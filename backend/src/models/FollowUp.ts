import { Schema, model, Document, Types } from "mongoose";

export interface IFollowUp extends Document {
  tenant: Types.ObjectId;
  service?: Types.ObjectId | null;
  lead: Types.ObjectId;
  leadName: string;
  phone: string;
  due: Date; // Keep for compatibility
  dueDate?: Date; // NEW
  dueTime?: string; // NEW - HH:MM format
  type: string; // "Call" | "WhatsApp" | "Email" | "Visit" | "call" | "email" | "whatsapp" | "sms"
  note?: string;
  remark?: string; // NEW - follow-up note
  owner: string;
  assignedTo?: string; // NEW - assigned counsellor name
  status?: Types.ObjectId; // the lead status at time of scheduling
  done: boolean;
  outcome?: string;
  completedAt?: Date; // NEW
  completionNote?: string; // NEW
  /** when the owner was reminded that this is due */
  remindedAt?: Date | null;
  /** the matching event in the owner's Google Calendar */
  gcalEventId?: string;
  gcalSyncedAt?: Date | null;
}

const followUpSchema = new Schema<IFollowUp>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", default: null, index: true },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    leadName: String,
    phone: String,
    due: { type: Date, required: true, index: true },
    dueDate: { type: Date, index: true },
    dueTime: String,
    type: { type: String, default: "Call" },
    note: String,
    remark: String,
    owner: String,
    assignedTo: String,
    status: { type: Schema.Types.ObjectId, ref: "LeadStatus" },
    done: { type: Boolean, default: false },
    outcome: String,
    completedAt: Date,
    completionNote: String,
    remindedAt: { type: Date, default: null },
    gcalEventId: { type: String, default: "" },
    gcalSyncedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

followUpSchema.index({ tenant: 1, done: 1, due: 1 });

export const FollowUp = model<IFollowUp>("FollowUp", followUpSchema);
