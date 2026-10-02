import DateInput from "./DateInput";
import { useState, useEffect } from "react";
import { useToast } from "../context/ToastContext";
import { leadsApi, followUpsApi, usersApi } from "../api";

export default function FollowUpSlider({ lead, onClose, statuses = [], services = [] }) {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [workload, setWorkload] = useState(null);
  const [loadingWorkload, setLoadingWorkload] = useState(false);
  const [current, setCurrent] = useState({ 
    type: "call", 
    date: new Date().toISOString().split("T")[0], 
    time: "10:00", 
    remark: "" 
  });
  const [next, setNext] = useState({ 
    type: "call", 
    date: "", 
    time: "10:00", 
    remark: "",
    assignedTo: lead.owner || ""
  });
  const [scheduling, setScheduling] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await usersApi.users();
        setUsers(res || []);
      } catch (e) {
        console.error("Failed to load users", e);
      }
    }
    loadUsers();
  }, []);

  useEffect(() => {
    if (!next.assignedTo) {
      setWorkload(null);
      return;
    }
    async function fetchWorkload() {
      setLoadingWorkload(true);
      try {
        const res = await followUpsApi.getWorkload(next.assignedTo);
        setWorkload(res);
      } catch (e) {
        console.error("Failed to fetch workload", e);
      } finally {
        setLoadingWorkload(false);
      }
    }
    fetchWorkload();
  }, [next.assignedTo]);

  const handleClose = () => {
    setIsClosing(true);
  };

  const setCurr = (k, v) => setCurrent(f => ({ ...f, [k]: v }));
  const setNext_ = (k, v) => setNext(f => ({ ...f, [k]: v }));

  async function schedule() {
    // Validation: Current follow-up must have date and remark
    if (!current.date || !current.remark.trim()) {
      toast("Current follow-up: Date and remark are required", "error");
      return;
    }

    // Validation: Next follow-up must have date and remark
    if (!next.date || !next.remark.trim()) {
      toast("Next follow-up: Date and remark are required", "error");
      return;
    }

    setScheduling(true);
    try {
      // Call API to schedule follow-ups
      await leadsApi.addFollowUp(lead._id, { current, next });
      toast("Follow-up logged and scheduled successfully");
      setCurrent({ type: "call", date: new Date().toISOString().split("T")[0], time: "10:00", remark: "" });
      setNext({ type: "call", date: "", time: "10:00", remark: "", assignedTo: lead.owner || "" });
      onClose();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setScheduling(false);
    }
  }

  const followUpTypes = [
    { value: "call", icon: "telephone", label: "Call" },
    { value: "email", icon: "envelope", label: "Email" },
    { value: "whatsapp", icon: "chat-dots", label: "WhatsApp" },
    { value: "sms", icon: "chat-left-text", label: "SMS" }
  ];

  const statusMap = Object.fromEntries((statuses || []).map((s) => [s._id, s]));
  const serviceMap = Object.fromEntries((services || []).map((s) => [s._id, s]));
  const followUpHistory = lead.followUps || [];

  return (
    <>
      <div className="offcanvas-backdrop fade show" onClick={handleClose}></div>
      <div
        className="offcanvas offcanvas-end show"
        style={{
          visibility: "visible",
          width: 550,
          animation: isClosing ? "slideOutRight 0.5s ease-out forwards" : "slideInRight 0.5s ease-out"
        }}
        onAnimationEnd={() => isClosing && onClose()}
      >
        <div className="offcanvas-header border-bottom">
          <h5 className="offcanvas-title">Schedule Follow-up</h5>
          <button className="btn-close" onClick={handleClose}></button>
        </div>

        <div className="offcanvas-body" style={{ overflowY: "auto", maxHeight: "calc(100vh - 100px)" }}>
          {/* Lead Info */}
          <div className="mb-4 pb-3 border-bottom">
            <div style={{ fontSize: 11, color: "var(--text-2)", textTransform: "uppercase", marginBottom: 8 }}>Lead</div>
            <div className="fw-semibold">{lead.name}</div>
            <div className="text-muted small">{lead.phone}</div>
          </div>

          {/* Lead Services & Status */}
          {(lead.serviceTracks || []).length > 0 && (
            <div className="mb-4 pb-3 border-bottom">
              <div style={{ fontSize: 11, color: "var(--text-2)", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>
                <i className="bi bi-briefcase me-1"></i>Services & Status
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {(lead.serviceTracks || []).map((track, idx) => {
                  const svc = serviceMap[track.service?._id || track.service] || {};
                  const st = statusMap[track.status] || {};
                  return (
                    <div key={idx} className="badge" style={{ background: st.color || "#79838f", fontSize: 11, padding: "6px 10px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{svc.name || "Service"}</span>
                      <span style={{ fontSize: 10, opacity: 0.8 }}>•</span>
                      <span>{st.name || "—"}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CURRENT FOLLOW-UP */}
          <div className="mb-4 p-3 border rounded" style={{ background: "var(--surface-2)", borderLeft: "4px solid #0085a8" }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#0085a8", marginBottom: 12 }}>
              <i className="bi bi-chat-left-fill me-1"></i>Current Follow-up (Today)
            </div>

            {/* Type, Date, Time in single row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: 12 }}>
              <div>
                <label className="form-label small" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                  <i className="bi bi-chat-dots me-1"></i>Type
                </label>
                <select
                  className="form-select form-select-sm"
                  value={current.type}
                  onChange={(e) => setCurr("type", e.target.value)}
                >
                  {followUpTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label small" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                  <i className="bi bi-calendar-event me-1"></i>Date <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <DateInput
                  className="form-control form-control-sm"
                  style={{ borderColor: !current.date ? "#fca5a5" : undefined }}
                  value={current.date}
                  onChange={(e) => setCurr("date", e.target.value)}
                />
              </div>

              <div>
                <label className="form-label small" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                  <i className="bi bi-clock me-1"></i>Time
                </label>
                <input
                  type="time"
                  className="form-control form-control-sm"
                  value={current.time}
                  onChange={(e) => setCurr("time", e.target.value)}
                />
              </div>
            </div>

            {/* Remark */}
            <div>
              <label className="form-label small" style={{ fontSize: 11, fontWeight: 600 }}>
                <i className="bi bi-chat-left-quote me-1"></i>What was discussed? <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                placeholder="e.g., Discussed fee structure, student confirmed campus visit"
                value={current.remark}
                onChange={(e) => setCurr("remark", e.target.value)}
                style={{ fontSize: 12, borderColor: !current.remark.trim() ? "#fca5a5" : undefined }}
              />
            </div>
          </div>

          {/* NEXT FOLLOW-UP */}
          <div className="mb-4 p-3 border rounded" style={{ background: "var(--surface-2)", borderLeft: "4px solid #25d366" }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#25d366", marginBottom: 12 }}>
              <i className="bi bi-calendar-plus me-1"></i>Next Follow-up
            </div>

            {/* Type, Date, Time in single row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: 12 }}>
              <div>
                <label className="form-label small" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                  <i className="bi bi-chat-dots me-1"></i>Type
                </label>
                <select
                  className="form-select form-select-sm"
                  value={next.type}
                  onChange={(e) => setNext_("type", e.target.value)}
                >
                  {followUpTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label small" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                  <i className="bi bi-calendar-event me-1"></i>Date <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <DateInput
                  className="form-control form-control-sm"
                  style={{ borderColor: !next.date ? "#fca5a5" : undefined }}
                  value={next.date}
                  onChange={(e) => setNext_("date", e.target.value)}
                />
              </div>

              <div>
                <label className="form-label small" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                  <i className="bi bi-clock me-1"></i>Time
                </label>
                <input
                  type="time"
                  className="form-control form-control-sm"
                  value={next.time}
                  onChange={(e) => setNext_("time", e.target.value)}
                />
              </div>
            </div>

            {/* Remark */}
            <div className="mb-3">
              <label className="form-label small" style={{ fontSize: 11, fontWeight: 600 }}>
                <i className="bi bi-chat-left-quote me-1"></i>What to discuss next? <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <textarea
                className="form-control form-control-sm"
                rows={2}
                placeholder="e.g., Confirm documents submission, Finalize admission"
                value={next.remark}
                onChange={(e) => setNext_("remark", e.target.value)}
                style={{ fontSize: 12, borderColor: !next.remark.trim() ? "#fca5a5" : undefined }}
              />
            </div>

            {/* Assign to Dropdown */}
            <div className="mb-3">
              <label className="form-label small" style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                <i className="bi bi-person me-1"></i>Assign To
              </label>
              <select
                className="form-select form-select-sm"
                value={next.assignedTo}
                onChange={(e) => setNext_("assignedTo", e.target.value)}
                style={{ fontSize: 12 }}
              >
                <option value="">Select counsellor</option>
                {users.map((u) => (
                  <option key={u._id} value={u.name}>{u.name} ({u.role || "User"})</option>
                ))}
              </select>
            </div>

            {/* Workload Indicator */}
            {loadingWorkload && (
              <div className="d-flex align-items-center gap-2 mt-2" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                <div className="spinner-border spinner-border-sm" role="status"></div>
                <span>Checking counsellor workload...</span>
              </div>
            )}
            {!loadingWorkload && workload && (
              <div className="mt-3 p-3 rounded border" style={{ background: "white", fontSize: 11 }}>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="fw-semibold text-muted">Counsellor Workload:</span>
                  <span className={`badge ${workload.pending >= workload.capacity ? "bg-danger" : "bg-success"}`} style={{ fontSize: 10 }}>
                    {workload.pending} / {workload.capacity} Capacity
                  </span>
                </div>
                <div className="progress mb-2" style={{ height: "6px" }}>
                  <div 
                    className={`progress-bar ${workload.pending >= workload.capacity ? "bg-danger" : "bg-success"}`} 
                    role="progressbar" 
                    style={{ width: `${Math.min(100, (workload.pending / workload.capacity) * 100)}%` }}
                  ></div>
                </div>
                <div className="d-flex justify-content-between mt-2 text-muted" style={{ fontSize: 10 }}>
                  <span>Completed today: {workload.completed}</span>
                  {workload.nextDate && <span>Next due: {new Date(workload.nextDate).toLocaleDateString()}</span>}
                </div>
              </div>
            )}
          </div>

          {/* Schedule Button */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: 20 }}>
            <button className="btn btn-outline-secondary" onClick={onClose} disabled={scheduling}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={scheduling} onClick={schedule}>
              {scheduling && <span className="spinner-border spinner-border-sm me-2" />}
              <i className="bi bi-calendar-check me-1"></i>Save & Schedule
            </button>
          </div>

          {/* Follow-up History */}
          <div className="border-top pt-3">
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "var(--text-2)", marginBottom: 12 }}>
              <i className="bi bi-list-ul me-1"></i>Follow-up History
            </div>
            <div style={{ maxHeight: 150, overflowY: "auto" }}>
              {followUpHistory.length === 0 ? (
                <div className="text-muted text-center py-3" style={{ fontSize: 12 }}>
                  <i className="bi bi-inbox me-1"></i>No follow-ups yet
                </div>
              ) : (
                <ul className="list-unstyled">
                  {followUpHistory.map((fu, idx) => (
                    <li key={idx} className="py-2 px-2 border-bottom small">
                      <div className="fw-semibold">{new Date(fu.dueDate || fu.due).toLocaleDateString()} at {fu.dueTime || "10:00"}</div>
                      <div className="text-muted">{fu.remark || fu.note}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
