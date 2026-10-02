import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Save, type LucideIcon } from "lucide-react";
import { UIButton, SearchInput } from "./UIKit";
import { http } from "../../api";
import { useToast } from "../../context/ToastContext";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { appStore } from "../../api/appStore";

type Field = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "color" | "toggle" | "multiselect";
  options?: string[];
  /** multiselect: the things to tick. Nothing ticked means "all" (see emptyLabel). */
  choices?: { value: string; label: string }[];
  emptyLabel?: string;
  placeholder?: string;
  required?: boolean;
};

const COLOR_SWATCHES = ["#2249b7", "#059669", "#dc2626", "#f97316", "#a855f7", "#0891b2", "#eab308", "#64748b"];

type CrudRow = { id: string; [k: string]: any };

type Props = {
  title: string;
  /** One short line for a rule the user can't guess (e.g. available tokens). */
  hint?: string;
  icon: LucideIcon;
  accent?: string;
  accentTint?: string;
  storageKey: string;
  /** When set, rows are loaded from / saved to this backend endpoint (MongoDB)
   *  instead of appStore. `params` are sent as list filters and merged
   *  into every created row (e.g. `{ module: "crm" }`). */
  endpoint?: string;
  params?: Record<string, string>;
  fields: Field[];
  columns: { key: string; label: string; render?: (row: CrudRow) => any }[];
  seed?: CrudRow[];
  /** Numeric field key; when set, rows are always listed in ascending order of it. */
  sortKey?: string;
  createLabel?: string;
  emptyMessage?: string;
};

const uid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

export default function MiniCrudPage({
  title,
  hint,
  icon: Icon,
  accent = "var(--primary)",
  accentTint = "color-mix(in srgb, var(--primary) 12%, transparent)",
  storageKey,
  sortKey,
  endpoint,
  params,
  fields,
  columns,
  seed = [],
  createLabel = "Add",
  emptyMessage,
}: Props) {
  const [items, setItems] = useState<CrudRow[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CrudRow | null>(null);
  const [form, setForm] = useState<any>({});
  const toast = useToast() as any;
  const paramsKey = JSON.stringify(params ?? {});

  const loadRemote = async () => {
    try {
      const qs = new URLSearchParams({ ...(params ?? {}), perPage: "200" }).toString();
      const res: any = await http.get(`${endpoint}?${qs}`);
      setItems((res?.data ?? []).map((d: any) => ({ ...d, id: d._id })));
    } catch (e: any) {
      toast?.(e?.message || "Failed to load", "error");
    }
  };

  useEffect(() => {
    if (endpoint) {
      loadRemote();
      return;
    }
    try {
      const raw = appStore.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw));
      else if (seed.length > 0) {
        appStore.setItem(storageKey, JSON.stringify(seed));
        setItems(seed);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, endpoint, paramsKey]);

  const persist = (next: CrudRow[]) => {
    setItems(next);
    try {
      appStore.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q ? items.filter((row) => Object.values(row).some((v) => String(v ?? "").toLowerCase().includes(q))) : items;
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => (Number(a[sortKey]) || 0) - (Number(b[sortKey]) || 0));
  }, [items, search, sortKey]);

  const openCreate = () => {
    setEditing(null);
    const f: any = {};
    fields.forEach((fd) => { f[fd.key] = fd.type === "color" ? "#2249b7" : fd.type === "number" ? 0 : fd.type === "toggle" ? true : fd.type === "multiselect" ? [] : ""; });
    setForm(f);
    setShowForm(true);
  };

  const openEdit = (row: CrudRow) => {
    setEditing(row);
    setForm({ ...row });
    setShowForm(true);
  };

  const save = async () => {
    if (fields.some((f) => f.required && !form[f.key]?.toString().trim())) {
      alert("Fill required fields");
      return;
    }
    if (endpoint) {
      const body: any = {};
      fields.forEach((f) => { body[f.key] = form[f.key]; });
      try {
        if (editing) await http.patch(`${endpoint}/${editing.id}`, body);
        else await http.post(endpoint, { ...body, ...(params ?? {}) });
        toast?.(editing ? "Saved" : "Created");
        setShowForm(false);
        setEditing(null);
        setForm({});
        await loadRemote();
      } catch (e: any) {
        toast?.(e?.message || "Failed to save", "error");
      }
      return;
    }
    if (editing) persist(items.map((r) => (r.id === editing.id ? { ...editing, ...form } : r)));
    else persist([{ ...form, id: uid(), createdAt: new Date().toISOString() }, ...items]);
    setShowForm(false);
    setEditing(null);
    setForm({});
  };

  const remove = async (row: CrudRow) => {
    if (!confirm("Delete this item?")) return;
    if (endpoint) {
      try {
        await http.del(`${endpoint}/${row.id}`);
        await loadRemote();
      } catch (e: any) {
        toast?.(e?.message || "Failed to delete", "error");
      }
      return;
    }
    persist(items.filter((r) => r.id !== row.id));
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md" style={{ background: accentTint, color: accent }}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
            <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
          </div>
          {hint && <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-snug">{hint}</p>}
        </div>
        <UIButton onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
          {createLabel}
        </UIButton>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          containerClassName="flex-1 max-w-md"
        />
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {items.length}</div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                {columns.map((c) => <th key={c.key} className="px-4 py-3 text-left font-medium">{c.label}</th>)}
                <th className="px-4 py-3 text-right font-medium w-24" style={{ textAlign: "right" }}>Actions</th>
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
                      <UIButton size="icon-sm" variant="ghost" onClick={() => openEdit(row)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </UIButton>
                      <UIButton size="icon-sm" variant="danger" onClick={() => remove(row)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </UIButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent className="crm-theme w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10">
            <SheetTitle>{editing ? "Edit" : createLabel}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                  ) : f.type === "multiselect" ? (
                    (() => {
                      const picked: string[] = Array.isArray(form[f.key]) ? form[f.key] : [];
                      const toggle = (v: string) =>
                        setForm({ ...form, [f.key]: picked.includes(v) ? picked.filter((x) => x !== v) : [...picked, v] });
                      return (
                        <div className="rounded-md border bg-background max-h-48 overflow-y-auto">
                          <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-b">
                            <input type="checkbox" checked={picked.length === 0} onChange={() => setForm({ ...form, [f.key]: [] })} />
                            <span className="font-medium">{f.emptyLabel || "All"}</span>
                          </label>
                          {(f.choices || []).map((c) => (
                            <label key={c.value} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent/40">
                              <input type="checkbox" checked={picked.includes(c.value)} onChange={() => toggle(c.value)} />
                              <span className="truncate">{c.label}</span>
                            </label>
                          ))}
                          {(f.choices || []).length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Nothing to choose from yet.</div>}
                        </div>
                      );
                    })()
                  ) : f.type === "toggle" ? (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form[f.key] !== false}
                      onClick={() => setForm({ ...form, [f.key]: form[f.key] === false })}
                      className="inline-flex items-center gap-2"
                    >
                      <span
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form[f.key] !== false ? "" : "bg-muted"}`}
                        style={form[f.key] !== false ? { background: "var(--primary)" } : undefined}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${form[f.key] !== false ? "translate-x-4" : "translate-x-0.5"}`} />
                      </span>
                      <span className="text-xs font-medium">{form[f.key] !== false ? "Active" : "Inactive"}</span>
                    </button>
                  ) : f.type === "color" ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {COLOR_SWATCHES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          title={c}
                          onClick={() => setForm({ ...form, [f.key]: c })}
                          className={`h-8 w-8 rounded-md border transition-shadow ${(form[f.key] || "").toLowerCase() === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  ) : (
                    <input type={f.type || "text"} value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: f.type === "number" ? parseInt(e.target.value) || 0 : e.target.value })} className="w-full h-9 px-3 rounded-md border bg-background text-sm" placeholder={f.placeholder} />
                  )}
                </div>
              </div>
            ))}
          </div>
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setShowForm(false)} className="flex-1">
              Cancel
            </UIButton>
            <UIButton onClick={save} leftIcon={<Save className="h-3.5 w-3.5" />} className="flex-1">
              {editing ? "Save" : "Create"}
            </UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
