import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  Save,
  Building2,
  Sparkles,
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
    default:
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

type EventForm = {
  eventName: string;
  eventType: string;
  organizer: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  city: string;
  capacity: number;
  description: string;
};

const EMPTY_FORM: EventForm = {
  eventName: "",
  eventType: "",
  organizer: "",
  startDate: "",
  endDate: "",
  startTime: "09:00",
  endTime: "18:00",
  venue: "",
  city: "",
  capacity: 100,
  description: "",
};

export default function EventsAllPage() {
  const {
    events = [],
    eventsLoading,
    eventTypes = [],
    attendees = [],
    addEvent,
    updateEvent,
    deleteEvent,
    setSelectedEventId,
  } = useEventData() as any;

  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Auto-open create drawer via ?create=1
  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setEditingId(null);
      setForm(EMPTY_FORM);
      setDrawerOpen(true);
    } else if (searchParams.get("edit")) {
      const ev = events.find((e: any) => e.id === searchParams.get("edit"));
      if (ev) openEditFor(ev);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, events.length]);

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

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
    setSearchParams({ create: "1" });
  };

  const openEditFor = (e: any) => {
    setEditingId(e.id);
    setForm({
      eventName: e.eventName || "",
      eventType: e.eventType || "",
      organizer: e.organizer || "",
      startDate: e.startDate || "",
      endDate: e.endDate || "",
      startTime: e.startTime || "09:00",
      endTime: e.endTime || "18:00",
      venue: e.venue || "",
      city: e.city || "",
      capacity: e.capacity || 100,
      description: e.description || "",
    });
    setDrawerOpen(true);
    setSearchParams({ edit: e.id });
    if (setSelectedEventId) setSelectedEventId(e.id);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingId(null);
    // Clean the URL
    if (searchParams.get("create") || searchParams.get("edit")) {
      setSearchParams({});
    }
  };

  const save = async () => {
    if (!form.eventName.trim() || !form.startDate) {
      alert("Event name and start date are required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateEvent(editingId, form);
      } else {
        await addEvent(form);
      }
      closeDrawer();
    } catch (e: any) {
      alert(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: Ev) => {
    if (!confirm(`Delete "${e.eventName}"?`)) return;
    try {
      await deleteEvent(e.id, e.eventName);
    } catch (err) {
      console.error(err);
    }
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
          <h1 className="text-xl font-semibold tracking-tight mt-0.5 text-foreground">Events</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse, filter, and create — everything you need to manage your events in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: "var(--primary)" }}
        >
          <Plus className="h-4 w-4" />
          Create Event
        </button>
      </div>

      {/* Status tabs — nested-radius math: outer(16px) − padding(4px) = inner(12px) */}
      <div
        className="inline-flex items-center gap-0.5 border bg-card overflow-x-auto max-w-full shadow-sm"
        role="tablist"
        aria-label="Filter by status"
        style={{ borderRadius: "16px", padding: "4px" }}
      >
        {STATUS_TABS.map((t) => {
          const active = statusTab === t.key;
          const count = counts[t.key] ?? 0;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatusTab(t.key)}
              className={`relative inline-flex items-center gap-2 h-9 px-4 text-sm font-medium transition-all whitespace-nowrap ${
                active
                  ? "shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              style={
                active
                  ? {
                      background: "var(--accent)",
                      color: "var(--accent-foreground)",
                      borderRadius: "12px",
                    }
                  : { borderRadius: "12px" }
              }
            >
              <span>{t.label}</span>
              <span
                className={`text-[10px] font-semibold tabular-nums ${
                  active ? "opacity-70" : "opacity-45"
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
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="inline-flex flex-col items-center gap-2">
                      <div
                        className="inline-flex h-12 w-12 items-center justify-center rounded-full"
                        style={{
                          background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                          color: "var(--primary)",
                        }}
                      >
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {(events as Ev[]).length === 0 ? "No events yet" : "No events match your filters"}
                      </div>
                      <div className="text-xs text-muted-foreground max-w-sm">
                        {(events as Ev[]).length === 0
                          ? "Click 'Create Event' to add your first one."
                          : "Try adjusting your search or clearing the filters."}
                      </div>
                      {(events as Ev[]).length === 0 && (
                        <button
                          onClick={openCreate}
                          className="mt-2 inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm"
                          style={{ background: "var(--primary)" }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Create your first event
                        </button>
                      )}
                    </div>
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
                    <tr
                      key={e.id}
                      className="border-t hover:bg-accent/30 transition-colors cursor-pointer"
                      onClick={() => openEditFor(e)}
                    >
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
                      <td className="px-4 py-2.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditFor(e)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
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

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={closeDrawer}>
          <div className="flex-1 bg-black/40 backdrop-blur-sm" />
          <div
            className="w-full max-w-2xl bg-card border-l shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="sticky top-0 z-10 bg-card border-b px-6 py-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  {editingId ? "Edit event" : "New event"}
                </div>
                <div className="text-lg font-semibold text-foreground mt-0.5">
                  {editingId ? form.eventName || "Untitled" : "Create a new event"}
                </div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basics */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold"
                    style={{
                      background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    1
                  </span>
                  <div className="text-sm font-semibold text-foreground">Basics</div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Event name *
                    </label>
                    <input
                      value={form.eventName}
                      onChange={(e) => setForm({ ...form, eventName: e.target.value })}
                      placeholder="e.g. Tech Conference 2026"
                      className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Event type
                      </label>
                      <select
                        value={form.eventType}
                        onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                        className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        <option value="">— choose —</option>
                        {(eventTypes as any[])
                          .filter((t) => t.active !== false)
                          .map((t) => (
                            <option key={t.id || t._id} value={t.id || t._id}>
                              {t.label || t.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Organizer
                      </label>
                      <input
                        value={form.organizer}
                        onChange={(e) => setForm({ ...form, organizer: e.target.value })}
                        placeholder="Your team or company"
                        className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Short description
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="One-liner that sums up the event"
                      rows={2}
                      className="mt-1 w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Date & Time */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold"
                    style={{
                      background: "color-mix(in srgb, var(--info) 15%, transparent)",
                      color: "var(--info)",
                    }}
                  >
                    2
                  </span>
                  <div className="text-sm font-semibold text-foreground">Date & Time</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Start date *
                    </label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      End date
                    </label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Start time
                    </label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      End time
                    </label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold"
                    style={{
                      background: "color-mix(in srgb, var(--success) 15%, transparent)",
                      color: "var(--success)",
                    }}
                  >
                    3
                  </span>
                  <div className="text-sm font-semibold text-foreground">Location</div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Venue
                    </label>
                    <div className="mt-1 relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <input
                        value={form.venue}
                        onChange={(e) => setForm({ ...form, venue: e.target.value })}
                        placeholder="e.g. Grand Hyatt, Gurugram"
                        className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      City
                    </label>
                    <input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="e.g. Gurugram"
                      className="mt-1 w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Capacity */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold"
                    style={{
                      background: "color-mix(in srgb, var(--warning) 15%, transparent)",
                      color: "var(--warning)",
                    }}
                  >
                    4
                  </span>
                  <div className="text-sm font-semibold text-foreground">Capacity</div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total capacity
                  </label>
                  <div className="mt-1 relative max-w-[200px]">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="number"
                      value={form.capacity}
                      onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 0 })}
                      min={0}
                      className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex items-center gap-2">
              <button
                type="button"
                onClick={closeDrawer}
                className="flex-1 h-10 rounded-md text-sm font-medium border hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !form.eventName.trim() || !form.startDate}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 rounded-md text-sm font-medium text-white shadow-sm disabled:opacity-40"
                style={{ background: "var(--primary)" }}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {editingId ? "Save changes" : "Create event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
