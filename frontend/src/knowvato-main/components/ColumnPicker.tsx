import { useEffect, useMemo, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import { appStore } from "../../api/appStore";

/**
 * Column chooser for a table: an icon button that lists the columns with
 * tick boxes. The choice is remembered per user.
 *
 *   const cols = useColumnPicker("registrants", ["Sr No", "Name", …], [0, 1]);
 *   <table id={cols.tableId}> … </table>   {cols.style}   {cols.button}
 *
 * Columns are hidden by position (nth-child), so the table markup itself does
 * not change — keep `labels` in the same order as the <th> cells.
 */
export function useColumnPicker(name: string, labels: string[], locked: number[] = [0]) {
  const key = `cols.${name}`;
  const tableId = `tbl-${name}`;
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      const v = JSON.parse(appStore.getItem(key) || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = (label: string) => {
    const next = hidden.includes(label) ? hidden.filter((x) => x !== label) : [...hidden, label];
    setHidden(next);
    appStore.setItem(key, JSON.stringify(next));
  };

  const css = useMemo(
    () =>
      labels
        .map((l, i) => (hidden.includes(l) && !locked.includes(i) ? `#${tableId} tr > *:nth-child(${i + 1}):not([colspan]){display:none}` : ""))
        .join(""),
    [labels, hidden, locked, tableId]
  );
  const hiddenCount = labels.filter((l, i) => hidden.includes(l) && !locked.includes(i)).length;

  const button = (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className={`ui-btn ui-btn-sm ui-btn-icon ${hiddenCount ? "ui-btn-primary" : "ui-btn-outline"}`}
        title="Choose columns"
        aria-label="Choose columns"
        onClick={() => setOpen((o) => !o)}
      >
        <Columns3 className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className="rounded-lg border bg-card py-1"
          style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40, minWidth: 190, maxHeight: 320, overflowY: "auto", boxShadow: "var(--shadow-lift)" }}
        >
          {labels.map((l, i) => {
            const fixed = locked.includes(i);
            return (
              <label key={l} className="text-[12.5px] text-foreground" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0, padding: "6px 12px", cursor: fixed ? "default" : "pointer", opacity: fixed ? 0.55 : 1 }}>
                <input type="checkbox" checked={fixed || !hidden.includes(l)} disabled={fixed} onChange={() => toggle(l)} />
                <span>{l}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );

  return { tableId, button, style: css ? <style>{css}</style> : null };
}
