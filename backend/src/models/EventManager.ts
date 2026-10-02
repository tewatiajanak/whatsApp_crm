import { randomUUID } from "crypto";
import { Schema, model } from "mongoose";

/**
 * Event Manager data — one document per event / attendee / activity-log entry.
 *
 * `_id` is a string (UUID) rather than an ObjectId so records created before
 * these collections existed keep their ids: attendee ids are printed inside
 * pass QR codes and must keep scanning.
 *
 * The schemas are `strict: false` because events carry per-event settings
 * (attendee fields, categories, pass design) and attendees carry the custom
 * fields configured for their event.
 */
const base = { _id: { type: String, default: () => randomUUID() } };
const opts = { strict: false, timestamps: true, minimize: false } as const;

const eventSchema = new Schema(
  {
    ...base,
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    eventName: { type: String, required: true, trim: true },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: "" },
    venue: { type: String, default: "" },
    city: { type: String, default: "" },
    organizer: { type: String, default: "" },
    eventType: { type: String, default: "" },
  },
  opts
);

const attendeeSchema = new Schema(
  {
    ...base,
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    eventId: { type: String, required: true },
    name: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    category: { type: String, default: "" },
    organization: { type: String, default: "" },
    status: { type: String, default: "registered" },
    passGenerated: { type: Boolean, default: false },
  },
  opts
);
attendeeSchema.index({ tenant: 1, eventId: 1 });

const eventLogSchema = new Schema(
  {
    ...base,
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    eventId: { type: String, default: "" },
    action: { type: String, default: "" },
  },
  opts
);
eventLogSchema.index({ tenant: 1, eventId: 1, createdAt: -1 });

export const EmEvent = model("EmEvent", eventSchema, "em_events");
export const EmAttendee = model("EmAttendee", attendeeSchema, "em_attendees");
export const EmEventLog = model("EmEventLog", eventLogSchema, "em_event_logs");
