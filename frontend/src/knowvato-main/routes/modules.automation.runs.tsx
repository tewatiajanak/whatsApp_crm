import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PlayCircle, ArrowLeft, RefreshCw, Search, Loader2, X, CheckCircle2, AlertCircle, Clock } from "lucide-react";

type Run = {
  id: string;
  workflowName: string;
  status: "completed" | "running" | "failed" | "waiting";
  triggerPayload?: any;
  startedAt: string;
  duration?: number;
  steps: { name: string; status: "completed" | "failed" | "skipped" | "running"; duration?: number }[];
};

const STORAGE = "em_workflow_runs";
const uid = () => Math.random().toString(36).slice(2);

const SEED: Run[] = [
  {
    id: uid(),
    workflowName: "VIP fast-track approval",
    status: "completed",
    startedAt: new Date(Date.now() - 300_000).toISOString(),
    duration: 1240,
    steps: [
      { name: "Trigger: registration.created", status: "completed", duration: 40 },
      { name: "Condition: ticket = VIP", status: "completed", duration: 15 },
      { name: "Action: approve registration", status: "completed", duration: 180 },
      { name: "Action: generate pass", status: "completed", duration: 820 },
      { name: "Action: send WhatsApp", status: "completed", duration: 185 },
    ],
  },
  {
    id: uid(),
    workflowName: "Feedback nudge",
    status: "waiting",
    startedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
    steps: [
      { name: "Trigger: checkin.success", status: "completed", duration: 30 },
      { name: "Delay: 60 minutes", status: "running", duration: 900_000 },
    ],
  },
  {
    id: uid(),
    workflowName: "Payment success flow",
    status: "failed",
    startedAt: new Date(Date.now() - 3600_000).toISOString(),
    duration: 4820,
    steps: [
      { name: "Trigger: payment.success", status: "completed", duration: 20 },
      { name: "Action: send invoice email", status: "completed", duration: 1240 },
      { name: "Action: generate pass", status: "completed", duration: 3120 },
      { name: "Action: send WhatsApp", status: "failed", duration: 440 },
    ],
  },
];

const load = (): Run[] => {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) {
      localStorage.setItem(STORAGE, JSON.stringify(SEED));
      return SEED;
    }
    return JSON.parse(raw);
  } catch {
    return SEED;
  }
};

const statusStyle = (s: string) => {
  switch (s) {
    case "completed": return { bg: "var(--success-bg)", fg: "var(--success)", icon: CheckCircle2 };
    case "failed": return { bg: "var(--destructive-bg)", fg: "var(--destructive)", icon: AlertCircle };
    case "running": return { bg: "var(--info-bg)", fg: "var(--info)", icon: Loader2 };
    case "waiting": return { bg: "var(--warning-bg)", fg: "var(--warning)", icon: Clock };
    case "skipped": return { bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", fg: "var(--muted-foreground)", icon: Clock };
    default: return { bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", fg: "var(--muted-foreground)", icon: Clock };
  }
};

const fmtDuration = (ms?: number) => {
  if (!ms) return "—";
  if (ms > 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms > 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
};

export default function AutomationRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState<Run | null>(null);

  useEffect(() => { setRuns(load()); }, []);

  const filtered = statusFilter === "all" ? runs : runs.filter((r) => r.status === statusFilter);

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link to="/modules/automation" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1" style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-3 w-3" /> Back to Automation
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--info) 15%, transparent)", color: "var(--info)" }}>
              <PlayCircle className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Runs</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Every workflow execution — completed, running, waiting, failed.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: runs.length, key: "all" },
          { label: "Completed", value: runs.filter((r) => r.status === "completed").length, key: "completed", color: "var(--success)" },
          { label: "Running", value: runs.filter((r) => r.status === "running").length, key: "running", color: "var(--info)" },
          { label: "Waiting", value: runs.filter((r) => r.status === "waiting").length, key: "waiting", color: "var(--warning)" },
          { label: "Failed", value: runs.filter((r) => r.status === "failed").length, key: "failed", color: "var(--destructive)" },
        ].map((s) => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)} className={`rounded-xl border bg-card p-3 text-left transition-colors ${statusFilter === s.key ? "ring-2 ring-primary" : "hover:bg-accent/30"}`}>
            <div className="text-lg font-semibold text-foreground tabular-nums">{s.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className="px-4 py-3 text-left font-medium">Workflow</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Steps</th>
                <th className="px-4 py-3 text-left font-medium">Started</th>
                <th className="px-4 py-3 text-left font-medium">Duration</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No runs match.</td></tr>}
              {filtered.map((r) => {
                const st = statusStyle(r.status);
                const Ico = st.icon;
                return (
                  <tr key={r.id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.workflowName}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: st.bg, color: st.fg }}>
                        <Ico className={`h-3 w-3 ${r.status === "running" ? "animate-spin" : ""}`} />
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {r.steps.filter((s) => s.status === "completed").length} / {r.steps.length}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(r.startedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono">{fmtDuration(r.duration)}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setDetail(r)} className="text-xs text-primary hover:underline">View timeline</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)}>
          <div className="bg-card rounded-xl border shadow-2xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg font-semibold">{detail.workflowName}</div>
                <div className="text-xs text-muted-foreground mt-1">Timeline · {detail.steps.length} steps</div>
              </div>
              <button onClick={() => setDetail(null)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2 pt-2 border-t">
              {detail.steps.map((s, i) => {
                const st = statusStyle(s.status);
                const Ico = st.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md shrink-0 mt-0.5" style={{ background: st.bg, color: st.fg }}>
                      <Ico className={`h-3 w-3 ${s.status === "running" ? "animate-spin" : ""}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-foreground">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{s.status} · {fmtDuration(s.duration)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
