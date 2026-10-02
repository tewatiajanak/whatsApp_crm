import { Schema, model, Document, Types } from "mongoose";

/* ---- WhatsApp message template ---- */
export interface ITemplate extends Document {
  tenant: Types.ObjectId;
  name: string;
  channel: "whatsapp" | "email" | "sms";
  subject?: string;
  language: string;
  category: "Marketing" | "Utility" | "Authentication";
  status: "Approved" | "Pending" | "Rejected" | "Draft";
  body: string;
  metaId?: string;
  rejectionReason?: string;
  components?: any;
}
const templateSchema = new Schema<ITemplate>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    channel: { type: String, enum: ["whatsapp", "email", "sms"], default: "whatsapp" },
    subject: String,
    language: { type: String, default: "en" },
    category: { type: String, enum: ["Marketing", "Utility", "Authentication"], default: "Utility" },
    status: { type: String, enum: ["Approved", "Pending", "Rejected", "Draft"], default: "Draft" },
    body: { type: String, default: "" },
    metaId: String,
    rejectionReason: String,
    components: Schema.Types.Mixed,
  },
  { timestamps: true }
);
export const Template = model<ITemplate>("Template", templateSchema);

/* ---- Campaign ---- */
export interface ICampaign extends Document {
  tenant: Types.ObjectId;
  name: string;
  template: string;
  category: string;
  status: "Draft" | "Scheduled" | "Running" | "Paused" | "Completed";
  audienceSize: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  scheduledFor?: Date | null;
  rateLimit: string;
  createdBy: string;
}
const campaignSchema = new Schema<ICampaign>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    template: String,
    category: { type: String, default: "Utility" },
    status: { type: String, enum: ["Draft", "Scheduled", "Running", "Paused", "Completed"], default: "Draft" },
    audienceSize: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    read: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    scheduledFor: { type: Date, default: null },
    rateLimit: { type: String, default: "500 msg/min" },
    createdBy: String,
  },
  { timestamps: true }
);
export const Campaign = model<ICampaign>("Campaign", campaignSchema);

/* ---- Message (the delivery log) ---- */
export interface IMessage extends Document {
  tenant: Types.ObjectId;
  campaign?: Types.ObjectId | null;
  contact?: Types.ObjectId | null;
  conversation?: Types.ObjectId | null;
  waMessageId?: string;
  direction: "inbound" | "outbound";
  type: "text" | "template" | "image" | "document";
  body?: string;
  template?: string;
  contactName?: string;
  phone: string;
  category?: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed" | "received";
  errorCode?: string;
  failReason?: string;
  agent?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  /** "whatsapp" | "email" */
  channel?: string;
  subject?: string;
  /** Where it was sent from, e.g. "events" (Event Manager → Communication). */
  source?: string;
  eventId?: string;
  eventName?: string;
  simulated?: boolean;
}
const messageSchema = new Schema<IMessage>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign", default: null },
    contact: { type: Schema.Types.ObjectId, ref: "Contact", default: null },
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", default: null },
    waMessageId: { type: String, index: true },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    type: { type: String, enum: ["text", "template", "image", "document"], default: "text" },
    body: String,
    template: String,
    contactName: String,
    phone: { type: String, required: true },
    category: String,
    status: { type: String, enum: ["queued", "sent", "delivered", "read", "failed", "received"], default: "queued" },
    errorCode: String,
    failReason: String,
    agent: String,
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    channel: String,
    subject: String,
    source: String,
    eventId: String,
    eventName: String,
    simulated: Boolean,
  },
  { timestamps: true }
);
messageSchema.index({ tenant: 1, createdAt: -1 });
messageSchema.index({ tenant: 1, source: 1, createdAt: -1 });
messageSchema.index({ tenant: 1, status: 1 });
export const Message = model<IMessage>("Message", messageSchema);

/* ---- Conversation (1:1, user-initiated, 24h window) ---- */
export interface IConvMessage {
  from: "me" | "them";
  time: string;
  type: "text" | "template" | "image" | "document";
  text?: string;
  template?: string;
  agent?: string;
  at: Date;
}
export interface IConversation extends Document {
  tenant: Types.ObjectId;
  contact?: Types.ObjectId;
  lead?: Types.ObjectId | null;
  name: string;
  phone: string;
  category?: string;
  assigned?: string;
  unread: number;
  priority: boolean;
  tags: string[];
  initiatedBy: "user";
  windowOpenedAt: Date;
  windowExpiresAt: Date;
  last?: string;
  lastTime?: string;
  messages: IConvMessage[];
}
const convMsgSchema = new Schema<IConvMessage>(
  {
    from: { type: String, enum: ["me", "them"], required: true },
    time: String,
    type: { type: String, default: "text" },
    text: String,
    template: String,
    agent: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);
const conversationSchema = new Schema<IConversation>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    contact: { type: Schema.Types.ObjectId, ref: "Contact" },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    name: String,
    phone: { type: String, required: true },
    category: String,
    assigned: String,
    unread: { type: Number, default: 0 },
    priority: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    initiatedBy: { type: String, default: "user" },
    windowOpenedAt: { type: Date, default: Date.now },
    windowExpiresAt: { type: Date, required: true },
    last: String,
    lastTime: String,
    messages: { type: [convMsgSchema], default: [] },
  },
  { timestamps: true }
);
conversationSchema.index({ tenant: 1, phone: 1 });
export const Conversation = model<IConversation>("Conversation", conversationSchema);
