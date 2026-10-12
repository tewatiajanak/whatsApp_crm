import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { PersonAvatar, type Employee } from "./shared";

/** Searchable employee dropdown with photos. `value` is the employee id ("" = none). */
export default function EmployeePicker({
  employees,
  value,
  onChange,
  disabled,
  clearable = true,
  emptyLabel = "—",
}: {
  employees: Employee[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  clearable?: boolean;
  /** shown when nobody is chosen — a filter says "All employees" */
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const current = employees.find((e) => e._id === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = employees.filter((e) => e.status !== "Inactive" || e._id === value);
    return s ? list.filter((e) => `${e.name} ${e.designation || ""} ${e.email || ""}`.toLowerCase().includes(s)) : list;
  }, [employees, q, value]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); setQ(""); }}
        className="ui-input w-full flex items-center gap-2 text-left"
        style={{ opacity: disabled ? 0.6 : 1 }}
      >
        {current ? (
          <>
            <PersonAvatar name={current.name} photo={current.photo} size={22} />
            <span className="truncate flex-1">{current.name}</span>
          </>
        ) : (
          <span className="flex-1 truncate text-muted-foreground">{emptyLabel}</span>
        )}
        {current && clearable && !disabled && (
          <span role="button" title="Clear" onClick={(e) => { e.stopPropagation(); onChange(""); }} className="inline-flex text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-card shadow-lg overflow-hidden" style={{ minWidth: 220 }}>
          <div className="p-2 border-b">
            <input autoFocus className="ui-input w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
            {shown.length === 0 && <div className="px-3 py-3 text-xs text-muted-foreground">No match</div>}
            {shown.map((e) => (
              <button
                key={e._id}
                type="button"
                onClick={() => { onChange(e._id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
                style={{ background: e._id === value ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "transparent", border: 0 }}
              >
                <PersonAvatar name={e.name} photo={e.photo} size={26} />
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{e.name}</span>
                  {e.designation && <span className="block truncate text-[11px] text-muted-foreground">{e.designation}</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
