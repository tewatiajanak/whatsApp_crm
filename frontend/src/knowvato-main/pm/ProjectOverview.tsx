import { useEffect, useState } from "react";
import { CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Flag } from "lucide-react";
import { pmApi } from "../../api";
import { Pill } from "../user-management/shared";
import { fmtDate, fmtRelative } from "@/utils/date";
import { MasterBadge, ProgressBar, ScheduleBadge } from "./shared";

const CARD = "rounded-xl border bg-card p-3.5";
const HEAD = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2";
const TIP = { contentStyle: { borderRadius: 8, fontSize: 12, border: "1px solid var(--border)" } };

/** Project page › Overview: planned vs actual, modules, the chain that decides the end date. */
export default function ProjectOverview({ projectId, stats, modules, onOpenTask, refresh }: { projectId: string; stats: any; modules: any[]; onOpenTask: (id: string) => void; refresh: any }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    pmApi.projectOverview(projectId).then((r: any) => setD(r.data)).catch(() => {});
  }, [projectId, refresh]);
  if (!d) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;

  const R = 54;
  const C = 2 * Math.PI * R;
  const taskRow = (t: any) => (
    <button key={t._id} type="button" onClick={() => onOpenTask(t._id)} className="flex w-full items-center gap-2 py-2 text-left" style={{ background: "transparent", border: 0, borderBottom: "1px solid var(--border)" }}>
      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium" style={{ color: t.overdue ? "var(--destructive)" : "var(--foreground)" }}>{t.title}</span><span className="block truncate text-[11px] text-muted-foreground">{t.assignee}{t.due ? ` · ${fmtDate(t.due)}` : ""}</span></span>
      <MasterBadge item={t.status} fallback="" />
    </button>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className={`${CARD} flex items-center gap-4`}>
        <svg width={132} height={132} viewBox="0 0 132 132" className="shrink-0">
          <circle cx={66} cy={66} r={R} fill="none" stroke="var(--muted-background)" strokeWidth={12} />
          <circle cx={66} cy={66} r={R} fill="none" stroke={stats.schedule === "delayed" ? "var(--destructive)" : "var(--primary)"} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${(stats.progress / 100) * C} ${C}`} transform="rotate(-90 66 66)" />
          <text x={66} y={64} textAnchor="middle" fontSize={26} fontWeight={600} fill="var(--foreground)">{stats.progress}%</text>
          <text x={66} y={84} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">planned {stats.planned}%</text>
        </svg>
        <div className="min-w-0 space-y-1.5">
          <ScheduleBadge schedule={stats.schedule} />
          <div className="text-sm text-foreground">{stats.done} of {stats.total} tasks done</div>
          <div className="text-xs text-muted-foreground">Client verification: {d.verifications.pending} waiting · {d.verifications.approved} approved</div>
          <div className="text-xs text-muted-foreground">Sign-off: {d.signoffs.signed}/{d.signoffs.modules} modules{d.signoffs.pending ? ` · ${d.signoffs.pending} waiting` : ""}</div>
        </div>
      </div>

      <div className={`${CARD} lg:col-span-2`}>
        <div className={HEAD}>Planned vs actual</div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={d.curve} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10.5 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip {...TIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="planned" name="Planned" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke="var(--primary)" strokeWidth={2.5} dot={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={CARD}>
        <div className={HEAD}>Modules</div>
        <div className="space-y-2.5">
          {modules.map((m) => (
            <div key={m._id}>
              <div className="flex items-center justify-between gap-2 mb-1"><span className="min-w-0 truncate text-[13px] font-medium text-foreground">{m.name}</span><span className="text-xs font-semibold tabular-nums">{m.stats.progress}%</span></div>
              <ProgressBar value={m.stats.progress} color={m.stats.schedule === "delayed" ? "var(--destructive)" : "var(--primary)"} />
            </div>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <div className={HEAD}>Tasks by status</div>
        <div style={{ height: 190 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={d.byStatus} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={2}>{d.byStatus.map((x: any, i: number) => <Cell key={i} fill={x.color} />)}</Pie>
              <Tooltip {...TIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={CARD}>
        <div className={HEAD}>Overdue</div>
        {d.overdue.length === 0 ? <div className="py-6 text-center text-sm text-muted-foreground">No overdue tasks</div> : d.overdue.map(taskRow)}
      </div>

      <div className={`${CARD} lg:col-span-2`}>
        <div className={HEAD}>Critical path</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {d.criticalPath.map((t: any, i: number) => (
            <span key={t._id} className="inline-flex items-center gap-1.5">
              {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              <button type="button" onClick={() => onOpenTask(t._id)} className="rounded-lg border px-2.5 py-1.5 text-[12.5px]" style={{ background: "transparent", color: t.overdue ? "var(--destructive)" : t.isCompleted ? "var(--muted-foreground)" : "var(--foreground)", borderColor: t.overdue ? "var(--destructive)" : undefined, textDecoration: t.isCompleted ? "line-through" : undefined }}>{t.title}</button>
            </span>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <div className={HEAD}>Milestones</div>
        {d.milestones.length === 0 ? <div className="py-6 text-center text-sm text-muted-foreground">No milestones</div> : d.milestones.map((t: any) => (
          <button key={t._id} type="button" onClick={() => onOpenTask(t._id)} className="flex w-full items-center gap-2 py-2 text-left" style={{ background: "transparent", border: 0, borderBottom: "1px solid var(--border)" }}>
            <Flag className="h-3.5 w-3.5 shrink-0" style={{ color: "#f59e0b" }} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{t.title}</span>
            {t.isCompleted ? <Pill tone="success">Done</Pill> : <span className="text-[11px] text-muted-foreground">{t.due ? fmtDate(t.due) : ""}</span>}
          </button>
        ))}
      </div>

      <div className={`${CARD} lg:col-span-3`}>
        <div className={HEAD}>Recent activity</div>
        {d.activity.length === 0 && <div className="py-4 text-center text-sm text-muted-foreground">No activity</div>}
        {d.activity.map((a: any) => (
          <div key={a._id} className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="min-w-0 truncate text-foreground">{a.task && <b>{a.task.title}: </b>}{a.text}{(a.from || a.to) && <span className="text-muted-foreground"> · {a.from} → {a.to}</span>}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{a.byName} · {fmtRelative(a.createdAt)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
