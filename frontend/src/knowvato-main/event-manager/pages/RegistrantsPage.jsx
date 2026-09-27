import React, { useEffect, useMemo, useState } from "react";
import QRCodeStyling from "qr-code-styling";
import { FiSearch, FiEdit2, FiX, FiEye } from "react-icons/fi";
import { useEventData } from "../context/EventDataContext";
import { fetchAttendees } from "../services/api";
import { toast } from "react-toastify";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const PASS_PREVIEW_W = 340;
const DEFAULT_CATEGORIES = [
  { id: 1, name: "VIP", color: "var(--warning)" },
  { id: 2, name: "General", color: "var(--info)" },
  { id: 3, name: "Staff", color: "var(--success)" },
  { id: 4, name: "Speaker", color: "#8B5CF6" },
];

const DEFAULT_PASS_LAYOUT = {
  headerTitle: {
    x: 18,
    y: 20,
    w: 320,
    h: 26,
    fontSize: 19,
    fontWeight: "700",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "var(--card)",
  },
  headerSub: {
    x: 18,
    y: 52,
    w: 320,
    h: 18,
    fontSize: 13,
    fontWeight: "400",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "rgba(255,255,255,0.82)",
  },
  headerBrand: {
    x: 330,
    y: 20,
    w: 80,
    h: 14,
    fontSize: 11,
    fontWeight: "400",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "rgba(255,255,255,0.55)",
  },
  logo: { x: 330, y: 8, w: 72, h: 72, opacity: 1, src: null },
  categoryBadge: { x: 18, y: 120, w: 116, h: 28 },
  name: {
    x: 18,
    y: 160,
    w: 385,
    h: 34,
    fontSize: 24,
    fontWeight: "700",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "#0f172a",
  },
  organization: {
    x: 18,
    y: 204,
    w: 385,
    h: 22,
    fontSize: 13,
    fontWeight: "400",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "var(--foreground)",
  },
  phone: {
    x: 18,
    y: 230,
    w: 385,
    h: 22,
    fontSize: 13,
    fontWeight: "400",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "var(--foreground)",
  },
  email: {
    x: 18,
    y: 256,
    w: 385,
    h: 22,
    fontSize: 13,
    fontWeight: "400",
    fontStyle: "normal",
    fontFamily: "Segoe UI",
    color: "var(--foreground)",
  },
  qr: { x: 135, y: 460, w: 150, h: 150 },
};

const truncate = (str, n) =>
  str && str.length > n ? str.substring(0, n - 1) + "…" : str || "";

const validatePhone = (value) => {
  if (!value) return true;
  const digits = value.toString().replace(/[\s\-\(\)\.\+]/g, "");
  return /^\d{10}$/.test(digits) || /^\d{12}$/.test(digits);
};

const loadImage = (src) =>
  new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

const PassViewModal = ({ attendee, event, onClose }) => {
  const [qrSrc, setQrSrc] = useState(null);
  const fullDesign = event?.passDesign || {};
  const isNewDesign = fullDesign.elements && Array.isArray(fullDesign.elements);
  const catDesigns = fullDesign.categoryDesigns || {};
  const categoryDesign = catDesigns[attendee.category] || catDesigns["Default"];
  const canvas = categoryDesign?.canvas ||
    fullDesign.canvas || { width: 420, height: 640, background: "var(--card)" };
  const elements = categoryDesign?.elements || fullDesign.elements || [];
  const design = categoryDesign || fullDesign;
  const passW = canvas.width;
  const passH = canvas.height;
  const S = PASS_PREVIEW_W / passW;
  const previewH = Math.round(passH * S);
  const primaryColor = design.primaryColor || "var(--primary)";
  const headerColor = design.headerColor || primaryColor;
  const qrColor = design.qrColor || "#000000";
  const bgColor = design.bgColor || canvas.background || "var(--card)";
  const bgImage = design.bgImage || null;
  const bgOpacity = design.bgOpacity ?? 60;
  const bgFit = design.bgFit || "cover";
  const bgPosX = design.bgPosX ?? 50;
  const bgPosY = design.bgPosY ?? 50;
  const showHeader = design.showHeader !== false;
  const headerHeight = design.headerHeight || 108;
  const headerConfig = design.headerConfig || {};
  const layout = { ...DEFAULT_PASS_LAYOUT, ...(design.layout || {}) };
  const eventCats = (event?.categories || []).filter(
    (c) => c.enabled !== false,
  );
  const catColor =
    eventCats.find(
      (c) => c.label?.toLowerCase() === (attendee.category || "").toLowerCase(),
    )?.color ||
    DEFAULT_CATEGORIES.find(
      (c) => c.name.toLowerCase() === (attendee.category || "").toLowerCase(),
    )?.color ||
    primaryColor;

  useEffect(() => {
    let active = true;
    const qr = new QRCodeStyling({
      width: 240,
      height: 240,
      type: "canvas",
      data: attendee.passId || "PASS",
      dotsOptions: { color: qrColor, type: "square" },
      backgroundOptions: { color: "var(--card)" },
      qrOptions: { errorCorrectionLevel: "M" },
    });
    qr.getRawData("png")
      .then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setQrSrc((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [attendee.passId, qrColor]);

  const elStyle = (el, defSize, defWeight, defColor) => ({
    fontWeight: el?.fontWeight || defWeight,
    fontSize: (el?.fontSize || defSize) * S,
    fontStyle: el?.fontStyle || "normal",
    fontFamily: `"${el?.fontFamily || "Segoe UI"}", Arial, sans-serif`,
    color: el?.color || defColor,
    whiteSpace: "nowrap",
  });

  const substitute = (str) =>
    (str || "")
      .replace(/\{\{name\}\}/g, attendee.name || "")
      .replace(/\{\{email\}\}/g, attendee.email || "")
      .replace(/\{\{phone\}\}/g, attendee.phone || "")
      .replace(/\{\{passId\}\}/g, attendee.passId || "")
      .replace(/\{\{category\}\}/g, attendee.category || "")
      .replace(/\{\{eventName\}\}/g, event?.eventName || "")
      .replace(/\{\{venue\}\}/g, event?.venue || "")
      .replace(/\{\{startDate\}\}/g, event?.startDate || "")
      .replace(/\{\{endDate\}\}/g, event?.endDate || "");

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-sheet" style={{ maxWidth: PASS_PREVIEW_W + 60 }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h6 className="fw-bold mb-0">Pass Preview</h6>
            <small className="text-muted">
              {attendee.name}
              {attendee.category && (
                <span style={{ color: catColor }}> · {attendee.category}</span>
              )}
            </small>
          </div>
          <button type="button" className="btn-close" onClick={onClose} />
        </div>
        <div
          style={{
            position: "relative",
            width: PASS_PREVIEW_W,
            height: previewH,
            margin: "0 auto",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: bgColor,
              backgroundImage: bgImage ? `url(${bgImage})` : undefined,
              backgroundSize: bgFit === "stretch" ? "100% 100%" : bgFit,
              backgroundPosition: `${bgPosX}% ${bgPosY}%`,
              backgroundRepeat: "no-repeat",
            }}
          />
          {bgImage && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `rgba(255,255,255,${(100 - bgOpacity) / 100})`,
              }}
            />
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: `2.5px solid ${primaryColor}`,
              borderRadius: 16,
              pointerEvents: "none",
              zIndex: 10,
            }}
          />
          {isNewDesign && elements.length > 0 ? (
            elements.map((el) => {
              const isText = ["text", "header", "footer", "card"].includes(
                el.type,
              );
              const isMedia = ["image", "logo"].includes(el.type);
              return (
                <div
                  key={el.id}
                  style={{
                    position: "absolute",
                    left: el.x * S,
                    top: el.y * S,
                    width: el.w * S,
                    height: el.h * S,
                    zIndex: el.zIndex || 1,
                    background: el.bg || "transparent",
                    borderRadius: (el.borderRadius || 0) * S,
                    border:
                      (el.borderWidth || 0) > 0
                        ? `${el.borderWidth * S}px ${el.borderStyle} ${el.borderColor}`
                        : "none",
                    overflow: "hidden",
                    opacity: el.opacity ?? 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      el.textAlign === "center"
                        ? "center"
                        : el.textAlign === "right"
                          ? "flex-end"
                          : "flex-start",
                    padding: `${(el.paddingY || 0) * S}px ${(el.paddingX || 0) * S}px`,
                    boxSizing: "border-box",
                  }}
                >
                  {isText && (
                    <div
                      style={{
                        fontSize: (el.fontSize || 14) * S,
                        fontWeight: el.fontWeight,
                        fontFamily: el.fontFamily,
                        fontStyle: el.fontStyle,
                        textDecoration: el.textDecoration,
                        color: el.color,
                        textAlign: el.textAlign,
                        lineHeight: el.lineHeight,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {substitute(el.content)}
                    </div>
                  )}
                  {el.type === "qr" && qrSrc && (
                    <img
                      src={qrSrc}
                      alt="QR"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  )}
                  {isMedia && el.imageUrl && (
                    <img
                      src={el.imageUrl}
                      alt={el.label}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: el.objectFit || "cover",
                      }}
                    />
                  )}
                </div>
              );
            })
          ) : (
            <>
              {showHeader && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: headerHeight * S,
                      background: headerColor,
                      zIndex: 2,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: layout.headerTitle.x * S,
                      top: layout.headerTitle.y * S,
                      zIndex: 3,
                      ...elStyle(layout.headerTitle, 19, "700", "var(--card)"),
                      overflow: "hidden",
                      maxWidth: (passW - layout.headerTitle.x) * S,
                    }}
                  >
                    {headerConfig.customTitle || event?.eventName || "Event"}
                  </div>
                  {headerConfig.showDates !== false && (
                    <div
                      style={{
                        position: "absolute",
                        left: layout.headerSub.x * S,
                        top: layout.headerSub.y * S,
                        zIndex: 3,
                        ...elStyle(
                          layout.headerSub,
                          13,
                          "400",
                          "rgba(255,255,255,0.82)",
                        ),
                      }}
                    >
                      {[
                        event?.startDate,
                        event?.endDate && `– ${event.endDate}`,
                        headerConfig.showVenue !== false && event?.venue,
                      ]
                        .filter(Boolean)
                        .join("  ")}
                    </div>
                  )}
                  {layout.headerBrand && (
                    <div
                      style={{
                        position: "absolute",
                        left: layout.headerBrand.x * S,
                        top: layout.headerBrand.y * S,
                        zIndex: 3,
                        ...elStyle(
                          layout.headerBrand,
                          11,
                          "400",
                          "rgba(255,255,255,0.55)",
                        ),
                      }}
                    >
                      {headerConfig.brandText || "KnowVato"}
                    </div>
                  )}
                  {layout.logo?.src && layout.logo.visible !== false && (
                    <img
                      src={layout.logo.src}
                      alt="Logo"
                      style={{
                        position: "absolute",
                        zIndex: 5,
                        left: layout.logo.x * S,
                        top: layout.logo.y * S,
                        width: layout.logo.w * S,
                        height: layout.logo.h * S,
                        objectFit: "contain",
                        opacity: layout.logo.opacity ?? 1,
                      }}
                    />
                  )}
                </>
              )}
              {layout.categoryBadge.visible !== false && (
                <div
                  style={{
                    position: "absolute",
                    zIndex: 3,
                    left: layout.categoryBadge.x * S,
                    top: layout.categoryBadge.y * S,
                    width: layout.categoryBadge.w * S,
                    height: layout.categoryBadge.h * S,
                    background: catColor,
                    color: "var(--card)",
                    borderRadius: (layout.categoryBadge.h / 2) * S,
                    fontSize: (layout.categoryBadge.fontSize || 11) * S,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    whiteSpace: "nowrap",
                  }}
                >
                  {attendee.category || "General"}
                </div>
              )}
              {layout.name.visible !== false && (
                <div
                  style={{
                    position: "absolute",
                    zIndex: 3,
                    left: layout.name.x * S,
                    top: layout.name.y * S,
                    ...elStyle(layout.name, 24, "700", "#0f172a"),
                    overflow: "hidden",
                    maxWidth: (passW - layout.name.x) * S,
                  }}
                >
                  {attendee.name || "—"}
                </div>
              )}
              {attendee.organization &&
                layout.organization.visible !== false && (
                  <div
                    style={{
                      position: "absolute",
                      zIndex: 3,
                      left: layout.organization.x * S,
                      top: layout.organization.y * S,
                      ...elStyle(layout.organization, 13, "400", "var(--foreground)"),
                    }}
                  >
                    ⊞ {attendee.organization}
                  </div>
                )}
              {attendee.phone && layout.phone.visible !== false && (
                <div
                  style={{
                    position: "absolute",
                    zIndex: 3,
                    left: layout.phone.x * S,
                    top: layout.phone.y * S,
                    ...elStyle(layout.phone, 13, "400", "var(--foreground)"),
                  }}
                >
                  ◉ {attendee.phone}
                </div>
              )}
              {attendee.email && layout.email.visible !== false && (
                <div
                  style={{
                    position: "absolute",
                    zIndex: 3,
                    left: layout.email.x * S,
                    top: layout.email.y * S,
                    ...elStyle(layout.email, 13, "400", "var(--foreground)"),
                  }}
                >
                  ✉ {attendee.email}
                </div>
              )}
              {Object.entries(layout)
                .filter(([k]) => k.startsWith("ci_"))
                .map(([k, el]) =>
                  el.src && el.visible !== false ? (
                    <img
                      key={k}
                      src={el.src}
                      alt="Custom"
                      style={{
                        position: "absolute",
                        zIndex: 3,
                        left: el.x * S,
                        top: el.y * S,
                        width: el.w * S,
                        height: el.h * S,
                        objectFit: "contain",
                        opacity: el.opacity ?? 1,
                      }}
                    />
                  ) : null,
                )}
              {Object.entries(layout)
                .filter(([k]) => k.startsWith("ct_"))
                .map(([k, el]) =>
                  el.visible !== false ? (
                    <div
                      key={k}
                      style={{
                        position: "absolute",
                        zIndex: 3,
                        left: el.x * S,
                        top: el.y * S,
                        ...elStyle(el, 14, "400", "var(--foreground)"),
                        opacity: el.opacity ?? 1,
                      }}
                    >
                      {el.content || ""}
                    </div>
                  ) : null,
                )}
              {layout.qr.visible !== false && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      top: (layout.qr.y - 12) * S,
                      left: 18 * S,
                      right: 18 * S,
                      height: 1,
                      background: "var(--border)",
                      zIndex: 1,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      zIndex: 3,
                      left: layout.qr.x * S,
                      top: layout.qr.y * S,
                      width: layout.qr.w * S,
                      height: layout.qr.h * S,
                      background: "var(--border)",
                      borderRadius: 8 * S,
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {qrSrc ? (
                      <img
                        src={qrSrc}
                        alt="QR"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: 8 * S, color: "var(--muted-foreground)" }}>
                        Generating…
                      </span>
                    )}
                  </div>
                </>
              )}
              <div
                style={{
                  position: "absolute",
                  bottom: 6 * S,
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontSize: 8 * S,
                  color: "var(--muted-foreground)",
                  fontFamily: "monospace",
                  zIndex: 1,
                }}
              >
                {attendee.passId}
              </div>
            </>
          )}
        </div>
        <p
          className="text-muted text-center mt-3 mb-0"
          style={{ fontSize: 11 }}
        >
          Pass ID: <code>{attendee.passId}</code>
        </p>
      </div>
    </div>
  );
};

const RegistrantsPage = () => {
  const { events, updateAttendee } = useEventData();
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [attendeeQuery, setAttendeeQuery] = useState("");
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editAttendee, setEditAttendee] = useState(null);
  const [passPreviewAttendee, setPassPreviewAttendee] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    category: "",
    organization: "",
  });

  const filteredEvents = useMemo(() => events, [events]);

  useEffect(() => {
    if (!events.length) return;
    if (
      selectedEventId &&
      events.some((event) => String(event.id) === String(selectedEventId))
    )
      return;
    setSelectedEventId(filteredEvents[0]?.id || events[0]?.id || null);
  }, [events, filteredEvents, selectedEventId]);

  const filteredAttendees = useMemo(() => {
    const query = attendeeQuery.trim().toLowerCase();
    if (!query) return attendees;
    return attendees.filter(
      (attendee) =>
        (attendee.name || "").toLowerCase().includes(query) ||
        (attendee.phone || "").toLowerCase().includes(query),
    );
  }, [attendees, attendeeQuery]);

  const selectedEvent = useMemo(
    () =>
      events.find((event) => String(event.id) === String(selectedEventId)) ||
      filteredEvents[0] ||
      null,
    [events, selectedEventId, filteredEvents],
  );

  const categoryOptions = useMemo(
    () => (selectedEvent?.categories || []).filter((c) => c.enabled !== false),
    [selectedEvent],
  );

  const phoneHasError = editForm.phone.trim() && !validatePhone(editForm.phone);

  useEffect(() => {
    let active = true;
    if (!selectedEvent) {
      setAttendees([]);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    fetchAttendees(selectedEvent.id)
      .then((data) => {
        if (!active) return;
        setAttendees(data || []);
      })
      .catch(() => {
        if (!active) return;
        setAttendees([]);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedEvent]);

  useEffect(() => {
    if (!editAttendee) return;
    setEditForm({
      name: editAttendee.name || "",
      phone: editAttendee.phone || "",
      category: editAttendee.category || "",
      organization: editAttendee.organization || "",
    });
  }, [editAttendee]);

  const handleSave = async () => {
    if (!editAttendee) return;
    if (editForm.phone.trim() && !validatePhone(editForm.phone)) {
      toast.error(
        "Invalid mobile number. Enter 10 digits or 12 digits with country code.",
      );
      return;
    }

    try {
      const saved = await updateAttendee(
        editAttendee.id,
        editForm,
        editAttendee,
      );
      if (saved) {
        setAttendees((prev) =>
          prev.map((item) => (item.id === saved.id ? saved : item)),
        );
      }
      setEditAttendee(null);
      toast.success("Registrant updated successfully.");
    } catch (err) {
      toast.error(err?.message || "Unable to save registrant.");
    }
  };

  return (
    <div className="container-fluid p-2 fade-in" style={{ background: "var(--page-bg)", minHeight: "100%" }}>
      <div className="card shadow-sm mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="card-body p-3" style={{ background: "transparent" }}>
          <div className="d-flex flex-column flex-md-row align-items-start gap-3">
            <div style={{ minWidth: 220, maxWidth: 360, width: "100%" }}>
              <label className="form-label small fw-semibold mb-1">Event</label>
              <select
                className="form-select form-select-sm"
                value={selectedEventId || ""}
                onChange={(e) => setSelectedEventId(e.target.value)}
              >
                {filteredEvents.length > 0 ? (
                  filteredEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.eventName}
                    </option>
                  ))
                ) : (
                  <option value="">No events found</option>
                )}
              </select>
            </div>
          </div>
          {selectedEvent ? (
            <div className="mt-3 d-flex flex-column flex-md-row align-items-center gap-2">
              <span
                className="badge rounded-pill"
                style={{ background: "#eef2ff", color: "#1d4ed8" }}
              >
                {selectedEvent.eventName}
              </span>
              <span className="text-muted small">
                {attendees.length} registrant{attendees.length === 1 ? "" : "s"}
              </span>
            </div>
          ) : (
            <div className="mt-3 text-muted small">
              Choose an event to view its registrants.
            </div>
          )}
        </div>
      </div>

      {editAttendee && (
        <div className="card shadow-sm mb-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="card-body p-3" style={{ background: "transparent" }}>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3 flex-column flex-md-row">
              <div>
                <div className="fw-semibold">Edit Registrant</div>
                <div className="small text-muted">
                  Update name, mobile, category or organisation.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setEditAttendee(null)}
              >
                <FiX size={14} /> Close
              </button>
            </div>
            <div className="row g-3">
              <div className="col-12 col-md-3">
                <label className="form-label small fw-semibold mb-1">
                  Name
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small fw-semibold mb-1">
                  Mobile Number
                </label>
                <input
                  type="text"
                  className={`form-control form-control-sm${phoneHasError ? " is-invalid" : ""}`}
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small fw-semibold mb-1">
                  Category
                </label>
                {categoryOptions.length > 0 ? (
                  <select
                    className="form-select form-select-sm"
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select category</option>
                    {categoryOptions.map((option) => {
                      const value = option.label || option.name || "";
                      return (
                        <option key={option.id || value} value={value}>
                          {value || "Unknown"}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={editForm.category}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label small fw-semibold mb-1">
                  Organisation
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  value={editForm.organization}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      organization: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setEditAttendee(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSave}
              >
                <FiEdit2 size={14} className="me-1" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card shadow-sm h-100" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="card-body p-3" style={{ background: "transparent" }}>
          <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-3">
            <div>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                <h5 className="fw-semibold mb-0">Registrants</h5>
                {selectedEvent && (
                  <span
                    className="badge rounded-pill"
                    style={{
                      background: "#eef2ff",
                      color: "#1d4ed8",
                      fontSize: 12,
                    }}
                  >
                    {selectedEvent.eventName}
                  </span>
                )}
              </div>
              <div className="small text-muted">
                Filter events on the left to choose which registrants to show.
              </div>
            </div>
            <div
              className="input-group input-group-sm"
              style={{ maxWidth: 320, width: "100%" }}
            >
              <span className="input-group-text">
                <FiSearch size={14} />
              </span>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search name or mobile..."
                value={attendeeQuery}
                onChange={(e) => setAttendeeQuery(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">
              Loading registrants…
            </div>
          ) : !selectedEvent ? (
            <div className="text-center py-5 text-muted">
              No event selected.
            </div>
          ) : filteredAttendees.length === 0 ? (
            <div className="text-center py-5 text-muted">
              No registrants found.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead style={{ background: "var(--background)" }}>
                  <tr>
                    <th>Name</th>
                    <th>Mobile Number</th>
                    <th>Pass</th>
                    <th>Category</th>
                    <th>Organisation</th>
                    <th>Registration Date</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendees.map((attendee) => (
                    <tr key={attendee.id}>
                      <td>{attendee.name || "—"}</td>
                      <td>{attendee.phone || "—"}</td>
                      <td>
                        {attendee.passId ? (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            title="View Pass"
                            onClick={() => setPassPreviewAttendee(attendee)}
                          >
                            <FiEye size={14} />
                          </button>
                        ) : (
                          <span className="text-muted small">No pass</span>
                        )}
                      </td>
                      <td>{attendee.category || "—"}</td>
                      <td>{attendee.organization || "—"}</td>
                      <td>{formatDateTime(attendee.createdAt)}</td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setEditAttendee(attendee)}
                        >
                          <FiEdit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {passPreviewAttendee && (
          <PassViewModal
            attendee={passPreviewAttendee}
            event={selectedEvent}
            onClose={() => setPassPreviewAttendee(null)}
          />
        )}
      </div>
    </div>
  );
};

export default RegistrantsPage;
