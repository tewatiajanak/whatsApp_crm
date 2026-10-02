import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  Image as ImageIcon, Type, Heading1, Minus, MoveVertical, CalendarDays, Receipt, PanelTop, CheckSquare,
  MousePointerClick, TextCursorInput, Trash2, Copy, GripVertical, LayoutTemplate, Save, Monitor, Smartphone, X, Upload,
} from "lucide-react";
import { http } from "../../api";
import FormRenderer from "./FormRenderer";
import TemplateGallery from "./TemplateGallery";
import { allTemplates, saveDesignAsTemplate } from "./templateStore";
import {
  type Block, type BlockType, type EventInfo, type FormDesign, type FormField, type FormTemplate,
  BLOCK_LABELS, PAGE_FOOTER_DEFAULT, PAGE_HEADER_DEFAULT, applyTemplate, assetUrl, newBlock, uid,
} from "./schema";

/**
 * Three-pane form designer: elements on the left, the form canvas in the
 * middle, properties of the selected element on the right. Elements are
 * dragged from the left (or clicked) onto the canvas and re-ordered by dragging.
 */
type Props = {
  design: FormDesign;
  fields: FormField[];
  event: EventInfo;
  onChange: (next: FormDesign) => void;
  onNotify?: (msg: string, type?: string) => void;
};

const PALETTE: { type: BlockType; icon: any }[] = [
  { type: "banner", icon: PanelTop },
  { type: "heading", icon: Heading1 },
  { type: "text", icon: Type },
  { type: "image", icon: ImageIcon },
  { type: "eventInfo", icon: CalendarDays },
  { type: "fees", icon: Receipt },
  { type: "divider", icon: Minus },
  { type: "spacer", icon: MoveVertical },
];

export const LABEL = "block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";

type Drag = { kind: "new"; make: () => Block } | { kind: "move"; id: string };

/* ── small property editors ─────────────────────────────────────────────── */

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  );
}
export function ColorField({ value, onChange, allowEmpty }: { value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  // the native picker only accepts #rrggbb
  const hex = /^#[0-9a-f]{6}$/i.test(value || "") ? value : /^#[0-9a-f]{3}$/i.test(value || "") ? "#" + value.slice(1).split("").map((c) => c + c).join("") : "#ffffff";
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        title="Pick a color"
        className="rounded-md border cursor-pointer shrink-0"
        style={{ width: 38, height: 30, padding: 2, background: "var(--card)" }}
      />
      <input className="ui-input flex-1 min-w-0" style={{ height: 30, fontSize: 12 }} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={allowEmpty ? "Auto" : "#hex code"} />
      {allowEmpty && (
        <button
          type="button"
          title="Use the form's own color"
          onClick={() => onChange("")}
          className="ui-btn ui-btn-outline ui-btn-sm shrink-0"
          style={!value ? { borderColor: "var(--primary)", color: "var(--primary)" } : undefined}
        >
          Auto
        </button>
      )}
    </div>
  );
}
export function Num({ value, onChange, min = 0, max = 999, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      type="number"
      className="ui-input w-full"
      style={{ height: 32 }}
      value={value ?? 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
    />
  );
}
export function Choice({ value, options, onChange }: { value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-md border overflow-hidden w-full">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className="flex-1 h-7 text-[11.5px] font-medium"
          style={value === o.v ? { background: "var(--primary)", color: "var(--primary-foreground)", border: 0 } : { background: "var(--card)", color: "var(--muted-foreground)", border: 0 }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
/** Upload an image (or paste a URL). The file is stored on the server. */
export function ImageField({ value, onChange, onError, video = false }: { value: string; onChange: (v: string) => void; onError?: (msg: string) => void; video?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    if (video) {
      if (!/^video\/(mp4|webm)$/.test(file.type)) return onError?.("Choose an MP4 or WEBM video.");
      if (file.size > 30 * 1024 * 1024) return onError?.("The video must be smaller than 30 MB.");
    } else {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return onError?.("Choose a PNG, JPG, WEBP or GIF image.");
      if (file.size > 5 * 1024 * 1024) return onError?.("The image must be smaller than 5 MB.");
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res: any = await http.postForm("/events/form-image", fd);
      onChange(res?.data?.url || "");
    } catch (e: any) {
      onError?.(e?.message || "Could not upload the file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <div className="space-y-1.5">
      {value && (
        <div className="rounded-md border overflow-hidden" style={{ background: "var(--muted-background)" }}>
          {video ? (
            <video src={assetUrl(value)} muted loop autoPlay playsInline style={{ width: "100%", height: 84, objectFit: "cover", display: "block" }} />
          ) : (
            <img src={assetUrl(value)} alt="" style={{ width: "100%", height: 84, objectFit: "cover", display: "block" }} />
          )}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button type="button" className="ui-btn ui-btn-outline ui-btn-sm flex-1" disabled={busy} onClick={() => inputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : value ? (video ? "Replace video" : "Replace image") : video ? "Upload video" : "Upload image"}
        </button>
        {value && (
          <button type="button" className="ui-btn ui-btn-danger ui-btn-sm ui-btn-icon" title="Remove" onClick={() => onChange("")}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={video ? "video/mp4,video/webm" : "image/png,image/jpeg,image/webp,image/gif"} style={{ display: "none" }} onChange={(e) => pick(e.target.files?.[0])} />
      <input className="ui-input w-full" style={{ height: 30, fontSize: 12 }} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={video ? "…or paste a video URL (MP4)" : "…or paste an image URL"} />
    </div>
  );
}

export const ALIGN = [{ v: "left", l: "Left" }, { v: "center", l: "Center" }, { v: "right", l: "Right" }];
const TOKENS = "Use {{eventName}}, {{eventDate}}, {{eventTime}}, {{venue}}, {{city}}, {{organizer}} to insert event details.";

export default function FormDesigner({ design, fields, event, onChange, onNotify }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [showTemplates, setShowTemplates] = useState(false);
  const [saveName, setSaveName] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);

  const blocks = design.blocks;
  const selected = blocks.find((b) => b.id === selectedId) || null;
  const usedFieldKeys = new Set(blocks.filter((b) => b.type === "field").map((b) => b.props.fieldKey));
  const hasSubmit = blocks.some((b) => b.type === "submit");
  const hasConsent = blocks.some((b) => b.type === "consent");
  const templates = useMemo(() => (showTemplates ? allTemplates() : []), [showTemplates]);

  const setBlocks = (next: Block[]) => onChange({ ...design, blocks: next });
  const setTheme = (patch: Partial<FormDesign["theme"]>) => onChange({ ...design, theme: { ...design.theme, ...patch } });
  const patchBlock = (id: string, patch: Record<string, any>) =>
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...patch } } : b)));

  const insertAt = (block: Block, index: number) => {
    const next = [...blocks];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
    setBlocks(next);
    setSelectedId(block.id);
  };
  // Click-to-add: above the consent/submit buttons, which belong at the bottom.
  const addAtEnd = (block: Block) => {
    const tail = blocks.findIndex((b) => b.type === "submit" || b.type === "consent");
    insertAt(block, tail >= 0 && block.type !== "submit" ? tail : blocks.length);
  };
  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const duplicateBlock = (b: Block) => insertAt({ ...b, id: uid(), props: { ...b.props } }, blocks.indexOf(b) + 1);

  const finishDrop = () => {
    const d = drag.current;
    const at = dropAt;
    drag.current = null;
    setDropAt(null);
    if (!d || at === null) return;
    if (d.kind === "new") return insertAt(d.make(), at);
    const from = blocks.findIndex((b) => b.id === d.id);
    if (from < 0) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(from < at ? at - 1 : at, 0, moved);
    setBlocks(next);
  };

  const paletteItem = (key: string, label: string, Icon: any, make: () => Block, disabled = false, hint = "") => (
    <div
      key={key}
      draggable={!disabled}
      onDragStart={(e) => {
        drag.current = { kind: "new", make };
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", key);
      }}
      onDragEnd={() => {
        drag.current = null;
        setDropAt(null);
      }}
      onClick={() => !disabled && addAtEnd(make())}
      title={disabled ? hint : "Drag onto the form, or click to add"}
      className={`flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-[12.5px] ${disabled ? "opacity-45 cursor-not-allowed" : "cursor-grab hover:bg-accent active:cursor-grabbing"}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground">{label}</span>
    </div>
  );

  const wrapBlock = (b: Block, index: number, node: ReactNode) => {
    const isSel = selectedId === b.id;
    return (
      <div
        draggable
        onDragStart={(e) => {
          drag.current = { kind: "move", id: b.id };
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", b.id);
        }}
        onDragEnd={() => {
          drag.current = null;
          setDropAt(null);
        }}
        onDragOver={(e) => {
          if (!drag.current) return;
          e.preventDefault();
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          const at = e.clientY < r.top + r.height / 2 ? index : index + 1;
          if (at !== dropAt) setDropAt(at);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          finishDrop();
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(b.id);
        }}
        style={{
          position: "relative",
          borderRadius: 8,
          cursor: "pointer",
          outline: isSel ? "2px solid var(--primary)" : "1px dashed transparent",
          outlineOffset: 4,
          boxShadow: dropAt === index ? "0 -3px 0 0 var(--primary)" : dropAt === index + 1 && index === blocks.length - 1 ? "0 3px 0 0 var(--primary)" : undefined,
        }}
        className="group/ef hover:[outline:1px_dashed_var(--border)]"
      >
        <div style={{ pointerEvents: "none" }}>
          {node ?? <div className="text-xs text-muted-foreground py-2">This field is no longer part of the form.</div>}
        </div>
        {isSel && (
          <div style={{ position: "absolute", top: -14, right: 6, display: "flex", alignItems: "center", gap: 2, background: "var(--primary)", borderRadius: 6, padding: "3px 4px", zIndex: 5, boxShadow: "0 2px 6px rgba(15,23,42,.25)" }}>
            <span title="Drag to move" style={{ color: "#fff", display: "inline-flex", alignItems: "center", padding: "0 3px", cursor: "grab" }}>
              <GripVertical className="h-3.5 w-3.5" />
            </span>
            {b.type !== "field" && b.type !== "submit" && (
              <button type="button" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateBlock(b); }} style={{ background: "transparent", border: 0, color: "#fff", padding: "2px 4px", display: "inline-flex" }}>
                <Copy className="h-3.5 w-3.5" />
              </button>
            )}
            {b.type !== "submit" && (
              <button type="button" title="Remove from form" onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }} style={{ background: "transparent", border: 0, color: "#fff", padding: "2px 4px", display: "inline-flex" }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const useTemplate = (t: FormTemplate) => {
    if (blocks.length && !window.confirm(`Replace the current design with "${t.name}"? Your fields stay; the layout and colors change.`)) return;
    onChange(applyTemplate(t, fields));
    setSelectedId(null);
    setShowTemplates(false);
  };

  const doSaveTemplate = () => {
    if (!saveName?.trim()) return;
    saveDesignAsTemplate(saveName, design);
    setSaveName(null);
    onNotify?.("Design saved as a template. It is now in Setup → Event Form Design.");
  };

  /* ── properties of the selected block ─────────────────────────────────── */
  const renderProps = (b: Block) => {
    const p = b.props;
    const set = (patch: Record<string, any>) => patchBlock(b.id, patch);
    const text = (key: string, label: string, area = false) => (
      <Row label={label}>
        {area ? (
          <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 10px" }} rows={3} value={p[key] || ""} onChange={(e) => set({ [key]: e.target.value })} />
        ) : (
          <input className="ui-input w-full" style={{ height: 32 }} value={p[key] || ""} onChange={(e) => set({ [key]: e.target.value })} />
        )}
      </Row>
    );
    switch (b.type) {
      case "banner":
        return (
          <>
            {text("title", "Title")}
            {text("subtitle", "Subtitle")}
            <p className="text-[10.5px] text-muted-foreground leading-snug -mt-1">{TOKENS}</p>
            <Row label="Alignment"><Choice value={p.align || "left"} options={ALIGN} onChange={(v) => set({ align: v })} /></Row>
            <Row label="Background"><ColorField value={p.bg} onChange={(v) => set({ bg: v })} allowEmpty /></Row>
            <Row label="Second color (gradient)"><ColorField value={p.bg2} onChange={(v) => set({ bg2: v })} allowEmpty /></Row>
            <Row label="Background image"><ImageField value={p.imageUrl} onChange={(v) => set({ imageUrl: v })} onError={(m) => onNotify?.(m, "error")} /></Row>
            <Row label="Padding"><Num value={p.padding} onChange={(v) => set({ padding: v })} max={80} /></Row>
          </>
        );
      case "heading":
        return (
          <>
            {text("text", "Text")}
            <Row label="Size"><Choice value={p.size || "lg"} options={[{ v: "sm", l: "S" }, { v: "md", l: "M" }, { v: "lg", l: "L" }, { v: "xl", l: "XL" }]} onChange={(v) => set({ size: v })} /></Row>
            <Row label="Alignment"><Choice value={p.align || "left"} options={ALIGN} onChange={(v) => set({ align: v })} /></Row>
            <Row label="Color"><ColorField value={p.color} onChange={(v) => set({ color: v })} allowEmpty /></Row>
          </>
        );
      case "text":
        return (
          <>
            {text("text", "Text", true)}
            <p className="text-[10.5px] text-muted-foreground leading-snug -mt-1">{TOKENS}</p>
            <Row label="Font size"><Num value={p.size || 14} onChange={(v) => set({ size: v })} min={10} max={28} /></Row>
            <Row label="Alignment"><Choice value={p.align || "left"} options={ALIGN} onChange={(v) => set({ align: v })} /></Row>
            <Row label="Color"><ColorField value={p.color} onChange={(v) => set({ color: v })} allowEmpty /></Row>
          </>
        );
      case "image":
        return (
          <>
            <Row label="Image"><ImageField value={p.url} onChange={(v) => set({ url: v })} onError={(m) => onNotify?.(m, "error")} /></Row>
            {text("alt", "Description (for screen readers)")}
            <Row label="Height"><Num value={p.height} onChange={(v) => set({ height: v })} min={40} max={600} /></Row>
            <Row label="Fit"><Choice value={p.fit || "cover"} options={[{ v: "cover", l: "Fill" }, { v: "contain", l: "Fit" }]} onChange={(v) => set({ fit: v })} /></Row>
            <Row label="Corner radius"><Num value={p.radius} onChange={(v) => set({ radius: v })} max={40} /></Row>
          </>
        );
      case "eventInfo":
        return (
          <>
            <Row label="Layout"><Choice value={p.layout || "row"} options={[{ v: "row", l: "In a row" }, { v: "stack", l: "Stacked" }]} onChange={(v) => set({ layout: v })} /></Row>
            {([["showDate", "Show date"], ["showTime", "Show time"], ["showVenue", "Show venue"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" checked={p[k] !== false} onChange={(e) => set({ [k]: e.target.checked })} /> {l}
              </label>
            ))}
          </>
        );
      case "fees":
        return (
          <>
            {text("title", "Title")}
          </>
        );
      case "divider":
        return (
          <>
            <Row label="Thickness"><Num value={p.thickness} onChange={(v) => set({ thickness: v })} min={1} max={8} /></Row>
            <Row label="Space above and below"><Num value={p.spacing} onChange={(v) => set({ spacing: v })} max={60} /></Row>
            <Row label="Color"><ColorField value={p.color} onChange={(v) => set({ color: v })} allowEmpty /></Row>
          </>
        );
      case "spacer":
        return <Row label="Height"><Num value={p.height} onChange={(v) => set({ height: v })} max={160} /></Row>;
      case "field": {
        const f = fields.find((x) => x.key === p.fieldKey);
        return (
          <>
            <div className="rounded-md border px-2.5 py-2 text-xs">
              <div className="font-semibold text-foreground">{f?.label || p.fieldKey}</div>
              <div className="text-muted-foreground mt-0.5">{f?.type}{f?.required ? " · required" : " · optional"}</div>
            </div>
            <Row label="Width"><Choice value={p.width || "full"} options={[{ v: "full", l: "Full row" }, { v: "half", l: "Half row" }]} onChange={(v) => set({ width: v })} /></Row>
            {text("placeholder", "Placeholder")}
            {text("helpText", "Help text under the field")}
          </>
        );
      }
      case "consent":
        return (
          <>
            {text("text", "Text", true)}
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input type="checkbox" checked={p.required !== false} onChange={(e) => set({ required: e.target.checked })} /> Must be ticked to register
            </label>
          </>
        );
      case "submit":
        return (
          <>
            {text("label", "Button text")}
            <Row label="Position"><Choice value={p.align || "stretch"} options={[{ v: "stretch", l: "Full" }, ...ALIGN]} onChange={(v) => set({ align: v })} /></Row>
          </>
        );
      default:
        return null;
    }
  };

  const th = design.theme;
  const pageHeader = { ...PAGE_HEADER_DEFAULT, ...(th.header || {}) };
  const pageFooter = { ...PAGE_FOOTER_DEFAULT, ...(th.footer || {}) };

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2" style={{ background: "var(--muted-background)" }}>
        <div className="flex items-center gap-2">
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setShowTemplates(true)}>
            <LayoutTemplate className="h-3.5 w-3.5" /> Choose template
          </button>
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setSaveName("")}>
            <Save className="h-3.5 w-3.5" /> Save as template
          </button>
        </div>
        <div className="inline-flex rounded-md border overflow-hidden">
          {([["desktop", Monitor], ["mobile", Smartphone]] as const).map(([v, Icon]) => (
            <button
              key={v}
              type="button"
              title={v === "desktop" ? "Desktop width" : "Mobile width"}
              onClick={() => setViewport(v)}
              className="h-7 w-9 inline-flex items-center justify-center"
              style={viewport === v ? { background: "var(--primary)", color: "var(--primary-foreground)", border: 0 } : { background: "var(--card)", color: "var(--muted-foreground)", border: 0 }}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[210px_minmax(0,1fr)_270px]" style={{ minHeight: 560 }}>
        {/* Elements */}
        <div className="border-b lg:border-b-0 lg:border-r p-3 space-y-3 overflow-y-auto" style={{ maxHeight: 720 }}>
          <div>
            <div className={LABEL}>Elements</div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              {PALETTE.map((it) => paletteItem(it.type, BLOCK_LABELS[it.type], it.icon, () => newBlock(it.type)))}
            </div>
          </div>
          <div>
            <div className={LABEL}>Form fields</div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              {fields.map((f) =>
                paletteItem(`f-${f.key}`, f.label, TextCursorInput, () => newBlock("field", { fieldKey: f.key }), usedFieldKeys.has(f.key), "Already on the form")
              )}
            </div>
          </div>
          <div>
            <div className={LABEL}>Actions</div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              {paletteItem("consent", BLOCK_LABELS.consent, CheckSquare, () => newBlock("consent"), hasConsent, "Already on the form")}
              {paletteItem("submit", BLOCK_LABELS.submit, MousePointerClick, () => newBlock("submit"), hasSubmit, "A form has one submit button")}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="overflow-auto"
          style={{ background: "var(--muted-background)", maxHeight: 720 }}
          onClick={() => setSelectedId(null)}
          onDragOver={(e) => {
            if (!drag.current) return;
            e.preventDefault();
            if (dropAt === null) setDropAt(blocks.length);
          }}
          onDrop={(e) => {
            e.preventDefault();
            finishDrop();
          }}
        >
          <div className={viewport === "mobile" ? "ef-narrow" : ""} style={{ maxWidth: viewport === "mobile" ? 400 : undefined, margin: "0 auto" }}>
            <FormRenderer
              design={design}
              fields={fields}
              event={event}
              mode="design"
              wrapBlock={wrapBlock}
              tail={
                blocks.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-10 text-center text-xs text-muted-foreground">
                    Drag elements here, or choose a template to start.
                  </div>
                ) : undefined
              }
            />
          </div>
        </div>

        {/* Properties */}
        <div className="border-t lg:border-t-0 lg:border-l p-3 space-y-3 overflow-y-auto" style={{ maxHeight: 720 }}>
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">{BLOCK_LABELS[selected.type]}</div>
                <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Back to form settings" onClick={() => setSelectedId(null)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {renderProps(selected)}
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-foreground">Page</div>
              <Row label="Layout">
                <Choice
                  value={th.layout || "card"}
                  options={[{ v: "card", l: "Form on page" }, { v: "split", l: "Picture + form" }]}
                  onChange={(v) => setTheme({ layout: v as any })}
                />
              </Row>
              <Row label="Background image"><ImageField value={th.bgImage || ""} onChange={(v) => setTheme({ bgImage: v })} onError={(m) => onNotify?.(m, "error")} /></Row>
              <Row label="Background video"><ImageField video value={th.bgVideo || ""} onChange={(v) => setTheme({ bgVideo: v })} onError={(m) => onNotify?.(m, "error")} /></Row>
              <p className="text-[10.5px] text-muted-foreground leading-snug -mt-1">The video plays muted on a loop. MP4 / WEBM, up to 30 MB.</p>
              {(th.bgImage || th.bgVideo) && <Row label="Darken background (%)"><Num value={th.overlay ?? 30} onChange={(v) => setTheme({ overlay: v })} max={90} step={5} /></Row>}
              {th.layout === "split" && (
                <>
                  <Row label="Title over the picture">
                    <input className="ui-input w-full" style={{ height: 32 }} value={th.heroTitle ?? "{{eventName}}"} onChange={(e) => setTheme({ heroTitle: e.target.value })} />
                  </Row>
                  <Row label="Text over the picture">
                    <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 10px" }} rows={2} value={th.heroText ?? ""} onChange={(e) => setTheme({ heroText: e.target.value })} />
                  </Row>
                </>
              )}

              <label className="text-xs font-semibold text-foreground" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                <input type="checkbox" checked={pageHeader.show} onChange={(e) => setTheme({ header: { ...pageHeader, show: e.target.checked } })} />
                <span>Header bar</span>
              </label>
              {pageHeader.show && (
                <>
                  <Row label="Logo"><ImageField value={pageHeader.logo} onChange={(v) => setTheme({ header: { ...pageHeader, logo: v } })} onError={(m) => onNotify?.(m, "error")} /></Row>
                  <Row label="Header text">
                    <input className="ui-input w-full" style={{ height: 32 }} value={pageHeader.title} onChange={(e) => setTheme({ header: { ...pageHeader, title: e.target.value } })} />
                  </Row>
                  <Row label="Header background"><ColorField value={pageHeader.bg} onChange={(v) => setTheme({ header: { ...pageHeader, bg: v || "#ffffff" } })} /></Row>
                  <Row label="Header text color"><ColorField value={pageHeader.color} onChange={(v) => setTheme({ header: { ...pageHeader, color: v || "#253338" } })} /></Row>
                </>
              )}

              <label className="text-xs font-semibold text-foreground" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                <input type="checkbox" checked={pageFooter.show} onChange={(e) => setTheme({ footer: { ...pageFooter, show: e.target.checked } })} />
                <span>Footer</span>
              </label>
              {pageFooter.show && (
                <>
                  <Row label="Footer text">
                    <input className="ui-input w-full" style={{ height: 32 }} value={pageFooter.text} onChange={(e) => setTheme({ footer: { ...pageFooter, text: e.target.value } })} />
                  </Row>
                  <Row label="Footer background"><ColorField value={pageFooter.bg} onChange={(v) => setTheme({ footer: { ...pageFooter, bg: v || "#253338" } })} /></Row>
                  <Row label="Footer text color"><ColorField value={pageFooter.color} onChange={(v) => setTheme({ footer: { ...pageFooter, color: v || "#ffffff" } })} /></Row>
                </>
              )}

              <div className="text-sm font-semibold text-foreground pt-2 border-t">Form settings</div>
              <Row label="Accent / button color"><ColorField value={th.primary} onChange={(v) => setTheme({ primary: v || "#217E79" })} /></Row>
              <Row label="Page background"><ColorField value={th.pageBg} onChange={(v) => setTheme({ pageBg: v || "#FAF8F5" })} /></Row>
              <Row label="Form background"><ColorField value={th.cardBg} onChange={(v) => setTheme({ cardBg: v || "#ffffff" })} /></Row>
              <Row label="Text color"><ColorField value={th.text} onChange={(v) => setTheme({ text: v || "#253338" })} /></Row>
              <Row label="Input style">
                <Choice value={th.inputStyle} options={[{ v: "outline", l: "Outline" }, { v: "filled", l: "Filled" }, { v: "underline", l: "Line" }]} onChange={(v) => setTheme({ inputStyle: v as any })} />
              </Row>
              <div className="grid grid-cols-2 gap-2">
                <Row label="Corner radius"><Num value={th.radius} onChange={(v) => setTheme({ radius: v })} max={28} /></Row>
                <Row label="Font size"><Num value={th.fontSize} onChange={(v) => setTheme({ fontSize: v })} min={11} max={20} /></Row>
              </div>
              <Row label="Form width"><Num value={th.width} onChange={(v) => setTheme({ width: v })} min={360} max={1100} step={20} /></Row>
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" checked={th.cardBorder} onChange={(e) => setTheme({ cardBorder: e.target.checked })} /> Border around the form
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground">
                <input type="checkbox" checked={th.cardShadow} onChange={(e) => setTheme({ cardShadow: e.target.checked })} /> Shadow under the form
              </label>
            </>
          )}
        </div>
      </div>

      {/* Template picker */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,.45)" }} onClick={() => setShowTemplates(false)}>
          <div className="w-full rounded-xl border bg-card shadow-lg flex flex-col" style={{ maxWidth: 1180, maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Choose a template</div>
              </div>
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" onClick={() => setShowTemplates(false)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <TemplateGallery templates={templates} onSelect={useTemplate} event={event} fields={fields} />
            </div>
          </div>
        </div>
      )}

      {/* Save as template */}
      {saveName !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,.45)" }} onClick={() => setSaveName(null)}>
          <div className="w-full rounded-xl border bg-card shadow-lg p-4" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-foreground">Save as template</div>
            <label className={LABEL}>Template name</label>
            <input autoFocus className="ui-input w-full" value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSaveTemplate()} placeholder="e.g. Our conference look" maxLength={50} />
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="ui-btn ui-btn-outline" onClick={() => setSaveName(null)}>Cancel</button>
              <button type="button" className="ui-btn ui-btn-primary" onClick={doSaveTemplate} disabled={!saveName.trim()}>Save template</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
