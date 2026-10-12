import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, MapPin } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UIButton } from "../components/UIKit";
import { Pill } from "../user-management/shared";
import { fmtDate } from "@/utils/date";
import EmployeePicker from "./EmployeePicker";
import { usePm } from "./PmLayout";
import TaskDrawer from "./TaskDrawer";
import { MasterBadge, PersonAvatar, addDays, exportRows, todayYmd, ymd } from "./shared";
import WorkTitle from "./WorkTabs";

const SPANS = [["day", "Day", 1], ["week", "Week", 7], ["month", "Month", 31]] as const;
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Project Management → Team Calendar: who works where, on what, and what is due. */
export default function TeamCalendarPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const isMobile = useIsMobile();
  const { hasRight } = useAuth() as any;
  const { employees, masters } = usePm();
  const [span, setSpan] = useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [by, setBy] = useState<"person" | "project">("person");
  const [f, setF] = useState({ team: "", employee: "", project: "", location: "" });
  const [data, setData] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [detail, setDetail] = useState<{ emp: any; date: string; cell: any } | null>(null);
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [layers, setLayers] = useState({ plans: true, tasks: true, meetings: true, holidays: true });

  // the visible range: a day, the Monday–Sunday week, or the whole month
  const [from, to] = useMemo(() => {
    if (span === "day") return [anchor, anchor];
    if (span === "week") {
      const monday = addDays(anchor, -((anchor.getDay() + 6) % 7));
      return [monday, addDays(monday, 6)];
    }
    return [new Date(anchor.getFullYear(), anchor.getMonth(), 1), new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)];
  }, [span, anchor]);

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ from: ymd(from), to: ymd(to) });
      Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
      const res: any = await pmApi.teamCalendar(q.toString());
      setData(res.data);
    } catch (e: any) {
      toast(e?.message || "Could not load the calendar", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, f]);
  useEffect(() => {
    if (hasRight("team", "view")) pmApi.hierarchy().then((r: any) => setTeams(r?.data?.teams ?? [])).catch(() => {});
    if (hasRight("projects", "view")) pmApi.projects().then((r: any) => setProjects(r?.data ?? [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (dir: number) => setAnchor(span === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1) : addDays(anchor, dir * (span === "week" ? 7 : 1)));
  const holidays = useMemo(() => new Map<string, string>((data?.holidays || []).map((h: any) => [h.date, h.name])), [data]);
  const today = todayYmd();
  const days: string[] = data?.days || [];
  const cellOf = (emp: string, date: string) => data?.cells?.[emp]?.[date];

  // "By project": the same data turned around — project rows, people working on it per day
  const projectRows = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string; days: Record<string, Map<string, any>> }>();
    for (const emp of data.employees) {
      for (const date of days) {
        const c = cellOf(emp._id, date);
        if (!c) continue;
        const add = (p: any) => {
          if (!p?._id) return;
          if (!map.has(p._id)) map.set(p._id, { name: p.name, days: {} });
          const row = map.get(p._id)!;
          row.days[date] = row.days[date] || new Map();
          row.days[date].set(emp._id, emp);
        };
        c.entries.forEach((e: any) => add(e.project));
        c.tasks.forEach((t: any) => add(t.project));
      }
    }
    return [...map.entries()].map(([id, v]) => ({ _id: id, ...v })).sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const exportExcel = () => {
    const rows: any[] = [];
    for (const emp of data.employees) {
      for (const date of days) {
        const c = cellOf(emp._id, date);
        (c?.entries || []).forEach((e: any) =>
          rows.push({ Date: fmtDate(date), Employee: emp.name, Location: e.location?.name || "", "Client / site": e.site, Project: e.project?.name || "", Work: e.task?.title || e.description, Hours: e.hours, From: e.from, To: e.to, Result: e.result === "not_done" ? "Not done" : e.result ? e.result[0].toUpperCase() + e.result.slice(1) : "", Remarks: e.remarks })
        );
      }
    }
    if (!rows.length) return toast("No plans in this period", "error");
    exportRows(`plan-register-${ymd(from)}-to-${ymd(to)}.xlsx`, "Plan register", rows);
  };

  const cell = (emp: any, date: string) => {
    const c = cellOf(emp._id, date);
    const off = layers.holidays && holidays.has(date);
    return (
      <td key={date} className="border-l border-b align-top p-1" style={{ minWidth: span === "month" ? 54 : 120, background: date === today ? "color-mix(in srgb, var(--primary) 7%, transparent)" : off ? "var(--muted-background)" : undefined }}>
        {c && (
          <button type="button" onClick={() => setDetail({ emp, date, cell: c })} className="block w-full text-left" style={{ background: "transparent", border: 0, padding: 0 }}>
            {layers.plans && [...new Map(c.entries.filter((e: any) => e.location).map((e: any) => [e.location._id, e.location])).values()].map((l: any) => (
              <span key={l._id} className="mb-0.5 flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10.5px] font-semibold" style={{ background: `color-mix(in srgb, ${l.color} 16%, transparent)`, color: l.color }}>
                <MapPin className="h-2.5 w-2.5 shrink-0" />{span === "month" ? l.name.slice(0, 3) : l.name}
              </span>
            ))}
            {layers.plans && c.hours > 0 && <span className="block text-[10.5px] text-muted-foreground">{c.hours}h</span>}
            {layers.meetings && c.meetings?.length > 0 && (
              <span className="mt-0.5 mr-0.5 inline-flex items-center rounded px-1 py-0.5 text-[10.5px] font-semibold" style={{ background: "var(--info-bg)", color: "var(--info)" }}>{c.meetings.length} mtg</span>
            )}
            {layers.tasks && c.tasks.length > 0 && (
              <span className="mt-0.5 inline-flex items-center rounded px-1 py-0.5 text-[10.5px] font-semibold" style={c.tasks.some((t: any) => t.overdue) ? { background: "var(--destructive-bg)", color: "var(--destructive)" } : { background: "var(--muted-background)", color: "var(--muted-foreground)" }}>
                {c.tasks.length} due
              </span>
            )}
          </button>
        )}
      </td>
    );
  };

  return (
    <>
      <WorkTitle
        actions={hasRight("team_calendar", "export") && <UIButton variant="outline" onClick={exportExcel} disabled={!data} leftIcon={<Download className="h-3.5 w-3.5" />}>Export Excel</UIButton>}
      />

      {/* who is where today */}
      {data?.today?.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {data.today.map((g: any) => (
            <div key={g.location._id} className="shrink-0 rounded-xl border bg-card p-3" style={{ minWidth: 200 }}>
              <div className="flex items-center justify-between gap-2">
                <MasterBadge item={g.location} />
                <span className="text-xl font-semibold leading-none" style={{ color: g.location.color }}>{g.people.length}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {g.people.slice(0, 8).map((p: any) => <span key={p._id} title={`${p.name}${p.site ? ` · ${p.site}` : ""}`}><PersonAvatar name={p.name} photo={p.photo} size={24} /></span>)}
                {g.people.length > 8 && <span className="text-[11px] text-muted-foreground self-center">+{g.people.length - 8}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <UIButton size="icon-sm" variant="outline" title="Previous" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></UIButton>
          <span className="px-1 text-sm font-semibold text-foreground whitespace-nowrap">{span === "day" ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`}</span>
          <UIButton size="icon-sm" variant="outline" title="Next" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></UIButton>
          <UIButton size="sm" variant="ghost" onClick={() => setAnchor(new Date())}>Today</UIButton>
        </div>
        <div className="pm-seg">
          {SPANS.map(([v, label]) => (
            <button key={v} type="button" onClick={() => setSpan(v)} className={span === v ? "is-on" : ""}>{label}</button>
          ))}
        </div>
        <div className="pm-seg">
          {([["person", "By person"], ["project", "By project"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setBy(v)} className={by === v ? "is-on" : ""}>{label}</button>
          ))}
        </div>
        {teams.length > 0 && (
          <select className="ui-input" value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })}>
            <option value="">All teams</option>
            {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        )}
        <div style={{ width: 200 }}><EmployeePicker employees={employees} value={f.employee} onChange={(id) => setF({ ...f, employee: id })} emptyLabel="All employees" /></div>
        {projects.length > 0 && (
          <select className="ui-input" value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}>
            <option value="">All projects</option>
            {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        )}
        <select className="ui-input" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })}>
          <option value="">All locations</option>
          {(masters.work_location || []).map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
        </select>
        <div className="pm-chips is-sm lg:ml-auto">
          {([["plans", "Daily plans"], ["tasks", "Tasks due"], ["meetings", "Meetings"], ["holidays", "Holidays"]] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={layers[k]} onClick={() => setLayers({ ...layers, [k]: !layers[k] })} className={layers[k] ? "is-on" : ""}>{label}</button>
          ))}
        </div>
      </div>

      {loading && !data && <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>}
      {data && (by === "person" ? data.employees.length === 0 : projectRows.length === 0) && <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">Nothing planned</div>}

      {/* phone, one day: a simple list */}
      {data && by === "person" && isMobile && span === "day" && (
        <div className="space-y-2">
          {data.employees.map((emp: any) => {
            const c = cellOf(emp._id, days[0]);
            return (
              <div key={emp._id} className="rounded-xl border bg-card p-3" onClick={() => c && setDetail({ emp, date: days[0], cell: c })}>
                <div className="flex items-center gap-2.5">
                  <PersonAvatar name={emp.name} photo={emp.photo} size={32} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{emp.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {c ? [...new Map(c.entries.filter((e: any) => e.location).map((e: any) => [e.location._id, e.location])).values()].map((l: any) => <MasterBadge key={l._id} item={l} />) : <span className="text-[11px] text-muted-foreground">No plan</span>}
                    </div>
                  </div>
                  {c && <span className="text-xs text-muted-foreground whitespace-nowrap">{c.hours > 0 && `${c.hours}h · `}{c.tasks.length} due</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data && by === "person" && !(isMobile && span === "day") && data.employees.length > 0 && (
        <div className="rounded-xl border bg-card overflow-auto" style={{ maxHeight: "70vh" }}>
          <table className="text-sm" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "100%" }}>
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="sticky left-0 top-0 z-20 px-3 py-2 text-left font-medium border-b" style={{ background: "var(--muted-background)", minWidth: isMobile ? 120 : 190 }}>Person</th>
                {days.map((d) => (
                  <th key={d} title={holidays.get(d)} className="sticky top-0 z-10 px-1 py-2 text-center font-medium border-b border-l" style={{ background: d === today ? "var(--primary)" : "var(--muted-background)", color: d === today ? "#fff" : layers.holidays && holidays.has(d) ? "var(--destructive)" : undefined }}>
                    <div>{WD[new Date(`${d}T00:00:00`).getDay()]}</div>
                    <div className="text-[12px] font-semibold">{Number(d.slice(8))}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.employees.map((emp: any) => (
                <tr key={emp._id}>
                  <td className="sticky left-0 z-10 px-3 py-2 border-b bg-card">
                    <div className="flex items-center gap-2">
                      <PersonAvatar name={emp.name} photo={emp.photo} size={26} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-foreground truncate" style={{ maxWidth: isMobile ? 80 : 140 }}>{emp.name}</div>
                        {!isMobile && <div className="text-[10.5px] text-muted-foreground truncate" style={{ maxWidth: 140 }}>{emp.designation}</div>}
                      </div>
                    </div>
                  </td>
                  {days.map((d) => cell(emp, d))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && by === "project" && projectRows.length > 0 && (
        <div className="rounded-xl border bg-card overflow-auto" style={{ maxHeight: "70vh" }}>
          <table className="text-sm" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "100%" }}>
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="sticky left-0 top-0 z-20 px-3 py-2 text-left font-medium border-b" style={{ background: "var(--muted-background)", minWidth: isMobile ? 120 : 210 }}>Project</th>
                {days.map((d) => (
                  <th key={d} className="sticky top-0 z-10 px-1 py-2 text-center font-medium border-b border-l" style={{ background: d === today ? "var(--primary)" : "var(--muted-background)", color: d === today ? "#fff" : undefined }}>
                    <div>{WD[new Date(`${d}T00:00:00`).getDay()]}</div>
                    <div className="text-[12px] font-semibold">{Number(d.slice(8))}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projectRows.map((p) => (
                <tr key={p._id}>
                  <td className="sticky left-0 z-10 px-3 py-2 border-b bg-card text-[13px] font-medium text-foreground">{p.name}</td>
                  {days.map((d) => (
                    <td key={d} className="border-b border-l p-1 align-top" style={{ minWidth: span === "month" ? 54 : 110 }}>
                      <div className="flex flex-wrap gap-0.5">
                        {[...(p.days[d]?.values() || [])].map((emp: any) => <span key={emp._id} title={emp.name}><PersonAvatar name={emp.name} photo={emp.photo} size={22} /></span>)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* one person, one day */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{detail?.emp.name} · {detail && fmtDate(detail.date)}</SheetTitle></SheetHeader>
          {detail && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {detail.cell.entries.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Plan{detail.cell.hours > 0 && ` · ${detail.cell.hours}h`}</div>
                  <div className="rounded-lg border divide-y">
                    {detail.cell.entries.map((e: any) => (
                      <div key={e._id} className="px-3 py-2.5">
                        <div className="text-sm font-medium text-foreground">{e.task?.title || e.description}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <MasterBadge item={e.location} />
                          {e.site && <span>{e.site}</span>}
                          {e.project && <span>· {e.project.name}</span>}
                          {(e.hours > 0 || (e.from && e.to)) && <span>· {e.hours > 0 ? `${e.hours}h` : ""}{e.from && e.to ? ` (${e.from}–${e.to})` : ""}</span>}
                          {e.result && <Pill tone={e.result === "done" ? "success" : e.result === "partial" ? "warning" : "danger"}>{e.result === "not_done" ? "Not done" : e.result === "done" ? "Done" : "Partial"}</Pill>}
                        </div>
                        {e.remarks && <div className="mt-1 text-xs text-muted-foreground">{e.remarks}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detail.cell.meetings?.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Meetings</div>
                  <div className="rounded-lg border divide-y">
                    {detail.cell.meetings.map((m: any) => (
                      <div key={m._id} className="flex items-center gap-2 px-3 py-2.5">
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground">{m.title}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{m.from} – {m.to}</span>
                        <MasterBadge item={m.type} fallback="" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {detail.cell.tasks.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Due</div>
                  <div className="rounded-lg border divide-y">
                    {detail.cell.tasks.map((t: any) => (
                      <button key={t._id} type="button" onClick={() => setOpenTask(t._id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left" style={{ background: "transparent", border: 0 }}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground">{t.title}</span>
                          {t.project && <span className="block truncate text-[11px] text-muted-foreground">{t.project.name}</span>}
                        </span>
                        {t.overdue ? <Pill tone="danger">Overdue</Pill> : <MasterBadge item={t.status} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} onChanged={load} />
    </>
  );
}
