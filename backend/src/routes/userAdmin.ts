import { Router } from "express";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { ok, asyncHandler, ApiError, paginated, audit } from "../utils/http";
import { require_ } from "../middleware/auth";
import { MODULES, PASSWORD_PARTS, PasswordPolicy, User, UserCategory, UserType } from "../models/User";
import { defaultPassword, describeRule, otpAvailable, policyFor } from "../services/userAccess";
import { decryptSecret, encryptSecret, maskSecret } from "../services/payments/crypto";

/**
 * User Management (Configuration): users, user types and the password policy.
 * Roles keep their existing /usertypes routes (a "user type" row in that
 * collection is a role — see models/User).
 */
const r = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");

/** Keep only well-formed permission rows for known modules. */
const cleanPerms = (list: unknown) =>
  (Array.isArray(list) ? list : [])
    .filter((p: any) => p && MODULES.includes(p.module))
    .map((p: any) => ({ module: p.module, view: !!p.view, create: !!p.create, edit: !!p.edit, del: !!p.del }));

/* ---- what the screens need to know up front ---- */
r.get(
  "/user-admin/meta",
  require_("setup", "view"),
  asyncHandler(async (_req: any, res: any) => {
    ok(res, { modules: MODULES, otpAvailable: otpAvailable() });
  })
);

/* ---- User types (own team / client) ---- */
r.get(
  "/user-categories",
  require_("setup", "view"),
  asyncHandler(async (req: any, res: any) => {
    const [rows, counts] = await Promise.all([
      UserCategory.find({ tenant: req.tenantId }).sort({ createdAt: 1 }).lean(),
      User.aggregate([{ $match: { tenant: new Types.ObjectId(String(req.tenantId)) } }, { $group: { _id: "$category", n: { $sum: 1 } } }]),
    ]);
    const countMap = new Map(counts.map((c: any) => [String(c._id), c.n]));
    ok(res, rows.map((x: any) => ({ ...x, userCount: countMap.get(String(x._id)) || 0 })));
  })
);
const categoryBody = (body: any) => {
  const name = String(body?.name || "").trim();
  if (!name) throw new ApiError(400, "Enter the user type name");
  return { name, kind: body.kind === "client" ? "client" : "internal", otpLogin: !!body.otpLogin };
};
r.post(
  "/user-categories",
  require_("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await UserCategory.create({ ...categoryBody(req.body), perms: cleanPerms(req.body.perms), tenant: req.tenantId });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "User Management", entity: `User type ${doc.name}` });
    ok(res, doc, 201);
  })
);
r.patch(
  "/user-categories/:id",
  require_("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const set: any = {};
    if (req.body.name !== undefined || req.body.kind !== undefined || req.body.otpLogin !== undefined) {
      const current: any = await UserCategory.findOne({ _id: req.params.id, tenant: req.tenantId }).lean();
      if (!current) throw new ApiError(404, "User type not found");
      Object.assign(set, categoryBody({ ...current, ...req.body }));
    }
    if (req.body.perms !== undefined) set.perms = cleanPerms(req.body.perms);
    const doc = await UserCategory.findOneAndUpdate({ _id: req.params.id, tenant: req.tenantId }, { $set: set }, { new: true });
    if (!doc) throw new ApiError(404, "User type not found");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "User Management", entity: `User type ${doc.name}` });
    ok(res, doc);
  })
);
r.delete(
  "/user-categories/:id",
  require_("setup", "del"),
  asyncHandler(async (req: any, res: any) => {
    const inUse = await User.countDocuments({ tenant: req.tenantId, category: req.params.id });
    if (inUse) throw new ApiError(409, `${inUse} user${inUse === 1 ? " has" : "s have"} this user type. Move them to another type first.`);
    const done = await UserCategory.deleteOne({ _id: req.params.id, tenant: req.tenantId });
    if (!done.deletedCount) throw new ApiError(404, "User type not found");
    ok(res, { deleted: true });
  })
);

/* ---- Users ---- */
const readUser = async (req: any, body: any, existing?: any) => {
  const out: any = {};
  const has = (k: string) => body[k] !== undefined;
  if (has("name") || !existing) {
    out.name = String(body.name || "").trim();
    if (!out.name) throw new ApiError(400, "Enter the user's name");
  }
  if (has("email") || !existing) {
    out.email = String(body.email || "").trim().toLowerCase();
    if (!EMAIL.test(out.email)) throw new ApiError(400, "Enter a valid email address");
  }
  if (has("mobile")) {
    out.mobile = digits(body.mobile);
    if (out.mobile && out.mobile.length < 7) throw new ApiError(400, "Enter a valid mobile number");
    if (out.mobile) {
      const clash = await User.findOne({ mobile: out.mobile, _id: { $ne: existing?._id } }).select("_id").lean();
      if (clash) throw new ApiError(409, "Another user already has this mobile number");
    }
  }
  if (has("dob")) {
    out.dob = String(body.dob || "");
    if (out.dob && !/^\d{4}-\d{2}-\d{2}$/.test(out.dob)) throw new ApiError(400, "Enter a valid date of birth");
  }
  if (has("userType") || !existing) {
    const role = body.userType?._id || body.userType;
    if (!role || !(await UserType.exists({ _id: role, tenant: req.tenantId }))) throw new ApiError(400, "Choose a role");
    out.userType = role;
  }
  if (has("category")) {
    const cat = body.category?._id || body.category || null;
    if (cat && !(await UserCategory.exists({ _id: cat, tenant: req.tenantId }))) throw new ApiError(400, "Choose a user type");
    out.category = cat;
  }
  if (has("designation")) out.designation = body.designation || null;
  if (has("status")) out.status = ["Active", "Inactive", "Pending"].includes(body.status) ? body.status : "Active";
  return out;
};

r.get(
  "/users",
  require_("setup", "view"),
  asyncHandler(async (req: any, res: any) => {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(String(req.query.perPage || "50"), 10) || 50));
    const filter: any = { tenant: req.tenantId };
    if (req.query.q) {
      const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { email: rx }, { mobile: rx }];
    }
    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).populate("userType category"),
      User.countDocuments(filter),
    ]);
    paginated(res, items, total, page, perPage);
  })
);

r.post(
  "/users",
  require_("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const data = await readUser(req, req.body);
    const cat: any = data.category ? await UserCategory.findById(data.category).lean() : null;
    // the first password comes from the Password Policy of this kind of user
    const first = await defaultPassword(req.tenantId, cat?.kind === "client" ? "client" : "internal", data);
    const user = await User.create({
      ...data,
      tenant: req.tenantId,
      passwordHash: await bcrypt.hash(first.password, 10),
      mustChangePassword: first.forceChange,
    });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "User Management", entity: user.email });
    ok(res, { user: await user.populate("userType category"), passwordRule: first.rule, mustChangePassword: first.forceChange }, 201);
  })
);

r.patch(
  "/users/:id",
  require_("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const existing = await User.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!existing) throw new ApiError(404, "User not found");
    const data = await readUser(req, req.body, existing);
    if (String(existing._id) === String(req.auth.uid) && data.status && data.status !== "Active") {
      throw new ApiError(400, "You cannot deactivate your own account");
    }
    Object.assign(existing, data);
    await existing.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "User Management", entity: existing.email });
    ok(res, await existing.populate("userType category"));
  })
);

// This user's own exceptions to the role (one row per module that differs).
r.put(
  "/users/:id/permissions",
  require_("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      { $set: { permOverrides: cleanPerms(req.body?.overrides) } },
      { new: true }
    ).populate("userType category");
    if (!user) throw new ApiError(404, "User not found");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "User Management", entity: `Access of ${user.email}` });
    ok(res, user);
  })
);

// Back to the default password of the policy.
r.post(
  "/users/:id/reset-password",
  require_("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const user: any = await User.findOne({ _id: req.params.id, tenant: req.tenantId }).populate("category");
    if (!user) throw new ApiError(404, "User not found");
    const first = await defaultPassword(req.tenantId, user.category?.kind === "client" ? "client" : "internal", user);
    user.passwordHash = await bcrypt.hash(first.password, 10);
    user.mustChangePassword = first.forceChange;
    await user.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "User Management", entity: `Password reset for ${user.email}` });
    ok(res, { passwordRule: first.rule, mustChangePassword: first.forceChange });
  })
);

r.delete(
  "/users/:id",
  require_("setup", "del"),
  asyncHandler(async (req: any, res: any) => {
    if (String(req.params.id) === String(req.auth.uid)) throw new ApiError(400, "You cannot delete your own account");
    const done = await User.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
    if (!done) throw new ApiError(404, "User not found");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "User Management", entity: done.email });
    ok(res, { deleted: true });
  })
);

/* ---- Password policy: one for our own users, one for client users ---- */
const presentPolicy = (p: any) => ({
  kind: p.kind,
  mode: p.mode,
  parts: p.parts,
  fixedSet: !!p.fixed,
  fixedMasked: p.fixed ? maskSecret(decryptSecret(p.fixed)) : "",
  forceChange: p.forceChange !== false,
  rule: describeRule(p),
});
r.get(
  "/password-policy",
  require_("setup", "view"),
  asyncHandler(async (req: any, res: any) => {
    ok(res, [presentPolicy(await policyFor(req.tenantId, "internal")), presentPolicy(await policyFor(req.tenantId, "client"))]);
  })
);
r.put(
  "/password-policy/:kind",
  require_("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const kind = req.params.kind === "client" ? "client" : "internal";
    const current = await policyFor(req.tenantId, kind);
    const mode = req.body?.mode === "fixed" ? "fixed" : "parts";
    const parts = (Array.isArray(req.body?.parts) ? req.body.parts : []).filter((p: any, i: number, all: any[]) => (PASSWORD_PARTS as readonly string[]).includes(p) && all.indexOf(p) === i);
    if (mode === "parts" && !parts.length) throw new ApiError(400, "Choose what the default password is made from");
    const typed = String(req.body?.fixed || "");
    if (mode === "fixed" && !typed && !current.fixed) throw new ApiError(400, "Enter the fixed password");
    if (typed && typed.length < 6) throw new ApiError(400, "The fixed password needs at least 6 characters");
    const doc = await PasswordPolicy.findOneAndUpdate(
      { tenant: req.tenantId, kind },
      { $set: { mode, parts: mode === "parts" ? parts : current.parts, fixed: typed ? encryptSecret(typed) : current.fixed, forceChange: req.body?.forceChange !== false } },
      { new: true, upsert: true }
    );
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "User Management", entity: `Password policy (${kind})` });
    ok(res, presentPolicy(doc));
  })
);

export default r;
