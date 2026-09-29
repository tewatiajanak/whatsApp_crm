import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEventData } from "@/event-manager/context/EventDataContext";
import {
  ArrowLeft,
  ListTodo,
  Plus,
  X,
  Flag,
  Calendar,
  ArrowRight,
  ArrowLeft as MoveLeft,
} from "lucide-react";

type Priority = "low" | "medium" | "high" | "urgent";
type Status = "todo" | "in_progress" | "blocked" | "done";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  eventId?: string | null;
  assignee?: string;
  dueDate?: string;
  createdAt: string;
};

const STORAGE_KEY = "em_tasks";
const COLUMNS: { status: Status; label: string; color: string }[] = [
  { status: "todo", label: "To do", color: "var(--muted-foreground)" },
  { status: "in_progress", label: "In progress", color: "var(--info)" },
  { status: "blocked", label: "Blocked", color: "var(--warning)" },
  { status: "done", label: "Done", color: "var(--success)" },
];

const PRIORITY_STYLE: Record<Priority, { bg: string; fg: string; label: string }> = {
  low: { bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", fg: "var(--muted-foreground)", label: "Low" },
  medium: { bg: "var(--info-bg)", fg: "var(--info)", label: "Medium" },
  high: { bg: "var(--warning-bg)", fg: "var(--warning)", label: "High" },
  urgent: { bg: "var(--destructive-bg)", fg: "var(--destructive)", label: "Urgent" },
};

const load = (): Task[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const save = (tasks: Task[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {}
};

const uid = () =>
  typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const SEED: Omit<Task, "id" | "createdAt">[] = [
  { title: "Finalize speaker list for keynote day", status: "in_progress", priority: "high" },
  { title: "Book AV vendor and confirm quote", status: "todo", priority: "urgent" },
  { title: "Design registration form with logic", status: "in_progress", priority: "medium" },
  { title: "Get sponsor logos in high resolution", status: "blocked", priority: "medium", description: "Waiting on TCS and Infosys design teams" },
  { title: "Publish 'Save the date' broadcast", status: "todo", priority: "high" },
  { title: "Approve pass design v3", status: "done", priority: "medium" },
  { title: "Confirm venue walkthrough date", status: "done", priority: "low" },
];

export default function EventsTasksPage() {
  const { events = [] } = useEventData() as any;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterEvent, setFilterEvent] = useState("all");
  const [addingIn, setAddingIn] = useState<Status | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [openTask, setOpenTask] = useState<Task | null>(null);

  useEffect(() => {
    const existing = load();
    if (existing.length === 0) {
      const seeded = SEED.map((s) => ({ ...s, id: uid(), createdAt: new Date().toISOString() }));
      save(seeded);
      setTasks(seeded);
    } else {
      setTasks(existing);
    }
  }, []);

  const persist = (next: Task[]) => {
    setTasks(next);
    save(next);
  };

  const filtered = useMemo(() => {
    if (filterEvent === "all") return tasks;
    return tasks.filter((t) => t.eventId === filterEvent);
  }, [tasks, filterEvent]);

  const byColumn = useMemo(() => {
    const out: Record<Status, Task[]> = { todo: [], in_progress: [], blocked: [], done: [] };
    filtered.forEach((t) => out[t.status].push(t));
    return out;
  }, [filtered]);

  const addTask = (status: Status) => {
    if (!newTitle.trim()) return;
    const task: Task = {
      id: uid(),
      title: newTitle.trim(),
      status,
      priority: newPriority,
      eventId: filterEvent === "all" ? null : filterEvent,
      createdAt: new Date().toISOString(),
    };
    persist([task, ...tasks]);
    setNewTitle("");
    setAddingIn(null);
  };

  const moveTask = (id: string, direction: -1 | 1) => {
    const order: Status[] = ["todo", "in_progress", "blocked", "done"];
    persist(
      tasks.map((t) => {
        if (t.id !== id) return t;
        const idx = order.indexOf(t.status);
        const nxt = Math.max(0, Math.min(order.length - 1, idx + direction));
        return { ...t, status: order[nxt] };
      })
    );
    if (openTask?.id === id) {
      const updated = tasks.find((t) => t.id === id);
      if (updated) setOpenTask({ ...updated });
    }
  };

  const removeTask = (id: string) => {
    persist(tasks.filter((t) => t.id !== id));
    if (openTask?.id === id) setOpenTask(null);
  };

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
              <ListTodo className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Tasks</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Kanban board for event execution — org-wide or scoped to a specific event.
          </p>
        </div>
        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">All events</option>
          {(events as any[]).map((e) => (
            <option key={e.id} value={e.id}>{e.eventName || "Untitled"}</option>
          ))}
        </select>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const colTasks = byColumn[col.status];
          return (
            <div key={col.status} className="rounded-xl border bg-card overflow-hidden flex flex-col">
              <div
                className="p-3 border-b flex items-center justify-between"
                style={{ background: "var(--muted-background)" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: col.color }}
                  />
                  <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    {col.label}
                  </div>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {colTasks.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAddingIn(col.status)}
                  className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-2 space-y-1.5 min-h-[200px] flex-1">
                {addingIn === col.status && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-2 space-y-2">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addTask(col.status);
                        if (e.key === "Escape") {
                          setAddingIn(null);
                          setNewTitle("");
                        }
                      }}
                      placeholder="What's the task?"
                      className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm"
                    />
                    <div className="flex items-center gap-1.5">
                      <select
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value as Priority)}
                        className="h-7 px-2 rounded-md border border-input bg-background text-xs flex-1"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => addTask(col.status)}
                        className="h-7 px-2 rounded-md text-xs font-medium text-primary-foreground"
                        style={{ background: "var(--primary)" }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingIn(null);
                          setNewTitle("");
                        }}
                        className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                {colTasks.length === 0 && addingIn !== col.status && (
                  <div className="text-[11px] text-muted-foreground text-center py-4 italic">
                    No tasks
                  </div>
                )}
                {colTasks.map((t) => {
                  const ps = PRIORITY_STYLE[t.priority];
                  return (
                    <div
                      key={t.id}
                      onClick={() => setOpenTask(t)}
                      className="rounded-lg border bg-card p-2.5 cursor-pointer hover:shadow-sm transition-shadow group"
                    >
                      <div className="text-sm font-medium text-foreground leading-snug">
                        {t.title}
                      </div>
                      {t.description && (
                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {t.description}
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: ps.bg, color: ps.fg }}
                        >
                          <Flag className="h-2.5 w-2.5" />
                          {ps.label}
                        </span>
                        <div className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5 transition-opacity">
                          {col.status !== "todo" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveTask(t.id, -1);
                              }}
                              className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                              title="Move left"
                            >
                              <MoveLeft className="h-3 w-3" />
                            </button>
                          )}
                          {col.status !== "done" && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveTask(t.id, 1);
                              }}
                              className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                              title="Move right"
                            >
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail drawer */}
      {openTask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setOpenTask(null)}>
          <div
            className="bg-card rounded-xl border shadow-2xl w-full max-w-md p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Task</div>
                <div className="text-lg font-semibold text-foreground mt-0.5">{openTask.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpenTask(null)}
                className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {openTask.description && (
              <div className="text-sm text-muted-foreground">{openTask.description}</div>
            )}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground uppercase tracking-wider mb-1">Status</div>
                <div className="font-medium text-foreground capitalize">
                  {openTask.status.replace("_", " ")}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground uppercase tracking-wider mb-1">Priority</div>
                <span
                  className="inline-flex items-center gap-1 font-medium px-1.5 py-0.5 rounded"
                  style={{ background: PRIORITY_STYLE[openTask.priority].bg, color: PRIORITY_STYLE[openTask.priority].fg }}
                >
                  <Flag className="h-3 w-3" />
                  {PRIORITY_STYLE[openTask.priority].label}
                </span>
              </div>
              {openTask.dueDate && (
                <div>
                  <div className="text-muted-foreground uppercase tracking-wider mb-1">Due</div>
                  <div className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Calendar className="h-3 w-3" />
                    {openTask.dueDate}
                  </div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground uppercase tracking-wider mb-1">Created</div>
                <div className="font-medium text-foreground">
                  {new Date(openTask.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="pt-3 border-t flex items-center gap-2">
              <button
                type="button"
                onClick={() => moveTask(openTask.id, -1)}
                disabled={openTask.status === "todo"}
                className="flex-1 h-9 rounded-md text-sm font-medium border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => moveTask(openTask.id, 1)}
                disabled={openTask.status === "done"}
                className="flex-1 h-9 rounded-md text-sm font-medium text-primary-foreground shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "var(--primary)" }}
              >
                Advance →
              </button>
              <button
                type="button"
                onClick={() => removeTask(openTask.id)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600"
                title="Delete"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
