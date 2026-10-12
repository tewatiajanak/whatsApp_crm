/* WhatsApp templates of Project Management.
   A PM template is written with named keys ({{task.title}}); the WhatsApp
   provider (Meta) wants numbered variables ({{1}}) with an example each.
   This file turns one into the other, both when the template is submitted
   for approval and when a message is sent. */

export const WA_META_CATEGORIES = ["UTILITY", "MARKETING", "AUTHENTICATION"] as const;
export const WA_HEADER_TYPES = ["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT"] as const;
export const WA_BUTTON_TYPES = ["QUICK_REPLY", "URL", "PHONE_NUMBER"] as const;
export const WA_LIMITS = { body: 1024, header: 60, footer: 60, button: 25, buttons: 3 };

const KEY = /\{\{\s*([a-zA-Z]+\.?[a-zA-Z]*)\s*\}\}/g;
const keysOf = (text: string) => [...String(text || "").matchAll(KEY)].map((m) => m[1]);
/** {{task.title}} … {{client.name}} → {{1}} … {{2}} */
const numbered = (text: string) => {
  let n = 0;
  return String(text || "").replace(KEY, () => `{{${++n}}}`);
};
const filled = (v: any) => String(v ?? "").trim() || "-"; // the provider refuses an empty value
const isMedia = (t: string) => t === "IMAGE" || t === "VIDEO" || t === "DOCUMENT";

/** The name the provider knows the template by: lowercase letters, digits and "_". */
export const metaName = (name: string) => String(name || "").toLowerCase().trim().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 512);

/** Clean what the form sends. */
export function cleanWa(input: any, existing: any = {}) {
  const src = input && typeof input === "object" ? input : {};
  const pick = (k: string, fallback: any) => (src[k] !== undefined ? src[k] : existing?.[k] ?? fallback);
  const headerType = (WA_HEADER_TYPES as readonly string[]).includes(pick("headerType", "NONE")) ? pick("headerType", "NONE") : "NONE";
  const buttons = (Array.isArray(pick("buttons", [])) ? pick("buttons", []) : [])
    .map((b: any) => {
      const type = (WA_BUTTON_TYPES as readonly string[]).includes(b?.type) ? b.type : "QUICK_REPLY";
      const text = String(b?.text || "").trim().slice(0, WA_LIMITS.button);
      if (type === "URL") return { type, text, url: String(b?.url || "").trim() };
      if (type === "PHONE_NUMBER") return { type, text, phoneNumber: String(b?.phoneNumber || "").replace(/[^\d+]/g, "") };
      return { type, text };
    })
    .filter((b: any) => b.text)
    .slice(0, WA_LIMITS.buttons);
  return {
    metaCategory: (WA_META_CATEGORIES as readonly string[]).includes(String(pick("metaCategory", "UTILITY")).toUpperCase()) ? String(pick("metaCategory", "UTILITY")).toUpperCase() : "UTILITY",
    headerType,
    headerText: headerType === "TEXT" ? String(pick("headerText", "")).trim().slice(0, WA_LIMITS.header) : "",
    headerMedia: isMedia(headerType) ? String(pick("headerMedia", "")).trim() : "",
    footer: String(pick("footer", "")).trim().slice(0, WA_LIMITS.footer),
    buttons,
    // set by the server only
    metaId: existing?.metaId || "",
    metaStatus: existing?.metaStatus || "",
    rejectionReason: existing?.rejectionReason || "",
  };
}

/** The part of a template the provider approves. When it changes, the approval no longer covers it. */
export const approvedPart = (tpl: any) =>
  JSON.stringify([tpl?.body || "", tpl?.wa?.headerType || "NONE", tpl?.wa?.headerText || "", tpl?.wa?.footer || "", tpl?.wa?.buttons || [], tpl?.wa?.metaCategory || "UTILITY"]);

/** What is wrong with a template before it is submitted ("" = nothing). */
export function waProblem(tpl: any): string {
  const wa = tpl?.wa || {};
  const body = String(tpl?.body || "").trim();
  if (!body) return "Enter the message";
  if (body.length > WA_LIMITS.body) return `The message can be at most ${WA_LIMITS.body} characters`;
  if (/^\s*\{\{[^}]+\}\}/.test(body) || /\{\{[^}]+\}\}\s*$/.test(body)) return "The message cannot start or end with a key";
  if (wa.headerType === "TEXT") {
    if (!wa.headerText) return "Enter the header text";
    if (keysOf(wa.headerText).length > 1) return "The header can hold one key only";
  }
  if (isMedia(wa.headerType) && !wa.headerMedia) return "Add the header media";
  if (keysOf(wa.footer).length) return "The footer cannot hold keys";
  for (const b of wa.buttons || []) {
    if (b.type === "URL") {
      if (!/^https?:\/\//i.test(b.url || "")) return `Button "${b.text}": enter a link that starts with https://`;
      const keys = keysOf(b.url);
      if (keys.length > 1 || (keys.length === 1 && !/\{\{[^}]+\}\}\s*$/.test(b.url))) return `Button "${b.text}": one key is allowed, at the end of the link`;
    }
    if (b.type === "PHONE_NUMBER" && String(b.phoneNumber || "").replace(/\D/g, "").length < 10) return `Button "${b.text}": enter the number with country code`;
  }
  return "";
}

/** The components to submit for approval. `samples` are example values of the keys. */
export function metaComponents(tpl: any, samples: Record<string, string>) {
  const wa = tpl?.wa || {};
  const example = (text: string) => keysOf(text).map((k) => filled(samples[k]));
  const out: any[] = [];
  if (wa.headerType === "TEXT" && wa.headerText) {
    const ex = example(wa.headerText);
    out.push({ type: "HEADER", format: "TEXT", text: numbered(wa.headerText), ...(ex.length ? { example: { header_text: ex } } : {}) });
  } else if (isMedia(wa.headerType)) {
    out.push({ type: "HEADER", format: wa.headerType, example: { header_handle: wa.headerMedia ? [wa.headerMedia] : [] } });
  }
  const ex = example(tpl.body);
  out.push({ type: "BODY", text: numbered(tpl.body), ...(ex.length ? { example: { body_text: [ex] } } : {}) });
  if (wa.footer) out.push({ type: "FOOTER", text: wa.footer });
  if (wa.buttons?.length) {
    out.push({
      type: "BUTTONS",
      buttons: wa.buttons.map((b: any) => {
        if (b.type === "URL") {
          const keys = keysOf(b.url);
          return { type: "URL", text: b.text, url: numbered(b.url), ...(keys.length ? { example: [String(b.url).replace(KEY, (_w: string, k: string) => filled(samples[k]))] } : {}) };
        }
        if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phoneNumber };
        return { type: "QUICK_REPLY", text: b.text };
      }),
    });
  }
  return out;
}

/** Is the message sent as the approved template (true) or as plain text (false)? */
export const sendsAsTemplate = (tpl: any) => !!tpl?.waTemplateName && (!tpl?.wa?.metaId || tpl?.wa?.metaStatus === "Approved");

/**
 * The values of one message, in the shape the provider wants.
 * Empty when the template has only message keys: the plain list (waParams) is enough then.
 */
export function sendComponents(tpl: any, values: Record<string, string>) {
  const wa = tpl?.wa || {};
  const params = (text: string) => keysOf(text).map((k) => ({ type: "text", text: filled(values[k]) }));
  const out: any[] = [];
  if (wa.headerType === "TEXT" && keysOf(wa.headerText).length) out.push({ type: "header", parameters: params(wa.headerText) });
  if (isMedia(wa.headerType) && wa.headerMedia) {
    const kind = String(wa.headerType).toLowerCase();
    out.push({ type: "header", parameters: [{ type: kind, [kind]: /^\d+$/.test(wa.headerMedia) ? { id: wa.headerMedia } : { link: wa.headerMedia } }] });
  }
  (wa.buttons || []).forEach((b: any, i: number) => {
    if (b.type === "URL" && keysOf(b.url).length) out.push({ type: "button", sub_type: "url", index: String(i), parameters: params(b.url) });
  });
  if (!out.length) return [];
  const body = params(tpl.body);
  if (body.length) out.push({ type: "body", parameters: body });
  return out;
}
