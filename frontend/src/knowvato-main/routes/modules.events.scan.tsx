import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, CameraOff, Clock, LogIn, LogOut, RefreshCw, Users } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { http } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useEventData } from "@/event-manager/context/EventDataContext";
import { SearchInput, UIButton } from "@/components/UIKit";
import { fmtDateTime } from "@/utils/date";

/**
 * Event Manager → Scan Pass: the entry desk. Scan the QR on a pass (or find the
 * person by name / mobile) to check them in or out. Built for a phone first.
 */
type Mode = "in" | "out";
type Result = { tone: "ok" | "warn" | "bad"; title: string; attendee?: any };

const READER_ID = "scan-pass-reader";
const TONE = {
  ok: { bg: "var(--success-bg)", fg: "var(--success)" },
  warn: { bg: "var(--warning-bg)", fg: "var(--warning)" },
  bad: { bg: "var(--destructive-bg)", fg: "var(--destructive)" },
};
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  "checked-in": { label: "Checked in", bg: "var(--success-bg)", fg: "var(--success)" },
  "checked-out": { label: "Checked out", bg: "var(--warning-bg)", fg: "var(--warning)" },
};
const NOT_ARRIVED = { label: "Not arrived", bg: "var(--muted-background)", fg: "var(--muted-foreground)" };
const digits = (s?: string) => String(s || "").replace(/\D/g, "");

export default function EventsScanPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { events = [], attendees = [], setAttendees } = useEventData() as any;
  const [eventId, setEventId] = useState("all");
  const [mode, setMode] = useState<Mode>("in");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "checked-in" | "checked-out" | "remaining">("all");
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    http
      .get("/attendees")
      .then((res: any) => setAttendees(res?.data ?? []))
      .catch((e: any) => toast(e?.message || "Could not load attendees", "error"))
      .finally(() => setLoading(false));
  };
  // registrations also arrive from the public form — start from fresh data
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const eventMap = useMemo(() => Object.fromEntries((events as any[]).map((e) => [e.id, e])), [events]);
  const pool = useMemo(
    () => (attendees as any[]).filter((a) => eventMap[a.eventId] && (eventId === "all" || a.eventId === eventId)),
    [attendees, eventMap, eventId]
  );
  const stats = useMemo(() => {
    const inside = pool.filter((a) => a.status === "checked-in").length;
    const left = pool.filter((a) => a.status === "checked-out").length;
    return { total: pool.length, "checked-in": inside, "checked-out": left, remaining: pool.length - inside - left };
  }, [pool]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qd = digits(q);
    return pool
      .filter((a) => filter === "all" || (filter === "remaining" ? a.status !== "checked-in" && a.status !== "checked-out" : a.status === filter))
      .filter((a) => !q || String(a.name || "").toLowerCase().includes(q) || (qd.length >= 3 && digits(a.phone).includes(qd)));
  }, [pool, filter, search]);

  // Check a person in or out; the server sets the time
  const mark = async (a: any, action: Mode) => {
    setBusyId(a.id);
    try {
      const res: any = await http.post(`/attendees/${a.id}/attendance`, { action });
      const saved = res?.data;
      setAttendees((prev: any[]) => prev.map((x) => (x.id === saved.id ? saved : x)));
      setResult({ tone: "ok", title: action === "in" ? "Checked in" : "Checked out", attendee: saved });
    } catch (e: any) {
      setResult({ tone: "warn", title: e?.message || "Could not save", attendee: a });
    } finally {
      setBusyId("");
    }
  };

  // the camera callback is created once — it reads the latest values from here
  const live = useRef({ pool, mode, mark });
  live.current = { pool, mode, mark };
  const lastScan = useRef({ code: "", at: 0 });
  const onCode = (code: string) => {
    const now = Date.now();
    // the camera reads the same pass many times a second
    if (code === lastScan.current.code && now - lastScan.current.at < 4000) return;
    lastScan.current = { code, at: now };
    const a = live.current.pool.find((x) => x.passId === code || x.id === code);
    if (!a) return setResult({ tone: "bad", title: "Pass not found for this event" });
    live.current.mark(a, live.current.mode);
  };

  const scanner = useRef<Html5Qrcode | null>(null);
  const stopCamera = async () => {
    const s = scanner.current;
    scanner.current = null;
    setCameraOn(false);
    try {
      if (s?.isScanning) await s.stop();
      s?.clear();
    } catch {}
  };
  const startCamera = async () => {
    setCameraError("");
    try {
      const s = new Html5Qrcode(READER_ID);
      scanner.current = s;
      setCameraOn(true);
      await s.start({ facingMode: "environment" }, { fps: 10, qrbox: (w, h) => { const side = Math.floor(Math.min(w, h) * 0.7); return { width: side, height: side }; } }, onCode, () => {});
    } catch (e: any) {
      await stopCamera();
      const msg = String(e?.message || e || "");
      setCameraError(
        /NotAllowed|Permission/i.test(msg)
          ? "Camera permission is blocked. Allow the camera for this site in the browser settings."
          : /NotFound|no camera/i.test(msg)
          ? "No camera found on this device."
          : !window.isSecureContext
          ? "The camera works only on a secure (https) address."
          : "Could not start the camera."
      );
    }
  };
  useEffect(() => () => void stopCamera(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = [
    ["all", "Total", stats.total, Users, "color-mix(in srgb, var(--primary) 12%, transparent)", "var(--primary)"],
    ["checked-in", "Checked in", stats["checked-in"], LogIn, "var(--success-bg)", "var(--success)"],
    ["checked-out", "Checked out", stats["checked-out"], LogOut, "var(--warning-bg)", "var(--warning)"],
    ["remaining", "Remaining", stats.remaining, Clock, "var(--info-bg)", "var(--info)"],
  ] as const;
  const who = result?.attendee;

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
        <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight m-0">Scan Pass</h1>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select className="ui-input flex-1 sm:flex-none" style={{ minWidth: 0 }} value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="all">All events</option>
            {(events as any[]).map((e) => (
              <option key={e.id} value={e.id}>{e.eventName || "Untitled"}</option>
            ))}
          </select>
          <UIButton size="icon-sm" variant="outline" onClick={load} title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></UIButton>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-3 items-start">
        {/* Scanner */}
        <div className="rounded-xl border bg-card p-3 space-y-3">
          <div className="grid grid-cols-2 rounded-lg border overflow-hidden">
            {([["in", "Check in", LogIn], ["out", "Check out", LogOut]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className="h-10 text-sm font-semibold inline-flex items-center justify-center gap-2"
                style={mode === id ? { background: "var(--primary)", color: "var(--primary-foreground)", border: 0 } : { background: "var(--card)", color: "var(--muted-foreground)", border: 0 }}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className="rounded-lg overflow-hidden" style={{ background: "#0f172a", position: "relative", minHeight: cameraOn ? 0 : 200 }}>
            <div id={READER_ID} style={{ width: "100%" }} />
            {!cameraOn && (
              <div className="flex flex-col items-center justify-center gap-2" style={{ position: "absolute", inset: 0, color: "rgba(255,255,255,.7)" }}>
                <CameraOff className="h-8 w-8" />
              </div>
            )}
          </div>
          {cameraError && <div className="rounded-lg px-3 py-2 text-xs" style={{ background: TONE.bad.bg, color: TONE.bad.fg }}>{cameraError}</div>}
          <UIButton className="w-full" variant={cameraOn ? "outline" : "primary"} onClick={cameraOn ? stopCamera : startCamera} leftIcon={cameraOn ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}>
            {cameraOn ? "Stop camera" : "Start camera"}
          </UIButton>

          {result && (
            <div className="rounded-lg px-3 py-3" style={{ background: TONE[result.tone].bg }} role="status">
              <div className="text-sm font-semibold" style={{ color: TONE[result.tone].fg }}>{result.title}</div>
              {who && (
                <div className="mt-1 text-sm text-foreground">
                  <div className="font-semibold">{who.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {[who.category, eventMap[who.eventId]?.eventName].filter(Boolean).join(" · ")}
                  </div>
                  {who.checkInTime && <div className="text-xs text-muted-foreground mt-1">In: {fmtDateTime(who.checkInTime)}{who.checkOutTime ? ` · Out: ${fmtDateTime(who.checkOutTime)}` : ""}</div>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* People */}
        <div className="space-y-3 min-w-0">
          {/* same cards as the Overview page; tapping one filters the list */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {tiles.map(([id, label, value, Icon, bg, fg]) => (
              // a div, not a button: the app's button styles would square the card's corners
              <div
                key={id}
                role="button"
                tabIndex={0}
                onClick={() => setFilter(id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setFilter(id)}
                aria-pressed={filter === id}
                className="rounded-xl border bg-card p-3 flex items-center justify-between gap-3 cursor-pointer"
                style={{ background: "var(--card)", borderColor: filter === id ? "var(--primary)" : "var(--border)" }}
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-muted-foreground truncate">{label}</span>
                  <span className="block text-xl font-semibold text-foreground mt-1 leading-tight">{loading ? "…" : value}</span>
                </span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg shrink-0" style={{ background: bg, color: fg }}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
            ))}
          </div>
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or mobile…" containerClassName="w-full" />
          <div className="rounded-xl border bg-card overflow-hidden">
            {rows.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted-foreground">{loading ? "Loading…" : pool.length ? "No one matches." : "No attendees yet."}</div>}
            {rows.slice(0, 200).map((a, i) => {
              const st = STATUS[a.status] || NOT_ARRIVED;
              const inside = a.status === "checked-in";
              return (
                <div key={a.id} className={`flex items-center gap-3 px-3 py-2.5 ${i ? "border-t" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{a.name || "—"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[a.phone, a.category, eventId === "all" ? eventMap[a.eventId]?.eventName : ""].filter(Boolean).join(" · ")}
                    </div>
                    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium mt-1" style={{ background: st.bg, color: st.fg }}>
                      {st.label}
                    </span>
                  </div>
                  <UIButton size="sm" variant={inside ? "outline" : "primary"} loading={busyId === a.id} onClick={() => mark(a, inside ? "out" : "in")}>
                    {inside ? "Check out" : "Check in"}
                  </UIButton>
                </div>
              );
            })}
            {rows.length > 200 && <div className="border-t px-4 py-2 text-center text-xs text-muted-foreground">Showing 200 of {rows.length} — search to narrow down.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
