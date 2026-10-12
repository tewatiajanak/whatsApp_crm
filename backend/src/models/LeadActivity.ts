import { Schema, model, Document, Types } from "mongoose";

/** One entry on a lead's timeline: everything that happened to the lead, in order. */
export const ACTIVITY_TYPES = [
  "created", "enquiry", "status", "assigned", "note", "call", "message",
  "followup_scheduled", "followup_done", "followup_rescheduled",
  "edited", "service", "imported", "merged", "tag", "registration",
  "document", "payment", "automation", "sla", "visit", "email", "approval", "restored",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ILeadActivity extends Document {
  tenant: Types.ObjectId;
  lead: Types.ObjectId;
  type: ActivityType;
  title: string;
  detail?: string;
  by: string;
  meta?: Record<string, any>;
  at: Date;
}

const leadActivitySchema = new Schema<ILeadActivity>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    title: { type: String, required: true },
    detail: { type: String, default: "" },
    by: { type: String, default: "System" },
    meta: { type: Schema.Types.Mixed, default: {} },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

leadActivitySchema.index({ tenant: 1, lead: 1, at: -1 });
leadActivitySchema.index({ tenant: 1, type: 1, at: -1 });

export const LeadActivity = model<ILeadActivity>("LeadActivity", leadActivitySchema);
