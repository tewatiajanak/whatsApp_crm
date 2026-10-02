import { Schema, model, Document, Types } from "mongoose";

/**
 * Per-module Setup data (Event Manager, CRM, Website Builder, Front Office).
 * Each record belongs to exactly one module, so templates and custom fields
 * created in one module's Setup are never listed in another.
 */
export const SETUP_MODULES = ["events", "crm", "website", "front-office"] as const;
export type SetupModule = (typeof SETUP_MODULES)[number];

/* ---- Communication templates (WhatsApp / SMS / Email) ---- */
export interface IModuleTemplate extends Document {
  tenant: Types.ObjectId;
  module: SetupModule;
  channel: "whatsapp" | "sms" | "email";
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  header?: { type: string; text?: string };
  subject?: string;
  body: string;
  footer?: string;
  buttons: any[];
  sample?: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  active: boolean;
}

const moduleTemplateSchema = new Schema<IModuleTemplate>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    module: { type: String, enum: SETUP_MODULES, required: true },
    channel: { type: String, enum: ["whatsapp", "sms", "email"], required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ["MARKETING", "UTILITY", "AUTHENTICATION"], default: "MARKETING" },
    language: { type: String, default: "en_US" },
    header: { type: Schema.Types.Mixed, default: { type: "none" } },
    subject: { type: String, default: "" },
    body: { type: String, required: true },
    footer: { type: String, default: "" },
    buttons: { type: Schema.Types.Mixed, default: [] },
    sample: { type: String, default: "" },
    status: { type: String, enum: ["APPROVED", "PENDING", "REJECTED"], default: "PENDING" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

moduleTemplateSchema.index({ tenant: 1, module: 1, channel: 1 });

export const ModuleTemplate = model<IModuleTemplate>("ModuleTemplate", moduleTemplateSchema);

/* ---- Custom fields ---- */
export interface ICustomField extends Document {
  tenant: Types.ObjectId;
  module: SetupModule;
  key: string;
  label: string;
  type: string;
  category?: string;
  options?: string;
  required: string;
  isSystem: string;
  isActive: boolean;
  /** Event ids this field applies to; empty = every event. */
  events: string[];
}

const customFieldSchema = new Schema<ICustomField>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    module: { type: String, enum: SETUP_MODULES, required: true },
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, default: "text" },
    category: { type: String, default: "" },
    options: { type: String, default: "" },
    required: { type: String, enum: ["yes", "no", ""], default: "no" },
    isSystem: { type: String, enum: ["yes", "no", ""], default: "no" },
    isActive: { type: Boolean, default: true },
    events: { type: [String], default: [] },
  },
  { timestamps: true }
);

customFieldSchema.index({ tenant: 1, module: 1, key: 1 }, { unique: true });

export const CustomField = model<ICustomField>("CustomField", customFieldSchema);
