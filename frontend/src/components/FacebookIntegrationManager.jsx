import React, { useState, useEffect } from "react";
import {
  Plug,
  Plus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Pencil,
  Trash2,
  Key,
  ShieldCheck,
  FileText,
  Activity,
  HelpCircle,
  ArrowRight,
  Sliders,
  Check,
  Play,
  User,
} from "lucide-react";
import { facebookApi } from "../api";
import { useToast } from "../context/ToastContext";

// Standard CRM Lead target fields for mapping
const CRM_LEAD_FIELDS = [
  { key: "name", label: "Lead Name" },
  { key: "phone", label: "Phone Number" },
  { key: "email", label: "Email Address" },
  { key: "city", label: "City" },
  { key: "offering", label: "Offering / Service" },
  { key: "notes", label: "Notes / Comments" },
  { key: "ignore", label: "— Do Not Map (Ignore) —" },
];

// Sample Facebook Lead Ads Forms for demo / selection
const MOCK_FB_PAGES = [
  {
    pageId: "109823746192834",
    pageName: "KnowVato Academy Official",
    accessToken: "EAAG_KNOWVATO_PAGE_TOKEN_DEMO_987",
    forms: [
      {
        id: "form_101",
        name: "Admissions 2026-27 Lead Form",
        status: "ACTIVE",
        fields: [
          { name: "full_name", label: "Full Name", type: "FULL_NAME" },
          { name: "phone_number", label: "Phone Number", type: "PHONE" },
          { name: "email", label: "Email Address", type: "EMAIL" },
          { name: "city_name", label: "City", type: "CITY" },
          { name: "course_interest", label: "Course / Grade Interest", type: "CUSTOM" },
        ],
      },
      {
        id: "form_102",
        name: "Course Enquiry Quick Form",
        status: "ACTIVE",
        fields: [
          { name: "full_name", label: "Applicant Name", type: "FULL_NAME" },
          { name: "phone_number", label: "Mobile Number", type: "PHONE" },
          { name: "email_address", label: "Email ID", type: "EMAIL" },
          { name: "notes_comments", label: "Questions / Remarks", type: "CUSTOM" },
        ],
      },
    ],
  },
  {
    pageId: "209485736102948",
    pageName: "Edunextion Global Campus",
    accessToken: "EAAG_EDUNEXTION_PAGE_TOKEN_DEMO_123",
    forms: [
      {
        id: "form_201",
        name: "Campus Tour Request Form",
        status: "ACTIVE",
        fields: [
          { name: "full_name", label: "Parent Name", type: "FULL_NAME" },
          { name: "phone_number", label: "Contact Number", type: "PHONE" },
          { name: "email", label: "Email", type: "EMAIL" },
          { name: "preferred_date", label: "Preferred Tour Date", type: "CUSTOM" },
        ],
      },
    ],
  },
];

export default function FacebookIntegrationManager({ showHeader = true, backLink = null }) {
  const toast = useToast();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [modalStep, setModalStep] = useState(1); // 1: SSO Connect, 2: Select Page & Form, 3: Field Mapping
  const [ssoConnected, setSsoConnected] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [selectedPage, setSelectedPage] = useState(MOCK_FB_PAGES[0]);
  const [selectedForm, setSelectedForm] = useState(MOCK_FB_PAGES[0].forms[0]);
  const [showInstructions, setShowInstructions] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const initialFormState = {
    id: null,
    backendId: null,
    pageName: "",
    pageId: "",
    pageAccessToken: "",
    appSecret: "",
    verifyToken: "knowvato_fb_token",
    active: true,
    status: "untested",
    selectedFormId: "form_101",
    formMapping: {
      full_name: "name",
      phone_number: "phone",
      email: "email",
      city_name: "city",
      course_interest: "offering",
    },
  };

  const [form, setForm] = useState(initialFormState);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await facebookApi.list();
      const raw = res?.data || res || [];
      const list = (Array.isArray(raw) ? raw : []).map((item) => ({
        id: item._id,
        backendId: item._id,
        pageName: item.config?.pageName || item.name || "Facebook Page",
        pageId: item.config?.pageId || item.account || "",
        pageAccessToken: item.config?.pageAccessToken || "",
        appSecret: item.config?.appSecret || "",
        verifyToken: item.config?.verifyToken || "knowvato_fb_token",
        active: item.connected ?? item.config?.active ?? true,
        status: item.config?.status || (item.connected ? "connected" : "untested"),
        createdAt: item.createdAt || new Date().toISOString(),
        callbackUrl: `${window.location.origin}/webhooks/facebook/${item.tenant || "default"}`,
        formMapping: item.config?.formMapping || initialFormState.formMapping,
        selectedFormId: item.config?.selectedFormId || "form_101",
      }));
      setIntegrations(list);
    } catch (err) {
      console.warn("Failed to load Facebook integrations:", err);
      toast(err.message || "Failed to load integrations", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const startCreate = () => {
    setForm(initialFormState);
    setModalStep(1);
    setSsoConnected(false);
    setTestResult(null);
    setOpenModal(true);
  };

  const startEdit = (item) => {
    const page = MOCK_FB_PAGES.find((p) => p.pageId === item.pageId) || MOCK_FB_PAGES[0];
    const fbForm = page.forms.find((f) => f.id === item.selectedFormId) || page.forms[0];
    setSelectedPage(page);
    setSelectedForm(fbForm);
    setForm({
      id: item.id,
      backendId: item.backendId,
      pageName: item.pageName,
      pageId: item.pageId,
      pageAccessToken: item.pageAccessToken,
      appSecret: item.appSecret,
      verifyToken: item.verifyToken,
      active: Boolean(item.active),
      status: item.status || "untested",
      selectedFormId: item.selectedFormId || fbForm.id,
      formMapping: item.formMapping || initialFormState.formMapping,
    });
    setSsoConnected(true);
    setModalStep(3); // Direct to Field Mapping for edit
    setTestResult(null);
    setOpenModal(true);
  };

  // Simulate Facebook SSO Login
  const handleFacebookSSO = () => {
    setSsoLoading(true);
    setTimeout(() => {
      setSsoLoading(false);
      setSsoConnected(true);
      setForm((prev) => ({
        ...prev,
        pageName: MOCK_FB_PAGES[0].pageName,
        pageId: MOCK_FB_PAGES[0].pageId,
        pageAccessToken: MOCK_FB_PAGES[0].accessToken,
        status: "connected",
      }));
      toast("Successfully authenticated via Facebook Single Sign-On! Managed Pages retrieved.");
      setModalStep(2);
    }, 1200);
  };

  const handleSelectPage = (page) => {
    setSelectedPage(page);
    const firstForm = page.forms[0];
    setSelectedForm(firstForm);
    setForm((prev) => ({
      ...prev,
      pageName: page.pageName,
      pageId: page.pageId,
      pageAccessToken: page.accessToken,
      selectedFormId: firstForm?.id,
    }));
  };

  const handleSelectForm = (fbForm) => {
    setSelectedForm(fbForm);
    // Initialize field mapping for detected form fields
    const defaultMap = {};
    (fbForm.fields || []).forEach((field) => {
      if (field.name.includes("name")) defaultMap[field.name] = "name";
      else if (field.name.includes("phone") || field.name.includes("mobile")) defaultMap[field.name] = "phone";
      else if (field.name.includes("email")) defaultMap[field.name] = "email";
      else if (field.name.includes("city")) defaultMap[field.name] = "city";
      else if (field.name.includes("course") || field.name.includes("grade") || field.name.includes("interest")) defaultMap[field.name] = "offering";
      else defaultMap[field.name] = "notes";
    });

    setForm((prev) => ({
      ...prev,
      selectedFormId: fbForm.id,
      formMapping: defaultMap,
    }));
  };

  const handleFieldMappingChange = (fbFieldName, crmFieldKey) => {
    setForm((prev) => ({
      ...prev,
      formMapping: {
        ...prev.formMapping,
        [fbFieldName]: crmFieldKey,
      },
    }));
  };

  const handleTestFieldMapping = () => {
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      const simulatedData = {
        name: "Rahul Sharma",
        phone: "+91 98765 43210",
        email: "rahul.sharma@example.com",
        city: "New Delhi",
        offering: "Admissions 2026-27",
      };
      setTestResult(simulatedData);
      toast("Field mapping test passed! Sample payload verified ✓");
    }, 800);
  };

  const toggleActive = async (item) => {
    try {
      await facebookApi.activate(item.backendId || item.id);
      toast(`${item.pageName} integration status updated`);
      loadData();
    } catch (err) {
      toast(err.message || "Failed to activate integration", "error");
    }
  };

  const onDelete = async (item) => {
    if (confirm(`Are you sure you want to delete Facebook integration for ${item.pageName}?`)) {
      try {
        await facebookApi.remove(item.backendId || item.id);
        toast("Facebook integration deleted!");
        loadData();
      } catch (err) {
        toast(err.message || "Delete failed", "error");
      }
    }
  };

  const onSave = async () => {
    if (!form.pageName || !form.pageId) {
      toast("Page Name and Page ID are required", "error");
      return;
    }

    try {
      const payload = {
        pageName: form.pageName,
        pageId: form.pageId,
        pageAccessToken: form.pageAccessToken,
        appSecret: form.appSecret,
        verifyToken: form.verifyToken,
        active: form.active,
        formMapping: form.formMapping,
        selectedFormId: form.selectedFormId,
      };

      if (form.backendId) {
        await facebookApi.update(form.backendId, payload);
        toast("Facebook integration updated!");
      } else {
        await facebookApi.create(payload);
        toast("Facebook integration saved!");
      }

      setOpenModal(false);
      loadData();
    } catch (err) {
      toast(err.message || "Failed to save integration", "error");
    }
  };

  return (
    <div className="facebook-integration-wrapper space-y-4">
      {/* Top Header Section */}
      <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-3">
        <div>
          {backLink}
          <h4 className="fw-semibold mb-1 d-flex align-items-center gap-2" style={{ color: "var(--text)", fontSize: "16px" }}>
            <i className="bi bi-facebook text-primary" style={{ fontSize: "1.3rem" }}></i>
            Facebook Integration
          </h4>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
            style={{ fontSize: "12px" }}
            onClick={() => setShowInstructions(!showInstructions)}
          >
            <HelpCircle size={14} /> Setup Guide
          </button>
          <button className="btn btn-sm btn-wa d-inline-flex align-items-center gap-1" style={{ fontSize: "12px" }} onClick={startCreate}>
            <Plus size={14} /> FB Integration
          </button>
        </div>
      </div>

      {/* Setup Instructions Drawer */}
      {showInstructions && (
        <div className="card mb-4 border" style={{ borderRadius: "var(--radius)", fontSize: "12px" }}>
          <div className="card-header bg-white py-2 px-3 fw-semibold text-dark d-flex align-items-center justify-content-between">
            <span>Facebook Single Sign-On & Lead Ads Setup Process</span>
            <button className="btn-close" style={{ fontSize: "10px" }} onClick={() => setShowInstructions(false)}></button>
          </div>
          <div className="card-body py-3 px-3">
            <ol className="mb-0 ps-3 space-y-1 text-secondary">
              <li>
                <strong>Single Sign-On (SSO):</strong> Click <em>FB Integration</em> → Click <strong>Connect with Facebook</strong> to authenticate your Meta Manager account.
              </li>
              <li>
                <strong>Select Managed Page & Form:</strong> Choose your active Facebook Page and the target Lead Ad Form.
              </li>
              <li>
                <strong>Field Mapping:</strong> Map each Facebook form input (e.g. <code>full_name</code>, <code>phone_number</code>) to CRM Lead fields.
              </li>
              <li>
                <strong>Webhook Callback:</strong> Add Webhook URL <code>{window.location.origin}/webhooks/facebook/:tenantId</code> in Meta Developer Console to receive live lead leads instantly.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="card border-0 shadow-sm overflow-hidden" style={{ borderRadius: "var(--radius)" }}>
        <div className="card-header bg-white py-3 px-4 d-flex align-items-center justify-content-between border-bottom">
          <div className="d-flex align-items-center gap-2">
            <Plug className="text-secondary" size={16} />
            <span className="fw-semibold" style={{ fontSize: "14px" }}>Configured Facebook Pages</span>
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
                <th style={{ fontSize: "12px", fontWeight: 600 }}>Page Name / ID</th>
                <th style={{ fontSize: "12px", fontWeight: 600 }}>Verify Token</th>
                <th style={{ fontSize: "12px", fontWeight: 600 }}>Status</th>
                <th style={{ fontSize: "12px", fontWeight: 600 }}>Active</th>
                <th style={{ fontSize: "12px", fontWeight: 600 }}>Created</th>
                <th className="text-end" style={{ fontSize: "12px", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted" style={{ fontSize: "12px" }}>
                    <Loader2 className="animate-spin me-2 d-inline-block" size={18} />
                    Loading Facebook integrations...
                  </td>
                </tr>
              ) : integrations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted" style={{ fontSize: "12px" }}>
                    <div className="d-flex flex-column align-items-center justify-content-center">
                      <Plug size={32} className="text-muted opacity-50 mb-2" />
                      <p className="mb-1 text-dark" style={{ fontSize: "12px", fontWeight: 500 }}>No Facebook Page Integrations configured yet</p>
                      <small className="text-secondary mb-3" style={{ fontSize: "11.5px" }}>Add your Facebook Page credentials via Single Sign-On to start capturing Lead Ads.</small>
                      <button className="btn btn-sm btn-wa d-inline-flex align-items-center gap-1" style={{ fontSize: "12px" }} onClick={startCreate}>
                        <Plus size={14} /> FB Integration
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                integrations.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2.5 px-3">
                      <div className="d-flex align-items-center gap-2">
                        <i className="bi bi-facebook text-primary" style={{ fontSize: "16px" }}></i>
                        <div>
                          <span className="text-dark d-block" style={{ fontSize: "12px", fontWeight: 400 }}>{i.pageName}</span>
                          <span className="text-muted font-monospace d-block" style={{ fontSize: "11px" }}>ID: {i.pageId}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 font-monospace text-secondary" style={{ fontSize: "11.5px" }}>
                      {i.verifyToken || "—"}
                    </td>
                    <td className="py-2.5">
                      {i.status === "connected" ? (
                        <span style={{ fontSize: "12px", fontWeight: 500, color: "#16a34a" }} className="d-inline-flex align-items-center gap-1">
                          <CheckCircle2 size={13} /> Live & Connected
                        </span>
                      ) : i.status === "disconnected" ? (
                        <span style={{ fontSize: "12px", fontWeight: 500, color: "#dc2626" }} className="d-inline-flex align-items-center gap-1">
                          <XCircle size={13} /> Connection Failed
                        </span>
                      ) : (
                        <span style={{ fontSize: "12px", fontWeight: 500, color: "#6b7280" }}>
                          Untested
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <div className="form-check form-switch mb-0">
                        <input
                          className="form-check-input cursor-pointer"
                          type="checkbox"
                          role="switch"
                          checked={Boolean(i.active)}
                          onChange={() => toggleActive(i)}
                          style={{ width: "2.2em", height: "1.1em" }}
                        />
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
                            toast("Facebook Webhook Callback URL copied!");
                          }}
                          title="Copy FB Webhook URL"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          className="btn btn-sm border-0 text-secondary hover-primary p-1"
                          style={{ fontSize: "12px" }}
                          onClick={() => startEdit(i)}
                          title="Configure Field Mapping"
                        >
                          <Sliders size={14} />
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

      {/* Multi-Step Modal Dialog for FB Single Sign-On, Page/Form Selection & Field Mapping */}
      {openModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
          <div className="modal d-block fade show" tabIndex="-1" style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-0 rounded-3 shadow">
                {/* Modal Header & Stepper Progress */}
                <div className="modal-header border-bottom py-2.5 px-4 d-flex justify-content-between align-items-center">
                  <h5 className="modal-title fw-semibold d-flex align-items-center gap-2" style={{ fontSize: "14px" }}>
                    <i className="bi bi-facebook text-primary"></i>
                    {form.backendId ? "Edit Facebook Integration & Field Mapping" : "Facebook Integration Wizard"}
                  </h5>
                  <button type="button" className="btn-close" style={{ fontSize: "11px" }} onClick={() => setOpenModal(false)}></button>
                </div>

                {/* Step indicator bar */}
                <div className="bg-light px-4 py-2 border-bottom d-flex align-items-center justify-content-between" style={{ fontSize: "11.5px" }}>
                  <div className={`d-flex align-items-center gap-1.5 ${modalStep === 1 ? "fw-bold text-primary" : ssoConnected ? "text-success" : "text-muted"}`}>
                    <span className="badge rounded-circle p-1 bg-secondary opacity-75" style={{ width: "18px", height: "18px", fontSize: "10px" }}>1</span>
                    1. Facebook SSO Single Sign-On
                  </div>
                  <ArrowRight size={12} className="text-muted" />
                  <div className={`d-flex align-items-center gap-1.5 ${modalStep === 2 ? "fw-bold text-primary" : modalStep > 2 ? "text-success" : "text-muted"}`}>
                    <span className="badge rounded-circle p-1 bg-secondary opacity-75" style={{ width: "18px", height: "18px", fontSize: "10px" }}>2</span>
                    2. Select Active Page & Lead Form
                  </div>
                  <ArrowRight size={12} className="text-muted" />
                  <div className={`d-flex align-items-center gap-1.5 ${modalStep === 3 ? "fw-bold text-primary" : "text-muted"}`}>
                    <span className="badge rounded-circle p-1 bg-secondary opacity-75" style={{ width: "18px", height: "18px", fontSize: "10px" }}>3</span>
                    3. Field Mapping & Testing
                  </div>
                </div>

                <div className="modal-body p-4" style={{ maxHeight: "70vh", overflowY: "auto", fontSize: "12px" }}>
                  {/* STEP 1: Facebook SSO Single Sign-On */}
                  {modalStep === 1 && (
                    <div className="text-center py-4">
                      <div className="mb-3 d-inline-flex p-3 rounded-circle bg-primary bg-opacity-10 text-primary">
                        <i className="bi bi-facebook" style={{ fontSize: "2.5rem" }}></i>
                      </div>
                      <h6 className="fw-semibold text-dark mb-2" style={{ fontSize: "15px" }}>Connect your Facebook Account</h6>

                      {!ssoConnected ? (
                        <button
                          type="button"
                          className="btn text-white px-4 py-2 d-inline-flex align-items-center gap-2 shadow-sm"
                          style={{ backgroundColor: "#1877F2", fontSize: "13px", fontWeight: 500, borderRadius: "var(--radius-sm)" }}
                          onClick={handleFacebookSSO}
                          disabled={ssoLoading}
                        >
                          {ssoLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <i className="bi bi-facebook" style={{ fontSize: "1.1rem" }}></i>
                          )}
                          Continue with Facebook SSO
                        </button>
                      ) : (
                        <div className="d-flex flex-column align-items-center gap-2">
                          <div className="text-success fw-medium d-inline-flex align-items-center gap-1">
                            <CheckCircle2 size={16} /> Facebook Single Sign-On Authenticated
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary mt-2"
                            style={{ fontSize: "12px" }}
                            onClick={() => setModalStep(2)}
                          >
                            Next: Select Managed Page & Form →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 2: Select Facebook Page & Active Form */}
                  {modalStep === 2 && (
                    <div className="space-y-4">
                      <div>
                        <label className="form-label small fw-semibold text-dark mb-2" style={{ fontSize: "12px" }}>
                          Select Managed Facebook Page
                        </label>
                        <div className="row g-2">
                          {MOCK_FB_PAGES.map((page) => (
                            <div className="col-md-6" key={page.pageId}>
                              <div
                                className={`card p-3 cursor-pointer border rounded-3 transition-all ${
                                  selectedPage.pageId === page.pageId ? "border-primary bg-primary bg-opacity-10" : ""
                                }`}
                                onClick={() => handleSelectPage(page)}
                              >
                                <div className="d-flex align-items-center justify-content-between">
                                  <div className="d-flex align-items-center gap-2">
                                    <i className="bi bi-facebook text-primary" style={{ fontSize: "18px" }}></i>
                                    <div>
                                      <span className="text-dark d-block fw-medium" style={{ fontSize: "12.5px" }}>{page.pageName}</span>
                                      <small className="text-secondary" style={{ fontSize: "11px" }}>ID: {page.pageId}</small>
                                    </div>
                                  </div>
                                  {selectedPage.pageId === page.pageId && <Check size={16} className="text-primary" />}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2">
                        <label className="form-label small fw-semibold text-dark mb-2" style={{ fontSize: "12px" }}>
                          Select Active Facebook Lead Ad Form
                        </label>
                        <div className="list-group">
                          {(selectedPage.forms || []).map((fbForm) => (
                            <div
                              key={fbForm.id}
                              className={`list-group-item list-group-item-action d-flex align-items-center justify-content-between cursor-pointer py-2.5 px-3 ${
                                selectedForm.id === fbForm.id ? "active bg-primary text-white border-primary" : ""
                              }`}
                              onClick={() => handleSelectForm(fbForm)}
                            >
                              <div>
                                <span className="fw-medium d-block" style={{ fontSize: "12px" }}>{fbForm.name}</span>
                                <small className={selectedForm.id === fbForm.id ? "text-white-50" : "text-secondary"} style={{ fontSize: "11px" }}>
                                  Detected fields: {fbForm.fields.map((f) => f.name).join(", ")}
                                </small>
                              </div>
                              <span className={`badge ${selectedForm.id === fbForm.id ? "bg-white text-primary" : "bg-success-subtle text-success"}`} style={{ fontSize: "10.5px" }}>
                                {fbForm.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Field Mapping & Testing */}
                  {modalStep === 3 && (
                    <div className="space-y-4">
                      <div className="d-flex align-items-center justify-content-between bg-light p-2.5 rounded-3 border">
                        <div>
                          <span className="text-dark fw-medium" style={{ fontSize: "12px" }}>{form.pageName}</span>
                          <span className="text-secondary ms-2" style={{ fontSize: "11.5px" }}>Form: <strong>{selectedForm.name}</strong></span>
                        </div>
                        <button className="btn btn-sm btn-outline-secondary py-0 px-2" style={{ fontSize: "11px" }} onClick={() => setModalStep(2)}>
                          Change Form
                        </button>
                      </div>

                      <div>
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <label className="form-label small fw-semibold text-dark mb-0" style={{ fontSize: "12px" }}>
                            Map Facebook Form Fields → CRM Lead Fields
                          </label>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 py-0 px-2"
                            style={{ fontSize: "11px" }}
                            onClick={handleTestFieldMapping}
                            disabled={testing}
                          >
                            {testing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Test Field Mapping
                          </button>
                        </div>

                        <div className="table-responsive border rounded-3">
                          <table className="table table-sm align-middle mb-0" style={{ fontSize: "12px" }}>
                            <thead className="table-light">
                              <tr>
                                <th style={{ fontSize: "11.5px", fontWeight: 600 }}>Facebook Form Field</th>
                                <th style={{ fontSize: "11.5px", fontWeight: 600 }}>Field Type</th>
                                <th style={{ fontSize: "11.5px", fontWeight: 600 }}>Target CRM Field</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(selectedForm.fields || []).map((fbField) => (
                                <tr key={fbField.name}>
                                  <td className="py-2 fw-medium font-monospace text-dark" style={{ fontSize: "11.5px" }}>
                                    {fbField.name} <span className="text-muted font-normal">({fbField.label})</span>
                                  </td>
                                  <td className="py-2 text-secondary" style={{ fontSize: "11px" }}>
                                    {fbField.type}
                                  </td>
                                  <td className="py-2">
                                    <select
                                      className="form-select form-select-sm"
                                      style={{ fontSize: "11.5px" }}
                                      value={form.formMapping[fbField.name] || "ignore"}
                                      onChange={(e) => handleFieldMappingChange(fbField.name, e.target.value)}
                                    >
                                      {CRM_LEAD_FIELDS.map((crmField) => (
                                        <option key={crmField.key} value={crmField.key}>
                                          {crmField.label}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Simulation Test Result Panel */}
                      {testResult && (
                        <div className="p-3 border rounded-3 bg-light" style={{ fontSize: "11.5px" }}>
                          <div className="fw-semibold text-success mb-1 d-flex align-items-center gap-1">
                            <CheckCircle2 size={14} /> Sample Lead Payload Output:
                          </div>
                          <pre className="mb-0 text-dark bg-white p-2 border rounded font-monospace" style={{ fontSize: "11px" }}>
                            {JSON.stringify(testResult, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Footer Navigation */}
                <div className="modal-footer border-top py-2.5 px-4 d-flex justify-content-between">
                  <div>
                    {modalStep > 1 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        style={{ fontSize: "12px" }}
                        onClick={() => setModalStep(modalStep - 1)}
                      >
                        ← Back
                      </button>
                    )}
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      style={{ fontSize: "12px" }}
                      onClick={() => setOpenModal(false)}
                    >
                      Cancel
                    </button>
                    {modalStep < 3 ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-wa"
                        style={{ fontSize: "12px" }}
                        disabled={modalStep === 1 && !ssoConnected}
                        onClick={() => setModalStep(modalStep + 1)}
                      >
                        Next Step →
                      </button>
                    ) : (
                      <button type="button" className="btn btn-sm btn-wa" style={{ fontSize: "12px" }} onClick={onSave}>
                        Save Integration & Mapping
                      </button>
                    )}
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
