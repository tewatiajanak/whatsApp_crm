import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../api";
import {
  ScrollText,
  ArrowLeft,
  Search,
  RefreshCw,
  MessageSquare,
  Mail,
  Bell,
  Loader2,
  Eye,
  X,
} from "lucide-react";

type Msg = {
  _id: string;
  contactName?: string;
  phone?: string;
  template?: string;
  status?: string;
  channel?: string;
  createdAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  body?: string;
  [k: string]: any;
};

const statusStyle = (s?: string) => {
  const S = (s || "").toLowerCase();
  if (S.includes("read") || S.includes("open"))
    return { bg: "var(--success-bg)", fg: "var(--success)", label: "Read" };
  if (S.includes("deliver"))
    return { bg: "var(--info-bg)", fg: "var(--info)", label: "Delivered" };
  if (S.includes("sent"))
    return { bg: "color-mix(in srgb, var(--primary) 15%, transparent)", fg: "var(--primary)", label: "Sent" };
  if (S.includes("queue") || S.includes("pending"))
    return { bg: "var(--warning-bg)", fg: "var(--warning)", label: "Queued" };
  if (S.includes("fail"))
    return { bg: "var(--destructive-bg)", fg: "var(--destructive)", label: "Failed" };
  return { bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", fg: "var(--muted-foreground)", label: s || "Unknown" };
};

const channelIcon: Record<string, any> = {
  whatsapp: { icon: MessageSquare, color: "#25D366" },
  sms: { icon: MessageSquare, color: "#0891b2" },
  email: { icon: Mail, color: "#7c3aed" },
  push: { icon: Bell, color: "#f59e0b" },
};

export default function CommunicationLogsPage() {
  const [items, setItems] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState<Msg | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await http.get("/messages?perPage=200&sort=-createdAt");
      setItems(res?.data ?? res?.items ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed");
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
    return items.filter((m) => {
      if (status !== "all" && !(m.status || "").toLowerCase().includes(status)) return false;
      if (q) {
        const hay = `${m.contactName ?? ""} ${m.phone ?? ""} ${m.template ?? ""} ${m.body ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, status]);

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link to="/modules/communication" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1" style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-3 w-3" /> Back to Communication
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{ background: "color-mix(in srgb, var(--info) 15%, transparent)", color: "var(--info)" }}
            >
              <ScrollText className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Message Logs</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Every message sent — email, WhatsApp, SMS, push — with delivery status from provider webhooks.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-accent">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: items.length, color: "var(--primary)" },
          { label: "Sent", value: items.filter((m) => (m.status || "").toLowerCase().includes("sent")).length, color: "var(--primary)" },
          { label: "Delivered", value: items.filter((m) => (m.status || "").toLowerCase().includes("deliver")).length, color: "var(--info)" },
          { label: "Read", value: items.filter((m) => (m.status || "").toLowerCase().includes("read")).length, color: "var(--success)" },
          { label: "Failed", value: items.filter((m) => (m.status || "").toLowerCase().includes("fail")).length, color: "var(--destructive)" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3">
            <div className="text-lg font-semibold text-foreground tabular-nums">{s.value}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipient, template, body…"
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 px-3 rounded-md border border-input bg-background text-sm">
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="deliver">Delivered</option>
          <option value="read">Read</option>
          <option value="fail">Failed</option>
          <option value="queue">Queued</option>
        </select>
        <div className="ml-auto text-xs text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} of ${items.length}`}
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className="px-4 py-3 text-left font-medium">Sent</th>
                <th className="px-4 py-3 text-left font-medium">Channel</th>
                <th className="px-4 py-3 text-left font-medium">Recipient</th>
                <th className="px-4 py-3 text-left font-medium">Template</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>}
              {!loading && error && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">{error}</td></tr>}
              {!loading && !error && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No messages found.</td></tr>}
              {!loading && filtered.map((m) => {
                const st = statusStyle(m.status);
                const ch = channelIcon[m.channel || "whatsapp"] || channelIcon.whatsapp;
                const Ico = ch.icon;
                return (
                  <tr key={m._id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {m.createdAt ? new Date(m.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded"
                        style={{ background: `color-mix(in srgb, ${ch.color} 15%, transparent)`, color: ch.color }}
                      >
                        <Ico className="h-3 w-3" />
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-sm text-foreground">{m.contactName || "—"}</div>
                      {m.phone && <div className="text-[11px] text-muted-foreground">{m.phone}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-xs">{m.template || <span className="italic">—</span>}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: st.bg, color: st.fg }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => setDetail(m)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent text-muted-foreground hover:text-foreground">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
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
              <div className="text-lg font-semibold">Message details</div>
              <button onClick={() => setDetail(null)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">To:</span> <strong>{detail.contactName || "—"}</strong> {detail.phone && <span className="text-muted-foreground">({detail.phone})</span>}</div>
              <div><span className="text-muted-foreground">Template:</span> {detail.template || "—"}</div>
              <div><span className="text-muted-foreground">Channel:</span> {detail.channel || "whatsapp"}</div>
              <div className="pt-2 border-t">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Body</div>
                <div className="rounded-md border p-3 bg-muted/30 text-sm whitespace-pre-wrap">{detail.body || <span className="italic text-muted-foreground">No preview available</span>}</div>
              </div>
              <div className="pt-2 border-t space-y-1 text-xs">
                <div className="text-muted-foreground uppercase tracking-wider">Timeline</div>
                {detail.createdAt && <div>Created: {new Date(detail.createdAt).toLocaleString("en-IN")}</div>}
                {detail.sentAt && <div>Sent: {new Date(detail.sentAt).toLocaleString("en-IN")}</div>}
                {detail.deliveredAt && <div>Delivered: {new Date(detail.deliveredAt).toLocaleString("en-IN")}</div>}
                {detail.readAt && <div>Read: {new Date(detail.readAt).toLocaleString("en-IN")}</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
