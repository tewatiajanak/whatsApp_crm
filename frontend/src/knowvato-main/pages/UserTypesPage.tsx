import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, KeyRound, Users as UsersIcon } from "lucide-react";
import { usersApi } from "../../api";
import { useToast } from "../../context/ToastContext";
import { UIButton } from "../components/UIKit";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { type Perm, LABEL, MODULE_KEYS, PermissionMatrix, Pill, TH, Toggle, fullPerm } from "../user-management/shared";

type UserType = { _id: string; name: string; kind: "internal" | "client"; otpLogin: boolean; perms: Perm[]; userCount: number };
const EMPTY = { name: "", kind: "internal" as "internal" | "client", otpLogin: false };

/** Configuration → User Management → User Types: whose users they are, and the most they may access. */
export default function UserTypesPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const [rows, setRows] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [otpAvailable, setOtpAvailable] = useState(true);
  const [editing, setEditing] = useState<UserType | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [access, setAccess] = useState<UserType | null>(null);
  const [limited, setLimited] = useState(false);
  const [perms, setPerms] = useState<Perm[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [list, meta]: any[] = await Promise.all([usersApi.categories(), usersApi.meta()]);
      setRows(list?.data ?? []);
      setOtpAvailable(meta?.data?.otpAvailable !== false);
    } catch (e: any) {
      toast(e?.message || "Could not load user types", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormOpen(true);
  };
  const openEdit = (r: UserType) => {
    setEditing(r);
    setForm({ name: r.name, kind: r.kind, otpLogin: r.otpLogin });
    setFormOpen(true);
  };
  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await usersApi.updateCategory(editing._id, form);
      else await usersApi.createCategory(form);
      toast(editing ? "User type updated" : "User type added");
      setFormOpen(false);
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not save the user type", "error");
    } finally {
      setSaving(false);
    }
  };
  const toggleOtp = async (r: UserType) => {
    try {
      await usersApi.updateCategory(r._id, { otpLogin: !r.otpLogin });
      setRows((prev) => prev.map((x) => (x._id === r._id ? { ...x, otpLogin: !r.otpLogin } : x)));
    } catch (e: any) {
      toast(e?.message || "Could not update", "error");
    }
  };
  const remove = async (r: UserType) => {
    if (!window.confirm(`Delete the user type "${r.name}"?`)) return;
    try {
      await usersApi.removeCategory(r._id);
      toast("User type deleted");
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not delete", "error");
    }
  };

  const openAccess = (r: UserType) => {
    setAccess(r);
    setLimited(r.perms.length > 0);
    setPerms(r.perms.length ? r.perms : MODULE_KEYS.map(fullPerm));
  };
  const saveAccess = async () => {
    if (!access) return;
    setSaving(true);
    try {
      await usersApi.updateCategory(access._id, { perms: limited ? perms : [] });
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
          <h2 className="text-base font-semibold text-foreground leading-tight">User Types</h2>
        </div>
        <UIButton onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add user type</UIButton>
      </div>

      {!otpAvailable && rows.some((r) => r.otpLogin) && (
        <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
          OTP sign-in is switched on, but no mail server (SMTP) is set up to send the code — users are signing in with the password only.
        </div>
      )}

      <div className="mt-3 rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className={TH} style={{ width: 64 }}>Sr No</th>
                <th className={TH}>User type</th>
                <th className={TH}>Belongs to</th>
                <th className={TH}>OTP sign-in (MFA)</th>
                <th className={TH}>Access</th>
                <th className={TH}>Users</th>
                <th className="px-4 py-3 font-medium" style={{ width: 130, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No user types yet.</td></tr>
              )}
              {!loading && rows.map((r, i) => (
                <tr key={r._id} className="border-t hover:bg-accent/30">
                  <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{r.name}</td>
                  <td className="px-4 py-2.5">{r.kind === "client" ? <Pill tone="info">Client</Pill> : <Pill tone="success">Own team</Pill>}</td>
                  <td className="px-4 py-2.5"><Toggle on={r.otpLogin} onChange={() => toggleOtp(r)} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.perms.length ? "Limited" : "No limit"}</td>
                  <td className="px-4 py-2.5">{r.userCount}</td>
                  <td className="px-4 py-2.5" style={{ textAlign: "right" }}>
                    <div className="inline-flex items-center gap-1">
                      <UIButton size="icon-sm" variant="ghost" onClick={() => openAccess(r)} title="Rights and access"><KeyRound className="h-3.5 w-3.5" /></UIButton>
                      <UIButton size="icon-sm" variant="ghost" onClick={() => openEdit(r)} title="Edit"><Pencil className="h-3.5 w-3.5" /></UIButton>
                      <UIButton size="icon-sm" variant="danger" onClick={() => remove(r)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></UIButton>
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
        <SheetContent className="crm-theme w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{editing ? "Edit user type" : "Add user type"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className={LABEL}>User type name *</label>
              <input autoFocus className="ui-input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} />
            </div>
            <div>
              <label className={LABEL}>Belongs to</label>
              <select className="ui-input w-full" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "internal" | "client" })}>
                <option value="internal">Own team</option>
                <option value="client">Client</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>OTP sign-in (MFA)</label>
              <Toggle on={form.otpLogin} onChange={() => setForm({ ...form, otpLogin: !form.otpLogin })} />
              {!otpAvailable && form.otpLogin && (
                <p className="text-[11px] mt-1" style={{ color: "var(--warning)" }}>Needs a mail server (SMTP) to send the code. Until then sign-in uses the password only.</p>
              )}
            </div>
          </div>
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={save} loading={saving} disabled={!form.name.trim()} className="flex-1">{editing ? "Save changes" : "Add user type"}</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Rights and access */}
      <Sheet open={!!access} onOpenChange={(o) => !o && setAccess(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-2xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>Rights and access — {access?.name}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <label className="text-sm text-foreground" style={{ display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
              <input type="checkbox" checked={limited} onChange={(e) => setLimited(e.target.checked)} />
              <span>Limit what users of this type can access</span>
            </label>
            {limited ? (
              <PermissionMatrix value={perms} onChange={setPerms} />
            ) : (
              <p className="text-xs text-muted-foreground">No limit — a user gets whatever their role allows.</p>
            )}
            {limited && <p className="text-[11px] text-muted-foreground">A user's role and personal rights can never go beyond what is ticked here.</p>}
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
