import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Webhook, ArrowLeft, Plus, X, Trash2, ExternalLink, Play, Copy } from "lucide-react";
import { appStore } from "../../api/appStore";

type Endpoint = {
  id: string;
  url: string;
  description?: string;
  events: string[];
  secret: string;
  active: boolean;
  successCount: number;
  failCount: number;
  createdAt: string;
};

const EVENTS = [
  "registration.created", "registration.approved", "registration.rejected",
  "payment.success", "payment.failed", "payment.refund",
  "checkin.success", "checkin.duplicate",
  "certificate.generated", "feedback.submitted",
  "event.published", "event.completed",
];

const STORAGE = "em_webhook_endpoints";
const load = (): Endpoint[] => {
  try {
    return JSON.parse(appStore.getItem(STORAGE) || "[]");
  } catch {
    return [];
  }
};
const save = (e: Endpoint[]) => {
  try {
    appStore.setItem(STORAGE, JSON.stringify(e));
  } catch {}
};
const uid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const genSecret = () => "whsec_" + Array.from({ length: 32 }, () => Math.random().toString(36)[2] || "0").join("");

const SEED: Omit<Endpoint, "id" | "createdAt">[] = [
  { url: "https://api.mycrm.com/webhooks/knowvato", description: "Sync registrations to CRM", events: ["registration.created", "registration.approved"], secret: genSecret(), active: true, successCount: 1247, failCount: 3 },
  { url: "https://analytics.mydomain.com/ingest", description: "Analytics pipeline", events: ["payment.success", "checkin.success"], secret: genSecret(), active: true, successCount: 892, failCount: 0 },
];

export default function AutomationWebhooksPage() {
  const [items, setItems] = useState<Endpoint[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Endpoint, "id" | "createdAt" | "successCount" | "failCount">>({
    url: "",
    description: "",
    events: [],
    secret: genSecret(),
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

  const persist = (n: Endpoint[]) => { setItems(n); save(n); };
  const toggle = (id: string) => persist(items.map((e) => e.id === id ? { ...e, active: !e.active } : e));
  const remove = (id: string) => {
    if (!confirm("Delete endpoint? Active deliveries will stop immediately.")) return;
    persist(items.filter((e) => e.id !== id));
  };
  const test = (e: Endpoint) => alert(`Test payload sent to ${e.url} (signed with X-EventOS-Signature)`);
  const copySecret = (s: string) => { navigator.clipboard.writeText(s); alert("Secret copied"); };
  const create = () => {
    if (!form.url.startsWith("https://")) { alert("URL must start with https://"); return; }
    if (form.events.length === 0) { alert("Select at least one event"); return; }
    const endpoint: Endpoint = { ...form, id: uid(), successCount: 0, failCount: 0, createdAt: new Date().toISOString() };
    persist([endpoint, ...items]);
    setShowForm(false);
    setForm({ url: "", description: "", events: [], secret: genSecret(), active: true });
  };

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link to="/modules/automation" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1" style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-3 w-3" /> Back to Automation
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--warning) 15%, transparent)", color: "var(--warning)" }}>
              <Webhook className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Outbound Webhooks</h1>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: "var(--primary)" }}>
          <Plus className="h-4 w-4" />
          New endpoint
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Endpoints", value: items.length, color: "var(--primary)" },
          { label: "Active", value: items.filter((e) => e.active).length, color: "var(--success)" },
          { label: "Successful deliveries", value: items.reduce((a, b) => a + b.successCount, 0).toLocaleString(), color: "var(--info)" },
          { label: "Failed deliveries", value: items.reduce((a, b) => a + b.failCount, 0).toLocaleString(), color: "var(--destructive)" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3">
            <div className="text-lg font-semibold text-foreground tabular-nums">{s.value}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {items.length === 0 && <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">No endpoints yet.</div>}
        {items.map((e) => (
          <div key={e.id} className={`rounded-xl border bg-card overflow-hidden ${!e.active ? "opacity-60" : ""}`}>
            <div className="p-4 flex items-start gap-3 border-b" style={{ background: "var(--muted-background)" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={e.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-foreground hover:text-primary truncate max-w-md inline-flex items-center gap-1" style={{ textDecoration: "none" }}>
                    <code className="font-mono">{e.url}</code>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium" style={{ background: e.active ? "var(--success-bg)" : "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", color: e.active ? "var(--success)" : "var(--muted-foreground)" }}>
                    {e.active ? "Active" : "Paused"}
                  </span>
                </div>
                {e.description && <div className="text-xs text-muted-foreground mt-0.5">{e.description}</div>}
              </div>
              <div className="inline-flex items-center gap-1 shrink-0">
                <button onClick={() => test(e)} className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium rounded-md border hover:bg-accent" title="Send test">
                  <Play className="h-3 w-3" />
                  Test
                </button>
                <button onClick={() => toggle(e.id)} className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium rounded-md border hover:bg-accent">
                  {e.active ? "Pause" : "Resume"}
                </button>
                <button onClick={() => remove(e.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Events ({e.events.length})</div>
                <div className="flex flex-wrap gap-1">
                  {e.events.slice(0, 4).map((ev) => (
                    <code key={ev} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{ev}</code>
                  ))}
                  {e.events.length > 4 && <span className="text-[10px] text-muted-foreground">+{e.events.length - 4} more</span>}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Deliveries</div>
                <div className="flex items-center gap-3">
                  <div><span style={{ color: "var(--success)" }} className="font-semibold">{e.successCount}</span> <span className="text-muted-foreground">success</span></div>
                  <div><span style={{ color: "var(--destructive)" }} className="font-semibold">{e.failCount}</span> <span className="text-muted-foreground">failed</span></div>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Signing secret</div>
                <button onClick={() => copySecret(e.secret)} className="inline-flex items-center gap-1 text-[10px] font-mono bg-muted px-2 py-1 rounded text-muted-foreground hover:bg-accent">
                  <Copy className="h-3 w-3" />
                  {e.secret.slice(0, 12)}…
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-card rounded-xl border shadow-2xl w-full max-w-md p-5 space-y-3 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="text-lg font-semibold">New webhook endpoint</div>
              <button onClick={() => setShowForm(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">URL (https only)</label>
              <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono" placeholder="https://api.example.com/webhooks/…" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-sm" placeholder="e.g. Sync to our CRM" />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Events ({form.events.length} selected)</label>
              <div className="mt-1 border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                {EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/30 rounded px-1 py-0.5">
                    <input type="checkbox" checked={form.events.includes(ev)} onChange={(e) => setForm({ ...form, events: e.target.checked ? [...form.events, ev] : form.events.filter((x) => x !== ev) })} className="accent-[var(--primary)]" />
                    <code className="font-mono">{ev}</code>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Signing secret</label>
              <div className="flex items-center gap-1 mt-1">
                <code className="flex-1 h-9 px-3 rounded-md border border-input bg-muted text-xs font-mono flex items-center overflow-hidden">{form.secret}</code>
                <button onClick={() => setForm({ ...form, secret: genSecret() })} className="h-9 px-2 rounded-md border text-xs">Regenerate</button>
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <button onClick={() => setShowForm(false)} className="flex-1 h-9 rounded-md text-sm font-medium border hover:bg-accent">Cancel</button>
              <button onClick={create} className="flex-1 h-9 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: "var(--primary)" }}>Create endpoint</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
