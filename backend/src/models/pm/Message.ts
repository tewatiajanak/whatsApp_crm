import { Schema, model, Document, Types } from "mongoose";

/* ---- Message queue: every Email / WhatsApp of Project Management goes through here ---- */
export interface IPmMessage extends Document {
  tenant: Types.ObjectId;
  channel: "email" | "whatsapp";
  /** the address / number it is really sent to (the test recipient in test mode) */
  to: string;
  /** who it was meant for */
  intendedTo: string;
  toName: string;
  templateName: string;
  subject: string;
  body: string;
  /** the approved WhatsApp template to send it as, when set */
  waTemplateName: string;
  waLanguage: string;
  waParams: string[];
  /** header / button values of the template, when it has any (else waParams is enough) */
  waComponents: any[];
  /** WhatsApp quick-reply buttons (e.g. Approve / Reject of a verification) */
  waButtons: { id: string; title: string }[];
  /** attachments by file path (e.g. a meeting .ics) */
  attachments: { filename: string; content: string; contentType: string }[];
  event: string;
  project?: Types.ObjectId | null;
  task?: Types.ObjectId | null;
  client?: Types.ObjectId | null;
  /** meeting / ticket / verification … */
  refKind: string;
  refId?: Types.ObjectId | null;
  scheduledAt: Date;
  status: "Pending" | "Sending" | "Sent" | "Failed" | "Skipped";
  attempts: number;
  error: string;
  providerId: string;
  sentAt?: Date | null;
  /** WhatsApp delivery receipts */
  delivery: "" | "sent" | "delivered" | "read" | "failed";
  simulated: boolean;
}
const messageSchema = new Schema<IPmMessage>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    channel: { type: String, enum: ["email", "whatsapp"], required: true },
    to: { type: String, required: true },
    intendedTo: { type: String, default: "" },
    toName: { type: String, default: "" },
    templateName: { type: String, default: "" },
    subject: { type: String, default: "" },
    body: { type: String, default: "" },
    waTemplateName: { type: String, default: "" },
    waLanguage: { type: String, default: "en" },
    waParams: { type: [String], default: [] },
    waComponents: { type: Schema.Types.Mixed, default: [] },
    waButtons: { type: Schema.Types.Mixed, default: [] },
    attachments: { type: Schema.Types.Mixed, default: [] },
    event: { type: String, default: "" },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", default: null },
    task: { type: Schema.Types.ObjectId, ref: "PmTask", default: null },
    client: { type: Schema.Types.ObjectId, ref: "PmClient", default: null },
    refKind: { type: String, default: "" },
    refId: { type: Schema.Types.ObjectId, default: null },
    scheduledAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["Pending", "Sending", "Sent", "Failed", "Skipped"], default: "Pending" },
    attempts: { type: Number, default: 0 },
    error: { type: String, default: "" },
    providerId: { type: String, default: "" },
    sentAt: { type: Date, default: null },
    delivery: { type: String, default: "" },
    simulated: { type: Boolean, default: false },
  },
  { timestamps: true }
);
messageSchema.index({ status: 1, scheduledAt: 1 });
messageSchema.index({ tenant: 1, createdAt: -1 });
messageSchema.index({ tenant: 1, providerId: 1 });
messageSchema.index({ tenant: 1, task: 1 });
export const PmMessage = model<IPmMessage>("PmMessage", messageSchema, "pm_messages");

/* ---- Email / sending settings: one per tenant ---- */
export interface IPmMailSettings extends Document {
  tenant: Types.ObjectId;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  /** encrypted (services/payments/crypto) */
  smtpPass: string;
  fromName: string;
  fromEmail: string;
  /** web address of the app, used to build the links inside messages */
  appUrl: string;
  /** when on, every message goes to the test recipients below instead of the real ones */
  testMode: boolean;
  testEmail: string;
  testNumber: string;
  /** master switches */
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  /** daily digest at this hour (local); −1 = off */
  digestHour: number;
  lastDigest: string;
  /** reminder when the daily plan is not filled by this hour; −1 = off */
  planReminderHour: number;
  lastPlanReminder: string;
  /** remind a pending client verification after this many days; 0 = off */
  verificationReminderDays: number;
  verificationLinkDays: number;
}
const mailSchema = new Schema<IPmMailSettings>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    smtpHost: { type: String, default: "" },
    smtpPort: { type: Number, default: 587 },
    smtpSecure: { type: Boolean, default: false },
    smtpUser: { type: String, default: "" },
    smtpPass: { type: String, default: "" },
    fromName: { type: String, default: "" },
    fromEmail: { type: String, default: "" },
    appUrl: { type: String, default: "" },
    testMode: { type: Boolean, default: true },
    testEmail: { type: String, default: "" },
    testNumber: { type: String, default: "" },
    emailEnabled: { type: Boolean, default: true },
    whatsappEnabled: { type: Boolean, default: true },
    digestHour: { type: Number, default: -1 },
    lastDigest: { type: String, default: "" },
    planReminderHour: { type: Number, default: -1 },
    lastPlanReminder: { type: String, default: "" },
    verificationReminderDays: { type: Number, default: 2 },
    verificationLinkDays: { type: Number, default: 7 },
  },
  { timestamps: true }
);
export const PmMailSettings = model<IPmMailSettings>("PmMailSettings", mailSchema, "pm_mail_settings");

/* ---- In-app notifications ---- */
export const NOTIFY_CATEGORIES = [
  { key: "assigned", label: "Task assigned to me" },
  { key: "mention", label: "Mentions" },
  { key: "status", label: "Status changes on my work" },
  { key: "due", label: "Due tomorrow" },
  { key: "overdue", label: "Overdue" },
  { key: "unblocked", label: "My task can start" },
  { key: "verification", label: "Client verification" },
  { key: "ticket", label: "Tickets" },
  { key: "meeting", label: "Meetings & trainings" },
  { key: "plan", label: "Daily plan reminder" },
] as const;

export interface IPmNotification extends Document {
  tenant: Types.ObjectId;
  user: Types.ObjectId;
  category: string;
  title: string;
  body: string;
  /** where a click goes */
  task?: Types.ObjectId | null;
  project?: Types.ObjectId | null;
  link: string;
  read: boolean;
}
const notificationSchema = new Schema<IPmNotification>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    task: { type: Schema.Types.ObjectId, ref: "PmTask", default: null },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", default: null },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
notificationSchema.index({ tenant: 1, user: 1, read: 1, createdAt: -1 });
export const PmNotification = model<IPmNotification>("PmNotification", notificationSchema, "pm_notifications");

/* ---- A person's notification preferences: per category, which channels ---- */
export interface IPmNotifyPref extends Document {
  tenant: Types.ObjectId;
  user: Types.ObjectId;
  /** category → { inApp, email, whatsapp }; a missing category means in-app only */
  prefs: Record<string, { inApp: boolean; email: boolean; whatsapp: boolean }>;
  digest: boolean;
}
const prefSchema = new Schema<IPmNotifyPref>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    prefs: { type: Schema.Types.Mixed, default: {} },
    digest: { type: Boolean, default: true },
  },
  { timestamps: true, minimize: false }
);
prefSchema.index({ tenant: 1, user: 1 }, { unique: true });
export const PmNotifyPref = model<IPmNotifyPref>("PmNotifyPref", prefSchema, "pm_notify_prefs");
