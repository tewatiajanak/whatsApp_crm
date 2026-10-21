import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { crmApi, leadsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Chip, Modal, Tabs, Panel, SearchBox, FilterSummary } from "../components/ui";
import DateInput from "../components/DateInput";
import { formatDate, formatDateTime } from "../utils/dateFormat";
import { money, labelCls, waLink, telLink, idOf } from "../components/lead/leadUtils";

const num = new Intl.NumberFormat("en-IN");
const tone = (stage) => (/enrol|accept/i.test(stage) ? "var(--success)" : /reject|declin/i.test(stage) ? "var(--destructive)" : /offer/i.test(stage) ? "var(--info)" : /pending|review/i.test(stage) ? "var(--warning)" : "var(--primary)");
const OFFER = { accepted: { label: "Offer accepted", color: "var(--success)" }, declined: { label: "Offer declined", color: "var(--destructive)" } };
const isoIn = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function exportExcel(rows, name) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Applications");
  XLSX.writeFile(wb, `${name}.xlsx`);
}
const copyText = (toast, text, what) => navigator.clipboard?.writeText(text).then(() => toast(`${what} copied`), () => toast("Could not copy", "error"));

/* ───────────── offer: letter, fee, and sending it by email / WhatsApp ───────────── */
const TOKENS = [
  { v: "{name}", l: "Applicant name" }, { v: "{firstName}", l: "First name" }, { v: "{appNo}", l: "Application no." }, { v: "{course}", l: "Course" },
  { v: "{amount}", l: "Fee amount" }, { v: "{validTill}", l: "Valid till" }, { v: "{link}", l: "Offer link" }, { v: "{payLink}", l: "Payment link" },
  { v: "{organisation}", l: "Organisation" }, { v: "{offer}", l: "Offer letter text" },
];
const DEFAULT_ORDER = ["{name}", "{course}", "{amount}", "{validTill}", "{link}", "{payLink}", "{organisation}"];
const varCount = (t) => (t ? t.vars : 0);

function VarRows({ count, vars, setVars }) {
  if (!count) return null;
  return (
    <div className="rounded-lg border p-2 space-y-1.5">
      {Array.from({ length: count }, (_, i) => {
        const v = vars[i] ?? "";
        const isToken = TOKENS.some((t) => t.v === v);
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground" style={{ width: 40 }}>{`{{${i + 1}}}`}</span>
            <select className="ui-input" style={{ width: 160 }} aria-label={`Value for {{${i + 1}}}`} value={isToken ? v : "custom"} onChange={(e) => { const n = [...vars]; n[i] = e.target.value === "custom" ? "" : e.target.value; setVars(n); }}>
              {TOKENS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              <option value="custom">Own text</option>
            </select>
            {!isToken && <input className="ui-input flex-1 min-w-0" aria-label="Text" value={v} onChange={(e) => { const n = [...vars]; n[i] = e.target.value; setVars(n); }} />}
          </div>
        );
      })}
    </div>
  );
}

function OfferModal({ app, detail, onClose, onDone }) {
  const toast = useToast();
  const tpl = useApi(() => crmApi.applicationTemplates(), []);
  const all = tpl.data || [];
  const emailTpls = all.filter((t) => t.channel === "email");
  const waTpls = all.filter((t) => t.channel === "whatsapp");
  const old = app.offer || {};
  const [o, setO] = useState({
    text: old.text || `Dear ${app.name},\n\nWe are pleased to offer you admission${app.course ? ` to ${app.course}` : ""}.`,
    amount: old.amount || "", validTill: old.validTill ? String(old.validTill).slice(0, 10) : isoIn(7),
  });
  const contactEmail = detail?.leadInfo?.email || app.email || "";
  const [em, setEm] = useState({ enabled: !!contactEmail, to: contactEmail, templateId: "", subject: "", vars: [] });
  const [wa, setWa] = useState({ enabled: !!app.phone, to: app.phone || "", templateId: "", vars: [] });
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("email");
  const emT = emailTpls.find((t) => t._id === em.templateId);
  const waT = waTpls.find((t) => t._id === wa.templateId);
  const pick = (set, list, id) => set((x) => ({ ...x, templateId: id, vars: DEFAULT_ORDER.slice(0, varCount(list.find((t) => t._id === id))) }));

  // what the person will see (links are made when it is sent)
  const local = { "{name}": app.name, "{firstName}": (app.name || "").split(" ")[0], "{appNo}": app.appNo, "{course}": app.course || "", "{amount}": o.amount ? money(o.amount) : "", "{validTill}": o.validTill ? formatDate(o.validTill) : "", "{link}": app.link || "[offer link]", "{payLink}": Number(o.amount) > 0 ? "[payment link]" : app.link || "[offer link]", "{organisation}": "[organisation]", "{offer}": o.text };
  const fillT = (s) => String(s || "").replace(/\{(name|firstName|appNo|course|amount|validTill|link|payLink|organisation|offer)\}/g, (m) => local[m] ?? m);
  const fillV = (s, vars) => String(s || "").replace(/\{\{(\d+)\}\}/g, (m, n) => fillT(vars[Number(n) - 1] ?? m));
  const fallback = `${o.text}\n\n${Number(o.amount) > 0 ? `To confirm your seat, pay ${money(o.amount)}${o.validTill ? ` by ${formatDate(o.validTill)}` : ""}: [payment link]\n\n` : ""}Accept or decline your offer here: ${local["{link}"]}`;
  const emailPreview = { subject: fillV(em.subject || emT?.subject || `Offer of admission · ${app.appNo}`, em.vars), body: emT ? fillV(emT.body, em.vars) : fallback };
  const waPreview = waT ? fillV(waT.body, wa.vars) + (waT.footer ? `\n\n${waT.footer}` : "") : fallback;

  async function send() {
    if (!o.text.trim()) return toast("Write the offer", "error");
    setBusy(true);
    try {
      const r = await crmApi.makeOffer(app._id, { ...o, email: em, whatsapp: wa });
      const s = r.data.sent || {};
      const parts = Object.entries(s).map(([k, v]) => `${k === "email" ? "Email" : "WhatsApp"} ${v.ok ? (v.simulated ? "saved (email not set up)" : "sent") : `failed: ${v.error}`}`);
      const failed = Object.values(s).some((v) => !v.ok);
      toast(parts.length ? `Offer made · ${parts.join(" · ")}` : "Offer made", failed ? "error" : undefined);
      if (!parts.length) copyText(toast, r.data.link, "Offer link");
      onDone();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  const channelBox = (label, icon, state, set, list, chosen, toLabel, type) => (
    <div className="rounded-lg border">
      <label className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm font-medium text-foreground">
        <input type="checkbox" className="form-check-input m-0" checked={state.enabled} onChange={(e) => set((x) => ({ ...x, enabled: e.target.checked }))} />
        <i className={`bi bi-${icon}`}></i>{label}
      </label>
      {state.enabled && (
        <div className="px-3 pb-3 space-y-2 border-t pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className={labelCls}>{toLabel} *</label><input type={type} className="ui-input w-full" value={state.to} onChange={(e) => set((x) => ({ ...x, to: e.target.value }))} /></div>
            <div><label className={labelCls}>Template</label>
              <select className="ui-input w-full" value={state.templateId} onChange={(e) => pick(set, list, e.target.value)}>
                <option value="">Offer letter (no template)</option>
                {list.map((t) => <option key={t._id} value={t._id}>{t.name}{t.channel === "whatsapp" && !t.approved ? " · not approved" : ""}</option>)}
              </select>
            </div>
          </div>
          {!list.length && !tpl.loading && <div className="text-[11px] text-muted-foreground">No {label.toLowerCase()} templates yet · <Link to={`/crm/setup?active=module-${label === "Email" ? "email" : "whatsapp"}-templates&mode=list`} style={{ color: "var(--primary)" }}>Create in Setup</Link></div>}
          {label === "Email" && <div><label className={labelCls}>Subject</label><input className="ui-input w-full" value={state.subject} onChange={(e) => set((x) => ({ ...x, subject: e.target.value }))} title={chosen?.subject || `Offer of admission · ${app.appNo}`} /></div>}
          <VarRows count={varCount(chosen)} vars={state.vars} setVars={(vars) => set((x) => ({ ...x, vars }))} />
          {chosen && label === "WhatsApp" && !chosen.approved && <div className="text-[11px]" style={{ color: "var(--warning)" }}>Not approved on WhatsApp yet, so it goes as a normal message. It reaches people who messaged you in the last 24 hours.</div>}
        </div>
      )}
    </div>
  );

  return (
    <Modal size="wide" title={`${old.sentAt ? "Send offer again" : "Make offer"} · ${app.name}`} onClose={onClose}
      footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn ui-btn-primary" disabled={busy || !o.text.trim()} onClick={send}><i className="bi bi-send"></i>{busy ? "Sending…" : em.enabled || wa.enabled ? "Make offer & send" : "Make offer"}</button></>}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div><label className={labelCls}>Offer letter *</label><textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={7} value={o.text} onChange={(e) => setO({ ...o, text: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Fee to confirm (₹)</label><input className="ui-input w-full" type="number" min="0" value={o.amount} onChange={(e) => setO({ ...o, amount: e.target.value })} /></div>
            <div><label className={labelCls}>Valid till</label><DateInput className="ui-input w-full" value={o.validTill} onChange={(e) => setO({ ...o, validTill: e.target.value })} /></div>
          </div>
          {channelBox("Email", "envelope", em, setEm, emailTpls, emT, "To", "email")}
          {channelBox("WhatsApp", "whatsapp", wa, setWa, waTpls, waT, "Number", "tel")}
        </div>
        <div>
          <div className="flex items-center justify-between mb-2"><span className={labelCls + " mb-0"}>Preview</span><Tabs value={view} onChange={setView} tabs={[{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }]} /></div>
          {view === "email" ? (
            <div className="rounded-lg border bg-card">
              <div className="px-3 py-2 border-b text-sm"><span className="text-muted-foreground">Subject </span><span className="font-medium text-foreground">{emailPreview.subject}</span></div>
              {/<[a-z][\s\S]*>/i.test(emailPreview.body) ? <div className="p-3 text-sm" dangerouslySetInnerHTML={{ __html: emailPreview.body }} /> : <div className="p-3 text-sm text-foreground whitespace-pre-wrap">{emailPreview.body}</div>}
            </div>
          ) : (
            <div className="rounded-lg p-3" style={{ background: "#e5ddd5" }}>
              <div className="rounded-lg bg-white p-3 text-sm whitespace-pre-wrap ms-auto" style={{ maxWidth: 340, color: "#111827" }}>{waPreview}</div>
            </div>
          )}
          {Number(o.amount) > 0 && <div className="text-[11px] text-muted-foreground mt-2">{money(o.amount)} is added to the lead's fees. The payment link goes in the message.</div>}
        </div>
      </div>
    </Modal>
  );
}

/* ───────────── one application ───────────── */
function ApplicationDrawer({ id, onClose, onChanged }) {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("leads", "edit");
  const a = useApi(() => crmApi.application(id), [id]);
  const [stage, setStage] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState(false);
  const d = a.data;
  useEffect(() => { if (d) setStage(d.stage); }, [d?.stage]); // eslint-disable-line react-hooks/exhaustive-deps

  async function move() {
    setBusy(true);
    try { await crmApi.setApplicationStage(id, stage, note); toast(stage === d.stage ? "Note added" : `${d.name} → ${stage}`); setNote(""); a.reload(); onChanged(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  async function openDoc(doc) {
    try { const blob = await crmApi.documentFile(idOf(d.lead), doc._id); const url = URL.createObjectURL(blob); window.open(url, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    catch (e) { toast(e.message, "error"); }
  }

  return (
    <Modal size="wide" title={d ? <span className="flex items-center gap-2"><span className="font-mono">{d.appNo}</span><Chip color={tone(d.stage)}>{d.stage}</Chip></span> : "Application"} onClose={onClose}
      footer={d && <>
        <button type="button" className="ui-btn ui-btn-outline me-auto" onClick={() => copyText(toast, d.link, "Applicant link")}><i className="bi bi-link-45deg"></i>Applicant link</button>
        {canEdit && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setOffer(true)}><i className="bi bi-envelope-paper"></i>{d.offer?.sentAt ? "Send offer again" : "Make offer"}</button>}
      </>}>
      {a.loading && !d ? <Spinner /> : !d ? <ErrorBox error={a.error} /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-lg font-semibold text-foreground">{d.name}</div>
              <div className="text-xs text-muted-foreground">{[d.phone, d.leadInfo?.email || d.email, d.course].filter(Boolean).join(" · ")}</div>
              <div className="text-xs text-muted-foreground">Applied {formatDateTime(d.createdAt)}{d.leadInfo?.owner ? ` · ${d.leadInfo.owner}` : ""}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {d.phone && <a className="ui-btn ui-btn-outline ui-btn-sm" href={telLink(d.phone)}><i className="bi bi-telephone"></i>Call</a>}
              {d.phone && <a className="ui-btn ui-btn-outline ui-btn-sm" target="_blank" rel="noreferrer" href={`${waLink(d.phone)}?text=${encodeURIComponent(`Hi ${d.name.split(" ")[0]}, about your application ${d.appNo}: ${d.link}`)}`}><i className="bi bi-whatsapp"></i>WhatsApp</a>}
              {d.lead && can("leads", "view") && <Link className="ui-btn ui-btn-outline ui-btn-sm" to={`/crm/leads?lead=${idOf(d.lead)}`}><i className="bi bi-person"></i>Lead</Link>}
              {d.formLink && <Link className="ui-btn ui-btn-outline ui-btn-sm" to={d.formLink}><i className="bi bi-ui-checks"></i>Form</Link>}
            </div>
          </div>

          {canEdit && (
            <Panel title="Stage">
              <div className="flex flex-wrap gap-2">
                <select className="ui-input" style={{ width: 200 }} aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)}>{[...new Set([d.stage, ...d.stages])].map((s) => <option key={s}>{s}</option>)}</select>
                <input className="ui-input flex-1" style={{ minWidth: 180 }} aria-label="Note" title="Note" value={note} onChange={(e) => setNote(e.target.value)} />
                <button type="button" className="ui-btn ui-btn-primary" disabled={busy || (stage === d.stage && !note.trim())} onClick={move}>{stage === d.stage ? "Add note" : "Move"}</button>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto mt-3">
                {d.stages.map((s, i) => {
                  const at = d.stages.indexOf(d.stage);
                  const done = i <= at && !/reject/i.test(d.stage);
                  return <div key={s} className="flex-1 min-w-[70px]"><div className="h-1.5 rounded-full" style={{ background: done ? tone(d.stage) : "var(--border)" }} /><div className="text-[10px] mt-1 truncate" style={{ color: s === d.stage ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: s === d.stage ? 600 : 400 }}>{s}</div></div>;
                })}
              </div>
            </Panel>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Panel title="Offer">
              {d.offer?.sentAt ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex flex-wrap gap-1.5">{d.offer.response ? <Chip color={OFFER[d.offer.response]?.color}>{OFFER[d.offer.response]?.label}</Chip> : <Chip color="var(--info)">Waiting for reply</Chip>}{d.offer.amount > 0 && <Chip icon="currency-rupee">{money(d.offer.amount)}</Chip>}{d.offer.validTill && <Chip icon="calendar-event">till {formatDate(d.offer.validTill)}</Chip>}</div>
                  <div className="text-foreground whitespace-pre-line line-clamp-4">{d.offer.text}</div>
                  <div className="text-[11px] text-muted-foreground">Sent {formatDateTime(d.offer.sentAt)}{d.offer.respondedAt ? ` · replied ${formatDateTime(d.offer.respondedAt)}` : ""}</div>
                </div>
              ) : <div className="text-sm text-muted-foreground text-center py-3">No offer yet</div>}
            </Panel>
            <Panel title="Fees">
              {!d.fees.length ? <div className="text-sm text-muted-foreground text-center py-3">No fees</div> : d.fees.map((f) => (
                <div key={f._id} className="flex items-center gap-2 py-1.5 border-t first:border-t-0 text-sm">
                  <div className="min-w-0 flex-1"><div className="text-foreground truncate">{f.title}</div><div className="text-[11px] text-muted-foreground">{money(f.amount - f.discount)}{f.paid ? ` · paid ${money(f.paid)}` : ""}{f.dueDate ? ` · due ${formatDate(f.dueDate)}` : ""}</div></div>
                  <Chip color={f.status === "paid" ? "var(--success)" : f.status === "cancelled" ? "var(--muted-foreground)" : "var(--warning)"}>{f.status === "paid" ? "Paid" : f.status === "cancelled" ? "Cancelled" : `Due ${money(f.balance)}`}</Chip>
                  {f.status === "pending" && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Copy payment link" onClick={() => copyText(toast, f.link, "Payment link")}><i className="bi bi-link-45deg"></i></button>}
                </div>
              ))}
            </Panel>
          </div>

          {d.answers.length > 0 && (
            <Panel title="Application" bodyClass="p-0">
              <dl className="divide-y m-0">{d.answers.map((x, i) => <div key={i} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 px-3 py-2"><dt className="text-xs text-muted-foreground">{x.label}</dt><dd className="text-sm text-foreground m-0 break-words whitespace-pre-line">{x.value}</dd></div>)}</dl>
            </Panel>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Panel title={`Documents (${d.documents.length})`}>
              {!d.documents.length ? <div className="text-sm text-muted-foreground text-center py-3">No documents</div> : d.documents.map((doc) => (
                <button key={doc._id} type="button" className="w-full flex items-center gap-2 py-1.5 border-t first:border-t-0 text-sm text-left bg-transparent border-x-0 border-b-0" onClick={() => openDoc(doc)}>
                  <i className={`bi bi-${/image/.test(doc.mime) ? "image" : "file-earmark-text"} text-muted-foreground`}></i>
                  <span className="truncate flex-1 text-foreground hover:underline">{doc.name}</span>
                  <span className="text-[11px] text-muted-foreground">{formatDate(doc.createdAt)}</span>
                </button>
              ))}
            </Panel>
            <Panel title="History">
              {[...(d.stageHistory || [])].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-t first:border-t-0">
                  <span className="h-2 w-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: tone(h.stage) }} />
                  <div><div className="text-sm text-foreground">{h.stage}{h.note ? <span className="text-muted-foreground"> · {h.note}</span> : ""}</div><div className="text-[11px] text-muted-foreground">{h.by} · {formatDateTime(h.at)}</div></div>
                </div>
              ))}
            </Panel>
          </div>
        </div>
      )}
      {offer && d && <OfferModal app={d} detail={d} onClose={() => setOffer(false)} onDone={() => { setOffer(false); a.reload(); onChanged(); }} />}
    </Modal>
  );
}

/* ───────────── all applications ───────────── */
export default function Applications() {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("leads", "edit");
  const [sp, setSp] = useSearchParams();
  const [stage, setStage] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [f, setF] = useState({ course: "", owner: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(() => sp.get("app") || null);
  const [offerFor, setOfferFor] = useState(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const params = useMemo(() => ({ stage, q: term, ...f }), [stage, term, f]);
  const apps = useApi(() => crmApi.applications({ ...params, page }), [params, page]);
  const meta = useApi(() => leadsApi.meta().catch(() => ({ data: {} })), []);
  const d = apps.data || { stages: [], counts: {}, items: [], total: 0, pages: 1, courses: [] };
  const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
  const setFilter = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const filtered = term || f.course || f.owner || f.from || f.to;
  const close = () => { setOpen(null); if (sp.get("app")) { sp.delete("app"); setSp(sp, { replace: true }); } };

  async function exportAll() {
    setExporting(true);
    try {
      const all = (await crmApi.applications({ ...params, perPage: 200 })).data.items || [];
      await exportExcel(all.map((a) => ({ "Application no": a.appNo, Name: a.name, Phone: a.phone, Email: a.email, Course: a.course, Stage: a.stage, Owner: a.lead?.owner || "", Applied: formatDate(a.createdAt), "Offer sent": a.offer?.sentAt ? formatDate(a.offer.sentAt) : "", "Offer reply": a.offer?.response || "", Fee: a.fee?.amount || "", "Fee paid": a.fee ? (a.fee.paid ? "Yes" : "No") : "" })), "applications");
    } catch (e) { toast(e.message, "error"); }
    finally { setExporting(false); }
  }

  const offerChip = (a) => (a.offer?.response ? <Chip color={OFFER[a.offer.response]?.color}>{OFFER[a.offer.response]?.label}</Chip> : a.offer?.sentAt ? <Chip color="var(--info)">Offer sent</Chip> : null);
  const feeChip = (a) => (a.fee ? <Chip color={a.fee.paid ? "var(--success)" : "var(--warning)"}>{a.fee.paid ? "Paid" : `Due ${money(a.fee.balance)}`}</Chip> : null);

  return (
    <div>
      <PageHeader title="Applications" actions={<button type="button" className="ui-btn ui-btn-outline" disabled={exporting || !d.total} onClick={exportAll}><i className="bi bi-file-earmark-excel"></i>Export Excel</button>} />
      <Tabs value={stage} onChange={(v) => { setStage(v); setPage(1); }} tabs={[{ value: "", label: "All", count: total }, ...d.stages.map((s) => ({ value: s, label: s, count: d.counts[s] || 0 }))]} />
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SearchBox value={q} onChange={setQ} />
        <select className="ui-input min-w-[140px]" style={{ width: "auto" }} aria-label="Course" value={f.course} onChange={(e) => setFilter("course", e.target.value)}><option value="">All courses</option>{(d.courses || []).map((c) => <option key={c}>{c}</option>)}</select>
        <select className="ui-input min-w-[130px]" style={{ width: "auto" }} aria-label="Owner" value={f.owner} onChange={(e) => setFilter("owner", e.target.value)}><option value="">Anyone</option><option value="me">Me</option>{(meta.data?.owners || []).map((o) => <option key={o}>{o}</option>)}</select>
        <DateInput className="ui-input" style={{ width: 140 }} title="From" value={f.from} onChange={(e) => setFilter("from", e.target.value)} />
        <DateInput className="ui-input" style={{ width: 140 }} title="To" value={f.to} onChange={(e) => setFilter("to", e.target.value)} />
        <FilterSummary onClear={filtered ? () => { setQ(""); setF({ course: "", owner: "", from: "", to: "" }); setPage(1); } : undefined} text={apps.loading ? "Loading…" : `${num.format(d.total)} application${d.total === 1 ? "" : "s"}`} />
      </div>
      <ErrorBox error={apps.error} />

      {/* phones */}
      <div className="md:hidden space-y-2">
        {apps.loading && !apps.data ? <Spinner /> : !d.items.length ? <div className="rounded-xl border bg-card"><EmptyState icon="clipboard-check" text="No applications" /></div> : d.items.map((a) => (
          <button key={a._id} type="button" className="w-full text-left rounded-xl border bg-card p-3" onClick={() => setOpen(a._id)}>
            <div className="flex items-center gap-2"><span className="text-sm font-semibold text-foreground truncate flex-1">{a.name}</span><Chip color={tone(a.stage)}>{a.stage}</Chip></div>
            <div className="text-xs text-muted-foreground mt-0.5"><span className="font-mono">{a.appNo}</span>{a.course ? ` · ${a.course}` : ""}</div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">{offerChip(a)}{feeChip(a)}<span className="text-[11px] text-muted-foreground ms-auto">{formatDate(a.createdAt)}</span></div>
          </button>
        ))}
      </div>
      {/* tablets and up */}
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
              {["Application no", "Applicant", "Course", "Stage", "Offer & fee", "Owner", "Applied", ""].map((h, i) => <th key={i} className={"px-3 py-3 font-medium whitespace-nowrap " + (i === 7 ? "text-right" : "text-left")}>{h}</th>)}
            </tr></thead>
            <tbody>
              {apps.loading && !apps.data ? <tr><td colSpan={99}><Spinner /></td></tr> : !d.items.length ? <tr><td colSpan={99}><EmptyState icon="clipboard-check" text="No applications" /></td></tr> : d.items.map((a) => (
                <tr key={a._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setOpen(a._id)}>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{a.appNo}</td>
                  <td className="px-3 py-2.5"><div className="font-medium text-foreground truncate" style={{ maxWidth: 220 }}>{a.name}</div><div className="text-[11px] text-muted-foreground">{a.phone}</div></td>
                  <td className="px-3 py-2.5">{a.course || "—"}</td>
                  <td className="px-3 py-2.5"><Chip color={tone(a.stage)}>{a.stage}</Chip></td>
                  <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{offerChip(a)}{feeChip(a)}{!a.offer?.sentAt && !a.fee && <span className="text-muted-foreground">—</span>}</div></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{a.lead?.owner || "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{formatDate(a.createdAt)}</td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-end">
                      {a.link && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Copy applicant link" onClick={() => copyText(toast, a.link, "Applicant link")}><i className="bi bi-link-45deg"></i></button>}
                      {canEdit && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setOfferFor(a)}><i className="bi bi-envelope-paper"></i>{a.offer?.sentAt ? "Resend" : "Offer"}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-2">
        <span>{num.format(d.total)} application{d.total === 1 ? "" : "s"}</span>
        <span className="inline-flex items-center gap-2">
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} title="Previous"><i className="bi bi-chevron-left"></i></button>
          {page} / {d.pages}
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" disabled={page >= d.pages} onClick={() => setPage((p) => p + 1)} title="Next"><i className="bi bi-chevron-right"></i></button>
        </span>
      </div>

      {open && <ApplicationDrawer id={open} onClose={close} onChanged={apps.reload} />}
      {offerFor && <OfferModal app={offerFor} onClose={() => setOfferFor(null)} onDone={() => { setOfferFor(null); apps.reload(); }} />}
    </div>
  );
}
