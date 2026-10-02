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

// Standard form shell — a right-side slider (same as Event Manager drawers).
// `size` widens it: "lg" / "xl" for bigger forms.
const DRAWER_WIDTH = { sm: "max-w-md", lg: "max-w-2xl", xl: "max-w-4xl" };

export function Modal({ title, onClose, children, footer, size, bodyStyle }) {
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <div
        className={`w-full ${DRAWER_WIDTH[size] || "max-w-lg"} bg-card border-l shadow-2xl flex flex-col h-full`}
        style={{ animation: "slideInRight 0.2s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div className="text-lg font-semibold text-foreground leading-tight">{title}</div>
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" onClick={onClose} title="Close">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4" style={bodyStyle}>{children}</div>
        {footer && <div className="border-t p-4 flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
