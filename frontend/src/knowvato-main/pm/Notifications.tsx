import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Save } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { UIButton } from "../components/UIKit";
import { Toggle } from "../user-management/shared";
import { fmtRelative } from "@/utils/date";
import { PageTitle } from "./shared";

type Note = { _id: string; category: string; title: string; body: string; task?: string; project?: string; link: string; read: boolean; createdAt: string };

/** Where a notification leads. */
const target = (n: Note) => (n.link ? n.link : n.project ? `/modules/projects/p/${n.project}?tab=Tasks${n.task ? `&task=${n.task}` : ""}` : n.task ? `/modules/projects/my-work?task=${n.task}` : "/modules/projects/notifications");

function Row({ n, onOpen }: { n: Note; onOpen: (n: Note) => void }) {
  return (
    <button type="button" onClick={() => onOpen(n)} className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left hover:bg-accent/30" style={{ background: n.read ? "transparent" : "color-mix(in srgb, var(--primary) 7%, transparent)", border: 0, borderBottom: "1px solid var(--border)" }}>
      <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ background: n.read ? "transparent" : "var(--primary)" }} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{n.title}</span>
        {n.body && <span className="block text-xs text-muted-foreground truncate">{n.body}</span>}
        <span className="block text-[11px] text-muted-foreground">{fmtRelative(n.createdAt)}</span>
      </span>
    </button>
  );
}

/** The bell in the top bar: unread count, the latest alerts, "View all". Checks every 60 seconds. */
export function PmBell() {
  const { hasPm: pmUser, can } = useAuth() as any;
  // lead and follow-up alerts arrive here too, so CRM users get the bell as well
  const hasPm = pmUser || can("leads", "view") || can("followups", "view");
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const load = () => pmApi.notifications("limit=8").then((r: any) => { setItems(r.data.items); setUnread(r.data.unread); }).catch(() => {});
  useEffect(() => {
    if (!hasPm) return;
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => clearInterval(t);
  }, [hasPm]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!hasPm) return <i className="bi bi-bell"></i>;
  const openNote = async (n: Note) => {
    setOpen(false);
    if (!n.read) pmApi.readNotification(n._id).then(load).catch(() => {});
    nav(target(n));
  };

  return (
    <div ref={box} className="relative">
      <button type="button" title="Notifications" onClick={() => { setOpen((o) => !o); if (!open) load(); }} className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-[var(--sidebar-accent)]" style={{ background: "transparent", border: 0, color: "var(--foreground)" }}>
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute inline-flex items-center justify-center rounded-full text-[10px] font-semibold" style={{ top: 2, right: 2, minWidth: 16, height: 16, padding: "0 4px", background: "var(--destructive)", color: "#fff" }}>{unread > 99 ? "99+" : unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 rounded-xl border bg-card shadow-lg overflow-hidden" style={{ width: "min(360px, calc(100vw - 24px))" }}>
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unread > 0 && <button type="button" className="text-[12px] font-medium" style={{ background: "transparent", border: 0, color: "var(--primary)" }} onClick={() => pmApi.readAllNotifications().then(load)}>Mark all read</button>}
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
            {items.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications</div>}
            {items.map((n) => <Row key={n._id} n={n} onOpen={openNote} />)}
          </div>
          {pmUser && <button type="button" className="w-full px-3 py-2.5 text-[13px] font-medium" style={{ background: "transparent", border: 0, color: "var(--primary)" }} onClick={() => { setOpen(false); nav("/modules/projects/notifications"); }}>View all</button>}
        </div>
      )}
    </div>
  );
}

/** Project Management → Notifications: all alerts, and how I want to receive them. */
export default function NotificationsPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const nav = useNavigate();
  const [tab, setTab] = useState<"all" | "activity" | "settings">("all");
  const [activity, setActivity] = useState<any[]>([]);
  const [mine, setMine] = useState(true);
  useEffect(() => {
    if (tab === "activity") pmApi.activity(mine ? "mine=1" : "").then((r: any) => setActivity(r?.data ?? [])).catch(() => {});
  }, [tab, mine]);
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [prefs, setPrefs] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = () => pmApi.notifications(`limit=100${onlyUnread ? "&unread=1" : ""}`).then((r: any) => { setItems(r.data.items); setUnread(r.data.unread); }).catch((e: any) => toast(e?.message || "Could not load", "error"));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyUnread]);
  useEffect(() => {
    if (tab === "settings" && !prefs) pmApi.notifyPrefs().then((r: any) => setPrefs(r.data)).catch(() => {});
  }, [tab, prefs]);

  const openNote = async (n: Note) => {
    if (!n.read) await pmApi.readNotification(n._id).catch(() => {});
    nav(target(n));
  };
  const cell = (cat: string, channel: "inApp" | "email" | "whatsapp") => {
    const cur = prefs.prefs[cat] || { inApp: true, email: false, whatsapp: false };
    return <input type="checkbox" style={{ width: 18, height: 18 }} checked={!!cur[channel]} onChange={() => setPrefs({ ...prefs, prefs: { ...prefs.prefs, [cat]: { ...cur, [channel]: !cur[channel] } } })} />;
  };
  const save = async () => {
    setSaving(true);
    try {
      await pmApi.saveNotifyPrefs({ prefs: prefs.prefs, digest: prefs.digest });
      toast("Saved");
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageTitle
        icon={<Bell className="h-4 w-4" />}
        title="Notifications"
        actions={
          tab === "all"
            ? unread > 0 && <UIButton variant="outline" onClick={() => pmApi.readAllNotifications().then(load)} leftIcon={<CheckCheck className="h-3.5 w-3.5" />}>Mark all read</UIButton>
            : tab === "settings" && <UIButton onClick={save} loading={saving} disabled={!prefs} leftIcon={<Save className="h-3.5 w-3.5" />}>Save</UIButton>
        }
      />
      <div className="mt-3 flex items-center justify-between gap-2 border-b">
        <div className="flex gap-1">
          {([["all", `All${unread ? ` (${unread})` : ""}`], ["activity", "Activity"], ["settings", "My settings"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setTab(v)} className="px-3 py-2 text-[13px] font-medium" style={{ background: "transparent", border: 0, borderBottom: `2px solid ${tab === v ? "var(--primary)" : "transparent"}`, color: tab === v ? "var(--primary)" : "var(--muted-foreground)" }}>{label}</button>
          ))}
        </div>
        {tab === "all" && (
          <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground pb-1">Unread only<Toggle on={onlyUnread} onChange={() => setOnlyUnread((v) => !v)} labels={["Yes", "No"]} /></span>
        )}
      </div>

      {tab === "all" && (
        <div className="mt-3 rounded-xl border bg-card overflow-hidden">
          {items.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">No notifications</div>}
          {items.map((n) => <Row key={n._id} n={n} onOpen={openNote} />)}
        </div>
      )}

      {tab === "activity" && (
        <>
          <div className="mt-3 flex items-center justify-end gap-2 text-[12px] text-muted-foreground">Only mine<Toggle on={mine} onChange={() => setMine((v) => !v)} labels={["Yes", "No"]} /></div>
          <div className="mt-2 rounded-xl border bg-card divide-y">
            {activity.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">No activity</div>}
            {activity.map((a) => (
              <button key={a._id} type="button" onClick={() => a.project && nav(`/modules/projects/p/${a.project._id}${a.task ? `?tab=Tasks&task=${a.task._id}` : ""}`)} className="block w-full px-3.5 py-2.5 text-left text-sm" style={{ background: "transparent", border: 0, borderBottom: "1px solid var(--border)" }}>
                <span className="block text-foreground">{a.task && <b>{a.task.title}: </b>}{a.text}{(a.from || a.to) && <span className="text-muted-foreground"> · {a.from} → {a.to}</span>}</span>
                <span className="block text-[11px] text-muted-foreground">{a.project?.name ? `${a.project.name} · ` : ""}{a.byName} · {fmtRelative(a.createdAt)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === "settings" && prefs && (
        <div className="mt-3 space-y-3 max-w-2xl">
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                  <th className="px-3.5 py-2.5 text-left font-medium">Alert</th>
                  {["In-app", "Email", "WhatsApp"].map((h) => <th key={h} className="px-2 py-2.5 font-medium" style={{ textAlign: "center", width: 78 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {prefs.categories.map((c: any) => (
                  <tr key={c.key} className="border-t">
                    <td className="px-3.5 py-2.5">{c.label}</td>
                    {(["inApp", "email", "whatsapp"] as const).map((ch) => <td key={ch} className="px-2 py-2.5" style={{ textAlign: "center" }}>{cell(c.key, ch)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-xl border bg-card px-3.5 py-3 flex items-center justify-between gap-3 text-sm">
            <span>Daily digest email</span>
            <Toggle on={prefs.digest} onChange={() => setPrefs({ ...prefs, digest: !prefs.digest })} labels={["On", "Off"]} />
          </div>
        </div>
      )}
    </>
  );
}
