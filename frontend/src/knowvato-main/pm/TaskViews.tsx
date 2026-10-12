import { Fragment, useMemo, useState } from "react";
import { CheckSquare, ChevronLeft, ChevronRight, Link2 } from "lucide-react";
import { pmApi } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { UIButton } from "../components/UIKit";
import { TH } from "../user-management/shared";
import { fmtDate } from "@/utils/date";
import { usePm } from "./PmLayout";
import { MasterBadge, PersonAvatar, TatBadge, addDays, ymd } from "./shared";

export type TaskRow = {
  _id: string; number: string; title: string; kind: string; overdue: boolean; isCompleted: boolean; isPaused: boolean; isStarted?: boolean;
  due?: string | null; start?: string | null; plannedStart?: string | null; plannedDue?: string | null; actualStart?: string | null; actualEnd?: string | null;
  checklistDone: number; checklistTotal: number; dependsOn: string[]; milestone?: boolean;
  assignee?: { _id: string; name: string; photo?: string } | null;
  status?: { _id: string; name: string; color: string } | null;
  priority?: { _id: string; name: string; color: string } | null;
  project?: { _id: string; name: string; code: string } | null;
  projectModule?: { _id: string; name: string } | null;
};

const OVERDUE_ROW = { background: "color-mix(in srgb, var(--destructive) 6%, transparent)" };

/* ───────────── list ───────────── */
export function TaskList({
  tasks, onOpen, groupByModule, showProject, selected, onSelect,
}: {
  tasks: TaskRow[];
  onOpen: (id: string) => void;
  groupByModule?: boolean;
  showProject?: boolean;
  /** bulk selection (ids); leave out to hide the tick boxes */
  selected?: string[];
  onSelect?: (ids: string[]) => void;
}) {
  const isMobile = useIsMobile();
  const groups = useMemo(() => {
    if (!groupByModule) return [{ name: "", rows: tasks }];
    const map = new Map<string, { name: string; rows: TaskRow[] }>();
    tasks.forEach((t) => {
      const k = t.projectModule?._id || "";
      if (!map.has(k)) map.set(k, { name: t.projectModule?.name || "Other tasks", rows: [] });
      map.get(k)!.rows.push(t);
    });
    return [...map.values()];
  }, [tasks, groupByModule]);
  const toggle = (id: string) => onSelect?.(selected!.includes(id) ? selected!.filter((x) => x !== id) : [...selected!, id]);

  if (!tasks.length) return <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No tasks</div>;

  if (isMobile) {
    return (
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.name} className="space-y-2">
            {g.name && <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</div>}
            {g.rows.map((t) => (
              <div key={t._id} className="rounded-xl border bg-card p-3" style={t.overdue ? OVERDUE_ROW : undefined} onClick={() => onOpen(t._id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{t.title}</div>
                    {showProject && t.project && <div className="text-[11px] text-muted-foreground truncate">{t.project.name}</div>}
                  </div>
                  <TatBadge task={t} />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <MasterBadge item={t.status} />
                  <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                    {t.checklistTotal > 0 && <span className="inline-flex items-center gap-0.5"><CheckSquare className="h-3 w-3" />{t.checklistDone}/{t.checklistTotal}</span>}
                    {t.assignee && <PersonAvatar name={t.assignee.name} photo={t.assignee.photo} size={20} />}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const cols = 6 + (showProject ? 1 : 0) + (selected ? 1 : 0);
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
              {selected && (
                <th className="px-3 py-3" style={{ width: 36 }}>
                  <input type="checkbox" checked={tasks.length > 0 && selected.length === tasks.length} onChange={(e) => onSelect?.(e.target.checked ? tasks.map((t) => t._id) : [])} />
                </th>
              )}
              <th className={TH}>Task</th>
              {showProject && <th className={TH}>Project</th>}
              <th className={TH}>Assignee</th>
              <th className={TH}>Status</th>
              <th className={TH}>Due</th>
              <th className={TH}>TAT</th>
              <th className={TH}>Checklist</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.name}>
                {g.name && (
                  <tr className="border-t" style={{ background: "var(--muted-background)" }}>
                    <td colSpan={cols} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.name} · {g.rows.filter((t) => t.isCompleted).length}/{g.rows.length}</td>
                  </tr>
                )}
                {g.rows.map((t) => (
                  <tr key={t._id} className="border-t hover:bg-accent/30 cursor-pointer" style={t.overdue ? OVERDUE_ROW : undefined} onClick={() => onOpen(t._id)}>
                    {selected && (
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.includes(t._id)} onChange={() => toggle(t._id)} />
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground" style={t.isCompleted ? { color: "var(--muted-foreground)" } : undefined}>{t.title}</div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono">{t.number}</span>
                        {t.dependsOn?.length > 0 && <span className="inline-flex items-center gap-0.5"><Link2 className="h-3 w-3" />{t.dependsOn.length}</span>}
                      </div>
                    </td>
                    {showProject && <td className="px-4 py-2.5 text-xs">{t.project?.name || "—"}</td>}
                    <td className="px-4 py-2.5">{t.assignee ? <span className="inline-flex items-center gap-2"><PersonAvatar name={t.assignee.name} photo={t.assignee.photo} size={22} /><span className="truncate" style={{ maxWidth: 130 }}>{t.assignee.name}</span></span> : "—"}</td>
                    <td className="px-4 py-2.5"><MasterBadge item={t.status} /></td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{t.due ? fmtDate(t.due) : "—"}</td>
                    <td className="px-4 py-2.5"><TatBadge task={t} /></td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{t.checklistTotal ? `${t.checklistDone}/${t.checklistTotal}` : "—"}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────── board (Kanban by status) ───────────── */
export function TaskBoard({ tasks, onOpen, onChanged, showProject }: { tasks: TaskRow[]; onOpen: (id: string) => void; onChanged: () => void; showProject?: boolean }) {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { masters } = usePm();
  const [drag, setDrag] = useState("");
  const [over, setOver] = useState("");
  const statuses = (masters.task_status || []).filter((s) => s.active);

  const drop = async (status: string) => {
    const id = drag;
    setDrag("");
    setOver("");
    const task = tasks.find((t) => t._id === id);
    if (!task || task.status?._id === status) return;
    try {
      // the server decides whether this change is allowed
      await pmApi.setTaskStatus(id, status);
      onChanged();
    } catch (e: any) {
      toast(e?.message || "Could not move the task", "error");
    }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {statuses.map((s) => {
        const rows = tasks.filter((t) => t.status?._id === s._id);
        return (
          <div
            key={s._id}
            onDragOver={(e) => { e.preventDefault(); setOver(s._id); }}
            onDragLeave={() => setOver("")}
            onDrop={() => drop(s._id)}
            className="shrink-0 rounded-xl border bg-card flex flex-col"
            style={{ width: 270, outline: over === s._id ? `2px solid ${s.color}` : undefined }}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
              <MasterBadge item={s} />
              <span className="text-xs font-semibold text-muted-foreground">{rows.length}</span>
            </div>
            <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: "60vh", minHeight: 80 }}>
              {rows.map((t) => (
                <div
                  key={t._id}
                  draggable
                  onDragStart={() => setDrag(t._id)}
                  onClick={() => onOpen(t._id)}
                  className="rounded-lg border bg-card p-2.5 cursor-pointer hover:border-primary"
                  style={{ ...(t.overdue ? { borderColor: "var(--destructive)" } : {}), opacity: drag === t._id ? 0.4 : 1 }}
                >
                  <div className="text-[13px] font-medium text-foreground">{t.title}</div>
                  {showProject && t.project && <div className="text-[11px] text-muted-foreground truncate">{t.project.name}</div>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <TatBadge task={t} />
                    <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                      {t.checklistTotal > 0 && <span>{t.checklistDone}/{t.checklistTotal}</span>}
                      {t.assignee && <PersonAvatar name={t.assignee.name} photo={t.assignee.photo} size={20} />}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── calendar (month, by due date) ───────────── */
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthNav({ month, onChange }: { month: Date; onChange: (d: Date) => void }) {
  return (
    <div className="flex items-center gap-2">
      <UIButton size="icon-sm" variant="outline" title="Previous" onClick={() => onChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></UIButton>
      <span className="text-sm font-semibold text-foreground" style={{ minWidth: 120, textAlign: "center" }}>{month.toLocaleString("en-IN", { month: "long", year: "numeric" })}</span>
      <UIButton size="icon-sm" variant="outline" title="Next" onClick={() => onChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></UIButton>
      <UIButton size="sm" variant="ghost" onClick={() => onChange(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</UIButton>
    </div>
  );
}

/** The dates of a month grid, Monday first, padded to whole weeks. */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let d = start; d <= last || days.length % 7; d = addDays(d, 1)) days.push(d);
  return days;
}

export function TaskCalendar({ tasks, onOpen, extra }: { tasks: TaskRow[]; onOpen: (id: string) => void; extra?: (date: string) => React.ReactNode }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const byDay = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    tasks.forEach((t) => {
      if (!t.due) return;
      const k = ymd(new Date(t.due));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    });
    return map;
  }, [tasks]);
  const today = ymd(new Date());

  return (
    <div>
      <MonthNav month={month} onChange={setMonth} />
      <div className="mt-2 rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-7 text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
          {WEEK.map((d) => <div key={d} className="px-2 py-2 text-center font-medium">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {monthGrid(month).map((d) => {
            const k = ymd(d);
            const rows = byDay.get(k) || [];
            const other = d.getMonth() !== month.getMonth();
            return (
              <div key={k} className="border-t border-l first:border-l-0 p-1" style={{ minHeight: 86, opacity: other ? 0.45 : 1, background: k === today ? "color-mix(in srgb, var(--primary) 7%, transparent)" : undefined }}>
                <div className="text-[11px] font-semibold px-1" style={{ color: k === today ? "var(--primary)" : "var(--muted-foreground)" }}>{d.getDate()}</div>
                {extra?.(k)}
                {rows.slice(0, 3).map((t) => (
                  <button key={t._id} type="button" onClick={() => onOpen(t._id)} title={t.title} className="mt-0.5 block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px]" style={{ border: 0, background: `color-mix(in srgb, ${t.overdue ? "#dc2626" : t.status?.color || "#64748b"} 16%, transparent)`, color: t.overdue ? "#dc2626" : t.status?.color || "var(--foreground)", textDecoration: t.isCompleted ? "line-through" : undefined }}>
                    {t.title}
                  </button>
                ))}
                {rows.length > 3 && <div className="px-1.5 text-[10.5px] text-muted-foreground">+{rows.length - 3}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ───────────── timeline (simple Gantt) ───────────── */
const DAY = 86_400_000;
const ROW = 30;
const HEAD = 34;
const LABEL_W = 230;

export function TaskTimeline({ tasks, onOpen }: { tasks: TaskRow[]; onOpen: (id: string) => void }) {
  const isMobile = useIsMobile();
  const labelW = isMobile ? 130 : LABEL_W;
  const rows = useMemo(() => tasks.filter((t) => t.start && t.due), [tasks]);
  if (!rows.length) return <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No tasks</div>;

  const time = (v?: string | null) => (v ? new Date(v).getTime() : NaN);
  const all = rows.flatMap((t) => [time(t.start), time(t.due), time(t.plannedStart), time(t.plannedDue), time(t.actualEnd)]).filter((n) => !isNaN(n));
  const min = new Date(Math.min(...all, Date.now()));
  const start = new Date(min.getFullYear(), min.getMonth(), min.getDate() - 1).getTime();
  const days = Math.max(14, Math.ceil((Math.max(...all, Date.now()) - start) / DAY) + 2);
  const dayW = days > 120 ? 8 : days > 60 ? 14 : 22;
  const x = (t: number) => ((t - start) / DAY) * dayW;
  const width = days * dayW;
  const height = HEAD + rows.length * ROW;
  const indexOf = new Map(rows.map((t, i) => [t._id, i]));
  const todayX = x(Date.now());

  // one label per week on the scale
  const ticks: { x: number; label: string; month: boolean }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start + i * DAY);
    if (d.getDay() === 1 || i === 0) ticks.push({ x: i * dayW, label: `${d.getDate()}/${d.getMonth() + 1}`, month: d.getDate() <= 7 });
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex">
        {/* task names stay in place while the chart scrolls */}
        <div className="shrink-0 border-r" style={{ width: labelW }}>
          <div className="border-b px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center" style={{ height: HEAD, background: "var(--muted-background)" }}>Task</div>
          {rows.map((t) => (
            <button key={t._id} type="button" onClick={() => onOpen(t._id)} title={t.title} className="flex w-full items-center gap-1.5 border-b px-3 text-left text-[12.5px]" style={{ height: ROW, background: "transparent", border: 0, borderBottom: "1px solid var(--border)", color: t.overdue ? "var(--destructive)" : "var(--foreground)" }}>
              <span className="truncate">{t.title}</span>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto flex-1">
          <svg width={width} height={height} style={{ display: "block" }}>
            <rect x={0} y={0} width={width} height={HEAD} fill="var(--muted-background)" />
            {ticks.map((t) => (
              <g key={t.x}>
                <line x1={t.x} y1={HEAD} x2={t.x} y2={height} stroke="var(--border)" strokeWidth={1} />
                <text x={t.x + 4} y={21} fontSize={10.5} fill="var(--muted-foreground)">{t.label}</text>
              </g>
            ))}
            {rows.map((_, i) => <line key={i} x1={0} y1={HEAD + (i + 1) * ROW} x2={width} y2={HEAD + (i + 1) * ROW} stroke="var(--border)" strokeWidth={1} />)}

            {/* dependency arrows: predecessor end → this start */}
            {rows.flatMap((t, i) =>
              (t.dependsOn || []).filter((d) => indexOf.has(String(d))).map((d) => {
                const p = rows[indexOf.get(String(d))!];
                const x1 = x(time(p.actualEnd) || time(p.due));
                const y1 = HEAD + indexOf.get(String(d))! * ROW + ROW / 2;
                const x2 = x(time(t.actualStart) || time(t.start));
                const y2 = HEAD + i * ROW + ROW / 2;
                const mid = Math.max(x1 + 6, x2 - 8);
                return <path key={`${t._id}-${d}`} d={`M${x1},${y1} H${mid} V${y2} H${x2}`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.55} markerEnd="url(#pm-arrow)" />;
              })
            )}
            <defs>
              <marker id="pm-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="var(--muted-foreground)" /></marker>
            </defs>

            {rows.map((t, i) => {
              const y = HEAD + i * ROW;
              const color = t.overdue ? "var(--destructive)" : t.status?.color || "var(--muted-foreground)";
              const s = time(t.actualStart) || time(t.start);
              const e = time(t.actualEnd) || time(t.due);
              const ps = time(t.plannedStart);
              const pe = time(t.plannedDue);
              return (
                <g key={t._id} style={{ cursor: "pointer" }} onClick={() => onOpen(t._id)}>
                  {/* planned (thin, behind) */}
                  {!isNaN(ps) && !isNaN(pe) && <rect x={x(ps)} y={y + ROW - 9} width={Math.max(3, x(pe) - x(ps))} height={3} rx={1.5} fill="var(--muted-foreground)" opacity={0.35} />}
                  {/* actual / current */}
                  <rect x={x(s)} y={y + 7} width={Math.max(4, x(e) - x(s))} height={12} rx={4} fill={color} opacity={t.isCompleted ? 0.55 : 0.9}>
                    <title>{`${t.title}\n${fmtDate(new Date(s))} → ${fmtDate(new Date(e))}${t.assignee ? `\n${t.assignee.name}` : ""}`}</title>
                  </rect>
                  {t.milestone && <path d={`M${x(e)},${y + 5} l6,8 l-6,8 l-6,-8 z`} fill="#f59e0b" />}
                </g>
              );
            })}
            <line x1={todayX} y1={0} x2={todayX} y2={height} stroke="var(--primary)" strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={todayX + 4} y={11} fontSize={10} fill="var(--primary)" fontWeight={600}>Today</text>
          </svg>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block rounded" style={{ width: 18, height: 8, background: "var(--info)" }} />Actual</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block rounded" style={{ width: 18, height: 3, background: "var(--muted-foreground)", opacity: 0.5 }} />Planned</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block rounded" style={{ width: 18, height: 8, background: "var(--destructive)" }} />Overdue</span>
      </div>
    </div>
  );
}
