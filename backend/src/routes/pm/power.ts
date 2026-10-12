import { Router } from "express";
import { Types } from "mongoose";
import { ok, asyncHandler, ApiError } from "../../utils/http";
import { User } from "../../models/User";
import { PmMaster } from "../../models/pm/Setup";
import { PmClient } from "../../models/pm/Client";
import { PmProject, PmTask, PmActivity, PmAssignment, nextNumber } from "../../models/pm/Project";
import { PmDailyPlan } from "../../models/pm/DailyPlan";
import { PmMeeting } from "../../models/pm/Meeting";
import { PmTicket } from "../../models/pm/Portal";
import { PmRecurring, PmTimeLog } from "../../models/pm/Extras";
import { getPmSettings } from "../../services/pm/masters";
import { emitPm } from "../../services/pm/events";
import { everyMinute } from "../../services/pm/messages";
import { logActivity, statusFlags, statusWith, visibleProjectFilter, visibleTaskFilter } from "../../services/pm/projects";
import { changeTaskStatus } from "../../services/pm/taskStatus";
import { anyRight, canSeeEmployee, getVisibleEmployeeIds, pmRight, visibleFilter } from "../../services/pm/visibility";
import { PM_MODULES } from "../../models/User";
import { findTask } from "./tasks";

/** Power features: global search, bulk actions, watchers, time logging, recurring tasks, activity feed. */
const r = Router();
const anyPm = anyRight(...PM_MODULES.map((m) => [m, "view"] as [string, "view"]));
const has = (req: any, module: string, action = "view") => !!(req.perms || []).find((p: any) => p.module === module)?.[action];
const rx = (q: any) => new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(6, "0");

/* ---- global search (header, Ctrl+K): only what the user may see ---- */
r.get(
  "/search",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return ok(res, []);
    const re = rx(q);
    const out: any[] = [];
    const visible = await getVisibleEmployeeIds(req);
    const jobs: Promise<any>[] = [];
    if (has(req, "pm_projects")) jobs.push(PmProject.find({ tenant: req.tenantId, ...(await visibleProjectFilter(req)), $and: [{ $or: [{ name: re }, { code: re }] }] }).limit(6).select("name code").lean().then((rows) => rows.forEach((p: any) => out.push({ kind: "Project", title: p.name, sub: p.code, link: `/modules/projects/p/${p._id}` }))));
    if (has(req, "pm_tasks") || has(req, "pm_my_tasks")) {
      const own = has(req, "pm_tasks") ? await visibleTaskFilter(req) : { assignee: new Types.ObjectId(String(req.auth.uid)) };
      jobs.push(PmTask.find({ $and: [{ tenant: req.tenantId }, own, { $or: [{ title: re }, { number: re }] }] }).limit(8).select("title number project").populate("project", "name").lean().then((rows) => rows.forEach((t: any) => out.push({ kind: "Task", title: t.title, sub: `${t.number}${t.project ? ` · ${t.project.name}` : ""}`, link: t.project ? `/modules/projects/p/${t.project._id}?tab=Tasks&task=${t._id}` : `/modules/projects/my-work?task=${t._id}` }))));
    }
    if (has(req, "pm_clients")) jobs.push(PmClient.find({ tenant: req.tenantId, ...(await visibleFilter(req, "accountManager")), $or: [{ name: re }, { code: re }] }).limit(5).select("name code city").lean().then((rows) => rows.forEach((c: any) => out.push({ kind: "Client", title: c.name, sub: [c.code, c.city].filter(Boolean).join(" · "), link: "/modules/projects/clients" }))));
    if (has(req, "pm_tickets")) jobs.push(PmTicket.find({ tenant: req.tenantId, mergedInto: null, ...(visible === "all" ? {} : { $or: [{ assignee: { $in: visible } }, { assignee: null }] }), $and: [{ $or: [{ subject: re }, { number: re }] }] }).limit(5).select("subject number").lean().then((rows) => rows.forEach((t: any) => out.push({ kind: "Ticket", title: t.subject, sub: t.number, link: `/modules/projects/tickets?open=${t._id}` }))));
    if (has(req, "pm_team")) jobs.push(User.find({ tenant: req.tenantId, pmClient: null, name: re, ...(visible === "all" ? {} : { _id: { $in: visible } }) }).limit(5).select("name email").lean().then((rows) => rows.forEach((u: any) => out.push({ kind: "Employee", title: u.name, sub: u.email, link: `/modules/projects/people/${u._id}` }))));
    if (has(req, "pm_meetings")) jobs.push(PmMeeting.find({ tenant: req.tenantId, title: re, ...(visible === "all" ? {} : { $or: [{ organizer: { $in: visible } }, { "attendees.user": { $in: visible } }] }) }).sort({ date: -1 }).limit(5).select("title date").lean().then((rows) => rows.forEach((m: any) => out.push({ kind: "Meeting", title: m.title, sub: m.date.split("-").reverse().join("-"), link: `/modules/projects/meetings?open=${m._id}` }))));
    await Promise.all(jobs);
    ok(res, out);
  })
);

/* ---- bulk actions on tasks: status, due date, priority, labels ---- */
r.post(
  "/tasks/bulk",
  pmRight("tasks", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const b = req.body || {};
    const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x: any) => Types.ObjectId.isValid(String(x))).slice(0, 300);
    if (!ids.length) throw new ApiError(400, "Select the tasks");
    const tasks = await PmTask.find({ $and: [{ tenant: req.tenantId, _id: { $in: ids } }, await visibleTaskFilter(req)] });
    const failed: { title: string; error: string }[] = [];
    let changed = 0;
    const priority = b.priority && (await PmMaster.exists({ _id: b.priority, tenant: req.tenantId, type: "priority" })) ? b.priority : null;
    const s = await getPmSettings(req.tenantId);
    const due = DATE.test(String(b.due || "")) ? new Date(`${b.due}T${s.workEnd}:00+05:30`) : null;
    const labels: string[] = (Array.isArray(b.labels) ? b.labels : []).map((x: any) => String(x).trim()).filter(Boolean);
    for (const task of tasks) {
      try {
        if (priority) task.priority = priority;
        if (due && !task.isCompleted) { task.due = due; task.dueLocked = true; }
        if (labels.length) task.labels = [...new Set([...(task.labels || []), ...labels])].slice(0, 10);
        if (priority || due || labels.length) await task.save();
        if (b.status) await changeTaskStatus(req.tenantId, task, b.status, { id: req.auth.uid, name: req.auth.name });
        changed++;
      } catch (e: any) {
        failed.push({ title: task.title, error: e?.message || "Could not change" });
      }
    }
    ok(res, { changed, failed });
  })
);

/* ---- labels in use ---- */
r.get(
  "/labels",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    ok(res, ((await PmTask.distinct("labels", { tenant: req.tenantId })) as string[]).filter(Boolean).sort());
  })
);

/* ---- watch a task: be told about its changes ---- */
r.post(
  "/tasks/:id/watch",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    await PmTask.updateOne({ _id: task._id }, req.body?.on === false ? { $pull: { watchers: req.auth.uid } } : { $addToSet: { watchers: req.auth.uid } });
    ok(res, { watching: req.body?.on !== false });
  })
);

/* ---- a checklist item that became big turns into its own task ---- */
r.post(
  "/tasks/:id/checklist/:itemId/to-task",
  anyRight(["pm_tasks", "create"], ["pm_my_tasks", "create"]),
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    const item: any = task.checklist.find((c: any) => String(c._id) === String(req.params.itemId));
    if (!item) throw new ApiError(404, "Checklist item not found");
    const first = (await statusWith(req.tenantId, "task_status", "isInitial")) || (await statusWith(req.tenantId, "task_status", null));
    const made = await PmTask.create({
      tenant: req.tenantId, number: `T-${pad(await nextNumber(req.tenantId, "task"))}`, title: item.text, kind: "adhoc",
      project: task.project, projectModule: task.projectModule, client: task.client, product: task.product, priority: task.priority, assignee: task.assignee || req.auth.uid,
      status: first?._id || null, ...statusFlags(first), tatValue: 1, tatUnit: "working_days", order: (task.order || 0) + 0.5,
      plannedStart: new Date(), plannedDue: task.due || new Date(Date.now() + 86_400_000), start: new Date(), due: task.due || new Date(Date.now() + 86_400_000),
      clientVisible: false, description: `From the checklist of ${task.number} ${task.title}`, createdBy: req.auth.uid,
    });
    task.checklist = task.checklist.filter((c: any) => String(c._id) !== String(item._id)) as any;
    await task.save();
    await PmAssignment.create({ tenant: req.tenantId, entity: "task", entityId: made._id, project: task.project || null, from: null, to: made.assignee, reason: "From checklist", by: req.auth.uid });
    await logActivity({ tenant: req.tenantId, project: task.project, task: task._id, kind: "checklist", text: `Checklist item became task ${made.number}: ${item.text}`, by: req.auth.uid, byName: req.auth.name });
    emitPm("task_assigned", { tenantId: String(req.tenantId), actorId: req.auth.uid, actorName: req.auth.name, taskId: String(made._id), projectId: task.project ? String(task.project) : undefined });
    ok(res, { task: made._id, number: made.number }, 201);
  })
);

/* ---- time logging ---- */
r.get(
  "/tasks/:id/time",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    const rows = await PmTimeLog.find({ tenant: req.tenantId, task: task._id }).sort({ date: -1, createdAt: -1 }).populate("user", "name photo").lean();
    ok(res, { logs: rows, total: rows.reduce((n, x) => n + x.hours, 0), enabled: (await getPmSettings(req.tenantId)).timeLogging });
  })
);
r.post(
  "/tasks/:id/time",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    if (!(await getPmSettings(req.tenantId)).timeLogging) throw new ApiError(400, "Time logging is switched off");
    const task = await findTask(req, req.params.id);
    const hours = Number(req.body?.hours);
    if (!(hours > 0 && hours <= 24)) throw new ApiError(400, "Hours must be between 0 and 24");
    const date = DATE.test(String(req.body?.date || "")) ? req.body.date : new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    ok(res, await PmTimeLog.create({ tenant: req.tenantId, task: task._id, project: task.project || null, user: req.auth.uid, date, hours, note: String(req.body?.note || "").trim() }), 201);
  })
);
r.delete(
  "/time/:id",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    const done = await PmTimeLog.deleteOne({ _id: req.params.id, tenant: req.tenantId, user: req.auth.uid });
    if (!done.deletedCount) throw new ApiError(404, "You can only delete your own time entries");
    ok(res, { deleted: true });
  })
);
// Timesheet: hours per person per day.
r.get(
  "/timesheet",
  anyRight(["pm_reports", "view"], ["pm_my_tasks", "view"], ["pm_team_calendar", "view"]),
  asyncHandler(async (req: any, res: any) => {
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (!DATE.test(from) || !DATE.test(to) || from > to) throw new ApiError(400, "Choose a date range");
    const visible = await getVisibleEmployeeIds(req);
    const mineOnly = !has(req, "pm_reports") && !has(req, "pm_team_calendar");
    const filter: any = { tenant: req.tenantId, date: { $gte: from, $lte: to } };
    if (mineOnly) filter.user = req.auth.uid;
    else if (visible !== "all") filter.user = { $in: visible };
    if (req.query.employee && Types.ObjectId.isValid(String(req.query.employee)) && !mineOnly) filter.user = visible === "all" || visible.includes(String(req.query.employee)) ? req.query.employee : req.auth.uid;
    const rows: any[] = await PmTimeLog.find(filter).sort({ date: 1 }).populate("user", "name photo").populate("task", "title number").populate("project", "name").lean();
    ok(res, rows);
  })
);

/* ---- how loaded is a person? (shown before assigning) ---- */
r.get(
  "/people/:id/load",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    const id = String(req.params.id);
    if (!Types.ObjectId.isValid(id) || !(await User.exists({ _id: id, tenant: req.tenantId }))) throw new ApiError(404, "Employee not found");
    const now = new Date();
    const date = DATE.test(String(req.query.date || "")) ? String(req.query.date) : new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    const [open, overdue, plan, s] = await Promise.all([
      PmTask.countDocuments({ tenant: req.tenantId, assignee: id, isCompleted: false }),
      PmTask.countDocuments({ tenant: req.tenantId, assignee: id, isCompleted: false, isPaused: false, due: { $lt: now } }),
      PmDailyPlan.findOne({ tenant: req.tenantId, employee: id, date }).select("entries.hours").lean(),
      getPmSettings(req.tenantId),
    ]);
    ok(res, { open, overdue, plannedHours: (plan?.entries || []).reduce((n: number, e: any) => n + (e.hours || 0), 0), date, limit: s.workloadThreshold, overloaded: open >= s.workloadThreshold });
  })
);

/* ---- activity feed: mine, or everything I may see ---- */
r.get(
  "/activity",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    const limit = Math.min(200, parseInt(String(req.query.limit || "60"), 10) || 60);
    const filter: any = { tenant: req.tenantId };
    if (req.query.mine === "1" || !has(req, "pm_projects")) filter.by = req.auth.uid;
    else {
      const projects = await PmProject.distinct("_id", { tenant: req.tenantId, ...(await visibleProjectFilter(req)) });
      filter.$or = [{ project: { $in: projects } }, { by: req.auth.uid }];
    }
    ok(res, await PmActivity.find(filter).sort({ createdAt: -1 }).limit(limit).populate("task", "title number").populate("project", "name").lean());
  })
);

/* ---- recurring tasks ---- */
const stepDate = (date: string, freq: string, every: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  if (freq === "daily") d.setUTCDate(d.getUTCDate() + every);
  else if (freq === "weekly") d.setUTCDate(d.getUTCDate() + 7 * every);
  else d.setUTCMonth(d.getUTCMonth() + every);
  return d.toISOString().slice(0, 10);
};
async function recurringBody(req: any, b: any, existing?: any) {
  const out: any = {};
  const hasKey = (k: string) => b[k] !== undefined;
  if (hasKey("title") || !existing) {
    out.title = String(b.title || "").trim();
    if (!out.title) throw new ApiError(400, "Enter the task title");
  }
  if (hasKey("assignee") || !existing) {
    const id = b.assignee?._id || b.assignee;
    if (!id || !(await User.exists({ _id: id, tenant: req.tenantId }))) throw new ApiError(400, "Choose the assignee");
    if (!(await canSeeEmployee(req, id))) throw new ApiError(403, "You cannot assign to this person");
    out.assignee = id;
  }
  if (hasKey("project")) out.project = b.project && (await PmProject.exists({ _id: b.project, tenant: req.tenantId })) ? b.project : null;
  if (hasKey("priority")) out.priority = b.priority && (await PmMaster.exists({ _id: b.priority, tenant: req.tenantId, type: "priority" })) ? b.priority : null;
  if (hasKey("description")) out.description = String(b.description || "");
  if (hasKey("checklist")) out.checklist = (Array.isArray(b.checklist) ? b.checklist : []).map((x: any) => String(x).trim()).filter(Boolean).slice(0, 30);
  if (hasKey("freq")) out.freq = ["daily", "weekly", "monthly"].includes(b.freq) ? b.freq : "weekly";
  if (hasKey("every")) out.every = Math.min(30, Math.max(1, Number(b.every) || 1));
  if (hasKey("dueInDays")) out.dueInDays = Math.min(90, Math.max(0, Number(b.dueInDays) || 0));
  if (hasKey("next") || !existing) {
    if (!DATE.test(String(b.next || ""))) throw new ApiError(400, "Choose the first date");
    out.next = b.next;
  }
  if (hasKey("until")) out.until = DATE.test(String(b.until || "")) ? b.until : "";
  if (hasKey("active")) out.active = !!b.active;
  return out;
}
r.get(
  "/recurring",
  pmRight("tasks", "view"),
  asyncHandler(async (req: any, res: any) => {
    ok(res, await PmRecurring.find({ tenant: req.tenantId, ...(await visibleFilter(req, "assignee")) }).sort({ active: -1, next: 1 }).populate("assignee", "name photo").populate("project", "name").populate("priority", "name color").lean());
  })
);
r.post(
  "/recurring",
  pmRight("tasks", "create"),
  asyncHandler(async (req: any, res: any) => {
    ok(res, await PmRecurring.create({ ...(await recurringBody(req, req.body || {})), tenant: req.tenantId, createdBy: req.auth.uid }), 201);
  })
);
r.patch(
  "/recurring/:id",
  pmRight("tasks", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmRecurring.findOne({ _id: req.params.id, tenant: req.tenantId, ...(await visibleFilter(req, "assignee")) });
    if (!doc) throw new ApiError(404, "Recurring task not found");
    Object.assign(doc, await recurringBody(req, req.body || {}, doc));
    await doc.save();
    ok(res, doc);
  })
);
r.delete(
  "/recurring/:id",
  pmRight("tasks", "del"),
  asyncHandler(async (req: any, res: any) => {
    const done = await PmRecurring.deleteOne({ _id: req.params.id, tenant: req.tenantId, ...(await visibleFilter(req, "assignee")) });
    if (!done.deletedCount) throw new ApiError(404, "Recurring task not found");
    ok(res, { deleted: true });
  })
);

// Each due recurring task makes its next task. The date is claimed first, so it is made once.
everyMinute(async () => {
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const due: any[] = await PmRecurring.find({ active: true, next: { $lte: today } }).lean();
  for (const rec of due) {
    const next = stepDate(rec.next, rec.freq, rec.every);
    const ended = !!rec.until && next > rec.until;
    const got = await PmRecurring.updateOne({ _id: rec._id, next: rec.next }, { $set: { next, active: !ended }, $inc: { made: 1 } });
    if (!got.modifiedCount) continue;
    const s = await getPmSettings(rec.tenant);
    const first = (await statusWith(rec.tenant, "task_status", "isInitial")) || (await statusWith(rec.tenant, "task_status", null));
    const project: any = rec.project ? await PmProject.findById(rec.project).select("client product").lean() : null;
    const dueDate = new Date(new Date(`${rec.next}T${s.workEnd}:00+05:30`).getTime() + rec.dueInDays * 86_400_000);
    const task = await PmTask.create({
      tenant: rec.tenant, number: `T-${pad(await nextNumber(rec.tenant, "task"))}`, title: rec.title, kind: "adhoc", project: rec.project || null, client: project?.client || null, product: project?.product || null,
      priority: rec.priority || null, assignee: rec.assignee, status: first?._id || null, ...statusFlags(first), tatValue: Math.max(1, rec.dueInDays), tatUnit: "days",
      plannedStart: new Date(), plannedDue: dueDate, start: new Date(), due: dueDate, dueLocked: true, clientVisible: false, description: rec.description,
      checklist: (rec.checklist || []).map((text: string, i: number) => ({ text, order: i + 1, mandatory: false, done: false })), labels: ["recurring"], createdBy: rec.createdBy,
    });
    emitPm("task_assigned", { tenantId: String(rec.tenant), taskId: String(task._id), projectId: rec.project ? String(rec.project) : undefined, actorName: "Recurring task" });
  }
});

export default r;
