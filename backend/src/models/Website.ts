import { Schema, model, Document, Types } from "mongoose";

/**
 * Website Builder: a tenant owns many websites; a website owns pages and menus.
 * Page content is the page JSON (schemaVersion 2): a tree of nodes
 * { id, type, props, style: { desktop, tablet, mobile }, children }.
 * Draft and published copies are kept apart, so editing never changes the live site.
 */

/* ---- Website ---- */
export interface IWebsite extends Document {
  tenant: Types.ObjectId;
  name: string;
  /** public address: /site/<siteKey> */
  siteKey: string;
  status: "draft" | "published";
  /** design tokens (colours, fonts, spacing…) — see frontend website-builder/theme.js */
  themeDraft: any;
  themePublished: any;
  themePublishedAt?: Date | null;
  /** leadCapture: form submissions with a name and phone also become CRM leads */
  settings: { description?: string; logoText?: string; logoUrl?: string; templateKey?: string; leadCapture?: boolean; apps?: any };
}
const websiteSchema = new Schema<IWebsite>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    siteKey: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/ },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    themeDraft: { type: Schema.Types.Mixed, default: {} },
    themePublished: { type: Schema.Types.Mixed, default: null },
    themePublishedAt: { type: Date, default: null },
    settings: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);
// the key is part of a public URL, so it is unique across every tenant
websiteSchema.index({ siteKey: 1 }, { unique: true });
export const Website = model<IWebsite>("Website", websiteSchema);

/* ---- Page ---- */
export interface IWebPage extends Document {
  tenant: Types.ObjectId;
  website: Types.ObjectId;
  title: string;
  /** "/" for the home page, otherwise "/about", "/services/web" … */
  path: string;
  isHome: boolean;
  status: "draft" | "published";
  draft: any;
  published: any;
  /** goes up on every draft save; a save carrying an older number is refused */
  version: number;
  seo: { title?: string; description?: string };
  /** "collectionItem" pages end in "/:slug" and show one record of `collectionKey` */
  pageType: "static" | "collectionItem";
  collectionKey: string;
  publishedAt?: Date | null;
  order: number;
}
const webPageSchema = new Schema<IWebPage>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    website: { type: Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    path: { type: String, required: true, trim: true, lowercase: true, match: /^\/([a-z0-9-]+(\/[a-z0-9-]+)*(\/:slug)?)?$/ },
    pageType: { type: String, enum: ["static", "collectionItem"], default: "static" },
    collectionKey: { type: String, default: "" },
    isHome: { type: Boolean, default: false },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    draft: { type: Schema.Types.Mixed, default: {} },
    published: { type: Schema.Types.Mixed, default: null },
    version: { type: Number, default: 1 },
    seo: { type: Schema.Types.Mixed, default: {} },
    publishedAt: { type: Date, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, minimize: false }
);
webPageSchema.index({ website: 1, path: 1 }, { unique: true });
export const WebPage = model<IWebPage>("WebPage", webPageSchema);

/* ---- Menu (one per location per website) ---- */
export interface IWebMenu extends Document {
  tenant: Types.ObjectId;
  website: Types.ObjectId;
  location: string;
  /** [{ id, label, type: 'page'|'url'|'anchor'|'heading', pageId?, url?, newTab?, highlight?, children: [...] }] */
  items: any[];
}
const webMenuSchema = new Schema<IWebMenu>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    website: { type: Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    location: { type: String, required: true, enum: ["primary", "footer", "mobile", "legal"] },
    items: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);
webMenuSchema.index({ website: 1, location: 1 }, { unique: true });
export const WebMenu = model<IWebMenu>("WebMenu", webMenuSchema);

/* ---- Saved block (a section the user saved for reuse on this website) ---- */
export interface IWebBlock extends Document {
  tenant: Types.ObjectId;
  website: Types.ObjectId;
  name: string;
  category: string;
  content: any;
}
const webBlockSchema = new Schema<IWebBlock>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    website: { type: Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, default: "Saved", trim: true, maxlength: 40 },
    content: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);
export const WebBlock = model<IWebBlock>("WebBlock", webBlockSchema);

/* ---- Collection (content type): the shape of a list of records ---- */
export const WEB_FIELD_TYPES = ["text", "textarea", "richtext", "number", "boolean", "date", "image", "url", "email", "select", "tags", "relation"] as const;
export interface IWebField { key: string; label: string; type: (typeof WEB_FIELD_TYPES)[number]; required?: boolean; options?: string[]; relation?: string; hiddenFromApi?: boolean }
export interface IWebCollection extends Document {
  tenant: Types.ObjectId;
  website: Types.ObjectId;
  key: string;
  name: string;
  fields: IWebField[];
  settings: { titleField?: string; apiEnabled?: boolean; publicWithoutKey?: boolean; appKey?: string };
}
const webCollectionSchema = new Schema<IWebCollection>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    website: { type: Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    key: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z][a-z0-9_]{1,39}$/ },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    fields: { type: Schema.Types.Mixed, default: [] },
    settings: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);
webCollectionSchema.index({ website: 1, key: 1 }, { unique: true });
export const WebCollection = model<IWebCollection>("WebCollection", webCollectionSchema);

/* ---- Record: one entry of a collection ---- */
export interface IWebRecord extends Document {
  tenant: Types.ObjectId;
  website: Types.ObjectId;
  collectionKey: string;
  slug: string;
  status: "draft" | "published";
  publishedAt?: Date | null;
  data: Record<string, any>;
  /** lower-cased text of the searchable fields */
  searchText: string;
}
const webRecordSchema = new Schema<IWebRecord>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    website: { type: Schema.Types.ObjectId, ref: "Website", required: true },
    collectionKey: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z0-9][a-z0-9-]{0,79}$/ },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    publishedAt: { type: Date, default: null },
    data: { type: Schema.Types.Mixed, default: {} },
    searchText: { type: String, default: "" },
  },
  { timestamps: true, minimize: false }
);
webRecordSchema.index({ website: 1, collectionKey: 1, slug: 1 }, { unique: true });
webRecordSchema.index({ website: 1, collectionKey: 1, status: 1, publishedAt: -1 });
export const WebRecord = model<IWebRecord>("WebRecord", webRecordSchema);

/* ---- API key for the read-only Content Delivery API (only a hash is stored) ---- */
export interface IWebApiKey extends Document {
  tenant: Types.ObjectId; website: Types.ObjectId; name: string; prefix: string; hash: string;
  allowedOrigins: string[]; allowedCollections: string[]; status: "active" | "revoked"; expiresAt?: Date | null; lastUsedAt?: Date | null; uses: number;
}
const webApiKeySchema = new Schema<IWebApiKey>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    website: { type: Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    prefix: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
    allowedOrigins: { type: [String], default: [] },
    allowedCollections: { type: [String], default: [] },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    expiresAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
    uses: { type: Number, default: 0 },
  },
  { timestamps: true }
);
export const WebApiKey = model<IWebApiKey>("WebApiKey", webApiKeySchema);

/* ---- Outgoing webhook ---- */
export const WEB_EVENTS = ["record.created", "record.updated", "record.deleted", "record.published", "page.published", "page.unpublished", "form.submitted", "theme.published"] as const;
export interface IWebWebhook extends Document {
  tenant: Types.ObjectId; website: Types.ObjectId; name: string; url: string; events: string[]; secret: string; active: boolean; failures: number;
  /** newest first, capped */
  deliveries: { at: Date; event: string; status: number; ms: number; error?: string }[];
}
const webWebhookSchema = new Schema<IWebWebhook>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    website: { type: Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true, maxlength: 500 },
    events: { type: [String], default: [] },
    secret: { type: String, required: true },
    active: { type: Boolean, default: true },
    failures: { type: Number, default: 0 },
    deliveries: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);
export const WebWebhook = model<IWebWebhook>("WebWebhook", webWebhookSchema);

/* ---- External REST data source (called server-side only) ---- */
export interface IWebDataSource extends Document {
  tenant: Types.ObjectId; website: Types.ObjectId; key: string; name: string; url: string;
  /** AES-256-GCM encrypted JSON of request headers (may hold API keys); never returned by the API */
  headersEnc: string;
  rootPath: string; fields: { key: string; path: string }[]; ttlSeconds: number;
  lastSuccessAt?: Date | null; lastErrorAt?: Date | null; lastError?: string; failures: number;
}
const webDataSourceSchema = new Schema<IWebDataSource>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    website: { type: Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    key: { type: String, required: true, lowercase: true, trim: true, match: /^[a-z][a-z0-9_]{1,39}$/ },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    url: { type: String, required: true, trim: true, maxlength: 1000 },
    headersEnc: { type: String, default: "" },
    rootPath: { type: String, default: "", maxlength: 200 },
    fields: { type: Schema.Types.Mixed, default: [] },
    ttlSeconds: { type: Number, default: 300, min: 30, max: 86400 },
    lastSuccessAt: { type: Date, default: null },
    lastErrorAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    failures: { type: Number, default: 0 },
  },
  { timestamps: true }
);
webDataSourceSchema.index({ website: 1, key: 1 }, { unique: true });
export const WebDataSource = model<IWebDataSource>("WebDataSource", webDataSourceSchema);

/* ---- Form submission from a public website ---- */
export interface IWebSubmission extends Document { tenant: Types.ObjectId; website: Types.ObjectId; form: string; pagePath: string; data: Record<string, string>; read: boolean; leadCreated: boolean }
const webSubmissionSchema = new Schema<IWebSubmission>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    website: { type: Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    form: { type: String, default: "Form", maxlength: 80 },
    pagePath: { type: String, default: "/", maxlength: 200 },
    data: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
    leadCreated: { type: Boolean, default: false },
  },
  { timestamps: true }
);
export const WebSubmission = model<IWebSubmission>("WebSubmission", webSubmissionSchema);

/* ---- Share link: read-only view of the draft website, expiring ---- */
export interface IWebShareLink extends Document { tenant: Types.ObjectId; website: Types.ObjectId; tokenHash: string; label: string; expiresAt: Date; views: number; revokedAt?: Date | null }
const webShareLinkSchema = new Schema<IWebShareLink>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    website: { type: Schema.Types.ObjectId, ref: "Website", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    label: { type: String, default: "", maxlength: 80 },
    expiresAt: { type: Date, required: true },
    views: { type: Number, default: 0 },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
export const WebShareLink = model<IWebShareLink>("WebShareLink", webShareLinkSchema);
