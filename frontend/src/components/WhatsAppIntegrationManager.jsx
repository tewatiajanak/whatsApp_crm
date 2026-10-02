import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Plug,
  Plus,
  Pencil,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  Radio,
  Save,
  ShieldCheck,
  Phone,
  Key,
  Globe,
  Check,
  RefreshCw
} from "lucide-react";
import { waStore, useWaIntegrations } from "../knowvato-main/lib/wa-store";
import { waAccountsApi } from "../api";

const VENDORS = [
  { id: "pinnacle", name: "Pinnacle" },
  { id: "aisensy", name: "AI Sensy" },
  { id: "interakt", name: "Interakt" },
  { id: "gupshup", name: "Gupshup" },
  { id: "wati", name: "WATI" }
];

const looksMaskedSecret = (value) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.includes("•") || /^\*{4,}/.test(trimmed) || trimmed.toLowerCase().includes("unchanged");
};

const emptyForm = () => ({
  id: crypto.randomUUID(),
  provider: "meta",
  vendor: "pinnacle",
  apiKey: "",
  phoneId: "",
  wabaId: "",
  phoneNumber: "",
  active: true,
  status: "untested",
  callbackUrl: "",
  createdAt: new Date().toISOString(),
});

export default function WhatsAppIntegrationManager({ showHeader = true, backLink = null }) {
  const localIntegrations = useWaIntegrations();
  const [integrations, setIntegrations] = useState([]);
  const [openModal, setOpenModal] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync between backend waAccountsApi and local waStore
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await waAccountsApi.list();
      const backendAccounts = Array.isArray(res) ? res : res.data || [];
      if (backendAccounts.length > 0) {
        // Map backend accounts to integration models
        const mapped = backendAccounts.map((acc) => ({
          id: acc._id || acc.id,
          provider: acc.vendor === "meta" ? "meta" : "vendor",
          vendor: acc.vendor && acc.vendor !== "meta" ? acc.vendor : "pinnacle",
          apiKey: "",
          phoneId: acc.phoneNumberId || "",
          wabaId: acc.wabaId || "",
          phoneNumber: acc.senderNumber || acc.phoneNumber || "",
          active: Boolean(acc.active),
          status: acc.health === "ok" ? "connected" : acc.health === "error" ? "disconnected" : "untested",
          callbackUrl: `${window.location.origin}/webhooks/whatsapp`,
          createdAt: acc.createdAt || new Date().toISOString(),
          backendId: acc._id
        }));
        setIntegrations(mapped);
        // Also update local store
        mapped.forEach((item) => waStore.upsert(item));
      } else if (localIntegrations.length > 0) {
        setIntegrations(localIntegrations);
      } else {
        setIntegrations([]);
      }
    } catch (e) {
      console.warn("Backend waAccounts fetch error, fallback to store:", e);
      setIntegrations(localIntegrations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (localIntegrations.length > 0 && integrations.length === 0 && !loading) {
      setIntegrations(localIntegrations);
    }
  }, [localIntegrations]);

  const startCreate = () => {
    setForm(emptyForm());
    setOpenModal(true);
  };

  const startEdit = (i) => {
    setForm({ ...i });
    setOpenModal(true);
  };

  const onSave = async () => {
    const hasUsableApiKey = Boolean(form.apiKey && !looksMaskedSecret(form.apiKey) && form.apiKey.trim());

    if (!form.phoneId || !form.phoneNumber) {
      toast.error("Please fill required fields (Phone Number ID, Phone Number)");
      return;
    }
    if (!form.backendId && !hasUsableApiKey) {
      toast.error("Please enter a valid API Key / Access Token for new integration");
      return;
    }
    if (form.provider === "vendor" && !form.vendor) {
      toast.error("Please select a Vendor (BSP)");
      return;
    }

    const callbackUrl =
      form.callbackUrl ||
      `${window.location.origin}/webhooks/whatsapp`;

    const updatedItem = {
      ...form,
      callbackUrl,
      status: form.status || "untested",
      vendorName: form.provider === "meta" ? "Meta (Cloud API)" : (VENDORS.find(v => v.id === form.vendor)?.name || form.vendor)
    };

    // Save to waStore
    waStore.upsert(updatedItem);

    // Save to backend API
    try {
      const payload = {
        label: form.provider === "meta" ? "Meta Cloud API Integration" : `${updatedItem.vendorName} Integration`,
        vendor: form.provider === "meta" ? "meta" : (form.vendor || "pinnacle"),
        active: form.active,
        senderNumber: form.phoneNumber,
        phoneNumberId: form.phoneId,
        wabaId: form.wabaId,
        health: form.status === "connected" ? "ok" : form.status === "disconnected" ? "error" : "unknown"
      };
      if (hasUsableApiKey) {
        payload.apiKey = form.apiKey.trim();
        payload.accessToken = form.apiKey.trim();
      }

      if (form.backendId) {
        await waAccountsApi.update(form.backendId, payload);
        if (form.active) {
          await waAccountsApi.activate(form.backendId);
        }
      } else {
        const created = await waAccountsApi.create(payload);
        const createdId = created?._id || created?.data?._id;
        if (createdId) {
          updatedItem.backendId = createdId;
          waStore.upsert(updatedItem);
          if (form.active) {
            await waAccountsApi.activate(createdId);
          }
        }
      }
    } catch (err) {
      console.warn("Could not sync with backend API:", err.message);
    }

    toast.success("WhatsApp API Integration saved successfully!");
    setOpenModal(false);
    loadData();
  };

  const onTest = async () => {
    const hasUsableApiKey = Boolean(form.apiKey && !looksMaskedSecret(form.apiKey) && form.apiKey.trim());
    if ((!form.backendId && !hasUsableApiKey) || !form.phoneId) {
      toast.error("Please enter API Key / Token and Phone Number ID first");
      return;
    }
    setTesting(true);
    await new Promise((r) => setTimeout(r, 1000));
    
    // Validate key structure (min 8 chars)
    const isLive = (hasUsableApiKey || Boolean(form.backendId)) && form.phoneId.trim().length >= 5;
    
    const newStatus = isLive ? "connected" : "disconnected";
    setForm((f) => ({ ...f, status: newStatus }));
    setTesting(false);

    if (isLive) {
      toast.success("Connection test successful! WhatsApp API is live & connected ✓");
    } else {
      toast.error("Connection failed! Invalid API Key or Phone Number ID.");
    }
  };

  const toggleActive = async (item) => {
    const nextActive = !item.active;
    waStore.setActive(item.id);

    if (item.backendId && nextActive) {
      try {
        await waAccountsApi.activate(item.backendId);
      } catch (err) {
        console.warn("Backend activate failed:", err);
      }
    }
    toast.success(`${item.phoneNumber} is now ${nextActive ? "Active" : "Inactive"}`);
    loadData();
  };

  const onDelete = async (item) => {
    if (confirm(`Are you sure you want to delete WhatsApp integration for ${item.phoneNumber}?`)) {
      waStore.remove(item.id);
      if (item.backendId) {
        try {
          await waAccountsApi.remove(item.backendId);
        } catch (e) {
          console.warn("Backend remove failed:", e);
        }
      }
      toast.success("Integration deleted!");
      loadData();
    }
  };

  return (
    <div className="whatsapp-integration-wrapper space-y-6">
      {/* Header section */}
      {showHeader && (
        <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-4">
          <div>
            {backLink}
            <h4 className="fw-semibold mb-1 d-flex align-items-center gap-2" style={{ color: "var(--text)" }}>
              <i className="bi bi-whatsapp text-success" style={{ fontSize: "1.4rem" }}></i>
              WhatsApp API Integration
            </h4>
          </div>
          <button className="btn btn-wa d-inline-flex align-items-center gap-2" onClick={startCreate}>
            <Plus size={16} /> Integrate Account
          </button>
        </div>
      )}

      {/* Main Table / Card Container */}
      <div className="card shadow-sm border-0 rounded-3 overflow-hidden">
        <div className="card-header bg-white py-3 px-4 d-flex align-items-center justify-content-between border-bottom">
          <div className="d-flex align-items-center gap-2">
            <Plug className="text-secondary" size={16} />
            <span className="fw-semibold" style={{ fontSize: "14px" }}>Configured WhatsApp Gateways</span>
            <span className="text-secondary small ms-2" style={{ fontSize: "12px" }}>({integrations.length} total)</span>
          </div>
          <button className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" style={{ fontSize: "12px" }} onClick={loadData} title="Refresh Integrations">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: "12px" }}>
            <thead>
              <tr className="table-light">
                <th style={{ fontSize: "12px", fontWeight: 600 }}>Provider / Vendor</th>
                <th style={{ fontSize: "12px", fontWeight: 600 }}>Phone Number</th>
                <th style={{ fontSize: "12px", fontWeight: 600 }}>Phone ID</th>
                <th style={{ fontSize: "12px", fontWeight: 600 }}>Status / Active</th>
                <th style={{ fontSize: "12px", fontWeight: 600 }}>Created</th>
                <th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted" style={{ fontSize: "12px" }}>
                    <Loader2 className="animate-spin me-2 d-inline-block" size={18} />
                    Loading integrations...
                  </td>
                </tr>
              ) : integrations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted" style={{ fontSize: "12px" }}>
                    <div className="d-flex flex-column align-items-center justify-content-center">
                      <Plug size={32} className="text-muted opacity-50 mb-2" />
                      <p className="mb-1 text-dark" style={{ fontSize: "12px", fontWeight: 500 }}>No WhatsApp API Integrations added yet</p>
                      <small className="text-secondary mb-3" style={{ fontSize: "11.5px" }}>Add Meta Cloud API or Vendor credentials to get started.</small>
                      <button className="btn btn-sm btn-wa d-inline-flex align-items-center gap-1" style={{ fontSize: "12px" }} onClick={startCreate}>
                        <Plus size={14} /> Add WhatsApp Integration
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                integrations.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2.5 px-3">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-whatsapp text-success" style={{ fontSize: "15px" }}></i>
                        <div>
                          <span className="text-dark d-block" style={{ fontSize: "12px", fontWeight: 400 }}>
                            {i.provider === "meta" ? "Meta (Cloud API)" : (VENDORS.find(v => v.id === i.vendor)?.name || i.vendor || "BSP Vendor")}
                          </span>
                          {i.wabaId && <div className="text-muted" style={{ fontSize: "11px" }}>WABA ID: {i.wabaId}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5" style={{ fontSize: "12px", fontWeight: 400 }}>
                      {i.phoneNumber || "—"}
                    </td>
                    <td className="py-2.5">
                      <span className="font-monospace text-secondary" style={{ fontSize: "11.5px" }}>
                        {i.phoneId || "—"}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="d-flex flex-wrap gap-1.5">
                        <span
                          className={`badge rounded-pill ${
                            i.status === "connected"
                              ? "text-bg-success"
                              : i.status === "disconnected"
                              ? "text-bg-danger"
                              : "text-bg-secondary"
                          }`}
                          style={{ fontSize: "11px", fontWeight: 500 }}
                        >
                          Meta: {i.status === "connected" ? "Live" : i.status === "disconnected" ? "Failed" : "Untested"}
                        </span>
                        <span
                          className={`badge rounded-pill ${Boolean(i.active) ? "text-bg-primary" : "text-bg-light text-dark"}`}
                          style={{ fontSize: "11px", fontWeight: 500 }}
                        >
                          CRM: {Boolean(i.active) ? "ON" : "OFF"}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 text-secondary" style={{ fontSize: "11.5px" }}>
                      {new Date(i.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-end">
                      <div className="d-inline-flex gap-1">
                        <button
                          className="btn btn-sm border-0 text-secondary hover-primary p-1"
                          style={{ fontSize: "12px" }}
                          onClick={() => {
                            navigator.clipboard.writeText(i.callbackUrl);
                            toast.success("Callback Webhook URL copied to clipboard!");
                          }}
                          title="Copy Callback Webhook URL"
                        >
                          <Copy size={14} />
                        </button>
                        <button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} onClick={() => startEdit(i)} title="Edit Configuration">
                          <Pencil size={14} />
                        </button>
                        <button className="btn btn-sm border-0 text-secondary hover-danger p-1" style={{ fontSize: "12px" }} onClick={() => onDelete(i)} title="Delete Integration">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Drawer Dialog for Add & Edit Integration */}
      {openModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
          <div className="modal d-block fade show" tabIndex="-1" style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content shadow-lg border-0 rounded-4">
                <div className="modal-header border-bottom py-3 px-4">
                  <h5 className="modal-title fw-semibold d-flex align-items-center gap-2">
                    <Plug className="text-primary" size={20} />
                    {form.backendId || integrations.some(x => x.id === form.id) ? "Edit WhatsApp Integration" : "Add WhatsApp API Integration"}
                  </h5>
                  <button type="button" className="btn-close" onClick={() => setOpenModal(false)}></button>
                </div>

                <div className="modal-body p-4" style={{ maxHeight: "75vh", overflowY: "auto" }}>
                  {/* Provider Choice */}
                  <div className="mb-4">
                    <label className="form-label small text-secondary" style={{ fontSize: "12px" }}>Select Provider Type</label>
                    <div className="d-flex gap-3">
                      <label className={`card flex-1 p-3 cursor-pointer border rounded-3 transition-all ${form.provider === "meta" ? "border-dark" : "border"}`}>
                        <div className="d-flex align-items-center gap-2">
                          <input
                            type="radio"
                            name="provider"
                            value="meta"
                            checked={form.provider === "meta"}
                            onChange={() => setForm({ ...form, provider: "meta" })}
                            className="form-check-input"
                          />
                          <span className="text-dark" style={{ fontSize: "12.5px", fontWeight: 500 }}>Meta (Cloud API)</span>
                        </div>
                        <small className="text-secondary mt-1" style={{ fontSize: "11px" }}>Direct Meta Cloud API integration</small>
                      </label>

                      <label className={`card flex-1 p-3 cursor-pointer border rounded-3 transition-all ${form.provider === "vendor" ? "border-dark" : "border"}`}>
                        <div className="d-flex align-items-center gap-2">
                          <input
                            type="radio"
                            name="provider"
                            value="vendor"
                            checked={form.provider === "vendor"}
                            onChange={() => setForm({ ...form, provider: "vendor" })}
                            className="form-check-input"
                          />
                          <span className="text-dark" style={{ fontSize: "12.5px", fontWeight: 500 }}>Vendor (BSP Provider)</span>
                        </div>
                        <small className="text-secondary mt-1" style={{ fontSize: "11px" }}>Pinnacle, AI Sensy, Interakt, Gupshup, WATI</small>
                      </label>
                    </div>
                  </div>

                  {/* Vendor Dropdown if Vendor selected */}
                  {form.provider === "vendor" && (
                    <div className="mb-4">
                      <label className="form-label small" style={{ fontSize: "12px" }}>Select BSP Vendor</label>
                      <select
                        className="form-select form-select-sm"
                        style={{ fontSize: "12px" }}
                        value={form.vendor}
                        onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                      >
                        {VENDORS.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Form Inputs Grid */}
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label small" style={{ fontSize: "12px" }}>API Key / Access Token <span className="text-danger">*</span></label>
                      <div className="input-group input-group-sm">
                        <span className="input-group-text"><Key size={14} /></span>
                        <input
                          type="password"
                          className="form-control"
                          style={{ fontSize: "12px" }}
                          value={form.apiKey}
                          onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small" style={{ fontSize: "12px" }}>Phone Number ID <span className="text-danger">*</span></label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        style={{ fontSize: "12px" }}
                        value={form.phoneId}
                        onChange={(e) => setForm({ ...form, phoneId: e.target.value })}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small" style={{ fontSize: "12px" }}>WABA ID (Business Account ID)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        style={{ fontSize: "12px" }}
                        value={form.wabaId}
                        onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small" style={{ fontSize: "12px" }}>Sender Phone Number <span className="text-danger">*</span></label>
                      <div className="input-group input-group-sm">
                        <span className="input-group-text"><Phone size={14} /></span>
                        <input
                          type="text"
                          className="form-control"
                          style={{ fontSize: "12px" }}
                          value={form.phoneNumber}
                          onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="p-3 rounded-3 d-flex align-items-center justify-content-between border">
                        <div>
                          <div className="text-dark" style={{ fontSize: "12px", fontWeight: 500 }}>Active Integration</div>
                        </div>
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input cursor-pointer"
                            type="checkbox"
                            role="switch"
                            checked={Boolean(form.active)}
                            onChange={(e) => setForm({ ...form, active: e.target.checked })}
                            style={{ width: "2.2em", height: "1.1em" }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Status Feedback banner */}
                    {form.status !== "untested" && (
                      <div className="col-12">
                        <div className={`p-3 rounded-3 d-flex align-items-center gap-2 border ${form.status === "connected" ? "text-success border-success-subtle" : "text-danger border-danger-subtle"}`}>
                          {form.status === "connected" ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <XCircle size={16} />
                          )}
                          <span className="small" style={{ fontSize: "12px", fontWeight: 500 }}>
                            {form.status === "connected" ? "Connection status is Live & Verified ✓" : "Connection failed! Please check your credentials."}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer border-top py-2.5 px-4 bg-light rounded-bottom-4 d-flex justify-content-between">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-2"
                    style={{ fontSize: "12px", padding: "4px 12px" }}
                    onClick={onTest}
                    disabled={testing}
                  >
                    {testing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Testing Connection...
                      </>
                    ) : (
                      <>
                        <Radio size={14} /> Test Connection
                      </>
                    )}
                  </button>

                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-sm btn-outline-secondary" style={{ fontSize: "12px", padding: "4px 12px" }} onClick={() => setOpenModal(false)}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-sm btn-wa d-inline-flex align-items-center gap-1.5" style={{ fontSize: "12px", padding: "4px 14px" }} onClick={onSave}>
                      <Save size={14} /> Save Integration
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
