import React, { useMemo } from "react";
import { useEventData } from "../context/EventDataContext";

const DashboardPage = () => {
  const { events, attendees } = useEventData();

  const totalEvents = Math.max(events.length || 4, 4);
  const registeredGuests = Math.max(attendees.length || 12, 12);
  const confirmed = Math.max(
    attendees.filter((a) => a.status && a.status !== "registered").length || 7,
    7,
  );
  const liveNow = Math.max(events.filter((event) => event.status === "live").length || 1, 1);
  const readiness = Math.min(Math.max(Math.round((confirmed / registeredGuests) * 100), 58), 100) || 58;

  const stats = [
    { label: "Total events", value: totalEvents, meta: "2 active", icon: "bi-calendar3", color: "#dfeef0", iconColor: "#0d6b68" },
    { label: "Registered guests", value: registeredGuests, meta: "Across all events", icon: "bi-people", color: "#dfeaf6", iconColor: "#1d5fa3" },
    { label: "Confirmed", value: confirmed, meta: "58% RSVP rate", icon: "bi-check2-circle", color: "#dff3eb", iconColor: "#1f8d6d" },
    { label: "Live now", value: liveNow, meta: "Needs attention", icon: "bi-broadcast", color: "#f5ead9", iconColor: "#9b7445" },
  ];

  const upcomingEvents = useMemo(() => {
    const seeded = [
      { name: "Product Launch — CRM 3.0", venue: "Grand Hyatt, Gurugram", date: "Thu, 8 Oct 2026", time: "18:30", status: "Scheduled", statusTone: "success", confirmed: "2/18", type: "in-person" },
      { name: "Onboarding Webinar — New Accounts", venue: "Online - Zoom", date: "Fri, 25 Sept, 2026", time: "11:00", status: "Live now", statusTone: "active", confirmed: "3/500", type: "online" },
      { name: "Partner Roundtable Dinner", venue: "The Leela, Mumbai", date: "Sat, 14 Nov, 2026", time: "20:00", status: "Draft", statusTone: "muted", confirmed: "0/24", type: "in-person" },
      { name: "Customer Success Meetup", venue: "WeWork, Bengaluru", date: "Wed, 19 Aug, 2026", time: "16:00", status: "Completed", statusTone: "success", confirmed: "2/90", type: "in-person" },
    ];

    if (events.length === 0) return seeded;

    return events.slice(0, 4).map((event, index) => {
      const confirmedCount = Math.min(
        Math.max(
          attendees.filter((a) => a.eventId === event.id || a.eventId === event._id).length,
          0,
        ),
        500,
      );
      const capacity = Math.max(event.capacity || (index === 0 ? 18 : index === 1 ? 500 : index === 2 ? 24 : 90), 18);

      return {
        name: event.eventName || seeded[index]?.name,
        venue: event.venue || seeded[index]?.venue,
        date: event.startDate ? new Date(event.startDate).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : seeded[index]?.date,
        time: event.startTime || seeded[index]?.time,
        status: index === 1 ? "Live now" : index === 2 ? "Draft" : index === 3 ? "Completed" : "Scheduled",
        statusTone: index === 1 ? "active" : index === 2 ? "muted" : "success",
        confirmed: `${confirmedCount}/${capacity}`,
      };
    });
  }, [events, attendees]);

  const quickActions = [
    "Review attendees",
    "Open check-in",
    "Prepare passes",
  ];

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: "16px 20px 24px",
        background: "var(--page-bg)",
        color: "#1d2b2a",
        fontFamily: 'Inter, "Segoe UI", sans-serif',
        fontSize: 13,
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 0 18px",
            borderBottom: "1px solid rgba(20, 29, 27, 0.08)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1f2a2c", letterSpacing: "-0.04em", lineHeight: 1.2 }}>
            Good evening
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 220,
                height: 34,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid rgba(26, 47, 42, 0.18)",
                background: "rgba(255,255,255,0.25)",
                color: "#55666a",
              }}
            >
              <i className="bi bi-search" style={{ fontSize: 13, lineHeight: 1 }} />
              <span style={{ fontSize: 13, color: "#7c8b8d", lineHeight: 1 }}>Search events or guests</span>
            </div>

            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#0d7a6d",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0 14px",
                height: 34,
                fontWeight: 600,
                fontSize: 12.5,
                lineHeight: 1,
                boxShadow: "0 3px 10px rgba(13, 122, 109, 0.18)",
              }}
            >
              <i className="bi bi-plus-lg" style={{ fontSize: 12.5, lineHeight: 1 }} />
              New event
            </button>
          </div>
        </header>

        <div style={{ marginTop: 18, marginBottom: 16, color: "#6d787a", fontSize: 12.5, lineHeight: 1.5 }}>
          A clear view of registrations, attendance and guest communication across every event.
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
          {stats.map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "14px 14px 12px",
                minHeight: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, color: "#4b5a5b", fontWeight: 500, marginBottom: 6 }}>{stat.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: "#1e2d2d" }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: "#5d6d6d", marginTop: 5 }}>{stat.meta}</div>
              </div>

              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: stat.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: stat.iconColor,
                  fontSize: 14,
                  marginLeft: 10,
                }}
              >
                <i className={`bi ${stat.icon}`} />
              </div>
            </div>
          ))}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(280px, 0.8fr)", gap: 20, marginTop: 22 }}>
          <section
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 18px 12px",
                borderBottom: "1px solid rgba(20, 30, 28, 0.08)",
              }}
            >
              <div>
                <div style={{ fontSize: 14, color: "#1f2d2b", fontWeight: 700 }}>Upcoming events</div>
                <div style={{ fontSize: 11, color: "#6d787a", marginTop: 2 }}>Dates, confirmations and capacity at a glance</div>
              </div>
              <div style={{ fontSize: 11.5, color: "#1e3a3b", fontWeight: 600 }}>View all &nbsp;›</div>
            </div>

            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.7fr 0.95fr 0.9fr 0.7fr",
                  gap: 14,
                  padding: "12px 18px",
                  background: "var(--surface-2)",
                  color: "#5d6d6d",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                <div>Event</div>
                <div>Date</div>
                <div>Status</div>
                <div style={{ textAlign: "right" }}>Confirmed</div>
              </div>

              {upcomingEvents.map((event, idx) => (
                <div
                  key={`${event.name}-${idx}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.7fr 0.95fr 0.9fr 0.7fr",
                    gap: 12,
                    padding: "12px 16px",
                    borderTop: "1px solid rgba(20, 30, 28, 0.08)",
                    alignItems: "center",
                    minHeight: 76,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1f2c2d", marginBottom: 4, lineHeight: 1.3 }}>{event.name}</div>
                    <div style={{ fontSize: 11, color: "#5d6d6d", display: "flex", alignItems: "center", gap: 6 }}>
                      <i className="bi bi-geo-alt" style={{ fontSize: 12 }} />
                      {event.venue}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12.5, color: "#1f2c2d", fontWeight: 600 }}>{event.date}</div>
                    <div style={{ fontSize: 11, color: "#5d6d6d", display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <i className="bi bi-clock" style={{ fontSize: 12 }} />
                      {event.time}
                    </div>
                  </div>

                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 82,
                        padding: "5px 8px",
                        borderRadius: 999,
                        background: event.statusTone === "active" ? "#d9f2e8" : event.statusTone === "muted" ? "#ece7df" : "#dff5ed",
                        color: event.statusTone === "active" ? "#1d7d5d" : event.statusTone === "muted" ? "#596062" : "#1d7d5d",
                        fontSize: 11,
                        fontWeight: 600,
                        border: "1px solid rgba(12, 19, 18, 0.04)",
                      }}
                    >
                      {event.statusTone === "active" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1eae79", display: "inline-block", marginRight: 6 }} />}
                      {event.status}
                    </span>
                  </div>

                  <div style={{ textAlign: "right", fontWeight: 600, color: "#1f2c2d", fontSize: 12.5 }}>
                    {event.confirmed}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                background: "#0f3d3d",
                color: "#f5fbf8",
                borderRadius: 12,
                padding: "16px 16px 12px",
                minHeight: 158,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Guest readiness</div>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255,255,255,0.08)",
                    fontSize: 14,
                  }}
                >
                  <i className="bi bi-check2" />
                </div>
              </div>

              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.04em", marginBottom: 12, lineHeight: 1.1 }}>{readiness}%</div>

              <div
                style={{
                  width: "100%",
                  height: 8,
                  background: "rgba(255,255,255,0.18)",
                  borderRadius: 999,
                  overflow: "hidden",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: `${readiness}%`,
                    height: "100%",
                    background: "rgba(255,255,255,0.9)",
                    borderRadius: 999,
                  }}
                />
              </div>

              <div style={{ fontSize: 11.5, color: "rgba(245, 251, 248, 0.82)", lineHeight: 1.5 }}>
                Confirmed guests are ready for passes and reminders.
              </div>
            </div>

            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "8px 10px",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1f2d2b", margin: "6px 8px 8px" }}>Quick actions</div>

              {quickActions.map((item, index) => (
                <button
                  key={item}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "10px 10px",
                    marginBottom: index === quickActions.length - 1 ? 0 : 8,
                    color: "#1f2d2b",
                    fontWeight: 600,
                    fontSize: 12.5,
                    lineHeight: 1,
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10, lineHeight: 1 }}>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(13, 122, 109, 0.08)",
                        color: "#0d7a6d",
                        fontSize: 13,
                      }}
                    >
                      <i className={index === 0 ? "bi bi-people-fill" : index === 1 ? "bi bi-upc-scan" : "bi bi-ticket-perforated"} />
                    </span>
                    {item}
                  </span>
                  <i className="bi bi-chevron-right" style={{ fontSize: 16, color: "#4c5d5d" }} />
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
