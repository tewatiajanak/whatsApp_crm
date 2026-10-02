import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mastersApi, sessionsApi, gradesApi, workflowConfigApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useToast } from "../context/ToastContext";
import { Spinner, ErrorBox, EmptyState, Modal, IconBtn } from "../components/ui";

const ENQUIRY_FORM_DEFAULT_FIELDS = [
  { fieldName: "studentName", label: "Student Name", fieldType: "text", isRequired: true, selected: true, hidden: false, defaultValue: "", options: [], textColor: "#000000" },
  { fieldName: "mobileNumber", label: "Mobile Number", fieldType: "phone", isRequired: true, selected: true, hidden: false, defaultValue: "", options: [], textColor: "#000000" },
  { fieldName: "emailId", label: "Email Id", fieldType: "email", isRequired: false, selected: true, hidden: false, defaultValue: "", options: [], textColor: "#000000" },
  { fieldName: "courseInterested", label: "Course Interested", fieldType: "text", isRequired: false, selected: true, hidden: false, defaultValue: "", options: [], textColor: "#000000" },
  { fieldName: "enquirySource", label: "Enquiry Source", fieldType: "select", isRequired: false, selected: true, hidden: false, defaultValue: "", options: [], textColor: "#000000" },
  { fieldName: "academicYear", label: "Academic Year", fieldType: "select", isRequired: false, selected: true, hidden: false, defaultValue: "", options: [], textColor: "#000000" },
  { fieldName: "grade", label: "Class", fieldType: "select", isRequired: false, selected: true, hidden: false, defaultValue: "", options: [], textColor: "#000000" }
];

const ENQUIRY_FORM_DEFAULT_LAYOUT = {
  columns: 2,
  width: "600px",
  height: "",
  align: "left",
  headingFontSize: "24px",
  headingColor: "#111827",
  headingAlign: "left",
  headingBold: true,
  headingItalic: false,
  taglineFontSize: "16px",
  taglineColor: "#4b5563",
  taglineAlign: "left",
  taglineBold: false,
  taglineItalic: false,
  submitText: "Submit Enquiry",
  buttonColor: "#0d6efd",
  buttonTextColor: "#ffffff",
  buttonFontSize: "16px",
  buttonBold: true,
  buttonItalic: false,
  footerText: ""
};

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

function normalizeFieldName(value) {
  return String(value || "").trim().replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
}

function canonicalFieldKey(value) {
  return String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function formatDateDMY(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (num) => String(num).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function getShareUrl(formId) {
  return `${window.location.origin}/public/enquiry-form/${formId}`;
}

function normalizeForm(form) {
  const normalizeSize = (v, fallback) => {
    if (v === undefined || v === null) return fallback;
    const s = String(v).trim();
    if (!s) return fallback;
    if (/^[0-9]+$/.test(s)) return `${s}px`;
    return s;
  };
  return {
    ...form,
    name: String(form.name || "").trim(),
    heading: String(form.heading || "").trim(),
    tagline: String(form.tagline || "").trim(),
    fields: (form.fields || []).map((field, idx) => ({
      fieldName: normalizeFieldName(field.fieldName || field.label || ""),
      label: String(field.label || "").trim(),
      fieldType: field.fieldType || "text",
      isRequired: Boolean(field.isRequired),
      selected: Boolean(field.selected),
      hidden: Boolean(field.hidden),
      defaultValue: field.defaultValue || "",
      options: Array.isArray(field.options) ? field.options : [],
      column: field.column !== undefined && field.column !== null ? Number(field.column) : null,
      sequence: field.sequence !== undefined && field.sequence !== null ? Number(field.sequence) : (idx + 1) * 10,
      textColor: field.textColor || "#000000"
    })).sort((a, b) => (a.sequence || 0) - (b.sequence || 0)),
    isActive: Boolean(form.isActive),
    updatedAt: form.updatedAt || new Date().toISOString(),
    // layout
    columns: form.columns || ENQUIRY_FORM_DEFAULT_LAYOUT.columns,
    width: normalizeSize(form.width, ENQUIRY_FORM_DEFAULT_LAYOUT.width),
    height: normalizeSize(form.height, ENQUIRY_FORM_DEFAULT_LAYOUT.height),
    align: form.align || ENQUIRY_FORM_DEFAULT_LAYOUT.align,
    fontFamily: form.fontFamily || "Default",
    cardBgColor: form.cardBgColor || "#ffffff",
    cardBorderRadius: normalizeSize(form.cardBorderRadius, "12px"),
    cardShadow: form.cardShadow || "medium",
    fieldBorderRadius: normalizeSize(form.fieldBorderRadius, "6px"),
    fieldLabelFontSize: normalizeSize(form.fieldLabelFontSize, "14px"),
    fieldInputFontSize: normalizeSize(form.fieldInputFontSize, "14px"),
    headingFontSize: form.headingFontSize || ENQUIRY_FORM_DEFAULT_LAYOUT.headingFontSize,
    headingColor: form.headingColor || ENQUIRY_FORM_DEFAULT_LAYOUT.headingColor,
    headingAlign: form.headingAlign || ENQUIRY_FORM_DEFAULT_LAYOUT.headingAlign,
    headingBold: form.headingBold !== undefined ? Boolean(form.headingBold) : ENQUIRY_FORM_DEFAULT_LAYOUT.headingBold,
    headingItalic: form.headingItalic !== undefined ? Boolean(form.headingItalic) : ENQUIRY_FORM_DEFAULT_LAYOUT.headingItalic,
    headingFontFamily: form.headingFontFamily || "Default",
    taglineFontSize: form.taglineFontSize || ENQUIRY_FORM_DEFAULT_LAYOUT.taglineFontSize,
    taglineColor: form.taglineColor || ENQUIRY_FORM_DEFAULT_LAYOUT.taglineColor,
    taglineAlign: form.taglineAlign || ENQUIRY_FORM_DEFAULT_LAYOUT.taglineAlign,
    taglineBold: form.taglineBold !== undefined ? Boolean(form.taglineBold) : ENQUIRY_FORM_DEFAULT_LAYOUT.taglineBold,
    taglineItalic: form.taglineItalic !== undefined ? Boolean(form.taglineItalic) : ENQUIRY_FORM_DEFAULT_LAYOUT.taglineItalic,
    taglineFontFamily: form.taglineFontFamily || "Default",
    submitText: String(form.submitText || ENQUIRY_FORM_DEFAULT_LAYOUT.submitText).trim(),
    buttonColor: form.buttonColor || ENQUIRY_FORM_DEFAULT_LAYOUT.buttonColor,
    buttonTextColor: form.buttonTextColor || ENQUIRY_FORM_DEFAULT_LAYOUT.buttonTextColor,
    buttonFontSize: form.buttonFontSize || ENQUIRY_FORM_DEFAULT_LAYOUT.buttonFontSize,
    buttonBold: form.buttonBold !== undefined ? Boolean(form.buttonBold) : ENQUIRY_FORM_DEFAULT_LAYOUT.buttonBold,
    buttonItalic: form.buttonItalic !== undefined ? Boolean(form.buttonItalic) : ENQUIRY_FORM_DEFAULT_LAYOUT.buttonItalic,
    buttonAlign: form.buttonAlign || "left",
    buttonBorderRadius: normalizeSize(form.buttonBorderRadius, "6px"),
    footerText: form.footerText || ENQUIRY_FORM_DEFAULT_LAYOUT.footerText,
    footerFontSize: normalizeSize(form.footerFontSize, "13px"),
    footerColor: form.footerColor || "#6b7280",
    footerAlign: form.footerAlign || "left",
    footerFontFamily: form.footerFontFamily || "Default",
    footerBold: form.footerBold !== undefined ? Boolean(form.footerBold) : false,
    footerItalic: form.footerItalic !== undefined ? Boolean(form.footerItalic) : false,
    createdAt: form.createdAt || form.updatedAt || new Date().toISOString(),
    _id: form._id || `${Date.now()}`
  };
}

function getEnquiryConfigData(raw) {
  const config = raw?.data || raw;
  return Array.isArray(config) ? config : config?.forms || config?.fields || [];
}

export default function EnquiryForms() {
  const navigate = useNavigate();
  const { formId } = useParams();
  const toast = useToast();
  const config = useApi(() => workflowConfigApi.get("enquiryForms"), []);
  const sources = useApi(() => mastersApi.sources(), []);
  const sessions = useApi(() => sessionsApi.list(), []);
  const grades = useApi(() => gradesApi.list(), []);
  const [forms, setForms] = useState([]);
  const [activeForm, setActiveForm] = useState(null);
  const [fieldEditor, setFieldEditor] = useState(null);
  const [previewForm, setPreviewForm] = useState(null);
  const [editorStep, setEditorStep] = useState(1);

  useEffect(() => {
    setForms(getEnquiryConfigData(config.data));
  }, [config.data]);

  useEffect(() => {
    if (!config.loading && !config.error) {
      if (formId === "new") {
        setEditorStep(1);
        setActiveForm({
          _id: undefined,
          name: "",
          heading: "",
          tagline: "",
          isActive: true,
          fields: ENQUIRY_FORM_DEFAULT_FIELDS.map((field) => ({ ...field })),
          // layout defaults
          ...ENQUIRY_FORM_DEFAULT_LAYOUT
        });
      } else if (formId) {
        const existing = forms.find((form) => String(form._id) === String(formId));
        if (existing) {
          setEditorStep(1);
          setActiveForm({
            ...existing,
            heading: existing.heading || "",
            tagline: existing.tagline || "",
            fields: (existing.fields || []).map((field) => ({ ...field })),
            // ensure layout keys exist
            columns: existing.columns || ENQUIRY_FORM_DEFAULT_LAYOUT.columns,
            width: existing.width || ENQUIRY_FORM_DEFAULT_LAYOUT.width,
            height: existing.height || ENQUIRY_FORM_DEFAULT_LAYOUT.height,
            align: existing.align || ENQUIRY_FORM_DEFAULT_LAYOUT.align,
            footerEnabled: Boolean(existing.footerEnabled || ENQUIRY_FORM_DEFAULT_LAYOUT.footerEnabled),
            footerText: existing.footerText || ENQUIRY_FORM_DEFAULT_LAYOUT.footerText
          });
        } else {
          setActiveForm(null);
        }
      } else {
        setActiveForm(null);
      }
    }
  }, [formId, forms, config.loading, config.error]);

  const fieldOptions = {
    source: (sources.data || []).map((item) => item.name || item.value || item.label || item._id).filter(Boolean),
    year: (sessions.data || []).map((item) => item.name || item.year || item.label || item._id).filter(Boolean),
    grade: (grades.data || []).map((item) => item.name || item.grade || item.label || item._id).filter(Boolean)
  };

  const getDefaultOptions = (field) => {
    const normalized = String(field.fieldName || field.label || "").toLowerCase();
    if (normalized.includes("source")) return fieldOptions.source;
    if (normalized.includes("year") || normalized.includes("session") || normalized.includes("academic")) return fieldOptions.year;
    if (normalized.includes("grade") || normalized.includes("class") || normalized.includes("standard")) return fieldOptions.grade;
    if (Array.isArray(field.options) && field.options.length) return field.options;
    return null;
  };

  const saveConfig = async (nextForms) => {
    const normalized = nextForms.map((form) => normalizeForm(form));
    try {
      await workflowConfigApi.save("enquiryForms", { forms: normalized });
      setForms(normalized);
      toast("Enquiry form saved");
      config.reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const createNewForm = () => navigate("/crm/setup/enquiry-forms/new");
  const editForm = (form) => navigate(`/crm/setup/enquiry-forms/${form._id}`);
  const closeEditor = () => navigate("/crm/setup?active=enquiry-form");
  const openPreview = (form) => setPreviewForm(form);
  const closePreview = () => setPreviewForm(null);

  const openFieldEditor = (field = null, idx = undefined) => {
    setFieldEditor({
      _idx: idx,
      fieldName: field?.fieldName || "",
      label: field?.label || "",
      fieldType: field?.fieldType || "text",
      isRequired: Boolean(field?.isRequired),
      selected: field?.selected !== false,
      hidden: Boolean(field?.hidden),
      defaultValue: field?.defaultValue || "",
      options: Array.isArray(field?.options) ? [...field.options] : [],
      optionsText: Array.isArray(field?.options) ? field.options.join(", ") : "",
      column: field?.column ?? null,
      textColor: field?.textColor || "#000000",
      maxColumns: activeForm?.columns || ENQUIRY_FORM_DEFAULT_LAYOUT.columns,
      error: ""
    });
  };

  const closeFieldEditor = () => setFieldEditor(null);

  const saveFieldEditor = () => {
    if (!fieldEditor) return;
    const normalizedFieldName = normalizeFieldName(fieldEditor.fieldName || fieldEditor.label || "");
    if (!fieldEditor.label.trim()) {
      setFieldEditor({ ...fieldEditor, error: "Field label is required" });
      return;
    }

    const siblingFieldKeys = (activeForm.fields || [])
      .map((field, idx) => canonicalFieldKey(field.fieldName || field.label || ""))
      .filter((_, idx) => idx !== fieldEditor._idx);

    const fieldKey = canonicalFieldKey(fieldEditor.fieldName || fieldEditor.label || "");
    if (siblingFieldKeys.includes(fieldKey)) {
      setFieldEditor({ ...fieldEditor, error: `Field label "${fieldEditor.label}" must be unique.` });
      return;
    }

    const normalizedField = {
      ...fieldEditor,
      fieldName: normalizedFieldName,
      label: fieldEditor.label.trim(),
      fieldType: fieldEditor.fieldType || "text",
      isRequired: Boolean(fieldEditor.isRequired),
      selected: Boolean(fieldEditor.selected),
      hidden: Boolean(fieldEditor.hidden),
      defaultValue: fieldEditor.defaultValue || "",
      options:
        fieldEditor.fieldType === "select"
          ? String(fieldEditor.optionsText || "")
              .split(",")
              .map((o) => o.trim())
              .filter(Boolean)
          : [],
      column: fieldEditor.column !== undefined && fieldEditor.column !== null ? Number(fieldEditor.column) : null,
      textColor: fieldEditor.textColor || "#000000"
    };

    const nextFields = [...(activeForm.fields || [])];
    if (fieldEditor._idx !== undefined && fieldEditor._idx !== null) {
      nextFields[fieldEditor._idx] = normalizedField;
    } else {
      nextFields.push(normalizedField);
    }
    setActiveForm({ ...activeForm, fields: nextFields });
    closeFieldEditor();
  };

  const deleteForm = async (formIdToDelete) => {
    if (!confirm("Delete this enquiry form?")) return;
    const next = forms.filter((form) => form._id !== formIdToDelete);
    await saveConfig(next);
  };

  const saveForm = async () => {
    if (!activeForm) return;
    if (!activeForm.name.trim()) {
      toast("Form name is required", "error");
      return;
    }

    const fieldKeys = (activeForm.fields || [])
      .map((field) => canonicalFieldKey(field.fieldName || field.label || ""))
      .filter(Boolean);

    const duplicateKey = fieldKeys.find((key, idx) => fieldKeys.indexOf(key) !== idx);
    if (duplicateKey) {
      toast(`Duplicate field found. Please use unique field labels.`, "error");
      return;
    }

    const nextForm = normalizeForm(activeForm);
    const nextForms = activeForm._id
      ? forms.map((form) => (String(form._id) === String(activeForm._id) ? nextForm : form))
      : [...forms, nextForm];

    await saveConfig(nextForms);
    navigate("/crm/setup?active=enquiry-form");
  };

  const displayedForms = forms.filter((form) => form.name.toLowerCase().includes((form?.name || "").toLowerCase()));

  return (
    <div style={{ padding: "0 2px" }}>
      <ErrorBox error={config.error} />

      {config.loading ? (
        <Spinner />
      ) : activeForm ? (
        <div className="card shadow-sm border-0" style={{ borderRadius: "16px" }}>
          {/* Stepper Header */}
          <div className="card-header bg-white border-bottom p-4" style={{ borderTopLeftRadius: "16px", borderTopRightRadius: "16px" }}>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h5 className="mb-1 fw-bold text-dark d-flex align-items-center gap-2" style={{ fontSize: "1.15rem" }}>
                  {activeForm._id ? "Edit Enquiry Form" : "Create Enquiry Form"}
                  <span className="badge bg-light text-primary border px-2 py-1" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    Step {editorStep} of 2
                  </span>
                </h5>
                <div className="text-muted small">
                  {editorStep === 1 
                    ? "Configure form fields, validate requirements and label options." 
                    : "Customise styling controls, width settings, colors and review live layout."}
                </div>
              </div>
              <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={closeEditor}>
                <i className="bi bi-x-lg"></i> Exit Editor
              </button>
            </div>
          </div>

          <div className="card-body p-4">
            {editorStep === 1 ? (
              /* ==================== STEP 1: CONFIGURE FIELDS ==================== */
              <div className="d-flex flex-column gap-4">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold text-muted mb-1">Form Name <span className="text-danger">*</span></label>
                    <input
                      className="form-control form-control-sm"
                      style={{ padding: "0.45rem 0.6rem" }}
                      value={activeForm.name}
                      onChange={(e) => setActiveForm({ ...activeForm, name: e.target.value })}
                      placeholder="e.g. Greenwood Admission Enquiry"
                    />
                    <div className="form-text small text-muted">A private name for your reference.</div>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold text-muted mb-1">Form Columns</label>
                    <select
                      className="form-select form-select-sm"
                      style={{ padding: "0.45rem 0.6rem", minHeight: "2.1rem" }}
                      value={activeForm.columns || 2}
                      onChange={(e) => {
                        const nextCols = parseInt(e.target.value, 10);
                        const nextFields = (activeForm.fields || []).map((f) => {
                          const currentCol = Number(f.column);
                          if (!currentCol || currentCol > nextCols || currentCol === activeForm.columns) {
                            return { ...f, column: nextCols };
                          }
                          return f;
                        });
                        setActiveForm({ ...activeForm, columns: nextCols, fields: nextFields });
                      }}
                    >
                      <option value={1}>1 Column Layout</option>
                      <option value={2}>2 Columns Layout</option>
                      <option value={3}>3 Columns Layout</option>
                    </select>
                    <div className="form-text small text-muted">Defines default field column span.</div>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold text-muted mb-1">Form Heading</label>
                    <input
                      className="form-control form-control-sm"
                      style={{ padding: "0.45rem 0.6rem" }}
                      value={activeForm.heading || ""}
                      onChange={(e) => setActiveForm({ ...activeForm, heading: e.target.value })}
                      placeholder="e.g. ADMISSION ENQUIRY"
                    />
                    <div className="form-text small text-muted">Displayed as the main title.</div>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold text-muted mb-1">Tagline</label>
                    <input
                      className="form-control form-control-sm"
                      style={{ padding: "0.45rem 0.6rem" }}
                      value={activeForm.tagline || ""}
                      onChange={(e) => setActiveForm({ ...activeForm, tagline: e.target.value })}
                      placeholder="e.g. Please share details to get in touch."
                    />
                    <div className="form-text small text-muted">A subtitle beneath the heading.</div>
                  </div>
                </div>

                <div className="border-top pt-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                      <h6 className="fw-bold mb-1 text-dark" style={{ fontSize: "1.05rem" }}>Form Fields</h6>
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn btn-sm btn-wa d-flex align-items-center gap-1" onClick={() => openFieldEditor()}>
                        <i className="bi bi-plus-lg"></i> Add Field
                      </button>
                    </div>
                  </div>

                  {(activeForm.fields || []).length === 0 ? (
                    <EmptyState title="No fields yet" subtitle="Add a field to start building this enquiry form." />
                  ) : (
                    <div className="table-responsive" style={{ minHeight: "200px" }}>
                      <table className="table table-hover align-middle mb-0" style={{ fontSize: "0.9rem" }}>
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: 40 }} className="text-center">Active</th>
                            <th style={{ width: 80 }} className="text-center">Sequence</th>
                            <th>Field Label</th>
                            <th>Field Type</th>
                            <th>Default Value</th>
                            <th style={{ width: 140 }}>Width / Span</th>
                            <th style={{ width: 80 }} className="text-center">Hidden</th>
                            <th style={{ width: 90 }} className="text-center">Mandatory</th>
                            <th style={{ width: 90 }} className="text-end">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeForm.fields.map((field, idx) => {
                            const defaultOptions = getDefaultOptions(field);
                            return (
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
                                <td className="text-center">
                                  <input
                                    type="number"
                                    className="form-control form-control-sm text-center mx-auto"
                                    style={{ width: "60px", padding: "0.25rem" }}
                                    min="1"
                                    max="99"
                                    value={field.sequence ?? ""}
                                    onChange={(e) => {
                                      const next = [...activeForm.fields];
                                      next[idx] = { ...field, sequence: e.target.value === "" ? "" : Number(e.target.value) };
                                      setActiveForm({ ...activeForm, fields: next });
                                    }}
                                    onBlur={() => {
                                      const next = [...activeForm.fields];
                                      next.sort((a, b) => {
                                        const seqA = a.sequence === "" || a.sequence === undefined ? 99 : Number(a.sequence);
                                        const seqB = b.sequence === "" || b.sequence === undefined ? 99 : Number(b.sequence);
                                        return seqA - seqB;
                                      });
                                      setActiveForm({ ...activeForm, fields: next });
                                    }}
                                    placeholder="--"
                                  />
                                </td>
                                <td>
                                  <input
                                    className="form-control form-control-sm"
                                    value={field.label}
                                    onChange={(e) => {
                                      const next = [...activeForm.fields];
                                      next[idx] = {
                                        ...field,
                                        label: e.target.value,
                                        fieldName: normalizeFieldName(e.target.value)
                                      };
                                      setActiveForm({ ...activeForm, fields: next });
                                    }}
                                    placeholder="Field label"
                                  />
                                </td>
                                <td>
                                  <select
                                    className="form-select form-select-sm"
                                    value={field.fieldType}
                                    onChange={(e) => {
                                      const next = [...activeForm.fields];
                                      next[idx] = { ...field, fieldType: e.target.value };
                                      setActiveForm({ ...activeForm, fields: next });
                                    }}
                                  >
                                    {ENQUIRY_FIELD_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                                  </select>
                                </td>
                                <td>
                                  {defaultOptions ? (
                                    <select
                                      className="form-select form-select-sm"
                                      value={field.defaultValue || ""}
                                      onChange={(e) => {
                                        const next = [...activeForm.fields];
                                        next[idx] = { ...field, defaultValue: e.target.value };
                                        setActiveForm({ ...activeForm, fields: next });
                                      }}
                                    >
                                      <option value="">None</option>
                                      {defaultOptions.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      className="form-control form-control-sm"
                                      value={field.defaultValue || ""}
                                      onChange={(e) => {
                                        const next = [...activeForm.fields];
                                        next[idx] = { ...field, defaultValue: e.target.value };
                                        setActiveForm({ ...activeForm, fields: next });
                                      }}
                                      placeholder="No default"
                                    />
                                  )}
                                </td>
                                <td>
                                  <select
                                    className="form-select form-select-sm"
                                    value={field.column ?? activeForm.columns ?? 1}
                                    onChange={(e) => {
                                      const next = [...activeForm.fields];
                                      next[idx] = { ...field, column: Number(e.target.value) };
                                      setActiveForm({ ...activeForm, fields: next });
                                    }}
                                  >
                                    {[1, 2, 3].map((val) => {
                                      let label = `${val} per row`;
                                      if (val === 1) label = "Full Width (1)";
                                      else if (val === 2) label = "Half Width (2)";
                                      else if (val === 3) label = "1/3 Width (3)";
                                      return (
                                        <option key={val} value={val}>{label}</option>
                                      );
                                    })}
                                  </select>
                                </td>
                                <td className="text-center">
                                  <input
                                    type="checkbox"
                                    className="form-check-input"
                                    checked={Boolean(field.hidden)}
                                    onChange={(e) => {
                                      const next = [...activeForm.fields];
                                      next[idx] = { ...field, hidden: e.target.checked };
                                      setActiveForm({ ...activeForm, fields: next });
                                    }}
                                  />
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
                                  <div className="d-flex justify-content-end gap-1">
                                    <button
                                      className="btn btn-sm btn-outline-secondary py-1 px-2"
                                      onClick={() => openFieldEditor(field, idx)}
                                      title="Edit field"
                                    >
                                      <i className="bi bi-pencil"></i>
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline-danger py-1 px-2"
                                      onClick={() => {
                                        const next = activeForm.fields.filter((_, i) => i !== idx);
                                        setActiveForm({ ...activeForm, fields: next });
                                      }}
                                      title="Delete field"
                                    >
                                      <i className="bi bi-trash"></i>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="d-flex gap-2 justify-content-end border-top pt-3 mt-4">
                  <button className="btn btn-outline-secondary px-4" onClick={closeEditor}>Cancel</button>
                  <button
                    className="btn btn-primary px-4 d-flex align-items-center gap-1"
                    type="button"
                    onClick={() => {
                      if (!activeForm.name.trim()) {
                        toast("Form name is required", "error");
                        return;
                      }
                      setEditorStep(2);
                    }}
                  >
                    Next <i className="bi bi-arrow-right"></i>
                  </button>
                </div>
              </div>
            ) : (
              /* ==================== STEP 2: STYLE & LIVE PREVIEW ==================== */
              <div className="d-flex flex-column gap-4">
                <div className="row g-4">
                  {/* Left Half: Layout Settings & styling controls (col-lg-6) */}
                  <div className="col-lg-6" style={{ maxHeight: "650px", overflowY: "auto", paddingRight: "10px" }}>
                    <div className="d-flex flex-column gap-3">
                      
                      {/* Sub-Card Section: Layout & Theme Settings */}
                      <div className="card border-0 bg-light p-3 shadow-none" style={{ borderRadius: "12px" }}>
                        <h6 className="fw-bold mb-3 text-primary d-flex align-items-center gap-2">
                          <i className="bi bi-sliders"></i> Layout & Theme Settings
                        </h6>
                        <div className="row g-2">
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Global Font Style</label>
                            <select className="form-select form-select-sm" value={activeForm.fontFamily || "Default"} onChange={(e) => setActiveForm({ ...activeForm, fontFamily: e.target.value })}>
                              <option value="Default">System default</option>
                              <option value="Inter">Inter (Modern & Clean)</option>
                              <option value="Outfit">Outfit (Geometric & Premium)</option>
                              <option value="Montserrat">Montserrat (Classic Geometric)</option>
                              <option value="Playfair Display">Playfair Display (Elegant Serif)</option>
                              <option value="Lora">Lora (Traditional Serif)</option>
                              <option value="Fira Code">Fira Code (Technical Monospace)</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Form Card Shadow</label>
                            <select className="form-select form-select-sm" value={activeForm.cardShadow || "medium"} onChange={(e) => setActiveForm({ ...activeForm, cardShadow: e.target.value })}>
                              <option value="none">None</option>
                              <option value="small">Small</option>
                              <option value="medium">Medium</option>
                              <option value="large">Large</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Card Border Radius</label>
                            <input
                              className="form-control form-control-sm"
                              value={activeForm.cardBorderRadius || ""}
                              onChange={(e) => setActiveForm({ ...activeForm, cardBorderRadius: e.target.value })}
                              placeholder="e.g. 12px"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Field Border Radius</label>
                            <input
                              className="form-control form-control-sm"
                              value={activeForm.fieldBorderRadius || ""}
                              onChange={(e) => setActiveForm({ ...activeForm, fieldBorderRadius: e.target.value })}
                              placeholder="e.g. 6px"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Field Label Font Size</label>
                            <input
                              className="form-control form-control-sm"
                              value={activeForm.fieldLabelFontSize || ""}
                              onChange={(e) => setActiveForm({ ...activeForm, fieldLabelFontSize: e.target.value })}
                              placeholder="e.g. 14px"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Field Input Font Size</label>
                            <input
                              className="form-control form-control-sm"
                              value={activeForm.fieldInputFontSize || ""}
                              onChange={(e) => setActiveForm({ ...activeForm, fieldInputFontSize: e.target.value })}
                              placeholder="e.g. 14px"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Card Background</label>
                            <div className="d-flex gap-2 align-items-center">
                              <input
                                type="color"
                                className="form-control form-control-color"
                                style={{ height: "30px", width: "50px", padding: "2px", borderRadius: "6px" }}
                                value={activeForm.cardBgColor || "#ffffff"}
                                onChange={(e) => setActiveForm({ ...activeForm, cardBgColor: e.target.value })}
                              />
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                style={{ fontSize: "0.85rem" }}
                                value={activeForm.cardBgColor || "#ffffff"}
                                onChange={(e) => setActiveForm({ ...activeForm, cardBgColor: e.target.value })}
                                placeholder="#ffffff"
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Align</label>
                            <select className="form-select form-select-sm" value={activeForm.align || "left"} onChange={(e) => setActiveForm({ ...activeForm, align: e.target.value })}>
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Width</label>
                            <div className="input-group input-group-sm">
                              <input className="form-control" value={activeForm.width || ""} onChange={(e) => setActiveForm({ ...activeForm, width: e.target.value })} placeholder="e.g. 600px" />
                              <button className="btn btn-outline-secondary" type="button" onClick={() => setActiveForm({ ...activeForm, width: "auto" })}>Auto</button>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Height</label>
                            <div className="input-group input-group-sm">
                              <input className="form-control" value={activeForm.height || ""} onChange={(e) => setActiveForm({ ...activeForm, height: e.target.value })} placeholder="e.g. Auto" />
                              <button className="btn btn-outline-secondary" type="button" onClick={() => setActiveForm({ ...activeForm, height: "auto" })}>Auto</button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sub-Card Section: Heading Styling */}
                      <div className="card border-0 bg-light p-3 shadow-none" style={{ borderRadius: "12px" }}>
                        <h6 className="fw-bold mb-3 text-secondary d-flex align-items-center gap-2">
                          <i className="bi bi-type-h1"></i> Heading Styling
                        </h6>
                        <div className="row g-2">
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Heading Size</label>
                            <input
                              className="form-control form-control-sm"
                              value={activeForm.headingFontSize || ""}
                              onChange={(e) => setActiveForm({ ...activeForm, headingFontSize: e.target.value })}
                              placeholder="e.g. 24px"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Heading Align</label>
                            <select className="form-select form-select-sm" value={activeForm.headingAlign || "left"} onChange={(e) => setActiveForm({ ...activeForm, headingAlign: e.target.value })}>
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Heading Font Family</label>
                            <select className="form-select form-select-sm" value={activeForm.headingFontFamily || "Default"} onChange={(e) => setActiveForm({ ...activeForm, headingFontFamily: e.target.value })}>
                              <option value="Default">Inherit global font</option>
                              <option value="Inter">Inter</option>
                              <option value="Outfit">Outfit</option>
                              <option value="Montserrat">Montserrat</option>
                              <option value="Playfair Display">Playfair Display</option>
                              <option value="Lora">Lora</option>
                              <option value="Fira Code">Fira Code</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Heading Color</label>
                            <div className="d-flex gap-2 align-items-center">
                              <input
                                type="color"
                                className="form-control form-control-color"
                                style={{ height: "30px", width: "50px", padding: "2px", borderRadius: "6px" }}
                                value={activeForm.headingColor || "#111827"}
                                onChange={(e) => setActiveForm({ ...activeForm, headingColor: e.target.value })}
                              />
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                style={{ fontSize: "0.85rem" }}
                                value={activeForm.headingColor || "#111827"}
                                onChange={(e) => setActiveForm({ ...activeForm, headingColor: e.target.value })}
                                placeholder="#111827"
                              />
                            </div>
                          </div>
                          <div className="col-12 d-flex align-items-center gap-3 mt-2">
                            <div className="form-check form-check-inline mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="headingBold"
                                checked={Boolean(activeForm.headingBold)}
                                onChange={(e) => setActiveForm({ ...activeForm, headingBold: e.target.checked })}
                              />
                              <label className="form-check-label small fw-semibold" htmlFor="headingBold">Bold</label>
                            </div>
                            <div className="form-check form-check-inline mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="headingItalic"
                                checked={Boolean(activeForm.headingItalic)}
                                onChange={(e) => setActiveForm({ ...activeForm, headingItalic: e.target.checked })}
                              />
                              <label className="form-check-label small fw-semibold" htmlFor="headingItalic">Italic</label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sub-Card Section: Tagline Styling */}
                      <div className="card border-0 bg-light p-3 shadow-none" style={{ borderRadius: "12px" }}>
                        <h6 className="fw-bold mb-3 text-secondary d-flex align-items-center gap-2">
                          <i className="bi bi-justify-left"></i> Tagline Styling
                        </h6>
                        <div className="row g-2">
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Tagline Size</label>
                            <input
                              className="form-control form-control-sm"
                              value={activeForm.taglineFontSize || ""}
                              onChange={(e) => setActiveForm({ ...activeForm, taglineFontSize: e.target.value })}
                              placeholder="e.g. 16px"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Tagline Align</label>
                            <select className="form-select form-select-sm" value={activeForm.taglineAlign || "left"} onChange={(e) => setActiveForm({ ...activeForm, taglineAlign: e.target.value })}>
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Tagline Font Family</label>
                            <select className="form-select form-select-sm" value={activeForm.taglineFontFamily || "Default"} onChange={(e) => setActiveForm({ ...activeForm, taglineFontFamily: e.target.value })}>
                              <option value="Default">Inherit global font</option>
                              <option value="Inter">Inter</option>
                              <option value="Outfit">Outfit</option>
                              <option value="Montserrat">Montserrat</option>
                              <option value="Playfair Display">Playfair Display</option>
                              <option value="Lora">Lora</option>
                              <option value="Fira Code">Fira Code</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Tagline Color</label>
                            <div className="d-flex gap-2 align-items-center">
                              <input
                                type="color"
                                className="form-control form-control-color"
                                style={{ height: "30px", width: "50px", padding: "2px", borderRadius: "6px" }}
                                value={activeForm.taglineColor || "#4b5563"}
                                onChange={(e) => setActiveForm({ ...activeForm, taglineColor: e.target.value })}
                              />
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                style={{ fontSize: "0.85rem" }}
                                value={activeForm.taglineColor || "#4b5563"}
                                onChange={(e) => setActiveForm({ ...activeForm, taglineColor: e.target.value })}
                                placeholder="#4b5563"
                              />
                            </div>
                          </div>
                          <div className="col-12 d-flex align-items-center gap-3 mt-2">
                            <div className="form-check form-check-inline mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="taglineBold"
                                checked={Boolean(activeForm.taglineBold)}
                                onChange={(e) => setActiveForm({ ...activeForm, taglineBold: e.target.checked })}
                              />
                              <label className="form-check-label small fw-semibold" htmlFor="taglineBold">Bold</label>
                            </div>
                            <div className="form-check form-check-inline mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="taglineItalic"
                                checked={Boolean(activeForm.taglineItalic)}
                                onChange={(e) => setActiveForm({ ...activeForm, taglineItalic: e.target.checked })}
                              />
                              <label className="form-check-label small fw-semibold" htmlFor="taglineItalic">Italic</label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sub-Card Section: Button Styling */}
                      <div className="card border-0 bg-light p-3 shadow-none" style={{ borderRadius: "12px" }}>
                        <h6 className="fw-bold mb-3 text-secondary d-flex align-items-center gap-2">
                          <i className="bi bi-menu-button-wide"></i> Button Styling
                        </h6>
                        <div className="row g-2">
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Submit Text</label>
                            <input
                              className="form-control form-control-sm"
                              value={activeForm.submitText || ""}
                              onChange={(e) => setActiveForm({ ...activeForm, submitText: e.target.value })}
                              placeholder="Submit Enquiry"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Button Size</label>
                            <input
                              className="form-control form-control-sm"
                              value={activeForm.buttonFontSize || ""}
                              onChange={(e) => setActiveForm({ ...activeForm, buttonFontSize: e.target.value })}
                              placeholder="16px"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Button Align</label>
                            <select className="form-select form-select-sm" value={activeForm.buttonAlign || "left"} onChange={(e) => setActiveForm({ ...activeForm, buttonAlign: e.target.value })}>
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                              <option value="full">Full Width</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Button Border Radius</label>
                            <input
                              className="form-control form-control-sm"
                              value={activeForm.buttonBorderRadius || ""}
                              onChange={(e) => setActiveForm({ ...activeForm, buttonBorderRadius: e.target.value })}
                              placeholder="e.g. 6px"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Button Fill Color</label>
                            <div className="d-flex gap-2 align-items-center">
                              <input
                                type="color"
                                className="form-control form-control-color"
                                style={{ height: "30px", width: "50px", padding: "2px", borderRadius: "6px" }}
                                value={activeForm.buttonColor || "#0d6efd"}
                                onChange={(e) => setActiveForm({ ...activeForm, buttonColor: e.target.value })}
                              />
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                style={{ fontSize: "0.85rem" }}
                                value={activeForm.buttonColor || "#0d6efd"}
                                onChange={(e) => setActiveForm({ ...activeForm, buttonColor: e.target.value })}
                                placeholder="#0d6efd"
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Button Text Color</label>
                            <div className="d-flex gap-2 align-items-center">
                              <input
                                type="color"
                                className="form-control form-control-color"
                                style={{ height: "30px", width: "50px", padding: "2px", borderRadius: "6px" }}
                                value={activeForm.buttonTextColor || "#ffffff"}
                                onChange={(e) => setActiveForm({ ...activeForm, buttonTextColor: e.target.value })}
                              />
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                style={{ fontSize: "0.85rem" }}
                                value={activeForm.buttonTextColor || "#ffffff"}
                                onChange={(e) => setActiveForm({ ...activeForm, buttonTextColor: e.target.value })}
                                placeholder="#ffffff"
                              />
                            </div>
                          </div>
                          <div className="col-12 d-flex align-items-center gap-3 mt-2">
                            <div className="form-check form-check-inline mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="buttonBold"
                                checked={Boolean(activeForm.buttonBold)}
                                onChange={(e) => setActiveForm({ ...activeForm, buttonBold: e.target.checked })}
                              />
                              <label className="form-check-label small fw-semibold" htmlFor="buttonBold">Bold</label>
                            </div>
                            <div className="form-check form-check-inline mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="buttonItalic"
                                checked={Boolean(activeForm.buttonItalic)}
                                onChange={(e) => setActiveForm({ ...activeForm, buttonItalic: e.target.checked })}
                              />
                              <label className="form-check-label small fw-semibold" htmlFor="buttonItalic">Italic</label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Sub-Card Section: Footer Styling */}
                      <div className="card border-0 bg-light p-3 shadow-none" style={{ borderRadius: "12px" }}>
                        <h6 className="fw-bold mb-3 text-secondary d-flex align-items-center gap-2">
                          <i className="bi bi-paragraph"></i> Footer Styling
                        </h6>
                        <div className="row g-2">
                          <div className="col-12">
                            <label className="form-label small fw-semibold text-muted mb-1">Footer Text</label>
                            <input
                              className="form-control form-control-sm"
                              value={activeForm.footerText || ""}
                              onChange={(e) => setActiveForm({ ...activeForm, footerText: e.target.value })}
                              placeholder="Optional footer text"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Footer Size</label>
                            <input
                              className="form-control form-control-sm"
                              value={activeForm.footerFontSize || ""}
                              onChange={(e) => setActiveForm({ ...activeForm, footerFontSize: e.target.value })}
                              placeholder="e.g. 13px"
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Footer Align</label>
                            <select className="form-select form-select-sm" value={activeForm.footerAlign || "left"} onChange={(e) => setActiveForm({ ...activeForm, footerAlign: e.target.value })}>
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Footer Font Family</label>
                            <select className="form-select form-select-sm" value={activeForm.footerFontFamily || "Default"} onChange={(e) => setActiveForm({ ...activeForm, footerFontFamily: e.target.value })}>
                              <option value="Default">Inherit global font</option>
                              <option value="Inter">Inter</option>
                              <option value="Outfit">Outfit</option>
                              <option value="Montserrat">Montserrat</option>
                              <option value="Playfair Display">Playfair Display</option>
                              <option value="Lora">Lora</option>
                              <option value="Fira Code">Fira Code</option>
                            </select>
                          </div>
                          <div className="col-md-6">
                            <label className="form-label small fw-semibold text-muted mb-1">Footer Color</label>
                            <div className="d-flex gap-2 align-items-center">
                              <input
                                type="color"
                                className="form-control form-control-color"
                                style={{ height: "30px", width: "50px", padding: "2px", borderRadius: "6px" }}
                                value={activeForm.footerColor || "#6b7280"}
                                onChange={(e) => setActiveForm({ ...activeForm, footerColor: e.target.value })}
                              />
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                style={{ fontSize: "0.85rem" }}
                                value={activeForm.footerColor || "#6b7280"}
                                onChange={(e) => setActiveForm({ ...activeForm, footerColor: e.target.value })}
                                placeholder="#6b7280"
                              />
                            </div>
                          </div>
                          <div className="col-12 d-flex align-items-center gap-3 mt-2">
                            <div className="form-check form-check-inline mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="footerBold"
                                checked={Boolean(activeForm.footerBold)}
                                onChange={(e) => setActiveForm({ ...activeForm, footerBold: e.target.checked })}
                              />
                              <label className="form-check-label small fw-semibold" htmlFor="footerBold">Bold</label>
                            </div>
                            <div className="form-check form-check-inline mb-0">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="footerItalic"
                                checked={Boolean(activeForm.footerItalic)}
                                onChange={(e) => setActiveForm({ ...activeForm, footerItalic: e.target.checked })}
                              />
                              <label className="form-check-label small fw-semibold" htmlFor="footerItalic">Italic</label>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Right Half: Live Form Preview (col-lg-6) */}
                  <div className="col-lg-6 border-start ps-4">
                    <div className="d-flex flex-column h-100">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <span className="fw-bold text-dark" style={{ fontSize: "1.05rem" }}>
                          <i className="bi bi-eye text-primary me-1"></i> Interactive Live Preview
                        </span>
                        <small className="text-muted">Simulates styles in real-time</small>
                      </div>
                      
                      <div className="p-3 bg-light border rounded-3 flex-grow-1 d-flex align-items-start justify-content-center shadow-inner" style={{ minHeight: "450px", overflowY: "auto" }}>
                        <LiveFormPreview form={activeForm} getDefaultOptions={getDefaultOptions} />
                      </div>
                    </div>
                  </div>
                </div>

                {activeForm._id && (
                  <div className="alert alert-light border small mb-0 py-2 px-3">
                    <div className="fw-semibold text-muted mb-1">Public Share Link</div>
                    <div className="d-flex align-items-center gap-2 justify-content-between">
                      <a href={getShareUrl(activeForm._id)} target="_blank" rel="noreferrer" className="text-break text-decoration-none">
                        {getShareUrl(activeForm._id)}
                      </a>
                      <button
                        className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(getShareUrl(activeForm._id));
                          toast("Share link copied to clipboard!", "success");
                        }}
                      >
                        <i className="bi bi-clipboard"></i> Copy
                      </button>
                    </div>
                  </div>
                )}
                <div className="d-flex gap-2 justify-content-between border-top pt-3 mt-4 col-12">
                  <button className="btn btn-outline-secondary px-4 d-flex align-items-center gap-1" type="button" onClick={() => setEditorStep(1)}>
                    <i className="bi bi-arrow-left"></i> Back to Fields
                  </button>
                  <div className="d-flex gap-2">
                    <button className="btn btn-outline-secondary px-4" onClick={closeEditor}>Cancel</button>
                    <button className="btn btn-success px-4" onClick={saveForm}>Save</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
            </div>
            <button className="btn btn-wa" onClick={createNewForm}><i className="bi bi-plus-lg me-1"></i>Create Enquiry Form</button>
          </div>

          {forms.length === 0 ? (
            <EmptyState title="No enquiry forms yet" subtitle="Create a form to start using it in your campaigns." />
          ) : (
            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead>
                  <tr>
                                    <th>Name</th>
                    <th>Status</th>
                    <th>Selected fields</th>
                    <th>Updated</th>
                    <th>Link</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((form) => (
                    <tr key={form._id}>
                      <td>{form.name}</td>
                      <td>
                        <span className="badge" style={{ background: form.isActive ? "#e6f4ea" : "#f3f2f1", color: form.isActive ? "#10714a" : "#6b6b6b" }}>
                          {form.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{(form.fields || []).filter((field) => field.selected).length}</td>
                      <td>{formatDateDMY(form.updatedAt)}</td>
                      <td>
                        <div className="small text-break mb-1">
                          <a href={getShareUrl(form._id)} target="_blank" rel="noreferrer">{getShareUrl(form._id)}</a>
                        </div>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          type="button"
                          title="Copy share link"
                          onClick={() => navigator.clipboard.writeText(getShareUrl(form._id))}
                        >
                          <i className="bi bi-clipboard"></i>
                        </button>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-1">
                          <IconBtn icon="eye" title="Preview form" onClick={() => openPreview(form)} />
                          <IconBtn icon="pencil" title="Edit form" onClick={() => editForm(form)} />
                          <IconBtn icon="trash" title="Delete form" danger onClick={() => deleteForm(form._id)} />
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
        <Modal size="lg" title={`Preview: ${previewForm.name || "Enquiry Form"}`} onClose={closePreview} footer={<button className="btn btn-outline-secondary" onClick={closePreview}>Close</button>}>
          <div className="mb-2">
          </div>
          <iframe
            src={getShareUrl(previewForm._id)}
            title={`Preview ${previewForm.name}`}
            style={{ width: "100%", minHeight: "560px", border: "1px solid #e5e7eb", borderRadius: 8 }}
          />
        </Modal>
      )}

      {fieldEditor && (
        <Modal
          title={fieldEditor._idx !== undefined && fieldEditor._idx !== null ? "Edit Field" : "Add Field"}
          onClose={closeFieldEditor}
          footer={
            <>
              <button className="btn btn-outline-secondary" onClick={closeFieldEditor}>Cancel</button>
              <button className="btn btn-wa" onClick={saveFieldEditor}>Save Field</button>
            </>
          }
        >
          <div className="mb-2">
            <label className="form-label">Field Label</label>
            <input
              className="form-control"
              value={fieldEditor.label}
              onChange={(e) => setFieldEditor({ ...fieldEditor, label: e.target.value, error: "" })}
              placeholder="e.g. Student Name"
            />
          </div>

          <div className="mb-2">
            <label className="form-label">Field Type</label>
            <select
              className="form-select"
              value={fieldEditor.fieldType}
              onChange={(e) => setFieldEditor({ ...fieldEditor, fieldType: e.target.value, error: "" })}
            >
              {ENQUIRY_FIELD_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {fieldEditor.fieldType === "select" && (
            <div className="mb-2">
              <label className="form-label">Dropdown Options</label>
              <textarea
                className="form-control"
                rows={4}
                value={fieldEditor.optionsText || ""}
                onChange={(e) => setFieldEditor({ ...fieldEditor, optionsText: e.target.value })}
                placeholder="Option 1, Option 2, Option 3"
              />
              <small className="text-muted">Enter values separated by commas for the dropdown menu.</small>
            </div>
          )}

          <div className="mb-2">
            <label className="form-label">Default Value</label>
            <input
              className="form-control"
              value={fieldEditor.defaultValue || ""}
              onChange={(e) => setFieldEditor({ ...fieldEditor, defaultValue: e.target.value })}
              placeholder="Optional default value"
            />
          </div>

          <div className="row gx-2 gy-2 mb-2">
            <div className="col-md-6">
              <label className="form-label">Column (optional)</label>
              <select className="form-select" value={fieldEditor.column ?? ""} onChange={(e) => setFieldEditor({ ...fieldEditor, column: e.target.value === "" ? null : Number(e.target.value) })}>
                <option value="">Auto</option>
                {Array.from({ length: fieldEditor.maxColumns || 2 }).map((_, i) => (
                  <option key={i} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <small className="text-muted">Choose a column to pin this field to that column (optional).</small>
            </div>
            <div className="col-md-6">
              <label className="form-label">Field text color</label>
              <input
                type="color"
                className="form-control form-control-color"
                value={fieldEditor.textColor || "#000000"}
                onChange={(e) => setFieldEditor({ ...fieldEditor, textColor: e.target.value })}
              />
            </div>
          </div>

          <div className="form-check mb-2">
            <input
              type="checkbox"
              className="form-check-input"
              id="fieldRequired"
              checked={fieldEditor.isRequired}
              onChange={(e) => setFieldEditor({ ...fieldEditor, isRequired: e.target.checked })}
            />
            <label className="form-check-label" htmlFor="fieldRequired">
              Required
            </label>
          </div>

          {fieldEditor.error && (
            <div className="alert alert-danger py-2" role="alert">
              {fieldEditor.error}
            </div>
          )}

          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="fieldSelected"
              checked={fieldEditor.selected}
              onChange={(e) => setFieldEditor({ ...fieldEditor, selected: e.target.checked })}
            />
            <label className="form-check-label" htmlFor="fieldSelected">Include field in form</label>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ==================== LIVE PREVIEW COMPONENT ==================== */
const getShadowStyle = (shadow) => {
  if (shadow === "none") return "none";
  if (shadow === "small") return "0 2px 4px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.05)";
  if (shadow === "large") return "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)";
  return "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)"; // default medium
};

const getFontFamilyStyle = (font) => {
  if (!font || font === "Default") return "inherit";
  if (font === "Playfair Display" || font === "Lora") return `'${font}', serif`;
  if (font === "Fira Code") return `'${font}', monospace`;
  return `'${font}', sans-serif`;
};

function LiveFormPreview({ form, getDefaultOptions }) {
  const [previewValues, setPreviewValues] = useState({});

  useEffect(() => {
    const linkId = "google-fonts-preview";
    let link = document.getElementById(linkId);
    if (!link) {
      link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Fira+Code:wght@400;500&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  if (!form) return null;
  const visibleFields = (form.fields || []).filter((f) => f.selected && !f.hidden);

  // Layout parameters
  const width = form.width || "100%";
  const height = form.height || "auto";

  // Heading style
  const headingStyle = {
    fontSize: form.headingFontSize || "24px",
    color: form.headingColor || "#111827",
    textAlign: form.headingAlign || "left",
    fontWeight: form.headingBold ? "bold" : "normal",
    fontStyle: form.headingItalic ? "italic" : "normal",
    fontFamily: getFontFamilyStyle(form.headingFontFamily || form.fontFamily),
    margin: 0
  };

  // Tagline style
  const taglineStyle = {
    fontSize: form.taglineFontSize || "16px",
    color: form.taglineColor || "#4b5563",
    textAlign: form.taglineAlign || "left",
    fontWeight: form.taglineBold ? "bold" : "normal",
    fontStyle: form.taglineItalic ? "italic" : "normal",
    fontFamily: getFontFamilyStyle(form.taglineFontFamily || form.fontFamily),
    margin: "8px 0 0 0"
  };

  // Button style
  const buttonStyle = {
    backgroundColor: form.buttonColor || "#0d6efd",
    color: form.buttonTextColor || "#ffffff",
    fontSize: form.buttonFontSize || "16px",
    fontWeight: form.buttonBold ? "bold" : "normal",
    fontStyle: form.buttonItalic ? "italic" : "normal",
    border: "none",
    padding: "0.45rem 1.2rem",
    borderRadius: form.buttonBorderRadius || "6px",
    width: form.buttonAlign === "full" ? "100%" : "auto"
  };

  const cardStyle = {
    maxWidth: width,
    height: height,
    borderRadius: form.cardBorderRadius || "12px",
    boxShadow: getShadowStyle(form.cardShadow),
    backgroundColor: form.cardBgColor || "#ffffff",
    fontFamily: getFontFamilyStyle(form.fontFamily)
  };

  const btnContainerClass = `mt-4 d-flex ${
    form.buttonAlign === "center"
      ? "justify-content-center"
      : form.buttonAlign === "right"
        ? "justify-content-end"
        : "justify-content-start"
  }`;

  const footerStyle = {
    fontSize: form.footerFontSize || "13px",
    color: form.footerColor || "#6b7280",
    textAlign: form.footerAlign || "left",
    fontFamily: getFontFamilyStyle(form.footerFontFamily || form.fontFamily),
    fontWeight: form.footerBold ? "bold" : "normal",
    fontStyle: form.footerItalic ? "italic" : "normal",
    marginTop: "1.5rem",
    borderTop: "1px solid #dee2e6",
    paddingTop: "0.5rem"
  };

  return (
    <div className="card border p-4 text-start w-100" style={cardStyle}>
      <h4 style={headingStyle}>{form.heading || "Form Title"}</h4>
      {form.tagline && <p style={taglineStyle}>{form.tagline}</p>}
      
      <div className="row g-3 mt-2">
        {visibleFields.map((field, fIdx) => {
          const defaultOptions = getDefaultOptions(field);
          
          // Determine bootstrap col span based on field.column
          const fieldCol = Number(field.column || form.columns || 1);

          let colClass = "col-12";
          if (fieldCol === 2) colClass = "col-md-6 col-12";
          else if (fieldCol === 3) colClass = "col-md-4 col-12";
          else colClass = "col-12";

          const key = field.fieldName || field.label || `field-${fIdx}`;
          const val = previewValues[key] ?? "";

          return (
            <div key={fIdx} className={colClass}>
              <div className="mb-2 text-start">
                <label className="form-label small fw-semibold mb-1" style={{ color: field.textColor, fontSize: form.fieldLabelFontSize || "14px" }}>
                  {field.label} {field.isRequired && <span className="text-danger">*</span>}
                </label>
                {field.fieldType === "textarea" ? (
                  <textarea
                    className="form-control form-control-sm"
                    rows="2"
                    placeholder={field.defaultValue || ""}
                    value={val}
                    onChange={(e) => setPreviewValues({ ...previewValues, [key]: e.target.value })}
                    style={{ borderRadius: form.fieldBorderRadius || "6px", fontSize: form.fieldInputFontSize || "14px" }}
                  />
                ) : field.fieldType === "select" ? (
                  <select
                    className="form-select form-select-sm"
                    value={val}
                    onChange={(e) => setPreviewValues({ ...previewValues, [key]: e.target.value })}
                    style={{ borderRadius: form.fieldBorderRadius || "6px", fontSize: form.fieldInputFontSize || "14px" }}
                  >
                    <option value="">{field.defaultValue || "Select Option"}</option>
                    {defaultOptions && defaultOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.fieldType || "text"}
                    className="form-control form-control-sm"
                    placeholder={field.defaultValue || ""}
                    value={val}
                    onChange={(e) => setPreviewValues({ ...previewValues, [key]: e.target.value })}
                    style={{ borderRadius: form.fieldBorderRadius || "6px", fontSize: form.fieldInputFontSize || "14px" }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={btnContainerClass}>
        <button style={buttonStyle} type="button">
          {form.submitText || "Submit"}
        </button>
      </div>

      {form.footerText && (
        <div style={footerStyle}>
          {form.footerText}
        </div>
      )}
    </div>
  );
}
