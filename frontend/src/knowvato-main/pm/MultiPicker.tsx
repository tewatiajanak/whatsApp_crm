import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

/** Dropdown to tick several options. `value` is the list of chosen option values. */
export default function MultiPicker({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const chosen = options.filter((o) => value.includes(o.value));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const s = q.trim().toLowerCase();
  const shown = s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options;

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); setQ(""); }} className="ui-input w-full flex items-center gap-2 text-left">
        <span className={`truncate flex-1 ${chosen.length ? "" : "text-muted-foreground"}`}>
          {chosen.length === 0 ? "—" : chosen.length <= 2 ? chosen.map((o) => o.label).join(", ") : `${chosen.length} selected`}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-card shadow-lg overflow-hidden" style={{ minWidth: 220 }}>
          {options.length > 8 && (
            <div className="p-2 border-b">
              <input autoFocus className="ui-input w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
            </div>
          )}
          <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
            {shown.length === 0 && <div className="px-3 py-3 text-xs text-muted-foreground">No match</div>}
            {shown.map((o) => {
              const on = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent/40"
                  style={{ background: "transparent", border: 0, color: "var(--foreground)" }}
                >
                  <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border" style={on ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" } : { background: "var(--card)" }}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
