import { Router } from "express";
import { Types } from "mongoose";
import { require_ } from "../middleware/auth";
import { ok, paginated, asyncHandler, ApiError, audit } from "../utils/http";
import { Lead } from "../models/Lead";
import { LeadActivity } from "../models/LeadActivity";
import { User } from "../models/User";
import { crmSettingsFor } from "../models/CrmExtras";
import { CrmActivityType, CrmQuery, CrmList, ACTIVITY_FIELD_TYPES, QUERY_STATUSES, QUERY_PRIORITIES } from "../models/CrmPro";
import { logActivity, refreshLead, assignableOwners, maskContacts, cleanPhone, escapeRegex, scoringWeights, DEFAULT_SCORING, noteLeadMessaged } from "../services/leadService";
import { guardLead, canSeeLead, leadOwnerScope, scopeLeadFilter } from "../services/leadAccess";
import { buildLeadFilter } from "../controllers/leadController";
import { sendText } from "../services/whatsapp";
import { sendEmail } from "../services/email";
import { notify } from "../services/pm/messages";
import { localDateTime, isDateKey } from "../utils/dates";

/** Lead CRM, part three: custom activity types, the query desk, lead lists and lead scoring. */
const r = Router();
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oid = (v: unknown) => (Types.ObjectId.isValid(String(v)) ? new Types.ObjectId(String(v)) : null);
const pageOf = (q: any) => Math.max(1, parseInt(String(q.page || "1"), 10) || 1);
const perPageOf = (q: any) => Math.min(200, Math.max(1, parseInt(String(q.perPage || "50"), 10) || 50));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

/* ───────────── custom activity types ───────────── */

function cleanFields(input: unknown) {
  const fields = (Array.isArray(input) ? input : []).slice(0, 15).map((f: any) => {
    const label = str(f?.label, 60);
    const type = (ACTIVITY_FIELD_TYPES as readonly string[]).includes(f?.type) ? f.type : "text";
    const options = type === "select" ? [...new Set((Array.isArray(f?.options) ? f.options : String(f?.options || "").split(",")).map((o: any) => str(o, 60)).filter(Boolean))] : [];
    if (type === "select" && !options.length) throw new ApiError(400, `Add options for ${label || "the dropdown field"}`);
    return { key: slug(str(f?.key, 40) || label), label, type, options, required: !!f?.required };
  }).filter((f) => f.label && f.key);
  const keys = fields.map((f) => f.key);
  if (new Set(keys).size !== keys.length) throw new ApiError(400, "Two fields have the same name");
  return fields;
}

r.get("/crm/activity-types", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const types = await CrmActivityType.find({ tenant: req.tenantId }).sort({ order: 1, name: 1 }).lean();
  const counts = await LeadActivity.aggregate([
    { $match: { tenant: new Types.ObjectId(String(req.tenantId)), type: "activity" } },
    { $group: { _id: "$meta.activityType", n: { $sum: 1 } } },
  ]);
  const byType = new Map(counts.map((c: any) => [String(c._id), c.n]));
  ok(res, types.map((t: any) => ({ ...t, logged: byType.get(String(t._id)) || 0 })));
}));

r.post("/crm/activity-types", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const name = str(b.name, 60);
  if (!name) throw new ApiError(400, "Name is required");
  const last: any = await CrmActivityType.findOne({ tenant: req.tenantId }).sort({ order: -1 }).select("order").lean();
  const t = await CrmActivityType.create({
    tenant: req.tenantId, name, icon: str(b.icon, 40) || "lightning", color: str(b.color, 20) || "#6366f1",
    points: Math.max(-50, Math.min(50, Number(b.points) || 0)), fields: cleanFields(b.fields), active: b.active !== false, order: (last?.order || 0) + 1,
  });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Activity types", entity: name });
  ok(res, t, 201);
}));

r.patch("/crm/activity-types/:id", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const t = await CrmActivityType.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!t) throw new ApiError(404, "Activity type not found");
  const b = req.body || {};
  if (b.name !== undefined) { const n = str(b.name, 60); if (!n) throw new ApiError(400, "Name is required"); t.name = n; }
  if (b.icon !== undefined) t.icon = str(b.icon, 40) || "lightning";
  if (b.color !== undefined) t.color = str(b.color, 20) || "#6366f1";
  if (b.points !== undefined) t.points = Math.max(-50, Math.min(50, Number(b.points) || 0));
  if (b.fields !== undefined) t.fields = cleanFields(b.fields) as any;
  if (b.active !== undefined) t.active = !!b.active;
  if (b.order !== undefined) t.order = Number(b.order) || 0;
  await t.save();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Activity types", entity: t.name });
  ok(res, t);
}));

r.delete("/crm/activity-types/:id", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const t = await CrmActivityType.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!t) throw new ApiError(404, "Activity type not found");
  // logged activities keep their name and values; a type in use is switched off instead of lost
  if (await LeadActivity.exists({ tenant: req.tenantId, type: "activity", "meta.activityType": t._id })) {
    t.active = false; await t.save();
    return ok(res, { deleted: false, deactivated: true });
  }
  await t.deleteOne();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Activity types", entity: t.name });
  ok(res, { deleted: true });
}));

/** Check typed values against the type's fields; returns label → value pairs for the timeline. */
function readValues(type: any, input: any) {
  const values: Record<string, any> = {};
  for (const f of type.fields || []) {
    let v = input?.[f.key];
    if (f.type === "yesno") v = v === true || v === "yes" || v === "true";
    else if (f.type === "number") v = v === "" || v === undefined || v === null ? "" : Number(v);
    else v = str(v, 1000);
    if (f.type === "number" && v !== "" && !Number.isFinite(v)) throw new ApiError(400, `${f.label} must be a number`);
    if (f.type === "date" && v && !isDateKey(v)) throw new ApiError(400, `${f.label} must be a date`);
    if (f.type === "select" && v && !f.options.includes(v)) throw new ApiError(400, `Pick a ${f.label} from the list`);
    if (f.required && (v === "" || v === undefined)) throw new ApiError(400, `${f.label} is required`);
    if (v !== "" && v !== undefined) values[f.key] = v;
  }
  return values;
}

r.post("/leads/:id/activities", require_("leads", "edit"), guardLead, asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const type: any = await CrmActivityType.findOne({ _id: oid(b.typeId), tenant: req.tenantId, active: true }).lean();
  if (!type) throw new ApiError(400, "Choose an activity");
  const lead = await Lead.findOne({ _id: req.params.id, tenant: req.tenantId });
  if (!lead) throw new ApiError(404, "Lead not found");
  const values = readValues(type, b.values || {});
  const at = isDateKey(b.date) ? localDateTime(b.date, str(b.time, 5) || "10:00") : new Date();
  if (at.getTime() > Date.now() + 60_000) throw new ApiError(400, "An activity cannot be in the future. Schedule a follow-up instead.");
  const shown = (type.fields || []).filter((f: any) => values[f.key] !== undefined).map((f: any) => `${f.label}: ${f.type === "yesno" ? (values[f.key] ? "Yes" : "No") : values[f.key]}`);
  const note = str(b.note, 1000);
  await LeadActivity.create({
    tenant: req.tenantId, lead: lead._id, type: "activity", by: req.auth?.name || "System", at,
    title: type.name, detail: [...shown, note].filter(Boolean).join(" · "),
    meta: { activityType: type._id, color: type.color, icon: type.icon, points: type.points || 0, values, note },
  });
  if (at > (lead.lastActivity || new Date(0))) lead.lastActivity = at;
  if (!lead.firstContactedAt) lead.firstContactedAt = at;
  lead.lastContactedAt = at;
  await lead.save();
  await refreshLead(lead);
  ok(res, { score: lead.score, priority: lead.priority }, 201);
}));

/** Every logged custom activity, newest first — the team's activity register. */
r.get("/crm/activities", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const q = req.query;
  const page = pageOf(q), perPage = perPageOf(q);
  const match: any = { tenant: req.tenantId, type: "activity" };
  const t = oid(q.type);
  if (t) match["meta.activityType"] = t;
  if (str(q.by)) match.by = str(q.by, 120);
  const at: any = {};
  if (isDateKey(q.from)) at.$gte = localDateTime(q.from);
  if (isDateKey(q.to)) at.$lte = new Date(localDateTime(q.to).getTime() + 86_400_000 - 1);
  if (Object.keys(at).length) match.at = at;
  // only activities on leads the user may see
  const names = await leadOwnerScope(req);
  if (names || req.leadBranches?.length) {
    const visible = await Lead.find(await scopeLeadFilter(req, { tenant: req.tenantId })).select("_id").limit(20000).lean();
    match.lead = { $in: visible.map((l: any) => l._id) };
  }
  const [items, total, byType] = await Promise.all([
    LeadActivity.find(match).sort({ at: -1 }).skip((page - 1) * perPage).limit(perPage).populate("lead", "name phone owner").lean(),
    LeadActivity.countDocuments(match),
    LeadActivity.aggregate([{ $match: { ...match, tenant: new Types.ObjectId(String(req.tenantId)) } }, { $group: { _id: "$title", n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
  ]);
  res.json({ ok: true, data: maskContacts(req, items), total, page, perPage, byType: byType.map((x: any) => ({ name: x._id, count: x.n })) });
}));

/* ───────────── query desk ───────────── */

/** Who may see which queries: anyone with full lead visibility sees all; others see the ones they handle or raised. */
async function queryScope(req: any, filter: any) {
  const names = await leadOwnerScope(req);
  if (names) filter.$and = [...(filter.$and || []), { $or: [{ assignedTo: { $in: names } }, { createdBy: { $in: names } }] }];
  return filter;
}

async function loadQuery(req: any) {
  const id = oid(req.params.id);
  if (!id) throw new ApiError(404, "Query not found");
  const q = await CrmQuery.findOne(await queryScope(req, { _id: id, tenant: req.tenantId }));
  if (!q) throw new ApiError(404, "Query not found");
  return q;
}

const isOpen = (s: string) => s === "open" || s === "pending";
function presentQuery(q: any) {
  const o = typeof q.toObject === "function" ? q.toObject() : { ...q };
  o.overdue = isOpen(o.status) && !!o.dueAt && new Date(o.dueAt).getTime() < Date.now();
  return o;
}

async function nextQueryNumber(tenant: any) {
  const last: any = await CrmQuery.findOne({ tenant }).sort({ number: -1 }).select("number").lean();
  return (last?.number || 1000) + 1;
}

async function slaHoursFor(tenant: any, category: string) {
  const s = await crmSettingsFor(tenant);
  const c = (s.queries?.categories || []).find((x: any) => x.name === category);
  return Number(c?.slaHours) || Number(s.queries?.defaultSlaHours) || 24;
}

async function tellAssignee(req: any, name: string, title: string, q: any) {
  if (!name || name === "Unassigned" || name === req.auth?.name) return;
  const u: any = await User.findOne({ tenant: req.tenantId, name }).select("_id").lean();
  if (u) await notify({ tenantId: req.tenantId, users: [u._id], category: "crm_lead", title, body: `#${q.number} · ${q.subject}`, link: `/crm/queries?q=${q._id}` });
}

r.get("/crm/queries/meta", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const s = await crmSettingsFor(req.tenantId);
  ok(res, { categories: s.queries?.categories || [], statuses: QUERY_STATUSES, priorities: QUERY_PRIORITIES, owners: await assignableOwners(req.tenantId) });
}));

r.get("/crm/queries", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const q = req.query;
  const page = pageOf(q), perPage = perPageOf(q);
  const base: any = { tenant: req.tenantId };
  const status = str(q.status);
  if (status === "active") base.status = { $in: ["open", "pending"] };
  else if ((QUERY_STATUSES as readonly string[]).includes(status)) base.status = status;
  if (str(q.category)) base.category = str(q.category, 60);
  if ((QUERY_PRIORITIES as readonly string[]).includes(str(q.priority))) base.priority = str(q.priority);
  if (str(q.assignedTo) === "me") base.assignedTo = req.auth?.name;
  else if (str(q.assignedTo)) base.assignedTo = str(q.assignedTo, 120);
  const lead = oid(q.lead);
  if (lead) base.lead = lead;
  if (str(q.overdue) === "1") { base.status = { $in: ["open", "pending"] }; base.dueAt = { $lt: new Date() }; }
  const search = str(q.q, 100);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    const n = Number(search.replace(/^#/, ""));
    base.$or = [{ subject: rx }, { name: rx }, { phone: rx }, { email: rx }, ...(Number.isInteger(n) && n > 0 ? [{ number: n }] : [])];
  }
  const filter = await queryScope(req, base);
  const statsBase = await queryScope(req, { tenant: req.tenantId });
  const [items, total, counts, overdue] = await Promise.all([
    CrmQuery.find(filter).select("-messages").sort({ status: 1, dueAt: 1, createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
    CrmQuery.countDocuments(filter),
    CrmQuery.aggregate([{ $match: { ...statsBase, tenant: new Types.ObjectId(String(req.tenantId)) } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    CrmQuery.countDocuments({ ...statsBase, status: { $in: ["open", "pending"] }, dueAt: { $lt: new Date() } }),
  ]);
  const stats: any = { open: 0, pending: 0, resolved: 0, closed: 0, overdue };
  for (const c of counts) stats[c._id] = c.n;
  res.json({ ok: true, data: maskContacts(req, items.map(presentQuery)), total, page, perPage, stats });
}));

r.post("/crm/queries", require_("leads", "create"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const subject = str(b.subject, 200);
  if (!subject) throw new ApiError(400, "Subject is required");
  const s = await crmSettingsFor(req.tenantId);
  let lead: any = null;
  if (b.lead) {
    if (!(await canSeeLead(req, b.lead))) throw new ApiError(404, "Lead not found");
    lead = await Lead.findOne({ _id: b.lead, tenant: req.tenantId }).select("name phone email owner").lean();
  }
  const name = str(b.name, 120) || lead?.name || "";
  const phone = cleanPhone(b.phone) || lead?.phone || "";
  if (!name && !phone) throw new ApiError(400, "Choose a lead or enter a name");
  const category = str(b.category, 60);
  const owners = await assignableOwners(req.tenantId);
  let assignedTo = str(b.assignedTo, 120);
  if (!assignedTo && s.queries?.assignToLeadOwner && lead?.owner && owners.includes(lead.owner)) assignedTo = lead.owner;
  if (assignedTo && assignedTo !== "Unassigned" && !owners.includes(assignedTo)) throw new ApiError(400, `${assignedTo} is not an active user`);
  const text = str(b.description, 4000);
  const created = new Date();
  let q: any = null;
  // the number is per tenant; two people saving at once just take the next one
  for (let i = 0; i < 5 && !q; i++) {
    try {
      q = await CrmQuery.create({
        tenant: req.tenantId, number: await nextQueryNumber(req.tenantId), lead: lead?._id || null, name, phone,
        email: str(b.email, 200).toLowerCase() || lead?.email || "", subject, category,
        priority: (QUERY_PRIORITIES as readonly string[]).includes(b.priority) ? b.priority : "medium",
        assignedTo: assignedTo || "Unassigned", raisedVia: str(b.raisedVia, 30) || "manual", createdBy: req.auth?.name || "",
        dueAt: new Date(created.getTime() + (await slaHoursFor(req.tenantId, category)) * 3_600_000),
        messages: text ? [{ by: name || "Customer", text, internal: false, channel: str(b.raisedVia, 30) || "manual", at: created, fromCustomer: true }] : [],
      });
    } catch (e: any) { if (e?.code !== 11000) throw e; }
  }
  if (!q) throw new ApiError(409, "Could not number the query. Try again.");
  if (lead) await logActivity({ tenant: req.tenantId, lead: lead._id, type: "query", by: req.auth?.name, title: `Query #${q.number} raised`, detail: [category, subject].filter(Boolean).join(" · ") });
  await tellAssignee(req, q.assignedTo, `New query for you: ${name || phone}`, q);
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Queries", entity: `#${q.number}` });
  ok(res, presentQuery(q), 201);
}));

r.get("/crm/queries/:id", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const q = await loadQuery(req);
  ok(res, maskContacts(req, presentQuery(q)));
}));

r.patch("/crm/queries/:id", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const q = await loadQuery(req);
  const b = req.body || {};
  const changes: string[] = [];
  if (b.subject !== undefined) { const v = str(b.subject, 200); if (!v) throw new ApiError(400, "Subject is required"); q.subject = v; }
  if (b.category !== undefined && str(b.category, 60) !== q.category) {
    q.category = str(b.category, 60);
    if (isOpen(q.status)) q.dueAt = new Date(new Date(q.createdAt).getTime() + (await slaHoursFor(req.tenantId, q.category)) * 3_600_000);
    changes.push(`Category: ${q.category || "—"}`);
  }
  if (b.priority !== undefined && (QUERY_PRIORITIES as readonly string[]).includes(b.priority) && b.priority !== q.priority) { q.priority = b.priority; changes.push(`Priority: ${b.priority}`); }
  if (b.assignedTo !== undefined && str(b.assignedTo, 120) !== q.assignedTo) {
    const to = str(b.assignedTo, 120) || "Unassigned";
    if (to !== "Unassigned" && !(await assignableOwners(req.tenantId)).includes(to)) throw new ApiError(400, `${to} is not an active user`);
    q.assignedTo = to; changes.push(`Assigned to ${to}`);
    await tellAssignee(req, to, `Query assigned to you: ${q.name || q.phone}`, q);
  }
  if (b.status !== undefined && (QUERY_STATUSES as readonly string[]).includes(b.status) && b.status !== q.status) {
    q.status = b.status;
    q.resolvedAt = isOpen(b.status) ? null : q.resolvedAt || new Date();
    changes.push(`Status: ${b.status}`);
    if (q.lead && !isOpen(b.status)) await logActivity({ tenant: req.tenantId, lead: q.lead, type: "query", by: req.auth?.name, title: `Query #${q.number} ${b.status}`, detail: q.subject });
  }
  if (changes.length) q.messages.push({ by: req.auth?.name || "System", text: changes.join(" · "), internal: true, channel: "system", at: new Date(), fromCustomer: false });
  await q.save();
  ok(res, presentQuery(q));
}));

r.post("/crm/queries/:id/messages", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const q = await loadQuery(req);
  const b = req.body || {};
  const text = str(b.text, 4000);
  if (!text) throw new ApiError(400, "Write a reply");
  const internal = !!b.internal;
  const fromCustomer = !internal && !!b.fromCustomer;
  const channel = internal || fromCustomer ? "" : ["whatsapp", "email"].includes(b.channel) ? b.channel : "";
  if (channel === "email" && !q.email) throw new ApiError(400, "This query has no email address");
  if (channel === "whatsapp" && !q.phone) throw new ApiError(400, "This query has no phone number");
  if (channel === "whatsapp") await sendText(req.tenantId, q.phone, text);
  if (channel === "email") await sendEmail({ to: q.email, subject: `Re: ${q.subject} [#${q.number}]`, html: text.replace(/\n/g, "<br>"), text });
  if (channel) await noteLeadMessaged(req.tenantId, channel === "email" ? q.email : q.phone, channel, req.auth?.name, `Query #${q.number}: ${text}`);
  q.messages.push({ by: fromCustomer ? q.name || "Customer" : req.auth?.name || "System", text, internal, channel: channel || (fromCustomer ? "manual" : ""), at: new Date(), fromCustomer });
  if (!internal && !fromCustomer && !q.firstResponseAt) q.firstResponseAt = new Date();
  // a reply waits on the customer; their answer puts it back with us
  if (!internal && !fromCustomer && b.markPending !== false && q.status === "open") q.status = "pending";
  if (fromCustomer && q.status !== "open") { q.status = "open"; q.resolvedAt = null; }
  await q.save();
  ok(res, presentQuery(q), 201);
}));

r.delete("/crm/queries/:id", require_("leads", "del"), asyncHandler(async (req: any, res: any) => {
  const q = await loadQuery(req);
  await q.deleteOne();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Queries", entity: `#${q.number}` });
  ok(res, { deleted: true });
}));

r.get("/leads/:id/queries", require_("leads", "view"), guardLead, asyncHandler(async (req: any, res: any) => {
  const items = await CrmQuery.find({ tenant: req.tenantId, lead: req.params.id }).select("-messages").sort({ createdAt: -1 }).limit(100).lean();
  ok(res, items.map(presentQuery));
}));

/* ───────────── lead lists ───────────── */

const LIST_FILTER_KEYS = ["q", "status", "subStatus", "source", "service", "owner", "priority", "tag", "city", "branch", "course", "partner", "createdFrom", "createdTo", "minScore", "maxScore", "followUp", "view"];
function cleanListFilters(input: any) {
  const out: Record<string, string> = {};
  for (const k of LIST_FILTER_KEYS) { const v = str(input?.[k], 200); if (v) out[k] = v; }
  for (const [k, v] of Object.entries(input || {})) if (/^cf_[a-z0-9_]+$/i.test(k) && str(v, 200)) out[k] = str(v, 200);
  return out;
}

/** The Mongo filter for a list's members, within what the user may see. */
export async function listMemberFilter(req: any, list: any) {
  if (list.kind === "dynamic") return buildLeadFilter(req, list.filters || {});
  return scopeLeadFilter(req, { tenant: req.tenantId, _id: { $in: list.leads || [] } });
}

r.get("/crm/lists", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const lists = await CrmList.find({ tenant: req.tenantId }).select("-leads").sort({ updatedAt: -1 }).lean();
  const full = await CrmList.find({ tenant: req.tenantId, kind: "static" }).select("leads").lean();
  const ids = new Map(full.map((l: any) => [String(l._id), l.leads]));
  const out: any[] = [];
  for (const l of lists) out.push({ ...l, count: await Lead.countDocuments(await listMemberFilter(req, { ...l, leads: ids.get(String(l._id)) || [] })) });
  ok(res, out);
}));

r.post("/crm/lists", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const name = str(b.name, 80);
  if (!name) throw new ApiError(400, "Name is required");
  const kind = b.kind === "dynamic" ? "dynamic" : "static";
  const filters = kind === "dynamic" ? cleanListFilters(b.filters) : {};
  if (kind === "dynamic" && !Object.keys(filters).length) throw new ApiError(400, "Pick at least one filter");
  let leads: any[] = [];
  if (kind === "static" && (Array.isArray(b.leadIds) || b.allMatching)) leads = await pickLeads(req, b);
  const list = await CrmList.create({ tenant: req.tenantId, name, kind, filters, leads, createdBy: req.auth?.name || "" });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Lead lists", entity: name });
  ok(res, { ...list.toObject(), leads: undefined, count: leads.length }, 201);
}));

/** Leads chosen on the leads screen: ticked ids, or "all matching" the current filters. */
async function pickLeads(req: any, b: any) {
  const filter = b.allMatching
    ? await buildLeadFilter(req, b.filters || {})
    : await scopeLeadFilter(req, { tenant: req.tenantId, _id: { $in: (Array.isArray(b.leadIds) ? b.leadIds : []).map(oid).filter(Boolean) } });
  const found = await Lead.find(filter).select("_id").limit(20001).lean();
  if (found.length > 20000) throw new ApiError(400, "A list can hold up to 20,000 leads");
  return found.map((l: any) => l._id);
}

async function loadList(req: any) {
  const l = await CrmList.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!l) throw new ApiError(404, "List not found");
  return l;
}

r.get("/crm/lists/:id", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const l = await loadList(req);
  const page = pageOf(req.query), perPage = perPageOf(req.query);
  const filter = await listMemberFilter(req, l);
  const [items, total] = await Promise.all([
    Lead.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).select("name phone email owner status source score priority course city createdAt").populate("status source").lean(),
    Lead.countDocuments(filter),
  ]);
  res.json({ ok: true, list: { ...l.toObject(), leads: undefined }, data: maskContacts(req, items), total, page, perPage });
}));

r.patch("/crm/lists/:id", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const l = await loadList(req);
  const b = req.body || {};
  if (b.name !== undefined) { const n = str(b.name, 80); if (!n) throw new ApiError(400, "Name is required"); l.name = n; }
  if (l.kind === "dynamic" && b.filters !== undefined) {
    const f = cleanListFilters(b.filters);
    if (!Object.keys(f).length) throw new ApiError(400, "Pick at least one filter");
    l.filters = f; l.markModified("filters");
  }
  await l.save();
  ok(res, { ...l.toObject(), leads: undefined });
}));

r.post("/crm/lists/:id/members", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const l = await loadList(req);
  if (l.kind !== "static") throw new ApiError(400, "Leads join a smart list through its filters");
  const b = req.body || {};
  const ids = await pickLeads(req, b);
  const before = l.leads.length;
  if (b.remove) {
    const drop = new Set(ids.map(String));
    l.leads = l.leads.filter((x: any) => !drop.has(String(x))) as any;
  } else {
    const have = new Set(l.leads.map(String));
    const add = ids.filter((x: any) => !have.has(String(x)));
    if (before + add.length > 20000) throw new ApiError(400, "A list can hold up to 20,000 leads");
    l.leads.push(...add);
    for (const id of add.slice(0, 500)) await logActivity({ tenant: req.tenantId, lead: id, type: "list", by: req.auth?.name, title: `Added to list ${l.name}` });
  }
  await l.save();
  ok(res, { count: l.leads.length, changed: Math.abs(l.leads.length - before) });
}));

r.delete("/crm/lists/:id", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const l = await loadList(req);
  await l.deleteOne();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Lead lists", entity: l.name });
  ok(res, { deleted: true });
}));

r.get("/leads/:id/lists", require_("leads", "view"), guardLead, asyncHandler(async (req: any, res: any) => {
  const lists = await CrmList.find({ tenant: req.tenantId, kind: "static", leads: oid(req.params.id) }).select("name").lean();
  ok(res, lists);
}));

/* ───────────── lead scoring ───────────── */

r.get("/crm/scoring", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const s = await crmSettingsFor(req.tenantId);
  const [types, bands] = await Promise.all([
    CrmActivityType.find({ tenant: req.tenantId, active: true }).select("name points color icon").sort({ order: 1 }).lean(),
    Lead.aggregate([{ $match: { tenant: new Types.ObjectId(String(req.tenantId)) } }, { $group: { _id: "$priority", n: { $sum: 1 }, avg: { $avg: "$score" } } }]),
  ]);
  ok(res, { weights: scoringWeights(s), defaults: DEFAULT_SCORING, activityTypes: types, bands: bands.map((b: any) => ({ priority: b._id, count: b.n, avg: Math.round(b.avg || 0) })) });
}));

let rescoring = new Set<string>();
r.post("/crm/scoring/recalculate", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const key = String(req.tenantId);
  if (rescoring.has(key)) return ok(res, { started: false, running: true });
  const ids = await Lead.find({ tenant: req.tenantId }).select("_id").sort({ lastActivity: -1 }).limit(20000).lean();
  rescoring.add(key);
  // runs on after the reply; a few thousand leads take a minute or two
  void (async () => {
    try { for (const l of ids) await refreshLead(l._id).catch(() => undefined); }
    finally { rescoring.delete(key); }
  })();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "RESCORE", module: "Leads", entity: `${ids.length} leads` });
  ok(res, { started: true, leads: ids.length });
}));

export default r;
