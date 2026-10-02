/**
 * Event registration form: data shapes shared by the create-event wizard, the
 * form designer, the Setup template gallery and the public live form.
 *
 * A form is two things saved on the event:
 *   fields — what is asked (step 2 of the wizard)
 *   design — how the page looks: a theme plus an ordered list of blocks (step 3)
 */

export type FieldType =
  | "text"
  | "number"
  | "email"
  | "phone"
  | "dropdown"
  | "multiselect"
  | "rating"
  | "date"
  | "address"
  | "consent"
  /** Asks "how many?" and then repeats a set of sub-fields that many times. */
  | "repeater";

/** One input inside a repeater row (e.g. a participant's name, age, mobile). */
export type SubField = {
  key: string;
  label: string;
  type: "text" | "number" | "email" | "phone" | "dropdown" | "date";
  required: boolean;
  options?: string[];
};

/** Show a field only when another field has a certain answer. */
export type ShowWhen = { field: string; op: "is" | "isNot" | "filled" | "empty"; value?: string };

export type FormField = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  /** Built-in attendee fields (name, phone, email, category, organization). */
  system?: boolean;
  /** Pre-filled answer. For a hidden field this is the value that gets saved. */
  defaultValue?: string;
  /** Not shown on the form; its default value is saved with every registration. */
  hidden?: boolean;
  /** multiselect: how many options may / must be ticked (0 = no limit). */
  minSelect?: number;
  maxSelect?: number;
  showWhen?: ShowWhen | null;
  /** repeater */
  itemLabel?: string;
  minRows?: number;
  maxRows?: number;
  subFields?: SubField[];
};

export type BlockType =
  | "banner"
  | "heading"
  | "text"
  | "image"
  | "eventInfo"
  | "fees"
  | "divider"
  | "spacer"
  | "field"
  | "consent"
  | "submit";

export type Block = { id: string; type: BlockType; props: Record<string, any> };

export type FormTheme = {
  pageBg: string;
  cardBg: string;
  primary: string;
  text: string;
  muted: string;
  inputBg: string;
  inputBorder: string;
  radius: number;
  width: number;
  fontSize: number;
  inputStyle: "outline" | "filled" | "underline";
  cardBorder: boolean;
  cardShadow: boolean;
  /** Page around the form (all optional — older designs simply have none). */
  /** "card": form centred on the page · "split": picture/video panel beside the form */
  layout?: "card" | "split";
  bgImage?: string;
  bgVideo?: string;
  /** Darkness over the background picture / video, 0–90 (%). */
  overlay?: number;
  /** split layout: text shown over the picture panel */
  heroTitle?: string;
  heroText?: string;
  header?: { show: boolean; logo: string; title: string; bg: string; color: string };
  footer?: { show: boolean; text: string; bg: string; color: string };
};

export const PAGE_HEADER_DEFAULT = { show: false, logo: "", title: "{{organizer}}", bg: "#ffffff", color: "#253338" };
export const PAGE_FOOTER_DEFAULT = { show: false, text: "© {{organizer}}", bg: "#253338", color: "#ffffff" };

export type FormDesign = { theme: FormTheme; blocks: Block[] };

/** A template is a design with one slot where the event's own fields go. */
export type TemplateItem = { type: BlockType | "fields"; props?: Record<string, any> };
export type FormTemplate = {
  id: string;
  name: string;
  description: string;
  builtIn?: boolean;
  theme: FormTheme;
  layout: TemplateItem[];
};

export type EventInfo = {
  eventName?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  venue?: string;
  city?: string;
  organizer?: string;
  description?: string;
  registrationFees?: Record<string, number>;
  registrationFee?: number;
};

export const SYSTEM_FIELDS: FormField[] = [
  { key: "name", label: "Full name", type: "text", required: true, system: true },
  { key: "phone", label: "Mobile number", type: "phone", required: true, system: true },
  { key: "email", label: "Email", type: "email", required: false, system: true },
  { key: "category", label: "Attendee category", type: "dropdown", required: true, system: true },
  { key: "organization", label: "Organization", type: "text", required: false, system: true },
];

/** Custom-field types that can be asked on a public form. */
export const SUPPORTED_FIELD_TYPES: FieldType[] = [
  "text", "number", "email", "phone", "dropdown", "multiselect", "rating", "date", "address", "consent", "repeater",
];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  number: "Number",
  email: "Email",
  phone: "Mobile number",
  dropdown: "Dropdown (choose one)",
  multiselect: "Checkboxes (choose many)",
  rating: "Rating 1–5",
  date: "Date",
  address: "Address / long text",
  consent: "Single checkbox",
  repeater: "Repeating group (e.g. participants)",
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const BLOCK_DEFAULTS: Record<BlockType, Record<string, any>> = {
  banner: { title: "{{eventName}}", subtitle: "{{eventDate}} · {{venue}}", bg: "", bg2: "", color: "#ffffff", align: "left", imageUrl: "", padding: 28 },
  heading: { text: "Register now", size: "lg", align: "left", color: "" },
  text: { text: "Fill in your details below to reserve your place.", align: "left", color: "", size: 14 },
  image: { url: "", alt: "", height: 180, fit: "cover", radius: 10 },
  eventInfo: { showDate: true, showTime: true, showVenue: true, layout: "row" },
  fees: { title: "Registration fee" },
  divider: { color: "", thickness: 1, spacing: 8 },
  spacer: { height: 16 },
  field: { fieldKey: "", width: "full", placeholder: "", helpText: "" },
  consent: { text: "I agree to the terms and conditions.", required: true },
  submit: { label: "Register", align: "stretch" },
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  banner: "Banner",
  heading: "Heading",
  text: "Text",
  image: "Image",
  eventInfo: "Event details",
  fees: "Fee table",
  divider: "Divider",
  spacer: "Spacer",
  field: "Form field",
  consent: "Consent checkbox",
  submit: "Submit button",
};

export const newBlock = (type: BlockType, props: Record<string, any> = {}): Block => ({
  id: uid(),
  type,
  props: { ...BLOCK_DEFAULTS[type], ...props },
});

/** Turn a template into a design for a particular set of fields. */
export function applyTemplate(tpl: Pick<FormTemplate, "theme" | "layout">, fields: FormField[]): FormDesign {
  const blocks: Block[] = [];
  let slotUsed = false;
  tpl.layout.forEach((item) => {
    if (item.type === "fields") {
      slotUsed = true;
      fields.forEach((f) => blocks.push(newBlock("field", { ...item.props, fieldKey: f.key })));
    } else {
      blocks.push(newBlock(item.type, item.props));
    }
  });
  const design = { theme: { ...tpl.theme }, blocks };
  return slotUsed ? design : syncFields(design, fields);
}

/** The reverse: keep theme and decoration, collapse the field blocks into one slot. */
export function designToLayout(design: FormDesign): TemplateItem[] {
  const out: TemplateItem[] = [];
  let slotAdded = false;
  design.blocks.forEach((b) => {
    if (b.type === "field") {
      if (!slotAdded) {
        out.push({ type: "fields", props: { width: b.props.width || "full" } });
        slotAdded = true;
      }
    } else {
      out.push({ type: b.type, props: { ...b.props } });
    }
  });
  if (!slotAdded) out.push({ type: "fields", props: { width: "full" } });
  return out;
}

/**
 * Keep the canvas in step with the chosen fields: drop blocks whose field was
 * removed, add a block for every new field (just above the submit button), and
 * make sure there is exactly one submit button.
 */
export function syncFields(design: FormDesign, fields: FormField[]): FormDesign {
  const keys = new Set(fields.map((f) => f.key));
  const seen = new Set<string>();
  let blocks = design.blocks.filter((b) => {
    if (b.type !== "field") return true;
    if (!keys.has(b.props.fieldKey) || seen.has(b.props.fieldKey)) return false;
    seen.add(b.props.fieldKey);
    return true;
  });
  const missing = fields.filter((f) => !seen.has(f.key));
  if (missing.length) {
    const lastField = blocks.map((b) => b.type).lastIndexOf("field");
    const width = lastField >= 0 ? blocks[lastField].props.width : "full";
    const submitAt = blocks.findIndex((b) => b.type === "submit" || b.type === "consent");
    const at = lastField >= 0 ? lastField + 1 : submitAt >= 0 ? submitAt : blocks.length;
    blocks = [...blocks.slice(0, at), ...missing.map((f) => newBlock("field", { fieldKey: f.key, width })), ...blocks.slice(at)];
  }
  if (!blocks.some((b) => b.type === "submit")) blocks = [...blocks, newBlock("submit")];
  return { ...design, blocks };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ddmmyyyy = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

export const eventDateText = (e: EventInfo) => {
  const a = ddmmyyyy(e.startDate);
  const b = ddmmyyyy(e.endDate);
  return b && b !== a ? `${a} to ${b}` : a;
};
export const eventTimeText = (e: EventInfo) => [e.startTime, e.endTime].filter(Boolean).join(" – ");
export const eventVenueText = (e: EventInfo) => [e.venue, e.city].filter(Boolean).join(", ");

/** Replace {{eventName}} style tokens with the event's own details. */
export function fillTokens(text: string, e: EventInfo): string {
  const map: Record<string, string> = {
    eventName: e.eventName || "Your event name",
    eventDate: eventDateText(e) || "Event date",
    eventTime: eventTimeText(e),
    venue: e.venue || "Venue",
    city: e.city || "",
    organizer: e.organizer || "",
  };
  return String(text || "")
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k in map ? map[k] : ""))
    .replace(/\s*·\s*$/, "")
    .replace(/^\s*·\s*/, "");
}

/** Fee for a chosen category; falls back to the single event-wide fee. */
export function feeFor(e: EventInfo, category?: string): number {
  const fees = e.registrationFees || {};
  if (category && fees[category] !== undefined) return Number(fees[category]) || 0;
  return Number(e.registrationFee) || 0;
}
export const feeLabel = (n: number) => (n > 0 ? `₹${n.toLocaleString("en-IN")}` : "Free");

/** Uploaded images are stored as "/uploads/…" — point them at the API host. */
export const assetUrl = (url?: string) =>
  url && url.startsWith("/uploads/") ? `${(import.meta as any).env?.VITE_API_BASE || ""}${url}` : url || "";

/* ───────────── rules shared by the live form (and mirrored on the server) ───────────── */

export const REPEATER_MAX = 50;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmptyValue = (v: any) =>
  v === undefined || v === null || v === "" || v === false || (Array.isArray(v) && v.length === 0);

/** A field with a condition is shown only while the field it depends on matches. */
export function isFieldVisible(f: FormField, fields: FormField[], values: Record<string, any>, depth = 0): boolean {
  const w = f.showWhen;
  if (!w?.field) return true;
  const ctrl = fields.find((x) => x.key === w.field);
  if (!ctrl || ctrl.key === f.key) return true;
  // a field depending on a field that is itself not shown stays closed
  if (depth < 5 && !ctrl.hidden && !isFieldVisible(ctrl, fields, values, depth + 1)) return false;
  const v = values[ctrl.key];
  const filled = !isEmptyValue(v);
  if (w.op === "filled") return filled;
  if (w.op === "empty") return !filled;
  const target = String(w.value ?? "");
  const hit = Array.isArray(v)
    ? ctrl.type === "repeater" ? String(v.length) === target : v.map(String).includes(target)
    : ctrl.type === "consent" ? (v ? "yes" : "no") === target.toLowerCase()
    : String(v ?? "") === target;
  return w.op === "is" ? hit : !hit;
}

const defaultFor = (f: FormField): any => {
  const d = (f.defaultValue ?? "").trim();
  if (f.type === "repeater") return Array.from({ length: Math.max(0, f.minRows || 0) }, () => ({}));
  if (f.type === "multiselect") return d ? d.split(",").map((x) => x.trim()).filter(Boolean) : [];
  if (f.type === "consent") return /^(yes|true|1)$/i.test(d);
  return d;
};

/** Starting answers: every field's default value. */
export const initialValues = (fields: FormField[]): Record<string, any> =>
  Object.fromEntries(fields.map((f) => [f.key, defaultFor(f)]));

const checkOne = (type: string, label: string, required: boolean, v: any): string => {
  if (isEmptyValue(v)) return required ? `${label} is required` : "";
  if (type === "email" && !EMAIL_RE.test(String(v))) return "Enter a valid email address";
  if (type === "phone" && String(v).replace(/\D/g, "").length < 7) return "Enter a valid mobile number";
  if (type === "number" && !Number.isFinite(Number(v))) return "Enter a number";
  return "";
};

/**
 * Check the answers. Fields that are hidden or currently closed by a condition
 * are not checked. Repeater errors are keyed "<field>.<row>.<subfield>".
 */
export function validateValues(fields: FormField[], values: Record<string, any>): Record<string, string> {
  const errors: Record<string, string> = {};
  fields.forEach((f) => {
    if (f.hidden || !isFieldVisible(f, fields, values)) return;
    const v = values[f.key];
    if (f.type === "repeater") {
      const rows: any[] = Array.isArray(v) ? v : [];
      const min = Math.max(f.required ? 1 : 0, f.minRows || 0);
      if (rows.length < min) errors[f.key] = min === 1 ? `Add at least one ${(f.itemLabel || "entry").toLowerCase()}` : `At least ${min} are needed`;
      rows.forEach((row, i) =>
        (f.subFields || []).forEach((sf) => {
          const e = checkOne(sf.type, sf.label, sf.required, row?.[sf.key]);
          if (e) errors[`${f.key}.${i}.${sf.key}`] = e;
        })
      );
      return;
    }
    const e = checkOne(f.type, f.label, f.required, v);
    if (e) return void (errors[f.key] = e);
    if (f.type === "multiselect" && Array.isArray(v) && v.length) {
      if (f.minSelect && v.length < f.minSelect) errors[f.key] = `Choose at least ${f.minSelect}`;
      if (f.maxSelect && v.length > f.maxSelect) errors[f.key] = `Choose at most ${f.maxSelect}`;
    }
  });
  return errors;
}

/** A picture as a CSS background value; quoted so any URL is safe inside url(). */
export const cssUrl = (url?: string) => `url("${assetUrl(url).replace(/"/g, "%22")}")`;

/**
 * Re-order the field blocks of a design to follow the order of `fields`.
 * Everything else (banner, text, submit…) stays exactly where it is: the field
 * blocks only swap places among the slots they already occupy.
 */
export function orderFieldBlocks(design: FormDesign, fields: FormField[]): FormDesign {
  const rank = new Map(fields.map((x, i) => [x.key, i]));
  const sorted = design.blocks
    .filter((b) => b.type === "field")
    .sort((a, b) => (rank.get(a.props.fieldKey) ?? 999) - (rank.get(b.props.fieldKey) ?? 999));
  let n = 0;
  return { ...design, blocks: design.blocks.map((b) => (b.type === "field" ? sorted[n++] : b)) };
}
