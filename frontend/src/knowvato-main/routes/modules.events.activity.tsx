import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../api";
import {
  ArrowLeft,
  Activity,
  Loader2,
  Search,
  Filter as FilterIcon,
  RefreshCw,
} from "lucide-react";

type LogEntry = {
  _id: string;
  action: string;
  module?: string;
  entity?: string;
  user?: string;
  ip?: string;
  createdAt: string;
};

const ACTION_STYLE: Record<string, { bg: string; fg: string }> = {
  CREATE: { bg: "var(--success-bg)", fg: "var(--success)" },
  UPDATE: { bg: "var(--info-bg)", fg: "var(--info)" },
  DELETE: { bg: "var(--destructive-bg)", fg: "var(--destructive)" },
  LOGIN: { bg: "color-mix(in srgb, var(--primary) 12%, transparent)", fg: "var(--primary)" },
  LOGOUT: { bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", fg: "var(--muted-foreground)" },
};

const iconForAction = (a: string) => {
  const A = (a || "").toUpperCase();
  if (A.includes("CREATE") || A.includes("ADD")) return "bi-plus-circle";
  if (A.includes("UPDATE") || A.includes("EDIT")) return "bi-pencil";
  if (A.includes("DELETE") || A.includes("REMOVE")) return "bi-trash";
  if (A.includes("LOGIN")) return "bi-box-arrow-in-right";
  if (A.includes("LOGOUT")) return "bi-box-arrow-right";
  if (A.includes("EVENT")) return "bi-calendar-event";
  return "bi-lightning";
};

const fmtWhen = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

const fmtWhenFull = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-IN");
  } catch {
    return iso;
  }
};

const groupByDay = (items: LogEntry[]) => {
  const g: Record<string, LogEntry[]> = {};
  items.forEach((it) => {
    const d = new Date(it.createdAt);
    const k = d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    if (!g[k]) g[k] = [];
    g[k].push(it);
  });
  return Object.entries(g);
};

export default function EventsActivityPage() {
  const [items, setItems] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await http.get("/audit?perPage=200&sort=-createdAt");
      const list: LogEntry[] = res?.data ?? res?.items ?? (Array.isArray(res) ? res : []);
      setItems(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load activity log");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (action !== "all" && (it.action || "").toUpperCase() !== action) return false;
      if (q) {
        const hay = `${it.action ?? ""} ${it.entity ?? ""} ${it.module ?? ""} ${it.user ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, action]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);
  const actions = useMemo(() => {
    const s = new Set<string>();
    items.forEach((it) => it.action && s.add(it.action.toUpperCase()));
    return Array.from(s).sort();
  }, [items]);

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
              <Activity className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Activity Log</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Every meaningful action across your workspace — pulled from the audit log.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, entity, user…"
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm min-w-[140px]"
        >
          <option value="all">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <FilterIcon className="h-3.5 w-3.5" />
          {loading ? "Loading…" : `${filtered.length} of ${items.length}`}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border bg-card p-4">
        {loading && (
          <div className="text-center py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
            Loading audit trail…
          </div>
        )}
        {!loading && error && (
          <div className="text-center py-10">
            <div className="text-sm text-muted-foreground mb-2">{error}</div>
            <button
              type="button"
              onClick={load}
              className="text-xs text-primary hover:underline"
            >
              Retry
            </button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No activity yet. Create an event or take an action and it will show up here.
          </div>
        )}
        {!loading && !error && items.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No entries match your filters.
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-6">
            {grouped.map(([day, entries]) => (
              <div key={day}>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 sticky top-0 bg-card py-1">
                  {day}
                </div>
                <div className="space-y-2">
                  {entries.map((it) => {
                    const style = ACTION_STYLE[(it.action || "").toUpperCase()] ?? {
                      bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)",
                      fg: "var(--muted-foreground)",
                    };
                    return (
                      <div
                        key={it._id}
                        className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/30 transition-colors"
                      >
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0 mt-0.5"
                          style={{ background: style.bg, color: style.fg }}
                        >
                          <i className={`${iconForAction(it.action)} text-[14px]`} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <div className="text-sm text-foreground">
                              <span className="font-medium">{it.user || "System"}</span>
                              <span className="text-muted-foreground"> · </span>
                              <span
                                className="text-xs font-semibold uppercase tracking-wider"
                                style={{ color: style.fg }}
                              >
                                {it.action}
                              </span>
                              {it.entity && (
                                <>
                                  <span className="text-muted-foreground"> </span>
                                  <span className="text-foreground">{it.entity}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-2">
                            <span title={fmtWhenFull(it.createdAt)}>{fmtWhen(it.createdAt)}</span>
                            {it.module && (
                              <>
                                <span>·</span>
                                <span className="uppercase tracking-wider">{it.module}</span>
                              </>
                            )}
                            {it.ip && (
                              <>
                                <span>·</span>
                                <span className="font-mono">{it.ip}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
