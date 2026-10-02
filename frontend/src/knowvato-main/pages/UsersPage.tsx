import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, KeyRound, RotateCcw, Users as UsersIcon } from "lucide-react";
import { usersApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import DateInput from "../../components/DateInput";
import { SearchInput, UIButton } from "../components/UIKit";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtDate } from "@/utils/date";
import { type Perm, LABEL, PermissionMatrix, Pill, TH, emptyPerm, permOf } from "../user-management/shared";
import { useColumnPicker } from "../components/ColumnPicker";

const COLUMNS = ["Sr No", "Name", "Mobile", "Role", "User type", "DOB", "Status", "Actions"];

type Role = { _id: string; name: string; perms: Perm[] };
type UserType = { _id: string; name: string; kind: "internal" | "client"; perms: Perm[] };
type User = {
  _id: string; name: string; email: string; mobile?: string; dob?: string; status: string;
  userType?: Role | null; category?: UserType | null; permOverrides?: Perm[]; lastLogin?: string;
};
type Form = { name: string; email: string; mobile: string; dob: string; userType: string; category: string; status: string };
const EMPTY: Form = { name: "", email: "", mobile: "", dob: "", userType: "", category: "", status: "Active" };

/** Configuration → User Management → Users. */
export default function UsersPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { user: me } = useAuth() as any;
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [types, setTypes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [access, setAccess] = useState<User | null>(null);
  const [overrides, setOverrides] = useState<Perm[]>([]);
  const cols = useColumnPicker("users", COLUMNS, [0, 1, 7]);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r, t]: any[] = await Promise.all([usersApi.users(), usersApi.userTypes(), usersApi.categories()]);
      setUsers(u?.data ?? []);
      setRoles(r?.data ?? []);
      setTypes(t?.data ?? []);
    } catch (e: any) {
      toast(e?.message || "Could not load users", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? users.filter((u) => `${u.name} ${u.email} ${u.mobile || ""} ${u.userType?.name || ""} ${u.category?.name || ""}`.toLowerCase().includes(q)) : users;
  }, [users, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, userType: roles[0]?._id || "", category: types[0]?._id || "" });
    setFormOpen(true);
  };
  const openEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, mobile: u.mobile || "", dob: u.dob || "", userType: u.userType?._id || "", category: u.category?._id || "", status: u.status || "Active" });
    setFormOpen(true);
  };
  const canSave = form.name.trim() && form.email.trim() && form.userType;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const body = { ...form, category: form.category || null };
      if (editing) {
        await usersApi.updateUser(editing._id, body);
        toast("User updated");
      } else {
        const res: any = await usersApi.createUser(body);
        toast(`User created. Default password: ${res.data.passwordRule}${res.data.mustChangePassword ? " (must be changed at first sign-in)" : ""}`);
      }
      setFormOpen(false);
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not save the user", "error");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (u: User) => {
    if (!window.confirm(`Reset the password of ${u.name} to the default from the Password Policy?`)) return;
    try {
      const res: any = await usersApi.resetPassword(u._id);
      toast(`Password reset. It is now: ${res.data.passwordRule}`);
    } catch (e: any) {
      toast(e?.message || "Could not reset the password", "error");
    }
  };
  const remove = async (u: User) => {
    if (!window.confirm(`Delete the user ${u.name} (${u.email})?`)) return;
    try {
      await usersApi.removeUser(u._id);
      toast("User deleted");
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not delete the user", "error");
    }
  };

  const openAccess = (u: User) => {
    setAccess(u);
    setOverrides(u.permOverrides || []);
  };
  const isCustom = (m: string) => overrides.some((p) => p.module === m);
  const roleRow = (m: string) => permOf(access?.userType?.perms, m) || emptyPerm(m);
  const toggleCustom = (m: string) =>
    setOverrides((prev) => (prev.some((p) => p.module === m) ? prev.filter((p) => p.module !== m) : [...prev, { ...roleRow(m) }]));
  const saveAccess = async () => {
    if (!access) return;
    setSaving(true);
    try {
      await usersApi.setUserPermissions(access._id, overrides);
      toast("Access saved");
      setAccess(null);
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not save access", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
            <UsersIcon className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold text-foreground leading-tight">Users</h2>
        </div>
        <UIButton onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />} disabled={!roles.length} title={roles.length ? undefined : "Create a role first"}>
          Add user
        </UIButton>
      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, mobile, role…" containerClassName="flex-1 min-w-[240px] max-w-md" />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{loading ? "Loading…" : `${filtered.length} of ${users.length}`}</span>
          {cols.button}
        </div>
      </div>
      {cols.style}

      <div className="mt-3 rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table id={cols.tableId} className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className={TH} style={{ width: 64 }}>Sr No</th>
                <th className={TH}>Name</th>
                <th className={TH}>Mobile</th>
                <th className={TH}>Role</th>
                <th className={TH}>User type</th>
                <th className={TH}>DOB</th>
                <th className={TH}>Status</th>
                <th className="px-4 py-3 font-medium" style={{ width: 160, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">{users.length ? "No users match your search." : "No users yet."}</td></tr>
              )}
              {filtered.map((u, i) => (
                <tr key={u._id} className="border-t hover:bg-accent/30">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-foreground">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-2.5">{u.mobile || "—"}</td>
                  <td className="px-4 py-2.5">
                    {u.userType?.name || "—"}
                    {(u.permOverrides?.length || 0) > 0 && <span className="ml-1.5"><Pill tone="warning">Custom rights</Pill></span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.category ? (
                      <span className="inline-flex items-center gap-1.5">
                        {u.category.name}
                        <Pill tone={u.category.kind === "client" ? "info" : "success"}>{u.category.kind === "client" ? "Client" : "Own team"}</Pill>
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{u.dob ? fmtDate(u.dob) : "—"}</td>
                  <td className="px-4 py-2.5"><Pill tone={u.status === "Active" ? "success" : "muted"}>{u.status}</Pill></td>
                  <td className="px-4 py-2.5" style={{ textAlign: "right" }}>
                    <div className="inline-flex items-center gap-1">
                      <UIButton size="icon-sm" variant="ghost" onClick={() => openAccess(u)} title="Access rights"><KeyRound className="h-3.5 w-3.5" /></UIButton>
                      <UIButton size="icon-sm" variant="ghost" onClick={() => resetPassword(u)} title="Reset password to the default"><RotateCcw className="h-3.5 w-3.5" /></UIButton>
                      <UIButton size="icon-sm" variant="ghost" onClick={() => openEdit(u)} title="Edit"><Pencil className="h-3.5 w-3.5" /></UIButton>
                      <UIButton size="icon-sm" variant="danger" onClick={() => remove(u)} disabled={String(me?._id || me?.id) === u._id} title="Delete"><Trash2 className="h-3.5 w-3.5" /></UIButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / edit */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="crm-theme w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{editing ? "Edit user" : "Add user"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
            <div className="sm:col-span-2">
              <label className={LABEL}>Name *</label>
              <input autoFocus className="ui-input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>Email *</label>
              <input type="email" className="ui-input w-full" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Mobile number</label>
              <input type="tel" inputMode="numeric" className="ui-input w-full" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/[^\d+ -]/g, "") })} maxLength={16} />
            </div>
            <div>
              <label className={LABEL}>Date of birth</label>
              <DateInput className="ui-input w-full" value={form.dob} onChange={(e: any) => setForm({ ...form, dob: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Role *</label>
              <select className="ui-input w-full" value={form.userType} onChange={(e) => setForm({ ...form, userType: e.target.value })}>
                <option value="">— select —</option>
                {roles.map((r) => (
                  <option key={r._id} value={r._id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>User type</label>
              <select className="ui-input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">— none —</option>
                {types.map((t) => (
                  <option key={t._id} value={t._id}>{t.name} ({t.kind === "client" ? "Client" : "Own team"})</option>
                ))}
              </select>
            </div>
            {editing && (
              <div>
                <label className={LABEL}>Status</label>
                <select className="ui-input w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            )}
          </div>
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={save} loading={saving} disabled={!canSave} className="flex-1">{editing ? "Save changes" : "Add user"}</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Access rights */}
      <Sheet open={!!access} onOpenChange={(o) => !o && setAccess(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-2xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>Access rights — {access?.name}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Pill tone="muted">Role: {access?.userType?.name || "—"}</Pill>
              {access?.category && <Pill tone="muted">User type: {access.category.name}</Pill>}
            </div>
            <PermissionMatrix
              value={overrides}
              onChange={setOverrides}
              limit={access?.category?.perms}
              leadHeader="Custom"
              rowLead={(m) => <input type="checkbox" checked={isCustom(m)} onChange={() => toggleCustom(m)} title="Give this user different rights from the role for this module" />}
              rowLocked={(m) => !isCustom(m)}
              lockedValue={roleRow}
            />
            <p className="text-[11px] text-muted-foreground">Unticked “Custom” rows follow the role. Greyed boxes are outside what the user type allows.</p>
          </div>
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setAccess(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={saveAccess} loading={saving} className="flex-1">Save access</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
