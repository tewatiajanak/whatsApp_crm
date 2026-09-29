import { useEffect, useMemo, useState } from "react";
import { http } from "../../api";
import { useToast } from "../../context/ToastContext";
import {
  ShieldCheck,
  Plus,
  Search,
  Save,
  Trash2,
  X,
  Users,
  Loader2,
} from "lucide-react";

type Role = {
  _id: string;
  name: string;
  desc?: string;
  perms: { module: string; view: boolean; create: boolean; edit: boolean; del: boolean }[];
};

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "leads", label: "Leads" },
  { key: "followups", label: "Follow-ups" },
  { key: "chat", label: "Chat" },
  { key: "blast", label: "Campaigns" },
  { key: "contacts", label: "Contacts" },
  { key: "conversion", label: "Conversion" },
  { key: "setup", label: "Setup / Configuration" },
  { key: "reports", label: "Reports" },
  { key: "workflows", label: "Workflows" },
];

const ACTIONS = ["view", "create", "edit", "del"] as const;

export default function RolesPage() {
  const toast = useToast() as any;
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<{ name: string; desc: string; perms: any }>({
    name: "",
    desc: "",
    perms: {},
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await http.get("/usertypes?perPage=100&sort=name");
      setRoles(res?.data ?? res?.items ?? []);
    } catch (e: any) {
      toast?.error?.(e?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    const perms: any = {};
    MODULES.forEach((m) => {
      perms[m.key] = { view: false, create: false, edit: false, del: false };
    });
    setForm({ name: "", desc: "", perms });
  };

  const openEdit = (r: Role) => {
    setEditing(r);
    const perms: any = {};
    MODULES.forEach((m) => {
      const existing = r.perms?.find((p) => p.module === m.key);
      perms[m.key] = existing
        ? { view: existing.view, create: existing.create, edit: existing.edit, del: existing.del }
        : { view: false, create: false, edit: false, del: false };
    });
    setForm({ name: r.name, desc: r.desc || "", perms });
  };

  const toggle = (mod: string, action: string) => {
    setForm({
      ...form,
      perms: {
        ...form.perms,
        [mod]: { ...form.perms[mod], [action]: !form.perms[mod][action] },
      },
    });
  };

  const toggleRow = (mod: string, on: boolean) => {
    setForm({
      ...form,
      perms: { ...form.perms, [mod]: { view: on, create: on, edit: on, del: on } },
    });
  };

  const toggleCol = (action: string, on: boolean) => {
    const p: any = { ...form.perms };
    MODULES.forEach((m) => { p[m.key] = { ...p[m.key], [action]: on }; });
    setForm({ ...form, perms: p });
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const perms = MODULES.map((m) => ({ module: m.key, ...form.perms[m.key] }));
      const payload = { name: form.name.trim(), desc: form.desc.trim(), perms };
      if (editing) {
        await http.patch(`/usertypes/${editing._id}`, payload);
        toast?.success?.("Role updated");
      } else {
        await http.post("/usertypes", payload);
        toast?.success?.("Role created");
      }
      setEditing(null);
      setForm({ name: "", desc: "", perms: {} });
      await load();
    } catch (e: any) {
      toast?.error?.(e?.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Role) => {
    if (!confirm(`Delete role "${r.name}"?`)) return;
    try {
      await http.del(`/usertypes/${r._id}`);
      await load();
    } catch (e: any) {
      toast?.error?.(e?.message);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => `${r.name} ${r.desc}`.toLowerCase().includes(q));
  }, [roles, search]);

  const isEditing = editing !== null || Object.keys(form.perms).length > 0;

  return (
    <div className="p-6 md:p-8 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Roles & Permissions</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Control what each role can view, create, edit, or delete across all modules.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: "var(--primary)" }}>
          <Plus className="h-4 w-4" />
          New role
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        <div className="space-y-2">
          <div className="rounded-lg border bg-card p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search roles…" className="w-full h-8 pl-7 pr-2 rounded border bg-background text-sm" />
            </div>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            {loading && <div className="p-6 text-center text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin inline mr-1" />Loading…</div>}
            {!loading && filtered.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No roles</div>}
            {!loading && filtered.map((r) => (
              <button key={r._id} onClick={() => openEdit(r)} className={`w-full text-left p-3 border-b last:border-b-0 hover:bg-accent/30 transition-colors group ${editing?._id === r._id ? "bg-primary/5" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">{r.name}</div>
                    {r.desc && <div className="text-[11px] text-muted-foreground truncate">{r.desc}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {r.perms?.filter((p) => p.view || p.create || p.edit || p.del).length} of {MODULES.length} modules
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); remove(r); }} className="opacity-0 group-hover:opacity-100 h-7 w-7 inline-flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-all">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          {!isEditing && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Select a role from the list or create a new one to configure permissions.
            </div>
          )}
          {isEditing && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">{editing ? "Edit role" : "New role"}</div>
                {editing && (
                  <button onClick={() => { setEditing(null); setForm({ name: "", desc: "", perms: {} }); }} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" placeholder="e.g. Event Manager" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
                  <input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-md border bg-background text-sm" placeholder="What can they do?" />
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Permission Matrix</div>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead style={{ background: "var(--muted-background)" }}>
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Module</th>
                        {ACTIONS.map((a) => (
                          <th key={a} className="px-2 py-2 text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                            <div className="flex flex-col items-center">
                              {a === "del" ? "delete" : a}
                              <div className="inline-flex items-center gap-1 mt-0.5">
                                <button onClick={() => toggleCol(a, true)} className="text-[9px] text-primary hover:underline">all</button>
                                <span className="text-muted-foreground">·</span>
                                <button onClick={() => toggleCol(a, false)} className="text-[9px] text-muted-foreground hover:underline">none</button>
                              </div>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map((m) => (
                        <tr key={m.key} className="border-t hover:bg-accent/20">
                          <td className="px-3 py-1.5 text-sm">
                            <div>{m.label}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{m.key}</div>
                          </td>
                          {ACTIONS.map((a) => (
                            <td key={a} className="px-2 py-1.5 text-center">
                              <input type="checkbox" checked={form.perms[m.key]?.[a] || false} onChange={() => toggle(m.key, a)} className="h-4 w-4 accent-[var(--primary)] cursor-pointer" />
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-right">
                            <button onClick={() => toggleRow(m.key, !ACTIONS.every((a) => form.perms[m.key]?.[a]))} className="text-[10px] text-primary hover:underline">
                              {ACTIONS.every((a) => form.perms[m.key]?.[a]) ? "clear" : "all"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t">
                <button onClick={save} disabled={!form.name.trim() || saving} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm disabled:opacity-40" style={{ background: "var(--primary)" }}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {editing ? "Save changes" : "Create role"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
