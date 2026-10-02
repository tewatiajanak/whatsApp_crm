import { useEffect, useRef, useState, type ReactNode } from "react";
import { PanelTop, Type, UserRound, BadgeCheck, QrCode, Image as ImageIcon, Minus, MoveVertical, Trash2, Copy, GripVertical, X, LayoutTemplate } from "lucide-react";
import { ALIGN, Choice, ColorField, ImageField, LABEL, Num, Row } from "../event-form/FormDesigner";
import { uid } from "../event-form/schema";
import PassRenderer from "./PassRenderer";
import { buildQrUrls } from "./exportPass";
import {
  type PassBlock, type PassBlockType, type PassContext, type PassDesign, type PassField,
  PASS_BLOCK_LABELS, PASS_PRESETS, PASS_SIZES, newPassBlock, passValue,
} from "./schema";

/**
 * Pass designer: elements on the left, the pass in the middle, properties of
 * the selected element (or of the pass itself) on the right. Elements are
 * dragged onto the pass and re-ordered by dragging, top to bottom.
 */
type Props = {
  design: PassDesign;
  onChange: (next: PassDesign) => void;
  ctx: PassContext;
  fields: PassField[];
  onNotify?: (msg: string, type?: string) => void;
  /** shown at the right of the toolbar (attendee switcher, download) */
  toolbar?: ReactNode;
};

const PALETTE: { type: PassBlockType; icon: any }[] = [
  { type: "header", icon: PanelTop },
  { type: "value", icon: UserRound },
  { type: "badge", icon: BadgeCheck },
  { type: "qr", icon: QrCode },
  { type: "text", icon: Type },
  { type: "image", icon: ImageIcon },
  { type: "divider", icon: Minus },
  { type: "spacer", icon: MoveVertical },
];
const TOKENS = "Use {{eventName}}, {{eventDate}}, {{eventTime}}, {{venue}}, {{city}}, {{organizer}}, or an attendee value such as {{name}} or {{category}}.";

type Drag = { kind: "new"; make: () => PassBlock } | { kind: "move"; id: string };

export default function PassDesigner({ design, onChange, ctx, fields, onNotify, toolbar }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const drag = useRef<Drag | null>(null);

  const { blocks, settings } = design;
  const selected = blocks.find((b) => b.id === selectedId) || null;
  const passId = passValue(ctx, "passId");

  // QR images depend on the pass ID and on each QR block's colour and size
  const qrKey = blocks.filter((b) => b.type === "qr").map((b) => `${b.id}:${b.props.color}:${b.props.size}`).join("|");
  useEffect(() => {
    let alive = true;
    buildQrUrls(design, passId).then((urls) => alive && setQrUrls(urls)).catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrKey, passId]);

  const setBlocks = (next: PassBlock[]) => onChange({ ...design, blocks: next });
  const setSettings = (patch: Partial<PassDesign["settings"]>) => onChange({ ...design, settings: { ...settings, ...patch } });
  const patchBlock = (id: string, patch: Record<string, any>) => setBlocks(blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...patch } } : b)));

  const insertAt = (block: PassBlock, index: number) => {
    const next = [...blocks];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
    setBlocks(next);
    setSelectedId(block.id);
  };
  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

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

  const paletteItem = (key: string, label: string, Icon: any, make: () => PassBlock) => (
    <div
      key={key}
      draggable
      onDragStart={(e) => {
        drag.current = { kind: "new", make };
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", key);
      }}
      onDragEnd={() => {
        drag.current = null;
        setDropAt(null);
      }}
      onClick={() => insertAt(make(), blocks.length)}
      title="Drag onto the pass, or click to add at the bottom"
      className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-[12.5px] cursor-grab hover:bg-accent active:cursor-grabbing"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate text-foreground">{label}</span>
    </div>
  );

  const wrapBlock = (b: PassBlock, index: number, node: ReactNode) => {
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
          height: b.type === "spacer" && b.props.flexible ? "100%" : undefined,
          minHeight: b.type === "spacer" ? 8 : undefined,
          cursor: "pointer",
          outline: isSel ? "2px solid #2563EB" : "1px dashed transparent",
          outlineOffset: 1,
          boxShadow: dropAt === index ? "0 -3px 0 0 #2563EB" : dropAt === index + 1 && index === blocks.length - 1 ? "0 3px 0 0 #2563EB" : undefined,
          background: b.type === "spacer" && isSel ? "rgba(37,99,235,.12)" : undefined,
        }}
      >
        <div style={{ pointerEvents: "none", height: b.type === "spacer" && b.props.flexible ? "100%" : undefined }}>{node}</div>
      </div>
    );
  };

  /* ── properties ───────────────────────────────────────────────────────── */
  const renderProps = (b: PassBlock) => {
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
    const align = <Row label="Alignment"><Choice value={p.align || "left"} options={ALIGN} onChange={(v) => set({ align: v })} /></Row>;
    const tick = (key: string, label: string, fallback = false) => (
      <label className="text-xs text-foreground" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
        <input type="checkbox" checked={p[key] ?? fallback} onChange={(e) => set({ [key]: e.target.checked })} />
        <span>{label}</span>
      </label>
    );
    switch (b.type) {
      case "header":
        return (
          <>
            {text("title", "Title")}
            {text("subtitle", "Subtitle")}
            <p className="text-[10.5px] text-muted-foreground leading-snug -mt-1">{TOKENS}</p>
            <div className="grid grid-cols-2 gap-2">
              <Row label="Title size"><Num value={p.titleSize} onChange={(v) => set({ titleSize: v })} min={8} max={60} /></Row>
              <Row label="Subtitle size"><Num value={p.subtitleSize} onChange={(v) => set({ subtitleSize: v })} min={6} max={40} /></Row>
            </div>
            <Row label="Header height (padding)"><Num value={p.padding} onChange={(v) => set({ padding: v })} max={80} /></Row>
            {align}
            <Row label="Background"><ColorField value={p.bg} onChange={(v) => set({ bg: v })} /></Row>
            {tick("useRibbon", "Use the attendee category's ribbon color")}
            <Row label="Text color"><ColorField value={p.color} onChange={(v) => set({ color: v })} /></Row>
          </>
        );
      case "text":
        return (
          <>
            {text("text", "Text", true)}
            <p className="text-[10.5px] text-muted-foreground leading-snug -mt-1">{TOKENS}</p>
            <Row label="Text size"><Num value={p.size} onChange={(v) => set({ size: v })} min={6} max={72} /></Row>
            {tick("bold", "Bold")}
            {align}
            <Row label="Color"><ColorField value={p.color} onChange={(v) => set({ color: v })} allowEmpty /></Row>
          </>
        );
      case "value":
        return (
          <>
            <Row label="Value to show">
              <select className="ui-input w-full" style={{ height: 32 }} value={p.field} onChange={(e) => set({ field: e.target.value })}>
                {fields.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </Row>
            <Row label="Text size"><Num value={p.size} onChange={(v) => set({ size: v })} min={6} max={72} /></Row>
            {tick("bold", "Bold")}
            {align}
            {tick("showLabel", "Show a small label above the value")}
            {p.showLabel && text("label", "Label (blank = field name)")}
            <Row label="Color"><ColorField value={p.color} onChange={(v) => set({ color: v })} allowEmpty /></Row>
          </>
        );
      case "badge":
        return (
          <>
            <Row label="Text size"><Num value={p.size} onChange={(v) => set({ size: v })} min={6} max={40} /></Row>
            {align}
            <Row label="Badge color"><ColorField value={p.bg} onChange={(v) => set({ bg: v })} allowEmpty /></Row>
            <p className="text-[10.5px] text-muted-foreground leading-snug -mt-1">Auto = the category's badge color.</p>
            <Row label="Text color"><ColorField value={p.color} onChange={(v) => set({ color: v })} /></Row>
          </>
        );
      case "qr":
        return (
          <>
            <Row label="QR size"><Num value={p.size} onChange={(v) => set({ size: v })} min={50} max={400} step={5} /></Row>
            {align}
            <Row label="QR color"><ColorField value={p.color} onChange={(v) => set({ color: v })} /></Row>
            <p className="text-[10.5px] leading-snug -mt-1" style={{ color: "var(--warning)" }}>Keep the QR dark — a light QR may not scan.</p>
            {tick("showId", "Show the pass ID under the QR", true)}
          </>
        );
      case "image":
        return (
          <>
            <Row label="Image"><ImageField value={p.url} onChange={(v) => set({ url: v })} onError={(m) => onNotify?.(m, "error")} /></Row>
            <Row label="Height"><Num value={p.height} onChange={(v) => set({ height: v })} min={10} max={600} /></Row>
            {align}
          </>
        );
      case "divider":
        return (
          <>
            <Row label="Thickness"><Num value={p.thickness} onChange={(v) => set({ thickness: v })} min={1} max={10} /></Row>
            <Row label="Space above and below"><Num value={p.spacing} onChange={(v) => set({ spacing: v })} max={60} /></Row>
            <Row label="Color"><ColorField value={p.color} onChange={(v) => set({ color: v })} allowEmpty /></Row>
          </>
        );
      case "spacer":
        return (
          <>
            {tick("flexible", "Fill the remaining height (pushes what follows to the bottom)")}
            {!p.flexible && <Row label="Height"><Num value={p.height} onChange={(v) => set({ height: v })} max={400} /></Row>}
          </>
        );
      default:
        return null;
    }
  };

  const sizeMatch = PASS_SIZES.find((x) => x.width === settings.width && x.height === settings.height);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2" style={{ background: "var(--muted-background)" }}>
        <div className="flex items-center gap-2">
          <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            className="ui-input"
            style={{ height: 30 }}
            value=""
            onChange={(e) => {
              const preset = PASS_PRESETS.find((x) => x.id === e.target.value);
              if (preset && window.confirm(`Replace the current pass design with the "${preset.name}" layout?`)) {
                onChange(preset.build());
                setSelectedId(null);
              }
            }}
          >
            <option value="">Start from a layout…</option>
            {PASS_PRESETS.map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
        </div>
        {toolbar}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)_280px]" style={{ minHeight: 560 }}>
        {/* Elements */}
        <div className="border-b lg:border-b-0 lg:border-r p-3 space-y-3 overflow-y-auto" style={{ maxHeight: 760 }}>
          <div>
            <div className={LABEL}>Elements</div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              {PALETTE.map((it) => paletteItem(it.type, PASS_BLOCK_LABELS[it.type], it.icon, () => newPassBlock(it.type)))}
            </div>
          </div>
          <div>
            <div className={LABEL}>Attendee values</div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
              {fields.map((f) =>
                paletteItem(`v-${f.key}`, f.label, UserRound, () => newPassBlock("value", { field: f.key, size: f.key === "name" ? 22 : 12, bold: f.key === "name" }))
              )}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="overflow-auto flex items-start justify-center p-6"
          style={{ background: "var(--muted-background)", maxHeight: 760 }}
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
          <div style={{ boxShadow: "0 10px 30px -12px rgba(15,23,42,.35)", borderRadius: settings.radius, flexShrink: 0 }}>
            <PassRenderer design={design} ctx={ctx} qrUrls={qrUrls} fields={fields} designing wrapBlock={wrapBlock} />
          </div>
        </div>

        {/* Properties */}
        <div className="border-t lg:border-t-0 lg:border-l p-3 space-y-3 overflow-y-auto" style={{ maxHeight: 760 }}>
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">{PASS_BLOCK_LABELS[selected.type]}</div>
                <div className="flex items-center gap-1">
                  <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Duplicate" onClick={() => insertAt({ ...selected, id: uid(), props: { ...selected.props } }, blocks.indexOf(selected) + 1)}>
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="ui-btn ui-btn-danger ui-btn-sm ui-btn-icon" title="Remove from the pass" onClick={() => removeBlock(selected.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Back to pass settings" onClick={() => setSelectedId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {renderProps(selected)}
            </>
          ) : (
            <>
              <div className="text-sm font-semibold text-foreground">Pass settings</div>
              <Row label="Pass size">
                <select
                  className="ui-input w-full"
                  style={{ height: 32 }}
                  value={sizeMatch ? `${sizeMatch.width}x${sizeMatch.height}` : "custom"}
                  onChange={(e) => {
                    const m = PASS_SIZES.find((x) => `${x.width}x${x.height}` === e.target.value);
                    if (m) setSettings({ width: m.width, height: m.height });
                  }}
                >
                  {PASS_SIZES.map((x) => (
                    <option key={x.label} value={`${x.width}x${x.height}`}>{x.label} ({x.width} × {x.height})</option>
                  ))}
                  {!sizeMatch && <option value="custom">Custom ({settings.width} × {settings.height})</option>}
                </select>
              </Row>
              <div className="grid grid-cols-2 gap-2">
                <Row label="Width"><Num value={settings.width} onChange={(v) => setSettings({ width: v })} min={200} max={900} step={10} /></Row>
                <Row label="Height"><Num value={settings.height} onChange={(v) => setSettings({ height: v })} min={160} max={1200} step={10} /></Row>
              </div>
              <Row label="Background color"><ColorField value={settings.bg} onChange={(v) => setSettings({ bg: v || "#ffffff" })} /></Row>
              <Row label="Background image"><ImageField value={settings.bgImage} onChange={(v) => setSettings({ bgImage: v })} onError={(m) => onNotify?.(m, "error")} /></Row>
              <Row label="Text color"><ColorField value={settings.textColor} onChange={(v) => setSettings({ textColor: v || "#253338" })} /></Row>
              <Row label="Border color"><ColorField value={settings.borderColor} onChange={(v) => setSettings({ borderColor: v || "#217E79" })} /></Row>
              <div className="grid grid-cols-3 gap-2">
                <Row label="Border"><Num value={settings.borderWidth} onChange={(v) => setSettings({ borderWidth: v })} max={20} /></Row>
                <Row label="Corners"><Num value={settings.radius} onChange={(v) => setSettings({ radius: v })} max={60} /></Row>
                <Row label="Padding"><Num value={settings.padding} onChange={(v) => setSettings({ padding: v })} max={80} /></Row>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
