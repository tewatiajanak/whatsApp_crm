import { useState } from "react";
import { followUpsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState } from "../components/ui";

const ICON = { Call: "telephone", WhatsApp: "whatsapp", Email: "envelope", Visit: "geo-alt" };

export default function FollowUps() {
  const toast = useToast();
  const [bucket, setBucket] = useState("today");
  const fu = useApi(() => followUpsApi.buckets(), []);

  async function complete(id) {
    try {
      await followUpsApi.complete(id, "Completed");
      toast("Follow-up completed");
      fu.reload();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  async function reschedule(id, days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(10, 0, 0, 0);
    try {
      await followUpsApi.reschedule(id, d.toISOString());
      toast("Rescheduled");
      fu.reload();
    } catch (e) {
      toast(e.message, "error");
    }
  }

  if (fu.loading) return <Spinner />;
  const counts = fu.data?.counts || {};
  const items = fu.data?.[bucket] || [];

  const cards = [
    { key: "overdue", label: "Overdue", icon: "exclamation-triangle", tone: "danger" },
    { key: "today", label: "Due Today", icon: "bell", tone: "warning" },
    { key: "upcoming", label: "Upcoming", icon: "clock-history", tone: "info" },
    { key: "done", label: "Completed", icon: "check-circle", tone: "success" },
  ];

  return (
    <div className="space-y-3">
      <PageHeader title="Follow-ups" />
      <ErrorBox error={fu.error} />

      {/* KPI Cards Row with generous grid gaps */}
      <div className="row row-cols-1 row-cols-sm-2 row-cols-md-4 g-4 mb-4">
        {cards.map((c) => {
          const isActive = bucket === c.key;
          return (
            <div className="col" key={c.key}>
              <div
                className="card h-100 transition-all"
                style={{
                  borderRadius: "10px",
                  padding: "14px 14px 12px",
                  backgroundColor: "var(--surface)",
                  borderColor: isActive ? "var(--primary)" : "var(--border)",
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div style={{ fontSize: 12.5, color: "#4b5a5b", fontWeight: 500 }}>
                    {c.label}
                  </div>
                  <div
                    className={`bg-${c.tone}-subtle d-flex align-items-center justify-content-center`}
                    style={{ width: 34, height: 34, borderRadius: 8, fontSize: 14 }}
                  >
                    <i className={`bi bi-${c.icon} text-${c.tone}`}></i>
                  </div>
                </div>

                <div className="mb-2" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: "#1e2d2d" }}>
                  {counts[c.key] ?? 0}
                </div>

                <button
                  className={`btn btn-sm ${isActive ? "btn-wa" : "btn-outline-secondary"} w-100 mt-auto`}
                  onClick={() => setBucket(c.key)}
                >
                  {isActive ? "Active Filter" : "Filter List"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Table Card with ample spacing */}
      <div className="card border shadow-xs rounded-4 overflow-hidden mb-4">
        <div className="card-header d-flex align-items-center justify-content-between" style={{ background: "var(--surface)", padding: "16px 18px 12px" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1f2d2b" }}>
            {bucket === "today" ? "Due Today" : bucket.toUpperCase()} Follow-ups
          </span>
          <span className="badge bg-secondary-subtle text-secondary px-3 py-1.5 rounded-pill">
            {items.length} Task{items.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="bg-light">
              <tr>
                <th className="py-3 px-4">Lead</th>
                <th className="py-3">Type</th>
                <th className="py-3">Note</th>
                <th className="py-3">Owner</th>
                <th className="py-3">Due Date</th>
                <th className="py-3 px-4 text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-5">
                    <EmptyState icon="check2-circle" text="No follow-ups found for this filter." />
                  </td>
                </tr>
              ) : (
                items.map((f) => (
                  <tr key={f._id}>
                    <td className="py-3 px-4">
                      <div className="fw-medium text-foreground">{f.leadName}</div>
                      <div className="text-muted small">{f.phone}</div>
                    </td>
                    <td className="small">
                      <i className={`bi bi-${ICON[f.type] || "bell"} me-1 text-primary`}></i>
                      {f.type}
                    </td>
                    <td className="small text-muted">{f.note || "—"}</td>
                    <td className="small">{(f.owner || "").split(" ")[0]}</td>
                    <td className="small">{new Date(f.due).toLocaleString()}</td>
                    <td className="py-3 px-4 text-end">
                      {f.done ? (
                        <span className="badge text-bg-success px-2.5 py-1">{f.outcome || "Done"}</span>
                      ) : (
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-wa d-inline-flex align-items-center gap-1"
                            onClick={() => complete(f._id)}
                            title="Mark Completed"
                          >
                            <i className="bi bi-check-lg"></i> Complete
                          </button>
                          <button
                            className="btn btn-outline-secondary dropdown-toggle"
                            data-bs-toggle="dropdown"
                          ></button>
                          <ul className="dropdown-menu dropdown-menu-end shadow-sm">
                            <li>
                              <button className="dropdown-item" onClick={() => reschedule(f._id, 1)}>
                                Tomorrow
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item" onClick={() => reschedule(f._id, 3)}>
                                In 3 days
                              </button>
                            </li>
                            <li>
                              <button className="dropdown-item" onClick={() => reschedule(f._id, 7)}>
                                Next week
                              </button>
                            </li>
                          </ul>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
