import { Request } from "express";
import { Types } from "mongoose";
import { PmMaster, PmHoliday } from "../../models/pm/Setup";
import { PmProject, PmProjectModule, PmTask, PmActivity } from "../../models/pm/Project";
import { getPmSettings } from "./masters";
import { WorkCalendar, calculateSchedule } from "./dateEngine";
import { getVisibleEmployeeIds } from "./visibility";

const DAY = 86_400_000;
const oid = (v: any) => new Types.ObjectId(String(v));

export async function loadCalendar(tenantId: any): Promise<WorkCalendar> {
  const [s, holidays] = await Promise.all([getPmSettings(tenantId), PmHoliday.find({ tenant: tenantId }).select("date").lean()]);
  return { workingDays: s.workingDays, workStart: s.workStart, workEnd: s.workEnd, holidays: new Set(holidays.map((h) => h.date)) };
}

/** The flag copies a task keeps of its status. */
export function statusFlags(status?: { flags?: Record<string, boolean> } | null) {
  const f = status?.flags || {};
  return { isCompleted: !!f.isCompleted, isStarted: !!f.isInProgress || !!f.isCompleted || !!f.isWaitingForClient, isPaused: !!f.pausesTat, isWaitingForClient: !!f.isWaitingForClient };
}

/** The status carrying a flag (first by order), e.g. the initial or the completed status. */
export async function statusWith(tenantId: any, type: "task_status" | "project_status", flag: string | null) {
  await getPmSettings(tenantId);
  const rows = await PmMaster.find({ tenant: tenantId, type, active: true }).sort({ order: 1 }).lean();
  return (flag ? rows.find((r: any) => r.flags?.[flag]) : rows[0]) || null;
}

export async function logActivity(a: { tenant: any; project?: any; task?: any; kind: string; text: string; from?: string; to?: string; by?: any; byName?: string }) {
  try {
    await PmActivity.create({ ...a, byName: a.byName || "System" });
  } catch {
    /* the activity log never breaks the request */
  }
}

/* ───────────── visibility ───────────── */

/** Mongo filter: the projects this user may see (incharge, module incharge or task assignee among their people). */
export async function visibleProjectFilter(req: Request): Promise<Record<string, any>> {
  const ids = await getVisibleEmployeeIds(req);
  if (ids === "all") return {};
  const people = ids.map(oid);
  const [byTask, byModule] = await Promise.all([
    PmTask.distinct("project", { tenant: req.tenantId, assignee: { $in: people }, project: { $ne: null } }),
    PmProjectModule.distinct("project", { tenant: req.tenantId, incharge: { $in: people } }),
  ]);
  return { $or: [{ incharge: { $in: people } }, { _id: { $in: [...byTask, ...byModule] } }] };
}

/** Mongo filter: the tasks this user may see. */
export async function visibleTaskFilter(req: Request): Promise<Record<string, any>> {
  const ids = await getVisibleEmployeeIds(req);
  if (ids === "all") return {};
  const people = ids.map(oid);
  const [projects, modules] = await Promise.all([
    PmProject.distinct("_id", { tenant: req.tenantId, incharge: { $in: people } }),
    PmProjectModule.distinct("_id", { tenant: req.tenantId, incharge: { $in: people } }),
  ]);
  return { $or: [{ assignee: { $in: people } }, { createdBy: { $in: people } }, { project: { $in: projects } }, { projectModule: { $in: modules } }] };
}

/* ───────────── numbers: progress, overdue, schedule status ───────────── */

export type Schedule = "ahead" | "on_track" | "delayed" | "completed_on_time" | "completed_late" | "not_started";

export interface Stats {
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  waiting: number;
  /** % of tasks completed */
  progress: number;
  /** % expected to be complete by now, from the planned dates */
  planned: number;
  schedule: Schedule;
  expectedEnd: Date | null;
  /** + late, − early, against the planned end */
  delayDays: number;
}

export const isOverdue = (t: any, now = new Date()) => !t.isCompleted && !t.isPaused && !!t.due && new Date(t.due) < now;

export function computeStats(tasks: any[], plannedEnd: Date | null | undefined, thresholds: { ahead: number; delayed: number }, now = new Date()): Stats {
  const total = tasks.length;
  const done = tasks.filter((t) => t.isCompleted).length;
  const overdueTasks = tasks.filter((t) => isOverdue(t, now));
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const progress = pct(done);
  const planned = pct(tasks.filter((t) => (t.plannedDue || t.due) && new Date(t.plannedDue || t.due) <= now).length);

  let expectedEnd: Date | null = null;
  for (const t of tasks) {
    const end = t.isCompleted ? t.actualEnd || t.due : t.due && new Date(t.due) < now ? now : t.due;
    if (end && (!expectedEnd || new Date(end) > expectedEnd)) expectedEnd = new Date(end);
  }
  const delayDays = plannedEnd && expectedEnd ? Math.round((expectedEnd.getTime() - new Date(plannedEnd).getTime()) / DAY) : 0;

  // a late task that other open tasks wait for (or a milestone) is critical
  const waitedFor = new Set<string>();
  tasks.filter((t) => !t.isCompleted).forEach((t) => (t.dependsOn || []).forEach((d: any) => waitedFor.add(String(d))));
  const criticalOverdue = overdueTasks.some((t) => t.milestone || waitedFor.has(String(t._id)));

  let schedule: Schedule;
  if (!total) schedule = "not_started";
  else if (done === total) schedule = plannedEnd && expectedEnd && expectedEnd.getTime() > new Date(plannedEnd).getTime() + DAY / 2 ? "completed_late" : "completed_on_time";
  else if (progress < planned - thresholds.delayed || criticalOverdue) schedule = "delayed";
  else if (progress > planned + thresholds.ahead) schedule = "ahead";
  else schedule = "on_track";

  return {
    total,
    done,
    inProgress: tasks.filter((t) => t.isStarted && !t.isCompleted && !t.isWaitingForClient).length,
    overdue: overdueTasks.length,
    waiting: tasks.filter((t) => t.isWaitingForClient && !t.isCompleted).length,
    progress,
    planned,
    schedule,
    expectedEnd,
    delayDays,
  };
}

const STAT_FIELDS = "project projectModule isCompleted isStarted isPaused isWaitingForClient due plannedDue actualEnd dependsOn milestone";

/** Stats of many projects in one query: Map projectId → Stats, and per module. */
export async function projectStats(tenantId: any, projects: { _id: any; plannedEnd?: Date | null }[]) {
  const s = await getPmSettings(tenantId);
  const thresholds = { ahead: s.aheadThreshold, delayed: s.delayedThreshold };
  const tasks = await PmTask.find({ tenant: tenantId, project: { $in: projects.map((p) => p._id) } }).select(STAT_FIELDS).lean();
  const byProject = new Map<string, any[]>();
  for (const t of tasks) {
    const k = String(t.project);
    if (!byProject.has(k)) byProject.set(k, []);
    byProject.get(k)!.push(t);
  }
  const now = new Date();
  const out = new Map<string, Stats>();
  const modules = new Map<string, Stats>();
  for (const p of projects) {
    const mine = byProject.get(String(p._id)) || [];
    out.set(String(p._id), computeStats(mine, p.plannedEnd, thresholds, now));
    const byModule = new Map<string, any[]>();
    for (const t of mine) {
      const k = String(t.projectModule || "");
      if (!byModule.has(k)) byModule.set(k, []);
      byModule.get(k)!.push(t);
    }
    for (const [k, list] of byModule) {
      const end = list.reduce((m: Date | null, t: any) => (t.plannedDue && (!m || new Date(t.plannedDue) > m) ? new Date(t.plannedDue) : m), null);
      modules.set(k, computeStats(list, end, thresholds, now));
    }
  }
  return { projects: out, modules };
}

/* ───────────── rescheduling ───────────── */

const fmt = (d?: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10).split("-").reverse().join("-") : "—");

/**
 * Recalculate the current dates of a project's tasks:
 *   completed      → fixed at its actual end
 *   started        → keeps its dates
 *   not started    → start = latest predecessor end (or project start), due = start + TAT
 * Every changed date is written to the task and to the activity log.
 * Returns the tasks whose dates moved.
 */
export async function rescheduleProject(tenantId: any, projectId: any, actor?: { id?: any; name?: string }, reason = "Dependency") {
  const [project, tasks, cal] = await Promise.all([
    PmProject.findOne({ _id: projectId, tenant: tenantId }).lean(),
    PmTask.find({ tenant: tenantId, project: projectId }).select("title tatValue tatUnit dependsOn start due actualStart actualEnd isCompleted isStarted dueLocked").lean(),
    loadCalendar(tenantId),
  ]);
  if (!project || !tasks.length) return [];

  const fixed = new Map<string, { start?: Date; due: Date }>();
  for (const t of tasks as any[]) {
    if (t.isCompleted) fixed.set(String(t._id), { start: t.actualStart || t.start || undefined, due: t.actualEnd || t.due || new Date() });
    else if ((t.isStarted || t.dueLocked) && t.due) fixed.set(String(t._id), { start: t.actualStart || t.start || undefined, due: t.due });
  }
  let schedule: Map<string, { start: Date; due: Date }>;
  try {
    schedule = calculateSchedule(
      tasks.map((t: any) => ({ id: String(t._id), tatValue: t.tatValue, tatUnit: t.tatUnit, dependsOn: (t.dependsOn || []).map(String) })),
      project.startDate,
      cal,
      fixed
    );
  } catch {
    return []; // a loop: leave the dates as they are
  }

  const moved: any[] = [];
  for (const t of tasks as any[]) {
    if (t.isCompleted || t.isStarted || t.dueLocked) continue;
    const next = schedule.get(String(t._id))!;
    const sameDue = t.due && Math.abs(new Date(t.due).getTime() - next.due.getTime()) < 60_000;
    const sameStart = t.start && Math.abs(new Date(t.start).getTime() - next.start.getTime()) < 60_000;
    if (sameDue && sameStart) continue;
    await PmTask.updateOne({ _id: t._id }, { $set: { start: next.start, due: next.due } });
    if (!sameDue) {
      moved.push({ _id: t._id, title: t.title, from: t.due, to: next.due });
      await logActivity({ tenant: tenantId, project: projectId, task: t._id, kind: "dates", text: `Due date moved (${reason})`, from: fmt(t.due), to: fmt(next.due), by: actor?.id, byName: actor?.name });
    }
  }
  return moved;
}

/** Close or reopen the project when its last task completes / a task reopens. */
export async function syncProjectCompletion(tenantId: any, projectId: any): Promise<"completed" | "reopened" | null> {
  const project = await PmProject.findOne({ _id: projectId, tenant: tenantId });
  if (!project) return null;
  const [total, open] = await Promise.all([
    PmTask.countDocuments({ tenant: tenantId, project: projectId }),
    PmTask.countDocuments({ tenant: tenantId, project: projectId, isCompleted: false }),
  ]);
  if (total && !open && !project.actualEnd) {
    const last = await PmTask.findOne({ tenant: tenantId, project: projectId }).sort({ actualEnd: -1 }).select("actualEnd").lean();
    project.actualEnd = last?.actualEnd || new Date();
    const done = await statusWith(tenantId, "project_status", "isCompleted");
    if (done) project.status = done._id as any;
    await project.save();
    return "completed";
  }
  if (open && project.actualEnd) {
    project.actualEnd = null;
    await project.save();
    return "reopened";
  }
  return null;
}
