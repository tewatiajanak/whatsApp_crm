import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { crmApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { Spinner, Chip, Panel } from "../ui";
import { fuIcon, isoDay } from "./leadUtils";

/* ───────────── push notifications on this device ───────────── */
const b64 = (s) => Uint8Array.from(atob((s + "=".repeat((4 - (s.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function usePush() {
  const toast = useToast();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!pushSupported()) return;
    navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((s) => setOn(!!s)).catch(() => undefined);
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const current = await reg.pushManager.getSubscription();
      if (current) {
        await crmApi.pushUnsubscribe(current.endpoint).catch(() => undefined);
        await current.unsubscribe();
        setOn(false);
        toast("Notifications off on this device");
      } else {
        if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked for this site in your browser settings");
        const key = (await crmApi.pushKey()).data.publicKey;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
        await crmApi.pushSubscribe(sub.toJSON());
        setOn(true);
        toast("Notifications on for this device");
      }
    } catch (e) { toast(e.message || "Could not change notifications", "error"); }
    finally { setBusy(false); }
  }
  return { supported: pushSupported(), on, busy, toggle };
}

// A person's own switches and links: phone notifications, on leave, calendar feed, booking page.
export function MyCrmPanel() {
  const toast = useToast();
  const links = useApi(() => crmApi.myLinks(), []);
  const push = usePush();
  const [away, setAway] = useState(false);
  useEffect(() => { if (links.data) setAway(!!links.data.away); }, [links.data]);
  const copy = (text, what) => navigator.clipboard?.writeText(text).then(() => toast(`${what} copied`), () => toast("Could not copy", "error"));

  async function toggleAway() {
    try { await crmApi.setAway(!away); setAway(!away); toast(!away ? "Marked on leave — no new leads will come to you" : "Back at work"); }
    catch (e) { toast(e.message, "error"); }
  }

  const row = "flex items-center justify-between gap-3 px-3 py-2.5 border-b last:border-b-0";
  return (
    <Panel title="My settings" bodyClass="p-0">
      {!links.data ? <Spinner /> : <>
        <div className={row}>
          <span className="text-sm text-foreground">Notifications on this device</span>
          {push.supported
            ? <button type="button" className={"ui-btn ui-btn-sm " + (push.on ? "ui-btn-primary" : "ui-btn-outline")} disabled={push.busy} onClick={push.toggle}>{push.on ? "On" : "Turn on"}</button>
            : <span className="text-xs text-muted-foreground">Not supported here</span>}
        </div>
        <div className={row}>
          <span className="text-sm text-foreground">On leave</span>
          <button type="button" className={"ui-btn ui-btn-sm " + (away ? "ui-btn-primary" : "ui-btn-outline")} onClick={toggleAway}>{away ? "Yes" : "No"}</button>
        </div>
        <div className={row}>
          <span className="text-sm text-foreground">Follow-ups in Google / Outlook calendar</span>
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" title="Add this address as a calendar subscription" onClick={() => copy(links.data.calendarUrl, "Calendar link")}><i className="bi bi-calendar2-week"></i>Copy link</button>
        </div>
        {links.data.googleAvailable && (
          <div className={row}>
            <span className="text-sm text-foreground">Google Calendar, both ways {links.data.googleEmail && <Chip color="var(--success)">{links.data.googleEmail}</Chip>}</span>
            {links.data.googleEmail
              ? <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={async () => { try { await crmApi.googleDisconnect(); links.reload(); } catch (e) { toast(e.message, "error"); } }}>Disconnect</button>
              : <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={async () => { try { window.location.assign((await crmApi.googleConnect()).data.url); } catch (e) { toast(e.message, "error"); } }}>Connect</button>}
          </div>
        )}
        <div className={row}>
          <span className="text-sm text-foreground">My booking page {!links.data.bookingOn && <Chip>Off in settings</Chip>}</span>
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" disabled={!links.data.bookingOn} onClick={() => copy(links.data.bookingUrl, "Booking link")}><i className="bi bi-link-45deg"></i>Copy link</button>
        </div>
      </>}
    </Panel>
  );
}

/* ───────────── month calendar of follow-ups ───────────── */
const pad = (n) => String(n).padStart(2, "0");
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function FollowUpCalendar({ owner }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [open, setOpen] = useState(isoDay(0));
  const days = useMemo(() => {
    const first = new Date(cursor);
    first.setDate(1 - ((first.getDay() + 6) % 7)); // back to Monday
    return [...Array(42)].map((_, i) => { const d = new Date(first); d.setDate(first.getDate() + i); return d; });
  }, [cursor]);
  const cal = useApi(() => crmApi.calendar({ from: key(days[0]), to: key(days[41]), owner }), [cursor, owner]);
  const byDay = useMemo(() => {
    const m = {};
    for (const f of cal.data || []) (m[key(new Date(f.due))] ||= []).push(f);
    return m;
  }, [cal.data]);
  const today = isoDay(0);
  const move = (n) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const list = byDay[open] || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3">
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Previous month" onClick={() => move(-1)}><i className="bi bi-chevron-left"></i></button>
          <div className="text-sm font-semibold text-foreground">{cursor.toLocaleString("en-IN", { month: "long", year: "numeric" })}</div>
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Next month" onClick={() => move(1)}><i className="bi bi-chevron-right"></i></button>
        </div>
        <div className="grid grid-cols-7 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>{WEEK.map((d) => <div key={d} className="py-1.5">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const k = key(d);
            const items = byDay[k] || [];
            const pending = items.filter((f) => !f.done).length;
            const inMonth = d.getMonth() === cursor.getMonth();
            const late = pending && k < today;
            return (
              <button key={k} type="button" onClick={() => setOpen(k)} className="border-t border-l first:border-l-0 text-left p-1.5 bg-transparent"
                style={{ minHeight: 62, opacity: inMonth ? 1 : 0.4, outline: open === k ? "2px solid var(--primary)" : "none", outlineOffset: -2 }}>
                <div className="text-xs font-medium" style={{ color: k === today ? "var(--primary)" : "var(--foreground)" }}>{d.getDate()}</div>
                {!!pending && <div className="text-[10px] mt-1 rounded px-1 inline-block" style={{ background: `color-mix(in srgb, var(--${late ? "destructive" : "primary"}) 14%, transparent)`, color: `var(--${late ? "destructive" : "primary"})` }}>{pending} due</div>}
                {items.length - pending > 0 && <div className="text-[10px] text-muted-foreground mt-0.5">{items.length - pending} done</div>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl border bg-card">
        <div className="px-3 py-2.5 border-b text-sm font-semibold text-foreground">{open.split("-").reverse().join("-")}</div>
        {!list.length ? <div className="text-sm text-muted-foreground p-4">Nothing on this day.</div> : list.map((f) => (
          <Link key={f._id} to={`/crm/leads?lead=${f.lead}`} className="flex items-center gap-2.5 px-3 py-2 border-b last:border-b-0 hover:bg-accent/30 no-underline">
            <i className={`bi bi-${fuIcon(f.type)}`} style={{ color: "var(--primary)" }}></i>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground truncate">{f.leadName}</span>
              <span className="block text-xs text-muted-foreground truncate">{new Date(f.due).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {f.owner}{f.note ? ` · ${f.note}` : ""}</span>
            </span>
            {f.done && <Chip color="var(--success)" icon="check2">Done</Chip>}
          </Link>
        ))}
      </div>
    </div>
  );
}
