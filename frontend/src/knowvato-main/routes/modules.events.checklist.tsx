import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEventData } from "@/event-manager/context/EventDataContext";
import {
  ArrowLeft,
  CheckSquare,
  Plus,
  X,
  ChevronDown,
  Sparkles,
} from "lucide-react";

type ChecklistItem = {
  id: string;
  eventId: string; // scope: "all" for org-wide
  category: string;
  title: string;
  dueOffsetDays: number; // negative = before event start
  done: boolean;
  createdAt: string;
};

const CATEGORIES = [
  { key: "venue", label: "Venue", icon: "bi-building", color: "#2249b7" },
  { key: "speakers", label: "Speakers", icon: "bi-mic", color: "#7c3aed" },
  { key: "sponsors", label: "Sponsors", icon: "bi-award", color: "#eab308" },
  { key: "registration", label: "Registration", icon: "bi-person-plus", color: "#0891b2" },
  { key: "passes", label: "Passes & Badges", icon: "bi-person-badge", color: "#059669" },
  { key: "volunteers", label: "Volunteers", icon: "bi-people", color: "#14b8a6" },
  { key: "communication", label: "Communication", icon: "bi-chat-dots", color: "#f97316" },
  { key: "completion", label: "Completion & Feedback", icon: "bi-check2-circle", color: "#8b5cf6" },
];

const DEFAULT_ITEMS: Omit<ChecklistItem, "id" | "eventId" | "done" | "createdAt">[] = [
  { category: "venue", title: "Confirm venue booking and payment", dueOffsetDays: -45 },
  { category: "venue", title: "Walk-through and layout planning", dueOffsetDays: -14 },
  { category: "venue", title: "Confirm AV, mic, projector, WiFi", dueOffsetDays: -7 },
  { category: "speakers", title: "Finalize speaker list and confirmations", dueOffsetDays: -30 },
  { category: "speakers", title: "Collect bios, photos, session topics", dueOffsetDays: -21 },
  { category: "speakers", title: "Send speaker travel & hotel details", dueOffsetDays: -14 },
  { category: "sponsors", title: "Sign sponsor contracts and collect logos", dueOffsetDays: -30 },
  { category: "sponsors", title: "Deliver sponsor branding placements", dueOffsetDays: -7 },
  { category: "registration", title: "Publish registration form", dueOffsetDays: -30 },
  { category: "registration", title: "Test end-to-end registration flow", dueOffsetDays: -21 },
  { category: "passes", title: "Design event pass and print samples", dueOffsetDays: -14 },
  { category: "passes", title: "Bulk-generate passes for confirmed attendees", dueOffsetDays: -3 },
  { category: "volunteers", title: "Recruit and brief volunteers", dueOffsetDays: -14 },
  { category: "volunteers", title: "Assign gates and desk roles", dueOffsetDays: -3 },
  { category: "communication", title: "Send 'Save the date' broadcast", dueOffsetDays: -30 },
  { category: "communication", title: "Send confirmation email + WhatsApp on approval", dueOffsetDays: -21 },
  { category: "communication", title: "Send day-before reminder", dueOffsetDays: -1 },
  { category: "completion", title: "Send feedback form after event ends", dueOffsetDays: 1 },
  { category: "completion", title: "Generate and deliver certificates", dueOffsetDays: 3 },
  { category: "completion", title: "Post-event debrief with team", dueOffsetDays: 7 },
];

const STORAGE_KEY = "em_checklist_items";

const loadItems = (): ChecklistItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveItems = (items: ChecklistItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
};

const uid = () =>
  typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function EventsChecklistPage() {
  const { events = [] } = useEventData() as any;
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [scope, setScope] = useState<string>("all");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.key, true]))
  );
  const [adding, setAdding] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newOffset, setNewOffset] = useState<number>(-7);

  useEffect(() => {
    setItems(loadItems());
  }, []);

  const persist = (next: ChecklistItem[]) => {
    setItems(next);
    saveItems(next);
  };

  const seedDefaults = () => {
    if (items.some((it) => it.eventId === scope)) return;
    const now = new Date().toISOString();
    const seeded = DEFAULT_ITEMS.map((d) => ({
      ...d,
      id: uid(),
      eventId: scope,
      done: false,
      createdAt: now,
    }));
    persist([...items, ...seeded]);
  };

  useEffect(() => {
    // Auto-seed defaults for org-wide scope on first mount if empty
    if (scope === "all" && !items.some((it) => it.eventId === "all") && items.length === 0) {
      seedDefaults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, scope]);

  const scopedItems = useMemo(() => items.filter((it) => it.eventId === scope), [items, scope]);
  const grouped = useMemo(() => {
    const g: Record<string, ChecklistItem[]> = {};
    scopedItems.forEach((it) => {
      if (!g[it.category]) g[it.category] = [];
      g[it.category].push(it);
    });
    return g;
  }, [scopedItems]);

  const total = scopedItems.length;
  const done = scopedItems.filter((it) => it.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const toggle = (id: string) => {
    persist(items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));
  };
  const remove = (id: string) => {
    persist(items.filter((it) => it.id !== id));
  };
  const addItem = (cat: string) => {
    if (!newTitle.trim()) return;
    const item: ChecklistItem = {
      id: uid(),
      eventId: scope,
      category: cat,
      title: newTitle.trim(),
      dueOffsetDays: newOffset,
      done: false,
      createdAt: new Date().toISOString(),
    };
    persist([...items, item]);
    setNewTitle("");
    setNewOffset(-7);
    setAdding(null);
  };
  const resetScope = () => {
    if (!confirm("Reset this checklist? All items in this scope will be removed.")) return;
    persist(items.filter((it) => it.eventId !== scope));
  };

  return (
    <div className="p-4 max-w-[1400px] mx-auto space-y-4">
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
              <CheckSquare className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Checklist</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Event readiness board — grouped by category with due-day offsets from event start.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">Org-wide template</option>
            {(events as any[]).map((e) => (
              <option key={e.id} value={e.id}>{e.eventName || "Untitled"}</option>
            ))}
          </select>
          {scopedItems.length === 0 && (
            <button
              type="button"
              onClick={seedDefaults}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-accent"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Seed defaults
            </button>
          )}
          {scopedItems.length > 0 && (
            <button
              type="button"
              onClick={resetScope}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-accent text-muted-foreground"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Progress card */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm font-semibold text-foreground">Progress</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {done} of {total} tasks complete
            </div>
          </div>
          <div className="text-2xl font-semibold text-foreground tabular-nums">
            {pct}%
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? "var(--success)" : "var(--primary)",
            }}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          const catItems = grouped[cat.key] ?? [];
          const catDone = catItems.filter((it) => it.done).length;
          const isOpen = openCats[cat.key];
          return (
            <div key={cat.key} className="rounded-xl border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenCats((p) => ({ ...p, [cat.key]: !p[cat.key] }))}
                className="w-full p-3 flex items-center justify-between gap-2 hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${cat.color} 12%, transparent)`,
                      color: cat.color,
                    }}
                  >
                    <i className={`${cat.icon} text-[13px]`} />
                  </span>
                  <div className="text-sm font-semibold text-foreground">{cat.label}</div>
                  {catItems.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {catDone} / {catItems.length}
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                    isOpen ? "" : "-rotate-90"
                  }`}
                />
              </button>
              {isOpen && (
                <div className="border-t p-2 space-y-1">
                  {catItems.map((it) => (
                    <div
                      key={it.id}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent/30 transition-colors group ${
                        it.done ? "opacity-60" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={it.done}
                        onChange={() => toggle(it.id)}
                        className="h-4 w-4 rounded border-input cursor-pointer accent-[var(--primary)]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${it.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {it.title}
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                        {it.dueOffsetDays < 0
                          ? `${Math.abs(it.dueOffsetDays)}d before`
                          : it.dueOffsetDays === 0
                          ? "Event day"
                          : `${it.dueOffsetDays}d after`}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(it.id)}
                        className="opacity-0 group-hover:opacity-100 h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-all"
                        title="Delete"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {adding === cat.key ? (
                    <div className="p-2 border-t mt-1 flex items-center gap-2 flex-wrap">
                      <input
                        autoFocus
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addItem(cat.key);
                          if (e.key === "Escape") {
                            setAdding(null);
                            setNewTitle("");
                          }
                        }}
                        placeholder="What needs to be done?"
                        className="flex-1 h-8 px-2 rounded-md border border-input bg-background text-sm min-w-[200px]"
                      />
                      <input
                        type="number"
                        value={newOffset}
                        onChange={(e) => setNewOffset(parseInt(e.target.value) || 0)}
                        className="h-8 w-20 px-2 rounded-md border border-input bg-background text-sm"
                        title="Days offset (negative = before event)"
                      />
                      <button
                        type="button"
                        onClick={() => addItem(cat.key)}
                        className="h-8 px-3 rounded-md text-xs font-medium text-primary-foreground shadow-sm"
                        style={{ background: "var(--primary)" }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdding(null);
                          setNewTitle("");
                        }}
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAdding(cat.key)}
                      className="w-full inline-flex items-center gap-1.5 h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-md"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add item
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
