import { Router } from "express";
import { Types } from "mongoose";
import rateLimit from "express-rate-limit";
import { require_ } from "../middleware/auth";
import { ok, asyncHandler, ApiError, audit } from "../utils/http";
import {
  CrmCompany, CrmDealStage, CrmDeal, CrmProduct, CrmQuote, DEFAULT_STAGES, STAGE_KINDS, QUOTE_STATUSES, nextNumber,
} from "../models/CrmSales";
import { Lead } from "../models/Lead";
import { User } from "../models/User";
import { crmSettingsFor } from "../models/CrmExtras";
import { OrganizationDetails } from "../models/OrganizationDetails";
import { leadOwnerScope, canSeeLead } from "../services/leadAccess";
import { logActivity, escapeRegex, isValidEmail, cleanPhone, assignableOwners } from "../services/leadService";
import { newToken } from "../services/leadFees";
import { sendEmail } from "../services/email";
import { notify, appUrl } from "../services/pm/messages";
import { approvalRules, maxDiscountPct } from "./crmApprovals";

/** Sales: companies, a deal pipeline, products and quotations a customer accepts from a link. */
const r = Router();
export const publicSalesRoutes = Router();

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "");
const oid = (v: unknown) => (v && Types.ObjectId.isValid(String(v)) ? new Types.ObjectId(String(v)) : null);
const money = (v: unknown) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
const pct = (v: unknown) => Math.max(0, Math.min(100, Number(v) || 0));
const dateOrNull = (v: unknown) => { if (!v) return null; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? null : d; };
const tagsOf = (v: unknown) => [...new Set((Array.isArray(v) ? v : String(v || "").split(",")).map((t: any) => str(t, 40)).filter(Boolean))].slice(0, 15);
const pageOf = (q: any) => Math.max(1, parseInt(String(q.page || "1"), 10) || 1);
const perPageOf = (q: any) => Math.min(200, Math.max(1, parseInt(String(q.perPage || "50"), 10) || 50));
const by = (req: any) => req.auth?.name || "System";
const tid = (req: any) => new Types.ObjectId(String(req.tenantId));

/** only records owned by people this user may see (same rule as leads) */
async function scoped(req: any, filter: any) {
  const names = await leadOwnerScope(req);
  if (names) filter.$and = [...(filter.$and || []), { owner: { $in: names } }];
  return filter;
}
async function mustSee(req: any, doc: any) {
  const names = await leadOwnerScope(req);
  if (names && !names.includes(doc.owner)) throw new ApiError(404, "Not found");
}
async function cleanOwner(req: any, v: unknown) {
  const o = str(v, 80);
  if (!o || o === "Unassigned") return "Unassigned";
  const owners = await assignableOwners(req.tenantId);
  if (!owners.includes(o)) throw new ApiError(400, `${o} is not a user`);
  return o;
}

/* ───────────── line items: totals are always worked out here ───────────── */
async function cleanItems(tenant: any, input: unknown) {
  const rows = (Array.isArray(input) ? input : []).slice(0, 100);
  const out: any[] = [];
  for (const x of rows as any[]) {
    const product = oid(x?.product);
    const p: any = product ? await CrmProduct.findOne({ _id: product, tenant }).lean() : null;
    const name = str(x?.name, 200) || p?.name || "";
    if (!name) continue;
    const qty = Math.max(0, Number(x?.qty) || 0) || 1;
    const price = x?.price === undefined || x?.price === "" ? money(p?.price) : money(x.price);
    const discountPct = pct(x?.discountPct);
    const taxPct = x?.taxPct === undefined || x?.taxPct === "" ? pct(p?.taxPercent) : pct(x.taxPct);
    const gross = qty * price;
    const taxable = gross - (gross * discountPct) / 100;
    out.push({ product: p?._id || null, name, description: str(x?.description, 500), qty, unit: str(x?.unit, 20) || p?.unit || "Nos", price, discountPct, taxPct, amount: Math.round((taxable + (taxable * taxPct) / 100) * 100) / 100 });
  }
  return out;
}
function totals(items: any[], adjustment = 0) {
  let subtotal = 0, discountTotal = 0, taxTotal = 0;
  for (const i of items) {
    const gross = i.qty * i.price;
    const disc = (gross * i.discountPct) / 100;
    subtotal += gross; discountTotal += disc; taxTotal += ((gross - disc) * i.taxPct) / 100;
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { subtotal: r2(subtotal), discountTotal: r2(discountTotal), taxTotal: r2(taxTotal), total: r2(subtotal - discountTotal + taxTotal + (Number(adjustment) || 0)) };
}

/* ═════════════ companies ═════════════ */

function companyFields(b: any) {
  const out: any = {};
  for (const [k, max] of [["industry", 80], ["website", 200], ["gstin", 20], ["address", 500], ["city", 80], ["state", 80], ["country", 80], ["size", 40]] as const) if (b[k] !== undefined) out[k] = str(b[k], max);
  if (b.phone !== undefined) out.phone = b.phone ? cleanPhone(b.phone) : "";
  if (b.email !== undefined) { const e = str(b.email, 120).toLowerCase(); if (e && !isValidEmail(e)) throw new ApiError(400, "Enter a valid email address"); out.email = e; }
  if (out.website && !/^https?:\/\//i.test(out.website)) out.website = `https://${out.website}`;
  if (b.tags !== undefined) out.tags = tagsOf(b.tags);
  if (b.contacts !== undefined) out.contacts = (Array.isArray(b.contacts) ? b.contacts : []).slice(0, 50).map((c: any) => {
    const email = str(c?.email, 120).toLowerCase();
    if (email && !isValidEmail(email)) throw new ApiError(400, `${email} is not a valid email`);
    return { name: str(c?.name, 120), role: str(c?.role, 80), phone: c?.phone ? cleanPhone(c.phone) : "", email, primary: !!c?.primary };
  }).filter((c: any) => c.name);
  return out;
}

r.get("/crm/companies", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const q = req.query;
  const filter: any = { tenant: req.tenantId };
  const term = str(q.q, 80);
  if (term) { const rx = new RegExp(escapeRegex(term), "i"); filter.$or = [{ name: rx }, { city: rx }, { industry: rx }, { email: rx }, { phone: rx }, { "contacts.name": rx }]; }
  if (str(q.industry)) filter.industry = str(q.industry, 80);
  if (str(q.owner)) filter.owner = q.owner === "me" ? by(req) : str(q.owner, 80);
  await scoped(req, filter);
  const page = pageOf(q), perPage = perPageOf(q);
  const [items, total, industries] = await Promise.all([
    CrmCompany.find(filter).sort({ name: 1 }).skip((page - 1) * perPage).limit(perPage).lean(),
    CrmCompany.countDocuments(filter),
    CrmCompany.distinct("industry", { tenant: req.tenantId }),
  ]);
  const ids = items.map((c: any) => c._id);
  const deals = await CrmDeal.aggregate([
    { $match: { tenant: tid(req), company: { $in: ids } } },
    { $lookup: { from: "crmdealstages", localField: "stage", foreignField: "_id", as: "s" } },
    { $group: { _id: "$company", n: { $sum: 1 }, open: { $sum: { $cond: [{ $eq: [{ $first: "$s.kind" }, "open"] }, "$value", 0] } }, won: { $sum: { $cond: [{ $eq: [{ $first: "$s.kind" }, "won"] }, "$value", 0] } } } },
  ]);
  const dm = new Map(deals.map((d: any) => [String(d._id), d]));
  res.json({ ok: true, data: items.map((c: any) => ({ ...c, deals: dm.get(String(c._id))?.n || 0, openValue: dm.get(String(c._id))?.open || 0, wonValue: dm.get(String(c._id))?.won || 0 })), total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)), industries: industries.filter(Boolean).sort() });
}));

r.post("/crm/companies", require_("leads", "create"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const name = str(b.name, 160);
  if (!name) throw new ApiError(400, "Name is required");
  if (await CrmCompany.exists({ tenant: req.tenantId, name: new RegExp(`^${escapeRegex(name)}$`, "i") })) throw new ApiError(409, `${name} is already a company`);
  const c = await CrmCompany.create({ tenant: req.tenantId, name, ...companyFields(b), owner: b.owner !== undefined ? await cleanOwner(req, b.owner) : by(req), createdBy: by(req) });
  await audit({ tenant: req.tenantId, user: by(req), action: "CREATE", module: "Companies", entity: name });
  ok(res, c, 201);
}));

r.get("/crm/companies/:id", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const c: any = await CrmCompany.findOne({ _id: oid(req.params.id), tenant: req.tenantId }).lean();
  if (!c) throw new ApiError(404, "Company not found");
  await mustSee(req, c);
  const [deals, quotes] = await Promise.all([
    CrmDeal.find({ tenant: req.tenantId, company: c._id }).sort({ updatedAt: -1 }).populate("stage", "name color kind").lean(),
    CrmQuote.find({ tenant: req.tenantId, company: c._id }).sort({ createdAt: -1 }).select("quoteNo subject total status createdAt validTill").lean(),
  ]);
  ok(res, { ...c, dealList: deals, quoteList: quotes });
}));

r.patch("/crm/companies/:id", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const c: any = await CrmCompany.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!c) throw new ApiError(404, "Company not found");
  await mustSee(req, c);
  const b = req.body || {};
  if (b.name !== undefined) {
    const n = str(b.name, 160);
    if (!n) throw new ApiError(400, "Name is required");
    if (n.toLowerCase() !== c.name.toLowerCase() && (await CrmCompany.exists({ tenant: req.tenantId, name: new RegExp(`^${escapeRegex(n)}$`, "i") }))) throw new ApiError(409, `${n} is already a company`);
    c.name = n;
  }
  Object.assign(c, companyFields(b));
  if (b.owner !== undefined) c.owner = await cleanOwner(req, b.owner);
  const note = str(b.note, 2000);
  if (note) c.notes.unshift({ text: note, by: by(req), at: new Date() });
  await c.save();
  await audit({ tenant: req.tenantId, user: by(req), action: "UPDATE", module: "Companies", entity: c.name });
  ok(res, c);
}));

r.delete("/crm/companies/:id", require_("leads", "del"), asyncHandler(async (req: any, res: any) => {
  const c: any = await CrmCompany.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!c) throw new ApiError(404, "Company not found");
  await mustSee(req, c);
  const n = await CrmDeal.countDocuments({ tenant: req.tenantId, company: c._id });
  if (n) throw new ApiError(409, `${c.name} has ${n} deal${n === 1 ? "" : "s"}. Move or delete them first.`);
  await c.deleteOne();
  await CrmQuote.updateMany({ tenant: req.tenantId, company: c._id }, { $set: { company: null } });
  await audit({ tenant: req.tenantId, user: by(req), action: "DELETE", module: "Companies", entity: c.name });
  ok(res, { deleted: true });
}));

/* ═════════════ deal stages ═════════════ */

async function stagesFor(tenant: any) {
  let stages = await CrmDealStage.find({ tenant }).sort({ order: 1 }).lean();
  if (!stages.length) {
    await CrmDealStage.insertMany(DEFAULT_STAGES.map((s, i) => ({ ...s, tenant, order: i + 1 })), { ordered: false }).catch(() => undefined);
    stages = await CrmDealStage.find({ tenant }).sort({ order: 1 }).lean();
  }
  return stages as any[];
}

r.get("/crm/deal-stages", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const stages = await stagesFor(req.tenantId);
  const counts = await CrmDeal.aggregate([{ $match: { tenant: tid(req) } }, { $group: { _id: "$stage", n: { $sum: 1 } } }]);
  const m = new Map(counts.map((c: any) => [String(c._id), c.n]));
  ok(res, stages.map((s) => ({ ...s, deals: m.get(String(s._id)) || 0 })));
}));

r.post("/crm/deal-stages", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const name = str(b.name, 60);
  if (!name) throw new ApiError(400, "Name is required");
  const stages = await stagesFor(req.tenantId);
  const kind = (STAGE_KINDS as readonly string[]).includes(b.kind) ? b.kind : "open";
  const s = await CrmDealStage.create({ tenant: req.tenantId, name, color: str(b.color, 20) || "#6366f1", probability: kind === "won" ? 100 : kind === "lost" ? 0 : pct(b.probability), kind, order: (stages[stages.length - 1]?.order || 0) + 1 });
  ok(res, s, 201);
}));

r.put("/crm/deal-stages/order", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(oid).filter(Boolean);
  await Promise.all(ids.map((id: any, i: number) => CrmDealStage.updateOne({ _id: id, tenant: req.tenantId }, { $set: { order: i + 1 } })));
  ok(res, await stagesFor(req.tenantId));
}));

r.patch("/crm/deal-stages/:id", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const s: any = await CrmDealStage.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!s) throw new ApiError(404, "Stage not found");
  const b = req.body || {};
  if (b.name !== undefined) { const n = str(b.name, 60); if (!n) throw new ApiError(400, "Name is required"); s.name = n; }
  if (b.color !== undefined) s.color = str(b.color, 20) || s.color;
  if (b.kind !== undefined && (STAGE_KINDS as readonly string[]).includes(b.kind)) s.kind = b.kind;
  if (b.probability !== undefined) s.probability = pct(b.probability);
  if (s.kind === "won") s.probability = 100;
  if (s.kind === "lost") s.probability = 0;
  await s.save();
  ok(res, s);
}));

r.delete("/crm/deal-stages/:id", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const s: any = await CrmDealStage.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!s) throw new ApiError(404, "Stage not found");
  const n = await CrmDeal.countDocuments({ tenant: req.tenantId, stage: s._id });
  if (n) throw new ApiError(409, `${n} deal${n === 1 ? " is" : "s are"} in ${s.name}. Move ${n === 1 ? "it" : "them"} first.`);
  const left = await CrmDealStage.find({ tenant: req.tenantId, _id: { $ne: s._id } }).lean();
  for (const k of STAGE_KINDS) if (s.kind === k && !left.some((x: any) => x.kind === k)) throw new ApiError(400, `Keep at least one ${k} stage`);
  await s.deleteOne();
  ok(res, { deleted: true });
}));

/* ═════════════ deals ═════════════ */

const dealView = (d: any, stage: any) => {
  const prob = d.probability ?? stage?.probability ?? 0;
  const overdue = stage?.kind === "open" && d.expectedClose && new Date(d.expectedClose) < new Date(new Date().toDateString());
  const idle = Math.floor((Date.now() - new Date(d.stageChangedAt || d.updatedAt).getTime()) / 86_400_000);
  return { ...d, stageInfo: stage ? { _id: stage._id, name: stage.name, color: stage.color, kind: stage.kind, probability: stage.probability } : null, prob, weighted: Math.round(((d.value || 0) * prob) / 100), overdue: !!overdue, daysInStage: idle };
};

async function dealFilter(req: any) {
  const q = req.query;
  const filter: any = { tenant: req.tenantId };
  const stages = await stagesFor(req.tenantId);
  if (oid(q.stage)) filter.stage = oid(q.stage);
  if ((STAGE_KINDS as readonly string[]).includes(q.kind)) filter.stage = { $in: stages.filter((s) => s.kind === q.kind).map((s) => s._id) };
  if (str(q.owner)) filter.owner = q.owner === "me" ? by(req) : str(q.owner, 80);
  if (oid(q.company)) filter.company = oid(q.company);
  if (oid(q.lead)) filter.lead = oid(q.lead);
  if (["low", "medium", "high"].includes(q.priority)) filter.priority = q.priority;
  const from = dateOrNull(q.closeFrom), to = dateOrNull(q.closeTo);
  if (from || to) filter.expectedClose = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: new Date(to.getTime() + 86_399_999) } : {}) };
  if (q.overdue === "1") { filter.expectedClose = { $lt: new Date(new Date().toDateString()) }; filter.stage = { $in: stages.filter((s) => s.kind === "open").map((s) => s._id) }; }
  const term = str(q.q, 80);
  if (term) {
    const rx = new RegExp(escapeRegex(term), "i");
    const cos = await CrmCompany.find({ tenant: req.tenantId, name: rx }).select("_id").lean();
    filter.$or = [{ title: rx }, { contactName: rx }, { contactPhone: rx }, { contactEmail: rx }, { company: { $in: cos.map((c: any) => c._id) } }, ...(/^\d+$/.test(term) ? [{ number: Number(term) }] : [])];
  }
  await scoped(req, filter);
  return { filter, stages };
}

r.get("/crm/deals", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const { filter, stages } = await dealFilter(req);
  const sm = new Map(stages.map((s) => [String(s._id), s]));
  const page = pageOf(req.query), perPage = perPageOf(req.query);
  const sortKey = ({ value: { value: -1 }, close: { expectedClose: 1 }, created: { createdAt: -1 } } as any)[req.query.sort] || { updatedAt: -1 };
  const [items, total] = await Promise.all([
    CrmDeal.find(filter).sort(sortKey).skip((page - 1) * perPage).limit(perPage).populate("company", "name").populate("lead", "name phone").lean(),
    CrmDeal.countDocuments(filter),
  ]);
  res.json({ ok: true, data: items.map((d: any) => dealView(d, sm.get(String(d.stage)))), total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)) });
}));

/** the pipeline: every stage with its deals */
r.get("/crm/deals/board", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const { filter, stages } = await dealFilter(req);
  const sm = new Map(stages.map((s) => [String(s._id), s]));
  // closed deals: only the last 90 days on the board
  const since = new Date(Date.now() - 90 * 86_400_000);
  const closedIds = stages.filter((s) => s.kind !== "open").map((s) => s._id);
  const items = await CrmDeal.find({ ...filter, $nor: [{ stage: { $in: closedIds }, closedAt: { $lt: since } }] }).sort({ updatedAt: -1 }).limit(1000).populate("company", "name").lean();
  const cols = stages.map((s) => {
    const deals = items.filter((d: any) => String(d.stage) === String(s._id)).map((d: any) => dealView(d, sm.get(String(d.stage))));
    return { stage: s, deals, count: deals.length, value: deals.reduce((a: number, d: any) => a + (d.value || 0), 0), weighted: deals.reduce((a: number, d: any) => a + d.weighted, 0) };
  });
  ok(res, cols);
}));

r.get("/crm/deals/summary", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const { filter, stages } = await dealFilter(req);
  const sm = new Map(stages.map((s) => [String(s._id), s]));
  const all = await CrmDeal.find(filter).select("value stage probability closedAt createdAt expectedClose owner").lean();
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const nextMonth = new Date(monthStart); nextMonth.setMonth(nextMonth.getMonth() + 1);
  let open = 0, openValue = 0, weighted = 0, wonMonth = 0, wonMonthValue = 0, won = 0, lost = 0, wonValue = 0, overdue = 0, closingMonth = 0, cycleDays = 0;
  const owners: Record<string, { open: number; won: number; value: number }> = {};
  for (const d of all as any[]) {
    const s = sm.get(String(d.stage));
    const o = (owners[d.owner] = owners[d.owner] || { open: 0, won: 0, value: 0 });
    if (s?.kind === "open") {
      open++; openValue += d.value || 0; weighted += ((d.value || 0) * (d.probability ?? s.probability)) / 100; o.open += d.value || 0;
      if (d.expectedClose && d.expectedClose < new Date(new Date().toDateString())) overdue++;
      if (d.expectedClose && d.expectedClose >= monthStart && d.expectedClose < nextMonth) closingMonth += d.value || 0;
    } else if (s?.kind === "won") {
      won++; wonValue += d.value || 0; o.won++; o.value += d.value || 0;
      if (d.closedAt) cycleDays += (new Date(d.closedAt).getTime() - new Date(d.createdAt).getTime()) / 86_400_000;
      if (d.closedAt && d.closedAt >= monthStart) { wonMonth++; wonMonthValue += d.value || 0; }
    } else if (s?.kind === "lost") lost++;
  }
  ok(res, {
    open, openValue, weighted: Math.round(weighted), wonMonth, wonMonthValue, won, lost, overdue, closingMonth,
    winRate: won + lost ? Math.round((won / (won + lost)) * 1000) / 10 : 0, avgDeal: won ? Math.round(wonValue / won) : 0, avgCycleDays: won ? Math.round(cycleDays / won) : 0,
    owners: Object.entries(owners).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.value - a.value),
  });
}));

async function setStage(req: any, d: any, stageId: unknown, lostReason?: string) {
  const s: any = await CrmDealStage.findOne({ _id: oid(stageId), tenant: req.tenantId }).lean();
  if (!s) throw new ApiError(400, "Pick a stage");
  if (String(d.stage) === String(s._id)) return s;
  if (s.kind === "lost" && !str(lostReason) && !d.lostReason) throw new ApiError(400, "Say why the deal was lost");
  d.stage = s._id;
  d.stageChangedAt = new Date();
  d.closedAt = s.kind === "open" ? null : new Date();
  if (s.kind === "lost") d.lostReason = str(lostReason, 300) || d.lostReason;
  if (s.kind !== "lost") d.lostReason = "";
  d.probability = null;
  d.history.push({ stage: s.name, by: by(req), at: new Date(), note: s.kind === "lost" ? d.lostReason : "" });
  if (d.lead) await logActivity({ tenant: req.tenantId, lead: d.lead, type: "status", by: by(req), title: `Deal ${s.kind === "won" ? "won" : s.kind === "lost" ? "lost" : `moved to ${s.name}`}`, detail: `${d.title}${d.value ? ` · ₹${d.value.toLocaleString("en-IN")}` : ""}` }).catch(() => undefined);
  return s;
}

async function dealFields(req: any, d: any, b: any) {
  if (b.title !== undefined) { const t = str(b.title, 200); if (!t) throw new ApiError(400, "Title is required"); d.title = t; }
  if (b.company !== undefined) {
    const c = oid(b.company);
    if (c && !(await CrmCompany.exists({ _id: c, tenant: req.tenantId }))) throw new ApiError(400, "Company not found");
    d.company = c;
  }
  if (b.lead !== undefined) {
    const l = oid(b.lead);
    if (l && !(await canSeeLead(req, l))) throw new ApiError(400, "Lead not found");
    d.lead = l;
  }
  for (const k of ["contactName", "source"]) if (b[k] !== undefined) d[k] = str(b[k], 120);
  if (b.contactPhone !== undefined) d.contactPhone = b.contactPhone ? cleanPhone(b.contactPhone) : "";
  if (b.contactEmail !== undefined) { const e = str(b.contactEmail, 120).toLowerCase(); if (e && !isValidEmail(e)) throw new ApiError(400, "Enter a valid email address"); d.contactEmail = e; }
  if (b.items !== undefined) { d.items = await cleanItems(req.tenantId, b.items); }
  if (b.value !== undefined) d.value = money(b.value);
  else if (b.items !== undefined && d.items.length) d.value = totals(d.items).total;
  if (b.probability !== undefined) d.probability = b.probability === "" || b.probability === null ? null : pct(b.probability);
  if (b.expectedClose !== undefined) d.expectedClose = dateOrNull(b.expectedClose);
  if (b.owner !== undefined) d.owner = await cleanOwner(req, b.owner);
  if (b.priority !== undefined) d.priority = ["low", "medium", "high"].includes(b.priority) ? b.priority : "medium";
  if (b.tags !== undefined) d.tags = tagsOf(b.tags);
}

r.post("/crm/deals", require_("leads", "create"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const stages = await stagesFor(req.tenantId);
  const d: any = new CrmDeal({ tenant: req.tenantId, title: "x", stage: stages.find((s) => s.kind === "open")?._id || stages[0]._id, owner: by(req), createdBy: by(req) });
  // from a lead: its name, phone, email, owner and value are the starting point
  const lead: any = oid(b.lead) && (await canSeeLead(req, b.lead)) ? await Lead.findOne({ _id: oid(b.lead), tenant: req.tenantId }).lean() : null;
  if (lead) Object.assign(d, { lead: lead._id, contactName: lead.name, contactPhone: lead.phone, contactEmail: lead.email || "", owner: lead.owner || by(req), value: lead.value || 0 });
  await dealFields(req, d, { ...b, title: b.title || (lead ? `${lead.name}${lead.course ? ` · ${lead.course}` : ""}` : "") });
  const stage = await setStage(req, d, b.stage || d.stage, b.lostReason);
  if (!d.history.length) d.history.push({ stage: stage.name, by: by(req), at: new Date() });
  d.number = await nextNumber(req.tenantId, "deal");
  await d.save();
  if (d.lead) await logActivity({ tenant: req.tenantId, lead: d.lead, type: "note", by: by(req), title: "Deal created", detail: `${d.title} · D-${d.number}` }).catch(() => undefined);
  if (d.owner !== by(req) && d.owner !== "Unassigned") {
    const u: any = await User.findOne({ tenant: req.tenantId, name: d.owner }).select("_id").lean();
    if (u) await notify({ tenantId: req.tenantId, users: [u._id], category: "crm_lead", title: `Deal assigned: ${d.title}`, body: `by ${by(req)}`, link: `/crm/deals?deal=${d._id}` }).catch(() => undefined);
  }
  await audit({ tenant: req.tenantId, user: by(req), action: "CREATE", module: "Deals", entity: d.title });
  ok(res, d, 201);
}));

r.get("/crm/deals/:id", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const d: any = await CrmDeal.findOne({ _id: oid(req.params.id), tenant: req.tenantId }).populate("company", "name phone email city").populate("lead", "name phone email owner").lean();
  if (!d) throw new ApiError(404, "Deal not found");
  await mustSee(req, d);
  const stage = await CrmDealStage.findById(d.stage).lean();
  const quotes = await CrmQuote.find({ tenant: req.tenantId, deal: d._id }).sort({ createdAt: -1 }).select("quoteNo subject total status createdAt validTill views").lean();
  ok(res, { ...dealView(d, stage), quotes, totals: totals(d.items || []) });
}));

r.patch("/crm/deals/:id", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const d: any = await CrmDeal.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!d) throw new ApiError(404, "Deal not found");
  await mustSee(req, d);
  const b = req.body || {};
  await dealFields(req, d, b);
  if (b.stage !== undefined) await setStage(req, d, b.stage, b.lostReason);
  else if (b.lostReason !== undefined) d.lostReason = str(b.lostReason, 300);
  const note = str(b.note, 2000);
  if (note) d.notes.unshift({ text: note, by: by(req), at: new Date() });
  await d.save();
  const stage = await CrmDealStage.findById(d.stage).lean();
  ok(res, dealView(d.toObject(), stage));
}));

r.delete("/crm/deals/:id", require_("leads", "del"), asyncHandler(async (req: any, res: any) => {
  const d: any = await CrmDeal.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!d) throw new ApiError(404, "Deal not found");
  await mustSee(req, d);
  await d.deleteOne();
  await CrmQuote.updateMany({ tenant: req.tenantId, deal: d._id }, { $set: { deal: null } });
  await audit({ tenant: req.tenantId, user: by(req), action: "DELETE", module: "Deals", entity: d.title });
  ok(res, { deleted: true });
}));

/* ═════════════ products ═════════════ */

function productFields(b: any) {
  const out: any = {};
  for (const [k, max] of [["sku", 60], ["category", 80], ["unit", 20], ["hsn", 20], ["description", 500]] as const) if (b[k] !== undefined) out[k] = str(b[k], max);
  if (b.price !== undefined) out.price = money(b.price);
  if (b.taxPercent !== undefined) out.taxPercent = pct(b.taxPercent);
  if (b.active !== undefined) out.active = !!b.active;
  return out;
}
r.get("/crm/products", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const filter: any = { tenant: req.tenantId };
  const term = str(req.query.q, 80);
  if (term) { const rx = new RegExp(escapeRegex(term), "i"); filter.$or = [{ name: rx }, { sku: rx }, { category: rx }]; }
  if (req.query.active === "1") filter.active = true;
  if (str(req.query.category)) filter.category = str(req.query.category, 80);
  const [items, categories] = await Promise.all([CrmProduct.find(filter).sort({ name: 1 }).limit(1000).lean(), CrmProduct.distinct("category", { tenant: req.tenantId })]);
  res.json({ ok: true, data: items, categories: categories.filter(Boolean).sort() });
}));
r.post("/crm/products", require_("setup", "create"), asyncHandler(async (req: any, res: any) => {
  const name = str(req.body?.name, 160);
  if (!name) throw new ApiError(400, "Name is required");
  const p = await CrmProduct.create({ tenant: req.tenantId, name, ...productFields(req.body || {}) });
  await audit({ tenant: req.tenantId, user: by(req), action: "CREATE", module: "Products", entity: name });
  ok(res, p, 201);
}));
r.patch("/crm/products/:id", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const p: any = await CrmProduct.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!p) throw new ApiError(404, "Product not found");
  if (req.body?.name !== undefined) { const n = str(req.body.name, 160); if (!n) throw new ApiError(400, "Name is required"); p.name = n; }
  Object.assign(p, productFields(req.body || {}));
  await p.save();
  ok(res, p);
}));
r.delete("/crm/products/:id", require_("setup", "del"), asyncHandler(async (req: any, res: any) => {
  const p: any = await CrmProduct.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!p) throw new ApiError(404, "Product not found");
  // deals and quotations keep their own copy of the line, so a used product is only switched off
  if (await CrmQuote.exists({ tenant: req.tenantId, "items.product": p._id }) || await CrmDeal.exists({ tenant: req.tenantId, "items.product": p._id })) {
    p.active = false; await p.save();
    return ok(res, { deleted: false, deactivated: true });
  }
  await p.deleteOne();
  ok(res, { deleted: true });
}));

/* ═════════════ quotations ═════════════ */

const quotePrefix = async (_tenant: any) => "QT-";
const expired = (q: any) => q.status === "sent" && q.validTill && new Date(q.validTill).getTime() + 86_400_000 < Date.now();
const quoteView = (q: any, base = "") => ({ ...q, expired: expired(q), link: base ? `${base}/quote/${q.token}` : undefined });

async function quoteFields(req: any, q: any, b: any) {
  if (b.subject !== undefined) q.subject = str(b.subject, 200);
  if (b.deal !== undefined) {
    const d: any = oid(b.deal) ? await CrmDeal.findOne({ _id: oid(b.deal), tenant: req.tenantId }).lean() : null;
    if (b.deal && !d) throw new ApiError(400, "Deal not found");
    q.deal = d?._id || null;
    if (d) { if (!q.company && d.company) q.company = d.company; if (!q.lead && d.lead) q.lead = d.lead; }
  }
  if (b.company !== undefined) {
    const c = oid(b.company);
    if (c && !(await CrmCompany.exists({ _id: c, tenant: req.tenantId }))) throw new ApiError(400, "Company not found");
    q.company = c;
  }
  if (b.customer !== undefined) {
    const c = b.customer || {};
    const email = str(c.email, 120).toLowerCase();
    if (email && !isValidEmail(email)) throw new ApiError(400, "Enter a valid email address");
    q.customer = { name: str(c.name, 160), email, phone: c.phone ? cleanPhone(c.phone) : "", address: str(c.address, 500), gstin: str(c.gstin, 20) };
  }
  if (b.items !== undefined) q.items = await cleanItems(req.tenantId, b.items);
  if (b.adjustment !== undefined) q.adjustment = Math.round((Number(b.adjustment) || 0) * 100) / 100;
  if (b.adjustmentLabel !== undefined) q.adjustmentLabel = str(b.adjustmentLabel, 60);
  if (b.validTill !== undefined) q.validTill = dateOrNull(b.validTill);
  if (b.terms !== undefined) q.terms = str(b.terms, 4000);
  if (b.notes !== undefined) q.notes = str(b.notes, 2000);
  if (b.owner !== undefined) q.owner = await cleanOwner(req, b.owner);
  Object.assign(q, totals(q.items || [], q.adjustment));
  // more discount than was approved: approval is needed again
  if (q.approval?.status === "approved" && maxDiscountPct(q) > (q.approval.pct || 0)) q.approval = { status: "", id: null, pct: 0 };
}

r.get("/crm/quotes", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const qy = req.query;
  const filter: any = { tenant: req.tenantId };
  if ((QUOTE_STATUSES as readonly string[]).includes(qy.status)) filter.status = qy.status;
  if (qy.status === "expired") Object.assign(filter, { status: "sent", validTill: { $lt: new Date(Date.now() - 86_400_000) } });
  if (oid(qy.deal)) filter.deal = oid(qy.deal);
  if (oid(qy.company)) filter.company = oid(qy.company);
  const term = str(qy.q, 80);
  if (term) { const rx = new RegExp(escapeRegex(term), "i"); filter.$or = [{ quoteNo: rx }, { subject: rx }, { "customer.name": rx }, { "customer.email": rx }]; }
  await scoped(req, filter);
  const page = pageOf(qy), perPage = perPageOf(qy);
  const [items, total, stats] = await Promise.all([
    CrmQuote.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).populate("deal", "title number").populate("company", "name").lean(),
    CrmQuote.countDocuments(filter),
    CrmQuote.aggregate([{ $match: await scoped(req, { tenant: tid(req) }) }, { $group: { _id: "$status", n: { $sum: 1 }, v: { $sum: "$total" } } }]),
  ]);
  res.json({ ok: true, data: items.map((q: any) => quoteView(q)), total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)), stats: Object.fromEntries(stats.map((s: any) => [s._id, { n: s.n, value: s.v }])) });
}));

r.post("/crm/quotes", require_("leads", "create"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const q: any = new CrmQuote({ tenant: req.tenantId, token: newToken(), owner: by(req), createdBy: by(req), validTill: new Date(Date.now() + 15 * 86_400_000) });
  // from a deal: the customer and the lines come with it
  const deal: any = oid(b.deal) ? await CrmDeal.findOne({ _id: oid(b.deal), tenant: req.tenantId }).populate("company").lean() : null;
  if (deal) {
    q.subject = deal.title;
    q.customer = { name: deal.company?.name || deal.contactName, email: deal.contactEmail || deal.company?.email || "", phone: deal.contactPhone || deal.company?.phone || "", address: [deal.company?.address, deal.company?.city, deal.company?.state].filter(Boolean).join(", "), gstin: deal.company?.gstin || "" };
    if (!b.items && deal.items?.length) q.items = deal.items;
    q.owner = deal.owner;
  }
  await quoteFields(req, q, { ...b, deal: b.deal });
  if (!q.items.length) throw new ApiError(400, "Add at least one line");
  if (!q.customer?.name) throw new ApiError(400, "Customer name is required");
  q.number = await nextNumber(req.tenantId, "quote");
  q.quoteNo = `${await quotePrefix(req.tenantId)}${String(q.number).padStart(4, "0")}`;
  await q.save();
  await audit({ tenant: req.tenantId, user: by(req), action: "CREATE", module: "Quotations", entity: q.quoteNo });
  ok(res, q, 201);
}));

r.get("/crm/quotes/:id", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const q: any = await CrmQuote.findOne({ _id: oid(req.params.id), tenant: req.tenantId }).populate("deal", "title number").populate("company", "name").lean();
  if (!q) throw new ApiError(404, "Quotation not found");
  await mustSee(req, q);
  ok(res, quoteView(q, await appUrl(req.tenantId)));
}));

r.patch("/crm/quotes/:id", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const q: any = await CrmQuote.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!q) throw new ApiError(404, "Quotation not found");
  await mustSee(req, q);
  const b = req.body || {};
  const editing = ["subject", "customer", "items", "adjustment", "adjustmentLabel", "validTill", "terms", "notes", "deal", "company"].some((k) => b[k] !== undefined);
  if (editing && ["accepted", "rejected"].includes(q.status)) throw new ApiError(400, `This quotation was ${q.status}. Duplicate it to make changes.`);
  await quoteFields(req, q, b);
  if (editing && q.status === "sent") q.status = "draft"; // changed after sending: send it again
  if (b.status !== undefined) {
    if (!(QUOTE_STATUSES as readonly string[]).includes(b.status)) throw new ApiError(400, "Pick a status");
    q.status = b.status;
    if (["accepted", "rejected"].includes(b.status)) { q.respondedAt = new Date(); q.response = { name: by(req), note: str(b.responseNote, 500) || "Marked by staff" }; }
  }
  if (!q.items.length) throw new ApiError(400, "Add at least one line");
  await q.save();
  ok(res, quoteView(q.toObject(), await appUrl(req.tenantId)));
}));

r.post("/crm/quotes/:id/duplicate", require_("leads", "create"), asyncHandler(async (req: any, res: any) => {
  const src: any = await CrmQuote.findOne({ _id: oid(req.params.id), tenant: req.tenantId }).lean();
  if (!src) throw new ApiError(404, "Quotation not found");
  await mustSee(req, src);
  const { _id, createdAt, updatedAt, token, number, quoteNo, status, sentAt, viewedAt, views, respondedAt, response, ...rest } = src;
  const n = await nextNumber(req.tenantId, "quote");
  const q = await CrmQuote.create({ ...rest, token: newToken(), number: n, quoteNo: `${await quotePrefix(req.tenantId)}${String(n).padStart(4, "0")}`, status: "draft", validTill: new Date(Date.now() + 15 * 86_400_000), createdBy: by(req) });
  ok(res, q, 201);
}));

r.post("/crm/quotes/:id/send", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const q: any = await CrmQuote.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!q) throw new ApiError(404, "Quotation not found");
  await mustSee(req, q);
  if (["accepted", "rejected"].includes(q.status)) throw new ApiError(400, `This quotation was already ${q.status}`);
  // a discount above the allowed limit needs approval first
  const rule = (await approvalRules(req.tenantId)).quote_discount;
  const pct = maxDiscountPct(q);
  if (rule.enabled && pct > rule.maxPct && !(q.approval?.status === "approved" && pct <= (q.approval.pct || 0))) {
    const e: any = new ApiError(409, q.approval?.status === "pending" ? "The discount is waiting for approval" : `A discount of ${pct}% is above the ${rule.maxPct}% limit. Ask for approval first.`);
    e.details = { needsApproval: true, pct, limit: rule.maxPct, status: q.approval?.status || "" };
    throw e;
  }
  const base = await appUrl(req.tenantId);
  const link = `${base}/quote/${q.token}`;
  const to = str(req.body?.email, 120).toLowerCase() || q.customer.email;
  let emailed = false;
  if (req.body?.channel !== "link") {
    if (!to || !isValidEmail(to)) throw new ApiError(400, "Add the customer's email first");
    const org: any = await OrganizationDetails.findOne({ tenant: req.tenantId }).select("name").lean();
    const msg = str(req.body?.message, 2000) || `Dear ${q.customer.name},\n\nPlease find our quotation ${q.quoteNo} for ₹${q.total.toLocaleString("en-IN")}.`;
    await sendEmail({ to, subject: `Quotation ${q.quoteNo}${org?.name ? ` from ${org.name}` : ""}`, html: `<p>${msg.replace(/[&<>]/g, (c: string) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string)).replace(/\n/g, "<br>")}</p><p><a href="${link}">View and accept the quotation</a></p>`, text: `${msg}\n\n${link}` });
    emailed = true;
  }
  if (q.status === "draft") q.status = "sent";
  q.sentAt = new Date();
  await q.save();
  if (q.lead) await logActivity({ tenant: req.tenantId, lead: q.lead, type: "email", by: by(req), title: `Quotation ${q.quoteNo} sent`, detail: `₹${q.total.toLocaleString("en-IN")}` }).catch(() => undefined);
  ok(res, { link, emailed, status: q.status });
}));

r.delete("/crm/quotes/:id", require_("leads", "del"), asyncHandler(async (req: any, res: any) => {
  const q: any = await CrmQuote.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!q) throw new ApiError(404, "Quotation not found");
  await mustSee(req, q);
  await q.deleteOne();
  await audit({ tenant: req.tenantId, user: by(req), action: "DELETE", module: "Quotations", entity: q.quoteNo });
  ok(res, { deleted: true });
}));

/* ═════════════ public: the customer's quotation page ═════════════ */

const respondLimiter = rateLimit({ windowMs: 10 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

publicSalesRoutes.get("/public/quote/:token", asyncHandler(async (req: any, res: any) => {
  const q: any = await CrmQuote.findOne({ token: str(req.params.token, 60) });
  if (!q || q.status === "draft") throw new ApiError(404, "This quotation link is not valid");
  if (req.query.view === "1") { q.views = (q.views || 0) + 1; if (!q.viewedAt) q.viewedAt = new Date(); await q.save(); }
  const [org, s] = await Promise.all([OrganizationDetails.findOne({ tenant: q.tenant }).select("name logo email phone address").lean(), crmSettingsFor(q.tenant)]);
  const o: any = org || {};
  ok(res, {
    quoteNo: q.quoteNo, subject: q.subject, customer: q.customer, items: q.items, adjustment: q.adjustment, adjustmentLabel: q.adjustmentLabel,
    subtotal: q.subtotal, discountTotal: q.discountTotal, taxTotal: q.taxTotal, total: q.total, validTill: q.validTill, terms: q.terms, notes: q.notes,
    status: expired(q) ? "expired" : q.status, createdAt: q.createdAt, respondedAt: q.respondedAt, response: q.response,
    seller: { name: (s as any).billing?.legalName || o.name || "", address: (s as any).billing?.address || o.address || "", gstin: (s as any).billing?.gstin || "", logo: o.logo || "", email: o.email || "", phone: o.phone || "" },
  });
}));

publicSalesRoutes.post("/public/quote/:token/respond", respondLimiter, asyncHandler(async (req: any, res: any) => {
  const q: any = await CrmQuote.findOne({ token: str(req.params.token, 60) });
  if (!q || q.status === "draft") throw new ApiError(404, "This quotation link is not valid");
  if (q.status !== "sent") throw new ApiError(400, `This quotation was already ${q.status}`);
  if (expired(q)) throw new ApiError(400, "This quotation has expired. Ask for a new one.");
  const accept = req.body?.decision === "accept";
  const name = str(req.body?.name, 120);
  if (accept && !name) throw new ApiError(400, "Type your name to accept");
  q.status = accept ? "accepted" : "rejected";
  q.respondedAt = new Date();
  q.response = { name: name || q.customer.name, note: str(req.body?.note, 1000) };
  await q.save();
  if (q.deal) {
    const d: any = await CrmDeal.findById(q.deal);
    if (d) { d.notes.unshift({ text: `Quotation ${q.quoteNo} ${q.status} by ${q.response.name}${q.response.note ? `: ${q.response.note}` : ""}`, by: "Customer", at: new Date() }); if (accept) d.value = q.total; await d.save(); }
  }
  if (q.lead) await logActivity({ tenant: q.tenant, lead: q.lead, type: "note", by: "Customer", title: `Quotation ${q.quoteNo} ${q.status}`, detail: q.response.note }).catch(() => undefined);
  const u: any = await User.findOne({ tenant: q.tenant, name: q.owner }).select("_id").lean();
  if (u) await notify({ tenantId: q.tenant, users: [u._id], category: "crm_lead", title: `Quotation ${q.quoteNo} ${q.status}`, body: `${q.customer.name} · ₹${q.total.toLocaleString("en-IN")}`, link: `/crm/quotes?quote=${q._id}` }).catch(() => undefined);
  ok(res, { status: q.status });
}));

export default r;
