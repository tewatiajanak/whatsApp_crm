import { useRef, useState, type ReactNode, type RefObject } from "react";
import { ExternalLink, FileText, Image as ImageIcon, Phone, Plus, Reply, Trash2, Upload, Video } from "lucide-react";
import { pmApi } from "../../api";
import { UIButton } from "../components/UIKit";
import { LABEL, Pill } from "../user-management/shared";

export type WaButton = { type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER"; text: string; url?: string; phoneNumber?: string };
export type Wa = {
  metaCategory: string; headerType: string; headerText: string; headerMedia: string; footer: string; buttons: WaButton[];
  metaId?: string; metaStatus?: string; rejectionReason?: string;
};
export const EMPTY_WA: Wa = { metaCategory: "UTILITY", headerType: "NONE", headerText: "", headerMedia: "", footer: "", buttons: [] };
export const LIMITS = { body: 1024, header: 60, footer: 60, button: 25, buttons: 3 };
/** the name WhatsApp knows a template by: lowercase letters, digits and "_" */
export const metaName = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");

const META_CATEGORIES = [["UTILITY", "Utility"], ["MARKETING", "Marketing"], ["AUTHENTICATION", "Authentication"]];
const LANGUAGES = [["en", "English"], ["en_US", "English (US)"], ["hi", "Hindi"], ["es", "Spanish"], ["fr", "French"]];
const HEADERS = [["NONE", "None"], ["TEXT", "Text"], ["IMAGE", "Image"], ["VIDEO", "Video"], ["DOCUMENT", "Document (PDF)"]];
const MEDIA: Record<string, { accept: string; maxMb: number }> = {
  IMAGE: { accept: "image/jpeg,image/png", maxMb: 5 },
  VIDEO: { accept: "video/mp4", maxMb: 16 },
  DOCUMENT: { accept: "application/pdf", maxMb: 100 },
};
const BUTTON_KINDS: [WaButton["type"], string, typeof Reply][] = [["QUICK_REPLY", "Quick reply", Reply], ["URL", "Link", ExternalLink], ["PHONE_NUMBER", "Call", Phone]];
const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted"> = { Approved: "success", Pending: "warning", Rejected: "danger" };

/** Approval of a WhatsApp template at the provider. */
export function WaStatus({ wa, name }: { wa?: Wa; name?: string }) {
  const status = wa?.metaStatus || "";
  if (!wa?.metaId) return <Pill tone="muted">{name ? "Linked" : "Not submitted"}</Pill>;
  return <Pill tone={STATUS_TONE[status] || "muted"}>{status || "Changed"}</Pill>;
}

/** *bold* and _italic_ as WhatsApp shows them */
const marked = (text: string): ReactNode[] =>
  text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((part, i) =>
    /^\*[^*]+\*$/.test(part) ? <b key={i}>{part.slice(1, -1)}</b> : /^_[^_]+_$/.test(part) ? <i key={i}>{part.slice(1, -1)}</i> : <span key={i}>{part}</span>
  );

/**
 * The WhatsApp part of the template form: name at the provider, type, language,
 * header, message, footer, buttons and a live preview.
 */
export default function WaTemplateFields({
  name, body, waTemplateName, waLanguage, wa, set, samples, keyMenu, bodyRef, headerRef, onFocus, onError,
}: {
  name: string;
  body: string;
  waTemplateName: string;
  waLanguage: string;
  wa: Wa;
  set: (patch: { body?: string; waTemplateName?: string; waLanguage?: string; wa?: Wa }) => void;
  samples: Record<string, string>;
  keyMenu: ReactNode;
  bodyRef: RefObject<HTMLTextAreaElement>;
  headerRef: RefObject<HTMLInputElement>;
  onFocus: (field: "body" | "header") => void;
  onError: (message: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState("");
  const locked = !!wa.metaId; // the provider does not let the name or language change after submitting
  const setWa = (patch: Partial<Wa>) => set({ wa: { ...wa, ...patch } });
  const setButton = (i: number, patch: Partial<WaButton>) => setWa({ buttons: wa.buttons.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const media = MEDIA[wa.headerType];
  const fill = (text: string) => text.replace(/\{\{\s*([a-zA-Z]+\.?[a-zA-Z]*)\s*\}\}/g, (whole, k) => samples[k] ?? whole);

  const uploadMedia = async (f?: File | null) => {
    if (!f || !media) return;
    if (f.size > media.maxMb * 1024 * 1024) return onError(`The file can be at most ${media.maxMb} MB`);
    setUploading(true);
    try {
      const res: any = await pmApi.uploadWaMedia(f);
      setWa({ headerMedia: res.data.id });
      setUploaded(f.name);
    } catch (e: any) {
      onError(e?.message || "Could not upload");
    } finally {
      setUploading(false);
    }
  };

  const HeaderIcon = wa.headerType === "IMAGE" ? ImageIcon : wa.headerType === "VIDEO" ? Video : FileText;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <div className="flex items-end justify-between gap-2">
            <label className={LABEL}>WhatsApp template name</label>
            <span className="mb-1"><WaStatus wa={wa} name={waTemplateName} /></span>
          </div>
          <input className="ui-input w-full font-mono" value={waTemplateName} disabled={locked} maxLength={120} onChange={(e) => set({ waTemplateName: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder={metaName(name)} />
        </div>
        <div>
          <label className={LABEL}>Type</label>
          <select className="ui-input w-full" value={wa.metaCategory} onChange={(e) => setWa({ metaCategory: e.target.value })}>
            {META_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL}>Language</label>
          <select className="ui-input w-full" value={waLanguage} disabled={locked} onChange={(e) => set({ waLanguage: e.target.value })}>
            {LANGUAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            {!LANGUAGES.some(([v]) => v === waLanguage) && <option value={waLanguage}>{waLanguage}</option>}
          </select>
        </div>
      </div>

      {wa.metaStatus === "Rejected" && wa.rejectionReason && (
        <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "var(--destructive-bg)", color: "var(--destructive)" }}>{wa.rejectionReason}</div>
      )}

      {/* header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={LABEL}>Header</label>
          <select className="ui-input w-full" value={wa.headerType} onChange={(e) => { setUploaded(""); setWa({ headerType: e.target.value, headerText: "", headerMedia: "" }); }}>
            {HEADERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {wa.headerType === "TEXT" && (
          <div className="sm:col-span-2">
            <label className={LABEL}>Header text * <span className="normal-case tracking-normal font-normal">{wa.headerText.length}/{LIMITS.header}</span></label>
            <input ref={headerRef} className="ui-input w-full" value={wa.headerText} maxLength={LIMITS.header} onFocus={() => onFocus("header")} onChange={(e) => setWa({ headerText: e.target.value })} />
          </div>
        )}
        {media && (
          <div className="sm:col-span-2">
            <label className={LABEL}>Header media * <span className="normal-case tracking-normal font-normal">max {media.maxMb} MB</span></label>
            <div className="flex items-center gap-2">
              <input className="ui-input flex-1 min-w-0" value={wa.headerMedia} onChange={(e) => { setUploaded(""); setWa({ headerMedia: e.target.value.trim() }); }} placeholder="https://" title={uploaded || undefined} />
              <UIButton size="sm" variant="outline" loading={uploading} onClick={() => file.current?.click()} leftIcon={<Upload className="h-3.5 w-3.5" />}>Upload</UIButton>
              <input ref={file} type="file" accept={media.accept} hidden onChange={(e) => { uploadMedia(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </div>
        )}
      </div>

      {/* message */}
      <div>
        <div className="flex items-end justify-between gap-2">
          <label className={LABEL}>Message * <span className="normal-case tracking-normal font-normal" style={body.length > LIMITS.body ? { color: "var(--destructive)" } : undefined}>{body.length}/{LIMITS.body}</span></label>
          {keyMenu}
        </div>
        <textarea ref={bodyRef} className="ui-input w-full" rows={6} value={body} onFocus={() => onFocus("body")} onChange={(e) => set({ body: e.target.value })} style={{ height: "auto" }} />
      </div>

      <div>
        <label className={LABEL}>Footer <span className="normal-case tracking-normal font-normal">{wa.footer.length}/{LIMITS.footer}</span></label>
        <input className="ui-input w-full" value={wa.footer} maxLength={LIMITS.footer} onChange={(e) => setWa({ footer: e.target.value })} />
      </div>

      {/* buttons */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <label className={LABEL} style={{ marginBottom: 0 }}>Buttons <span className="normal-case tracking-normal font-normal">{wa.buttons.length}/{LIMITS.buttons}</span></label>
          <div className="flex flex-wrap gap-1.5">
            {BUTTON_KINDS.map(([type, label, Icon]) => (
              <button key={type} type="button" disabled={wa.buttons.length >= LIMITS.buttons} onClick={() => setWa({ buttons: [...wa.buttons, { type, text: "", ...(type === "URL" ? { url: "" } : type === "PHONE_NUMBER" ? { phoneNumber: "" } : {}) }] })} className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[11.5px] font-medium disabled:opacity-50" style={{ color: "var(--foreground)" }}>
                <Plus className="h-3 w-3" /><Icon className="h-3 w-3" />{label}
              </button>
            ))}
          </div>
        </div>
        {wa.buttons.length > 0 && (
          <div className="rounded-lg border divide-y">
            {wa.buttons.map((b, i) => {
              const Icon = BUTTON_KINDS.find((k) => k[0] === b.type)?.[2] || Reply;
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 p-2">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground" style={{ background: "var(--muted-background)" }} title={BUTTON_KINDS.find((k) => k[0] === b.type)?.[1]}><Icon className="h-3.5 w-3.5" /></span>
                  <input className="ui-input" style={{ width: 150 }} value={b.text} maxLength={LIMITS.button} aria-label="Button label" placeholder="Label" onChange={(e) => setButton(i, { text: e.target.value })} />
                  {b.type === "URL" && <input className="ui-input flex-1" style={{ minWidth: 140 }} value={b.url || ""} aria-label="Link" placeholder="https://" onChange={(e) => setButton(i, { url: e.target.value })} />}
                  {b.type === "PHONE_NUMBER" && <input type="tel" className="ui-input flex-1" style={{ minWidth: 140 }} value={b.phoneNumber || ""} aria-label="Phone number" placeholder="919876543210" onChange={(e) => setButton(i, { phoneNumber: e.target.value.replace(/[^\d+]/g, "") })} />}
                  <span className={b.type === "QUICK_REPLY" ? "ml-auto" : ""}><UIButton size="icon-sm" variant="danger" title="Remove" onClick={() => setWa({ buttons: wa.buttons.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></UIButton></span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* preview, filled with sample values */}
      <div>
        <label className={LABEL}>Preview</label>
        <div className="pm-wa-preview">
          <div className="pm-wa-bubble">
            {wa.headerType === "TEXT" && wa.headerText && <div className="font-semibold mb-1">{fill(wa.headerText)}</div>}
            {media && (
              /^https?:\/\//i.test(wa.headerMedia) && wa.headerType === "IMAGE"
                ? <img src={wa.headerMedia} alt="" className="mb-1.5 w-full rounded-md" style={{ maxHeight: 160, objectFit: "cover" }} />
                : <div className="pm-wa-media"><HeaderIcon className="h-6 w-6" />{uploaded && <span className="truncate text-[11px]">{uploaded}</span>}</div>
            )}
            <div className="whitespace-pre-wrap break-words">{body.trim() ? marked(fill(body)) : <span style={{ opacity: 0.5 }}>Message</span>}</div>
            {wa.footer && <div className="mt-1 text-[11px]" style={{ opacity: 0.6 }}>{wa.footer}</div>}
          </div>
          {wa.buttons.filter((b) => b.text).map((b, i) => {
            const Icon = BUTTON_KINDS.find((k) => k[0] === b.type)?.[2] || Reply;
            return <div key={i} className="pm-wa-button"><Icon className="h-3.5 w-3.5" />{b.text}</div>;
          })}
        </div>
      </div>
    </>
  );
}
