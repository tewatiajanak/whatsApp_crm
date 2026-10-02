

import { useState } from "react";
import { messagesApi, templatesApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, ErrorBox, DataTable, Modal, Tabs } from "../components/ui";
import WhatsAppTemplateBuilder from "../components/WhatsAppTemplateBuilder";

const TONE = {
  Approved: { background: "var(--ok-bg)", color: "var(--ok)" },
  Pending: { background: "var(--warn-bg)", color: "var(--warn)" },
  Rejected: { background: "var(--err-bg)", color: "var(--err)" },
  Draft: { background: "var(--pill-bg)", color: "var(--pill-ink)" },
};

export default function Templates() {
  const { can } = useAuth();
  const list = useApi(() => templatesApi.list({ perPage: 100 }), []);
  const [creatingMeta, setCreatingMeta] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [channel, setChannel] = useState("whatsapp");
  const [syncing, setSyncing] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [loadingSyncCandidates, setLoadingSyncCandidates] = useState(false);
  const [syncCandidates, setSyncCandidates] = useState([]);
  const [selectedSyncNames, setSelectedSyncNames] = useState([]);
  const [syncingSelected, setSyncingSelected] = useState(false);
  const [submittingId, setSubmittingId] = useState(null);
  const [testTemplate, setTestTemplate] = useState(null);
  const [testPhone, setTestPhone] = useState("");
  const [testParamValues, setTestParamValues] = useState({});
  const [testHeaderMediaValue, setTestHeaderMediaValue] = useState("");
  const [testHeaderLocalPreviewUrl, setTestHeaderLocalPreviewUrl] = useState("");
  const [uploadingTestHeaderMedia, setUploadingTestHeaderMedia] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const toast = useToast();

  const rows = (list.data || []).filter((t) => channel === "all" || (t.channel || "whatsapp") === channel);

  async function openSyncModal() {
    setLoadingSyncCandidates(true);
    try {
      const res = await templatesApi.metaSyncCandidates();
      const candidates = Array.isArray(res?.templates) ? res.templates : [];
      setSyncCandidates(candidates);
      setSelectedSyncNames(candidates.map((tpl) => tpl.name));
      setSyncModalOpen(true);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoadingSyncCandidates(false);
    }
  }

  function toggleSelectedSyncName(name) {
    setSelectedSyncNames((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  }

  function selectAllSyncCandidates() {
    setSelectedSyncNames(syncCandidates.map((tpl) => tpl.name));
  }

  function clearSyncSelection() {
    setSelectedSyncNames([]);
  }

  async function handleSyncSelectedMeta() {
    if (!selectedSyncNames.length) {
      toast("Select at least one approved Meta template to sync", "error");
      return;
    }

    setSyncingSelected(true);
    try {
      const res = await templatesApi.syncMeta(selectedSyncNames);
      toast(`Synced ${res.count} templates from Meta Graph API ✓`);
      setSyncModalOpen(false);
      list.reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSyncingSelected(false);
    }
  }

  async function handleDeleteLocal(templateId, templateName) {
    if (!confirm(`Delete template '${templateName}' from CRM? (Meta template will remain unchanged)`)) return;
    try {
      await templatesApi.remove(templateId);
      toast("Template deleted from CRM");
      list.reload();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  function openTestModal(tpl) {
    setTestTemplate(tpl);
    setTestPhone("");
    const header = (tpl?.components || []).find((c) => c?.type === "HEADER");
    const sampleHeaderHandle = header?.example?.header_handle?.[0] || tpl?.headerMediaUrl || "";
    setTestHeaderMediaValue(isHttpUrl(sampleHeaderHandle) ? sampleHeaderHandle : "");
    setTestHeaderLocalPreviewUrl(isHttpUrl(sampleHeaderHandle) ? sampleHeaderHandle : "");
    const vars = extractVariableIndexes(getTemplateBodyText(tpl));
    const next = {};
    vars.forEach((n) => {
      next[n] = `sample-${n}`;
    });
    setTestParamValues(next);
  }

  function updateTestParam(variableIndex, value) {
    setTestParamValues((prev) => ({ ...prev, [variableIndex]: value }));
  }

  async function handleUploadTestHeaderMedia(file) {
    if (!file) return;
    setUploadingTestHeaderMedia(true);
    try {
      setTestHeaderLocalPreviewUrl(URL.createObjectURL(file));
      const res = await templatesApi.uploadTestMedia(file);
      const mediaId = res?.data?.id || res?.id;
      if (!mediaId) throw new Error("Meta media ID not returned");
      setTestHeaderMediaValue(mediaId);
      toast("Media uploaded to Meta. Media ID selected for test send.");
    } catch (e) {
      toast(e.message || "Failed to upload test media", "error");
    } finally {
      setUploadingTestHeaderMedia(false);
    }
  }

  function getResolvedTemplatePreview(template, samples = {}) {
    const components = template?.components || [];
    const header = components.find((c) => c.type === "HEADER");
    const body = components.find((c) => c.type === "BODY");
    const footer = components.find((c) => c.type === "FOOTER");
    const buttonBlock = components.find((c) => c.type === "BUTTONS");
    const buttons = buttonBlock?.buttons || [];
    const headerMediaUrl = header?.example?.header_handle?.[0] || "";

    return {
      headerType: header?.format || "NONE",
      headerText: header?.text || "",
      headerMediaUrl,
      bodyText: renderPreviewBody(body?.text || template?.body || "", samples),
      footerText: footer?.text || "",
      buttons,
    };
  }

  async function handleSendTemplateTest() {
    if (!testTemplate?.name) {
      toast("Template not selected", "error");
      return;
    }
    if (!testPhone.trim()) {
      toast("Enter target phone number", "error");
      return;
    }

    setSendingTest(true);
    try {
      const variables = extractVariableIndexes(getTemplateBodyText(testTemplate));
      const params = variables.map((n) => String(testParamValues[n] || "").trim());
      const templateComponents = buildTemplateSendComponents(testTemplate, params, testHeaderMediaValue);

      await messagesApi.send({
        channel: "whatsapp",
        to: testPhone.trim(),
        template: testTemplate.name,
        params,
        languageCode: testTemplate.language || "en",
        templateComponents,
      });
      toast(`Test sent using '${testTemplate.name}'`);
      setTestTemplate(null);
    } catch (e) {
      const message = String(e?.message || "");
      if (message.includes("131030") || message.toLowerCase().includes("not in allowed list")) {
        toast("Test failed: recipient number not in Meta allowed list. Add this number in Meta App Dashboard > WhatsApp > API Setup > Recipient numbers, then retry.", "error");
      } else if (message.includes("template.components.parameters.image.link is not a URL") || message.includes("132012")) {
        toast("Meta needs a valid public media URL (or valid media ID) for this header. Please enter Header Media URL in test modal and retry.", "error");
      } else {
        toast(message || "Failed to send test", "error");
      }
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSubmitForApproval(tpl) {
    if (!tpl?.name || !tpl?.body) {
      toast("Template name and body are required before submit", "error");
      return;
    }
    setSubmittingId(tpl._id);
    try {
      await templatesApi.createMeta({
        name: tpl.name,
        category: (tpl.category || "Utility").toUpperCase(),
        language: tpl.language || "en",
        body: tpl.body,
      });
      toast(`Template '${tpl.name}' sent for approval`);
      list.reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSubmittingId(null);
    }
  }

  const columns = [
    { key: "name", label: "Name", render: (t) => <span className="row-name font-monospace">{t.name}</span> },
    { key: "channel", label: "Channel", render: (t) => (
      <span className="pill" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
        <i className={`bi bi-${(t.channel || "whatsapp") === "email" ? "envelope" : "whatsapp"} me-1`}></i>{t.channel || "whatsapp"}
      </span>
    ) },
    { key: "category", label: "Category", render: (t) => <span className="pill">{t.category}</span> },
    {
      key: "status",
      label: "Meta Status",
      render: (t) => {
        const reason = t.status === "Rejected" ? (t.rejectionReason || "Meta did not return a rejection reason") : "";
        return (
          <span className="pill" style={TONE[t.status] || TONE.Draft} title={reason}>
            {t.status}
          </span>
        );
      },
    },
    { key: "actions", label: "Actions", render: (t) => (
      <div className="d-inline-flex align-items-center gap-2">
        {t.channel === "whatsapp" && (
          <button
            className="btn btn-sm icon-only-action text-info"
            title="Test Template"
            onClick={() => openTestModal(t)}
          >
            <i className="bi bi-send-check"></i>
          </button>
        )}
        {t.channel === "whatsapp" && (
          <button
            className="btn btn-sm icon-only-action text-primary"
            title="Edit"
            onClick={() => setEditingTemplate(t)}
          >
            <i className="bi bi-pencil"></i>
          </button>
        )}
        {t.channel === "whatsapp" && t.status === "Draft" && (
          <button
            className="btn btn-sm icon-only-action text-success"
            title="Submit for Approval"
            disabled={submittingId === t._id}
            onClick={() => handleSubmitForApproval(t)}
          >
            {submittingId === t._id ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-cloud-upload"></i>}
          </button>
        )}
        {t.channel === "whatsapp" && (
          <button className="btn btn-sm icon-only-action text-danger" title="Delete from CRM" onClick={() => handleDeleteLocal(t._id, t.name)}>
            <i className="bi bi-trash"></i>
          </button>
        )}
      </div>
    ) },
  ];

  return (
    <div>
      <PageHeader
        title="Meta WhatsApp & Email Templates"
      />
      {creatingMeta || editingTemplate ? (
        <div className="mt-4">
          <WhatsAppTemplateBuilder
            initialTemplate={editingTemplate || undefined}
            onCancel={() => {
              setCreatingMeta(false);
              setEditingTemplate(null);
            }}
            onSaved={() => {
              setCreatingMeta(false);
              setEditingTemplate(null);
              list.reload();
            }}
          />
        </div>
      ) : (
        <>
          <div className="mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
            <Tabs tabs={[{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Email" }]} value={channel} onChange={setChannel} />
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" disabled={loadingSyncCandidates} onClick={openSyncModal}>
                {loadingSyncCandidates ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-arrow-repeat me-1"></i>}
                Sync from Meta
              </button>
              {can("blast", "create") && (
                <button className="btn btn-wa btn-sm" onClick={() => setCreatingMeta(true)}>
                  <i className="bi bi-meta me-1"></i>New Meta Template
                </button>
              )}
            </div>
          </div>
          <div className="text-muted small mb-2">
            Use "Sync from Meta" only to import templates created directly on Meta.
          </div>
          <ErrorBox error={list.error} />
          <DataTable columns={columns} rows={rows} loading={list.loading} empty={{ icon: "file-text", text: "No templates found." }} />

          {syncModalOpen && (
            <Modal
              title="Select Meta Templates to Sync"
              onClose={() => setSyncModalOpen(false)}
              footer={
                <>
                  <button className="btn btn-outline-secondary" onClick={() => setSyncModalOpen(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-outline-secondary" onClick={clearSyncSelection}>
                    Clear Selection
                  </button>
                  <button className="btn btn-outline-secondary" onClick={selectAllSyncCandidates}>
                    Select All
                  </button>
                  <button className="btn btn-wa" disabled={syncingSelected || !selectedSyncNames.length} onClick={handleSyncSelectedMeta}>
                    {syncingSelected ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-download me-1"></i>}
                    Sync Selected
                  </button>
                </>
              }
            >
              {syncCandidates.length === 0 ? (
                <div className="text-center py-4 text-muted">
                  No approved Meta templates available to sync. Already-synced templates are hidden.
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  <div className="text-muted small mb-2">
                    Only approved Meta templates are shown. Templates already synced into CRM are hidden.
                  </div>
                  {syncCandidates.map((tpl) => (
                    <label
                      key={tpl.name}
                      className="d-flex align-items-start gap-3 border rounded p-3 cursor-pointer"
                      style={{ background: selectedSyncNames.includes(tpl.name) ? "#f8fafc" : "#fff" }}
                    >
                      <input
                        type="checkbox"
                        className="form-check-input mt-1"
                        checked={selectedSyncNames.includes(tpl.name)}
                        onChange={() => toggleSelectedSyncName(tpl.name)}
                      />
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <div className="fw-semibold">{tpl.name}</div>
                          <span className="pill" style={TONE.Approved}>Approved</span>
                        </div>
                        <div className="small text-muted mt-1">
                          {tpl.category} • {tpl.language || "en"}
                        </div>
                        <div className="small text-secondary mt-2 text-truncate" title={tpl.body || ""}>
                          {tpl.body || "No body text"}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </Modal>
          )}

          {testTemplate && (
            <Modal
              title={`Test Template: ${testTemplate.name}`}
              onClose={() => setTestTemplate(null)}
              footer={
                <>
                  <button className="btn btn-outline-secondary" onClick={() => setTestTemplate(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-wa" disabled={sendingTest} onClick={handleSendTemplateTest}>
                    {sendingTest ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-send-check me-1"></i>}
                    Send Test
                  </button>
                </>
              }
            >
              <div className="row g-2 align-items-start">
                <div className="col-lg-5 pe-lg-2">
                  <div
                    className="d-flex flex-column gap-3 p-3 rounded-4 border"
                    style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}
                  >
                    <div>
                      <label className="form-label small fw-semibold text-uppercase" style={{ letterSpacing: "0.04em" }}>Target Phone Number</label>
                      <input
                        className="form-control"
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        placeholder="+91XXXXXXXXXX"
                      />
                    </div>
                    {(() => {
                      const header = (testTemplate?.components || []).find((c) => c?.type === "HEADER");
                      const format = String(header?.format || "").toUpperCase();
                      if (!["IMAGE", "VIDEO", "DOCUMENT"].includes(format)) return null;
                      return (
                        <div>
                          <label className="form-label small fw-semibold text-uppercase" style={{ letterSpacing: "0.04em" }}>
                            Header Media URL / Media ID
                          </label>
                          <input
                            className="form-control"
                            value={testHeaderMediaValue}
                            onChange={(e) => {
                              const value = e.target.value;
                              setTestHeaderMediaValue(value);
                              setTestHeaderLocalPreviewUrl(isHttpUrl(value) ? value : "");
                            }}
                            placeholder={format === "DOCUMENT" ? "https://...pdf or media id" : "https://... or media id"}
                          />
                          <div className="mt-2">
                            <label className="form-label small text-muted mb-1">Or upload test file to Meta</label>
                            <input
                              type="file"
                              className="form-control"
                              accept={format === "IMAGE" ? "image/*" : format === "VIDEO" ? "video/*" : "application/pdf"}
                              onChange={(e) => handleUploadTestHeaderMedia(e.target.files?.[0])}
                              disabled={uploadingTestHeaderMedia}
                            />
                            {uploadingTestHeaderMedia && (
                              <div className="small text-muted mt-1">
                                <span className="spinner-border spinner-border-sm me-1" />Uploading to Meta...
                              </div>
                            )}
                          </div>
                          <div className="small text-muted mt-1">
                            Meta test send needs a public URL or a valid Meta media ID for {format.toLowerCase()} header.
                          </div>
                        </div>
                      );
                    })()}
                    {extractVariableIndexes(getTemplateBodyText(testTemplate)).length > 0 ? (
                      <div>
                        <label className="form-label small fw-semibold text-uppercase mb-2" style={{ letterSpacing: "0.04em" }}>Template Variables</label>
                        <div className="d-flex flex-column gap-2">
                          {extractVariableIndexes(getTemplateBodyText(testTemplate)).map((n) => (
                            <div key={n}>
                              <label className="form-label small text-muted mb-1 fw-semibold">{`{{${n}}}`}</label>
                              <input
                                className="form-control"
                                value={testParamValues[n] || ""}
                                onChange={(e) => updateTestParam(n, e.target.value)}
                                placeholder={`Value for {{${n}}}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-muted small">This template has no variables. Test will be sent as-is.</div>
                    )}
                  </div>
                </div>

                <div className="col-lg-7 ps-lg-3">
                  {(() => {
                    const preview = getResolvedTemplatePreview(testTemplate, testParamValues);
                    const previewImageSrc =
                      testHeaderLocalPreviewUrl ||
                      (isHttpUrl(testHeaderMediaValue) ? testHeaderMediaValue : "") ||
                      (isHttpUrl(preview.headerMediaUrl) ? preview.headerMediaUrl : "");
                    return (
                      <div
                        className="border rounded-4 overflow-hidden"
                        style={{
                          fontSize: "13px",
                          background: "linear-gradient(180deg, #f9fcff 0%, #ffffff 24%)",
                          borderColor: "#d9e3ef",
                          boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)",
                        }}
                      >
                        {preview.headerType && preview.headerType !== "NONE" && !preview.headerText && (
                          <div
                            className="px-3 py-2 border-bottom d-flex align-items-center gap-2 text-muted"
                            style={{ background: "#f8fafc" }}
                          >
                            {preview.headerType === "IMAGE" && <i className="bi bi-image"></i>}
                            {preview.headerType === "VIDEO" && <i className="bi bi-play-circle"></i>}
                            {preview.headerType === "DOCUMENT" && <i className="bi bi-file-earmark-pdf"></i>}
                            <span className="fw-semibold text-dark">{preview.headerType} Header</span>
                          </div>
                        )}
                        {preview.headerType === "IMAGE" && previewImageSrc && (
                          <img
                            src={previewImageSrc}
                            alt="Template header preview"
                            className="w-100 border-bottom"
                            style={{ maxHeight: 170, objectFit: "cover" }}
                          />
                        )}
                        {preview.headerType === "VIDEO" && preview.headerMediaUrl && (
                          <div className="px-3 py-2 border-bottom bg-light d-flex align-items-center gap-2 text-dark">
                            <i className="bi bi-play-circle"></i>
                            <span className="small text-truncate">Video attached</span>
                          </div>
                        )}
                        {preview.headerType === "DOCUMENT" && preview.headerMediaUrl && (
                          <div className="px-3 py-2 border-bottom bg-light d-flex align-items-center gap-2 text-dark">
                            <i className="bi bi-file-earmark-pdf"></i>
                            <span className="small text-truncate">Document attached</span>
                          </div>
                        )}
                        {preview.headerType === "IMAGE" && !preview.headerText && !previewImageSrc && (
                          <div className="px-3 py-2 border-bottom bg-info-subtle text-info-emphasis small">
                            Image selected as Meta media ID. Upload a file here to see local preview.
                          </div>
                        )}
                        {preview.headerType !== "NONE" && !preview.headerText && !preview.headerMediaUrl && !previewImageSrc && (
                          <div className="px-3 py-2 border-bottom bg-warning-subtle text-warning-emphasis small">
                            No file attached in this template header.
                          </div>
                        )}
                        {preview.headerText && (
                          <div className="px-3 pt-3 pb-1 fw-semibold text-dark" style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>
                            {preview.headerText}
                          </div>
                        )}
                        <div className="px-3 py-2 text-dark" style={{ whiteSpace: "pre-wrap", lineHeight: 1.58, minHeight: 100 }}>
                          {preview.bodyText}
                        </div>
                        {preview.footerText && (
                          <div className="px-3 pb-2 text-muted" style={{ whiteSpace: "pre-wrap", fontSize: "11px" }}>
                            {preview.footerText}
                          </div>
                        )}
                        {preview.buttons.length > 0 && (
                          <div className="border-top bg-light">
                            {preview.buttons.map((btn, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 text-center fw-semibold d-flex align-items-center justify-content-center gap-2"
                                style={{
                                  borderBottom: index < preview.buttons.length - 1 ? "1px solid #e5e7eb" : "none",
                                  color: "#0a76c5",
                                  fontSize: "13px",
                                  background: "#fbfdff",
                                }}
                              >
                                {btn.type === "URL" && <i className="bi bi-box-arrow-up-right"></i>}
                                {btn.type === "PHONE_NUMBER" && <i className="bi bi-telephone"></i>}
                                {btn.type === "QUICK_REPLY" && <i className="bi bi-reply"></i>}
                                {btn.text || "Button"}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}

function extractVariableIndexes(text) {
  const matches = String(text || "").match(/\{\{(\d+)\}\}/g) || [];
  return [...new Set(matches.map((m) => Number(m.replace(/[^\d]/g, ""))))].sort((a, b) => a - b);
}

function getTemplateBodyText(template) {
  const bodyFromComponent = template?.components?.find((c) => c?.type === "BODY")?.text;
  return bodyFromComponent || template?.body || "";
}

function buildTemplateSendComponents(template, params = [], mediaValue = "") {
  const components = [];
  const sourceComponents = Array.isArray(template?.components) ? template.components : [];
  const header = sourceComponents.find((c) => c?.type === "HEADER");
  const headerFormat = String(header?.format || "").toUpperCase();
  const headerHandle = header?.example?.header_handle?.[0];
  const resolvedMediaValue = String(mediaValue || headerHandle || "").trim();

  if (headerFormat === "IMAGE") {
    if (!resolvedMediaValue) throw new Error("Header image is required for this template test.");
    components.push({
      type: "header",
      parameters: [{ type: "image", image: buildMediaParam(resolvedMediaValue) }],
    });
  } else if (headerFormat === "VIDEO") {
    if (!resolvedMediaValue) throw new Error("Header video is required for this template test.");
    components.push({
      type: "header",
      parameters: [{ type: "video", video: buildMediaParam(resolvedMediaValue) }],
    });
  } else if (headerFormat === "DOCUMENT") {
    if (!resolvedMediaValue) throw new Error("Header document is required for this template test.");
    components.push({
      type: "header",
      parameters: [{ type: "document", document: buildMediaParam(resolvedMediaValue) }],
    });
  }

  if (Array.isArray(params) && params.length > 0) {
    components.push({
      type: "body",
      parameters: params.map((p) => ({ type: "text", text: p })),
    });
  }

  return components;
}

function isHttpUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function buildMediaParam(value) {
  const v = String(value || "").trim();
  if (isHttpUrl(v)) return { link: v };
  return { id: v };
}

function renderPreviewBody(text, samples = {}) {
  if (!text) return "";
  return text.replace(/\{\{(\d+)\}\}/g, (_, num) => {
    const value = samples[num];
    return value !== undefined && value !== "" ? value : `{{${num}}}`;
  });
}

function CreateMetaTemplateModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    category: "UTILITY",
    language: "en",
    headerType: "NONE",
    headerText: "",
    headerMediaUrl: "",
    body: "",
    footer: "",
    buttons: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function addButton(type) {
    if (form.buttons.length >= 3 && type === "QUICK_REPLY") {
      toast("Max 3 quick reply buttons allowed", "error");
      return;
    }
    const newBtn =
      type === "QUICK_REPLY"
        ? { type: "QUICK_REPLY", text: "Reply Option" }
        : type === "URL"
        ? { type: "URL", text: "Visit Website", url: "https://greenwood.edu" }
        : type === "PHONE_NUMBER"
        ? { type: "PHONE_NUMBER", text: "Call Us", phoneNumber: "+919999900001" }
        : { type: "COPY_CODE", text: "Copy Code", code: "PROMO50" };

    setForm((f) => ({ ...f, buttons: [...f.buttons, newBtn] }));
  }

  function removeButton(index) {
    setForm((f) => ({ ...f, buttons: f.buttons.filter((_, i) => i !== index) }));
  }

  async function handleSubmitMeta() {
    if (!form.name || !form.body) {
      toast("Template name and body content are required", "error");
      return;
    }
    setSubmitting(true);
    try {
      await templatesApi.createMeta(form);
      toast("Meta Template submitted successfully to Graph API ✓");
      onSaved();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Create Meta WhatsApp Template"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-wa" disabled={submitting || !form.name || !form.body} onClick={handleSubmitMeta}>
            {submitting && <span className="spinner-border spinner-border-sm me-1" />}
            Submit to Meta Graph API
          </button>
        </>
      }
    >
      <div className="row g-3">
        <div className="col-6">
          <label className="form-label fw-semibold">Template Name (a-z, 0-9, _)</label>
          <input
            className="form-control"
            value={form.name}
            onChange={(e) => set("name", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
            placeholder="fee_due_reminder_v1"
          />
        </div>
        <div className="col-3">
          <label className="form-label fw-semibold">Category</label>
          <select className="form-select" value={form.category} onChange={(e) => set("category", e.target.value)}>
            <option value="UTILITY">Utility</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>
        </div>
        <div className="col-3">
          <label className="form-label fw-semibold">Language</label>
          <select className="form-select" value={form.language} onChange={(e) => set("language", e.target.value)}>
            <option value="en">English (en)</option>
            <option value="hi">Hindi (hi)</option>
            <option value="es">Spanish (es)</option>
            <option value="fr">French (fr)</option>
          </select>
        </div>

        {/* Header Section */}
        <div className="col-12 border-top pt-3">
          <label className="form-label fw-semibold">Header (Optional)</label>
          <div className="row g-2">
            <div className="col-4">
              <select className="form-select" value={form.headerType} onChange={(e) => set("headerType", e.target.value)}>
                <option value="NONE">None</option>
                <option value="TEXT">Text Header</option>
                <option value="IMAGE">Image Media</option>
                <option value="VIDEO">Video Media</option>
                <option value="DOCUMENT">Document PDF</option>
              </select>
            </div>
            {form.headerType === "TEXT" && (
              <div className="col-8">
                <input className="form-control" placeholder="Header text..." value={form.headerText} onChange={(e) => set("headerText", e.target.value)} />
              </div>
            )}
            {["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerType) && (
              <div className="col-8">
                <input className="form-control" placeholder="Sample media URL..." value={form.headerMediaUrl} onChange={(e) => set("headerMediaUrl", e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* Body Section */}
        <div className="col-12">
          <label className="form-label fw-semibold">Body Content (Meta Required)</label>
          <textarea
            className="form-control"
            rows={4}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            placeholder="Hi {{1}}, your fee of ₹{{2}} is due on {{3}}."
          />
          <div className="form-text small">Use {"{{1}}"}, {"{{2}}"} for dynamic variables.</div>
        </div>

        {/* Footer Section */}
        <div className="col-12">
          <label className="form-label fw-semibold">Footer Text (Optional)</label>
          <input className="form-control" value={form.footer} onChange={(e) => set("footer", e.target.value)} placeholder="e.g. Greenwood Admissions" />
        </div>

        {/* Buttons Section */}
        <div className="col-12 border-top pt-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <label className="form-label fw-semibold mb-0">Interactive Buttons (Optional)</label>
            <div className="btn-group btn-group-sm">
              <button className="btn btn-outline-secondary" onClick={() => addButton("QUICK_REPLY")}>+ Quick Reply</button>
              <button className="btn btn-outline-secondary" onClick={() => addButton("URL")}>+ Call to Action URL</button>
              <button className="btn btn-outline-secondary" onClick={() => addButton("PHONE_NUMBER")}>+ Phone Number</button>
            </div>
          </div>

          {form.buttons.map((btn, idx) => (
            <div key={idx} className="p-2 border rounded mb-2 d-flex gap-2 align-items-center bg-light">
              <span className="badge bg-secondary text-capitalize">{btn.type.replace("_", " ")}</span>
              <input
                className="form-control form-control-sm"
                placeholder="Button Label"
                value={btn.text}
                onChange={(e) => {
                  const updated = [...form.buttons];
                  updated[idx].text = e.target.value;
                  set("buttons", updated);
                }}
              />
              {btn.type === "URL" && (
                <input
                  className="form-control form-control-sm"
                  placeholder="URL (https://...)"
                  value={btn.url || ""}
                  onChange={(e) => {
                    const updated = [...form.buttons];
                    updated[idx].url = e.target.value;
                    set("buttons", updated);
                  }}
                />
              )}
              {btn.type === "PHONE_NUMBER" && (
                <input
                  className="form-control form-control-sm"
                  placeholder="+91..."
                  value={btn.phoneNumber || ""}
                  onChange={(e) => {
                    const updated = [...form.buttons];
                    updated[idx].phoneNumber = e.target.value;
                    set("buttons", updated);
                  }}
                />
              )}
              <button className="btn btn-sm btn-outline-danger" onClick={() => removeButton(idx)}>
                <i className="bi bi-x"></i>
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
