import { Router } from "express";
import { Types, Model } from "mongoose";
import { require_ } from "../middleware/auth";
import { ok, asyncHandler, ApiError, audit } from "../utils/http";
import { Lead } from "../models/Lead";
import { FollowUp } from "../models/FollowUp";
import { LeadActivity } from "../models/LeadActivity";
import { LeadStatus, SubStatus, LeadSource } from "../models/Masters";
import { Registration } from "../models/Registration";
import { LeadFee } from "../models/CrmExtras";
import { CrmQuery } from "../models/CrmPro";
import { CrmForm, CrmFormSubmission } from "../models/CrmForm";
import { CrmDeal, CrmDealStage, CrmQuote, CrmCompany } from "../models/CrmSales";
import { CrmReport } from "../models/CrmReport";
import { leadOwnerScope, scopeLeadFilter } from "../services/leadAccess";
import { assignableOwners } from "../services/leadService";
import { tzOffsetMin, localDateKey, localDateTime, isDateKey } from "../utils/dates";

/**
 * CRM → Report builder: one query engine over the CRM's data. A report is a spec
 * (source, columns, filters, period, grouping, measures, sort); dashboards are
 * lists of such specs shown as cards, charts and tables. Only whitelisted fields
 * can be read, and every source keeps the lead visibility rules.
 */
const r = Router();
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

type FType = "string" | "number" | "date" | "bool" | "ref" | "enum" | "array";
interface FieldDef { label: string; type: FType; path: string; ref?: string; options?: string[] }
interface SourceDef { label: string; model: Model<any>; date: string; owner?: string; viaLead?: string; fields: Record<string, FieldDef> }

const F = (label: string, type: FType, path: string, extra: Partial<FieldDef> = {}): FieldDef => ({ label, type, path, ...extra });
export const SOURCES: Record<string, SourceDef> = {
  leads: {
    label: "Leads", model: Lead, date: "createdAt", owner: "owner",
    fields: {
      name: F("Name", "string", "name"), phone: F("Phone", "string", "phone"), email: F("Email", "string", "email"),
      course: F("Course", "string", "course"), city: F("City", "string", "city"), state: F("State", "string", "state"), grade: F("Class / grade", "string", "grade"),
      branch: F("Branch", "string", "branch"), owner: F("Owner", "string", "owner"),
      status: F("Status", "ref", "status", { ref: "status" }), subStatus: F("Sub-status", "ref", "subStatus", { ref: "subStatus" }), source: F("Source", "ref", "source", { ref: "source" }),
      priority: F("Priority", "enum", "priority", { options: ["hot", "warm", "cold"] }), score: F("Score", "number", "score"), value: F("Value", "number", "value"),
      enquiryCount: F("Enquiries", "number", "enquiryCount"), followUpCount: F("Follow-ups done", "number", "followUpCount"), tags: F("Tags", "array", "tags"),
      lostReason: F("Lost reason", "string", "lostReason"), capturedFrom: F("Captured from", "string", "capturedFrom"),
      utmSource: F("UTM source", "string", "utm.source"), utmCampaign: F("UTM campaign", "string", "utm.campaign"),
      createdAt: F("Created", "date", "createdAt"), lastActivity: F("Last activity", "date", "lastActivity"), nextFollowUp: F("Next follow-up", "date", "nextFollowUp"),
      firstContactedAt: F("First contacted", "date", "firstContactedAt"), statusChangedAt: F("Status changed", "date", "statusChangedAt"),
    },
  },
  followups: {
    label: "Follow-ups", model: FollowUp, date: "due", owner: "owner",
    fields: {
      leadName: F("Lead", "string", "leadName"), phone: F("Phone", "string", "phone"), type: F("Type", "string", "type"), owner: F("Owner", "string", "owner"),
      due: F("Due", "date", "due"), done: F("Done", "bool", "done"), outcome: F("Outcome", "string", "outcome"), note: F("Note", "string", "note"),
      completedAt: F("Completed", "date", "completedAt"), createdAt: F("Created", "date", "createdAt"),
    },
  },
  applications: {
    label: "Applications", model: Registration, date: "createdAt", viaLead: "lead",
    fields: {
      appNo: F("Application no.", "string", "appNo"), name: F("Name", "string", "name"), phone: F("Phone", "string", "phone"), email: F("Email", "string", "email"),
      course: F("Course", "string", "course"), stage: F("Stage", "string", "stage"), offerAmount: F("Offer fee", "number", "offer.amount"),
      offerResponse: F("Offer reply", "string", "offer.response"), offerSentAt: F("Offer sent", "date", "offer.sentAt"), createdAt: F("Applied", "date", "createdAt"),
    },
  },
  deals: {
    label: "Deals", model: CrmDeal, date: "createdAt", owner: "owner",
    fields: {
      number: F("Deal no.", "number", "number"), title: F("Title", "string", "title"), company: F("Company", "ref", "company", { ref: "company" }),
      stage: F("Stage", "ref", "stage", { ref: "dealStage" }), value: F("Value", "number", "value"), owner: F("Owner", "string", "owner"),
      priority: F("Priority", "enum", "priority", { options: ["low", "medium", "high"] }), source: F("Source", "string", "source"), contactName: F("Contact", "string", "contactName"),
      expectedClose: F("Expected close", "date", "expectedClose"), closedAt: F("Closed", "date", "closedAt"), lostReason: F("Lost reason", "string", "lostReason"),
      createdAt: F("Created", "date", "createdAt"),
    },
  },
  quotes: {
    label: "Quotations", model: CrmQuote, date: "createdAt", owner: "owner",
    fields: {
      quoteNo: F("Quotation no.", "string", "quoteNo"), customer: F("Customer", "string", "customer.name"), subject: F("Subject", "string", "subject"),
      status: F("Status", "enum", "status", { options: ["draft", "sent", "accepted", "rejected"] }), subtotal: F("Subtotal", "number", "subtotal"),
      discountTotal: F("Discount", "number", "discountTotal"), taxTotal: F("Tax", "number", "taxTotal"), total: F("Total", "number", "total"),
      owner: F("Owner", "string", "owner"), views: F("Views", "number", "views"), validTill: F("Valid till", "date", "validTill"), createdAt: F("Created", "date", "createdAt"),
    },
  },
  submissions: {
    label: "Form submissions", model: CrmFormSubmission, date: "submittedAt",
    fields: {
      refNo: F("Reference", "string", "refNo"), form: F("Form", "ref", "form", { ref: "form" }), status: F("Status", "enum", "status", { options: ["new", "review", "accepted", "rejected"] }),
      name: F("Name", "string", "name"), phone: F("Phone", "string", "phone"), email: F("Email", "string", "email"), amount: F("Fee", "number", "amount"), paid: F("Paid", "bool", "paid"),
      utmSource: F("UTM source", "string", "meta.utm.source"), utmCampaign: F("UTM campaign", "string", "meta.utm.campaign"), via: F("Via", "string", "meta.via"),
      submittedAt: F("Submitted", "date", "submittedAt"),
    },
  },
  fees: {
    label: "Fees & payments", model: LeadFee, date: "createdAt", viaLead: "lead",
    fields: {
      title: F("Fee", "string", "title"), amount: F("Amount", "number", "amount"), discount: F("Concession", "number", "discount"), paidAmount: F("Paid", "number", "paidAmount"),
      status: F("Status", "enum", "status", { options: ["pending", "paid", "cancelled"] }), mode: F("Mode", "string", "mode"), receiptNo: F("Receipt", "string", "receiptNo"),
      dueDate: F("Due", "date", "dueDate"), paidAt: F("Paid on", "date", "paidAt"), createdAt: F("Created", "date", "createdAt"),
    },
  },
  queries: {
    label: "Queries", model: CrmQuery, date: "createdAt",
    fields: {
      number: F("Number", "number", "number"), subject: F("Subject", "string", "subject"), name: F("From", "string", "name"), category: F("Category", "string", "category"),
      priority: F("Priority", "enum", "priority", { options: ["low", "medium", "high", "urgent"] }), status: F("Status", "enum", "status", { options: ["open", "pending", "resolved", "closed"] }),
      assignedTo: F("Assigned to", "string", "assignedTo"), raisedVia: F("Raised via", "string", "raisedVia"), createdAt: F("Raised", "date", "createdAt"), resolvedAt: F("Resolved", "date", "resolvedAt"),
    },
  },
  activities: {
    label: "Lead timeline", model: LeadActivity, date: "at", viaLead: "lead",
    fields: { type: F("Type", "string", "type"), title: F("What", "string", "title"), detail: F("Detail", "string", "detail"), by: F("By", "string", "by"), at: F("When", "date", "at") },
  },
};

const AGGS = ["count", "sum", "avg", "min", "max", "distinct"] as const;
const OPS = ["eq", "ne", "in", "nin", "contains", "starts", "gt", "gte", "lt", "lte", "between", "empty", "notEmpty", "true", "false"] as const;
const BUCKETS: Record<string, string> = { day: "%Y-%m-%d", week: "%G-W%V", month: "%Y-%m", quarter: "Q", year: "%Y" };
const tz = (() => { const m = Math.abs(tzOffsetMin); return `${tzOffsetMin < 0 ? "-" : "+"}${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; })();

/* ───────────── periods ───────────── */
const addDays = (key: string, n: number) => localDateKey(new Date(localDateTime(key).getTime() + n * 86_400_000 + 3_600_000));
export function periodRange(p: any): { from: Date | null; to: Date | null; label: string } {
  const today = localDateKey();
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = (k: string) => localDateTime(k), end = (k: string) => new Date(localDateTime(k).getTime() + 86_400_000 - 1);
  const preset = str(p?.preset, 20) || "all";
  const dow = (new Date(localDateTime(today).getTime() + tzOffsetMin * 60_000).getUTCDay() + 6) % 7; // Monday = 0
  switch (preset) {
    case "today": return { from: day(today), to: end(today), label: "Today" };
    case "yesterday": { const k = addDays(today, -1); return { from: day(k), to: end(k), label: "Yesterday" }; }
    case "this_week": return { from: day(addDays(today, -dow)), to: end(today), label: "This week" };
    case "last_7": return { from: day(addDays(today, -6)), to: end(today), label: "Last 7 days" };
    case "last_30": return { from: day(addDays(today, -29)), to: end(today), label: "Last 30 days" };
    case "last_90": return { from: day(addDays(today, -89)), to: end(today), label: "Last 90 days" };
    case "this_month": return { from: day(`${y}-${pad(m)}-01`), to: end(today), label: "This month" };
    case "last_month": { const ly = m === 1 ? y - 1 : y, lm = m === 1 ? 12 : m - 1; return { from: day(`${ly}-${pad(lm)}-01`), to: new Date(day(`${y}-${pad(m)}-01`).getTime() - 1), label: "Last month" }; }
    case "this_quarter": { const qm = Math.floor((m - 1) / 3) * 3 + 1; return { from: day(`${y}-${pad(qm)}-01`), to: end(today), label: "This quarter" }; }
    case "this_year": return { from: day(`${y}-01-01`), to: end(today), label: "This year" };
    case "fy": { const fy = m >= 4 ? y : y - 1; return { from: day(`${fy}-04-01`), to: end(today), label: "This financial year" }; }
    case "custom": return { from: isDateKey(p?.from) ? day(p.from) : null, to: isDateKey(p?.to) ? end(p.to) : null, label: `${p?.from || "…"} – ${p?.to || "…"}` };
    default: return { from: null, to: null, label: "All time" };
  }
}
/** the same length of time just before, for "vs previous period" */
function previousRange(cur: { from: Date | null; to: Date | null }) {
  if (!cur.from || !cur.to) return null;
  const len = cur.to.getTime() - cur.from.getTime() + 1;
  return { from: new Date(cur.from.getTime() - len), to: new Date(cur.from.getTime() - 1) };
}

/* ───────────── building the query ───────────── */
function cast(f: FieldDef, v: any): any {
  if (Array.isArray(v)) return v.map((x) => cast(f, x));
  if (f.type === "number") { const n = Number(v); if (!Number.isFinite(n)) throw new ApiError(400, `${f.label} needs a number`); return n; }
  if (f.type === "date") { if (!isDateKey(v)) throw new ApiError(400, `${f.label} needs a date`); return localDateTime(v); }
  if (f.type === "bool") return v === true || v === "true" || v === "yes";
  if (f.type === "ref") { if (!Types.ObjectId.isValid(String(v))) throw new ApiError(400, `Pick a ${f.label}`); return new Types.ObjectId(String(v)); }
  return String(v ?? "").slice(0, 200);
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function condition(f: FieldDef, op: string, value: any) {
  const p = f.path;
  switch (op) {
    case "eq": return f.type === "string" ? { [p]: new RegExp(`^${esc(String(value))}$`, "i") } : { [p]: cast(f, value) };
    case "ne": return f.type === "string" ? { [p]: { $not: new RegExp(`^${esc(String(value))}$`, "i") } } : { [p]: { $ne: cast(f, value) } };
    case "in": return { [p]: { $in: cast(f, Array.isArray(value) ? value : String(value).split(",").map((x) => x.trim()).filter(Boolean)) } };
    case "nin": return { [p]: { $nin: cast(f, Array.isArray(value) ? value : String(value).split(",").map((x) => x.trim()).filter(Boolean)) } };
    case "contains": return { [p]: new RegExp(esc(String(value || "")), "i") };
    case "starts": return { [p]: new RegExp(`^${esc(String(value || ""))}`, "i") };
    case "gt": return { [p]: { $gt: cast(f, value) } };
    case "gte": return { [p]: { $gte: cast(f, value) } };
    case "lt": return { [p]: { $lt: f.type === "date" ? new Date(cast(f, value).getTime()) : cast(f, value) } };
    case "lte": return { [p]: { $lte: f.type === "date" ? new Date(cast(f, value).getTime() + 86_400_000 - 1) : cast(f, value) } };
    case "between": { const [a, b] = Array.isArray(value) ? value : String(value).split(","); const out: any = {}; if (a) out.$gte = cast(f, a); if (b) out.$lte = f.type === "date" ? new Date(cast(f, b).getTime() + 86_400_000 - 1) : cast(f, b); return { [p]: out }; }
    case "empty": return { $or: [{ [p]: { $exists: false } }, { [p]: null }, { [p]: "" }, ...(f.type === "array" ? [{ [p]: { $size: 0 } }] : [])] };
    case "notEmpty": return { [p]: { $exists: true, $nin: [null, "", ...(f.type === "array" ? [[]] : [])] } };
    case "true": return { [p]: true };
    case "false": return { [p]: { $ne: true } };
    default: throw new ApiError(400, "Unknown filter");
  }
}

async function baseMatch(req: any, src: SourceDef, spec: any, range: { from: Date | null; to: Date | null } | null) {
  const and: any[] = [{ tenant: new Types.ObjectId(String(req.tenantId)) }];
  if (src.model === CrmFormSubmission) and.push({ status: { $ne: "draft" } });
  // the same people as on the Leads page
  const names = await leadOwnerScope(req);
  if (src.owner && names) and.push({ [src.owner]: { $in: names } });
  if (src.viaLead && (names || req.leadBranches?.length)) {
    const ids = (await Lead.find(await scopeLeadFilter(req, { tenant: req.tenantId })).select("_id").lean()).map((l: any) => l._id);
    and.push({ [src.viaLead]: { $in: ids } });
  }
  const dateField = src.fields[str(spec.dateField, 40)]?.type === "date" ? src.fields[str(spec.dateField, 40)].path : src.date;
  if (range?.from || range?.to) and.push({ [dateField]: { ...(range.from ? { $gte: range.from } : {}), ...(range.to ? { $lte: range.to } : {}) } });
  for (const fl of (Array.isArray(spec.filters) ? spec.filters : []).slice(0, 20)) {
    const f = src.fields[str(fl?.field, 40)];
    if (!f) continue;
    if (!(OPS as readonly string[]).includes(fl.op)) throw new ApiError(400, "Unknown filter");
    if (!["empty", "notEmpty", "true", "false"].includes(fl.op) && (fl.value === undefined || fl.value === "" || (Array.isArray(fl.value) && !fl.value.length))) continue;
    and.push(condition(f, fl.op, fl.value));
  }
  return { $and: and };
}

/** names for ids: statuses, sources, stages, companies, forms */
async function refNames(tenant: any) {
  const [st, sub, srcs, stages, cos, forms] = await Promise.all([
    LeadStatus.find({ tenant }).select("name color").lean(), SubStatus.find({ tenant }).select("name").lean(), LeadSource.find({ tenant }).select("name").lean(),
    CrmDealStage.find({ tenant }).select("name color").lean(), CrmCompany.find({ tenant }).select("name").lean(), CrmForm.find({ tenant }).select("name").lean(),
  ]);
  const m = new Map<string, { name: string; color?: string }>();
  for (const x of [...st, ...sub, ...srcs, ...stages, ...cos, ...forms] as any[]) m.set(String(x._id), { name: x.name, color: x.color });
  return m;
}

function groupExpr(f: FieldDef, bucket?: string) {
  const p = `$${f.path}`;
  if (f.type === "date") {
    if (bucket === "quarter") return { $concat: [{ $toString: { $year: { date: p, timezone: tz } } }, "-Q", { $toString: { $ceil: { $divide: [{ $month: { date: p, timezone: tz } }, 3] } } }] };
    return { $dateToString: { format: BUCKETS[bucket || "month"] || BUCKETS.month, date: p, timezone: tz } };
  }
  return p;
}
function measureExpr(src: SourceDef, m: any) {
  const agg = (AGGS as readonly string[]).includes(m?.agg) ? m.agg : "count";
  if (agg === "count") return { $sum: 1 };
  const f = src.fields[str(m?.field, 40)];
  if (!f) throw new ApiError(400, "Pick a field to add up");
  if (agg === "distinct") return { $addToSet: `$${f.path}` };
  if (f.type !== "number") throw new ApiError(400, `${f.label} is not a number`);
  return { [`$${agg}`]: `$${f.path}` };
}
const measureLabel = (src: SourceDef, m: any) => {
  const agg = (AGGS as readonly string[]).includes(m?.agg) ? m.agg : "count";
  if (agg === "count") return `${src.label}`;
  const f = src.fields[m?.field];
  return `${{ sum: "Total", avg: "Average", min: "Lowest", max: "Highest", distinct: "Unique" }[agg as string] || agg} ${f?.label?.toLowerCase() || ""}`.trim();
};

/** run a spec → { columns, rows, total } */
export async function runSpec(req: any, spec: any) {
  const src = SOURCES[str(spec?.source, 30)];
  if (!src) throw new ApiError(400, "Pick what to report on");
  const range = periodRange(spec.period || {});
  const match = await baseMatch(req, src, spec, range);
  const names = await refNames(req.tenantId);
  const show = (f: FieldDef, v: any) => {
    if (v === null || v === undefined || v === "") return "";
    if (f.type === "ref") return names.get(String(v))?.name || "—";
    if (f.type === "bool") return v ? "Yes" : "No";
    if (f.type === "array") return Array.isArray(v) ? v.join(", ") : String(v);
    return v;
  };
  const groups = (Array.isArray(spec.groupBy) ? spec.groupBy : []).map((g: any) => (typeof g === "string" ? { field: g } : g)).filter((g: any) => src.fields[g?.field]).slice(0, 2);
  const measures = (Array.isArray(spec.measures) && spec.measures.length ? spec.measures : [{ agg: "count" }]).slice(0, 6);
  const limit = Math.min(5000, Math.max(1, Number(spec.limit) || 500));

  /* summary: grouped (or one totals row) */
  if (groups.length || spec.mode === "summary") {
    const _id: any = {};
    groups.forEach((g: any, i: number) => { _id[`g${i}`] = groupExpr(src.fields[g.field], g.bucket); });
    const $group: any = { _id: groups.length ? _id : null };
    measures.forEach((m: any, i: number) => { $group[`m${i}`] = measureExpr(src, m); });
    const pipeline: any[] = [{ $match: match }];
    // tags: one row per tag
    for (const g of groups) if (src.fields[g.field].type === "array") pipeline.push({ $unwind: { path: `$${src.fields[g.field].path}`, preserveNullAndEmptyArrays: true } });
    pipeline.push({ $group });
    const rowsRaw = await src.model.aggregate(pipeline).allowDiskUse(true);
    const columns = [
      ...groups.map((g: any, i: number) => ({ key: `g${i}`, label: src.fields[g.field].label + (src.fields[g.field].type === "date" ? ` (${g.bucket || "month"})` : ""), type: src.fields[g.field].type === "date" ? "string" : src.fields[g.field].type === "number" ? "number" : "string", group: true })),
      ...measures.map((m: any, i: number) => ({ key: `m${i}`, label: str(m.label, 60) || measureLabel(src, m), type: "number", measure: true, money: !!m.money || ["value", "amount", "total", "subtotal", "taxTotal", "discountTotal", "paidAmount", "discount", "offerAmount"].includes(m.field) })),
    ];
    let rows = rowsRaw.map((x: any) => {
      const row: any = {};
      groups.forEach((g: any, i: number) => {
        const f = src.fields[g.field]; const v = x._id?.[`g${i}`];
        row[`g${i}`] = f.type === "date" ? v || "—" : show(f, v) || "—";
        if (f.type === "ref") row[`c${i}`] = names.get(String(v))?.color;
      });
      measures.forEach((m: any, i: number) => { const v = x[`m${i}`]; row[`m${i}`] = Array.isArray(v) ? v.length : Math.round((Number(v) || 0) * 100) / 100; });
      return row;
    });
    const sortKey = str(spec.sort?.by, 10);
    const dir = spec.sort?.dir === "asc" ? 1 : -1;
    if (sortKey && columns.some((c) => c.key === sortKey)) rows.sort((a: any, b: any) => (a[sortKey] > b[sortKey] ? dir : a[sortKey] < b[sortKey] ? -dir : 0));
    else if (groups.some((g: any) => src.fields[g.field].type === "date")) rows.sort((a: any, b: any) => String(a.g0).localeCompare(String(b.g0)));
    else rows.sort((a: any, b: any) => b.m0 - a.m0);
    const total = rows.length;
    rows = rows.slice(0, limit);
    const totals: any = {};
    measures.forEach((m: any, i: number) => { if (["count", "sum"].includes(m.agg || "count")) totals[`m${i}`] = Math.round(rowsRaw.reduce((a: number, x: any) => a + (Number(x[`m${i}`]) || 0), 0) * 100) / 100; });
    // "vs previous period" for a single number
    let previous: any = null;
    if (spec.compare && !groups.length) {
      const pr = previousRange(range);
      if (pr) {
        const pm = await baseMatch(req, src, spec, pr);
        const prev = await src.model.aggregate([{ $match: pm }, { $group }]);
        previous = Object.fromEntries(measures.map((_m: any, i: number) => { const v = prev[0]?.[`m${i}`]; return [`m${i}`, Array.isArray(v) ? v.length : Math.round((Number(v) || 0) * 100) / 100]; }));
      }
    }
    return { mode: "summary", source: spec.source, sourceLabel: src.label, period: range.label, columns, rows, total, totals, previous };
  }

  /* list: one row per record */
  const cols = (Array.isArray(spec.columns) && spec.columns.length ? spec.columns : Object.keys(src.fields).slice(0, 6)).filter((c: string) => src.fields[c]).slice(0, 30);
  const sortF = src.fields[str(spec.sort?.by, 40)];
  const sort: any = { [sortF ? sortF.path : src.date]: spec.sort?.dir === "asc" ? 1 : -1 };
  const page = Math.max(1, Number(spec.page) || 1);
  const per = Math.min(limit, 200);
  const project: any = { _id: 1 };
  for (const c of cols) project[src.fields[c].path] = 1;
  if (src.viaLead) project[src.viaLead] = 1;
  const [docs, total] = await Promise.all([
    src.model.find(match).sort(sort).skip(spec.all ? 0 : (page - 1) * per).limit(spec.all ? limit : per).select(project).lean(),
    src.model.countDocuments(match),
  ]);
  const get = (o: any, p: string) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const rows = (docs as any[]).map((d) => {
    const row: any = { _id: d._id, _lead: src === SOURCES.leads ? d._id : src.viaLead ? d[src.viaLead] : undefined };
    for (const c of cols) { const f = src.fields[c]; const v = get(d, f.path); row[c] = f.type === "date" ? (v ? new Date(v).toISOString() : "") : show(f, v); if (f.type === "ref") row[`${c}__color`] = names.get(String(v))?.color; }
    return row;
  });
  return { mode: "list", source: spec.source, sourceLabel: src.label, period: range.label, columns: cols.map((c: string) => ({ key: c, label: src.fields[c].label, type: src.fields[c].type, money: ["value", "amount", "total", "subtotal", "taxTotal", "discountTotal", "paidAmount", "discount", "offerAmount"].includes(c) })), rows, total, page, pages: Math.max(1, Math.ceil(total / per)) };
}

/* ═════════════ API ═════════════ */

r.get("/crm/reports/meta", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const tenant = req.tenantId;
  const [statuses, subs, sources, stages, companies, forms, owners] = await Promise.all([
    LeadStatus.find({ tenant }).sort({ order: 1 }).select("name").lean(), SubStatus.find({ tenant }).select("name").lean(), LeadSource.find({ tenant }).select("name").lean(),
    CrmDealStage.find({ tenant }).sort({ order: 1 }).select("name").lean(), CrmCompany.find({ tenant }).sort({ name: 1 }).limit(500).select("name").lean(), CrmForm.find({ tenant }).sort({ name: 1 }).select("name").lean(),
    assignableOwners(tenant),
  ]);
  const refs: Record<string, any[]> = { status: statuses, subStatus: subs, source: sources, dealStage: stages, company: companies, form: forms };
  ok(res, {
    sources: Object.entries(SOURCES).map(([key, s]) => ({
      key, label: s.label, date: Object.entries(s.fields).find(([, f]) => f.path === s.date)?.[0] || "",
      fields: Object.entries(s.fields).map(([k, f]) => ({ key: k, label: f.label, type: f.type, options: f.type === "ref" ? (refs[f.ref!] || []).map((x: any) => ({ value: String(x._id), label: x.name })) : f.options ? f.options.map((o) => ({ value: o, label: o[0].toUpperCase() + o.slice(1) })) : k === "owner" || k === "assignedTo" ? owners.map((o) => ({ value: o, label: o })) : undefined })),
    })),
    ops: OPS, aggs: AGGS, buckets: Object.keys(BUCKETS),
  });
}));

r.post("/crm/reports/run", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  ok(res, await runSpec(req, req.body || {}));
}));

/** a list report as an Excel-ready table (all matching rows, up to 5,000) */
r.post("/crm/reports/export", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const out: any = await runSpec(req, { ...(req.body || {}), all: true, limit: 5000 });
  ok(res, out);
}));

/* saved reports and dashboards */
const canEditSaved = (req: any, x: any) => x.createdBy === req.auth?.name || (req.perms || []).some((p: any) => p.module === "setup" && p.edit);
r.get("/crm/reports/saved", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const kind = req.query.kind === "dashboard" ? "dashboard" : req.query.kind === "report" ? "report" : undefined;
  const list = await CrmReport.find({ tenant: req.tenantId, ...(kind ? { kind } : {}), $or: [{ shared: true }, { createdBy: req.auth?.name }] }).sort({ pinned: -1, updatedAt: -1 }).lean();
  ok(res, list.map((x: any) => ({ ...x, canEdit: canEditSaved(req, x) })));
}));
r.get("/crm/reports/saved/:id", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const x: any = Types.ObjectId.isValid(req.params.id) ? await CrmReport.findOne({ _id: req.params.id, tenant: req.tenantId }).lean() : null;
  if (!x || (!x.shared && x.createdBy !== req.auth?.name)) throw new ApiError(404, "Not found");
  ok(res, { ...x, canEdit: canEditSaved(req, x) });
}));
function cleanWidgets(input: unknown) {
  return (Array.isArray(input) ? input : []).slice(0, 40).map((w: any, i: number) => {
    if (!SOURCES[str(w?.spec?.source, 30)]) throw new ApiError(400, `Widget ${i + 1}: pick what to report on`);
    return { id: str(w?.id, 20) || `w${Date.now().toString(36)}${i}`, type: ["kpi", "bar", "line", "pie", "table"].includes(w?.type) ? w.type : "kpi", title: str(w?.title, 80), w: Math.min(4, Math.max(1, Number(w?.w) || 1)), spec: w.spec };
  });
}
r.post("/crm/reports/saved", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const name = str(b.name, 100);
  if (!name) throw new ApiError(400, "Give it a name");
  const kind = b.kind === "dashboard" ? "dashboard" : "report";
  if (kind === "report" && !SOURCES[str(b.spec?.source, 30)]) throw new ApiError(400, "Pick what to report on");
  const x = await CrmReport.create({ tenant: req.tenantId, kind, name, spec: b.spec || {}, widgets: kind === "dashboard" ? cleanWidgets(b.widgets) : [], shared: b.shared !== false, pinned: !!b.pinned, createdBy: req.auth?.name, updatedBy: req.auth?.name });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: kind === "dashboard" ? "Dashboards" : "Reports", entity: name });
  ok(res, x, 201);
}));
r.patch("/crm/reports/saved/:id", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const x: any = Types.ObjectId.isValid(req.params.id) ? await CrmReport.findOne({ _id: req.params.id, tenant: req.tenantId }) : null;
  if (!x) throw new ApiError(404, "Not found");
  if (!canEditSaved(req, x)) throw new ApiError(403, "Only the person who made it can change it");
  const b = req.body || {};
  if (b.name !== undefined) { const n = str(b.name, 100); if (!n) throw new ApiError(400, "Give it a name"); x.name = n; }
  if (b.spec !== undefined) { if (x.kind === "report" && !SOURCES[str(b.spec?.source, 30)]) throw new ApiError(400, "Pick what to report on"); x.spec = b.spec; x.markModified("spec"); }
  if (b.widgets !== undefined && x.kind === "dashboard") { x.widgets = cleanWidgets(b.widgets); x.markModified("widgets"); }
  if (b.shared !== undefined) x.shared = !!b.shared;
  if (b.pinned !== undefined) x.pinned = !!b.pinned;
  x.updatedBy = req.auth?.name;
  await x.save();
  ok(res, x);
}));
r.delete("/crm/reports/saved/:id", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const x: any = Types.ObjectId.isValid(req.params.id) ? await CrmReport.findOne({ _id: req.params.id, tenant: req.tenantId }) : null;
  if (!x) throw new ApiError(404, "Not found");
  if (!canEditSaved(req, x)) throw new ApiError(403, "Only the person who made it can delete it");
  await x.deleteOne();
  ok(res, { deleted: true });
}));

export default r;
