import type { CSSProperties, ReactNode } from "react";
import DateInput from "../../components/DateInput";
import {
  type Block,
  type EventInfo,
  type FormDesign,
  type FormField,
  type SubField,
  PAGE_FOOTER_DEFAULT,
  PAGE_HEADER_DEFAULT,
  REPEATER_MAX,
  assetUrl,
  cssUrl,
  isFieldVisible,
  eventDateText,
  eventTimeText,
  eventVenueText,
  feeFor,
  feeLabel,
  fillTokens,
} from "./schema";

/**
 * Draws a registration form from its design. Used three ways:
 *   live    — the public page: inputs work, `values`/`onChange`/`errors` drive it
 *   preview — read-only look (template thumbnails, designer preview)
 *   design  — the designer canvas: `wrapBlock` adds selection/drag handles
 */
type Props = {
  design: FormDesign;
  fields: FormField[];
  event: EventInfo;
  mode: "live" | "preview" | "design";
  values?: Record<string, any>;
  errors?: Record<string, string>;
  onChange?: (key: string, value: any) => void;
  onSubmit?: () => void;
  submitting?: boolean;
  /** design mode: wrap each block (selection outline, drag, drop marker) */
  wrapBlock?: (block: Block, index: number, node: ReactNode) => ReactNode;
  /** design mode: shown after the last block */
  tail?: ReactNode;
};

const HEADING_SIZE: Record<string, number> = { sm: 13, md: 17, lg: 22, xl: 30 };

export default function FormRenderer({ design, fields, event, mode, values = {}, errors = {}, onChange, onSubmit, submitting, wrapBlock, tail }: Props) {
  const th = design.theme;
  const live = mode === "live";
  const fieldMap = Object.fromEntries(fields.map((f) => [f.key, f]));
  const categories = Object.keys(event.registrationFees || {});
  const fee = feeFor(event, values.category);
  const set = (k: string, v: any) => onChange?.(k, v);

  const inputStyle: CSSProperties = {
    width: "100%",
    minHeight: 40,
    padding: th.inputStyle === "underline" ? "8px 2px" : "9px 12px",
    fontSize: th.fontSize,
    color: th.text,
    background: th.inputStyle === "underline" ? "transparent" : th.inputBg,
    border: th.inputStyle === "underline" ? "0" : `1px solid ${th.inputBorder}`,
    borderBottom: `1px solid ${th.inputBorder}`,
    borderRadius: th.inputStyle === "underline" ? 0 : Math.min(th.radius, 12),
    outline: "none",
    fontFamily: "inherit",
  };
  const labelStyle: CSSProperties = { display: "block", fontSize: th.fontSize - 1.5, fontWeight: 600, color: th.text, marginBottom: 5 };

  const renderInput = (f: FormField, b: Block) => {
    const v = values[f.key];
    const common = { style: inputStyle, disabled: !live, placeholder: b.props.placeholder || "" };
    const opts = f.key === "category" && categories.length ? categories : f.options || [];
    switch (f.type) {
      case "dropdown":
        return (
          <select {...common} value={v || ""} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">Select…</option>
            {opts.map((o) => (
              <option key={o} value={o}>
                {f.key === "category" && categories.length ? `${o} — ${feeLabel(feeFor(event, o))}` : o}
              </option>
            ))}
          </select>
        );
      case "multiselect":
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
            {opts.map((o) => {
              const list: string[] = Array.isArray(v) ? v : [];
              // once the limit is reached the remaining options lock
              const locked = !!f.maxSelect && list.length >= f.maxSelect && !list.includes(o);
              return (
                <label key={o} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: th.fontSize, color: th.text, opacity: locked ? 0.45 : 1 }}>
                  <input
                    type="checkbox"
                    disabled={!live || locked}
                    checked={list.includes(o)}
                    onChange={(e) => set(f.key, e.target.checked ? [...list, o] : list.filter((x) => x !== o))}
                    style={{ accentColor: th.primary }}
                  />
                  {o}
                </label>
              );
            })}
            {!opts.length && <span style={{ fontSize: th.fontSize - 1, color: th.muted }}>No options set</span>}
          </div>
        );
      case "rating":
        return (
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                disabled={!live}
                onClick={() => set(f.key, n)}
                style={{
                  width: 38, height: 38, borderRadius: Math.min(th.radius, 10), fontSize: th.fontSize, fontWeight: 600, cursor: live ? "pointer" : "default",
                  border: `1px solid ${Number(v) >= n ? th.primary : th.inputBorder}`,
                  background: Number(v) >= n ? th.primary : th.inputBg,
                  color: Number(v) >= n ? "#fff" : th.text,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        );
      case "repeater": {
        const max = Math.min(REPEATER_MAX, f.maxRows || REPEATER_MAX);
        const min = Math.max(0, f.minRows || 0);
        // the designer / preview shows one sample row
        const rows: any[] = live ? (Array.isArray(v) ? v : []) : [{}];
        const item = f.itemLabel || "Entry";
        const resize = (n: number) => {
          const count = Math.max(min, Math.min(max, Math.floor(n) || 0));
          set(f.key, Array.from({ length: count }, (_, i) => rows[i] || {}));
        };
        const setCell = (i: number, key: string, value: any) =>
          set(f.key, rows.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
        const subInput = (sf: SubField, i: number) => {
          const val = rows[i]?.[sf.key] ?? "";
          const st = { ...inputStyle, minHeight: 36 };
          if (sf.type === "dropdown")
            return (
              <select style={st} disabled={!live} value={val} onChange={(e) => setCell(i, sf.key, e.target.value)}>
                <option value="">Select…</option>
                {(sf.options || []).map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            );
          if (sf.type === "date") return <DateInput value={val} onChange={(e: any) => setCell(i, sf.key, e.target.value)} disabled={!live} style={st} />;
          return (
            <input
              style={st}
              disabled={!live}
              type={sf.type === "number" ? "number" : sf.type === "email" ? "email" : sf.type === "phone" ? "tel" : "text"}
              value={val}
              onChange={(e) => setCell(i, sf.key, e.target.value)}
            />
          );
        };
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                type="number"
                min={min}
                max={max}
                disabled={!live}
                value={live ? rows.length || "" : ""}
                onChange={(e) => resize(Number(e.target.value))}
                style={{ ...inputStyle, width: 110 }}
              />
              <span style={{ fontSize: th.fontSize - 2, color: th.muted }}>
                {min > 0 ? `${min} to ${max}` : `up to ${max}`}
              </span>
            </div>
            {rows.map((_, i) => (
              <div key={i} style={{ marginTop: 10, padding: 12, border: `1px solid ${th.inputBorder}`, borderRadius: Math.min(th.radius, 12) }}>
                <div style={{ fontSize: th.fontSize - 1.5, fontWeight: 700, color: th.primary, marginBottom: 8 }}>{item} {i + 1}</div>
                <div className="ef-grid" style={{ gap: "10px 12px" }}>
                  {(f.subFields || []).map((sf) => (
                    <div key={sf.key} className="ef-half" style={{ minWidth: 0 }}>
                      <label style={{ ...labelStyle, fontWeight: 500, marginBottom: 3 }}>
                        {sf.label}
                        {sf.required && <span style={{ color: "#DC2626" }}> *</span>}
                      </label>
                      {subInput(sf, i)}
                      {errors[`${f.key}.${i}.${sf.key}`] && (
                        <div style={{ fontSize: th.fontSize - 2.5, color: "#DC2626", marginTop: 3 }}>{errors[`${f.key}.${i}.${sf.key}`]}</div>
                      )}
                    </div>
                  ))}
                  {!(f.subFields || []).length && <div className="ef-full" style={{ fontSize: th.fontSize - 1, color: th.muted }}>No details configured for this group.</div>}
                </div>
              </div>
            ))}
          </div>
        );
      }
      case "date":
        return <DateInput value={v || ""} onChange={(e: any) => set(f.key, e.target.value)} disabled={!live} style={inputStyle} />;
      case "address":
        return <textarea {...common} rows={3} value={v || ""} onChange={(e) => set(f.key, e.target.value)} />;
      case "consent":
        return (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: th.fontSize, color: th.text }}>
            <input type="checkbox" disabled={!live} checked={!!v} onChange={(e) => set(f.key, e.target.checked)} style={{ marginTop: 3, accentColor: th.primary }} />
            <span>{f.label}{f.required && <span style={{ color: "#DC2626" }}> *</span>}</span>
          </label>
        );
      default:
        return (
          <input
            {...common}
            type={f.type === "number" ? "number" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"}
            inputMode={f.type === "phone" ? "tel" : undefined}
            value={v ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
          />
        );
    }
  };

  const renderBlock = (b: Block): ReactNode => {
    const p = b.props;
    switch (b.type) {
      case "banner": {
        const bg = p.bg || th.primary;
        return (
          <div
            style={{
              padding: p.padding ?? 28,
              borderRadius: th.radius,
              textAlign: p.align || "left",
              color: p.color || "#fff",
              background: p.imageUrl
                ? `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), ${cssUrl(p.imageUrl)} center/cover`
                : p.bg2
                ? `linear-gradient(135deg, ${bg}, ${p.bg2})`
                : bg,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{fillTokens(p.title, event)}</div>
            {fillTokens(p.subtitle, event) && <div style={{ fontSize: th.fontSize, opacity: 0.9, marginTop: 6 }}>{fillTokens(p.subtitle, event)}</div>}
          </div>
        );
      }
      case "heading":
        return (
          <div style={{ fontSize: HEADING_SIZE[p.size] || 22, fontWeight: 700, lineHeight: 1.25, textAlign: p.align || "left", color: p.color || th.text }}>
            {fillTokens(p.text, event)}
          </div>
        );
      case "text":
        return (
          <div style={{ fontSize: p.size || th.fontSize, lineHeight: 1.55, textAlign: p.align || "left", color: p.color || th.muted, whiteSpace: "pre-wrap" }}>
            {fillTokens(p.text, event)}
          </div>
        );
      case "image":
        return p.url ? (
          <img src={assetUrl(p.url)} alt={p.alt || ""} style={{ width: "100%", height: p.height || 180, objectFit: p.fit || "cover", borderRadius: p.radius ?? th.radius, display: "block" }} />
        ) : (
          <div style={{ height: p.height || 180, borderRadius: p.radius ?? th.radius, border: `1px dashed ${th.inputBorder}`, display: "flex", alignItems: "center", justifyContent: "center", color: th.muted, fontSize: th.fontSize - 1 }}>
            Image — upload one or paste a URL in the properties
          </div>
        );
      case "eventInfo": {
        const rows = [
          p.showDate !== false && eventDateText(event) && { icon: "bi-calendar3", text: eventDateText(event) },
          p.showTime !== false && eventTimeText(event) && { icon: "bi-clock", text: eventTimeText(event) },
          p.showVenue !== false && eventVenueText(event) && { icon: "bi-geo-alt", text: eventVenueText(event) },
        ].filter(Boolean) as { icon: string; text: string }[];
        if (!rows.length) return mode === "live" ? null : <div style={{ fontSize: th.fontSize - 1, color: th.muted }}>Event date, time and venue appear here.</div>;
        return (
          <div style={{ display: "flex", flexDirection: p.layout === "stack" ? "column" : "row", flexWrap: "wrap", gap: p.layout === "stack" ? 6 : "6px 18px", fontSize: th.fontSize, color: th.text }}>
            {rows.map((r) => (
              <span key={r.icon} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <i className={`bi ${r.icon}`} style={{ color: th.primary }} />
                {r.text}
              </span>
            ))}
          </div>
        );
      }
      case "fees": {
        const list = categories.length
          ? categories.map((c) => ({ name: c, amount: feeFor(event, c) }))
          : [{ name: "Registration", amount: feeFor(event) }];
        return (
          <div>
            {p.title && <div style={{ ...labelStyle, marginBottom: 8 }}>{p.title}</div>}
            <div style={{ border: `1px solid ${th.inputBorder}`, borderRadius: Math.min(th.radius, 12), overflow: "hidden" }}>
              {list.map((r, i) => (
                <div key={r.name} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 12px", fontSize: th.fontSize, color: th.text, borderTop: i ? `1px solid ${th.inputBorder}` : 0, background: values.category === r.name ? `${th.primary}14` : "transparent" }}>
                  <span>{r.name}</span>
                  <span style={{ fontWeight: 600, color: th.primary }}>{feeLabel(r.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case "divider":
        return <div style={{ borderTop: `${p.thickness || 1}px solid ${p.color || th.inputBorder}`, margin: `${p.spacing ?? 8}px 0` }} />;
      case "spacer":
        return <div style={{ height: p.height ?? 16 }} />;
      case "field": {
        const f = fieldMap[p.fieldKey];
        if (!f) return null;
        if (f.hidden) return null;
        if (live && !isFieldVisible(f, fields, values)) return null;
        const limit =
          f.type === "multiselect" && (f.maxSelect || f.minSelect)
            ? f.minSelect && f.maxSelect
              ? f.minSelect === f.maxSelect ? `Choose exactly ${f.maxSelect}` : `Choose ${f.minSelect} to ${f.maxSelect}`
              : f.maxSelect ? `Choose up to ${f.maxSelect}` : `Choose at least ${f.minSelect}`
            : "";
        return (
          <div>
            {f.type !== "consent" && (
              <label style={labelStyle}>
                {f.label}
                {f.required && <span style={{ color: "#DC2626" }}> *</span>}
              </label>
            )}
            {renderInput(f, b)}
            {limit && <div style={{ fontSize: th.fontSize - 2.5, color: th.muted, marginTop: 4 }}>{limit}</div>}
            {mode === "design" && f.showWhen?.field && (
              <div style={{ fontSize: th.fontSize - 2.5, color: th.primary, marginTop: 4 }}>
                Conditional — shown only when “{fieldMap[f.showWhen.field]?.label || f.showWhen.field}” matches
              </div>
            )}
            {p.helpText && <div style={{ fontSize: th.fontSize - 2.5, color: th.muted, marginTop: 4 }}>{p.helpText}</div>}
            {errors[f.key] && <div style={{ fontSize: th.fontSize - 2.5, color: "#DC2626", marginTop: 4 }}>{errors[f.key]}</div>}
          </div>
        );
      }
      case "consent":
        return (
          <div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: th.fontSize, color: th.text }}>
              <input type="checkbox" disabled={!live} checked={!!values.__consent} onChange={(e) => set("__consent", e.target.checked)} style={{ marginTop: 3, accentColor: th.primary }} />
              <span>{p.text}{p.required !== false && <span style={{ color: "#DC2626" }}> *</span>}</span>
            </label>
            {errors.__consent && <div style={{ fontSize: th.fontSize - 2.5, color: "#DC2626", marginTop: 4 }}>{errors.__consent}</div>}
          </div>
        );
      case "submit": {
        const label = fee > 0 ? `${p.label || "Register"} & pay ${feeLabel(fee)}` : p.label || "Register";
        return (
          <div style={{ display: "flex", justifyContent: p.align === "left" ? "flex-start" : p.align === "right" ? "flex-end" : p.align === "center" ? "center" : "stretch" }}>
            <button
              type="button"
              disabled={!live || submitting}
              onClick={onSubmit}
              style={{
                width: !p.align || p.align === "stretch" ? "100%" : undefined,
                minHeight: 44, padding: "0 26px", border: 0, cursor: live ? "pointer" : "default",
                borderRadius: Math.min(th.radius, 14), background: th.primary, color: "#fff",
                fontSize: th.fontSize + 1, fontWeight: 600, fontFamily: "inherit", opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Please wait…" : label}
            </button>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const header = { ...PAGE_HEADER_DEFAULT, ...(th.header || {}) };
  const footer = { ...PAGE_FOOTER_DEFAULT, ...(th.footer || {}) };
  const split = th.layout === "split";
  const hasMedia = !!(th.bgVideo || th.bgImage);
  const overlay = Math.max(0, Math.min(90, th.overlay ?? 30)) / 100;

  // Background picture / video. On the live page it stays put while the form scrolls.
  const media = (fixed: boolean) =>
    hasMedia ? (
      <div style={{ position: fixed ? "fixed" : "absolute", inset: 0, zIndex: 0, overflow: "hidden" }} aria-hidden>
        {th.bgVideo ? (
          <video src={assetUrl(th.bgVideo)} autoPlay muted loop playsInline poster={th.bgImage ? assetUrl(th.bgImage) : undefined} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: `${cssUrl(th.bgImage)} center/cover no-repeat` }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${overlay})` }} />
      </div>
    ) : null;

  const card = (
    <div
      style={{
        maxWidth: th.width,
        margin: "0 auto",
        background: th.cardBg,
        borderRadius: th.radius + 4,
        border: th.cardBorder ? `1px solid ${th.inputBorder}` : 0,
        boxShadow: th.cardShadow ? "0 10px 30px -18px rgba(15,23,42,.35)" : "none",
        padding: 22,
      }}
    >
        <div className="ef-grid">
          {design.blocks.map((b, i) => {
            const node = renderBlock(b);
            if (node === null && mode !== "design") return null;
            const cls = b.type === "field" && b.props.width === "half" ? "ef-half" : "ef-full";
            return (
              <div key={b.id} className={cls} style={{ minWidth: 0 }}>
                {wrapBlock ? wrapBlock(b, i, node) : node}
              </div>
            );
          })}
          {tail && <div className="ef-full">{tail}</div>}
        </div>
    </div>
  );

  return (
    <div className="ef-root" style={{ position: "relative", display: "flex", flexDirection: "column", background: th.pageBg, minHeight: mode === "live" ? "100vh" : split ? 560 : undefined, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`.ef-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 14px}.ef-full{grid-column:span 2}.ef-half{grid-column:span 1}.ef-narrow .ef-half{grid-column:span 2}.ef-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);flex:1}.ef-hero{position:relative;min-height:320px}.ef-narrow .ef-split{grid-template-columns:1fr}.ef-narrow .ef-hero{min-height:220px}@media(max-width:560px){.ef-half{grid-column:span 2}}@media(max-width:820px){.ef-split{grid-template-columns:1fr}.ef-hero{min-height:220px}}.ef-root input:focus,.ef-root select:focus,.ef-root textarea:focus{border-color:${th.primary} !important;box-shadow:0 0 0 3px ${th.primary}26}`}</style>
      {!split && media(mode === "live")}

      {header.show && (
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: header.bg, color: header.color }}>
          {header.logo && <img src={assetUrl(header.logo)} alt="" style={{ height: 34, maxWidth: 160, objectFit: "contain", display: "block" }} />}
          <div style={{ fontSize: 16, fontWeight: 700 }}>{fillTokens(header.title, event)}</div>
        </div>
      )}

      {split ? (
        <div className="ef-split" style={{ position: "relative", zIndex: 1 }}>
          <div className="ef-hero" style={{ background: hasMedia ? "#000" : `linear-gradient(135deg, ${th.primary}, ${th.text})`, overflow: "hidden" }}>
            {media(false)}
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 1, padding: "28px 28px 32px", color: "#ffffff" }}>
              <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.15 }}>{fillTokens(th.heroTitle ?? "{{eventName}}", event)}</div>
              {fillTokens(th.heroText ?? "", event) && (
                <div style={{ fontSize: th.fontSize + 1, marginTop: 10, opacity: 0.92, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{fillTokens(th.heroText ?? "", event)}</div>
              )}
            </div>
          </div>
          <div style={{ padding: "28px 18px", background: th.pageBg, display: "flex", alignItems: "center" }}>
            <div style={{ width: "100%" }}>{card}</div>
          </div>
        </div>
      ) : (
        <div style={{ position: "relative", zIndex: 1, flex: 1, padding: "28px 14px" }}>{card}</div>
      )}

      {footer.show && (
        <div style={{ position: "relative", zIndex: 1, padding: "14px 20px", textAlign: "center", fontSize: th.fontSize - 1.5, background: footer.bg, color: footer.color }}>
          {fillTokens(footer.text, event)}
        </div>
      )}
    </div>
  );
}
