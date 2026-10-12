import { useState } from "react";
import { crmApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Spinner, ErrorBox, EmptyState, Chip } from "../ui";
import DateInput from "../DateInput";
import { formatDate, formatDateTime } from "../../utils/dateFormat";
import { money, waLink } from "./leadUtils";

const BLANK = { plan: false, title: "", amount: "", dueDate: "", paid: false, mode: "Cash", reference: "", instalments: 3, everyDays: 30 };

// Fees on a lead: what is due, what came in, instalments, refunds, concessions, pay links, receipts.
export default function LeadFees({ lead, canEdit, onChanged }) {
  const toast = useToast();
  const { can } = useAuth();
  const fees = useApi(() => crmApi.fees(lead._id), [lead._id]);
  const [form, setForm] = useState(null);
  const [act, setAct] = useState(null); // { id, kind: "pay" | "refund" | "discount", amount, mode, reference, reason }
  const [busy, setBusy] = useState(false);
  const data = fees.data || { fees: [], paid: 0, pending: 0, modes: [] };
  const offline = (data.modes || []).filter((m) => m !== "Online");
  const hidden = !!lead.contactsHidden;

  async function run(fn, msg) {
    setBusy(true);
    try { await fn(); toast(msg); setForm(null); setAct(null); fees.reload(); onChanged?.(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  const copy = (link) => navigator.clipboard?.writeText(link).then(() => toast("Payment link copied"), () => toast("Could not copy the link", "error"));
  const share = (f) => `${waLink(lead.phone)}?text=${encodeURIComponent(`Hi ${lead.name.split(" ")[0]}, please pay ${money(f.balance)} for ${f.title} here: ${f.link}`)}`;
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setA = (k, v) => setAct((a) => ({ ...a, [k]: v }));

  function saveForm() {
    if (form.plan) return run(() => crmApi.feePlan(lead._id, { title: form.title, total: form.amount, instalments: form.instalments, firstDue: form.dueDate, everyDays: form.everyDays }), "Instalment plan added");
    return run(() => crmApi.addFee(lead._id, form), form.paid ? "Payment recorded" : "Fee added");
  }
  function saveAct(f) {
    if (act.kind === "pay") return run(() => crmApi.payFee(f._id, { mode: act.mode, reference: act.reference, amount: act.amount }), "Payment recorded");
    if (act.kind === "refund") return run(() => crmApi.refundFee(f._id, { amount: act.amount, reason: act.reason }), "Refund recorded");
    return run(() => crmApi.requestDiscount(f._id, { amount: act.amount, reason: act.reason }), "Sent for approval");
  }
  const formReady = form && form.title.trim() && Number(form.amount) > 0 && (!form.plan || (form.dueDate && form.instalments >= 2));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border px-3 py-2"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Received</div><div className="text-base font-semibold" style={{ color: "var(--success)" }}>{money(data.paid)}</div></div>
        <div className="rounded-lg border px-3 py-2"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Still to pay</div><div className="text-base font-semibold" style={{ color: data.pending ? "var(--warning)" : undefined }}>{money(data.pending)}</div></div>
      </div>

      {canEdit && !form && <button type="button" className="ui-btn ui-btn-outline w-full" onClick={() => setForm(BLANK)}><i className="bi bi-plus-lg"></i>Add fee</button>}
      {form && (
        <div className="rounded-lg border p-2.5 space-y-2">
          <div className="flex gap-1">
            {[[false, "One fee"], [true, "Instalment plan"]].map(([v, label]) => <button key={label} type="button" className={"ui-btn ui-btn-sm " + (form.plan === v ? "ui-btn-primary" : "ui-btn-ghost")} onClick={() => setF("plan", v)}>{label}</button>)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px] gap-2">
            <input className="ui-input w-full" autoFocus placeholder="Fee for (e.g. Tuition fee)" value={form.title} onChange={(e) => setF("title", e.target.value)} />
            <input className="ui-input w-full" type="number" min="1" placeholder={form.plan ? "Total ₹" : "Amount ₹"} value={form.amount} onChange={(e) => setF("amount", e.target.value)} />
            <DateInput className="ui-input w-full" placeholder={form.plan ? "First due" : "Due date"} value={form.dueDate} onChange={(e) => setF("dueDate", e.target.value)} />
          </div>
          {form.plan ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">Instalments<input className="ui-input w-full mt-1" type="number" min="2" max="24" value={form.instalments} onChange={(e) => setF("instalments", Number(e.target.value))} /></label>
              <label className="text-xs text-muted-foreground">Days between<input className="ui-input w-full mt-1" type="number" min="1" value={form.everyDays} onChange={(e) => setF("everyDays", Number(e.target.value))} /></label>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={form.paid} onChange={(e) => setF("paid", e.target.checked)} />Already collected</label>
              {form.paid && (
                <div className="grid grid-cols-2 gap-2">
                  <select className="ui-input w-full" value={form.mode} onChange={(e) => setF("mode", e.target.value)}>{offline.map((m) => <option key={m}>{m}</option>)}</select>
                  <input className="ui-input w-full" placeholder="Reference / UTR" value={form.reference} onChange={(e) => setF("reference", e.target.value)} />
                </div>
              )}
            </>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className="ui-btn ui-btn-outline" onClick={() => setForm(null)} disabled={busy}>Cancel</button>
            <button type="button" className="ui-btn ui-btn-primary" disabled={busy || !formReady} onClick={saveForm}>Save</button>
          </div>
        </div>
      )}

      <ErrorBox error={fees.error} />
      {fees.loading && !fees.data ? <Spinner /> : !data.fees.length ? <EmptyState icon="receipt" text="No fees yet." /> : data.fees.map((f) => {
        const part = f.status === "pending" && f.paidAmount > 0;
        const overdue = f.status === "pending" && f.dueDate && new Date(f.dueDate) < new Date();
        return (
          <div key={f._id} className="rounded-lg border p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{f.title}</div>
                <div className="text-[11px]" style={{ color: overdue ? "var(--destructive)" : "var(--muted-foreground)" }}>
                  {f.status === "paid" ? `Paid ${formatDateTime(f.paidAt)}${f.invoiceNo ? ` · invoice ${f.invoiceNo}` : ""}` : f.dueDate ? `Due ${formatDate(f.dueDate)}` : "No due date"}
                  {f.discount > 0 && ` · ${money(f.discount)} concession`}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-semibold text-foreground">{money(f.amount)}</div>
                <Chip color={f.status === "paid" ? "var(--success)" : f.status === "cancelled" ? "var(--muted-foreground)" : part ? "var(--info)" : "var(--warning)"}>{part ? `${money(f.balance)} left` : f.status}</Chip>
              </div>
            </div>
            {(f.payments || []).map((p, i) => <div key={i} className="text-[11px] text-muted-foreground mt-1"><i className="bi bi-check2 me-1" style={{ color: "var(--success)" }}></i>{money(p.amount)} · {p.mode}{p.reference ? ` · ${p.reference}` : ""} · receipt {p.receiptNo} · {formatDate(p.at)}</div>)}
            {(f.refunds || []).map((p, i) => <div key={i} className="text-[11px] mt-1" style={{ color: "var(--destructive)" }}><i className="bi bi-arrow-counterclockwise me-1"></i>{money(p.amount)} refunded · {p.reason}</div>)}

            <div className="flex flex-wrap gap-1.5 mt-2">
              {f.status === "pending" && <>
                <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => copy(f.link)}><i className="bi bi-link-45deg"></i>Pay link</button>
                {!hidden && <a className="ui-btn ui-btn-outline ui-btn-sm" href={share(f)} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp"></i>Send</a>}
                {canEdit && <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setAct({ id: f._id, kind: "pay", amount: f.balance, mode: offline[0] || "Cash", reference: "" })}><i className="bi bi-cash-coin"></i>Receive</button>}
                {canEdit && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setAct({ id: f._id, kind: "discount", amount: "", reason: "" })}>Concession</button>}
                {canEdit && !f.paidAmount && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => run(() => crmApi.cancelFee(f._id), "Fee cancelled")}>Cancel</button>}
              </>}
              {f.paidAmount > 0 && <a className="ui-btn ui-btn-ghost ui-btn-sm" href={f.link} target="_blank" rel="noreferrer"><i className="bi bi-receipt"></i>{f.status === "paid" ? "Invoice" : "Receipt"}</a>}
              {f.paidAmount > 0 && can("leads", "del") && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setAct({ id: f._id, kind: "refund", amount: "", reason: "" })}>Refund</button>}
            </div>

            {act?.id === f._id && (
              <div className="grid grid-cols-2 sm:grid-cols-[110px_130px_1fr_auto] gap-2 mt-2">
                <input className="ui-input w-full" type="number" min="1" placeholder="Amount ₹" autoFocus value={act.amount} onChange={(e) => setA("amount", e.target.value)} />
                {act.kind === "pay"
                  ? <><select className="ui-input w-full" value={act.mode} onChange={(e) => setA("mode", e.target.value)}>{offline.map((m) => <option key={m}>{m}</option>)}</select>
                      <input className="ui-input w-full" placeholder="Reference / UTR" value={act.reference} onChange={(e) => setA("reference", e.target.value)} /></>
                  : <input className="ui-input w-full sm:col-span-2" placeholder={act.kind === "refund" ? "Why is it refunded?" : "Why is a concession needed?"} value={act.reason} onChange={(e) => setA("reason", e.target.value)} />}
                <button type="button" className="ui-btn ui-btn-primary" disabled={busy || !(Number(act.amount) > 0) || (act.kind !== "pay" && !act.reason.trim())} onClick={() => saveAct(f)}>
                  {act.kind === "pay" ? "Save" : act.kind === "refund" ? "Refund" : "Ask approval"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

