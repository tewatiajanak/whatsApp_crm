import React, { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { useEventData } from "../context/EventDataContext";
import { fetchAttendees } from "../services/api";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  FiCamera,
  FiCameraOff,
  FiCheck,
  FiClipboard,
  FiArrowUp,
  FiArrowDown,
  FiTrash2,
  FiX,
  FiRefreshCcw,
  FiChevronRight,
} from "react-icons/fi";
import { AiOutlineCalendar } from "react-icons/ai";

const DEFAULT_CATEGORIES = [
  { name: "VIP", color: "var(--warning)" },
  { name: "General", color: "var(--info)" },
  { name: "Staff", color: "var(--success)" },
  { name: "Speaker", color: "#8B5CF6" },
];

const DEFAULT_SCAN_CONFIG = {
  allowCheckout: true,
  requireConfirmation: false,
  showStatsOnScan: true,
  enableManualCheckin: true,
  autoClosePopup: true,
  showCategoryBadge: true,
};

const getCatColor = (name) =>
  DEFAULT_CATEGORIES.find((c) => c.name.toLowerCase() === name?.toLowerCase())
    ?.color || "var(--muted-foreground)";

// ── Event Multi-Select Dropdown ───────────────────────────────────────────────

const EventMultiSelect = ({ events, selectedIds, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (eventId) => {
    const newSelected = selectedIds.includes(eventId)
      ? selectedIds.filter((id) => id !== eventId)
      : [...selectedIds, eventId];
    onChange(newSelected.length > 0 ? newSelected : []);
  };

  const selectedEvents = events.filter((e) => selectedIds.includes(e.id));

  return (
    <div className="position-relative" ref={dropdownRef} style={{ zIndex: 1000 }}>
      <button
        type="button"
        className="btn btn-outline-secondary w-100 text-start d-flex justify-content-between align-items-center"
        onClick={() => setIsOpen(!isOpen)}
        style={{ padding: "8px 10px", borderRadius: 6, fontSize: 13 }}
      >
        <span>
          {selectedEvents.length > 0 ? (
            <span>
              <strong>{selectedEvents.length}</strong> event{selectedEvents.length !== 1 ? "s" : ""}
            </span>
          ) : (
            "Select events..."
          )}
        </span>
        <FiChevronRight
          size={14}
          style={{
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        />
      </button>

      {isOpen && (
        <div
          className="card border shadow-sm mt-1 position-absolute w-100"
          style={{
            maxHeight: 250,
            overflowY: "auto",
            top: "100%",
            left: 0,
            borderRadius: 6,
            zIndex: 1001,
          }}
        >
          <div className="card-body p-0">
            {events.length === 0 ? (
              <div className="p-2 text-muted small text-center">No events available</div>
            ) : (
              events.map((e) => (
                <label
                  key={e.id}
                  className="d-flex align-items-center gap-2 px-3 py-2 mb-0 cursor-pointer"
                  style={{
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                  onMouseEnter={(el) => (el.currentTarget.style.background = "var(--background)")}
                  onMouseLeave={(el) => (el.currentTarget.style.background = "transparent")}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(e.id)}
                    onChange={() => handleToggle(e.id)}
                    className="form-check-input"
                    style={{ margin: 0, cursor: "pointer", minWidth: 16 }}
                  />
                  <div className="flex-grow-1 min-width-0">
                    <div className="fw-semibold text-truncate" style={{ fontSize: 12 }}>
                      {e.eventName}
                    </div>
                    <div className="text-muted" style={{ fontSize: 10 }}>
                      {e.venue || "No venue"} · {e.attendeeCount || 0} registrants
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Event Selector ────────────────────────────────────────────────────────────

const EventSelector = ({ events, loading, today, onSelect, onLogout }) => {
  const getStatus = (event) => {
    if (event.startDate <= today && event.endDate >= today)
      return { label: "Today", cls: "bg-success" };
    if (event.startDate > today)
      return { label: "Upcoming", cls: "bg-info text-dark" };
    return { label: "Past", cls: "bg-secondary" };
  };

  return (
    <div
      className="d-flex flex-column align-items-center justify-content-center"
      style={{ minHeight: "85vh", padding: "16px", background: "var(--page-bg)" }}
    >
      <div
        className="card shadow-sm"
        style={{ width: "min(420px, 100%)", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="card-body p-4" style={{ background: "transparent" }}>
          <div className="d-flex align-items-center gap-2 mb-1">
            <AiOutlineCalendar size={22} style={{ color: "var(--primary)" }} />
            <h5 className="fw-bold mb-0" style={{ color: "var(--foreground)" }}>Select Event</h5>
          </div>
          <p className="small mb-4" style={{ color: "var(--muted-foreground)" }}>Active events for today.</p>

          {loading ? (
            <div className="text-center py-4 text-muted small">
              <div
                className="spinner-border spinner-border-sm me-2"
                role="status"
              />
              Loading events…
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-4">
              <div className="fw-semibold mt-2" style={{ color: "var(--foreground)" }}>No active events today</div>
              <div className="small mt-1" style={{ color: "var(--muted-foreground)" }}>
                Only events running today are shown here.
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {events.map((event) => {
                const st = getStatus(event);
                return (
                  <button
                    key={event.id}
                    type="button"
                    className="btn btn-outline-secondary text-start d-flex align-items-center gap-3 p-3"
                    style={{ borderRadius: 10 }}
                    onClick={() => onSelect(event.id)}
                  >
                    <div className="flex-grow-1 min-width-0">
                      <div className="fw-semibold text-truncate">
                        {event.eventName}
                      </div>
                      <div className="text-muted small">
                        {event.startDate} – {event.endDate}
                        {event.venue ? ` · ${event.venue}` : ""}
                      </div>
                      <div className="mt-1">
                        <span
                          className={`badge ${st.cls}`}
                          style={{ fontSize: 10 }}
                        >
                          {st.label}
                        </span>
                        {event.attendeeCount > 0 && (
                          <span
                            className="text-muted ms-2"
                            style={{ fontSize: 11 }}
                          >
                            {event.attendeeCount} registrants
                          </span>
                        )}
                      </div>
                    </div>
                    <FiChevronRight
                      size={16}
                      className="text-muted flex-shrink-0"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Scan Popup Modal ──────────────────────────────────────────────────────────

const ScanPopup = ({
  attendee,
  rawValue,
  scanMode,
  onConfirm,
  onClose,
  config,
}) => {
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    if (!config.autoClosePopup) return undefined;

    const t = setInterval(
      () =>
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(t);
            onClose();
          }
          return c - 1;
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [config.autoClosePopup, onClose]);

  const actionLabel = scanMode === "entry" ? "Check In" : "Check Out";
  const actionColor = scanMode === "entry" ? "var(--success)" : "var(--warning)";

  if (!attendee) {
    return (
      <div
        className="scan-modal-overlay"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="scan-popup scan-popup--error">
          <button
            type="button"
            className="btn-close scan-popup__close"
            onClick={onClose}
          />
          <div style={{ fontSize: 40, textAlign: "center" }}>❓</div>
          <h5 className="fw-bold text-center mt-2">Unknown Pass</h5>
          <p className="text-muted text-center small">
            No registrant matched:
            <br />
            <code>{rawValue}</code>
          </p>
          <button
            type="button"
            className="btn btn-outline-secondary w-100 btn-sm mt-2"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const alreadyCheckedIn = attendee.status === "checked-in";
  const alreadyCheckedOut = attendee.status === "checked-out";

  const handleConfirmClick = () => {
    // Instant confirmation without dialog
    onConfirm(scanMode === "entry" ? "checked-in" : "checked-out");
  };

  return (
    <div
      className="scan-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="scan-popup">
        <button
          type="button"
          className="btn-close scan-popup__close"
          onClick={onClose}
        />

        <div className="d-flex justify-content-between align-items-center mb-3">
          {config.showCategoryBadge && attendee.category ? (
            <span
              className="badge"
              style={{
                background: getCatColor(attendee.category),
                color: "var(--card)",
                fontSize: 12,
                padding: "5px 12px",
              }}
            >
              {attendee.category}
            </span>
          ) : (
            <span />
          )}
          <span
            className={`badge ${attendee.status === "checked-in" ? "bg-success" : attendee.status === "checked-out" ? "bg-warning text-dark" : "bg-secondary"}`}
          >
            {attendee.status === "checked-in"
              ? "Checked In"
              : attendee.status === "checked-out"
                ? "Checked Out"
                : "Registered"}
          </span>
        </div>

        <h4 className="fw-bold mb-1">{attendee.name}</h4>
        {attendee.organization && (
          <p className="text-muted small mb-1">🏢 {attendee.organization}</p>
        )}
        {attendee.phone && (
          <p className="text-muted small mb-1">📞 {attendee.phone}</p>
        )}
        {attendee.email && (
          <p className="text-muted small mb-2">✉ {attendee.email}</p>
        )}

        <div className="mb-3">
          <code style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            {attendee.passId}
          </code>
        </div>

        {alreadyCheckedIn && attendee.checkInTime && (
          <div className="alert alert-success py-2 small mb-3">
            ✅ Checked in at{" "}
            {new Date(attendee.checkInTime).toLocaleTimeString()}
          </div>
        )}
        {alreadyCheckedOut && attendee.checkOutTime && (
          <div className="alert alert-warning py-2 small mb-3">
            ⬆ Checked out at{" "}
            {new Date(attendee.checkOutTime).toLocaleTimeString()}
          </div>
        )}

        <button
          type="button"
          className="btn w-100 fw-bold mb-2"
          style={{
            background: actionColor,
            color: "var(--card)",
            borderColor: actionColor,
          }}
          onClick={handleConfirmClick}
        >
          {scanMode === "entry" ? (
            <FiArrowDown className="me-2" />
          ) : (
            <FiArrowUp className="me-2" />
          )}
          {actionLabel}
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary w-100 btn-sm"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// ── Attendee List with search ─────────────────────────────────────────────────

const AttendeeList = ({
  attendees,
  statFilter,
  getCatColor,
  showCategoryBadge,
  selectedEvents,
  allAttendees,
}) => {
  const [input, setInput] = React.useState("");
  const [submitted, setSubmitted] = React.useState("");

  const handleSearch = () => setSubmitted(input.trim());
  const handleClear = () => {
    setInput("");
    setSubmitted("");
  };

  // If search submitted → search ALL attendees ignoring stat filter
  // Otherwise → show stat-filtered list
  const list = React.useMemo(() => {
    if (submitted) {
      const q = submitted.toLowerCase();
      const digits = submitted.replace(/\D/g, "");
      return attendees.filter(
        (a) =>
          a.name?.toLowerCase().includes(q) ||
          (digits.length >= 3 && a.phone?.replace(/\D/g, "").includes(digits)),
      );
    }
    return attendees.filter((a) => {
      if (statFilter === "all") return true;
      if (statFilter === "registered")
        return !a.status || a.status === "registered";
      return a.status === statFilter;
    });
  }, [attendees, statFilter, submitted]);

  return (
    <>
      {/* Search bar with submit */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="d-flex gap-2 mb-2"
      >
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="Search by name or mobile…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn btn-sm btn-primary px-3">
          <FiCheck size={14} />
        </button>
        {submitted && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={handleClear}
          >
            <FiX size={14} />
          </button>
        )}
      </form>

      {submitted && (
        <div className="text-muted small mb-2">
          {list.length} result{list.length !== 1 ? "s" : ""} for{" "}
          <strong>"{submitted}"</strong>
        </div>
      )}

      {list.length === 0 ? (
        <div className="text-center text-muted small py-3">
          No registrants found.
        </div>
      ) : (
        <div
          style={{ maxHeight: 300, overflowY: "auto" }}
          className="d-flex flex-column gap-1"
        >
          {list.map((a) => {
            const eventName = selectedEvents.length > 1
              ? selectedEvents.find((e) => e.id === a.eventId)?.eventName
              : null;
            return (
              <div
                key={a.id}
                className="border rounded-2 p-2"
                style={{ background: "var(--background)", fontSize: 12, borderColor: "var(--border)" }}
              >
                <div className="d-flex align-items-start justify-content-between gap-2 mb-1">
                  <div className="min-width-0 flex-grow-1">
                    <div className="fw-semibold text-truncate">{a.name}</div>
                    {a.phone && (
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        📱 {a.phone}
                      </div>
                    )}
                    {eventName && (
                      <div className="text-muted" style={{ fontSize: 10, marginTop: 2 }}>
                        📍 <strong>{eventName}</strong>
                      </div>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-1 flex-shrink-0">
                    {showCategoryBadge && a.category && (
                      <span
                        className="badge"
                        style={{
                          background: getCatColor(a.category),
                          color: "var(--card)",
                          fontSize: 9,
                          padding: "3px 6px",
                        }}
                      >
                        {a.category}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`badge ${a.status === "checked-in" ? "bg-success" : a.status === "checked-out" ? "bg-warning text-dark" : "bg-secondary"}`}
                  style={{ fontSize: 9 }}
                >
                  {a.status === "checked-in"
                    ? "Checked In"
                    : a.status === "checked-out"
                      ? "Checked Out"
                      : "Registered"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

// ── Main Scanner ──────────────────────────────────────────────────────────────

const Scanner = ({ attendees, events, selectedEvent, onChangeEvent, onEventSelect, onUpdateAttendee }) => {
  const { updateAttendeeStatus } = useEventData();
  const [config] = useLocalStorage("app_config", DEFAULT_SCAN_CONFIG);
  const [selectedEventIds, setSelectedEventIds] = useState(
    Array.isArray(selectedEvent)
      ? selectedEvent.map(e => e.id).filter(Boolean)
      : selectedEvent?.id ? [selectedEvent.id] : []
  );

  const handleEventSelect = (ids) => {
    setSelectedEventIds(ids);
    onEventSelect(ids);
  };

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const pollRef = useRef(null);
  const lastRawRef = useRef(null);
  const lastRawTimer = useRef(null);

  const [scanMode, setScanMode] = useState("entry");
  const [inputMode, setInputMode] = useState("scan"); // "scan" | "search"
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [popup, setPopup] = useState(null);
  const [manualValue, setManualValue] = useState("");
  const [statFilter, setStatFilter] = useState("checked-in"); // default shows checked-in
  const [searchResults, setSearchResults] = useState([]);
  const [scanLog, setScanLog] = useLocalStorage("scan_log", []);
  const [detectorReady, setDetectorReady] = useState(false);

  const selectedEvents = events.filter((e) => selectedEventIds.includes(e.id));

  useEffect(() => {
    setDetectorReady("BarcodeDetector" in window);
  }, []);

  // Sync selected events from parent when they change
  useEffect(() => {
    if (Array.isArray(selectedEvent)) {
      const eventIds = selectedEvent.map(e => e.id).filter(Boolean);
      setSelectedEventIds(eventIds);
    }
  }, [selectedEvent]);


  // For QR camera scan — match by Pass ID only
  const findAttendee = useCallback(
    (raw) => attendees.find((a) => a.passId === raw || a.id === raw) || null,
    [attendees],
  );

  // For manual lookup — auto-detects mobile vs name, returns ALL matches from selected events
  const findAttendees = useCallback(
    (query) => {
      const q = query.trim();
      if (!q) return [];
      const phoneClean = q.replace(/\D/g, "");
      // If input is all digits (7+), treat as mobile
      if (phoneClean.length >= 7 && phoneClean === q.replace(/[\s\+\-]/g, "")) {
        return attendees.filter((a) => {
          const stored = a.phone?.replace(/\D/g, "") || "";
          return (
            stored === phoneClean ||
            stored.endsWith(phoneClean) ||
            phoneClean.endsWith(stored)
          );
        });
      }
      // Otherwise search by name
      return attendees.filter((a) =>
        a.name?.toLowerCase().includes(q.toLowerCase()),
      );
    },
    [attendees],
  );

  const handleRaw = useCallback(
    (raw) => {
      if (!raw || raw === lastRawRef.current) return;
      lastRawRef.current = raw;
      clearTimeout(lastRawTimer.current);
      lastRawTimer.current = setTimeout(() => {
        lastRawRef.current = null;
      }, 4000);

      const attendee = findAttendee(raw);
      setPopup({ attendee, rawValue: raw });
    },
    [findAttendee],
  );

  const handleConfirm = (status) => {
    if (!popup?.attendee) return;
    if (status === "checked-out" && !config.allowCheckout) {
      toast.info("Check-out is disabled in configuration.");
      return;
    }
    updateAttendeeStatus(popup.attendee.id, status);

    // Update main attendees list via callback
    onUpdateAttendee(popup.attendee.id, status);

    const entry = {
      id: Date.now(),
      attendeeId: popup.attendee.id,
      attendeeName: popup.attendee.name,
      eventId: selectedEvents[0]?.id,
      eventName: selectedEvents[0]?.eventName,
      type: scanMode,
      status,
      timestamp: new Date().toISOString(),
    };
    setScanLog((prev) => [entry, ...prev].slice(0, 300));
    toast.success(
      `${status === "checked-in" ? "✅ Check-in" : "⬆ Check-out"}: ${popup.attendee.name}`,
      { autoClose: 500 },
    );
    setPopup(null);
  };

  const startCamera = async () => {
    setCameraError("");
    const attempts = [
      {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      { video: { facingMode: "environment" } },
      { video: true },
    ];

    for (const constraint of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraint);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraOn(true);
        setCameraError("");

        if (detectorReady) {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          pollRef.current = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) handleRaw(codes[0].rawValue);
            } catch {
              /* ignore */
            }
          }, 300);
        }
        return;
      } catch (err) {
        if (err.name === "NotAllowedError") {
          setCameraError(
            "❌ Camera permission denied. Please enable camera access in your browser settings.",
          );
          return;
        }
      }
    }
    setCameraError(
      "⚠️ Camera not available. Use manual search or upload QR code image below.",
    );
  };

  const stopCamera = () => {
    clearInterval(pollRef.current);
    clearTimeout(lastRawTimer.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  // Auto-start camera when scan mode is active; stop when switching to search
  useEffect(() => {
    if (inputMode === "scan") {
      startCamera();
    } else {
      stopCamera();
    }
  }, [inputMode]); // eslint-disable-line

  useEffect(() => {
    if (!config.enableManualCheckin && inputMode === "search") {
      setInputMode("scan");
    }
  }, [config.enableManualCheckin, inputMode]);

  useEffect(() => () => stopCamera(), []);

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const q = manualValue.trim();
    if (!q) return;
    const results = findAttendees(q);
    setSearchResults(results);
    if (results.length === 0) {
      setPopup({ attendee: null, rawValue: q });
    }
  };

  const handleDirectAction = (attendee, status) => {
    if (status === "checked-out" && !config.allowCheckout) {
      toast.info("Check-out is disabled in configuration.");
      return;
    }
    // Update context (API call)
    updateAttendeeStatus(attendee.id, status);

    // Update UI immediately
    setSearchResults((prev) =>
      prev.map((a) => (a.id === attendee.id ? { ...a, status } : a)),
    );

    // Update main attendees list via callback
    onUpdateAttendee(attendee.id, status);

    const entry = {
      id: Date.now(),
      attendeeId: attendee.id,
      attendeeName: attendee.name,
      eventId: selectedEvents[0]?.id,
      eventName: selectedEvents[0]?.eventName,
      type: status === "checked-in" ? "entry" : "exit",
      status,
      timestamp: new Date().toISOString(),
    };
    setScanLog((prev) => [entry, ...prev].slice(0, 300));
    toast.success(
      `${status === "checked-in" ? "✅ Check-in" : "⬆ Check-out"}: ${attendee.name}`,
      { autoClose: 500 },
    );
  };

  const clearLog = () => {
    setScanLog([]);
    toast.info("Log cleared.");
  };

  return (
    <>
      <div className="container-fluid p-2 fade-in">
        {/* Header */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body p-3">
            <div className="d-flex align-items-center gap-3">
              <h2 className="fw-bold mb-0">Scan Entry</h2>
              {events.length > 0 && (
                <div style={{ minWidth: 280 }}>
                  <EventMultiSelect
                    events={events}
                    selectedIds={selectedEventIds.filter(Boolean)}
                    onChange={handleEventSelect}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="row g-3">
          {/* Left: controls */}
          <div className="col-lg-6">
            {/* Scan or Search switcher */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body p-3">
                <div className="d-flex gap-2 mb-3">
                  <button
                    type="button"
                    className={`btn flex-fill fw-semibold ${inputMode === "scan" ? "btn-primary" : "btn-outline-secondary"}`}
                    onClick={() => {
                      setInputMode("scan");
                      setSearchResults([]);
                      if (inputMode !== "scan") stopCamera();
                    }}
                  >
                    <FiCamera className="me-1" /> Scan QR
                  </button>
                  <button
                    type="button"
                    className={`btn flex-fill fw-semibold ${inputMode === "search" ? "btn-primary" : "btn-outline-secondary"}`}
                    disabled={!config.enableManualCheckin}
                    onClick={() => {
                      if (!config.enableManualCheckin) return;
                      setInputMode("search");
                      setSearchResults([]);
                      setManualValue("");
                      stopCamera();
                    }}
                  >
                    <FiClipboard className="me-1" /> Search
                  </button>
                </div>

                {/* Camera panel */}
                {inputMode === "scan" && (
                  <>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="text-muted small">
                        Point camera at QR code
                      </span>
                      {cameraOn && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => {
                            stopCamera();
                            setTimeout(startCamera, 300);
                          }}
                          title="Restart"
                        >
                          <FiRefreshCcw size={13} />
                        </button>
                      )}
                    </div>
                    <div className="d-flex gap-2 mb-3">
                      <button
                        type="button"
                        className={`btn btn-sm flex-fill ${scanMode === "entry" ? "btn-success" : "btn-outline-success"}`}
                        onClick={() => setScanMode("entry")}
                      >
                        <FiArrowDown className="me-1" /> Check In
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm flex-fill ${scanMode === "exit" ? "btn-warning" : "btn-outline-warning"}`}
                        onClick={() => setScanMode("exit")}
                        disabled={!config.allowCheckout}
                      >
                        <FiArrowUp className="me-1" /> Check Out
                      </button>
                    </div>
                    <div
                      className="scan-viewport rounded-4 overflow-hidden bg-dark position-relative"
                      style={{ aspectRatio: "4/3" }}
                    >
                      <video
                        ref={videoRef}
                        muted
                        playsInline
                        autoPlay
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: cameraOn ? "block" : "none",
                        }}
                      />
                      {!cameraOn && (
                        <div
                          className="d-flex flex-column align-items-center justify-content-center h-100 text-secondary"
                          style={{ gap: 8 }}
                        >
                          <FiCameraOff size={36} />
                          <span className="small">Tap Start Camera</span>
                        </div>
                      )}
                      {cameraOn && (
                        <div className="scan-crosshair">
                          <div className="scan-corner tl" />
                          <div className="scan-corner tr" />
                          <div className="scan-corner bl" />
                          <div className="scan-corner br" />
                          <div className="scan-line" />
                        </div>
                      )}
                    </div>
                    {cameraError && (
                      <div className="alert alert-warning mt-2 mb-0 small">
                        {cameraError}
                      </div>
                    )}
                    {cameraOn && !detectorReady && (
                      <div className="alert alert-info mt-2 mb-0 small">
                        Auto-scan not supported — use Search instead.
                      </div>
                    )}
                  </>
                )}

                {/* Search panel */}
                {inputMode === "search" && (
                  <>
                    <form
                      onSubmit={handleManualSubmit}
                      className="d-flex gap-2 mb-3"
                    >
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter name or mobile number…"
                        value={manualValue}
                        onChange={(e) => {
                          setManualValue(e.target.value);
                          setSearchResults([]);
                        }}
                        autoComplete="off"
                        autoFocus
                      />
                      <button type="submit" className="btn btn-primary px-3">
                        <FiCheck />
                      </button>
                    </form>

                    {searchResults.length > 0 && (
                      <div className="d-flex flex-column gap-2">
                        {searchResults.map((a) => {
                          const eventName = selectedEvents.find((e) => e.id === a.eventId)?.eventName;
                          return (
                          <div
                            key={a.id}
                            className="border rounded-3 p-3"
                            style={{ background: "var(--background)" }}
                          >
                            <div className="d-flex justify-content-between align-items-start mb-2">
                              <div className="flex-grow-1">
                                <div className="fw-bold">{a.name}</div>
                                {a.phone && (
                                  <div className="text-muted small">
                                    📱 {a.phone}
                                  </div>
                                )}
                                {selectedEvents.length > 1 && eventName && (
                                  <div className="text-muted small" style={{ fontSize: 11, marginTop: 4 }}>
                                    📍 <strong>{eventName}</strong>
                                  </div>
                                )}
                                {config.showCategoryBadge && a.category && (
                                  <span
                                    className="badge mt-2"
                                    style={{
                                      background: getCatColor(a.category),
                                      color: "var(--card)",
                                      fontSize: 10,
                                      display: "inline-block",
                                    }}
                                  >
                                    {a.category}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`badge ${a.status === "checked-in" ? "bg-success" : a.status === "checked-out" ? "bg-warning text-dark" : "bg-secondary"}`}
                                style={{ fontSize: 10 }}
                              >
                                {a.status === "checked-in"
                                  ? "Checked In"
                                  : a.status === "checked-out"
                                    ? "Checked Out"
                                    : "Registered"}
                              </span>
                            </div>
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-success flex-fill"
                                onClick={() =>
                                  handleDirectAction(a, "checked-in")
                                }
                                disabled={a.status === "checked-in"}
                              >
                                <FiArrowDown className="me-1" /> Check In
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-warning flex-fill"
                                onClick={() =>
                                  handleDirectAction(a, "checked-out")
                                }
                                disabled={
                                  a.status === "checked-out" ||
                                  !config.allowCheckout
                                }
                              >
                                <FiArrowUp className="me-1" /> Check Out
                              </button>
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: stats + scan log */}
          <div className="col-lg-6">
            {/* Attendance stats */}
            <div className="card border-0 shadow-sm mb-3">
              <div className="card-body p-3">
                <h6 className="fw-bold mb-3">Attendance</h6>
                {config.showStatsOnScan && (
                  <div className="row g-2 text-center mb-3">
                    {[
                      {
                        key: "all",
                        label: "Total",
                        value: attendees.length,
                        color: "#6366f1",
                        bg: "#eef2ff",
                      },
                      {
                        key: "checked-in",
                        label: "Checked In",
                        value: attendees.filter(
                          (a) => a.status === "checked-in",
                        ).length,
                        color: "#16a34a",
                        bg: "#f0fdf4",
                      },
                      {
                        key: "checked-out",
                        label: "Checked Out",
                        value: attendees.filter(
                          (a) => a.status === "checked-out",
                        ).length,
                        color: "#d97706",
                        bg: "#fffbeb",
                      },
                      {
                        key: "registered",
                        label: "Remaining",
                        value: attendees.filter(
                          (a) => !a.status || a.status === "registered",
                        ).length,
                        color: "var(--muted-foreground)",
                        bg: "var(--background)",
                      },
                    ].map(({ key, label, value, color, bg }) => (
                      <div key={key} className="col-6 col-sm-3">
                        <div
                          onClick={() => setStatFilter(key)}
                          style={{
                            background: bg,
                            borderRadius: 10,
                            padding: "10px 6px",
                            cursor: "pointer",
                            border: `2px solid ${statFilter === key ? color : "transparent"}`,
                            transition: "border 0.15s",
                          }}
                        >
                          <div style={{ fontSize: 22, fontWeight: 700, color }}>
                            {value}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                            {label}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Search within list */}
                <AttendeeList
                  attendees={attendees}
                  statFilter={statFilter}
                  getCatColor={getCatColor}
                  showCategoryBadge={config.showCategoryBadge}
                  selectedEvents={selectedEvents}
                  allAttendees={attendees}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {popup && (
        <ScanPopup
          attendee={popup.attendee}
          rawValue={popup.rawValue}
          scanMode={scanMode}
          onConfirm={handleConfirm}
          onClose={() => setPopup(null)}
          config={config}
        />
      )}
    </>
  );
};

// ── Page Root ─────────────────────────────────────────────────────────────────

const ScanPage = () => {
  const { events, eventsLoading, attendees, setSelectedEventId, setAttendees } =
    useEventData();
  const [scanEventIds, setScanEventIds] = useState([]);
  const [multiEventAttendees, setMultiEventAttendees] = useState([]);

  const today = new Date().toISOString().slice(0, 10);

  const activeEvents = events.filter(
    (e) => e.startDate <= today && e.endDate >= today,
  );

  // Auto-select first active event
  useEffect(() => {
    if (activeEvents.length > 0 && scanEventIds.length === 0) {
      const firstEvent = activeEvents[0];
      setScanEventIds([firstEvent.id]);
      setSelectedEventId(firstEvent.id);
    }
  }, [activeEvents, scanEventIds, setSelectedEventId]);

  // When multiple events are selected, fetch attendees for all of them
  useEffect(() => {
    if (scanEventIds.length > 1) {
      // Fetch attendees for each selected event and combine
      Promise.all(scanEventIds.map((eventId) => fetchAttendees(eventId)))
        .then((results) => {
          // Flatten the array of arrays into a single array
          const combined = results.flat();
          setMultiEventAttendees(combined);
        })
        .catch((err) => {
          console.error("Error fetching attendees for multiple events:", err);
        });
    } else {
      setMultiEventAttendees([]);
    }
  }, [scanEventIds]);

  const scanEvents = events.filter((e) => scanEventIds.includes(e.id));

  // Use combined multi-event attendees if multiple selected, otherwise filter by selected events
  const eventAttendees =
    scanEventIds.length > 1
      ? multiEventAttendees
      : attendees.filter((a) => scanEventIds.includes(a.eventId));

  const handleChangeEvent = () => {
    setScanEventIds([]);
    setSelectedEventId(null);
  };

  const handleEventSelect = (ids) => {
    setScanEventIds(ids);
    // For single event, use context's selectedEventId for filtering
    // For multiple events, we'll handle it via multiEventAttendees
    if (ids.length === 1) {
      setSelectedEventId(ids[0]);
    } else if (ids.length > 1) {
      // Set to null so context doesn't filter, we'll use multiEventAttendees instead
      setSelectedEventId(null);
    }
  };

  const handleUpdateAttendee = (attendeeId, status) => {
    // Update multiEventAttendees for multiple selection
    if (scanEventIds.length > 1) {
      setMultiEventAttendees((prev) =>
        prev.map((a) => (a.id === attendeeId ? { ...a, status } : a)),
      );
    }
  };

  if (eventsLoading) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center"
        style={{ minHeight: "85vh" }}
      >
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading events…</span>
        </div>
      </div>
    );
  }

  if (activeEvents.length === 0) {
    return (
      <div
        className="d-flex flex-column align-items-center justify-content-center"
        style={{ minHeight: "85vh", padding: "16px", background: "var(--page-bg)" }}
      >
        <div
          className="card shadow-sm"
          style={{
            width: "min(420px, 100%)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
          }}
        >
          <div className="card-body p-4 text-center" style={{ background: "transparent" }}>
            <AiOutlineCalendar size={48} style={{ color: "var(--primary)", marginBottom: 16 }} />
            <h5 className="fw-bold mb-2" style={{ color: "var(--foreground)" }}>No Active Events</h5>
            <p className="small mb-0" style={{ color: "var(--muted-foreground)" }}>
              There are no active events today. Check back later!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Scanner
      attendees={eventAttendees}
      events={activeEvents}
      selectedEvent={scanEvents}
      onChangeEvent={handleChangeEvent}
      onEventSelect={handleEventSelect}
      onUpdateAttendee={handleUpdateAttendee}
    />
  );
};

export default ScanPage;
