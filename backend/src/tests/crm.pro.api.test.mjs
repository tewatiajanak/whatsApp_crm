// Lead CRM (activity types, queries, lists, scoring, source history) API regression test. Needs the API running.
//   npm run crm:api-test                (defaults: http://localhost:4001, the seed admin)
//   API=… EMAIL=… PASSWORD=… npm run crm:api-test
// It creates leads and records whose names start with "__apitest" and deletes them at the end.
// No message is sent: query replies are saved without a channel.
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
const anon = { auth: false };
async function test(name, fn) {
  try { await fn(); results.push([true, name]); } catch (e) { results.push([false, name, `${e.message.split("\n").filter(Boolean).slice(0, 6).join(" | ")} (line ${(e.stack.match(/test\.mjs:(\d+)/) || [])[1]})`]); }
}
const stamp = Date.now().toString().slice(-6);
const tag = stamp.replace(/\d/g, (d) => "abcdefghij"[d]);
const phone = (n) => `+9190000${stamp}${n}`.slice(0, 15);
const made = { leads: [], types: [], queries: [], lists: [] };

const login = await call("POST", "/auth/login", { email: process.env.EMAIL || "priya@greenwood.edu", password: process.env.PASSWORD || "password123" });
assert.equal(login.status, 200, "login failed — is the API running and are the credentials right?");
token = login.data.token;
const me = login.data.user?.name;

await test("auth: new routes refuse a missing token", async () => {
  for (const p of ["/crm/activity-types", "/crm/queries", "/crm/lists", "/crm/scoring", "/crm/activities"]) assert.equal((await call("GET", p, undefined, anon)).status, 401, p);
});

let leadA, leadB;
await test("leads: two test leads, with a primary source", async () => {
  const sources = (await call("GET", "/masters/sources")).data || [];
  const src = sources[0]?._id;
  const a = await call("POST", "/leads", { name: `__apitest A ${tag}`, phone: phone(1), email: `a${stamp}@example.com`, course: "BBA", city: "Delhi", source: src });
  assert.equal(a.status, 201, JSON.stringify(a.json)); leadA = a.data.lead; made.leads.push(leadA._id);
  const b = await call("POST", "/leads", { name: `__apitest B ${tag}`, phone: phone(2) });
  assert.equal(b.status, 201, JSON.stringify(b.json)); leadB = b.data.lead; made.leads.push(leadB._id);
  const full = (await call("GET", `/leads/${leadA._id}`)).data;
  assert.equal(full.sourceHistory?.length, 1, "first enquiry is the primary source");
});

await test("source history: a repeat enquiry is recorded as a second source", async () => {
  const again = await call("POST", "/leads/convert", { name: `__apitest A ${tag}`, phone: phone(1), source: "Website", capturedFrom: "Website form" });
  assert.ok([200, 201].includes(again.status), JSON.stringify(again.json));
  const full = (await call("GET", `/leads/${leadA._id}`)).data;
  assert.equal(full.sourceHistory.length, 2);
  assert.equal(full.enquiryCount, 2);
});

let visit;
await test("activity types: create, validation, list", async () => {
  assert.equal((await call("POST", "/crm/activity-types", { name: "" })).status, 400);
  assert.equal((await call("POST", "/crm/activity-types", { name: `__apitest bad ${stamp}`, fields: [{ label: "Pick", type: "select", options: [] }] })).status, 400, "dropdown needs options");
  assert.equal((await call("POST", "/crm/activity-types", { name: `__apitest dup ${stamp}`, fields: [{ label: "X" }, { label: "x" }] })).status, 400, "same field twice");
  const r = await call("POST", "/crm/activity-types", { name: `__apitest Campus visit ${stamp}`, points: 15, color: "#10b981", icon: "building", fields: [{ label: "Visited with", type: "select", options: ["Parents", "Alone"], required: true }, { label: "Rating", type: "number" }, { label: "Took brochure", type: "yesno" }] });
  assert.equal(r.status, 201, JSON.stringify(r.json)); visit = r.data; made.types.push(visit._id);
  assert.equal(visit.fields[0].key, "visited_with");
  assert.equal((await call("POST", "/crm/activity-types", { name: `__apitest Campus visit ${stamp}` })).status, 409, "duplicate name");
  assert.ok((await call("GET", "/crm/activity-types")).data.some((t) => t._id === visit._id));
});

await test("activities: log on a lead — validation, timeline, score goes up", async () => {
  const before = (await call("GET", `/leads/${leadB._id}`)).data.score;
  assert.equal((await call("POST", `/leads/${leadB._id}/activities`, { typeId: visit._id, values: {} })).status, 400, "required field");
  assert.equal((await call("POST", `/leads/${leadB._id}/activities`, { typeId: visit._id, values: { visited_with: "Friends" } })).status, 400, "not an option");
  assert.equal((await call("POST", `/leads/${leadB._id}/activities`, { typeId: visit._id, values: { visited_with: "Parents", rating: "abc" } })).status, 400, "number");
  assert.equal((await call("POST", `/leads/${leadB._id}/activities`, { typeId: visit._id, date: "2099-01-01", values: { visited_with: "Parents" } })).status, 400, "future");
  const ok = await call("POST", `/leads/${leadB._id}/activities`, { typeId: visit._id, values: { visited_with: "Parents", rating: 4, took_brochure: true }, note: "Liked the labs" });
  assert.equal(ok.status, 201, JSON.stringify(ok.json));
  assert.ok(ok.data.score >= before + 15, `score ${before} → ${ok.data.score}`);
  const tl = (await call("GET", `/leads/${leadB._id}/timeline`)).data;
  const items = Array.isArray(tl) ? tl : tl.items || [];
  const entry = items.find((x) => x.type === "activity");
  assert.ok(entry, "on the timeline"); assert.match(entry.detail, /Visited with: Parents/); assert.match(entry.detail, /Took brochure: Yes/);
  const reg = await call("GET", `/crm/activities?type=${visit._id}`);
  assert.equal(reg.status, 200); assert.equal(reg.json.total, 1); assert.equal(reg.data[0].lead.name, leadB.name);
});

await test("activity types: one in use is switched off, not deleted", async () => {
  const del = await call("DELETE", `/crm/activity-types/${visit._id}`);
  assert.equal(del.status, 200); assert.equal(del.data.deactivated, true);
  assert.equal((await call("POST", `/leads/${leadB._id}/activities`, { typeId: visit._id, values: { visited_with: "Parents" } })).status, 400, "inactive type");
  assert.equal((await call("PATCH", `/crm/activity-types/${visit._id}`, { active: true, points: 10 })).data.points, 10);
});

let qry;
await test("queries: meta, create with SLA due time, validation", async () => {
  const meta = (await call("GET", "/crm/queries/meta")).data;
  assert.ok(meta.categories.length && meta.statuses.includes("open"));
  assert.equal((await call("POST", "/crm/queries", { subject: "" })).status, 400);
  assert.equal((await call("POST", "/crm/queries", { subject: "x" })).status, 400, "needs a lead or a name");
  assert.equal((await call("POST", "/crm/queries", { subject: "x", name: "y", assignedTo: "Nobody At All" })).status, 400);
  const cat = meta.categories[0];
  const r = await call("POST", "/crm/queries", { lead: leadA._id, subject: `__apitest Hostel fee ${stamp}`, category: cat.name, priority: "high", description: "What is the hostel fee?" });
  assert.equal(r.status, 201, JSON.stringify(r.json)); qry = r.data; made.queries.push(qry._id);
  assert.ok(qry.number > 1000); assert.equal(qry.status, "open"); assert.equal(qry.name, leadA.name);
  const hours = (new Date(qry.dueAt) - new Date(qry.createdAt)) / 3_600_000;
  assert.ok(Math.abs(hours - cat.slaHours) < 0.01, `due in ${hours}h, want ${cat.slaHours}h`);
  assert.equal(qry.messages.length, 1); assert.equal(qry.messages[0].fromCustomer, true);
});

await test("queries: reply, internal note, customer answer, status flow", async () => {
  assert.equal((await call("POST", `/crm/queries/${qry._id}/messages`, { text: "" })).status, 400);
  const note = await call("POST", `/crm/queries/${qry._id}/messages`, { text: "Check with accounts", internal: true });
  assert.equal(note.data.status, "open"); assert.equal(note.data.firstResponseAt, null, "a note is not a response");
  const reply = await call("POST", `/crm/queries/${qry._id}/messages`, { text: "It is 80,000 a year" });
  assert.equal(reply.status, 201); assert.equal(reply.data.status, "pending"); assert.ok(reply.data.firstResponseAt);
  const back = await call("POST", `/crm/queries/${qry._id}/messages`, { text: "Thanks, and the mess?", fromCustomer: true });
  assert.equal(back.data.status, "open");
  const res = await call("PATCH", `/crm/queries/${qry._id}`, { status: "resolved", priority: "low" });
  assert.equal(res.data.status, "resolved"); assert.ok(res.data.resolvedAt); assert.equal(res.data.overdue, false);
  assert.ok(res.data.messages.some((m) => m.channel === "system" && /Status: resolved/.test(m.text)));
  assert.equal((await call("GET", `/leads/${leadA._id}/queries`)).data.length, 1);
  const tl = (await call("GET", `/leads/${leadA._id}/timeline`)).data;
  assert.ok((Array.isArray(tl) ? tl : tl.items || []).some((x) => x.type === "query"));
});

await test("queries: list with filters, search by number, stats", async () => {
  const r = await call("GET", `/crm/queries?q=%23${qry.number}`);
  assert.equal(r.status, 200); assert.equal(r.json.total, 1); assert.equal(r.data[0].messages, undefined, "list leaves the thread out");
  assert.ok(r.json.stats && typeof r.json.stats.overdue === "number");
  assert.equal((await call("GET", `/crm/queries?status=active&q=%23${qry.number}`)).json.total, 0);
  assert.equal((await call("GET", "/crm/queries/64b000000000000000000001")).status, 404);
  assert.equal((await call("PATCH", `/crm/queries/${qry._id}`, { assignedTo: "Nobody At All" })).status, 400);
});

let staticList, smartList;
await test("lists: static list from picked leads, add / remove members", async () => {
  assert.equal((await call("POST", "/crm/lists", { name: "" })).status, 400);
  const r = await call("POST", "/crm/lists", { name: `__apitest static ${stamp}`, leadIds: [leadA._id] });
  assert.equal(r.status, 201, JSON.stringify(r.json)); staticList = r.data; made.lists.push(staticList._id);
  assert.equal(r.data.count, 1);
  const add = await call("POST", `/crm/lists/${staticList._id}/members`, { leadIds: [leadA._id, leadB._id] });
  assert.equal(add.data.count, 2); assert.equal(add.data.changed, 1, "no duplicates");
  const view = await call("GET", `/crm/lists/${staticList._id}`);
  assert.equal(view.json.total, 2);
  assert.equal((await call("GET", `/leads?list=${staticList._id}`)).json.total, 2, "leads list filters by list");
  assert.equal((await call("GET", `/leads/${leadB._id}/lists`)).data.length, 1);
  const rm = await call("POST", `/crm/lists/${staticList._id}/members`, { leadIds: [leadB._id], remove: true });
  assert.equal(rm.data.count, 1);
  assert.equal((await call("POST", "/crm/lists", { name: `__apitest static ${stamp}` })).status, 409, "duplicate name");
});

await test("lists: smart list follows its filters", async () => {
  assert.equal((await call("POST", "/crm/lists", { name: `__apitest smart x ${stamp}`, kind: "dynamic", filters: {} })).status, 400);
  const r = await call("POST", "/crm/lists", { name: `__apitest smart ${stamp}`, kind: "dynamic", filters: { q: `__apitest A ${tag}`, bogus: "x" } });
  assert.equal(r.status, 201, JSON.stringify(r.json)); smartList = r.data; made.lists.push(smartList._id);
  assert.deepEqual(Object.keys(r.data.filters), ["q"], "unknown filters dropped");
  assert.equal((await call("GET", `/crm/lists/${smartList._id}`)).json.total, 1);
  assert.equal((await call("POST", `/crm/lists/${smartList._id}/members`, { leadIds: [leadB._id] })).status, 400);
  await call("PATCH", `/crm/lists/${smartList._id}`, { filters: { q: `__apitest B ${tag}` } });
  const after = await call("GET", `/crm/lists/${smartList._id}`);
  assert.equal(after.json.total, 1); assert.equal(after.data[0]._id, leadB._id);
  const all = (await call("GET", "/crm/lists")).data;
  assert.equal(all.find((l) => l._id === smartList._id).count, 1);
});

await test("scoring: read, save, refuse warm ≥ hot, restore", async () => {
  const s = (await call("GET", "/crm/scoring")).data;
  assert.equal(typeof s.weights.hot, "number"); assert.ok(Array.isArray(s.bands));
  const was = s.weights;
  assert.equal((await call("PUT", "/crm/settings", { scoring: { hot: 30, warm: 50 } })).status, 400);
  const saved = await call("PUT", "/crm/settings", { scoring: { email: 9 } });
  assert.equal(saved.status, 200); assert.equal(saved.data.scoring.email, 9);
  assert.equal((await call("PUT", "/crm/settings", { scoring: { email: was.email } })).data.scoring.email, was.email);
});

await test("query settings: categories saved, duplicates refused", async () => {
  const was = (await call("GET", "/crm/settings")).data.queries;
  assert.equal((await call("PUT", "/crm/settings", { queries: { categories: [{ name: "A" }, { name: "a" }] } })).status, 400);
  const r = await call("PUT", "/crm/settings", { queries: { categories: [...was.categories, { name: "__apitest cat", slaHours: 6 }] } });
  assert.equal(r.status, 200); assert.ok(r.data.queries.categories.some((c) => c.name === "__apitest cat" && c.slaHours === 6));
  await call("PUT", "/crm/settings", { queries: { categories: was.categories } });
});

// clean up everything this run made
for (const id of made.lists) await call("DELETE", `/crm/lists/${id}`);
for (const id of made.leads) await call("DELETE", `/leads/${id}`);
// leftovers of an earlier run that stopped half way
for (const l of (await call("GET", "/leads?q=__apitest&perPage=200")).data || []) await call("DELETE", `/leads/${l._id}`);
for (const l of (await call("GET", "/crm/lists")).data || []) if (l.name.startsWith("__apitest")) await call("DELETE", `/crm/lists/${l._id}`);
for (const q of (await call("GET", "/crm/queries?q=__apitest&perPage=200")).data || []) await call("DELETE", `/crm/queries/${q._id}`);
const bin = (await call("GET", "/crm/trash")).data?.items || [];
for (const t of bin.filter((x) => String(x.name).startsWith("__apitest"))) await call("DELETE", `/crm/trash/${t._id}`);
for (const t of (await call("GET", "/crm/activity-types")).data || []) if (t.name.startsWith("__apitest")) await call("DELETE", `/crm/activity-types/${t._id}`);
for (const id of made.queries) await call("DELETE", `/crm/queries/${id}`);

const failed = results.filter((r) => !r[0]);
for (const [pass, name, why] of results) console.log(`${pass ? "✓" : "✗"} ${name}${why ? `\n    ${why}` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
