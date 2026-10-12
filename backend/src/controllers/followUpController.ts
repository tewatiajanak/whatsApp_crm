import { Request, Response } from "express";
import { Types } from "mongoose";
import { FollowUp } from "../models/FollowUp";
import { Lead, ILead } from "../models/Lead";
import { asyncHandler, ok, ApiError, audit } from "../utils/http";
import { logActivity, refreshLead, maskContacts } from "../services/leadService";
import { scopeFollowUpFilter, leadOwnerScope, canSeeLead } from "../services/leadAccess";
import { startOfLocalDay, endOfLocalDay, localDateTime, isDateKey, localDateKey } from "../utils/dates";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const TYPES: Record<string, string> = { call: "Call", whatsapp: "WhatsApp", email: "Email", sms: "SMS", visit: "Visit", meeting: "Meeting" };
/** "call" / "CALL" / "Call" → "Call"; anything unknown becomes a call. */
export const normalizeFollowUpType = (t: unknown) => TYPES[String(t || "").trim().toLowerCase()] || "Call";

/** A due moment from either an ISO timestamp or a local date + time. */
function dueFrom(date: unknown, time?: unknown): Date | null {
  if (isDateKey(date) && String(date).length === 10) return localDateTime(date, str(time) || "10:00");
  const d = new Date(String(date || ""));
  return isNaN(d.getTime()) ? null : d;
}

/** Record that the lead was actually reached. */
function touchContact(lead: ILead) {
  const now = new Date();
  if (!lead.firstContactedAt) lead.firstContactedAt = now;
  lead.lastContactedAt = now;
  lead.lastActivity = now;
}

async function schedule(opts: {
  tenant: any; lead: ILead; due: Date; time?: string; type?: unknown; note?: string; owner?: string; service?: any; user?: string;
}) {
  const type = normalizeFollowUpType(opts.type);
  const owner = str(opts.owner) || opts.lead.owner || opts.user || "Unassigned";
  const fu = await FollowUp.create({
    tenant: opts.tenant,
    lead: opts.lead._id,
    service: opts.service || null,
    leadName: opts.lead.name,
    phone: opts.lead.phone,
    type,
    due: opts.due,
    dueDate: opts.due,
    dueTime: opts.time || "",
    note: opts.note,
    remark: opts.note,
    owner,
    assignedTo: owner,
    done: false,
    status: opts.lead.status,
  });
  await logActivity({
    tenant: opts.tenant, lead: opts.lead._id, type: "followup_scheduled", by: opts.user,
    title: `${type} follow-up scheduled`, detail: opts.note, meta: { due: opts.due, owner, followUp: fu._id },
  });
  return fu;
}

/** GET /followups/buckets → counts + items for overdue / today / upcoming / done */
export const buckets = asyncHandler(async (req: Request, res: Response) => {
  const base: any = { tenant: req.tenantId };
  const owner = str(req.query.owner);
  if (owner === "me") base.owner = req.auth?.name;
  else if (owner && owner !== "All") base.owner = owner;
  if (Types.ObjectId.isValid(str(req.query.service))) base.service = req.query.service;
  const type = str(req.query.type);
  if (type) base.type = normalizeFollowUpType(type);
  await scopeFollowUpFilter(req, base);

  const sod = startOfLocalDay();
  const eod = endOfLocalDay();
  const filters = {
    overdue: { ...base, done: false, due: { $lt: sod } },
    today: { ...base, done: false, due: { $gte: sod, $lte: eod } },
    upcoming: { ...base, done: false, due: { $gt: eod } },
    done: { ...base, done: true },
  };
  const LIMIT = 200;
  const withLead = (q: any) => q.limit(LIMIT).populate({ path: "lead", select: "name phone email priority score status owner", populate: { path: "status", select: "name color" } }).lean();

  const [overdue, today, upcoming, done, counts] = await Promise.all([
    withLead(FollowUp.find(filters.overdue).sort({ due: 1 })),
    withLead(FollowUp.find(filters.today).sort({ due: 1 })),
    withLead(FollowUp.find(filters.upcoming).sort({ due: 1 })),
    withLead(FollowUp.find(filters.done).sort({ completedAt: -1, updatedAt: -1 })),
    Promise.all(Object.values(filters).map((f) => FollowUp.countDocuments(f))),
  ]);
  const [cOverdue, cToday, cUpcoming, cDone] = counts;
  const m = (rows: any[]) => maskContacts(req, rows);
  ok(res, { counts: { overdue: cOverdue, today: cToday, upcoming: cUpcoming, done: cDone }, overdue: m(overdue), today: m(today), upcoming: m(upcoming), done: m(done) });
});

/** GET /leads/:id/followups → every follow-up of one lead, newest first */
export const listForLead = asyncHandler(async (req: Request, res: Response) => {
  if (!(await Lead.exists({ _id: req.params.id, tenant: req.tenantId }))) throw new ApiError(404, "Lead not found");
  ok(res, await FollowUp.find({ tenant: req.tenantId, lead: req.params.id }).sort({ done: 1, due: -1 }).lean());
});

/** POST /followups/:id/complete { outcome, note, next: { date, time, type, note, assignedTo } } */
export const complete = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const b = req.body || {};
  const fu = await FollowUp.findOne({ _id: req.params.id, tenant });
  if (!fu) throw new ApiError(404, "Follow-up not found");
  let nextDue: Date | null = null;
  if (b.next?.date) {
    nextDue = dueFrom(b.next.date, b.next.time);
    if (!nextDue) throw new ApiError(400, "The next follow-up date is not valid");
  }

  if (!fu.done) {
    fu.done = true;
    fu.completedAt = new Date();
    fu.outcome = str(b.outcome) || "Completed";
    fu.completionNote = str(b.note);
    await fu.save();
  }

  const lead = await Lead.findOne({ _id: fu.lead, tenant });
  if (lead) {
    touchContact(lead);
    lead.followUpCount = (lead.followUpCount || 0) + 1;
    await lead.save();
    await logActivity({
      tenant, lead: lead._id, type: "followup_done", by: req.auth?.name,
      title: `${fu.type} follow-up · ${fu.outcome}`, detail: fu.completionNote || fu.note, meta: { followUp: fu._id },
    });
    if (nextDue) {
      await schedule({ tenant, lead, due: nextDue, time: str(b.next.time), type: b.next.type || fu.type, note: str(b.next.note), owner: str(b.next.assignedTo) || fu.owner, service: fu.service, user: req.auth?.name });
    }
    await refreshLead(lead);
  }
  await audit({ tenant, user: req.auth?.name, action: "FOLLOWUP", module: "Follow-ups", entity: fu.leadName || String(fu._id), next: fu.outcome });
  ok(res, fu);
});

/** POST /followups/:id/reschedule { due } or { date, time } */
export const reschedule = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const b = req.body || {};
  const due = dueFrom(b.date || b.due, b.time);
  if (!due) throw new ApiError(400, "Choose a valid date");
  const fu = await FollowUp.findOne({ _id: req.params.id, tenant });
  if (!fu) throw new ApiError(404, "Follow-up not found");
  if (fu.done) throw new ApiError(400, "This follow-up is already completed");
  const prev = fu.due;
  fu.due = due;
  fu.dueDate = due;
  if (str(b.time)) fu.dueTime = str(b.time);
  await fu.save();
  await logActivity({
    tenant, lead: fu.lead, type: "followup_rescheduled", by: req.auth?.name,
    title: "Follow-up rescheduled", detail: `${localDateKey(prev)} → ${localDateKey(due)}${str(b.reason) ? ` · ${str(b.reason)}` : ""}`,
  });
  await refreshLead(fu.lead);
  ok(res, fu);
});

/** DELETE /followups/:id → cancel a follow-up that is no longer needed */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const fu = await FollowUp.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
  if (!fu) throw new ApiError(404, "Follow-up not found");
  await refreshLead(fu.lead);
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Follow-ups", entity: fu.leadName || String(fu._id) });
  ok(res, { deleted: true });
});

/** POST /followups { lead, date|due, time, type, note, assignedTo } */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const b = req.body || {};
  const lead = (await canSeeLead(req, b.lead)) ? await Lead.findOne({ _id: b.lead, tenant: req.tenantId }) : null;
  if (!lead) throw new ApiError(404, "Lead not found");
  const due = dueFrom(b.date || b.dueDate || b.due, b.time || b.dueTime);
  if (!due) throw new ApiError(400, "Choose a follow-up date");
  const fu = await schedule({ tenant: req.tenantId, lead, due, time: str(b.time || b.dueTime), type: b.type, note: str(b.note || b.remark), owner: str(b.assignedTo || b.owner), service: b.service, user: req.auth?.name });
  await refreshLead(lead);
  ok(res, fu, 201);
});

/**
 * POST /leads/:id/followups
 * Either { current, next } — log what just happened and schedule what comes
 * next — or a flat { dueDate, dueTime, type, remark, assignedTo, done }.
 */
export const createFollowUpForLead = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const user = req.auth?.name;
  const lead = await Lead.findOne({ _id: req.params.id, tenant });
  if (!lead) throw new ApiError(404, "Lead not found");
  const body = req.body || {};

  const current = body.current || (body.done === true || body.done === "true" ? { type: body.type, date: body.dueDate || body.due, time: body.dueTime, remark: body.remark || body.note } : null);
  const next = body.next || (!current ? { type: body.type, date: body.dueDate || body.due, time: body.dueTime, remark: body.remark || body.note, assignedTo: body.assignedTo } : null);

  const nextDue = next?.date ? dueFrom(next.date, next.time) : null;
  if (next?.date && !nextDue) throw new ApiError(400, "The next follow-up date is not valid");
  const logNow = !!(current && str(current.remark));
  if (!logNow && !nextDue) throw new ApiError(400, "Add what was discussed, or choose the next follow-up date");

  let count = 0;
  if (logNow) {
    const at = dueFrom(current.date, current.time) || new Date();
    const type = normalizeFollowUpType(current.type);
    // The conversation just logged settles whatever was due up to today. When the
    // next step is being set as well, it replaces the lead's other pending
    // follow-ups too — except those of a specific service, which run on their own.
    const settles: any[] = [{ due: { $lte: endOfLocalDay() } }];
    if (nextDue) settles.push({ service: null });
    const settled = await FollowUp.updateMany(
      { tenant, lead: lead._id, done: false, $or: settles },
      { $set: { done: true, completedAt: new Date(), outcome: "Completed", completionNote: str(current.remark) } }
    );
    if (!settled.modifiedCount) {
      await FollowUp.create({
        tenant, lead: lead._id, leadName: lead.name, phone: lead.phone, type, due: at, dueDate: at, dueTime: str(current.time),
        note: str(current.remark), remark: str(current.remark), owner: user || lead.owner, assignedTo: user || lead.owner,
        done: true, outcome: "Completed", completedAt: new Date(), completionNote: str(current.remark), status: lead.status,
      });
    }
    touchContact(lead);
    lead.followUpCount = (lead.followUpCount || 0) + 1;
    await lead.save();
    await logActivity({ tenant, lead: lead._id, type: "followup_done", by: user, title: `${type} · logged`, detail: str(current.remark), at });
    count++;
  }

  if (nextDue) {
    await schedule({ tenant, lead, due: nextDue, time: str(next.time), type: next.type, note: str(next.remark), owner: str(next.assignedTo), user });
    count++;
  }

  await refreshLead(lead);
  await audit({ tenant, user, action: "FOLLOWUP_LOGGED", module: "Follow-ups", entity: lead.name, next: [logNow && "Logged", nextDue && `Next ${localDateKey(nextDue)}`].filter(Boolean).join(" · ") });
  ok(res, { success: true, count, created: true });
});

/** GET /followups/workload?counsellor= → how loaded a counsellor is */
export const getWorkload = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const counsellor = str(req.query.counsellor);
  if (!counsellor) throw new ApiError(400, "counsellor query param required");
  const scope = await leadOwnerScope(req);
  if (scope && !scope.includes(counsellor)) throw new ApiError(403, "You cannot see this person's follow-ups");
  const mine = { tenant, $or: [{ assignedTo: counsellor }, { owner: counsellor }] };

  const [pending, overdue, completedToday, nextFollowUp] = await Promise.all([
    FollowUp.countDocuments({ ...mine, done: false }),
    FollowUp.countDocuments({ ...mine, done: false, due: { $lt: startOfLocalDay() } }),
    FollowUp.countDocuments({ ...mine, done: true, completedAt: { $gte: startOfLocalDay() } }),
    FollowUp.findOne({ ...mine, done: false }).sort({ due: 1 }).select("due").lean(),
  ]);

  ok(res, { pending, overdue, completed: completedToday, capacity: 20, nextDate: nextFollowUp ? localDateKey(nextFollowUp.due) : null });
});
