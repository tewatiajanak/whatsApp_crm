import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "../lib/router-shim";
import { useEventData } from "../context/EventDataContext";
import { fetchEventLogs } from "../services/api";
import { fmtDateTime } from "../../utils/date";

const ACTION_META = {
  "Event Created":      { icon: "bi-plus-circle",   color: "var(--success)" },
  "Event Updated":      { icon: "bi-pencil",         color: "var(--info)" },
  "Event Deleted":      { icon: "bi-trash",          color: "var(--destructive)" },
  "Attendees Imported": { icon: "bi-cloud-upload",   color: "var(--info)" },
  "Attendee Updated":   { icon: "bi-person-check",   color: "var(--warning)" },
  "Attendee Deleted":   { icon: "bi-person-x",       color: "var(--destructive)" },
  "Pass Design Saved":  { icon: "bi-qr-code",        color: "var(--primary)" },
  "Passes Downloaded":  { icon: "bi-download",       color: "var(--success)" },
};

const fmtDate = (d) => fmtDateTime(d);

// Smart value renderer — handles nested objects/arrays gracefully
const renderValue = (value) => {
  if (value === null || value === undefined) return "—";

  if (Array.isArray(value)) {
    if (value.length === 0) return "None";

    if (typeof value[0] === "object" && value[0] !== null) {
      // Attendee field settings (have label + type/fieldId)
      const isFields =
        value[0]?.label !== undefined &&
        (value[0]?.type !== undefined || value[0]?.fieldId !== undefined);
      if (isFields) {
        return (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
            <thead>
              <tr style={{ fontSize: 10, color: "var(--muted-foreground)", textTransform: "uppercase" }}>
                <th style={{ fontWeight: 600, paddingBottom: 4, paddingRight: 12 }}>Field</th>
                <th style={{ fontWeight: 600, paddingBottom: 4, paddingRight: 12 }}>Type</th>
                <th style={{ fontWeight: 600, paddingBottom: 4, paddingRight: 12 }}>Used</th>
                <th style={{ fontWeight: 600, paddingBottom: 4 }}>Required</th>
              </tr>
            </thead>
            <tbody>
              {value.map((f, i) => (
                <tr key={i} style={{ fontSize: 12 }}>
                  <td style={{ paddingRight: 12, paddingBottom: 2, fontWeight: 600 }}>{f.label || f.fieldId}</td>
                  <td style={{ paddingRight: 12, paddingBottom: 2, color: "var(--muted-foreground)" }}>{f.type || "—"}</td>
                  <td style={{ paddingRight: 12, paddingBottom: 2 }}>
                    {f.enabled !== false
                      ? <span style={{ color: "var(--success)", fontWeight: 600 }}>Yes</span>
                      : <span style={{ color: "var(--muted-foreground)" }}>No</span>}
                  </td>
                  <td style={{ paddingBottom: 2 }}>
                    {f.required
                      ? <span style={{ color: "var(--destructive)", fontWeight: 600 }}>Yes</span>
                      : <span style={{ color: "var(--muted-foreground)" }}>No</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      // Category settings (have label + color)
      const isCats =
        value[0]?.label !== undefined && value[0]?.color !== undefined;
      if (isCats) {
        const enabled = value.filter((c) => c.enabled !== false);
        if (enabled.length === 0) return <span style={{ color: "var(--muted-foreground)" }}>None selected</span>;
        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {enabled.map((c, i) => (
              <span
                key={i}
                style={{
                  background: c.color || "var(--muted-foreground)",
                  color: "var(--card)",
                  borderRadius: 4,
                  padding: "1px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {c.label}
              </span>
            ))}
          </div>
        );
      }

      // Generic array of objects — show count
      return <span style={{ color: "var(--muted-foreground)" }}>{value.length} item{value.length !== 1 ? "s" : ""}</span>;
    }

    return value.join(", ");
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const LABEL_MAP = {
  eventName:            "Event Name",
  startDate:            "Start Date",
  endDate:              "End Date",
  venue:                "Venue",
  organizer:            "Organizer",
  attendeeFields:       "Attendee Details",
  attendeeFieldSettings:"Attendee Details",
  categories:           "Categories",
  count:                "Count",
  names:                "Names",
  status:               "Status",
  passStatus:           "Pass Status",
  passDesignSaved:      "Pass Design",
};

const RecordBlock = ({ data, type }) => {
  if (!data || Object.keys(data).length === 0) return null;
  const isOld = type === "old";
  return (
    <div
      style={{
        background: isOld ? "var(--destructive-bg)" : "var(--success-bg)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 14px",
        marginTop: 8,
        flex: 1,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: isOld ? "var(--destructive)" : "var(--success)",
          textTransform: "uppercase",
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        {isOld ? "Old Record" : "New Record"}
      </div>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}>
            {LABEL_MAP[k] || k}:
          </span>
          <div style={{ fontSize: 12, color: isOld ? "var(--destructive)" : "var(--success)", marginTop: 2 }}>
            {renderValue(v)}
          </div>
        </div>
      ))}
    </div>
  );
};

const ActivityLogPage = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { events } = useEventData();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const selectedEvent = events.find(
    (e) => e.id === Number(eventId) || e.id === eventId,
  );

  useEffect(() => {
    setLoading(true);
    fetchEventLogs(eventId)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [eventId]);

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate("/modules/events/all")}
            className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            style={{ background: "transparent", border: 0, padding: 0 }}
          >
            <i className="bi bi-arrow-left" /> Back to Events
          </button>
          <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight truncate">
            Activity Log
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {selectedEvent?.eventName || ""}
          </p>
        </div>
        {!loading && (
          <div className="text-xs text-muted-foreground">
            {logs.length} {logs.length === 1 ? "entry" : "entries"}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-xl border bg-card">
        <div className="p-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No activity recorded yet.</div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 38 }}>
              {/* Vertical line */}
              <div
                style={{
                  position: "absolute",
                  left: 14,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "var(--border)",
                }}
              />

              {logs.map((log) => {
                const meta = ACTION_META[log.action] || {
                  icon: "bi-circle",
                  color: "var(--muted-foreground)",
                };
                const hasDiff = log.oldData || log.newData;

                return (
                  <div key={log.id || log._id} style={{ position: "relative", marginBottom: 14 }}>
                    {/* Dot */}
                    <div
                      style={{
                        position: "absolute",
                        left: -38,
                        top: 12,
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: "var(--card)",
                        border: `2px solid ${meta.color}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1,
                      }}
                    >
                      <i
                        className={`bi ${meta.icon}`}
                        style={{ fontSize: 11, color: meta.color }}
                      />
                    </div>

                    {/* Card */}
                    <div
                      style={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: "12px 16px",
                      }}
                    >
                      {/* Action + timestamp */}
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <span
                          style={{ fontSize: 13, fontWeight: 600, color: meta.color }}
                        >
                          {log.action}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
                          {fmtDate(log.changedAt)}
                        </span>
                      </div>

                      {/* Entity + who */}
                      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 4 }}>
                        {log.entityName && (
                          <span className="font-semibold text-foreground mr-1">
                            {log.entityName}
                          </span>
                        )}
                        <span>
                          Modified by{" "}
                          <strong style={{ color: "var(--foreground)" }}>
                            {log.changedBy || "Admin"}
                          </strong>
                        </span>
                      </div>

                      {/* Old + New records */}
                      {hasDiff && (
                        <div
                          className="flex gap-2 flex-wrap mt-1"
                          style={{ alignItems: "flex-start" }}
                        >
                          <RecordBlock data={log.oldData} type="old" />
                          <RecordBlock data={log.newData} type="new" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityLogPage;
