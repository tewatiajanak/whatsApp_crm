import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlarmClock, CalendarCheck, CalendarDays, CalendarRange, CircleCheck, Columns3, Hourglass, LayoutList, Plus, type LucideIcon } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { UIButton } from "../components/UIKit";
import QuickTask from "./QuickTask";
import TaskDrawer from "./TaskDrawer";
import { TaskBoard, TaskCalendar, TaskList, type TaskRow } from "./TaskViews";
import { StatTile, type Tone } from "./shared";
import WorkTitle from "./WorkTabs";

const TILES: [string, string, string, Tone, LucideIcon][] = [
  ["overdue", "Overdue", "overdue", "danger", AlarmClock],
  ["today", "Due today", "today", "warning", CalendarCheck],
  ["week", "This week", "week", "info", CalendarRange],
  ["waiting", "Waiting for client", "waiting", "warning", Hourglass],
  ["completedMonth", "Completed this month", "completed_month", "success", CircleCheck],
];
const VIEWS = [["list", LayoutList, "List"], ["board", Columns3, "Board"], ["calendar", CalendarDays, "Calendar"]] as const;

/** Project Management → My Work: the landing page of an employee. */
export default function MyWorkPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const nav = useNavigate();
  const { hasRight } = useAuth() as any;
  const [tiles, setTiles] = useState<Record<string, number>>({});
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [bucket, setBucket] = useState("open");
  const [view, setView] = useState<"list" | "board" | "calendar">("list");
  const [params] = useSearchParams();
  const [openTask, setOpenTask] = useState<string | null>(params.get("task"));
  const [add, setAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      // the board and the calendar show everything that is open; the list follows the chosen tile
      const [w, t]: any[] = await Promise.all([pmApi.myWork(), pmApi.tasks(`mine=1&perPage=300&bucket=${view === "list" ? bucket : "open"}`)]);
      setTiles(w.data.tiles);
      setTasks(t.data ?? []);
    } catch (e: any) {
      toast(e?.message || "Could not load your work", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket, view]);

  return (
    <>
      <WorkTitle
        actions={
          <div className="flex items-center gap-2">
            <UIButton variant="outline" onClick={() => nav("/modules/projects/people/me")}>My performance</UIButton>
            {hasRight("my_tasks", "create") && <UIButton onClick={() => setAdd(true)} leftIcon={<Plus className="h-3.5 w-3.5" />}>Task</UIButton>}
          </div>
        }
      />

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {TILES.map(([key, label, b, tone, Icon]) => {
          const active = bucket === b && view === "list";
          return <StatTile key={key} label={label} value={tiles[key] ?? 0} tone={tone} icon={Icon} active={active} onClick={() => { setView("list"); setBucket(active ? "open" : b); }} />;
        })}
      </div>

      <div className="mt-3 mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{loading ? "Loading…" : `${tasks.length} tasks`}</span>
        <div className="inline-flex rounded-lg border overflow-hidden">
          {VIEWS.map(([v, Icon, label]) => (
            <button key={v} type="button" title={label} onClick={() => setView(v)} className="inline-flex h-9 w-10 items-center justify-center" style={{ border: 0, background: view === v ? "var(--primary)" : "transparent", color: view === v ? "#fff" : "var(--muted-foreground)" }}>
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {view === "list" && <TaskList tasks={tasks} onOpen={setOpenTask} showProject />}
      {view === "board" && <TaskBoard tasks={tasks} onOpen={setOpenTask} onChanged={load} showProject />}
      {view === "calendar" && <TaskCalendar tasks={tasks} onOpen={setOpenTask} />}

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} onChanged={load} />
      <QuickTask open={add} onClose={() => setAdd(false)} onCreated={load} />
    </>
  );
}
