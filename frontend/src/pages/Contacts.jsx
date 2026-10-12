import { useEffect, useState } from "react";
import { contactsApi, leadsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, ErrorBox, Avatar, DataTable, Modal, IconBtn, Chip, Confirm } from "../components/ui";
import { labelCls } from "../components/lead/leadUtils";

export default function Contacts() {
  const toast = useToast();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const PER_PAGE = 50;
  const list = useApi(() => contactsApi.list({ q: search, page, perPage: PER_PAGE }), [search, page]);
  const total = list.raw?.total || 0;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  // search a moment after typing stops
  useEffect(() => {
    const t = setTimeout(() => { setSearch(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function remove() {
    setBusy(true);
    try { await contactsApi.remove(removing._id); toast("Contact deleted"); setRemoving(null); list.reload(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  async function toLead(c) {
    try {
      const res = await leadsApi.convert({ name: c.name, phone: c.phone, email: c.email, contactId: c._id, tags: c.tags });
      toast(res.data.created ? "Lead created" : "Already a lead — enquiry recorded");
    } catch (e) { toast(e.message, "error"); }
  }

  const columns = [
    { key: "name", label: "Contact", render: (c) => (
      <div className="d-flex align-items-center gap-2"><Avatar name={c.name} size={30} /><div><div className="row-name">{c.name}</div><div className="row-sub">{c.phone}</div></div></div>
    ) },
    { key: "email", label: "Email", render: (c) => <span className="text-muted-foreground">{c.email || "—"}</span> },
    { key: "category", label: "Category", render: (c) => c.category || "—" },
    { key: "tags", label: "Tags", render: (c) => <span className="inline-flex gap-1">{(c.tags || []).slice(0, 2).map((t) => <Chip key={t}>{t}</Chip>)}</span> },
    { key: "stage", label: "Stage", render: (c) => c.lifecycleStage },
    { key: "value", label: "Value", align: "right", render: (c) => "₹" + (c.value || 0).toLocaleString("en-IN") },
    { key: "optIn", label: "Opt-in", render: (c) => (c.optIn ? <Chip color="var(--success)">Opted in</Chip> : <Chip color="var(--destructive)">Opted out</Chip>) },
    { key: "act", label: "", align: "right", render: (c) => (
      <span className="inline-flex gap-1">
        {can("leads", "create") && <IconBtn icon="flag" title="Make a lead" onClick={() => toLead(c)} />}
        {can("contacts", "edit") && <IconBtn icon="pencil" title="Edit" onClick={() => setEditing(c)} />}
        {can("contacts", "del") && <IconBtn icon="trash" title="Delete" danger onClick={() => setRemoving(c)} />}
      </span>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Contacts"
        actions={can("contacts", "create") && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setEditing({})}><i className="bi bi-plus-lg"></i>Add contact</button>} />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="ui-search flex-1" style={{ maxWidth: 340 }}>
          <span className="ui-search-icon"><i className="bi bi-search"></i></span>
          <input className="ui-search-input" placeholder="Name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <ErrorBox error={list.error} />
      <DataTable columns={columns} rows={list.data} loading={list.loading && !list.data} empty={{ icon: "people", text: "No contacts." }} />
      <div className="flex items-center justify-between gap-2 mt-2 text-xs text-muted-foreground">
        <span>{total ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} of ${total}` : "0 contacts"}</span>
        <span className="inline-flex items-center gap-2">
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} title="Previous"><i className="bi bi-chevron-left"></i></button>
          {page} / {pages}
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} title="Next"><i className="bi bi-chevron-right"></i></button>
        </span>
      </div>
      {editing && <ContactModal contact={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
      {removing && <Confirm danger title={`Delete ${removing.name}?`} confirmLabel="Delete" busy={busy} onCancel={() => setRemoving(null)} onConfirm={remove} />}
    </div>
  );
}

function ContactModal({ contact, onClose, onSaved }) {
  const toast = useToast();
  const isNew = !contact._id;
  const [form, setForm] = useState({
    name: contact.name || "", phone: contact.phone || "", email: contact.email || "",
    category: contact.category || "Admission", lifecycleStage: contact.lifecycleStage || "Lead",
    value: contact.value || 0, optIn: contact.optIn !== false, tags: (contact.tags || []).join(", "),
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const [saving, setSaving] = useState(false);
  async function save() {
    const payload = { ...form, name: form.name.trim(), phone: form.phone.replace(/[^\d+]/g, ""), value: Number(form.value) || 0, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
    setSaving(true);
    try { if (isNew) await contactsApi.create(payload); else await contactsApi.update(contact._id, payload); toast("Contact saved"); onSaved(); }
    catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }
  const field = (k, label, props = {}) => (
    <div><label className={labelCls}>{label}</label><input className="ui-input w-full" value={form[k]} onChange={(e) => set(k, e.target.value)} {...props} /></div>
  );
  return (
    <Modal title={isNew ? "Add contact" : "Edit contact"} onClose={onClose}
      footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={saving || !form.name.trim() || form.phone.replace(/\D/g, "").length < 7} onClick={save}>{saving ? "Saving…" : "Save"}</button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("name", "Name *")}
        {field("phone", "Phone *", { type: "tel", placeholder: "+91" })}
        {field("email", "Email", { type: "email" })}
        {field("category", "Category")}
        <div><label className={labelCls}>Stage</label><select className="ui-input w-full" value={form.lifecycleStage} onChange={(e) => set("lifecycleStage", e.target.value)}><option>Lead</option><option>Prospect</option><option>Customer</option></select></div>
        {field("value", "Value (₹)", { type: "number", min: 0 })}
        <div className="sm:col-span-2">{field("tags", "Tags", { placeholder: "Comma separated" })}</div>
        <label className="sm:col-span-2 flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={form.optIn} onChange={(e) => set("optIn", e.target.checked)} />Agreed to receive marketing messages</label>
      </div>
    </Modal>
  );
}
