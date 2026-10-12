import { Router } from "express";
import { Types } from "mongoose";
import * as XLSX from "xlsx";
import { ok, asyncHandler, ApiError, audit } from "../../utils/http";
import { User } from "../../models/User";
import { Team } from "../../models/Team";
import { PmMaster } from "../../models/pm/Setup";
import { PmProject, PmProjectModule, PmTask, PmAssignment } from "../../models/pm/Project";
import { PmDailyPlan } from "../../models/pm/DailyPlan";
import { PmMeeting } from "../../models/pm/Meeting";
import { PmMessage } from "../../models/pm/Message";
import { PmTicket, PmVerification } from "../../models/pm/Portal";
import { PmSavedView } from "../../models/pm/Extras";
import { isOverdue, projectStats, visibleProjectFilter, visibleTaskFilter } from "../../services/pm/projects";
import { getVisibleEmployeeIds, pmRight } from "../../services/pm/visibility";

/** Reports. One registry: each report says which filters it takes and returns columns + rows (+ a small chart). */
const r = Router();
const DAY = 86_400_000;
const oid = (v: any) => new Types.ObjectId(String(v));
const valid = (v: any) => !!v && Types.ObjectId.isValid(String(v));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const fmt = (d?: any) => (d ? new Date(new Date(d).getTime() + 330 * 60_000).toISOString().slice(0, 10).split("-").reverse().join("-") : "");
const localDay = (d: any) => new Date(new Date(d).getTime() + 330 * 60_000).toISOString().slice(0, 10);
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const days = (a: any, b: any) => Math.round(((new Date(a).getTime() - new Date(b).getTime()) / DAY) * 10) / 10;
const avg = (list: number[]) => (list.length ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10 : 0);

type Column = { key: string; label: string; type?: "number" | "percent" | "date" };
type Result = { columns: Column[]; rows: Record<string, any>[]; chart?: { x: string; bars: { key: string; label: string; color: string }[] } };
type Filter = "range" | "year" | "client" | "product" | "project" | "incharge" | "employee" | "team" | "groupBy";
interface Report {
  key: string;
  title: string;
  filters: Filter[];
  groupBy?: [string, string][];
  run: (req: any, f: Record<string, string>) => Promise<Result>;
}

/* ---- shared scopes: always inside what the user may see ---- */
function dateRange(f: Record<string, string>) {
  const range: any = {};
  if (/^\d{4}$/.test(f.year || "")) {
    range.$gte = new Date(`${f.year}-01-01T00:00:00+05:30`);
    range.$lt = new Date(`${Number(f.year) + 1}-01-01T00:00:00+05:30`);
  }
  if (DATE.test(f.from || "")) range.$gte = new Date(`${f.from}T00:00:00+05:30`);
  if (DATE.test(f.to || "")) range.$lt = new Date(new Date(`${f.to}T00:00:00+05:30`).getTime() + DAY);
  return Object.keys(range).length ? range : null;
}
async function teamMembers(req: any, f: Record<string, string>): Promise<Types.ObjectId[] | null> {
  if (!valid(f.team)) return null;
  const t: any = await Team.findOne({ _id: f.team, tenant: req.tenantId }).lean();
  return t ? [oid(t.manager), ...(t.members || []).map((m: any) => oid(m.user))] : [];
}
async function projectsOf(req: any, f: Record<string, string>) {
  const filter: any = { tenant: req.tenantId, ...(await visibleProjectFilter(req)) };
  for (const k of ["client", "product", "incharge"]) if (valid(f[k])) filter[k] = f[k];
  if (valid(f.project)) filter._id = f.project;
  return PmProject.find(filter).populate("client", "name").populate("product", "name").populate("incharge", "name").populate("status", "name").lean();
}
async function tasksOf(req: any, f: Record<string, string>, extra: any = {}, select = "") {
  const and: any[] = [{ tenant: req.tenantId, ...extra }, await visibleTaskFilter(req)];
  for (const k of ["client", "product", "project"]) if (valid(f[k])) and.push({ [k]: f[k] });
  if (valid(f.employee)) and.push({ assignee: f.employee });
  const team = await teamMembers(req, f);
  if (team) and.push({ assignee: { $in: team } });
  return PmTask.find({ $and: and }).select(select || "title number assignee project projectModule product taskType isCompleted isPaused isWaitingForClient due plannedStart plannedDue start actualStart actualEnd tatValue tatUnit kind")
    .populate("assignee", "name").populate("project", "name").lean();
}
const onTime = (t: any) => !t.due || new Date(t.actualEnd) <= new Date(t.due);

const REPORTS: Report[] = [
  {
    key: "project_delivery", title: "Project Delivery", filters: ["range", "client", "product", "incharge"],
    async run(req, f) {
      const projects: any[] = await projectsOf(req, f);
      const stats = (await projectStats(req.tenantId, projects)).projects;
      const range = dateRange(f);
      const rows = projects
        .filter((p) => !range || ((!range.$gte || p.plannedEnd >= range.$gte) && (!range.$lt || p.plannedEnd < range.$lt)))
        .map((p) => {
          const s = stats.get(String(p._id))!;
          const doneOn = p.actualEnd;
          return {
            code: p.code, project: p.name, client: p.client?.name || "", incharge: p.incharge?.name || "", plannedEnd: fmt(p.plannedEnd), actualEnd: fmt(doneOn),
            result: doneOn ? (s.schedule === "completed_late" ? "Late" : "On time") : s.schedule === "delayed" ? "Running late" : "Running", delayDays: s.delayDays, progress: s.progress,
          };
        });
      return {
        columns: [{ key: "code", label: "Code" }, { key: "project", label: "Project" }, { key: "client", label: "Client" }, { key: "incharge", label: "Incharge" }, { key: "plannedEnd", label: "Planned end" }, { key: "actualEnd", label: "Actual end" }, { key: "result", label: "Result" }, { key: "delayDays", label: "Delay days", type: "number" }, { key: "progress", label: "Progress %", type: "percent" }],
        rows,
        chart: { x: "project", bars: [{ key: "delayDays", label: "Delay days", color: "#dc2626" }] },
      };
    },
  },
  {
    key: "person_project_ontime", title: "Projects On Time per Person", filters: ["year", "client", "product"],
    async run(req, f) {
      const projects: any[] = (await projectsOf(req, f)).filter((p: any) => p.actualEnd);
      const stats = (await projectStats(req.tenantId, projects)).projects;
      const year = /^\d{4}$/.test(f.year || "") ? f.year : "";
      const map = new Map<string, any>();
      for (const p of projects) {
        const y = localDay(p.actualEnd).slice(0, 4);
        if (year && y !== year) continue;
        const k = `${p.incharge?._id}|${y}`;
        if (!map.has(k)) map.set(k, { person: p.incharge?.name || "—", year: y, completed: 0, onTime: 0, late: 0 });
        const row = map.get(k);
        row.completed++;
        row[stats.get(String(p._id))!.schedule === "completed_late" ? "late" : "onTime"]++;
      }
      const rows = [...map.values()].map((x) => ({ ...x, onTimePct: pct(x.onTime, x.completed) })).sort((a, b) => b.year.localeCompare(a.year) || b.completed - a.completed);
      return {
        columns: [{ key: "person", label: "Project incharge" }, { key: "year", label: "Year" }, { key: "completed", label: "Completed", type: "number" }, { key: "onTime", label: "On time", type: "number" }, { key: "late", label: "Late", type: "number" }, { key: "onTimePct", label: "On time %", type: "percent" }],
        rows,
        chart: { x: "person", bars: [{ key: "onTime", label: "On time", color: "#16a34a" }, { key: "late", label: "Late", color: "#dc2626" }] },
      };
    },
  },
  {
    key: "person_tasks", title: "Tasks per Person", filters: ["range", "client", "product", "project", "employee", "team"],
    async run(req, f) {
      const tasks: any[] = await tasksOf(req, f, { assignee: { $ne: null } });
      const range = dateRange(f);
      const now = new Date();
      const map = new Map<string, any>();
      for (const t of tasks) {
        const stamp = t.isCompleted ? t.actualEnd : t.due;
        if (range && stamp && ((range.$gte && stamp < range.$gte) || (range.$lt && stamp >= range.$lt))) continue;
        const k = String(t.assignee._id);
        if (!map.has(k)) map.set(k, { person: t.assignee.name, assigned: 0, completed: 0, onTime: 0, late: 0, overdue: 0, delays: [] as number[] });
        const row = map.get(k);
        row.assigned++;
        if (t.isCompleted && t.actualEnd) {
          row.completed++;
          if (onTime(t)) row.onTime++;
          else { row.late++; row.delays.push(days(t.actualEnd, t.due)); }
        } else if (isOverdue(t, now)) row.overdue++;
      }
      const rows = [...map.values()].map(({ delays, ...x }) => ({ ...x, onTimePct: pct(x.onTime, x.completed), avgDelay: avg(delays) })).sort((a, b) => b.assigned - a.assigned);
      return {
        columns: [{ key: "person", label: "Employee" }, { key: "assigned", label: "Assigned", type: "number" }, { key: "completed", label: "Completed", type: "number" }, { key: "onTime", label: "On time", type: "number" }, { key: "late", label: "Late", type: "number" }, { key: "overdue", label: "Overdue now", type: "number" }, { key: "onTimePct", label: "On time %", type: "percent" }, { key: "avgDelay", label: "Avg delay days", type: "number" }],
        rows,
        chart: { x: "person", bars: [{ key: "onTime", label: "On time", color: "#16a34a" }, { key: "late", label: "Late", color: "#f97316" }, { key: "overdue", label: "Overdue", color: "#dc2626" }] },
      };
    },
  },
  {
    key: "reassignment", title: "Reassignments", filters: ["range", "project", "employee"],
    async run(req, f) {
      const visible = await getVisibleEmployeeIds(req);
      const filter: any = { tenant: req.tenantId, entity: "task", from: { $ne: null } };
      const range = dateRange(f);
      if (range) filter.createdAt = range;
      if (valid(f.project)) filter.project = f.project;
      const rows0: any[] = await PmAssignment.find(filter).populate("from", "name").populate("to", "name").populate("project", "name").lean();
      const map = new Map<string, any>();
      const row = (u: any) => {
        const k = String(u._id);
        if (!map.has(k)) map.set(k, { _id: k, person: u.name, fromThem: 0, toThem: 0, reasons: new Map<string, number>(), projects: new Set<string>() });
        return map.get(k);
      };
      for (const a of rows0) {
        if (a.from) { const x = row(a.from); x.fromThem++; x.reasons.set(a.reason, (x.reasons.get(a.reason) || 0) + 1); if (a.project) x.projects.add(a.project.name); }
        if (a.to) { const x = row(a.to); x.toThem++; if (a.project) x.projects.add(a.project.name); }
      }
      const rows = [...map.values()]
        .filter((x) => (visible === "all" || visible.includes(x._id)) && (!valid(f.employee) || x._id === String(f.employee)))
        .map((x) => ({ person: x.person, fromThem: x.fromThem, toThem: x.toThem, reasons: [...x.reasons.entries()].sort((a: any, b: any) => b[1] - a[1]).map(([r2, n]: any) => `${r2} (${n})`).join(", "), projects: [...x.projects].join(", ") }))
        .sort((a, b) => b.fromThem - a.fromThem);
      return {
        columns: [{ key: "person", label: "Employee" }, { key: "fromThem", label: "Reassigned from", type: "number" }, { key: "toThem", label: "Reassigned to", type: "number" }, { key: "reasons", label: "Reasons" }, { key: "projects", label: "Projects" }],
        rows,
        chart: { x: "person", bars: [{ key: "fromThem", label: "From", color: "#dc2626" }, { key: "toThem", label: "To", color: "#2563eb" }] },
      };
    },
  },
  {
    key: "overdue", title: "Overdue Tasks", filters: ["client", "product", "project", "employee", "team"],
    async run(req, f) {
      const now = new Date();
      const tasks: any[] = await tasksOf(req, f, { isCompleted: false, isPaused: false, due: { $lt: now } });
      const rows = tasks.map((t) => ({ number: t.number, task: t.title, project: t.project?.name || "", assignee: t.assignee?.name || "", due: fmt(t.due), daysOverdue: Math.max(1, Math.ceil((now.getTime() - new Date(t.due).getTime()) / DAY)) })).sort((a, b) => b.daysOverdue - a.daysOverdue);
      const by = new Map<string, number>();
      rows.forEach((x) => by.set(x.assignee || "—", (by.get(x.assignee || "—") || 0) + 1));
      return {
        columns: [{ key: "number", label: "Number" }, { key: "task", label: "Task" }, { key: "project", label: "Project" }, { key: "assignee", label: "Assignee" }, { key: "due", label: "Due" }, { key: "daysOverdue", label: "Days overdue", type: "number" }],
        rows,
      };
    },
  },
  {
    key: "tat_compliance", title: "TAT Compliance", filters: ["range", "client", "product", "project", "groupBy"],
    groupBy: [["employee", "Employee"], ["product", "Product"], ["module", "Module"], ["taskType", "Task type"]],
    async run(req, f) {
      const range = dateRange(f);
      const tasks: any[] = await tasksOf(req, f, { isCompleted: true, actualEnd: range || { $ne: null } });
      const by = f.groupBy || "employee";
      const [products, modules, types] = await Promise.all([
        by === "product" ? (await import("../../models/pm/Product")).PmProduct.find({ tenant: req.tenantId }).select("name").lean() : [],
        by === "module" ? PmProjectModule.find({ tenant: req.tenantId }).select("name").lean() : [],
        by === "taskType" ? PmMaster.find({ tenant: req.tenantId, type: "task_type" }).select("name").lean() : [],
      ]);
      const name = (list: any[], id: any) => list.find((x: any) => String(x._id) === String(id))?.name || "—";
      const keyOf = (t: any) => (by === "product" ? name(products, t.product) : by === "module" ? name(modules, t.projectModule) : by === "taskType" ? name(types, t.taskType) : t.assignee?.name || "—");
      const map = new Map<string, any>();
      for (const t of tasks) {
        const k = keyOf(t);
        if (!map.has(k)) map.set(k, { group: k, completed: 0, onTime: 0, late: 0 });
        const x = map.get(k);
        x.completed++;
        x[onTime(t) ? "onTime" : "late"]++;
      }
      const rows = [...map.values()].map((x) => ({ ...x, compliance: pct(x.onTime, x.completed) })).sort((a, b) => a.compliance - b.compliance);
      return {
        columns: [{ key: "group", label: (this.groupBy!.find((g) => g[0] === by) || ["", "Group"])[1] }, { key: "completed", label: "Completed", type: "number" }, { key: "onTime", label: "Within TAT", type: "number" }, { key: "late", label: "Beyond TAT", type: "number" }, { key: "compliance", label: "Compliance %", type: "percent" }],
        rows,
        chart: { x: "group", bars: [{ key: "compliance", label: "Compliance %", color: "#2563eb" }] },
      };
    },
  },
  {
    key: "module", title: "Module Planned vs Actual", filters: ["client", "product"],
    async run(req, f) {
      const tasks: any[] = await tasksOf(req, f, { projectModule: { $ne: null }, isCompleted: true });
      const modules = await PmProjectModule.find({ tenant: req.tenantId }).select("name").lean();
      const map = new Map<string, any>();
      for (const t of tasks) {
        const k = modules.find((m) => String(m._id) === String(t.projectModule))?.name || "—";
        if (!map.has(k)) map.set(k, { module: k, tasks: 0, planned: [] as number[], actual: [] as number[], projects: new Set<string>() });
        const x = map.get(k);
        x.tasks++;
        if (t.plannedStart && t.plannedDue) x.planned.push(days(t.plannedDue, t.plannedStart));
        if (t.actualEnd && (t.actualStart || t.start)) x.actual.push(Math.max(0, days(t.actualEnd, t.actualStart || t.start)));
        if (t.project) x.projects.add(String(t.project._id));
      }
      const rows = [...map.values()].map((x) => ({ module: x.module, projects: x.projects.size, tasks: x.tasks, plannedDays: avg(x.planned), actualDays: avg(x.actual), difference: Math.round((avg(x.actual) - avg(x.planned)) * 10) / 10 })).sort((a, b) => b.difference - a.difference);
      return {
        columns: [{ key: "module", label: "Module" }, { key: "projects", label: "Projects", type: "number" }, { key: "tasks", label: "Tasks done", type: "number" }, { key: "plannedDays", label: "Avg planned days / task", type: "number" }, { key: "actualDays", label: "Avg actual days / task", type: "number" }, { key: "difference", label: "Difference", type: "number" }],
        rows,
        chart: { x: "module", bars: [{ key: "plannedDays", label: "Planned", color: "#64748b" }, { key: "actualDays", label: "Actual", color: "#2563eb" }] },
      };
    },
  },
  {
    key: "client_pending", title: "Pending with Client", filters: ["client", "project"],
    async run(req, f) {
      const now = new Date();
      const tasks: any[] = await tasksOf(req, f, { isCompleted: false, isWaitingForClient: true }, "title number project client assignee due updatedAt");
      const pending: any[] = await PmVerification.find({ tenant: req.tenantId, status: "Pending", task: { $in: tasks.map((t) => t._id) } }).select("task sentAt reminders contacts.name").lean();
      const clients = await (await import("../../models/pm/Client")).PmClient.find({ tenant: req.tenantId }).select("name").lean();
      const rows = tasks.map((t) => {
        const v = pending.find((x) => String(x.task) === String(t._id));
        const since = v?.sentAt || t.updatedAt;
        return { client: clients.find((c) => String(c._id) === String(t.client))?.name || "", project: t.project?.name || "", task: t.title, assignee: t.assignee?.name || "", sentTo: (v?.contacts || []).map((c: any) => c.name).join(", "), since: fmt(since), ageDays: Math.floor((now.getTime() - new Date(since).getTime()) / DAY), reminders: v?.reminders || 0 };
      }).sort((a, b) => b.ageDays - a.ageDays);
      return { columns: [{ key: "client", label: "Client" }, { key: "project", label: "Project" }, { key: "task", label: "Task" }, { key: "assignee", label: "Assignee" }, { key: "sentTo", label: "Sent to" }, { key: "since", label: "Waiting since" }, { key: "ageDays", label: "Days", type: "number" }, { key: "reminders", label: "Reminders", type: "number" }], rows };
    },
  },
  {
    key: "daily_plan", title: "Daily Plan", filters: ["range", "employee", "team"],
    async run(req, f) {
      const visible = await getVisibleEmployeeIds(req);
      const filter: any = { tenant: req.tenantId };
      const team = await teamMembers(req, f);
      const people = [visible === "all" ? null : visible.map(oid), team, valid(f.employee) ? [oid(f.employee)] : null].filter(Boolean) as Types.ObjectId[][];
      if (people.length) filter.$and = people.map((ids) => ({ employee: { $in: ids } }));
      filter.date = { $gte: DATE.test(f.from || "") ? f.from : localDay(new Date(Date.now() - 30 * DAY)), $lte: DATE.test(f.to || "") ? f.to : localDay(new Date()) };
      const [plans, locations, users]: any[] = await Promise.all([
        PmDailyPlan.find(filter).lean(),
        PmMaster.find({ tenant: req.tenantId, type: "work_location" }).lean(),
        User.find({ tenant: req.tenantId }).select("name").lean(),
      ]);
      const onsite = new Set(locations.filter((l: any) => l.flags?.isOnsite).map((l: any) => String(l._id)));
      const map = new Map<string, any>();
      for (const p of plans) {
        const k = String(p.employee);
        if (!map.has(k)) map.set(k, { person: users.find((u: any) => String(u._id) === k)?.name || "—", days: 0, entries: 0, done: 0, partial: 0, notDone: 0, hours: 0, onsiteDays: 0 });
        const x = map.get(k);
        x.days++;
        if (p.entries.some((e: any) => onsite.has(String(e.location)))) x.onsiteDays++;
        for (const e of p.entries) {
          x.entries++;
          x.hours += e.hours || 0;
          if (e.result === "done") x.done++;
          if (e.result === "partial") x.partial++;
          if (e.result === "not_done") x.notDone++;
        }
      }
      const rows = [...map.values()].map((x) => ({ ...x, adherence: pct(x.done, x.done + x.partial + x.notDone) })).sort((a, b) => b.days - a.days);
      return {
        columns: [{ key: "person", label: "Employee" }, { key: "days", label: "Days planned", type: "number" }, { key: "hours", label: "Planned hours", type: "number" }, { key: "entries", label: "Entries", type: "number" }, { key: "done", label: "Done", type: "number" }, { key: "partial", label: "Partial", type: "number" }, { key: "notDone", label: "Not done", type: "number" }, { key: "adherence", label: "Done %", type: "percent" }, { key: "onsiteDays", label: "Onsite days", type: "number" }],
        rows,
        chart: { x: "person", bars: [{ key: "done", label: "Done", color: "#16a34a" }, { key: "partial", label: "Partial", color: "#f97316" }, { key: "notDone", label: "Not done", color: "#dc2626" }] },
      };
    },
  },
  {
    key: "meetings", title: "Meetings & Trainings", filters: ["range", "project"],
    async run(req, f) {
      const visible = await getVisibleEmployeeIds(req);
      const and: any[] = [{ tenant: req.tenantId, status: "scheduled" }];
      if (visible !== "all") and.push({ $or: [{ organizer: { $in: visible } }, { "attendees.user": { $in: visible } }] });
      if (DATE.test(f.from || "")) and.push({ date: { $gte: f.from } });
      if (DATE.test(f.to || "")) and.push({ date: { $lte: f.to } });
      if (valid(f.project)) and.push({ project: f.project });
      const rows0: any[] = await PmMeeting.find({ $and: and }).populate("type", "name").lean();
      const today = localDay(new Date());
      const map = new Map<string, any>();
      for (const m of rows0) {
        const k = m.type?.name || "—";
        if (!map.has(k)) map.set(k, { type: k, count: 0, held: 0, invited: 0, attended: 0 });
        const x = map.get(k);
        x.count++;
        if (m.date <= today) { x.held++; x.invited += m.attendees.length; x.attended += m.attendees.filter((a: any) => a.attended).length; }
      }
      const rows = [...map.values()].map((x) => ({ ...x, attendance: pct(x.attended, x.invited) }));
      return {
        columns: [{ key: "type", label: "Type" }, { key: "count", label: "Scheduled", type: "number" }, { key: "held", label: "Held", type: "number" }, { key: "invited", label: "Invited", type: "number" }, { key: "attended", label: "Attended", type: "number" }, { key: "attendance", label: "Attendance %", type: "percent" }],
        rows,
        chart: { x: "type", bars: [{ key: "count", label: "Scheduled", color: "#2563eb" }, { key: "held", label: "Held", color: "#16a34a" }] },
      };
    },
  },
  {
    key: "tickets", title: "Tickets", filters: ["range", "client", "groupBy"],
    groupBy: [["client", "Client"], ["category", "Category"]],
    async run(req, f) {
      const visible = await getVisibleEmployeeIds(req);
      const and: any[] = [{ tenant: req.tenantId, mergedInto: null }];
      if (visible !== "all") and.push({ $or: [{ assignee: { $in: visible } }, { assignee: null }] });
      const range = dateRange(f);
      if (range) and.push({ createdAt: range });
      if (valid(f.client)) and.push({ client: f.client });
      const tickets: any[] = await PmTicket.find({ $and: and }).select("client category isClosed resolveDue resolvedAt createdAt rating").populate("client", "name").populate("category", "name").lean();
      const by = f.groupBy === "category" ? "category" : "client";
      const now = new Date();
      const map = new Map<string, any>();
      for (const t of tickets) {
        const k = t[by]?.name || "—";
        if (!map.has(k)) map.set(k, { group: k, total: 0, open: 0, met: 0, breached: 0, hours: [] as number[], ratings: [] as number[] });
        const x = map.get(k);
        x.total++;
        if (!t.isClosed) x.open++;
        const end = t.resolvedAt || (t.isClosed ? null : now);
        if (t.resolveDue && end) x[new Date(end) <= new Date(t.resolveDue) ? "met" : "breached"]++;
        if (t.resolvedAt) x.hours.push((new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) / 3_600_000);
        if (t.rating) x.ratings.push(t.rating);
      }
      const rows = [...map.values()].map(({ hours, ratings, ...x }) => ({ ...x, slaPct: pct(x.met, x.met + x.breached), avgHours: avg(hours), rating: avg(ratings) })).sort((a, b) => b.total - a.total);
      return {
        columns: [{ key: "group", label: by === "category" ? "Category" : "Client" }, { key: "total", label: "Tickets", type: "number" }, { key: "open", label: "Open", type: "number" }, { key: "met", label: "SLA met", type: "number" }, { key: "breached", label: "SLA missed", type: "number" }, { key: "slaPct", label: "SLA %", type: "percent" }, { key: "avgHours", label: "Avg resolution hrs", type: "number" }, { key: "rating", label: "Avg rating", type: "number" }],
        rows,
        chart: { x: "group", bars: [{ key: "met", label: "SLA met", color: "#16a34a" }, { key: "breached", label: "SLA missed", color: "#dc2626" }] },
      };
    },
  },
  {
    key: "communication", title: "Communication Log", filters: ["range", "client", "project"],
    async run(req, f) {
      const filter: any = { tenant: req.tenantId };
      const range = dateRange(f);
      if (range) filter.createdAt = range;
      for (const k of ["client", "project"]) if (valid(f[k])) filter[k] = f[k];
      const rows0: any[] = await PmMessage.aggregate([{ $match: { ...filter, tenant: oid(req.tenantId), ...(filter.client ? { client: oid(filter.client) } : {}), ...(filter.project ? { project: oid(filter.project) } : {}) } }, { $group: { _id: { channel: "$channel", template: "$templateName", status: "$status" }, n: { $sum: 1 } } }]);
      const map = new Map<string, any>();
      for (const x of rows0) {
        const k = `${x._id.channel}|${x._id.template}`;
        if (!map.has(k)) map.set(k, { channel: x._id.channel === "email" ? "Email" : "WhatsApp", template: x._id.template || "—", sent: 0, failed: 0, pending: 0, skipped: 0 });
        const key = ({ Sent: "sent", Failed: "failed", Pending: "pending", Sending: "pending", Skipped: "skipped" } as any)[x._id.status] || "pending";
        map.get(k)[key] += x.n;
      }
      const rows = [...map.values()].map((x) => ({ ...x, total: x.sent + x.failed + x.pending + x.skipped })).sort((a, b) => b.total - a.total);
      return {
        columns: [{ key: "channel", label: "Channel" }, { key: "template", label: "Template" }, { key: "total", label: "Total", type: "number" }, { key: "sent", label: "Sent", type: "number" }, { key: "failed", label: "Failed", type: "number" }, { key: "pending", label: "Pending", type: "number" }, { key: "skipped", label: "Skipped", type: "number" }],
        rows,
        chart: { x: "template", bars: [{ key: "sent", label: "Sent", color: "#16a34a" }, { key: "failed", label: "Failed", color: "#dc2626" }] },
      };
    },
  },
];

const filtersOf = (query: any) => {
  const f: Record<string, string> = {};
  for (const k of ["from", "to", "year", "client", "product", "project", "incharge", "employee", "team", "groupBy"]) if (query[k]) f[k] = String(query[k]);
  return f;
};
const find = (key: string) => {
  const report = REPORTS.find((x) => x.key === key);
  if (!report) throw new ApiError(404, "Report not found");
  return report;
};

r.get(
  "/reports",
  pmRight("reports", "view"),
  asyncHandler(async (_req: any, res: any) => {
    ok(res, REPORTS.map((x) => ({ key: x.key, title: x.title, filters: x.filters, groupBy: x.groupBy || [] })));
  })
);

r.get(
  "/reports/:key",
  pmRight("reports", "view"),
  asyncHandler(async (req: any, res: any) => {
    const report = find(req.params.key);
    ok(res, { title: report.title, ...(await report.run(req, filtersOf(req.query))) });
  })
);

/** A sheet with the title, the filters and who exported it on top, then the table with a frozen heading. */
export function buildWorkbook(title: string, filterText: string, by: string, columns: Column[], rows: Record<string, any>[]) {
  const head = [[title], [filterText || "All data"], [`Exported by ${by} on ${fmt(new Date())}`], []];
  const table = [columns.map((c) => c.label), ...rows.map((row) => columns.map((c) => row[c.key] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet([...head, ...table]);
  ws["!cols"] = columns.map((c, i) => ({ wch: Math.min(60, Math.max(c.label.length + 2, ...rows.slice(0, 500).map((row) => String(row[c.key] ?? "").length + 2), i === 0 ? title.length / 2 : 0)) }));
  ws["!freeze"] = { xSplit: 0, ySplit: head.length + 1 } as any;
  (ws as any)["!views"] = [{ state: "frozen", ySplit: head.length + 1 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.replace(/[\\/?*[\]:]/g, " ").slice(0, 30));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

r.get(
  "/reports/:key/export",
  pmRight("reports", "export"),
  asyncHandler(async (req: any, res: any) => {
    const report = find(req.params.key);
    const f = filtersOf(req.query);
    const out = await report.run(req, f);
    const filterText = Object.entries(f).filter(([k]) => ["from", "to", "year", "groupBy"].includes(k)).map(([k, v]) => `${k}: ${k === "from" || k === "to" ? fmt(`${v}T00:00:00+05:30`) : v}`).join(" · ");
    const file = buildWorkbook(report.title, filterText, req.auth.name, out.columns, out.rows);
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "EXPORT", module: "Project Management", entity: `Report ${report.title}`, next: `${out.rows.length} rows` });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${report.key}.xlsx"`);
    res.send(file);
  })
);

/* ---- saved views (reports and the task list) ---- */
r.get(
  "/views",
  asyncHandler(async (req: any, res: any) => {
    const screen = String(req.query.screen || "");
    ok(res, await PmSavedView.find({ tenant: req.tenantId, screen, $or: [{ user: req.auth.uid }, { shared: true }] }).sort({ name: 1 }).populate("user", "name").lean());
  })
);
r.post(
  "/views",
  asyncHandler(async (req: any, res: any) => {
    if (req.isClientUser) throw new ApiError(403, "Forbidden");
    const name = String(req.body?.name || "").trim();
    const screen = String(req.body?.screen || "").trim();
    if (!name || !screen) throw new ApiError(400, "Enter a name for the view");
    const filters = req.body?.filters && typeof req.body.filters === "object" ? req.body.filters : {};
    ok(res, await PmSavedView.create({ tenant: req.tenantId, user: req.auth.uid, screen, name, filters, shared: !!req.body?.shared }), 201);
  })
);
r.delete(
  "/views/:id",
  asyncHandler(async (req: any, res: any) => {
    const done = await PmSavedView.deleteOne({ _id: req.params.id, tenant: req.tenantId, user: req.auth.uid });
    if (!done.deletedCount) throw new ApiError(404, "You can only delete your own views");
    ok(res, { deleted: true });
  })
);

export default r;
