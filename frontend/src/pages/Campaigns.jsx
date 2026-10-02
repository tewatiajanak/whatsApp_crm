import { useState } from "react";
import { campaignsApi, templatesApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, ErrorBox, DataTable, Modal } from "../components/ui";

// neutral status pill colours (meaning only)
const STATUS_STYLE = {
  Running: { background: "var(--ok-bg)", color: "var(--ok)" },
  Scheduled: { background: "var(--info-bg)", color: "var(--info)" },
  Completed: { background: "var(--pill-bg)", color: "var(--pill-ink)" },
  Paused: { background: "var(--warn-bg)", color: "var(--warn)" },
  Draft: { background: "var(--pill-bg)", color: "var(--pill-ink)" },
};

export default function Campaigns() {
  const toast = useToast();
  const { can } = useAuth();
  const list = useApi(() => campaignsApi.list({ perPage: 100 }), []);
  const [creating, setCreating] = useState(false);

  async function launch(id) {
    try { const r = await campaignsApi.launch(id); toast(r.data?.scheduled ? "Scheduled" : `Launched (${r.data?.queued || 0} recipients)`); list.reload(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function pause(c) {
    try { await campaignsApi.pause(c._id, c.status === "Running" ? "Paused" : "Running"); list.reload(); }
    catch (e) { toast(e.message, "error"); }
  }

  const columns = [
    { key: "name", label: "Campaign", render: (c) => <span className="row-name">{c.name}</span> },
    { key: "template", label: "Template", render: (c) => <span className="small font-monospace">{c.template}</span> },
    { key: "status", label: "Status", render: (c) => <span className="pill" style={STATUS_STYLE[c.status]}>{c.status}</span> },
    { key: "sent", label: "Sent", align: "right", render: (c) => c.sent },
    { key: "delivered", label: "Delivered", align: "right", render: (c) => c.delivered },
    { key: "read", label: "Read", align: "right", render: (c) => c.read },
    { key: "failed", label: "Failed", align: "right", render: (c) => <span style={{ color: c.failed ? "var(--err)" : "inherit" }}>{c.failed}</span> },
    { key: "act", label: "", align: "right", render: (c) => (
      <>
        {can("blast", "create") && (c.status === "Draft" || c.status === "Scheduled") && <button className="btn btn-sm btn-wa me-1" onClick={(e) => { e.stopPropagation(); launch(c._id); }}><i className="bi bi-play-fill"></i> Launch</button>}
        {can("blast", "edit") && (c.status === "Running" || c.status === "Paused") && <button className="btn btn-sm btn-outline-secondary" onClick={(e) => { e.stopPropagation(); pause(c); }}>{c.status === "Running" ? "Pause" : "Resume"}</button>}
      </>
    ) },
  ];

  return (
    <div>
      <PageHeader title="Bulk Campaigns"
        actions={can("blast", "create") && <button className="btn btn-wa btn-sm" onClick={() => setCreating(true)}><i className="bi bi-plus-lg me-1"></i>New Campaign</button>} />
      <ErrorBox error={list.error} />
      <DataTable columns={columns} rows={list.data} loading={list.loading} empty={{ icon: "send", text: "No campaigns yet." }} />
      {creating && <CreateCampaign onClose={() => setCreating(false)} onSaved={() => { setCreating(false); list.reload(); }} />}
    </div>
  );
}

function CreateCampaign({ onClose, onSaved }) {
  const toast = useToast();
  const templates = useApi(() => templatesApi.list({ status: "Approved" }), []);
  const [form, setForm] = useState({ name: "", template: "", category: "Utility" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  async function save() {
    try { await campaignsApi.create(form); toast("Campaign created"); onSaved(); } catch (e) { toast(e.message, "error"); }
  }
  return (
    <Modal title="New Campaign" onClose={onClose}
      footer={<><button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button><button className="btn btn-wa" disabled={!form.name || !form.template} onClick={save}>Create</button></>}>
      <div className="row g-3">
        <div className="col-12"><label className="form-label">Name</label><input className="form-control" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="col-6"><label className="form-label">Template</label><select className="form-select" value={form.template} onChange={(e) => set("template", e.target.value)}><option value="">—</option>{(templates.data || []).map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}</select></div>
        <div className="col-6"><label className="form-label">Category</label><select className="form-select" value={form.category} onChange={(e) => set("category", e.target.value)}><option>Utility</option><option>Marketing</option><option>Authentication</option></select></div>
      </div>
      <div className="text-muted small mt-2">Audience = opted-in contacts in this category. Launch from the list to send.</div>
    </Modal>
  );
}
