import { Schema, model, Document, Types } from "mongoose";

const T = { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true } as const;

/* ───────────── companies (accounts) ───────────── */
export interface ICrmCompany extends Document {
  tenant: Types.ObjectId;
  name: string;
  industry: string;
  website: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  country: string;
  size: string;
  owner: string;
  tags: string[];
  notes: Array<{ text: string; by: string; at: Date }>;
  contacts: Array<{ _id?: Types.ObjectId; name: string; role: string; phone: string; email: string; primary: boolean }>;
  createdBy: string;
}
const companySchema = new Schema<ICrmCompany>(
  {
    tenant: T,
    name: { type: String, required: true, trim: true },
    industry: { type: String, default: "" },
    website: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    gstin: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    size: { type: String, default: "" },
    owner: { type: String, default: "Unassigned" },
    tags: { type: [String], default: [] },
    notes: { type: [{ _id: false, text: String, by: String, at: Date }], default: [] },
    contacts: { type: [{ name: String, role: String, phone: String, email: String, primary: Boolean }], default: [] },
    createdBy: { type: String, default: "System" },
  },
  { timestamps: true }
);
companySchema.index({ tenant: 1, name: 1 }, { unique: true });
export const CrmCompany = model<ICrmCompany>("CrmCompany", companySchema);

/* ───────────── deal stages (a master: the code reads `kind`, never the name) ───────────── */
export const STAGE_KINDS = ["open", "won", "lost"] as const;
export interface ICrmDealStage extends Document {
  tenant: Types.ObjectId;
  name: string;
  color: string;
  probability: number;
  kind: (typeof STAGE_KINDS)[number];
  order: number;
}
const stageSchema = new Schema<ICrmDealStage>(
  {
    tenant: T,
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#6366f1" },
    probability: { type: Number, default: 0, min: 0, max: 100 },
    kind: { type: String, enum: STAGE_KINDS, default: "open" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
stageSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const CrmDealStage = model<ICrmDealStage>("CrmDealStage", stageSchema);
export const DEFAULT_STAGES = [
  { name: "Qualification", color: "#64748b", probability: 10, kind: "open" },
  { name: "Needs analysis", color: "#0ea5e9", probability: 25, kind: "open" },
  { name: "Proposal", color: "#6366f1", probability: 50, kind: "open" },
  { name: "Negotiation", color: "#f59e0b", probability: 75, kind: "open" },
  { name: "Won", color: "#16a34a", probability: 100, kind: "won" },
  { name: "Lost", color: "#dc2626", probability: 0, kind: "lost" },
] as const;

/* ───────────── products and services you sell ───────────── */
export interface ICrmProduct extends Document {
  tenant: Types.ObjectId;
  name: string;
  sku: string;
  category: string;
  unit: string;
  price: number;
  taxPercent: number;
  hsn: string;
  description: string;
  active: boolean;
}
const productSchema = new Schema<ICrmProduct>(
  {
    tenant: T,
    name: { type: String, required: true, trim: true },
    sku: { type: String, default: "" },
    category: { type: String, default: "" },
    unit: { type: String, default: "Nos" },
    price: { type: Number, default: 0, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0, max: 100 },
    hsn: { type: String, default: "" },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
productSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const CrmProduct = model<ICrmProduct>("CrmProduct", productSchema);

/* ───────────── line items (deals and quotations) ───────────── */
export interface ILineItem { product?: Types.ObjectId | null; name: string; description: string; qty: number; unit: string; price: number; discountPct: number; taxPct: number; amount: number }
const lineSchema = new Schema<ILineItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "CrmProduct", default: null },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    qty: { type: Number, default: 1 },
    unit: { type: String, default: "Nos" },
    price: { type: Number, default: 0 },
    discountPct: { type: Number, default: 0 },
    taxPct: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

/* ───────────── deals (opportunities) ───────────── */
export interface ICrmDeal extends Document {
  tenant: Types.ObjectId;
  number: number;
  title: string;
  company?: Types.ObjectId | null;
  lead?: Types.ObjectId | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  value: number;
  stage: Types.ObjectId;
  probability: number | null;
  expectedClose?: Date | null;
  owner: string;
  source: string;
  priority: "low" | "medium" | "high";
  items: ILineItem[];
  tags: string[];
  notes: Array<{ text: string; by: string; at: Date }>;
  history: Array<{ stage: string; by: string; at: Date; note?: string }>;
  stageChangedAt: Date;
  closedAt?: Date | null;
  lostReason: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
const dealSchema = new Schema<ICrmDeal>(
  {
    tenant: T,
    number: { type: Number, default: 0 },
    title: { type: String, required: true, trim: true },
    company: { type: Schema.Types.ObjectId, ref: "CrmCompany", default: null, index: true },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
    contactName: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    value: { type: Number, default: 0, min: 0 },
    stage: { type: Schema.Types.ObjectId, ref: "CrmDealStage", required: true },
    probability: { type: Number, default: null },
    expectedClose: { type: Date, default: null },
    owner: { type: String, default: "Unassigned" },
    source: { type: String, default: "" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    items: { type: [lineSchema], default: [] },
    tags: { type: [String], default: [] },
    notes: { type: [{ _id: false, text: String, by: String, at: Date }], default: [] },
    history: { type: [{ _id: false, stage: String, by: String, at: Date, note: String }], default: [] },
    stageChangedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    lostReason: { type: String, default: "" },
    createdBy: { type: String, default: "System" },
  },
  { timestamps: true }
);
dealSchema.index({ tenant: 1, stage: 1, updatedAt: -1 });
export const CrmDeal = model<ICrmDeal>("CrmDeal", dealSchema);

/* ───────────── quotations ───────────── */
export const QUOTE_STATUSES = ["draft", "sent", "accepted", "rejected"] as const;
export interface ICrmQuote extends Document {
  tenant: Types.ObjectId;
  number: number;
  quoteNo: string;
  deal?: Types.ObjectId | null;
  company?: Types.ObjectId | null;
  lead?: Types.ObjectId | null;
  customer: { name: string; email: string; phone: string; address: string; gstin: string };
  subject: string;
  items: ILineItem[];
  adjustment: number;
  adjustmentLabel: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  validTill?: Date | null;
  terms: string;
  notes: string;
  status: (typeof QUOTE_STATUSES)[number];
  token: string;
  sentAt?: Date | null;
  viewedAt?: Date | null;
  views: number;
  respondedAt?: Date | null;
  response: { name: string; note: string };
  owner: string;
  /** discount approval, when a line discount is above the allowed limit */
  approval: { status: string; id?: Types.ObjectId | null; pct: number };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
const quoteSchema = new Schema<ICrmQuote>(
  {
    tenant: T,
    number: { type: Number, default: 0 },
    quoteNo: { type: String, default: "" },
    deal: { type: Schema.Types.ObjectId, ref: "CrmDeal", default: null, index: true },
    company: { type: Schema.Types.ObjectId, ref: "CrmCompany", default: null },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    customer: { name: { type: String, default: "" }, email: { type: String, default: "" }, phone: { type: String, default: "" }, address: { type: String, default: "" }, gstin: { type: String, default: "" } },
    subject: { type: String, default: "" },
    items: { type: [lineSchema], default: [] },
    adjustment: { type: Number, default: 0 },
    adjustmentLabel: { type: String, default: "" },
    subtotal: { type: Number, default: 0 },
    discountTotal: { type: Number, default: 0 },
    taxTotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    validTill: { type: Date, default: null },
    terms: { type: String, default: "" },
    notes: { type: String, default: "" },
    status: { type: String, enum: QUOTE_STATUSES, default: "draft" },
    token: { type: String, required: true, unique: true },
    sentAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    views: { type: Number, default: 0 },
    respondedAt: { type: Date, default: null },
    response: { name: { type: String, default: "" }, note: { type: String, default: "" } },
    owner: { type: String, default: "Unassigned" },
    approval: { status: { type: String, default: "" }, id: { type: Schema.Types.ObjectId, default: null }, pct: { type: Number, default: 0 } },
    createdBy: { type: String, default: "System" },
  },
  { timestamps: true }
);
quoteSchema.index({ tenant: 1, createdAt: -1 });
export const CrmQuote = model<ICrmQuote>("CrmQuote", quoteSchema);

/** per-tenant running numbers for deals and quotations */
const counterSchema = new Schema({ tenant: T, key: { type: String, required: true }, n: { type: Number, default: 0 } });
counterSchema.index({ tenant: 1, key: 1 }, { unique: true });
export const CrmCounter = model("CrmCounter", counterSchema);
export async function nextNumber(tenant: any, key: string) {
  const c: any = await CrmCounter.findOneAndUpdate({ tenant, key }, { $inc: { n: 1 } }, { new: true, upsert: true }).lean();
  return c.n as number;
}
