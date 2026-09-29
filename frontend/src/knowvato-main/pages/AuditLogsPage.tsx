import { useEffect, useMemo, useState } from "react";
import { http } from "../../api";
import {
  ScrollText,
  Loader2,
  Search,
  Filter as FilterIcon,
  RefreshCw,
} from "lucide-react";

type Log = { _id: string; action: string; module?: string; entity?: string; user?: string; ip?: string; createdAt: string };

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
  if (A.includes("DELETE")) return "bi-trash";
  if (A.includes("LOGIN")) return "bi-box-arrow-in-right";
  if (A.includes("LOGOUT")) return "bi-box-arrow-right";
  return "bi-lightning";
};

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString("en-IN");
};

export default function AuditLogsPage() {
  const [items, setItems] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const [module, setModule] = useState("all");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await http.get("/audit?perPage=300&sort=-createdAt");
      setItems(res?.data ?? res?.items ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const actions = useMemo(() => Array.from(new Set(items.map((i) => i.action?.toUpperCase()).filter(Boolean))).sort(), [items]);
  const modules = useMemo(() => Array.from(new Set(items.map((i) => i.module).filter(Boolean))).sort() as string[], [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (action !== "all" && (it.action || "").toUpperCase() !== action) return false;
      if (module !== "all" && it.module !== module) return false;
      if (q) {
        const hay = `${it.action} ${it.entity ?? ""} ${it.module ?? ""} ${it.user ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, action, module]);

  return (
    <div className="p-6 md:p-8 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Audit Logs</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Every create, update, and delete across the workspace.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-accent">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: items.length },
          { label: "Creates", value: items.filter((i) => (i.action || "").toUpperCase() === "CREATE").length, color: "var(--success)" },
          { label: "Updates", value: items.filter((i) => (i.action || "").toUpperCase() === "UPDATE").length, color: "var(--info)" },
          { label: "Deletes", value: items.filter((i) => (i.action || "").toUpperCase() === "DELETE").length, color: "var(--destructive)" },
          { label: "Last 24h", value: items.filter((i) => Date.now() - new Date(i.createdAt).getTime() < 86_400_000).length, color: "var(--warning)" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3">
            <div className="text-lg font-semibold text-foreground tabular-nums">{s.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-2 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, entity, user…" className="w-full h-9 pl-8 pr-3 rounded border bg-background text-sm" />
        </div>
        <select value={action} onChange={(e) => setAction(e.target.value)} className="h-9 px-3 rounded border bg-background text-sm">
          <option value="all">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={module} onChange={(e) => setModule(e.target.value)} className="h-9 px-3 rounded border bg-background text-sm">
          <option value="all">All modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1"><FilterIcon className="h-3 w-3" />{filtered.length} of {items.length}</div>
      </div>

      <div className="rounded-xl border bg-card p-2">
        {loading && <div className="p-6 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</div>}
        {!loading && error && <div className="p-6 text-center text-muted-foreground">{error}</div>}
        {!loading && !error && filtered.length === 0 && <div className="p-8 text-center text-muted-foreground">No audit entries.</div>}
        {!loading && filtered.map((it) => {
          const st = ACTION_STYLE[(it.action || "").toUpperCase()] || { bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", fg: "var(--muted-foreground)" };
          return (
            <div key={it._id} className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/30">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0 mt-0.5" style={{ background: st.bg, color: st.fg }}>
                <i className={`${iconForAction(it.action)} text-[14px]`} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-medium">{it.user || "System"}</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: st.fg }}>{it.action}</span>
                  {it.entity && <span className="text-foreground"> {it.entity}</span>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                  <span>{fmtWhen(it.createdAt)}</span>
                  {it.module && <span className="uppercase tracking-wider">{it.module}</span>}
                  {it.ip && <span className="font-mono">{it.ip}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
