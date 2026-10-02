import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Banknote, IndianRupee, RotateCcw, RefreshCw, X } from "lucide-react";
import { http } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import DateInput from "../../components/DateInput";
import { useEventData } from "@/event-manager/context/EventDataContext";
import { SearchInput, UIButton } from "@/components/UIKit";
import { fmtDate } from "@/utils/date";
import { useColumnPicker } from "@/components/ColumnPicker";

const COLUMNS = ["Sr No", "Attendee", "Event", "Category", "Amount", "Status", "Paid by", "Reference", "Paid on", "Actions"];

/**
 * Event Manager → Payments: who has paid for which event, online or offline,
 * and a way to record a payment received offline (cash, UPI, cheque…).
 */
type Status = "paid" | "pending" | "unpaid" | "failed" | "free";
type Row = {
  id: string;
  name: string;
  contact: string;
  eventId: string;
  eventName: string;
  category: string;
  amount: number;
  amountPaid: number;
  status: Status;
  mode: string;
  reference: string;
  paidAt?: string;
  raw: any;
};

const STATUS: Record<Status, { label: string; bg: string; fg: string }> = {
  paid: { label: "Paid", bg: "var(--success-bg)", fg: "var(--success)" },
  pending: { label: "Payment pending", bg: "var(--warning-bg)", fg: "var(--warning)" },
  unpaid: { label: "Unpaid", bg: "var(--destructive-bg)", fg: "var(--destructive)" },
  failed: { label: "Payment failed", bg: "var(--destructive-bg)", fg: "var(--destructive)" },
  free: { label: "Free", bg: "var(--muted-background)", fg: "var(--muted-foreground)" },
};
const MODES = ["Cash", "UPI", "Bank transfer", "Cheque", "Card (POS)", "Other"];
const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
const TH = "px-4 py-3 text-left font-medium";
const money = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

/** What an attendee owes: the amount fixed at registration, else the event's fee for their category. */
const feeOf = (a: any, e: any): number => {
  if (a.fee !== undefined && a.fee !== null) return Number(a.fee) || 0;
  const fees = e?.registrationFees || {};
  if (a.category && fees[a.category] !== undefined) return Number(fees[a.category]) || 0;
  return Number(e?.registrationFee) || 0;
};

export default function EventsPaymentsPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { user } = useAuth() as any;
  const { events = [], attendees = [], setAttendees } = useEventData() as any;
  const [searchParams] = useSearchParams();
  const [eventId, setEventId] = useState(searchParams.get("event") || "all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<Row | null>(null);
  const [form, setForm] = useState({ amount: 0, mode: "Cash", reference: "", date: today(), note: "" });
  const [saving, setSaving] = useState(false);
  const cols = useColumnPicker("payments", COLUMNS, [0, 1, 9]);

  const refresh = async (quiet = false) => {
    setRefreshing(true);
    try {
      const res: any = await http.get("/attendees");
      setAttendees(res?.data ?? []);
    } catch (e: any) {
      if (!quiet) toast(e?.message || "Could not refresh payments", "error");
    } finally {
      setRefreshing(false);
    }
  };
  // online payments change on the server (gateway callbacks) — start from fresh data
  useEffect(() => {
    refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventMap = useMemo(() => Object.fromEntries((events as any[]).map((e) => [e.id, e])), [events]);

  const rows: Row[] = useMemo(
    () =>
      (attendees as any[])
        .filter((a) => eventMap[a.eventId])
        .map((a) => {
          const e = eventMap[a.eventId];
          const amount = feeOf(a, e);
          const st: Status = a.paymentStatus === "paid" ? "paid" : amount <= 0 ? "free" : (["pending", "failed"].includes(a.paymentStatus) ? a.paymentStatus : "unpaid");
          const manual = a.paymentMode === "manual";
          return {
            id: a.id,
            name: a.name || "—",
            contact: a.phone || a.email || "",
            eventId: a.eventId,
            eventName: e.eventName,
            category: a.category || "",
            amount,
            amountPaid: st === "paid" ? Number(a.amountPaid) || amount : 0,
            status: st,
            mode: st !== "paid" ? "" : manual ? `Offline · ${a.manualPayment?.mode || "Cash"}` : `Online${a.paymentProvider ? ` · ${a.paymentProvider}` : ""}`,
            reference: manual ? a.manualPayment?.reference || "" : a.paymentTxnId || "",
            paidAt: a.paidAt,
            raw: a,
          };
        }),
    [attendees, eventMap]
  );

  const inEvent = useMemo(() => (eventId === "all" ? rows : rows.filter((r) => r.eventId === eventId)), [rows, eventId]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inEvent.filter((r) => {
      if (status === "due" ? !["unpaid", "pending", "failed"].includes(r.status) : status !== "all" && r.status !== status) return false;
      return !q || `${r.name} ${r.contact} ${r.reference} ${r.eventName}`.toLowerCase().includes(q);
    });
  }, [inEvent, status, search]);

  const summary = useMemo(() => {
    const payable = inEvent.filter((r) => r.status !== "free");
    const paid = payable.filter((r) => r.status === "paid");
    return {
      expected: payable.reduce((s, r) => s + (r.status === "paid" ? r.amountPaid : r.amount), 0),
      collected: paid.reduce((s, r) => s + r.amountPaid, 0),
      online: paid.filter((r) => r.raw.paymentMode !== "manual").reduce((s, r) => s + r.amountPaid, 0),
      offline: paid.filter((r) => r.raw.paymentMode === "manual").reduce((s, r) => s + r.amountPaid, 0),
      due: payable.filter((r) => r.status !== "paid").reduce((s, r) => s + r.amount, 0),
      paidCount: paid.length,
      dueCount: payable.length - paid.length,
    };
  }, [inEvent]);

  const openRecord = (r: Row) => {
    setTarget(r);
    setForm({ amount: r.amount || 0, mode: "Cash", reference: "", date: today(), note: "" });
  };

  const replaceAttendee = (saved: any) => setAttendees((prev: any[]) => prev.map((a) => (a.id === saved.id ? saved : a)));

  const saveManual = async () => {
    if (!target || form.amount <= 0) return;
    setSaving(true);
    try {
      const res: any = await http.post(`/attendees/${target.id}/manual-payment`, { ...form, recordedBy: user?.name || user?.email || "" });
      replaceAttendee(res.data);
      toast(`Payment of ${money(form.amount)} recorded for ${target.name}`);
      setTarget(null);
    } catch (e: any) {
      toast(e?.message || "Could not record the payment", "error");
    } finally {
      setSaving(false);
    }
  };

  const undoManual = async (r: Row) => {
    if (!window.confirm(`Remove the offline payment of ${money(r.amountPaid)} recorded for ${r.name}? They will show as unpaid again.`)) return;
    try {
      const res: any = await http.del(`/attendees/${r.id}/manual-payment?by=${encodeURIComponent(user?.name || user?.email || "")}`);
      replaceAttendee(res.data);
      toast("Offline payment removed");
    } catch (e: any) {
      toast(e?.message || "Could not remove the payment", "error");
    }
  };

  const tiles = [
    { label: "Collected", value: money(summary.collected), sub: `${summary.paidCount} paid`, color: "var(--success)" },
    { label: "Online", value: money(summary.online), sub: "through the gateway", color: "var(--info)" },
    { label: "Offline", value: money(summary.offline), sub: "recorded manually", color: "var(--primary)" },
    { label: "Still due", value: money(summary.due), sub: `${summary.dueCount} attendee${summary.dueCount === 1 ? "" : "s"}`, color: "var(--destructive)" },
  ];

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2 border-b">
        <div>
          <Link to="/modules/events" className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors" style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-3 w-3" /> Back to Event Manager
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-foreground leading-tight">Payments</h1>
        </div>
        <UIButton variant="outline" onClick={() => refresh()} loading={refreshing} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
          Refresh
        </UIButton>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border bg-card p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t.label}</div>
            <div className="text-xl font-semibold mt-1" style={{ color: t.color }}>{t.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{t.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select className="ui-input" value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ minWidth: 200 }}>
          <option value="all">All events</option>
          {(events as any[]).map((e) => (
            <option key={e.id} value={e.id}>{e.eventName || "Untitled"}</option>
          ))}
        </select>
        <select className="ui-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="paid">Paid</option>
          <option value="due">Due (unpaid / pending / failed)</option>
          <option value="unpaid">Unpaid</option>
          <option value="pending">Payment pending</option>
          <option value="failed">Payment failed</option>
          <option value="free">Free</option>
        </select>
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile, reference…" containerClassName="flex-1 min-w-[220px] max-w-md" />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{filtered.length} of {inEvent.length}</span>
          {cols.button}
        </div>
      </div>
      {cols.style}

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table id={cols.tableId} className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className={TH} style={{ width: 64 }}>Sr No</th>
                <th className={TH}>Attendee</th>
                <th className={TH}>Event</th>
                <th className={TH}>Category</th>
                <th className="px-4 py-3 font-medium" style={{ textAlign: "right" }}>Amount</th>
                <th className={TH}>Status</th>
                <th className={TH}>Paid by</th>
                <th className={TH}>Reference</th>
                <th className={TH}>Paid on</th>
                <th className="px-4 py-3 font-medium" style={{ width: 150, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {rows.length === 0 ? "No registrations yet." : "No payments match your filters."}
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => {
                const st = STATUS[r.status];
                const manual = r.raw.paymentMode === "manual";
                return (
                  <tr key={r.id} className="border-t hover:bg-accent/30">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{r.name}</div>
                      {r.contact && <div className="text-xs text-muted-foreground">{r.contact}</div>}
                    </td>
                    <td className="px-4 py-2.5">{r.eventName}</td>
                    <td className="px-4 py-2.5">{r.category || "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ textAlign: "right" }}>
                      {r.status === "free" ? "—" : money(r.status === "paid" ? r.amountPaid : r.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{r.mode || "—"}</td>
                    <td className="px-4 py-2.5">
                      {r.reference ? <code className="text-xs font-mono text-muted-foreground">{r.reference}</code> : "—"}
                      {manual && r.raw.manualPayment?.note && <div className="text-[11px] text-muted-foreground">{r.raw.manualPayment.note}</div>}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{r.paidAt ? fmtDate(r.paidAt) : "—"}</td>
                    <td className="px-4 py-2.5" style={{ textAlign: "right" }}>
                      {r.status === "paid" ? (
                        manual ? (
                          <UIButton size="sm" variant="ghost" onClick={() => undoManual(r)} leftIcon={<RotateCcw className="h-3.5 w-3.5" />} title="Remove this offline payment">
                            Undo
                          </UIButton>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )
                      ) : (
                        <UIButton size="sm" variant="outline" onClick={() => openRecord(r)} leftIcon={<Banknote className="h-3.5 w-3.5" />}>
                          Record payment
                        </UIButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record offline payment */}
      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,.45)" }} onClick={() => !saving && setTarget(null)}>
          <div className="w-full rounded-xl border bg-card shadow-lg" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">Record offline payment</div>
                <div className="text-[11px] text-muted-foreground truncate">{target.name} · {target.eventName}{target.category ? ` · ${target.category}` : ""}</div>
              </div>
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" onClick={() => setTarget(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Amount received (₹) *</label>
                <div className="relative">
                  <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input type="number" min={0} className="ui-input w-full" style={{ paddingLeft: 28 }} value={form.amount} onChange={(e) => setForm({ ...form, amount: Math.max(0, Number(e.target.value) || 0) })} />
                </div>
                {target.amount > 0 && form.amount !== target.amount && (
                  <p className="text-[11px] mt-1" style={{ color: "var(--warning)" }}>The registration amount is {money(target.amount)}.</p>
                )}
              </div>
              <div>
                <label className={LABEL}>Paid by *</label>
                <select className="ui-input w-full" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                  {MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Payment date</label>
                <DateInput className="ui-input w-full" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Reference no.</label>
                <input className="ui-input w-full" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={100} />
              </div>
              <div className="col-span-2">
                <label className={LABEL}>Note</label>
                <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-4 py-3">
              <UIButton variant="outline" onClick={() => setTarget(null)} disabled={saving}>Cancel</UIButton>
              <UIButton onClick={saveManual} loading={saving} disabled={form.amount <= 0}>Mark as paid</UIButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
