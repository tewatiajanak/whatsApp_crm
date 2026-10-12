import { Schema, model, Document, Types } from "mongoose";

/* An employee's work plan for one day: one record per employee per date. */
export interface IPlanEntry {
  _id?: Types.ObjectId;
  project?: Types.ObjectId | null;
  task?: Types.ObjectId | null;
  /** what will be done, when no task is chosen */
  description: string;
  location?: Types.ObjectId | null;
  /** client / site name when onsite */
  site: string;
  hours: number;
  /** HH:MM, optional */
  from: string;
  to: string;
  /** end-of-day update */
  result: "" | "done" | "partial" | "not_done";
  remarks: string;
}

export interface IPmDailyPlan extends Document {
  tenant: Types.ObjectId;
  employee: Types.ObjectId;
  /** YYYY-MM-DD */
  date: string;
  entries: IPlanEntry[];
  isDemo?: boolean;
}

const entrySchema = new Schema<IPlanEntry>({
  project: { type: Schema.Types.ObjectId, ref: "PmProject", default: null },
  task: { type: Schema.Types.ObjectId, ref: "PmTask", default: null },
  description: { type: String, default: "", trim: true },
  location: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
  site: { type: String, default: "", trim: true },
  hours: { type: Number, default: 0 },
  from: { type: String, default: "" },
  to: { type: String, default: "" },
  result: { type: String, enum: ["", "done", "partial", "not_done"], default: "" },
  remarks: { type: String, default: "" },
});

const planSchema = new Schema<IPmDailyPlan>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    entries: { type: [entrySchema], default: [] },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
planSchema.index({ tenant: 1, employee: 1, date: 1 }, { unique: true });
planSchema.index({ tenant: 1, date: 1 });

export const PmDailyPlan = model<IPmDailyPlan>("PmDailyPlan", planSchema, "pm_daily_plans");
