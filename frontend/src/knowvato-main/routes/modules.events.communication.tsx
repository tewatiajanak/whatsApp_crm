import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Mail, MessageCircle, RefreshCw } from "lucide-react";
import { http } from "../../api";
import { useToast } from "../../context/ToastContext";
import { useEventData } from "@/event-manager/context/EventDataContext";
import { SearchInput, UIButton } from "@/components/UIKit";
import { useColumnPicker } from "@/components/ColumnPicker";
import MessageComposer, { type Channel } from "@/components/MessageComposer";
import { fmtDate, fmtDateTime } from "@/utils/date";

/** Event Manager → Communication: message the attendees of any event, and the history of what was sent. */
type Sent = { id: string; channel: Channel; to: string; name: string; eventId: string; eventName: string; template: string; subject: string; body: string; status: string; failReason: string; simulated: boolean; sentBy: string; at: string };

const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
const TH = "px-4 py-3 text-left font-medium";
const CHECK = "flex items-center gap-2 text-sm text-foreground cursor-pointer";
const HISTORY_COLUMNS = ["Sr No", "Date & time", "Channel", "Sent to", "Event", "Template", "Message", "Status", "Sent by"];
const CHANNELS = [["whatsapp", "WhatsApp", MessageCircle], ["email", "Email", Mail]] as const;

const day = (iso?: string, end = false) => (iso ? new Date(`${String(iso).slice(0, 10)}T${end ? "23:59:59" : "00:00:00"}`).getTime() : NaN);
const eventStage = (e: any, now: number) => {
  const start = day(e.startDate);
  if (!Number.isFinite(start)) return "Draft";
  if (now > day(e.endDate || e.startDate, true)) return "Completed";
  return now >= start ? "Live" : "Upcoming";
};
/** What an attendee owes: the amount fixed at registration, else the event's fee for their category. */
const feeOf = (a: any, e: any): number => {
  if (a.fee !== undefined && a.fee !== null) return Number(a.fee) || 0;
  const fees = e?.registrationFees || {};
  if (a.category && fees[a.category] !== undefined) return Number(fees[a.category]) || 0;
  return Number(e?.registrationFee) || 0;
};
const paymentOf = (a: any, e: any) => (a.paymentStatus === "paid" ? "paid" : feeOf(a, e) <= 0 ? "free" : "unpaid");
const checkedIn = (a: any) => a.status === "checked-in" || a.status === "checked-out";
const plain = (html: string) => html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  sent: { label: "Sent", bg: "var(--info-bg)", fg: "var(--info)" },
  delivered: { label: "Delivered", bg: "var(--success-bg)", fg: "var(--success)" },
  read: { label: "Read", bg: "var(--success-bg)", fg: "var(--success)" },
  failed: { label: "Failed", bg: "var(--destructive-bg)", fg: "var(--destructive)" },
  simulated: { label: "Not delivered", bg: "var(--warning-bg)", fg: "var(--warning)" },
};

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string, any?])[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md border overflow-hidden">
      {options.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className="h-8 px-3 text-xs font-medium inline-flex items-center gap-1.5"
          style={value === id ? { background: "var(--primary)", color: "var(--primary-foreground)", border: 0 } : { background: "var(--card)", color: "var(--muted-foreground)", border: 0 }}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />} {label}
        </button>
      ))}
    </div>
  );
}

/** Dropdown to tick one or more events; nothing ticked means all events. */
function EventPicker({ events, picked, onChange }: { events: any[]; picked: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const label = !picked.length ? "All events" : picked.length === 1 ? events.find((e) => e.id === picked[0])?.eventName || "1 event" : `${picked.length} events`;
  const toggle = (id: string) => onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  return (
    <div ref={box} style={{ position: "relative", minWidth: 220 }}>
      <button type="button" className="ui-input w-full flex items-center justify-between gap-2 text-left" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="truncate">{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="rounded-lg border bg-card py-1 overflow-y-auto" role="listbox" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 40, minWidth: "100%", width: 340, maxWidth: "calc(100vw - 64px)", maxHeight: 300, boxShadow: "var(--shadow-lift)" }}>
          <label className={`${CHECK} px-3 py-2 hover:bg-accent`} style={{ marginBottom: 0 }}>
            <input type="checkbox" checked={!picked.length} onChange={() => onChange([])} />
            <span className="font-medium">All events</span>
          </label>
          {events.map((e) => (
            <label key={e.id} className={`${CHECK} px-3 py-2 hover:bg-accent border-t min-w-0`} style={{ marginBottom: 0 }}>
              <input type="checkbox" checked={picked.includes(e.id)} onChange={() => toggle(e.id)} />
              <span className="flex-1 min-w-0 truncate">{e.eventName || "Untitled"}</span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {e._stage}{e.startDate ? ` · ${fmtDate(e.startDate)}` : ""}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventsCommunicationPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { events = [], attendees = [], setAttendees } = useEventData() as any;
  const [tab, setTab] = useState<"send" | "history">("send");

  // ---- send ----
  const [channel, setChannel] = useState<Channel>("whatsapp");
  // events to send to; none ticked = all events
  const [picked, setPicked] = useState<string[]>([]);
  const [category, setCategory] = useState("all");
  const [payment, setPayment] = useState("all");
  const [checkin, setCheckin] = useState("all");

  // registrations also arrive from the public form — start from fresh data
  useEffect(() => {
    http
      .get("/attendees")
      .then((res: any) => setAttendees(res?.data ?? []))
      .catch((e: any) => toast(e?.message || "Could not load attendees", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventMap = useMemo(() => Object.fromEntries((events as any[]).map((e) => [e.id, e])), [events]);
  const eventList = useMemo(() => {
    const now = Date.now();
    return [...(events as any[])].sort((a, b) => (day(b.startDate) || 0) - (day(a.startDate) || 0)).map((e) => ({ ...e, _stage: eventStage(e, now) }));
  }, [events]);

  const inScope = useMemo(
    () => (attendees as any[]).filter((a) => eventMap[a.eventId] && (!picked.length || picked.includes(a.eventId))),
    [attendees, eventMap, picked]
  );
  const categories = useMemo(() => [...new Set(inScope.map((a) => a.category).filter(Boolean))].sort() as string[], [inScope]);
  const audience = useMemo(
    () =>
      inScope.filter(
        (a) =>
          (category === "all" || a.category === category) &&
          (payment === "all" || paymentOf(a, eventMap[a.eventId]) === payment) &&
          (checkin === "all" || checkedIn(a) === (checkin === "yes"))
      ),
    [inScope, category, payment, checkin, eventMap]
  );
  const recipients = useMemo(
    () => audience.map((a) => ({ id: a.id, name: a.name, phone: a.phone, email: a.email, eventId: a.eventId, eventName: eventMap[a.eventId]?.eventName })),
    [audience, eventMap]
  );

  // ---- history ----
  const [history, setHistory] = useState<Sent[]>([]);
  const [loading, setLoading] = useState(false);
  const [hChannel, setHChannel] = useState("all");
  const [hEvent, setHEvent] = useState("all");
  const [hStatus, setHStatus] = useState("all");
  const [search, setSearch] = useState("");
  const cols = useColumnPicker("event-communications", HISTORY_COLUMNS, [0, 3]);

  const loadHistory = () => {
    setLoading(true);
    http
      .get("/event-communications")
      .then((res: any) => setHistory(res?.data ?? []))
      .catch((e: any) => toast(e?.message || "Could not load the history", "error"))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (tab === "history") loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const statusOf = (m: Sent) => (m.status !== "failed" && m.simulated ? "simulated" : m.status);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return history.filter(
      (m) =>
        (hChannel === "all" || m.channel === hChannel) &&
        (hEvent === "all" || m.eventId === hEvent) &&
        (hStatus === "all" || statusOf(m) === hStatus) &&
        (!q || `${m.name} ${m.to} ${m.template} ${m.subject} ${m.body}`.toLowerCase().includes(q))
    );
  }, [history, hChannel, hEvent, hStatus, search]);

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b">
        <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight m-0">Communication</h1>
        <Segmented value={tab} options={[["send", "Send"], ["history", "History"]] as const} onChange={setTab} />
      </div>

      {tab === "send" ? (
        <div className="space-y-3">
          {/* Who gets it */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className={LABEL}>Send by</label>
                <Segmented value={channel} options={CHANNELS} onChange={setChannel} />
              </div>
              <div>
                <label className={LABEL}>Send to</label>
                <EventPicker events={eventList} picked={picked} onChange={setPicked} />
              </div>
              <div className="flex-1" style={{ minWidth: 150 }}>
                <label className={LABEL}>Attendee category</label>
                <select className="ui-input w-full" value={categories.includes(category) ? category : "all"} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1" style={{ minWidth: 130 }}>
                <label className={LABEL}>Payment</label>
                <select className="ui-input w-full" value={payment} onChange={(e) => setPayment(e.target.value)}>
                  <option value="all">All</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="free">Free entry</option>
                </select>
              </div>
              <div className="flex-1" style={{ minWidth: 130 }}>
                <label className={LABEL}>Check-in</label>
                <select className="ui-input w-full" value={checkin} onChange={(e) => setCheckin(e.target.value)}>
                  <option value="all">All</option>
                  <option value="yes">Checked in</option>
                  <option value="no">Not checked in</option>
                </select>
              </div>
            </div>
          </div>

          {/* What they get */}
          <div className="rounded-xl border bg-card flex flex-col overflow-hidden">
            <MessageComposer key={channel} channel={channel} recipients={recipients} onNotify={toast} wide />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select className="ui-input" value={hChannel} onChange={(e) => setHChannel(e.target.value)}>
              <option value="all">WhatsApp and email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
            <select className="ui-input" value={hEvent} onChange={(e) => setHEvent(e.target.value)} style={{ minWidth: 200 }}>
              <option value="all">All events</option>
              {eventList.map((e) => (
                <option key={e.id} value={e.id}>{e.eventName || "Untitled"}</option>
              ))}
            </select>
            <select className="ui-input" value={hStatus} onChange={(e) => setHStatus(e.target.value)}>
              <option value="all">Any status</option>
              {Object.entries(STATUS).map(([id, s]) => (
                <option key={id} value={id}>{s.label}</option>
              ))}
            </select>
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, number, email, message…" containerClassName="flex-1 min-w-[220px] max-w-md" />
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{loading ? "Loading…" : `${rows.length} of ${history.length}`}</span>
              <UIButton size="icon-sm" variant="outline" onClick={loadHistory} title="Refresh"><RefreshCw className="h-3.5 w-3.5" /></UIButton>
              {cols.button}
            </div>
          </div>
          {cols.style}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table id={cols.tableId} className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                    <th className={TH} style={{ width: 64 }}>Sr No</th>
                    <th className={TH}>Date &amp; time</th>
                    <th className={TH}>Channel</th>
                    <th className={TH}>Sent to</th>
                    <th className={TH}>Event</th>
                    <th className={TH}>Template</th>
                    <th className={TH}>Message</th>
                    <th className={TH}>Status</th>
                    <th className={TH}>Sent by</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        {history.length ? "Nothing matches these filters." : "Nothing has been sent yet."}
                      </td>
                    </tr>
                  )}
                  {rows.map((m, i) => {
                    const st = STATUS[statusOf(m)] || STATUS.sent;
                    const message = plain(m.body);
                    return (
                      <tr key={m.id} className="border-t hover:bg-accent/30">
                        <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDateTime(m.at)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            {m.channel === "email" ? <Mail className="h-3.5 w-3.5 text-muted-foreground" /> : <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />}
                            {m.channel === "email" ? "Email" : "WhatsApp"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-foreground">{m.name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{m.to}</div>
                        </td>
                        <td className="px-4 py-2.5">{m.eventName || "—"}</td>
                        <td className="px-4 py-2.5">{m.template || "—"}</td>
                        <td className="px-4 py-2.5" style={{ maxWidth: 320 }}>
                          {m.subject && <div className="font-medium text-foreground truncate" title={m.subject}>{m.subject}</div>}
                          <div className="text-xs text-muted-foreground truncate" title={message}>{message || "—"}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" style={{ background: st.bg, color: st.fg }} title={m.failReason || undefined}>
                            {st.label}
                          </span>
                          {m.failReason && <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--destructive)", maxWidth: 200 }} title={m.failReason}>{m.failReason}</div>}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{m.sentBy || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
