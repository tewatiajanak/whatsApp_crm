// CRM Forms + Sales (companies, deals, products, quotations) API regression test. Needs the API running.
//   npm run forms:api-test                (defaults: http://localhost:4001, the seed admin)
//   API=… EMAIL=… PASSWORD=… npm run forms:api-test
// Everything it makes is named "__apitest …" and deleted at the end. Emails go out only if SMTP is live; none are addressed to real people.
import assert from "node:assert/strict";

const BASE = process.env.API || "http://localhost:4001";
const A = `${BASE}/api`;
let token = "";
const results = [];
async function call(method, url, body, headers = {}) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(A + url, {
    method,
    headers: { ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}), ...(token && headers.auth !== false ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
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
const phone = (n) => `+9198${stamp}${String(n).padStart(2, "0")}`.slice(0, 13);
const made = { regs: [], forms: [], leads: [], companies: [], deals: [], products: [], quotes: [], stages: [] };

const login = await call("POST", "/auth/login", { email: process.env.EMAIL || "priya@greenwood.edu", password: process.env.PASSWORD || "password123" });
assert.equal(login.status, 200, "login failed — is the API running and are the credentials right?");
token = login.data.token;

await test("auth: new routes refuse a missing token", async () => {
  for (const p of ["/crm/forms", "/crm/companies", "/crm/deals", "/crm/products", "/crm/quotes", "/crm/deal-stages"]) assert.equal((await call("GET", p, undefined, anon)).status, 401, p);
});

/* ───────────── forms ───────────── */
let form, slug;
await test("forms: templates list and create from the admission template", async () => {
  const t = await call("GET", "/crm/forms/templates");
  assert.equal(t.status, 200);
  assert.ok(t.data.some((x) => x.key === "admission"));
  const c = await call("POST", "/crm/forms", { template: "enquiry", name: `__apitest Enquiry ${stamp}` });
  assert.equal(c.status, 201, JSON.stringify(c.json));
  form = c.data; slug = form.slug; made.forms.push(form._id);
  assert.equal(form.status, "draft");
  assert.ok(form.pages[0].fields.some((f) => f.map === "phone"));
});

await test("forms: a draft form is not open to the public", async () => {
  const p = await call("GET", `/public/forms/${slug}`, undefined, anon);
  assert.equal(p.status, 200);
  assert.equal(p.data.open, false);
  const s = await call("POST", `/public/forms/${slug}/submit`, { data: {} }, anon);
  assert.equal(s.status, 403);
});

let fields;
await test("forms: builder save — validation, conditions, fee, go live", async () => {
  // a choice field without options is refused
  const bad = await call("PATCH", `/crm/forms/${form._id}`, { pages: [{ title: "A", fields: [{ type: "select", label: "Pick", options: [] }] }] });
  assert.equal(bad.status, 400);
  // two fields filling the same lead field are refused
  const twice = await call("PATCH", `/crm/forms/${form._id}`, { pages: [{ title: "A", fields: [{ type: "text", label: "N1", map: "name" }, { type: "text", label: "N2", map: "name" }] }] });
  assert.equal(twice.status, 400);
  fields = [
    { id: "nm", type: "text", label: "Full name", required: true, map: "name" },
    { id: "ph", type: "phone", label: "Mobile", required: true, map: "phone" },
    { id: "em", type: "email", label: "Email", map: "email" },
    { id: "pl", type: "radio", label: "Plan", required: true, options: ["Basic", "Pro"] },
    { id: "co", type: "text", label: "Company name", required: true, showIf: { field: "pl", op: "eq", value: "Pro" } },
    { id: "ag", type: "number", label: "Age", min: 10, max: 99 },
    { id: "pin", type: "text", label: "PIN code", pattern: "[0-9]{6}", patternMessage: "Enter 6 digits" },
    { id: "doc", type: "file", label: "ID proof", accept: ".pdf,image/*", maxSizeMb: 1 },
    { id: "ok", type: "consent", label: "I agree", required: true },
  ];
  const s = await call("PATCH", `/crm/forms/${form._id}`, {
    pages: [{ title: "Details", fields: fields.slice(0, 5) }, { title: "More", fields: fields.slice(5) }],
    settings: { onePerPhone: true, allowDraft: true, createApplication: true, fee: { enabled: true, amount: 100, title: "Form fee", amountFrom: "pl", amounts: { Basic: 100, Pro: 250 } }, successMessage: "Thanks {name}, ref {ref}" },
    status: "live",
  });
  assert.equal(s.status, 200, JSON.stringify(s.json));
  assert.equal(s.data.status, "live");
  assert.equal(s.data.problems.length, 0);
  const pub = await call("GET", `/public/forms/${slug}?view=1`, undefined, anon);
  assert.equal(pub.data.open, true);
  assert.equal(pub.data.pages.length, 2);
  assert.equal(pub.data.settings.fee.amounts.Pro, 250);
});

await test("forms: link name must be unique and valid", async () => {
  assert.equal((await call("PATCH", `/crm/forms/${form._id}`, { slug: "a" })).status, 400);
  const mine = `apitest-${stamp}`;
  const ok1 = await call("PATCH", `/crm/forms/${form._id}`, { slug: mine });
  assert.equal(ok1.status, 200); slug = mine;
});

await test("forms: server checks required, conditional, pattern, number range, consent", async () => {
  const r1 = await call("POST", `/public/forms/${slug}/submit`, { data: { nm: "X", ph: phone(1), pl: "Pro", ok: true } }, anon);
  assert.equal(r1.status, 400, "company is required when Pro is picked");
  assert.ok(r1.json.details.fields.co);
  const r2 = await call("POST", `/public/forms/${slug}/submit`, { data: { nm: "X", ph: phone(1), pl: "Basic", ok: true, pin: "12", ag: 5 } }, anon);
  assert.equal(r2.status, 400);
  assert.equal(r2.json.details.fields.pin, "Enter 6 digits");
  assert.ok(r2.json.details.fields.ag);
  const r3 = await call("POST", `/public/forms/${slug}/submit`, { data: { nm: "X", ph: phone(1), pl: "Basic" } }, anon);
  assert.ok(r3.json.details.fields.ok, "consent must be ticked");
  const r4 = await call("POST", `/public/forms/${slug}/submit`, { data: { nm: "X", ph: "12", pl: "Gold", ok: true } }, anon);
  assert.ok(r4.json.details.fields.ph && r4.json.details.fields.pl);
});

let draftToken;
await test("forms: save a draft and resume it", async () => {
  await call("POST", `/public/forms/${slug}/start`, {}, anon);
  const d = await call("POST", `/public/forms/${slug}/draft`, { data: { nm: `__apitest Draft ${stamp}`, ph: phone(2) }, page: 1 }, anon);
  assert.equal(d.status, 200, JSON.stringify(d.json));
  draftToken = d.data.token;
  const back = await call("GET", `/public/forms/${slug}?resume=${draftToken}`, undefined, anon);
  assert.equal(back.data.draft.data.nm, `__apitest Draft ${stamp}`);
  assert.equal(back.data.draft.page, 1);
});

let sub;
await test("forms: submit with a file (multipart) → lead, application, fee by plan", async () => {
  const fd = new FormData();
  fd.append("payload", JSON.stringify({ token: draftToken, data: { nm: `__apitest Draft ${stamp}`, ph: phone(2), em: `f${stamp}@example.com`, pl: "Pro", co: "Acme", ag: 30, pin: "110001", ok: true }, utm: { source: "apitest" } }));
  fd.append("doc", new Blob([Buffer.from("%PDF-1.4 test")], { type: "application/pdf" }), "id.pdf");
  const s = await call("POST", `/public/forms/${slug}/submit`, fd, anon);
  assert.equal(s.status, 201, JSON.stringify(s.json));
  sub = s.data;
  assert.match(sub.refNo, /^ENQ-\d{4}$/, "enquiry forms number as ENQ-");
  assert.equal(sub.amount, 250, "Pro plan amount");
  assert.ok(sub.payUrl.includes("/pay/"));
  assert.ok(sub.message.includes(sub.refNo));
  const list = await call("GET", `/crm/forms/${form._id}/submissions`);
  assert.equal(list.status, 200);
  const row = list.data.find((x) => x.refNo === sub.refNo);
  assert.ok(row, "listed");
  assert.equal(row.files.length, 1);
  assert.ok(row.lead && row.registration && row.fee);
  made.leads.push(row.lead); made.regs.push(row.registration);
  sub.id = row._id;
  const apps = await call("GET", `/crm/applications?q=${sub.refNo}`);
  assert.ok((apps.data?.items || []).some((a) => a.appNo === sub.refNo), "application made");
});

await test("forms: one submission per phone", async () => {
  const again = await call("POST", `/public/forms/${slug}/submit`, { data: { nm: "Again", ph: phone(2), pl: "Basic", ok: true } }, anon);
  assert.equal(again.status, 409);
});

await test("forms: wrong file type is refused", async () => {
  const fd = new FormData();
  fd.append("payload", JSON.stringify({ data: { nm: "Y", ph: phone(3), pl: "Basic", ok: true } }));
  fd.append("doc", new Blob([Buffer.from("x")], { type: "application/x-msdownload" }), "bad.exe");
  const s = await call("POST", `/public/forms/${slug}/submit`, fd, anon);
  assert.equal(s.status, 400);
  assert.ok(s.json.details.fields.doc);
});

await test("forms: hidden-honeypot submissions are dropped quietly", async () => {
  const s = await call("POST", `/public/forms/${slug}/submit`, { _hp: "spam", data: {} }, anon);
  assert.equal(s.status, 200);
  assert.equal(s.data.refNo, "");
});

await test("forms: submission detail, file, status, note, receipt, analytics", async () => {
  const d = await call("GET", `/crm/form-submissions/${sub.id}`);
  assert.equal(d.status, 200);
  assert.ok(d.data.answers.some((a) => a.label === "Company name" && a.value === "Acme"));
  assert.equal(d.data.feeInfo.balance, 250);
  const file = await fetch(`${A}/crm/form-submissions/${sub.id}/files/${d.data.files[0]._id}`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(file.status, 200);
  assert.equal((await fetch(`${A}/crm/form-submissions/${sub.id}/files/${d.data.files[0]._id}`)).status, 401, "files need a login");
  const p = await call("PATCH", `/crm/form-submissions/${sub.id}`, { status: "review", note: "Checked documents" });
  assert.equal(p.status, 200);
  assert.equal(p.data.status, "review");
  const rc = await call("GET", `/public/form-receipt/${sub.token}`, undefined, anon);
  assert.equal(rc.status, 200);
  assert.equal(rc.data.refNo, sub.refNo);
  assert.equal(rc.data.fee.paid, false);
  const an = await call("GET", `/crm/forms/${form._id}/analytics`);
  assert.equal(an.status, 200);
  assert.ok(an.data.views >= 1 && an.data.submissions >= 1);
  assert.ok(an.data.sources.some((s) => s.source === "apitest"));
  const fl = await call("GET", "/crm/forms");
  const mine = fl.data.items.find((x) => x._id === form._id);
  assert.equal(mine.submissions, 1);
});

await test("forms: bulk status, max submissions closes the form, duplicate", async () => {
  const b = await call("POST", "/crm/form-submissions/bulk", { ids: [sub.id], action: "accepted" });
  assert.equal(b.data.updated, 1);
  await call("PATCH", `/crm/forms/${form._id}`, { settings: { maxSubmissions: 1 } });
  const p = await call("GET", `/public/forms/${slug}`, undefined, anon);
  assert.equal(p.data.open, false, "full");
  const dup = await call("POST", `/crm/forms/${form._id}/duplicate`);
  assert.equal(dup.status, 201);
  assert.equal(dup.data.status, "draft");
  made.forms.push(dup.data._id);
});

/* ───────────── sales ───────────── */
let company, product, deal, quote, stages;
await test("companies: create, duplicate name refused, contacts, list", async () => {
  const c = await call("POST", "/crm/companies", { name: `__apitest Co ${stamp}`, industry: "Software", email: `co${stamp}@example.com`, website: "example.com", contacts: [{ name: "Ravi", role: "CTO", email: `r${stamp}@example.com`, primary: true }] });
  assert.equal(c.status, 201, JSON.stringify(c.json));
  company = c.data; made.companies.push(company._id);
  assert.equal(company.website, "https://example.com");
  assert.equal((await call("POST", "/crm/companies", { name: `__APITEST co ${stamp}` })).status, 409);
  assert.equal((await call("POST", "/crm/companies", { name: "x", email: "bad" })).status, 400);
  const l = await call("GET", `/crm/companies?q=${stamp}`);
  assert.ok(l.data.some((x) => x._id === company._id));
});

await test("products: create and price lookup", async () => {
  const p = await call("POST", "/crm/products", { name: `__apitest Licence ${stamp}`, price: 1000, taxPercent: 18, unit: "Year" });
  assert.equal(p.status, 201);
  product = p.data; made.products.push(product._id);
});

await test("deal stages: defaults, won/lost flags, cannot remove the last won stage", async () => {
  const s = await call("GET", "/crm/deal-stages");
  stages = s.data;
  assert.ok(stages.some((x) => x.kind === "won") && stages.some((x) => x.kind === "lost"));
  const extra = await call("POST", "/crm/deal-stages", { name: `__apitest Stage ${stamp}`, probability: 40 });
  assert.equal(extra.status, 201); made.stages.push(extra.data._id);
  const won = stages.filter((x) => x.kind === "won");
  if (won.length === 1) assert.equal((await call("DELETE", `/crm/deal-stages/${won[0]._id}`)).status, won[0].deals ? 409 : 400);
});

await test("deals: create with lines (server totals), board, stage move, lost needs a reason, won", async () => {
  const open = stages.find((x) => x.kind === "open");
  const d = await call("POST", "/crm/deals", { title: `__apitest Deal ${stamp}`, company: company._id, stage: open._id, items: [{ product: product._id, qty: 2, discountPct: 10 }], expectedClose: "2020-01-01" });
  assert.equal(d.status, 201, JSON.stringify(d.json));
  deal = d.data; made.deals.push(deal._id);
  // 2 × 1000 − 10% = 1800, +18% = 2124
  assert.equal(deal.value, 2124);
  assert.ok(deal.number > 0);
  const full = await call("GET", `/crm/deals/${deal._id}`);
  assert.equal(full.data.overdue, true);
  assert.equal(full.data.weighted, Math.round(2124 * open.probability / 100));
  const board = await call("GET", `/crm/deals/board?q=${stamp}`);
  assert.ok(board.data.find((c) => c.stage._id === open._id).deals.some((x) => x._id === deal._id));
  const lost = stages.find((x) => x.kind === "lost");
  assert.equal((await call("PATCH", `/crm/deals/${deal._id}`, { stage: lost._id })).status, 400);
  const won = stages.find((x) => x.kind === "won");
  const w = await call("PATCH", `/crm/deals/${deal._id}`, { stage: won._id, note: "Signed" });
  assert.equal(w.status, 200);
  assert.ok(w.data.closedAt);
  const sum = await call("GET", "/crm/deals/summary");
  assert.ok(sum.data.won >= 1);
});

await test("deals: a deal from a lead takes its contact", async () => {
  const d = await call("POST", "/crm/deals", { lead: made.leads[0] });
  assert.equal(d.status, 201, JSON.stringify(d.json));
  made.deals.push(d.data._id);
  assert.equal(d.data.contactPhone.replace(/\D/g, "").slice(-10), phone(2).replace(/\D/g, "").slice(-10));
});

await test("quotes: from a deal, totals, link send, public view and accept", async () => {
  const q = await call("POST", "/crm/quotes", { deal: deal._id, adjustment: -24, adjustmentLabel: "Round off" });
  assert.equal(q.status, 201, JSON.stringify(q.json));
  quote = q.data; made.quotes.push(quote._id);
  assert.equal(quote.subtotal, 2000);
  assert.equal(quote.discountTotal, 200);
  assert.equal(quote.taxTotal, 324);
  assert.equal(quote.total, 2100);
  assert.match(quote.quoteNo, /^QT-\d{4}$/);
  assert.equal((await call("GET", `/public/quote/${quote.token}`, undefined, anon)).status, 404, "drafts are private");
  const s = await call("POST", `/crm/quotes/${quote._id}/send`, { channel: "link" });
  assert.equal(s.status, 200);
  assert.equal(s.data.status, "sent");
  const pub = await call("GET", `/public/quote/${quote.token}?view=1`, undefined, anon);
  assert.equal(pub.status, 200);
  assert.equal(pub.data.total, 2100);
  assert.equal((await call("POST", `/public/quote/${quote.token}/respond`, { decision: "accept" }, anon)).status, 400, "name needed");
  const acc = await call("POST", `/public/quote/${quote.token}/respond`, { decision: "accept", name: "Ravi" }, anon);
  assert.equal(acc.data.status, "accepted");
  assert.equal((await call("PATCH", `/crm/quotes/${quote._id}`, { notes: "x" })).status, 400, "accepted quotes are locked");
  const g = await call("GET", `/crm/quotes/${quote._id}`);
  assert.equal(g.data.views, 1);
  const dup = await call("POST", `/crm/quotes/${quote._id}/duplicate`);
  assert.equal(dup.data.status, "draft"); made.quotes.push(dup.data._id);
});

await test("companies: a company with deals cannot be deleted", async () => {
  assert.equal((await call("DELETE", `/crm/companies/${company._id}`)).status, 409);
});


/* ───────────── applications & offer ───────────── */
await test("applications: detail, filters, stage move with note, offer (fee updated, not duplicated), templates", async () => {
  const tE = await call("POST", "/module-templates", { module: "crm", channel: "email", name: `__apitest_offer_${stamp}`, subject: "Offer {{1}}", body: "Dear {{1}}, your seat in {{2}} is ready.", status: "APPROVED" });
  assert.equal(tE.status, 201, JSON.stringify(tE.json));
  const tl = await call("GET", "/crm/applications/templates");
  assert.equal(tl.status, 200);
  const mine = tl.data.find((t) => t._id === tE.data._id);
  assert.equal(mine.vars, 2, "counts {{1}} {{2}}");
  const lead = (await call("POST", "/leads", { name: `__apitest App ${stamp}`, phone: phone(40), course: "BCA" })).data.lead;
  made.leads.push(lead._id);
  const reg = await call("POST", "/registrations", { lead: lead._id, course: "BCA" });
  assert.equal(reg.status, 201); made.regs.push(reg.data._id);
  const list = await call("GET", `/crm/applications?q=${stamp}&course=BCA`);
  assert.ok(list.data.items.some((a) => a._id === reg.data._id));
  assert.ok(list.data.courses.includes("BCA"));
  const none = await call("GET", `/crm/applications?q=${stamp}&course=__nope`);
  assert.equal(none.data.items.length, 0);
  const det = await call("GET", `/crm/applications/${reg.data._id}`);
  assert.equal(det.status, 200);
  assert.ok(det.data.link.includes("/application/"));
  const mv = await call("PATCH", `/crm/applications/${reg.data._id}`, { stage: "Under review", note: "Docs checked" });
  assert.equal(mv.status, 200);
  assert.equal(mv.data.stageHistory.at(-1).note, "Docs checked");
  assert.equal((await call("PATCH", `/crm/applications/${reg.data._id}`, { stage: "Nope" })).status, 400);
  assert.equal((await call("POST", `/crm/applications/${reg.data._id}/offer`, { text: "Hi", email: { enabled: true, to: "bad" } })).status, 400, "bad email refused");
  assert.equal((await call("POST", `/crm/applications/${reg.data._id}/offer`, { text: "Hi", whatsapp: { enabled: true, to: "12" } })).status, 400, "bad number refused");
  const o1 = await call("POST", `/crm/applications/${reg.data._id}/offer`, { text: "Welcome", amount: 5000, validTill: "2030-01-31" });
  assert.equal(o1.status, 200, JSON.stringify(o1.json));
  assert.equal(o1.data.stage, "Offer made");
  assert.ok(o1.data.payLink.includes("/pay/"));
  const o2 = await call("POST", `/crm/applications/${reg.data._id}/offer`, { text: "Welcome again", amount: 6000, validTill: "2030-01-31" });
  assert.equal(o2.data.payLink, o1.data.payLink, "same fee, updated");
  const det2 = await call("GET", `/crm/applications/${reg.data._id}`);
  const fees = det2.data.fees.filter((f) => f.title.includes(reg.data.appNo));
  assert.equal(fees.length, 1);
  assert.equal(fees[0].amount, 6000);
  const row = (await call("GET", `/crm/applications?q=${reg.data.appNo}`)).data.items[0];
  assert.equal(row.fee.balance, 6000);
  await call("DELETE", `/module-templates/${tE.data._id}`);
});

/* ───────────── clean up ───────────── */
for (const id of made.quotes) await call("DELETE", `/crm/quotes/${id}`);
for (const id of made.deals) await call("DELETE", `/crm/deals/${id}`);
for (const id of made.companies) await call("DELETE", `/crm/companies/${id}`);
for (const id of made.products) await call("DELETE", `/crm/products/${id}`);
for (const id of made.stages) await call("DELETE", `/crm/deal-stages/${id}`);
for (const id of made.forms) await call("DELETE", `/crm/forms/${id}`);
for (const id of made.regs) await call("DELETE", `/registrations/${id}`);
for (const id of made.leads) await call("DELETE", `/leads/${id}`);

const failed = results.filter((x) => !x[0]);
for (const [pass, name, why] of results) console.log(`${pass ? "✔" : "✘"} ${name}${why ? `\n    ${why}` : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
