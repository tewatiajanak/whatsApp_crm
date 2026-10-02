import { useEffect, useMemo, useState } from "react";
import { http } from "../../api";
import { useToast } from "../../context/ToastContext";
import {
  ShieldCheck,
  Plus,
  Save,
  Trash2,
  X,
  Loader2,
  Pencil,
  Check,
} from "lucide-react";
import { UIButton, SearchInput } from "../components/UIKit";

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
  const [drawerOpen, setDrawerOpen] = useState(false);
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
      toast?.(e?.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const emptyPerms = () => {
    const p: any = {};
    MODULES.forEach((m) => { p[m.key] = { view: false, create: false, edit: false, del: false }; });
    return p;
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", desc: "", perms: emptyPerms() });
    setDrawerOpen(true);
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
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(null);
    setForm({ name: "", desc: "", perms: {} });
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
        toast?.("Role updated");
      } else {
        await http.post("/usertypes", payload);
        toast?.("Role created");
      }
      closeDrawer();
      await load();
    } catch (e: any) {
      toast?.(e?.message, "error");
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
      toast?.(e?.message, "error");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((r) => `${r.name} ${r.desc}`.toLowerCase().includes(q));
  }, [roles, search]);

  const permsCount = (r: Role) => r.perms?.filter((p) => p.view || p.create || p.edit || p.del).length ?? 0;

  return (
    <div className="p-4 md:p-5 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground leading-tight">Roles & Permissions</h2>
          </div>
        </div>
        <UIButton onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
          New role
        </UIButton>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles…"
          containerClassName="flex-1 max-w-md"
        />
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {roles.length}</div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">Description</th>
                <th className="px-4 py-2.5 text-left font-medium">Modules with access</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading roles…
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {roles.length === 0 ? "No roles yet. Click 'New role' to start." : "No roles match your search."}
                </td></tr>
              )}
              {!loading && filtered.map((r) => {
                const n = permsCount(r);
                return (
                  <tr
                    key={r._id}
                    className="border-t hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => openEdit(r)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{r.name}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-md truncate">
                      {r.desc || <span className="italic opacity-60">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(n / MODULES.length) * 100}%`, background: "var(--primary)" }} />
                        </div>
                        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                          {n} / {MODULES.length}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <UIButton size="icon-sm" variant="ghost" onClick={() => openEdit(r)} title="Edit permissions">
                          <Pencil className="h-3.5 w-3.5" />
                        </UIButton>
                        <UIButton size="icon-sm" variant="danger" onClick={() => remove(r)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </UIButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer with permission matrix */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={closeDrawer}>
          <div className="flex-1 bg-black/40 backdrop-blur-sm" />
          <div
            className="w-full max-w-3xl bg-card border-l shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-card border-b px-5 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {editing ? "Edit role" : "New role"}
                </div>
                <div className="text-base font-semibold text-foreground leading-tight">
                  {editing ? form.name || "Untitled" : "Create a new role"}
                </div>
              </div>
              <UIButton size="icon-sm" variant="ghost" onClick={closeDrawer}>
                <X className="h-4 w-4" />
              </UIButton>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Basics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Role name *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="ui-input w-full mt-1" placeholder="e.g. Event Manager" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
                  <input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} className="ui-input w-full mt-1" placeholder="What can they do?" />
                </div>
              </div>

              {/* Matrix */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Permission Matrix</div>
                  <div className="text-[10px] text-muted-foreground">
                    Click cells or use row/column shortcuts
                  </div>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead style={{ background: "var(--muted-background)" }}>
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Module</th>
                        {ACTIONS.map((a) => (
                          <th key={a} className="px-2 py-2 text-center text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                            <div className="flex flex-col items-center">
                              <span>{a === "del" ? "delete" : a}</span>
                              <div className="inline-flex items-center gap-1 mt-0.5">
                                <button onClick={() => toggleCol(a, true)} className="text-[9px] text-primary hover:underline">all</button>
                                <span className="text-muted-foreground">·</span>
                                <button onClick={() => toggleCol(a, false)} className="text-[9px] text-muted-foreground hover:underline">none</button>
                              </div>
                            </div>
                          </th>
                        ))}
                        <th className="w-16 px-2 py-2 text-right text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Row</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map((m) => {
                        const rowAll = ACTIONS.every((a) => form.perms[m.key]?.[a]);
                        return (
                          <tr key={m.key} className="border-t hover:bg-accent/20">
                            <td className="px-3 py-1.5 text-sm">
                              <div className="text-foreground">{m.label}</div>
                              <div className="text-[10px] font-mono text-muted-foreground">{m.key}</div>
                            </td>
                            {ACTIONS.map((a) => (
                              <td key={a} className="px-2 py-1.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggle(m.key, a)}
                                  className={`inline-flex items-center justify-center h-6 w-6 rounded transition-colors ${
                                    form.perms[m.key]?.[a]
                                      ? "text-white"
                                      : "bg-transparent border border-border text-transparent hover:border-primary"
                                  }`}
                                  style={form.perms[m.key]?.[a] ? { background: "var(--primary)" } : undefined}
                                  title={`${a} on ${m.label}`}
                                >
                                  <Check className="h-3 w-3" strokeWidth={3} />
                                </button>
                              </td>
                            ))}
                            <td className="px-2 py-1.5 text-right">
                              <button onClick={() => toggleRow(m.key, !rowAll)} className="text-[10px] text-primary hover:underline">
                                {rowAll ? "clear" : "all"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sticky footer */}
            <div className="sticky bottom-0 bg-card border-t px-5 py-3 flex items-center gap-2">
              <UIButton variant="outline" onClick={closeDrawer} className="flex-1">Cancel</UIButton>
              <UIButton onClick={save} disabled={!form.name.trim()} loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />} className="flex-1">
                {editing ? "Save changes" : "Create role"}
              </UIButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
