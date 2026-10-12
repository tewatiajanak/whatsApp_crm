import { Schema, model, Document, Types } from "mongoose";

/**
 * One collection for every simple Project Management master (statuses,
 * priorities, task types, …). `type` says which master a row belongs to; the
 * registry in services/pm/masters lists the types and the flags each one has.
 * Code reads the FLAGS (isCompleted, pausesTat, …), never the names.
 */
export interface IPmMaster extends Document {
  tenant: Types.ObjectId;
  type: string;
  name: string;
  color: string;
  order: number;
  active: boolean;
  flags: Record<string, boolean>;
  /** numbers a type needs, e.g. ticket priority: responseHours, resolveHours */
  values: Record<string, number>;
  isDemo?: boolean;
}

const masterSchema = new Schema<IPmMaster>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    type: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#64748b" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    flags: { type: Schema.Types.Mixed, default: {} },
    values: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);
masterSchema.index({ tenant: 1, type: 1, name: 1 }, { unique: true });
masterSchema.index({ tenant: 1, type: 1, order: 1 });

export const PmMaster = model<IPmMaster>("PmMaster", masterSchema, "pm_masters");

/* ---- Holidays ---- */
export interface IPmHoliday extends Document {
  tenant: Types.ObjectId;
  /** YYYY-MM-DD */
  date: string;
  name: string;
}
const holidaySchema = new Schema<IPmHoliday>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    date: { type: String, required: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);
holidaySchema.index({ tenant: 1, date: 1 }, { unique: true });
export const PmHoliday = model<IPmHoliday>("PmHoliday", holidaySchema, "pm_holidays");

/* ---- Settings: one record per tenant ---- */
export interface IPmSettings extends Document {
  tenant: Types.ObjectId;
  /** 0 = Sunday … 6 = Saturday */
  workingDays: number[];
  /** HH:MM, local time */
  workStart: string;
  workEnd: string;
  maxAttachments: number;
  maxFileSizeMb: number;
  allowedFileTypes: string[];
  /** schedule status: ahead / delayed when actual progress differs from planned by more than this (%) */
  aheadThreshold: number;
  delayedThreshold: number;
  pastedImagesCount: boolean;
  /** allowed task status changes; none = every change is allowed */
  taskStatusFlow: { from: Types.ObjectId; to: Types.ObjectId }[];
  /** default masters were created once for this tenant */
  mastersSeeded: boolean;
  /** default communication templates were created once */
  templatesSeeded: boolean;
  /** a client may reopen a closed ticket within this many days */
  ticketReopenDays: number;
  /** a person with more open tasks than this is shown as overloaded */
  workloadThreshold: number;
  /** people may log hours on tasks */
  timeLogging: boolean;
  /** a new meeting emails its invite unless switched off on the meeting */
  meetingEmail: boolean;
}
const settingsSchema = new Schema<IPmSettings>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5, 6] },
    workStart: { type: String, default: "09:30" },
    workEnd: { type: String, default: "18:30" },
    maxAttachments: { type: Number, default: 3 },
    maxFileSizeMb: { type: Number, default: 10 },
    allowedFileTypes: { type: [String], default: ["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "zip"] },
    aheadThreshold: { type: Number, default: 5 },
    delayedThreshold: { type: Number, default: 5 },
    pastedImagesCount: { type: Boolean, default: false },
    taskStatusFlow: {
      type: [new Schema({ from: { type: Schema.Types.ObjectId, ref: "PmMaster" }, to: { type: Schema.Types.ObjectId, ref: "PmMaster" } }, { _id: false })],
      default: [],
    },
    mastersSeeded: { type: Boolean, default: false },
    templatesSeeded: { type: Boolean, default: false },
    ticketReopenDays: { type: Number, default: 7 },
    workloadThreshold: { type: Number, default: 12 },
    timeLogging: { type: Boolean, default: true },
    meetingEmail: { type: Boolean, default: true },
  },
  { timestamps: true }
);
export const PmSettings = model<IPmSettings>("PmSettings", settingsSchema, "pm_settings");
