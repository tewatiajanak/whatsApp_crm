import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Building2, Download, KeyRound, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useIsMobile } from "@/hooks/use-mobile";
import DateInput from "../../components/DateInput";
import { fmtDate } from "@/utils/date";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchInput, UIButton } from "../components/UIKit";
import { LABEL, Pill, TH, Toggle } from "../user-management/shared";
import EmployeePicker from "./EmployeePicker";
import { PageTitle, PersonAvatar, type Employee } from "./shared";

type Contact = { _id?: string; name: string; designation: string; email: string; mobile: string; primary: boolean; portalAccess: boolean };
type Client = {
  _id: string; name: string; code: string; address: string; city: string; state: string; agreementDate?: string; status: string;
  accountManager?: { _id: string; name: string; photo?: string } | null;
  products: { _id: string; name: string; code: string }[];
  contacts: Contact[];
};
type Form = { name: string; code: string; address: string; city: string; state: string; agreementDate: string; status: string; accountManager: string; products: string[]; contacts: Contact[] };
const EMPTY: Form = { name: "", code: "", address: "", city: "", state: "", agreementDate: "", status: "Active", accountManager: "", products: [], contacts: [] };
const NEW_CONTACT: Contact = { name: "", designation: "", email: "", mobile: "", primary: false, portalAccess: false };

/** Project Management → Clients: client companies and their contacts (SPOCs). */
export default function ClientsPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const isMobile = useIsMobile();
  const { hasRight } = useAuth() as any;
  const canAdd = hasRight("clients", "create");
  const canEdit = hasRight("clients", "edit");
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<{ _id: string; name: string; active: boolean }[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await pmApi.clients();
      setClients(res?.data ?? []);
    } catch (e: any) {
      toast(e?.message || "Could not load clients", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    pmApi.products().then((r: any) => setProducts(r?.data ?? [])).catch(() => {});
    pmApi.employees().then((r: any) => setEmployees(r?.data ?? [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter(
      (c) =>
        (!status || c.status === status) &&
        (!productFilter || c.products.some((p) => p._id === productFilter)) &&
        (!q || `${c.name} ${c.code} ${c.city} ${c.contacts.map((x) => x.name).join(" ")}`.toLowerCase().includes(q))
    );
  }, [clients, search, status, productFilter]);
  const primaryOf = (c: Client) => c.contacts.find((x) => x.primary) || c.contacts[0];

  // a new client starts with one SPOC to fill in
  const openAdd = () => { setEditing(null); setForm({ ...EMPTY, contacts: [{ ...NEW_CONTACT, primary: true }] }); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm({
      name: c.name, code: c.code, address: c.address, city: c.city, state: c.state, agreementDate: c.agreementDate || "", status: c.status,
      accountManager: c.accountManager?._id || "", products: c.products.map((p) => p._id), contacts: c.contacts.map((x) => ({ ...x })),
    });
  };
  const setContact = (i: number, patch: Partial<Contact>) =>
    setForm((f) => (f ? { ...f, contacts: f.contacts.map((c, j) => (j === i ? { ...c, ...patch } : patch.primary ? { ...c, primary: false } : c)) } : f));

  const save = async () => {
    if (!form?.name.trim() || !form.code.trim()) return;
    setSaving(true);
    try {
      // a SPOC left completely empty is not saved
      const body = { ...form, accountManager: form.accountManager || null, contacts: form.contacts.filter((c) => c._id || c.name.trim() || c.email.trim() || c.mobile.trim() || c.designation.trim()) };
      if (editing) await pmApi.updateClient(editing._id, body);
      else await pmApi.createClient(body);
      toast("Saved");
      setForm(null);
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (c: Client) => {
    if (!window.confirm(`Delete the client ${c.name}?`)) return;
    try {
      await pmApi.removeClient(c._id);
      toast("Deleted");
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not delete", "error");
    }
  };

  const [logins, setLogins] = useState<any[]>([]);
  const loadLogins = () => hasRight("portal_users", "view") && pmApi.portalUsers().then((r: any) => setLogins(r?.data ?? [])).catch(() => {});
  useEffect(() => {
    loadLogins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loginOf = (c: Contact) => logins.find((u) => u.email === c.email);
  const createLogin = async (c: Contact) => {
    if (!editing || !c._id) return;
    try {
      const res: any = await pmApi.createPortalUser(editing._id, c._id);
      toast(`Portal login created. Password: ${res.data.passwordRule}${res.data.mustChangePassword ? " (must be changed at first sign-in)" : ""}`);
      loadLogins();
    } catch (e: any) {
      toast(e?.message || "Could not create the login", "error");
    }
  };
  const toggleLogin = async (u: any) => {
    try {
      await pmApi.updatePortalUser(u._id, { status: u.status === "Active" ? "Inactive" : "Active" });
      loadLogins();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    }
  };

  const exportExcel = () => {
    const rows = filtered.map((c) => {
      const p = primaryOf(c);
      return {
        Client: c.name, Code: c.code, City: c.city, State: c.state, "Date of Agreement": c.agreementDate ? fmtDate(c.agreementDate) : "", "Account Manager": c.accountManager?.name || "", Products: c.products.map((x) => x.name).join(", "),
        "SPOC": p?.name || "", Email: p?.email || "", Mobile: p?.mobile || "", SPOCs: c.contacts.length, Status: c.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0] || { a: 1 }).map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Clients");
    XLSX.writeFile(wb, "clients.xlsx");
  };

  const actions = (c: Client) => (
    <div className="inline-flex items-center gap-1">
      {canEdit && <UIButton size="icon-sm" variant="ghost" title="Edit" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></UIButton>}
      {hasRight("clients", "del") && <UIButton size="icon-sm" variant="danger" title="Delete" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5" /></UIButton>}
    </div>
  );

  return (
    <>
      <PageTitle
        icon={<Building2 className="h-4 w-4" />}
        title="Clients"
        actions={
          <div className="flex items-center gap-2">
            {hasRight("clients", "export") && <UIButton variant="outline" onClick={exportExcel} disabled={!filtered.length} leftIcon={<Download className="h-3.5 w-3.5" />}>Export Excel</UIButton>}
            {canAdd && <UIButton onClick={openAdd} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add client</UIButton>}
          </div>
        }
      />

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" containerClassName="flex-1 min-w-[200px] max-w-md" />
        <select className="ui-input" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
          <option value="">All products</option>
          {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
        <select className="ui-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{loading ? "Loading…" : `${filtered.length} of ${clients.length}`}</span>
      </div>

      {!loading && filtered.length === 0 && (
        <div className="mt-3 rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No clients
          {canAdd && !clients.length && <div className="mt-3"><UIButton size="sm" onClick={openAdd} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add client</UIButton></div>}
        </div>
      )}

      {filtered.length > 0 && isMobile && (
        <div className="mt-3 space-y-2">
          {filtered.map((c) => {
            const p = primaryOf(c);
            return (
              <div key={c._id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">{[c.code, c.city].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Pill tone={c.status === "Active" ? "success" : "muted"}>{c.status}</Pill>
                </div>
                {c.products.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{c.products.map((x) => <Pill key={x._id} tone="info">{x.name}</Pill>)}</div>}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="min-w-0 text-xs text-muted-foreground truncate">{p ? `${p.name}${p.mobile ? ` · ${p.mobile}` : ""}` : "—"}</div>
                  {actions(c)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && !isMobile && (
        <div className="mt-3 rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                  <th className={TH}>Client</th>
                  <th className={TH}>City</th>
                  <th className={TH}>Account manager</th>
                  <th className={TH}>Products</th>
                  <th className={TH}>SPOC</th>
                  <th className={TH}>Status</th>
                  <th className="px-4 py-3 font-medium" style={{ width: 96, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const p = primaryOf(c);
                  return (
                    <tr key={c._id} className="border-t hover:bg-accent/30">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground">{c.name}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">{c.code}</div>
                      </td>
                      <td className="px-4 py-2.5">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="px-4 py-2.5">
                        {c.accountManager ? (
                          <span className="inline-flex items-center gap-2"><PersonAvatar name={c.accountManager.name} photo={c.accountManager.photo} size={24} />{c.accountManager.name}</span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5"><div className="flex flex-wrap gap-1">{c.products.length ? c.products.map((x) => <Pill key={x._id} tone="info">{x.name}</Pill>) : "—"}</div></td>
                      <td className="px-4 py-2.5">
                        {p ? (
                          <>
                            <div className="text-foreground">{p.name}{c.contacts.length > 1 && <span className="ml-1.5 text-[11px] text-muted-foreground">+{c.contacts.length - 1}</span>}</div>
                            <div className="text-xs text-muted-foreground">{p.email || p.mobile}</div>
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5"><Pill tone={c.status === "Active" ? "success" : "muted"}>{c.status}</Pill></td>
                      <td className="px-4 py-2.5" style={{ textAlign: "right" }}>{actions(c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{editing ? "Edit client" : "Add client"}</SheetTitle></SheetHeader>
          {form && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Client name *</label>
                  <input autoFocus className="ui-input w-full" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL}>Code *</label>
                  <input className="ui-input w-full" value={form.code} maxLength={20} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>Address</label>
                  <input className="ui-input w-full" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL}>City</label>
                  <input className="ui-input w-full" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL}>State</label>
                  <input className="ui-input w-full" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </div>
                <div>
                  <label className={LABEL}>Account manager</label>
                  <EmployeePicker employees={employees} value={form.accountManager} onChange={(id) => setForm({ ...form, accountManager: id })} />
                </div>
                <div>
                  <label className={LABEL}>Status</label>
                  <select className="ui-input w-full" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Date of agreement</label>
                  <DateInput className="ui-input w-full" value={form.agreementDate} onChange={(e: any) => setForm({ ...form, agreementDate: e.target.value })} />
                </div>
              </div>

              <div>
                <label className={LABEL}>Products</label>
                <div className="flex flex-wrap gap-1.5">
                  {products.filter((p) => p.active || form.products.includes(p._id)).map((p) => {
                    const on = form.products.includes(p._id);
                    return (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => setForm({ ...form, products: on ? form.products.filter((x) => x !== p._id) : [...form.products, p._id] })}
                        className="rounded-lg border px-3 py-1.5 text-[13px]"
                        style={on ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" } : { background: "transparent", color: "var(--foreground)" }}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                  {products.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={LABEL} style={{ marginBottom: 0 }}>SPOC</label>
                  <UIButton size="sm" variant="outline" onClick={() => setForm({ ...form, contacts: [...form.contacts, { ...NEW_CONTACT, primary: form.contacts.length === 0 }] })} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add SPOC</UIButton>
                </div>
                <div className="space-y-2">
                  {form.contacts.map((c, i) => (
                    <div key={i} className="rounded-lg border p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className={LABEL}>Name *</label>
                          <input className="ui-input w-full" value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                        </div>
                        <div>
                          <label className={LABEL}>Mobile number</label>
                          <input type="tel" inputMode="numeric" className="ui-input w-full" value={c.mobile} maxLength={16} onChange={(e) => setContact(i, { mobile: e.target.value.replace(/[^\d+ -]/g, "") })} />
                        </div>
                        <div>
                          <label className={LABEL}>Email</label>
                          <input type="email" className="ui-input w-full" value={c.email} onChange={(e) => setContact(i, { email: e.target.value })} />
                        </div>
                        <div>
                          <label className={LABEL}>Designation</label>
                          <input className="ui-input w-full" value={c.designation} onChange={(e) => setContact(i, { designation: e.target.value })} />
                        </div>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
                        <button type="button" onClick={() => setContact(i, { primary: true })} className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ background: "transparent", border: 0, padding: 0, color: c.primary ? "var(--primary)" : "var(--muted-foreground)" }}>
                          <Star className="h-3.5 w-3.5" fill={c.primary ? "currentColor" : "none"} /> Primary
                        </button>
                        <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                          Portal access
                          <Toggle on={c.portalAccess} onChange={() => setContact(i, { portalAccess: !c.portalAccess })} labels={["Yes", "No"]} />
                        </span>
                        {c._id && c.portalAccess && c.email && hasRight("portal_users", "view") && (
                          loginOf(c)
                            ? <button type="button" onClick={() => hasRight("portal_users", "edit") && toggleLogin(loginOf(c))} title="Portal login — click to switch on / off" style={{ background: "transparent", border: 0, padding: 0 }}><Pill tone={loginOf(c).status === "Active" ? "success" : "muted"}>Login {loginOf(c).status === "Active" ? "active" : "off"}</Pill></button>
                            : hasRight("portal_users", "create") && <UIButton size="sm" variant="outline" onClick={() => createLogin(c)} leftIcon={<KeyRound className="h-3.5 w-3.5" />}>Create login</UIButton>
                        )}
                        <span className="ml-auto">
                          <UIButton size="icon-sm" variant="ghost" title="Remove SPOC" onClick={() => setForm({ ...form, contacts: form.contacts.filter((_, j) => j !== i) })}><X className="h-3.5 w-3.5" /></UIButton>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setForm(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={save} loading={saving} disabled={!form?.name.trim() || !form?.code.trim()} className="flex-1">Save</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
