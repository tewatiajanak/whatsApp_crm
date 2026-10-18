import { Schema, model, Document, Types } from "mongoose";

/** One person in an imported recipient list or a campaign's audience. */
export interface IRecipient {
  name: string;
  phone: string;
  /** other columns from the imported file, used to fill template variables */
  extra?: Record<string, string>;
}
const recipientSchema = new Schema<IRecipient>(
  {
    name: { type: String, default: "" },
    phone: { type: String, required: true },
    extra: { type: Schema.Types.Mixed, default: undefined },
  },
  { _id: false }
);

/* ---- Recipient list (imported from CSV / Excel for bulk campaigns) ---- */
export interface IRecipientList extends Document {
  tenant: Types.ObjectId;
  name: string;
  fileName: string;
  columns: string[];
  /** where these contacts came from (Source master) */
  source?: Types.ObjectId | null;
  /** employee responsible for the list */
  owner?: Types.ObjectId | null;
  rows: IRecipient[];
  count: number;
  createdBy: string;
}
const recipientListSchema = new Schema<IRecipientList>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    fileName: { type: String, default: "" },
    columns: { type: [String], default: [] },
    source: { type: Schema.Types.ObjectId, ref: "LeadSource", default: null },
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rows: { type: [recipientSchema], default: [] },
    count: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);
recipientListSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const RecipientList = model<IRecipientList>("RecipientList", recipientListSchema);

/* ---- The audience a campaign was sent to, frozen when it is launched ---- */
export interface ICampaignAudience extends Document {
  tenant: Types.ObjectId;
  campaign: Types.ObjectId;
  rows: IRecipient[];
}
const campaignAudienceSchema = new Schema<ICampaignAudience>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign", required: true, unique: true },
    rows: { type: [recipientSchema], default: [] },
  },
  { timestamps: true }
);
export const CampaignAudience = model<ICampaignAudience>("CampaignAudience", campaignAudienceSchema);

export const MAX_RECIPIENTS = 50000;
