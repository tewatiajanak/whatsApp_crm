import { Schema, model, Document, Types } from "mongoose";

export interface IRegistration extends Document {
  tenant: Types.ObjectId;
  lead?: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  course?: string;
  status?: Types.ObjectId;
  documents?: Array<{ _id: any; name: string; description?: string }>;
  interaction?: any;
  payment?: any;
  data?: any;
  /** where the application stands (Submitted → … → Enrolled) */
  stage: string;
  appNo: string;
  /** unguessable id in the applicant's status link */
  token: string;
  stageHistory: Array<{ stage: string; by: string; at: Date; note?: string }>;
  offer?: { text?: string; amount?: number; validTill?: Date | null; sentAt?: Date | null; respondedAt?: Date | null; response?: string };
}

const registrationSchema = new Schema<IRegistration>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: "" },
    course: { type: String, default: "" },
    status: { type: Schema.Types.ObjectId, ref: "LeadStatus", default: null },
    documents: { type: [{ _id: Schema.Types.Mixed, name: String, description: String }], default: [] },
    interaction: { type: Schema.Types.Mixed, default: {} },
    payment: { type: Schema.Types.Mixed, default: {} },
    data: { type: Schema.Types.Mixed, default: {} },
    stage: { type: String, default: "Submitted" },
    appNo: { type: String, default: "" },
    token: { type: String, default: "", index: true },
    stageHistory: { type: [{ _id: false, stage: String, by: String, at: Date, note: String }], default: [] },
    offer: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

registrationSchema.index({ tenant: 1, phone: 1 });

export const Registration = model<IRegistration>("Registration", registrationSchema);
