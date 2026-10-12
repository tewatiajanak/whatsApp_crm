import { Schema, model, Document, Types } from "mongoose";

/* A client company and its contacts (SPOCs). Not the CRM lead `Contact`. */
export interface IPmClientContact {
  _id?: Types.ObjectId;
  name: string;
  designation: string;
  email: string;
  /** mobile / WhatsApp number */
  mobile: string;
  primary: boolean;
  portalAccess: boolean;
}

export interface IPmClient extends Document {
  tenant: Types.ObjectId;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  /** date of the agreement with the client, YYYY-MM-DD ("" = not set) */
  agreementDate: string;
  accountManager?: Types.ObjectId | null;
  status: "Active" | "Inactive";
  products: Types.ObjectId[];
  contacts: IPmClientContact[];
  isDemo?: boolean;
}

const contactSchema = new Schema<IPmClientContact>({
  name: { type: String, required: true, trim: true },
  designation: { type: String, default: "", trim: true },
  email: { type: String, default: "", trim: true, lowercase: true },
  mobile: { type: String, default: "", trim: true },
  primary: { type: Boolean, default: false },
  portalAccess: { type: Boolean, default: false },
});

const clientSchema = new Schema<IPmClient>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    agreementDate: { type: String, default: "" },
    accountManager: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    products: { type: [Schema.Types.ObjectId], ref: "PmProduct", default: [] },
    contacts: { type: [contactSchema], default: [] },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
clientSchema.index({ tenant: 1, code: 1 }, { unique: true });
clientSchema.index({ tenant: 1, accountManager: 1 });

export const PmClient = model<IPmClient>("PmClient", clientSchema, "pm_clients");
