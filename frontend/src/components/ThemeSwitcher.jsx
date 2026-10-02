import React, { useState, useMemo } from "react";
import { useTheme, PRESETS, SHADOW_MAP, BUTTON_STYLES, MAX_CUSTOM_THEMES, buildVars } from "../context/ThemeContext";

const EMPTY_FORM = {
  name: "",
  accent: "#4f46e5",
  accentHover: "#4338ca",
  pageBg: "#f8fafc",
  border: "#e2e8f0",
  cardBg: "#ffffff",
  headingText: "#0f172a",
  textColor: "#475569",
  activeStyle: "light",
  radius: "12",
  shadowKey: "subtle",
  clickScale: "0.9",
  buttonStyle: "normal",
  font: "'Inter', sans-serif",
};

function ColorSwatchPair({ label, value, onChange }) {
  return (
    <div className="col-12 col-md-6 col-lg-4 mb-3" onClick={(e) => e.stopPropagation()}>
      <label className="form-label text-muted small uppercase fw-semibold mb-1" style={{ fontSize: "11px", letterSpacing: "0.04em" }}>
        {label}
      </label>
      <div className="input-group input-group-sm">
        <span className="input-group-text p-1 bg-white border-end-0">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 28, height: 28, border: "none", borderRadius: 4, cursor: "pointer", padding: 0 }}
          />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="form-control font-monospace border-start-0"
          style={{ fontSize: "12px", height: "36px" }}
        />
      </div>
    </div>
  );
}

export default function ThemeSwitcher() {
  const { themeId, setThemeId, customThemes, setCustomThemes, currentConfig } = useTheme();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const vars = useMemo(() => buildVars(currentConfig), [currentConfig]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setIsModalOpen(true);
  }

  function openEditPreset(presetKey) {
    const preset = PRESETS[presetKey];
    setEditingId(null);
    setForm({ ...preset, name: preset.name + " (Custom)" });
    setFormError("");
    setIsModalOpen(true);
  }

  function openEditCustom(id) {
    const found = customThemes.find((t) => t.id === id);
    if (!found) return;
    setEditingId(id);
    setForm({ ...found });
    setFormError("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  function deleteCustom(id) {
    if (window.confirm("Are you sure you want to delete this custom theme?")) {
      setCustomThemes((prev) => prev.filter((t) => t.id !== id));
      if (themeId === id) setThemeId("original");
    }
  }

  function saveForm() {
    const name = form.name.trim();
    if (!name) {
      setFormError("Please give your theme a name.");
      return;
    }
    const duplicate = customThemes.some(
      (t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== editingId
    );
    if (duplicate) {
      setFormError("A custom theme with this name already exists.");
      return;
    }

    if (editingId) {
      setCustomThemes((prev) =>
        prev.map((t) => (t.id === editingId ? { ...form, name, id: editingId } : t))
      );
      setThemeId(editingId);
    } else {
      if (customThemes.length >= MAX_CUSTOM_THEMES) {
        setFormError(`Limit reached: you can only save ${MAX_CUSTOM_THEMES} custom themes.`);
        return;
      }
      const newId = "custom_" + Date.now();
      const cfg = { ...form, name, id: newId };
      setCustomThemes((prev) => [...prev, cfg]);
      setThemeId(newId);
    }

    closeModal();
  }

  const slotsLeft = MAX_CUSTOM_THEMES - customThemes.length;
  const saveDisabled = !editingId && slotsLeft <= 0;

  return (
    <div className="card shadow-sm border" style={{ borderRadius: "16px", overflow: "hidden", background: "var(--surface)" }}>
      {/* Header */}
      <div className="card-header bg-white p-4 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-3">
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-grid place-items-center rounded-3 text-white shadow-sm"
            style={{ width: 44, height: 44, background: "var(--accent)" }}
          >
            <i className="bi bi-palette-fill fs-5"></i>
          </div>
          <div>
            <h5 className="mb-0 fw-bold" style={{ color: "var(--heading-text)" }}>UI Theme &amp; Appearance</h5>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <div className="px-3 py-1.5 rounded-pill border bg-light d-flex align-items-center gap-2" style={{ fontSize: "13px" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: currentConfig.accent }}></span>
            <span className="fw-semibold text-secondary">Active: {currentConfig.name}</span>
          </div>
        </div>
      </div>

      {/* Main Single Page Content */}
      <div className="card-body p-4">
        {/* Built-in Presets */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h6 className="fw-bold mb-0 text-secondary uppercase small" style={{ letterSpacing: "0.05em" }}>Built-in Presets</h6>
        </div>

        {/* Preset Cards Grid with clean 20px gap */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "32px" }}>
          {Object.entries(PRESETS).map(([key, preset]) => {
            const isActive = themeId === key;
            return (
              <div key={key}>
                <div
                  className={`card h-100 p-3.5 transition-all ${isActive ? "border-2 shadow" : "shadow-sm"}`}
                  style={{
                    borderColor: isActive ? preset.accent : "var(--border)",
                    background: "var(--surface)",
                    cursor: "default"
                  }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-bold" style={{ color: preset.headingText, fontSize: "14px" }}>{preset.name}</span>
                    {isActive ? (
                      <span className="badge text-white px-2 py-1" style={{ background: preset.accent, fontSize: "10px" }}>Active</span>
                    ) : (
                      <span className="badge bg-light text-secondary border" style={{ fontSize: "10px" }}>Preset</span>
                    )}
                  </div>

                  {/* Swatch Preview Bar */}
                  <div className="d-flex gap-1.5 my-2.5 p-2 rounded" style={{ background: preset.pageBg, border: `1px solid ${preset.border}` }}>
                    <div className="flex-grow-1 rounded" style={{ height: 26, background: preset.accent }} title="Accent" />
                    <div className="flex-grow-1 rounded" style={{ height: 26, background: preset.cardBg, border: `1px solid ${preset.border}` }} title="Card Bg" />
                    <div className="flex-grow-1 rounded" style={{ height: 26, background: preset.headingText }} title="Header Text" />
                  </div>

                  <div className="d-flex align-items-center justify-content-between mt-2 pt-2 border-top" style={{ fontSize: "11.5px", color: preset.textColor }}>
                    <span>Radius: {preset.radius}px</span>
                    <span>Font: {preset.font.includes("Inter") ? "Inter" : preset.font.includes("Georgia") ? "Georgia" : preset.font.includes("mono") ? "Monospace" : "System"}</span>
                  </div>

                  <div className="d-flex gap-2 mt-3 pt-1">
                    <button
                      type="button"
                      className="btn btn-sm flex-grow-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setThemeId(key);
                      }}
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 600,
                        background: isActive ? preset.accent : "transparent",
                        color: isActive ? "#ffffff" : preset.accent,
                        border: `1.5px solid ${preset.accent}`,
                        transition: "all 0.15s ease"
                      }}
                    >
                      {isActive ? "✓ Applied" : "Apply Theme"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm border"
                      title="Customize this preset"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditPreset(key);
                      }}
                      style={{ background: "var(--surface)", color: "var(--heading-text)" }}
                    >
                      <i className="bi bi-pencil"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom Themes Header */}
        <div className="d-flex align-items-center justify-content-between mb-3 pt-3 border-top">
          <div>
            <h6 className="fw-bold mb-0 text-secondary uppercase small" style={{ letterSpacing: "0.05em" }}>Your Custom Themes</h6>
            <div className="small text-muted">{customThemes.length} of {MAX_CUSTOM_THEMES} custom slots used</div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-wa d-flex align-items-center gap-1"
            disabled={slotsLeft <= 0}
            onClick={openCreateForm}
          >
            <i className="bi bi-plus-lg"></i> Create Custom Theme
          </button>
        </div>

        {/* Custom Saved Cards Grid */}
        {customThemes.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "24px" }}>
            {customThemes.map((custom) => {
              const isActive = themeId === custom.id;
              return (
                <div key={custom.id}>
                  <div
                    className={`card h-100 p-3.5 transition-all ${isActive ? "border-2 shadow" : "shadow-sm"}`}
                    style={{
                      borderColor: isActive ? custom.accent : "var(--border)",
                      background: "var(--surface)",
                      cursor: "default"
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-bold text-truncate" style={{ color: custom.headingText, fontSize: "14px", maxWidth: 130 }}>
                        {custom.name}
                      </span>
                      {isActive ? (
                        <span className="badge text-white px-2 py-1" style={{ background: custom.accent, fontSize: "10px" }}>Active</span>
                      ) : (
                        <span className="badge bg-light text-secondary border" style={{ fontSize: "10px" }}>Custom</span>
                      )}
                    </div>

                    <div className="d-flex gap-1.5 my-2.5 p-2 rounded" style={{ background: custom.pageBg, border: `1px solid ${custom.border}` }}>
                      <div className="flex-grow-1 rounded" style={{ height: 26, background: custom.accent }} title="Accent" />
                      <div className="flex-grow-1 rounded" style={{ height: 26, background: custom.cardBg, border: `1px solid ${custom.border}` }} title="Card Bg" />
                      <div className="flex-grow-1 rounded" style={{ height: 26, background: custom.headingText }} title="Header Text" />
                    </div>

                    <div className="d-flex gap-2 mt-3 pt-1">
                      <button
                        type="button"
                        className="btn btn-sm flex-grow-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setThemeId(custom.id);
                        }}
                        style={{
                          fontSize: "12.5px",
                          fontWeight: 600,
                          background: isActive ? custom.accent : "transparent",
                          color: isActive ? "#ffffff" : custom.accent,
                          border: `1.5px solid ${custom.accent}`,
                          transition: "all 0.15s ease"
                        }}
                      >
                        {isActive ? "✓ Applied" : "Apply"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-light border"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditCustom(custom.id);
                        }}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-light border text-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustom(custom.id);
                        }}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Overlay Dialog for Creating / Editing Custom Theme */}
      {isModalOpen && (
        <div 
          className="modal fade show d-block" 
          tabIndex="-1" 
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 1060 }}
          onClick={closeModal}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content p-4 shadow-lg border-0" style={{ borderRadius: "18px", background: "var(--surface)" }}>
              <div className="modal-header border-bottom pb-3 mb-3">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-sliders text-primary"></i>
                  {editingId ? "Edit Custom Theme" : "Create New Custom Theme"}
                </h5>
                <button type="button" className="btn-close" onClick={closeModal} />
              </div>

              <div className="modal-body p-0">
                {formError && <div className="alert alert-danger py-2 small mb-3">{formError}</div>}

                <div className="row g-3">
                  <div className="col-12 col-md-6 mb-2">
                    <label className="form-label fw-semibold small">Theme Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Emerald Dark"
                      value={form.name}
                      onChange={(e) => setField("name", e.target.value)}
                    />
                  </div>

                  <div className="col-12 col-md-6 mb-2">
                    <label className="form-label fw-semibold small">Font Family</label>
                    <select
                      className="form-select"
                      value={form.font}
                      onChange={(e) => setField("font", e.target.value)}
                    >
                      <option value="'Inter', sans-serif">Inter (Project Standard)</option>
                    </select>
                  </div>

                  <ColorSwatchPair label="Primary Accent Color" value={form.accent} onChange={(v) => setField("accent", v)} />
                  <ColorSwatchPair label="Hover Accent Color" value={form.accentHover} onChange={(v) => setField("accentHover", v)} />
                  <ColorSwatchPair label="Page Background" value={form.pageBg} onChange={(v) => setField("pageBg", v)} />
                  <ColorSwatchPair label="Card Surface" value={form.cardBg} onChange={(v) => setField("cardBg", v)} />
                  <ColorSwatchPair label="Heading Text" value={form.headingText} onChange={(v) => setField("headingText", v)} />
                  <ColorSwatchPair label="Body Text Color" value={form.textColor} onChange={(v) => setField("textColor", v)} />

                  <div className="col-12 col-md-6 mb-2">
                    <label className="form-label fw-semibold small">Corner Radius: {form.radius}px</label>
                    <input
                      type="range"
                      className="form-range"
                      min="0"
                      max="24"
                      step="2"
                      value={form.radius}
                      onChange={(e) => setField("radius", e.target.value)}
                    />
                  </div>

                  <div className="col-12 col-md-6 mb-2">
                    <label className="form-label fw-semibold small">Shadow Depth</label>
                    <select
                      className="form-select"
                      value={form.shadowKey}
                      onChange={(e) => setField("shadowKey", e.target.value)}
                    >
                      <option value="none">Flat (No Shadow)</option>
                      <option value="subtle">Subtle Elevation</option>
                      <option value="medium">Medium Shadow</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer border-top pt-3 mt-4 gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-wa btn-sm px-4"
                  disabled={saveDisabled}
                  onClick={saveForm}
                >
                  <i className="bi bi-check-lg me-1"></i> Save &amp; Apply Custom Theme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
