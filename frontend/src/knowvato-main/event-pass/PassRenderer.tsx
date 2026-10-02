import type { CSSProperties, ReactNode } from "react";
import { type PassBlock, type PassContext, type PassDesign, type PassField, fillPassTokens, passAsset, passValue } from "./schema";

/**
 * Draws a pass from its design. Inline styles only (no CSS classes): the same
 * markup is rendered into a blank frame to produce the downloadable image, and
 * must look identical there.
 */
type Props = {
  design: PassDesign;
  ctx: PassContext;
  /** QR image (data URL) per QR block id. */
  qrUrls: Record<string, string>;
  fields?: PassField[];
  /** designer: show placeholders for empty values and wrap blocks for selection/drag */
  designing?: boolean;
  wrapBlock?: (block: PassBlock, index: number, node: ReactNode) => ReactNode;
};

const FONT = "'DM Sans', 'Segoe UI', Arial, sans-serif";
const flexAlign = (a: string) => (a === "center" ? "center" : a === "right" ? "flex-end" : "flex-start");

export default function PassRenderer({ design, ctx, qrUrls, fields = [], designing, wrapBlock }: Props) {
  const s = design.settings;
  const category = String(ctx.attendee.category || "");
  const catColors = ctx.categoryColors[category] || {};

  const renderBlock = (b: PassBlock, index: number): ReactNode => {
    const p = b.props;
    switch (b.type) {
      case "header": {
        const title = fillPassTokens(p.title, ctx);
        const subtitle = fillPassTokens(p.subtitle, ctx);
        return (
          <div
            style={{
              // a header runs edge to edge, ignoring the pass padding
              margin: `${index === 0 ? -s.padding : 0}px ${-s.padding}px 0`,
              padding: p.padding ?? 16,
              background: (p.useRibbon && catColors.ribbon) || p.bg || "#217E79",
              color: p.color || "#ffffff",
              textAlign: p.align || "left",
            }}
          >
            <div style={{ fontSize: p.titleSize || 18, fontWeight: 700, lineHeight: 1.2 }}>{title || (designing ? "Event name" : "")}</div>
            {subtitle && <div style={{ fontSize: p.subtitleSize || 11, opacity: 0.9, marginTop: 4, lineHeight: 1.3 }}>{subtitle}</div>}
          </div>
        );
      }
      case "text": {
        const text = fillPassTokens(p.text, ctx);
        if (!text && !designing) return null;
        return (
          <div style={{ fontSize: p.size || 12, fontWeight: p.bold ? 700 : 400, color: p.color || s.textColor, textAlign: p.align || "left", lineHeight: 1.35, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {text || "Text"}
          </div>
        );
      }
      case "value": {
        const value = passValue(ctx, p.field);
        const label = p.label || fields.find((f) => f.key === p.field)?.label || p.field;
        if (!value && !designing) return null;
        return (
          <div style={{ textAlign: p.align || "left", color: p.color || s.textColor, wordBreak: "break-word" }}>
            {p.showLabel && <div style={{ fontSize: Math.max(8, (p.size || 14) * 0.55), opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>}
            <div style={{ fontSize: p.size || 14, fontWeight: p.bold ? 700 : 400, lineHeight: 1.25, opacity: value ? 1 : 0.4 }}>{value || `(${label})`}</div>
          </div>
        );
      }
      case "badge": {
        if (!category && !designing) return null;
        return (
          <div style={{ display: "flex", justifyContent: flexAlign(p.align) }}>
            <span style={{ display: "inline-block", padding: "3px 12px", borderRadius: 999, fontSize: p.size || 11, fontWeight: 700, lineHeight: 1.4, background: p.bg || catColors.badge || s.borderColor || "#217E79", color: p.color || "#ffffff" }}>
              {category || "Category"}
            </span>
          </div>
        );
      }
      case "qr": {
        const size = p.size || 130;
        const url = qrUrls[b.id];
        return (
          <div style={{ display: "flex", flexDirection: "column", alignItems: flexAlign(p.align || "center") }}>
            <div style={{ width: size, height: size, padding: Math.round(size * 0.05), background: "#ffffff", borderRadius: 6, boxSizing: "border-box" }}>
              {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", display: "block" }} /> : null}
            </div>
            {p.showId !== false && (
              <div style={{ fontSize: 8, letterSpacing: 0.8, marginTop: 4, color: s.textColor, opacity: 0.6, fontFamily: "'Courier New', monospace", maxWidth: Math.max(size, 160), wordBreak: "break-all", textAlign: "center" }}>
                {passValue(ctx, "passId")}
              </div>
            )}
          </div>
        );
      }
      case "image":
        if (!p.url) {
          return designing ? (
            <div style={{ display: "flex", justifyContent: flexAlign(p.align || "center") }}>
              <div style={{ height: p.height || 48, width: (p.height || 48) * 2, border: `1px dashed ${s.textColor}`, opacity: 0.45, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: s.textColor }}>
                Image / logo
              </div>
            </div>
          ) : null;
        }
        return (
          <div style={{ display: "flex", justifyContent: flexAlign(p.align || "center") }}>
            <img src={passAsset(p.url)} alt="" crossOrigin="anonymous" style={{ height: p.height || 48, maxWidth: "100%", objectFit: "contain", display: "block" }} />
          </div>
        );
      case "divider":
        return <div style={{ borderTop: `${p.thickness || 1}px solid ${p.color || s.textColor}`, opacity: p.color ? 1 : 0.2, margin: `${p.spacing ?? 6}px 0` }} />;
      case "spacer":
        return <div style={{ height: p.flexible ? "100%" : p.height ?? 12, minHeight: p.flexible ? 4 : undefined }} />;
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        width: s.width,
        height: s.height,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: s.padding,
        borderRadius: s.radius,
        border: s.borderWidth ? `${s.borderWidth}px solid ${s.borderColor}` : "none",
        background: s.bgImage ? `url("${passAsset(s.bgImage).replace(/"/g, "%22")}") center/cover no-repeat, ${s.bg}` : s.bg,
        color: s.textColor,
        fontFamily: FONT,
      }}
    >
      {design.blocks.map((b, i) => {
        const node = renderBlock(b, i);
        if (node === null && !wrapBlock) return null;
        const flexible = b.type === "spacer" && b.props.flexible;
        return (
          <div key={b.id} style={{ flex: flexible ? "1 1 0" : "0 0 auto", minHeight: 0, marginTop: b.type === "spacer" || b.type === "header" || i === 0 ? 0 : 4 }}>
            {wrapBlock ? wrapBlock(b, i, node) : node}
          </div>
        );
      })}
    </div>
  );
}
