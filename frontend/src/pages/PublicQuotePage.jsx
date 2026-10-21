import { useState } from "react";
import { useParams } from "react-router-dom";
import { salesApi } from "../api";
import { useApi } from "../hooks/useApi";
import { Spinner, Chip } from "../components/ui";
import { formatDate, formatDateTime } from "../utils/dateFormat";
import { money, labelCls } from "../components/lead/leadUtils";

const STATUS = { sent: { label: "Awaiting your reply", color: "var(--info)" }, accepted: { label: "Accepted", color: "var(--success)" }, rejected: { label: "Declined", color: "var(--destructive)" }, expired: { label: "Expired", color: "var(--warning)" } };

/** /quote/:token — the customer reads, prints and accepts or declines a quotation. */
export default function PublicQuotePage() {
  const { token } = useParams();
  const q = useApi(() => salesApi.publicQuote(token, { view: "1" }), [token]);
  const [mode, setMode] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const d = q.data;

  async function respond() {
    setBusy(true); setError("");
    try { await salesApi.respondQuote(token, { decision: mode, name, note }); setMode(""); q.reload(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (q.loading && !d) return <div className="crm-theme min-h-screen p-6" style={{ background: "var(--page-bg)" }}><Spinner /></div>;
  if (!d) return <div className="crm-theme min-h-screen flex items-center justify-center p-4" style={{ background: "var(--page-bg)" }}><div className="rounded-xl border bg-card p-6 text-sm text-foreground">{q.error?.message || "This link is not valid."}</div></div>;
  const st = STATUS[d.status] || STATUS.sent;
  return (
    <div className="crm-theme min-h-screen px-3 py-6 sm:py-10 print:p-0" style={{ background: "var(--page-bg)" }}>
      <div className="mx-auto rounded-xl border bg-card p-5 sm:p-8 print:border-0" style={{ maxWidth: 860 }}>
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b">
          <div className="min-w-0">
            {d.seller.logo && <img src={d.seller.logo} alt="" style={{ height: 40, maxWidth: 160, objectFit: "contain" }} className="mb-2" />}
            <div className="text-base font-semibold text-foreground">{d.seller.name}</div>
            <div className="text-xs text-muted-foreground whitespace-pre-line">{[d.seller.address, d.seller.gstin && `GSTIN ${d.seller.gstin}`, [d.seller.phone, d.seller.email].filter(Boolean).join(" · ")].filter(Boolean).join("\n")}</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold text-foreground">Quotation</div>
            <div className="font-mono text-sm text-foreground">{d.quoteNo}</div>
            <div className="text-xs text-muted-foreground">{formatDate(d.createdAt)}{d.validTill ? ` · valid till ${formatDate(d.validTill)}` : ""}</div>
            <div className="mt-1 print:hidden"><Chip color={st.color}>{st.label}</Chip></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
          <div><div className={labelCls}>To</div><div className="text-sm font-semibold text-foreground">{d.customer.name}</div><div className="text-xs text-muted-foreground whitespace-pre-line">{[d.customer.address, d.customer.gstin && `GSTIN ${d.customer.gstin}`, [d.customer.phone, d.customer.email].filter(Boolean).join(" · ")].filter(Boolean).join("\n")}</div></div>
          {d.subject && <div><div className={labelCls}>Subject</div><div className="text-sm text-foreground">{d.subject}</div></div>}
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">Disc</th><th className="px-3 py-2 text-right">Tax</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>{d.items.map((i, k) => (
              <tr key={k} className="border-t align-top"><td className="px-3 py-2 text-muted-foreground">{k + 1}</td><td className="px-3 py-2"><div className="text-foreground font-medium">{i.name}</div>{i.description && <div className="text-xs text-muted-foreground whitespace-pre-line">{i.description}</div>}</td><td className="px-3 py-2 text-right whitespace-nowrap">{i.qty} {i.unit}</td><td className="px-3 py-2 text-right">{money(i.price)}</td><td className="px-3 py-2 text-right">{i.discountPct ? `${i.discountPct}%` : "—"}</td><td className="px-3 py-2 text-right">{i.taxPct}%</td><td className="px-3 py-2 text-right font-medium">{money(i.amount)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="ms-auto mt-3 space-y-1 text-sm" style={{ maxWidth: 300 }}>
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="text-foreground">{money(d.subtotal)}</span></div>
          {d.discountTotal > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span className="text-foreground">− {money(d.discountTotal)}</span></div>}
          <div className="flex justify-between text-muted-foreground"><span>Tax</span><span className="text-foreground">{money(d.taxTotal)}</span></div>
          {d.adjustment !== 0 && <div className="flex justify-between text-muted-foreground"><span>{d.adjustmentLabel || "Adjustment"}</span><span className="text-foreground">{d.adjustment < 0 ? "− " : ""}{money(Math.abs(d.adjustment))}</span></div>}
          <div className="flex justify-between text-base font-semibold text-foreground border-t pt-1.5"><span>Total</span><span>{money(d.total)}</span></div>
        </div>
        {(d.notes || d.terms) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-4 border-t">
            {d.notes && <div><div className={labelCls}>Note</div><div className="text-sm text-foreground whitespace-pre-line">{d.notes}</div></div>}
            {d.terms && <div><div className={labelCls}>Terms</div><div className="text-xs text-muted-foreground whitespace-pre-line">{d.terms}</div></div>}
          </div>
        )}

        {d.status === "sent" ? (
          <div className="mt-6 pt-4 border-t print:hidden">
            {!mode ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="ui-btn ui-btn-primary" onClick={() => setMode("accept")}><i className="bi bi-check-lg"></i>Accept</button>
                <button type="button" className="ui-btn ui-btn-outline" onClick={() => setMode("reject")}>Decline</button>
                <button type="button" className="ui-btn ui-btn-ghost ms-auto" onClick={() => window.print()}><i className="bi bi-printer"></i>Print / PDF</button>
              </div>
            ) : (
              <div className="space-y-2" style={{ maxWidth: 420 }}>
                {mode === "accept" && <div><label className={labelCls}>Your name *</label><input className="ui-input w-full" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>}
                <div><label className={labelCls}>{mode === "accept" ? "Note" : "Reason"}</label><textarea className="ui-input w-full" style={{ minHeight: 70, height: "auto", paddingTop: 6 }} value={note} onChange={(e) => setNote(e.target.value)} /></div>
                {error && <div className="text-xs" style={{ color: "var(--destructive)" }}>{error}</div>}
                <div className="flex gap-2"><button type="button" className="ui-btn ui-btn-outline" onClick={() => setMode("")}>Back</button><button type="button" className={"ui-btn " + (mode === "accept" ? "ui-btn-primary" : "ui-btn-danger")} disabled={busy || (mode === "accept" && !name.trim())} onClick={respond}>{busy ? "Sending…" : mode === "accept" ? "Accept quotation" : "Decline"}</button></div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 pt-4 border-t flex flex-wrap items-center gap-2 print:hidden">
            {d.respondedAt && <span className="text-sm text-foreground">{st.label} by {d.response?.name} · {formatDateTime(d.respondedAt)}</span>}
            <button type="button" className="ui-btn ui-btn-ghost ms-auto" onClick={() => window.print()}><i className="bi bi-printer"></i>Print / PDF</button>
          </div>
        )}
      </div>
    </div>
  );
}
