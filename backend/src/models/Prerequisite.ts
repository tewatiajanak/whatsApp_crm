import { Schema, model, Document, Types } from "mongoose";

/**
 * Admission pre-requisite questionnaire a client fills from a public link
 * (Setup › Implementation › Pre-requisites). One per tenant: the link is tied to that client.
 * The client can save in parts and come back; Final Submit locks it.
 */
export const PREREQ_SECTIONS: { key: string; label: string }[] = [
  { key: "institute", label: "Institute & Employees" },
  { key: "branches", label: "Branch Details" },
  { key: "enquiryStages", label: "Enquiry Stages" },
  { key: "appProcess", label: "Application Process" },
  { key: "integrations", label: "Integrations" },
  { key: "whatsapp", label: "WhatsApp Setup" },
  { key: "academic", label: "Academic Details" },
  { key: "faq", label: "FAQs & Query Categories" },
  { key: "sources", label: "Enquiry Sources & Numbering" },
  { key: "fee", label: "Fee & Documents" },
  { key: "assign", label: "Assignment Rules" },
  { key: "forms", label: "Forms & Landing Page" },
  { key: "templates", label: "Communication Templates" },
  { key: "preview", label: "Preview & Download" },
];
/** sections the client has to save before the form counts as complete (preview is only a summary) */
export const PREREQ_REQUIRED = PREREQ_SECTIONS.filter((s) => s.key !== "preview").map((s) => s.key);

export interface IPrereqSend { to: string; subject: string; at: Date; by: string; simulated: boolean }
export interface IPrerequisite extends Document {
  tenant: Types.ObjectId;
  token: string;
  /** the client's own project address, e.g. https://dps.knowvato.in — the link is built on it */
  clientUrl: string;
  status: "draft" | "submitted";
  data: any;
  /** sectionKey → { savedAt } once the client pressed Save on that section */
  sections: Record<string, { savedAt: Date }>;
  firstOpenedAt?: Date | null;
  lastSavedAt?: Date | null;
  submittedAt?: Date | null;
  submittedBy?: { name: string; email: string } | null;
  reopenedAt?: Date | null;
  sends: IPrereqSend[];
}

const prerequisiteSchema = new Schema<IPrerequisite>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    token: { type: String, required: true, unique: true },
    clientUrl: { type: String, default: "" },
    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    data: { type: Schema.Types.Mixed, default: null },
    sections: { type: Schema.Types.Mixed, default: {} },
    firstOpenedAt: { type: Date, default: null },
    lastSavedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    submittedBy: { type: new Schema({ name: String, email: String }, { _id: false }), default: null },
    reopenedAt: { type: Date, default: null },
    sends: { type: [new Schema({ to: String, subject: String, at: Date, by: String, simulated: Boolean }, { _id: false })], default: [] },
  },
  { timestamps: true, minimize: false }
);
export const Prerequisite = model<IPrerequisite>("Prerequisite", prerequisiteSchema);
