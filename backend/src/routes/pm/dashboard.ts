import { Router } from "express";
import { Types } from "mongoose";
import { ok, asyncHandler, ApiError } from "../../utils/http";
import { User } from "../../models/User";
import { Team } from "../../models/Team";
import { PmMaster } from "../../models/pm/Setup";
import { PmProject, PmProjectModule, PmTask, PmActivity, PmAssignment } from "../../models/pm/Project";
import { PmDailyPlan } from "../../models/pm/DailyPlan";
import { PmMeeting } from "../../models/pm/Meeting";
import { PmSignoff, PmTicket, PmVerification } from "../../models/pm/Portal";
import { getPmSettings } from "../../services/pm/masters";
import { isOverdue, projectStats, visibleProjectFilter, visibleTaskFilter } from "../../services/pm/projects";
import { anyRight, canSeeEmployee, getVisibleEmployeeIds, pmRight } from "../../services/pm/visibility";
import { findProject } from "./projects";

/** Dashboards: management, project overview, person. Every number is calculated here and respects the visibility. */
const r = Router();
const DAY = 86_400_000;
const localDay = (d: Date) => new Date(new Date(d).getTime() + 330 * 60_000).toISOString().slice(0, 10);
const count = <T,>(list: T[], key: (x: T) => string) => {
  const m = new Map<string, number>();
  list.forEach((x) => m.set(key(x), (m.get(key(x)) || 0) + 1));
  return m;
};

/* ───────────── management dashboard ───────────── */
r.get(
  "/dashboard",
  pmRight("dashboard", "view"),
  asyncHandler(async (req: any, res: any) => {
    const q = req.query;
    const now = new Date();
    const today = localDay(now);
    const settings = await getPmSettings(req.tenantId);

    const projectFilter: any = { tenant: req.tenantId, ...(await visibleProjectFilter(req)) };
    for (const k of ["client", "product", "incharge"]) if (q[k] && Types.ObjectId.isValid(String(q[k]))) projectFilter[k] = q[k];
    let teamIds: string[] | null = null;
    if (q.team && Types.ObjectId.isValid(String(q.team))) {
      const team: any = await Team.findOne({ _id: q.team, tenant: req.tenantId }).lean();
      teamIds = team ? [String(team.manager), ...(team.members || []).map((m: any) => String(m.user))] : [];
    }

    const projects: any[] = await PmProject.find(projectFilter)
      .populate("client", "name").populate("status", "name color flags").populate("incharge", "name photo").lean();
    const stats = (await projectStats(req.tenantId, projects)).projects;
    const rows = projects.map((p) => ({ ...p, stats: stats.get(String(p._id))! }));
    const active = rows.filter((p) => !p.stats.schedule.startsWith("completed") && !p.status?.flags?.isCancelled);

    const taskAnd: any[] = [{ tenant: req.tenantId }, await visibleTaskFilter(req)];
    if (q.client || q.product || q.incharge) taskAnd.push({ $or: [{ project: { $in: projects.map((p) => p._id) } }] });
    if (teamIds) taskAnd.push({ assignee: { $in: teamIds.map((x) => new Types.ObjectId(x)) } });
    const tasks: any[] = await PmTask.find({ $and: taskAnd })
      .select("title number assignee project isCompleted isPaused isStarted isWaitingForClient due actualEnd status")
      .populate("assignee", "name photo").populate("project", "name").lean();
    const open = tasks.filter((t) => !t.isCompleted);
    const overdue = open.filter((t) => isOverdue(t, now));

    const visible = await getVisibleEmployeeIds(req);
    const peopleFilter = (field: string) => (visible === "all" ? {} : { [field]: { $in: visible.map((x) => new Types.ObjectId(x)) } });
    const projectIds = projects.map((p) => p._id);
    const [pendingVerifications, tickets, meetingsToday, plansToday, locations] = await Promise.all([
      PmVerification.find({ tenant: req.tenantId, status: "Pending", project: { $in: projectIds } }).select("task sentAt project").populate("task", "title").populate("project", "name").lean(),
      PmTicket.find({ tenant: req.tenantId, mergedInto: null, ...(visible === "all" ? {} : { $or: [{ assignee: { $in: visible } }, { assignee: null }] }) }).select("status isClosed client").populate("status", "name color").populate("client", "name").lean(),
      PmMeeting.countDocuments({ tenant: req.tenantId, status: "scheduled", date: today, ...(visible === "all" ? {} : { $or: [{ organizer: { $in: visible } }, { "attendees.user": { $in: visible } }] }) }),
      PmDailyPlan.find({ tenant: req.tenantId, date: today, ...peopleFilter("employee") }).select("employee entries.location").lean(),
      PmMaster.find({ tenant: req.tenantId, type: "work_location" }).lean(),
    ]);
    const onsite = new Set(locations.filter((l: any) => l.flags?.isOnsite).map((l) => String(l._id)));
    const onsiteToday = plansToday.filter((p: any) => p.entries.some((e: any) => onsite.has(String(e.location)))).length;

    // tasks completed per week, last 8 weeks
    const weeks: { week: string; done: number }[] = [];
    const monday = new Date(now.getTime() - ((new Date(now.getTime() + 330 * 60_000).getUTCDay() + 6) % 7) * DAY);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(`${localDay(new Date(monday.getTime() - i * 7 * DAY))}T00:00:00+05:30`);
      const end = new Date(start.getTime() + 7 * DAY);
      weeks.push({ week: localDay(start).slice(5).split("-").reverse().join("/"), done: tasks.filter((t) => t.isCompleted && t.actualEnd && t.actualEnd >= start && t.actualEnd < end).length });
    }

    // workload: open tasks and the hours planned this week, per person
    const weekStart = localDay(monday);
    const weekEnd = localDay(new Date(monday.getTime() + 6 * DAY));
    const plans = await PmDailyPlan.find({ tenant: req.tenantId, date: { $gte: weekStart, $lte: weekEnd }, ...peopleFilter("employee") }).select("employee entries.hours").lean();
    const hours = new Map<string, number>();
    plans.forEach((p: any) => hours.set(String(p.employee), (hours.get(String(p.employee)) || 0) + p.entries.reduce((n: number, e: any) => n + (e.hours || 0), 0)));
    const people = new Map<string, any>();
    open.forEach((t) => t.assignee && people.set(String(t.assignee._id), t.assignee));
    const openBy = count(open.filter((t) => t.assignee), (t) => String(t.assignee._id));
    const overdueBy = count(overdue.filter((t) => t.assignee), (t) => String(t.assignee._id));
    const workload = [...people.values()]
      .map((u) => ({ _id: String(u._id), name: u.name, photo: u.photo || "", open: openBy.get(String(u._id)) || 0, overdue: overdueBy.get(String(u._id)) || 0, hours: hours.get(String(u._id)) || 0, overloaded: (openBy.get(String(u._id)) || 0) > settings.workloadThreshold }))
      .sort((a, b) => b.open - a.open);

    const statusCount = (list: any[], of: (x: any) => any) => {
      const m = new Map<string, { name: string; color: string; value: number; id: string }>();
      list.forEach((x) => {
        const s = of(x);
        const k = String(s?._id || "");
        if (!m.has(k)) m.set(k, { id: k, name: s?.name || "—", color: s?.color || "#64748b", value: 0 });
        m.get(k)!.value++;
      });
      return [...m.values()];
    };

    ok(res, {
      tiles: {
        active: active.length,
        onTrack: active.filter((p) => p.stats.schedule === "on_track").length,
        delayed: active.filter((p) => p.stats.schedule === "delayed").length,
        ahead: active.filter((p) => p.stats.schedule === "ahead").length,
        overdueTasks: overdue.length,
        waiting: open.filter((t) => t.isWaitingForClient).length,
        pendingVerifications: pendingVerifications.length,
        openTickets: tickets.filter((t: any) => !t.isClosed).length,
        meetingsToday,
        onsiteToday,
      },
      bySchedule: [
        { key: "on_track", name: "On Track", color: "#16a34a", value: rows.filter((p) => p.stats.schedule === "on_track").length },
        { key: "ahead", name: "Ahead", color: "#2563eb", value: rows.filter((p) => p.stats.schedule === "ahead").length },
        { key: "delayed", name: "Delayed", color: "#dc2626", value: rows.filter((p) => p.stats.schedule === "delayed").length },
        { key: "completed", name: "Completed", color: "#64748b", value: rows.filter((p) => p.stats.schedule.startsWith("completed")).length },
      ].filter((x) => x.value),
      byStatus: statusCount(rows, (p) => p.status),
      overdueByPerson: workload.filter((w) => w.overdue).sort((a, b) => b.overdue - a.overdue).slice(0, 10).map((w) => ({ _id: w._id, name: w.name, value: w.overdue })),
      completedPerWeek: weeks,
      progress: active.sort((a, b) => b.stats.delayDays - a.stats.delayDays).slice(0, 15).map((p) => ({ _id: p._id, name: p.name, progress: p.stats.progress, planned: p.stats.planned, schedule: p.stats.schedule, delayDays: p.stats.delayDays })),
      workload: workload.slice(0, 15),
      ticketsByStatus: statusCount(tickets.filter((t: any) => !t.isClosed), (t) => t.status),
      delayed: active.filter((p) => p.stats.schedule === "delayed").sort((a, b) => b.stats.delayDays - a.stats.delayDays).slice(0, 8)
        .map((p) => ({ _id: p._id, name: p.name, client: p.client?.name || "", delayDays: p.stats.delayDays, overdue: p.stats.overdue, incharge: p.incharge?.name || "" })),
      dueSoon: open.filter((t) => t.due && t.due >= now && t.due.getTime() < now.getTime() + 3 * DAY).sort((a, b) => a.due - b.due).slice(0, 10)
        .map((t) => ({ _id: t._id, title: t.title, due: t.due, assignee: t.assignee?.name || "", project: t.project?.name || "" })),
      verifications: pendingVerifications.sort((a: any, b: any) => a.sentAt - b.sentAt).slice(0, 8)
        .map((v: any) => ({ _id: v._id, task: v.task?.title || "", taskId: v.task?._id, project: v.project?.name || "", projectId: v.project?._id, days: Math.floor((now.getTime() - new Date(v.sentAt).getTime()) / DAY) })),
    });
  })
);

/* ───────────── project overview ───────────── */
r.get(
  "/projects/:id/overview",
  pmRight("projects", "view"),
  asyncHandler(async (req: any, res: any) => {
    const project = await findProject(req, req.params.id);
    const now = new Date();
    const [tasks, modules, activity, verifications, signoffs]: any[] = await Promise.all([
      PmTask.find({ tenant: req.tenantId, project: project._id }).select("title number assignee status projectModule isCompleted isPaused isStarted isWaitingForClient due plannedDue start actualEnd dependsOn milestone").populate("status", "name color").populate("assignee", "name photo").lean(),
      PmProjectModule.find({ tenant: req.tenantId, project: project._id }).sort({ order: 1 }).select("name signedOffAt").lean(),
      PmActivity.find({ tenant: req.tenantId, project: project._id }).sort({ createdAt: -1 }).limit(8).populate("task", "title").lean(),
      PmVerification.find({ tenant: req.tenantId, project: project._id }).select("status").lean(),
      PmSignoff.find({ tenant: req.tenantId, project: project._id }).select("status title").lean(),
    ]);

    // S-curve: % planned to be complete vs % actually complete, week by week
    const first = project.startDate.getTime();
    const last = Math.max(now.getTime(), ...tasks.map((t: any) => new Date(t.plannedDue || t.due || now).getTime()));
    const step = Math.max(DAY, Math.ceil((last - first) / DAY / 16) * DAY);
    const curve: any[] = [];
    for (let t = first; t <= last + step; t += step) {
      const at = new Date(Math.min(t, last));
      const pct = (n: number) => (tasks.length ? Math.round((n / tasks.length) * 100) : 0);
      curve.push({
        date: localDay(at).slice(5).split("-").reverse().join("/"),
        planned: pct(tasks.filter((x: any) => (x.plannedDue || x.due) && new Date(x.plannedDue || x.due) <= at).length),
        actual: at <= now ? pct(tasks.filter((x: any) => x.isCompleted && x.actualEnd && new Date(x.actualEnd) <= at).length) : null,
      });
      if (t >= last) break;
    }

    // critical path: the longest chain of dependent tasks by end date
    const byId = new Map<string, any>(tasks.map((t: any) => [String(t._id), t]));
    const endOf = (t: any) => new Date(t.isCompleted ? t.actualEnd || t.due : t.due || now).getTime();
    const lastTask = tasks.reduce((m: any, t: any) => (!m || endOf(t) > endOf(m) ? t : m), null);
    const path: any[] = [];
    for (let cur = lastTask, guard = 0; cur && guard < 200; guard++) {
      path.unshift(cur);
      const preds = (cur.dependsOn || []).map((d: any) => byId.get(String(d))).filter(Boolean);
      cur = preds.reduce((m: any, t: any) => (!m || endOf(t) > endOf(m) ? t : m), null);
    }

    const statusMap = new Map<string, any>();
    tasks.forEach((t: any) => {
      const k = String(t.status?._id || "");
      if (!statusMap.has(k)) statusMap.set(k, { name: t.status?.name || "—", color: t.status?.color || "#64748b", value: 0 });
      statusMap.get(k).value++;
    });
    const brief = (t: any) => ({ _id: t._id, title: t.title, due: t.due, isCompleted: t.isCompleted, overdue: isOverdue(t, now), assignee: t.assignee?.name || "", status: t.status });

    ok(res, {
      curve,
      byStatus: [...statusMap.values()],
      criticalPath: path.map(brief),
      overdue: tasks.filter((t: any) => isOverdue(t, now)).sort((a: any, b: any) => a.due - b.due).slice(0, 10).map(brief),
      milestones: tasks.filter((t: any) => t.milestone).sort((a: any, b: any) => new Date(a.due || 0).getTime() - new Date(b.due || 0).getTime()).map(brief),
      activity,
      verifications: { pending: verifications.filter((v: any) => v.status === "Pending").length, approved: verifications.filter((v: any) => v.status === "Approved").length, rejected: verifications.filter((v: any) => v.status === "Rejected").length },
      signoffs: { modules: modules.length, signed: modules.filter((m: any) => m.signedOffAt).length, pending: signoffs.filter((x: any) => x.status === "Pending").length },
    });
  })
);

/* ───────────── person dashboard ───────────── */
r.get(
  "/people/:id/performance",
  anyRight(["pm_team", "view"], ["pm_my_tasks", "view"], ["pm_dashboard", "view"]),
  asyncHandler(async (req: any, res: any) => {
    const id = String(req.params.id === "me" ? req.auth.uid : req.params.id);
    if (!Types.ObjectId.isValid(id) || !(await canSeeEmployee(req, id))) throw new ApiError(404, "Employee not found");
    const person: any = await User.findOne({ _id: id, tenant: req.tenantId }).select("name email mobile photo code joiningDate designation department").populate("designation", "name").populate("department", "name").lean();
    if (!person) throw new ApiError(404, "Employee not found");
    const uid = new Types.ObjectId(id);
    const now = new Date();
    const yearAgo = new Date(now.getTime() - 365 * DAY);

    const [tasks, from, to, plans, locations]: any[] = await Promise.all([
      PmTask.find({ tenant: req.tenantId, assignee: uid }).select("title project isCompleted isPaused due plannedDue actualEnd").populate("project", "name").lean(),
      PmAssignment.countDocuments({ tenant: req.tenantId, entity: "task", from: uid }),
      PmAssignment.countDocuments({ tenant: req.tenantId, entity: "task", to: uid, from: { $ne: null } }),
      PmDailyPlan.find({ tenant: req.tenantId, employee: uid, date: { $gte: localDay(new Date(now.getTime() - 90 * DAY)) } }).select("date entries.result entries.location").lean(),
      PmMaster.find({ tenant: req.tenantId, type: "work_location" }).select("name color").lean(),
    ]);
    const done = tasks.filter((t: any) => t.isCompleted && t.actualEnd);
    const onTime = done.filter((t: any) => !t.due || new Date(t.actualEnd) <= new Date(t.due));
    const late = done.filter((t: any) => t.due && new Date(t.actualEnd) > new Date(t.due));
    const monthStart = new Date(`${localDay(now).slice(0, 7)}-01T00:00:00+05:30`);

    const months: any[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const key = d.toISOString().slice(0, 7);
      const mine = done.filter((t: any) => localDay(t.actualEnd).slice(0, 7) === key);
      months.push({ month: d.toLocaleString("en-IN", { month: "short", timeZone: "UTC" }), onTime: mine.filter((t: any) => !t.due || new Date(t.actualEnd) <= new Date(t.due)).length, late: mine.filter((t: any) => t.due && new Date(t.actualEnd) > new Date(t.due)).length });
    }
    const projects = new Map<string, any>();
    tasks.filter((t: any) => t.project && (!t.isCompleted || (t.actualEnd && t.actualEnd > yearAgo))).forEach((t: any) => {
      const k = String(t.project._id);
      if (!projects.has(k)) projects.set(k, { _id: k, name: t.project.name, open: 0, done: 0 });
      projects.get(k)[t.isCompleted ? "done" : "open"]++;
    });
    const entries = plans.flatMap((p: any) => p.entries);
    const byLocation = locations.map((l: any) => ({ name: l.name, color: l.color, value: plans.filter((p: any) => p.entries.some((e: any) => String(e.location) === String(l._id))).length })).filter((x: any) => x.value);

    ok(res, {
      person: { _id: id, name: person.name, email: person.email, mobile: person.mobile || "", photo: person.photo || "", code: person.code || "", designation: person.designation?.name || "", department: person.department?.name || "", joiningDate: person.joiningDate || "" },
      tiles: {
        open: tasks.filter((t: any) => !t.isCompleted).length,
        overdue: tasks.filter((t: any) => isOverdue(t, now)).length,
        completedMonth: done.filter((t: any) => t.actualEnd >= monthStart).length,
        onTimePct: done.length ? Math.round((onTime.length / done.length) * 100) : 0,
        reassignedFrom: from,
        reassignedTo: to,
        avgDelayDays: late.length ? Math.round((late.reduce((n: number, t: any) => n + (new Date(t.actualEnd).getTime() - new Date(t.due).getTime()) / DAY, 0) / late.length) * 10) / 10 : 0,
      },
      months,
      onTime: [{ name: "On time", color: "#16a34a", value: onTime.length }, { name: "Late", color: "#dc2626", value: late.length }].filter((x) => x.value),
      projects: [...projects.values()].sort((a, b) => b.open - a.open),
      plan: {
        days: plans.length,
        done: entries.filter((e: any) => e.result === "done").length,
        partial: entries.filter((e: any) => e.result === "partial").length,
        notDone: entries.filter((e: any) => e.result === "not_done").length,
        byLocation,
      },
    });
  })
);

export default r;
