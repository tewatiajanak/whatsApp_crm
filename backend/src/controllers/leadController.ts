import { Request, Response } from "express";
import { Types } from "mongoose";
import { Lead, LEAD_PRIORITIES } from "../models/Lead";
import { LeadActivity } from "../models/LeadActivity";
import { FollowUp } from "../models/FollowUp";
import { LeadStatus, SubStatus, LeadSource } from "../models/Masters";
import { Service } from "../models/Service";
import { Registration } from "../models/Registration";
import { Conversation } from "../models/Messaging";
import { asyncHandler, ok, paginated, ApiError, audit } from "../utils/http";
import {
  convertToLead, changeLeadStatus, assignLead, assignableOwners, refreshLead, logActivity,
  findLeadByPhone, findDuplicateLead, maskContacts, cleanPhone, isValidPhone, isValidEmail, escapeRegex,
} from "../services/leadService";
import { LeadTrash, Course, Branch, Partner } from "../models/CrmMore";
import { CrmList } from "../models/CrmPro";
import { fireAlerts } from "../services/alertsEngine";
import { scopeLeadFilter, leadOwnerScope } from "../services/leadAccess";
import { crmSettingsFor, AutomationJob, AutomationRun, LeadFee, LeadDocument } from "../models/CrmExtras";
import { CustomField } from "../models/ModuleSetup";
import { telephonyReady, smsReady } from "../services/crmChannels";
import { startOfLocalDay, endOfLocalDay, localDateTime, isDateKey } from "../utils/dates";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const oid = (v: unknown) => (typeof v === "string" && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null);
/** Days a lead may sit without activity before it counts as going cold. */
export const STALE_DAYS = 7;

/**
 * Turn the list's query string into a Mongo filter. Shared by the list, the
 * board, the export and "select all matching" bulk actions so they always agree.
 */
export async function buildLeadFilter(req: Request, q: Record<string, any> = req.query) {
  const tenant = req.tenantId;
  const filter: any = { tenant };
  const and: any[] = [];

  const search = str(q.q);
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    const digits = search.replace(/\D/g, "");
    const or: any[] = [{ name: rx }, { phone: rx }, { email: rx }, { course: rx }, { city: rx }];
    if (digits.length >= 4) or.push({ phoneKey: new RegExp(escapeRegex(digits.slice(-10))) });
    and.push({ $or: or });
  }

  for (const key of ["status", "subStatus", "source"]) {
    const id = oid(q[key]);
    if (id) filter[key] = id;
  }
  const service = oid(q.service);
  if (service) filter["serviceTracks.service"] = service;

  const owner = str(q.owner);
  if (owner === "me") filter.owner = req.auth?.name;
  else if (owner && owner !== "All") filter.owner = owner;

  const priority = str(q.priority);
  if ((LEAD_PRIORITIES as readonly string[]).includes(priority)) filter.priority = priority;
  if (str(q.tag)) filter.tags = str(q.tag);
  if (str(q.city)) filter.city = new RegExp(`^${escapeRegex(str(q.city))}$`, "i");
  if (str(q.branch)) filter.branch = str(q.branch);
  if (str(q.course)) filter.course = str(q.course);
  const partner = oid(q.partner);
  if (partner) filter.partner = partner;
  // custom fields: ?cf_<key>=value
  for (const [k, v] of Object.entries(q)) {
    if (k.startsWith("cf_") && /^cf_[a-z0-9_]+$/i.test(k) && typeof v === "string" && v) filter[`customFields.${k.slice(3)}`] = v;
  }

  const created: any = {};
  if (isDateKey(q.createdFrom)) created.$gte = localDateTime(q.createdFrom);
  if (isDateKey(q.createdTo)) created.$lte = new Date(localDateTime(q.createdTo).getTime() + 86_400_000 - 1);
  if (Object.keys(created).length) filter.createdAt = created;

  const score: any = {};
  if (q.minScore !== undefined && q.minScore !== "" && !isNaN(Number(q.minScore))) score.$gte = Number(q.minScore);
  if (q.maxScore !== undefined && q.maxScore !== "" && !isNaN(Number(q.maxScore))) score.$lte = Number(q.maxScore);
  if (Object.keys(score).length) filter.score = score;

  const followUp = str(q.followUp);
  if (followUp === "overdue") filter.nextFollowUp = { $lt: startOfLocalDay() };
  else if (followUp === "today") filter.nextFollowUp = { $gte: startOfLocalDay(), $lte: endOfLocalDay() };
  else if (followUp === "upcoming") filter.nextFollowUp = { $gt: endOfLocalDay() };
  else if (followUp === "none") filter.nextFollowUp = null;

  const view = str(q.view);
  if (view) {
    const closed = await LeadStatus.find({ tenant, $or: [{ isWon: true }, { isLost: true }] }).select("isWon isLost").lean();
    const wonIds = closed.filter((s: any) => s.isWon).map((s: any) => s._id);
    const lostIds = closed.filter((s: any) => s.isLost).map((s: any) => s._id);
    const openOnly = { status: { $nin: [...wonIds, ...lostIds] } };
    if (view === "open") and.push(openOnly);
    else if (view === "won") and.push({ status: { $in: wonIds } });
    else if (view === "lost") and.push({ status: { $in: lostIds } });
    else if (view === "new") and.push({ createdAt: { $gte: startOfLocalDay() } });
    else if (view === "untouched") and.push(openOnly, { firstContactedAt: null });
    else if (view === "stale") and.push(openOnly, { lastActivity: { $lt: new Date(Date.now() - STALE_DAYS * 86_400_000) } });
    else if (view === "unassigned") and.push({ owner: { $in: ["Unassigned", "", null] } });
  }

  // members of a lead list (static: its saved leads; smart: its filters)
  const listId = oid(q.list);
  if (listId) {
    const list: any = await CrmList.findOne({ _id: listId, tenant }).lean();
    if (!list) and.push({ _id: null });
    else if (list.kind === "static") and.push({ _id: { $in: list.leads || [] } });
    else if (!q._nested) {
      const inner = await buildLeadFilter(req, { ...(list.filters || {}), _nested: "1" });
      delete inner.tenant;
      and.push(inner);
    }
  }

  if (and.length) filter.$and = and;
  // never wider than the role's lead visibility
  return scopeLeadFilter(req, filter);
}

const SORTS: Record<string, any> = {
  "-createdAt": { createdAt: -1 }, createdAt: { createdAt: 1 },
  "-score": { score: -1, createdAt: -1 }, score: { score: 1, createdAt: -1 },
  nextFollowUp: { nextFollowUp: 1 }, "-nextFollowUp": { nextFollowUp: -1 },
  "-lastActivity": { lastActivity: -1 }, lastActivity: { lastActivity: 1 },
  name: { name: 1 }, "-name": { name: -1 },
  "-value": { value: -1 }, value: { value: 1 },
};

export const list = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const perPage = Math.min(200, Math.max(1, parseInt(String(req.query.perPage || "50"), 10) || 50));
  const filter = await buildLeadFilter(req);
  const sort = SORTS[str(req.query.sort)] || SORTS["-createdAt"];
  const [items, total] = await Promise.all([
    Lead.find(filter).sort(sort).skip((page - 1) * perPage).limit(perPage).select("-notes").populate("status source subStatus").lean(),
    Lead.countDocuments(filter),
  ]);
  paginated(res, maskContacts(req, items), total, page, perPage);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const lead = await Lead.findOne({ _id: req.params.id, tenant: req.tenantId }).populate("status source subStatus").populate("partner", "name code");
  if (!lead) throw new ApiError(404, "Lead not found");
  ok(res, maskContacts(req, lead));
});

/** Everything the Leads screens need to draw their filters, in one call. */
export const meta = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const [statuses, subStatuses, sources, services, owners, tags, lostReasons] = await Promise.all([
    LeadStatus.find({ tenant }).sort({ order: 1, createdAt: 1 }).lean(),
    SubStatus.find({ tenant }).sort({ name: 1 }).lean(),
    LeadSource.find({ tenant }).sort({ name: 1 }).lean(),
    Service.find({ tenant, active: { $ne: false } }).sort({ order: 1 }).lean(),
    assignableOwners(tenant),
    Lead.distinct("tags", { tenant }),
    Lead.distinct("lostReason", { tenant, lostReason: { $nin: ["", null] } }),
  ]);
  // someone limited to their own or their team's leads only filters by those owners
  const scope = await leadOwnerScope(req);
  const [settings, customFields] = await Promise.all([
    crmSettingsFor(tenant),
    CustomField.find({ tenant, module: "crm", isActive: { $ne: false } }).sort({ createdAt: 1 }).select("key label type options required").lean(),
  ]);
  const [courses, branches, partners] = await Promise.all([
    Course.find({ tenant, active: { $ne: false } }).sort({ name: 1 }).select("name fee seats intake").lean(),
    Branch.find({ tenant, active: { $ne: false } }).sort({ name: 1 }).select("name city").lean(),
    Partner.find({ tenant, active: { $ne: false } }).sort({ name: 1 }).select("name code").lean(),
  ]);
  ok(res, {
    customFields,
    courses,
    branches,
    partners,
    contactsHidden: !!req.maskContacts,
    hiddenFields: req.leadFieldRules?.hidden || [],
    readOnlyFields: req.leadFieldRules?.readOnly || [],
    myBranches: req.leadBranches || [],
    canCall: telephonyReady(settings),
    canSms: smsReady(settings),
    statuses, subStatuses, sources, services, owners, tags: tags.filter(Boolean).sort(), lostReasons, me: req.auth?.name,
    leadVisibility: req.leadVisibility || "all",
    visibleOwners: scope ? owners.filter((o) => scope.includes(o)) : owners,
  });
});

/** Counts behind the smart-view tabs. */
export const viewCounts = asyncHandler(async (req: Request, res: Response) => {
  const views: Record<string, Record<string, string>> = {
    all: {},
    mine: { owner: "me" },
    new: { view: "new" },
    untouched: { view: "untouched" },
    hot: { priority: "hot", view: "open" },
    overdue: { followUp: "overdue" },
    today: { followUp: "today" },
    stale: { view: "stale" },
    unassigned: { view: "unassigned" },
  };
  const entries = await Promise.all(
    Object.entries(views).map(async ([key, q]) => [key, await Lead.countDocuments(await buildLeadFilter(req, q))] as const)
  );
  ok(res, Object.fromEntries(entries));
});

/** Same phone already a lead? Used by the Add Lead form before saving. */
export const checkDuplicate = asyncHandler(async (req: Request, res: Response) => {
  const dup = await findDuplicateLead(req.tenantId, req.query.phone, str(req.query.email), oid(req.query.exclude) || undefined);
  ok(res, dup ? { duplicate: true, lead: { _id: dup._id, name: dup.name, phone: dup.phone, owner: dup.owner } } : { duplicate: false });
});

export const convert = asyncHandler(async (req: Request, res: Response) => {
  const b = req.body || {};
  if (!b.name || !b.phone) throw new ApiError(400, "Name and phone are required");
  const result = await convertToLead({
    tenant: req.tenantId,
    name: b.name, phone: b.phone, email: b.email,
    sourceKeyOrId: b.source,
    // a user who sees only their own leads keeps the ones they add
    owner: b.owner || (req.leadVisibility === "own" ? req.auth?.name : undefined),
    course: b.course, contactId: b.contactId,
    city: b.city, state: b.state, country: b.country, grade: b.grade,
    altPhone: b.altPhone, value: b.value, statusId: b.statusId, note: b.note,
    // someone tied to one branch adds leads to that branch
    branch: str(b.branch) || (req.leadBranches?.length === 1 ? req.leadBranches[0] : ""), partnerCode: str(b.partnerCode), manual: true,
    tags: Array.isArray(b.tags) ? b.tags : undefined,
    user: req.auth?.name,
  });
  if (result.created && b.customFields && typeof b.customFields === "object" && !Array.isArray(b.customFields)) {
    result.lead.customFields = b.customFields;
    result.lead.markModified("customFields");
    await result.lead.save();
  }
  ok(res, result, result.created ? 201 : 200);
});

const EDITABLE = ["name", "email", "altPhone", "course", "city", "state", "country", "grade", "lostReason", "branch"] as const;

export const update = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const b = req.body || {};
  const lead = await Lead.findOne({ _id: req.params.id, tenant });
  if (!lead) throw new ApiError(404, "Lead not found");

  // a user who sees masked contacts would save the masks back: their contact edits are ignored
  if (req.maskContacts) { delete b.phone; delete b.email; delete b.altPhone; }
  // fields this role may not see or may not change
  const locked = [...(req.leadFieldRules?.hidden || []), ...(req.leadFieldRules?.readOnly || [])];
  const touched = locked.filter((f) => b[f] !== undefined);
  if (touched.length) throw new ApiError(403, `Your role cannot change: ${touched.join(", ")}`);
  if (req.leadBranches?.length && b.branch !== undefined && !req.leadBranches.includes(str(b.branch))) throw new ApiError(403, "You can only use your own branch");

  const changed: string[] = [];
  if (b.doNotContact && typeof b.doNotContact === "object") {
    for (const ch of ["whatsapp", "sms", "email", "call"] as const) {
      if (b.doNotContact[ch] !== undefined && !!b.doNotContact[ch] !== !!lead.doNotContact?.[ch]) { lead.doNotContact[ch] = !!b.doNotContact[ch]; if (!changed.includes("do not contact")) changed.push("do not contact"); }
    }
  }
  if (b.partner !== undefined) {
    const p = b.partner ? await Partner.findOne({ _id: oid(b.partner), tenant }) : null;
    if (b.partner && !p) throw new ApiError(400, "Partner not found");
    if (String(lead.partner || "") !== String(p?._id || "")) { lead.partner = (p?._id as any) || null; changed.push("partner"); }
  }
  for (const k of EDITABLE) {
    if (b[k] === undefined) continue;
    const v = k === "email" ? str(b[k]).toLowerCase() : str(b[k]);
    if (k === "name" && !v) throw new ApiError(400, "Name is required");
    if (k === "email" && v && !isValidEmail(v)) throw new ApiError(400, "Enter a valid email address");
    if (String((lead as any)[k] || "") !== v) { (lead as any)[k] = v; changed.push(k); }
  }
  if (b.phone !== undefined) {
    const phone = cleanPhone(b.phone);
    if (!isValidPhone(phone)) throw new ApiError(400, "Enter a valid phone number");
    if (phone !== lead.phone) {
      const dup = await findLeadByPhone(tenant, phone, lead._id);
      if (dup) throw new ApiError(409, `${dup.name} already has this phone number`);
      lead.phone = phone;
      changed.push("phone");
    }
  }
  if (b.value !== undefined) {
    const value = Number(b.value);
    if (isNaN(value) || value < 0) throw new ApiError(400, "Value must be a number");
    if (value !== lead.value) { lead.value = value; changed.push("value"); }
  }
  if (b.tags !== undefined) {
    if (!Array.isArray(b.tags)) throw new ApiError(400, "tags must be a list");
    lead.tags = [...new Set(b.tags.map((t: any) => String(t).trim()).filter(Boolean))] as string[];
    changed.push("tags");
  }
  if (b.source !== undefined) {
    const src = b.source ? await LeadSource.findOne({ _id: oid(b.source), tenant }) : null;
    if (b.source && !src) throw new ApiError(400, "Source not found");
    if (String(lead.source || "") !== String(src?._id || "")) { lead.source = src?._id as any; changed.push("source"); }
  }
  if (b.priority !== undefined) {
    if (b.priority === "auto") lead.priorityManual = false;
    else if ((LEAD_PRIORITIES as readonly string[]).includes(b.priority)) { lead.priority = b.priority; lead.priorityManual = true; }
    else throw new ApiError(400, "Priority must be hot, warm or cold");
    changed.push("priority");
  }
  if (b.customFields && typeof b.customFields === "object" && !Array.isArray(b.customFields)) {
    lead.customFields = { ...(lead.customFields || {}), ...b.customFields };
    lead.markModified("customFields");
    changed.push("details");
  }

  if (changed.length) {
    lead.lastActivity = new Date();
    await lead.save();
    if (changed.includes("name") || changed.includes("phone")) {
      await FollowUp.updateMany({ tenant, lead: lead._id }, { $set: { leadName: lead.name, phone: lead.phone } });
    }
    await logActivity({ tenant, lead: lead._id, type: "edited", by: req.auth?.name, title: "Details updated", detail: changed.join(", ") });
    await audit({ tenant, user: req.auth?.name, action: "UPDATE", module: "Leads", entity: lead.name, next: changed.join(", ") });
  }
  if (b.owner !== undefined) await assignLead({ tenant, lead, owner: b.owner, user: req.auth?.name });

  await refreshLead(lead);
  ok(res, maskContacts(req, await lead.populate("status source subStatus")));
});

/**
 * Delete leads with everything that hangs off them. A copy of each goes to the
 * recycle bin first, so it can be restored until the bin is emptied.
 */
export async function deleteLeads(tenant: any, ids: any[], by = "System") {
  const leads = await Lead.find({ tenant, _id: { $in: ids } }).lean();
  for (const lead of leads) {
    const [followUps, activities, fees, documents] = await Promise.all([
      FollowUp.find({ tenant, lead: lead._id }).lean(),
      LeadActivity.find({ tenant, lead: lead._id }).lean(),
      LeadFee.find({ tenant, lead: lead._id }).lean(),
      LeadDocument.find({ tenant, lead: lead._id }).lean(),
    ]);
    await LeadTrash.create({ tenant, leadId: lead._id, name: lead.name, phone: lead.phone, owner: lead.owner, deletedBy: by, snapshot: { lead, followUps, activities, fees, documents } });
  }
  await Promise.all([
    FollowUp.deleteMany({ tenant, lead: { $in: ids } }),
    LeadActivity.deleteMany({ tenant, lead: { $in: ids } }),
    Conversation.updateMany({ tenant, lead: { $in: ids } }, { $unset: { lead: 1 } }),
    Registration.updateMany({ tenant, lead: { $in: ids } }, { $set: { lead: null } }),
    AutomationJob.deleteMany({ tenant, lead: { $in: ids } }),
    AutomationRun.deleteMany({ tenant, lead: { $in: ids } }),
    LeadFee.deleteMany({ tenant, lead: { $in: ids } }),
  ]);
  // the files themselves stay on disk until the recycle bin is emptied
  await LeadDocument.deleteMany({ tenant, lead: { $in: ids } });
  const r = await Lead.deleteMany({ tenant, _id: { $in: ids } });
  return r.deletedCount || 0;
}

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const lead = await Lead.findOne({ _id: req.params.id, tenant: req.tenantId }).select("name");
  if (!lead) throw new ApiError(404, "Lead not found");
  await deleteLeads(req.tenantId, [lead._id], req.auth?.name);
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Leads", entity: lead.name });
  ok(res, { deleted: true });
});

export const setStatus = asyncHandler(async (req: Request, res: Response) => {
  const { statusId, subStatusId, lostReason } = req.body || {};
  if (!statusId) throw new ApiError(400, "statusId required");
  const lead = await changeLeadStatus({
    tenant: req.tenantId,
    leadId: req.params.id,
    statusId,
    subStatusId,
    lostReason,
    user: req.auth?.name,
  });
  ok(res, maskContacts(req, await lead.populate("status source subStatus")));
});

export const addNote = asyncHandler(async (req: Request, res: Response) => {
  const text = str(req.body?.text);
  if (!text) throw new ApiError(400, "text required");
  const lead = await Lead.findOneAndUpdate(
    { _id: req.params.id, tenant: req.tenantId },
    { $push: { notes: { text, by: req.auth?.name || "System", at: new Date() } }, $set: { lastActivity: new Date() } },
    { new: true }
  );
  if (!lead) throw new ApiError(404, "Lead not found");
  await logActivity({ tenant: req.tenantId, lead: lead._id, type: "note", by: req.auth?.name, title: "Note", detail: text });
  await refreshLead(lead);
  await fireAlerts("lead.note_added", lead, req.tenantId!, req.auth?.name);
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "NOTE", module: "Leads", entity: lead.name });
  ok(res, lead);
});

export const CALL_OUTCOMES = ["Connected", "No answer", "Busy", "Switched off", "Wrong number", "Call back later"] as const;

/** Log a phone call made to (or received from) the lead. */
export const logCall = asyncHandler(async (req: Request, res: Response) => {
  const b = req.body || {};
  const outcome = str(b.outcome) || "Connected";
  if (!(CALL_OUTCOMES as readonly string[]).includes(outcome)) throw new ApiError(400, "Unknown call outcome");
  const lead = await Lead.findOne({ _id: req.params.id, tenant: req.tenantId });
  if (!lead) throw new ApiError(404, "Lead not found");

  const now = new Date();
  const minutes = Math.max(0, Number(b.durationMin) || 0);
  if (!lead.firstContactedAt) lead.firstContactedAt = now;
  lead.lastContactedAt = now;
  lead.lastActivity = now;
  if (str(b.note)) lead.currentRemark = str(b.note);
  await lead.save();
  await logActivity({
    tenant: req.tenantId, lead: lead._id, type: "call", by: req.auth?.name,
    title: `${b.direction === "incoming" ? "Incoming" : "Outgoing"} call · ${outcome}`,
    detail: [minutes ? `${minutes} min` : "", str(b.note)].filter(Boolean).join(" · "),
    meta: { outcome, direction: b.direction === "incoming" ? "incoming" : "outgoing", durationMin: minutes },
  });
  await refreshLead(lead);
  ok(res, lead);
});

/** The lead's full history, newest first. */
export const timeline = asyncHandler(async (req: Request, res: Response) => {
  const lead = await Lead.findOne({ _id: req.params.id, tenant: req.tenantId }).select("notes createdAt source").populate("source", "name").lean();
  if (!lead) throw new ApiError(404, "Lead not found");
  const acts: any[] = await LeadActivity.find({ tenant: req.tenantId, lead: lead._id }).sort({ at: -1 }).limit(500).lean();

  // notes written before the timeline existed
  const loggedNotes = new Set(acts.filter((a) => a.type === "note").map((a) => a.detail));
  for (const n of (lead as any).notes || []) {
    if (!loggedNotes.has(n.text)) acts.push({ _id: `note-${new Date(n.at).getTime()}`, type: "note", title: "Note", detail: n.text, by: n.by, at: n.at });
  }
  if (!acts.some((a) => a.type === "created" || a.type === "imported")) {
    acts.push({ _id: "created", type: "created", title: "Lead created", detail: (lead as any).source?.name || "", by: "", at: (lead as any).createdAt });
  }
  acts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  ok(res, acts);
});

export const getServiceStatuses = asyncHandler(async (req: Request, res: Response) => {
  const serviceId = oid(req.params.serviceId);
  const query: any = { tenant: req.tenantId };
  if (serviceId) {
    query.$or = [{ offerings: serviceId }, { offerings: { $size: 0 } }, { offerings: { $exists: false } }];
  }
  ok(res, await LeadStatus.find(query).sort({ order: 1 }));
});

/** Pipeline board: one column per status with its newest leads and totals. */
export const board = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const filter = await buildLeadFilter(req, { ...req.query, status: undefined });
  const service = oid(req.query.pipeline);
  const statusQuery: any = { tenant };
  if (service) statusQuery.$or = [{ offerings: service }, { offerings: { $size: 0 } }, { offerings: { $exists: false } }];
  const perColumn = Math.min(50, Math.max(5, Number(req.query.perColumn) || 20));

  const [statuses, totals] = await Promise.all([
    LeadStatus.find(statusQuery).sort({ order: 1, createdAt: 1 }).lean(),
    // aggregate() does not cast: the tenant id must be an ObjectId here
    Lead.aggregate([{ $match: { ...filter, tenant: new Types.ObjectId(String(tenant)) } }, { $group: { _id: "$status", count: { $sum: 1 }, value: { $sum: "$value" } } }]),
  ]);
  const totalBy = new Map(totals.map((t: any) => [String(t._id), t]));
  const columns = await Promise.all(
    statuses.map(async (s: any) => ({
      status: s,
      count: totalBy.get(String(s._id))?.count || 0,
      value: totalBy.get(String(s._id))?.value || 0,
      leads: totalBy.get(String(s._id))
        ? await Lead.find({ ...filter, status: s._id }).sort({ lastActivity: -1 }).limit(perColumn)
            .select("name phone owner priority score value nextFollowUp lastActivity tags course source").populate("source", "name").lean()
        : [],
    }))
  );
  ok(res, { columns: columns.map((c) => ({ ...c, leads: maskContacts(req, c.leads) })) });
});
