import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEventData } from "@/event-manager/context/EventDataContext";
import { loadTaskStatuses } from "@/lib/task-statuses";
import { loadTaskTemplates, newId, templatesForCategory } from "@/lib/task-checklists";
import { fmtDate } from "@/utils/date";
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
import { appStore } from "../../api/appStore";

type Priority = "low" | "medium" | "high" | "urgent";
// the id of a status from Setup → Task Statuses
type Status = string;

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
  /** Checklist points of this task; ticked here on the board. */
  checklist?: { id: string; text: string; done: boolean }[];
  /** Set when the task came from Setup → Task Checklist. */
  templateId?: string;
};

// which checklist tasks each event has already received
const GIVEN_KEY = "em_task_given";

const STORAGE_KEY = "em_tasks";

const PRIORITY_STYLE: Record<Priority, { bg: string; fg: string; label: string }> = {
  low: { bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", fg: "var(--muted-foreground)", label: "Low" },
  medium: { bg: "var(--info-bg)", fg: "var(--info)", label: "Medium" },
  high: { bg: "var(--warning-bg)", fg: "var(--warning)", label: "High" },
  urgent: { bg: "var(--destructive-bg)", fg: "var(--destructive)", label: "Urgent" },
};

const load = (): Task[] => {
  try {
    const raw = appStore.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const save = (tasks: Task[]) => {
  try {
    appStore.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {}
};

const uid = () =>
  typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function EventsTasksPage() {
  const { events = [] } = useEventData() as any;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterEvent, setFilterEvent] = useState("all");
  const [addingIn, setAddingIn] = useState<Status | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pointText, setPointText] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);

  // Board columns come from Setup → Task Statuses, in Sr No order
  const COLUMNS = useMemo(() => loadTaskStatuses().map((st) => ({ status: st.id, label: st.label, color: st.color })), []);
  const firstStatus = COLUMNS[0]?.status;
  const lastStatus = COLUMNS[COLUMNS.length - 1]?.status;
  const statusLabel = (id: Status) => COLUMNS.find((c) => c.status === id)?.label || id;
  const openTask = openId ? tasks.find((t) => t.id === openId) || null : null;
  const setOpenTask = (t: Task | null) => {
    setOpenId(t ? t.id : null);
    setPointText("");
  };

  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setTasks(load());
    setLoaded(true);
  }, []);

  const persist = (next: Task[]) => {
    setTasks(next);
    save(next);
  };

  // Tasks an event should have, from Setup → Task Checklist, for its category.
  const tasksFromTemplates = (ev: any, existing: Task[]): Task[] =>
    templatesForCategory(loadTaskTemplates(), ev.eventType)
      .filter((tpl) => !existing.some((t) => t.eventId === ev.id && t.templateId === tpl.id))
      .map((tpl) => ({
        id: uid(),
        title: tpl.task,
        status: firstStatus,
        priority: "medium" as Priority,
        eventId: ev.id,
        templateId: tpl.id,
        createdAt: new Date().toISOString(),
        checklist: tpl.points.map((p) => ({ id: newId(), text: p.text, done: false })),
      }));

  // Which checklist tasks each event has already been given: { eventId: [templateId…] }.
  // A task is handed to an event once — deleting it from the board keeps it deleted,
  // while tasks added to the checklist later still reach every event.
  const readGiven = (): Record<string, string[]> => {
    try {
      const v = JSON.parse(appStore.getItem(GIVEN_KEY) || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  };

  useEffect(() => {
    if (!loaded || !events.length || !firstStatus) return;
    const templates = loadTaskTemplates();
    const given = readGiven();
    let next = tasks;
    let changed = false;
    (events as any[]).forEach((ev) => {
      const had = new Set([...(given[ev.id] || []), ...next.filter((t) => t.eventId === ev.id && t.templateId).map((t) => t.templateId as string)]);
      const fresh = templatesForCategory(templates, ev.eventType).filter((tpl) => !had.has(tpl.id));
      if (fresh.length) {
        next = [...tasksFromTemplates(ev, next).filter((t) => fresh.some((tpl) => tpl.id === t.templateId)), ...next];
        fresh.forEach((tpl) => had.add(tpl.id));
      }
      const list = [...had];
      if (list.length !== (given[ev.id] || []).length) {
        given[ev.id] = list;
        changed = true;
      }
    });
    if (changed) appStore.setItem(GIVEN_KEY, JSON.stringify(given));
    if (next.length !== tasks.length) persist(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, events.length, firstStatus]);

  const eventName = (id?: string | null) => (id ? (events as any[]).find((e) => e.id === id)?.eventName || "" : "");

  // Ticking a point: all ticked → the task moves to the last status; the first tick moves it out of the first one.
  const togglePoint = (taskId: string, pointId: string) =>
    persist(
      tasks.map((t) => {
        if (t.id !== taskId || !t.checklist) return t;
        const checklist = t.checklist.map((p) => (p.id === pointId ? { ...p, done: !p.done } : p));
        const done = checklist.filter((p) => p.done).length;
        let status = t.status;
        if (done === checklist.length && lastStatus) status = lastStatus;
        else if (done > 0 && (t.status === firstStatus || t.status === lastStatus) && COLUMNS[1]) status = COLUMNS[1].status;
        else if (done === 0 && t.status === lastStatus) status = firstStatus;
        return { ...t, checklist, status };
      })
    );
  const addPoint = (taskId: string, text: string) =>
    persist(tasks.map((t) => (t.id === taskId ? { ...t, checklist: [...(t.checklist || []), { id: newId(), text, done: false }] } : t)));
  const removePoint = (taskId: string, pointId: string) =>
    persist(tasks.map((t) => (t.id === taskId ? { ...t, checklist: (t.checklist || []).filter((p) => p.id !== pointId) } : t)));

  const filtered = useMemo(() => {
    if (filterEvent === "all") return tasks;
    return tasks.filter((t) => t.eventId === filterEvent);
  }, [tasks, filterEvent]);

  const byColumn = useMemo(() => {
    const out: Record<Status, Task[]> = Object.fromEntries(COLUMNS.map((c) => [c.status, [] as Task[]]));
    // a task whose status was deleted in Setup shows in the first column
    filtered.forEach((t) => (out[t.status] || out[firstStatus] || []).push(t));
    // checklist tasks follow the Sr No set in Task Checklist; tasks added by hand keep their place
    const order = new Map(loadTaskTemplates().map((tpl, i) => [tpl.id, i]));
    const rank = (t: Task) => order.get(t.templateId as string) ?? Number.MAX_SAFE_INTEGER;
    Object.values(out).forEach((col) => {
      const slots = col.map((t, i) => (t.templateId ? i : -1)).filter((i) => i >= 0);
      const sorted = slots.map((i) => col[i]).sort((a, b) => String(a.eventId).localeCompare(String(b.eventId)) || rank(a) - rank(b));
      slots.forEach((slot, n) => (col[slot] = sorted[n]));
    });
    return out;
  }, [filtered, COLUMNS, firstStatus]);

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
    const order: Status[] = COLUMNS.map((c) => c.status);
    persist(
      tasks.map((t) => {
        if (t.id !== id) return t;
        const idx = Math.max(0, order.indexOf(t.status));
        const nxt = Math.max(0, Math.min(order.length - 1, idx + direction));
        return { ...t, status: order[nxt] };
      })
    );
  };

  // Drag & drop: dropping a card on a column moves the task to that status.
  const dropTask = (status: Status) => {
    if (dragId) persist(tasks.map((t) => (t.id === dragId && t.status !== status ? { ...t, status } : t)));
    setDragId(null);
    setDragOver(null);
  };

  const removeTask = (id: string) => {
    persist(tasks.filter((t) => t.id !== id));
    if (openTask?.id === id) setOpenTask(null);
  };

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
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
        </div>
        <div className="flex items-center gap-2">
          <select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)} className="ui-input" style={{ minWidth: 200 }}>
            <option value="all">All events</option>
            {(events as any[]).map((e) => (
              <option key={e.id} value={e.id}>{e.eventName || "Untitled"}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {COLUMNS.map((col) => {
          const colTasks = byColumn[col.status];
          return (
            <div
              key={col.status}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                if (dragOver !== col.status) setDragOver(col.status);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropTask(col.status);
              }}
              className="rounded-xl border bg-card overflow-hidden flex flex-col transition-shadow"
              style={dragId && dragOver === col.status ? { boxShadow: "0 0 0 2px var(--primary)" } : undefined}
            >
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
                  <div className="rounded-lg border bg-card p-2.5 space-y-2 shadow-sm">
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
                      className="w-full h-8 px-2.5 rounded-md border border-input bg-background text-sm"
                    />
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        Priority
                      </label>
                      <select
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value as Priority)}
                        className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingIn(null);
                          setNewTitle("");
                        }}
                        className="ui-btn ui-btn-outline ui-btn-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => addTask(col.status)}
                        disabled={!newTitle.trim()}
                        className="ui-btn ui-btn-primary ui-btn-sm"
                      >
                        Add task
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
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", t.id);
                        setDragId(t.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDragOver(null);
                      }}
                      onClick={() => setOpenTask(t)}
                      className="rounded-lg border bg-card p-2.5 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow group"
                      style={dragId === t.id ? { opacity: 0.45 } : undefined}
                    >
                      <div className="text-sm font-medium text-foreground leading-snug">
                        {t.title}
                      </div>
                      {filterEvent === "all" && eventName(t.eventId) && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{eventName(t.eventId)}</div>
                      )}
                      {t.description && (
                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                          {t.description}
                        </div>
                      )}
                      {!!t.checklist?.length && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[10.5px] text-muted-foreground mb-1">
                            <span>Checklist</span>
                            <span>{t.checklist.filter((p) => p.done).length}/{t.checklist.length}</span>
                          </div>
                          <div className="rounded-full overflow-hidden" style={{ height: 4, background: "var(--muted-background)" }}>
                            <div style={{ height: "100%", width: `${(t.checklist.filter((p) => p.done).length / t.checklist.length) * 100}%`, background: "var(--primary)" }} />
                          </div>
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
                          {col.status !== firstStatus && (
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
                          {col.status !== lastStatus && (
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
            className="bg-card rounded-xl border shadow-2xl w-full max-w-lg p-5 space-y-4 overflow-y-auto"
            style={{ maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{eventName(openTask.eventId) || "Task"}</div>
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
                  {statusLabel(openTask.status)}
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
                  {fmtDate(openTask.createdAt)}
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">
                Checklist{openTask.checklist?.length ? ` · ${openTask.checklist.filter((p) => p.done).length}/${openTask.checklist.length}` : ""}
              </div>
              <div className="space-y-1">
                {(openTask.checklist || []).map((p) => (
                  <div key={p.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                    <input type="checkbox" checked={p.done} onChange={() => togglePoint(openTask.id, p.id)} id={`pt-${p.id}`} />
                    <label htmlFor={`pt-${p.id}`} className="flex-1 text-sm m-0 cursor-pointer" style={p.done ? { textDecoration: "line-through", color: "var(--muted-foreground)" } : { color: "var(--foreground)" }}>
                      {p.text}
                    </label>
                    <button type="button" className="ui-btn ui-btn-danger ui-btn-sm ui-btn-icon" title="Remove point" onClick={() => removePoint(openTask.id, p.id)}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    className="ui-input flex-1"
                    style={{ height: 30 }}
                    value={pointText}
                    placeholder="Add a checklist point"
                    onChange={(e) => setPointText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && pointText.trim()) {
                        addPoint(openTask.id, pointText.trim());
                        setPointText("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="ui-btn ui-btn-outline ui-btn-sm"
                    disabled={!pointText.trim()}
                    onClick={() => {
                      addPoint(openTask.id, pointText.trim());
                      setPointText("");
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div className="pt-3 border-t flex items-center gap-2">
              <button
                type="button"
                onClick={() => moveTask(openTask.id, -1)}
                disabled={openTask.status === firstStatus}
                className="flex-1 h-9 rounded-md text-sm font-medium border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => moveTask(openTask.id, 1)}
                disabled={openTask.status === lastStatus}
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
