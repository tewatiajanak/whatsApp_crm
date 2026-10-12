import { Schema, model, Document, Types } from "mongoose";

/* Communication templates of Project Management, with named dynamic keys
   ({{client.name}}, {{task.title}}, …). */
export const PM_TEMPLATE_CATEGORIES = ["Task", "Project", "Meeting", "Training", "Ticket", "Verification", "Sign-off", "Reminder", "General"] as const;

export interface IPmTemplate extends Document {
  tenant: Types.ObjectId;
  name: string;
  channel: "email" | "whatsapp";
  category: string;
  /** email only */
  subject: string;
  /** email: HTML · whatsapp: plain text */
  body: string;
  /** the approved template at the WhatsApp provider, when the message must go as a template */
  waTemplateName: string;
  waLanguage: string;
  /** the WhatsApp template as the provider approves it (header, footer, buttons) and its approval */
  wa: {
    metaCategory: string;
    headerType: string;
    headerText: string;
    /** media header: a public link or the provider's media id */
    headerMedia: string;
    footer: string;
    buttons: { type: string; text: string; url?: string; phoneNumber?: string }[];
    metaId: string;
    /** "" = not submitted · Pending · Approved · Rejected */
    metaStatus: string;
    rejectionReason: string;
  };
  active: boolean;
}

const templateSchema = new Schema<IPmTemplate>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true },
    channel: { type: String, enum: ["email", "whatsapp"], required: true },
    category: { type: String, enum: PM_TEMPLATE_CATEGORIES, default: "General" },
    subject: { type: String, default: "" },
    body: { type: String, default: "" },
    waTemplateName: { type: String, default: "", trim: true },
    waLanguage: { type: String, default: "en", trim: true },
    wa: {
      metaCategory: { type: String, default: "UTILITY" },
      headerType: { type: String, default: "NONE" },
      headerText: { type: String, default: "" },
      headerMedia: { type: String, default: "" },
      footer: { type: String, default: "" },
      buttons: { type: Schema.Types.Mixed, default: [] },
      metaId: { type: String, default: "" },
      metaStatus: { type: String, default: "" },
      rejectionReason: { type: String, default: "" },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
templateSchema.index({ tenant: 1, channel: 1, name: 1 }, { unique: true });

export const PmTemplate = model<IPmTemplate>("PmTemplate", templateSchema, "pm_templates");
