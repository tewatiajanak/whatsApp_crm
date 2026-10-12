import { Schema, model, Document, Types } from "mongoose";

/* ---- Client verification of a task ---- */
export interface IPmVerification extends Document {
  tenant: Types.ObjectId;
  task: Types.ObjectId;
  project: Types.ObjectId;
  client: Types.ObjectId;
  /** what the client is asked to verify */
  summary: string;
  contacts: { name: string; email: string; mobile: string; token: string; awaitingReason: boolean }[];
  status: "Pending" | "Approved" | "Rejected" | "Expired";
  sentAt: Date;
  expiresAt: Date;
  answeredBy: string;
  answeredVia: "" | "portal" | "email" | "whatsapp";
  answeredAt?: Date | null;
  answeredFrom: string;
  comment: string;
  reminders: number;
  lastReminderAt?: Date | null;
  requestedBy?: Types.ObjectId | null;
}
const verificationSchema = new Schema<IPmVerification>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "PmTask", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", required: true },
    client: { type: Schema.Types.ObjectId, ref: "PmClient", required: true, index: true },
    summary: { type: String, default: "" },
    contacts: {
      type: [new Schema({ name: String, email: String, mobile: String, token: String, awaitingReason: { type: Boolean, default: false } }, { _id: false })],
      default: [],
    },
    status: { type: String, enum: ["Pending", "Approved", "Rejected", "Expired"], default: "Pending" },
    sentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    answeredBy: { type: String, default: "" },
    answeredVia: { type: String, default: "" },
    answeredAt: { type: Date, default: null },
    answeredFrom: { type: String, default: "" },
    comment: { type: String, default: "" },
    reminders: { type: Number, default: 0 },
    lastReminderAt: { type: Date, default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
verificationSchema.index({ "contacts.token": 1 });
verificationSchema.index({ status: 1, sentAt: 1 });
export const PmVerification = model<IPmVerification>("PmVerification", verificationSchema, "pm_verifications");

/* ---- Sign-off of a module or a whole project ---- */
export interface IPmSignoff extends Document {
  tenant: Types.ObjectId;
  project: Types.ObjectId;
  /** null = the whole project */
  projectModule?: Types.ObjectId | null;
  client: Types.ObjectId;
  title: string;
  /** what was delivered, frozen at the time of the request */
  summary: { module: string; tasks: number; completedOn: string }[];
  contact: { name: string; email: string; mobile: string };
  token: string;
  status: "Pending" | "Accepted" | "Concern" | "Expired";
  sentAt: Date;
  expiresAt: Date;
  answeredAt?: Date | null;
  answeredBy: string;
  answeredFrom: string;
  comment: string;
  ticket?: Types.ObjectId | null;
  requestedBy?: Types.ObjectId | null;
}
const signoffSchema = new Schema<IPmSignoff>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", required: true, index: true },
    projectModule: { type: Schema.Types.ObjectId, ref: "PmProjectModule", default: null },
    client: { type: Schema.Types.ObjectId, ref: "PmClient", required: true, index: true },
    title: { type: String, default: "" },
    summary: { type: Schema.Types.Mixed, default: [] },
    contact: { type: new Schema({ name: String, email: String, mobile: String }, { _id: false }), default: {} },
    token: { type: String, required: true, index: true },
    status: { type: String, enum: ["Pending", "Accepted", "Concern", "Expired"], default: "Pending" },
    sentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    answeredAt: { type: Date, default: null },
    answeredBy: { type: String, default: "" },
    answeredFrom: { type: String, default: "" },
    comment: { type: String, default: "" },
    ticket: { type: Schema.Types.ObjectId, ref: "PmTicket", default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
export const PmSignoff = model<IPmSignoff>("PmSignoff", signoffSchema, "pm_signoffs");

/* ---- Client ticket (support desk) ---- */
export interface ITicketReply {
  _id?: Types.ObjectId;
  by?: Types.ObjectId | null;
  /** set when the client wrote it */
  byClient: string;
  text: string;
  /** an internal note: never shown to the client */
  internal: boolean;
  at: Date;
}
export interface ITicketFile {
  _id?: Types.ObjectId;
  name: string;
  file: string;
  size: number;
  mime: string;
  byClient: boolean;
  at: Date;
}
export interface IPmTicket extends Document {
  tenant: Types.ObjectId;
  number: string;
  client: Types.ObjectId;
  project?: Types.ObjectId | null;
  product?: Types.ObjectId | null;
  projectModule?: Types.ObjectId | null;
  category?: Types.ObjectId | null;
  priority?: Types.ObjectId | null;
  status?: Types.ObjectId | null;
  isClosed: boolean;
  subject: string;
  description: string;
  raisedBy: { name: string; email: string; user?: Types.ObjectId | null };
  assignee?: Types.ObjectId | null;
  responseDue?: Date | null;
  resolveDue?: Date | null;
  firstResponseAt?: Date | null;
  resolvedAt?: Date | null;
  /** the manager was told about a missed response / resolution time */
  slaAlerted: string[];
  rating: number;
  ratingComment: string;
  linkedTask?: Types.ObjectId | null;
  mergedInto?: Types.ObjectId | null;
  replies: ITicketReply[];
  files: ITicketFile[];
  source: "portal" | "internal" | "signoff";
  isDemo?: boolean;
}
const ticketSchema = new Schema<IPmTicket>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    number: { type: String, required: true },
    client: { type: Schema.Types.ObjectId, ref: "PmClient", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", default: null },
    product: { type: Schema.Types.ObjectId, ref: "PmProduct", default: null },
    projectModule: { type: Schema.Types.ObjectId, ref: "PmProjectModule", default: null },
    category: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    priority: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    status: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    isClosed: { type: Boolean, default: false },
    subject: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    raisedBy: { type: new Schema({ name: String, email: String, user: { type: Schema.Types.ObjectId, ref: "User", default: null } }, { _id: false }), default: {} },
    assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
    responseDue: { type: Date, default: null },
    resolveDue: { type: Date, default: null },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    slaAlerted: { type: [String], default: [] },
    rating: { type: Number, default: 0 },
    ratingComment: { type: String, default: "" },
    linkedTask: { type: Schema.Types.ObjectId, ref: "PmTask", default: null },
    mergedInto: { type: Schema.Types.ObjectId, ref: "PmTicket", default: null },
    replies: {
      type: [new Schema<ITicketReply>({
        by: { type: Schema.Types.ObjectId, ref: "User", default: null },
        byClient: { type: String, default: "" },
        text: { type: String, required: true },
        internal: { type: Boolean, default: false },
        at: { type: Date, default: Date.now },
      })],
      default: [],
    },
    files: {
      type: [new Schema<ITicketFile>({ name: String, file: String, size: Number, mime: String, byClient: { type: Boolean, default: false }, at: { type: Date, default: Date.now } })],
      default: [],
    },
    source: { type: String, enum: ["portal", "internal", "signoff"], default: "portal" },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
ticketSchema.index({ tenant: 1, number: 1 }, { unique: true });
ticketSchema.index({ tenant: 1, assignee: 1, isClosed: 1 });
ticketSchema.index({ tenant: 1, client: 1, createdAt: -1 });
export const PmTicket = model<IPmTicket>("PmTicket", ticketSchema, "pm_tickets");
