import { Schema, model, Document, Types } from "mongoose";

const T = { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true } as const;

/* ───────────── custom activity types (Campus visit, Demo attended, …) ───────────── */
export const ACTIVITY_FIELD_TYPES = ["text", "number", "date", "select", "yesno"] as const;
export interface IActivityField { key: string; label: string; type: (typeof ACTIVITY_FIELD_TYPES)[number]; options: string[]; required: boolean }
export interface ICrmActivityType extends Document {
  tenant: Types.ObjectId;
  name: string;
  icon: string;
  color: string;
  points: number;
  fields: IActivityField[];
  active: boolean;
  order: number;
}
const activityFieldSchema = new Schema<IActivityField>(
  { key: String, label: String, type: { type: String, enum: ACTIVITY_FIELD_TYPES, default: "text" }, options: { type: [String], default: [] }, required: { type: Boolean, default: false } },
  { _id: false }
);
const activityTypeSchema = new Schema<ICrmActivityType>(
  {
    tenant: T,
    name: { type: String, required: true },
    icon: { type: String, default: "lightning" },
    color: { type: String, default: "#6366f1" },
    points: { type: Number, default: 0 },
    fields: { type: [activityFieldSchema], default: [] },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
activityTypeSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const CrmActivityType = model<ICrmActivityType>("CrmActivityType", activityTypeSchema);

/* ───────────── queries (student / customer helpdesk) ───────────── */
export const QUERY_STATUSES = ["open", "pending", "resolved", "closed"] as const;
export const QUERY_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export interface IQueryMessage { by: string; text: string; internal: boolean; channel: string; at: Date; fromCustomer: boolean }
export interface ICrmQuery extends Document {
  tenant: Types.ObjectId;
  number: number;
  lead?: Types.ObjectId | null;
  name: string;
  phone: string;
  email: string;
  subject: string;
  category: string;
  priority: (typeof QUERY_PRIORITIES)[number];
  status: (typeof QUERY_STATUSES)[number];
  assignedTo: string;
  raisedVia: string;
  createdBy: string;
  dueAt?: Date | null;
  firstResponseAt?: Date | null;
  resolvedAt?: Date | null;
  messages: IQueryMessage[];
  createdAt: Date;
  updatedAt: Date;
}
const querySchema = new Schema<ICrmQuery>(
  {
    tenant: T,
    number: { type: Number, required: true },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    subject: { type: String, required: true },
    category: { type: String, default: "" },
    priority: { type: String, enum: QUERY_PRIORITIES, default: "medium" },
    status: { type: String, enum: QUERY_STATUSES, default: "open" },
    assignedTo: { type: String, default: "Unassigned" },
    raisedVia: { type: String, default: "manual" },
    createdBy: { type: String, default: "" },
    dueAt: { type: Date, default: null },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    messages: {
      type: [{ _id: false, by: String, text: String, internal: { type: Boolean, default: false }, channel: { type: String, default: "" }, at: { type: Date, default: Date.now }, fromCustomer: { type: Boolean, default: false } }],
      default: [],
    },
  },
  { timestamps: true }
);
querySchema.index({ tenant: 1, number: 1 }, { unique: true });
querySchema.index({ tenant: 1, status: 1, dueAt: 1 });
querySchema.index({ tenant: 1, lead: 1 });
export const CrmQuery = model<ICrmQuery>("CrmQuery", querySchema);

/* ───────────── lead lists (segments) ───────────── */
export interface ICrmList extends Document {
  tenant: Types.ObjectId;
  name: string;
  kind: "static" | "dynamic";
  /** dynamic lists: the same query parameters the leads list understands */
  filters: Record<string, string>;
  leads: Types.ObjectId[];
  createdBy: string;
}
const listSchema = new Schema<ICrmList>(
  {
    tenant: T,
    name: { type: String, required: true },
    kind: { type: String, enum: ["static", "dynamic"], default: "static" },
    filters: { type: Schema.Types.Mixed, default: {} },
    leads: { type: [Schema.Types.ObjectId], ref: "Lead", default: [] },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true, minimize: false }
);
listSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const CrmList = model<ICrmList>("CrmList", listSchema);
