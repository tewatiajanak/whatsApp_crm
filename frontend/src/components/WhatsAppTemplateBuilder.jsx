import { useState, useMemo } from "react";
import { templatesApi, messagesApi } from "../api";
import { useToast } from "../context/ToastContext";
import { Modal } from "./ui";

const CATEGORIES = [
  { value: "UTILITY", label: "Utility" },
  { value: "MARKETING", label: "Marketing" },
  { value: "AUTHENTICATION", label: "Authentication" },
];

const LANGUAGES = [
  { code: "en", name: "English (en)" },
  { code: "hi", name: "Hindi (hi)" },
  { code: "es", name: "Spanish (es)" },
  { code: "fr", name: "French (fr)" },
];

const CATEGORY_TO_LOCAL = {
  UTILITY: "Utility",
  MARKETING: "Marketing",
  AUTHENTICATION: "Authentication",
};

const LOCAL_TO_META = {
  UTILITY: "UTILITY",
  MARKETING: "MARKETING",
  AUTHENTICATION: "AUTHENTICATION",
};

const META_MEDIA_LIMITS = {
  IMAGE: { maxBytes: 5 * 1024 * 1024, hint: "Meta standard: JPG/PNG up to 5 MB" },
  VIDEO: { maxBytes: 16 * 1024 * 1024, hint: "Meta standard: MP4 up to 16 MB" },
  DOCUMENT: { maxBytes: 100 * 1024 * 1024, hint: "Meta standard: PDF up to 100 MB" },
};

const MEDIA_ACCEPT = {
  IMAGE: "image/jpeg,image/png,image/webp",
  VIDEO: "video/mp4",
  DOCUMENT: "application/pdf",
};

function parseTemplateComponents(template) {
  const components = template?.components || [];
  const header = components.find((c) => c.type === "HEADER");
  const body = components.find((c) => c.type === "BODY");
  const footer = components.find((c) => c.type === "FOOTER");
  const buttonBlock = components.find((c) => c.type === "BUTTONS");
  const headerExample = header?.example?.header_handle?.[0] || "";

  const buttons = buttonBlock?.buttons?.map((b) => {
    if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text || "Reply" };
    if (b.type === "URL") return { type: "URL", text: b.text || "Open Link", url: b.url || "", urlType: b.url?.includes("{{") ? "dynamic" : "static" };
    if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text || "Call", phoneNumber: b.phone_number || b.phoneNumber || "" };
    return { type: "QUICK_REPLY", text: b.text || "Reply" };
  }) || [];

  return {
    headerType: header?.format || template?.headerType || "NONE",
    headerText: header?.text || template?.headerText || "",
    headerMediaUrl: headerExample || template?.headerMediaUrl || "",
    body: body?.text || template?.body || "",
    footer: footer?.text || template?.footer || "",
    buttons,
  };
}

function stableComponentsWithoutMedia(components = []) {
  return (components || []).map((c) => {
    if (c?.type !== "HEADER") return c;
    const next = { ...c };
    if (next.example) {
      next.example = { ...next.example, header_handle: [] };
    }
    return next;
  });
}

export default function WhatsAppTemplateBuilder({ initialTemplate, onCancel, onSaved }) {
  const toast = useToast();
  const editHydration = initialTemplate ? parseTemplateComponents(initialTemplate) : null;
  const isEditMode = Boolean(initialTemplate?._id);
  const [submitting, setSubmitting] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("+919999900001");
  const [sendingTest, setSendingTest] = useState(false);
  const [buttonMenuOpen, setButtonMenuOpen] = useState(false);
  const [headerMediaMode, setHeaderMediaMode] = useState(editHydration?.headerMediaUrl ? "url" : "upload");
  const [headerUploadName, setHeaderUploadName] = useState("");
  const [uploadingHeaderMedia, setUploadingHeaderMedia] = useState(false);
  const [headerLocalPreviewUrl, setHeaderLocalPreviewUrl] = useState("");

  const isMetaTemplateEdit = Boolean(initialTemplate?._id && initialTemplate?.metaId);
  const metaStatus = String(initialTemplate?.status || "").trim().toUpperCase();
  const canEditMetaByStatus = ["APPROVED", "REJECTED", "PAUSED"].includes(metaStatus);
  const lockByMetaStatus = isMetaTemplateEdit && !canEditMetaByStatus;
  const canEditContent = !isMetaTemplateEdit || canEditMetaByStatus;
  const canEditNameLanguage = !isEditMode;
  const canEditCategory = !isEditMode ? true : (isMetaTemplateEdit ? metaStatus !== "APPROVED" : false);

  const disabledFieldStyle = {
    backgroundColor: "#eef2f7",
    color: "#64748b",
    borderColor: "#d7dee8",
    cursor: "not-allowed",
  };

  const [form, setForm] = useState(() => ({
    name: initialTemplate?.name || "",
    category: initialTemplate?.category?.toUpperCase() || "UTILITY",
    language: initialTemplate?.language || "en",
    headerType: editHydration?.headerType || initialTemplate?.headerType || "NONE",
    headerText: editHydration?.headerText || initialTemplate?.headerText || "",
    headerMediaUrl: editHydration?.headerMediaUrl || initialTemplate?.headerMediaUrl || "",
    body: editHydration?.body || initialTemplate?.body || "",
    footer: editHydration?.footer || initialTemplate?.footer || "",
    buttons: editHydration?.buttons?.length ? editHydration.buttons : initialTemplate?.buttons || [],
    samples: initialTemplate?.samples || {},
  }));

  const updateForm = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  async function handleHeaderMediaUpload(file) {
    if (!file) return;
    const headerType = form.headerType;
    const rule = META_MEDIA_LIMITS[headerType];
    if (rule && file.size > rule.maxBytes) {
      toast(`${headerType} file is too large. ${rule.hint}`, "error");
      return;
    }
    setUploadingHeaderMedia(true);
    try {
      const localPreview = URL.createObjectURL(file);
      setHeaderLocalPreviewUrl(localPreview);
      const res = await templatesApi.uploadTestMedia(file);
      const mediaId = res?.data?.id || res?.id;
      if (!mediaId) throw new Error("Meta did not return media id");
      setHeaderUploadName(file.name);
      updateForm("headerMediaUrl", String(mediaId));
      toast("Media uploaded to Meta. Media ID saved for template header.");
    } catch (e) {
      toast(e.message || "Failed to upload media to Meta", "error");
    } finally {
      setUploadingHeaderMedia(false);
    }
  }

  // Extract all {{1}}, {{2}} variables from text
  const extractedVariables = useMemo(() => {
    const text = `${form.headerType === "TEXT" ? form.headerText : ""} ${form.body}`;
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    const nums = [...new Set(matches.map((m) => m.replace(/[\{\}]/g, "")))].sort((a, b) => Number(a) - Number(b));
    return nums;
  }, [form.headerType, form.headerText, form.body]);

  function insertVariable(varNum) {
    const varTag = `{{${varNum}}}`;
    setForm((prev) => ({ ...prev, body: prev.body + (prev.body.endsWith(" ") ? "" : " ") + varTag }));
  }

  function handleSampleChange(varNum, value) {
    setForm((prev) => ({
      ...prev,
      samples: { ...prev.samples, [varNum]: value },
    }));
  }

  function addButton(type) {
    setButtonMenuOpen(false);
    if (form.buttons.length >= 3) {
      toast("Max 3 buttons allowed", "error");
      return;
    }

    const newBtn =
      type === "CUSTOM"
        ? { type: "QUICK_REPLY", text: "Talk to Advisor" }
        : type === "URL"
        ? { type: "URL", text: "Visit Portal", url: "https://greenwood.edu", urlType: "static", urlVariable: "1" }
        : { type: "PHONE_NUMBER", text: "Call Support", phoneNumber: "+919999900001" };

    setForm((prev) => ({ ...prev, buttons: [...prev.buttons, newBtn] }));
  }

  function removeButton(idx) {
    setForm((prev) => ({ ...prev, buttons: prev.buttons.filter((_, i) => i !== idx) }));
  }

  function updateButtonField(idx, field, val) {
    setForm((prev) => {
      const updated = [...prev.buttons];
      updated[idx] = { ...updated[idx], [field]: val };
      return { ...prev, buttons: updated };
    });
  }

  function buildComponentsPayload() {
    const components = [];

    if (form.headerType === "TEXT" && form.headerText) {
      components.push({ type: "HEADER", format: "TEXT", text: form.headerText });
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerType)) {
      components.push({
        type: "HEADER",
        format: form.headerType,
        example: { header_handle: form.headerMediaUrl ? [form.headerMediaUrl] : [] },
      });
    }

    components.push({ type: "BODY", text: form.body || "" });

    if (form.footer) {
      components.push({ type: "FOOTER", text: form.footer });
    }

    if (form.buttons?.length) {
      const formattedButtons = form.buttons.map((b) => {
        if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text };
        if (b.type === "URL") return { type: "URL", text: b.text, url: b.url };
        if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phoneNumber };
        return { type: "QUICK_REPLY", text: b.text };
      });
      components.push({ type: "BUTTONS", buttons: formattedButtons });
    }

    return components;
  }

  async function handleSaveDraft() {
    const formattedName = form.name.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
    if (!formattedName) {
      toast("Please enter a valid template name", "error");
      return;
    }
    if (!form.body.trim()) {
      toast("Body content is required", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formattedName,
        channel: "whatsapp",
        category: CATEGORY_TO_LOCAL[form.category] || "Utility",
        language: form.language,
        status: "Draft",
        body: form.body,
        components: buildComponentsPayload(),
      };

      if (initialTemplate?._id) {
        await templatesApi.update(initialTemplate._id, payload);
      } else {
        await templatesApi.create(payload);
      }

      toast(`Template '${formattedName}' saved as Draft`);
      if (onSaved) onSaved();
    } catch (e) {
      toast(e.message || "Failed to save draft", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitMeta() {
    const formattedName = form.name.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
    if (!formattedName) {
      toast("Please enter a valid template name", "error");
      return;
    }
    if (!form.body.trim()) {
      toast("Body content is required", "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = { ...form, name: formattedName };
      const mediaValidationError = validateHeaderMediaValue(form.headerType, form.headerMediaUrl);
      if (mediaValidationError) {
        toast(mediaValidationError, "error");
        return;
      }

      const nextComponents = buildComponentsPayload();
      const prevComponents = Array.isArray(initialTemplate?.components) ? initialTemplate.components : [];
      const onlyMediaChanged = Boolean(initialTemplate?._id) &&
        JSON.stringify(stableComponentsWithoutMedia(prevComponents)) === JSON.stringify(stableComponentsWithoutMedia(nextComponents)) &&
        JSON.stringify(stableComponentsWithoutMedia(nextComponents)) !== "[]";

      if (lockByMetaStatus) {
        toast(`Meta validation: template with status '${initialTemplate?.status}' is not editable.`, "error");
        return;
      }

      if (onlyMediaChanged) {
        await templatesApi.update(initialTemplate._id, {
          name: formattedName,
          channel: "whatsapp",
          category: CATEGORY_TO_LOCAL[form.category] || "Utility",
          language: form.language,
          status: initialTemplate.status || "Approved",
          body: form.body,
          components: nextComponents,
        });
        toast("Media sample updated in CRM. Meta re-approval skipped (template content unchanged).");
        if (onSaved) onSaved();
        return;
      }

      if (isMetaTemplateEdit) {
        const initialMetaCategory = LOCAL_TO_META[String(initialTemplate?.category || "").toUpperCase()] || String(initialTemplate?.category || "").toUpperCase();
        const editPayload = { components: nextComponents };

        if (canEditCategory && form.category !== initialMetaCategory) {
          editPayload.category = form.category;
        }

        await templatesApi.editMeta(initialTemplate._id, editPayload);
        toast(`Template '${formattedName}' updated on Meta and CRM.`);
        if (onSaved) onSaved();
        return;
      }

      await templatesApi.createMeta({
        ...payload,
      });
      toast(`Template '${formattedName}' created successfully! ✓`);
      if (onSaved) onSaved();
    } catch (e) {
      toast(e.message || "Failed to save template", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendTestMessage() {
    if (!testPhone.trim()) {
      toast("Enter a valid mobile number", "error");
      return;
    }

    setSendingTest(true);
    try {
      const paramList = extractedVariables.map((v) => form.samples[v] || `Sample ${v}`);
      await messagesApi.send({
        channel: "whatsapp",
        to: testPhone,
        template: form.name || "admission_welcome",
        params: paramList,
        text: renderPreviewBody(form.body, form.samples),
      });
      toast(`Test message sent to ${testPhone} ✓`);
      setTestModalOpen(false);
    } catch (e) {
      toast(e.message || "Failed to send test message", "error");
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #e2e8f0", padding: "14px" }}>
      {/* Clean Header */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <div>
          <h5 className="fw-bold mb-1" style={{ color: "#0f172a" }}>
            {initialTemplate ? "Edit WhatsApp Template" : "Create WhatsApp Template"}
          </h5>
        </div>
        <div className="d-flex gap-2">
          {onCancel && (
            <button className="btn btn-outline-secondary btn-sm px-3" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button className="btn btn-outline-wa btn-sm px-3" onClick={() => setTestModalOpen(true)}>
            <i className="bi bi-send me-1"></i> Send Test
          </button>
          <button className="btn btn-wa btn-sm px-4 fw-semibold" disabled={submitting || !form.name || !form.body || lockByMetaStatus} onClick={handleSubmitMeta}>
            {submitting ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-check-circle me-1"></i>}
            {initialTemplate ? "Update on CRM + Meta" : "Save to CRM + Meta"}
          </button>
        </div>
      </div>

      {isMetaTemplateEdit && (
        <div className={`alert ${lockByMetaStatus ? "alert-warning" : "alert-info"} py-2 px-3 mb-3 small`}>
          Meta edit rules: only approved/rejected/paused templates are editable. Name and language are locked. Category is locked for approved templates.
        </div>
      )}

      {!isMetaTemplateEdit && isEditMode && (
        <div className="alert alert-secondary py-2 px-3 mb-3 small">
          Edit mode: Template name, category, and language are locked.
        </div>
      )}

      {/* Optimized Main Grid: Expanded Left Form (col-lg-8) & Sleek Right Preview (col-lg-4) */}
      <div className="row g-4">
        {/* Left Column: Expanded Form Editor */}
        <div className="col-lg-8">
          <div className="d-flex flex-column gap-2">
            {/* Template Details Card: Template Name on Top (Row 1), Category & Language Below (Row 2) */}
            <div className="p-4 border rounded-3 bg-light-subtle">
              {/* Row 1: Template Name */}
              <div className="mb-3">
                <label className="form-label small fw-semibold text-secondary mb-1">Template Name</label>
                <input
                  className="form-control form-control-sm font-monospace"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  disabled={!canEditNameLanguage || submitting}
                  style={!canEditNameLanguage ? disabledFieldStyle : undefined}
                  placeholder="Enter template name"
                />
                <div className="form-text" style={{ fontSize: "11px", marginTop: "4px" }}>
                  Use lowercase letters, numbers and underscores only (e.g. fee_reminder_v1).
                </div>
              </div>

              {/* Row 2: Category & Language Below with clear 2px / 8px gap */}
              <div className="row g-3" style={{ gap: "8px" }}>
                <div className="col-md-6" style={{ maxWidth: "48%", flex: "0 0 48%" }}>
                  <label className="form-label small fw-semibold text-secondary mb-1">Category</label>
                  <select className="form-select form-select-sm" value={form.category} onChange={(e) => updateForm("category", e.target.value)} disabled={!canEditCategory || submitting} style={!canEditCategory ? disabledFieldStyle : undefined}>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6" style={{ maxWidth: "48%", flex: "0 0 48%" }}>
                  <label className="form-label small fw-semibold text-secondary mb-1">Language</label>
                  <select className="form-select form-select-sm" value={form.language} onChange={(e) => updateForm("language", e.target.value)} disabled={!canEditNameLanguage || submitting} style={!canEditNameLanguage ? disabledFieldStyle : undefined}>
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Header Section */}
            <div className="p-4 border rounded-3 bg-white">
              <label className="form-label small fw-semibold text-secondary mb-2">Header (Optional)</label>
              <div className="row g-3" style={{ gap: "8px" }}>
                <div className="col-md-4" style={{ maxWidth: "28%", flex: "0 0 28%" }} >
                  <select className="form-select form-select-sm" value={form.headerType} onChange={(e) => updateForm("headerType", e.target.value)} disabled={!canEditContent || submitting}>
                    <option value="NONE">None</option>
                    <option value="TEXT">Text Header</option>
                    <option value="IMAGE">Image</option>
                    <option value="VIDEO">Video</option>
                    <option value="DOCUMENT">Document PDF</option>
                  </select>
                </div>
                {form.headerType === "TEXT" && (
                  <div className="col-md-8" style={{ maxWidth: "72%", flex: "0 0 68%" }}>
                    <input
                      className="form-control form-control-sm"
                      maxLength={60}
                      value={form.headerText}
                      onChange={(e) => updateForm("headerText", e.target.value)}
                      disabled={!canEditContent || submitting}
                      placeholder="Header text..."
                    />
                  </div>
                )}
                {["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerType) && (
                  <div className="col-md-8">
                    <div className="d-flex gap-2 mb-2">
                      <button
                        type="button"
                        className={`btn btn-sm ${headerMediaMode === "url" ? "btn-dark" : "btn-outline-secondary"}`}
                        onClick={() => setHeaderMediaMode("url")}
                        disabled={!canEditContent || submitting || uploadingHeaderMedia}
                      >
                        URL
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm ${headerMediaMode === "upload" ? "btn-dark" : "btn-outline-secondary"}`}
                        onClick={() => setHeaderMediaMode("upload")}
                        disabled={!canEditContent || submitting || uploadingHeaderMedia}
                      >
                        Upload
                      </button>
                    </div>

                    {headerMediaMode === "url" ? (
                      <input
                        className="form-control form-control-sm"
                        value={form.headerMediaUrl}
                        onChange={(e) => updateForm("headerMediaUrl", e.target.value)}
                        disabled={!canEditContent || submitting || uploadingHeaderMedia}
                        placeholder="Public media URL or Meta media ID"
                      />
                    ) : (
                      <>
                        <input
                          type="file"
                          className="form-control form-control-sm"
                          accept={MEDIA_ACCEPT[form.headerType] || "*/*"}
                          onChange={(e) => handleHeaderMediaUpload(e.target.files?.[0])}
                          disabled={!canEditContent || submitting || uploadingHeaderMedia}
                        />
                        {headerUploadName && (
                          <div className="small text-muted mt-1">Selected: {headerUploadName}</div>
                        )}
                        {uploadingHeaderMedia && (
                          <div className="small text-muted mt-1">
                            <span className="spinner-border spinner-border-sm me-1" />Uploading to Meta...
                          </div>
                        )}
                      </>
                    )}

                    <div className="small text-muted mt-2">
                      {META_MEDIA_LIMITS[form.headerType]?.hint} Use public URL or Meta media ID.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Message Body Section */}
            <div className="p-4 border rounded-3 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label className="form-label small fw-semibold text-secondary mb-0">Message Body</label>
                <div className="d-flex gap-1">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className="btn btn-xs btn-outline-primary py-0 px-2"
                      style={{ fontSize: "11px" }}
                      onClick={() => insertVariable(num)}
                      disabled={!canEditContent || submitting}
                    >
                      + {`{{${num}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                className="form-control mb-3"
                rows={12}
                maxLength={1024}
                value={form.body}
                onChange={(e) => updateForm("body", e.target.value)}
                disabled={!canEditContent || submitting}
                placeholder="Write your message here. Use {{1}}, {{2}}, etc. for dynamic variables."
                style={{ fontSize: "13.5px", lineHeight: "1.5" }}
              />

              {/* Dynamic Sample Substitutions */}
              {extractedVariables.length > 0 && (
                <div className="pt-3 border-top mt-2" >
                  <div className="small text-muted mb-2 font-semibold">Sample values for variables:</div>
                  <div className="row g-3" style={{ gap: "8px" }}>
                    {extractedVariables.map((v) => (
                      <div key={v} className="col-md-6" >
                        <div className="input-group input-group-sm" style={{ gap: "8px" }}>
                          <span className="input-group-text bg-light text-primary font-monospace">{`{{${v}}}`}</span>
                          <input
                            className="form-control"
                            value={form.samples[v] || ""}
                            onChange={(e) => handleSampleChange(v, e.target.value)}
                            placeholder={`Value ${v}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Text Section */}
            <div className="p-4 border rounded-3 bg-white">
              <label className="form-label small fw-semibold text-secondary mb-2">Footer Text (Optional)</label>
              <input
                className="form-control form-control-sm"
                maxLength={60}
                value={form.footer}
                onChange={(e) => updateForm("footer", e.target.value)}
                disabled={!canEditContent || submitting}
                placeholder="Footer text..."
              />
            </div>

            {/* Interactive Buttons Section */}
            <div className="p-4 border rounded-3 bg-white">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <label className="form-label small fw-semibold text-secondary mb-0">Buttons</label>
                <div className="position-relative">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm dropdown-toggle"
                    onClick={() => setButtonMenuOpen((open) => !open)}
                    disabled={!canEditContent || submitting}
                  >
                    + Add button
                  </button>
                  {buttonMenuOpen && (
                    <div
                      className="dropdown-menu show shadow-sm"
                      style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", minWidth: 240, zIndex: 20 }}
                    >
                      <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => addButton("CUSTOM")}>
                        <i className="bi bi-reply"></i> Custom
                      </button>
                      <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => addButton("URL")}>
                        <i className="bi bi-box-arrow-up-right"></i> Visit website
                      </button>
                      <button type="button" className="dropdown-item d-flex align-items-center gap-2" onClick={() => addButton("PHONE_NUMBER")}>
                        <i className="bi bi-telephone"></i> Call phone number
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {form.buttons.map((btn, idx) => (
                <div key={idx}>
                  <div className="d-flex gap-2 align-items-center mt-2">
                    <span className="badge bg-light text-dark border">{btn.type.replace("_", " ")}</span>
                    <input
                      className="form-control form-control-sm"
                      value={btn.text}
                      onChange={(e) => updateButtonField(idx, "text", e.target.value)}
                      disabled={!canEditContent || submitting}
                      placeholder="Button Label"
                    />
                    {btn.type === "URL" && (
                      <select
                        className="form-select form-select-sm"
                        value={btn.urlType || "static"}
                        onChange={(e) => updateButtonField(idx, "urlType", e.target.value)}
                        disabled={!canEditContent || submitting}
                      
                      >
                        <option value="static">Static URL</option>
                        <option value="dynamic">Dynamic URL</option>
                      </select>
                    )}
                    {btn.type === "PHONE_NUMBER" && (
                      <input
                        className="form-control form-control-sm"
                        value={btn.phoneNumber || ""}
                        onChange={(e) => updateButtonField(idx, "phoneNumber", e.target.value)}
                        disabled={!canEditContent || submitting}
                        placeholder="+91..."
                      />
                    )}
                    <button type="button" className="btn btn-sm btn-outline-danger border-0" onClick={() => removeButton(idx)} disabled={!canEditContent || submitting}>
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                  {btn.type === "URL" && (
                    <div className="mt-2 ms-5 ps-2 " style={{ paddingLeft: "12px" }}>
                      {(btn.urlType || "static") === "static" ? (
                        <input
                          className="form-control form-control-sm"
                          value={btn.url || ""}
                          onChange={(e) => updateButtonField(idx, "url", e.target.value)}
                          disabled={!canEditContent || submitting}
                          placeholder="Enter URL (https://...)"
                          style={{ width: "94%" }}
                        />
                      ) : (
                        <div className="d-flex gap-2 align-items-center">
                          <label className="form-label small mb-0" style={{ minWidth: "100px" }}>Variable:</label>
                          <select
                            className="form-select form-select-sm"
                            value={btn.urlVariable || "1"}
                            onChange={(e) => updateButtonField(idx, "urlVariable", e.target.value)}
                            disabled={!canEditContent || submitting}
                            style={{ maxWidth: "120px" }}
                          >
                            {extractedVariables.map((v) => (
                              <option key={v} value={v}>{`{{${v}}}`}</option>
                            ))}
                            {extractedVariables.length === 0 && <option value="1">No variables</option>}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Clean White Card Preview (No Dotted Shaded Background) */}
        <div className="col-lg-4">
          <div className="sticky-top" style={{ top: "80px" }}>
            <div
              style={{
                background: "#ffffff",
                padding: "24px",

                minHeight: "360px",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                
              }}
            >
              {/* Native WhatsApp Message Bubble */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px 12px 12px 12px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  overflow: "hidden",
                  width: "100%",
                }}
              >
                {/* Header Render */}
                {form.headerType === "TEXT" && form.headerText && (
                  <div style={{ padding: "14px 16px 2px", fontWeight: "700", fontSize: "14px", color: "#0f172a" }}>
                    {renderPreviewBody(form.headerText, form.samples)}
                  </div>
                )}

                {["IMAGE", "VIDEO", "DOCUMENT"].includes(form.headerType) && (
                  <div style={{ width: "100%", background: "#f8fafc" }}>
                    {form.headerType === "IMAGE" && (
                      (headerLocalPreviewUrl || (form.headerMediaUrl && isHttpUrl(form.headerMediaUrl) ? form.headerMediaUrl : "")) ? (
                        <img
                          src={headerLocalPreviewUrl || form.headerMediaUrl}
                          alt="Header preview"
                          style={{ width: "100%", height: "160px", objectFit: "cover" }}
                        />
                      ) : form.headerMediaUrl ? (
                        <div style={{ padding: "14px", background: "#ecfeff", borderBottom: "1px solid #bae6fd", color: "#0c4a6e" }}>
                          Meta media ID selected (preview unavailable)
                        </div>
                      ) : (
                        <div style={{ padding: "14px", color: "#92400e", background: "#fef3c7", borderBottom: "1px solid #fde68a" }}>
                          No image attached
                        </div>
                      )
                    )}
                    {form.headerType === "VIDEO" && (
                      form.headerMediaUrl ? (
                        <div style={{ height: "140px", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                          <i className="bi bi-play-circle-fill" style={{ fontSize: "36px" }}></i>
                        </div>
                      ) : (
                        <div style={{ padding: "14px", color: "#92400e", background: "#fef3c7", borderBottom: "1px solid #fde68a" }}>
                          No video attached
                        </div>
                      )
                    )}
                    {form.headerType === "DOCUMENT" && (
                      form.headerMediaUrl ? (
                        <div style={{ padding: "14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "10px" }}>
                          <i className="bi bi-file-earmark-pdf-fill text-danger" style={{ fontSize: "28px" }}></i>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>Document attached</div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>PDF Document</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: "14px", color: "#92400e", background: "#fef3c7", borderBottom: "1px solid #fde68a" }}>
                          No document attached
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* Body Content */}
                <div style={{ padding: "14px 16px", fontSize: "13.5px", color: "#1e293b", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                  {renderPreviewBody(form.body, form.samples)}
                </div>

                {/* Footer Text */}
                {form.footer && (
                  <div style={{ padding: "0 16px 8px", fontSize: "11px", color: "#64748b" }}>
                    {form.footer}
                  </div>
                )}

                {/* Timestamp & Ticks */}
                <div style={{ padding: "0 16px 10px", textAlign: "right", fontSize: "10px", color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "3px" }}>
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  <i className="bi bi-check2-all text-primary" style={{ fontSize: "13px" }}></i>
                </div>

                {/* Buttons */}
                {form.buttons.length > 0 && (
                  <div style={{ borderTop: "1px solid #e2e8f0", background: "#fafafa" }}>
                    {form.buttons.map((btn, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: "10px 14px",
                          textAlign: "center",
                          color: "#0284c7",
                          fontWeight: "600",
                          fontSize: "13px",
                          borderBottom: idx < form.buttons.length - 1 ? "1px solid #e2e8f0" : "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                        }}
                      >
                        {btn.type === "URL" && <i className="bi bi-box-arrow-up-right"></i>}
                        {btn.type === "PHONE_NUMBER" && <i className="bi bi-telephone-fill"></i>}
                        {btn.type === "QUICK_REPLY" && <i className="bi bi-reply-fill"></i>}
                        {btn.text || "Button"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Modal */}
      {testModalOpen && (
        <Modal
          title="Send Test Message"
          onClose={() => setTestModalOpen(false)}
          footer={
            <>
              <button className="btn btn-outline-secondary" onClick={() => setTestModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-wa" disabled={sendingTest || !testPhone} onClick={handleSendTestMessage}>
                {sendingTest && <span className="spinner-border spinner-border-sm me-2" />}
                Send Test
              </button>
            </>
          }
        >
          <div className="mb-3">
            <label className="form-label small fw-semibold">Mobile Number</label>
            <input
              className="form-control"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Enter phone number"
            />
          </div>
          <div className="p-3 bg-light rounded border small">
            <div className="text-muted mb-1">Preview:</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{renderPreviewBody(form.body, form.samples)}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function renderPreviewBody(text, samples = {}) {
  if (!text) return "";
  return text.replace(/\{\{(\d+)\}\}/g, (_, num) => {
    return samples[num] !== undefined && samples[num] !== "" ? samples[num] : `[Sample ${num}]`;
  });
}

function isHttpUrl(value) {
  try {
    const u = new URL(String(value || "").trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function looksLikeMetaMediaId(value) {
  const v = String(value || "").trim();
  return /^\d{8,}$/.test(v);
}

function validateHeaderMediaValue(headerType, value) {
  if (!["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)) return "";
  const v = String(value || "").trim();
  if (!v) return `Meta validation: ${headerType} header requires media URL or Meta media ID.`;
  if (v.startsWith("blob:")) return "Meta validation: local blob URL is not valid. Upload file to Meta or provide public URL.";

  if (looksLikeMetaMediaId(v)) return "";
  if (!isHttpUrl(v)) return "Meta validation: media must be a public URL or a numeric Meta media ID.";

  if (headerType === "DOCUMENT" && !/\.pdf($|\?)/i.test(v)) {
    return "Meta validation: document header URL should point to a PDF file.";
  }
  return "";
}
