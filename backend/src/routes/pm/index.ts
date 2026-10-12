import { Router } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { Types } from "mongoose";
import { ok, asyncHandler, ApiError, audit } from "../../utils/http";
import { User, PM_MODULES, PERM_ACTIONS } from "../../models/User";
import { Team } from "../../models/Team";
import { PmDepartment } from "../../models/pm/Department";
import { PmTask } from "../../models/pm/Project";
import { anyRight, getVisibleEmployeeIds, pmRight } from "../../services/pm/visibility";
import setupRoutes from "./setup";
import productRoutes from "./products";
import clientRoutes from "./clients";
import templateRoutes from "./templates";
import projectRoutes from "./projects";
import taskRoutes from "./tasks";
import planRoutes from "./plans";
import messagingRoutes from "./messaging";
import meetingRoutes from "./meetings";
import ticketRoutes from "./tickets";
import portalRoutes from "./portal";
import dashboardRoutes from "./dashboard";
import reportRoutes from "./reports";
import powerRoutes from "./power";

/**
 * Project Management API — everything under /api/pm.
 * Mounted after `authenticate`, so every route here needs a signed-in user;
 * each route then checks the right for the action and limits the data to what
 * the user may see (services/pm/visibility).
 */
const r = Router();

/* ---- what the screens need to know up front ---- */
r.get(
  "/meta",
  asyncHandler(async (req: any, res: any) => {
    ok(res, { modules: PM_MODULES, actions: PERM_ACTIONS, visibility: req.visibility });
  })
);

/* ---- Departments ---- */
const departmentBody = (body: any) => {
  const out: any = {};
  if (body.name !== undefined) {
    out.name = String(body.name || "").trim();
    if (!out.name) throw new ApiError(400, "Enter the department name");
  }
  if (body.order !== undefined) out.order = Number(body.order) || 0;
  if (body.active !== undefined) out.active = !!body.active;
  return out;
};
r.get(
  "/departments",
  anyRight(["pm_setup", "view"], ["pm_team", "view"], ["setup", "view"]),
  asyncHandler(async (req: any, res: any) => {
    const [rows, counts] = await Promise.all([
      PmDepartment.find({ tenant: req.tenantId }).sort({ order: 1, name: 1 }).lean(),
      User.aggregate([{ $match: { tenant: new Types.ObjectId(String(req.tenantId)), department: { $ne: null } } }, { $group: { _id: "$department", n: { $sum: 1 } } }]),
    ]);
    const countMap = new Map(counts.map((c: any) => [String(c._id), c.n]));
    ok(res, rows.map((d: any) => ({ ...d, employees: countMap.get(String(d._id)) || 0 })));
  })
);
r.post(
  "/departments",
  pmRight("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const data = departmentBody(req.body);
    if (!data.name) throw new ApiError(400, "Enter the department name");
    const doc = await PmDepartment.create({ ...data, tenant: req.tenantId });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Project Management", entity: `Department ${doc.name}` });
    ok(res, doc, 201);
  })
);
r.patch(
  "/departments/:id",
  pmRight("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmDepartment.findOneAndUpdate({ _id: req.params.id, tenant: req.tenantId }, { $set: departmentBody(req.body) }, { new: true });
    if (!doc) throw new ApiError(404, "Department not found");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Project Management", entity: `Department ${doc.name}` });
    ok(res, doc);
  })
);
r.delete(
  "/departments/:id",
  pmRight("setup", "del"),
  asyncHandler(async (req: any, res: any) => {
    const inUse = await User.countDocuments({ tenant: req.tenantId, department: req.params.id });
    if (inUse) throw new ApiError(409, `${inUse} employee${inUse === 1 ? " is" : "s are"} in this department. Move them first.`);
    const doc = await PmDepartment.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
    if (!doc) throw new ApiError(404, "Department not found");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Project Management", entity: `Department ${doc.name}` });
    ok(res, { deleted: true });
  })
);

/* ---- Employees (our own team; client users are never listed) ---- */
const EMPLOYEE_FIELDS = "name email mobile code designation department reportingManager joiningDate photo status category";

async function loadEmployees(req: any, extra: Record<string, any> = {}) {
  const ids = await getVisibleEmployeeIds(req);
  const filter: any = { tenant: req.tenantId, ...extra };
  if (ids !== "all") filter._id = { $in: ids };
  const rows: any[] = await User.find(filter)
    .select(EMPLOYEE_FIELDS)
    .populate("designation", "name")
    .populate("department", "name")
    .populate("category", "kind")
    .sort({ name: 1 })
    .lean();
  return rows
    .filter((u) => u.category?.kind !== "client")
    .map((u) => ({
      _id: String(u._id),
      name: u.name,
      email: u.email,
      mobile: u.mobile || "",
      code: u.code || "",
      designation: u.designation?.name || "",
      department: u.department?.name || "",
      departmentId: u.department?._id ? String(u.department._id) : "",
      reportingManager: u.reportingManager ? String(u.reportingManager) : "",
      joiningDate: u.joiningDate || "",
      photo: u.photo || "",
      status: u.status,
    }));
}

// Light list for pickers and lists; limited to the employees this user may see.
r.get(
  "/employees",
  anyRight(...PM_MODULES.map((m) => [m, "view"] as [string, "view"])),
  asyncHandler(async (req: any, res: any) => {
    ok(res, await loadEmployees(req, req.query.active === "1" ? { status: "Active" } : {}));
  })
);

/* ---- Team hierarchy: the people tree + teams ---- */
r.get(
  "/hierarchy",
  pmRight("team", "view"),
  asyncHandler(async (req: any, res: any) => {
    const employees = await loadEmployees(req);
    const shown = new Set(employees.map((e) => e._id));
    const teams: any[] = await Team.find({ tenant: req.tenantId }).select("name manager members parent active").lean();

    const teamsOf = new Map<string, string[]>();
    const add = (id: string, name: string) => {
      if (!teamsOf.has(id)) teamsOf.set(id, []);
      if (!teamsOf.get(id)!.includes(name)) teamsOf.get(id)!.push(name);
    };
    for (const t of teams) {
      add(String(t.manager), t.name);
      for (const m of t.members || []) add(String(m.user), t.name);
    }

    const now = new Date();
    const openTasks: any[] = await PmTask.find({ tenant: req.tenantId, isCompleted: false, assignee: { $in: employees.map((e) => e._id) } }).select("assignee project isPaused due").lean();
    const numbers = new Map<string, { open: number; overdue: number; projects: Set<string> }>();
    for (const t of openTasks) {
      const k = String(t.assignee);
      if (!numbers.has(k)) numbers.set(k, { open: 0, overdue: 0, projects: new Set() });
      const n = numbers.get(k)!;
      n.open++;
      if (!t.isPaused && t.due && new Date(t.due) < now) n.overdue++;
      if (t.project) n.projects.add(String(t.project));
    }

    ok(res, {
      employees: employees.map((e) => ({
        ...e,
        // a manager outside what this user may see is not exposed
        reportingManager: shown.has(e.reportingManager) ? e.reportingManager : "",
        teams: teamsOf.get(e._id) || [],
        openTasks: numbers.get(e._id)?.open || 0,
        overdueTasks: numbers.get(e._id)?.overdue || 0,
        projects: numbers.get(e._id)?.projects.size || 0,
      })),
      teams: teams
        .filter((t) => shown.has(String(t.manager)) || (t.members || []).some((m: any) => shown.has(String(m.user))))
        .map((t) => ({
          _id: String(t._id),
          name: t.name,
          manager: String(t.manager),
          parent: t.parent ? String(t.parent) : "",
          members: (t.members || []).map((m: any) => String(m.user)).filter((id: string) => shown.has(id)),
          active: t.active !== false,
        })),
    });
  })
);

/* ---- Employee photo ---- */
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };
const photoUpload = multer({ dest: path.join(os.tmpdir(), "whatsapp_crm_uploads"), limits: { fileSize: 2 * 1024 * 1024 } });
const photoDir = path.join(process.cwd(), "uploads", "user-photos");

r.post(
  "/employees/:id/photo",
  photoUpload.single("file"),
  asyncHandler(async (req: any, res: any) => {
    const tmp = req.file?.path;
    try {
      const self = String(req.params.id) === String(req.auth.uid);
      const admin = !!(req.perms || []).find((p: any) => p.module === "setup")?.edit;
      if (!self && !admin) throw new ApiError(403, "Forbidden");
      if (!req.file) throw new ApiError(400, "Choose a photo");
      const ext = PHOTO_TYPES[req.file.mimetype];
      if (!ext) throw new ApiError(400, "The photo must be a JPG, PNG or WebP image");
      const user = await User.findOne({ _id: req.params.id, tenant: req.tenantId });
      if (!user) throw new ApiError(404, "User not found");

      fs.mkdirSync(photoDir, { recursive: true });
      const fileName = `${user._id}-${Date.now()}${ext}`;
      fs.copyFileSync(tmp, path.join(photoDir, fileName));
      const old = user.photo;
      user.photo = `/uploads/user-photos/${fileName}`;
      await user.save();
      if (old && old.startsWith("/uploads/user-photos/")) fs.rm(path.join(photoDir, path.basename(old)), () => {});
      await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "User Management", entity: `Photo of ${user.email}` });
      ok(res, { photo: user.photo });
    } finally {
      if (tmp) fs.rm(tmp, () => {});
    }
  })
);
r.delete(
  "/employees/:id/photo",
  asyncHandler(async (req: any, res: any) => {
    const self = String(req.params.id) === String(req.auth.uid);
    const admin = !!(req.perms || []).find((p: any) => p.module === "setup")?.edit;
    if (!self && !admin) throw new ApiError(403, "Forbidden");
    const user = await User.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!user) throw new ApiError(404, "User not found");
    if (user.photo && user.photo.startsWith("/uploads/user-photos/")) fs.rm(path.join(photoDir, path.basename(user.photo)), () => {});
    user.photo = "";
    await user.save();
    ok(res, { photo: "" });
  })
);

r.use(setupRoutes);
r.use(productRoutes);
r.use(clientRoutes);
r.use(templateRoutes);
r.use(projectRoutes);
r.use(powerRoutes);
r.use(taskRoutes);
r.use(planRoutes);
r.use(messagingRoutes);
r.use(meetingRoutes);
r.use(ticketRoutes);
r.use(portalRoutes);
r.use(dashboardRoutes);
r.use(reportRoutes);

export default r;
