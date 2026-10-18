import { Router } from "express";
import { Types } from "mongoose";
import { require_ } from "../middleware/auth";
import { ok, paginated, asyncHandler, ApiError, audit } from "../utils/http";
import { Campaign, Template } from "../models/Messaging";
import { CrmList } from "../models/CrmPro";
import { LeadSource } from "../models/Masters";
import { User, UserCategory } from "../models/User";
import { RecipientList, CampaignAudience, MAX_RECIPIENTS } from "../models/CampaignPro";
import {
  launchCampaign, resumeCampaign, campaignStats, latestByPhone, rollup, normalizePhone, REPORT_STATUSES, resolveAudience,
} from "../services/campaignService";
import { listMemberFilter } from "./crm3";
import { explainWaError } from "../services/waErrors";

/** Bulk WhatsApp campaigns: recipient lists (import), audiences, live delivery report and resends. */
const r = Router();
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oid = (v: unknown) => (Types.ObjectId.isValid(String(v)) ? new Types.ObjectId(String(v)) : null);
const pageOf = (q: any) => Math.max(1, parseInt(String(q.page || "1"), 10) || 1);
const perPageOf = (q: any, max = 200) => Math.min(max, Math.max(1, parseInt(String(q.perPage || "50"), 10) || 50));
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const key10 = (p: string) => String(p || "").replace(/\D/g, "").slice(-10);
const AUDIENCE_TYPES = ["contacts", "list", "leadList"];
const VAR_SOURCES = ["name", "phone", "column", "text"];

function cleanVariables(input: unknown) {
  return (Array.isArray(input) ? input : []).slice(0, 20).map((v: any) => ({
    source: VAR_SOURCES.includes(v?.source) ? v.source : "text",
    value: str(v?.value, 300),
  }));
}

function cleanSchedule(v: unknown) {
  if (!v) return null;
  const d = new Date(String(v));
  if (isNaN(d.getTime())) throw new ApiError(400, "Invalid schedule time");
  return d;
}

/** Who can be picked as an audience, with labels — validated server-side. */
async function audienceFields(req: any, body: any) {
  const type = AUDIENCE_TYPES.includes(body.audienceType) ? body.audienceType : "contacts";
  if (type === "contacts") {
    const category = str(body.category, 40) || "All";
    return { audienceType: type, audienceRef: null, audienceRefs: [], category, audienceLabel: category === "All" ? "Opted-in contacts" : `Contacts · ${category}` };
  }
  // one or more lists of the same kind (audienceRefs), or the older single audienceRef
  const raw = Array.isArray(body.audienceRefs) && body.audienceRefs.length ? body.audienceRefs : [body.audienceRef];
  const refs = [...new Set(raw.map((x: any) => String(x || "")).filter(Boolean))].map(oid);
  if (!refs.length || refs.some((x) => !x)) throw new ApiError(400, "Pick a list");
  if (refs.length > 20) throw new ApiError(400, "Up to 20 lists at a time");
  const Mdl: any = type === "list" ? RecipientList : CrmList;
  const found = await Mdl.find({ _id: { $in: refs }, tenant: req.tenantId }).select("name").lean();
  if (found.length !== refs.length) throw new ApiError(400, type === "list" ? "List not found" : "Lead list not found");
  const names = refs.map((r) => found.find((f: any) => String(f._id) === String(r))!.name);
  return { audienceType: type, audienceRef: refs[0], audienceRefs: refs, audienceLabel: listLabel(type, names) };
}

/** "Parents 2025", "A + B", "A, B +3 more" — prefixed for lead lists. */
function listLabel(type: string, names: string[]) {
  const shown = names.length <= 2 ? names.join(" + ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`;
  return type === "leadList" ? `Lead list${names.length > 1 ? "s" : ""} · ${shown}` : shown;
}
/** campaigns that send to a list, whether picked alone or with others */
const usesList = (id: any) => ({ $or: [{ audienceRef: id }, { audienceRefs: id }] });

/** Campaign names are unique per tenant (any case), so a resend shows up as its own row. */
async function ensureFreeName(req: any, name: string, exceptId?: any) {
  const clash = await Campaign.findOne({ tenant: req.tenantId, name: new RegExp(`^${escapeRx(name)}$`, "i"), ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).select("_id").lean();
  if (clash) throw new ApiError(409, "A campaign with this name already exists");
}

async function checkTemplate(req: any, name: string) {
  if (!name) throw new ApiError(400, "Pick a template");
  const t = await Template.findOne({ tenant: req.tenantId, name, status: "Approved" }).select("_id").lean();
  if (!t) throw new ApiError(400, "Template is not approved");
}

const leadFilterFor = (req: any) => (list: any) => listMemberFilter(req, list);

async function launchAndRespond(req: any, id: any) {
  try {
    return await launchCampaign({ tenant: req.tenantId, campaignId: String(id), user: req.auth?.name, leadFilter: leadFilterFor(req) });
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, e?.message || "Could not launch");
  }
}

/* ───────────── campaigns ───────────── */

r.get("/campaigns", require_("blast", "view"), asyncHandler(async (req: any, res: any) => {
  const page = pageOf(req.query);
  const perPage = perPageOf(req.query);
  const filter: any = { tenant: req.tenantId };
  if (typeof req.query.status === "string" && req.query.status && req.query.status !== "All") filter.status = req.query.status;
  const q = str(req.query.q);
  if (q) filter.$or = [{ name: new RegExp(escapeRx(q), "i") }, { template: new RegExp(escapeRx(q), "i") }];
  const [items, total] = await Promise.all([
    Campaign.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
    Campaign.countDocuments(filter),
  ]);
  const stats = await campaignStats(items.map((c) => c._id));
  const parents = new Map<string, string>();
  const parentIds = items.map((c: any) => c.parentCampaign).filter(Boolean);
  if (parentIds.length) for (const p of await Campaign.find({ _id: { $in: parentIds } }).select("name").lean()) parents.set(String(p._id), p.name);
  const childCounts = new Map<string, number>();
  for (const c of await Campaign.aggregate([{ $match: { tenant: new Types.ObjectId(String(req.tenantId)), parentCampaign: { $in: items.map((i) => i._id) } } }, { $group: { _id: "$parentCampaign", n: { $sum: 1 } } }])) childCounts.set(String(c._id), c.n);
  const out = items.map((c: any) => {
    const s = stats.get(String(c._id)) || rollup({});
    return {
      ...c,
      sent: s.sent, delivered: s.delivered, read: s.read, failed: s.failed,
      pending: Math.max(0, (c.audienceSize || 0) - s.attempted),
      parentName: c.parentCampaign ? parents.get(String(c.parentCampaign)) || "" : "",
      resends: childCounts.get(String(c._id)) || 0,
    };
  });
  paginated(res, out, total, page, perPage);
}));

/** How many unique numbers the picked audience reaches (a number in several lists counts once). */
r.post("/campaigns/audience-preview", require_("blast", "view"), asyncHandler(async (req: any, res: any) => {
  const a: any = await audienceFields(req, req.body || {});
  const rows = await resolveAudience({ ...a, tenant: req.tenantId }, leadFilterFor(req));
  ok(res, { count: rows.length, label: a.audienceLabel });
}));

r.post("/campaigns", require_("blast", "create"), asyncHandler(async (req: any, res: any) => {
  const name = str(req.body.name, 120);
  if (!name) throw new ApiError(400, "Name is required");
  await ensureFreeName(req, name);
  const template = str(req.body.template, 200);
  await checkTemplate(req, template);
  const c = await Campaign.create({
    tenant: req.tenantId,
    name,
    template,
    category: "Utility",
    ...(await audienceFields(req, req.body)),
    variables: cleanVariables(req.body.variables),
    scheduledFor: cleanSchedule(req.body.scheduledFor),
    createdBy: req.auth?.name || "",
  });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Blast", entity: name });
  let launch: any = null;
  if (req.body.launch) launch = await launchAndRespond(req, c._id);
  ok(res, { campaign: await Campaign.findById(c._id).lean(), launch }, 201);
}));

r.patch("/campaigns/:id", require_("blast", "edit"), asyncHandler(async (req: any, res: any) => {
  const c = await Campaign.findOne({ _id: req.params.id, tenant: req.tenantId });
  if (!c) throw new ApiError(404, "Campaign not found");
  if (!["Draft", "Scheduled"].includes(c.status)) throw new ApiError(409, "A sent campaign cannot be changed");
  if (req.body.name !== undefined) { const n = str(req.body.name, 120); if (!n) throw new ApiError(400, "Name is required"); await ensureFreeName(req, n, c._id); c.name = n; }
  if (req.body.template !== undefined) { const t = str(req.body.template, 200); await checkTemplate(req, t); c.template = t; }
  if (req.body.audienceType !== undefined && c.audienceType !== "resend") Object.assign(c, await audienceFields(req, req.body));
  if (req.body.variables !== undefined) c.variables = cleanVariables(req.body.variables) as any;
  if (req.body.scheduledFor !== undefined) c.scheduledFor = cleanSchedule(req.body.scheduledFor);
  if (c.status === "Scheduled") c.status = "Draft"; // re-launch to freeze the new audience
  await c.save();
  ok(res, c);
}));

r.delete("/campaigns/:id", require_("blast", "del"), asyncHandler(async (req: any, res: any) => {
  const c = await Campaign.findOne({ _id: req.params.id, tenant: req.tenantId });
  if (!c) throw new ApiError(404, "Campaign not found");
  if (c.status === "Running") throw new ApiError(409, "Pause the campaign first");
  await CampaignAudience.deleteOne({ campaign: c._id });
  await c.deleteOne();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Blast", entity: c.name });
  ok(res, { deleted: true });
}));

r.post("/campaigns/:id/launch", require_("blast", "create"), asyncHandler(async (req: any, res: any) => {
  const c = await Campaign.findOne({ _id: req.params.id, tenant: req.tenantId }).select("_id").lean();
  if (!c) throw new ApiError(404, "Campaign not found");
  ok(res, await launchAndRespond(req, c._id));
}));

/** Pause a running campaign, or resume (continues with whoever has not been sent yet). */
r.post("/campaigns/:id/pause", require_("blast", "edit"), asyncHandler(async (req: any, res: any) => {
  const c = await Campaign.findOne({ _id: req.params.id, tenant: req.tenantId });
  if (!c) throw new ApiError(404, "Campaign not found");
  if (req.body.status === "Running") {
    if (c.status !== "Paused") throw new ApiError(409, "Only a paused campaign can be resumed");
    await resumeCampaign(req.tenantId, String(c._id));
  } else {
    if (c.status !== "Running") throw new ApiError(409, "Only a running campaign can be paused");
    c.status = "Paused";
    await c.save();
  }
  ok(res, await Campaign.findById(c._id).lean());
}));

/**
 * Delivery report: funnel numbers, every recipient with their latest status,
 * and the resend history (the campaign it came from + resends made from it).
 */
r.get("/campaigns/:id/report", require_("blast", "view"), asyncHandler(async (req: any, res: any) => {
  const c: any = await Campaign.findOne({ _id: req.params.id, tenant: req.tenantId }).lean();
  if (!c) throw new ApiError(404, "Campaign not found");
  const audience = await CampaignAudience.findOne({ campaign: c._id }).lean();
  const latest = await latestByPhone(c._id);

  const rows: any[] = [];
  const seen = new Set<string>();
  for (const a of audience?.rows || []) {
    const k = key10(a.phone);
    seen.add(k);
    const m = latest.get(k);
    rows.push({ name: a.name || m?.contactName || "", phone: a.phone, status: m?.status || "pending", sentAt: m?.sentAt || null, deliveredAt: m?.deliveredAt || null, readAt: m?.readAt || null, failReason: m?.failReason || "" });
  }
  for (const [k, m] of latest) {
    if (seen.has(k)) continue;
    rows.push({ name: m.contactName || "", phone: m.phone, status: m.status, sentAt: m.sentAt || null, deliveredAt: m.deliveredAt || null, readAt: m.readAt || null, failReason: m.failReason || "" });
  }

  const exact: Record<string, number> = Object.fromEntries(REPORT_STATUSES.map((s) => [s, 0]));
  for (const row of rows) exact[row.status] = (exact[row.status] || 0) + 1;
  const total = Math.max(c.audienceSize || 0, rows.length);
  const summary = { ...rollup(exact, total), audience: total, exact };

  let list = rows;
  const st = str(req.query.status, 20);
  if (st && st !== "all") list = list.filter((x) => x.status === st);
  const q = str(req.query.q).toLowerCase();
  if (q) list = list.filter((x) => x.name.toLowerCase().includes(q) || x.phone.includes(q));
  const all = req.query.all === "1";
  const page = pageOf(req.query);
  const perPage = all ? MAX_RECIPIENTS : perPageOf(req.query);
  const pageRows = list.slice((page - 1) * perPage, page * perPage).map((x) => {
    if (x.status !== "failed") return x;
    const f = explainWaError(x.failReason);
    return { ...x, failCode: f.code, failTitle: f.title, failFix: f.fix };
  });
  // why messages failed, grouped (whole campaign, not just this page)
  const groups = new Map<string, { code: string; title: string; fix: string; count: number }>();
  for (const x of rows) {
    if (x.status !== "failed") continue;
    const f = explainWaError(x.failReason);
    const k = f.code || f.title;
    const g = groups.get(k) || { code: f.code, title: f.title, fix: f.fix, count: 0 };
    g.count++; groups.set(k, g);
  }
  const failures = [...groups.values()].sort((a, b) => b.count - a.count);

  const children = await Campaign.find({ tenant: req.tenantId, parentCampaign: c._id }).sort({ createdAt: -1 }).lean();
  const childStats = await campaignStats(children.map((x) => x._id));
  const parent = c.parentCampaign ? await Campaign.findOne({ _id: c.parentCampaign, tenant: req.tenantId }).select("name status createdAt").lean() : null;

  ok(res, {
    campaign: c,
    summary,
    failures,
    rows: pageRows,
    total: list.length,
    page,
    perPage,
    parent,
    resends: children.map((x: any) => {
      const s = childStats.get(String(x._id)) || rollup({});
      return { _id: x._id, name: x.name, status: x.status, template: x.template, resendStatuses: x.resendStatuses, audienceSize: x.audienceSize, createdAt: x.createdAt, launchedAt: x.launchedAt, createdBy: x.createdBy, sent: s.sent, delivered: s.delivered, read: s.read, failed: s.failed };
    }),
  });
}));

/** New campaign to the recipients of this one who are in the picked statuses. */
r.post("/campaigns/:id/resend", require_("blast", "create"), asyncHandler(async (req: any, res: any) => {
  const parent: any = await Campaign.findOne({ _id: req.params.id, tenant: req.tenantId }).lean();
  if (!parent) throw new ApiError(404, "Campaign not found");
  const statuses = [...new Set((Array.isArray(req.body.statuses) ? req.body.statuses : []).filter((s: any) => (REPORT_STATUSES as readonly string[]).includes(s)))] as string[];
  if (!statuses.length) throw new ApiError(400, "Pick who to resend to");
  const template = str(req.body.template, 200) || parent.template;
  await checkTemplate(req, template);
  const name = str(req.body.name, 120);
  if (!name) throw new ApiError(400, "Name is required");
  await ensureFreeName(req, name);
  const c = await Campaign.create({
    tenant: req.tenantId,
    name,
    template,
    category: parent.category,
    audienceType: "resend",
    parentCampaign: parent._id,
    resendStatuses: statuses,
    audienceLabel: `Resend · ${parent.name}`,
    variables: req.body.variables !== undefined ? cleanVariables(req.body.variables) : parent.variables || [],
    scheduledFor: cleanSchedule(req.body.scheduledFor),
    createdBy: req.auth?.name || "",
  });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Blast", entity: name, next: `resend of ${parent.name}: ${statuses.join(", ")}` });
  let launch: any = null;
  if (req.body.launch) {
    try { launch = await launchAndRespond(req, c._id); }
    catch (e) { await c.deleteOne(); throw e; }
  }
  ok(res, { campaign: await Campaign.findById(c._id).lean(), launch }, 201);
}));

/* ───────────── recipient lists (import) ───────────── */

/** Source master options, readable by anyone who can see lists. */
r.get("/campaign-lists/sources", require_("blast", "view"), asyncHandler(async (req: any, res: any) => {
  ok(res, await LeadSource.find({ tenant: req.tenantId }).select("name color").sort({ name: 1 }).lean());
}));

/** Employees = active users of our own team (not client users). */
async function employeeFilter(tenant: any) {
  const clientCats = (await UserCategory.find({ tenant, kind: "client" }).select("_id").lean()).map((c: any) => c._id);
  return { tenant, status: "Active", pmClient: { $in: [null, undefined] }, category: { $nin: clientCats } };
}
r.get("/campaign-lists/owners", require_("blast", "view"), asyncHandler(async (req: any, res: any) => {
  ok(res, await User.find(await employeeFilter(req.tenantId)).select("name").sort({ name: 1 }).lean());
}));
async function cleanOwner(req: any, v: unknown) {
  if (v === null || v === "" || v === undefined) return null;
  const id = oid(v);
  if (!id || !(await User.exists({ ...(await employeeFilter(req.tenantId)), _id: id }))) throw new ApiError(400, "Owner must be an active employee");
  return id;
}
const LIST_POP = [{ path: "source", select: "name color" }, { path: "owner", select: "name" }];

async function cleanSource(req: any, v: unknown) {
  if (v === null || v === "" || v === undefined) return null;
  const id = oid(v);
  if (!id || !(await LeadSource.exists({ _id: id, tenant: req.tenantId }))) throw new ApiError(400, "Invalid source");
  return id;
}

r.get("/campaign-lists", require_("blast", "view"), asyncHandler(async (req: any, res: any) => {
  const filter: any = { tenant: req.tenantId };
  const q = str(req.query.q);
  if (q) filter.name = new RegExp(escapeRx(q), "i");
  const src = oid(req.query.source);
  if (src) filter.source = src;
  const own = oid(req.query.owner);
  if (own) filter.owner = own;
  const lists = await RecipientList.find(filter).select("-rows").populate(LIST_POP).sort({ updatedAt: -1 }).lean();
  const used = new Map<string, number>();
  for (const u of await Campaign.aggregate([
    { $match: { tenant: new Types.ObjectId(String(req.tenantId)), audienceType: "list" } },
    { $project: { refs: { $setUnion: [{ $ifNull: ["$audienceRefs", []] }, { $cond: [{ $ifNull: ["$audienceRef", false] }, ["$audienceRef"], []] }] } } },
    { $unwind: "$refs" },
    { $group: { _id: "$refs", n: { $sum: 1 } } },
  ])) used.set(String(u._id), u.n);
  ok(res, lists.map((l) => ({ ...l, campaigns: used.get(String(l._id)) || 0 })));
}));

r.get("/campaign-lists/:id", require_("blast", "view"), asyncHandler(async (req: any, res: any) => {
  const list: any = await RecipientList.findOne({ _id: req.params.id, tenant: req.tenantId }).populate(LIST_POP).lean();
  if (!list) throw new ApiError(404, "List not found");
  let rows = list.rows || [];
  const q = str(req.query.q).toLowerCase();
  if (q) rows = rows.filter((x: any) => String(x.name || "").toLowerCase().includes(q) || String(x.phone).includes(q) || Object.values(x.extra || {}).some((v) => String(v).toLowerCase().includes(q)));
  const page = pageOf(req.query);
  const perPage = req.query.all === "1" ? MAX_RECIPIENTS : perPageOf(req.query);
  const { rows: _r, ...meta } = list;
  ok(res, { ...meta, rows: rows.slice((page - 1) * perPage, page * perPage), total: rows.length, page, perPage });
}));

/** Rows come already parsed from the file (CSV / Excel) by the browser. */
function cleanRows(input: unknown, columns: string[]) {
  const raw = Array.isArray(input) ? input : [];
  if (raw.length > MAX_RECIPIENTS) throw new ApiError(400, `A list can have up to ${MAX_RECIPIENTS} numbers`);
  const seen = new Set<string>();
  const rows: any[] = [];
  let invalid = 0, duplicates = 0;
  for (const x of raw as any[]) {
    const phone = normalizePhone(x?.phone);
    if (!phone) { invalid++; continue; }
    const k = key10(phone);
    if (seen.has(k)) { duplicates++; continue; }
    seen.add(k);
    const extra: Record<string, string> = {};
    for (const col of columns) { const v = str(x?.extra?.[col], 300); if (v) extra[col] = v; }
    rows.push({ name: str(x?.name, 120), phone, ...(Object.keys(extra).length ? { extra } : {}) });
  }
  return { rows, invalid, duplicates };
}

r.post("/campaign-lists/import", require_("blast", "create"), asyncHandler(async (req: any, res: any) => {
  const name = str(req.body.name, 120);
  if (!name) throw new ApiError(400, "Name is required");
  const columns = [...new Set((Array.isArray(req.body.columns) ? req.body.columns : []).map((c: any) => str(c, 60)).filter(Boolean))].slice(0, 30) as string[];
  const { rows, invalid, duplicates } = cleanRows(req.body.rows, columns);
  const summary = { valid: rows.length, invalid, duplicates };
  const source = await cleanSource(req, req.body.source);
  const owner = await cleanOwner(req, req.body.owner);
  if (req.body.dryRun) return ok(res, { summary });
  if (!rows.length) throw new ApiError(400, "No valid phone numbers in the file");
  const existing = await RecipientList.findOne({ tenant: req.tenantId, name }).select("_id").lean();
  if (existing && !req.body.listId) throw new ApiError(409, "A list with this name already exists");
  const list = await RecipientList.create({ tenant: req.tenantId, name, fileName: str(req.body.fileName, 200), columns, source, owner, rows, count: rows.length, createdBy: req.auth?.name || "" });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "IMPORT", module: "Blast", entity: name, next: `${rows.length} numbers` });
  const { rows: _r, ...meta } = list.toObject();
  ok(res, { list: meta, summary }, 201);
}));

/** Create an empty list; recipients are added later (upload or manual entry). */
r.post("/campaign-lists", require_("blast", "create"), asyncHandler(async (req: any, res: any) => {
  const name = str(req.body.name, 120);
  if (!name) throw new ApiError(400, "Name is required");
  if (await RecipientList.exists({ tenant: req.tenantId, name })) throw new ApiError(409, "A list with this name already exists");
  const list = await RecipientList.create({ tenant: req.tenantId, name, source: await cleanSource(req, req.body.source), owner: await cleanOwner(req, req.body.owner), columns: [], rows: [], count: 0, createdBy: req.auth?.name || "" });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Blast", entity: name });
  ok(res, await RecipientList.findById(list._id).select("-rows").populate(LIST_POP).lean(), 201);
}));

/** Add more numbers from another file to an existing list (duplicates skipped). */
r.post("/campaign-lists/:id/append", require_("blast", "create"), asyncHandler(async (req: any, res: any) => {
  const list = await RecipientList.findOne({ _id: req.params.id, tenant: req.tenantId });
  if (!list) throw new ApiError(404, "List not found");
  const columns = [...new Set([...(list.columns || []), ...(Array.isArray(req.body.columns) ? req.body.columns : []).map((c: any) => str(c, 60)).filter(Boolean)])].slice(0, 30) as string[];
  const { rows, invalid, duplicates } = cleanRows(req.body.rows, columns);
  const have = new Set(list.rows.map((x) => key10(x.phone)));
  const fresh = rows.filter((x) => !have.has(key10(x.phone)));
  const summary = { valid: fresh.length, invalid, duplicates: duplicates + (rows.length - fresh.length) };
  if (req.body.dryRun) return ok(res, { summary });
  if (list.rows.length + fresh.length > MAX_RECIPIENTS) throw new ApiError(400, `A list can have up to ${MAX_RECIPIENTS} numbers`);
  list.rows.push(...(fresh as any));
  list.columns = columns;
  list.count = list.rows.length;
  await list.save();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "IMPORT", module: "Blast", entity: list.name, next: `+${fresh.length} numbers` });
  ok(res, { summary, count: list.count });
}));

r.patch("/campaign-lists/:id", require_("blast", "edit"), asyncHandler(async (req: any, res: any) => {
  const set: any = {};
  if ("name" in req.body) {
    const name = str(req.body.name, 120);
    if (!name) throw new ApiError(400, "Name is required");
    const clash = await RecipientList.findOne({ tenant: req.tenantId, name, _id: { $ne: req.params.id } }).select("_id").lean();
    if (clash) throw new ApiError(409, "A list with this name already exists");
    set.name = name;
  }
  if ("source" in req.body) set.source = await cleanSource(req, req.body.source);
  if ("owner" in req.body) set.owner = await cleanOwner(req, req.body.owner);
  const list = await RecipientList.findOneAndUpdate({ _id: req.params.id, tenant: req.tenantId }, { $set: set }, { new: true }).select("-rows").populate(LIST_POP);
  if (!list) throw new ApiError(404, "List not found");
  if (set.name) {
    // relabel every campaign that uses this list (alone or with others)
    const camps = await Campaign.find({ tenant: req.tenantId, audienceType: "list", ...usesList(list._id) }).select("audienceRef audienceRefs").lean();
    for (const c of camps as any[]) {
      const refs = c.audienceRefs?.length ? c.audienceRefs : [c.audienceRef];
      const lists = await RecipientList.find({ _id: { $in: refs } }).select("name").lean();
      const names = refs.map((r: any) => lists.find((l: any) => String(l._id) === String(r))?.name).filter(Boolean) as string[];
      await Campaign.updateOne({ _id: c._id }, { $set: { audienceLabel: listLabel("list", names) } });
    }
  }
  ok(res, list);
}));

/** Remove one number from a list. */
r.delete("/campaign-lists/:id/rows/:phone", require_("blast", "edit"), asyncHandler(async (req: any, res: any) => {
  const list = await RecipientList.findOne({ _id: req.params.id, tenant: req.tenantId });
  if (!list) throw new ApiError(404, "List not found");
  const k = key10(req.params.phone);
  list.rows = list.rows.filter((x) => key10(x.phone) !== k) as any;
  list.count = list.rows.length;
  await list.save();
  ok(res, { count: list.count });
}));

r.delete("/campaign-lists/:id", require_("blast", "del"), asyncHandler(async (req: any, res: any) => {
  const list = await RecipientList.findOne({ _id: req.params.id, tenant: req.tenantId }).select("name");
  if (!list) throw new ApiError(404, "List not found");
  const pending = await Campaign.countDocuments({ tenant: req.tenantId, audienceType: "list", ...usesList(list._id), status: { $in: ["Draft", "Scheduled"] } });
  if (pending) throw new ApiError(409, "A draft or scheduled campaign uses this list");
  await list.deleteOne();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Blast", entity: list.name });
  ok(res, { deleted: true });
}));

export default r;
