import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../api";
import {
  GitBranch,
  Plus,
  Search,
  Pause,
  Play,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { fmtDate } from "@/utils/date";

type WF = {
  _id: string;
  name?: string;
  status?: string;
  trigger?: any;
  active?: boolean;
  createdAt?: string;
  stats?: any;
  [k: string]: any;
};

const statusStyle = (s?: string, active?: boolean) => {
  if (active === false || (s || "").toLowerCase().includes("paus"))
    return { bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", fg: "var(--muted-foreground)", label: "Paused" };
  if ((s || "").toLowerCase().includes("draft"))
    return { bg: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)", fg: "var(--muted-foreground)", label: "Draft" };
  return { bg: "var(--success-bg)", fg: "var(--success)", label: "Active" };
};

export default function AutomationWorkflowsPage() {
  const [items, setItems] = useState<WF[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("registration.approved");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await http.get("/workflows?perPage=100&sort=-createdAt");
      setItems(res?.data ?? res?.items ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((w) => (w.name || "").toLowerCase().includes(q));
  }, [items, search]);

  const create = async () => {
    if (!name.trim()) return;
    try {
      await http.post("/workflows", { name: name.trim(), status: "Draft", active: true, trigger: { type: "domain_event", key: trigger } });
      setName("");
      setShowForm(false);
      await load();
    } catch (e: any) {
      alert(e?.message || "Create failed");
    }
  };

  const toggle = async (w: WF) => {
    try {
      await http.patch(`/workflows/${w._id}`, { active: !w.active });
      await load();
    } catch (e: any) {
      alert(e?.message || "Update failed");
    }
  };

  const remove = async (w: WF) => {
    if (!confirm(`Delete workflow "${w.name}"?`)) return;
    try {
      await http.del(`/workflows/${w._id}`);
      await load();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
  };

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
              <GitBranch className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Workflows</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Visual automation — trigger → conditions → actions.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: "var(--primary)" }}>
          <Plus className="h-4 w-4" />
          New workflow
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total workflows", value: items.length, color: "var(--primary)" },
          { label: "Active", value: items.filter((w) => w.active !== false).length, color: "var(--success)" },
          { label: "Paused", value: items.filter((w) => w.active === false).length, color: "var(--muted-foreground)" },
          { label: "Drafts", value: items.filter((w) => (w.status || "").toLowerCase().includes("draft")).length, color: "var(--warning)" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3.5">
            <div className="text-xl font-semibold text-foreground tabular-nums">{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-3 flex items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workflows…" className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm" />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">{loading ? "Loading…" : `${filtered.length} of ${items.length}`}</div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className="px-4 py-3 text-left font-medium">Workflow</th>
                <th className="px-4 py-3 text-left font-medium">Trigger</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>}
              {!loading && error && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{error}</td></tr>}
              {!loading && !error && filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No workflows.</td></tr>}
              {!loading && filtered.map((w) => {
                const st = statusStyle(w.status, w.active);
                return (
                  <tr key={w._id} className={`border-t hover:bg-accent/30 ${w.active === false ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{w.name || "Untitled"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{w.trigger?.key || w.trigger?.type || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: st.bg, color: st.fg }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {fmtDate(w.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => toggle(w)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" title={w.active === false ? "Resume" : "Pause"}>
                          {w.active === false ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => remove(w)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl border shadow-2xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">New workflow</div>
                <div className="text-xs text-muted-foreground mt-1">Full visual builder in Phase 12.</div>
              </div>
              <button onClick={() => setShowForm(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-sm" placeholder="e.g. VIP fast-track approval" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Trigger</label>
              <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
                <option value="registration.created">Registration created</option>
                <option value="registration.approved">Registration approved</option>
                <option value="payment.success">Payment success</option>
                <option value="checkin.success">Check-in success</option>
                <option value="event.reminder">Event reminder</option>
                <option value="feedback.submitted">Feedback submitted</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <button onClick={() => setShowForm(false)} className="flex-1 h-9 rounded-md text-sm font-medium border hover:bg-accent">Cancel</button>
              <button onClick={create} disabled={!name.trim()} className="flex-1 h-9 rounded-md text-sm font-medium text-white shadow-sm disabled:opacity-40" style={{ background: "var(--primary)" }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
