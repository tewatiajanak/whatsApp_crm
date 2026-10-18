import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FiArrowLeft,
  FiSave,
  FiDownload,
  FiTrash2,
  FiCopy,
} from "react-icons/fi";
import { useForm } from "../../context/FormContext";
import { useEventData } from "../../context/EventDataContext";
import {
  generateProfessionalFormDesign,
  generateModernFormDesign,
  generateMinimalFormDesign,
} from "../../utils/generateFormDesigns";

const DYNAMIC_FIELDS = [
  { key: "{{name}}", label: "Attendee Name" },
  { key: "{{email}}", label: "Email" },
  { key: "{{phone}}", label: "Phone" },
  { key: "{{category}}", label: "Category" },
];

const FONTS = [
  "Inter, sans-serif",
  "Arial, sans-serif",
  "Georgia, serif",
  "Courier New, monospace",
  "Verdana, sans-serif",
];

const CANVAS_PRESETS = [
  { label: "Badge (400×600)", w: 400, h: 600 },
  { label: "Card (350×200)", w: 350, h: 200 },
  { label: "Ticket (600×250)", w: 600, h: 250 },
  { label: "A5 (420×595)", w: 420, h: 595 },
];

const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_ELEMENT = {
  text: {
    w: 200,
    h: 36,
    label: "Text",
    icon: "bi-type-h1",
    content: "Text Here",
    fontSize: 16,
    fontWeight: "400",
    fontFamily: "Inter, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    color: "var(--foreground)",
    textAlign: "left",
    lineHeight: 1.4,
    bg: "transparent",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    paddingX: 0,
    paddingY: 0,
    opacity: 1,
  },
  header: {
    w: 400,
    h: 72,
    label: "Header",
    icon: "bi-layout-text-window",
    content: "Event Header",
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 1.3,
    bg: "#7c3aed",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
    borderStyle: "solid",
    paddingX: 16,
    paddingY: 16,
    opacity: 1,
  },
  footer: {
    w: 400,
    h: 48,
    label: "Footer",
    icon: "bi-layout-text-sidebar-reverse",
    content: "Event Footer",
    fontSize: 12,
    fontWeight: "400",
    fontFamily: "Inter, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    color: "var(--muted-foreground)",
    textAlign: "center",
    lineHeight: 1.4,
    bg: "#f8fafc",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
    borderStyle: "solid",
    paddingX: 8,
    paddingY: 8,
    opacity: 1,
  },
  qr: {
    w: 100,
    h: 100,
    label: "QR Code",
    icon: "bi-qr-code",
    content: "{{passId}}",
    fontSize: 10,
    fontWeight: "400",
    fontFamily: "Inter, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    color: "#000000",
    textAlign: "center",
    lineHeight: 1,
    bg: "#ffffff",
    borderRadius: 4,
    borderWidth: 0,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    paddingX: 4,
    paddingY: 4,
    opacity: 1,
  },
  image: {
    w: 140,
    h: 140,
    label: "Image",
    icon: "bi-image",
    content: "",
    imageUrl: "",
    objectFit: "cover",
    fontSize: 12,
    fontWeight: "400",
    fontFamily: "Inter, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    color: "var(--muted-foreground)",
    textAlign: "center",
    lineHeight: 1,
    bg: "#f1f5f9",
    borderRadius: 8,
    borderWidth: 0,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    paddingX: 0,
    paddingY: 0,
    opacity: 1,
  },
  logo: {
    w: 80,
    h: 80,
    label: "Logo",
    icon: "bi-patch-check",
    content: "",
    imageUrl: "",
    objectFit: "contain",
    fontSize: 12,
    fontWeight: "400",
    fontFamily: "Inter, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    color: "var(--muted-foreground)",
    textAlign: "center",
    lineHeight: 1,
    bg: "transparent",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
    borderStyle: "solid",
    paddingX: 0,
    paddingY: 0,
    opacity: 1,
  },
  card: {
    w: 340,
    h: 80,
    label: "Card",
    icon: "bi-card-text",
    content: "",
    fontSize: 13,
    fontWeight: "400",
    fontFamily: "Inter, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    color: "var(--foreground)",
    textAlign: "left",
    lineHeight: 1.4,
    bg: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    paddingX: 12,
    paddingY: 12,
    opacity: 1,
  },
  divider: {
    w: 360,
    h: 2,
    label: "Divider",
    icon: "bi-dash-lg",
    content: "",
    fontSize: 0,
    fontWeight: "400",
    fontFamily: "Inter, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    color: "transparent",
    textAlign: "left",
    lineHeight: 1,
    bg: "#e2e8f0",
    borderRadius: 0,
    borderWidth: 0,
    borderColor: "transparent",
    borderStyle: "solid",
    paddingX: 0,
    paddingY: 0,
    opacity: 1,
  },
  "form-field": {
    w: 300,
    h: 45,
    label: "Form Field",
    icon: "bi-input-cursor-text",
    content: "Form Field",
    fieldId: "name",
    placeholder: "Enter field name",
    fontSize: 14,
    fontWeight: "400",
    fontFamily: "Inter, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    color: "var(--foreground)",
    textAlign: "left",
    lineHeight: 1.4,
    bg: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderStyle: "solid",
    paddingX: 12,
    paddingY: 10,
    opacity: 1,
  },
  "form-select": {
    w: 300,
    h: 45,
    label: "Select Field",
    icon: "bi-list-check",
    content: "Select an option",
    fieldId: "category",
    fontSize: 14,
    fontWeight: "400",
    fontFamily: "Inter, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    color: "var(--foreground)",
    textAlign: "left",
    lineHeight: 1.4,
    bg: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderStyle: "solid",
    paddingX: 12,
    paddingY: 10,
    opacity: 1,
  },
  "form-checkbox": {
    w: 20,
    h: 20,
    label: "Checkbox",
    icon: "bi-check-square",
    content: "",
    fieldId: "agreement",
    checked: false,
    fontSize: 14,
    fontWeight: "400",
    fontFamily: "Inter, sans-serif",
    bg: "#ffffff",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderStyle: "solid",
    opacity: 1,
  },
  "form-submit": {
    w: 300,
    h: 45,
    label: "Submit Button",
    icon: "bi-check-circle",
    content: "Submit",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter, sans-serif",
    fontStyle: "normal",
    textDecoration: "none",
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 1,
    bg: "#7c3aed",
    borderRadius: 6,
    borderWidth: 0,
    borderColor: "transparent",
    borderStyle: "solid",
    paddingX: 0,
    paddingY: 0,
    opacity: 1,
  },
};

const ELEMENT_BTNS = Object.entries(DEFAULT_ELEMENT).map(([type, def]) => ({
  type,
  ...def,
}));

const makeElement = (type, x = 40, y = 40) => ({
  id: uid(),
  type,
  x,
  y,
  w: DEFAULT_ELEMENT[type].w,
  h: DEFAULT_ELEMENT[type].h,
  zIndex: 1,
  locked: false,
  ...DEFAULT_ELEMENT[type],
});

const smallBtn = {
  height: 26,
  borderRadius: 6,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#475569",
  cursor: "pointer",
  fontSize: 11,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const PropRow = ({ label, children }) => (
  <div className="mb-2">
    <label
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--muted-foreground)",
        display: "block",
        marginBottom: 3,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {label}
    </label>
    {children}
  </div>
);

const NumInput = ({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  suffix,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        width: suffix ? 56 : 72,
        height: 28,
        borderRadius: 6,
        border: "1px solid #e2e8f0",
        fontSize: 12,
        padding: "0 6px",
        outline: "none",
      }}
    />
    {suffix && <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{suffix}</span>}
  </div>
);

const ColorInput = ({ value, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
    <input
      type="color"
      value={value === "transparent" ? "#ffffff" : value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: "1px solid #e2e8f0",
        cursor: "pointer",
        padding: 2,
      }}
    />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: 80,
        height: 28,
        borderRadius: 6,
        border: "1px solid #e2e8f0",
        fontSize: 11,
        padding: "0 6px",
        fontFamily: "monospace",
      }}
    />
    <button
      type="button"
      title="Transparent"
      onClick={() => onChange("transparent")}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: "1px solid #e2e8f0",
        background: "#fff",
        cursor: "pointer",
        fontSize: 11,
      }}
    >
      ✕
    </button>
  </div>
);

const SelectInput = ({ value, onChange, options }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    style={{
      width: "100%",
      height: 28,
      borderRadius: 6,
      border: "1px solid #e2e8f0",
      fontSize: 12,
      padding: "0 6px",
    }}
  >
    {options.map((o) => (
      <option key={o.value ?? o} value={o.value ?? o}>
        {o.label ?? o}
      </option>
    ))}
  </select>
);

const AccordionButton = ({ title, section, isOpen, onClick }) => (
  <button
    onClick={onClick}
    style={{
      width: "100%",
      padding: "8px 10px",
      background: isOpen ? "#f5f3ff" : "#f8fafc",
      border: "1px solid #e2e8f0",
      borderLeft: `3px solid ${isOpen ? "#a855f7" : "#e2e8f0"}`,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      fontSize: 11,
      fontWeight: 600,
      color: isOpen ? "#7c3aed" : "#64748b",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 6,
      marginBottom: 0,
    }}
  >
    {title}
    <i
      className={`bi ${isOpen ? "bi-chevron-down" : "bi-chevron-right"}`}
      style={{ fontSize: 10 }}
    />
  </button>
);

const PropertiesPanel = ({
  el,
  selectedElements,
  onChange,
  onDelete,
  onDuplicate,
  onBring,
  onSend,
  canvasState,
  alignElements,
  distributeHorizontally,
  distributeVertically,
  groupElements,
  ungroupElements,
  form,
  gap,
  setGap,
  openAccordion,
  setOpenAccordion,
}) => {
  const { events } = useEventData();

  if (!el)
    return (
      <div style={{ padding: 16 }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--muted-foreground)",
            textAlign: "center",
            marginTop: 40,
          }}
        >
          <i
            className="bi bi-cursor"
            style={{ fontSize: 28, display: "block", marginBottom: 8 }}
          />
          Click an element to edit its properties
        </div>
      </div>
    );

  const p = (key) => (val) => onChange({ ...el, [key]: val });
  const isText = ["text", "header", "footer", "card"].includes(el.type);
  const isMedia = ["image", "logo"].includes(el.type);

  // Get event data to access category labels
  const event = events.find(
    (e) => e.id === form?.eventId || e._id === form?.eventId,
  );
  const selectedCategories =
    event?.categories?.filter(
      (c) =>
        c.enabled !== false &&
        (form?.selectedCategories || []).includes(
          c.categoryId || c.id || c._id,
        ),
    ) || [];

  return (
    <div style={{ padding: "8px 10px", overflowY: "auto", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
          paddingBottom: 8,
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: "var(--foreground)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <i
            className={`bi ${DEFAULT_ELEMENT[el.type]?.icon}`}
            style={{ color: "#a855f7" }}
          />
          {el.label || el.type}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={onDuplicate}
            title="Duplicate"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid #f1f5f9",
              background: "#f1f5f9",
              color: "#475569",
              cursor: "pointer",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FiCopy size={12} />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "1px solid #fef2f2",
              background: "#fef2f2",
              color: "var(--destructive)",
              cursor: "pointer",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FiTrash2 size={12} />
          </button>
        </div>
      </div>

      {/* Multi-Select Controls */}
      {selectedElements && selectedElements.length > 1 && (
        <div
          style={{
            background: "#f0fdf4",
            borderRadius: 8,
            padding: 8,
            marginBottom: 6,
            border: "1px solid #bbf7d0",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#22c55e",
              marginBottom: 8,
            }}
          >
            {selectedElements.length} Elements Selected
          </div>

          {/* Group Controls */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              marginBottom: 6,
            }}
          >
            <button
              onClick={groupElements}
              style={{
                ...smallBtn,
                fontSize: 9,
                background: "#dcfce7",
                color: "var(--success)",
              }}
              title="Group Elements"
            >
              <i className="bi bi-diagram-3" /> Group
            </button>
            {selectedElements.length > 0 && selectedElements[0].groupId && (
              <button
                onClick={ungroupElements}
                style={{
                  ...smallBtn,
                  fontSize: 9,
                  background: "#dcfce7",
                  color: "var(--success)",
                }}
                title="Ungroup Elements"
              >
                <i className="bi bi-diagram-2" /> Ungroup
              </button>
            )}
          </div>

          {/* Alignment Controls */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              marginBottom: 6,
            }}
          >
            <button
              onClick={() => alignElements("left")}
              style={{ ...smallBtn, fontSize: 9 }}
              title="Align Left"
            >
              <i className="bi bi-align-start" /> Left
            </button>
            <button
              onClick={() => alignElements("centerX")}
              style={{ ...smallBtn, fontSize: 9 }}
              title="Align Center"
            >
              <i className="bi bi-distribute-horizontal" /> Center
            </button>
            <button
              onClick={() => alignElements("top")}
              style={{ ...smallBtn, fontSize: 9 }}
              title="Align Top"
            >
              <i className="bi bi-align-top" /> Top
            </button>
            <button
              onClick={() => alignElements("centerY")}
              style={{ ...smallBtn, fontSize: 9 }}
              title="Align Middle"
            >
              <i className="bi bi-distribute-vertical" /> Middle
            </button>
          </div>

          {/* Distribution Controls */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              marginBottom: 6,
            }}
          >
            <button
              onClick={() => distributeHorizontally()}
              style={{ ...smallBtn, fontSize: 9 }}
              title="Distribute Horizontally"
            >
              <i className="bi bi-columns-gap" /> Dist H
            </button>
            <button
              onClick={() => distributeVertically()}
              style={{ ...smallBtn, fontSize: 9 }}
              title="Distribute Vertically"
            >
              <i className="bi bi-rows-gap" /> Dist V
            </button>
          </div>

          {/* Gap Control */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 8px",
              background: "#dcfce7",
              borderRadius: 6,
            }}
          >
            <label
              style={{
                fontSize: 10,
                color: "var(--success)",
                fontWeight: 600,
                flex: 1,
              }}
            >
              Gap (px):
            </label>
            <input
              type="number"
              value={gap}
              onChange={(e) => setGap(Math.max(0, Number(e.target.value)))}
              min={0}
              max={100}
              style={{
                width: 40,
                height: 24,
                borderRadius: 4,
                border: "1px solid #86efac",
                padding: "0 4px",
                fontSize: 12,
                textAlign: "center",
              }}
            />
          </div>
        </div>
      )}

      {/* Lock */}
      <PropRow label="State">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={el?.locked}
            onChange={(e) => onChange({ ...el, locked: e.target.checked })}
          />
          Lock element
        </label>
      </PropRow>

      {/* Text Content - Show at top for text elements */}
      {isText && (
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 8,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Content
          </div>
          <PropRow label="">
            <textarea
              value={el.content}
              onChange={(e) => onChange({ ...el, content: e.target.value })}
              rows={3}
              style={{
                width: "100%",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 12,
                padding: "6px 8px",
                resize: "vertical",
              }}
            />
          </PropRow>
          <PropRow label="Insert Dynamic Field">
            <select
              onChange={(e) => {
                if (e.target.value)
                  onChange({
                    ...el,
                    content: (el.content || "") + e.target.value,
                  });
                e.target.value = "";
              }}
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 12,
                padding: "0 6px",
              }}
            >
              <option value="">— Insert field —</option>
              {DYNAMIC_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label} ({f.key})
                </option>
              ))}
            </select>
          </PropRow>
        </div>
      )}

      {/* Position & Size */}
      <AccordionButton
        title="Position & Size"
        section="position"
        isOpen={openAccordion === "position"}
        onClick={() =>
          setOpenAccordion(openAccordion === "position" ? null : "position")
        }
      />
      {openAccordion === "position" && (
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 0,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div>
              <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>X</span>
              <NumInput value={Math.round(el.x)} onChange={p("x")} />
            </div>
            <div>
              <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Y</span>
              <NumInput value={Math.round(el.y)} onChange={p("y")} />
            </div>
            <div>
              <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>W</span>
              <NumInput value={Math.round(el.w)} min={10} onChange={p("w")} />
            </div>
            <div>
              <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>H</span>
              <NumInput value={Math.round(el.h)} min={4} onChange={p("h")} />
            </div>
          </div>
        </div>
      )}

      {/* Alignment */}
      <AccordionButton
        title="Alignment"
        section="alignment"
        isOpen={openAccordion === "alignment"}
        onClick={() =>
          setOpenAccordion(openAccordion === "alignment" ? null : "alignment")
        }
      />
      {openAccordion === "alignment" && (
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 0,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 4,
              marginBottom: 8,
            }}
          >
            <button
              onClick={() => onChange({ ...el, x: 0 })}
              style={{ ...smallBtn, fontSize: 10 }}
              title="Align Left"
            >
              <i className="bi bi-align-start" />
            </button>
            <button
              onClick={() =>
                onChange({ ...el, x: (canvasState.width - el.w) / 2 })
              }
              style={{ ...smallBtn, fontSize: 10 }}
              title="Center X"
            >
              <i className="bi bi-distribute-horizontal" />
            </button>
            <button
              onClick={() => onChange({ ...el, x: canvasState.width - el.w })}
              style={{ ...smallBtn, fontSize: 10 }}
              title="Align Right"
            >
              <i className="bi bi-align-end" />
            </button>
            <button
              onClick={() => onChange({ ...el, y: 0 })}
              style={{ ...smallBtn, fontSize: 10 }}
              title="Align Top"
            >
              <i className="bi bi-align-top" />
            </button>
            <button
              onClick={() =>
                onChange({
                  ...el,
                  x: (canvasState.width - el.w) / 2,
                  y: (canvasState.height - el.h) / 2,
                })
              }
              style={{
                ...smallBtn,
                fontSize: 10,
                background: "#f5f3ff",
                color: "#7c3aed",
                border: "1px solid #e9d5ff",
              }}
              title="Center"
            >
              <i className="bi bi-bullseye" />
            </button>
            <button
              onClick={() => onChange({ ...el, y: canvasState.height - el.h })}
              style={{ ...smallBtn, fontSize: 10 }}
              title="Align Bottom"
            >
              <i className="bi bi-align-bottom" />
            </button>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}
          >
            <button
              onClick={() =>
                onChange({ ...el, y: (canvasState.height - el.h) / 2 })
              }
              style={{ ...smallBtn, fontSize: 10 }}
              title="Center Y"
            >
              <i className="bi bi-distribute-vertical" /> Center Y
            </button>
            <button
              onClick={() =>
                onChange({ ...el, x: (canvasState.width - el.w) / 2 })
              }
              style={{ ...smallBtn, fontSize: 10 }}
              title="Center X"
            >
              <i className="bi bi-distribute-horizontal" /> Center X
            </button>
          </div>
        </div>
      )}

      {/* Layer */}
      <div
        style={{
          background: "#f8fafc",
          borderRadius: 8,
          padding: 8,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--muted-foreground)",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Layer
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onBring} style={{ flex: 1, ...smallBtn }}>
            <i className="bi bi-layers-fill" style={{ marginRight: 4 }} />
            Bring Forward
          </button>
          <button onClick={onSend} style={{ flex: 1, ...smallBtn }}>
            <i className="bi bi-layers" style={{ marginRight: 4 }} />
            Send Back
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
            Z-Index: {el.zIndex}
          </span>
        </div>
      </div>

      {/* Appearance */}
      <div
        style={{
          background: "#f8fafc",
          borderRadius: 8,
          padding: 8,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--muted-foreground)",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Appearance
        </div>
        <PropRow label="Background">
          <ColorInput value={el.bg || "transparent"} onChange={p("bg")} />
        </PropRow>
        <PropRow label="Border Radius">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="range"
              min={0}
              max={60}
              value={el.borderRadius}
              onChange={(e) => p("borderRadius")(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <NumInput
              value={el.borderRadius}
              min={0}
              max={200}
              suffix="px"
              onChange={p("borderRadius")}
            />
          </div>
        </PropRow>
        <PropRow label="Border Width">
          <NumInput
            value={el.borderWidth}
            min={0}
            max={20}
            suffix="px"
            onChange={p("borderWidth")}
          />
        </PropRow>
        {el.borderWidth > 0 && (
          <>
            <PropRow label="Border Color">
              <ColorInput value={el.borderColor} onChange={p("borderColor")} />
            </PropRow>
            <PropRow label="Border Style">
              <SelectInput
                value={el.borderStyle}
                onChange={p("borderStyle")}
                options={["solid", "dashed", "dotted", "double"]}
              />
            </PropRow>
          </>
        )}
        <PropRow label="Opacity">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={el.opacity}
              onChange={(e) => p("opacity")(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 11, color: "var(--muted-foreground)", width: 32 }}>
              {Math.round(el.opacity * 100)}%
            </span>
          </div>
        </PropRow>
      </div>

      {/* Text - Typography Section */}
      {isText && (
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 8,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Typography
          </div>
          <PropRow label="Font Family">
            <SelectInput
              value={el.fontFamily}
              onChange={p("fontFamily")}
              options={FONTS}
            />
          </PropRow>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div>
              <PropRow label="Size">
                <NumInput
                  value={el.fontSize}
                  min={6}
                  max={120}
                  suffix="px"
                  onChange={p("fontSize")}
                />
              </PropRow>
            </div>
            <div>
              <PropRow label="Line Height">
                <NumInput
                  value={el.lineHeight}
                  min={0.8}
                  max={4}
                  step={0.1}
                  onChange={p("lineHeight")}
                />
              </PropRow>
            </div>
          </div>
          <PropRow label="Weight">
            <div style={{ display: "flex", gap: 4 }}>
              {[
                ["100", "Thin"],
                ["400", "Regular"],
                ["600", "Semi"],
                ["700", "Bold"],
                ["900", "Black"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => p("fontWeight")(v)}
                  style={{
                    flex: 1,
                    height: 26,
                    borderRadius: 5,
                    border: `1px solid ${el.fontWeight === v ? "#a855f7" : "#e2e8f0"}`,
                    background: el.fontWeight === v ? "#f5f3ff" : "#fff",
                    color: el.fontWeight === v ? "#7c3aed" : "#475569",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: v,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </PropRow>
          <PropRow label="Style">
            <div style={{ display: "flex", gap: 4 }}>
              {[
                ["normal", "N"],
                ["italic", "I"],
                ["oblique", "O"],
              ].map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => p("fontStyle")(v)}
                  style={{
                    width: 30,
                    height: 26,
                    borderRadius: 5,
                    border: `1px solid ${el.fontStyle === v ? "#a855f7" : "#e2e8f0"}`,
                    background: el.fontStyle === v ? "#f5f3ff" : "#fff",
                    color: el.fontStyle === v ? "#7c3aed" : "#475569",
                    cursor: "pointer",
                    fontSize: 12,
                    fontStyle: v,
                  }}
                >
                  {l}
                </button>
              ))}
              <button
                onClick={() =>
                  p("textDecoration")(
                    el.textDecoration === "underline" ? "none" : "underline",
                  )
                }
                style={{
                  width: 30,
                  height: 26,
                  borderRadius: 5,
                  border: `1px solid ${el.textDecoration === "underline" ? "#a855f7" : "#e2e8f0"}`,
                  background:
                    el.textDecoration === "underline" ? "#f5f3ff" : "#fff",
                  color:
                    el.textDecoration === "underline" ? "#7c3aed" : "#475569",
                  cursor: "pointer",
                  fontSize: 12,
                  textDecoration: "underline",
                }}
              >
                U
              </button>
            </div>
          </PropRow>
          <PropRow label="Alignment">
            <div style={{ display: "flex", gap: 4 }}>
              {[
                ["left", "bi-text-left"],
                ["center", "bi-text-center"],
                ["right", "bi-text-right"],
              ].map(([v, ic]) => (
                <button
                  key={v}
                  onClick={() => p("textAlign")(v)}
                  style={{
                    flex: 1,
                    height: 26,
                    borderRadius: 5,
                    border: `1px solid ${el.textAlign === v ? "#a855f7" : "#e2e8f0"}`,
                    background: el.textAlign === v ? "#f5f3ff" : "#fff",
                    color: el.textAlign === v ? "#7c3aed" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  <i className={`bi ${ic}`} />
                </button>
              ))}
            </div>
          </PropRow>
          <PropRow label="Text Color">
            <ColorInput value={el.color} onChange={p("color")} />
          </PropRow>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <PropRow label="Pad X">
              <NumInput
                value={el.paddingX}
                min={0}
                max={60}
                suffix="px"
                onChange={p("paddingX")}
              />
            </PropRow>
            <PropRow label="Pad Y">
              <NumInput
                value={el.paddingY}
                min={0}
                max={60}
                suffix="px"
                onChange={p("paddingY")}
              />
            </PropRow>
          </div>
        </div>
      )}

      {/* Image/Logo */}
      {isMedia && (
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 8,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Image
          </div>
          <PropRow label="Image Upload">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    onChange({ ...el, imageUrl: event.target?.result });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 11,
                padding: "0 4px",
              }}
            />
          </PropRow>
          <PropRow label="Image URL">
            <input
              type="text"
              value={el.imageUrl || ""}
              placeholder="https://... or paste image"
              onChange={(e) => onChange({ ...el, imageUrl: e.target.value })}
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 11,
                padding: "0 8px",
              }}
            />
          </PropRow>
          <PropRow label="Fit">
            <SelectInput
              value={el.objectFit}
              onChange={p("objectFit")}
              options={["cover", "contain", "fill", "none"]}
            />
          </PropRow>
        </div>
      )}

      {/* Form Field Properties */}
      {el.type === "form-field" && (
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 8,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Form Field Settings
          </div>
          <PropRow label="Map Field">
            <select
              value={el.fieldId || ""}
              onChange={(e) => {
                const field = form?.fields?.find(
                  (f) => f.fieldId === e.target.value,
                );
                onChange({
                  ...el,
                  fieldId: e.target.value,
                  placeholder: field?.label || "",
                  content: field?.label || "Form Field",
                });
              }}
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 12,
                padding: "0 6px",
              }}
            >
              <option value="">— Select a field —</option>
              {(() => {
                // Get all enabled fields
                const allFields = (form?.fields || []).filter(
                  (f) => f.enabled === true,
                );

                // Current selected field
                const currentField = allFields.find(
                  (f) => f.fieldId === el.fieldId,
                );

                // Fields used by selected elements
                const usedFieldIds = new Set(
                  selectedElements
                    ?.filter((e) => e.fieldId)
                    .map((e) => e.fieldId) || [],
                );

                // Group: Currently selected fields (for this element + others)
                const selectedFieldsList = allFields.filter(
                  (f) =>
                    usedFieldIds.has(f.fieldId) || f.fieldId === el.fieldId,
                );

                // Other fields
                const otherFields = allFields.filter(
                  (f) =>
                    !usedFieldIds.has(f.fieldId) && f.fieldId !== el.fieldId,
                );

                return (
                  <>
                    {/* Show selected fields first */}
                    {selectedFieldsList.map((field) => (
                      <option key={field.fieldId} value={field.fieldId}>
                        {field.label} ({field.fieldName || field.fieldId})
                      </option>
                    ))}
                    {/* Separator */}
                    {selectedFieldsList.length > 0 &&
                      otherFields.length > 0 && (
                        <option disabled>─────────────────</option>
                      )}
                    {/* Show other available fields */}
                    {otherFields.map((field) => (
                      <option key={field.fieldId} value={field.fieldId}>
                        {field.label} ({field.fieldName || field.fieldId})
                      </option>
                    ))}
                  </>
                );
              })()}
              {/* Categories */}
              {selectedCategories.length > 0 && (
                <>
                  <option disabled>─────────────────</option>
                  {selectedCategories.map((cat) => (
                    <option
                      key={cat.categoryId || cat.id}
                      value={cat.categoryId || cat.id}
                    >
                      {cat.label || cat.categoryName} (category)
                    </option>
                  ))}
                </>
              )}
            </select>
          </PropRow>
          <PropRow label="Input Type">
            <select
              value={el.inputType || "text"}
              onChange={(e) => onChange({ ...el, inputType: e.target.value })}
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 12,
                padding: "0 6px",
              }}
            >
              <option value="text">Text Input</option>
              <option value="email">Email</option>
              <option value="number">Number</option>
              <option value="dropdown">Dropdown/Select</option>
              <option value="checkbox">Checkbox</option>
              <option value="textarea">Textarea</option>
            </select>
          </PropRow>
          <PropRow label="Placeholder">
            <input
              type="text"
              value={el.placeholder || ""}
              onChange={(e) => onChange({ ...el, placeholder: e.target.value })}
              placeholder="Placeholder text"
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 11,
                padding: "0 8px",
              }}
            />
          </PropRow>
          {el.inputType === "dropdown" && (
            <PropRow label="Options (comma-separated)">
              <input
                type="text"
                value={el.options || ""}
                onChange={(e) => onChange({ ...el, options: e.target.value })}
                placeholder="Option 1, Option 2, Option 3"
                style={{
                  width: "100%",
                  height: 28,
                  borderRadius: 6,
                  border: "1px solid #e2e8f0",
                  fontSize: 11,
                  padding: "0 8px",
                }}
              />
            </PropRow>
          )}
        </div>
      )}

      {/* Form Select Properties */}
      {el.type === "form-select" && (
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 8,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Select Field Settings
          </div>
          <PropRow label="Field ID">
            <input
              type="text"
              value={el.fieldId || "category"}
              onChange={(e) => onChange({ ...el, fieldId: e.target.value })}
              placeholder="Field ID"
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 11,
                padding: "0 8px",
              }}
            />
          </PropRow>
          <PropRow label="Label">
            <input
              type="text"
              value={el.content || ""}
              onChange={(e) => onChange({ ...el, content: e.target.value })}
              placeholder="Dropdown label"
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 11,
                padding: "0 8px",
              }}
            />
          </PropRow>
        </div>
      )}

      {/* Form Submit Button Properties */}
      {el.type === "form-submit" && (
        <div
          style={{
            background: "#f8fafc",
            borderRadius: 8,
            padding: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "var(--muted-foreground)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Button Settings
          </div>
          <PropRow label="Button Text">
            <input
              type="text"
              value={el.content || "Submit"}
              onChange={(e) => onChange({ ...el, content: e.target.value })}
              placeholder="Button text"
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                fontSize: 11,
                padding: "0 8px",
              }}
            />
          </PropRow>
        </div>
      )}
    </div>
  );
};

const CanvasEl = ({ el, selected, onMouseDown }) => {
  const isText = ["text", "header", "footer", "card"].includes(el.type);
  const isMedia = ["image", "logo"].includes(el.type);
  const [hoveredHandle, setHoveredHandle] = useState(null);

  const handleCursor = {
    nw: "nw-resize",
    n: "n-resize",
    ne: "ne-resize",
    e: "e-resize",
    se: "se-resize",
    s: "s-resize",
    sw: "sw-resize",
    w: "w-resize",
  };

  const hPos = (h) => {
    const s = {
      position: "absolute",
      width: 8,
      height: 8,
      borderRadius: 2,
      background: "#a855f7",
      border: "2px solid #fff",
      zIndex: 10,
      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
      cursor: handleCursor[h],
    };
    if (h === "nw") return { ...s, top: -4, left: -4 };
    if (h === "n")
      return { ...s, top: -4, left: "50%", transform: "translateX(-50%)" };
    if (h === "ne") return { ...s, top: -4, right: -4 };
    if (h === "e")
      return { ...s, top: "50%", right: -4, transform: "translateY(-50%)" };
    if (h === "se") return { ...s, bottom: -4, right: -4 };
    if (h === "s")
      return { ...s, bottom: -4, left: "50%", transform: "translateX(-50%)" };
    if (h === "sw") return { ...s, bottom: -4, left: -4 };
    if (h === "w")
      return { ...s, top: "50%", left: -4, transform: "translateY(-50%)" };
  };

  return (
    <div
      onMouseDown={(e) => onMouseDown(e, el.id)}
      style={{
        position: "absolute",
        left: el.x,
        top: el.y,
        width: el.w,
        height: el.h,
        background: el.bg,
        borderRadius: el.borderRadius,
        border:
          el.borderWidth > 0
            ? `${el.borderWidth}px ${el.borderStyle} ${el.borderColor}`
            : "none",
        opacity: el.opacity ?? 1,
        zIndex: (el.zIndex || 1) + 1,
        cursor: el.locked ? "not-allowed" : "move",
        boxSizing: "border-box",
        outline: selected ? "2px solid #a855f7" : "none",
        outlineOffset: 2,
        boxShadow: selected
          ? "0 0 0 1px #e9d5ff, 0 0 8px rgba(168,85,247,0.3)"
          : "none",
        overflow: "hidden",
      }}
    >
      {el.type === "qr" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <i
            className="bi bi-qr-code"
            style={{ fontSize: Math.min(el.w, el.h) * 0.55, color: "var(--foreground)" }}
          />
          <span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>
            {el.content || "{{passId}}"}
          </span>
        </div>
      ) : el.type === "form-field" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: `${el.paddingY}px ${el.paddingX}px`,
            background: el.bg,
            borderRadius: el.borderRadius,
            border: `${el.borderWidth}px ${el.borderStyle} ${el.borderColor}`,
            fontSize: el.fontSize,
            color: el.color || "#1e293b",
            gap: 2,
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, color: "#7c3aed" }}>
            {el.fieldId || "Field"}
          </span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: el.fontSize - 2,
              color: el.color || "#1e293b",
            }}
          >
            {el.placeholder || el.content || "Form Field"}
          </span>
        </div>
      ) : el.type === "form-select" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            padding: `${el.paddingY}px ${el.paddingX}px`,
            background: el.bg,
            borderRadius: el.borderRadius,
            border: `${el.borderWidth}px ${el.borderStyle} ${el.borderColor}`,
            fontSize: el.fontSize,
            color: "#999",
          }}
        >
          <span>{el.content || "Select an option"}</span>
        </div>
      ) : el.type === "form-checkbox" ? (
        <div
          style={{
            width: el.w,
            height: el.h,
            background: el.bg,
            borderRadius: el.borderRadius,
            border: `${el.borderWidth}px ${el.borderStyle} ${el.borderColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i
            className="bi bi-check"
            style={{
              color: el.checked ? "#a855f7" : "transparent",
              fontSize: 14,
            }}
          />
        </div>
      ) : el.type === "form-submit" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: el.bg,
            borderRadius: el.borderRadius,
            border: `${el.borderWidth}px ${el.borderStyle} ${el.borderColor}`,
            fontSize: el.fontSize,
            fontWeight: el.fontWeight,
            color: el.color,
            cursor: "pointer",
          }}
        >
          {el.content}
        </div>
      ) : isMedia && el.imageUrl ? (
        <img
          src={el.imageUrl}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: el.objectFit || "cover",
            display: "block",
          }}
        />
      ) : isText ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            padding: `${el.paddingY}px ${el.paddingX}px`,
            fontSize: el.fontSize,
            fontWeight: el.fontWeight,
            fontFamily: el.fontFamily,
            fontStyle: el.fontStyle,
            textDecoration: el.textDecoration,
            color: el.color,
            textAlign: el.textAlign,
            lineHeight: el.lineHeight,
            display: "flex",
            alignItems: "center",
            justifyContent:
              el.textAlign === "center"
                ? "center"
                : el.textAlign === "right"
                  ? "flex-end"
                  : "flex-start",
            overflow: "hidden",
            boxSizing: "border-box",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {el.content || ""}
        </div>
      ) : isMedia ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <i
            className={`bi ${el.type === "logo" ? "bi-patch-check" : "bi-image"}`}
            style={{ fontSize: 28, color: "#cbd5e1" }}
          />
          <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{el.label}</span>
        </div>
      ) : el.type === "divider" ? (
        <div style={{ width: "100%", height: "100%", background: el.bg }} />
      ) : null}

      {selected &&
        !el.locked &&
        ["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => (
          <div
            key={h}
            style={hPos(h)}
            onMouseEnter={() => setHoveredHandle(h)}
            onMouseLeave={() => setHoveredHandle(null)}
          />
        ))}
    </div>
  );
};

// Generate professional industry-level design elements for new forms
const generateDefaultElements = (form) => {
  if (!form) return [];

  const enabledFields = (form.fields || []).filter((f) => f.enabled !== false);
  const defaultElements = [];
  let zIndex = 1;

  // ========== BACKGROUND SECTION ==========
  // Background Image (Editable)
  defaultElements.push({
    id: Math.random().toString(36).slice(2, 9),
    type: "image",
    x: 0,
    y: 0,
    w: 600,
    h: 1000,
    label: "Background Image",
    imageUrl:
      "https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=1000&fit=crop",
    objectFit: "cover",
    opacity: 0.25,
    zIndex: zIndex++,
  });

  // ========== LEFT SIDE BRANDING ==========
  // Brand Background (editable rectangle)
  defaultElements.push({
    id: Math.random().toString(36).slice(2, 9),
    type: "text",
    x: 20,
    y: 30,
    w: 280,
    h: 200,
    label: "Brand Background",
    content: "",
    bg: "rgba(51, 51, 51, 0.7)",
    borderRadius: 12,
    zIndex: zIndex++,
  });

  // Brand Main Heading (Fully Editable)
  defaultElements.push({
    id: Math.random().toString(36).slice(2, 9),
    type: "header",
    x: 40,
    y: 50,
    w: 240,
    h: 60,
    label: "Main Heading",
    content: "Welcome!",
    fontSize: 36,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "left",
    bg: "transparent",
    zIndex: zIndex++,
  });

  // Brand Subtitle (Fully Editable)
  defaultElements.push({
    id: Math.random().toString(36).slice(2, 9),
    type: "text",
    x: 40,
    y: 120,
    w: 240,
    h: 60,
    label: "Brand Description",
    content: form.formName + "\n\nFill out the form and get started today!",
    fontSize: 14,
    color: "#e0e0e0",
    textAlign: "left",
    lineHeight: 1.5,
    zIndex: zIndex++,
  });

  // ========== RIGHT SIDE FORM ==========
  const formX = 320;
  const formW = 260;
  let currentY = 40;

  // Logo Section (Editable Image)
  defaultElements.push({
    id: Math.random().toString(36).slice(2, 9),
    type: "image",
    x: formX + 85,
    y: currentY,
    w: 90,
    h: 50,
    label: "Logo",
    imageUrl: "https://via.placeholder.com/90x50/667eea/ffffff?text=Logo",
    objectFit: "contain",
    zIndex: zIndex++,
  });

  currentY += 70;

  // Form Title (Editable Header)
  defaultElements.push({
    id: Math.random().toString(36).slice(2, 9),
    type: "header",
    x: formX + 10,
    y: currentY,
    w: 240,
    h: 40,
    label: "Form Title",
    content: form.formName || "Registration",
    fontSize: 24,
    fontWeight: "700",
    color: "#333333",
    textAlign: "center",
    bg: "transparent",
    zIndex: zIndex++,
  });

  currentY += 50;

  // Form Subtitle (Editable Text)
  defaultElements.push({
    id: Math.random().toString(36).slice(2, 9),
    type: "text",
    x: formX + 10,
    y: currentY,
    w: 240,
    h: 25,
    label: "Form Subtitle",
    content: "Please fill in your information",
    fontSize: 13,
    color: "#888888",
    textAlign: "center",
    zIndex: zIndex++,
  });

  currentY += 35;

  // Divider (Editable Line)
  defaultElements.push({
    id: Math.random().toString(36).slice(2, 9),
    type: "divider",
    x: formX + 20,
    y: currentY,
    w: 220,
    h: 1,
    label: "Divider",
    bg: "#eeeeee",
    borderWidth: 0,
    zIndex: zIndex++,
  });

  currentY += 20;

  // ========== FORM FIELDS (ALL OF THEM) ==========
  enabledFields.forEach((field, idx) => {
    // Field Label (Editable Text)
    defaultElements.push({
      id: Math.random().toString(36).slice(2, 9),
      type: "text",
      x: formX + 15,
      y: currentY,
      w: 230,
      h: 18,
      label: `Label: ${field.label}`,
      content: `${field.label}${field.required ? " *" : ""}`,
      fontSize: 13,
      fontWeight: "600",
      color: "#333333",
      zIndex: zIndex++,
    });

    currentY += 22;

    // Field Input (Editable Form Field)
    defaultElements.push({
      id: Math.random().toString(36).slice(2, 9),
      type: "form-field",
      x: formX + 15,
      y: currentY,
      w: 230,
      h: 40,
      label: field.label,
      fieldId: field.fieldId,
      placeholder: `Enter ${field.label.toLowerCase()}`,
      content: field.label,
      fontSize: 13,
      required: field.required,
      bg: "#f9f9f9",
      color: "#333333",
      borderWidth: 1,
      borderColor: "#d0d0d0",
      borderRadius: 6,
      paddingX: 12,
      paddingY: 10,
      zIndex: zIndex++,
    });

    currentY += 50;
  });

  // Spacer before button
  currentY += 10;

  // Submit Button (Fully Editable)
  defaultElements.push({
    id: Math.random().toString(36).slice(2, 9),
    type: "form-submit",
    x: formX + 15,
    y: currentY,
    w: 230,
    h: 48,
    label: "Submit Button",
    content: "Submit",
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    textAlign: "center",
    borderRadius: 6,
    zIndex: zIndex++,
  });

  currentY += 70;

  // ========== FOOTER ==========
  // Footer Background (Editable)
  defaultElements.push({
    id: Math.random().toString(36).slice(2, 9),
    type: "text",
    x: 0,
    y: currentY,
    w: 600,
    h: 50,
    label: "Footer Background",
    content: "",
    bg: "#333333",
    zIndex: zIndex++,
  });

  // Footer Text (Editable)
  defaultElements.push({
    id: Math.random().toString(36).slice(2, 9),
    type: "text",
    x: 20,
    y: currentY + 12,
    w: 560,
    h: 26,
    label: "Footer Text",
    content: "© 2026 Your Company. All rights reserved.",
    fontSize: 12,
    color: "#aaaaaa",
    textAlign: "center",
    zIndex: zIndex++,
  });

  return defaultElements;
};

const FormEditor = ({ formId, onBack }) => {
  const { getFormById, getFormElements, saveFormElements, updateForm } =
    useForm();
  const form = getFormById(formId);

  // Get existing elements or generate default design
  const existingElements = getFormElements(formId);
  const initialElements =
    existingElements && existingElements.length > 0
      ? existingElements
      : generateDefaultElements(form);

  // Calculate default canvas height based on number of fields
  const enabledFieldsCount = (form?.fields || []).filter(
    (f) => f.enabled !== false,
  ).length;
  const defaultCanvasHeight = 300 + enabledFieldsCount * 70 + 150;

  const [elements, setElements] = useState(initialElements);
  const [selectedElementIds, setSelectedElementIds] = useState([]);
  const [canvas, setCanvas] = useState({
    width: 600,
    height: Math.max(600, defaultCanvasHeight),
    background: "#f5f5f5",
    borderRadius: 0,
  });
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [gap, setGap] = useState(10);
  const [openAccordion, setOpenAccordion] = useState("position");
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);

  const selectedElement = elements.find(
    (el) => el.id === selectedElementIds[0],
  );
  const selectedElements = elements.filter((el) =>
    selectedElementIds.includes(el.id),
  );
  const isFormElement =
    selectedElement &&
    ["form-field", "form-select", "form-checkbox", "form-submit"].includes(
      selectedElement.type,
    );

  const addElement = useCallback((type) => {
    const el = makeElement(type);
    setElements((prev) => [...prev, el]);
    setSelectedElementIds([el.id]);
  }, []);

  const updateElement = useCallback((updated) => {
    setElements((prev) =>
      prev.map((el) => (el.id === updated.id ? updated : el)),
    );
  }, []);

  // Group management (must be after updateElement definition)
  const groupElements = useCallback(() => {
    if (selectedElements.length < 2) return;
    const groupId = uid();
    const updated = selectedElements.map((el) => ({ ...el, groupId }));
    updated.forEach((el) => updateElement(el));
  }, [selectedElements, updateElement]);

  const ungroupElements = useCallback(() => {
    if (selectedElements.length === 0) return;
    const updated = selectedElements.map((el) => ({ ...el, groupId: null }));
    updated.forEach((el) => updateElement(el));
  }, [selectedElements, updateElement]);

  // When moving a grouped element, move all in the group
  const moveGroup = useCallback(
    (elementId, dx, dy) => {
      const element = elements.find((e) => e.id === elementId);
      if (!element || !element.groupId) return false;

      const groupMembers = elements.filter(
        (e) => e.groupId === element.groupId,
      );
      groupMembers.forEach((el) => {
        updateElement({ ...el, x: el.x + dx, y: el.y + dy });
      });
      return true;
    },
    [elements, updateElement],
  );

  const deleteSelected = useCallback(() => {
    setElements((prev) =>
      prev.filter((el) => !selectedElementIds.includes(el.id)),
    );
    setSelectedElementIds([]);
  }, [selectedElementIds]);

  const duplicateSelected = useCallback(() => {
    const el = elements.find((e) => e.id === selectedElementIds[0]);
    if (!el) return;
    const dup = { ...el, id: uid(), x: el.x + 16, y: el.y + 16 };
    setElements((prev) => [...prev, dup]);
    setSelectedElementIds([dup.id]);
  }, [elements, selectedElementIds]);

  const bringForward = useCallback(() => {
    const el = elements.find((e) => e.id === selectedElementIds[0]);
    if (!el) return;
    const maxZ = Math.max(...elements.map((e) => e.zIndex || 1), 0);
    updateElement({ ...el, zIndex: maxZ + 1 });
  }, [elements, selectedElementIds, updateElement]);

  const sendBackward = useCallback(() => {
    const el = elements.find((e) => e.id === selectedElementIds[0]);
    if (!el) return;
    const minZ = Math.min(...elements.map((e) => e.zIndex || 1), 0);
    updateElement({ ...el, zIndex: minZ - 1 });
  }, [elements, selectedElementIds, updateElement]);

  // Distribute elements horizontally with equal gap
  const distributeHorizontally = useCallback(() => {
    if (selectedElements.length < 2) return;
    const sorted = [...selectedElements].sort((a, b) => a.x - b.x);
    let currentX = sorted[0].x;
    const updated = sorted.map((el) => {
      const newEl = { ...el, x: currentX };
      currentX += el.w + gap;
      return newEl;
    });
    updated.forEach((el) => updateElement(el));
  }, [selectedElements, gap, updateElement]);

  // Distribute elements vertically with equal gap
  const distributeVertically = useCallback(() => {
    if (selectedElements.length < 2) return;
    const sorted = [...selectedElements].sort((a, b) => a.y - b.y);
    let currentY = sorted[0].y;
    const updated = sorted.map((el) => {
      const newEl = { ...el, y: currentY };
      currentY += el.h + gap;
      return newEl;
    });
    updated.forEach((el) => updateElement(el));
  }, [selectedElements, gap, updateElement]);

  // Align all selected elements
  const alignElements = useCallback(
    (direction) => {
      if (selectedElements.length < 2) return;
      const updated = selectedElements.map((el) => {
        switch (direction) {
          case "left":
            return { ...el, x: Math.min(...selectedElements.map((e) => e.x)) };
          case "centerX":
            return {
              ...el,
              x:
                selectedElements.reduce((sum, e) => sum + e.x + e.w / 2, 0) /
                  selectedElements.length -
                el.w / 2,
            };
          case "right":
            return {
              ...el,
              x: Math.max(...selectedElements.map((e) => e.x + e.w)) - el.w,
            };
          case "top":
            return { ...el, y: Math.min(...selectedElements.map((e) => e.y)) };
          case "centerY":
            return {
              ...el,
              y:
                selectedElements.reduce((sum, e) => sum + e.y + e.h / 2, 0) /
                  selectedElements.length -
                el.h / 2,
            };
          case "bottom":
            return {
              ...el,
              y: Math.max(...selectedElements.map((e) => e.y + e.h)) - el.h,
            };
          default:
            return el;
        }
      });
      updated.forEach((el) => updateElement(el));
    },
    [selectedElements, updateElement],
  );

  const getElementAtPoint = useCallback(
    (px, py) => {
      const sorted = [...elements].sort(
        (a, b) => (b.zIndex || 1) - (a.zIndex || 1),
      );
      for (const el of sorted) {
        if (px >= el.x && px < el.x + el.w && py >= el.y && py < el.y + el.h)
          return el;
      }
      return null;
    },
    [elements],
  );

  const onCanvasMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const px = (e.clientX - rect.left) / zoom;
      const py = (e.clientY - rect.top) / zoom;

      const clicked = getElementAtPoint(px, py);
      if (!clicked) {
        setSelectedElementIds([]);
        return;
      }

      // Multi-select with Ctrl/Cmd + Click
      if (e.ctrlKey || e.metaKey) {
        setSelectedElementIds((prev) =>
          prev.includes(clicked.id)
            ? prev.filter((id) => id !== clicked.id)
            : [...prev, clicked.id],
        );
      } else {
        setSelectedElementIds([clicked.id]);
      }
      if (clicked.locked) return;

      const handles = {
        nw:
          clicked.x <= px &&
          px < clicked.x + 8 &&
          clicked.y <= py &&
          py < clicked.y + 8,
        n:
          clicked.x + clicked.w / 2 - 4 <= px &&
          px < clicked.x + clicked.w / 2 + 4 &&
          clicked.y <= py &&
          py < clicked.y + 8,
        ne:
          clicked.x + clicked.w - 8 <= px &&
          px < clicked.x + clicked.w &&
          clicked.y <= py &&
          py < clicked.y + 8,
        e:
          clicked.x + clicked.w - 8 <= px &&
          px < clicked.x + clicked.w &&
          clicked.y + clicked.h / 2 - 4 <= py &&
          py < clicked.y + clicked.h / 2 + 4,
        se:
          clicked.x + clicked.w - 8 <= px &&
          px < clicked.x + clicked.w &&
          clicked.y + clicked.h - 8 <= py &&
          py < clicked.y + clicked.h,
        s:
          clicked.x + clicked.w / 2 - 4 <= px &&
          px < clicked.x + clicked.w / 2 + 4 &&
          clicked.y + clicked.h - 8 <= py &&
          py < clicked.y + clicked.h,
        sw:
          clicked.x <= px &&
          px < clicked.x + 8 &&
          clicked.y + clicked.h - 8 <= py &&
          py < clicked.y + clicked.h,
        w:
          clicked.x <= px &&
          px < clicked.x + 8 &&
          clicked.y + clicked.h / 2 - 4 <= py &&
          py < clicked.y + clicked.h / 2 + 4,
      };

      const handle = Object.entries(handles).find(([, hit]) => hit)?.[0];
      if (handle) {
        resizeRef.current = {
          id: clicked.id,
          handle,
          startX: px,
          startY: py,
          origX: clicked.x,
          origY: clicked.y,
          origW: clicked.w,
          origH: clicked.h,
        };
      } else {
        dragRef.current = {
          id: clicked.id,
          startX: px,
          startY: py,
          origX: clicked.x,
          origY: clicked.y,
        };
      }

      const onMouseMove = (me) => {
        const cx = (me.clientX - rect.left) / zoom;
        const cy = (me.clientY - rect.top) / zoom;

        if (dragRef.current) {
          const dx = cx - dragRef.current.startX;
          const dy = cy - dragRef.current.startY;
          const el = elements.find((e) => e.id === dragRef.current.id);
          if (el) {
            updateElement({
              ...el,
              x: Math.max(0, dragRef.current.origX + dx),
              y: Math.max(0, dragRef.current.origY + dy),
            });
          }
        } else if (resizeRef.current) {
          const dx = cx - resizeRef.current.startX;
          const dy = cy - resizeRef.current.startY;
          const h = resizeRef.current.handle;
          const el = elements.find((e) => e.id === resizeRef.current.id);
          if (!el) return;

          let nx = el.x,
            ny = el.y,
            nw = el.w,
            nh = el.h;
          if (["nw", "w", "sw"].includes(h)) {
            nx = resizeRef.current.origX + dx;
            nw = resizeRef.current.origW - dx;
          }
          if (["ne", "e", "se"].includes(h))
            nw = Math.max(20, resizeRef.current.origW + dx);
          if (["nw", "n", "ne"].includes(h)) {
            ny = resizeRef.current.origY + dy;
            nh = resizeRef.current.origH - dy;
          }
          if (["sw", "s", "se"].includes(h))
            nh = Math.max(4, resizeRef.current.origH + dy);

          updateElement({ ...el, x: nx, y: ny, w: nw, h: nh });
        }
      };

      const onMouseUp = () => {
        dragRef.current = null;
        resizeRef.current = null;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [zoom, getElementAtPoint, elements, updateElement],
  );

  const saveForm = async () => {
    setSaving(true);
    setError("");
    try {
      await saveFormElements(formId, elements);
      // Navigate back to forms table view after successful save
      setTimeout(() => {
        onBack();
      }, 500);
    } catch (err) {
      setError("Failed to save form: " + err.message);
      alert("Failed to save form: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#f1f5f9",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              className="btn btn-link p-0 text-dark"
              onClick={onBack}
              style={{ border: "none", fontSize: 20 }}
            >
              <FiArrowLeft />
            </button>
            <div>
              <h5 style={{ marginBottom: 0, fontWeight: "bold" }}>
                {form?.formName}
              </h5>
              <small style={{ color: "var(--muted-foreground)" }}>{form?.eventName}</small>
            </div>
          </div>
          <button
            onClick={saveForm}
            disabled={saving}
            style={{
              height: 32,
              borderRadius: 6,
              border: "none",
              background: "linear-gradient(135deg,#7c3aed,#a855f7)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm" /> Saving…
              </>
            ) : (
              <>
                <FiSave size={14} /> Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          overflowX: "auto",
        }}
      >
        {/* Load Default Designs */}
        <div
          style={{
            display: "flex",
            gap: 6,
            flexShrink: 0,
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}>
            Design:
          </span>
          <button
            onClick={() => {
              const designs = generateProfessionalFormDesign(form);
              setElements(designs);
            }}
            title="Load Professional Design"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              height: 32,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#475569",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 500,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Professional
          </button>
          <button
            onClick={() => {
              const designs = generateModernFormDesign(form);
              setElements(designs);
            }}
            title="Load Modern Design"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              height: 32,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#475569",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 500,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Modern
          </button>
          <button
            onClick={() => {
              const designs = generateMinimalFormDesign(form);
              setElements(designs);
            }}
            title="Load Minimal Design"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              height: 32,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#475569",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 500,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Minimal
          </button>
        </div>

        {/* Separator */}
        <div
          style={{
            width: "1px",
            height: 20,
            background: "#e2e8f0",
            flexShrink: 0,
          }}
        />

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {ELEMENT_BTNS.map(({ type, icon, label }) => (
            <button
              key={type}
              onClick={() => addElement(type)}
              title={`Add ${label}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                height: 32,
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#475569",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 500,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <i className={`bi ${icon}`} />
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }} />

        {/* Zoom Controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#475569",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            −
          </button>
          <span
            style={{
              fontSize: 11,
              color: "var(--muted-foreground)",
              minWidth: 40,
              textAlign: "center",
            }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
              color: "#475569",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            +
          </button>
          <div
            style={{
              width: 1,
              height: 24,
              background: "#e2e8f0",
              margin: "0 4px",
            }}
          />
          <button
            onClick={() => setFullscreen(!fullscreen)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: fullscreen ? "#e0e7ff" : "#f8fafc",
              color: fullscreen ? "#4f46e5" : "#475569",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={fullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            <i
              className={`bi ${fullscreen ? "bi-fullscreen-exit" : "bi-fullscreen"}`}
            />
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger mt-2 mb-0 py-2 px-3 small">
          {error}
        </div>
      )}

      {/* Editor */}
      <div
        style={{
          display: "flex",
          flex: 1,
          gap: 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Left Panel */}
        {!fullscreen && (
          <div
            style={{
              width: 200,
              background: "#fff",
              borderRight: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Canvas settings */}
            <div
              style={{
                padding: "10px 12px",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--muted-foreground)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Canvas
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 4,
                  marginBottom: 6,
                }}
              >
                <div>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Width</span>
                  <NumInput
                    value={canvas.width}
                    min={100}
                    max={2000}
                    onChange={(v) => setCanvas((c) => ({ ...c, width: v }))}
                  />
                </div>
                <div>
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>Height</span>
                  <NumInput
                    value={canvas.height}
                    min={100}
                    max={3000}
                    onChange={(v) => setCanvas((c) => ({ ...c, height: v }))}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                  Background
                </span>
                <ColorInput
                  value={canvas.background}
                  onChange={(v) => setCanvas((c) => ({ ...c, background: v }))}
                />
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
                  Border Radius
                </span>
                <NumInput
                  value={canvas.borderRadius || 0}
                  min={0}
                  max={100}
                  suffix="px"
                  onChange={(v) =>
                    setCanvas((c) => ({ ...c, borderRadius: v }))
                  }
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {CANVAS_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() =>
                      setCanvas((c) => ({ ...c, width: p.w, height: p.h }))
                    }
                    style={{
                      fontSize: 9,
                      padding: "2px 5px",
                      borderRadius: 4,
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      cursor: "pointer",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Layers */}
            <div
              style={{
                padding: "8px 12px 4px",
                fontWeight: 700,
                fontSize: 11,
                color: "var(--muted-foreground)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Layers ({elements.length})
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {[...elements]
                .filter(Boolean)
                .reverse()
                .map((el, idx) => {
                  const formFieldIndex =
                    elements.filter((e) => e.type === "form-field").length -
                    idx;
                  const displayLabel =
                    el.type === "form-field"
                      ? `${formFieldIndex}. ${el.fieldId || "Field"}`
                      : el.content?.replace(/\{\{[^}]+\}\}/g, "…") ||
                        el.label ||
                        el.type;
                  return (
                    <div
                      key={el.id}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          setSelectedElementIds((prev) =>
                            prev.includes(el.id)
                              ? prev.filter((id) => id !== el.id)
                              : [...prev, el.id],
                          );
                        } else {
                          setSelectedElementIds([el.id]);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 12px",
                        cursor: "pointer",
                        background: selectedElementIds.includes(el.id)
                          ? "#f5f3ff"
                          : "transparent",
                        borderLeft: `3px solid ${selectedElementIds.includes(el.id) ? "#a855f7" : "transparent"}`,
                      }}
                    >
                      <i
                        className={`bi ${DEFAULT_ELEMENT[el.type]?.icon}`}
                        style={{
                          fontSize: 12,
                          color: selectedElementIds.includes(el.id)
                            ? "#7c3aed"
                            : "#94a3b8",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          color: "#475569",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: el.type === "form-field" ? 600 : 400,
                        }}
                      >
                        {displayLabel}
                      </span>
                      {el.locked && (
                        <i
                          className="bi bi-lock-fill"
                          style={{ fontSize: 10, color: "var(--muted-foreground)" }}
                        />
                      )}
                    </div>
                  );
                })}
              {elements.length === 0 && (
                <div
                  style={{
                    padding: 16,
                    fontSize: 11,
                    color: "var(--muted-foreground)",
                    textAlign: "center",
                  }}
                >
                  Add elements from toolbar
                </div>
              )}
            </div>
          </div>
        )}

        {/* Center Canvas */}
        <div
          style={{
            flex: 1,
            background: "#e2e8f0",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            overflow: "auto",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: canvas.width * zoom,
              height: canvas.height * zoom,
              flexShrink: 0,
              position: "relative",
            }}
          >
            <div
              ref={canvasRef}
              onMouseDown={onCanvasMouseDown}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: canvas.width,
                height: canvas.height,
                background: canvas.background,
                borderRadius: canvas.borderRadius || 0,
                boxShadow: "0 4px 30px rgba(0,0,0,0.15)",
                transform: `scale(${zoom})`,
                transformOrigin: "top left",
                backgroundImage:
                  "radial-gradient(#cbd5e1 0.5px, transparent 0.5px)",
                backgroundSize: "16px 16px",
                cursor: "default",
                userSelect: "none",
              }}
            >
              {elements.map((el) => (
                <CanvasEl
                  key={el.id}
                  el={el}
                  selected={selectedElementIds.includes(el.id)}
                  onMouseDown={onCanvasMouseDown}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        {!fullscreen && (
          <div
            style={{
              width: 240,
              background: "#fff",
              borderLeft: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            <PropertiesPanel
              el={selectedElement}
              selectedElements={selectedElements}
              onChange={updateElement}
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
              onBring={bringForward}
              onSend={sendBackward}
              canvasState={canvas}
              alignElements={alignElements}
              distributeHorizontally={distributeHorizontally}
              distributeVertically={distributeVertically}
              groupElements={groupElements}
              ungroupElements={ungroupElements}
              form={form}
              gap={gap}
              setGap={setGap}
              openAccordion={openAccordion}
              setOpenAccordion={setOpenAccordion}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FormEditor;
