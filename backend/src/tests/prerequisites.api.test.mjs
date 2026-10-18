// Pre-requisites (Setup › Implementation) API regression test. Needs the API running.
//   node src/tests/prerequisites.api.test.mjs     (defaults: http://localhost:4001, the seed admin)
// The tenant's pre-requisite record is snapshotted in Mongo first and restored at the end.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const BASE = process.env.API || "http://localhost:4001";
const A = `${BASE}/api`;
const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  fs.readFileSync(path.join(here, "../../.env"), "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
let token = "";
const results = [];
async function call(method, url, body, opts = {}) {
  const res = await fetch(A + url, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token && opts.auth !== false ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json, data: json?.data };
}
async function test(name, fn) {
  try { await fn(); results.push([true, name]); } catch (e) { results.push([false, name, e.message.split("\n").slice(0, 4).join(" | ")]); }
}

const login = await call("POST", "/auth/login", { email: process.env.EMAIL || "priya@greenwood.edu", password: process.env.PASSWORD || "password123" });
assert.equal(login.status, 200, "login failed — is the API running?");
token = login.data.token;
const tenantId = login.data.user.tenant;

// snapshot this tenant's record so the test leaves real data as it was
const mongo = new MongoClient(env.MONGO_URI);
await mongo.connect();
const col = mongo.db().collection("prerequisites");
const { ObjectId } = await import("mongodb");
const tenantOid = new ObjectId(String(tenantId));
const snapshot = await col.findOne({ tenant: tenantOid });
await col.deleteOne({ tenant: tenantOid });

const pub = (t, method = "GET", body) => call(method, `/public/prereq/${t}`, body, { auth: false });
const sample = (name) => ({ activeSection: "institute", sub: {}, institute: { name, employees: [{ name: "Asha Rao", role: "Admin" }, { name: "" }] }, branches: [{ id: "br1", name: "North" }], enquiryStages: [{ stage: "New" }], appProcess: { stages: [{ id: "st1", name: "Basic", fields: [{ id: "fd1" }, { id: "fd2" }] }] }, faqs: [{ q: "Q", a: "A" }, { q: "Q2", a: "" }], templates: [{ sms: "x" }, {}] });
let rec, T;

await test("auth: admin routes refuse a missing token", async () => {
  for (const p of ["/prerequisites", "/prerequisites/data"]) assert.equal((await call("GET", p, undefined, { auth: false })).status, 401, p);
});

await test("admin: first view creates the record with a 40-hex token and a link on the given origin", async () => {
  const r = await call("GET", "/prerequisites?origin=http://localhost:5173");
  assert.equal(r.status, 200, JSON.stringify(r.json));
  rec = r.data; T = rec.token;
  assert.match(T, /^[0-9a-f]{40}$/);
  assert.equal(rec.link, `http://localhost:5173/prerequisites/${T}`);
  assert.equal(rec.state, "Not started");
  assert.equal(rec.sections.length, 14);
  assert.deepEqual(rec.progress, { done: 0, total: 13 });
  const again = await call("GET", "/prerequisites");
  assert.equal(again.data.token, T, "same record on the next view");
});

await test("public: bad / unknown token → 404", async () => {
  assert.equal((await pub("abc")).status, 404);
  assert.equal((await pub("0".repeat(40))).status, 404);
});

await test("public: opening the link marks it Opened; no data yet", async () => {
  const r = await pub(T);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.data.status, "draft");
  assert.equal(r.data.data, null);
  assert.equal((await call("GET", "/prerequisites")).data.state, "Opened");
});

await test("public: saving needs form data", async () => {
  assert.equal((await pub(T, "PUT", {})).status, 400);
  assert.equal((await pub(T, "PUT", { data: [] })).status, 400);
  assert.equal((await pub(T, "PUT", { data: { nope: 1 } })).status, 400);
});

await test("public: autosave (no section) keeps data but marks nothing received", async () => {
  const r = await pub(T, "PUT", { data: sample("Draft School") });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const a = (await call("GET", "/prerequisites")).data;
  assert.equal(a.state, "In progress");
  assert.equal(a.progress.done, 0);
});

await test("public: Save & Next on a section marks it received; unknown section ignored", async () => {
  await pub(T, "PUT", { data: sample("Greenwood High"), section: "institute" });
  const r = await pub(T, "PUT", { data: sample("Greenwood High"), section: "appProcess" });
  assert.ok(r.data.sections.institute && r.data.sections.appProcess);
  await pub(T, "PUT", { data: sample("Greenwood High"), section: "hacker" });
  const a = (await call("GET", "/prerequisites")).data;
  assert.equal(a.progress.done, 2);
  const inst = a.sections.find((s) => s.key === "institute");
  assert.equal(inst.summary, "Greenwood High · 1 employee");
  assert.equal(a.sections.find((s) => s.key === "appProcess").summary, "1 stages · 2 fields");
  assert.equal(a.sections.find((s) => s.key === "branches").savedAt, null);
  assert.ok(!("hacker" in (r.data.sections || {})));
});

await test("public: resuming the link returns what was saved", async () => {
  const r = await pub(T);
  assert.equal(r.data.data.institute.name, "Greenwood High");
  assert.ok(r.data.sections.institute);
});

await test("public: very large payload refused (413)", async () => {
  const big = sample("Big"); big.notes = "x".repeat(2_100_000);
  assert.equal((await pub(T, "PUT", { data: big })).status, 413);
});

await test("admin: client URL is normalised and used for the link; bad URL refused", async () => {
  const r = await call("PATCH", "/prerequisites", { clientUrl: "DPS.knowvato.in/some/path/" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.data.clientUrl, "https://dps.knowvato.in");
  assert.equal(r.data.link, `https://dps.knowvato.in/prerequisites/${T}`);
  assert.equal((await call("PATCH", "/prerequisites", { clientUrl: "http://exa mple" })).status, 400);
});

await test("admin: email validation", async () => {
  assert.equal((await call("POST", "/prerequisites/send", { to: "", subject: "s", body: "b" })).status, 400);
  assert.equal((await call("POST", "/prerequisites/send", { to: "not-an-email", subject: "s", body: "b" })).status, 400);
  assert.equal((await call("POST", "/prerequisites/send", { to: "a@b.co", subject: "", body: "b" })).status, 400);
  assert.equal((await call("POST", "/prerequisites/send", { to: "a@b.co", subject: "s", body: "" })).status, 400);
});

await test("admin: email sends to each address, fills placeholders and is logged", async () => {
  const r = await call("POST", "/prerequisites/send", { to: "one@example.com, two@example.com", name: "Mr Rao", subject: "{{institute}} set-up", body: "Hi {{name}}" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.data.sent, 2);
  const a = (await call("GET", "/prerequisites")).data;
  assert.equal(a.sends.length, 2);
  assert.ok(!a.sends[0].subject.includes("{{"), "subject placeholders filled");
  assert.deepEqual(a.sends.map((s) => s.to), ["one@example.com", "two@example.com"]);
});

await test("public: final submit needs a name", async () => {
  assert.equal((await call("POST", `/public/prereq/${T}/submit`, { data: sample("Greenwood High") }, { auth: false })).status, 400);
  assert.equal((await call("POST", `/public/prereq/${T}/submit`, { data: sample("Greenwood High"), name: "A", email: "bad" }, { auth: false })).status, 400);
});

await test("public: final submit locks the form", async () => {
  const r = await call("POST", `/public/prereq/${T}/submit`, { data: sample("Greenwood Final"), name: "Principal", email: "p@school.in" }, { auth: false });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.data.status, "submitted");
  assert.equal(r.data.submittedBy.name, "Principal");
  assert.equal((await pub(T, "PUT", { data: sample("Changed") })).status, 409, "no edits after submit");
  assert.equal((await call("POST", `/public/prereq/${T}/submit`, { name: "X" }, { auth: false })).status, 409, "no second submit");
  const a = (await call("GET", "/prerequisites")).data;
  assert.equal(a.state, "Submitted");
  assert.equal(a.submittedBy.email, "p@school.in");
  const view = (await pub(T)).data;
  assert.equal(view.data.institute.name, "Greenwood Final");
});

await test("admin: can read the client's answers", async () => {
  const r = await call("GET", "/prerequisites/data");
  assert.equal(r.status, 200);
  assert.equal(r.data.status, "submitted");
  assert.equal(r.data.data.institute.name, "Greenwood Final");
});

await test("admin: reopen unlocks; reopen on a draft is refused", async () => {
  const r = await call("POST", "/prerequisites/reopen", {});
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.data.status, "draft");
  assert.equal((await pub(T, "PUT", { data: sample("Edited again"), section: "fee" })).status, 200);
  assert.equal((await call("POST", "/prerequisites/reopen", {})).status, 409);
});

await test("admin: new link replaces the old one and keeps the answers", async () => {
  const r = await call("POST", "/prerequisites/regenerate", {});
  assert.equal(r.status, 200);
  const T2 = r.data.token;
  assert.notEqual(T2, T);
  assert.equal((await pub(T)).status, 404, "old link stops working");
  const v = await pub(T2);
  assert.equal(v.status, 200);
  assert.equal(v.data.data.institute.name, "Edited again");
  T = T2;
});

await test("tenant isolation: the public payload carries no internal ids", async () => {
  const v = (await pub(T)).data;
  assert.ok(!("tenant" in v) && !("_id" in v) && !("token" in v) && !("sends" in v));
});

// restore
await col.deleteOne({ tenant: tenantOid });
if (snapshot) await col.insertOne(snapshot);
await mongo.close();

for (const [okk, name, msg] of results) console.log(`${okk ? "✓" : "✗"} ${name}${okk ? "" : `\n    ${msg}`}`);
const passed = results.filter((r) => r[0]).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
