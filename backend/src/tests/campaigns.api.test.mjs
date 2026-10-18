// Bulk campaigns (recipient lists, audiences, report, resend) API regression test. Needs the API running.
//   node src/tests/campaigns.api.test.mjs     (defaults: http://localhost:4001, the seed admin)
// Nothing is launched (no WhatsApp message is sent). Everything it creates starts with "__apitest" and is deleted at the end.
import assert from "node:assert/strict";

const BASE = process.env.API || "http://localhost:4001";
const A = `${BASE}/api`;
let token = "";
const results = [];
async function call(method, url, body, headers = {}) {
  const res = await fetch(A + url, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token && headers.auth !== false ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, data: json?.data };
}
async function test(name, fn) {
  try { await fn(); results.push([true, name]); } catch (e) { results.push([false, name, e.message.split("\n").slice(0, 4).join(" | ")]); }
}
const stamp = Date.now().toString().slice(-6);
const made = { lists: [], campaigns: [] };

const login = await call("POST", "/auth/login", { email: process.env.EMAIL || "priya@greenwood.edu", password: process.env.PASSWORD || "password123" });
assert.equal(login.status, 200, "login failed — is the API running and are the credentials right?");
token = login.data.token;

await test("auth: routes refuse a missing token", async () => {
  for (const p of ["/campaigns", "/campaign-lists"]) assert.equal((await call("GET", p, undefined, { auth: false })).status, 401, p);
});

const rows = [
  { name: "A One", phone: `+91 98${stamp}01`, extra: { City: "Pune" } },
  { name: "B Two", phone: `98${stamp}02`, extra: { City: "Delhi" } },
  { name: "Dup", phone: `+9198${stamp}02` },          // same last 10 digits as B
  { name: "Bad", phone: "12" },                         // invalid
];
let list;
await test("lists: dry run counts valid / invalid / duplicates without saving", async () => {
  const r = await call("POST", "/campaign-lists/import", { name: `__apitest list ${stamp}`, columns: ["City"], rows, dryRun: true });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.data.summary, { valid: 2, invalid: 1, duplicates: 1 });
  const all = await call("GET", "/campaign-lists");
  assert.ok(!all.data.some((l) => l.name === `__apitest list ${stamp}`));
});
await test("lists: import saves the list with extra columns", async () => {
  const r = await call("POST", "/campaign-lists/import", { name: `__apitest list ${stamp}`, fileName: "x.csv", columns: ["City"], rows });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  list = r.data.list; made.lists.push(list._id);
  assert.equal(list.count, 2);
  assert.equal(list.rows, undefined, "rows are not returned in the summary");
  const g = await call("GET", `/campaign-lists/${list._id}?q=delhi`);
  assert.equal(g.data.total, 1, "search covers name / phone / contact fields");
  const g2 = await call("GET", `/campaign-lists/${list._id}`);
  assert.equal(g2.data.rows.find((x) => x.name === "A One").extra.City, "Pune");
});
await test("lists: same name refused, empty file refused", async () => {
  assert.equal((await call("POST", "/campaign-lists/import", { name: `__apitest list ${stamp}`, rows })).status, 409);
  assert.equal((await call("POST", "/campaign-lists/import", { name: `__apitest other ${stamp}`, rows: [{ phone: "1" }] })).status, 400);
});
await test("lists: append skips numbers already in the list", async () => {
  const r = await call("POST", `/campaign-lists/${list._id}/append`, { rows: [{ name: "C", phone: `98${stamp}03` }, { name: "B again", phone: `98${stamp}02` }] });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.data.count, 3);
  assert.equal(r.data.summary.duplicates, 1);
});
await test("lists: remove one number, rename", async () => {
  const r = await call("DELETE", `/campaign-lists/${list._id}/rows/${encodeURIComponent(`98${stamp}03`)}`);
  assert.equal(r.data.count, 2);
  const n = await call("PATCH", `/campaign-lists/${list._id}`, { name: `__apitest list ${stamp} b` });
  assert.equal(n.status, 200);
});

await test("lists: source from the Source master, set / filter / clear, bad id refused", async () => {
  const srcs = await call("GET", "/campaign-lists/sources");
  assert.equal(srcs.status, 200, JSON.stringify(srcs.json));
  assert.equal((await call("PATCH", `/campaign-lists/${list._id}`, { source: "000000000000000000000000" })).status, 400);
  if (!srcs.data.length) return;
  const sid = srcs.data[0]._id;
  const p = await call("PATCH", `/campaign-lists/${list._id}`, { source: sid });
  assert.equal(p.status, 200, JSON.stringify(p.json));
  assert.equal(p.data.source.name, srcs.data[0].name);
  const f = await call("GET", `/campaign-lists?source=${sid}`);
  assert.ok(f.data.some((l) => l._id === list._id));
  const ap = await call("POST", `/campaign-lists/${list._id}/append`, { columns: ["Father Name", "City"], rows: [{ name: "Manual", phone: `98${stamp}09`, extra: { "Father Name": "R K", City: "Agra" } }] });
  assert.equal(ap.data.summary.valid, 1);
  const g = await call("GET", `/campaign-lists/${list._id}?q=agra`);
  assert.equal(g.data.rows[0].extra["Father Name"], "R K");
  await call("DELETE", `/campaign-lists/${list._id}/rows/${encodeURIComponent(`98${stamp}09`)}`);
  assert.equal((await call("PATCH", `/campaign-lists/${list._id}`, { source: null })).data.source, null);
});

await test("lists: create an empty list with source + owner (employees only), edit owner", async () => {
  const owners = await call("GET", "/campaign-lists/owners");
  assert.equal(owners.status, 200, JSON.stringify(owners.json));
  assert.ok(owners.data.length > 0);
  assert.equal((await call("POST", "/campaign-lists", { name: `__apitest bad ${stamp}`, owner: "000000000000000000000000" })).status, 400);
  const c = await call("POST", "/campaign-lists", { name: `__apitest empty ${stamp}`, owner: owners.data[0]._id });
  assert.equal(c.status, 201, JSON.stringify(c.json));
  made.lists.push(c.data._id);
  assert.equal(c.data.count, 0);
  assert.equal(c.data.owner.name, owners.data[0].name);
  assert.equal((await call("POST", "/campaign-lists", { name: `__apitest empty ${stamp}` })).status, 409);
  const ap = await call("POST", `/campaign-lists/${c.data._id}/append`, { columns: ["City"], rows: [{ name: "X", phone: `98${stamp}11`, extra: { City: "Agra" } }] });
  assert.equal(ap.data.count, 1);
  const f = await call("GET", `/campaign-lists?owner=${owners.data[0]._id}`);
  assert.ok(f.data.some((l) => l._id === c.data._id));
  assert.equal((await call("PATCH", `/campaign-lists/${c.data._id}`, { owner: null })).data.owner, null);
});

const tpls = (await call("GET", "/templates?status=Approved&perPage=200")).data || [];
const tpl = tpls.find((t) => !t.channel || t.channel === "whatsapp");
let camp;
if (!tpl) results.push([true, "campaigns: skipped (no approved WhatsApp template)"]);
else {
  await test("campaigns: create validates name, template and list", async () => {
    assert.equal((await call("POST", "/campaigns", { name: "", template: tpl.name, audienceType: "list", audienceRef: list._id })).status, 400);
    assert.equal((await call("POST", "/campaigns", { name: "x", template: "__nope", audienceType: "list", audienceRef: list._id })).status, 400);
    assert.equal((await call("POST", "/campaigns", { name: "x", template: tpl.name, audienceType: "list", audienceRef: "000000000000000000000000" })).status, 400);
  });
  await test("campaigns: draft to an imported list shows in the list with live counts", async () => {
    const r = await call("POST", "/campaigns", { name: `__apitest camp ${stamp}`, template: tpl.name, audienceType: "list", audienceRef: list._id, variables: [{ source: "column", value: "City" }] });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    camp = r.data.campaign; made.campaigns.push(camp._id);
    assert.equal(camp.audienceLabel, `__apitest list ${stamp} b`);
    assert.equal(camp.status, "Draft");
    const l = await call("GET", `/campaigns?q=__apitest camp ${stamp}`);
    const row = l.data.find((c) => c._id === camp._id);
    assert.ok(row && row.sent === 0 && row.read === 0 && row.resends === 0);
  });
  await test("campaigns: a list used by a draft cannot be deleted", async () => {
    assert.equal((await call("DELETE", `/campaign-lists/${list._id}`)).status, 409);
  });
  await test("report: draft has an empty report", async () => {
    const r = await call("GET", `/campaigns/${camp._id}/report`);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal(r.data.summary.sent, 0);
    assert.deepEqual(r.data.resends, []);
  });
  await test("resend: needs statuses; creates a linked draft that shows in the history", async () => {
    assert.equal((await call("POST", `/campaigns/${camp._id}/resend`, { statuses: [] })).status, 400);
    assert.equal((await call("POST", `/campaigns/${camp._id}/resend`, { statuses: ["failed"] })).status, 400, "name required");
    assert.equal((await call("POST", `/campaigns/${camp._id}/resend`, { statuses: ["failed"], name: `__APITEST CAMP ${stamp}` })).status, 409, "name must be new (any case)");
    const r = await call("POST", `/campaigns/${camp._id}/resend`, { statuses: ["failed", "bogus"], name: `__apitest resend ${stamp}` });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    made.campaigns.push(r.data.campaign._id);
    assert.equal(r.data.campaign.audienceType, "resend");
    assert.deepEqual(r.data.campaign.resendStatuses, ["failed"]);
    assert.equal(r.data.campaign.variables[0].value, "City", "keeps the original variables");
    const rep = await call("GET", `/campaigns/${camp._id}/report`);
    assert.equal(rep.data.resends.length, 1);
    const child = await call("GET", `/campaigns/${r.data.campaign._id}/report`);
    assert.equal(child.data.parent.name, `__apitest camp ${stamp}`);
    // nobody has failed yet, so launching it has no one to send to
    assert.equal((await call("POST", `/campaigns/${r.data.campaign._id}/launch`)).status, 400);
  });
  await test("campaigns: pause / resume only from the right state", async () => {
    assert.equal((await call("POST", `/campaigns/${camp._id}/pause`, { status: "Paused" })).status, 409);
    assert.equal((await call("POST", `/campaigns/${camp._id}/pause`, { status: "Running" })).status, 409);
  });
  await test("multi-list: preview counts unique numbers across lists", async () => {
    const l2 = await call("POST", "/campaign-lists/import", { name: `__apitest list2 ${stamp}`, rows: [{ name: "Dup A", phone: `98${stamp}01` }, { name: "New D", phone: `98${stamp}04` }] });
    assert.equal(l2.status, 201, JSON.stringify(l2.json));
    made.lists.push(l2.data.list._id);
    globalThis.list2 = l2.data.list;
    const one = await call("POST", "/campaigns/audience-preview", { audienceType: "list", audienceRefs: [list._id] });
    const both = await call("POST", "/campaigns/audience-preview", { audienceType: "list", audienceRefs: [list._id, list2._id] });
    assert.equal(one.status, 200, JSON.stringify(one.json));
    assert.equal(both.data.count, one.data.count + 1, "the shared number counts once");
    assert.equal(both.data.label, `__apitest list ${stamp} b + __apitest list2 ${stamp}`);
    const old = await call("POST", "/campaigns/audience-preview", { audienceType: "list", audienceRef: list._id });
    assert.equal(old.data.count, one.data.count, "single audienceRef still works");
  });
  await test("multi-list: validation", async () => {
    assert.equal((await call("POST", "/campaigns/audience-preview", { audienceType: "list", audienceRefs: [list._id, "000000000000000000000000"] })).status, 400);
    assert.equal((await call("POST", "/campaigns/audience-preview", { audienceType: "list", audienceRefs: ["bad"] })).status, 400);
    assert.equal((await call("POST", "/campaigns/audience-preview", { audienceType: "list", audienceRefs: Array.from({ length: 21 }, () => list._id + "") })).status, 200, "same id repeated is one list");
  });
  await test("multi-list: draft keeps every list; usage, delete guard and rename follow", async () => {
    const r = await call("POST", "/campaigns", { name: `__apitest multi ${stamp}`, template: tpl.name, audienceType: "list", audienceRefs: [list._id, list2._id] });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    const c = r.data.campaign; made.campaigns.push(c._id);
    assert.equal(c.audienceRefs.length, 2);
    assert.equal(c.audienceRef, list._id);
    const lists = (await call("GET", "/campaign-lists")).data;
    assert.ok(lists.find((l) => l._id === list2._id).campaigns >= 1, "second list counts the campaign");
    assert.equal((await call("DELETE", `/campaign-lists/${list2._id}`)).status, 409, "second list is protected too");
    await call("PATCH", `/campaign-lists/${list2._id}`, { name: `__apitest list3 ${stamp}` });
    const after = (await call("GET", `/campaigns?q=__apitest multi ${stamp}`)).data.find((x) => x._id === c._id);
    assert.equal(after.audienceLabel, `__apitest list ${stamp} b + __apitest list3 ${stamp}`);
    const toContacts = await call("PATCH", `/campaigns/${c._id}`, { audienceType: "contacts" });
    assert.equal(toContacts.status, 200);
    assert.deepEqual(toContacts.data.audienceRefs, [], "switching to contacts clears the lists");
  });
  await test("campaigns: edit a draft", async () => {
    const r = await call("PATCH", `/campaigns/${camp._id}`, { name: `__apitest camp ${stamp} b` });
    assert.equal(r.status, 200);
    assert.equal(r.data.name, `__apitest camp ${stamp} b`);
  });
}

// clean up
for (const id of made.campaigns.reverse()) await call("DELETE", `/campaigns/${id}`);
for (const id of made.lists) await call("DELETE", `/campaign-lists/${id}`);
await test("cleanup: test records removed", async () => {
  for (const id of made.lists) assert.equal((await call("GET", `/campaign-lists/${id}`)).status, 404);
});

const failed = results.filter((r) => !r[0]);
for (const [okk, name, err] of results) console.log(`${okk ? "✓" : "✗"} ${name}${err ? `\n    ${err}` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
