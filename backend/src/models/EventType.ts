import { Schema, model, Document, Types } from "mongoose";

/**
 * Event Type — a configurable template for creating events. Each type carries
 * defaults (icon, color, feature toggles) that pre-fill new events of that type.
 * PHASE-4 model, minimal implementation. Advanced defaults (form / pass /
 * checklist templates) will be wired in as those modules ship for real.
 */
export interface IEventType extends Document {
  tenant: Types.ObjectId;
  name: string;
  key: string;
  icon: string;
  color: string;
  description?: string;
  defaultFeatures: Record<string, boolean>;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

const eventTypeSchema = new Schema<IEventType>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true, lowercase: true },
    icon: { type: String, default: "bi-calendar-event" },
    color: { type: String, default: "#2249b7" },
    description: { type: String, default: "" },
    defaultFeatures: { type: Schema.Types.Mixed, default: {} },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

eventTypeSchema.index({ tenant: 1, key: 1 }, { unique: true });
eventTypeSchema.index({ tenant: 1, sortOrder: 1 });

export const EventType = model<IEventType>("EventType", eventTypeSchema);
