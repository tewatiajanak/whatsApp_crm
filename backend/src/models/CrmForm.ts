import { Schema, model, Document, Types } from "mongoose";

const T = { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true } as const;

/* ───────────── forms built in CRM → Forms (enquiry, application, registration, …) ───────────── */
export const FORM_KINDS = ["enquiry", "application", "registration", "event", "feedback", "other"] as const;
export const FORM_STATUSES = ["draft", "live", "closed"] as const;
export const FIELD_TYPES = [
  "text", "textarea", "email", "phone", "number", "date", "time", "url",
  "select", "radio", "checkbox", "yesno", "rating", "file", "signature", "consent",
  "heading", "hidden",
] as const;
/** fields that hold no answer */
export const LAYOUT_TYPES = ["heading"] as const;
/** where a dropdown / radio / checkbox gets its options */
export const OPTION_SOURCES = ["custom", "courses", "branches", "grades", "sessions"] as const;
/** lead fields an answer can fill */
export const LEAD_TARGETS = ["name", "phone", "email", "altPhone", "city", "state", "country", "course", "grade", "branch", "note"] as const;
export const SHOW_OPS = ["eq", "neq", "filled", "empty"] as const;
export const SUBMISSION_STATUSES = ["draft", "new", "review", "accepted", "rejected"] as const;

export interface IFormField {
  id: string;
  type: (typeof FIELD_TYPES)[number];
  label: string;
  required: boolean;
  width: "full" | "half";
  options: string[];
  optionSource: (typeof OPTION_SOURCES)[number];
  map: string;
  defaultValue: string;
  param: string;
  min: number | null;
  max: number | null;
  minLength: number | null;
  maxLength: number | null;
  pattern: string;
  patternMessage: string;
  accept: string;
  maxSizeMb: number;
  multiple: boolean;
  showIf: { field: string; op: (typeof SHOW_OPS)[number]; value: string } | null;
}
export interface IFormPage { id: string; title: string; fields: IFormField[] }

export interface ICrmForm extends Document {
  tenant: Types.ObjectId;
  name: string;
  kind: (typeof FORM_KINDS)[number];
  status: (typeof FORM_STATUSES)[number];
  slug: string;
  title: string;
  pages: IFormPage[];
  settings: {
    submitLabel: string;
    nextLabel: string;
    backLabel: string;
    buttonAlign: "left" | "center" | "right" | "full";
    successMessage: string;
    redirectUrl: string;
    closedMessage: string;
    opensAt: Date | null;
    closesAt: Date | null;
    maxSubmissions: number;
    onePerPhone: boolean;
    allowDraft: boolean;
    showProgress: boolean;
    numberPrefix: string;
    createLead: boolean;
    createApplication: boolean;
    leadSource: string;
    leadStatus: string;
    owner: string;
    course: string;
    tags: string[];
    notifyOwner: boolean;
    notifyEmails: string[];
    replyEmail: boolean;
    replyWhatsApp: boolean;
    replyText: string;
    fee: { enabled: boolean; amount: number; title: string; amountFrom: string; amounts: Record<string, number> };
  };
  theme: { color: string; logo: string; cover: string; background: string; width: "narrow" | "wide" };
  stats: { views: number; starts: number };
  counter: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const fieldSchema = new Schema<IFormField>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: FIELD_TYPES, default: "text" },
    label: { type: String, default: "" },
    required: { type: Boolean, default: false },
    width: { type: String, enum: ["full", "half"], default: "full" },
    options: { type: [String], default: [] },
    optionSource: { type: String, enum: OPTION_SOURCES, default: "custom" },
    map: { type: String, default: "" },
    defaultValue: { type: String, default: "" },
    param: { type: String, default: "" },
    min: { type: Number, default: null },
    max: { type: Number, default: null },
    minLength: { type: Number, default: null },
    maxLength: { type: Number, default: null },
    pattern: { type: String, default: "" },
    patternMessage: { type: String, default: "" },
    accept: { type: String, default: "" },
    maxSizeMb: { type: Number, default: 5 },
    multiple: { type: Boolean, default: false },
    showIf: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const formSchema = new Schema<ICrmForm>(
  {
    tenant: T,
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: FORM_KINDS, default: "enquiry" },
    status: { type: String, enum: FORM_STATUSES, default: "draft" },
    slug: { type: String, required: true, unique: true },
    title: { type: String, default: "" },
    pages: { type: [{ _id: false, id: String, title: String, fields: { type: [fieldSchema], default: [] } }], default: [] },
    settings: {
      submitLabel: { type: String, default: "Submit" },
      nextLabel: { type: String, default: "Next" },
      backLabel: { type: String, default: "Back" },
      buttonAlign: { type: String, enum: ["left", "center", "right", "full"], default: "right" },
      successMessage: { type: String, default: "Thank you. We have received your details." },
      redirectUrl: { type: String, default: "" },
      closedMessage: { type: String, default: "This form is closed." },
      opensAt: { type: Date, default: null },
      closesAt: { type: Date, default: null },
      maxSubmissions: { type: Number, default: 0 },
      onePerPhone: { type: Boolean, default: false },
      allowDraft: { type: Boolean, default: false },
      showProgress: { type: Boolean, default: true },
      numberPrefix: { type: String, default: "" },
      createLead: { type: Boolean, default: true },
      createApplication: { type: Boolean, default: false },
      leadSource: { type: String, default: "" },
      leadStatus: { type: String, default: "" },
      owner: { type: String, default: "" },
      course: { type: String, default: "" },
      tags: { type: [String], default: [] },
      notifyOwner: { type: Boolean, default: true },
      notifyEmails: { type: [String], default: [] },
      replyEmail: { type: Boolean, default: false },
      replyWhatsApp: { type: Boolean, default: false },
      replyText: { type: String, default: "" },
      fee: {
        enabled: { type: Boolean, default: false },
        amount: { type: Number, default: 0 },
        title: { type: String, default: "Application fee" },
        /** a dropdown / radio field whose answer picks the amount from `amounts` */
        amountFrom: { type: String, default: "" },
        amounts: { type: Schema.Types.Mixed, default: {} },
      },
    },
    theme: {
      color: { type: String, default: "" },
      logo: { type: String, default: "" },
      cover: { type: String, default: "" },
      background: { type: String, default: "" },
      width: { type: String, enum: ["narrow", "wide"], default: "narrow" },
    },
    stats: { views: { type: Number, default: 0 }, starts: { type: Number, default: 0 } },
    counter: { type: Number, default: 0 },
    createdBy: { type: String, default: "System" },
    updatedBy: { type: String, default: "System" },
  },
  { timestamps: true, minimize: false }
);
formSchema.index({ tenant: 1, updatedAt: -1 });
export const CrmForm = model<ICrmForm>("CrmForm", formSchema);

/* ───────────── one filled-in form ───────────── */
export interface IFormFile { _id?: Types.ObjectId; field: string; name: string; file: string; mime: string; size: number }
export interface ICrmFormSubmission extends Document {
  tenant: Types.ObjectId;
  form: Types.ObjectId;
  number: number;
  refNo: string;
  status: (typeof SUBMISSION_STATUSES)[number];
  data: Record<string, any>;
  files: IFormFile[];
  name: string;
  phone: string;
  email: string;
  phoneKey: string;
  lead?: Types.ObjectId | null;
  registration?: Types.ObjectId | null;
  fee?: Types.ObjectId | null;
  amount: number;
  paid: boolean;
  /** unguessable id in the receipt / resume link */
  token: string;
  page: number;
  meta: { utm: Record<string, string>; referrer: string; userAgent: string; ipHash: string; via: string };
  notes: Array<{ text: string; by: string; at: Date }>;
  history: Array<{ status: string; by: string; at: Date }>;
  submittedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
const submissionSchema = new Schema<ICrmFormSubmission>(
  {
    tenant: T,
    form: { type: Schema.Types.ObjectId, ref: "CrmForm", required: true, index: true },
    number: { type: Number, default: 0 },
    refNo: { type: String, default: "" },
    status: { type: String, enum: SUBMISSION_STATUSES, default: "new" },
    data: { type: Schema.Types.Mixed, default: {} },
    files: { type: [{ field: String, name: String, file: String, mime: String, size: Number }], default: [] },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    phoneKey: { type: String, default: "" },
    lead: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    registration: { type: Schema.Types.ObjectId, ref: "Registration", default: null },
    fee: { type: Schema.Types.ObjectId, ref: "LeadFee", default: null },
    amount: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
    token: { type: String, required: true, unique: true },
    page: { type: Number, default: 0 },
    meta: {
      utm: { type: Schema.Types.Mixed, default: {} },
      referrer: { type: String, default: "" },
      userAgent: { type: String, default: "" },
      ipHash: { type: String, default: "" },
      via: { type: String, default: "Online" },
    },
    notes: { type: [{ _id: false, text: String, by: String, at: Date }], default: [] },
    history: { type: [{ _id: false, status: String, by: String, at: Date }], default: [] },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false }
);
submissionSchema.index({ tenant: 1, form: 1, submittedAt: -1 });
submissionSchema.index({ form: 1, phoneKey: 1 });
export const CrmFormSubmission = model<ICrmFormSubmission>("CrmFormSubmission", submissionSchema);
