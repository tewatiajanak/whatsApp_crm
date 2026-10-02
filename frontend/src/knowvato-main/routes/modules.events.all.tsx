import DateInput from "../../components/DateInput";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEventData } from "@/event-manager/context/EventDataContext";
import {
  ArrowLeft,
  Plus,
  CalendarDays,
  MapPin,
  Users,
  Pencil,
  Trash2,
  Menu,
  ExternalLink,
  History,
  Loader2,
  Filter as FilterIcon,
  X,
  Sparkles,
} from "lucide-react";
import { UIButton, SearchInput } from "@/components/UIKit";
import { fmtDate } from "@/utils/date";

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

type RowAction = { label: string; icon: any; onClick: () => void; danger?: boolean };

// Per-row actions menu. Rendered position:fixed so the table's overflow
// container can't clip it.
function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon"
        title="Actions"
        aria-label="Actions"
      >
        <Menu className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="rounded-lg border bg-card py-1 text-left"
          style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 60, minWidth: 170, boxShadow: "var(--shadow-lift)" }}
        >
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <div key={a.label}>
                {a.danger && <div className="my-1 border-t" />}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    a.onClick();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[12.5px] hover:bg-accent text-left"
                  style={{ color: a.danger ? "var(--destructive)" : "var(--foreground)", background: "transparent", border: 0 }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {a.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

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
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("all");
  const [typeFilter, setTypeFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  // Old links still arrive as ?create=1 / ?edit=<id>: send them to the wizard.
  useEffect(() => {
    if (searchParams.get("create") === "1") navigate("/modules/events/new", { replace: true });
    else if (searchParams.get("edit")) navigate(`/modules/events/${searchParams.get("edit")}/edit`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  const openCreate = () => navigate("/modules/events/new");
  const openEditFor = (e: any) => navigate(`/modules/events/${e.id}/edit`);

  const handleDelete = async (e: Ev) => {
    if (!confirm(`Delete "${e.eventName}"?`)) return;
    try {
      await deleteEvent(e.id, e.eventName);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b">
        <div>
          <Link
            to="/modules/events"
            className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to Event Manager
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">Events</h1>
        </div>
        <UIButton onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>
          Create Event
        </UIButton>
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
              className={`relative inline-flex items-center gap-2 h-9 px-4 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? "shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={
                active
                  ? {
                      background: "var(--accent)",
                      color: "var(--accent-foreground)",
                      borderRadius: "12px",
                    }
                  : { background: "transparent", borderRadius: "12px" }
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
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, venue, organizer…"
          containerClassName="flex-1 min-w-[240px] max-w-md"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="ui-input min-w-[160px]"
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
        <DateInput
          wrapperStyle={{ display: "inline-block" }}
          placeholder="From"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="ui-input"
          title="From"
        />
        <DateInput
          wrapperStyle={{ display: "inline-block" }}
          placeholder="To"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="ui-input"
          title="To"
        />
        {hasFilter && (
          <UIButton size="sm" variant="ghost" onClick={clearFilters} leftIcon={<X className="h-3.5 w-3.5" />}>
            Clear
          </UIButton>
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
                <th className="px-4 py-3 text-right font-medium" style={{ textAlign: "right", width: 90 }}>Actions</th>
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
                        <UIButton onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />} className="mt-2">
                          Create your first event
                        </UIButton>
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
                        <RowActionsMenu
                          actions={[
                            { label: "Edit Event", icon: Pencil, onClick: () => openEditFor(e) },
                            ...(e.form?.published
                              ? [{ label: "Registration Form Link", icon: ExternalLink, onClick: () => window.open(`/e/${e.id}`, "_blank", "noopener") }]
                              : []),
                            { label: "Attendees", icon: Users, onClick: () => navigate(`/modules/events/${e.id}/attendees`) },
                            { label: "Activity Log", icon: History, onClick: () => navigate(`/modules/events/${e.id}/logs`) },
                            { label: "Delete", icon: Trash2, onClick: () => handleDelete(e), danger: true },
                          ]}
                        />
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
