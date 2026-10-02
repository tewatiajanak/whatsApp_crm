/**
 * Event pass design: a pass is a fixed-size card made of blocks stacked from
 * top to bottom. Saved on the event as `passLayout`.
 */
import { type EventInfo, assetUrl, eventDateText, eventTimeText, uid } from "../event-form/schema";

export type PassBlockType = "header" | "text" | "value" | "badge" | "qr" | "image" | "divider" | "spacer";
export type PassBlock = { id: string; type: PassBlockType; props: Record<string, any> };

export type PassSettings = {
  width: number;
  height: number;
  bg: string;
  bgImage: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  radius: number;
  padding: number;
};
export type PassDesign = { settings: PassSettings; blocks: PassBlock[] };

/** A value shown on the pass: an attendee detail or an answer from the registration form. */
export type PassField = { key: string; label: string };

export const BASE_PASS_FIELDS: PassField[] = [
  { key: "name", label: "Name" },
  { key: "category", label: "Attendee category" },
  { key: "organization", label: "Organization" },
  { key: "phone", label: "Mobile number" },
  { key: "email", label: "Email" },
  { key: "passId", label: "Pass ID" },
];

export const PASS_SIZES: { label: string; width: number; height: number }[] = [
  { label: "ID card — portrait", width: 340, height: 540 },
  { label: "ID card — landscape", width: 540, height: 340 },
  { label: "Badge — large portrait", width: 400, height: 600 },
  { label: "Ticket — wide", width: 640, height: 280 },
  { label: "Square", width: 420, height: 420 },
];

export const PASS_BLOCK_LABELS: Record<PassBlockType, string> = {
  header: "Header band",
  text: "Text",
  value: "Attendee value",
  badge: "Category badge",
  qr: "QR code",
  image: "Image / logo",
  divider: "Divider",
  spacer: "Space",
};

export const PASS_BLOCK_DEFAULTS: Record<PassBlockType, Record<string, any>> = {
  header: { title: "{{eventName}}", subtitle: "{{eventDate}} · {{venue}}", bg: "#217E79", useRibbon: false, color: "#ffffff", titleSize: 18, subtitleSize: 11, align: "left", padding: 16 },
  text: { text: "Text", size: 12, bold: false, color: "", align: "left" },
  value: { field: "name", showLabel: false, label: "", size: 22, bold: true, color: "", align: "left" },
  badge: { size: 11, align: "left", bg: "", color: "#ffffff" },
  qr: { size: 130, align: "center", color: "#000000", showId: true },
  image: { url: "", height: 48, align: "center" },
  divider: { color: "", thickness: 1, spacing: 6 },
  spacer: { height: 12, flexible: false },
};

export const newPassBlock = (type: PassBlockType, props: Record<string, any> = {}): PassBlock => ({
  id: uid(),
  type,
  props: { ...PASS_BLOCK_DEFAULTS[type], ...props },
});

const settings = (over: Partial<PassSettings> = {}): PassSettings => ({
  width: 340, height: 540, bg: "#ffffff", bgImage: "", textColor: "#253338",
  borderColor: "#217E79", borderWidth: 2, radius: 16, padding: 18,
  ...over,
});
const B = newPassBlock;

/** Starting points offered in the designer. */
export const PASS_PRESETS: { id: string; name: string; build: () => PassDesign }[] = [
  {
    id: "classic",
    name: "Classic",
    build: () => ({
      settings: settings(),
      blocks: [
        B("header"), B("spacer", { height: 10 }), B("badge"), B("spacer", { height: 6 }), B("value", { field: "name" }),
        B("value", { field: "organization", size: 12, bold: false }), B("value", { field: "phone", size: 12, bold: false }),
        B("spacer", { flexible: true }), B("divider"), B("qr"),
      ],
    }),
  },
  {
    id: "centered",
    name: "Centered",
    build: () => ({
      settings: settings({ borderWidth: 0, bg: "#FAF8F5" }),
      blocks: [
        B("header", { align: "center", useRibbon: true, padding: 20 }), B("spacer", { height: 16 }),
        B("value", { field: "name", align: "center", size: 24 }), B("spacer", { height: 6 }), B("badge", { align: "center" }),
        B("value", { field: "organization", align: "center", size: 12, bold: false }),
        B("spacer", { flexible: true }), B("qr", { size: 150 }),
      ],
    }),
  },
  {
    id: "dark",
    name: "Dark",
    build: () => ({
      settings: settings({ bg: "#0F172A", textColor: "#F8FAFC", borderColor: "#F59E0B" }),
      blocks: [
        B("text", { text: "{{eventName}}", size: 18, bold: true, color: "#F59E0B" }), B("text", { text: "{{eventDate}}", size: 11 }),
        B("divider", { color: "#334155", spacing: 10 }), B("value", { field: "name", size: 24 }), B("badge"),
        B("spacer", { flexible: true }), B("qr", { color: "#0F172A" }),
      ],
    }),
  },
  {
    id: "landscape",
    name: "Landscape",
    build: () => ({
      settings: settings({ width: 540, height: 340 }),
      blocks: [
        B("header", { padding: 12 }), B("spacer", { height: 8 }), B("value", { field: "name", size: 24 }), B("badge"),
        B("value", { field: "organization", size: 12, bold: false }), B("spacer", { flexible: true }), B("qr", { size: 96, align: "right", showId: false }),
      ],
    }),
  },
];

export const defaultPassDesign = (): PassDesign => PASS_PRESETS[0].build();

export type PassContext = {
  event: EventInfo;
  attendee: Record<string, any>;
  /** attendee category name → { badge, ribbon } colours from Setup */
  categoryColors: Record<string, { badge?: string; ribbon?: string }>;
};

const valueOf = (ctx: PassContext, key: string): string => {
  const v = key === "passId" ? ctx.attendee.passId || ctx.attendee.id : ctx.attendee[key];
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return typeof v[0] === "object" ? String(v.length) : v.join(", ");
  return typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
};
export const passValue = valueOf;

/** {{eventName}} / {{venue}} … and any attendee field such as {{name}} or {{category}}. */
export function fillPassTokens(text: string, ctx: PassContext): string {
  const e = ctx.event;
  const map: Record<string, string> = {
    eventName: e.eventName || "",
    eventDate: eventDateText(e),
    eventTime: eventTimeText(e),
    venue: e.venue || "",
    city: e.city || "",
    organizer: e.organizer || "",
  };
  return String(text || "")
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k in map ? map[k] : valueOf(ctx, k)))
    .replace(/\s*·\s*$/, "")
    .replace(/^\s*·\s*/, "");
}

/** Absolute URL for an uploaded image (the export runs in a blank frame). */
export const passAsset = (url?: string) => {
  const u = assetUrl(url);
  return u.startsWith("/") ? `${window.location.origin}${u}` : u;
};
