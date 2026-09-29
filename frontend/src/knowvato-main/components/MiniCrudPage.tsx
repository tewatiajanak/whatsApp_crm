import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, Pencil, X, Save, type LucideIcon } from "lucide-react";

type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "color";
  options?: string[];
  placeholder?: string;
  required?: boolean;
};

type CrudRow = { id: string; [k: string]: any };

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
  accent?: string;
  accentTint?: string;
  storageKey: string;
  fields: Field[];
  columns: { key: string; label: string; render?: (row: CrudRow) => any }[];
  seed?: CrudRow[];
  createLabel?: string;
  emptyMessage?: string;
  footer?: string;
};

const uid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

export default function MiniCrudPage({
  title,
  description,
  icon: Icon,
  accent = "var(--primary)",
  accentTint = "color-mix(in srgb, var(--primary) 12%, transparent)",
  storageKey,
  fields,
  columns,
  seed = [],
  createLabel = "Add",
  emptyMessage,
  footer,
}: Props) {
  const [items, setItems] = useState<CrudRow[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CrudRow | null>(null);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw));
      else if (seed.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(seed));
        setItems(seed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = (next: CrudRow[]) => {
    setItems(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [items, search]);

  const openCreate = () => {
    setEditing(null);
    const f: any = {};
    fields.forEach((fd) => { f[fd.key] = fd.type === "color" ? "#2249b7" : fd.type === "number" ? 0 : ""; });
    setForm(f);
    setShowForm(true);
  };

  const openEdit = (row: CrudRow) => {
    setEditing(row);
    setForm({ ...row });
    setShowForm(true);
  };

  const save = () => {
    if (fields.some((f) => f.required && !form[f.key]?.toString().trim())) {
      alert("Fill required fields");
      return;
    }
    if (editing) persist(items.map((r) => (r.id === editing.id ? { ...editing, ...form } : r)));
    else persist([{ ...form, id: uid(), createdAt: new Date().toISOString() }, ...items]);
    setShowForm(false);
    setEditing(null);
    setForm({});
  };

  const remove = (row: CrudRow) => {
    if (!confirm("Delete this item?")) return;
    persist(items.filter((r) => r.id !== row.id));
  };

  return (
    <div className="p-6 md:p-8 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ background: accentTint, color: accent }}>
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: accent }}>
          <Plus className="h-4 w-4" />
          {createLabel}
        </button>
      </div>

      <div className="rounded-lg border bg-card p-2 flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full h-9 pl-8 pr-3 rounded border bg-background text-sm" />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {items.length}</div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                {columns.map((c) => <th key={c.key} className="px-4 py-3 text-left font-medium">{c.label}</th>)}
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {emptyMessage || "No items yet."}
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="border-t hover:bg-accent/30">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2.5 text-sm">
                      {c.render ? c.render(row) : (row[c.key] || <span className="text-muted-foreground italic">—</span>)}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => openEdit(row)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(row)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {footer && <div className="text-xs text-muted-foreground pt-2 border-t">{footer}</div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl border shadow-2xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="text-lg font-semibold">{editing ? "Edit" : createLabel}</div>
              <button onClick={() => setShowForm(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            {fields.map((f) => (
              <div key={f.key}>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </label>
                <div className="mt-1">
                  {f.type === "textarea" ? (
                    <textarea value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-md border bg-background text-sm" placeholder={f.placeholder} />
                  ) : f.type === "select" ? (
                    <select value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="w-full h-9 px-3 rounded-md border bg-background text-sm">
                      <option value="">— choose —</option>
                      {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.type === "color" ? (
                    <div className="flex items-center gap-2">
                      <input type="color" value={form[f.key] || "#2249b7"} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="h-9 w-14 rounded-md border cursor-pointer bg-background" />
                      <input value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} className="flex-1 h-9 px-3 rounded-md border bg-background text-xs font-mono" />
                    </div>
                  ) : (
                    <input type={f.type || "text"} value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? parseInt(e.target.value) || 0 : e.target.value })} className="w-full h-9 px-3 rounded-md border bg-background text-sm" placeholder={f.placeholder} />
                  )}
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-2 border-t">
              <button onClick={() => setShowForm(false)} className="flex-1 h-9 rounded-md text-sm font-medium border hover:bg-accent">Cancel</button>
              <button onClick={save} className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: accent }}>
                <Save className="h-3.5 w-3.5" />
                {editing ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
