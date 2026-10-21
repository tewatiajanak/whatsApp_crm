import { Schema, model, Document, Types } from "mongoose";

const T = { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true } as const;

/* ───────────── recycle bin: a deleted lead with everything that hung off it ───────────── */
export interface ILeadTrash extends Document {
  tenant: Types.ObjectId;
  leadId: Types.ObjectId;
  name: string;
  phone: string;
  owner: string;
  deletedBy: string;
  deletedAt: Date;
  /** the lead and its follow-ups, timeline, fees and document records, exactly as they were */
  snapshot: { lead: any; followUps: any[]; activities: any[]; fees: any[]; documents: any[] };
}
const leadTrashSchema = new Schema<ILeadTrash>(
  {
    tenant: T,
    leadId: { type: Schema.Types.ObjectId, required: true },
    name: String,
    phone: String,
    owner: String,
    deletedBy: { type: String, default: "System" },
    deletedAt: { type: Date, default: Date.now, index: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: false, minimize: false }
);
export const LeadTrash = model<ILeadTrash>("LeadTrash", leadTrashSchema);

/* ───────────── masters: courses, branches ───────────── */
export interface ICourse extends Document { tenant: Types.ObjectId; name: string; fee: number; seats: number; intake: string; active: boolean }
const courseSchema = new Schema<ICourse>(
  { tenant: T, name: { type: String, required: true, trim: true }, fee: { type: Number, default: 0 }, seats: { type: Number, default: 0 }, intake: { type: String, default: "" }, active: { type: Boolean, default: true } },
  { timestamps: true }
);
courseSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const Course = model<ICourse>("CrmCourse", courseSchema);

export interface IBranch extends Document { tenant: Types.ObjectId; name: string; city: string; active: boolean }
const branchSchema = new Schema<IBranch>(
  { tenant: T, name: { type: String, required: true, trim: true }, city: { type: String, default: "" }, active: { type: Boolean, default: true } },
  { timestamps: true }
);
branchSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const Branch = model<IBranch>("CrmBranch", branchSchema);

/* ───────────── referral partners (agents) ───────────── */
export interface IPartner extends Document {
  tenant: Types.ObjectId;
  name: string;
  phone: string;
  email: string;
  /** goes in links as ?ref=CODE */
  code: string;
  commissionType: "per_win" | "percent_paid";
  rate: number;
  /** unguessable id in the partner's own status link */
  token: string;
  active: boolean;
  paidOut: number;
}
const partnerSchema = new Schema<IPartner>(
  {
    tenant: T,
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    code: { type: String, required: true, uppercase: true, trim: true },
    commissionType: { type: String, enum: ["per_win", "percent_paid"], default: "per_win" },
    rate: { type: Number, default: 0 },
    token: { type: String, required: true, unique: true },
    active: { type: Boolean, default: true },
    paidOut: { type: Number, default: 0 },
  },
  { timestamps: true }
);
partnerSchema.index({ tenant: 1, code: 1 }, { unique: true });
export const Partner = model<IPartner>("CrmPartner", partnerSchema);

/* ───────────── what was spent on a source in a month (for cost per lead) ───────────── */
export interface ISourceSpend extends Document { tenant: Types.ObjectId; source: Types.ObjectId; month: string; amount: number }
const sourceSpendSchema = new Schema<ISourceSpend>(
  { tenant: T, source: { type: Schema.Types.ObjectId, ref: "LeadSource", required: true }, month: { type: String, required: true }, amount: { type: Number, default: 0 } },
  { timestamps: true }
);
sourceSpendSchema.index({ tenant: 1, month: 1, source: 1 }, { unique: true });
export const SourceSpend = model<ISourceSpend>("CrmSourceSpend", sourceSpendSchema);

/* ───────────── approvals (fee discounts) ───────────── */
export const APPROVAL_KINDS = ["fee_discount", "refund", "quote_discount"] as const;
export interface IApproval extends Document {
  tenant: Types.ObjectId;
  kind: (typeof APPROVAL_KINDS)[number];
  lead: Types.ObjectId;
  leadName: string;
  fee: Types.ObjectId;
  feeTitle: string;
  amount: number;
  reason: string;
  requestedBy: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decidedBy: string;
  decidedAt?: Date | null;
  note: string;
  /** what the request is about when it is not a fee (a quotation) */
  entity?: Types.ObjectId | null;
  entityTitle: string;
  link: string;
  percent: number;
  /** 1, or 2 when a second person must also approve */
  level: number;
  levels: number;
  trail: Array<{ level: number; status: string; by: string; at: Date; note: string }>;
  payload: any;
  createdAt: Date;
}
const approvalSchema = new Schema<IApproval>(
  {
    tenant: T,
    kind: { type: String, default: "fee_discount" },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    leadName: String,
    fee: { type: Schema.Types.ObjectId, ref: "LeadFee", default: null },
    feeTitle: String,
    amount: { type: Number, required: true },
    reason: { type: String, default: "" },
    requestedBy: { type: String, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected", "cancelled"], default: "pending" },
    decidedBy: { type: String, default: "" },
    decidedAt: { type: Date, default: null },
    note: { type: String, default: "" },
    entity: { type: Schema.Types.ObjectId, default: null },
    entityTitle: { type: String, default: "" },
    link: { type: String, default: "" },
    percent: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    levels: { type: Number, default: 1 },
    trail: { type: [{ _id: false, level: Number, status: String, by: String, at: Date, note: String }], default: [] },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);
approvalSchema.index({ tenant: 1, status: 1, createdAt: -1 });
export const Approval = model<IApproval>("CrmApproval", approvalSchema);

/* ───────────── website visits (tracking script) ───────────── */
export interface IWebVisit extends Document { tenant: Types.ObjectId; visitor: string; lead?: Types.ObjectId | null; url: string; title: string; referrer: string; at: Date }
const webVisitSchema = new Schema<IWebVisit>(
  { tenant: T, visitor: { type: String, required: true }, lead: { type: Schema.Types.ObjectId, ref: "Lead", default: null }, url: String, title: String, referrer: String, at: { type: Date, default: Date.now } },
  { timestamps: false }
);
webVisitSchema.index({ tenant: 1, visitor: 1, at: -1 });
webVisitSchema.index({ tenant: 1, lead: 1, at: -1 });
// anonymous visits are kept for 90 days
webVisitSchema.index({ at: 1 }, { expireAfterSeconds: 90 * 86400 });
export const WebVisit = model<IWebVisit>("CrmWebVisit", webVisitSchema);

/* ───────────── emails sent from the CRM, so opens and clicks can be counted ───────────── */
export interface IEmailTrack extends Document { tenant: Types.ObjectId; lead: Types.ObjectId; subject: string; token: string; opens: number; clicks: number; firstOpenAt?: Date | null; sentAt: Date }
const emailTrackSchema = new Schema<IEmailTrack>(
  { tenant: T, lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true }, subject: String, token: { type: String, required: true, unique: true }, opens: { type: Number, default: 0 }, clicks: { type: Number, default: 0 }, firstOpenAt: { type: Date, default: null }, sentAt: { type: Date, default: Date.now } },
  { timestamps: false }
);
export const EmailTrack = model<IEmailTrack>("CrmEmailTrack", emailTrackSchema);

/* ───────────── browser push subscriptions ───────────── */
export interface IPushSub extends Document { tenant: Types.ObjectId; user: Types.ObjectId; endpoint: string; keys: { p256dh: string; auth: string } }
const pushSubSchema = new Schema<IPushSub>(
  { tenant: T, user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }, endpoint: { type: String, required: true, unique: true }, keys: { p256dh: String, auth: String } },
  { timestamps: true }
);
export const PushSub = model<IPushSub>("CrmPushSub", pushSubSchema);

/* ───────────── one-time codes for applicants signing in with their phone ───────────── */
export interface IApplicantOtp extends Document { tenant: Types.ObjectId; phoneKey: string; hash: string; expires: Date; attempts: number }
const applicantOtpSchema = new Schema<IApplicantOtp>(
  { tenant: T, phoneKey: { type: String, required: true }, hash: { type: String, required: true }, expires: { type: Date, required: true }, attempts: { type: Number, default: 0 } },
  { timestamps: true }
);
applicantOtpSchema.index({ expires: 1 }, { expireAfterSeconds: 0 });
applicantOtpSchema.index({ phoneKey: 1 });
export const ApplicantOtp = model<IApplicantOtp>("CrmApplicantOtp", applicantOtpSchema);
