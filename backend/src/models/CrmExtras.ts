import { Schema, model, Document, Types } from "mongoose";

const T = { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true } as const;

/* ───────────── CRM settings (one per tenant) ───────────── */
export interface ICrmSettings extends Document {
  tenant: Types.ObjectId;
  reminders: { enabled: boolean; minutesBefore: number; morningDigest: boolean; digestHour: number };
  sla: { enabled: boolean; firstResponseMins: number; notifyManager: boolean; alsoNotify: string[] };
  telephony: { provider: "none" | "exotel" | "custom"; sid: string; apiKey: string; apiToken: string; subdomain: string; callerId: string; customUrl: string; customHeaders: string };
  sms: { provider: "none" | "msg91" | "custom"; authKey: string; senderId: string; entityId: string; customUrl: string; customMethod: "GET" | "POST"; customHeaders: string; customBody: string };
  reports: { enabled: boolean; frequency: "daily" | "weekly"; hour: number; weekday: number; recipients: string[]; lastSentKey: string };
  applicationStages: string[];
  assignment: { maxOpenLeads: number; respectHours: boolean; startHour: number; endHour: number; reassignOnSla: boolean };
  duplicates: { matchEmail: boolean; matchAltPhone: boolean; action: "enquiry" | "block" | "allow" };
  ivr: { enabled: boolean; greeting: string; options: Array<{ digit: string; label: string; target: string }> };
  inbox: { enabled: boolean; host: string; port: number; secure: boolean; user: string; pass: string; lastUid: number; lastCheck?: Date | null; lastError: string };
  pulls: Array<{ name: string; url: string; headers: string; listPath: string; map: Record<string, string>; enabled: boolean; lastPull?: Date | null; lastError: string }>;
  google: { clientId: string; clientSecret: string };
  billing: { legalName: string; address: string; gstin: string; gstPercent: number; invoicePrefix: string };
  portals: { indiamartEnabled: boolean; indiamartKey: string; indiamartLastPull?: Date | null; indiamartLastError: string };
  push: { publicKey: string; privateKey: string };
  booking: { enabled: boolean; slotMinutes: number; startHour: number; endHour: number; days: number[] };
  trashDays: number;
  lastDecayKey: string;
  lastDigestKey: string;
}

export const DEFAULT_APPLICATION_STAGES = ["Submitted", "Under review", "Documents pending", "Offer made", "Offer accepted", "Enrolled", "Rejected"];

const crmSettingsSchema = new Schema<ICrmSettings>(
  {
    tenant: { ...T, unique: true },
    reminders: {
      enabled: { type: Boolean, default: true },
      minutesBefore: { type: Number, default: 15 },
      morningDigest: { type: Boolean, default: true },
      digestHour: { type: Number, default: 9 },
    },
    sla: {
      enabled: { type: Boolean, default: false },
      firstResponseMins: { type: Number, default: 30 },
      notifyManager: { type: Boolean, default: true },
      alsoNotify: { type: [String], default: [] },
    },
    telephony: {
      provider: { type: String, enum: ["none", "exotel", "custom"], default: "none" },
      sid: { type: String, default: "" },
      apiKey: { type: String, default: "" },
      apiToken: { type: String, default: "" }, // encrypted
      subdomain: { type: String, default: "api.exotel.com" },
      callerId: { type: String, default: "" },
      customUrl: { type: String, default: "" },
      customHeaders: { type: String, default: "" }, // encrypted JSON
    },
    sms: {
      provider: { type: String, enum: ["none", "msg91", "custom"], default: "none" },
      authKey: { type: String, default: "" }, // encrypted
      senderId: { type: String, default: "" },
      entityId: { type: String, default: "" },
      customUrl: { type: String, default: "" },
      customMethod: { type: String, enum: ["GET", "POST"], default: "GET" },
      customHeaders: { type: String, default: "" }, // encrypted JSON
      customBody: { type: String, default: "" },
    },
    reports: {
      enabled: { type: Boolean, default: false },
      frequency: { type: String, enum: ["daily", "weekly"], default: "daily" },
      hour: { type: Number, default: 19 },
      weekday: { type: Number, default: 1 },
      recipients: { type: [String], default: [] },
      lastSentKey: { type: String, default: "" },
    },
    applicationStages: { type: [String], default: DEFAULT_APPLICATION_STAGES },
    assignment: {
      maxOpenLeads: { type: Number, default: 0 }, // 0 = no limit
      respectHours: { type: Boolean, default: false },
      startHour: { type: Number, default: 9 },
      endHour: { type: Number, default: 19 },
      reassignOnSla: { type: Boolean, default: false },
    },
    duplicates: {
      matchEmail: { type: Boolean, default: false },
      matchAltPhone: { type: Boolean, default: false },
      // what happens when the same person is entered again
      action: { type: String, enum: ["enquiry", "block", "allow"], default: "enquiry" },
    },
    ivr: {
      enabled: { type: Boolean, default: false },
      greeting: { type: String, default: "Welcome. Press 1 for admissions, 2 for fees." },
      options: { type: [{ _id: false, digit: String, label: String, target: String }], default: [] },
    },
    inbox: {
      enabled: { type: Boolean, default: false },
      host: { type: String, default: "" },
      port: { type: Number, default: 993 },
      secure: { type: Boolean, default: true },
      user: { type: String, default: "" },
      pass: { type: String, default: "" }, // encrypted
      lastUid: { type: Number, default: 0 },
      lastCheck: { type: Date, default: null },
      lastError: { type: String, default: "" },
    },
    pulls: {
      type: [{ _id: false, name: String, url: String, headers: String, listPath: String, map: Schema.Types.Mixed, enabled: { type: Boolean, default: true }, lastPull: Date, lastError: String, seen: [String] }],
      default: [],
    },
    google: { clientId: { type: String, default: "" }, clientSecret: { type: String, default: "" } }, // secret encrypted
    billing: {
      legalName: { type: String, default: "" },
      address: { type: String, default: "" },
      gstin: { type: String, default: "" },
      gstPercent: { type: Number, default: 0 },
      invoicePrefix: { type: String, default: "INV" },
    },
    portals: {
      indiamartEnabled: { type: Boolean, default: false },
      indiamartKey: { type: String, default: "" }, // encrypted
      indiamartLastPull: { type: Date, default: null },
      indiamartLastError: { type: String, default: "" },
    },
    push: { publicKey: { type: String, default: "" }, privateKey: { type: String, default: "" } }, // private key encrypted
    booking: {
      enabled: { type: Boolean, default: false },
      slotMinutes: { type: Number, default: 30 },
      startHour: { type: Number, default: 10 },
      endHour: { type: Number, default: 18 },
      days: { type: [Number], default: [1, 2, 3, 4, 5, 6] },
    },
    trashDays: { type: Number, default: 30 },
    lastDecayKey: { type: String, default: "" },
    lastDigestKey: { type: String, default: "" },
  },
  { timestamps: true, minimize: false }
);
export const CrmSettings = model<ICrmSettings>("CrmSettings", crmSettingsSchema);

/** The tenant's settings, created with defaults the first time they are needed. */
export async function crmSettingsFor(tenant: any): Promise<ICrmSettings> {
  return (await CrmSettings.findOne({ tenant })) || (await CrmSettings.create({ tenant }));
}

/* ───────────── documents on a lead ───────────── */
export interface ILeadDocument extends Document {
  tenant: Types.ObjectId;
  lead: Types.ObjectId;
  name: string;
  category: string;
  file: string; // file name inside uploads/lead-docs/<tenant>/
  mime: string;
  size: number;
  by: string;
}
const leadDocumentSchema = new Schema<ILeadDocument>(
  {
    tenant: T,
    lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, default: "" },
    file: { type: String, required: true },
    mime: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    by: { type: String, default: "System" },
  },
  { timestamps: true }
);
export const LeadDocument = model<ILeadDocument>("LeadDocument", leadDocumentSchema);

/* ───────────── fees and payments on a lead ───────────── */
export const FEE_MODES = ["Online", "Cash", "UPI", "Bank transfer", "Cheque", "Card"] as const;
export interface ILeadFee extends Document {
  tenant: Types.ObjectId;
  lead: Types.ObjectId;
  title: string;
  amount: number;
  dueDate?: Date | null;
  status: "pending" | "paid" | "cancelled";
  mode: string;
  reference: string;
  note: string;
  /** unguessable id in the public payment link */
  token: string;
  txnId: string;
  receiptNo: string;
  paidAt?: Date | null;
  by: string;
  /** approved concession taken off the amount */
  discount: number;
  paidAmount: number;
  payments: Array<{ amount: number; mode: string; reference: string; receiptNo: string; at: Date; by: string; txnId?: string }>;
  refunds: Array<{ amount: number; reason: string; at: Date; by: string }>;
  invoiceNo: string;
  /** instalments made from one plan share this id */
  plan: string;
}

/** What is still to be paid on a fee. */
export const feeBalance = (f: { amount: number; discount?: number; paidAmount?: number }) => Math.max(0, Math.round(((f.amount || 0) - (f.discount || 0) - (f.paidAmount || 0)) * 100) / 100);
const leadFeeSchema = new Schema<ILeadFee>(
  {
    tenant: T,
    lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: ["pending", "paid", "cancelled"], default: "pending" },
    mode: { type: String, default: "" },
    reference: { type: String, default: "" },
    note: { type: String, default: "" },
    token: { type: String, required: true, unique: true },
    txnId: { type: String, default: "" },
    receiptNo: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    by: { type: String, default: "System" },
    discount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    payments: { type: [{ _id: false, amount: Number, mode: String, reference: String, receiptNo: String, at: Date, by: String, txnId: String }], default: [] },
    refunds: { type: [{ _id: false, amount: Number, reason: String, at: Date, by: String }], default: [] },
    invoiceNo: { type: String, default: "" },
    plan: { type: String, default: "" },
  },
  { timestamps: true }
);
export const LeadFee = model<ILeadFee>("LeadFee", leadFeeSchema);

/* ───────────── monthly targets per counsellor ───────────── */
export interface ILeadTarget extends Document {
  tenant: Types.ObjectId;
  owner: string;
  month: string; // yyyy-mm
  wins: number;
  value: number;
  calls: number;
  followUps: number;
}
const leadTargetSchema = new Schema<ILeadTarget>(
  {
    tenant: T,
    owner: { type: String, required: true },
    month: { type: String, required: true },
    wins: { type: Number, default: 0 },
    value: { type: Number, default: 0 },
    calls: { type: Number, default: 0 },
    followUps: { type: Number, default: 0 },
  },
  { timestamps: true }
);
leadTargetSchema.index({ tenant: 1, month: 1, owner: 1 }, { unique: true });
export const LeadTarget = model<ILeadTarget>("LeadTarget", leadTargetSchema);

/* ───────────── API keys for pushing leads in from outside ───────────── */
export interface ILeadApiKey extends Document {
  tenant: Types.ObjectId;
  name: string;
  keyHash: string;
  hint: string; // last 4 characters, to tell keys apart
  source?: Types.ObjectId | null;
  owner: string;
  active: boolean;
  hits: number;
  lastUsedAt?: Date | null;
  lastError: string;
}
const leadApiKeySchema = new Schema<ILeadApiKey>(
  {
    tenant: T,
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true, unique: true },
    hint: { type: String, default: "" },
    source: { type: Schema.Types.ObjectId, ref: "LeadSource", default: null },
    owner: { type: String, default: "" },
    active: { type: Boolean, default: true },
    hits: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
  },
  { timestamps: true }
);
export const LeadApiKey = model<ILeadApiKey>("LeadApiKey", leadApiKeySchema);

/* ───────────── automation: delayed steps + run log ───────────── */
export interface IAutomationJob extends Document {
  tenant: Types.ObjectId;
  workflow: Types.ObjectId;
  lead: Types.ObjectId;
  action: { kind: string; params: Record<string, any> };
  runAt: Date;
  status: "pending" | "done" | "failed" | "skipped";
  error: string;
}
const automationJobSchema = new Schema<IAutomationJob>(
  {
    tenant: T,
    workflow: { type: Schema.Types.ObjectId, ref: "Workflow", required: true },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    action: { type: Schema.Types.Mixed, required: true },
    runAt: { type: Date, required: true },
    status: { type: String, enum: ["pending", "done", "failed", "skipped"], default: "pending" },
    error: { type: String, default: "" },
  },
  { timestamps: true }
);
automationJobSchema.index({ status: 1, runAt: 1 });
export const AutomationJob = model<IAutomationJob>("AutomationJob", automationJobSchema);

export interface IAutomationRun extends Document {
  tenant: Types.ObjectId;
  workflow: Types.ObjectId;
  workflowName: string;
  lead?: Types.ObjectId | null;
  leadName: string;
  event: string;
  action: string;
  ok: boolean;
  detail: string;
  at: Date;
}
const automationRunSchema = new Schema<IAutomationRun>(
  {
    tenant: T,
    workflow: { type: Schema.Types.ObjectId, ref: "Workflow" },
    workflowName: { type: String, default: "" },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    leadName: { type: String, default: "" },
    event: { type: String, default: "" },
    action: { type: String, default: "" },
    ok: { type: Boolean, default: true },
    detail: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);
automationRunSchema.index({ tenant: 1, at: -1 });
export const AutomationRun = model<IAutomationRun>("AutomationRun", automationRunSchema);
