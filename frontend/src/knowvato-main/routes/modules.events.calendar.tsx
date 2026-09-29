import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEventData } from "@/event-manager/context/EventDataContext";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Clock,
} from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const eventDayKey = (raw?: string): string | null => {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return toDateKey(d);
};

export default function EventsCalendarPage() {
  const { events = [], eventsLoading, eventTypes = [] } = useEventData() as any;
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<string | null>(toDateKey(today));

  const typeMap = useMemo(() => {
    const m: Record<string, any> = {};
    (eventTypes as any[]).forEach((t) => {
      m[t.id || t._id] = t;
    });
    return m;
  }, [eventTypes]);

  // Build a map: dateKey -> events[] (an event with start/end is placed on
  // every day in that range).
  const eventsByDay = useMemo(() => {
    const m: Record<string, any[]> = {};
    (events as any[]).forEach((e) => {
      const start = e.startDate ? new Date(e.startDate) : null;
      const end = e.endDate ? new Date(e.endDate) : start;
      if (!start || isNaN(start.getTime())) return;
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last =
        end && !isNaN(end.getTime())
          ? new Date(end.getFullYear(), end.getMonth(), end.getDate())
          : d;
      while (d.getTime() <= last.getTime()) {
        const k = toDateKey(d);
        if (!m[k]) m[k] = [];
        m[k].push(e);
        d.setDate(d.getDate() + 1);
      }
    });
    return m;
  }, [events]);

  // Build the 42-cell grid for the current month
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startOffset = first.getDay(); // 0 = Sunday
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() - startOffset + i);
      cells.push({
        date: d,
        inMonth: d.getMonth() === cursor.getMonth(),
      });
    }
    return cells;
  }, [cursor]);

  const jumpMonth = (delta: number) => {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
  };
  const jumpToday = () => {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDay(toDateKey(d));
  };

  const selectedEvents = selectedDay ? eventsByDay[selectedDay] ?? [] : [];
  const selectedDate = selectedDay ? new Date(selectedDay) : null;

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
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "var(--primary)",
              }}
            >
              <CalendarIcon className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Calendar</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Month view of every event — click a day to see what's happening.
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

      {/* Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => jumpMonth(-1)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"
            title="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-base font-semibold text-foreground min-w-[180px] text-center">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </div>
          <button
            type="button"
            onClick={() => jumpMonth(1)}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"
            title="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={jumpToday}
            className="ml-2 h-8 px-3 rounded-md text-xs font-medium border hover:bg-accent"
          >
            Today
          </button>
        </div>
        <div className="text-xs text-muted-foreground">
          {eventsLoading ? "Loading…" : `${(events as any[]).length} events total`}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Month grid */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b" style={{ background: "var(--muted-background)" }}>
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-center">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map(({ date, inMonth }, i) => {
              const key = toDateKey(date);
              const dayEvents = eventsByDay[key] ?? [];
              const isToday = key === toDateKey(today);
              const isSelected = key === selectedDay;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  className={`min-h-[90px] p-1.5 border-r border-b text-left flex flex-col gap-1 transition-colors ${
                    !inMonth ? "bg-muted/30" : ""
                  } ${isSelected ? "bg-primary/5" : "hover:bg-accent/20"}`}
                >
                  <div
                    className={`text-xs font-semibold inline-flex items-center justify-center h-6 w-6 rounded-full shrink-0 ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : isSelected
                        ? "text-primary"
                        : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  {dayEvents.slice(0, 3).map((e) => {
                    const t = typeMap[e.eventType];
                    return (
                      <div
                        key={e.id}
                        className="text-[10px] font-medium truncate rounded px-1 py-0.5"
                        style={{
                          background: `color-mix(in srgb, ${t?.color || "var(--primary)"} 15%, transparent)`,
                          color: t?.color || "var(--primary)",
                        }}
                      >
                        {e.eventName || "Untitled"}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day panel */}
        <div className="rounded-xl border bg-card p-4 h-fit lg:sticky lg:top-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Selected day
          </div>
          <div className="text-lg font-semibold text-foreground mt-1">
            {selectedDate
              ? selectedDate.toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "Pick a day"}
          </div>
          <div className="mt-4">
            {selectedEvents.length === 0 && (
              <div className="text-sm text-muted-foreground italic py-6 text-center border rounded-lg">
                No events on this day.
              </div>
            )}
            <div className="space-y-2">
              {selectedEvents.map((e: any) => {
                const t = typeMap[e.eventType];
                return (
                  <Link
                    key={e.id}
                    to={`/modules/events/${e.id}`}
                    className="block rounded-lg border p-3 hover:shadow-sm transition-shadow"
                    style={{ textDecoration: "none" }}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0 mt-0.5"
                        style={{
                          background: `color-mix(in srgb, ${t?.color || "var(--primary)"} 12%, transparent)`,
                          color: t?.color || "var(--primary)",
                        }}
                      >
                        <i className={`${t?.icon || "bi-calendar-event"} text-[13px]`} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground truncate">
                          {e.eventName || "Untitled"}
                        </div>
                        {t && (
                          <div className="text-[11px] mt-0.5" style={{ color: t.color }}>
                            {t.label || t.name}
                          </div>
                        )}
                        {e.startTime && (
                          <div className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {e.startTime}{e.endTime ? ` – ${e.endTime}` : ""}
                          </div>
                        )}
                        {e.venue && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1 truncate">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{e.venue}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
