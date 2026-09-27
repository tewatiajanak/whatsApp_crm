import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { mastersApi, servicesApi, sessionsApi, gradesApi, teamsApi, workflowsApi, workflowConfigApi, usersApi, templatesApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Tabs, Modal, IconBtn } from "../components/ui";
import RegistrationFormBuilder from "../components/RegistrationFormBuilder";
import LandingPageBuilder from "../components/LandingPageBuilder";
import LandingPageWizard from "../components/LandingPageWizard";
import ThemeSwitcher from "../components/ThemeSwitcher";
import WhatsAppTemplateBuilder from "../components/WhatsAppTemplateBuilder";
import WhatsAppIntegrationManager from "../components/WhatsAppIntegrationManager";
import FacebookIntegrationManager from "../components/FacebookIntegrationManager";

const DEFAULT_LANDING_PAGE_CONFIG = {
  brandName: "Your Institution",
  heroTitle: "Welcome to a better admissions experience",
  heroSubtitle: "Show your programs, benefits, and next steps in one polished page for families and prospects.",
  heroCtaLabel: "Book a Visit",
  heroCtaLink: "#contact",
  accentColor: "#0085a8",
  highlightTitle: "Why families choose us",
  features: [
    "Instant WhatsApp follow-up",
    "Simple enquiry capture",
    "Track every conversation in one place"
  ]
};

const CATEGORIES = [
  {
    id: "general",
    title: "General",
    color: "#0f172a",
    items: [
      { id: "organization-details", label: "Organization Details" }
    ]
  },
  {
    id: "lead-config",
    title: "Lead Configuration",
    color: "#0f172a",
    items: [
      { id: "offerings", label: "Offerings" },
      { id: "status", label: "Lead Statuses" },
      { id: "sources", label: "Sources" }
    ]
  },
  {
    id: "forms",
    title: "Forms",
    color: "#0f172a",
    items: [
      { id: "enquiry-form", label: "Enquiry Form" },
      { id: "registration-form", label: "Registration Form" },
      { id: "landing-page", label: "Landing Page" }
    ]
  },
  {
    id: "ui",
    title: "UI",
    color: "#0f172a",
    items: [
      { id: "ui-theme", label: "Theme Customization" }
    ]
  },
  {
    id: "academic",
    title: "Academic Setup",
    color: "#0f172a",
    items: [
      { id: "sessions", label: "Academic Sessions" },
      { id: "grades", label: "Grades" }
    ]
  },
  {
    id: "workflow",
    title: "Workflows",
    color: "#0f172a",
    items: [
      { id: "workflows", label: "Workflows" },
      { id: "comm-templates", label: "Communication Templates" },
      { id: "teams", label: "Teams" }
    ]
  },
  {
    id: "integrations",
    title: "Integrations",
    color: "#0f172a",
    items: [
      { id: "ai-integration", label: "AI Integration" },
      { id: "whatsapp-integration", label: "WhatsApp Integration" },
      { id: "facebook-integration", label: "Facebook Integration" },
      { id: "google-form", label: "Google Form" },
      { id: "api-integration", label: "API Integration" }
    ]
  }
];
const COLORS = ["#0085a8", "#00586f", "#2e7d57", "#9a6700", "#b3261e", "#1f5f8b", "#5b4b8a", "#7a5c2e", "#41505f", "#6b7280"];

export default function Setup() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const getActiveSection = () => {
    const params = new URLSearchParams(location.search);
    return params.get("active") || "offerings";
  };
  const getMode = () => {
    const params = new URLSearchParams(location.search);
    return params.get("mode") || "list";
  };
  const [selected, setSelected] = useState(getActiveSection);
  const [mode, setMode] = useState(getMode);

  const [openCategories, setOpenCategories] = useState({
    general: true,
    "lead-config": true,
    forms: true,
    ui: true,
    academic: true,
    workflow: true,
    integrations: true,
  });

  useEffect(() => {
    const active = getActiveSection();
    setSelected(active);
    const currentMode = getMode();
    if (currentMode !== mode) {
      setMode(currentMode);
    }
  }, [location.search]);

  const toggleCategory = (categoryId) => {
    setOpenCategories((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const selectSection = (item) => {
    const id = typeof item === "string" ? item : item.id;
    setSelected(id);
    setMode("list");
    navigate(`/crm/setup?active=${id}&mode=list`);
  };

  const hideSidebar = (selected === "registration-form" || selected === "landing-page" || selected === "whatsapp-templates") && mode === "editor";

  return (
    <div style={{ padding: "4px" }}>
      <div style={hideSidebar ? { display: "block", marginBottom: "4px" } : { display: "grid", gridTemplateColumns: "minmax(240px, 260px) minmax(0, 1fr)", gap: "4px", marginBottom: "4px" }}>
        {!hideSidebar && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", position: "sticky", top: "70px", maxHeight: "calc(100vh - 86px)", overflowY: "auto", paddingRight: "2px", zIndex: 5 }}>
            {CATEGORIES.map((cat) => (
              <div key={cat.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", background: "var(--surface)", overflow: "visible", width: "100%", height: "auto", minHeight: "fit-content", maxHeight: "none" }}>
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "10px 14px",
                    border: "none",
                    background: "transparent",
                    color: "var(--text)",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.title}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-2)", whiteSpace: "nowrap" }}>{cat.items.length} options</div>
                  </div>
                  <i className={`bi bi-chevron-${openCategories[cat.id] ? "down" : "right"}`} style={{ fontSize: 13, color: "var(--text-2)", flexShrink: 0 }}></i>
                </button>

                {openCategories[cat.id] && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "2px 8px 8px", height: "auto", minHeight: "fit-content", maxHeight: "none", overflow: "visible" }}>
                    {cat.items.map((item) => {
                      const isSelected = selected === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectSection(item)}
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            border: "none",
                            borderLeft: isSelected ? "3px solid var(--text)" : "3px solid transparent",
                            background: isSelected ? "var(--surface-2)" : "transparent",
                            color: isSelected ? "var(--text)" : "var(--text-2)",
                            fontWeight: isSelected ? 500 : 400,
                            textAlign: "left",
                            borderRadius: "4px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "8px",
                            transition: "all 0.15s ease"
                          }}
                        >
                          <span style={{ fontSize: "12.5px", whiteSpace: "nowrap" }}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: "0 0 0 0" }}>
          {selected === "organization-details" && <OrganizationDetails />}
          {selected === "offerings" && <ServicesMaster />}
          {selected === "status" && <CombinedStatusMaster />}
          {selected === "sources" && <SourceMaster />}
          {selected === "registration-form" && <RegistrationFormConfig />}
          {selected === "enquiry-form" && <EnquiryFormConfig />}
          {selected === "landing-page" && <LandingPageTab />}
          {selected === "ui-theme" && <ThemeSwitcher />}
          {selected === "sessions" && <AcademicSessions />}
          {selected === "grades" && <Grades />}
          {selected === "teams" && <Teams />}
          {selected === "workflows" && <WorkflowsTab />}
          {selected === "comm-templates" && <CommunicationTemplatesConfig />}
          {selected === "whatsapp-templates" && <WhatsAppTemplatesSetup />}
          {selected === "ai-integration" && <AIIntegrationSetupCard />}
          {selected === "whatsapp-integration" && <WhatsAppIntegrationManager />}
          {(selected === "facebook" || selected === "facebook-integration") && <FacebookIntegrationManager />}
          {selected === "google-form" && <IntegrationPlaceholder title="Google Form" />}
          {selected === "api-integration" && <IntegrationPlaceholder title="API Integration" />}
        </div>
      </div>
    </div>
  );
}

function ServicesMaster() {
  const toast = useToast();
  const list = useApi(() => servicesApi.list(), []);
  const [edit, setEdit] = useState(null);
  const ICONS = ["grid", "whatsapp", "calendar-event", "mortarboard", "globe", "envelope", "people", "cash-coin", "bus-front", "book"];
  async function save(f) {
    try {
      if (f._id) await servicesApi.update(f._id, f);
      else await servicesApi.create({ ...f, key: f.key || f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), order: (list.data?.length || 0) + 1 });
      toast("Saved"); setEdit(null); list.reload();
    } catch (e) { toast(e.message, "error"); }
  }
  async function remove(id) { if (confirm("Delete this offering?")) { try { await servicesApi.remove(id); toast("Deleted"); list.reload(); } catch (e) { toast(e.message, "error"); } } }
  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header d-flex justify-content-between align-items-center">
        <div><span className="fw-semibold">Offerings</span><div className="text-muted small">Pipelines a lead can be in. Each can have its own statuses.</div></div>
        <button className="btn btn-sm btn-wa" onClick={() => setEdit({ name: "", color: COLORS[0], icon: "grid", isRecurring: false })}>Add offering</button>
      </div>
      <ErrorBox error={list.error} />
      <div className="table-responsive"><table className="table mb-0 align-middle">
        <thead><tr><th>Offering</th><th>Frequency</th><th></th></tr></thead>
        <tbody>
          {list.loading ? <tr><td colSpan={3}><Spinner /></td></tr> : (list.data || []).map((s) => (
            <tr key={s._id}>
              <td><span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text)" }}>{s.name}</span></td>
              <td><span style={{ fontSize: "12px", color: s.isRecurring ? "#16a34a" : "#6b7280", fontWeight: 400 }}>{s.isRecurring ? "Recurring" : "One-time"}</span></td>
              <td className="text-end"><IconBtn icon="pencil" onClick={() => setEdit(s)} />{!s.builtIn && <IconBtn icon="trash" danger onClick={() => remove(s._id)} />}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {edit && (
        <Modal title={edit._id ? "Edit offering" : "Add offering"} onClose={() => setEdit(null)}
          footer={<><button className="btn btn-outline-secondary btn-sm" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-wa btn-sm" disabled={!edit.name} onClick={() => save(edit)}>Save</button></>}>
          <label className="form-label small fw-semibold">Name</label>
          <input className="form-control form-control-sm mb-3" style={{ fontSize: "12.5px" }} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. Hostel, Transport, Scholarship" />
          <label className="form-label small fw-semibold">Colour</label>
          <div className="d-flex flex-wrap gap-2 mb-3">{COLORS.map((c) => <button key={c} onClick={() => setEdit({ ...edit, color: c })} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: edit.color === c ? "3px solid #1f2630" : "1px solid #ccc" }} />)}</div>
          <label className="form-label small fw-semibold">Icon</label>
          <div className="d-flex flex-wrap gap-2 mb-3">{ICONS.map((ic) => <button key={ic} onClick={() => setEdit({ ...edit, icon: ic })} className="btn btn-sm" style={{ border: edit.icon === ic ? "2px solid var(--accent)" : "1px solid var(--border-2)" }}><i className={`bi bi-${ic}`}></i></button>)}</div>
          <label className="form-label small fw-semibold">Frequency</label>
          <div className="d-flex gap-3">
            <div className="form-check">
              <input className="form-check-input" type="radio" id="oneTime" name="frequency" checked={!edit.isRecurring} onChange={() => setEdit({ ...edit, isRecurring: false })} />
              <label className="form-check-label small" htmlFor="oneTime">One-time</label>
            </div>
            <div className="form-check">
              <input className="form-check-input" type="radio" id="recurring" name="frequency" checked={edit.isRecurring} onChange={() => setEdit({ ...edit, isRecurring: true })} />
              <label className="form-check-label small" htmlFor="recurring">Recurring</label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CombinedStatusMaster() {
  const toast = useToast();
  const list = useApi(() => mastersApi.statuses(), []);
  const [edit, setEdit] = useState(null);
  const services = useApi(() => servicesApi.list(), []);
  const svcMap = Object.fromEntries((services.data || []).map((s) => [s._id, s]));
  const [expandedId, setExpandedId] = useState(null);

  async function save(f) {
    try {
      if (f._id) await mastersApi.updateStatus(f._id, f);
      else await mastersApi.createStatus({ ...f, order: (list.data?.length || 0) + 1 });
      toast("Saved"); setEdit(null); list.reload();
    } catch (e) { toast(e.message, "error"); }
  }

  async function removeStatus(id) { if (confirm("Delete status?")) { try { await mastersApi.removeStatus(id); toast("Deleted"); list.reload(); } catch (e) { toast(e.message, "error"); } } }

  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header d-flex justify-content-between align-items-center">
        <div><span className="fw-semibold" style={{ fontSize: "14px" }}>Lead Statuses</span><div className="text-muted small">Create statuses with sub-statuses and map to offerings.</div></div>
        <button className="btn btn-sm btn-wa" onClick={() => setEdit({ name: "", color: COLORS[0], subStatuses: [""], offerings: [], followUpRequired: false, isWon: false, isLost: false })}>Add Status</button>
      </div>
      <ErrorBox error={list.error} />
      <div className="table-responsive">
        <table className="table mb-0 align-middle" style={{ fontSize: "12px" }}>
          <thead><tr className="table-light"><th style={{ fontSize: "12px", fontWeight: 600 }}>Status</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Sub-Statuses</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Offerings</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Follow-up</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Type</th><th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Actions</th></tr></thead>
          <tbody>
            {list.loading ? <tr><td colSpan={6}><Spinner /></td></tr> : !list.data || list.data.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted py-4">No statuses created yet. Click "Add Status" to create one.</td></tr>
            ) : (list.data || []).map((s) => (
              <tr key={s._id}>
                <td><span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text)" }}>{s.name}</span></td>
                <td>
                  {s.subStatuses && s.subStatuses.length > 0 ? (
                    <button className="btn btn-sm btn-link p-0" onClick={() => setExpandedId(expandedId === s._id ? null : s._id)}>
                      {expandedId === s._id ? (
                        <div style={{ fontSize: 12 }}>
                          {s.subStatuses.map((sub, idx) => <div key={idx} className="text-muted small">{sub}</div>)}
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--text-2)" }}>{s.subStatuses.length} sub-status</span>
                      )}
                    </button>
                  ) : (
                    <span className="text-muted small">—</span>
                  )}
                </td>
                <td style={{ fontSize: 13 }}>{s.offerings && s.offerings.length > 0 ? `${s.offerings.length} offerings` : "—"}</td>
                <td style={{ fontSize: 13 }}>{s.followUpRequired === "Yes" ? "Yes" : "No"}</td>
                <td style={{ fontSize: 13 }}>{s.isWon ? "Won" : s.isLost ? "Lost" : "Open"}</td>
                <td className="text-end"><IconBtn icon="pencil" onClick={() => setEdit(s)} /><IconBtn icon="trash" danger onClick={() => removeStatus(s._id)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <StatusModal status={edit} services={services.data || []} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function StatusModal({ status, services, onClose, onSave }) {
  const [f, setF] = useState({
    _id: status._id,
    name: status.name || "",
    color: status.color || COLORS[0],
    subStatuses: status.subStatuses || [""],
    offerings: status.offerings || [],
    followUpRequired: status.followUpRequired === "Yes",
    isWon: status.isWon || false,
    isLost: status.isLost || false
  });
  const [offeringsOpen, setOfferingsOpen] = useState(false);

  const handleAddSubStatus = () => {
    setF({ ...f, subStatuses: [...f.subStatuses, ""] });
  };

  const handleSubStatusChange = (idx, val) => {
    const updated = [...f.subStatuses];
    updated[idx] = val;
    setF({ ...f, subStatuses: updated });
  };

  const handleRemoveSubStatus = (idx) => {
    if (f.subStatuses.length > 1) {
      setF({ ...f, subStatuses: f.subStatuses.filter((_, i) => i !== idx) });
    }
  };

  const handleOfferingToggle = (offeringId) => {
    setF({
      ...f,
      offerings: f.offerings.includes(offeringId)
        ? f.offerings.filter(o => o !== offeringId)
        : [...f.offerings, offeringId]
    });
  };

  const handleSave = () => {
    const payload = {
      ...f,
      subStatuses: f.subStatuses.filter(s => s.trim()),
      followUpRequired: f.followUpRequired ? "Yes" : "No"
    };
    onSave(payload);
  };

  return (
    <Modal title={status._id ? "Edit status" : "Add status"} onClose={onClose}
      footer={<><button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button><button className="btn btn-wa" disabled={!f.name} onClick={handleSave}>Save</button></>}>

      <label className="form-label small fw-semibold">Status Name</label>
      <input className="form-control mb-3" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />

      <label className="form-label small fw-semibold mb-2">Color</label>
      <div className="d-flex flex-wrap gap-2 mb-4">{COLORS.map((c) => <button key={c} onClick={() => setF({ ...f, color: c })} style={{ width: 28, height: 28, borderRadius: 6, background: c, border: f.color === c ? "3px solid #1f2630" : "1px solid #ccc" }} title={c} />)}</div>

      <label className="form-label small fw-semibold mb-3">Sub-Statuses</label>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
        {f.subStatuses.map((sub, idx) => (
          <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input className="form-control form-control-sm" value={sub} onChange={(e) => handleSubStatusChange(idx, e.target.value)} />
            {f.subStatuses.length > 1 && (
              <button className="btn btn-sm btn-outline-danger" onClick={() => handleRemoveSubStatus(idx)} style={{ padding: "4px 8px" }}>
                <i className="bi bi-trash"></i>
              </button>
            )}
            {idx === f.subStatuses.length - 1 && (
              <button className="btn btn-sm btn-outline-secondary" onClick={handleAddSubStatus} style={{ padding: "4px 12px", whiteSpace: "nowrap" }} title="Add sub-status">
                <i className="bi bi-plus-lg"></i>
              </button>
            )}
          </div>
        ))}
      </div>

      <label className="form-label small fw-semibold mb-2">Offerings</label>
      <div style={{ position: "relative", marginBottom: "16px" }}>
        <button style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-2)", borderRadius: "16px", background: "white", textAlign: "left", cursor: "pointer" }} onClick={() => setOfferingsOpen(!offeringsOpen)}>
          <div style={{ fontSize: 14, color: f.offerings.length > 0 ? "var(--text)" : "var(--muted)" }}>
            {f.offerings.length === 0 ? "Select offerings..." : `${f.offerings.length} selected`}
          </div>
        </button>
        {offeringsOpen && (
          <>
            <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setOfferingsOpen(false)}></div>
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid var(--border)", borderRadius: "16px", marginTop: "4px", maxHeight: "220px", overflowY: "auto", zIndex: 1000, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
              {services.map((o) => (
                <div key={o._id} style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--divider)", cursor: "pointer" }} onClick={() => handleOfferingToggle(o._id)}>
                  <input type="checkbox" checked={f.offerings.includes(o._id)} onChange={() => {}} style={{ marginRight: "8px", cursor: "pointer" }} />
                  <span style={{ fontSize: 13 }}>{o.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <label className="form-label small fw-semibold mb-2">Follow-up Required</label>
      <div style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
        <div className="form-check"><input className="form-check-input" type="radio" name="followup" checked={f.followUpRequired} onChange={() => setF({ ...f, followUpRequired: true })} id="followup-yes" /><label className="form-check-label small" htmlFor="followup-yes">Yes</label></div>
        <div className="form-check"><input className="form-check-input" type="radio" name="followup" checked={!f.followUpRequired} onChange={() => setF({ ...f, followUpRequired: false })} id="followup-no" /><label className="form-check-label small" htmlFor="followup-no">No</label></div>
      </div>

      <label className="form-label small fw-semibold mb-2">Count As</label>
      <div style={{ display: "flex", gap: "16px" }}>
        <div className="form-check"><input className="form-check-input" type="radio" name="status-type" checked={f.isWon} onChange={() => setF({ ...f, isWon: true, isLost: false })} id="won" /><label className="form-check-label small" htmlFor="won">Won</label></div>
        <div className="form-check"><input className="form-check-input" type="radio" name="status-type" checked={f.isLost} onChange={() => setF({ ...f, isLost: true, isWon: false })} id="lost" /><label className="form-check-label small" htmlFor="lost">Lost</label></div>
        <div className="form-check"><input className="form-check-input" type="radio" name="status-type" checked={!f.isWon && !f.isLost} onChange={() => setF({ ...f, isWon: false, isLost: false })} id="open" /><label className="form-check-label small" htmlFor="open">Open</label></div>
      </div>
    </Modal>
  );
}

function SourceMaster() {
  const toast = useToast();
  const list = useApi(() => mastersApi.sources(), []);
  const [form, setForm] = useState({ name: "" });
  async function add() { if (!form.name) return; try { await mastersApi.createSource(form); toast("Added"); setForm({ name: "" }); list.reload(); } catch (e) { toast(e.message, "error"); } }
  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header bg-white fw-semibold" style={{ fontSize: "14px" }}>Lead sources</div>
      <div className="card-body" style={{ fontSize: "12px" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input className="form-control form-control-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ flex: 1, fontSize: "12.5px" }} placeholder="Enter lead source (e.g. Website, Instagram)" />
          <button className="btn btn-sm btn-wa" onClick={add} style={{ padding: "5px 12px", fontSize: "12px" }} title="Add source"><i className="bi bi-plus-lg me-1"></i>Add</button>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle" style={{ fontSize: "12px" }}>
            <thead><tr className="table-light"><th style={{ fontSize: "12px", fontWeight: 600 }}>Source Name</th><th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Action</th></tr></thead>
            <tbody>
              {(list.data || []).map((s) => <tr key={s._id}><td style={{ fontSize: "12px", fontWeight: 400 }}>{s.name}</td><td className="text-end"><button className="btn btn-sm border-0 text-secondary hover-danger p-1" style={{ fontSize: "12px" }} onClick={async () => { await mastersApi.removeSource(s._id); list.reload(); }}><i className="bi bi-trash" style={{ fontSize: "13px" }}></i></button></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const PERM_MODS = ["dashboard", "leads", "followups", "chat", "blast", "contacts", "conversion", "setup", "reports"];
function UserTypes() {
  const toast = useToast();
  const list = useApi(() => usersApi.userTypes(), []);
  const [edit, setEdit] = useState(null);
  async function save(f) {
    try { if (f._id) await usersApi.updateUserType(f._id, f); else await usersApi.createUserType(f); toast("Saved"); setEdit(null); list.reload(); }
    catch (e) { toast(e.message, "error"); }
  }
  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header bg-white d-flex justify-content-between align-items-center"><span className="fw-semibold" style={{ fontSize: "14px" }}>User types & permissions</span><button className="btn btn-sm btn-wa" onClick={() => setEdit({ name: "", desc: "", perms: PERM_MODS.map((m) => ({ module: m, view: false, create: false, edit: false, del: false })) })}>Add</button></div>
      <ErrorBox error={list.error} />
      <div className="table-responsive">
        <table className="table table-hover mb-0 align-middle" style={{ fontSize: "12px" }}>
          <thead><tr className="table-light"><th style={{ fontSize: "12px", fontWeight: 600 }}>Type</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Description</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Modules</th><th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Actions</th></tr></thead>
          <tbody>
            {list.loading ? <tr><td colSpan={4}><Spinner /></td></tr> : (list.data || []).map((t) => (
              <tr key={t._id}><td style={{ fontSize: "12px", fontWeight: 400 }}>{t.name}</td><td style={{ fontSize: "12px" }} className="text-secondary">{t.desc}</td><td style={{ fontSize: "12px" }} className="text-secondary">{t.perms.filter((p) => p.view).length}/{t.perms.length} modules</td><td className="text-end"><button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} onClick={() => setEdit(t)}><i className="bi bi-pencil" style={{ fontSize: "13px" }}></i></button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <PermModal userType={edit} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function PermModal({ userType, onClose, onSave }) {
  const [name, setName] = useState(userType.name);
  const [desc, setDesc] = useState(userType.desc || "");
  const [perms, setPerms] = useState(() => PERM_MODS.map((m) => { const f = userType.perms.find((p) => p.module === m); return f ? { ...f } : { module: m, view: false, create: false, edit: false, del: false }; }));
  function toggle(i, k) {
    setPerms((ps) => ps.map((p, idx) => idx === i ? { ...p, [k]: !p[k], ...(k === "view" && p[k] ? { create: false, edit: false, del: false } : {}), ...(k !== "view" && !p[k] ? { view: true } : {}) } : p));
  }
  return (
    <><div className="modal-backdrop fade show"></div>
      <div className="modal d-block"><div className="modal-dialog modal-lg"><div className="modal-content">
        <div className="modal-header"><h5 className="modal-title">{userType._id ? "Edit" : "New"} user type</h5><button className="btn-close" onClick={onClose}></button></div>
        <div className="modal-body">
          <div className="row g-3 mb-3"><div className="col-6"><label className="form-label small">Name</label><input className="form-control" value={name} onChange={(e) => setName(e.target.value)} /></div><div className="col-6"><label className="form-label small">Description</label><input className="form-control" value={desc} onChange={(e) => setDesc(e.target.value)} /></div></div>
          <table className="table table-sm table-bordered align-middle">
            <thead><tr><th>Module</th><th className="text-center">View</th><th className="text-center">Create</th><th className="text-center">Edit</th><th className="text-center">Delete</th></tr></thead>
            <tbody>
              {perms.map((p, i) => (
                <tr key={p.module}><td className="text-capitalize small fw-medium">{p.module}</td>
                  {["view", "create", "edit", "del"].map((k) => <td className="text-center" key={k}><input type="checkbox" checked={p[k]} onChange={() => toggle(i, k)} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-footer"><button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancel</button><button className="btn btn-sm btn-wa" disabled={!name} onClick={() => onSave({ _id: userType._id, name, desc, perms })}>Save</button></div>
      </div></div></div></>
  );
}

function Users() {
  const toast = useToast();
  const list = useApi(() => usersApi.users(), []);
  const types = useApi(() => usersApi.userTypes(), []);
  const designations = useApi(() => designationsApi.list(), []);
  const [edit, setEdit] = useState(null);
  const typeMap = Object.fromEntries((types.data || []).map((t) => [t._id, t]));
  async function save(f) {
    try { if (f._id) await usersApi.updateUser(f._id, f); else await usersApi.createUser({ ...f, passwordHash: "TempPass!23" }); toast("Saved (default password: TempPass!23)"); setEdit(null); list.reload(); }
    catch (e) { toast(e.message, "error"); }
  }
  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header bg-white d-flex justify-content-between align-items-center"><span className="fw-semibold" style={{ fontSize: "14px" }}>Users</span><button className="btn btn-sm btn-wa" onClick={() => setEdit({ name: "", email: "", userType: types.data?.[0]?._id, designation: "", status: "Active" })}>Add user</button></div>
      <ErrorBox error={list.error} />
      <div className="table-responsive">
        <table className="table table-hover mb-0 align-middle" style={{ fontSize: "12px" }}>
          <thead><tr className="table-light"><th style={{ fontSize: "12px", fontWeight: 600 }}>User</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Email</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Type</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Status</th><th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Actions</th></tr></thead>
          <tbody>
            {list.loading ? <tr><td colSpan={5}><Spinner /></td></tr> : (list.data || []).map((u) => (
              <tr key={u._id}><td style={{ fontSize: "12px", fontWeight: 400 }}>{u.name}</td><td style={{ fontSize: "12px" }} className="font-monospace text-secondary">{u.email}</td><td style={{ fontSize: "12px" }} className="text-secondary">{typeMap[u.userType]?.name || u.userType?.name || "—"}</td><td><span style={{ fontSize: "12px", fontWeight: 500, color: u.status === "Active" ? "#16a34a" : "#6b7280" }}>{u.status}</span></td><td className="text-end"><button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} onClick={() => setEdit({ ...u, userType: u.userType?._id || u.userType })}><i className="bi bi-pencil" style={{ fontSize: "13px" }}></i></button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <UserModal user={edit} types={types.data || []} designations={designations.data || []} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function UserModal({ user, types, designations = [], onClose, onSave }) {
  const [f, setF] = useState({ _id: user._id, name: user.name || "", email: user.email || "", userType: user.userType || types[0]?._id, designation: user.designation || "", status: user.status || "Active" });
  return (
    <><div className="modal-backdrop fade show"></div>
      <div className="modal d-block"><div className="modal-dialog"><div className="modal-content">
        <div className="modal-header"><h5 className="modal-title">{user._id ? "Edit" : "Add"} user</h5><button className="btn-close" onClick={onClose}></button></div>
        <div className="modal-body"><div className="row g-3">
          <div className="col-12"><label className="form-label small">Name</label><input className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="col-12"><label className="form-label small">Email</label><input className="form-control" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="col-6"><label className="form-label small">User type</label><select className="form-select" value={f.userType} onChange={(e) => setF({ ...f, userType: e.target.value })}>{types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></div>
          <div className="col-6"><label className="form-label small">Designation</label><select className="form-select" value={f.designation} onChange={(e) => setF({ ...f, designation: e.target.value })}><option value="">— Select —</option>{designations.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}</select></div>
          <div className="col-6"><label className="form-label small">Status</label><select className="form-select" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option>Active</option><option>Inactive</option><option>Pending</option></select></div>
        </div></div>
        <div className="modal-footer"><button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancel</button><button className="btn btn-sm btn-wa" disabled={!f.name || !f.email} onClick={() => onSave(f)}>Save</button></div>
      </div></div></div></>
  );
}

function WhatsAppAccounts() {
  const toast = useToast();
  const list = useApi(() => waAccountsApi.list(), []);
  const [edit, setEdit] = useState(null);
  async function activate(id) { try { await waAccountsApi.activate(id); toast("Activated"); list.reload(); } catch (e) { toast(e.message, "error"); } }
  async function remove(id) { if (confirm("Delete this account?")) { try { await waAccountsApi.remove(id); toast("Deleted"); list.reload(); } catch (e) { toast(e.message, "error"); } } }
  async function save(f) {
    try { if (f._id) await waAccountsApi.update(f._id, f); else await waAccountsApi.create(f); toast("Saved"); setEdit(null); list.reload(); }
    catch (e) { toast(e.message, "error"); }
  }
  return (
    <div className="card">
      <div className="card-header bg-white d-flex justify-content-between align-items-center">
        <div><span className="fw-semibold" style={{ fontSize: "14px" }}>WhatsApp Accounts</span><div className="text-secondary small">Configure multiple vendors — exactly one is active at a time.</div></div>
        <button className="btn btn-sm btn-wa" onClick={() => setEdit({ vendor: "meta", label: "", active: false })}>Add account</button>
      </div>
      <ErrorBox error={list.error} />
      <div className="table-responsive"><table className="table table-hover mb-0 align-middle" style={{ fontSize: "12px" }}>
        <thead><tr className="table-light"><th style={{ fontSize: "12px", fontWeight: 600 }}>Account</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Vendor</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Sender</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Status</th><th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Actions</th></tr></thead>
        <tbody>
          {list.loading ? <tr><td colSpan={5}><Spinner /></td></tr> : (list.data || []).length === 0 ? <tr><td colSpan={5}><EmptyState icon="whatsapp" text="No WhatsApp accounts." /></td></tr> : list.data.map((a) => (
            <tr key={a._id}>
              <td style={{ fontSize: "12px", fontWeight: 400 }}>{a.label}</td>
              <td style={{ fontSize: "11.5px" }} className="text-secondary text-uppercase">{a.vendor}</td>
              <td style={{ fontSize: "12px" }} className="font-monospace text-secondary">{a.senderNumber || "—"}</td>
              <td>{a.active ? <span style={{ fontSize: "12px", fontWeight: 500, color: "#16a34a" }}><i className="bi bi-check-circle me-1"></i>Active</span> : <button className="btn btn-sm border-0 text-success p-1" style={{ fontSize: "12px" }} onClick={() => activate(a._id)}>Make active</button>}</td>
              <td className="text-end"><div className="d-flex justify-content-end gap-1"><button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} onClick={() => setEdit(a)}><i className="bi bi-pencil" style={{ fontSize: "13px" }}></i></button><button className="btn btn-sm border-0 text-secondary hover-danger p-1" style={{ fontSize: "12px" }} onClick={() => remove(a._id)}><i className="bi bi-trash" style={{ fontSize: "13px" }}></i></button></div></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {edit && <WaModal account={edit} onClose={() => setEdit(null)} onSave={save} />}
    </div>
  );
}

function WaModal({ account, onClose, onSave }) {
  const [f, setF] = useState({
    _id: account._id, label: account.label || "", vendor: account.vendor || "meta", senderNumber: account.senderNumber || "",
    apiBaseUrl: account.apiBaseUrl || "", apiKey: "", accessToken: "", phoneNumberId: account.phoneNumberId || "",
    verifyToken: account.verifyToken || "", appSecret: "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isPinnacle = f.vendor === "pinnacle";
  const isMeta = f.vendor === "meta";
  // strip empty secret fields so we don't overwrite stored values with blanks on edit
  function clean() { const o = { ...f }; ["apiKey", "accessToken", "appSecret"].forEach((k) => { if (!o[k]) delete o[k]; }); return o; }
  return (
    <><div className="modal-backdrop fade show"></div>
      <div className="modal d-block"><div className="modal-dialog"><div className="modal-content">
        <div className="modal-header"><h5 className="modal-title">{account._id ? "Edit" : "Add"} WhatsApp account</h5><button className="btn-close" onClick={onClose}></button></div>
        <div className="modal-body"><div className="row g-3">
          <div className="col-7"><label className="form-label small">Label</label><input className="form-control" value={f.label} onChange={(e) => set("label", e.target.value)} placeholder="Pinnacle – Admissions" /></div>
          <div className="col-5"><label className="form-label small">Vendor</label><select className="form-select" value={f.vendor} onChange={(e) => set("vendor", e.target.value)}><option value="meta">Meta (direct)</option><option value="pinnacle">Pinnacle</option><option value="simulation">Simulation</option></select></div>
          <div className="col-12"><label className="form-label small">Sender number</label><input className="form-control" value={f.senderNumber} onChange={(e) => set("senderNumber", e.target.value)} /></div>
          {isMeta && <>
            <div className="col-12"><label className="form-label small">Phone Number ID</label><input className="form-control" value={f.phoneNumberId} onChange={(e) => set("phoneNumberId", e.target.value)} /></div>
            <div className="col-12"><label className="form-label small">Access Token</label><input className="form-control" type="password" placeholder={account._id ? "•••• (unchanged)" : ""} value={f.accessToken} onChange={(e) => set("accessToken", e.target.value)} /></div>
            <div className="col-6"><label className="form-label small">App Secret</label><input className="form-control" type="password" value={f.appSecret} onChange={(e) => set("appSecret", e.target.value)} /></div>
            <div className="col-6"><label className="form-label small">Verify Token</label><input className="form-control" value={f.verifyToken} onChange={(e) => set("verifyToken", e.target.value)} /></div>
          </>}
          {isPinnacle && <>
            <div className="col-12"><label className="form-label small">API Base URL</label><input className="form-control" value={f.apiBaseUrl} onChange={(e) => set("apiBaseUrl", e.target.value)} placeholder="from Pinnacle docs" /></div>
            <div className="col-12"><label className="form-label small">API Key</label><input className="form-control" type="password" placeholder={account._id ? "•••• (unchanged)" : ""} value={f.apiKey} onChange={(e) => set("apiKey", e.target.value)} /></div>
            <div className="col-12 small text-secondary">Webhook URL to register with Pinnacle: <code>/webhooks/whatsapp/&lt;tenantId&gt;</code></div>
          </>}
        </div></div>
        <div className="modal-footer"><button className="btn btn-sm btn-outline-secondary" onClick={onClose}>Cancel</button><button className="btn btn-sm btn-wa" disabled={!f.label} onClick={() => onSave(clean())}>Save</button></div>
      </div></div></div></>
  );
}

function Integrations() {
  const toast = useToast();
  const list = useApi(() => integrationsApi.list(), []);
  async function toggle(it) {
    try { await integrationsApi.update(it._id, { connected: !it.connected, account: !it.connected ? "Connected just now" : null }); toast(it.connected ? "Disconnected" : "Connected"); list.reload(); }
    catch (e) { toast(e.message, "error"); }
  }
  return (
    <div className="row g-3">
      {list.loading ? <Spinner /> : (list.data || []).map((it) => (
        <div className="col-md-6" key={it._id}>
          <div className="card h-100">
            <div className="card-body p-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="text-dark" style={{ fontSize: "13px", fontWeight: 500 }}>{it.name}</span>
                <span style={{ fontSize: "12px", fontWeight: 500, color: it.connected ? "#16a34a" : "#6b7280" }}>{it.connected ? "Connected" : "Off"}</span>
              </div>
              <div className="text-secondary small mb-2" style={{ fontSize: "12px" }}>{it.desc}</div>
              {it.account && <div className="small font-monospace text-secondary mb-2" style={{ fontSize: "11.5px" }}>{it.account}</div>}
              <button className={"btn btn-sm " + (it.connected ? "btn-outline-secondary" : "btn-wa")} style={{ fontSize: "12px" }} onClick={() => toggle(it)}>{it.connected ? "Disconnect" : "Connect"}</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AcademicSessions() {
  const toast = useToast();
  const list = useApi(() => sessionsApi.list(), []);
  const [form, setForm] = useState({ name: "", startDate: "01-04-2026", endDate: "31-03-2027" });

  const parseDDMMYYYY = (dateStr) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900) return null;
    return new Date(year, month - 1, day);
  };

  const formatDateToDDMMYYYY = (dateStr) => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  async function add() {
    if (!form.name || !form.startDate || !form.endDate) return;
    const startDate = parseDDMMYYYY(form.startDate);
    const endDate = parseDDMMYYYY(form.endDate);
    if (!startDate || !endDate) {
      toast("Invalid date format. Use dd-mm-yyyy", "error");
      return;
    }
    if (startDate >= endDate) {
      toast("From Date must be before To Date", "error");
      return;
    }
    try {
      const startYear = startDate.getFullYear();
      const endYear = endDate.getFullYear();
      const startDateStr = `${startYear}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
      const endDateStr = `${endYear}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
      await sessionsApi.create({ name: form.name, startDate: startDateStr, endDate: endDateStr, startYear, endYear });
      toast("Added");
      setForm({ name: "", startDate: "01-04-2026", endDate: "31-03-2027" });
      list.reload();
    } catch (e) { toast(e.message, "error"); }
  }

  async function remove(id) { if (confirm("Delete?")) { try { await sessionsApi.remove(id); toast("Deleted"); list.reload(); } catch (e) { toast(e.message, "error"); } } }

  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header bg-white fw-semibold" style={{ fontSize: "14px" }}>Academic Sessions/Years</div>
      <div className="card-body" style={{ fontSize: "12px" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label className="form-label small fw-semibold mb-1" style={{ fontSize: "12px" }}>Session Name</label>
            <input className="form-control form-control-sm" style={{ fontSize: "12.5px" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 2026-2027" />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label small fw-semibold mb-1" style={{ fontSize: "12px" }}>From Date</label>
            <input className="form-control form-control-sm" style={{ fontSize: "12.5px" }} placeholder="dd-mm-yyyy" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label small fw-semibold mb-1" style={{ fontSize: "12px" }}>To Date</label>
            <input className="form-control form-control-sm" style={{ fontSize: "12.5px" }} placeholder="dd-mm-yyyy" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <button className="btn btn-sm btn-wa" onClick={add} style={{ padding: "5px 12px", fontSize: "12px" }} title="Add session"><i className="bi bi-plus-lg me-1"></i>Add</button>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle" style={{ fontSize: "12px" }}>
            <thead><tr className="table-light"><th style={{ fontSize: "12px", fontWeight: 600 }}>Session</th><th style={{ fontSize: "12px", fontWeight: 600 }}>From Date</th><th style={{ fontSize: "12px", fontWeight: 600 }}>To Date</th><th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Action</th></tr></thead>
            <tbody>{(list.data || []).map((s) => <tr key={s._id}><td style={{ fontSize: "12px", fontWeight: 400 }}>{s.name}</td><td style={{ fontSize: "12px" }} className="text-secondary">{formatDateToDDMMYYYY(s.startDate || s.startYear + "-04-01")}</td><td style={{ fontSize: "12px" }} className="text-secondary">{formatDateToDDMMYYYY(s.endDate || s.endYear + "-03-31")}</td><td className="text-end"><button className="btn btn-sm border-0 text-secondary hover-danger p-1" style={{ fontSize: "12px" }} onClick={() => remove(s._id)}><i className="bi bi-trash" style={{ fontSize: "13px" }}></i></button></td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Grades() {
  const toast = useToast();
  const list = useApi(() => gradesApi.list(), []);
  const [form, setForm] = useState({ name: "" });
  async function add() { if (!form.name) return; try { await gradesApi.create(form); toast("Added"); setForm({ name: "" }); list.reload(); } catch (e) { toast(e.message, "error"); } }
  async function remove(id) { if (confirm("Delete?")) { try { await gradesApi.remove(id); toast("Deleted"); list.reload(); } catch (e) { toast(e.message, "error"); } } }
  return (
    <div className="card" style={{ marginBottom: 0, borderRadius: "var(--radius)" }}>
      <div className="card-header bg-white fw-semibold" style={{ fontSize: "14px" }}>Grades</div>
      <div className="card-body" style={{ fontSize: "12px" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <input className="form-control form-control-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ flex: 1, fontSize: "12.5px" }} placeholder="Enter grade name (e.g. Grade 1, Class XI)" />
          <button className="btn btn-sm btn-wa" onClick={add} style={{ padding: "5px 12px", fontSize: "12px" }} title="Add grade"><i className="bi bi-plus-lg me-1"></i>Add</button>
        </div>
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle" style={{ fontSize: "12px" }}>
            <thead><tr className="table-light"><th style={{ fontSize: "12px", fontWeight: 600 }}>Grade</th><th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Action</th></tr></thead>
            <tbody>{(list.data || []).map((g) => <tr key={g._id}><td style={{ fontSize: "12px", fontWeight: 400 }}>{g.name}</td><td className="text-end"><button className="btn btn-sm border-0 text-secondary hover-danger p-1" style={{ fontSize: "12px" }} onClick={() => remove(g._id)}><i className="bi bi-trash" style={{ fontSize: "13px" }}></i></button></td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Teams() {
  const toast = useToast();
  const list = useApi(() => teamsApi.list(), []);
  const users = useApi(() => usersApi.users(), []);
  const sources = useApi(() => mastersApi.sources(), []);
  const [edit, setEdit] = useState(null);
  const [viewMembers, setViewMembers] = useState(null);
  async function save(f) { try { if (f._id) await teamsApi.update(f._id, f); else await teamsApi.create(f); toast("Saved"); setEdit(null); list.reload(); } catch (e) { toast(e.message, "error"); } }
  async function remove(id) { if (confirm("Delete?")) { try { await teamsApi.remove(id); toast("Deleted"); list.reload(); } catch (e) { toast(e.message, "error"); } } }
  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header d-flex justify-content-between align-items-center">
        <span className="fw-semibold" style={{ fontSize: "14px" }}>Teams</span>
        <button className="btn btn-sm btn-wa" onClick={() => setEdit({ name: "", manager: "", members: [], sources: [] })}>Add team</button>
      </div>
      <div className="table-responsive">
        <table className="table table-hover mb-0 align-middle" style={{ fontSize: "12px" }}>
          <thead><tr className="table-light"><th style={{ fontSize: "12px", fontWeight: 600 }}>Team</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Manager</th><th style={{ fontSize: "12px", fontWeight: 600 }}>Members</th><th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Actions</th></tr></thead>
          <tbody>{(list.data || []).map((t) => <tr key={t._id}><td style={{ fontSize: "12px", fontWeight: 400 }}>{t.name}</td><td style={{ fontSize: "12px" }} className="text-secondary">{t.manager?.name || "—"}</td><td style={{ fontSize: "12px" }}><button style={{ background: "none", border: "none", color: "var(--accent-ink)", cursor: "pointer", padding: 0, textDecoration: "underline", fontSize: "12px" }} onClick={() => setViewMembers(t)}>{t.members?.length || 0} members</button></td><td className="text-end"><div className="d-flex justify-content-end gap-1"><button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} onClick={() => setEdit(t)}><i className="bi bi-pencil" style={{ fontSize: "13px" }}></i></button><button className="btn btn-sm border-0 text-secondary hover-danger p-1" style={{ fontSize: "12px" }} onClick={() => remove(t._id)}><i className="bi bi-trash" style={{ fontSize: "13px" }}></i></button></div></td></tr>)}</tbody>
        </table>
      </div>
      {edit && <TeamModal team={edit} users={users.data || []} sources={sources.data || []} onClose={() => setEdit(null)} onSave={save} />}
      {viewMembers && <MembersModal team={viewMembers} onClose={() => setViewMembers(null)} />}
    </div>
  );
}

function MembersModal({ team, onClose }) {
  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal d-block"><div className="modal-dialog"><div className="modal-content">
        <div className="modal-header"><h5 className="modal-title">{team.name} - Team Members</h5><button className="btn-close" onClick={onClose}></button></div>
        <div className="modal-body">
          {(!team.members || team.members.length === 0) ? (
            <div className="text-muted text-center py-4">No members assigned</div>
          ) : (
            <ul className="list-unstyled">
              {team.members.map((m, idx) => (
                <li key={idx} style={{ padding: "10px 0", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", gap: "10px" }}>
                  <i className="bi bi-person-circle" style={{ fontSize: "20px", color: "var(--accent)" }}></i>
                  <span style={{ fontSize: "14px" }}>{m.user?.name || "Unknown"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Close</button></div>
      </div></div></div>
    </>
  );
}

function MultiSelectDropdown({ options, selected, onChange, label, isRequired }) {
  const [open, setOpen] = useState(false);
  const selectedItems = options.filter(o => selected.includes(o._id));

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        style={{
          width: "100%",
          padding: "8px 12px",
          border: "1px solid var(--border-2)",
          borderRadius: "16px",
          background: "white",
          textAlign: "left",
          cursor: "pointer",
          borderColor: isRequired && !selected.length ? "#fca5a5" : undefined
        }}
        onClick={() => setOpen(!open)}
      >
        <div style={{ fontSize: 14, color: selected.length > 0 ? "var(--text)" : "var(--muted)" }}>
          {selected.length === 0 ? "Select members..." : `${selected.length} selected`}
        </div>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setOpen(false)}></div>
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "white",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              marginTop: "4px",
              maxHeight: "220px",
              overflowY: "auto",
              zIndex: 1000,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
            }}
          >
            {options.map((o) => (
              <div key={o._id} style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--divider)", cursor: "pointer" }} onClick={() => onChange(selected.includes(o._id) ? selected.filter(s => s !== o._id) : [...selected, o._id])}>
                <input type="checkbox" checked={selected.includes(o._id)} onChange={() => {}} style={{ marginRight: "8px", cursor: "pointer" }} />
                <span style={{ fontSize: 13 }}>{o.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TeamModal({ team, users, sources, onClose, onSave }) {
  const [f, setF] = useState({ _id: team._id, name: team.name || "", manager: team.manager?._id || "", members: (team.members || []).map(m => m._id || m), sources: (team.sources || []).map(s => s._id || s) });
  const [membersOpen, setMembersOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const canSave = f.name && f.manager && f.members && f.members.length > 0;

  const handleSave = () => {
    const data = {
      ...f,
      members: f.members || [],
      sources: f.sources || []
    };
    onSave(data);
  };

  return (
    <><div className="modal-backdrop fade show"></div><div className="modal d-block"><div className="modal-dialog modal-lg"><div className="modal-content">
      <div className="modal-header"><h5 className="modal-title">{team._id ? "Edit" : "Add"} team</h5><button className="btn-close" onClick={onClose}></button></div>
      <div className="modal-body"><div className="row g-3">
        <div className="col-12"><label className="form-label small">Team name <span style={{ color: "#dc2626" }}>*</span></label><input className="form-control" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Enter team name" /></div>
        <div className="col-12"><label className="form-label small">Manager <span style={{ color: "#dc2626" }}>*</span></label><select className="form-select" value={f.manager} onChange={(e) => setF({ ...f, manager: e.target.value })}><option value="">— Select Manager —</option>{users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></div>
        <div className="col-6"><label className="form-label small">Team Members <span style={{ color: "#dc2626" }}>*</span></label><MultiSelectDropdown options={users} selected={f.members} onChange={(members) => setF({ ...f, members })} isRequired={!f.members.length} />{!f.members.length && <div style={{ color: "#dc2626", fontSize: "12px", marginTop: "4px" }}>At least one team member is required</div>}</div>
        <div className="col-6"><label className="form-label small">Mapped sources</label><MultiSelectDropdown options={sources} selected={f.sources} onChange={(sources) => setF({ ...f, sources })} isRequired={false} /></div>
      </div></div>
      <div className="modal-footer"><button className="btn btn-outline-secondary" onClick={onClose}>Cancel</button><button className="btn btn-wa" disabled={!canSave} onClick={handleSave}>Save</button></div>
    </div></div></div></>
  );
}

function WorkflowsTab() {
  const [subTab, setSubTab] = useState("assignment");
  const SUB_TABS = [{ value: "assignment", label: "Lead Assignment" }, { value: "alerts", label: "Alerts" }, { value: "conversion", label: "Lead Conversion" }];
  return (
    <div>
      <div className="mb-3"><Tabs tabs={SUB_TABS} value={subTab} onChange={setSubTab} /></div>
      {subTab === "assignment" && <LeadAssignment />}
      {subTab === "alerts" && <AlertsWorkflow />}
      {subTab === "conversion" && <div className="card"><div className="card-body text-center text-muted py-5">Lead Conversion Workflow coming soon...</div></div>}
    </div>
  );
}

function LeadAssignment() {
  const toast = useToast();
  const workflow = useApi(() => workflowsApi.list().then((res) => (res.find((w) => w.type === "LeadAssignment") || {})), []);
  const teams = useApi(() => teamsApi.list(), []);
  const sources = useApi(() => mastersApi.sources(), []);
  const config = useApi(() => workflowConfigApi.get(), []);
  const [f, setF] = useState({ strategy: "round_robin", teamId: "", sourceMap: [], stateMap: [], cityMap: [], gradeMap: [] });
  async function save() { try { if (workflow.data?._id) await workflowsApi.update(workflow.data._id, { ...f, type: "LeadAssignment", name: "LeadAssignment", active: true }); else await workflowsApi.create({ ...f, type: "LeadAssignment", name: "LeadAssignment", active: true }); toast("Saved"); workflow.reload(); } catch (e) { toast(e.message, "error"); } }
  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header bg-white"><span className="fw-semibold" style={{ fontSize: "14px" }}>Lead Assignment Configuration</span><div className="text-muted small">Configure how new leads are automatically assigned to team members</div></div>
      <div className="card-body" style={{ fontSize: "12px" }}>
        <label className="form-label mb-2" style={{ fontSize: "12px", color: "var(--text)" }}>Strategy</label>
        <div className="row g-2 mb-4">
          {(config.data?.ASSIGNMENT_STRATEGIES || []).map((s) => (
            <div className="col-md-6" key={s.key}>
              <div className="form-check">
                <input className="form-check-input" type="radio" checked={f.strategy === s.key} onChange={() => setF({ ...f, strategy: s.key })} id={"strat" + s.key} />
                <label className="form-check-label text-dark" style={{ fontSize: "12px" }} htmlFor={"strat" + s.key}>{s.label}</label>
              </div>
            </div>
          ))}
        </div>
        {f.strategy === "round_robin" && (
          <div className="mb-3">
            <label className="form-label" style={{ fontSize: "12px", color: "var(--text)" }}>Team</label>
            <select className="form-select form-select-sm" style={{ fontSize: "12px" }} value={f.teamId} onChange={(e) => setF({ ...f, teamId: e.target.value })}>
              <option value="">— Select —</option>
              {(teams.data || []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div className="d-flex gap-2"><button className="btn btn-sm btn-wa" style={{ fontSize: "12px" }} onClick={save}>Save</button></div>
      </div>
    </div>
  );
}
function AlertsWorkflow() {
  return (
    <div className="card">
      <div className="card-header"><span className="fw-semibold">Alert Workflows</span><div className="text-muted small">Define automated alerts and actions based on lead events</div></div>
      <div className="card-body text-center text-muted py-5">Alerts configuration coming soon...</div>
    </div>
  );
}

function RegistrationFormConfig() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const config = useApi(() => workflowConfigApi.get("registrationForms"), []);
  const statuses = useApi(() => mastersApi.statuses(), []);
  const templates = useApi(() => templatesApi.list({ perPage: 100 }), []);
  const [forms, setForms] = useState([]);
  const [filter, setFilter] = useState("");
  const [activeForm, setActiveForm] = useState(null);

  const getFormsData = (raw) => {
    const data = raw?.data || raw;
    return Array.isArray(data) ? data : data?.forms || [];
  };

  useEffect(() => {
    setForms(getFormsData(config.data));
  }, [config.data]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("mode") !== "editor") {
      setActiveForm(null);
    }
  }, [location.search]);

  const saveConfig = async (nextForms) => {
    try {
      await workflowConfigApi.save("registrationForms", { forms: nextForms });
      toast("Registration form configuration saved");
      config.reload();
      setForms(nextForms);
    } catch (e) {
      toast(e.message, "error");
    }
  };



  const openNewForm = () => {
    const f = {
      _id: undefined,
      formTitle: "",
      formType: null,
      formCategory: "registration",
      formColumns: 2,
      steps: [],
      isActive: true
    };
    setActiveForm(f);
    navigate("/crm/setup?active=registration-form&mode=editor", { state: { form: f } });
  };

  const openEditForm = (form) => {
    const f = {
      ...form,
      formTitle: form.formTitle || form.name || "",
      formType: form.formType || "single",
      formCategory: form.formCategory || "registration",
      formColumns: form.formColumns || 2,
      steps: form.steps || [],
      isActive: form.isActive !== false
    };
    setActiveForm(f);
    navigate("/crm/setup?active=registration-form&mode=editor", { state: { form: f } });
  };

  const openPreviewForm = (form) => {
    const f = {
      ...form,
      formTitle: form.formTitle || form.name || "",
      formType: form.formType || "single",
      formCategory: form.formCategory || "registration",
      formColumns: form.formColumns || 2,
      steps: form.steps || [],
      isActive: form.isActive !== false
    };
    setActiveForm(f);
    navigate("/crm/setup?active=registration-form&mode=editor&startScreen=preview_only", { state: { form: f } });
  };

  const closeEditor = () => {
    navigate("/crm/setup?active=registration-form&mode=list");
  };

  const saveForm = async (formData) => {
    if (!formData.formTitle || !formData.formTitle.trim()) {
      toast("Form title is required", "error");
      return;
    }

    const formToSave = {
      ...formData,
      _id: formData._id || `${Date.now()}`,
      name: formData.formTitle.trim(),
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: formData.isActive !== false
    };

    const nextForms = formData._id
      ? forms.map((f) => (f._id === formData._id ? formToSave : f))
      : [...forms, formToSave];

    await saveConfig(nextForms);
    closeEditor();
  };

  const deleteForm = async (formId) => {
    if (!confirm("Delete this registration form?")) return;
    const nextForms = forms.filter((f) => f._id !== formId);
    await saveConfig(nextForms);
  };


  const formatDateDMY = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const pad = (num) => String(num).padStart(2, "0");
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
  };

  const filteredForms = forms.filter((f) =>
    (f.formTitle || f.name || "").toLowerCase().includes(filter.toLowerCase())
  );

  const currentForm = activeForm || location.state?.form;
  const isEditorMode = currentForm && new URLSearchParams(location.search).get("mode") === "editor";

  if (isEditorMode) {
    const startScreen = new URLSearchParams(location.search).get("startScreen");
    if (startScreen === "preview_only") {
      return (
        <RegistrationFormBuilder
          key={`${currentForm?._id}_${startScreen}`}
          initialForm={currentForm}
          onSave={saveForm}
          onCancel={closeEditor}
          statuses={statuses.data || []}
          templates={templates.data || []}
          startScreen={startScreen}
        />
      );
    }

    return (
      <div className="card" style={{ borderRadius: "var(--radius)" }}>
        <div className="card-header d-flex justify-content-between align-items-center">
          <div>
            <span className="fw-semibold">{currentForm._id ? "Edit Registration Form" : "Create Registration Form"}</span>
            <div className="text-muted small">Design your form layout and steps.</div>
          </div>
          <button className="btn btn-sm btn-outline-secondary" onClick={closeEditor}>
            Back to List
          </button>
        </div>
        <div className="card-body p-0">
          <RegistrationFormBuilder
            key={`${currentForm?._id}_${startScreen || "setup"}`}
            initialForm={currentForm}
            onSave={saveForm}
            onCancel={closeEditor}
            statuses={statuses.data || []}
            templates={templates.data || []}
            startScreen={startScreen || "setup"}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <span className="fw-semibold">Registration Forms</span>
          <div className="text-muted small">Manage enrollment registration workflows, stepper steps and fields.</div>
        </div>
        <button className="btn btn-sm btn-wa" onClick={openNewForm}>
          <i className="bi bi-plus-lg me-1"></i>Create Registration Form
        </button>
      </div>

      <ErrorBox error={config.error} />

      {config.loading ? (
        <div className="card-body"><Spinner /></div>
      ) : (
        <div className="card-body" style={{ fontSize: "12px" }}>
          <div className="row gy-3 mb-3 align-items-center">
            <div className="col-sm-5">
              <input
                className="form-control form-control-sm"
                style={{ fontSize: "12.5px", padding: "5px 10px" }}
                placeholder="Filter by form name"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <div className="col-sm-7 text-sm-end text-muted" style={{ fontSize: "12px" }}>
              {filteredForms.length} form{filteredForms.length === 1 ? "" : "s"} found
            </div>
          </div>

          {filteredForms.length === 0 ? (
            <div className="text-center text-muted py-5" style={{ fontSize: "12px" }}>
              <div className="mb-3"><i className="bi bi-folder2-open" style={{ fontSize: "28px", opacity: 0.5 }}></i></div>
              <div>No registration forms yet.</div>
              <button className="btn btn-sm btn-outline-wa mt-2" style={{ fontSize: "12px" }} onClick={openNewForm}>Create your first registration form</button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle" style={{ fontSize: "12px" }}>
                <thead>
                  <tr className="table-light">
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Name</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Type</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Columns</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Steps</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Status</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Updated</th>
                    <th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredForms.map((form) => (
                    <tr key={form._id}>
                      <td>
                        <span className="font-monospace text-dark d-block" style={{ fontSize: "12px", fontWeight: 400 }}>{form.formTitle || form.name}</span>
                        <span className="text-muted text-capitalize" style={{ fontSize: "11px" }}>
                          Category: {form.formCategory || "registration"}
                        </span>
                      </td>
                      <td>
                        <span className="text-secondary" style={{ fontSize: "11.5px", fontWeight: 400 }}>
                          {form.formType === "stepper" ? "Multi-Step" : "Single Page"}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px" }} className="text-secondary">{form.formColumns || 2} Cols</td>
                      <td style={{ fontSize: "12px" }} className="text-secondary">{(form.steps || []).length} Step{(form.steps || []).length === 1 ? "" : "s"}</td>
                      <td>
                        <span style={{ fontSize: "12px", fontWeight: 500, color: form.isActive ? "#16a34a" : "#6b7280" }}>
                          {form.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ fontSize: "11.5px" }} className="text-secondary">{form.updatedAt ? formatDateDMY(form.updatedAt) : "—"}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          <button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} title="Preview form" onClick={() => openPreviewForm(form)}>
                            <i className="bi bi-eye" style={{ fontSize: "13px" }}></i>
                          </button>
                          <button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} title="Edit form" onClick={() => openEditForm(form)}>
                            <i className="bi bi-pencil" style={{ fontSize: "13px" }}></i>
                          </button>
                          <button className="btn btn-sm border-0 text-secondary hover-danger p-1" style={{ fontSize: "12px" }} title="Delete form" onClick={() => deleteForm(form._id)}>
                            <i className="bi bi-trash" style={{ fontSize: "13px" }}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const ENQUIRY_FORM_DEFAULT_FIELDS = [
  { fieldName: "studentName", label: "Student Name", fieldType: "text", isRequired: true, selected: true },
  { fieldName: "mobileNumber", label: "Mobile Number", fieldType: "phone", isRequired: true, selected: true },
  { fieldName: "emailId", label: "Email Id", fieldType: "email", isRequired: false, selected: true },
  { fieldName: "courseInterested", label: "Course Interested", fieldType: "text", isRequired: false, selected: true },
  { fieldName: "enquirySource", label: "Enquiry Source", fieldType: "text", isRequired: false, selected: true }
];

const ENQUIRY_FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "textarea", label: "Textarea" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "checkbox", label: "Checkbox" }
];



const LANDING_PAGE_TEMPLATES = [
  {
    id: "blank",
    name: "Blank Screen (Start from Scratch)",
    description: "Start with an empty page canvas and drag/add elements to design your own page.",
    accentColor: "#64748b",
    config: {
      brandName: "My Brand",
      heroTitle: "Build Something Beautiful",
      heroSubtitle: "Design your custom layout by dragging and editing blocks.",
      heroCtaLabel: "Learn More",
      heroCtaLink: "#contact",
      accentColor: "#64748b",
      highlightTitle: "Key Highlights",
      features: [],
      components: []
    }
  },
  {
    id: "clarwyn",
    name: "Clarwyn Academy (Modern & Elegant)",
    description: "Sleek blue theme suited for K-12 private academies and international schools.",
    accentColor: "#0085a8",
    config: {
      brandName: "Clarwyn Academy",
      heroTitle: "Empowering Future Leaders",
      heroSubtitle: "Experience a values-driven, future-ready curriculum designed for academic excellence and holistic development.",
      heroCtaLabel: "Schedule a Tour",
      heroCtaLink: "#contact",
      accentColor: "#0085a8",
      highlightTitle: "Why Clarwyn Stands Out",
      features: [
        "Innovative STEM & Robotics labs",
        "State-of-the-art sports complex",
        "Personalized mentorship and university counseling"
      ]
    }
  },
  {
    id: "bright-horizon",
    name: "Bright Horizon Preschool (Warm & Playful)",
    description: "Bright orange theme designed for early-years, preschools, and kindergartens.",
    accentColor: "#e65c00",
    config: {
      brandName: "Bright Horizon Kindergarten",
      heroTitle: "Where Joyful Learning Begins",
      heroSubtitle: "A nurturing space for little minds to explore, play, and grow with creative child-centric learning methods.",
      heroCtaLabel: "Book a Free Trial Class",
      heroCtaLink: "#contact",
      accentColor: "#e65c00",
      highlightTitle: "A Safe & Caring Space",
      features: [
        "Play-based international curriculum",
        "Eco-friendly sensory classrooms",
        "Healthy, nutritious child-friendly meals"
      ]
    }
  },
  {
    id: "apex-tech",
    name: "Apex Tech Institute (Professional & Tech)",
    description: "Indigo theme tailored for universities, professional courses, and technical bootcamps.",
    accentColor: "#3f51b5",
    config: {
      brandName: "Apex Tech Institute",
      heroTitle: "Accelerate Your Tech Career",
      heroSubtitle: "Industry-aligned bootcamps, hands-on coding labs, and dedicated placement support to get you hired.",
      heroCtaLabel: "Apply for Scholarship",
      heroCtaLink: "#contact",
      accentColor: "#3f51b5",
      highlightTitle: "Apex Academy Advantages",
      features: [
        "1-on-1 industry engineering mentors",
        "Guaranteed interview opportunities",
        "24/7 access to high-performance labs"
      ]
    }
  }
];

function LandingPageTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [activePage, setActivePage] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [previewPage, setPreviewPage] = useState(null);

  const enquiryFormsConfig = useApi(() => workflowConfigApi.get("enquiryForms"), []);
  const formsList = enquiryFormsConfig?.data?.data?.forms || enquiryFormsConfig?.data?.forms || [];

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("mode") !== "editor") {
      setActivePage(null);
    }
  }, [location.search]);

  const openNewLandingPage = () => {
    navigate("/crm/setup?active=landing-page&mode=wizard");
  };

  const handleSelectTemplate = (template) => {
    setShowTemplateModal(false);
    const newPage = {
      _id: undefined,
      name: `New ${template.name}`,
      ...template.config,
      isActive: true
    };
    setActivePage(newPage);
    navigate("/crm/setup?active=landing-page&mode=editor", { state: { page: newPage } });
  };

  const openEditLandingPage = (page) => {
    const p = {
      ...DEFAULT_LANDING_PAGE_CONFIG,
      ...page,
      features: page.features || [...DEFAULT_LANDING_PAGE_CONFIG.features]
    };
    setActivePage(p);
    navigate("/crm/setup?active=landing-page&mode=editor", { state: { page: p } });
  };

  const openPreviewLandingPage = (page) => {
    setPreviewPage(page);
  };

  const closeLandingPageEditor = () => {
    navigate("/crm/setup?active=landing-page&mode=list");
  };

  const saveLandingPage = async (pageData) => {
    try {
      const configRes = await workflowConfigApi.get("landingPages");
      const doc = configRes?.data || configRes;
      const dataPayload = doc?.data || doc;
      const currentPages = Array.isArray(dataPayload) ? dataPayload : dataPayload?.pages || [];

      const pageToSave = {
        ...pageData,
        _id: pageData._id || `lp-${Date.now()}`,
        createdAt: pageData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const isExisting = pageData._id && currentPages.some((p) => p._id === pageData._id);
      const nextPages = isExisting
        ? currentPages.map((p) => (p._id === pageData._id ? pageToSave : p))
        : [...currentPages, pageToSave];

      await workflowConfigApi.save("landingPages", { pages: nextPages });
      toast("Landing page saved successfully");
      closeLandingPageEditor();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const currentPage = activePage || location.state?.page;
  const currentMode = new URLSearchParams(location.search).get("mode") || "list";
  const isLandingPageEditor = currentPage && currentMode === "editor";
  const isLandingPageWizard = currentMode === "wizard";

  return (
    <>
      {isLandingPageEditor ? (
        <LandingPageBuilder
          key={`${currentPage?._id || "new"}`}
          initialPage={currentPage}
          formsList={formsList}
          onSave={saveLandingPage}
          onCancel={closeLandingPageEditor}
        />
      ) : isLandingPageWizard ? (
        <LandingPageWizard
          onSelect={(selectedConfig) => {
            const newPage = {
              _id: undefined,
              name: selectedConfig.name,
              pageType: selectedConfig.pageType,
              ...selectedConfig.config,
              isActive: true
            };
            setActivePage(newPage);
            navigate("/crm/setup?active=landing-page&mode=editor", { state: { page: newPage } });
          }}
          onCancel={closeLandingPageEditor}
        />
      ) : (
        <LandingPageList
          onCreate={openNewLandingPage}
          onEdit={openEditLandingPage}
          onPreview={openPreviewLandingPage}
        />
      )}

      {previewPage && (
        <Modal
          size="xl"
          title={previewPage.name || "Landing Page Preview"}
          onClose={() => setPreviewPage(null)}
          bodyStyle={{ padding: 0, background: "transparent" }}
          footer={<button className="btn btn-outline-secondary" type="button" onClick={() => setPreviewPage(null)}>Close</button>}
        >
          <iframe
            src={`${window.location.origin}/public/landing-page/${previewPage._id}`}
            title={`Preview ${previewPage.name}`}
            style={{ width: "100%", minHeight: "680px", border: "none", borderRadius: 0 }}
          />
        </Modal>
      )}

      {showTemplateModal && (
        <Modal
          title="Select a Landing Page Template"
          onClose={() => setShowTemplateModal(false)}
        >
          <div className="d-flex flex-column gap-3">
            {LANDING_PAGE_TEMPLATES.map((template) => (
              <div
                key={template.id}
                className="card p-3 border-2 hover-shadow"
                style={{
                  cursor: "pointer",
                  borderRadius: "12px",
                  transition: "all 0.2s ease-in-out",
                  borderLeft: `5px solid ${template.accentColor}`,
                  border: "1px solid #e2e8f0"
                }}
                onClick={() => handleSelectTemplate(template)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = template.accentColor;
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.transform = "none";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="fw-bold mb-1" style={{ color: "var(--dark)" }}>{template.name}</h6>
                    <p className="text-muted small mb-0">{template.description}</p>
                  </div>
                  <span
                    className="badge px-3 py-2 text-white"
                    style={{ background: template.accentColor, borderRadius: "6px" }}
                  >
                    Select
                  </span>
                </div>
                <div className="mt-3 p-2 bg-light rounded" style={{ borderLeft: `3px solid ${template.accentColor}` }}>
                  <div className="small fw-semibold text-secondary">Hero Title Preview:</div>
                  <div className="text-dark fw-bold">"{template.config.heroTitle}"</div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

function LandingPageList({ onCreate, onEdit, onPreview }) {
  const toast = useToast();
  const config = useApi(() => workflowConfigApi.get("landingPages"), []);
  const [pages, setPages] = useState([]);
  const [filter, setFilter] = useState("");

  const getPagesData = (raw) => {
    const data = raw?.data || raw;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.pages)) return data.pages;
    return [];
  };

  useEffect(() => {
    setPages(getPagesData(config.data));
  }, [config.data]);

  const deletePage = async (pageId) => {
    if (!window.confirm("Are you sure you want to delete this landing page?")) return;
    const nextPages = pages.filter((p) => p._id !== pageId);
    try {
      await workflowConfigApi.save("landingPages", { pages: nextPages });
      toast("Landing page deleted");
      config.reload();
      setPages(nextPages);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const filteredPages = pages.filter((p) =>
    p && (p.name || p.brandName || "").toLowerCase().includes(filter.toLowerCase())
  );

  const formatDateDMY = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const pad = (num) => String(num).padStart(2, "0");
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
  };

  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <span className="fw-semibold">Landing Pages</span>
          <div className="text-muted small">Manage marketing campaign landing pages, headers, highlights, and enquiry triggers.</div>
        </div>
        <button className="btn btn-sm btn-wa" onClick={onCreate}>
          <i className="bi bi-plus-lg me-1"></i>Create Landing Page
        </button>
      </div>

      <ErrorBox error={config.error} />

      {config.loading ? (
        <div className="card-body"><Spinner /></div>
      ) : (
        <div className="card-body">
          <div className="row gy-3 mb-4">
            <div className="col-sm-6">
              <input
                className="form-control"
                placeholder="Filter by landing page name..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <div className="col-sm-6 text-sm-end text-muted align-self-center">
              {filteredPages.length} landing page{filteredPages.length === 1 ? "" : "s"} found
            </div>
          </div>

          {filteredPages.length === 0 ? (
            <div className="text-center text-muted py-5">
              <div className="mb-3"><i className="bi bi-browser-chrome" style={{ fontSize: "32px", opacity: 0.5 }}></i></div>
              <div>No landing pages yet.</div>
              <button className="btn btn-sm btn-outline-wa mt-2" onClick={onCreate}>Create your first landing page</button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead>
                  <tr className="table-light">
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Name</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Brand Name</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Hero CTA</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Highlights</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Status</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Updated</th>
                    <th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPages.map((page) => (
                    <tr key={page._id}>
                      <td><span className="font-monospace text-dark" style={{ fontSize: "12px", fontWeight: 400 }}>{page.name || "Untitled Landing Page"}</span></td>
                      <td style={{ fontSize: "12px" }} className="text-secondary">{page.brandName || "—"}</td>
                      <td>
                        <span className="text-secondary" style={{ fontSize: "11.5px", fontWeight: 400 }}>
                          {page.heroCtaLabel || "Book a Visit"}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px" }} className="text-secondary">{(page.features || []).length} items</td>
                      <td>
                        <span style={{ fontSize: "12px", fontWeight: 500, color: page.isActive !== false ? "#16a34a" : "#6b7280" }}>
                          {page.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ fontSize: "11.5px" }} className="text-secondary">{page.updatedAt ? formatDateDMY(page.updatedAt) : "—"}</td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          <button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} title="Preview page" onClick={() => onPreview(page)}>
                            <i className="bi bi-eye" style={{ fontSize: "13px" }}></i>
                          </button>
                          <button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} title="Edit page" onClick={() => onEdit(page)}>
                            <i className="bi bi-pencil" style={{ fontSize: "13px" }}></i>
                          </button>
                          <button className="btn btn-sm border-0 text-secondary hover-danger p-1" style={{ fontSize: "12px" }} title="Delete page" onClick={() => deletePage(page._id)}>
                            <i className="bi bi-trash" style={{ fontSize: "13px" }}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );}

function EnquiryFormConfig() {
  const navigate = useNavigate();
  const toast = useToast();
  const config = useApi(() => workflowConfigApi.get("enquiryForms"), []);
  const [forms, setForms] = useState([]);
  const [filter, setFilter] = useState("");
  const [activeForm, setActiveForm] = useState(null);
  const [previewForm, setPreviewForm] = useState(null);

  const getEnquiryConfigData = (raw) => {
    const data = raw?.data || raw;
    return Array.isArray(data) ? data : data?.forms || data?.fields || [];
  };

  useEffect(() => {
    setForms(getEnquiryConfigData(config.data));
  }, [config.data]);

  const saveConfig = async (nextForms) => {
    try {
      const updatedForms = nextForms.map((form) => ({
        ...form,
        updatedAt: form.updatedAt || new Date().toISOString(),
        createdAt: form.createdAt || form.updatedAt || new Date().toISOString()
      }));
      await workflowConfigApi.save("enquiryForms", { forms: updatedForms });
      toast("Enquiry form configuration saved");
      config.reload();
      setForms(updatedForms);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const openNewForm = () => {
    navigate("/crm/setup/enquiry-forms/new");
  };

  const openEditForm = (form) => {
    navigate(`/crm/setup/enquiry-forms/${form._id}`);
  };

  const openPreview = (form) => setPreviewForm(form);
  const closePreview = () => setPreviewForm(null);

  const saveForm = async () => {
    if (!activeForm.name.trim()) {
      toast("Form name is required", "error");
      return;
    }

    const normalizedFields = (activeForm.fields || []).map((field) => ({
      fieldName: String(field.fieldName || field.label || "").trim().replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, ""),
      label: String(field.label || "").trim(),
      fieldType: field.fieldType || "text",
      isRequired: Boolean(field.isRequired),
      selected: Boolean(field.selected),
      hidden: Boolean(field.hidden),
      defaultValue: field.defaultValue || "",
      options: Array.isArray(field.options) ? field.options : []
    }));

    const formToSave = {
      ...activeForm,
      name: activeForm.name.trim(),
      heading: String(activeForm.heading || activeForm.name || "").trim(),
      tagline: String(activeForm.tagline || "").trim(),
      isActive: activeForm.isActive !== false,
      fields: normalizedFields,
      updatedAt: new Date().toISOString(),
      createdAt: activeForm.createdAt || new Date().toISOString(),
      _id: activeForm._id || `${Date.now()}`
    };

    const nextForms = activeForm._id
      ? forms.map((form) => (form._id === activeForm._id ? formToSave : form))
      : [...forms, formToSave];

    await saveConfig(nextForms);
    setActiveForm(null);
  };

  const deleteForm = async (formId) => {
    if (!confirm("Delete this enquiry form?")) return;
    const nextForms = forms.filter((form) => form._id !== formId);
    await saveConfig(nextForms);
  };

  const formatDateDMY = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const pad = (num) => String(num).padStart(2, "0");
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
  };

  const getShortSharePath = (formId) => `/public/enquiry-form/${formId}`;
  const getShareUrl = (formId) => `${window.location.origin}${getShortSharePath(formId)}`;
  const copyShareLink = async (formId) => {
    try {
      await navigator.clipboard.writeText(getShareUrl(formId));
      toast("Link copied");
    } catch (e) {
      toast(e.message || "Unable to copy link", "error");
    }
  };

  const filteredForms = forms.filter((form) => form.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <span className="fw-semibold">Enquiry Forms</span>
          <div className="text-muted small">Create named enquiry forms for campaigns and manage saved templates.</div>
        </div>
        {!activeForm && (
          <button className="btn btn-sm btn-wa" onClick={openNewForm}>
            <i className="bi bi-plus-lg me-1"></i>Create Enquiry Form
          </button>
        )}
      </div>

      <ErrorBox error={config.error} />

      {config.loading ? (
        <div className="card-body"><Spinner /></div>
      ) : activeForm ? (
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
            <div>
              <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => setActiveForm(null)}>Back to forms</button>
              <span className="fw-semibold">{activeForm._id ? "Edit enquiry form" : "Create enquiry form"}</span>
            </div>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                id="formActive"
                checked={activeForm.isActive}
                onChange={(e) => setActiveForm({ ...activeForm, isActive: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="formActive">Active</label>
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label">Form Name</label>
            <input
              className="form-control"
              value={activeForm.name}
              onChange={(e) => setActiveForm({ ...activeForm, name: e.target.value })}
              placeholder="e.g. Admission Enquiry"
            />
          </div>

          <div className="mb-4">
            <label className="form-label">Form Heading</label>
            <input
              className="form-control"
              value={activeForm.heading || ""}
              onChange={(e) => setActiveForm({ ...activeForm, heading: e.target.value })}
              placeholder="e.g. Admission Enquiry"
            />
          </div>

          <div className="mb-4">
            <label className="form-label">Tagline</label>
            <input
              className="form-control"
              value={activeForm.tagline || ""}
              onChange={(e) => setActiveForm({ ...activeForm, tagline: e.target.value })}
              placeholder="e.g. Share your details and we'll follow up with you."
            />
          </div>

          {activeForm._id && (
            <div className="alert alert-light border mb-4">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div className="small text-muted mb-1">Short link</div>
                  <div className="text-break fw-medium">{getShortSharePath(activeForm._id)}</div>
                </div>
                <button className="btn btn-sm btn-outline-secondary p-1" type="button" onClick={() => copyShareLink(activeForm._id)} title="Copy short link">
                  <i className="bi bi-clipboard"></i>
                </button>
              </div>
            </div>
          )}

          <div className="mb-3 d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-1">Form Fields</h5>
              <div className="text-muted small">Select which fields to include and mark them mandatory as needed.</div>
            </div>
            <div className="d-flex" style={{ gap: "4px" }}>
              {activeForm._id && (
                <button className="btn btn-sm btn-outline-secondary p-1" type="button" title="Preview form" onClick={() => openPreview(activeForm)}>
                  <i className="bi bi-eye"></i>
                </button>
              )}
              <button
                className="btn btn-sm btn-wa"
                onClick={() => setActiveForm({
                  ...activeForm,
                  fields: [...activeForm.fields, { fieldName: "", label: "New Field", fieldType: "text", isRequired: false, selected: true, options: [] }]
                })}
              >
                <i className="bi bi-plus-lg me-1"></i>Add Field
              </button>
            </div>
          </div>

          {(activeForm.fields || []).length === 0 ? (
            <EmptyState title="No fields configured" subtitle="Add a field to start building this enquiry form." />
          ) : (
            <div className="table-responsive mb-4">
              <table className="table table-bordered align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}></th>
                    <th>Label</th>
                    <th>Type</th>
                    <th style={{ width: 120 }}>Mandatory</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {activeForm.fields.map((field, idx) => (
                    <tr key={idx}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={Boolean(field.selected)}
                          onChange={(e) => {
                            const next = [...activeForm.fields];
                            next[idx] = { ...field, selected: e.target.checked };
                            setActiveForm({ ...activeForm, fields: next });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="form-control"
                          value={field.label}
                          onChange={(e) => {
                            const next = [...activeForm.fields];
                            next[idx] = { ...field, label: e.target.value };
                            setActiveForm({ ...activeForm, fields: next });
                          }}
                          placeholder="Field label"
                        />
                        <small className="text-muted">Internal name: {field.fieldName || field.label.toLowerCase().replace(/[^a-z0-9]+/g, "_")}</small>
                      </td>
                      <td>
                        <select
                          className="form-select"
                          value={field.fieldType}
                          onChange={(e) => {
                            const next = [...activeForm.fields];
                            next[idx] = { ...field, fieldType: e.target.value };
                            setActiveForm({ ...activeForm, fields: next });
                          }}
                        >
                          {ENQUIRY_FIELD_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>{type.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={Boolean(field.isRequired)}
                          onChange={(e) => {
                            const next = [...activeForm.fields];
                            next[idx] = { ...field, isRequired: e.target.checked };
                            setActiveForm({ ...activeForm, fields: next });
                          }}
                        />
                      </td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-link-danger"
                          onClick={() => {
                            const next = activeForm.fields.filter((_, i) => i !== idx);
                            setActiveForm({ ...activeForm, fields: next });
                          }}
                          title="Remove field"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="d-flex gap-2">
            <button className="btn btn-wa" onClick={saveForm}>Save form</button>
            <button className="btn btn-outline-secondary" onClick={() => setActiveForm(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="card-body">
          <div className="row gy-3 mb-4">
            <div className="col-sm-6">
              <input
                className="form-control"
                placeholder="Filter by form name"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <div className="col-sm-6 text-sm-end text-muted align-self-center">
              {filteredForms.length} form{filteredForms.length === 1 ? "" : "s"} found
            </div>
          </div>

          {filteredForms.length === 0 ? (
            <div className="text-center text-muted py-5">
              <div className="mb-3"><i className="bi bi-folder2-open" style={{ fontSize: "32px", opacity: 0.5 }}></i></div>
              <div>No enquiry forms yet.</div>
              <button className="btn btn-sm btn-outline-wa mt-2" onClick={openNewForm}>Create your first enquiry form</button>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0 align-middle" style={{ fontSize: "12px" }}>
                <thead>
                  <tr className="table-light">
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Name</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Status</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Fields</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Updated</th>
                    <th style={{ fontSize: "12px", fontWeight: 600 }}>Link</th>
                    <th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredForms.map((form) => (
                    <tr key={form._id}>
                      <td style={{ fontSize: "12px", fontWeight: 400 }}>{form.name}</td>
                      <td>
                        <span style={{ fontSize: "12px", fontWeight: 500, color: form.isActive ? "#16a34a" : "#6b7280" }}>
                          {form.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px" }} className="text-secondary">{(form.fields || []).filter((field) => field.selected).length}</td>
                      <td style={{ fontSize: "11.5px" }} className="text-secondary">{form.updatedAt ? formatDateDMY(form.updatedAt) : "—"}</td>
                      <td className="text-break">
                        <div className="d-flex align-items-center" style={{ gap: "4px" }}>
                          <a href={getShareUrl(form._id)} target="_blank" rel="noreferrer" className="text-decoration-none" style={{ fontSize: "12px" }}>{getShortSharePath(form._id)}</a>
                          <button className="btn btn-sm border-0 text-secondary p-1" type="button" title="Copy short link" onClick={() => copyShareLink(form._id)}>
                            <i className="bi bi-clipboard" style={{ fontSize: "13px" }}></i>
                          </button>
                        </div>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          <button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} title="Edit enquiry form" onClick={() => openEditForm(form)}>
                            <i className="bi bi-pencil" style={{ fontSize: "13px" }}></i>
                          </button>
                          <button className="btn btn-sm border-0 text-secondary hover-danger p-1" style={{ fontSize: "12px" }} title="Delete form" onClick={() => deleteForm(form._id)}>
                            <i className="bi bi-trash" style={{ fontSize: "13px" }}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {previewForm && (
        <Modal
          size="xl"
          title={previewForm.name || "Enquiry Form"}
          onClose={closePreview}
          bodyStyle={{ padding: 0, background: "transparent" }}
          footer={<button className="btn btn-outline-secondary" type="button" onClick={closePreview}>Close</button>}
        >
          <iframe
            src={getShareUrl(previewForm._id)}
            title={`Preview ${previewForm.name}`}
            style={{ width: "100%", minHeight: "680px", border: "none", borderRadius: 0 }}
          />
        </Modal>
      )}
    </div>
  );
}

function IntegrationPlaceholder({ title }) {
  return (
    <div className="card">
      <div className="card-header bg-white fw-semibold">{title}</div>
      <div className="card-body text-center text-muted py-5">{title} configuration coming soon...</div>
    </div>
  );
}

function AIIntegrationSetupCard() {
  const navigate = useNavigate();
  return (
    <div className="card shadow-xs border-0">
      <div className="card-body p-4">
        <div className="d-flex align-items-center gap-3 mb-3">
          <div className="p-2.5 rounded-3 bg-emerald-50 text-success border border-success-subtle">
            <i className="bi bi-stars" style={{ fontSize: 24 }}></i>
          </div>
          <div>
            <h5 className="fw-bold mb-1">AI Assistant & Copilot Integration</h5>
            <p className="text-muted small mb-0">
              Configure Google Gemini, Anthropic Claude, or OpenAI for automated operational tasks across CRM & Events.
            </p>
          </div>
        </div>
        <div className="p-3 rounded-3 bg-light border mb-4">
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <div className="fw-semibold small">Full AI Integration Hub</div>
              <div className="text-muted" style={{ fontSize: 11.5 }}>
                Manage API keys, select LLM models (Gemini / Claude), and toggle the floating AI Copilot button.
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm rounded-pill px-3"
              onClick={() => navigate("/modules/integrations-ai")}
            >
              Open AI Configuration ➔
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommunicationTemplatesConfig() {
  const toast = useToast();
  const list = useApi(() => templatesApi.list({ perPage: 100 }), []);
  const [activeTab, setActiveTab] = useState("email");
  const [filter, setFilter] = useState("");
  const [editTemplate, setEditTemplate] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const rows = (list.data || []).filter(
    (t) => (t.channel || "whatsapp") === activeTab
  );

  const filteredRows = rows.filter(
    (t) =>
      (t.name || "").toLowerCase().includes(filter.toLowerCase()) ||
      (t.body || "").toLowerCase().includes(filter.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await templatesApi.remove(id);
      toast("Template deleted successfully");
      list.reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const handleEdit = (template) => {
    setEditTemplate({
      ...template,
      subject: template.subject || "",
      language: template.language || "en",
      category: template.category || "Utility",
      body: template.body || "",
      status: template.status || "Draft"
    });
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditTemplate({
      _id: undefined,
      name: "",
      channel: activeTab,
      subject: "",
      language: "en",
      category: "Utility",
      body: "",
      status: "Draft"
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!editTemplate.name || !editTemplate.name.trim()) {
      toast("Template name is required", "error");
      return;
    }
    if (!editTemplate.body || !editTemplate.body.trim()) {
      toast("Template body is required", "error");
      return;
    }

    try {
      if (editTemplate._id) {
        await templatesApi.update(editTemplate._id, editTemplate);
        toast("Template updated successfully");
      } else {
        await templatesApi.create(editTemplate);
        toast("Template created successfully");
      }
      setShowForm(false);
      setEditTemplate(null);
      list.reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const formatDateDMY = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const pad = (num) => String(num).padStart(2, "0");
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
  };

  const tTabLabel = activeTab === "email" ? "Email" : activeTab === "whatsapp" ? "WhatsApp" : "SMS";

  if (showForm && activeTab === "whatsapp") {
    return (
      <WhatsAppTemplateBuilder
        initialTemplate={editTemplate}
        onCancel={() => setShowForm(false)}
        onSaved={() => {
          setShowForm(false);
          list.reload();
        }}
      />
    );
  }

  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <span className="fw-semibold">Communication Templates</span>
          <div className="text-muted small">Manage templates for automated Email, WhatsApp, and SMS messages.</div>
        </div>
        <button className="btn btn-sm btn-wa" onClick={handleCreate}>
          <i className="bi bi-plus-lg me-1"></i>Create {tTabLabel} Template
        </button>
      </div>

      <div className="card-body">
        <div className="mb-4">
          <Tabs
            tabs={[
              { value: "email", label: "Email Templates" },
              { value: "whatsapp", label: "WhatsApp Templates" },
              { value: "sms", label: "SMS Templates" }
            ]}
            value={activeTab}
            onChange={(val) => {
              setActiveTab(val);
              setFilter("");
            }}
          />
        </div>

        <div className="row gy-3 mb-3 align-items-center">
          <div className="col-sm-5">
            <input
              className="form-control form-control-sm"
              style={{ fontSize: "12.5px", padding: "5px 10px" }}
              placeholder={`Search ${tTabLabel} templates...`}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="col-sm-7 text-sm-end text-muted" style={{ fontSize: "12px" }}>
            {filteredRows.length} template{filteredRows.length === 1 ? "" : "s"} found
          </div>
        </div>

        <ErrorBox error={list.error} />

        {list.loading ? (
          <Spinner />
        ) : filteredRows.length === 0 ? (
          <div className="text-center text-muted py-5" style={{ fontSize: "12px" }}>
            <div className="mb-3"><i className="bi bi-chat-text" style={{ fontSize: "28px", opacity: 0.5 }}></i></div>
            <div>No templates configured.</div>
            <button className="btn btn-sm btn-outline-wa mt-2" style={{ fontSize: "12px" }} onClick={handleCreate}>Create your first template</button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle" style={{ fontSize: "12px" }}>
              <thead>
                <tr className="table-light">
                  <th style={{ fontSize: "12px", fontWeight: 600 }}>Name</th>
                  {activeTab !== "email" && <th style={{ fontSize: "12px", fontWeight: 600 }}>Category</th>}
                  {activeTab === "email" && <th style={{ fontSize: "12px", fontWeight: 600 }}>Subject</th>}
                  <th style={{ fontSize: "12px", fontWeight: 600 }}>Content</th>
                  {activeTab !== "email" && <th style={{ fontSize: "12px", fontWeight: 600 }}>Status</th>}
                  <th style={{ fontSize: "12px", fontWeight: 600 }}>Updated</th>
                  <th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((t) => (
                  <tr key={t._id}>
                    <td>
                      <span className="font-monospace text-dark" style={{ fontSize: "12px", fontWeight: 400 }}>
                        {t.name}
                      </span>
                    </td>
                    {activeTab !== "email" && (
                      <td style={{ fontSize: "12px" }} className="text-secondary">
                        {t.category || "Utility"}
                      </td>
                    )}
                    {activeTab === "email" && <td style={{ fontSize: "12px" }} className="text-dark">{t.subject || "—"}</td>}
                    <td>
                      <span
                        className="small text-muted text-truncate d-inline-block"
                        style={{ maxWidth: 280, fontSize: "12px" }}
                        title={t.body}
                      >
                        {(t.body || "").replace(/<[^>]+>/g, " ")}
                      </span>
                    </td>
                    {activeTab !== "email" && (
                      <td>
                        <span style={{ fontSize: "12px", fontWeight: 500, color: t.status === "Approved" ? "#16a34a" : t.status === "Rejected" ? "#dc2626" : "#6b7280" }}>
                          {t.status || "Draft"}
                        </span>
                      </td>
                    )}
                    <td style={{ fontSize: "11.5px" }} className="text-secondary">{t.updatedAt ? formatDateDMY(t.updatedAt) : "—"}</td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        <button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} title="Edit" onClick={() => handleEdit(t)}>
                          <i className="bi bi-pencil" style={{ fontSize: "13px" }}></i>
                        </button>
                        <button className="btn btn-sm border-0 text-secondary hover-danger p-1" style={{ fontSize: "12px" }} title="Delete" onClick={() => handleDelete(t._id)}>
                          <i className="bi bi-trash" style={{ fontSize: "13px" }}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && editTemplate && (
        <Modal
          title={editTemplate._id ? `Edit ${tTabLabel} Template` : `Create ${tTabLabel} Template`}
          onClose={() => {
            setShowForm(false);
            setEditTemplate(null);
          }}
          footer={
            <>
              <button
                className="btn btn-sm btn-outline-secondary me-2"
                style={{ fontSize: "12px" }}
                onClick={() => {
                  setShowForm(false);
                  setEditTemplate(null);
                }}
              >
                Cancel
              </button>
              <button className="btn btn-sm btn-wa" style={{ fontSize: "12px" }} onClick={handleSave}>
                Save
              </button>
            </>
          }
        >
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label fw-semibold">Template Name</label>
              <input
                className="form-control"
                value={editTemplate.name}
                onChange={(e) => setEditTemplate({ ...editTemplate, name: e.target.value.replace(/\s+/g, "_") })}
                placeholder="e.g. registration_ack_v1"
                disabled={Boolean(editTemplate._id)}
              />
              <small className="text-muted">Use snake_case, e.g. payment_reminder</small>
            </div>
            {activeTab === "email" && (
              <div className="col-12">
                <label className="form-label fw-semibold">Email Subject</label>
                <input
                  className="form-control"
                  value={editTemplate.subject}
                  onChange={(e) => setEditTemplate({ ...editTemplate, subject: e.target.value })}
                  placeholder="e.g. Welcome to EduNext Admission Portal"
                />
              </div>
            )}
            <div className={activeTab === "email" ? "col-12" : "col-md-6"}>
              <label className="form-label fw-semibold">Language</label>
              <input
                className="form-control"
                value={editTemplate.language}
                onChange={(e) => setEditTemplate({ ...editTemplate, language: e.target.value })}
                placeholder="en"
              />
            </div>
            {activeTab !== "email" && (
              <div className="col-md-6">
                <label className="form-label fw-semibold">Category</label>
                <select
                  className="form-select"
                  value={editTemplate.category}
                  onChange={(e) => setEditTemplate({ ...editTemplate, category: e.target.value })}
                >
                  <option value="Utility">Utility</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Authentication">Authentication</option>
                </select>
              </div>
            )}
            {activeTab === "whatsapp" && (
              <div className="col-12">
                <label className="form-label fw-semibold">Meta Status</label>
                <select
                  className="form-select"
                  value={editTemplate.status}
                  onChange={(e) => setEditTemplate({ ...editTemplate, status: e.target.value })}
                >
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            )}
            <div className="col-12">
              <label className="form-label fw-semibold">
                {activeTab === "email" ? "Body (HTML allowed)" : "Body Content"}
              </label>
              <textarea
                className="form-control"
                rows={6}
                value={editTemplate.body}
                onChange={(e) => setEditTemplate({ ...editTemplate, body: e.target.value })}
                placeholder={
                  activeTab === "email"
                    ? "<h1>Dear {{1}},</h1><p>We received your application...</p>"
                    : "Hi {{1}}, we have received your application for grade {{2}}."
                }
              />
              <small className="text-muted">
                Use {"{{1}}"}, {"{{2}}"} as placeholder variables.
              </small>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function WhatsAppTemplatesSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const list = useApi(() => templatesApi.list({ perPage: 100 }), []);
  const [filter, setFilter] = useState("");
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      list.reload();
    }, 15000);
    return () => clearInterval(id);
  }, [list.reload]);

  const getMode = () => {
    const params = new URLSearchParams(location.search);
    return params.get("mode") || "list";
  };
  const mode = getMode();

  const handleSyncMeta = async () => {
    setSyncing(true);
    try {
      const res = await templatesApi.syncMeta();
      toast(`Synced ${res.count} templates from Meta ✓`);
      list.reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (name) => {
    if (!confirm(`Delete template '${name}'?`)) return;
    try {
      await templatesApi.deleteMeta(name);
      toast("Template deleted");
      list.reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const openNewTemplate = () => {
    setActiveTemplate(null);
    navigate("/crm/setup?active=whatsapp-templates&mode=editor");
  };

  const openEditTemplate = (tpl) => {
    setActiveTemplate(tpl);
    navigate("/crm/setup?active=whatsapp-templates&mode=editor");
  };

  const closeEditor = () => {
    navigate("/crm/setup?active=whatsapp-templates&mode=list");
    list.reload();
  };

  if (mode === "editor") {
    return (
      <WhatsAppTemplateBuilder
        initialTemplate={activeTemplate}
        onCancel={closeEditor}
        onSaved={closeEditor}
      />
    );
  }

  const rows = (list.data || []).filter((t) => (t.channel || "whatsapp") === "whatsapp");
  const filtered = rows.filter((t) =>
    (t.name || "").toLowerCase().includes(filter.toLowerCase()) ||
    (t.body || "").toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <span className="fw-semibold">WhatsApp Templates</span>
          <div className="text-muted small">Manage and create Meta WhatsApp message templates.</div>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-secondary" disabled={syncing} onClick={handleSyncMeta}>
            {syncing ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-arrow-repeat me-1"></i>}
            Sync Meta
          </button>
          <button className="btn btn-sm btn-wa" onClick={openNewTemplate}>
            <i className="bi bi-plus-lg me-1"></i>Create Template
          </button>
        </div>
      </div>

      <div className="card-body" style={{ fontSize: "12px" }}>
        <div className="row gy-3 mb-3 align-items-center">
          <div className="col-sm-5">
            <input
              className="form-control form-control-sm"
              style={{ fontSize: "12.5px", padding: "5px 10px" }}
              placeholder="Search WhatsApp templates..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <div className="col-sm-7 text-sm-end text-muted" style={{ fontSize: "12px" }}>
            {filtered.length} template{filtered.length === 1 ? "" : "s"} found
          </div>
        </div>

        <ErrorBox error={list.error} />

        {list.loading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted py-5" style={{ fontSize: "12px" }}>
            <div className="mb-3"><i className="bi bi-whatsapp" style={{ fontSize: "28px", opacity: 0.5 }}></i></div>
            <div>No WhatsApp templates found.</div>
            <button className="btn btn-sm btn-outline-wa mt-2" style={{ fontSize: "12px" }} onClick={openNewTemplate}>
              Create your first WhatsApp template
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle" style={{ fontSize: "12px" }}>
              <thead>
                <tr className="table-light">
                  <th style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)" }}>Name</th>
                  <th style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)" }}>Category</th>
                  <th style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)" }}>Status</th>
                  <th style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)" }}>Content Preview</th>
                  <th style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)" }}>Updated</th>
                  <th className="text-end" style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-2)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t._id || t.name}>
                    <td>
                      <span className="font-monospace text-dark" style={{ fontSize: "12px", fontWeight: 400 }}>{t.name}</span>
                    </td>
                    <td>
                      <span className="text-secondary text-uppercase" style={{ fontSize: "11.5px", fontWeight: 400 }}>{t.category || "UTILITY"}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: t.status === "Approved" ? "#16a34a" : t.status === "Rejected" ? "#dc2626" : "#d97706" }}>
                        {t.status || "Approved"}
                      </span>
                    </td>
                    <td>
                      <span className="text-muted text-truncate d-inline-block" style={{ maxWidth: 280, fontSize: "12px" }}>
                        {t.body}
                      </span>
                    </td>
                    <td style={{ fontSize: "11.5px" }} className="text-secondary">
                      {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-1">
                        <button className="btn btn-sm border-0 text-secondary hover-primary p-1" style={{ fontSize: "12px" }} onClick={() => openEditTemplate(t)} title="Edit template">
                          <i className="bi bi-pencil" style={{ fontSize: "13px" }}></i>
                        </button>
                        <button className="btn btn-sm border-0 text-secondary hover-danger p-1" style={{ fontSize: "12px" }} onClick={() => handleDelete(t.name)} title="Delete template">
                          <i className="bi bi-trash" style={{ fontSize: "13px" }}></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function OrganizationDetails() {
  const toast = useToast();
  const [data, setData] = useState({
    name: "",
    address: "",
    code: "",
    loginImages: []
  });
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (data.loginImages.length > 0) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % data.loginImages.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [data.loginImages.length]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await mastersApi.list("organization");
      if (response.data && response.data.length > 0) {
        const orgData = response.data[0];
        setData(orgData);
        setImages(orgData.loginImages || []);
      }
    } catch (e) {
      console.log("No organization data found");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (data.loginImages.length + files.length > 5) {
      toast("Maximum 5 images allowed", "error");
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setData((prev) => ({
          ...prev,
          loginImages: [...prev.loginImages, event.target.result]
        }));
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setData((prev) => ({
      ...prev,
      loginImages: prev.loginImages.filter((_, i) => i !== index)
    }));
    if (currentImageIndex >= prev.loginImages.length - 1) {
      setCurrentImageIndex(0);
    }
  };

  const save = async () => {
    try {
      if (!data.name || !data.address || !data.code) {
        toast("Please fill all required fields", "error");
        return;
      }
      setLoading(true);
      if (data._id) {
        await mastersApi.update("organization", data._id, data);
      } else {
        await mastersApi.create("organization", data);
      }
      toast("Organization details saved");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ borderRadius: "var(--radius)" }}>
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <span className="fw-semibold">Organization Details</span>
          <div className="text-muted small">Configure your organization information and login branding</div>
        </div>
      </div>
      <div className="card-body" style={{ padding: "20px" }}>
        {loading ? (
          <Spinner />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
            {/* Left Side - Form */}
            <div>
              <div className="mb-3">
                <label className="form-label small fw-medium">Organization Name *</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                  placeholder="Enter organization name"
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Address *</label>
                <textarea
                  className="form-control form-control-sm"
                  rows="3"
                  value={data.address}
                  onChange={(e) => setData({ ...data, address: e.target.value })}
                  placeholder="Enter organization address"
                ></textarea>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Organization Code *</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={data.code}
                  onChange={(e) => setData({ ...data, code: e.target.value })}
                  placeholder="Enter organization code"
                />
              </div>

              <button className="btn btn-primary btn-sm" onClick={save} disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {/* Right Side - Image Upload */}
            <div>
              <label className="form-label small fw-medium d-block mb-3">Login Images (Max 5)</label>

              {/* Image Preview */}
              {data.loginImages.length > 0 && (
                <div
                  style={{
                    marginBottom: "20px",
                    borderRadius: "8px",
                    overflow: "hidden",
                    backgroundColor: "#f0f0f0",
                    height: "250px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative"
                  }}
                >
                  <img
                    src={data.loginImages[currentImageIndex]}
                    alt={`Login image ${currentImageIndex + 1}`}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "cover"
                    }}
                  />
                  {data.loginImages.length > 1 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "10px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        gap: "8px"
                      }}
                    >
                      {data.loginImages.map((_, idx) => (
                        <div
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: idx === currentImageIndex ? "#fff" : "rgba(255,255,255,0.5)",
                            cursor: "pointer",
                            border: "1px solid white"
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Upload Button */}
              <div
                style={{
                  border: "2px dashed #ddd",
                  borderRadius: "8px",
                  padding: "20px",
                  textAlign: "center",
                  cursor: "pointer",
                  backgroundColor: "#fafafa",
                  marginBottom: "15px",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#1e3c72")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#ddd")}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: "none" }}
                  id="image-upload"
                />
                <label htmlFor="image-upload" style={{ cursor: "pointer", marginBottom: 0 }}>
                  <i className="bi bi-cloud-upload" style={{ fontSize: "24px", color: "#666", marginBottom: "8px", display: "block" }}></i>
                  <div style={{ fontSize: "13px", color: "#333", fontWeight: 500 }}>Click to upload images</div>
                  <div style={{ fontSize: "12px", color: "#999", marginTop: "4px" }}>or drag and drop</div>
                </label>
              </div>

              {/* Uploaded Images Grid */}
              {data.loginImages.length > 0 && (
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "10px", color: "#666" }}>
                    Uploaded Images ({data.loginImages.length}/5)
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: "10px" }}>
                    {data.loginImages.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: "relative",
                          aspectRatio: "1",
                          borderRadius: "6px",
                          overflow: "hidden",
                          backgroundColor: "#f0f0f0",
                          border: idx === currentImageIndex ? "2px solid #1e3c72" : "1px solid #ddd"
                        }}
                      >
                        <img
                          src={img}
                          alt={`Thumbnail ${idx + 1}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            cursor: "pointer"
                          }}
                          onClick={() => setCurrentImageIndex(idx)}
                        />
                        <button
                          onClick={() => removeImage(idx)}
                          style={{
                            position: "absolute",
                            top: "2px",
                            right: "2px",
                            backgroundColor: "rgba(0,0,0,0.6)",
                            border: "none",
                            color: "#fff",
                            borderRadius: "3px",
                            width: "20px",
                            height: "20px",
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            fontSize: "12px"
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

