import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlarmClock, CalendarClock, CircleCheck, FolderKanban, Hourglass, LayoutDashboard, MapPin, ShieldCheck, Ticket, TrendingUp, TriangleAlert, type LucideIcon } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Pill } from "../user-management/shared";
import { fmtDate } from "@/utils/date";
import EmployeePicker from "./EmployeePicker";
import { usePm } from "./PmLayout";
import TaskDrawer from "./TaskDrawer";
import { PageTitle, PersonAvatar, ProgressBar, ScheduleBadge, StatTile, type Tone } from "./shared";

const TILES: [string, string, Tone, LucideIcon, string][] = [
  ["active", "Active projects", "primary", FolderKanban, "/modules/projects/list"],
  ["onTrack", "On track", "success", CircleCheck, "/modules/projects/list?schedule=on_track"],
  ["delayed", "Delayed", "danger", TriangleAlert, "/modules/projects/list?schedule=delayed"],
  ["ahead", "Ahead", "info", TrendingUp, "/modules/projects/list?schedule=ahead"],
  ["overdueTasks", "Overdue tasks", "danger", AlarmClock, "/modules/projects/tasks?bucket=overdue"],
  ["waiting", "Waiting for client", "warning", Hourglass, "/modules/projects/tasks?bucket=waiting"],
  ["pendingVerifications", "Pending verifications", "warning", ShieldCheck, "/modules/projects/tasks?bucket=waiting"],
  ["openTickets", "Open tickets", "info", Ticket, "/modules/projects/tickets"],
  ["meetingsToday", "Meetings today", "primary", CalendarClock, "/modules/projects/meetings"],
  ["onsiteToday", "Onsite today", "success", MapPin, "/modules/projects/team-calendar"],
];
const CARD = "rounded-xl border bg-card p-3.5";
const HEAD = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2";
const TIP = { contentStyle: { borderRadius: 8, fontSize: 12, border: "1px solid var(--border)" } };

/** Project Management → Dashboard: the state of all projects and people at a glance. */
export default function DashboardPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const nav = useNavigate();
  const { hasRight } = useAuth() as any;
  const { employees } = usePm();
  const [d, setD] = useState<any>(null);
  const [f, setF] = useState({ client: "", product: "", incharge: "", team: "" });
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [openTask, setOpenTask] = useState<string | null>(null);

  const load = () => {
    const q = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
    pmApi.dashboard(q.toString()).then((r: any) => setD(r.data)).catch((e: any) => toast(e?.message || "Could not load the dashboard", "error"));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);
  useEffect(() => {
    if (hasRight("clients", "view")) pmApi.clients().then((r: any) => setClients(r?.data ?? [])).catch(() => {});
    pmApi.products().then((r: any) => setProducts(r?.data ?? [])).catch(() => {});
    if (hasRight("team", "view")) pmApi.hierarchy().then((r: any) => setTeams(r?.data?.teams ?? [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (key: keyof typeof f, label: string, options: any[]) =>
    options.length > 0 && (
      <select className="ui-input" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>
        <option value="">{label}</option>
        {options.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
      </select>
    );

  return (
    <>
      <PageTitle icon={<LayoutDashboard className="h-4 w-4" />} title="Dashboard" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {select("client", "All clients", clients)}
        {select("product", "All products", products)}
        {select("team", "All teams", teams)}
        <div style={{ width: 210 }}><EmployeePicker employees={employees} value={f.incharge} onChange={(id) => setF({ ...f, incharge: id })} emptyLabel="All incharges" /></div>
      </div>

      {!d && <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>}
      {d && (
        <>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {TILES.map(([key, label, tone, Icon, link]) => (
              <StatTile key={key} label={label} value={d.tiles[key]} tone={tone} icon={Icon} onClick={() => nav(link)} />
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className={CARD}>
              <div className={HEAD}>Projects by schedule</div>
              <div style={{ height: 210 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={d.bySchedule} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2} onClick={(x: any) => nav(`/modules/projects/list?schedule=${x.key}`)} style={{ cursor: "pointer" }}>
                      {d.bySchedule.map((x: any) => <Cell key={x.key} fill={x.color} />)}
                    </Pie>
                    <Tooltip {...TIP} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                {d.bySchedule.map((x: any) => <span key={x.key} className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: x.color }} />{x.name} {x.value}</span>)}
              </div>
            </div>

            <div className={CARD}>
              <div className={HEAD}>Tasks completed per week</div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={d.completedPerWeek} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip {...TIP} />
                    <Line type="monotone" dataKey="done" name="Completed" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={CARD}>
              <div className={HEAD}>Overdue tasks by person</div>
              {d.overdueByPerson.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">No overdue tasks</div> : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.overdueByPerson} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 11 }} />
                      <Tooltip {...TIP} />
                      <Bar dataKey="value" name="Overdue" fill="#dc2626" radius={[0, 4, 4, 0]} onClick={(x: any) => nav(`/modules/projects/tasks?bucket=overdue&assignee=${x._id}`)} style={{ cursor: "pointer" }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className={CARD}>
              <div className={HEAD}>Project progress</div>
              {d.progress.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No active projects</div>}
              <div className="space-y-2.5">
                {d.progress.map((p: any) => (
                  <button key={p._id} type="button" onClick={() => nav(`/modules/projects/p/${p._id}`)} className="block w-full text-left" style={{ background: "transparent", border: 0, padding: 0 }}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{p.name}</span>
                      <span className="inline-flex items-center gap-2 shrink-0"><ScheduleBadge schedule={p.schedule} /><span className="text-xs font-semibold tabular-nums" style={{ width: 34, textAlign: "right" }}>{p.progress}%</span></span>
                    </div>
                    <ProgressBar value={p.progress} color={p.schedule === "delayed" ? "#dc2626" : p.schedule === "ahead" ? "#2563eb" : "#16a34a"} />
                  </button>
                ))}
              </div>
            </div>

            <div className={CARD}>
              <div className={HEAD}>Workload</div>
              {d.workload.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No open tasks</div>}
              <div className="space-y-2">
                {d.workload.map((w: any) => (
                  <button key={w._id} type="button" onClick={() => nav(`/modules/projects/people/${w._id}`)} className="flex w-full items-center gap-2.5 text-left" style={{ background: "transparent", border: 0, padding: 0 }}>
                    <PersonAvatar name={w.name} photo={w.photo} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-foreground">{w.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{w.open} open{w.hours > 0 && ` · ${w.hours}h this week`}</span>
                      </span>
                      <span className="mt-1 block"><ProgressBar value={Math.min(100, (w.open / Math.max(1, d.workload[0].open)) * 100)} color={w.overloaded ? "#dc2626" : "var(--primary)"} /></span>
                    </span>
                    {w.overloaded && <Pill tone="danger">Overloaded</Pill>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className={CARD}>
              <div className={HEAD}>Top delayed projects</div>
              {d.delayed.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Nothing delayed</div>}
              <div className="divide-y">
                {d.delayed.map((p: any) => (
                  <button key={p._id} type="button" onClick={() => nav(`/modules/projects/p/${p._id}`)} className="flex w-full items-center gap-2 py-2 text-left" style={{ background: "transparent", border: 0, borderBottom: "1px solid var(--border)" }}>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-foreground">{p.name}</span><span className="block truncate text-[11px] text-muted-foreground">{p.incharge} · {p.overdue} overdue</span></span>
                    <Pill tone="danger">{p.delayDays > 0 ? `${p.delayDays}d late` : "Behind plan"}</Pill>
                  </button>
                ))}
              </div>
            </div>
            <div className={CARD}>
              <div className={HEAD}>Due in the next 3 days</div>
              {d.dueSoon.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Nothing due</div>}
              <div>
                {d.dueSoon.map((t: any) => (
                  <button key={t._id} type="button" onClick={() => setOpenTask(t._id)} className="flex w-full items-center gap-2 py-2 text-left" style={{ background: "transparent", border: 0, borderBottom: "1px solid var(--border)" }}>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-foreground">{t.title}</span><span className="block truncate text-[11px] text-muted-foreground">{t.assignee}{t.project ? ` · ${t.project}` : ""}</span></span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDate(t.due)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className={CARD}>
              <div className={HEAD}>Verifications waiting</div>
              {d.verifications.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">None waiting</div>}
              <div>
                {d.verifications.map((v: any) => (
                  <button key={v._id} type="button" onClick={() => v.taskId && setOpenTask(v.taskId)} className="flex w-full items-center gap-2 py-2 text-left" style={{ background: "transparent", border: 0, borderBottom: "1px solid var(--border)" }}>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-foreground">{v.task}</span><span className="block truncate text-[11px] text-muted-foreground">{v.project}</span></span>
                    <Pill tone={v.days >= 3 ? "danger" : "warning"}>{v.days}d</Pill>
                  </button>
                ))}
              </div>
              {d.ticketsByStatus.length > 0 && (
                <>
                  <div className={`${HEAD} mt-3`}>Open tickets</div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.ticketsByStatus.map((s: any) => <button key={s.id} type="button" onClick={() => nav("/modules/projects/tickets")} className="rounded-md px-2 py-1 text-[11.5px] font-medium" style={{ border: 0, background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}>{s.name} {s.value}</button>)}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} onChanged={load} />
    </>
  );
}
