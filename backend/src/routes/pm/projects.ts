import { Router } from "express";
import { Types } from "mongoose";
import { ok, asyncHandler, ApiError, audit, paginated } from "../../utils/http";
import { User } from "../../models/User";
import { PmMaster } from "../../models/pm/Setup";
import { PmClient } from "../../models/pm/Client";
import { PmProduct, PmProductModule, PmTaskTemplate, TAT_UNITS } from "../../models/pm/Product";
import { PmProject, PmProjectModule, PmTask, PmActivity, PmAssignment, PmComment, nextNumber } from "../../models/pm/Project";
import { addTat, calculateSchedule, findCycle } from "../../services/pm/dateEngine";
import { getPmSettings } from "../../services/pm/masters";
import { emitPm } from "../../services/pm/events";
import { computeStats, loadCalendar, logActivity, projectStats, rescheduleProject, statusFlags, statusWith, visibleProjectFilter, visibleTaskFilter } from "../../services/pm/projects";
import { pmRight } from "../../services/pm/visibility";

/** Projects: create from a product template, list, detail, assignment. */
const r = Router();
const AUDIT = "Project Management";
const rx = (q: any) => new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const pad = (n: number, len: number) => String(n).padStart(len, "0");
const actor = (req: any) => ({ id: req.auth.uid, name: req.auth.name });
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function employeeId(req: any, value: any, what: string, required = false) {
  const id = value?._id || value || null;
  if (!id) {
    if (required) throw new ApiError(400, `Choose the ${what}`);
    return null;
  }
  if (!(await User.exists({ _id: id, tenant: req.tenantId }))) throw new ApiError(400, `Choose a valid ${what}`);
  return String(id);
}

/** The project's start moment: the start date at the opening time of the working day. */
async function startMoment(tenantId: any, date: string) {
  const s = await getPmSettings(tenantId);
  return new Date(`${date}T${s.workStart}:00+05:30`);
}

/**
 * Turn the wizard's choices into the plan of a project: which modules and
 * tasks, who does them, and the dates. Used for the live preview AND the save.
 *
 * body.modules (optional): [{ module, incharge, tasks: [{ task, assignee, tatValue, tatUnit }], excluded: [taskId], extra: [{ title, assignee, tatValue, tatUnit }] }]
 * When body.modules is missing, every active module of the product is taken as it is.
 */
export async function buildPlan(req: any, body: any, productId: any, start: Date) {
  const [modules, templates, cal] = await Promise.all([
    PmProductModule.find({ tenant: req.tenantId, product: productId, active: true }).sort({ order: 1 }).lean(),
    PmTaskTemplate.find({ tenant: req.tenantId, product: productId }).sort({ order: 1 }).lean(),
    loadCalendar(req.tenantId),
  ]);
  const chosen: any[] = Array.isArray(body.modules) ? body.modules : modules.map((m) => ({ module: m._id }));
  const people = new Set((await User.find({ tenant: req.tenantId }).select("_id").lean()).map((u) => String(u._id)));
  const person = (v: any) => {
    const id = String(v?._id || v || "");
    return id && people.has(id) ? id : null;
  };

  const plan: any[] = [];
  const taken = new Map<string, any>(); // template id → planned task
  for (const c of chosen) {
    const mod = modules.find((m) => String(m._id) === String(c.module?._id || c.module));
    if (!mod) continue;
    const excluded = new Set((c.excluded || []).map(String));
    const edits = new Map<string, any>((c.tasks || []).map((t: any) => [String(t.task?._id || t.task), t]));
    const tasks: any[] = [];
    for (const t of templates.filter((x) => String(x.module) === String(mod._id))) {
      if (excluded.has(String(t._id))) continue;
      const e = edits.get(String(t._id)) || {};
      const tatValue = e.tatValue !== undefined && Number.isFinite(Number(e.tatValue)) && Number(e.tatValue) >= 0 ? Number(e.tatValue) : t.tatValue;
      const task = {
        id: String(t._id),
        source: t,
        title: t.title,
        assignee: e.assignee !== undefined ? person(e.assignee) : t.defaultAssignee ? String(t.defaultAssignee) : null,
        tatValue,
        tatUnit: (TAT_UNITS as readonly string[]).includes(e.tatUnit) ? e.tatUnit : t.tatUnit,
        dependsOn: [] as string[],
      };
      tasks.push(task);
      taken.set(task.id, task);
    }
    (c.extra || []).forEach((x: any) => {
      const title = String(x?.title || "").trim();
      if (!title) return;
      tasks.push({
        id: String(new Types.ObjectId()),
        source: null,
        title,
        assignee: person(x.assignee),
        tatValue: Number.isFinite(Number(x.tatValue)) && Number(x.tatValue) >= 0 ? Number(x.tatValue) : 1,
        tatUnit: (TAT_UNITS as readonly string[]).includes(x.tatUnit) ? x.tatUnit : "working_days",
        dependsOn: [],
      });
    });
    plan.push({
      source: mod,
      name: mod.name,
      incharge: c.incharge !== undefined ? person(c.incharge) : mod.defaultIncharge ? String(mod.defaultIncharge) : null,
      tasks,
    });
  }
  if (!plan.length) throw new ApiError(400, "Choose at least one module");

  // dependencies: a task left out hands its own predecessors to the tasks that waited for it
  const tplDeps = new Map(templates.map((t) => [String(t._id), (t.dependsOn || []).map(String)]));
  const resolve = (id: string, seen = new Set<string>()): string[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    return (tplDeps.get(id) || []).flatMap((d) => (taken.has(d) ? [d] : resolve(d, seen)));
  };
  for (const t of taken.values()) t.dependsOn = [...new Set(resolve(t.id))];

  const all = plan.flatMap((m) => m.tasks);
  const loop = findCycle(all.map((t: any) => ({ id: t.id, dependsOn: t.dependsOn })));
  if (loop.length) throw new ApiError(400, `Circular dependency: ${loop.map((id) => all.find((t: any) => t.id === id)?.title).join(" → ")}`);
  const schedule = calculateSchedule(all.map((t: any) => ({ id: t.id, tatValue: t.tatValue, tatUnit: t.tatUnit, dependsOn: t.dependsOn })), start, cal);
  let end = start;
  for (const t of all) {
    const d = schedule.get(t.id)!;
    t.start = d.start;
    t.due = d.due;
    if (d.due > end) end = d.due;
  }
  return { plan, end, cal };
}

async function projectHeader(req: any, body: any) {
  const clientId = body.client?._id || body.client;
  const productId = body.product?._id || body.product;
  const [client, product] = await Promise.all([
    PmClient.findOne({ _id: clientId, tenant: req.tenantId }).lean().catch(() => null),
    PmProduct.findOne({ _id: productId, tenant: req.tenantId }).lean().catch(() => null),
  ]);
  if (!client) throw new ApiError(400, "Choose the client");
  if (!product) throw new ApiError(400, "Choose the product");
  if (!DATE.test(String(body.startDate || ""))) throw new ApiError(400, "Choose the start date");
  return { client, product, start: await startMoment(req.tenantId, body.startDate) };
}

/* ---- live preview of the dates while the wizard is open ---- */
r.post(
  "/projects/preview",
  pmRight("projects", "create"),
  asyncHandler(async (req: any, res: any) => {
    const { product, start } = await projectHeader(req, req.body);
    const { plan, end } = await buildPlan(req, req.body, product._id, start);
    ok(res, {
      start,
      end,
      modules: plan.map((m) => ({
        module: String(m.source._id),
        name: m.name,
        incharge: m.incharge,
        autoMessages: (m.source.autoMessages || []).length,
        tasks: m.tasks.map((t: any) => ({
          task: t.source ? t.id : null,
          id: t.id,
          title: t.title,
          assignee: t.assignee,
          tatValue: t.tatValue,
          tatUnit: t.tatUnit,
          start: t.start,
          due: t.due,
          dependsOn: t.dependsOn,
          checklist: t.source?.checklist?.length || 0,
          autoMessages: t.source?.autoMessages?.length || 0,
          clientVerification: !!t.source?.clientVerification,
        })),
      })),
    });
  })
);

/** Write the modules and tasks of a plan into a project. Returns how many tasks were made. */
export async function writePlan(req: any, project: any, plan: any[], firstOrder: number, isDemo = false) {
  const initial = await statusWith(req.tenantId, "task_status", null);
  const first = (await statusWith(req.tenantId, "task_status", "isInitial")) || initial;
  const count = plan.reduce((n, m) => n + m.tasks.length, 0);
  const lastNumber = await nextNumber(req.tenantId, "task", count);
  let number = lastNumber - count;

  const idOf = new Map<string, Types.ObjectId>();
  plan.forEach((m) => m.tasks.forEach((t: any) => idOf.set(t.id, new Types.ObjectId())));

  const docs: any[] = [];
  const assignments: any[] = [];
  let order = firstOrder;
  for (const m of plan) {
    const mod = await PmProjectModule.create({
      tenant: req.tenantId,
      project: project._id,
      name: m.name,
      order: ++order,
      incharge: m.incharge,
      sourceModule: m.source._id,
      autoMessages: m.source.autoMessages || [],
    });
    if (m.incharge) assignments.push({ tenant: req.tenantId, entity: "module", entityId: mod._id, project: project._id, from: null, to: m.incharge, reason: "Project created", by: req.auth.uid });
    m.tasks.forEach((t: any, i: number) => {
      const src = t.source;
      const _id = idOf.get(t.id)!;
      docs.push({
        _id,
        tenant: req.tenantId,
        number: `T-${pad(++number, 6)}`,
        title: t.title,
        kind: src ? "template" : "adhoc",
        project: project._id,
        projectModule: mod._id,
        client: project.client,
        product: project.product,
        taskType: src?.taskType || null,
        priority: src?.priority || project.priority || null,
        assignee: t.assignee,
        status: first?._id || null,
        ...statusFlags(first),
        tatValue: t.tatValue,
        tatUnit: t.tatUnit,
        order: i + 1,
        dependsOn: t.dependsOn.map((d: string) => idOf.get(d)).filter(Boolean),
        plannedStart: t.start,
        plannedDue: t.due,
        start: t.start,
        due: t.due,
        clientVerification: !!src?.clientVerification,
        clientVisible: src ? !!src.clientVisible : true,
        attachmentRequired: !!(src?.attachmentRequired || src?.mandatoryAttachment),
        mandatoryAttachment: !!src?.mandatoryAttachment,
        description: src?.description || "",
        checklist: (src?.checklist || []).map((c: any) => ({ text: c.text, order: c.order, mandatory: c.mandatory, done: false })),
        autoMessages: src?.autoMessages || [],
        createdBy: req.auth.uid,
        isDemo,
      });
      if (t.assignee) assignments.push({ tenant: req.tenantId, entity: "task", entityId: _id, project: project._id, from: null, to: t.assignee, reason: "Project created", by: req.auth.uid });
    });
  }
  if (docs.length) await PmTask.insertMany(docs);
  if (assignments.length) await PmAssignment.insertMany(assignments);
  return docs;
}

/* ---- create ---- */
r.post(
  "/projects",
  pmRight("projects", "create"),
  asyncHandler(async (req: any, res: any) => {
    const b = req.body || {};
    const { client, product, start } = await projectHeader(req, b);
    const name = String(b.name || "").trim() || `${client.name} – ${product.name}`;
    const incharge = await employeeId(req, b.incharge, "project incharge", true);
    const { plan, end } = await buildPlan(req, b, product._id, start);

    const master = async (v: any, type: string) => {
      const id = v?._id || v || null;
      return id && (await PmMaster.exists({ _id: id, tenant: req.tenantId, type })) ? id : null;
    };
    const status = (await master(b.status, "project_status")) || (await statusWith(req.tenantId, "project_status", null))?._id || null;
    const code = `PRJ-${pad(await nextNumber(req.tenantId, "project"), 4)}`;

    const project = await PmProject.create({
      tenant: req.tenantId,
      code,
      name,
      client: client._id,
      product: product._id,
      incharge,
      priority: await master(b.priority, "priority"),
      status,
      startDate: start,
      plannedEnd: end,
      autoMessages: product.autoMessages || [],
      createdBy: req.auth.uid,
      isDemo: !!b.isDemo && !!client.isDemo,
    });
    let tasks: any[] = [];
    try {
      tasks = await writePlan(req, project, plan, 0, project.isDemo);
    } catch (e) {
      // leave nothing half-made behind
      await Promise.all([
        PmTask.deleteMany({ tenant: req.tenantId, project: project._id }),
        PmProjectModule.deleteMany({ tenant: req.tenantId, project: project._id }),
        PmAssignment.deleteMany({ tenant: req.tenantId, project: project._id }),
        PmProject.deleteOne({ _id: project._id }),
      ]);
      throw e;
    }
    await PmAssignment.create({ tenant: req.tenantId, entity: "project", entityId: project._id, project: project._id, from: null, to: incharge, reason: "Project created", by: req.auth.uid });
    await logActivity({ tenant: req.tenantId, project: project._id, kind: "created", text: `Project created with ${plan.length} modules and ${tasks.length} tasks`, by: req.auth.uid, byName: req.auth.name });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Project ${code} ${name}` });
    emitPm("project_created", { tenantId: String(req.tenantId), actorId: req.auth.uid, actorName: req.auth.name, projectId: String(project._id) });
    tasks.filter((t) => t.assignee).forEach((t) => emitPm("task_assigned", { tenantId: String(req.tenantId), actorId: req.auth.uid, actorName: req.auth.name, taskId: String(t._id), projectId: String(project._id), data: { quiet: true } }));
    ok(res, project, 201);
  })
);

/* ---- list ---- */
r.get(
  "/projects",
  pmRight("projects", "view"),
  asyncHandler(async (req: any, res: any) => {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(String(req.query.perPage || "50"), 10) || 50));
    const filter: any = { tenant: req.tenantId, ...(await visibleProjectFilter(req)) };
    for (const k of ["client", "product", "incharge", "status"]) if (req.query[k] && Types.ObjectId.isValid(String(req.query[k]))) filter[k] = req.query[k];
    if (req.query.q) filter.$and = [{ $or: [{ name: rx(req.query.q) }, { code: rx(req.query.q) }] }];

    // the schedule status is calculated, so that filter is applied after the numbers are known
    const all = await PmProject.find(filter)
      .sort({ createdAt: -1 })
      .populate("client", "name code")
      .populate("product", "name code")
      .populate("incharge", "name photo")
      .populate("status", "name color flags")
      .populate("priority", "name color")
      .lean();
    const { projects: stats } = await projectStats(req.tenantId, all);
    let rows = all.map((p: any) => ({ ...p, stats: stats.get(String(p._id)) }));
    const sched = String(req.query.schedule || "");
    if (sched) rows = rows.filter((p) => (sched === "completed" ? p.stats?.schedule?.startsWith("completed") : p.stats?.schedule === sched));
    paginated(res, rows.slice((page - 1) * perPage, page * perPage), rows.length, page, perPage);
  })
);

/** A project the user may see, or 404. */
export async function findProject(req: any, id: any) {
  if (!Types.ObjectId.isValid(String(id))) throw new ApiError(404, "Project not found");
  const doc = await PmProject.findOne({ _id: id, tenant: req.tenantId, ...(await visibleProjectFilter(req)) });
  if (!doc) throw new ApiError(404, "Project not found");
  return doc;
}

/* ---- detail ---- */
r.get(
  "/projects/:id",
  pmRight("projects", "view"),
  asyncHandler(async (req: any, res: any) => {
    const found = await findProject(req, req.params.id);
    const [project, modules] = await Promise.all([
      PmProject.findById(found._id)
        .populate("client", "name code city contacts")
        .populate("product", "name code")
        .populate("incharge", "name photo")
        .populate("status", "name color flags")
        .populate("priority", "name color")
        .lean(),
      PmProjectModule.find({ tenant: req.tenantId, project: found._id }).sort({ order: 1 }).populate("incharge", "name photo").lean(),
    ]);
    const stats = await projectStats(req.tenantId, [found]);
    ok(res, {
      project: { ...project, stats: stats.projects.get(String(found._id)) },
      modules: modules.map((m: any) => ({ ...m, stats: stats.modules.get(String(m._id)) || computeStats([], null, { ahead: 5, delayed: 5 }) })),
    });
  })
);

/* ---- edit the header ---- */
r.patch(
  "/projects/:id",
  pmRight("projects", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const project = await findProject(req, req.params.id);
    const b = req.body || {};
    if (b.name !== undefined) {
      const name = String(b.name || "").trim();
      if (!name) throw new ApiError(400, "Enter the project name");
      project.name = name;
    }
    if (b.priority !== undefined) project.priority = b.priority && (await PmMaster.exists({ _id: b.priority, tenant: req.tenantId, type: "priority" })) ? b.priority : null;
    if (b.status !== undefined) {
      const st: any = await PmMaster.findOne({ _id: b.status, tenant: req.tenantId, type: "project_status" }).lean();
      if (!st) throw new ApiError(400, "Choose a valid status");
      if (String(project.status || "") !== String(st._id)) {
        const before: any = project.status ? await PmMaster.findById(project.status).select("name").lean() : null;
        project.status = st._id;
        if (st.flags?.isCompleted && !project.actualEnd) project.actualEnd = new Date();
        if (!st.flags?.isCompleted && !st.flags?.isCancelled && project.actualEnd && (await PmTask.exists({ tenant: req.tenantId, project: project._id, isCompleted: false }))) project.actualEnd = null;
        await logActivity({ tenant: req.tenantId, project: project._id, kind: "status", text: "Project status changed", from: before?.name || "—", to: st.name, by: req.auth.uid, byName: req.auth.name });
        if (st.flags?.isCompleted) emitPm("project_completed", { tenantId: String(req.tenantId), actorId: req.auth.uid, actorName: req.auth.name, projectId: String(project._id) });
      }
    }
    if (b.autoMessages !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      project.autoMessages = await require("../../services/pm/rules").cleanRules(req.tenantId, "project", b.autoMessages);
      project.markModified("autoMessages");
    }
    let moved: any[] = [];
    if (b.startDate !== undefined) {
      if (!DATE.test(String(b.startDate))) throw new ApiError(400, "Choose the start date");
      const start = await startMoment(req.tenantId, b.startDate);
      if (start.getTime() !== project.startDate.getTime()) {
        project.startDate = start;
        await project.save();
        moved = await rescheduleProject(req.tenantId, project._id, actor(req), "Project start changed");
      }
    }
    await project.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: AUDIT, entity: `Project ${project.code}` });
    ok(res, { project, moved: moved.length });
  })
);

r.delete(
  "/projects/:id",
  pmRight("projects", "del"),
  asyncHandler(async (req: any, res: any) => {
    const project = await findProject(req, req.params.id);
    const tasks = await PmTask.distinct("_id", { tenant: req.tenantId, project: project._id });
    await Promise.all([
      PmComment.deleteMany({ tenant: req.tenantId, task: { $in: tasks } }),
      PmActivity.deleteMany({ tenant: req.tenantId, project: project._id }),
      PmAssignment.deleteMany({ tenant: req.tenantId, project: project._id }),
      PmTask.deleteMany({ tenant: req.tenantId, project: project._id }),
      PmProjectModule.deleteMany({ tenant: req.tenantId, project: project._id }),
    ]);
    await project.deleteOne();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: AUDIT, entity: `Project ${project.code} ${project.name}` });
    ok(res, { deleted: true });
  })
);

/* ---- add a module from the product template to a running project ---- */
r.post(
  "/projects/:id/modules",
  pmRight("projects", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const project = await findProject(req, req.params.id);
    const source = req.body?.module;
    if (await PmProjectModule.exists({ tenant: req.tenantId, project: project._id, sourceModule: source })) throw new ApiError(409, "This module is already in the project");
    const start = new Date(Math.max(Date.now(), project.startDate.getTime()));
    const { plan } = await buildPlan(req, { modules: [{ module: source, incharge: req.body?.incharge }] }, project.product, start);
    const last = await PmProjectModule.findOne({ tenant: req.tenantId, project: project._id }).sort({ order: -1 }).select("order").lean();
    const tasks = await writePlan(req, project, plan, last?.order || 0, project.isDemo);
    await logActivity({ tenant: req.tenantId, project: project._id, kind: "created", text: `Module added: ${plan[0].name} (${tasks.length} tasks)`, by: req.auth.uid, byName: req.auth.name });
    ok(res, { tasks: tasks.length }, 201);
  })
);

/* ---- save a project as a new product template ---- */
r.post(
  "/projects/:id/save-as-template",
  pmRight("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const project = await findProject(req, req.params.id);
    const name = String(req.body?.name || "").trim();
    const code = String(req.body?.code || "").trim().toUpperCase();
    if (!name || !code) throw new ApiError(400, "Enter the template name and code");
    if (await PmProduct.exists({ tenant: req.tenantId, code })) throw new ApiError(409, "Another product already has this code");
    const [modules, tasks] = await Promise.all([
      PmProjectModule.find({ tenant: req.tenantId, project: project._id }).sort({ order: 1 }).lean(),
      PmTask.find({ tenant: req.tenantId, project: project._id }).sort({ order: 1 }).lean(),
    ]);
    const product = await PmProduct.create({ tenant: req.tenantId, name, code, description: `From project ${project.code}`, autoMessages: project.autoMessages || [] });
    const idOf = new Map<string, Types.ObjectId>(tasks.map((t: any) => [String(t._id), new Types.ObjectId()]));
    for (const [i, m] of modules.entries()) {
      const mod = await PmProductModule.create({ tenant: req.tenantId, product: product._id, name: m.name, order: i + 1, defaultIncharge: m.incharge || null, autoMessages: m.autoMessages || [] });
      await PmTaskTemplate.insertMany(
        tasks
          .filter((t: any) => String(t.projectModule) === String(m._id))
          .map((t: any, j: number) => ({
            _id: idOf.get(String(t._id)),
            tenant: req.tenantId, product: product._id, module: mod._id, title: t.title, taskType: t.taskType, priority: t.priority,
            defaultAssignee: t.assignee, tatValue: t.tatValue, tatUnit: t.tatUnit, order: j + 1,
            dependsOn: (t.dependsOn || []).map((d: any) => idOf.get(String(d))).filter(Boolean),
            clientVerification: t.clientVerification, clientVisible: t.clientVisible, attachmentRequired: !!(t.attachmentRequired || t.mandatoryAttachment), mandatoryAttachment: t.mandatoryAttachment,
            description: t.description, checklist: (t.checklist || []).map((c: any) => ({ text: c.text, order: c.order, mandatory: c.mandatory })), autoMessages: t.autoMessages || [],
          }))
      );
    }
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Product ${name} from project ${project.code}` });
    ok(res, product, 201);
  })
);

/* ───────────── assignment & reassignment ───────────── */
const reasonOf = (body: any) => {
  const reason = String(body?.reason || "").trim();
  if (!reason) throw new ApiError(400, "Enter the reason");
  return reason;
};
const nameOf = async (id: any) => (id ? ((await User.findById(id).select("name").lean()) as any)?.name || "—" : "—");

r.post(
  "/projects/:id/reassign",
  pmRight("projects", "reassign"),
  asyncHandler(async (req: any, res: any) => {
    const project = await findProject(req, req.params.id);
    const to = await employeeId(req, req.body?.to, "project incharge", true);
    const reason = reasonOf(req.body);
    const from = project.incharge;
    if (String(from) === to) throw new ApiError(400, "This person is already the project incharge");
    project.incharge = to as any;
    await project.save();
    await PmAssignment.create({ tenant: req.tenantId, entity: "project", entityId: project._id, project: project._id, from, to, reason, by: req.auth.uid });
    await logActivity({ tenant: req.tenantId, project: project._id, kind: "reassign", text: `Project incharge changed — ${reason}`, from: await nameOf(from), to: await nameOf(to), by: req.auth.uid, byName: req.auth.name });
    ok(res, { incharge: to });
  })
);

r.post(
  "/project-modules/:id/reassign",
  pmRight("projects", "reassign"),
  asyncHandler(async (req: any, res: any) => {
    const mod = await PmProjectModule.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!mod) throw new ApiError(404, "Module not found");
    await findProject(req, mod.project);
    const to = await employeeId(req, req.body?.to, "module incharge", true);
    const reason = reasonOf(req.body);
    const from = mod.incharge;
    if (String(from || "") === to) throw new ApiError(400, "This person is already the module incharge");
    mod.incharge = to as any;
    await mod.save();
    await PmAssignment.create({ tenant: req.tenantId, entity: "module", entityId: mod._id, project: mod.project, from, to, reason, by: req.auth.uid });
    await logActivity({ tenant: req.tenantId, project: mod.project, kind: "reassign", text: `${mod.name}: module incharge changed — ${reason}`, from: await nameOf(from), to: await nameOf(to), by: req.auth.uid, byName: req.auth.name });
    ok(res, { incharge: to });
  })
);

/** Move tasks to a person, with a reason, and record it. Returns how many moved. */
export async function reassignTasks(req: any, tasks: any[], to: string, reason: string) {
  const toName = await nameOf(to);
  let n = 0;
  for (const t of tasks) {
    if (String(t.assignee || "") === to) continue;
    const from = t.assignee;
    await PmTask.updateOne({ _id: t._id }, { $set: { assignee: to } });
    await PmAssignment.create({ tenant: req.tenantId, entity: "task", entityId: t._id, project: t.project || null, from, to, reason, by: req.auth.uid });
    await logActivity({ tenant: req.tenantId, project: t.project, task: t._id, kind: "reassign", text: `Reassigned — ${reason}`, from: await nameOf(from), to: toName, by: req.auth.uid, byName: req.auth.name });
    emitPm("task_assigned", { tenantId: String(req.tenantId), actorId: req.auth.uid, actorName: req.auth.name, taskId: String(t._id), projectId: t.project ? String(t.project) : undefined, data: { from: from ? String(from) : null } });
    n++;
  }
  return n;
}

r.post(
  "/tasks/bulk-reassign",
  pmRight("tasks", "reassign"),
  asyncHandler(async (req: any, res: any) => {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((x: any) => Types.ObjectId.isValid(String(x)));
    if (!ids.length) throw new ApiError(400, "Select the tasks");
    const to = (await employeeId(req, req.body?.to, "assignee", true))!;
    const reason = reasonOf(req.body);
    const tasks = await PmTask.find({ tenant: req.tenantId, _id: { $in: ids }, ...(await visibleTaskFilter(req)) }).select("assignee project").lean();
    ok(res, { moved: await reassignTasks(req, tasks, to, reason) });
  })
);

// Hand over everything an employee holds (leave, exit): open tasks, and the incharge roles.
r.post(
  "/transfer",
  pmRight("tasks", "reassign"),
  asyncHandler(async (req: any, res: any) => {
    const from = (await employeeId(req, req.body?.from, "employee", true))!;
    const projectId = req.body?.project && Types.ObjectId.isValid(String(req.body.project)) ? req.body.project : null;
    const scope: any = { tenant: req.tenantId, ...(projectId ? { project: projectId } : {}) };
    const [tasks, modules, projects] = await Promise.all([
      PmTask.find({ ...scope, assignee: from, isCompleted: false, ...(await visibleTaskFilter(req)) }).select("assignee project").lean(),
      PmProjectModule.find({ ...scope, incharge: from }).lean(),
      PmProject.find({ tenant: req.tenantId, incharge: from, actualEnd: null, ...(projectId ? { _id: projectId } : {}), ...(await visibleProjectFilter(req)) }).lean(),
    ]);
    if (req.body?.preview) return ok(res, { tasks: tasks.length, modules: modules.length, projects: projects.length });

    const to = (await employeeId(req, req.body?.to, "new person", true))!;
    if (to === from) throw new ApiError(400, "Choose a different person");
    const reason = reasonOf(req.body);
    const moved = await reassignTasks(req, tasks, to, reason);
    const [fromName, toName] = [await nameOf(from), await nameOf(to)];
    for (const m of modules) {
      await PmProjectModule.updateOne({ _id: m._id }, { $set: { incharge: to } });
      await PmAssignment.create({ tenant: req.tenantId, entity: "module", entityId: m._id, project: m.project, from, to, reason, by: req.auth.uid });
      await logActivity({ tenant: req.tenantId, project: m.project, kind: "reassign", text: `${m.name}: module incharge changed — ${reason}`, from: fromName, to: toName, by: req.auth.uid, byName: req.auth.name });
    }
    for (const p of projects) {
      await PmProject.updateOne({ _id: p._id }, { $set: { incharge: to } });
      await PmAssignment.create({ tenant: req.tenantId, entity: "project", entityId: p._id, project: p._id, from, to, reason, by: req.auth.uid });
      await logActivity({ tenant: req.tenantId, project: p._id, kind: "reassign", text: `Project incharge changed — ${reason}`, from: fromName, to: toName, by: req.auth.uid, byName: req.auth.name });
    }
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: AUDIT, entity: `Work transfer ${fromName} → ${toName}`, next: `${moved} tasks, ${modules.length} modules, ${projects.length} projects` });
    ok(res, { tasks: moved, modules: modules.length, projects: projects.length });
  })
);

/* ───────────── project tabs: team, files, activity ───────────── */
r.get(
  "/projects/:id/team",
  pmRight("projects", "view"),
  asyncHandler(async (req: any, res: any) => {
    const project = await findProject(req, req.params.id);
    const [tasks, modules] = await Promise.all([
      PmTask.find({ tenant: req.tenantId, project: project._id }).select("assignee isCompleted isPaused due").lean(),
      PmProjectModule.find({ tenant: req.tenantId, project: project._id }).select("incharge name").lean(),
    ]);
    const now = new Date();
    const rows = new Map<string, any>();
    const row = (id: any) => {
      const k = String(id);
      if (!rows.has(k)) rows.set(k, { _id: k, roles: [] as string[], total: 0, open: 0, overdue: 0, done: 0 });
      return rows.get(k);
    };
    row(project.incharge).roles.push("Project incharge");
    modules.forEach((m: any) => m.incharge && row(m.incharge).roles.push(`${m.name} incharge`));
    tasks.forEach((t: any) => {
      if (!t.assignee) return;
      const x = row(t.assignee);
      x.total++;
      if (t.isCompleted) x.done++;
      else {
        x.open++;
        if (!t.isPaused && t.due && new Date(t.due) < now) x.overdue++;
      }
    });
    const people = await User.find({ _id: { $in: [...rows.keys()] } }).select("name photo designation").populate("designation", "name").lean();
    ok(res, people.map((u: any) => ({ ...rows.get(String(u._id)), name: u.name, photo: u.photo || "", designation: u.designation?.name || "" })).sort((a, b) => b.total - a.total));
  })
);

r.get(
  "/projects/:id/files",
  pmRight("projects", "view"),
  asyncHandler(async (req: any, res: any) => {
    const project = await findProject(req, req.params.id);
    const tasks = await PmTask.find({ tenant: req.tenantId, project: project._id, "attachments.0": { $exists: true } }).select("title number attachments").populate("attachments.by", "name").lean();
    ok(res, tasks.flatMap((t: any) => t.attachments.map((a: any) => ({ ...a, task: { _id: t._id, title: t.title, number: t.number } }))).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()));
  })
);

r.get(
  "/projects/:id/activity",
  pmRight("projects", "view"),
  asyncHandler(async (req: any, res: any) => {
    const project = await findProject(req, req.params.id);
    const limit = Math.min(300, parseInt(String(req.query.limit || "100"), 10) || 100);
    ok(res, await PmActivity.find({ tenant: req.tenantId, project: project._id }).sort({ createdAt: -1 }).limit(limit).populate("task", "title number").lean());
  })
);

export { addTat };
export default r;
