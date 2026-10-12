import { Schema, model, Document, Types } from "mongoose";

/* ---- Department (an employee belongs to one) ---- */
export interface IPmDepartment extends Document {
  tenant: Types.ObjectId;
  name: string;
  order: number;
  active: boolean;
}

const departmentSchema = new Schema<IPmDepartment>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
departmentSchema.index({ tenant: 1, name: 1 }, { unique: true });

export const PmDepartment = model<IPmDepartment>("PmDepartment", departmentSchema, "pm_departments");
