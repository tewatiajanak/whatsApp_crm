import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useEventData } from "../context/EventDataContext";
import { fmtDate } from "../../utils/date";

// Event Manager → Overview. Every number here is counted from the real events
// and attendees; nothing is a sample figure.

const dayStart = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`).getTime() : NaN);
const dayEnd = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T23:59:59`).getTime() : NaN);

/** draft · scheduled · live · completed — from the event's own dates. */
const statusOf = (e, now) => {
  const start = dayStart(e.startDate);
  if (!Number.isFinite(start)) return "draft";
  const end = dayEnd(e.endDate || e.startDate);
  if (now > end) return "completed";
  if (now >= start) return "live";
  return "scheduled";
};

const STATUS = {
  live: { label: "Live now", bg: "var(--success-bg)", fg: "var(--success)" },
  scheduled: { label: "Scheduled", bg: "var(--info-bg)", fg: "var(--info)" },
  draft: { label: "Draft", bg: "var(--muted-background)", fg: "var(--muted-foreground)" },
  completed: { label: "Completed", bg: "var(--muted-background)", fg: "var(--muted-foreground)" },
};

const TH = "px-4 py-3 text-left font-medium";

const DashboardPage = () => {
  const { events = [], attendees = [], eventsLoading } = useEventData();

  const data = useMemo(() => {
    const now = Date.now();
    const withStatus = events.map((e) => ({ ...e, _status: statusOf(e, now) }));
    const perEvent = new Map();
    attendees.forEach((a) => perEvent.set(a.eventId, (perEvent.get(a.eventId) || 0) + 1));

    const live = withStatus.filter((e) => e._status === "live");
    const scheduled = withStatus.filter((e) => e._status === "scheduled");
    const checkedIn = attendees.filter((a) => a.status === "checked-in" || a.status === "checked-out").length;
    const withPass = attendees.filter((a) => a.passGenerated).length;
    const pct = (n) => (attendees.length ? Math.round((n / attendees.length) * 100) : 0);

    // what is on now, then what is coming, soonest first
    const upcoming = [...live, ...scheduled]
      .sort((a, b) => dayStart(a.startDate) - dayStart(b.startDate))
      .slice(0, 6)
      .map((e) => ({ ...e, registered: perEvent.get(e.id) || 0 }));

    return {
      total: events.length,
      active: live.length + scheduled.length,
      registered: attendees.length,
      eventsWithGuests: perEvent.size,
      checkedIn,
      checkedInPct: pct(checkedIn),
      live,
      withPass,
      passPct: pct(withPass),
      upcoming,
    };
  }, [events, attendees]);

  const hour = new Date().getHours();
  const stats = [
    { label: "Total events", value: data.total, meta: `${data.active} active`, icon: "bi-calendar3", bg: "color-mix(in srgb, var(--primary) 12%, transparent)", fg: "var(--primary)" },
    { label: "Registered attendees", value: data.registered, meta: `Across ${data.eventsWithGuests} event${data.eventsWithGuests === 1 ? "" : "s"}`, icon: "bi-people", bg: "var(--info-bg)", fg: "var(--info)" },
    { label: "Checked in", value: data.checkedIn, meta: `${data.checkedInPct}% of registered`, icon: "bi-check2-circle", bg: "var(--success-bg)", fg: "var(--success)" },
    { label: "Live now", value: data.live.length, meta: data.live.length ? data.live.map((e) => e.eventName).join(", ") : "No event today", icon: "bi-broadcast", bg: "var(--warning-bg)", fg: "var(--warning)" },
  ];
  const quickActions = [
    { label: "Review attendees", to: "/modules/events/registrants", icon: "bi-people-fill" },
    { label: "Open check-in", to: "/modules/events/scan", icon: "bi-upc-scan" },
    { label: "Payments", to: "/modules/events/payments", icon: "bi-currency-rupee" },
  ];

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b">
        <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight m-0">
          {hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}
        </h1>
        <Link to="/modules/events/new" className="ui-btn ui-btn-primary" style={{ textDecoration: "none" }}>
          <i className="bi bi-plus-lg" /> New event
        </Link>
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
              <div className="text-xl font-semibold text-foreground mt-1 leading-tight">{eventsLoading ? "…" : s.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1 truncate" title={s.meta}>{s.meta}</div>
            </div>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{ background: s.bg, color: s.fg }}>
              <i className={`bi ${s.icon}`} />
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2.2fr)_minmax(280px,0.8fr)] gap-3 items-start">
        {/* Upcoming events */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="text-sm font-semibold text-foreground">Upcoming events</div>
            <Link to="/modules/events/all" className="text-xs font-semibold" style={{ textDecoration: "none", color: "var(--primary)" }}>
              View all ›
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                  <th className={TH} style={{ width: 64 }}>Sr No</th>
                  <th className={TH}>Event</th>
                  <th className={TH}>Date</th>
                  <th className={TH}>Status</th>
                  <th className="px-4 py-3 font-medium" style={{ textAlign: "right" }}>Registered</th>
                </tr>
              </thead>
              <tbody>
                {data.upcoming.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {eventsLoading ? "Loading…" : data.total ? "No upcoming events." : "No events yet."}
                    </td>
                  </tr>
                )}
                {data.upcoming.map((e, i) => {
                  const st = STATUS[e._status];
                  const capacity = Number(e.capacity) || 0;
                  return (
                    <tr key={e.id} className="border-t hover:bg-accent/30">
                      <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <Link to={`/modules/events/${e.id}/attendees`} className="font-medium text-foreground" style={{ textDecoration: "none" }}>
                          {e.eventName}
                        </Link>
                        {e.venue && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <i className="bi bi-geo-alt" /> {e.venue}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {fmtDate(e.startDate)}
                        {e.endDate && e.endDate !== e.startDate ? ` to ${fmtDate(e.endDate)}` : ""}
                        {e.startTime && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <i className="bi bi-clock" /> {e.startTime}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium" style={{ background: st.bg, color: st.fg }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ textAlign: "right" }}>
                        {e.registered}
                        {capacity > 0 && <span className="text-muted-foreground font-normal"> / {capacity}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          {/* Passes */}
          <div className="rounded-xl p-4" style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}>
            <div className="text-sm font-semibold">Passes generated</div>
            <div className="text-2xl font-semibold mt-2 leading-tight">{data.passPct}%</div>
            <div className="mt-3 rounded-full overflow-hidden" style={{ height: 8, background: "rgba(255,255,255,0.22)" }}>
              <div style={{ width: `${data.passPct}%`, height: "100%", background: "rgba(255,255,255,0.92)", borderRadius: 999 }} />
            </div>
            <div className="text-xs mt-3" style={{ opacity: 0.85 }}>
              {data.withPass} of {data.registered} attendees
            </div>
          </div>

          {/* Quick actions */}
          <div className="rounded-xl border bg-card p-3">
            <div className="text-sm font-semibold text-foreground mb-2">Quick actions</div>
            <div className="space-y-2">
              {quickActions.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-[12.5px] font-semibold text-foreground hover:bg-accent transition-colors"
                  style={{ textDecoration: "none", background: "var(--muted-background)" }}
                >
                  <span className="inline-flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
                      <i className={`bi ${a.icon}`} />
                    </span>
                    {a.label}
                  </span>
                  <i className="bi bi-chevron-right text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
