import { Schema, model, Document, Types } from "mongoose";

export interface IOrganizationDetails {
  tenant: Types.ObjectId;
  name?: string;
  tagline?: string;
  logo?: string;
  logoWidth?: number;
  logoHeight?: number;
  logoBorderRadius?: number;
  loginLayout?: "center-stack" | "side-by-side";
  logoSize?: number;
  nameFontSize?: number;
  taglineFontSize?: number;
  nameColor?: string;
  taglineColor?: string;
  natureOfBusiness?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  contactInfo?: {
    mobile?: string;
    email?: string;
  };
  socialMedia?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
    whatsapp?: string;
  };
  loginImages?: string[];
  loginVideo?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const organizationDetailsSchema = new Schema<IOrganizationDetails>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true, unique: true },
    name: { type: String, default: "" },
    tagline: { type: String, default: "" },
    logo: { type: String, default: null },
    logoWidth: { type: Number, default: 200 },
    logoHeight: { type: Number, default: 100 },
    logoBorderRadius: { type: Number, default: 0 },
    loginLayout: { type: String, enum: ["center-stack", "side-by-side"], default: "center-stack" },
    logoSize: { type: Number, default: 60 },
    nameFontSize: { type: Number, default: 24 },
    taglineFontSize: { type: Number, default: 14 },
    nameColor: { type: String, default: "#222" },
    taglineColor: { type: String, default: "#666" },
    natureOfBusiness: { type: String, default: "" },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      postalCode: { type: String, default: "" },
    },
    contactInfo: {
      mobile: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    socialMedia: {
      facebook: { type: String, default: "" },
      twitter: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      instagram: { type: String, default: "" },
      youtube: { type: String, default: "" },
      whatsapp: { type: String, default: "" },
    },
    loginImages: [{ type: String }],
    loginVideo: { type: String, default: null },
  },
  { timestamps: true }
);

export const OrganizationDetails = model<IOrganizationDetails>("OrganizationDetails", organizationDetailsSchema);
