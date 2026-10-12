import { Schema, model, Document, Types } from "mongoose";

/* ---- Lead status (colour-coded, follow-up rule) ---- */
export interface ILeadStatus extends Document {
  tenant: Types.ObjectId;
  name: string;
  color: string;
  subStatuses: string[];
  offerings: Types.ObjectId[];
  followUpRequired: string; // "Yes" or "No"
  order: number;
  isWon: boolean;
  isLost: boolean;
}

const leadStatusSchema = new Schema<ILeadStatus>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    color: { type: String, default: "#2563eb" },
    subStatuses: { type: [String], default: [] },
    offerings: { type: [Schema.Types.ObjectId], ref: "Service", default: [] },
    followUpRequired: { type: String, enum: ["Yes", "No"], default: "No" },
    order: { type: Number, default: 0 },
    isWon: { type: Boolean, default: false },
    isLost: { type: Boolean, default: false },
  },
  { timestamps: true }
);
leadStatusSchema.index({ tenant: 1, order: 1 });
export const LeadStatus = model<ILeadStatus>("LeadStatus", leadStatusSchema);

/* ---- Sub-status (belongs to a status) ---- */
export interface ISubStatus extends Document {
  tenant: Types.ObjectId;
  status: Types.ObjectId;
  name: string;
}
const subStatusSchema = new Schema<ISubStatus>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    status: { type: Schema.Types.ObjectId, ref: "LeadStatus", required: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);
export const SubStatus = model<ISubStatus>("SubStatus", subStatusSchema);

/* ---- Lead source ---- */
export interface ILeadSource extends Document {
  tenant: Types.ObjectId;
  name: string;
  color: string;
}
const leadSourceSchema = new Schema<ILeadSource>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    color: { type: String, default: "#6366f1" },
  },
  { timestamps: true }
);
export const LeadSource = model<ILeadSource>("LeadSource", leadSourceSchema);

/* ---- Academic Session ---- */
export interface IAcademicSession extends Document {
  tenant: Types.ObjectId;
  name: string;
  startYear: number;
  endYear: number;
  isActive: boolean;
}
const academicSessionSchema = new Schema<IAcademicSession>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    startYear: { type: Number, required: true },
    endYear: { type: Number, required: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);
academicSessionSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const AcademicSession = model<IAcademicSession>("AcademicSession", academicSessionSchema);

/* ---- Grade ---- */
export interface IGrade extends Document {
  tenant: Types.ObjectId;
  name: string;
  order: number;
}
const gradeSchema = new Schema<IGrade>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
gradeSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const Grade = model<IGrade>("Grade", gradeSchema);

/* ---- Designation ---- */
export interface IDesignation extends Document {
  tenant: Types.ObjectId;
  name: string;
  order: number;
}
const designationSchema = new Schema<IDesignation>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
designationSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const Designation = model<IDesignation>("Designation", designationSchema);

/* ---- Fee Head (class-wise amounts) ---- */
export interface IFeeHead extends Document {
  tenant: Types.ObjectId;
  name: string;
  order: number;
  isActive: boolean;
  /** one row per class the head applies to; no row = not applicable to that class */
  classFees: { grade: Types.ObjectId; amount: number }[];
}
const feeHeadSchema = new Schema<IFeeHead>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    classFees: {
      type: [
        new Schema(
          {
            grade: { type: Schema.Types.ObjectId, ref: "Grade", required: true },
            amount: { type: Number, default: 0, min: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);
feeHeadSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const FeeHead = model<IFeeHead>("FeeHead", feeHeadSchema);

/* ---- Document Type (class mapping) ---- */
export interface IDocumentType extends Document {
  tenant: Types.ObjectId;
  name: string;
  order: number;
  isActive: boolean;
  mandatory: boolean;
  /** classes the document is asked for */
  grades: Types.ObjectId[];
}
const documentTypeSchema = new Schema<IDocumentType>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    mandatory: { type: Boolean, default: true },
    grades: { type: [{ type: Schema.Types.ObjectId, ref: "Grade" }], default: [] },
  },
  { timestamps: true }
);
documentTypeSchema.index({ tenant: 1, name: 1 }, { unique: true });
export const DocumentType = model<IDocumentType>("DocumentType", documentTypeSchema);
