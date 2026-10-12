import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { crmApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Chip, Modal } from "../components/ui";
import DateInput from "../components/DateInput";
import { formatDate } from "../utils/dateFormat";
import { money, labelCls, waLink, idOf } from "../components/lead/leadUtils";

const tone = (stage) => (/enrol|accept/i.test(stage) ? "var(--success)" : /reject|declin/i.test(stage) ? "var(--destructive)" : /offer/i.test(stage) ? "var(--info)" : /pending/i.test(stage) ? "var(--warning)" : "var(--primary)");

// Applications: registered leads moving from "Submitted" to "Enrolled".
export default function Applications() {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("leads", "edit");
  const [stage, setStage] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [offer, setOffer] = useState(null);
  const [busy, setBusy] = useState(false);
  const apps = useApi(() => crmApi.applications({ stage, q: search, page }), [stage, search, page]);
  const d = apps.data || { stages: [], counts: {}, items: [], total: 0, pages: 1 };

  useEffect(() => { const t = setTimeout(() => { setSearch(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  async function move(a, next) {
    try { await crmApi.setApplicationStage(a._id, next); toast(`${a.name} → ${next}`); apps.reload(); }
    catch (e) { toast(e.message, "error"); }
  }
  const copy = (link) => navigator.clipboard?.writeText(link).then(() => toast("Applicant link copied"), () => toast("Could not copy", "error"));
  const total = Object.values(d.counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader title="Applications" />
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1">
        <button type="button" className={"ui-btn ui-btn-sm flex-shrink-0 " + (!stage ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => { setStage(""); setPage(1); }}>All <span className="text-[11px] opacity-80">{total}</span></button>
        {d.stages.map((s) => (
          <button key={s} type="button" className={"ui-btn ui-btn-sm flex-shrink-0 " + (stage === s ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => { setStage(s); setPage(1); }}>{s} <span className="text-[11px] opacity-80">{d.counts[s] || 0}</span></button>
        ))}
      </div>
      <div className="ui-search mb-3" style={{ maxWidth: 340 }}>
        <span className="ui-search-icon"><i className="bi bi-search"></i></span>
        <input className="ui-search-input" placeholder="Name, phone, application no., course" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ErrorBox error={apps.error} />

      {apps.loading && !apps.data ? <Spinner /> : !d.items.length ? <div className="rounded-xl border bg-card"><EmptyState icon="clipboard-check" text="No applications here." /></div> : (
        <div className="space-y-2">
          {d.items.map((a) => (
            <div key={a._id} className="rounded-xl border bg-card p-3 grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {a.lead && can("leads", "view") ? <Link to={`/crm/leads?lead=${idOf(a.lead)}`} className="text-sm font-semibold text-foreground hover:underline">{a.name}</Link> : <span className="text-sm font-semibold text-foreground">{a.name}</span>}
                  <span className="text-xs text-muted-foreground font-mono">{a.appNo}</span>
                  <Chip color={tone(a.stage)}>{a.stage}</Chip>
                  {a.offer?.response && <Chip color={a.offer.response === "accepted" ? "var(--success)" : "var(--destructive)"}>Offer {a.offer.response}</Chip>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.phone}{a.course ? ` · ${a.course}` : ""}{a.lead?.owner ? ` · ${a.lead.owner}` : ""} · applied {formatDate(a.createdAt)}</div>
              </div>
              <select className="ui-input w-full" value={a.stage} disabled={!canEdit} onChange={(e) => move(a, e.target.value)} aria-label="Stage">
                {[...new Set([a.stage, ...d.stages])].map((s) => <option key={s}>{s}</option>)}
              </select>
              <div className="flex gap-1.5 justify-end">
                {a.link && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Copy the applicant's status link" onClick={() => copy(a.link)}><i className="bi bi-link-45deg"></i></button>}
                {a.link && <a className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Send the link on WhatsApp" target="_blank" rel="noreferrer" href={`${waLink(a.phone)}?text=${encodeURIComponent(`Hi ${a.name.split(" ")[0]}, track your application ${a.appNo} here: ${a.link}`)}`}><i className="bi bi-whatsapp"></i></a>}
                {canEdit && <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setOffer({ app: a, text: a.offer?.text || `Dear ${a.name},\n\nWe are pleased to offer you admission${a.course ? ` to ${a.course}` : ""}.`, amount: a.offer?.amount || "", validTill: "" })}><i className="bi bi-envelope-paper"></i>Offer</button>}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{d.total} application{d.total === 1 ? "" : "s"}</span>
            <span className="inline-flex items-center gap-2">
              <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} title="Previous"><i className="bi bi-chevron-left"></i></button>
              {page} / {d.pages}
              <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" disabled={page >= d.pages} onClick={() => setPage((p) => p + 1)} title="Next"><i className="bi bi-chevron-right"></i></button>
            </span>
          </div>
        </div>
      )}

      {offer && (
        <Modal title={`Offer · ${offer.app.name}`} onClose={() => setOffer(null)}
          footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={() => setOffer(null)}>Cancel</button>
            <button type="button" className="ui-btn ui-btn-primary" disabled={busy || !offer.text.trim()} onClick={async () => {
              setBusy(true);
              try { const r = await crmApi.makeOffer(offer.app._id, { text: offer.text, amount: offer.amount, validTill: offer.validTill }); await navigator.clipboard?.writeText(r.data.link).catch(() => undefined); toast("Offer made — applicant link copied"); setOffer(null); apps.reload(); }
              catch (e) { toast(e.message, "error"); }
              finally { setBusy(false); }
            }}>{busy ? "Saving…" : "Make offer"}</button></>}>
          <div className="space-y-3">
            <div><label className={labelCls}>Offer letter</label><textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={8} value={offer.text} onChange={(e) => setOffer((o) => ({ ...o, text: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Fee to confirm the seat (₹)</label><input className="ui-input w-full" type="number" min="0" value={offer.amount} onChange={(e) => setOffer((o) => ({ ...o, amount: e.target.value }))} /></div>
              <div><label className={labelCls}>Valid till</label><DateInput className="ui-input w-full" value={offer.validTill} onChange={(e) => setOffer((o) => ({ ...o, validTill: e.target.value }))} /></div>
            </div>
            {Number(offer.amount) > 0 && <div className="text-xs text-muted-foreground">{money(offer.amount)} is added to the lead's fees; the applicant can pay it from their link.</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
