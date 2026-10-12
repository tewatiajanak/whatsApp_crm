import { Router } from "express";
import { Types } from "mongoose";
import { ok, asyncHandler, ApiError, audit } from "../../utils/http";
import { User } from "../../models/User";
import { PmMaster, PmHoliday } from "../../models/pm/Setup";
import { PmProduct, PmProductModule, PmTaskTemplate, TAT_UNITS } from "../../models/pm/Product";
import { PmClient } from "../../models/pm/Client";
import { getPmSettings } from "../../services/pm/masters";
import { WorkCalendar, calculateSchedule, daysBetween, findCycle } from "../../services/pm/dateEngine";
import { anyRight, pmRight } from "../../services/pm/visibility";
import { cleanRules } from "../../services/pm/rules";

/** Setup › Products: the Product → Module → Task → Checklist templates. */
const r = Router();
const AUDIT = "Project Management";
// templates are read when a project is created, not only in Setup
const canRead = anyRight(["pm_setup", "view"], ["pm_projects", "view"], ["pm_clients", "view"]);

export async function loadCalendar(tenantId: any): Promise<WorkCalendar> {
  const [s, holidays] = await Promise.all([getPmSettings(tenantId), PmHoliday.find({ tenant: tenantId }).select("date").lean()]);
  return { workingDays: s.workingDays, workStart: s.workStart, workEnd: s.workEnd, holidays: new Set(holidays.map((h) => h.date)) };
}

const product = async (req: any, id = req.params.id) => {
  const doc = await PmProduct.findOne({ _id: id, tenant: req.tenantId });
  if (!doc) throw new ApiError(404, "Product not found");
  return doc;
};
const employee = async (req: any, value: any, what: string) => {
  const id = value?._id || value || null;
  if (id && !(await User.exists({ _id: id, tenant: req.tenantId }))) throw new ApiError(400, `Choose a valid ${what}`);
  return id;
};
const master = async (req: any, value: any, type: string, what: string) => {
  const id = value?._id || value || null;
  if (id && !(await PmMaster.exists({ _id: id, tenant: req.tenantId, type }))) throw new ApiError(400, `Choose a valid ${what}`);
  return id;
};

/* ───────────── Products ───────────── */
async function productBody(req: any, body: any, existing?: any) {
  const out: any = {};
  const has = (k: string) => body[k] !== undefined;
  if (has("name") || !existing) {
    out.name = String(body.name || "").trim();
    if (!out.name) throw new ApiError(400, "Enter the product name");
  }
  if (has("code") || !existing) {
    out.code = String(body.code || "").trim().toUpperCase();
    if (!out.code) throw new ApiError(400, "Enter the product code");
    if (await PmProduct.exists({ tenant: req.tenantId, code: out.code, _id: { $ne: existing?._id } })) throw new ApiError(409, "Another product already has this code");
  }
  if (has("description")) out.description = String(body.description || "").trim();
  if (has("active")) out.active = !!body.active;
  if (has("autoMessages")) out.autoMessages = await cleanRules(req.tenantId, "project", body.autoMessages);
  return out;
}

r.get(
  "/products",
  canRead,
  asyncHandler(async (req: any, res: any) => {
    const tenant = new Types.ObjectId(String(req.tenantId));
    const [rows, mods, tasks] = await Promise.all([
      PmProduct.find({ tenant: req.tenantId }).sort({ name: 1 }).lean(),
      PmProductModule.aggregate([{ $match: { tenant } }, { $group: { _id: "$product", n: { $sum: 1 } } }]),
      PmTaskTemplate.aggregate([{ $match: { tenant } }, { $group: { _id: "$product", n: { $sum: 1 } } }]),
    ]);
    const m = new Map(mods.map((x: any) => [String(x._id), x.n]));
    const t = new Map(tasks.map((x: any) => [String(x._id), x.n]));
    ok(res, rows.map((p: any) => ({ ...p, modules: m.get(String(p._id)) || 0, tasks: t.get(String(p._id)) || 0 })));
  })
);

r.post(
  "/products",
  pmRight("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmProduct.create({ ...(await productBody(req, req.body)), tenant: req.tenantId });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Product ${doc.name}` });
    ok(res, doc, 201);
  })
);

r.patch(
  "/products/:id",
  pmRight("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await product(req);
    Object.assign(doc, await productBody(req, req.body, doc));
    await doc.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: AUDIT, entity: `Product ${doc.name}` });
    ok(res, doc);
  })
);

r.delete(
  "/products/:id",
  pmRight("setup", "del"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await product(req);
    const clients = await PmClient.countDocuments({ tenant: req.tenantId, products: doc._id });
    if (clients) throw new ApiError(409, `Assigned to ${clients} client${clients === 1 ? "" : "s"}. It cannot be deleted; make it inactive instead.`);
    await Promise.all([
      PmTaskTemplate.deleteMany({ tenant: req.tenantId, product: doc._id }),
      PmProductModule.deleteMany({ tenant: req.tenantId, product: doc._id }),
    ]);
    await doc.deleteOne();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: AUDIT, entity: `Product ${doc.name}` });
    ok(res, { deleted: true });
  })
);

/* The whole template of one product, with the planned duration of each module and of the product. */
async function fullProduct(req: any, productId: any) {
  const doc = await product(req, productId);
  const [modules, tasks, cal] = await Promise.all([
    PmProductModule.find({ tenant: req.tenantId, product: doc._id }).sort({ order: 1, name: 1 }).populate("defaultIncharge", "name photo").lean(),
    PmTaskTemplate.find({ tenant: req.tenantId, product: doc._id }).sort({ order: 1, createdAt: 1 }).populate("defaultAssignee", "name photo").lean(),
    loadCalendar(req.tenantId),
  ]);

  // planned duration, assuming the product starts now
  const start = new Date();
  const duration: Record<string, number> = {};
  let total = 0;
  let loop: string[] = [];
  try {
    const sched = calculateSchedule(
      tasks.map((t: any) => ({ id: String(t._id), tatValue: t.tatValue, tatUnit: t.tatUnit, dependsOn: (t.dependsOn || []).map(String) })),
      start,
      cal
    );
    let end = start;
    for (const mod of modules) {
      const mine = tasks.filter((t: any) => String(t.module) === String(mod._id)).map((t: any) => sched.get(String(t._id))!);
      if (!mine.length) {
        duration[String(mod._id)] = 0;
        continue;
      }
      const first = new Date(Math.min(...mine.map((x) => x.start.getTime())));
      const last = new Date(Math.max(...mine.map((x) => x.due.getTime())));
      duration[String(mod._id)] = daysBetween(first, last);
      if (last > end) end = last;
    }
    total = daysBetween(start, end);
  } catch (e: any) {
    loop = e?.loop || [];
  }

  return {
    product: doc,
    modules: modules.map((m: any) => ({ ...m, days: duration[String(m._id)] ?? 0 })),
    tasks,
    days: total,
    loop,
  };
}

r.get(
  "/products/:id/full",
  canRead,
  asyncHandler(async (req: any, res: any) => {
    ok(res, await fullProduct(req, req.params.id));
  })
);

/* ───────────── Modules ───────────── */
async function moduleBody(req: any, body: any, creating: boolean) {
  const out: any = {};
  if (body.name !== undefined || creating) {
    out.name = String(body.name || "").trim();
    if (!out.name) throw new ApiError(400, "Enter the module name");
  }
  if (body.defaultIncharge !== undefined) out.defaultIncharge = await employee(req, body.defaultIncharge, "module incharge");
  if (body.active !== undefined) out.active = !!body.active;
  if (body.autoMessages !== undefined) out.autoMessages = await cleanRules(req.tenantId, "module", body.autoMessages);
  return out;
}

r.post(
  "/products/:id/modules",
  pmRight("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const p = await product(req);
    const last = await PmProductModule.findOne({ tenant: req.tenantId, product: p._id }).sort({ order: -1 }).select("order").lean();
    const doc = await PmProductModule.create({ ...(await moduleBody(req, req.body, true)), tenant: req.tenantId, product: p._id, order: (last?.order || 0) + 1 });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Module ${p.name} › ${doc.name}` });
    ok(res, doc, 201);
  })
);

r.put(
  "/products/:id/modules/order",
  pmRight("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    await Promise.all(ids.map((id, i) => PmProductModule.updateOne({ _id: id, tenant: req.tenantId, product: req.params.id }, { $set: { order: i + 1 } })));
    ok(res, { ordered: ids.length });
  })
);

r.patch(
  "/modules/:id",
  pmRight("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmProductModule.findOneAndUpdate({ _id: req.params.id, tenant: req.tenantId }, { $set: await moduleBody(req, req.body, false) }, { new: true });
    if (!doc) throw new ApiError(404, "Module not found");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: AUDIT, entity: `Module ${doc.name}` });
    ok(res, doc);
  })
);

r.delete(
  "/modules/:id",
  pmRight("setup", "del"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmProductModule.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
    if (!doc) throw new ApiError(404, "Module not found");
    const gone = (await PmTaskTemplate.find({ tenant: req.tenantId, module: doc._id }).select("_id").lean()).map((t) => t._id);
    await PmTaskTemplate.deleteMany({ _id: { $in: gone } });
    // other tasks no longer wait for the deleted ones
    await PmTaskTemplate.updateMany({ tenant: req.tenantId, product: doc.product }, { $pull: { dependsOn: { $in: gone } } });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: AUDIT, entity: `Module ${doc.name}` });
    ok(res, { deleted: true });
  })
);

/* ───────────── Task templates ───────────── */
const yes = (v: any) => v === true || /^(y|yes|true|1)$/i.test(String(v ?? "").trim());

async function taskBody(req: any, body: any, productId: any, existing?: any) {
  const out: any = {};
  const has = (k: string) => body[k] !== undefined;
  if (has("title") || !existing) {
    out.title = String(body.title || "").trim();
    if (!out.title) throw new ApiError(400, "Enter the task title");
  }
  if (has("module") || !existing) {
    const mod = body.module?._id || body.module;
    if (!mod || !(await PmProductModule.exists({ _id: mod, tenant: req.tenantId, product: productId }))) throw new ApiError(400, "Choose a module");
    out.module = mod;
  }
  if (has("taskType")) out.taskType = await master(req, body.taskType, "task_type", "task type");
  if (has("priority")) out.priority = await master(req, body.priority, "priority", "priority");
  if (has("defaultAssignee")) out.defaultAssignee = await employee(req, body.defaultAssignee, "assignee");
  if (has("tatValue")) {
    out.tatValue = Number(body.tatValue);
    if (!Number.isFinite(out.tatValue) || out.tatValue < 0 || out.tatValue > 3650) throw new ApiError(400, "Enter a valid TAT");
  }
  if (has("tatUnit")) {
    if (!(TAT_UNITS as readonly string[]).includes(body.tatUnit)) throw new ApiError(400, "Choose a TAT unit");
    out.tatUnit = body.tatUnit;
  }
  for (const k of ["clientVerification", "clientVisible", "attachmentRequired", "mandatoryAttachment"]) if (has(k)) out[k] = !!body[k];
  // "mandatory" is a detail of "attachment required": the two never disagree
  if (out.mandatoryAttachment) out.attachmentRequired = true;
  else if (out.attachmentRequired === false) out.mandatoryAttachment = false;
  if (has("description")) out.description = String(body.description || "");
  if (has("autoMessages")) out.autoMessages = await cleanRules(req.tenantId, "task", body.autoMessages);
  if (has("checklist")) {
    out.checklist = (Array.isArray(body.checklist) ? body.checklist : [])
      .map((c: any, i: number) => ({ ...(c?._id ? { _id: c._id } : {}), text: String(c?.text || "").trim(), order: i + 1, mandatory: !!c?.mandatory }))
      .filter((c: any) => c.text);
  }
  if (has("dependsOn")) {
    const ids = ([...new Set((Array.isArray(body.dependsOn) ? body.dependsOn : []).map((d: any) => String(d?._id || d)))] as string[]).filter((d) => d !== String(existing?._id || ""));
    const all = await PmTaskTemplate.find({ tenant: req.tenantId, product: productId }).select("title dependsOn").lean();
    const known = new Map(all.map((t: any) => [String(t._id), t]));
    if (ids.some((d) => !known.has(d))) throw new ApiError(400, "A task can only depend on tasks of the same product");
    // would this make a loop?
    const selfId = String(existing?._id || "new");
    const graph = all.filter((t: any) => String(t._id) !== selfId).map((t: any) => ({ id: String(t._id), dependsOn: (t.dependsOn || []).map(String) }));
    graph.push({ id: selfId, dependsOn: ids });
    const loop = findCycle(graph);
    if (loop.length) {
      const names = loop.map((id) => (id === selfId ? out.title || existing?.title || "this task" : known.get(id)?.title || "?"));
      throw new ApiError(400, `Circular dependency: ${names.join(" → ")}`, { loop });
    }
    out.dependsOn = ids;
  }
  return out;
}

r.post(
  "/products/:id/tasks",
  pmRight("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const p = await product(req);
    const data = await taskBody(req, req.body, p._id);
    const last = await PmTaskTemplate.findOne({ tenant: req.tenantId, module: data.module }).sort({ order: -1 }).select("order").lean();
    const doc = await PmTaskTemplate.create({ ...data, tenant: req.tenantId, product: p._id, order: (last?.order || 0) + 1 });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Task template ${p.name} › ${doc.title}` });
    ok(res, doc, 201);
  })
);

r.put(
  "/modules/:id/tasks/order",
  pmRight("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    await Promise.all(ids.map((id, i) => PmTaskTemplate.updateOne({ _id: id, tenant: req.tenantId, module: req.params.id }, { $set: { order: i + 1 } })));
    ok(res, { ordered: ids.length });
  })
);

r.patch(
  "/task-templates/:id",
  pmRight("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmTaskTemplate.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!doc) throw new ApiError(404, "Task not found");
    Object.assign(doc, await taskBody(req, req.body, doc.product, doc));
    await doc.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: AUDIT, entity: `Task template ${doc.title}` });
    ok(res, doc);
  })
);

r.delete(
  "/task-templates/:id",
  pmRight("setup", "del"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmTaskTemplate.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
    if (!doc) throw new ApiError(404, "Task not found");
    await PmTaskTemplate.updateMany({ tenant: req.tenantId, product: doc.product }, { $pull: { dependsOn: doc._id } });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: AUDIT, entity: `Task template ${doc.title}` });
    ok(res, { deleted: true });
  })
);

/* ───────────── Copy ───────────── */
/** Copy modules (with their tasks) into a product. Dependencies inside the copied set are kept. */
async function copyModules(req: any, sourceModules: any[], targetProductId: any, sameProduct: boolean) {
  const sourceTasks = await PmTaskTemplate.find({ tenant: req.tenantId, module: { $in: sourceModules.map((m) => m._id) } }).sort({ order: 1 }).lean();
  const last = await PmProductModule.findOne({ tenant: req.tenantId, product: targetProductId }).sort({ order: -1 }).select("order").lean();
  let order = last?.order || 0;

  const moduleMap = new Map<string, any>();
  for (const m of sourceModules) {
    const made = await PmProductModule.create({
      tenant: req.tenantId,
      product: targetProductId,
      name: sameProduct ? `${m.name} (copy)` : m.name,
      order: ++order,
      defaultIncharge: m.defaultIncharge || null,
      active: m.active,
      autoMessages: m.autoMessages || [],
    });
    moduleMap.set(String(m._id), made._id);
  }
  const taskMap = new Map<string, Types.ObjectId>(sourceTasks.map((t: any) => [String(t._id), new Types.ObjectId()]));
  await PmTaskTemplate.insertMany(
    sourceTasks.map((t: any) => ({
      ...t,
      _id: taskMap.get(String(t._id)),
      product: targetProductId,
      module: moduleMap.get(String(t.module)),
      // inside the copy → the copied task; outside it → kept only within the same product
      dependsOn: (t.dependsOn || []).map((d: any) => taskMap.get(String(d)) || (sameProduct ? d : null)).filter(Boolean),
      checklist: (t.checklist || []).map((c: any) => ({ text: c.text, order: c.order, mandatory: c.mandatory })),
      createdAt: undefined,
      updatedAt: undefined,
    }))
  );
  return { modules: sourceModules.length, tasks: sourceTasks.length };
}

r.post(
  "/modules/:id/copy",
  pmRight("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const mod = await PmProductModule.findOne({ _id: req.params.id, tenant: req.tenantId }).lean();
    if (!mod) throw new ApiError(404, "Module not found");
    const target = req.body?.product ? await product(req, req.body.product) : await product(req, mod.product);
    const done = await copyModules(req, [mod], target._id, String(target._id) === String(mod.product));
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Module copy ${mod.name} → ${target.name}` });
    ok(res, done, 201);
  })
);

r.post(
  "/products/:id/copy",
  pmRight("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const source = await product(req);
    const made = await PmProduct.create({
      ...(await productBody(req, { name: req.body?.name, code: req.body?.code, description: source.description, active: true })),
      tenant: req.tenantId,
    });
    made.autoMessages = source.autoMessages || [];
    await made.save();
    const modules = await PmProductModule.find({ tenant: req.tenantId, product: source._id }).sort({ order: 1 }).lean();
    const done = await copyModules(req, modules, made._id, false);
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Product copy ${source.name} → ${made.name}` });
    ok(res, { product: made, ...done }, 201);
  })
);

/* ───────────── Import tasks from Excel ─────────────
   The browser reads the sheet and sends the rows. Nothing is saved unless
   every row is valid; the answer lists the problems row by row. */
// A "Day" is a working day (weekends and holidays are skipped), as in the task form.
const UNIT_WORDS: Record<string, string> = {
  hours: "hours", hour: "hours", hrs: "hours", hr: "hours",
  days: "working_days", day: "working_days", "working days": "working_days", "working day": "working_days", working_days: "working_days",
  "calendar days": "days", "calendar day": "days",
};

r.post(
  "/products/:id/import",
  pmRight("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const p = await product(req);
    const rows: any[] = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const dryRun = !!req.body?.dryRun; // check only: nothing is saved
    if (!rows.length) throw new ApiError(400, "The sheet has no rows");
    if (rows.length > 1000) throw new ApiError(400, "Import at most 1000 rows at a time");

    const [modules, existing, types, priorities, users] = await Promise.all([
      PmProductModule.find({ tenant: req.tenantId, product: p._id }).lean(),
      PmTaskTemplate.find({ tenant: req.tenantId, product: p._id }).select("title dependsOn module").lean(),
      PmMaster.find({ tenant: req.tenantId, type: "task_type" }).lean(),
      PmMaster.find({ tenant: req.tenantId, type: "priority" }).lean(),
      User.find({ tenant: req.tenantId }).select("email name").lean(),
    ]);
    const key = (v: any) => String(v ?? "").trim().toLowerCase();
    const byName = (list: any[], field = "name") => new Map(list.map((x: any) => [key(x[field]), x]));
    const moduleBy = byName(modules);
    const typeBy = byName(types);
    const priorityBy = byName(priorities);
    const userBy = new Map<string, any>();
    users.forEach((u: any) => { userBy.set(key(u.email), u); userBy.set(key(u.name), u); });
    const titleBy = new Map<string, string>(existing.map((t: any) => [key(t.title), String(t._id)]));

    const errors: { row: number; message: string }[] = [];
    const parsed: any[] = [];
    rows.forEach((raw, i) => {
      const row = Number(raw.row) > 0 ? Number(raw.row) : i + 2; // row 1 is the heading
      const fail = (message: string) => errors.push({ row, message });
      const title = String(raw.title ?? "").trim();
      const moduleName = String(raw.module ?? "").trim();
      if (!title) return fail("Task title is missing");
      if (!moduleName) return fail("Module is missing");
      if (titleBy.has(key(title))) return fail(`A task named "${title}" already exists`);
      const id = String(new Types.ObjectId());
      titleBy.set(key(title), id);

      const type = raw.taskType ? typeBy.get(key(raw.taskType)) : null;
      if (raw.taskType && !type) fail(`Task type "${raw.taskType}" not found`);
      const priority = raw.priority ? priorityBy.get(key(raw.priority)) : null;
      if (raw.priority && !priority) fail(`Priority "${raw.priority}" not found`);
      const assignee = raw.assignee ? userBy.get(key(raw.assignee)) : null;
      if (raw.assignee && !assignee) fail(`Assignee "${raw.assignee}" not found`);
      const tatValue = raw.tatValue === "" || raw.tatValue == null ? 1 : Number(raw.tatValue);
      if (!Number.isFinite(tatValue) || tatValue < 0) fail("TAT must be a number");
      const tatUnit = raw.tatUnit ? UNIT_WORDS[key(raw.tatUnit)] : "working_days";
      if (!tatUnit) fail(`TAT unit "${raw.tatUnit}" must be Hour or Day`);
      const incharge = raw.moduleIncharge ? userBy.get(key(raw.moduleIncharge)) : null;
      if (raw.moduleIncharge && !incharge) fail(`Module incharge "${raw.moduleIncharge}" not found`);
      const mandatoryAttachment = yes(raw.mandatoryAttachment);

      parsed.push({
        row, id, title, moduleName, moduleIncharge: incharge?._id || null, taskType: type?._id || null, priority: priority?._id || null, defaultAssignee: assignee?._id || null,
        tatValue, tatUnit,
        depends: String(raw.dependsOn ?? "").split(/[;\n]/).map((x) => x.trim()).filter(Boolean),
        clientVerification: yes(raw.clientVerification),
        clientVisible: raw.clientVisible === "" || raw.clientVisible == null ? true : yes(raw.clientVisible),
        attachmentRequired: mandatoryAttachment || yes(raw.attachmentRequired),
        mandatoryAttachment,
        description: String(raw.description ?? ""),
        // one item per line or ";" — an item ending in * is mandatory
        checklist: String(raw.checklist ?? "").split(/[;\n]/).map((x) => x.trim()).filter(Boolean)
          .map((x) => ({ text: x.replace(/\s*\*+$/, "").trim(), mandatory: /\*$/.test(x) })).filter((c) => c.text),
      });
    });

    // dependencies are given by task title: existing tasks or other rows of the sheet
    for (const t of parsed) {
      t.dependsOn = [];
      for (const name of t.depends) {
        const id = titleBy.get(key(name));
        if (!id || id === t.id) errors.push({ row: t.row, message: `Depends on "${name}": no such task` });
        else t.dependsOn.push(id);
      }
    }
    if (!errors.length) {
      const graph = [
        ...existing.map((t: any) => ({ id: String(t._id), dependsOn: (t.dependsOn || []).map(String) })),
        ...parsed.map((t) => ({ id: t.id, dependsOn: t.dependsOn })),
      ];
      const loop = findCycle(graph);
      if (loop.length) {
        const names = new Map<string, string>([...existing.map((t: any) => [String(t._id), t.title] as [string, string]), ...parsed.map((t) => [t.id, t.title] as [string, string])]);
        errors.push({ row: parsed.find((t) => loop.includes(t.id))?.row || 2, message: `Circular dependency: ${loop.map((id) => names.get(id)).join(" → ")}` });
      }
    }
    const names = [...new Map(parsed.map((t) => [key(t.moduleName), t.moduleName])).values()];
    const summary = {
      tasks: parsed.length,
      checklist: parsed.reduce((n, t) => n + t.checklist.length, 0),
      modules: names.map((name) => ({ name, isNew: !moduleBy.has(key(name)), tasks: parsed.filter((t) => key(t.moduleName) === key(name)).length })),
    };
    if (errors.length || dryRun) return ok(res, { created: 0, errors: errors.sort((a, b) => a.row - b.row), summary });

    // create the missing modules, then the tasks
    let order = Math.max(0, ...modules.map((m: any) => m.order || 0));
    for (const name of names) {
      if (moduleBy.has(key(name))) continue;
      const defaultIncharge = parsed.find((t) => key(t.moduleName) === key(name) && t.moduleIncharge)?.moduleIncharge || null;
      const made = await PmProductModule.create({ tenant: req.tenantId, product: p._id, name, order: ++order, defaultIncharge });
      moduleBy.set(key(name), made);
    }
    const counter = new Map<string, number>();
    for (const m of modules) counter.set(String(m._id), existing.filter((t: any) => String(t.module) === String(m._id)).length);
    await PmTaskTemplate.insertMany(
      parsed.map((t) => {
        const mod = moduleBy.get(key(t.moduleName));
        const n = (counter.get(String(mod._id)) || 0) + 1;
        counter.set(String(mod._id), n);
        return {
          _id: t.id, tenant: req.tenantId, product: p._id, module: mod._id, title: t.title, taskType: t.taskType, priority: t.priority,
          defaultAssignee: t.defaultAssignee, tatValue: t.tatValue, tatUnit: t.tatUnit, order: n, dependsOn: t.dependsOn,
          clientVerification: t.clientVerification, clientVisible: t.clientVisible, attachmentRequired: t.attachmentRequired, mandatoryAttachment: t.mandatoryAttachment,
          description: t.description, checklist: t.checklist.map((c: any, i: number) => ({ text: c.text, order: i + 1, mandatory: c.mandatory })),
        };
      })
    );
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Imported ${parsed.length} task templates into ${p.name}` });
    ok(res, { created: parsed.length, errors: [], summary });
  })
);

export default r;
