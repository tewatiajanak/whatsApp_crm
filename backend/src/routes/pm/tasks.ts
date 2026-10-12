import { Router } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { Types } from "mongoose";
import { ok, asyncHandler, ApiError, paginated } from "../../utils/http";
import { User } from "../../models/User";
import { PmMaster } from "../../models/pm/Setup";
import { TAT_UNITS } from "../../models/pm/Product";
import { PmProject, PmProjectModule, PmTask, PmComment, PmActivity, PmAssignment, nextNumber } from "../../models/pm/Project";
import { addTat, findCycle } from "../../services/pm/dateEngine";
import { getPmSettings } from "../../services/pm/masters";
import { emitPm } from "../../services/pm/events";
import { isOverdue, loadCalendar, logActivity, rescheduleProject, statusFlags, statusWith, syncProjectCompletion, visibleProjectFilter, visibleTaskFilter } from "../../services/pm/projects";
import { anyRight } from "../../services/pm/visibility";
import { reassignTasks } from "./projects";
import { changeTaskStatus } from "../../services/pm/taskStatus";

/** Tasks: list, detail, status, checklist, comments, attachments, ad-hoc tasks. */
const r = Router();
const rx = (q: any) => new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const pad = (n: number, len: number) => String(n).padStart(len, "0");
const has = (req: any, module: string, action: string) => !!(req.perms || []).find((p: any) => p.module === module)?.[action];

// "Tasks" (everyone's, by visibility) or "My Tasks" opens the task screens
const canView = anyRight(["pm_tasks", "view"], ["pm_my_tasks", "view"], ["pm_projects", "view"]);
const canAdd = anyRight(["pm_tasks", "create"], ["pm_my_tasks", "create"]);

/** A task the user may see, or 404. */
export async function findTask(req: any, id: any) {
  if (!Types.ObjectId.isValid(String(id))) throw new ApiError(404, "Task not found");
  const task = await PmTask.findOne({ _id: id, tenant: req.tenantId, ...(await visibleTaskFilter(req)) });
  if (!task) throw new ApiError(404, "Task not found");
  return task;
}
/** May this user change the task? Their own task with an edit right, or any visible task with Tasks › Edit. */
function requireEdit(req: any, task: any) {
  const mine = String(task.assignee || "") === String(req.auth.uid) || String(task.createdBy || "") === String(req.auth.uid);
  if (has(req, "pm_tasks", "edit") || (mine && has(req, "pm_my_tasks", "edit"))) return;
  throw new ApiError(403, "You cannot change this task");
}
const actor = (req: any) => ({ id: req.auth.uid, name: req.auth.name });
const ev = (req: any, task: any, data?: any) => ({ tenantId: String(req.tenantId), actorId: req.auth.uid, actorName: req.auth.name, taskId: String(task._id), projectId: task.project ? String(task.project) : undefined, moduleId: task.projectModule ? String(task.projectModule) : undefined, data });

const LIST_POPULATE = [
  { path: "assignee", select: "name photo" },
  { path: "status", select: "name color flags" },
  { path: "priority", select: "name color" },
  { path: "project", select: "name code" },
  { path: "projectModule", select: "name" },
  { path: "client", select: "name" },
];
const present = (t: any, now = new Date()) => ({
  ...t,
  overdue: isOverdue(t, now),
  checklistDone: (t.checklist || []).filter((c: any) => c.done).length,
  checklistTotal: (t.checklist || []).length,
});

/* ---- list ---- */
r.get(
  "/tasks",
  canView,
  asyncHandler(async (req: any, res: any) => {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const perPage = Math.min(500, Math.max(1, parseInt(String(req.query.perPage || "50"), 10) || 50));
    const q = req.query;
    const and: any[] = [{ tenant: req.tenantId }];
    // My Tasks only → own tasks, whatever the visibility
    if (q.mine === "1" || !has(req, "pm_tasks", "view")) and.push({ assignee: new Types.ObjectId(String(req.auth.uid)) });
    else and.push(await visibleTaskFilter(req));

    for (const [param, field] of [["project", "project"], ["module", "projectModule"], ["assignee", "assignee"], ["status", "status"], ["client", "client"], ["priority", "priority"]]) {
      if (q[param] && Types.ObjectId.isValid(String(q[param]))) and.push({ [field]: q[param] });
    }
    if (q.kind === "adhoc" || q.kind === "template") and.push({ kind: q.kind });
    if (q.standalone === "1") and.push({ project: null });
    if (q.label) and.push({ labels: String(q.label) });
    if (q.q) and.push({ $or: [{ title: rx(q.q) }, { number: rx(q.q) }] });

    const now = new Date();
    const dayStart = new Date(new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10) + "T00:00:00+05:30");
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const bucket = String(q.bucket || "");
    if (bucket === "overdue") and.push({ isCompleted: false, isPaused: false, due: { $lt: now } });
    if (bucket === "today") and.push({ isCompleted: false, due: { $gte: dayStart, $lt: dayEnd } });
    if (bucket === "week") and.push({ isCompleted: false, due: { $gte: dayStart, $lt: new Date(dayStart.getTime() + 7 * 86_400_000) } });
    if (bucket === "waiting") and.push({ isCompleted: false, isWaitingForClient: true });
    if (bucket === "open") and.push({ isCompleted: false });
    if (bucket === "completed") and.push({ isCompleted: true });
    if (bucket === "completed_month") and.push({ isCompleted: true, actualEnd: { $gte: new Date(dayStart.getFullYear(), dayStart.getMonth(), 1) } });
    if (q.from || q.to) {
      const range: any = {};
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(q.from))) range.$gte = new Date(`${q.from}T00:00:00+05:30`);
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(q.to))) range.$lt = new Date(new Date(`${q.to}T00:00:00+05:30`).getTime() + 86_400_000);
      if (Object.keys(range).length) and.push({ due: range });
    }

    const filter = { $and: and };
    // open tasks first by due date (overdue on top), completed at the end
    const sort: any = q.sort === "order" ? { projectModule: 1, order: 1 } : { isCompleted: 1, due: 1, createdAt: 1 };
    const [items, total] = await Promise.all([
      PmTask.find(filter).sort(sort).skip((page - 1) * perPage).limit(perPage).select("-autoMessages -firedRules -description").populate(LIST_POPULATE).lean(),
      PmTask.countDocuments(filter),
    ]);
    paginated(res, items.map((t) => present(t, now)), total, page, perPage);
  })
);

/* ---- My Work: tiles + my projects ---- */
r.get(
  "/my-work",
  anyRight(["pm_my_tasks", "view"], ["pm_tasks", "view"]),
  asyncHandler(async (req: any, res: any) => {
    const me = new Types.ObjectId(String(req.auth.uid));
    const tasks = await PmTask.find({ tenant: req.tenantId, assignee: me }).select("project isCompleted isPaused isWaitingForClient due actualEnd").lean();
    const now = new Date();
    const dayStart = new Date(new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10) + "T00:00:00+05:30");
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const weekEnd = new Date(dayStart.getTime() + 7 * 86_400_000);
    const monthStart = new Date(new Date(dayStart.getTime() + 330 * 60_000).toISOString().slice(0, 7) + "-01T00:00:00+05:30");
    const open = tasks.filter((t) => !t.isCompleted);
    const tiles = {
      overdue: open.filter((t) => isOverdue(t, now)).length,
      today: open.filter((t) => t.due && t.due >= dayStart && t.due < dayEnd).length,
      week: open.filter((t) => t.due && t.due >= dayStart && t.due < weekEnd).length,
      waiting: open.filter((t) => t.isWaitingForClient).length,
      completedMonth: tasks.filter((t) => t.isCompleted && t.actualEnd && t.actualEnd >= monthStart).length,
    };

    const projectIds = [...new Set(tasks.map((t) => String(t.project || "")).filter(Boolean))];
    const mineAsIncharge = await PmProject.distinct("_id", { tenant: req.tenantId, incharge: me, actualEnd: null });
    const ids = [...new Set([...projectIds, ...mineAsIncharge.map(String)])];
    const projects = await PmProject.find({ _id: { $in: ids }, tenant: req.tenantId }).select("name code plannedEnd actualEnd client").populate("client", "name").lean();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { projectStats } = require("../../services/pm/projects");
    const stats = await projectStats(req.tenantId, projects);
    ok(res, {
      tiles,
      projects: projects
        .map((p: any) => ({
          _id: p._id, name: p.name, code: p.code, client: p.client?.name || "",
          myOpen: open.filter((t) => String(t.project) === String(p._id)).length,
          stats: stats.projects.get(String(p._id)),
        }))
        .filter((p: any) => !p.stats?.schedule?.startsWith("completed") || p.myOpen)
        .sort((a: any, b: any) => b.myOpen - a.myOpen),
    });
  })
);

/* ---- detail ---- */
r.get(
  "/tasks/:id",
  canView,
  asyncHandler(async (req: any, res: any) => {
    const found = await findTask(req, req.params.id);
    const [task, comments, activity, settings, statuses]: any[] = await Promise.all([
      PmTask.findById(found._id)
        .populate([...LIST_POPULATE, { path: "taskType", select: "name" }, { path: "dependsOn", select: "title number isCompleted status due", populate: { path: "status", select: "name color" } }, { path: "attachments.by", select: "name" }, { path: "checklist.doneBy", select: "name" }, { path: "watchers", select: "name photo" }])
        .lean(),
      PmComment.find({ tenant: req.tenantId, task: found._id }).sort({ createdAt: 1 }).populate("by", "name photo").lean(),
      PmActivity.find({ tenant: req.tenantId, task: found._id }).sort({ createdAt: -1 }).limit(100).lean(),
      getPmSettings(req.tenantId),
      PmMaster.find({ tenant: req.tenantId, type: "task_status", active: true }).sort({ order: 1 }).lean(),
    ]);
    // the statuses this task may move to
    const flow = settings.taskStatusFlow || [];
    const current = String(found.status || "");
    const next = statuses.filter((s: any) => String(s._id) !== current && (!flow.length || flow.some((f: any) => String(f.from) === current && String(f.to) === String(s._id))));
    const waitingFor = (task.dependsOn || []).filter((d: any) => !d.isCompleted);
    const counted = (task.attachments || []).filter((a: any) => settings.pastedImagesCount || !a.pasted).length;
    ok(res, {
      task: present(task),
      comments,
      activity,
      nextStatuses: next,
      waitingFor,
      limits: { maxAttachments: settings.maxAttachments, used: counted, maxFileSizeMb: settings.maxFileSizeMb, allowedFileTypes: settings.allowedFileTypes },
      canEdit: has(req, "pm_tasks", "edit") || ((String(found.assignee || "") === String(req.auth.uid) || String(found.createdBy || "") === String(req.auth.uid)) && has(req, "pm_my_tasks", "edit")),
    });
  })
);

/* ---- ad-hoc task ---- */
r.post(
  "/tasks",
  canAdd,
  asyncHandler(async (req: any, res: any) => {
    const b = req.body || {};
    const title = String(b.title || "").trim();
    if (!title) throw new ApiError(400, "Enter the task title");

    let project: any = null;
    let mod: any = null;
    if (b.project) {
      project = await PmProject.findOne({ _id: b.project, tenant: req.tenantId, ...(await visibleProjectFilter(req)) }).lean();
      if (!project) throw new ApiError(400, "Choose a valid project");
      if (b.projectModule) {
        mod = await PmProjectModule.findOne({ _id: b.projectModule, tenant: req.tenantId, project: project._id }).lean();
        if (!mod) throw new ApiError(400, "Choose a valid module");
      }
    }
    // without the Tasks right a person can only give a task to themselves
    let assignee = b.assignee?._id || b.assignee || req.auth.uid;
    if (!has(req, "pm_tasks", "create") && !has(req, "pm_tasks", "assign")) assignee = req.auth.uid;
    if (!(await User.exists({ _id: assignee, tenant: req.tenantId }))) throw new ApiError(400, "Choose a valid assignee");

    const cal = await loadCalendar(req.tenantId);
    const start = new Date();
    const tatUnit = (TAT_UNITS as readonly string[]).includes(b.tatUnit) ? b.tatUnit : "working_days";
    const tatValue = Number.isFinite(Number(b.tatValue)) && Number(b.tatValue) >= 0 ? Number(b.tatValue) : 1;
    let due: Date;
    if (/^\d{4}-\d{2}-\d{2}/.test(String(b.due || ""))) {
      const s = await getPmSettings(req.tenantId);
      due = new Date(String(b.due).length === 10 ? `${b.due}T${s.workEnd}:00+05:30` : b.due);
      if (isNaN(due.getTime())) throw new ApiError(400, "Enter a valid due date");
    } else due = addTat(start, tatValue, tatUnit, cal);

    const master = async (v: any, type: string) => (v && (await PmMaster.exists({ _id: v, tenant: req.tenantId, type })) ? v : null);
    const first = (await statusWith(req.tenantId, "task_status", "isInitial")) || (await statusWith(req.tenantId, "task_status", null));
    const last = mod ? await PmTask.findOne({ tenant: req.tenantId, projectModule: mod._id }).sort({ order: -1 }).select("order").lean() : null;
    const task = await PmTask.create({
      tenant: req.tenantId,
      number: `T-${pad(await nextNumber(req.tenantId, "task"), 6)}`,
      title,
      kind: "adhoc",
      project: project?._id || null,
      projectModule: mod?._id || null,
      client: project?.client || null,
      product: project?.product || null,
      taskType: await master(b.taskType, "task_type"),
      priority: await master(b.priority, "priority"),
      assignee,
      status: first?._id || null,
      ...statusFlags(first),
      tatValue,
      tatUnit,
      order: (last?.order || 0) + 1,
      plannedStart: start,
      plannedDue: due,
      start,
      due,
      clientVisible: false,
      description: String(b.description || ""),
      checklist: (Array.isArray(b.checklist) ? b.checklist : []).map((c: any, i: number) => ({ text: String(c?.text ?? c ?? "").trim(), order: i + 1, mandatory: !!c?.mandatory, done: false })).filter((c: any) => c.text),
      createdBy: req.auth.uid,
    });
    await PmAssignment.create({ tenant: req.tenantId, entity: "task", entityId: task._id, project: project?._id || null, from: null, to: assignee, reason: "Task created", by: req.auth.uid });
    await logActivity({ tenant: req.tenantId, project: project?._id, task: task._id, kind: "created", text: "Task created", by: req.auth.uid, byName: req.auth.name });
    emitPm("task_assigned", ev(req, task));
    ok(res, task, 201);
  })
);

/* ---- edit fields ---- */
r.patch(
  "/tasks/:id",
  canView,
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    requireEdit(req, task);
    const b = req.body || {};
    const master = async (v: any, type: string) => (v && (await PmMaster.exists({ _id: v, tenant: req.tenantId, type })) ? v : null);
    if (b.title !== undefined) {
      const title = String(b.title || "").trim();
      if (!title) throw new ApiError(400, "Enter the task title");
      task.title = title;
    }
    if (b.description !== undefined) task.description = String(b.description || "");
    if (b.priority !== undefined) task.priority = await master(b.priority, "priority");
    if (b.taskType !== undefined) task.taskType = await master(b.taskType, "task_type");
    if (b.clientVisible !== undefined) task.clientVisible = !!b.clientVisible;
    if (b.milestone !== undefined) task.milestone = !!b.milestone;
    if (b.labels !== undefined) task.labels = [...new Set((Array.isArray(b.labels) ? b.labels : []).map((x: any) => String(x).trim()).filter(Boolean))].slice(0, 10) as string[];
    if (b.autoMessages !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      task.autoMessages = await require("../../services/pm/rules").cleanRules(req.tenantId, "task", b.autoMessages);
      task.markModified("autoMessages");
    }
    if (b.checklist !== undefined) {
      // add / rename / remove items; ticks are kept
      const old = new Map(task.checklist.map((c: any) => [String(c._id), c]));
      task.checklist = (Array.isArray(b.checklist) ? b.checklist : [])
        .map((c: any, i: number) => {
          const prev: any = c?._id ? old.get(String(c._id)) : null;
          return { ...(prev ? { _id: prev._id, done: prev.done, doneBy: prev.doneBy, doneAt: prev.doneAt } : { done: false }), text: String(c?.text || "").trim(), order: i + 1, mandatory: !!c?.mandatory };
        })
        .filter((c: any) => c.text) as any;
    }
    if (b.dependsOn !== undefined && task.project) {
      const ids = ([...new Set((Array.isArray(b.dependsOn) ? b.dependsOn : []).map((d: any) => String(d?._id || d)))] as string[]).filter((d) => d !== String(task._id));
      const all = await PmTask.find({ tenant: req.tenantId, project: task.project }).select("title dependsOn").lean();
      if (ids.some((d) => !all.some((t) => String(t._id) === d))) throw new ApiError(400, "A task can only depend on tasks of the same project");
      const graph = all.map((t: any) => ({ id: String(t._id), dependsOn: String(t._id) === String(task._id) ? ids : (t.dependsOn || []).map(String) }));
      const loop = findCycle(graph);
      if (loop.length) throw new ApiError(400, `Circular dependency: ${loop.map((id) => all.find((t) => String(t._id) === id)?.title).join(" → ")}`);
      task.dependsOn = ids as any;
    }
    let dueChanged = false;
    if (b.due !== undefined && b.due) {
      const s = await getPmSettings(req.tenantId);
      const due = new Date(String(b.due).length === 10 ? `${b.due}T${s.workEnd}:00+05:30` : b.due);
      if (isNaN(due.getTime())) throw new ApiError(400, "Enter a valid due date");
      if (!task.due || Math.abs(due.getTime() - task.due.getTime()) > 60_000) {
        const fmt = (d?: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10).split("-").reverse().join("-") : "—");
        await logActivity({ tenant: req.tenantId, project: task.project, task: task._id, kind: "dates", text: `Due date changed${b.reason ? ` — ${String(b.reason).trim()}` : ""}`, from: fmt(task.due), to: fmt(due), by: req.auth.uid, byName: req.auth.name });
        task.due = due;
        task.dueLocked = true;
        dueChanged = true;
      }
    }
    await task.save();
    // dependents follow a changed due date / changed dependencies
    if ((dueChanged || b.dependsOn !== undefined) && task.project) await rescheduleAfter(req, task, dueChanged);
    ok(res, task);
  })
);

/** Dependents of a task follow its (new) end. */
async function rescheduleAfter(req: any, task: any, _dueChanged: boolean) {
  if (!task.project) return [];
  return rescheduleProject(req.tenantId, task.project, actor(req), `after ${task.title}`);
}

/* ---- reassign one task ---- */
r.post(
  "/tasks/:id/reassign",
  anyRight(["pm_tasks", "reassign"], ["pm_tasks", "assign"]),
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    const to = String(req.body?.to?._id || req.body?.to || "");
    if (!to || !(await User.exists({ _id: to, tenant: req.tenantId }))) throw new ApiError(400, "Choose the new assignee");
    const reason = String(req.body?.reason || "").trim();
    if (task.assignee && !reason) throw new ApiError(400, "Enter the reason");
    if (String(task.assignee || "") === to) throw new ApiError(400, "This person already has the task");
    await reassignTasks(req, [task], to, reason || "Assigned");
    ok(res, { assignee: to });
  })
);

/* ---- status ---- */
r.post(
  "/tasks/:id/status",
  canView,
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    requireEdit(req, task);
    ok(res, await changeTaskStatus(req.tenantId, task, req.body?.status, actor(req)));
  })
);

/* ---- checklist tick ---- */
r.post(
  "/tasks/:id/checklist/:itemId",
  canView,
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    requireEdit(req, task);
    const item: any = task.checklist.find((c: any) => String(c._id) === String(req.params.itemId));
    if (!item) throw new ApiError(404, "Checklist item not found");
    const done = !!req.body?.done;
    if (item.done !== done) {
      item.done = done;
      item.doneBy = done ? req.auth.uid : null;
      item.doneAt = done ? new Date() : null;
      await task.save();
      await logActivity({ tenant: req.tenantId, project: task.project, task: task._id, kind: "checklist", text: `${done ? "Ticked" : "Unticked"}: ${item.text}`, by: req.auth.uid, byName: req.auth.name });
    }
    ok(res, { done: task.checklist.filter((c: any) => c.done).length, total: task.checklist.length });
  })
);

/* ---- comments ---- */
r.post(
  "/tasks/:id/comments",
  canView,
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    const text = String(req.body?.text || "").trim();
    if (!text) throw new ApiError(400, "Write a comment");
    if (text.length > 10_000) throw new ApiError(400, "The comment is too long");
    // mentions are written as @[Name](userId)
    const ids = [...text.matchAll(/@\[[^\]]+\]\(([0-9a-f]{24})\)/g)].map((m) => m[1]);
    const mentions = ids.length ? (await User.find({ _id: { $in: ids }, tenant: req.tenantId }).select("_id").lean()).map((u) => u._id) : [];
    const comment = await PmComment.create({ tenant: req.tenantId, task: task._id, project: task.project, by: req.auth.uid, text, mentions, clientVisible: !!req.body?.clientVisible });
    await logActivity({ tenant: req.tenantId, project: task.project, task: task._id, kind: "comment", text: "Commented", by: req.auth.uid, byName: req.auth.name });
    if (mentions.length) emitPm("task_mentioned", ev(req, task, { users: mentions.map(String) }));
    ok(res, await comment.populate("by", "name photo"), 201);
  })
);

r.delete(
  "/comments/:id",
  canView,
  asyncHandler(async (req: any, res: any) => {
    const c = await PmComment.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!c) throw new ApiError(404, "Comment not found");
    if (String(c.by) !== String(req.auth.uid) && !has(req, "pm_tasks", "del")) throw new ApiError(403, "You can only delete your own comment");
    await c.deleteOne();
    ok(res, { deleted: true });
  })
);

/* ---- attachments: kept in a private folder, served only through this API ---- */
export const PM_FILES = path.join(process.cwd(), "pm-files");
const upload = multer({ dest: path.join(os.tmpdir(), "whatsapp_crm_uploads"), limits: { fileSize: 50 * 1024 * 1024 } });
const IMAGE = /^image\/(png|jpe?g|webp|gif)$/;

r.post(
  "/tasks/:id/attachments",
  canView,
  upload.single("file"),
  asyncHandler(async (req: any, res: any) => {
    const tmp = req.file?.path;
    try {
      const task = await findTask(req, req.params.id);
      if (!req.file) throw new ApiError(400, "Choose a file");
      const pasted = req.body?.pasted === "1";
      if (!pasted) requireEdit(req, task);
      const s = await getPmSettings(req.tenantId);
      const ext = path.extname(req.file.originalname || "").slice(1).toLowerCase() || (req.file.mimetype || "").split("/")[1] || "";
      if (pasted ? !IMAGE.test(req.file.mimetype) : !s.allowedFileTypes.includes(ext)) throw new ApiError(400, pasted ? "Only images can be pasted" : `.${ext || "?"} files are not allowed`);
      if (req.file.size > s.maxFileSizeMb * 1024 * 1024) throw new ApiError(400, `The file is larger than ${s.maxFileSizeMb} MB`);
      const counted = task.attachments.filter((a: any) => s.pastedImagesCount || !a.pasted).length;
      if ((!pasted || s.pastedImagesCount) && counted >= s.maxAttachments) throw new ApiError(400, `A task can have at most ${s.maxAttachments} attachments`);

      const dir = path.join(PM_FILES, String(req.tenantId));
      fs.mkdirSync(dir, { recursive: true });
      const file = `${task._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? `.${ext.replace(/[^a-z0-9]/g, "")}` : ""}`;
      fs.copyFileSync(tmp, path.join(dir, file));
      task.attachments.push({ name: pasted ? `pasted-${Date.now()}.${ext || "png"}` : String(req.file.originalname).slice(0, 180), file, size: req.file.size, mime: req.file.mimetype, by: req.auth.uid, at: new Date(), clientVisible: req.body?.clientVisible === "1", pasted } as any);
      await task.save();
      const made: any = task.attachments[task.attachments.length - 1];
      if (!pasted) await logActivity({ tenant: req.tenantId, project: task.project, task: task._id, kind: "attachment", text: `Attached ${made.name}`, by: req.auth.uid, byName: req.auth.name });
      ok(res, made, 201);
    } finally {
      if (tmp) fs.rm(tmp, () => {});
    }
  })
);

r.get(
  "/tasks/:id/attachments/:attId",
  canView,
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    const a: any = task.attachments.find((x: any) => String(x._id) === String(req.params.attId));
    if (!a) throw new ApiError(404, "File not found");
    const full = path.join(PM_FILES, String(req.tenantId), path.basename(a.file));
    if (!fs.existsSync(full)) throw new ApiError(404, "File not found");
    res.setHeader("Content-Type", a.mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `${req.query.download === "1" ? "attachment" : "inline"}; filename="${encodeURIComponent(a.name)}"`);
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    fs.createReadStream(full).pipe(res);
  })
);

r.patch(
  "/tasks/:id/attachments/:attId",
  canView,
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    requireEdit(req, task);
    const a: any = task.attachments.find((x: any) => String(x._id) === String(req.params.attId));
    if (!a) throw new ApiError(404, "File not found");
    a.clientVisible = !!req.body?.clientVisible;
    await task.save();
    ok(res, a);
  })
);

r.delete(
  "/tasks/:id/attachments/:attId",
  canView,
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    const a: any = task.attachments.find((x: any) => String(x._id) === String(req.params.attId));
    if (!a) throw new ApiError(404, "File not found");
    if (String(a.by) !== String(req.auth.uid) && !has(req, "pm_tasks", "del")) throw new ApiError(403, "You can only delete your own uploads");
    task.attachments = task.attachments.filter((x: any) => String(x._id) !== String(a._id)) as any;
    await task.save();
    fs.rm(path.join(PM_FILES, String(req.tenantId), path.basename(a.file)), () => {});
    await logActivity({ tenant: req.tenantId, project: task.project, task: task._id, kind: "attachment", text: `Removed ${a.name}`, by: req.auth.uid, byName: req.auth.name });
    ok(res, { deleted: true });
  })
);

/* ---- delete a task (ad-hoc, or with the Tasks › Delete right) ---- */
r.delete(
  "/tasks/:id",
  canView,
  asyncHandler(async (req: any, res: any) => {
    const task = await findTask(req, req.params.id);
    const own = task.kind === "adhoc" && String(task.createdBy || "") === String(req.auth.uid);
    if (!has(req, "pm_tasks", "del") && !own) throw new ApiError(403, "You cannot delete this task");
    await Promise.all([
      PmTask.updateMany({ tenant: req.tenantId, dependsOn: task._id }, { $pull: { dependsOn: task._id } }),
      PmComment.deleteMany({ tenant: req.tenantId, task: task._id }),
    ]);
    task.attachments.forEach((a: any) => fs.rm(path.join(PM_FILES, String(req.tenantId), path.basename(a.file)), () => {}));
    await task.deleteOne();
    if (task.project) {
      await logActivity({ tenant: req.tenantId, project: task.project, kind: "edit", text: `Task deleted: ${task.title}`, by: req.auth.uid, byName: req.auth.name });
      await rescheduleProject(req.tenantId, task.project, actor(req), "Task deleted");
    }
    ok(res, { deleted: true });
  })
);

export default r;
