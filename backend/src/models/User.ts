import { Schema, model, Document, Types } from "mongoose";

/* ---- Module permission shape ---- */
export interface IPermission {
  module: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  del: boolean;
}

export const MODULES = [
  "dashboard", "leads", "followups", "chat", "blast",
  "contacts", "conversion", "setup", "reports", "workflows",
];

/* ---- UserType = ROLE ----
   The collection is called "usertypes" for historical reasons, but it is the
   role: a named set of permissions. The "User Type" shown in the UI (own team
   vs client) is UserCategory, below. */
export interface IUserType extends Document {
  tenant: Types.ObjectId;
  name: string;
  desc?: string;
  perms: IPermission[];
}

const permSchema = new Schema<IPermission>(
  {
    module: { type: String, required: true },
    view: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    del: { type: Boolean, default: false },
  },
  { _id: false }
);

const userTypeSchema = new Schema<IUserType>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    desc: String,
    perms: { type: [permSchema], default: [] },
  },
  { timestamps: true }
);

export const UserType = model<IUserType>("UserType", userTypeSchema);

/* ---- UserCategory = "User Type" in the UI: whose user is this? ---- */
export interface IUserCategory extends Document {
  tenant: Types.ObjectId;
  name: string;
  /** internal = our own team · client = a client's user */
  kind: "internal" | "client";
  /** Ask for a one-time code after the password (MFA). */
  otpLogin: boolean;
  /** The most a user of this type may ever be allowed. Empty = no limit. */
  perms: IPermission[];
}

const userCategorySchema = new Schema<IUserCategory>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["internal", "client"], default: "internal" },
    otpLogin: { type: Boolean, default: false },
    perms: { type: [permSchema], default: [] },
  },
  { timestamps: true }
);
userCategorySchema.index({ tenant: 1, name: 1 }, { unique: true });

export const UserCategory = model<IUserCategory>("UserCategory", userCategorySchema);

/* ---- Password policy: the default password of a new user, per kind of user ---- */
export const PASSWORD_PARTS = ["mobile", "email", "dob"] as const;
export interface IPasswordPolicy extends Document {
  tenant: Types.ObjectId;
  kind: "internal" | "client";
  /** "parts": built from the user's own details, in this order · "fixed": one password for everyone */
  mode: "parts" | "fixed";
  parts: string[];
  /** encrypted (services/payments/crypto) */
  fixed: string;
  /** New users must set their own password at first sign-in. */
  forceChange: boolean;
}

const passwordPolicySchema = new Schema<IPasswordPolicy>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    kind: { type: String, enum: ["internal", "client"], required: true },
    mode: { type: String, enum: ["parts", "fixed"], default: "parts" },
    parts: { type: [String], default: ["mobile"] },
    fixed: { type: String, default: "" },
    forceChange: { type: Boolean, default: true },
  },
  { timestamps: true }
);
passwordPolicySchema.index({ tenant: 1, kind: 1 }, { unique: true });

export const PasswordPolicy = model<IPasswordPolicy>("PasswordPolicy", passwordPolicySchema);

/**
 * What a user may actually do:
 *   the role's permissions → replaced per module by the user's own exceptions
 *   → never more than the user type allows.
 */
export function effectivePerms(role: IPermission[] = [], overrides: IPermission[] = [], cap: IPermission[] = []): IPermission[] {
  const pick = (list: IPermission[], m: string) => list.find((x) => x.module === m);
  return MODULES.map((module) => {
    const base = pick(overrides, module) || pick(role, module) || { module, view: false, create: false, edit: false, del: false };
    const limit = cap.length ? pick(cap, module) || { module, view: false, create: false, edit: false, del: false } : null;
    const allow = (k: "view" | "create" | "edit" | "del") => !!base[k] && (!limit || !!limit[k]);
    return { module, view: allow("view"), create: allow("create"), edit: allow("edit"), del: allow("del") };
  });
}

/* ---- User ---- */
export interface IUser extends Document {
  tenant: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  /** the user's ROLE (see UserType above) */
  userType: Types.ObjectId;
  /** the user's "User Type" (own team / client) */
  category?: Types.ObjectId | null;
  mobile?: string;
  /** YYYY-MM-DD */
  dob?: string;
  /** Per-user exceptions to the role, one row per module that differs. */
  permOverrides: IPermission[];
  mustChangePassword: boolean;
  otp?: { hash: string; expires: Date; attempts: number } | null;
  designation?: Types.ObjectId | null;
  status: "Active" | "Inactive" | "Pending";
  lastLogin?: Date;
}

const userSchema = new Schema<IUser>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    userType: { type: Schema.Types.ObjectId, ref: "UserType", required: true },
    category: { type: Schema.Types.ObjectId, ref: "UserCategory", default: null },
    mobile: { type: String, default: "", trim: true },
    dob: { type: String, default: "" },
    permOverrides: { type: [permSchema], default: [] },
    mustChangePassword: { type: Boolean, default: false },
    otp: { type: new Schema({ hash: String, expires: Date, attempts: { type: Number, default: 0 } }, { _id: false }), default: null },
    designation: { type: Schema.Types.ObjectId, ref: "Designation", default: null },
    status: { type: String, enum: ["Active", "Inactive", "Pending"], default: "Active" },
    lastLogin: Date,
  },
  { timestamps: true }
);

userSchema.index({ tenant: 1, email: 1 }, { unique: true });

// never leak the hash
userSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    delete ret.otp;
    return ret;
  },
});

export const User = model<IUser>("User", userSchema);
