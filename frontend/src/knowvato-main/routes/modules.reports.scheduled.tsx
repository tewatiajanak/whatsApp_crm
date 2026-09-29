import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ArrowLeft, Plus, Pause, Play, Trash2, X, Mail } from "lucide-react";

type Schedule = {
  id: string;
  reportName: string;
  cadence: "daily" | "weekly" | "monthly";
  time: string;
  format: "csv" | "xlsx" | "pdf";
  recipients: string;
  active: boolean;
  lastRunAt?: string;
  createdAt: string;
};

const STORAGE = "em_report_schedules";
const load = (): Schedule[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]");
  } catch {
    return [];
  }
};
const save = (s: Schedule[]) => {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(s));
  } catch {}
};
const uid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const SEED: Omit<Schedule, "id" | "createdAt">[] = [
  { reportName: "Daily registration summary", cadence: "daily", time: "09:00", format: "pdf", recipients: "admin@example.com", active: true },
  { reportName: "Weekly revenue report", cadence: "weekly", time: "10:00", format: "xlsx", recipients: "finance@example.com, cfo@example.com", active: true },
  { reportName: "Monthly GST tax summary", cadence: "monthly", time: "08:00", format: "xlsx", recipients: "finance@example.com", active: false },
];

export default function ReportsScheduledPage() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Schedule, "id" | "createdAt">>({
    reportName: "",
    cadence: "weekly",
    time: "09:00",
    format: "csv",
    recipients: "",
    active: true,
  });

  useEffect(() => {
    const existing = load();
    if (existing.length === 0) {
      const seeded = SEED.map((s) => ({ ...s, id: uid(), createdAt: new Date().toISOString() }));
      save(seeded);
      setItems(seeded);
    } else setItems(existing);
  }, []);

  const persist = (next: Schedule[]) => {
    setItems(next);
    save(next);
  };

  const toggle = (id: string) => persist(items.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  const runNow = (s: Schedule) => {
    persist(items.map((x) => (x.id === s.id ? { ...x, lastRunAt: new Date().toISOString() } : x)));
    alert(`Sent "${s.reportName}" to ${s.recipients}`);
  };
  const remove = (id: string) => {
    if (!confirm("Delete this schedule?")) return;
    persist(items.filter((s) => s.id !== id));
  };
  const create = () => {
    if (!form.reportName.trim() || !form.recipients.trim()) return;
    const s: Schedule = { ...form, id: uid(), createdAt: new Date().toISOString() };
    persist([s, ...items]);
    setShowForm(false);
    setForm({ reportName: "", cadence: "weekly", time: "09:00", format: "csv", recipients: "", active: true });
  };

  return (
    <div className="p-4 max-w-[1400px] mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link to="/modules/reports" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1" style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-3 w-3" /> Back to Reports
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--info) 15%, transparent)", color: "var(--info)" }}>
              <CalendarClock className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Scheduled Reports</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Send saved reports on a schedule.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: "var(--primary)" }}>
          <Plus className="h-4 w-4" />
          New schedule
        </button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className="px-4 py-3 text-left font-medium">Report</th>
                <th className="px-4 py-3 text-left font-medium">Cadence</th>
                <th className="px-4 py-3 text-left font-medium">Format</th>
                <th className="px-4 py-3 text-left font-medium">Recipients</th>
                <th className="px-4 py-3 text-left font-medium">Last run</th>
                <th className="px-4 py-3 text-left font-medium">Active</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No schedules yet.</td></tr>
              )}
              {items.map((s) => (
                <tr key={s.id} className={`border-t hover:bg-accent/30 ${!s.active ? "opacity-60" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{s.reportName}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs capitalize">
                      {s.cadence} at {s.time}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono uppercase">{s.format}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                    <div className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{s.recipients}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {s.lastRunAt ? new Date(s.lastRunAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => toggle(s.id)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${s.active ? "" : "bg-muted"}`} style={s.active ? { background: "var(--primary)" } : undefined}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${s.active ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={() => runNow(s)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground" title="Run now">
                        <Play className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(s.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl border shadow-2xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="text-lg font-semibold">New schedule</div>
              <button onClick={() => setShowForm(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            {[
              { label: "Report name", el: <input value={form.reportName} onChange={(e) => setForm({ ...form, reportName: e.target.value })} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" placeholder="e.g. Daily registrations" /> },
              { label: "Cadence", el: <select value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value as any })} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select> },
              { label: "Time", el: <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" /> },
              { label: "Format", el: <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value as any })} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"><option value="csv">CSV</option><option value="xlsx">Excel</option><option value="pdf">PDF</option></select> },
              { label: "Recipients (comma-separated)", el: <input value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" placeholder="user1@x.com, user2@x.com" /> },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label>
                <div className="mt-1">{f.el}</div>
              </div>
            ))}
            <div className="flex gap-2 pt-2 border-t">
              <button onClick={() => setShowForm(false)} className="flex-1 h-9 rounded-md text-sm font-medium border hover:bg-accent">Cancel</button>
              <button onClick={create} className="flex-1 h-9 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: "var(--primary)" }}>
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
