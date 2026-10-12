import { Schema, model, Document, Types } from "mongoose";

/* A meeting or a training (the type comes from the Meeting / Training Type master). */
export interface IMeetingAttendee {
  _id?: Types.ObjectId;
  /** an employee, or a client contact */
  user?: Types.ObjectId | null;
  name: string;
  email: string;
  mobile: string;
  isClient: boolean;
  response: "" | "yes" | "no" | "maybe";
  attended: boolean;
  /** opens the response page without a login */
  token: string;
}
export interface IMeetingAction {
  _id?: Types.ObjectId;
  text: string;
  assignee?: Types.ObjectId | null;
  /** YYYY-MM-DD */
  due: string;
  task?: Types.ObjectId | null;
}

export interface IPmMeeting extends Document {
  tenant: Types.ObjectId;
  title: string;
  type?: Types.ObjectId | null;
  /** YYYY-MM-DD and HH:MM, local time */
  date: string;
  from: string;
  to: string;
  startsAt: Date;
  /** hybrid = online + offline: a place and a link */
  mode: "onsite" | "online" | "hybrid";
  location: string;
  link: string;
  project?: Types.ObjectId | null;
  client?: Types.ObjectId | null;
  attendees: IMeetingAttendee[];
  agenda: string;
  organizer: Types.ObjectId;
  /** meetings created together as one recurring series */
  series?: Types.ObjectId | null;
  /** minutes before the start */
  /** invites, updates and reminders also go by email */
  emailInvite: boolean;
  reminders: number[];
  firedReminders: number[];
  status: "scheduled" | "cancelled";
  minutes: string;
  actions: IMeetingAction[];
  isDemo?: boolean;
}

const meetingSchema = new Schema<IPmMeeting>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    title: { type: String, required: true, trim: true },
    type: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    date: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    startsAt: { type: Date, required: true },
    mode: { type: String, enum: ["onsite", "online", "hybrid"], default: "onsite" },
    location: { type: String, default: "" },
    link: { type: String, default: "" },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", default: null },
    client: { type: Schema.Types.ObjectId, ref: "PmClient", default: null },
    attendees: {
      type: [new Schema<IMeetingAttendee>({
        user: { type: Schema.Types.ObjectId, ref: "User", default: null },
        name: { type: String, default: "" },
        email: { type: String, default: "" },
        mobile: { type: String, default: "" },
        isClient: { type: Boolean, default: false },
        response: { type: String, enum: ["", "yes", "no", "maybe"], default: "" },
        attended: { type: Boolean, default: false },
        token: { type: String, default: "" },
      })],
      default: [],
    },
    agenda: { type: String, default: "" },
    organizer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    series: { type: Schema.Types.ObjectId, default: null },
    emailInvite: { type: Boolean, default: true },
    reminders: { type: [Number], default: [1440, 30] },
    firedReminders: { type: [Number], default: [] },
    status: { type: String, enum: ["scheduled", "cancelled"], default: "scheduled" },
    minutes: { type: String, default: "" },
    actions: {
      type: [new Schema<IMeetingAction>({
        text: { type: String, required: true, trim: true },
        assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
        due: { type: String, default: "" },
        task: { type: Schema.Types.ObjectId, ref: "PmTask", default: null },
      })],
      default: [],
    },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
meetingSchema.index({ tenant: 1, date: 1 });
meetingSchema.index({ tenant: 1, "attendees.user": 1, date: 1 });
meetingSchema.index({ "attendees.token": 1 });
meetingSchema.index({ status: 1, startsAt: 1 });

export const PmMeeting = model<IPmMeeting>("PmMeeting", meetingSchema, "pm_meetings");
