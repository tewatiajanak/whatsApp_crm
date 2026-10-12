import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlarmClock, ArrowLeft, ArrowLeftRight, CircleCheck, ListTodo, Target, Timer, type LucideIcon } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { fmtDate } from "@/utils/date";
import TaskDrawer from "./TaskDrawer";
import { TaskCalendar, type TaskRow } from "./TaskViews";
import { PersonAvatar, StatTile, type Tone } from "./shared";

const CARD = "rounded-xl border bg-card p-3.5";
const HEAD = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2";
const TIP = { contentStyle: { borderRadius: 8, fontSize: 12, border: "1px solid var(--border)" } };

/** A person's performance: numbers, charts and their calendar. Employees see their own. */
export default function PersonPage() {
  const { personId = "me" } = useParams();
  const toast = useToast() as (msg: string, type?: string) => void;
  const nav = useNavigate();
  const { hasRight } = useAuth() as any;
  const [d, setD] = useState<any>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [openTask, setOpenTask] = useState<string | null>(null);

  useEffect(() => {
    setD(null);
    pmApi.performance(personId).then((r: any) => {
      setD(r.data);
      const own = personId === "me";
      if (own || hasRight("tasks", "view")) pmApi.tasks(own ? "mine=1&perPage=300" : `assignee=${r.data.person._id}&perPage=300`).then((t: any) => setTasks(t?.data ?? [])).catch(() => {});
    }).catch((e: any) => toast(e?.message || "Could not load", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  if (!d) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;
  const p = d.person;
  const t = d.tiles;
  const tiles: [string, any, Tone, LucideIcon][] = [
    ["Open", t.open, "primary", ListTodo],
    ["Overdue", t.overdue, "danger", AlarmClock],
    ["Completed this month", t.completedMonth, "success", CircleCheck],
    ["On time", `${t.onTimePct}%`, t.onTimePct >= 80 ? "success" : t.onTimePct >= 50 ? "warning" : "danger", Target],
    ["Reassigned from / to", `${t.reassignedFrom} / ${t.reassignedTo}`, "info", ArrowLeftRight],
    ["Avg delay days", t.avgDelayDays, "warning", Timer],
  ];

  const planTotal = d.plan.done + d.plan.partial + d.plan.notDone;

  return (
    <div>
      <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
        <Link to="/modules/projects/team" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon shrink-0" title="Team"><ArrowLeft className="h-4 w-4" /></Link>
        <PersonAvatar name={p.name} photo={p.photo} size={52} />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-foreground leading-tight truncate">{p.name}</h2>
          <div className="text-xs text-muted-foreground truncate">{[p.designation, p.department, p.code].filter(Boolean).join(" · ") || p.email}</div>
          {p.joiningDate && <div className="text-[11px] text-muted-foreground">Joined {fmtDate(p.joiningDate)}</div>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {tiles.map(([label, value, tone, Icon]) => (
          <StatTile key={label} label={label} value={value} tone={tone} icon={Icon} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={`${CARD} lg:col-span-2`}>
          <div className={HEAD}>Tasks completed per month</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.months} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip {...TIP} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="onTime" name="On time" stackId="a" fill="var(--success)" />
                <Bar dataKey="late" name="Late" stackId="a" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={CARD}>
          <div className={HEAD}>On time vs late</div>
          {d.onTime.length === 0 ? <div className="py-10 text-center text-sm text-muted-foreground">No completed tasks</div> : (
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.onTime} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>{d.onTime.map((x: any) => <Cell key={x.name} fill={x.color} />)}</Pie>
                  <Tooltip {...TIP} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={CARD}>
          <div className={HEAD}>Projects</div>
          {d.projects.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No projects</div>}
          {d.projects.map((x: any) => (
            <button key={x._id} type="button" onClick={() => hasRight("projects", "view") && nav(`/modules/projects/p/${x._id}`)} className="flex w-full items-center justify-between gap-2 py-2 text-left" style={{ background: "transparent", border: 0, borderBottom: "1px solid var(--border)" }}>
              <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{x.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{x.open} open · {x.done} done</span>
            </button>
          ))}
        </div>
        <div className={CARD}>
          <div className={HEAD}>Daily plan, last 90 days</div>
          <div className="grid grid-cols-3 gap-2">
            {([["Done", d.plan.done, "success"], ["Partial", d.plan.partial, "warning"], ["Not done", d.plan.notDone, "danger"]] as [string, number, Tone][]).map(([label, n, tone]) => (
              <StatTile key={label} compact label={label} value={n} tone={tone} />
            ))}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">{d.plan.days} days planned{planTotal ? ` · ${Math.round((d.plan.done / planTotal) * 100)}% done as planned` : ""}</div>
        </div>
        <div className={CARD}>
          <div className={HEAD}>Days by location</div>
          {d.plan.byLocation.length === 0 ? <div className="py-6 text-center text-sm text-muted-foreground">No plans</div> : (
            <div className="space-y-2">
              {d.plan.byLocation.map((l: any) => (
                <div key={l.name} className="flex items-center gap-2 text-[13px]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />
                  <span className="flex-1">{l.name}</span>
                  <span className="font-semibold tabular-nums">{l.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="mt-3">
          <TaskCalendar tasks={tasks} onOpen={setOpenTask} />
        </div>
      )}
      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} />
    </div>
  );
}
