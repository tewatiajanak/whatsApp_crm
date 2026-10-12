import { Schema, model, Document, Types } from "mongoose";

/* ---- Saved view: a named set of filters on a screen (tasks, a report), optionally shared ---- */
export interface IPmSavedView extends Document {
  tenant: Types.ObjectId;
  user: Types.ObjectId;
  /** "tasks" or "report:<key>" */
  screen: string;
  name: string;
  filters: Record<string, any>;
  shared: boolean;
}
const viewSchema = new Schema<IPmSavedView>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    screen: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    filters: { type: Schema.Types.Mixed, default: {} },
    shared: { type: Boolean, default: false },
  },
  { timestamps: true, minimize: false }
);
viewSchema.index({ tenant: 1, screen: 1 });
export const PmSavedView = model<IPmSavedView>("PmSavedView", viewSchema, "pm_saved_views");

/* ---- Time log: hours a person spent on a task ---- */
export interface IPmTimeLog extends Document {
  tenant: Types.ObjectId;
  task: Types.ObjectId;
  project?: Types.ObjectId | null;
  user: Types.ObjectId;
  /** YYYY-MM-DD */
  date: string;
  hours: number;
  note: string;
}
const timeSchema = new Schema<IPmTimeLog>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "PmTask", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", default: null },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    hours: { type: Number, required: true },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);
timeSchema.index({ tenant: 1, user: 1, date: 1 });
export const PmTimeLog = model<IPmTimeLog>("PmTimeLog", timeSchema, "pm_time_logs");

/* ---- Recurring task: makes an ad-hoc task again and again ---- */
export interface IPmRecurring extends Document {
  tenant: Types.ObjectId;
  title: string;
  description: string;
  assignee: Types.ObjectId;
  project?: Types.ObjectId | null;
  priority?: Types.ObjectId | null;
  checklist: string[];
  freq: "daily" | "weekly" | "monthly";
  /** every N days / weeks / months */
  every: number;
  /** days after creation the task is due */
  dueInDays: number;
  /** YYYY-MM-DD of the next task */
  next: string;
  until: string;
  active: boolean;
  createdBy: Types.ObjectId;
  made: number;
}
const recurringSchema = new Schema<IPmRecurring>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    assignee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", default: null },
    priority: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    checklist: { type: [String], default: [] },
    freq: { type: String, enum: ["daily", "weekly", "monthly"], default: "weekly" },
    every: { type: Number, default: 1 },
    dueInDays: { type: Number, default: 1 },
    next: { type: String, required: true },
    until: { type: String, default: "" },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    made: { type: Number, default: 0 },
  },
  { timestamps: true }
);
recurringSchema.index({ active: 1, next: 1 });
export const PmRecurring = model<IPmRecurring>("PmRecurring", recurringSchema, "pm_recurring");
