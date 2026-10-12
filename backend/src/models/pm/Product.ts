import { Schema, model, Document, Types } from "mongoose";

/* Setup templates: Product → Module → Task template → Checklist.
   A project copies these when it is created; later template changes do not
   touch running projects. */

export interface IPmProduct extends Document {
  tenant: Types.ObjectId;
  name: string;
  code: string;
  description: string;
  active: boolean;
  /** project-level auto Email/WhatsApp rules (services/pm/rules) */
  autoMessages: any[];
  isDemo?: boolean;
}
const productSchema = new Schema<IPmProduct>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
    autoMessages: { type: Schema.Types.Mixed, default: [] },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
productSchema.index({ tenant: 1, code: 1 }, { unique: true });
export const PmProduct = model<IPmProduct>("PmProduct", productSchema, "pm_products");

export interface IPmProductModule extends Document {
  tenant: Types.ObjectId;
  product: Types.ObjectId;
  name: string;
  order: number;
  defaultIncharge?: Types.ObjectId | null;
  active: boolean;
  /** module-level auto Email/WhatsApp rules */
  autoMessages: any[];
}
const moduleSchema = new Schema<IPmProductModule>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "PmProduct", required: true, index: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    defaultIncharge: { type: Schema.Types.ObjectId, ref: "User", default: null },
    active: { type: Boolean, default: true },
    autoMessages: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);
export const PmProductModule = model<IPmProductModule>("PmProductModule", moduleSchema, "pm_product_modules");

export const TAT_UNITS = ["hours", "days", "working_days"] as const;
export type TatUnit = (typeof TAT_UNITS)[number];

export interface IChecklistTemplate {
  _id?: Types.ObjectId;
  text: string;
  order: number;
  mandatory: boolean;
}
export const checklistTemplateSchema = new Schema<IChecklistTemplate>({
  text: { type: String, required: true, trim: true },
  order: { type: Number, default: 0 },
  mandatory: { type: Boolean, default: false },
});

export interface IPmTaskTemplate extends Document {
  tenant: Types.ObjectId;
  product: Types.ObjectId;
  module: Types.ObjectId;
  title: string;
  taskType?: Types.ObjectId | null;
  priority?: Types.ObjectId | null;
  defaultAssignee?: Types.ObjectId | null;
  tatValue: number;
  tatUnit: TatUnit;
  order: number;
  /** other task templates of the same product (any module) that must finish first */
  dependsOn: Types.ObjectId[];
  clientVerification: boolean;
  clientVisible: boolean;
  /** a file is expected on this task; `mandatoryAttachment` says it cannot be completed without one */
  attachmentRequired: boolean;
  mandatoryAttachment: boolean;
  description: string;
  checklist: IChecklistTemplate[];
  /** auto Email/WhatsApp rules (Part 1C) */
  autoMessages: any[];
}
const taskTemplateSchema = new Schema<IPmTaskTemplate>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "PmProduct", required: true, index: true },
    module: { type: Schema.Types.ObjectId, ref: "PmProductModule", required: true, index: true },
    title: { type: String, required: true, trim: true },
    taskType: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    priority: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    defaultAssignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
    tatValue: { type: Number, default: 1 },
    tatUnit: { type: String, enum: TAT_UNITS, default: "working_days" },
    order: { type: Number, default: 0 },
    dependsOn: { type: [Schema.Types.ObjectId], ref: "PmTaskTemplate", default: [] },
    clientVerification: { type: Boolean, default: false },
    clientVisible: { type: Boolean, default: true },
    attachmentRequired: { type: Boolean, default: false },
    mandatoryAttachment: { type: Boolean, default: false },
    description: { type: String, default: "" },
    checklist: { type: [checklistTemplateSchema], default: [] },
    autoMessages: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);
export const PmTaskTemplate = model<IPmTaskTemplate>("PmTaskTemplate", taskTemplateSchema, "pm_task_templates");
