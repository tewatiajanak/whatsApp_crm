import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { http } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useEventData } from "@/event-manager/context/EventDataContext";
import { SearchInput, UIButton } from "@/components/UIKit";
import { useColumnPicker } from "@/components/ColumnPicker";
import { fmtDateTime } from "@/utils/date";

/** Event Manager → Attendance: who came to which event, with in and out time. */
const COLUMNS = ["Sr No", "Name", "Mobile number", "Event", "Category", "In time", "Out time", "Status"];
const TH = "px-4 py-3 text-left font-medium";
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  "checked-in": { label: "Checked in", bg: "var(--success-bg)", fg: "var(--success)" },
  "checked-out": { label: "Checked out", bg: "var(--warning-bg)", fg: "var(--warning)" },
  absent: { label: "Not arrived", bg: "var(--muted-background)", fg: "var(--muted-foreground)" },
};
const statusOf = (a: any) => (STATUS[a.status] && a.status !== "absent" ? a.status : "absent");

export default function EventsAttendancePage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { events = [], attendees = [], setAttendees } = useEventData() as any;
  const [eventId, setEventId] = useState("all");
  const [status, setStatus] = useState("present");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const cols = useColumnPicker("event-attendance", COLUMNS, [0, 1]);

  const load = () => {
    setLoading(true);
    http
      .get("/attendees")
      .then((res: any) => setAttendees(res?.data ?? []))
      .catch((e: any) => toast(e?.message || "Could not load attendance", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const eventMap = useMemo(() => Object.fromEntries((events as any[]).map((e) => [e.id, e])), [events]);
  const pool = useMemo(
    () => (attendees as any[]).filter((a) => eventMap[a.eventId] && (eventId === "all" || a.eventId === eventId)),
    [attendees, eventMap, eventId]
  );
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pool
      .filter((a) => {
        const st = statusOf(a);
        return status === "all" || (status === "present" ? st !== "absent" : st === status);
      })
      .filter((a) => !q || `${a.name || ""} ${a.phone || ""}`.toLowerCase().includes(q))
      // latest arrival first; people who have not arrived go last
      .sort((a, b) => String(b.checkInTime || "").localeCompare(String(a.checkInTime || "")));
  }, [pool, status, search]);
  const present = useMemo(() => pool.filter((a) => statusOf(a) !== "absent").length, [pool]);

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      <div className="pb-2 border-b">
        <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight m-0">Attendance</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="ui-input" value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ minWidth: 200 }}>
          <option value="all">All events</option>
          {(events as any[]).map((e) => (
            <option key={e.id} value={e.id}>{e.eventName || "Untitled"}</option>
          ))}
        </select>
        <select className="ui-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="present">Attended</option>
          <option value="checked-in">Checked in</option>
          <option value="checked-out">Checked out</option>
          <option value="absent">Not arrived</option>
          <option value="all">Everyone</option>
        </select>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or mobile…" containerClassName="flex-1 min-w-[200px] max-w-md" />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{loading ? "Loading…" : `${present} of ${pool.length} attended`}</span>
          <UIButton size="icon-sm" variant="outline" onClick={load} title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></UIButton>
          {cols.button}
        </div>
      </div>
      {cols.style}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table id={cols.tableId} className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className={TH} style={{ width: 64 }}>Sr No</th>
                <th className={TH}>Name</th>
                <th className={TH}>Mobile number</th>
                <th className={TH}>Event</th>
                <th className={TH}>Category</th>
                <th className={TH}>In time</th>
                <th className={TH}>Out time</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">No attendance for this selection.</td>
                </tr>
              )}
              {rows.map((a, i) => {
                const st = STATUS[statusOf(a)];
                const came = statusOf(a) !== "absent";
                return (
                  <tr key={a.id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{a.name || "—"}</td>
                    <td className="px-4 py-2.5">{a.phone || "—"}</td>
                    <td className="px-4 py-2.5">{eventMap[a.eventId]?.eventName}</td>
                    <td className="px-4 py-2.5">{a.category || "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{came ? fmtDateTime(a.checkInTime) : "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{came ? fmtDateTime(a.checkOutTime) : "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
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
