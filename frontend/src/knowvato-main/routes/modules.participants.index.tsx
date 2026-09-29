import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Search,
  Filter as FilterIcon,
  Mail,
  Phone,
  Building2,
  Download,
  UserPlus,
  Trash2,
  Eye,
  X,
} from "lucide-react";

type Attendee = {
  id: string;
  eventId?: string;
  name?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  company?: string;
  status?: string;
  createdAt?: string;
  [k: string]: any;
};

const STORAGE_ATTENDEES = "em_mock_attendees";
const STORAGE_EVENTS = "em_mock_events";

const loadAttendees = (): Attendee[] => {
  try {
    const raw = localStorage.getItem(STORAGE_ATTENDEES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const loadEvents = () => {
  try {
    const raw = localStorage.getItem(STORAGE_EVENTS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveAttendees = (arr: Attendee[]) => {
  try {
    localStorage.setItem(STORAGE_ATTENDEES, JSON.stringify(arr));
  } catch {}
};

const initials = (name?: string) =>
  (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");

const statusStyle = (s?: string) => {
  const S = (s || "").toLowerCase();
  if (S.includes("checked") || S.includes("attended"))
    return { bg: "var(--success-bg)", fg: "var(--success)", label: "Checked-in" };
  if (S.includes("confirm") || S.includes("approved"))
    return { bg: "var(--info-bg)", fg: "var(--info)", label: "Confirmed" };
  if (S.includes("pending") || S.includes("wait"))
    return { bg: "var(--warning-bg)", fg: "var(--warning)", label: "Pending" };
  if (S.includes("cancel") || S.includes("reject"))
    return { bg: "var(--destructive-bg)", fg: "var(--destructive)", label: "Cancelled" };
  return {
    bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)",
    fg: "var(--muted-foreground)",
    label: s || "Registered",
  };
};

export default function ParticipantsIndexPage() {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [detail, setDetail] = useState<Attendee | null>(null);

  useEffect(() => {
    setAttendees(loadAttendees());
    setEvents(loadEvents());
  }, []);

  // Group by unique person (email or phone) to get org-wide participants
  const participants = useMemo(() => {
    const groups: Record<string, { key: string; profile: Attendee; regs: Attendee[] }> = {};
    attendees.forEach((a) => {
      const key = (a.email || a.mobile || a.phone || a.id || "").toString().toLowerCase();
      if (!groups[key]) groups[key] = { key, profile: a, regs: [] };
      groups[key].regs.push(a);
    });
    return Object.values(groups).map((g) => ({
      ...g,
      profile: {
        ...g.profile,
        events: g.regs.length,
      },
    }));
  }, [attendees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return participants.filter((p) => {
      if (statusFilter !== "all" && !p.regs.some((r) => (r.status || "").toLowerCase().includes(statusFilter))) return false;
      if (eventFilter !== "all" && !p.regs.some((r) => r.eventId === eventFilter)) return false;
      if (q) {
        const hay = `${p.profile.name ?? ""} ${p.profile.email ?? ""} ${p.profile.mobile ?? ""} ${p.profile.phone ?? ""} ${p.profile.company ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [participants, search, statusFilter, eventFilter]);

  const removeParticipant = (key: string) => {
    if (!confirm("Remove this participant from all their events?")) return;
    const targets = participants.find((p) => p.key === key)?.regs.map((r) => r.id) || [];
    const next = attendees.filter((a) => !targets.includes(a.id));
    setAttendees(next);
    saveAttendees(next);
  };

  const exportCsv = () => {
    const headers = ["Name", "Email", "Phone", "Company", "Events", "Status"];
    const rows = filtered.map((p) => [
      p.profile.name || "",
      p.profile.email || "",
      p.profile.mobile || p.profile.phone || "",
      p.profile.company || "",
      p.regs.length.toString(),
      p.regs.map((r) => r.status || "registered").join(" · "),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `participants-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const eventById = (id?: string) => events.find((e: any) => e.id === id);

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Users className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">All Participants</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Every person in your workspace, deduplicated across events by email or phone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, company…"
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">All statuses</option>
          <option value="checked">Checked-in</option>
          <option value="confirm">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="cancel">Cancelled</option>
        </select>
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm min-w-[160px]"
        >
          <option value="all">All events</option>
          {events.map((e: any) => (
            <option key={e.id} value={e.id}>{e.eventName || "Untitled"}</option>
          ))}
        </select>
        <div className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <FilterIcon className="h-3.5 w-3.5" />
          {filtered.length} of {participants.length}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Participants", value: participants.length, icon: Users, color: "var(--primary)" },
          { label: "Total registrations", value: attendees.length, icon: UserPlus, color: "var(--info)" },
          { label: "Events", value: events.length, icon: Building2, color: "var(--success)" },
          {
            label: "Avg / participant",
            value: participants.length ? (attendees.length / participants.length).toFixed(1) : "0",
            icon: FilterIcon,
            color: "var(--warning)",
          },
        ].map((s) => {
          const Ico = s.icon;
          return (
            <div key={s.label} className="rounded-xl border bg-card p-3.5 flex items-center gap-3">
              <span
                className="inline-flex h-9 w-9 items-center justify-center rounded-md shrink-0"
                style={{
                  background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                  color: s.color,
                }}
              >
                <Ico className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xl font-semibold text-foreground tabular-nums">{s.value}</div>
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className="px-4 py-3 text-left font-medium">Participant</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Events</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {participants.length === 0
                      ? "No participants yet. Register attendees from any event."
                      : "No participants match your filters."}
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const latestSt = statusStyle(p.regs[0]?.status);
                return (
                  <tr key={p.key} className="border-t hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full shrink-0 text-xs font-semibold"
                          style={{
                            background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                            color: "var(--primary)",
                          }}
                        >
                          {initials(p.profile.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {p.profile.name || <span className="italic text-muted-foreground">Anonymous</span>}
                          </div>
                          {p.regs.length > 1 && (
                            <div className="text-[11px] text-muted-foreground">
                              {p.regs.length} registrations
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-xs space-y-0.5">
                        {p.profile.email && (
                          <div className="inline-flex items-center gap-1 text-foreground truncate max-w-xs">
                            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{p.profile.email}</span>
                          </div>
                        )}
                        {(p.profile.mobile || p.profile.phone) && (
                          <div className="inline-flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            <span>{p.profile.mobile || p.profile.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate">
                      {p.profile.company || <span className="italic opacity-60">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        <Building2 className="h-3 w-3 text-muted-foreground" />
                        {p.regs.length}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
                        style={{ background: latestSt.bg, color: latestSt.fg }}
                      >
                        {latestSt.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDetail(p.profile)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground"
                          title="View"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeParticipant(p.key)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600"
                          title="Remove"
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

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div
            className="bg-card rounded-xl border shadow-2xl w-full max-w-lg p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold"
                  style={{
                    background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  {initials(detail.name)}
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-foreground truncate">
                    {detail.name || "Anonymous"}
                  </div>
                  {detail.company && (
                    <div className="text-xs text-muted-foreground">{detail.company}</div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              {detail.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${detail.email}`} className="text-primary hover:underline">
                    {detail.email}
                  </a>
                </div>
              )}
              {(detail.mobile || detail.phone) && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${detail.mobile || detail.phone}`} className="text-primary hover:underline">
                    {detail.mobile || detail.phone}
                  </a>
                </div>
              )}
            </div>
            <div className="pt-3 border-t">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Registrations
              </div>
              <div className="space-y-1.5">
                {participants
                  .find((p) => p.profile.id === detail.id)
                  ?.regs.map((r) => {
                    const ev = eventById(r.eventId);
                    const st = statusStyle(r.status);
                    return (
                      <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-md border">
                        <div className="text-sm text-foreground truncate">
                          {ev?.eventName || "Untitled event"}
                        </div>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium shrink-0"
                          style={{ background: st.bg, color: st.fg }}
                        >
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
            <div className="pt-3 border-t">
              <Link
                to="/modules/participants/segments"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                style={{ textDecoration: "none" }}
              >
                Build a segment including this participant →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
