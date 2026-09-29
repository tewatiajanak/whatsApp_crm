import { useEffect, useMemo, useState } from "react";
import { http } from "../../api";
import { useToast } from "../../context/ToastContext";
import { Building2, Plus, Trash2, Pencil, Loader2, X, Save } from "lucide-react";
import { UIButton, SearchInput } from "../components/UIKit";
import { fmtDate } from "../utils/date";

type Dept = {
  _id: string;
  name: string;
  order?: number;
  createdAt?: string;
};

export default function DepartmentsPage() {
  const toast = useToast() as any;
  const [items, setItems] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Dept | null>(null);
  const [form, setForm] = useState({ name: "", order: 0 });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await http.get("/designations?perPage=200&sort=order");
      setItems(res?.data ?? res?.items ?? []);
    } catch (e: any) {
      toast?.error?.(e?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((d) => d.name.toLowerCase().includes(q));
  }, [items, search]);

  const openCreate = () => { setEditing(null); setForm({ name: "", order: items.length }); setShowForm(true); };
  const openEdit = (d: Dept) => { setEditing(d); setForm({ name: d.name, order: d.order || 0 }); setShowForm(true); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await http.patch(`/designations/${editing._id}`, { name: form.name.trim(), order: form.order });
      else await http.post("/designations", { name: form.name.trim(), order: form.order });
      toast?.success?.(editing ? "Department updated" : "Department created");
      setShowForm(false);
      await load();
    } catch (e: any) {
      toast?.error?.(e?.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: Dept) => {
    if (!confirm(`Delete "${d.name}"?`)) return;
    try {
      await http.del(`/designations/${d._id}`);
      await load();
    } catch (e: any) {
      toast?.error?.(e?.message);
    }
  };

  return (
    <div className="p-4 md:p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground leading-tight">Departments</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-snug">Organize your team by department. Users can be assigned one department each.</p>
        </div>
        <UIButton onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
          New department
        </UIButton>
      </div>

      <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" containerClassName="max-w-md" />

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
              <th className="px-4 py-2.5 text-left font-medium w-20">Sr No</th>
              <th className="px-4 py-2.5 text-left font-medium">Department</th>
              <th className="px-4 py-2.5 text-left font-medium w-32">Created</th>
              <th className="px-4 py-2.5 text-right font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No departments yet. Add your first one.</td></tr>}
            {!loading && filtered.map((d, i) => (
              <tr key={d._id} className="border-t hover:bg-accent/30">
                <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-foreground">{d.name}</td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtDate(d.createdAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex items-center gap-1">
                    <UIButton size="icon-sm" variant="ghost" onClick={() => openEdit(d)} title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </UIButton>
                    <UIButton size="icon-sm" variant="danger" onClick={() => remove(d)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </UIButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl border shadow-2xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="text-lg font-semibold">{editing ? "Edit department" : "New department"}</div>
              <button onClick={() => setShowForm(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" placeholder="e.g. Sales" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sort priority</label>
              <input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" placeholder="Lower value shows first" />
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <UIButton variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</UIButton>
              <UIButton onClick={save} disabled={!form.name.trim()} loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />} className="flex-1">
                {editing ? "Save" : "Create"}
              </UIButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
