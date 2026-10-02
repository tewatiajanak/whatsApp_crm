import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Zap,
  ArrowLeft,
  Plus,
  X,
  Trash2,
  MessageSquare,
  Mail,
  Bell,
} from "lucide-react";
import { appStore } from "../../api/appStore";

type Rule = {
  id: string;
  name: string;
  trigger: string;
  channel: "whatsapp" | "email" | "sms" | "push";
  template: string;
  timing: string;
  active: boolean;
  createdAt: string;
};

const TRIGGERS = [
  { key: "registration.created", label: "Registration created" },
  { key: "registration.approved", label: "Registration approved" },
  { key: "payment.success", label: "Payment successful" },
  { key: "payment.failed", label: "Payment failed" },
  { key: "pass.generated", label: "Pass generated" },
  { key: "event.reminder", label: "Event reminder (relative)" },
  { key: "session.reminder", label: "Session reminder (relative)" },
  { key: "checkin.success", label: "Check-in success" },
  { key: "feedback.request", label: "Feedback request" },
  { key: "certificate.generated", label: "Certificate generated" },
];

const STORAGE = "em_automated_rules";
const load = (): Rule[] => {
  try {
    return JSON.parse(appStore.getItem(STORAGE) || "[]");
  } catch {
    return [];
  }
};
const save = (r: Rule[]) => {
  try {
    appStore.setItem(STORAGE, JSON.stringify(r));
  } catch {}
};
const uid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const SEED: Omit<Rule, "id" | "createdAt">[] = [
  { name: "Confirmation on registration", trigger: "registration.approved", channel: "whatsapp", template: "Registration Confirmation", timing: "immediate", active: true },
  { name: "Event reminder — 1 day before", trigger: "event.reminder", channel: "email", template: "Event Reminder", timing: "-1440", active: true },
  { name: "Event reminder — 2 hours before", trigger: "event.reminder", channel: "whatsapp", template: "Event Starting Soon", timing: "-120", active: true },
  { name: "Payment receipt", trigger: "payment.success", channel: "email", template: "Payment Receipt + Invoice", timing: "immediate", active: true },
  { name: "Feedback request after event", trigger: "feedback.request", channel: "email", template: "How was it?", timing: "60", active: false },
];

const channelIcon: Record<string, any> = {
  whatsapp: { icon: MessageSquare, color: "#25D366", label: "WhatsApp" },
  sms: { icon: MessageSquare, color: "#0891b2", label: "SMS" },
  email: { icon: Mail, color: "#7c3aed", label: "Email" },
  push: { icon: Bell, color: "#f59e0b", label: "Push" },
};

const fmtTiming = (t: string) => {
  if (t === "immediate") return "Immediate";
  const n = parseInt(t, 10);
  if (isNaN(n)) return t;
  if (n === 0) return "At event start";
  const abs = Math.abs(n);
  const days = Math.floor(abs / 1440);
  const hours = Math.floor((abs % 1440) / 60);
  const mins = abs % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}m`);
  const label = parts.join(" ");
  return n < 0 ? `${label} before` : `${label} after`;
};

export default function CommunicationAutomatedPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Rule, "id" | "createdAt">>({
    name: "",
    trigger: "registration.approved",
    channel: "whatsapp",
    template: "",
    timing: "immediate",
    active: true,
  });

  useEffect(() => {
    const existing = load();
    if (existing.length === 0) {
      const seeded = SEED.map((s) => ({ ...s, id: uid(), createdAt: new Date().toISOString() }));
      save(seeded);
      setRules(seeded);
    } else setRules(existing);
  }, []);

  const persist = (next: Rule[]) => {
    setRules(next);
    save(next);
  };

  const toggle = (id: string) => persist(rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
  const remove = (id: string) => {
    if (!confirm("Delete this rule?")) return;
    persist(rules.filter((r) => r.id !== id));
  };
  const create = () => {
    if (!form.name.trim() || !form.template.trim()) return;
    const rule: Rule = { ...form, id: uid(), name: form.name.trim(), template: form.template.trim(), createdAt: new Date().toISOString() };
    persist([rule, ...rules]);
    setShowForm(false);
    setForm({ name: "", trigger: "registration.approved", channel: "whatsapp", template: "", timing: "immediate", active: true });
  };

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link
            to="/modules/communication"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to Communication
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                background: "color-mix(in srgb, var(--warning) 15%, transparent)",
                color: "var(--warning)",
              }}
            >
              <Zap className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Automated Messages</h1>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm"
          style={{ background: "var(--primary)" }}
        >
          <Plus className="h-4 w-4" />
          New rule
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total rules", value: rules.length },
          { label: "Active", value: rules.filter((r) => r.active).length, color: "var(--success)" },
          { label: "Paused", value: rules.filter((r) => !r.active).length, color: "var(--muted-foreground)" },
          { label: "Triggers used", value: new Set(rules.map((r) => r.trigger)).size, color: "var(--info)" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3.5">
            <div className="text-xl font-semibold text-foreground tabular-nums">{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className="px-4 py-3 text-left font-medium">Rule</th>
                <th className="px-4 py-3 text-left font-medium">Trigger</th>
                <th className="px-4 py-3 text-left font-medium">Channel</th>
                <th className="px-4 py-3 text-left font-medium">Template</th>
                <th className="px-4 py-3 text-left font-medium">Timing</th>
                <th className="px-4 py-3 text-left font-medium">Active</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No rules configured yet.
                  </td>
                </tr>
              )}
              {rules.map((r) => {
                const ch = channelIcon[r.channel];
                const Ico = ch.icon;
                const trigger = TRIGGERS.find((t) => t.key === r.trigger)?.label || r.trigger;
                return (
                  <tr key={r.id} className={`border-t hover:bg-accent/30 ${!r.active ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2.5 font-medium text-foreground max-w-xs truncate">{r.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{trigger}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded"
                        style={{ background: `color-mix(in srgb, ${ch.color} 15%, transparent)`, color: ch.color }}
                      >
                        <Ico className="h-3 w-3" />
                        {ch.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground truncate max-w-xs">{r.template}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{fmtTiming(r.timing)}</td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => toggle(r.id)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          r.active ? "" : "bg-muted"
                        }`}
                        style={r.active ? { background: "var(--primary)" } : undefined}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                            r.active ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => remove(r.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
              <div className="text-lg font-semibold">New automated rule</div>
              <button onClick={() => setShowForm(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Name", el: <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" placeholder="e.g. Send reminder 1h before" /> },
                {
                  label: "Trigger",
                  el: (
                    <select value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
                      {TRIGGERS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  ),
                },
                {
                  label: "Channel",
                  el: (
                    <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as any })} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
                      {Object.entries(channelIcon).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  ),
                },
                { label: "Template", el: <input value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" placeholder="Template name" /> },
                {
                  label: "Timing",
                  el: (
                    <input value={form.timing} onChange={(e) => setForm({ ...form, timing: e.target.value })} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" placeholder="immediate or minutes (e.g. -60)" />
                  ),
                },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{f.label}</label>
                  <div className="mt-1">{f.el}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <button onClick={() => setShowForm(false)} className="flex-1 h-9 rounded-md text-sm font-medium border hover:bg-accent">Cancel</button>
              <button onClick={create} className="flex-1 h-9 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: "var(--primary)" }}>
                Create rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
