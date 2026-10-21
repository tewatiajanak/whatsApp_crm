import { Schema, model, Document, Types } from "mongoose";

/* ───────────── saved reports and dashboards (CRM → Report builder) ───────────── */
export interface ICrmReport extends Document {
  tenant: Types.ObjectId;
  kind: "report" | "dashboard";
  name: string;
  /** report: the query; dashboard: its default period */
  spec: any;
  widgets: Array<{ id: string; type: "kpi" | "bar" | "line" | "pie" | "table"; title: string; w: number; spec: any }>;
  shared: boolean;
  pinned: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
const reportSchema = new Schema<ICrmReport>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    kind: { type: String, enum: ["report", "dashboard"], default: "report" },
    name: { type: String, required: true, trim: true },
    spec: { type: Schema.Types.Mixed, default: {} },
    widgets: { type: [{ _id: false, id: String, type: { type: String }, title: String, w: Number, spec: Schema.Types.Mixed }], default: [] },
    shared: { type: Boolean, default: true },
    pinned: { type: Boolean, default: false },
    createdBy: { type: String, default: "System" },
    updatedBy: { type: String, default: "System" },
  },
  { timestamps: true, minimize: false }
);
reportSchema.index({ tenant: 1, kind: 1, updatedAt: -1 });
export const CrmReport = model<ICrmReport>("CrmReport", reportSchema);
