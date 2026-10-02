import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  ArrowLeft,
  Users,
  Calendar,
  Building2,
  UserCheck,
  Activity,
  DollarSign,
  Award,
} from "lucide-react";
import { appStore } from "../../api/appStore";

const load = (key: string): any[] => {
  try {
    return JSON.parse(appStore.getItem(key) || "[]");
  } catch {
    return [];
  }
};

const days = 30;

export default function ReportsAnalyticsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [eventTypes, setEventTypes] = useState<any[]>([]);

  useEffect(() => {
    setEvents(load("em_mock_events"));
    setAttendees(load("em_mock_attendees"));
    setEventTypes(load("em_mock_event-types"));
  }, []);

  const stats = useMemo(() => {
    const now = Date.now();
    const cutoff = now - days * 86_400_000;
    const recentAttendees = attendees.filter((a) => a.createdAt && new Date(a.createdAt).getTime() >= cutoff);
    const confirmed = attendees.filter((a) => (a.status || "").toLowerCase().includes("confirm")).length;
    const checkedIn = attendees.filter((a) => (a.status || "").toLowerCase().includes("check") || (a.status || "").toLowerCase().includes("attend")).length;
    const upcoming = events.filter((e) => e.startDate && new Date(e.startDate).getTime() > now).length;
    const completed = events.filter((e) => e.endDate && new Date(e.endDate).getTime() < now).length;
    return {
      totalParticipants: new Set(attendees.map((a) => a.email || a.mobile || a.id)).size,
      registrations: attendees.length,
      recentRegistrations: recentAttendees.length,
      events: events.length,
      upcoming,
      completed,
      confirmed,
      checkedIn,
      attendanceRate: confirmed > 0 ? Math.round((checkedIn / confirmed) * 100) : 0,
    };
  }, [events, attendees]);

  // Registration trend (last 30 days)
  const trend = useMemo(() => {
    const now = new Date();
    const bins: { day: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().split("T")[0];
      bins.push({ day: key, count: 0 });
    }
    attendees.forEach((a) => {
      if (!a.createdAt) return;
      const key = new Date(a.createdAt).toISOString().split("T")[0];
      const bin = bins.find((b) => b.day === key);
      if (bin) bin.count++;
    });
    return bins;
  }, [attendees]);

  const maxTrend = Math.max(1, ...trend.map((b) => b.count));

  // Events by type
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((e) => {
      const key = e.eventType || "unspecified";
      map[key] = (map[key] || 0) + 1;
    });
    const list = Object.entries(map).map(([k, count]) => {
      const t = eventTypes.find((et) => et.id === k || et.key === k);
      return { key: k, label: t?.label || t?.name || "Unspecified", color: t?.color || "#94a3b8", count };
    }).sort((a, b) => b.count - a.count);
    return list;
  }, [events, eventTypes]);

  const totalByType = byType.reduce((a, b) => a + b.count, 0);

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link to="/modules/reports" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1" style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-3 w-3" /> Back to Reports
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
              <TrendingUp className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Org Analytics</h1>
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total participants", value: stats.totalParticipants.toLocaleString(), icon: Users, color: "var(--primary)" },
          { label: "Registrations", value: stats.registrations.toLocaleString(), icon: UserCheck, color: "var(--info)" },
          { label: "Events", value: stats.events, icon: Calendar, color: "var(--success)" },
          { label: "Attendance rate", value: `${stats.attendanceRate}%`, icon: Activity, color: "var(--warning)" },
          { label: `Registrations (last ${days}d)`, value: stats.recentRegistrations.toLocaleString(), icon: TrendingUp, color: "var(--info)" },
          { label: "Confirmed", value: stats.confirmed.toLocaleString(), icon: UserCheck, color: "var(--success)" },
          { label: "Checked-in", value: stats.checkedIn.toLocaleString(), icon: Activity, color: "var(--success)" },
          { label: "Upcoming events", value: stats.upcoming, icon: Calendar, color: "var(--warning)" },
        ].map((s) => {
          const Ico = s.icon;
          return (
            <div key={s.label} className="rounded-xl border bg-card p-3.5 flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md shrink-0" style={{ background: `color-mix(in srgb, ${s.color} 12%, transparent)`, color: s.color }}>
                <Ico className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xl font-semibold text-foreground tabular-nums">{s.value}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend + Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Registration trend</div>
              <div className="text-[11px] text-muted-foreground">Last {days} days</div>
            </div>
            <div className="text-xs text-muted-foreground">
              Peak: <strong className="text-foreground">{maxTrend}</strong>
            </div>
          </div>
          <div className="flex items-end gap-0.5 h-40 overflow-hidden">
            {trend.map((b, i) => (
              <div
                key={i}
                className="flex-1 min-w-[3px] rounded-t transition-colors hover:opacity-80"
                style={{
                  height: `${(b.count / maxTrend) * 100}%`,
                  background: `color-mix(in srgb, var(--primary) ${30 + (b.count / maxTrend) * 60}%, transparent)`,
                }}
                title={`${b.day}: ${b.count}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2">
            <span>{trend[0]?.day}</span>
            <span>{trend[trend.length - 1]?.day}</span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm font-semibold text-foreground mb-3">Events by type</div>
          {byType.length === 0 && <div className="text-xs text-muted-foreground italic text-center py-4">No events yet</div>}
          <div className="space-y-2">
            {byType.slice(0, 8).map((t) => (
              <div key={t.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                    <span className="text-foreground">{t.label}</span>
                  </div>
                  <span className="font-medium text-muted-foreground tabular-nums">{t.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(t.count / totalByType) * 100}%`, background: t.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Health signals */}
      <div className="rounded-xl border bg-card p-4">
        <div className="text-sm font-semibold text-foreground mb-3">Event Health</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: "Registration momentum", value: stats.recentRegistrations, target: 100, color: "var(--info)", icon: TrendingUp },
            { label: "Attendance rate", value: stats.attendanceRate, target: 80, unit: "%", color: "var(--success)", icon: UserCheck },
            { label: "Upcoming events", value: stats.upcoming, target: 5, color: "var(--warning)", icon: Calendar },
          ].map((h) => {
            const pct = Math.min(100, Math.round((h.value / h.target) * 100));
            const Ico = h.icon;
            return (
              <div key={h.label} className="p-3 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Ico className="h-3.5 w-3.5" style={{ color: h.color }} />
                  <div className="text-xs font-medium text-foreground">{h.label}</div>
                </div>
                <div className="flex items-baseline gap-1">
                  <div className="text-2xl font-semibold tabular-nums" style={{ color: h.color }}>{h.value}{h.unit || ""}</div>
                  <div className="text-xs text-muted-foreground">/ {h.target}{h.unit || ""}</div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: h.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
