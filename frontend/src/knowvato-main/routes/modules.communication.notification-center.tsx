import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  ArrowLeft,
  Check,
  CheckCheck,
  X,
  UserPlus,
  DollarSign,
  AlertTriangle,
  Award,
  TrendingUp,
  ScanLine,
  Trash2,
  Filter as FilterIcon,
} from "lucide-react";

type NotifType =
  | "registration"
  | "payment"
  | "approval"
  | "certificate"
  | "system"
  | "checkin"
  | "limit";

type Notif = {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  entity?: { type: string; id: string };
};

const STORAGE = "em_in_app_notifications";
const load = (): Notif[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]");
  } catch {
    return [];
  }
};
const save = (n: Notif[]) => {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(n));
  } catch {}
};
const uid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const SEED_TEMPLATES: { type: NotifType; title: string; body: string; hoursAgo: number }[] = [
  { type: "registration", title: "New registration", body: "Priya Sharma registered for Tech Conference 2026", hoursAgo: 0.05 },
  { type: "payment", title: "Payment received", body: "₹4,500 received from Ankit Verma for VIP ticket", hoursAgo: 0.5 },
  { type: "approval", title: "Approval needed", body: "3 speaker applications waiting for review", hoursAgo: 2 },
  { type: "checkin", title: "Check-in spike", body: "127 attendees checked in during the last 15 minutes", hoursAgo: 3 },
  { type: "certificate", title: "Certificates generated", body: "245 participation certificates issued for Workshop batch 4", hoursAgo: 5 },
  { type: "limit", title: "Approaching plan limit", body: "You've used 85% of your monthly email quota (8,500 / 10,000)", hoursAgo: 8 },
  { type: "system", title: "Backup complete", body: "Weekly automated backup finished successfully", hoursAgo: 22 },
  { type: "system", title: "Password policy updated", body: "Minimum length increased to 12 characters", hoursAgo: 48 },
];

const iconFor = (t: NotifType) => {
  const map: Record<NotifType, { icon: any; color: string }> = {
    registration: { icon: UserPlus, color: "var(--primary)" },
    payment: { icon: DollarSign, color: "var(--success)" },
    approval: { icon: AlertTriangle, color: "var(--warning)" },
    certificate: { icon: Award, color: "#a855f7" },
    system: { icon: Bell, color: "var(--muted-foreground)" },
    checkin: { icon: ScanLine, color: "var(--info)" },
    limit: { icon: TrendingUp, color: "var(--destructive)" },
  };
  return map[t] || map.system;
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

export default function CommunicationNotificationCenterPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    const existing = load();
    if (existing.length === 0) {
      const now = Date.now();
      const seeded = SEED_TEMPLATES.map((s) => ({
        id: uid(),
        type: s.type,
        title: s.title,
        body: s.body,
        createdAt: new Date(now - s.hoursAgo * 3_600_000).toISOString(),
        read: s.hoursAgo > 6,
      }));
      save(seeded);
      setItems(seeded);
    } else setItems(existing);
  }, []);

  const persist = (next: Notif[]) => {
    setItems(next);
    save(next);
  };

  const filtered = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.read) : items),
    [items, filter]
  );
  const unreadCount = items.filter((n) => !n.read).length;

  const markRead = (id: string) => persist(items.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const markAllRead = () => persist(items.map((n) => ({ ...n, read: true })));
  const clearAll = () => {
    if (!confirm("Clear all notifications?")) return;
    persist([]);
  };
  const remove = (id: string) => persist(items.filter((n) => n.id !== id));

  return (
    <div className="p-4 max-w-[1000px] mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link to="/modules/communication" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1" style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-3 w-3" /> Back to Communication
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}
            >
              <Bell className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Notification Center</h1>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ background: "var(--primary)" }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Every alert from the platform — approvals, payments, capacity, plan usage.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-accent">
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
          {items.length > 0 && (
            <button onClick={clearAll} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-red-50 text-muted-foreground hover:text-red-600">
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => setFilter("all")}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium ${
            filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          <FilterIcon className="h-3.5 w-3.5" />
          All
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${filter === "all" ? "bg-white/20" : "bg-muted"}`}>{items.length}</span>
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium ${
            filter === "unread" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
          }`}
        >
          Unread
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${filter === "unread" ? "bg-white/20" : "bg-muted"}`}>{unreadCount}</span>
        </button>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {filtered.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full mx-auto mb-3" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
              <Check className="h-6 w-6" />
            </div>
            <div className="text-sm font-medium text-foreground">You're all caught up</div>
            <div className="text-xs text-muted-foreground mt-1">Nothing waiting for your attention.</div>
          </div>
        )}
        <div className="divide-y">
          {filtered.map((n) => {
            const { icon: Ico, color } = iconFor(n.type);
            return (
              <div key={n.id} className={`p-3 flex items-start gap-3 hover:bg-accent/30 transition-colors group ${!n.read ? "bg-primary/5" : ""}`}>
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md shrink-0 mt-0.5"
                  style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
                >
                  <Ico className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <div className="text-sm font-semibold text-foreground">{n.title}</div>
                    {!n.read && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--primary)" }} />}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5 leading-snug">{n.body}</div>
                  <div className="text-[11px] text-muted-foreground/70 mt-1">{fmtWhen(n.createdAt)}</div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5 transition-opacity">
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                      title="Mark as read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => remove(n.id)}
                    className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
