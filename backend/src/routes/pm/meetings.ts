import { Router } from "express";
import { Types } from "mongoose";
import { ok, asyncHandler, ApiError, audit } from "../../utils/http";
import { User } from "../../models/User";
import { Team } from "../../models/Team";
import { PmMaster } from "../../models/pm/Setup";
import { PmClient } from "../../models/pm/Client";
import { PmProject, PmTask, PmAssignment, nextNumber } from "../../models/pm/Project";
import { PmMeeting } from "../../models/pm/Meeting";
import { getVisibleEmployeeIds, pmRight } from "../../services/pm/visibility";
import { announceMeeting, newToken } from "../../services/pm/meetings";
import { statusFlags, statusWith } from "../../services/pm/projects";
import { getPmSettings } from "../../services/pm/masters";
import { emitPm } from "../../services/pm/events";

/** Meetings & Trainings. */
const r = Router();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const POPULATE = [
  { path: "type", select: "name color flags" },
  { path: "project", select: "name code" },
  { path: "client", select: "name" },
  { path: "organizer", select: "name photo" },
  { path: "attendees.user", select: "name photo" },
  { path: "actions.assignee", select: "name photo" },
  { path: "actions.task", select: "number title isCompleted" },
];
const startOf = (date: string, from: string) => new Date(`${date}T${from}:00+05:30`);
const addDays = (date: string, n: number) => new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const addMonths = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()));
  return d.toISOString().slice(0, 10);
};

/** Meetings the user may see: organised by / attended by one of their people. */
async function visibleMeetings(req: any) {
  const ids = await getVisibleEmployeeIds(req);
  if (ids === "all") return {};
  const people = ids.map((x) => new Types.ObjectId(x));
  return { $or: [{ organizer: { $in: people } }, { "attendees.user": { $in: people } }] };
}

/** Build the attendee list from teams, employees and client contacts; answers already given are kept. */
async function attendeeList(req: any, body: any, clientId: any, existing: any[] = []) {
  const userIds = new Set<string>((Array.isArray(body.employees) ? body.employees : []).map((x: any) => String(x?._id || x)));
  const teams = (Array.isArray(body.teams) ? body.teams : []).filter((t: any) => Types.ObjectId.isValid(String(t)));
  if (teams.length) {
    (await Team.find({ tenant: req.tenantId, _id: { $in: teams } }).lean()).forEach((t: any) => {
      userIds.add(String(t.manager));
      (t.members || []).forEach((m: any) => userIds.add(String(m.user)));
    });
  }
  const users = await User.find({ tenant: req.tenantId, _id: { $in: [...userIds].filter((x) => Types.ObjectId.isValid(x)) }, status: "Active" }).select("name email mobile").lean();
  const keep = (match: (a: any) => boolean) => existing.find(match);
  const out: any[] = users.map((u: any) => {
    const old = keep((a) => String(a.user || "") === String(u._id));
    return { ...(old ? { _id: old._id } : {}), user: u._id, name: u.name, email: u.email || "", mobile: u.mobile || "", isClient: false, response: old?.response || "", attended: !!old?.attended, token: old?.token || newToken() };
  });
  const contactIds = new Set<string>((Array.isArray(body.contacts) ? body.contacts : []).map(String));
  if (contactIds.size && clientId) {
    const client: any = await PmClient.findOne({ _id: clientId, tenant: req.tenantId }).lean();
    (client?.contacts || []).filter((c: any) => contactIds.has(String(c._id))).forEach((c: any) => {
      const old = keep((a) => a.isClient && a.email === c.email && a.name === c.name);
      out.push({ ...(old ? { _id: old._id } : {}), user: null, name: c.name, email: c.email || "", mobile: c.mobile || "", isClient: true, response: old?.response || "", attended: !!old?.attended, token: old?.token || newToken() });
    });
  }
  if (!out.length) throw new ApiError(400, "Choose at least one attendee");
  return out;
}

async function meetingBody(req: any, body: any, existing?: any) {
  const out: any = {};
  const has = (k: string) => body[k] !== undefined;
  if (has("title") || !existing) {
    out.title = String(body.title || "").trim();
    if (!out.title) throw new ApiError(400, "Enter the title");
  }
  if (has("type")) out.type = body.type && (await PmMaster.exists({ _id: body.type, tenant: req.tenantId, type: "meeting_type" })) ? body.type : null;
  if (has("date") || !existing) {
    if (!DATE.test(String(body.date || ""))) throw new ApiError(400, "Choose the date");
    out.date = body.date;
  }
  if (has("from") || has("to") || !existing) {
    const from = String(body.from ?? existing?.from ?? "");
    const to = String(body.to ?? existing?.to ?? "");
    if (!TIME.test(from) || !TIME.test(to) || from >= to) throw new ApiError(400, "The end time must be after the start time");
    out.from = from;
    out.to = to;
  }
  if (has("mode")) out.mode = ["online", "hybrid"].includes(body.mode) ? body.mode : "onsite";
  if (has("emailInvite")) out.emailInvite = !!body.emailInvite;
  else if (!existing) out.emailInvite = (await getPmSettings(req.tenantId)).meetingEmail !== false;
  if (has("location")) out.location = String(body.location || "").trim();
  if (has("link")) {
    out.link = String(body.link || "").trim();
    if (out.link && !/^https?:\/\//.test(out.link)) throw new ApiError(400, "The meeting link must start with http:// or https://");
  }
  if (has("agenda")) out.agenda = String(body.agenda || "");
  if (has("project")) out.project = body.project && (await PmProject.exists({ _id: body.project, tenant: req.tenantId })) ? body.project : null;
  if (has("client")) out.client = body.client && (await PmClient.exists({ _id: body.client, tenant: req.tenantId })) ? body.client : null;
  if (has("reminders")) out.reminders = [...new Set((Array.isArray(body.reminders) ? body.reminders : []).map(Number).filter((n: number) => n > 0 && n <= 10080))].slice(0, 4);
  return out;
}

/* ---- list ---- */
r.get(
  "/meetings",
  pmRight("meetings", "view"),
  asyncHandler(async (req: any, res: any) => {
    const q = req.query;
    const and: any[] = [{ tenant: req.tenantId }, await visibleMeetings(req)];
    if (DATE.test(String(q.from))) and.push({ date: { $gte: q.from } });
    if (DATE.test(String(q.to))) and.push({ date: { $lte: q.to } });
    for (const k of ["type", "project", "organizer", "client"]) if (q[k] && Types.ObjectId.isValid(String(q[k]))) and.push({ [k]: q[k] });
    if (q.mine === "1") and.push({ $or: [{ organizer: req.auth.uid }, { "attendees.user": req.auth.uid }] });
    if (q.status === "scheduled" || q.status === "cancelled") and.push({ status: q.status });
    if (q.q) and.push({ title: new RegExp(String(q.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
    const rows = await PmMeeting.find({ $and: and }).sort({ date: q.sort === "desc" ? -1 : 1, from: 1 }).limit(500).select("-attendees.token").populate(POPULATE).lean();
    ok(res, rows);
  })
);

async function findMeeting(req: any, id: any) {
  if (!Types.ObjectId.isValid(String(id))) throw new ApiError(404, "Meeting not found");
  const m = await PmMeeting.findOne({ $and: [{ _id: id, tenant: req.tenantId }, await visibleMeetings(req)] });
  if (!m) throw new ApiError(404, "Meeting not found");
  return m;
}
const canChange = (req: any, m: any) => String(m.organizer) === String(req.auth.uid) || !!(req.perms || []).find((p: any) => p.module === "pm_meetings")?.edit;

r.get(
  "/meetings/:id",
  pmRight("meetings", "view"),
  asyncHandler(async (req: any, res: any) => {
    const m = await findMeeting(req, req.params.id);
    ok(res, await PmMeeting.findById(m._id).select("-attendees.token").populate(POPULATE).lean());
  })
);

/* ---- create (one meeting, or a recurring series) ---- */
r.post(
  "/meetings",
  pmRight("meetings", "create"),
  asyncHandler(async (req: any, res: any) => {
    const b = req.body || {};
    const data = await meetingBody(req, b);
    const freq = ["daily", "weekly", "monthly"].includes(b.repeat) ? b.repeat : "none";
    const dates: string[] = [data.date];
    if (freq !== "none") {
      if (!DATE.test(String(b.until || "")) || b.until < data.date) throw new ApiError(400, "Choose the last date of the series");
      const working = (await getPmSettings(req.tenantId)).workingDays;
      for (let i = 1; dates.length < 60; i++) {
        const next = freq === "monthly" ? addMonths(data.date, i) : addDays(data.date, i * (freq === "weekly" ? 7 : 1));
        if (next > b.until) break;
        // a daily series skips the non-working days
        if (freq === "daily" && !working.includes(new Date(`${next}T00:00:00Z`).getUTCDay())) continue;
        dates.push(next);
      }
    }
    const series = dates.length > 1 ? new Types.ObjectId() : null;
    const made: any[] = [];
    for (const date of dates) {
      made.push(
        await PmMeeting.create({
          ...data, date, tenant: req.tenantId, organizer: req.auth.uid, series,
          startsAt: startOf(date, data.from),
          attendees: await attendeeList(req, b, data.client),
        })
      );
    }
    // one invite for the first meeting; the rest of a series is in the calendar and reminded on the day
    await announceMeeting(req.tenantId, made[0].toObject(), "invite");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Project Management", entity: `Meeting ${data.title}${dates.length > 1 ? ` (${dates.length} dates)` : ""}` });
    ok(res, { created: made.length, first: made[0]._id }, 201);
  })
);

r.patch(
  "/meetings/:id",
  pmRight("meetings", "view"),
  asyncHandler(async (req: any, res: any) => {
    const m = await findMeeting(req, req.params.id);
    if (!canChange(req, m)) throw new ApiError(403, "Only the organizer can change this meeting");
    const b = req.body || {};
    const before = `${m.date} ${m.from}-${m.to} ${m.location} ${m.link}`;
    const oldIds = new Set(m.attendees.map((a: any) => String(a._id)));
    Object.assign(m, await meetingBody(req, b, m));
    m.startsAt = startOf(m.date, m.from);
    if (b.employees !== undefined || b.teams !== undefined || b.contacts !== undefined) m.attendees = (await attendeeList(req, b, m.client, m.attendees)) as any;
    const moved = before !== `${m.date} ${m.from}-${m.to} ${m.location} ${m.link}`;
    if (moved) m.firedReminders = [];
    await m.save();
    const fresh = m.attendees.filter((a: any) => !oldIds.has(String(a._id))).map((a: any) => String(a._id));
    if (moved) await announceMeeting(req.tenantId, m.toObject(), "update");
    else if (fresh.length) await announceMeeting(req.tenantId, m.toObject(), "invite", fresh);
    ok(res, m);
  })
);

r.post(
  "/meetings/:id/cancel",
  pmRight("meetings", "view"),
  asyncHandler(async (req: any, res: any) => {
    const m = await findMeeting(req, req.params.id);
    if (!canChange(req, m)) throw new ApiError(403, "Only the organizer can cancel this meeting");
    if (m.status !== "cancelled") {
      m.status = "cancelled";
      await m.save();
      await announceMeeting(req.tenantId, m.toObject(), "cancel");
    }
    ok(res, { cancelled: true });
  })
);

// A cancelled meeting can be removed for good.
r.delete(
  "/meetings/:id",
  pmRight("meetings", "del"),
  asyncHandler(async (req: any, res: any) => {
    const m = await findMeeting(req, req.params.id);
    if (m.status !== "cancelled") throw new ApiError(400, "Cancel the meeting first");
    await m.deleteOne();
    ok(res, { deleted: true });
  })
);

/* ---- my answer ---- */
r.post(
  "/meetings/:id/respond",
  pmRight("meetings", "view"),
  asyncHandler(async (req: any, res: any) => {
    const response = ["yes", "no", "maybe"].includes(req.body?.response) ? req.body.response : "";
    const done = await PmMeeting.updateOne({ _id: req.params.id, tenant: req.tenantId, "attendees.user": req.auth.uid }, { $set: { "attendees.$.response": response } });
    if (!done.matchedCount) throw new ApiError(404, "You are not an attendee of this meeting");
    ok(res, { response });
  })
);

/* ---- after the meeting: attendance, minutes, action items ---- */
r.put(
  "/meetings/:id/minutes",
  pmRight("meetings", "view"),
  asyncHandler(async (req: any, res: any) => {
    const m = await findMeeting(req, req.params.id);
    if (!canChange(req, m)) throw new ApiError(403, "Only the organizer can record the minutes");
    const b = req.body || {};
    if (b.minutes !== undefined) m.minutes = String(b.minutes || "");
    if (Array.isArray(b.attended)) {
      const present = new Set(b.attended.map(String));
      m.attendees.forEach((a: any) => (a.attended = present.has(String(a._id))));
    }
    if (Array.isArray(b.actions)) {
      const old = new Map(m.actions.map((a: any) => [String(a._id), a]));
      m.actions = b.actions
        .map((a: any) => {
          const prev: any = a?._id ? old.get(String(a._id)) : null;
          return { ...(prev ? { _id: prev._id, task: prev.task } : {}), text: String(a?.text || "").trim(), assignee: a?.assignee?._id || a?.assignee || null, due: DATE.test(String(a?.due || "")) ? a.due : "" };
        })
        .filter((a: any) => a.text) as any;
    }
    await m.save();
    ok(res, await PmMeeting.findById(m._id).select("-attendees.token").populate(POPULATE).lean());
  })
);

// An action item becomes an ad-hoc task.
r.post(
  "/meetings/:id/actions/:actionId/task",
  pmRight("meetings", "view"),
  asyncHandler(async (req: any, res: any) => {
    const m = await findMeeting(req, req.params.id);
    if (!canChange(req, m)) throw new ApiError(403, "Only the organizer can create tasks from this meeting");
    const action: any = m.actions.find((a: any) => String(a._id) === String(req.params.actionId));
    if (!action) throw new ApiError(404, "Action item not found");
    if (action.task) throw new ApiError(409, "A task already exists for this action item");
    const assignee = action.assignee || req.auth.uid;
    const s = await getPmSettings(req.tenantId);
    const due = action.due ? new Date(`${action.due}T${s.workEnd}:00+05:30`) : new Date(Date.now() + 2 * 86_400_000);
    const first = (await statusWith(req.tenantId, "task_status", "isInitial")) || (await statusWith(req.tenantId, "task_status", null));
    const project: any = m.project ? await PmProject.findById(m.project).select("client product").lean() : null;
    const task = await PmTask.create({
      tenant: req.tenantId, number: `T-${String(await nextNumber(req.tenantId, "task")).padStart(6, "0")}`, title: action.text, kind: "adhoc",
      project: m.project || null, client: project?.client || m.client || null, product: project?.product || null, assignee, status: first?._id || null, ...statusFlags(first),
      tatValue: 1, tatUnit: "days", plannedStart: new Date(), plannedDue: due, start: new Date(), due, dueLocked: true, clientVisible: false,
      description: `From the meeting "${m.title}" on ${m.date.split("-").reverse().join("-")}`, createdBy: req.auth.uid,
    });
    await PmAssignment.create({ tenant: req.tenantId, entity: "task", entityId: task._id, project: m.project || null, from: null, to: assignee, reason: "Meeting action item", by: req.auth.uid });
    action.task = task._id;
    await m.save();
    emitPm("task_assigned", { tenantId: String(req.tenantId), actorId: req.auth.uid, actorName: req.auth.name, taskId: String(task._id), projectId: m.project ? String(m.project) : undefined });
    ok(res, { task: task._id, number: task.number }, 201);
  })
);

/* ---- training report: who attended which training ---- */
r.get(
  "/meetings-report/training",
  pmRight("meetings", "view"),
  asyncHandler(async (req: any, res: any) => {
    const types = (await PmMaster.find({ tenant: req.tenantId, type: "meeting_type" }).lean()).filter((t: any) => t.flags?.isTraining).map((t) => t._id);
    const and: any[] = [{ tenant: req.tenantId, status: "scheduled", type: { $in: types } }, await visibleMeetings(req)];
    if (DATE.test(String(req.query.from))) and.push({ date: { $gte: req.query.from } });
    if (DATE.test(String(req.query.to))) and.push({ date: { $lte: req.query.to } });
    const rows = await PmMeeting.find({ $and: and }).sort({ date: -1 }).limit(300).select("title date from to attendees type project").populate("type", "name color").populate("project", "name").lean();
    ok(res, rows.map((m: any) => ({
      _id: m._id, title: m.title, date: m.date, time: `${m.from} – ${m.to}`, type: m.type, project: m.project?.name || "",
      invited: m.attendees.length, attended: m.attendees.filter((a: any) => a.attended).length,
      people: m.attendees.map((a: any) => ({ name: a.name, isClient: a.isClient, attended: a.attended, response: a.response })),
    })));
  })
);

export default r;
