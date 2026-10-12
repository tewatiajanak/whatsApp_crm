import { Router } from "express";
import { Types } from "mongoose";
import { ok, asyncHandler, ApiError } from "../../utils/http";
import { User } from "../../models/User";
import { Team } from "../../models/Team";
import { PmMaster, PmHoliday } from "../../models/pm/Setup";
import { PmProject, PmTask } from "../../models/pm/Project";
import { PmDailyPlan } from "../../models/pm/DailyPlan";
import { PmMeeting } from "../../models/pm/Meeting";
import { canSeeEmployee, getVisibleEmployeeIds, pmRight } from "../../services/pm/visibility";

/** Daily work plan (employee) and the team calendar (managers). */
const r = Router();
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const POPULATE = [
  { path: "entries.project", select: "name code" },
  { path: "entries.task", select: "title number status isCompleted", populate: { path: "status", select: "name color" } },
  { path: "entries.location", select: "name color" },
];

const range = (req: any) => {
  const from = String(req.query.from || "");
  const to = String(req.query.to || "");
  if (!DATE.test(from) || !DATE.test(to) || from > to) throw new ApiError(400, "Choose a date range");
  if ((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 > 100) throw new ApiError(400, "Choose at most 100 days");
  return { from, to };
};
/** Every date from … to, inclusive. */
const eachDay = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d = new Date(d.getTime() + 86_400_000)) out.push(d.toISOString().slice(0, 10));
  return out;
};

async function cleanEntries(req: any, list: any) {
  const entries = Array.isArray(list) ? list : [];
  if (!entries.length) throw new ApiError(400, "Add at least one entry");
  if (entries.length > 20) throw new ApiError(400, "At most 20 entries a day");
  const me = req.auth.uid;
  const locations = new Set((await PmMaster.find({ tenant: req.tenantId, type: "work_location" }).select("_id").lean()).map((x) => String(x._id)));
  const out: any[] = [];
  for (const [i, e] of entries.entries()) {
    const n = `Entry ${i + 1}`;
    const taskId = e?.task?._id || e?.task || null;
    let projectId = e?.project?._id || e?.project || null;
    if (taskId) {
      const task: any = await PmTask.findOne({ _id: taskId, tenant: req.tenantId, assignee: me }).select("project").lean();
      if (!task) throw new ApiError(400, `${n}: choose one of your tasks`);
      projectId = task.project || projectId;
    }
    if (projectId && !(await PmProject.exists({ _id: projectId, tenant: req.tenantId }))) throw new ApiError(400, `${n}: choose a valid project`);
    const description = String(e?.description || "").trim();
    if (!taskId && !description) throw new ApiError(400, `${n}: choose a task or describe the work`);
    const location = e?.location?._id || e?.location || null;
    if (!location || !locations.has(String(location))) throw new ApiError(400, `${n}: choose the work location`);
    const from = TIME.test(String(e?.from || "")) ? e.from : "";
    const to = TIME.test(String(e?.to || "")) ? e.to : "";
    if (from && to && from >= to) throw new ApiError(400, `${n}: the end time must be after the start time`);
    // the hours follow the from–to times; a client that sends no times may still send hours
    const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const hours = from && to ? Math.round(((mins(to) - mins(from)) / 60) * 100) / 100 : Number(e?.hours) || 0;
    if (hours < 0 || hours > 24) throw new ApiError(400, `${n}: hours must be between 0 and 24`);
    out.push({
      ...(e?._id && Types.ObjectId.isValid(String(e._id)) ? { _id: e._id } : {}),
      project: projectId, task: taskId, description, location, site: String(e?.site || "").trim(), hours, from, to,
      result: ["done", "partial", "not_done"].includes(e?.result) ? e.result : "", remarks: String(e?.remarks || ""),
    });
  }
  return out;
}

/* ---- plans: mine, or — as far as the role's data visibility goes — of one employee (?employee=id) or of everyone (?employee=all) ---- */
r.get(
  "/plans",
  pmRight("daily_plan", "view"),
  asyncHandler(async (req: any, res: any) => {
    const { from, to } = range(req);
    const who = String(req.query.employee || "");
    const filter: any = { tenant: req.tenantId, employee: req.auth.uid, date: { $gte: from, $lte: to } };
    if (who === "all") {
      const visible = await getVisibleEmployeeIds(req);
      if (visible === "all") delete filter.employee;
      else filter.employee = { $in: visible };
    } else if (who) {
      if (!Types.ObjectId.isValid(who) || !(await canSeeEmployee(req, who))) throw new ApiError(403, "Forbidden");
      filter.employee = who;
    }
    const plans: any[] = await PmDailyPlan.find(filter).sort({ date: 1 }).populate([...POPULATE, { path: "employee", select: "name photo" }]).lean();
    ok(res, plans.filter((p) => p.employee).map((p) => ({ ...p, mine: String(p.employee._id) === String(req.auth.uid) })));
  })
);

// Plan one or many dates at once. A date that already has a plan is replaced.
r.put(
  "/plans",
  pmRight("daily_plan", "create"),
  asyncHandler(async (req: any, res: any) => {
    const dates = ([...new Set((Array.isArray(req.body?.dates) ? req.body.dates : []).map(String))] as string[]).filter((d) => DATE.test(d)).sort();
    if (!dates.length) throw new ApiError(400, "Choose the date");
    if (dates.length > 62) throw new ApiError(400, "Plan at most 62 days at a time");
    const entries = await cleanEntries(req, req.body?.entries);
    for (const date of dates) {
      // a fresh copy per day: each day gets its own entry ids and its own end-of-day update
      const copy = entries.map(({ _id, ...e }) => (dates.length === 1 && _id ? { _id, ...e } : { ...e, result: dates.length === 1 ? e.result : "", remarks: dates.length === 1 ? e.remarks : "" }));
      await PmDailyPlan.findOneAndUpdate({ tenant: req.tenantId, employee: req.auth.uid, date }, { $set: { entries: copy } }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }
    ok(res, { saved: dates.length });
  })
);

// End-of-day update of one entry.
r.patch(
  "/plans/:id/entries/:entryId",
  pmRight("daily_plan", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const plan = await PmDailyPlan.findOne({ _id: req.params.id, tenant: req.tenantId, employee: req.auth.uid });
    if (!plan) throw new ApiError(404, "Plan not found");
    const entry: any = plan.entries.find((e: any) => String(e._id) === String(req.params.entryId));
    if (!entry) throw new ApiError(404, "Entry not found");
    if (req.body?.result !== undefined) entry.result = ["done", "partial", "not_done"].includes(req.body.result) ? req.body.result : "";
    if (req.body?.remarks !== undefined) entry.remarks = String(req.body.remarks || "");
    await plan.save();
    ok(res, entry);
  })
);

// Copy the plan of one day to another (e.g. yesterday → today).
r.post(
  "/plans/copy",
  pmRight("daily_plan", "create"),
  asyncHandler(async (req: any, res: any) => {
    const { from, to } = req.body || {};
    if (!DATE.test(String(from)) || !DATE.test(String(to))) throw new ApiError(400, "Choose the dates");
    const source = await PmDailyPlan.findOne({ tenant: req.tenantId, employee: req.auth.uid, date: from }).lean();
    if (!source?.entries?.length) throw new ApiError(404, "No plan on that day");
    const entries = source.entries.map(({ _id, result, remarks, ...e }: any) => ({ ...e, result: "", remarks: "" }));
    await PmDailyPlan.findOneAndUpdate({ tenant: req.tenantId, employee: req.auth.uid, date: to }, { $set: { entries } }, { upsert: true, setDefaultsOnInsert: true });
    ok(res, { copied: entries.length });
  })
);

r.delete(
  "/plans/:id",
  pmRight("daily_plan", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const done = await PmDailyPlan.deleteOne({ _id: req.params.id, tenant: req.tenantId, employee: req.auth.uid });
    if (!done.deletedCount) throw new ApiError(404, "Plan not found");
    ok(res, { deleted: true });
  })
);

/* ---- team calendar: plans + task due dates + holidays, for the people this user may see ---- */
r.get(
  "/team-calendar",
  pmRight("team_calendar", "view"),
  asyncHandler(async (req: any, res: any) => {
    const { from, to } = range(req);
    const q = req.query;
    const visible = await getVisibleEmployeeIds(req);
    const userFilter: any = { tenant: req.tenantId, status: "Active" };
    if (visible !== "all") userFilter._id = { $in: visible };
    let people: any[] = await User.find(userFilter).select("name photo designation category").populate("designation", "name").populate("category", "kind").sort({ name: 1 }).lean();
    people = people.filter((u) => u.category?.kind !== "client");

    if (q.team && Types.ObjectId.isValid(String(q.team))) {
      const team: any = await Team.findOne({ _id: q.team, tenant: req.tenantId }).lean();
      const members = new Set<string>([String(team?.manager || ""), ...(team?.members || []).map((m: any) => String(m.user))]);
      people = people.filter((u) => members.has(String(u._id)));
    }
    if (q.employee && Types.ObjectId.isValid(String(q.employee))) people = people.filter((u) => String(u._id) === String(q.employee));
    const ids = people.map((u) => u._id);

    const start = new Date(`${from}T00:00:00+05:30`);
    const end = new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86_400_000);
    const taskFilter: any = { tenant: req.tenantId, assignee: { $in: ids }, due: { $gte: start, $lt: end } };
    if (q.project && Types.ObjectId.isValid(String(q.project))) taskFilter.project = q.project;
    const [plans, tasks, holidays] = await Promise.all([
      PmDailyPlan.find({ tenant: req.tenantId, employee: { $in: ids }, date: { $gte: from, $lte: to } }).populate(POPULATE).lean(),
      PmTask.find(taskFilter).select("title number assignee due isCompleted isPaused project status").populate("status", "name color").populate("project", "name code").lean(),
      PmHoliday.find({ tenant: req.tenantId, date: { $gte: from, $lte: to } }).lean(),
    ]);

    const project = q.project ? String(q.project) : "";
    const location = q.location ? String(q.location) : "";
    const cells: Record<string, Record<string, any>> = {};
    const cell = (emp: any, date: string) => {
      const e = String(emp);
      cells[e] = cells[e] || {};
      cells[e][date] = cells[e][date] || { plan: null, entries: [], hours: 0, tasks: [], meetings: [] };
      return cells[e][date];
    };
    for (const p of plans as any[]) {
      const entries = p.entries.filter((e: any) => (!project || String(e.project?._id || "") === project) && (!location || String(e.location?._id || "") === location));
      if (!entries.length) continue;
      const c = cell(p.employee, p.date);
      c.plan = p._id;
      c.entries = entries;
      c.hours = entries.reduce((n: number, e: any) => n + (e.hours || 0), 0);
    }
    const now = new Date();
    if (!location) {
      for (const t of tasks as any[]) {
        const date = new Date(new Date(t.due).getTime() + 330 * 60_000).toISOString().slice(0, 10);
        cell(t.assignee, date).tasks.push({ _id: t._id, title: t.title, number: t.number, project: t.project, status: t.status, isCompleted: t.isCompleted, overdue: !t.isCompleted && !t.isPaused && new Date(t.due) < now });
      }
    }
    if (!location) {
      const meetings: any[] = await PmMeeting.find({ tenant: req.tenantId, status: "scheduled", date: { $gte: from, $lte: to }, "attendees.user": { $in: ids }, ...(project ? { project } : {}) })
        .select("title date from to type attendees.user project").populate("type", "name color").lean();
      const shown = new Set(ids.map(String));
      for (const m of meetings) {
        for (const a of m.attendees) {
          if (a.user && shown.has(String(a.user))) cell(a.user, m.date).meetings.push({ _id: m._id, title: m.title, from: m.from, to: m.to, type: m.type });
        }
      }
    }
    // with a project or location filter, only the people who match are shown
    if (project || location) people = people.filter((u) => cells[String(u._id)]);

    // who is onsite today: entries of today whose location is not the last two masters … decided by name is not allowed,
    // so "onsite" is simply every plan entry of today grouped by location
    const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    const todayPlans = from <= today && today <= to ? (plans as any[]).filter((p) => p.date === today) : await PmDailyPlan.find({ tenant: req.tenantId, employee: { $in: ids }, date: today }).populate(POPULATE).lean();
    const byLocation: Record<string, any> = {};
    for (const p of todayPlans as any[]) {
      for (const e of p.entries) {
        if (!e.location) continue;
        const k = String(e.location._id);
        byLocation[k] = byLocation[k] || { location: e.location, people: [] };
        const who = people.find((u) => String(u._id) === String(p.employee));
        if (who && !byLocation[k].people.some((x: any) => x._id === String(who._id))) byLocation[k].people.push({ _id: String(who._id), name: who.name, photo: who.photo || "", site: e.site, project: e.project?.name || "" });
      }
    }

    ok(res, {
      days: eachDay(from, to),
      employees: people.map((u) => ({ _id: String(u._id), name: u.name, photo: u.photo || "", designation: u.designation?.name || "" })),
      cells,
      holidays,
      today: Object.values(byLocation),
    });
  })
);

export default r;
