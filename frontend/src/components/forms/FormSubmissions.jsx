import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formsApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Spinner, ErrorBox, EmptyState, Chip, Modal, Confirm, StatCard, Panel, SearchBox, Tabs, FilterSummary } from "../ui";
import DateInput from "../DateInput";
import { formatDate, formatDateTime } from "../../utils/dateFormat";
import { money, labelCls, waLink, idOf } from "../lead/leadUtils";
import { SUB_STATUS } from "./fieldTypes";

const num = new Intl.NumberFormat("en-IN");
const show = (v) => (Array.isArray(v) ? v.join(", ") : v === true ? "Yes" : v === false ? "No" : v ?? "");

async function exportExcel(rows, name) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Submissions");
  XLSX.writeFile(wb, `${name}.xlsx`);
}

function openBlob(blob, name, download) {
  const url = URL.createObjectURL(blob);
  if (download) { const a = document.createElement("a"); a.href = url; a.download = name; a.click(); }
  else window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ───────────── one submission ───────────── */
function SubmissionDrawer({ id, onClose, onChanged }) {
  const toast = useToast();
  const { can } = useAuth();
  const s = useApi(() => formsApi.submission(id), [id]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const d = s.data;

  async function save(body, msg) {
    setBusy(true);
    try { await formsApi.updateSubmission(id, body); toast(msg); setNote(""); s.reload(); onChanged(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  async function file(x, download) {
    try { openBlob(await formsApi.file(id, x._id), x.name, download); } catch (e) { toast(e.message, "error"); }
  }
  async function remove() {
    setBusy(true);
    try { await formsApi.removeSubmission(id); toast("Submission deleted"); onChanged(); onClose(); }
    catch (e) { toast(e.message, "error"); setBusy(false); }
  }
  const copy = (t, what) => navigator.clipboard?.writeText(t).then(() => toast(`${what} copied`));

  return (
    <Modal size="wide" title={d ? <span className="flex items-center gap-2">{d.refNo || "Draft"}<Chip color={SUB_STATUS[d.status]?.color}>{SUB_STATUS[d.status]?.label}</Chip></span> : "Submission"} onClose={onClose}
      footer={d && <>
        {can("leads", "del") && <button type="button" className="ui-btn ui-btn-outline me-auto" onClick={() => setDel(true)}><i className="bi bi-trash"></i>Delete</button>}
        {d.status !== "draft" && can("leads", "edit") && (
          <select className="ui-input" style={{ width: "auto" }} value={d.status} disabled={busy} aria-label="Status" onChange={(e) => save({ status: e.target.value }, `Marked ${SUB_STATUS[e.target.value].label}`)}>
            {["new", "review", "accepted", "rejected"].map((k) => <option key={k} value={k}>{SUB_STATUS[k].label}</option>)}
          </select>
        )}
        <button type="button" className="ui-btn ui-btn-primary" onClick={onClose}>Done</button>
      </>}>
      {s.loading && !d ? <Spinner /> : !d ? <ErrorBox error={s.error} /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-lg border p-2.5"><div className="text-[11px] text-muted-foreground">Submitted</div><div className="text-sm font-medium text-foreground">{d.submittedAt ? formatDateTime(d.submittedAt) : `Saved ${formatDateTime(d.updatedAt)}`}</div><div className="text-[11px] text-muted-foreground">{d.meta?.via}{d.meta?.utm?.source ? ` · ${d.meta.utm.source}` : ""}{d.meta?.utm?.campaign ? ` / ${d.meta.utm.campaign}` : ""}</div></div>
            <div className="rounded-lg border p-2.5">
              <div className="text-[11px] text-muted-foreground">Lead</div>
              {d.leadInfo ? <Link to={`/crm/leads?lead=${idOf(d.leadInfo)}`} className="text-sm font-medium text-foreground hover:underline">{d.leadInfo.name}</Link> : <div className="text-sm text-muted-foreground">—</div>}
              <div className="text-[11px] text-muted-foreground">{d.leadInfo?.owner || ""}</div>
            </div>
            <div className="rounded-lg border p-2.5">
              <div className="text-[11px] text-muted-foreground">{d.feeInfo ? "Fee" : "Payment"}</div>
              {d.feeInfo ? (
                <div className="flex items-center gap-2"><span className="text-sm font-medium text-foreground">{money(d.feeInfo.amount - (d.feeInfo.discount || 0))}</span>{d.paid ? <Chip color="var(--success)">Paid</Chip> : <Chip color="var(--warning)">Due {money(d.feeInfo.balance)}</Chip>}</div>
              ) : <div className="text-sm text-muted-foreground">—</div>}
              {d.feeInfo && !d.paid && <button type="button" className="text-[11px] p-0 border-0 bg-transparent" style={{ color: "var(--primary)" }} onClick={() => copy(d.feeInfo.link, "Payment link")}>Copy pay link</button>}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {d.phone && <a className="ui-btn ui-btn-outline ui-btn-sm" href={`tel:${d.phone}`}><i className="bi bi-telephone"></i>Call</a>}
            {d.phone && <a className="ui-btn ui-btn-outline ui-btn-sm" target="_blank" rel="noreferrer" href={`${waLink(d.phone)}?text=${encodeURIComponent(`Hi ${(d.name || "").split(" ")[0]}, about your ${d.formName} ${d.refNo}`)}`}><i className="bi bi-whatsapp"></i>WhatsApp</a>}
            {d.email && <a className="ui-btn ui-btn-outline ui-btn-sm" href={`mailto:${d.email}?subject=${encodeURIComponent(`${d.formName} ${d.refNo}`)}`}><i className="bi bi-envelope"></i>Email</a>}
            {d.status !== "draft" && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => copy(d.receiptLink, "Receipt link")}><i className="bi bi-receipt"></i>Receipt link</button>}
            {d.resumeLink && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => copy(d.resumeLink, "Resume link")}><i className="bi bi-arrow-repeat"></i>Resume link</button>}
            {d.application && <Link className="ui-btn ui-btn-outline ui-btn-sm" to={`/crm/applications`}><i className="bi bi-clipboard-check"></i>{d.application.stage}</Link>}
          </div>

          <Panel title="Answers" bodyClass="p-0">
            <dl className="divide-y m-0">
              {(d.pages || []).map((p) => (
                <div key={p.id}>
                  {(d.pages || []).length > 1 && <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>{p.title}</div>}
                  {p.fields.filter((f) => f.type !== "heading").map((f) => {
                    const files = (d.files || []).filter((x) => x.field === f.id);
                    const v = d.data?.[f.id];
                    if (!files.length && (v === undefined || v === "" || (Array.isArray(v) && !v.length))) return null;
                    return (
                      <div key={f.id} className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 px-3 py-2">
                        <dt className="text-xs text-muted-foreground">{f.label}</dt>
                        <dd className="text-sm text-foreground m-0 break-words whitespace-pre-line">
                          {files.length ? files.map((x) => (
                            <span key={x._id} className="inline-flex items-center gap-1 me-3">
                              <button type="button" className="p-0 border-0 bg-transparent hover:underline" style={{ color: "var(--primary)" }} onClick={() => file(x)}><i className="bi bi-paperclip"></i>{x.name}</button>
                              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Download" onClick={() => file(x, true)}><i className="bi bi-download"></i></button>
                            </span>
                          )) : f.type === "rating" ? <span>{"★".repeat(Number(v))}<span className="text-muted-foreground">{"★".repeat(Math.max(0, (f.max || 5) - Number(v)))}</span></span> : show(v)}
                        </dd>
                      </div>
                    );
                  })}
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Notes">
            {can("leads", "edit") && d.status !== "draft" && (
              <div className="flex gap-2 mb-2">
                <input className="ui-input flex-1" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) save({ note }, "Note added"); }} />
                <button type="button" className="ui-btn ui-btn-primary" disabled={!note.trim() || busy} onClick={() => save({ note }, "Note added")}>Add</button>
              </div>
            )}
            {[...(d.notes || [])].reverse().map((n, i) => <div key={i} className="text-sm border-t py-1.5"><div className="text-foreground whitespace-pre-line">{n.text}</div><div className="text-[11px] text-muted-foreground">{n.by} · {formatDateTime(n.at)}</div></div>)}
            {[...(d.history || [])].reverse().map((h, i) => <div key={`h${i}`} className="text-[11px] text-muted-foreground border-t py-1">{SUB_STATUS[h.status]?.label || h.status} · {h.by} · {formatDateTime(h.at)}</div>)}
          </Panel>
        </div>
      )}
      {del && <Confirm title="Delete this submission?" text="The lead and its documents stay." danger confirmLabel="Delete" busy={busy} onConfirm={remove} onCancel={() => setDel(false)} />}
    </Modal>
  );
}

/* ───────────── the list ───────────── */
export function Submissions({ form, openId, onOpen }) {
  const toast = useToast();
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const [paid, setPaid] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const params = useMemo(() => ({ status, paid, from, to, q: term }), [status, paid, from, to, term]);
  const list = useApi(() => formsApi.submissions(form._id, { ...params, page, perPage: 50 }), [form._id, params, page]);
  const rows = list.data || [];
  const counts = list.raw?.counts || {};
  const total = list.raw?.total || 0;
  const pages = list.raw?.pages || 1;
  useEffect(() => setPicked([]), [params, page]);

  const fields = form.pages.flatMap((p) => p.fields).filter((f) => !["heading", "file", "signature", "consent"].includes(f.type));
  const extra = fields.filter((f) => !["name", "phone", "email"].includes(f.map)).slice(0, 3);
  const hasFee = !!form.settings?.fee?.enabled;

  async function exportAll() {
    setBusy(true);
    try {
      const all = [];
      for (let p = 1; p <= 50; p++) { const res = await formsApi.submissions(form._id, { ...params, page: p, perPage: 200 }); all.push(...res.data); if (p >= res.pages) break; }
      const allFields = form.pages.flatMap((p) => p.fields).filter((f) => f.type !== "heading");
      await exportExcel(all.map((x) => ({
        "Ref no": x.refNo, Status: SUB_STATUS[x.status]?.label, Submitted: x.submittedAt ? formatDateTime(x.submittedAt) : "",
        ...Object.fromEntries(allFields.map((f) => [f.label, f.type === "file" ? (x.files || []).filter((y) => y.field === f.id).map((y) => y.name).join(", ") : show(x.data?.[f.id])])),
        ...(hasFee ? { Fee: x.amount || "", Paid: x.paid ? "Yes" : "No" } : {}), Source: x.meta?.utm?.source || "", Campaign: x.meta?.utm?.campaign || "", Via: x.meta?.via || "",
      })), `${form.name.replace(/[^\w\- ]+/g, "")} submissions`);
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  async function bulk(action) {
    setBusy(true);
    try { const r = await formsApi.bulk(picked, action); toast(action === "delete" ? `${r.data.deleted} deleted` : `${r.data.updated} marked ${SUB_STATUS[action].label}`); setPicked([]); list.reload(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); setAskDelete(false); }
  }
  const allOn = rows.length > 0 && picked.length === rows.length;

  return (
    <div>
      <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[
        { value: "", label: "All", count: Object.entries(counts).filter(([k]) => k !== "draft").reduce((a, [, v]) => a + v, 0) },
        ...["new", "review", "accepted", "rejected", ...(form.settings?.allowDraft ? ["draft"] : [])].map((k) => ({ value: k, label: k === "draft" ? "Unfinished" : SUB_STATUS[k].label, count: counts[k] || 0 })),
      ]} />
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SearchBox value={q} onChange={setQ} />
        {hasFee && <select className="ui-input" style={{ width: "auto" }} aria-label="Payment" value={paid} onChange={(e) => { setPaid(e.target.value); setPage(1); }}><option value="">Any payment</option><option value="1">Paid</option><option value="0">Not paid</option></select>}
        <DateInput className="ui-input" style={{ width: 140 }} title="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <DateInput className="ui-input" style={{ width: 140 }} title="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <button type="button" className="ui-btn ui-btn-outline" disabled={busy || !total} onClick={exportAll}><i className="bi bi-file-earmark-excel"></i>Export Excel</button>
        <FilterSummary onClear={q || paid || from || to ? () => { setQ(""); setPaid(""); setFrom(""); setTo(""); setPage(1); } : undefined} text={list.loading ? "Loading…" : `${num.format(total)} submission${total === 1 ? "" : "s"}`} />
      </div>

      {picked.length > 0 && can("leads", "edit") && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 mb-2" style={{ background: "color-mix(in srgb, var(--primary) 6%, transparent)" }}>
          <span className="text-sm font-medium text-foreground">{picked.length} selected</span>
          {["review", "accepted", "rejected"].map((k) => <button key={k} type="button" className="ui-btn ui-btn-outline ui-btn-sm" disabled={busy} onClick={() => bulk(k)}>{SUB_STATUS[k].label}</button>)}
          {can("leads", "del") && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" disabled={busy} onClick={() => setAskDelete(true)}><i className="bi bi-trash"></i>Delete</button>}
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ms-auto" onClick={() => setPicked([])}>Clear</button>
        </div>
      )}
      <ErrorBox error={list.error} />

      {/* phones */}
      <div className="md:hidden space-y-2">
        {list.loading && !rows.length ? <Spinner /> : !rows.length ? <div className="rounded-xl border bg-card"><EmptyState icon="inbox" text="No submissions" /></div> : rows.map((x) => (
          <button key={x._id} type="button" className="w-full text-left rounded-xl border bg-card p-3" onClick={() => onOpen(x._id)}>
            <div className="flex items-center gap-2"><span className="text-sm font-semibold text-foreground truncate flex-1">{x.name || x.refNo || "Unnamed"}</span><Chip color={SUB_STATUS[x.status]?.color}>{SUB_STATUS[x.status]?.label}</Chip></div>
            <div className="text-xs text-muted-foreground mt-0.5">{x.refNo}{x.phone ? ` · ${x.phone}` : ""}</div>
            <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground"><span>{formatDateTime(x.submittedAt || x.updatedAt)}</span>{x.amount > 0 && <Chip color={x.paid ? "var(--success)" : "var(--warning)"}>{x.paid ? "Paid" : "Unpaid"} {money(x.amount)}</Chip>}</div>
          </button>
        ))}
      </div>
      {/* tablets and up */}
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
              <th className="px-3 py-3 w-8"><input type="checkbox" className="form-check-input m-0" aria-label="Select all" checked={allOn} onChange={(e) => setPicked(e.target.checked ? rows.map((x) => x._id) : [])} /></th>
              <th className="px-3 py-3 text-left font-medium">Ref no</th><th className="px-3 py-3 text-left font-medium">Name</th>
              {extra.map((f) => <th key={f.id} className="px-3 py-3 text-left font-medium whitespace-nowrap" style={{ maxWidth: 160 }}>{f.label}</th>)}
              {hasFee && <th className="px-3 py-3 text-left font-medium">Payment</th>}
              <th className="px-3 py-3 text-left font-medium">Status</th><th className="px-3 py-3 text-left font-medium">Submitted</th>
            </tr></thead>
            <tbody>
              {list.loading && !rows.length ? <tr><td colSpan={99}><Spinner /></td></tr> : !rows.length ? <tr><td colSpan={99}><EmptyState icon="inbox" text="No submissions" /></td></tr> : rows.map((x) => (
                <tr key={x._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => onOpen(x._id)} style={x.status === "new" ? { fontWeight: 500 } : undefined}>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="form-check-input m-0" aria-label="Select" checked={picked.includes(x._id)} onChange={(e) => setPicked(e.target.checked ? [...picked, x._id] : picked.filter((y) => y !== x._id))} /></td>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{x.refNo || "—"}</td>
                  <td className="px-3 py-2.5"><div className="text-foreground truncate" style={{ maxWidth: 200 }}>{x.name || "—"}</div><div className="text-[11px] text-muted-foreground">{x.phone}</div></td>
                  {extra.map((f) => <td key={f.id} className="px-3 py-2.5"><div className="truncate" style={{ maxWidth: 160 }}>{show(x.data?.[f.id]) || "—"}</div></td>)}
                  {hasFee && <td className="px-3 py-2.5">{x.amount > 0 ? <Chip color={x.paid ? "var(--success)" : "var(--warning)"}>{x.paid ? "Paid" : "Unpaid"} · {money(x.amount)}</Chip> : "—"}</td>}
                  <td className="px-3 py-2.5"><Chip color={SUB_STATUS[x.status]?.color}>{SUB_STATUS[x.status]?.label}</Chip></td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(x.submittedAt || x.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-2 text-xs text-muted-foreground">
        <span>{num.format(total)} submission{total === 1 ? "" : "s"}</span>
        <span className="inline-flex items-center gap-2">
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Previous" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><i className="bi bi-chevron-left"></i></button>
          {page} / {pages}
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Next" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}><i className="bi bi-chevron-right"></i></button>
        </span>
      </div>
      {openId && <SubmissionDrawer id={openId} onClose={() => onOpen(null)} onChanged={list.reload} />}
      {askDelete && <Confirm title={`Delete ${picked.length} submission${picked.length === 1 ? "" : "s"}?`} text="Leads made from them stay." danger confirmLabel="Delete" busy={busy} onConfirm={() => bulk("delete")} onCancel={() => setAskDelete(false)} />}
    </div>
  );
}

/* ───────────── analytics ───────────── */
export function Analytics({ form }) {
  const [days, setDays] = useState(30);
  const a = useApi(() => formsApi.analytics(form._id, { days }), [form._id, days]);
  const d = a.data;
  if (a.loading && !d) return <Spinner />;
  if (!d) return <ErrorBox error={a.error} />;
  const peak = Math.max(1, ...d.series.map((x) => x.n));
  const srcMax = Math.max(1, ...d.sources.map((x) => x.n));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Views" value={num.format(d.views)} icon="eye" tone="info" />
        <StatCard label="Started" value={num.format(d.starts)} icon="pencil" tone="warning" />
        <StatCard label="Submitted" value={num.format(d.submissions)} icon="send-check" tone="success" />
        <StatCard label="Conversion" value={`${d.conversion}%`} icon="graph-up-arrow" hint="Submitted ÷ views" />
        <StatCard label="Leads" value={num.format(d.leads)} icon="person-plus" />
        {form.settings?.fee?.enabled ? <StatCard label="Collected" value={money(d.collected)} icon="currency-rupee" tone="success" hint={`${d.paid} paid`} /> : <StatCard label="Unfinished" value={num.format(d.drafts)} icon="bookmark" />}
      </div>
      <Panel title="Submissions per day" actions={<select className="ui-input ui-input-sm" style={{ width: "auto", height: 28 }} aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select>}>
        <div className="flex items-end gap-[2px]" style={{ height: 160 }}>
          {d.series.map((x) => (
            <div key={x.date} className="flex-1 h-full flex flex-col justify-end group relative" title={`${formatDate(x.date)} · ${x.n}`}>
              <div className="rounded-t-sm" style={{ height: `${(x.n / peak) * 100}%`, minHeight: x.n ? 3 : 1, background: x.n ? "var(--primary)" : "var(--border)" }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground mt-1"><span>{formatDate(d.series[0]?.date)}</span><span>Peak {peak}</span><span>{formatDate(d.series[d.series.length - 1]?.date)}</span></div>
      </Panel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="Sources">
          {!d.sources.length ? <div className="text-sm text-muted-foreground py-4 text-center">No submissions</div> : d.sources.map((s) => (
            <div key={s.source} className="py-1.5">
              <div className="flex justify-between text-sm"><span className="text-foreground truncate">{s.source}</span><span className="text-muted-foreground">{s.n}</span></div>
              <div className="h-1.5 rounded-full mt-1" style={{ background: "var(--muted-background, var(--muted))" }}><div className="h-full rounded-full" style={{ width: `${(s.n / srcMax) * 100}%`, background: "var(--primary)" }} /></div>
            </div>
          ))}
        </Panel>
        <Panel title="Where unfinished forms stopped">
          {d.dropOff.every((x) => !x.left) ? <div className="text-sm text-muted-foreground py-4 text-center">None</div> : d.dropOff.map((x, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1.5 border-t first:border-t-0"><span className="text-foreground">{i + 1}. {x.page}</span><Chip color={x.left ? "var(--warning)" : "var(--muted-foreground)"}>{x.left}</Chip></div>
          ))}
          <div className="text-[11px] text-muted-foreground mt-2">Completion {d.completion}% of people who started</div>
        </Panel>
      </div>
    </div>
  );
}
