// Report builder + approvals API regression test. Needs the API running and the seed users.
//   npm run reports:api-test
// Makes records named "__apitest …" and removes them; approval rules are put back as they were.
import assert from "node:assert/strict";

const A = `${process.env.API || "http://localhost:4001"}/api`;
const results = [];
const tokens = {};
async function login(email) {
  const r = await fetch(`${A}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: process.env.PASSWORD || "password123" }) });
  const j = await r.json();
  assert.equal(r.status, 200, `login ${email} failed`);
  return j.data;
}
async function call(who, method, url, body) {
  const res = await fetch(A + url, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, data: json?.data };
}
async function test(name, fn) {
  try { await fn(); results.push([true, name]); } catch (e) { results.push([false, name, `${e.message.split("\n").filter(Boolean).slice(0, 5).join(" | ")} (line ${(e.stack.match(/test\.mjs:(\d+)/) || [])[1]})`]); }
}
const stamp = Date.now().toString().slice(-6);
const made = { leads: [], reports: [], quotes: [] };

const admin = await login("priya@greenwood.edu"); tokens.admin = admin.token;
const mgr = await login("rahul@greenwood.edu"); tokens.mgr = mgr.token;
const cns = await login("ananya@greenwood.edu"); tokens.cns = cns.token;
const originalRules = (await call("admin", "GET", "/crm/approvals/rules")).data.rules;

/* ───────────── reports ───────────── */
await test("reports: auth and meta", async () => {
  assert.equal((await call(null, "POST", "/crm/reports/run", {})).status, 401);
  const m = await call("admin", "GET", "/crm/reports/meta");
  assert.equal(m.status, 200);
  const keys = m.data.sources.map((s) => s.key);
  for (const k of ["leads", "followups", "applications", "deals", "quotes", "submissions", "fees", "queries", "activities"]) assert.ok(keys.includes(k), k);
  const leads = m.data.sources.find((s) => s.key === "leads");
  assert.ok(leads.fields.find((f) => f.key === "status").options.length > 0, "status options");
});

let lead;
await test("reports: summary by source, totals, date buckets, filters", async () => {
  lead = (await call("admin", "POST", "/leads", { name: `__apitest Report ${stamp}`, phone: `+9197${stamp}01`, course: `__RPT${stamp}`, value: 12345, owner: "Rahul Bhatt" })).data.lead;
  made.leads.push(lead._id);
  const r = await call("admin", "POST", "/crm/reports/run", { source: "leads", mode: "summary", period: { preset: "all" }, groupBy: [{ field: "course" }], filters: [{ field: "course", op: "eq", value: `__RPT${stamp}` }], measures: [{ agg: "count" }, { agg: "sum", field: "value" }] });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.data.rows.length, 1);
  assert.equal(r.data.rows[0].m0, 1);
  assert.equal(r.data.rows[0].m1, 12345);
  assert.equal(r.data.totals.m1, 12345);
  const month = await call("admin", "POST", "/crm/reports/run", { source: "leads", period: { preset: "this_month" }, groupBy: [{ field: "createdAt", bucket: "month" }], measures: [{ agg: "count" }] });
  assert.match(month.data.rows[0].g0, /^\d{4}-\d{2}$/);
  const kpi = await call("admin", "POST", "/crm/reports/run", { source: "leads", mode: "summary", period: { preset: "this_month" }, compare: true, measures: [{ agg: "count" }] });
  assert.equal(kpi.data.rows.length, 1);
  assert.ok(kpi.data.previous && typeof kpi.data.previous.m0 === "number", "previous period");
});

await test("reports: list mode with columns, sort and paging", async () => {
  const r = await call("admin", "POST", "/crm/reports/run", { source: "leads", mode: "list", period: { preset: "all" }, columns: ["name", "status", "owner", "value", "createdAt"], filters: [{ field: "name", op: "contains", value: `Report ${stamp}` }], sort: { by: "value", dir: "desc" } });
  assert.equal(r.status, 200);
  assert.equal(r.data.mode, "list");
  assert.equal(r.data.rows[0].name, `__apitest Report ${stamp}`);
  assert.ok(r.data.rows[0].status && r.data.rows[0].status !== "—", "status name, not id");
  assert.deepEqual(r.data.columns.map((c) => c.key), ["name", "status", "owner", "value", "createdAt"]);
});

await test("reports: bad input is refused", async () => {
  assert.equal((await call("admin", "POST", "/crm/reports/run", { source: "nope" })).status, 400);
  assert.equal((await call("admin", "POST", "/crm/reports/run", { source: "leads", groupBy: [{ field: "owner" }], measures: [{ agg: "sum", field: "name" }] })).status, 400, "sum of text");
  assert.equal((await call("admin", "POST", "/crm/reports/run", { source: "leads", mode: "list", filters: [{ field: "score", op: "gte", value: "abc" }] })).status, 400);
  // unknown fields are ignored, never read
  const r = await call("admin", "POST", "/crm/reports/run", { source: "leads", mode: "list", columns: ["passwordHash", "name"] });
  assert.deepEqual(r.data.columns.map((c) => c.key), ["name"]);
});

await test("reports: a counsellor only counts leads they may see", async () => {
  const spec = { source: "leads", mode: "summary", period: { preset: "all" }, measures: [{ agg: "count" }] };
  const all = (await call("admin", "POST", "/crm/reports/run", spec)).data.rows[0].m0;
  const mine = (await call("cns", "POST", "/crm/reports/run", spec)).data.rows[0]?.m0 || 0;
  assert.ok(mine <= all);
});

await test("reports: save, share, dashboard with widgets, edit rights", async () => {
  const s = await call("admin", "POST", "/crm/reports/saved", { kind: "report", name: `__apitest R ${stamp}`, spec: { source: "leads", groupBy: [{ field: "source" }] }, shared: false });
  assert.equal(s.status, 201); made.reports.push(s.data._id);
  assert.ok(!(await call("cns", "GET", "/crm/reports/saved?kind=report")).data.some((x) => x._id === s.data._id), "private report hidden");
  const d = await call("admin", "POST", "/crm/reports/saved", { kind: "dashboard", name: `__apitest D ${stamp}`, widgets: [{ type: "kpi", title: "Leads", spec: { source: "leads", measures: [{ agg: "count" }] } }, { type: "pie", w: 2, spec: { source: "deals", groupBy: [{ field: "stage" }] } }] });
  assert.equal(d.status, 201); made.reports.push(d.data._id);
  assert.equal(d.data.widgets.length, 2);
  assert.equal((await call("admin", "POST", "/crm/reports/saved", { kind: "dashboard", name: "x", widgets: [{ type: "kpi", spec: { source: "bad" } }] })).status, 400);
  assert.equal((await call("cns", "PATCH", `/crm/reports/saved/${d.data._id}`, { name: "hacked" })).status, 403);
  const up = await call("admin", "PATCH", `/crm/reports/saved/${d.data._id}`, { widgets: [...d.data.widgets, { type: "table", w: 4, spec: { source: "leads", groupBy: [{ field: "owner" }] } }] });
  assert.equal(up.data.widgets.length, 3);
});

/* ───────────── approvals ───────────── */
let fee;
await test("approvals: rules save (admins only)", async () => {
  assert.equal((await call("cns", "PUT", "/crm/approvals/rules", {})).status, 403);
  const r = await call("admin", "PUT", "/crm/approvals/rules", { approvers: ["Rahul Bhatt"], fee_discount: { autoUpTo: 100, level2Above: 1000, level2Users: ["Ananya Saxena"] }, refund: { enabled: true, level2Above: 0 }, quote_discount: { enabled: true, maxPct: 10 } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.data.fee_discount.autoUpTo, 100);
  assert.equal(r.data.quote_discount.maxPct, 10);
});

await test("approvals: concession under the limit is applied at once", async () => {
  fee = (await call("admin", "POST", `/leads/${lead._id}/fees`, { title: `__apitest fee ${stamp}`, amount: 5000 })).data;
  assert.ok(fee?._id, "fee created");
  const r = await call("mgr", "POST", `/lead-fees/${fee._id}/discount-request`, { amount: 50, reason: "Sibling" });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.data.auto, true);
  assert.equal(r.data.status, "approved");
});

await test("approvals: one approver; own request cannot be approved; reject needs a reason", async () => {
  const r = await call("mgr", "POST", `/lead-fees/${fee._id}/discount-request`, { amount: 500, reason: "Merit" });
  assert.equal(r.status, 201);
  assert.equal(r.data.status, "pending");
  assert.equal(r.data.levels, 1);
  assert.equal((await call("mgr", "POST", `/crm/approvals/${r.data._id}/decide`, { approve: true })).status, 403, "own request");
  assert.equal((await call("admin", "POST", `/crm/approvals/${r.data._id}/decide`, { approve: false })).status, 400, "reason needed");
  const mine = await call("admin", "GET", "/crm/approvals?box=mine");
  assert.ok(mine.data.items.some((a) => a._id === r.data._id && a.canDecide));
  const ok1 = await call("admin", "POST", `/crm/approvals/${r.data._id}/decide`, { approve: true, note: "OK" });
  assert.equal(ok1.data.status, "approved");
  const fees = (await call("admin", "GET", `/leads/${lead._id}/fees`)).data;
  const f = (fees.fees || fees).find((x) => x._id === fee._id);
  assert.equal(f.discount, 550);
});

await test("approvals: big concession needs two people", async () => {
  const r = await call("mgr", "POST", `/lead-fees/${fee._id}/discount-request`, { amount: 2000, reason: "Scholarship" });
  assert.equal(r.data.levels, 2);
  const s1 = await call("admin", "POST", `/crm/approvals/${r.data._id}/decide`, { approve: true });
  assert.equal(s1.data.status, "pending");
  assert.equal(s1.data.level, 2);
  assert.equal((await call("admin", "POST", `/crm/approvals/${r.data._id}/decide`, { approve: true })).status, 403, "level 1 approver is not asked again");
  const s2 = await call("cns", "POST", `/crm/approvals/${r.data._id}/decide`, { approve: true, note: "Fine" });
  assert.equal(s2.status, 200, JSON.stringify(s2.json));
  assert.equal(s2.data.status, "approved");
  assert.equal(s2.data.trail.length, 2);
});

await test("approvals: withdraw a request", async () => {
  const r = await call("mgr", "POST", `/lead-fees/${fee._id}/discount-request`, { amount: 300, reason: "Try" });
  assert.equal((await call("admin", "POST", `/crm/approvals/${r.data._id}/cancel`)).status, 403);
  const c = await call("mgr", "POST", `/crm/approvals/${r.data._id}/cancel`);
  assert.equal(c.data.status, "cancelled");
});

await test("approvals: refund needs approval, applied when approved", async () => {
  await call("admin", "POST", `/lead-fees/${fee._id}/pay`, { amount: 1000, mode: "Cash" });
  const req = await call("mgr", "POST", `/lead-fees/${fee._id}/refund-request`, { amount: 400, reason: "Overpaid" });
  assert.equal(req.status, 201, JSON.stringify(req.json));
  assert.equal(req.data.approval.status, "pending");
  const ok1 = await call("admin", "POST", `/crm/approvals/${req.data.approval._id}/decide`, { approve: true });
  assert.equal(ok1.data.status, "approved");
  const fees = (await call("admin", "GET", `/leads/${lead._id}/fees`)).data;
  const f = (fees.fees || fees).find((x) => x._id === fee._id);
  assert.equal((f.refunds || []).reduce((a, x) => a + x.amount, 0), 400);
});

await test("approvals: quotation with a big discount cannot be sent until approved", async () => {
  const q = await call("admin", "POST", "/crm/quotes", { customer: { name: `__apitest Q ${stamp}` }, items: [{ name: "Thing", qty: 1, price: 1000, discountPct: 20 }] });
  assert.equal(q.status, 201); made.quotes.push(q.data._id);
  const s = await call("admin", "POST", `/crm/quotes/${q.data._id}/send`, { channel: "link" });
  assert.equal(s.status, 409);
  assert.equal(s.json.details.needsApproval, true);
  const a = await call("admin", "POST", `/crm/quotes/${q.data._id}/request-approval`, { reason: "Big order" });
  assert.equal(a.status, 201, JSON.stringify(a.json));
  const ok1 = await call("mgr", "POST", `/crm/approvals/${a.data.approval._id}/decide`, { approve: true });
  assert.equal(ok1.status, 200, JSON.stringify(ok1.json));
  assert.equal((await call("admin", "POST", `/crm/quotes/${q.data._id}/send`, { channel: "link" })).status, 200, "sends after approval");
});

/* ───────────── clean up ───────────── */
await call("admin", "PUT", "/crm/approvals/rules", originalRules);
for (const id of made.quotes) await call("admin", "DELETE", `/crm/quotes/${id}`);
for (const id of made.reports) await call("admin", "DELETE", `/crm/reports/saved/${id}`);
for (const id of made.leads) await call("admin", "DELETE", `/leads/${id}`);

const failed = results.filter((x) => !x[0]);
for (const [pass, name, why] of results) console.log(`${pass ? "✔" : "✘"} ${name}${why ? `\n    ${why}` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
