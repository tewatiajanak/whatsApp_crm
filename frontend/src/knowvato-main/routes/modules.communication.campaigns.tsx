import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../api";
import {
  Megaphone,
  ArrowLeft,
  Search,
  Plus,
  Send,
  Pause,
  Trash2,
  MessageSquare,
  Mail,
  Bell,
  Loader2,
  X,
} from "lucide-react";
import { fmtDate } from "@/utils/date";

type Campaign = {
  _id: string;
  name?: string;
  template?: string;
  status?: string;
  channel?: string;
  audience?: any;
  stats?: any;
  createdAt?: string;
  [k: string]: any;
};

const channelIcon: Record<string, any> = {
  whatsapp: { icon: MessageSquare, color: "#25D366" },
  sms: { icon: MessageSquare, color: "#0891b2" },
  email: { icon: Mail, color: "#7c3aed" },
  push: { icon: Bell, color: "#f59e0b" },
};

const statusStyle = (s?: string) => {
  const S = (s || "draft").toLowerCase();
  if (S.includes("sent") || S.includes("complete"))
    return { bg: "var(--success-bg)", fg: "var(--success)", label: "Completed" };
  if (S.includes("send") || S.includes("progress"))
    return { bg: "var(--info-bg)", fg: "var(--info)", label: "Sending" };
  if (S.includes("schedule"))
    return { bg: "var(--warning-bg)", fg: "var(--warning)", label: "Scheduled" };
  if (S.includes("pause"))
    return { bg: "color-mix(in srgb, var(--muted-foreground) 15%, transparent)", fg: "var(--muted-foreground)", label: "Paused" };
  if (S.includes("fail"))
    return { bg: "var(--destructive-bg)", fg: "var(--destructive)", label: "Failed" };
  return { bg: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)", fg: "var(--muted-foreground)", label: "Draft" };
};

export default function CommunicationCampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showComposer, setShowComposer] = useState(false);
  const [form, setForm] = useState({ name: "", channel: "whatsapp", template: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await http.get("/campaigns?perPage=100&sort=-createdAt");
      setItems(res?.data ?? res?.items ?? []);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
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
    if (!q) return items;
    return items.filter((c) =>
      `${c.name ?? ""} ${c.template ?? ""} ${c.status ?? ""}`.toLowerCase().includes(q)
    );
  }, [items, search]);

  const create = async () => {
    if (!form.name.trim()) return;
    try {
      await http.post("/campaigns", { ...form, name: form.name.trim(), status: "Draft" });
      setForm({ name: "", channel: "whatsapp", template: "" });
      setShowComposer(false);
      await load();
    } catch (e: any) {
      alert(e?.message || "Create failed");
    }
  };

  const remove = async (c: Campaign) => {
    if (!confirm(`Delete "${c.name}"?`)) return;
    try {
      await http.del(`/campaigns/${c._id}`);
      await load();
    } catch (e: any) {
      alert(e?.message || "Delete failed");
    }
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
                background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                color: "var(--primary)",
              }}
            >
              <Megaphone className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Campaigns</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowComposer(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm"
          style={{ background: "var(--primary)" }}
        >
          <Plus className="h-4 w-4" />
          New campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total campaigns", value: items.length, color: "var(--primary)" },
          {
            label: "Scheduled",
            value: items.filter((c) => (c.status || "").toLowerCase().includes("schedule")).length,
            color: "var(--warning)",
          },
          {
            label: "Completed",
            value: items.filter((c) => (c.status || "").toLowerCase().includes("sent") || (c.status || "").toLowerCase().includes("complete")).length,
            color: "var(--success)",
          },
          {
            label: "Drafts",
            value: items.filter((c) => (c.status || "").toLowerCase().includes("draft") || !c.status).length,
            color: "var(--muted-foreground)",
          },
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
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns…"
            className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {loading ? "Loading…" : `${filtered.length} of ${items.length}`}
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className="px-4 py-3 text-left font-medium">Campaign</th>
                <th className="px-4 py-3 text-left font-medium">Channel</th>
                <th className="px-4 py-3 text-left font-medium">Template</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    {error} — <button onClick={load} className="text-primary hover:underline">retry</button>
                  </td>
                </tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {items.length === 0 ? "No campaigns yet. Click 'New campaign' to start." : "No campaigns match."}
                  </td>
                </tr>
              )}
              {!loading && filtered.map((c) => {
                const st = statusStyle(c.status);
                const ch = channelIcon[c.channel || "whatsapp"] || channelIcon.whatsapp;
                const Ico = ch.icon;
                return (
                  <tr key={c._id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-medium text-foreground">{c.name || "Untitled"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded"
                        style={{ background: `color-mix(in srgb, ${ch.color} 15%, transparent)`, color: ch.color }}
                      >
                        <Ico className="h-3 w-3" />
                        {c.channel || "whatsapp"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-xs">
                      {c.template || <span className="italic opacity-60">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
                        style={{ background: st.bg, color: st.fg }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {fmtDate(c.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => remove(c)}
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

      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowComposer(false)}>
          <div className="bg-card rounded-xl border shadow-2xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">New campaign</div>
              </div>
              <button onClick={() => setShowComposer(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  placeholder="e.g. October re-engagement"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Channel</label>
                <select
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Template</label>
                <input
                  value={form.template}
                  onChange={(e) => setForm({ ...form, template: e.target.value })}
                  className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  placeholder="Template name or id"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-3 border-t">
              <button onClick={() => setShowComposer(false)} className="flex-1 h-9 rounded-md text-sm font-medium border hover:bg-accent">
                Cancel
              </button>
              <button
                onClick={create}
                disabled={!form.name.trim()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-md text-sm font-medium text-white shadow-sm disabled:opacity-40"
                style={{ background: "var(--primary)" }}
              >
                <Send className="h-3.5 w-3.5" />
                Create draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
