import { Schema, model, Document, Types } from "mongoose";

export interface ILeadNote {
  text: string;
  by: string;
  at: Date;
}

/** A lead's engagement in ONE service, with its own status + follow-up. */
export interface IServiceTrack {
  service: Types.ObjectId;
  status?: Types.ObjectId | null;
  subStatus?: Types.ObjectId | null;
  owner?: string;
  value?: number;
  nextFollowUp?: Date | null;
  isClosed?: boolean;     // won or lost in this service
  updatedAt?: Date;
}

export interface ILead extends Document {
  tenant: Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  contact?: Types.ObjectId;
  status: Types.ObjectId;
  subStatus?: Types.ObjectId | null;
  source?: Types.ObjectId;
  owner: string;
  course?: string;
  state?: string;
  city?: string;
  grade?: string;
  value: number;
  score: number;
  nextFollowUp?: Date | null;
  lastActivity: Date;
  tags: string[];
  notes: ILeadNote[];
  serviceTracks: IServiceTrack[];
  // follow-up tracking
  lastFollowUpType?: string;
  nextFollowUpDate?: Date | null;
  nextFollowUpType?: string;
  followUpCount: number;
  // last-10-digit phone, used to spot the same person entered in different formats
  phoneKey?: string;
  altPhone?: string;
  country?: string;
  priority: LeadPriority;
  /** true once someone picks the priority by hand; scoring then leaves it alone */
  priorityManual: boolean;
  lostReason?: string;
  currentRemark?: string;
  nextRemark?: string;
  firstContactedAt?: Date | null;
  lastContactedAt?: Date | null;
  statusChangedAt?: Date | null;
  enquiryCount: number;
  /** set when the first-response time limit passed without contact */
  slaBreachedAt?: Date | null;
  branch?: string;
  partner?: Types.ObjectId | null;
  /** channels this person asked not to be contacted on */
  doNotContact: { whatsapp: boolean; sms: boolean; email: boolean; call: boolean };
  /** id from the website tracking script, linking earlier page visits to this lead */
  visitorId?: string;
  utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  capturedFrom?: string;
  /** every enquiry's source in order: [0] primary, [1] secondary, [2] tertiary … */
  sourceHistory: Array<{ source?: Types.ObjectId | null; sourceName: string; capturedFrom: string; campaign: string; at: Date }>;
  customFields?: Record<string, any>;
}

export const LEAD_PRIORITIES = ["hot", "warm", "cold"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

/** Last 10 digits — "+91 98765 43210" and "09876543210" are the same person. */
export const phoneKeyOf = (phone: unknown) => String(phone || "").replace(/\D/g, "").slice(-10);

const noteSchema = new Schema<ILeadNote>(
  {
    text: { type: String, required: true },
    by: { type: String, default: "System" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const serviceTrackSchema = new Schema<IServiceTrack>(
  {
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    status: { type: Schema.Types.ObjectId, ref: "LeadStatus", default: null },
    subStatus: { type: Schema.Types.ObjectId, ref: "SubStatus", default: null },
    owner: { type: String, default: "Unassigned" },
    value: { type: Number, default: 0 },
    nextFollowUp: { type: Date, default: null },
    isClosed: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const leadSchema = new Schema<ILead>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    contact: { type: Schema.Types.ObjectId, ref: "Contact" },
    status: { type: Schema.Types.ObjectId, ref: "LeadStatus", required: true },
    subStatus: { type: Schema.Types.ObjectId, ref: "SubStatus", default: null },
    source: { type: Schema.Types.ObjectId, ref: "LeadSource" },
    owner: { type: String, default: "Unassigned" },
    course: String,
    state: { type: String, default: "" },
    city: { type: String, default: "" },
    grade: { type: String, default: "" },
    value: { type: Number, default: 0 },
    score: { type: Number, default: 50 },
    nextFollowUp: { type: Date, default: null },
    lastActivity: { type: Date, default: Date.now },
    tags: { type: [String], default: [] },
    notes: { type: [noteSchema], default: [] },
    serviceTracks: { type: [serviceTrackSchema], default: [] },
    // follow-up tracking
    lastFollowUpType: String,
    nextFollowUpDate: { type: Date, default: null },
    nextFollowUpType: String,
    followUpCount: { type: Number, default: 0 },
    phoneKey: { type: String, default: "" },
    altPhone: { type: String, default: "" },
    country: { type: String, default: "" },
    priority: { type: String, enum: LEAD_PRIORITIES, default: "warm" },
    priorityManual: { type: Boolean, default: false },
    lostReason: { type: String, default: "" },
    currentRemark: { type: String, default: "" },
    nextRemark: { type: String, default: "" },
    firstContactedAt: { type: Date, default: null },
    lastContactedAt: { type: Date, default: null },
    statusChangedAt: { type: Date, default: null },
    enquiryCount: { type: Number, default: 1 },
    slaBreachedAt: { type: Date, default: null },
    branch: { type: String, default: "" },
    partner: { type: Schema.Types.ObjectId, ref: "CrmPartner", default: null },
    doNotContact: {
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      call: { type: Boolean, default: false },
    },
    visitorId: { type: String, default: "" },
    utm: {
      source: { type: String, default: "" },
      medium: { type: String, default: "" },
      campaign: { type: String, default: "" },
      term: { type: String, default: "" },
      content: { type: String, default: "" },
    },
    capturedFrom: { type: String, default: "" },
    sourceHistory: {
      type: [{ _id: false, source: { type: Schema.Types.ObjectId, ref: "LeadSource", default: null }, sourceName: String, capturedFrom: String, campaign: String, at: { type: Date, default: Date.now } }],
      default: [],
    },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

leadSchema.index({ tenant: 1, phone: 1 });
leadSchema.index({ tenant: 1, status: 1 });
leadSchema.index({ tenant: 1, owner: 1 });
leadSchema.index({ tenant: 1, phoneKey: 1 });
leadSchema.index({ tenant: 1, createdAt: -1 });
leadSchema.index({ tenant: 1, nextFollowUp: 1 });

leadSchema.pre("save", function (next) {
  if (this.isModified("phone") || !this.phoneKey) this.phoneKey = phoneKeyOf(this.phone);
  next();
});

export const Lead = model<ILead>("Lead", leadSchema);
