import { useEffect, useRef } from "react";

// Shared presentational components — used everywhere so the UI is identical
// across the whole application (header, tabs, filter bar, table, pills, buttons).
// Markup and classes mirror the Event Manager pages (MiniCrudPage /
// modules.events.all) so CRM renders with the exact same look.

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-2 mb-3 border-b">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-[11px] text-muted-foreground leading-tight">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Segmented tab track (same as Event Manager status tabs)
export function Tabs({ tabs, value, onChange }) {
  return (
    <div
      className="inline-flex items-center gap-0.5 border bg-card overflow-x-auto max-w-full shadow-sm mb-3"
      role="tablist"
      style={{ borderRadius: "16px", padding: "4px" }}
    >
      {tabs.map((t) => {
        const v = typeof t === "string" ? t : t.value;
        const label = typeof t === "string" ? t : t.label;
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={`relative inline-flex items-center gap-2 h-9 px-4 text-sm font-medium transition-colors whitespace-nowrap border-0 ${
              active ? "shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
            style={
              active
                ? { background: "var(--accent)", color: "var(--accent-foreground)", borderRadius: "12px" }
                : { background: "transparent", borderRadius: "12px" }
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// Filter bar — inline row of controls (no card), like Event Manager filters.
// Field labels stay for screen readers; the controls carry placeholders.
export function FilterBar({ children }) {
  return <div className="filter-bar flex flex-wrap items-center gap-3 mb-3">{children}</div>;
}
export function Field({ label, children, style }) {
  return (
    <div style={style}>
      {label && <label className="field-label sr-only">{label}</label>}
      {children}
    </div>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="px-4 py-10 text-center text-muted-foreground">
      <span className="spinner-border spinner-border-sm me-2 align-middle" role="status" style={{ color: "var(--primary)" }} />
      {label}
    </div>
  );
}

export function EmptyState({ icon = "inbox", text = "Nothing here yet." }) {
  return (
    <div className="px-4 py-16 text-center">
      <div className="inline-flex flex-col items-center gap-2">
        <div
          className="inline-flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}
        >
          <i className={`bi bi-${icon}`} style={{ fontSize: 18 }}></i>
        </div>
        <div className="text-sm font-medium text-foreground">{text}</div>
      </div>
    </div>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="alert alert-danger py-2 small mb-3">
      <i className="bi bi-exclamation-triangle me-1"></i>
      {error.message || String(error)}
    </div>
  );
}

// Standard data table: pass columns [{key,label,align,render}] and rows.
// Same markup as Event Manager tables so every table in the app is identical.
export function DataTable({ columns, rows, rowKey = "_id", onRowClick, loading, empty }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-medium" style={{ textAlign: c.align || "left", width: c.width, whiteSpace: "nowrap" }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length}><Spinner /></td></tr>
            ) : !rows || rows.length === 0 ? (
              <tr><td colSpan={columns.length}><EmptyState {...(empty || {})} /></td></tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r[rowKey]}
                  className={"border-t hover:bg-accent/30" + (onRowClick ? " cursor-pointer" : "")}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2.5 text-sm" style={{ textAlign: c.align || "left" }}>
                      {c.render ? c.render(r) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Colour-coded status text (neutral structure; color only conveys status state)
export function StatusPill({ color, name, sub }) {
  if (!name) return <span className="text-muted">—</span>;
  return (
    <span className="d-inline-flex flex-column" style={{ lineHeight: 1.25 }}>
      <span style={{ fontSize: "12px", fontWeight: 500, color: color || "var(--text)" }}>
        {name}
      </span>
      {sub && <span style={{ fontSize: "11px", color: "var(--muted)" }}>{sub}</span>}
    </span>
  );
}

// Row action icon button (same as Event Manager row actions)
export function IconBtn({ icon, title, danger, onClick }) {
  return (
    <button
      type="button"
      className={"ui-btn ui-btn-sm ui-btn-icon " + (danger ? "ui-btn-danger" : "ui-btn-ghost")}
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
    >
      <i className={`bi bi-${icon}`} style={{ fontSize: 13 }}></i>
    </button>
  );
}

export function Avatar({ name = "?", size = 32 }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  // neutral, theme-aligned avatar (no random bright colours)
  return (
    <span
      className="d-inline-flex align-items-center justify-content-center flex-shrink-0"
      style={{ width: size, height: size, background: "var(--accent-soft)", color: "var(--accent-ink)", fontSize: size * 0.38, fontWeight: 600, borderRadius: "50%" }}
    >
      {initials}
    </span>
  );
}

/* Overlays (sliders + confirm dialogs): Esc closes the topmost one, the page behind doesn't scroll,
   focus moves into the overlay and returns to where it was when it closes. */
const overlayStack = [];
function useOverlay(onClose) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const me = {};
    overlayStack.push(me);
    const before = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // focus the panel unless a field inside already took focus (autoFocus)
    const t = setTimeout(() => { const el = panelRef.current; if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true }); }, 0);
    const onKey = (e) => { if (e.key === "Escape" && overlayStack[overlayStack.length - 1] === me && closeRef.current) { e.stopPropagation(); closeRef.current(); } };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      overlayStack.splice(overlayStack.indexOf(me), 1);
      if (!overlayStack.length) document.body.style.overflow = prevOverflow;
      if (before && typeof before.focus === "function" && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, []);
  return panelRef;
}

// Standard form shell — a right-side slider (same as Event Manager drawers).
// Every slider is the standard width; size="wide" (or "xl") is for full records, big tables and previews.
const sliderWidth = (size) => (size === "wide" || size === "xl" ? "var(--slider-w-wide)" : "var(--slider-w)");

export function Modal({ title, onClose, children, footer, size, bodyStyle }) {
  const panelRef = useOverlay(onClose);
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full bg-card border-l shadow-2xl flex flex-col h-full outline-none"
        style={{ maxWidth: sliderWidth(size), animation: "slideInRight 0.2s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div className="text-lg font-semibold text-foreground leading-tight">{title}</div>
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" onClick={onClose} title="Close" aria-label="Close">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={bodyStyle}>{children}</div>
        {footer && <div className="border-t p-4 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// Small confirmation dialog for destructive actions (replaces the browser's confirm()).
export function Confirm({ title, text, confirmLabel = "Confirm", danger, busy, onConfirm, onCancel }) {
  const panelRef = useOverlay(busy ? null : onCancel);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={onCancel}>
      <div ref={panelRef} role="alertdialog" aria-modal="true" tabIndex={-1} className="w-full max-w-sm rounded-xl border bg-card shadow-2xl p-4 outline-none" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {text && <div className="text-xs text-muted-foreground mt-1">{text}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="ui-btn ui-btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={"ui-btn " + (danger ? "ui-btn-danger" : "ui-btn-primary")} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// KPI tile. Pass onClick to make it a filter; `tone` is a theme colour name.
export function StatCard({ label, value, icon, tone = "primary", hint, active, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={"rounded-xl border bg-card p-3 text-left w-full transition-colors" + (onClick ? " hover:bg-accent/30" : "")}
      style={active ? { borderColor: "var(--primary)", boxShadow: "0 0 0 3px var(--ring)" } : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground truncate">{label}</div>
        {icon && (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: `color-mix(in srgb, var(--${tone}) 12%, transparent)`, color: `var(--${tone})` }}
          >
            <i className={`bi bi-${icon}`} style={{ fontSize: 13 }}></i>
          </span>
        )}
      </div>
      <div className="text-xl font-semibold text-foreground mt-1 leading-tight">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</div>}
    </Tag>
  );
}

// Soft coloured label. `color` is any CSS colour (a status colour or a theme variable).
export function Chip({ color = "var(--muted-foreground)", icon, children, title }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
      style={{ borderRadius: 6, background: `color-mix(in srgb, ${color} 13%, transparent)`, color }}
    >
      {icon && <i className={`bi bi-${icon}`} style={{ fontSize: 10 }}></i>}
      {children}
    </span>
  );
}

// Card with a title row — the standard panel on dashboards and reports.
export function Panel({ title, actions, children, className = "", bodyClass = "p-3" }) {
  return (
    <section className={"rounded-xl border bg-card overflow-hidden " + className}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b">
          <h2 className="text-sm font-semibold text-foreground m-0">{title}</h2>
          {actions}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}
