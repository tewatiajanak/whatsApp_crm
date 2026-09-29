import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEventData } from "@/event-manager/context/EventDataContext";
import {
  ArrowLeft,
  Plus,
  Search,
  CalendarDays,
  MapPin,
  Users,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  Filter as FilterIcon,
  X,
} from "lucide-react";

type Ev = any;

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "scheduled", label: "Scheduled" },
  { key: "live", label: "Live" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];

const deriveStatus = (e: Ev): string => {
  if (e.status) return String(e.status).toLowerCase();
  const now = Date.now();
  const start = e.startDate ? new Date(e.startDate).getTime() : NaN;
  const end = e.endDate ? new Date(e.endDate).getTime() : NaN;
  if (!isFinite(start)) return "draft";
  if (isFinite(end) && now > end) return "completed";
  if (now >= start && (!isFinite(end) || now <= end)) return "live";
  return "scheduled";
};

const statusStyle = (s: string) => {
  switch (s) {
    case "live":
      return { bg: "var(--success-bg)", fg: "var(--success)" };
    case "completed":
      return { bg: "var(--info-bg)", fg: "var(--info)" };
    case "draft":
      return {
        bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)",
        fg: "var(--muted-foreground)",
      };
    case "archived":
      return {
        bg: "color-mix(in srgb, var(--muted-foreground) 10%, transparent)",
        fg: "var(--muted-foreground)",
      };
    default: // scheduled
      return { bg: "var(--warning-bg)", fg: "var(--warning)" };
  }
};

const fmtDate = (d?: string) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

export default function EventsAllPage() {
  const {
    events = [],
    eventsLoading,
    eventTypes = [],
    attendees = [],
    deleteEvent,
    setSelectedEventId,
  } = useEventData() as any;

  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const typeMap = useMemo(() => {
    const m: Record<string, any> = {};
    (eventTypes as any[]).forEach((t: any) => {
      m[t.id || t._id] = t;
      m[t.key] = t;
    });
    return m;
  }, [eventTypes]);

  const regsPerEvent = useMemo(() => {
    const m: Record<string, number> = {};
    (attendees as any[]).forEach((a: any) => {
      const k = a.eventId;
      if (!k) return;
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [attendees]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: (events as Ev[]).length };
    (events as Ev[]).forEach((e) => {
      const s = deriveStatus(e);
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;
    return (events as Ev[])
      .filter((e) => {
        if (statusTab !== "all" && deriveStatus(e) !== statusTab) return false;
        if (typeFilter && e.eventType !== typeFilter) return false;
        if (q) {
          const hay = `${e.eventName || ""} ${e.venue || ""} ${e.organizer || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (from && e.startDate && new Date(e.startDate).getTime() < from) return false;
        if (to && e.startDate && new Date(e.startDate).getTime() > to) return false;
        return true;
      })
      .sort((a, b) => {
        const ta = a.startDate ? new Date(a.startDate).getTime() : 0;
        const tb = b.startDate ? new Date(b.startDate).getTime() : 0;
        return tb - ta;
      });
  }, [events, statusTab, typeFilter, search, fromDate, toDate]);

  const clearFilters = () => {
    setSearch("");
    setStatusTab("all");
    setTypeFilter("");
    setFromDate("");
    setToDate("");
  };

  const hasFilter = !!(search || typeFilter || fromDate || toDate || statusTab !== "all");

  const handleDelete = async (e: Ev) => {
    if (!confirm(`Delete "${e.eventName}"?`)) return;
    try {
      await deleteEvent(e.id, e.eventName);
    } catch (err) {
      console.error(err);
    }
  };

  const openEvent = (e: Ev) => {
    if (setSelectedEventId) setSelectedEventId(e.id);
  };

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link
            to="/modules/events"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to Event Manager
          </Link>
          <h1 className="text-xl font-semibold tracking-tight mt-0.5 text-foreground">All Events</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Every event in your workspace — search, filter, and drill in.
          </p>
        </div>
        <Link
          to="/modules/events/create?mode=new"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: "var(--primary)", textDecoration: "none" }}
        >
          <Plus className="h-4 w-4" />
          Create Event
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 flex-wrap overflow-x-auto">
        {STATUS_TABS.map((t) => {
          const active = statusTab === t.key;
          const count = counts[t.key] ?? 0;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusTab(t.key)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {t.label}
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  active ? "bg-white/20" : "bg-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, venue, organizer…"
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm min-w-[160px]"
        >
          <option value="">All types</option>
          {(eventTypes as any[])
            .filter((t) => t.active !== false)
            .map((t) => (
              <option key={t.id || t._id} value={t.id || t._id}>
                {t.label || t.name}
              </option>
            ))}
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-9 px-2 rounded-md border border-input bg-background text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-9 px-2 rounded-md border border-input bg-background text-xs"
          />
        </div>
        {hasFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
          <FilterIcon className="h-3.5 w-3.5" />
          {eventsLoading ? "Loading…" : `${filtered.length} of ${(events as Ev[]).length}`}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-[11px] uppercase tracking-wider text-muted-foreground"
                style={{ background: "var(--muted-background)" }}
              >
                <th className="px-4 py-3 text-left font-medium">Event</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Venue</th>
                <th className="px-4 py-3 text-left font-medium">Registrations</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {eventsLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                    Loading events…
                  </td>
                </tr>
              )}
              {!eventsLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {(events as Ev[]).length === 0
                      ? "No events yet. Click 'Create Event' to add your first one."
                      : "No events match your filters."}
                  </td>
                </tr>
              )}
              {!eventsLoading &&
                filtered.map((e) => {
                  const s = deriveStatus(e);
                  const st = statusStyle(s);
                  const type = typeMap[e.eventType];
                  const regs = regsPerEvent[e.id] || 0;
                  const capacity = e.capacity || 0;
                  const pct = capacity > 0 ? Math.min(100, Math.round((regs / capacity) * 100)) : 0;
                  return (
                    <tr key={e.id} className="border-t hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-foreground truncate max-w-xs">
                          {e.eventName || <span className="italic text-muted-foreground">Untitled</span>}
                        </div>
                        {e.organizer && (
                          <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                            by {e.organizer}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {type ? (
                          <span
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
                            style={{
                              background: `color-mix(in srgb, ${type.color || "var(--primary)"} 12%, transparent)`,
                              color: type.color || "var(--primary)",
                            }}
                          >
                            {type.icon && <i className={`${type.icon} text-[11px]`} />}
                            {type.label || type.name}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-xs text-foreground inline-flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-muted-foreground" />
                          {fmtDate(e.startDate)}
                        </div>
                        {e.endDate && e.endDate !== e.startDate && (
                          <div className="text-[11px] text-muted-foreground pl-4">
                            → {fmtDate(e.endDate)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[200px]">
                        <div className="inline-flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{e.venue || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 min-w-[140px]">
                        <div className="inline-flex items-center gap-1 text-xs text-foreground">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {regs}
                            {capacity > 0 && (
                              <span className="text-muted-foreground"> / {capacity}</span>
                            )}
                          </span>
                        </div>
                        {capacity > 0 && (
                          <div className="mt-1 h-1 w-24 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                background: pct >= 90 ? "var(--destructive)" : "var(--primary)",
                              }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize"
                          style={{ background: st.bg, color: st.fg }}
                        >
                          {s}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            to={`/modules/events/create?edit=${e.id}`}
                            onClick={() => openEvent(e)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                            title="Edit"
                            style={{ textDecoration: "none" }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            to={`/modules/events/${e.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                            title="Open workspace"
                            style={{ textDecoration: "none" }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(e)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
