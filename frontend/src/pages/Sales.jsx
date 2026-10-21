import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { salesApi, leadsApi, crmApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Chip, Modal, Confirm, Tabs, StatCard, Panel, SearchBox, FilterSummary } from "../components/ui";
import DateInput from "../components/DateInput";
import { formatDate, formatDateTime } from "../utils/dateFormat";
import { labelCls, money, compactMoney, idOf, timeAgo, waLink } from "../components/lead/leadUtils";
import LineItems, { Totals, sumLines } from "../components/sales/LineItems";

const num = new Intl.NumberFormat("en-IN");
const PRIORITY = { high: { label: "High", color: "var(--destructive)" }, medium: { label: "Medium", color: "var(--warning)" }, low: { label: "Low", color: "var(--muted-foreground)" } };
const QUOTE_STATUS = { draft: { label: "Draft", color: "var(--muted-foreground)" }, sent: { label: "Sent", color: "var(--info)" }, accepted: { label: "Accepted", color: "var(--success)" }, rejected: { label: "Rejected", color: "var(--destructive)" }, expired: { label: "Expired", color: "var(--warning)" } };
const iso = (d) => (d ? String(d).slice(0, 10) : "");

async function exportExcel(rows, name) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Sheet1");
  XLSX.writeFile(wb, `${name}.xlsx`);
}
function Pager({ page, pages, total, unit, onPage }) {
  return (
    <div className="flex items-center justify-between gap-2 mt-2 text-xs text-muted-foreground">
      <span>{num.format(total)} {unit}{total === 1 ? "" : "s"}</span>
      <span className="inline-flex items-center gap-2">
        <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Previous" disabled={page <= 1} onClick={() => onPage(page - 1)}><i className="bi bi-chevron-left"></i></button>
        {page} / {pages}
        <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Next" disabled={page >= pages} onClick={() => onPage(page + 1)}><i className="bi bi-chevron-right"></i></button>
      </span>
    </div>
  );
}
const useSearch = () => { const [q, setQ] = useState(""); const [term, setTerm] = useState(""); useEffect(() => { const t = setTimeout(() => setTerm(q), 300); return () => clearTimeout(t); }, [q]); return [q, setQ, term]; };
const useOwners = () => { const m = useApi(() => leadsApi.meta().catch(() => ({ data: {} })), []); return m.data?.owners || []; };
const useCompanies = (dep) => useApi(() => salesApi.companies({ perPage: 200 }), [dep]).data || [];
const useProducts = () => useApi(() => salesApi.products({ active: "1" }), []).data || [];
const Th = ({ children, right }) => <th className={`px-3 py-3 font-medium whitespace-nowrap ${right ? "text-right" : "text-left"}`}>{children}</th>;
const thead = "text-[11px] uppercase tracking-wider text-muted-foreground";

/* ═════════════ deal stages ═════════════ */
function StagesModal({ onClose, onChanged }) {
  const toast = useToast();
  const st = useApi(() => salesApi.stages(), []);
  const [rows, setRows] = useState([]);
  const [add, setAdd] = useState({ name: "", probability: 50, kind: "open", color: "#6366f1" });
  useEffect(() => { if (st.data) setRows(st.data); }, [st.data]);
  const run = async (fn, msg) => { try { await fn(); toast(msg); st.reload(); onChanged(); } catch (e) { toast(e.message, "error"); } };
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= rows.length) return; const n = [...rows]; [n[i], n[j]] = [n[j], n[i]]; setRows(n); run(() => salesApi.orderStages(n.map((x) => x._id)), "Order saved"); };
  return (
    <Modal title="Deal stages" onClose={onClose} footer={<button type="button" className="ui-btn ui-btn-primary" onClick={onClose}>Done</button>}>
      {st.loading && !rows.length ? <Spinner /> : (
        <div className="space-y-1.5">
          {rows.map((s, i) => (
            <div key={s._id} className="flex items-center gap-1.5 rounded-lg border p-1.5">
              <input type="color" className="ui-input p-0.5" style={{ width: 32 }} aria-label="Colour" value={s.color} onChange={(e) => setRows(rows.map((x) => (x._id === s._id ? { ...x, color: e.target.value } : x)))} onBlur={(e) => run(() => salesApi.updateStage(s._id, { color: e.target.value }), "Saved")} />
              <input className="ui-input flex-1 min-w-0" aria-label="Name" value={s.name} onChange={(e) => setRows(rows.map((x) => (x._id === s._id ? { ...x, name: e.target.value } : x)))} onBlur={(e) => e.target.value.trim() && run(() => salesApi.updateStage(s._id, { name: e.target.value }), "Saved")} />
              <select className="ui-input" style={{ width: 82 }} aria-label="Kind" value={s.kind} onChange={(e) => run(() => salesApi.updateStage(s._id, { kind: e.target.value }), "Saved")}><option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option></select>
              <input type="number" min="0" max="100" className="ui-input" style={{ width: 62 }} aria-label="Probability %" title="Probability %" disabled={s.kind !== "open"} value={s.probability} onChange={(e) => setRows(rows.map((x) => (x._id === s._id ? { ...x, probability: e.target.value } : x)))} onBlur={(e) => run(() => salesApi.updateStage(s._id, { probability: e.target.value }), "Saved")} />
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Up" disabled={i === 0} onClick={() => move(i, -1)}><i className="bi bi-chevron-up"></i></button>
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Down" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><i className="bi bi-chevron-down"></i></button>
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title={s.deals ? `${s.deals} deals` : "Delete"} disabled={!!s.deals} onClick={() => run(() => salesApi.removeStage(s._id), "Stage removed")}><i className="bi bi-trash"></i></button>
            </div>
          ))}
          <div className="flex items-center gap-1.5 rounded-lg border border-dashed p-1.5 mt-3">
            <input type="color" className="ui-input p-0.5" style={{ width: 32 }} aria-label="Colour" value={add.color} onChange={(e) => setAdd({ ...add, color: e.target.value })} />
            <input className="ui-input flex-1 min-w-0" aria-label="New stage name" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
            <select className="ui-input" style={{ width: 82 }} aria-label="Kind" value={add.kind} onChange={(e) => setAdd({ ...add, kind: e.target.value })}><option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option></select>
            <input type="number" min="0" max="100" className="ui-input" style={{ width: 62 }} aria-label="Probability %" value={add.probability} onChange={(e) => setAdd({ ...add, probability: e.target.value })} />
            <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={!add.name.trim()} onClick={() => run(() => salesApi.createStage(add), "Stage added").then(() => setAdd({ ...add, name: "" }))}><i className="bi bi-plus-lg"></i>Add</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ═════════════ one deal ═════════════ */
function DealDrawer({ id, initial, stages, onClose, onSaved, onQuote }) {
  const toast = useToast();
  const { can } = useAuth();
  const owners = useOwners();
  const companies = useCompanies(id);
  const products = useProducts();
  const isNew = !id;
  const deal = useApi(() => (id ? salesApi.deal(id) : Promise.resolve({ data: null })), [id]);
  const [f, setF] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  useEffect(() => {
    const d = deal.data;
    if (isNew) setF({ title: "", company: "", contactName: "", contactPhone: "", contactEmail: "", value: "", stage: stages.find((s) => s.kind === "open")?._id || "", probability: "", expectedClose: "", owner: "", source: "", priority: "medium", tags: "", items: [], lostReason: "", ...initial });
    else if (d) setF({ title: d.title, company: idOf(d.company) || "", contactName: d.contactName, contactPhone: d.contactPhone, contactEmail: d.contactEmail, value: d.value, stage: d.stage, probability: d.probability ?? "", expectedClose: iso(d.expectedClose), owner: d.owner, source: d.source, priority: d.priority, tags: (d.tags || []).join(", "), items: d.items || [], lostReason: d.lostReason || "" });
  }, [deal.data, isNew]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) return <Modal title="Deal" onClose={onClose}><Spinner /></Modal>;
  const d = deal.data;
  const set = (k, v) => setF({ ...f, [k]: v });
  const stage = stages.find((s) => s._id === f.stage);
  const lineTotal = f.items.length ? sumLines(f.items).total : null;

  async function save() {
    if (!f.title.trim() && !f.lead) return toast("Title is required", "error");
    if (stage?.kind === "lost" && !f.lostReason.trim()) return toast("Say why the deal was lost", "error");
    setBusy(true);
    try {
      const body = { ...f, value: f.items.length ? undefined : f.value, items: f.items, company: f.company || null };
      const r = isNew ? await salesApi.createDeal(body) : await salesApi.updateDeal(id, body);
      toast(isNew ? "Deal created" : "Deal saved");
      onSaved(r.data);
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  }
  async function addNote() {
    try { await salesApi.updateDeal(id, { note }); setNote(""); deal.reload(); } catch (e) { toast(e.message, "error"); }
  }
  async function remove() {
    setBusy(true);
    try { await salesApi.removeDeal(id); toast("Deal deleted"); onSaved(null); } catch (e) { toast(e.message, "error"); setBusy(false); }
  }

  return (
    <Modal size="wide" title={isNew ? "New deal" : <span className="flex items-center gap-2">D-{d?.number} {stage && <Chip color={stage.color}>{stage.name}</Chip>}</span>} onClose={onClose}
      footer={<>
        {!isNew && can("leads", "del") && <button type="button" className="ui-btn ui-btn-outline me-auto" onClick={() => setDel(true)}><i className="bi bi-trash"></i>Delete</button>}
        {!isNew && <button type="button" className="ui-btn ui-btn-outline" onClick={() => onQuote(d)}><i className="bi bi-file-earmark-text"></i>Quotation</button>}
        <button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button>
        {can("leads", isNew ? "create" : "edit") && <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>}
      </>}>
      <div className="space-y-4">
        {!isNew && d && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="Value" value={money(d.value)} icon="currency-rupee" />
            <StatCard label="Weighted" value={money(d.weighted)} icon="percent" tone="info" hint={`${d.prob}%`} />
            <StatCard label="In stage" value={`${d.daysInStage}d`} icon="hourglass" tone={d.daysInStage > 30 ? "warning" : "primary"} />
            <StatCard label="Close" value={d.expectedClose ? formatDate(d.expectedClose) : "—"} icon="calendar-event" tone={d.overdue ? "destructive" : "success"} hint={d.overdue ? "Overdue" : undefined} />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className={labelCls}>Title *</label><input className="ui-input w-full" autoFocus={isNew} value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
          <div><label className={labelCls}>Company</label><select className="ui-input w-full" value={f.company} onChange={(e) => set("company", e.target.value)}><option value="">None</option>{companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
          <div><label className={labelCls}>Contact</label><input className="ui-input w-full" value={f.contactName} onChange={(e) => set("contactName", e.target.value)} /></div>
          <div><label className={labelCls}>Phone</label><input type="tel" className="ui-input w-full" value={f.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></div>
          <div><label className={labelCls}>Email</label><input type="email" className="ui-input w-full" value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></div>
          <div><label className={labelCls}>Stage</label><select className="ui-input w-full" value={f.stage} onChange={(e) => set("stage", e.target.value)}>{stages.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
          {stage?.kind === "lost" ? <div><label className={labelCls}>Lost reason *</label><input className="ui-input w-full" list="deal-lost" value={f.lostReason} onChange={(e) => set("lostReason", e.target.value)} /><datalist id="deal-lost">{["Price", "Went with a competitor", "No budget", "No decision", "Not reachable", "Timing"].map((x) => <option key={x} value={x} />)}</datalist></div>
            : <div><label className={labelCls}>Probability %</label><input type="number" min="0" max="100" className="ui-input w-full" disabled={stage?.kind !== "open"} value={f.probability} onChange={(e) => set("probability", e.target.value)} title={`Stage default ${stage?.probability ?? 0}%`} /></div>}
          <div><label className={labelCls}>Value (₹)</label><input type="number" min="0" className="ui-input w-full" disabled={lineTotal !== null} value={lineTotal !== null ? lineTotal : f.value} onChange={(e) => set("value", e.target.value)} /></div>
          <div><label className={labelCls}>Expected close</label><DateInput className="ui-input w-full" value={f.expectedClose} onChange={(e) => set("expectedClose", e.target.value)} /></div>
          <div><label className={labelCls}>Owner</label><select className="ui-input w-full" value={f.owner} onChange={(e) => set("owner", e.target.value)}><option value="">Me</option><option value="Unassigned">Unassigned</option>{owners.map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><label className={labelCls}>Priority</label><select className="ui-input w-full" value={f.priority} onChange={(e) => set("priority", e.target.value)}>{Object.entries(PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></div>
          <div><label className={labelCls}>Source</label><input className="ui-input w-full" value={f.source} onChange={(e) => set("source", e.target.value)} /></div>
          <div><label className={labelCls}>Tags</label><input className="ui-input w-full" value={f.tags} onChange={(e) => set("tags", e.target.value)} /></div>
        </div>
        {d?.lead && <div className="text-sm"><i className="bi bi-person me-1 text-muted-foreground"></i>Lead <Link to={`/crm/leads?lead=${idOf(d.lead)}`} className="text-foreground font-medium hover:underline">{d.lead.name}</Link>{d.lead.phone ? <span className="text-muted-foreground"> · {d.lead.phone}</span> : null}</div>}

        <Panel title="Products & services">
          <LineItems items={f.items} setItems={(items) => set("items", items)} products={products} />
          {f.items.length > 0 && <div className="mt-3"><Totals items={f.items} /></div>}
        </Panel>

        {!isNew && d && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Panel title="Notes">
              <div className="flex gap-2 mb-2"><input className="ui-input flex-1" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && note.trim() && addNote()} /><button type="button" className="ui-btn ui-btn-primary" disabled={!note.trim()} onClick={addNote}>Add</button></div>
              {(d.notes || []).map((n, i) => <div key={i} className="border-t py-1.5"><div className="text-sm text-foreground whitespace-pre-line">{n.text}</div><div className="text-[11px] text-muted-foreground">{n.by} · {formatDateTime(n.at)}</div></div>)}
            </Panel>
            <Panel title="History">
              {[...(d.history || [])].reverse().map((h, i) => <div key={i} className="flex items-start gap-2 py-1.5 border-t first:border-t-0"><i className="bi bi-arrow-right-circle text-muted-foreground mt-0.5"></i><div><div className="text-sm text-foreground">{h.stage}{h.note ? ` · ${h.note}` : ""}</div><div className="text-[11px] text-muted-foreground">{h.by} · {formatDateTime(h.at)}</div></div></div>)}
              {(d.quotes || []).length > 0 && <div className="border-t mt-2 pt-2">{d.quotes.map((q) => <Link key={q._id} to={`/crm/quotes?quote=${q._id}`} className="flex items-center justify-between gap-2 py-1 text-sm text-foreground hover:underline"><span className="font-mono text-xs">{q.quoteNo}</span><span>{money(q.total)}</span><Chip color={QUOTE_STATUS[q.status]?.color}>{QUOTE_STATUS[q.status]?.label}</Chip></Link>)}</div>}
            </Panel>
          </div>
        )}
      </div>
      {del && <Confirm title="Delete this deal?" text="Its quotations stay." danger confirmLabel="Delete" busy={busy} onConfirm={remove} onCancel={() => setDel(false)} />}
    </Modal>
  );
}

/* ═════════════ deals ═════════════ */
export function Deals() {
  const toast = useToast();
  const { can } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [view, setView] = useState(() => { try { return localStorage.getItem("crm_deals_view") || "board"; } catch { return "board"; } });
  const [q, setQ, term] = useSearch();
  const [f, setF] = useState({ owner: "", priority: "", overdue: "", kind: "" });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(() => sp.get("deal") || null);
  const [creating, setCreating] = useState(() => (sp.get("lead") ? { lead: sp.get("lead") } : null));
  const [stagesOpen, setStagesOpen] = useState(false);
  const [quoteFor, setQuoteFor] = useState(null);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [lost, setLost] = useState(null);
  const owners = useOwners();
  const stages = useApi(() => salesApi.stages(), []);
  const params = useMemo(() => ({ ...f, q: term }), [f, term]);
  const board = useApi(() => (view === "board" ? salesApi.board(params) : Promise.resolve({ data: [] })), [view, params]);
  const list = useApi(() => (view === "list" ? salesApi.deals({ ...params, page, perPage: 50 }) : Promise.resolve({ data: [] })), [view, params, page]);
  const sum = useApi(() => salesApi.summary(params), [params]);
  const s = sum.data || {};
  useEffect(() => { try { localStorage.setItem("crm_deals_view", view); } catch { /* private mode */ } }, [view]);
  useEffect(() => setPage(1), [params]);
  const reload = () => { board.reload(); list.reload(); sum.reload(); };
  const close = () => { setOpen(null); setCreating(null); if (sp.get("deal") || sp.get("lead")) { sp.delete("deal"); sp.delete("lead"); setSp(sp, { replace: true }); } };
  const setFilter = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function move(deal, stage, lostReason) {
    try { await salesApi.updateDeal(deal._id, { stage: stage._id, lostReason }); toast(`${deal.title} → ${stage.name}`); reload(); } catch (e) { toast(e.message, "error"); }
  }
  function drop(stage) {
    const d = drag; setDrag(null); setOver(null);
    if (!d || String(d.stage) === String(stage._id)) return;
    if (stage.kind === "lost") setLost({ deal: d, stage, reason: "" }); else move(d, stage);
  }
  async function exportAll() {
    try {
      const all = (await salesApi.deals({ ...params, perPage: 200 })).data || [];
      await exportExcel(all.map((d) => ({ No: `D-${d.number}`, Title: d.title, Company: d.company?.name || "", Contact: d.contactName, Phone: d.contactPhone, Email: d.contactEmail, Stage: d.stageInfo?.name, Value: d.value, "Probability %": d.prob, Weighted: d.weighted, "Expected close": d.expectedClose ? formatDate(d.expectedClose) : "", Owner: d.owner, Priority: d.priority, Source: d.source, "Lost reason": d.lostReason, Created: formatDate(d.createdAt) })), "deals");
    } catch (e) { toast(e.message, "error"); }
  }

  return (
    <div>
      <PageHeader title="Deals" actions={<>
        {can("setup", "edit") && <button type="button" className="ui-btn ui-btn-outline" onClick={() => setStagesOpen(true)}><i className="bi bi-sliders"></i><span className="hidden sm:inline">Stages</span></button>}
        <button type="button" className="ui-btn ui-btn-outline" onClick={exportAll}><i className="bi bi-file-earmark-excel"></i><span className="hidden sm:inline">Export Excel</span></button>
        {can("leads", "create") && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setCreating({})}><i className="bi bi-plus-lg"></i>New deal</button>}
      </>} />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
        <StatCard label="Open pipeline" value={compactMoney(s.openValue || 0)} icon="funnel" hint={`${s.open || 0} deals`} active={f.kind === "open"} onClick={() => setFilter("kind", f.kind === "open" ? "" : "open")} />
        <StatCard label="Forecast" value={compactMoney(s.weighted || 0)} icon="graph-up-arrow" tone="info" hint={`Closing this month ${compactMoney(s.closingMonth || 0)}`} />
        <StatCard label="Won this month" value={compactMoney(s.wonMonthValue || 0)} icon="trophy" tone="success" hint={`${s.wonMonth || 0} deals`} active={f.kind === "won"} onClick={() => setFilter("kind", f.kind === "won" ? "" : "won")} />
        <StatCard label="Win rate" value={`${s.winRate || 0}%`} icon="bullseye" tone="primary" hint={s.avgDeal ? `Avg ${compactMoney(s.avgDeal)} · ${s.avgCycleDays}d` : undefined} />
        <StatCard label="Overdue" value={num.format(s.overdue || 0)} icon="alarm" tone="destructive" active={f.overdue === "1"} onClick={() => setFilter("overdue", f.overdue ? "" : "1")} />
      </div>
      <Tabs value={view} onChange={setView} tabs={[{ value: "board", label: "Board" }, { value: "list", label: "List" }]} />
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SearchBox value={q} onChange={setQ} />
        <select className="ui-input" style={{ width: "auto" }} aria-label="Owner" value={f.owner} onChange={(e) => setFilter("owner", e.target.value)}><option value="">Anyone</option><option value="me">Me</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>
        <select className="ui-input" style={{ width: "auto" }} aria-label="Priority" value={f.priority} onChange={(e) => setFilter("priority", e.target.value)}><option value="">Any priority</option>{Object.entries(PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select>
      </div>
      <ErrorBox error={board.error || list.error} />

      {view === "board" ? (board.loading && !board.data?.length ? <Spinner /> : (
        <div className="flex gap-3 overflow-x-auto pb-3" style={{ minHeight: 320 }}>
          {(board.data || []).map((c) => (
            <div key={c.stage._id} className="flex-shrink-0 rounded-xl border flex flex-col" style={{ width: 268, background: "var(--muted-background)", borderColor: over === c.stage._id ? "var(--primary)" : undefined, maxHeight: "calc(100vh - 300px)" }}
              onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(c.stage._id); } }} onDragLeave={() => setOver((o) => (o === c.stage._id ? null : o))} onDrop={() => drop(c.stage)}>
              <div className="px-3 py-2 border-b">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: c.stage.color }} /><span className="text-sm font-semibold text-foreground truncate">{c.stage.name}</span></span>
                  <span className="text-[11px] text-muted-foreground">{c.count}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{compactMoney(c.value)}{c.stage.kind === "open" ? ` · ${c.stage.probability}% → ${compactMoney(c.weighted)}` : ""}</div>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {c.deals.map((d) => (
                  <div key={d._id} draggable={can("leads", "edit")} onDragStart={() => setDrag(d)} onDragEnd={() => { setDrag(null); setOver(null); }} onClick={() => setOpen(d._id)}
                    className="rounded-lg border bg-card p-2.5 cursor-pointer hover:shadow-sm" style={{ opacity: drag?._id === d._id ? 0.5 : 1 }}>
                    <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium text-foreground line-clamp-2">{d.title}</span><span className="h-2 w-2 rounded-full flex-shrink-0 mt-1.5" style={{ background: PRIORITY[d.priority]?.color }} title={PRIORITY[d.priority]?.label} /></div>
                    {d.company?.name && <div className="text-xs text-muted-foreground truncate"><i className="bi bi-building me-1"></i>{d.company.name}</div>}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-sm font-semibold text-foreground">{money(d.value)}</span>
                      {d.expectedClose && c.stage.kind === "open" && <Chip color={d.overdue ? "var(--destructive)" : "var(--muted-foreground)"} icon="calendar-event">{formatDate(d.expectedClose).slice(0, 5)}</Chip>}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1"><span className="truncate">{d.owner && d.owner !== "Unassigned" ? d.owner.split(" ")[0] : "Unassigned"}</span>{c.stage.kind === "open" && <span>{d.daysInStage}d</span>}</div>
                    {can("leads", "edit") && (
                      <select className="ui-input w-full mt-2 md:hidden" style={{ height: 28, fontSize: 12 }} value="" aria-label="Move to stage" onClick={(e) => e.stopPropagation()} onChange={(e) => { const to = (stages.data || []).find((x) => x._id === e.target.value); if (to) (to.kind === "lost" ? setLost({ deal: d, stage: to, reason: "" }) : move(d, to)); }}>
                        <option value="">Move to…</option>{(stages.data || []).filter((x) => x._id !== c.stage._id).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                      </select>
                    )}
                  </div>
                ))}
                {!c.deals.length && <div className="text-[11px] text-center text-muted-foreground py-6">No deals</div>}
              </div>
            </div>
          ))}
        </div>
      )) : (
        <>
          <div className="md:hidden space-y-2">
            {list.loading && !list.data?.length ? <Spinner /> : !(list.data || []).length ? <div className="rounded-xl border bg-card"><EmptyState icon="briefcase" text="No deals" /></div> : list.data.map((d) => (
              <button key={d._id} type="button" className="w-full text-left rounded-xl border bg-card p-3" onClick={() => setOpen(d._id)}>
                <div className="flex items-center gap-2"><span className="text-sm font-semibold text-foreground truncate flex-1">{d.title}</span><Chip color={d.stageInfo?.color}>{d.stageInfo?.name}</Chip></div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>{d.company?.name || d.contactName}</span><span className="font-semibold text-foreground">{money(d.value)}</span></div>
              </button>
            ))}
          </div>
          <div className="hidden md:block rounded-xl border bg-card overflow-hidden"><div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className={thead} style={{ background: "var(--muted-background)" }}><Th>No</Th><Th>Deal</Th><Th>Company</Th><Th>Stage</Th><Th right>Value</Th><Th right>Weighted</Th><Th>Close</Th><Th>Owner</Th></tr></thead>
              <tbody>
                {list.loading && !list.data?.length ? <tr><td colSpan={99}><Spinner /></td></tr> : !(list.data || []).length ? <tr><td colSpan={99}><EmptyState icon="briefcase" text="No deals" /></td></tr> : list.data.map((d) => (
                  <tr key={d._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setOpen(d._id)}>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">D-{d.number}</td>
                    <td className="px-3 py-2.5"><div className="font-medium text-foreground truncate" style={{ maxWidth: 260 }}>{d.title}</div><div className="text-[11px] text-muted-foreground">{d.contactName}</div></td>
                    <td className="px-3 py-2.5">{d.company?.name || "—"}</td>
                    <td className="px-3 py-2.5"><Chip color={d.stageInfo?.color}>{d.stageInfo?.name}</Chip></td>
                    <td className="px-3 py-2.5 text-right font-medium">{money(d.value)}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{money(d.weighted)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: d.overdue ? "var(--destructive)" : undefined }}>{d.expectedClose ? formatDate(d.expectedClose) : "—"}</td>
                    <td className="px-3 py-2.5">{d.owner}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
          <Pager page={page} pages={list.raw?.pages || 1} total={list.raw?.total || 0} unit="deal" onPage={setPage} />
        </>
      )}

      {s.owners?.length > 1 && (
        <Panel title="By owner" className="mt-3" bodyClass="p-0">
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className={thead}><Th>Owner</Th><Th right>Open pipeline</Th><Th right>Won deals</Th><Th right>Won value</Th></tr></thead>
            <tbody>{s.owners.map((o) => <tr key={o.name} className="border-t"><td className="px-3 py-2">{o.name}</td><td className="px-3 py-2 text-right">{money(o.open)}</td><td className="px-3 py-2 text-right">{o.won}</td><td className="px-3 py-2 text-right font-medium">{money(o.value)}</td></tr>)}</tbody></table></div>
        </Panel>
      )}

      {(open || creating) && stages.data && <DealDrawer id={open} initial={creating || {}} stages={stages.data} onClose={close} onSaved={(d) => { reload(); if (d && !open) { setCreating(null); setOpen(d._id); } else if (!d) close(); else close(); }} onQuote={(d) => setQuoteFor(d)} />}
      {quoteFor && <QuoteEditor dealId={quoteFor._id} onClose={() => setQuoteFor(null)} onSaved={() => { setQuoteFor(null); toast("Quotation saved · see Quotations"); }} />}
      {stagesOpen && <StagesModal onClose={() => setStagesOpen(false)} onChanged={() => { stages.reload(); reload(); }} />}
      {lost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setLost(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-foreground">Why was {lost.deal.title} lost?</div>
            <input className="ui-input w-full" list="deal-lost-b" autoFocus aria-label="Reason" value={lost.reason} onChange={(e) => setLost((x) => ({ ...x, reason: e.target.value }))} />
            <datalist id="deal-lost-b">{["Price", "Went with a competitor", "No budget", "No decision", "Not reachable", "Timing"].map((r) => <option key={r} value={r} />)}</datalist>
            <div className="flex justify-end gap-2"><button type="button" className="ui-btn ui-btn-outline" onClick={() => setLost(null)}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={!lost.reason.trim()} onClick={() => { const x = lost; setLost(null); move(x.deal, x.stage, x.reason.trim()); }}>Mark lost</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═════════════ companies ═════════════ */
function CompanyDrawer({ id, onClose, onSaved }) {
  const toast = useToast();
  const { can } = useAuth();
  const owners = useOwners();
  const isNew = !id;
  const c = useApi(() => (id ? salesApi.company(id) : Promise.resolve({ data: null })), [id]);
  const [f, setF] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  useEffect(() => {
    const d = c.data;
    if (isNew) setF({ name: "", industry: "", website: "", phone: "", email: "", gstin: "", address: "", city: "", state: "", country: "India", size: "", owner: "", tags: "", contacts: [] });
    else if (d) setF({ ...d, tags: (d.tags || []).join(", "), contacts: d.contacts || [] });
  }, [c.data, isNew]);
  if (!f) return <Modal title="Company" onClose={onClose}><Spinner /></Modal>;
  const set = (k, v) => setF({ ...f, [k]: v });
  const setContact = (i, patch) => set("contacts", f.contacts.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  async function save() {
    if (!f.name.trim()) return toast("Name is required", "error");
    setBusy(true);
    try {
      const { dealList, quoteList, notes, _id, tenant, createdAt, updatedAt, __v, createdBy, deals, openValue, wonValue, ...body } = f;
      const r = isNew ? await salesApi.createCompany(body) : await salesApi.updateCompany(id, body);
      toast(isNew ? "Company added" : "Saved"); onSaved(r.data);
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  }
  async function addNote() { try { await salesApi.updateCompany(id, { note }); setNote(""); c.reload(); } catch (e) { toast(e.message, "error"); } }
  async function remove() { setBusy(true); try { await salesApi.removeCompany(id); toast("Company deleted"); onSaved(null); } catch (e) { toast(e.message, "error"); setBusy(false); setDel(false); } }
  const d = c.data;
  const g = "grid grid-cols-1 sm:grid-cols-2 gap-3";
  return (
    <Modal size="wide" title={isNew ? "New company" : f.name} onClose={onClose}
      footer={<>
        {!isNew && can("leads", "del") && <button type="button" className="ui-btn ui-btn-outline me-auto" onClick={() => setDel(true)}><i className="bi bi-trash"></i>Delete</button>}
        <button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button>
        {can("leads", isNew ? "create" : "edit") && <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>}
      </>}>
      <div className="space-y-4">
        <div className={g}>
          <div className="sm:col-span-2"><label className={labelCls}>Name *</label><input className="ui-input w-full" autoFocus={isNew} value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><label className={labelCls}>Industry</label><input className="ui-input w-full" list="co-ind" value={f.industry} onChange={(e) => set("industry", e.target.value)} /><datalist id="co-ind">{["Education", "Software", "Manufacturing", "Healthcare", "Retail", "Finance", "Real estate", "Hospitality", "Government"].map((x) => <option key={x} value={x} />)}</datalist></div>
          <div><label className={labelCls}>Size</label><select className="ui-input w-full" value={f.size} onChange={(e) => set("size", e.target.value)}><option value="">—</option>{["1–10", "11–50", "51–200", "201–500", "501–1000", "1000+"].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label className={labelCls}>Phone</label><input type="tel" className="ui-input w-full" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><label className={labelCls}>Email</label><input type="email" className="ui-input w-full" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><label className={labelCls}>Website</label><input className="ui-input w-full" value={f.website} onChange={(e) => set("website", e.target.value)} /></div>
          <div><label className={labelCls}>GSTIN</label><input className="ui-input w-full font-mono" value={f.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Address</label><input className="ui-input w-full" value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div><label className={labelCls}>City</label><input className="ui-input w-full" value={f.city} onChange={(e) => set("city", e.target.value)} /></div>
          <div><label className={labelCls}>State</label><input className="ui-input w-full" value={f.state} onChange={(e) => set("state", e.target.value)} /></div>
          <div><label className={labelCls}>Owner</label><select className="ui-input w-full" value={f.owner} onChange={(e) => set("owner", e.target.value)}><option value="">Me</option><option value="Unassigned">Unassigned</option>{owners.map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><label className={labelCls}>Tags</label><input className="ui-input w-full" value={f.tags} onChange={(e) => set("tags", e.target.value)} /></div>
        </div>
        <Panel title="People" actions={<button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => set("contacts", [...f.contacts, { name: "", role: "", phone: "", email: "", primary: !f.contacts.length }])}><i className="bi bi-plus-lg"></i>Add</button>}>
          {!f.contacts.length ? <div className="text-sm text-muted-foreground text-center py-3">No people</div> : f.contacts.map((p, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] gap-2 items-center py-1.5 border-t first:border-t-0">
              <input className="ui-input" aria-label="Name" title="Name" value={p.name} onChange={(e) => setContact(i, { name: e.target.value })} />
              <input className="ui-input" aria-label="Role" title="Role" value={p.role} onChange={(e) => setContact(i, { role: e.target.value })} />
              <input className="ui-input" aria-label="Phone" title="Phone" type="tel" value={p.phone} onChange={(e) => setContact(i, { phone: e.target.value })} />
              <input className="ui-input" aria-label="Email" title="Email" type="email" value={p.email} onChange={(e) => setContact(i, { email: e.target.value })} />
              <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="radio" className="form-check-input m-0" checked={!!p.primary} onChange={() => set("contacts", f.contacts.map((x, k) => ({ ...x, primary: k === i })))} />Main</label>
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Remove" onClick={() => set("contacts", f.contacts.filter((_, k) => k !== i))}><i className="bi bi-trash"></i></button>
            </div>
          ))}
        </Panel>
        {!isNew && d && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Panel title={`Deals (${d.dealList.length})`}>
              {!d.dealList.length ? <div className="text-sm text-muted-foreground text-center py-3">No deals</div> : d.dealList.map((x) => <Link key={x._id} to={`/crm/deals?deal=${x._id}`} className="flex items-center justify-between gap-2 py-1.5 border-t first:border-t-0 text-sm text-foreground hover:underline"><span className="truncate">{x.title}</span><span className="flex items-center gap-2"><Chip color={x.stage?.color}>{x.stage?.name}</Chip>{money(x.value)}</span></Link>)}
              {d.quoteList.length > 0 && <div className="border-t mt-2 pt-2">{d.quoteList.map((q) => <Link key={q._id} to={`/crm/quotes?quote=${q._id}`} className="flex items-center justify-between gap-2 py-1 text-sm text-foreground hover:underline"><span className="font-mono text-xs">{q.quoteNo}</span><span>{money(q.total)}</span><Chip color={QUOTE_STATUS[q.status]?.color}>{QUOTE_STATUS[q.status]?.label}</Chip></Link>)}</div>}
            </Panel>
            <Panel title="Notes">
              <div className="flex gap-2 mb-2"><input className="ui-input flex-1" aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && note.trim() && addNote()} /><button type="button" className="ui-btn ui-btn-primary" disabled={!note.trim()} onClick={addNote}>Add</button></div>
              {(d.notes || []).map((n, i) => <div key={i} className="border-t py-1.5"><div className="text-sm text-foreground whitespace-pre-line">{n.text}</div><div className="text-[11px] text-muted-foreground">{n.by} · {formatDateTime(n.at)}</div></div>)}
            </Panel>
          </div>
        )}
      </div>
      {del && <Confirm title={`Delete ${f.name}?`} danger confirmLabel="Delete" busy={busy} onConfirm={remove} onCancel={() => setDel(false)} />}
    </Modal>
  );
}

export function Companies() {
  const toast = useToast();
  const { can } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [q, setQ, term] = useSearch();
  const [industry, setIndustry] = useState("");
  const [owner, setOwner] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(() => sp.get("company") || null);
  const owners = useOwners();
  const list = useApi(() => salesApi.companies({ q: term, industry, owner, page, perPage: 50 }), [term, industry, owner, page]);
  const rows = list.data || [];
  useEffect(() => setPage(1), [term, industry, owner]);
  const close = () => { setOpen(null); if (sp.get("company")) { sp.delete("company"); setSp(sp, { replace: true }); } };
  async function exportAll() {
    try {
      const all = (await salesApi.companies({ q: term, industry, owner, perPage: 200 })).data || [];
      await exportExcel(all.map((c) => ({ Name: c.name, Industry: c.industry, Phone: c.phone, Email: c.email, Website: c.website, GSTIN: c.gstin, City: c.city, State: c.state, Owner: c.owner, Deals: c.deals, "Open value": c.openValue, "Won value": c.wonValue, People: (c.contacts || []).map((p) => p.name).join(", ") })), "companies");
    } catch (e) { toast(e.message, "error"); }
  }
  return (
    <div>
      <PageHeader title="Companies" actions={<>
        <button type="button" className="ui-btn ui-btn-outline" disabled={!rows.length} onClick={exportAll}><i className="bi bi-file-earmark-excel"></i><span className="hidden sm:inline">Export Excel</span></button>
        {can("leads", "create") && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setOpen("new")}><i className="bi bi-plus-lg"></i>New company</button>}
      </>} />
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SearchBox value={q} onChange={setQ} />
        <select className="ui-input" style={{ width: "auto" }} aria-label="Industry" value={industry} onChange={(e) => setIndustry(e.target.value)}><option value="">All industries</option>{(list.raw?.industries || []).map((x) => <option key={x}>{x}</option>)}</select>
        <select className="ui-input" style={{ width: "auto" }} aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Anyone</option><option value="me">Me</option>{owners.map((o) => <option key={o}>{o}</option>)}</select>
      </div>
      <ErrorBox error={list.error} />
      <div className="md:hidden space-y-2">
        {list.loading && !rows.length ? <Spinner /> : !rows.length ? <div className="rounded-xl border bg-card"><EmptyState icon="building" text="No companies" /></div> : rows.map((c) => (
          <button key={c._id} type="button" className="w-full text-left rounded-xl border bg-card p-3" onClick={() => setOpen(c._id)}>
            <div className="text-sm font-semibold text-foreground truncate">{c.name}</div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>{[c.industry, c.city].filter(Boolean).join(" · ") || "—"}</span><span>{c.deals} deals · {compactMoney(c.openValue)}</span></div>
          </button>
        ))}
      </div>
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className={thead} style={{ background: "var(--muted-background)" }}><Th>Company</Th><Th>Industry</Th><Th>Contact</Th><Th>City</Th><Th right>Deals</Th><Th right>Open</Th><Th right>Won</Th><Th>Owner</Th></tr></thead>
          <tbody>
            {list.loading && !rows.length ? <tr><td colSpan={99}><Spinner /></td></tr> : !rows.length ? <tr><td colSpan={99}><EmptyState icon="building" text="No companies" /></td></tr> : rows.map((c) => {
              const p = (c.contacts || []).find((x) => x.primary) || (c.contacts || [])[0];
              return (
                <tr key={c._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setOpen(c._id)}>
                  <td className="px-3 py-2.5"><div className="font-medium text-foreground">{c.name}</div>{c.website && <div className="text-[11px] text-muted-foreground truncate" style={{ maxWidth: 220 }}>{c.website.replace(/^https?:\/\//, "")}</div>}</td>
                  <td className="px-3 py-2.5">{c.industry || "—"}</td>
                  <td className="px-3 py-2.5">{p ? <><div className="text-foreground">{p.name}</div><div className="text-[11px] text-muted-foreground">{p.phone || p.email}</div></> : c.phone || "—"}</td>
                  <td className="px-3 py-2.5">{c.city || "—"}</td>
                  <td className="px-3 py-2.5 text-right">{c.deals}</td>
                  <td className="px-3 py-2.5 text-right">{money(c.openValue)}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{money(c.wonValue)}</td>
                  <td className="px-3 py-2.5">{c.owner}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div></div>
      <Pager page={page} pages={list.raw?.pages || 1} total={list.raw?.total || 0} unit="company" onPage={setPage} />
      {open && <CompanyDrawer id={open === "new" ? null : open} onClose={close} onSaved={(c) => { list.reload(); if (c && open === "new") setOpen(c._id); else if (!c) close(); }} />}
    </div>
  );
}

/* ═════════════ products ═════════════ */
export function Products() {
  const toast = useToast();
  const { can } = useAuth();
  const [q, setQ, term] = useSearch();
  const [category, setCategory] = useState("");
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);
  const list = useApi(() => salesApi.products({ q: term, category }), [term, category]);
  const rows = list.data || [];
  async function save() {
    if (!edit.name?.trim()) return toast("Name is required", "error");
    setBusy(true);
    try { if (edit._id) await salesApi.updateProduct(edit._id, edit); else await salesApi.createProduct(edit); toast("Saved"); setEdit(null); list.reload(); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { const r = await salesApi.removeProduct(del._id); toast(r.data.deactivated ? "In use, so switched off" : "Deleted"); setDel(null); list.reload(); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  }
  const set = (k, v) => setEdit({ ...edit, [k]: v });
  return (
    <div>
      <PageHeader title="Products" actions={<>
        <button type="button" className="ui-btn ui-btn-outline" disabled={!rows.length} onClick={() => exportExcel(rows.map((p) => ({ Name: p.name, SKU: p.sku, Category: p.category, Unit: p.unit, Price: p.price, "Tax %": p.taxPercent, HSN: p.hsn, Active: p.active ? "Yes" : "No" })), "products")}><i className="bi bi-file-earmark-excel"></i><span className="hidden sm:inline">Export Excel</span></button>
        {can("setup", "create") && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setEdit({ name: "", sku: "", category: "", unit: "Nos", price: 0, taxPercent: 18, hsn: "", description: "", active: true })}><i className="bi bi-plus-lg"></i>New product</button>}
      </>} />
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SearchBox value={q} onChange={setQ} />
        <select className="ui-input" style={{ width: "auto" }} aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{(list.raw?.categories || []).map((x) => <option key={x}>{x}</option>)}</select>
      </div>
      <ErrorBox error={list.error} />
      <div className="rounded-xl border bg-card overflow-hidden"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className={thead} style={{ background: "var(--muted-background)" }}><Th>Product</Th><Th>Category</Th><Th right>Price</Th><Th right>Tax</Th><Th>Unit</Th><Th>Status</Th><Th right> </Th></tr></thead>
          <tbody>
            {list.loading && !rows.length ? <tr><td colSpan={99}><Spinner /></td></tr> : !rows.length ? <tr><td colSpan={99}><EmptyState icon="box-seam" text="No products" /></td></tr> : rows.map((p) => (
              <tr key={p._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => can("setup", "edit") && setEdit(p)}>
                <td className="px-3 py-2.5"><div className="font-medium text-foreground">{p.name}</div><div className="text-[11px] text-muted-foreground">{[p.sku, p.hsn && `HSN ${p.hsn}`].filter(Boolean).join(" · ")}</div></td>
                <td className="px-3 py-2.5">{p.category || "—"}</td>
                <td className="px-3 py-2.5 text-right font-medium">{money(p.price)}</td>
                <td className="px-3 py-2.5 text-right">{p.taxPercent}%</td>
                <td className="px-3 py-2.5">{p.unit}</td>
                <td className="px-3 py-2.5"><Chip color={p.active ? "var(--success)" : "var(--muted-foreground)"}>{p.active ? "Active" : "Off"}</Chip></td>
                <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>{can("setup", "del") && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Delete" onClick={() => setDel(p)}><i className="bi bi-trash"></i></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
      {edit && (
        <Modal title={edit._id ? "Edit product" : "New product"} onClose={() => setEdit(null)} footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={() => setEdit(null)}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button></>}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={labelCls}>Name *</label><input className="ui-input w-full" autoFocus value={edit.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div><label className={labelCls}>SKU</label><input className="ui-input w-full" value={edit.sku} onChange={(e) => set("sku", e.target.value)} /></div>
            <div><label className={labelCls}>Category</label><input className="ui-input w-full" list="prod-cat" value={edit.category} onChange={(e) => set("category", e.target.value)} /><datalist id="prod-cat">{(list.raw?.categories || []).map((x) => <option key={x} value={x} />)}</datalist></div>
            <div><label className={labelCls}>Price (₹)</label><input type="number" min="0" className="ui-input w-full" value={edit.price} onChange={(e) => set("price", e.target.value)} /></div>
            <div><label className={labelCls}>Tax %</label><select className="ui-input w-full" value={edit.taxPercent} onChange={(e) => set("taxPercent", Number(e.target.value))}>{[0, 5, 12, 18, 28].map((x) => <option key={x} value={x}>{x}%</option>)}</select></div>
            <div><label className={labelCls}>Unit</label><input className="ui-input w-full" list="prod-unit" value={edit.unit} onChange={(e) => set("unit", e.target.value)} /><datalist id="prod-unit">{["Nos", "Hours", "Days", "Months", "Year", "Licence", "Seat", "Kg", "Box"].map((x) => <option key={x} value={x} />)}</datalist></div>
            <div><label className={labelCls}>HSN / SAC</label><input className="ui-input w-full" value={edit.hsn} onChange={(e) => set("hsn", e.target.value)} /></div>
            <div className="col-span-2"><label className={labelCls}>Description</label><textarea className="ui-input w-full" style={{ minHeight: 70, height: "auto", paddingTop: 6 }} value={edit.description} onChange={(e) => set("description", e.target.value)} /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm text-foreground"><input type="checkbox" className="form-check-input m-0" checked={edit.active} onChange={(e) => set("active", e.target.checked)} />Active</label>
          </div>
        </Modal>
      )}
      {del && <Confirm title={`Delete ${del.name}?`} text="If a deal or quotation uses it, it is switched off instead." danger confirmLabel="Delete" busy={busy} onConfirm={remove} onCancel={() => setDel(null)} />}
    </div>
  );
}

/* ═════════════ quotations ═════════════ */
function QuoteEditor({ id, dealId, onClose, onSaved }) {
  const toast = useToast();
  const { can } = useAuth();
  const isNew = !id;
  const products = useProducts();
  const companies = useCompanies(id);
  const quote = useApi(() => (id ? salesApi.quote(id) : Promise.resolve({ data: null })), [id]);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [send, setSend] = useState(null);
  const [ask, setAsk] = useState(null);
  const [del, setDel] = useState(false);
  useEffect(() => {
    const q = quote.data;
    if (isNew) setF({ deal: dealId || "", company: "", subject: "", customer: { name: "", email: "", phone: "", address: "", gstin: "" }, items: dealId ? [] : [{ product: "", name: "", description: "", qty: 1, unit: "Nos", price: 0, discountPct: 0, taxPct: 18 }], adjustment: 0, adjustmentLabel: "", validTill: iso(new Date(Date.now() + 15 * 86_400_000).toISOString()), terms: "Prices are in INR.\nPayment: 50% advance, balance on delivery.", notes: "" });
    else if (q) setF({ ...q, deal: idOf(q.deal) || "", company: idOf(q.company) || "", validTill: iso(q.validTill) });
  }, [quote.data, isNew]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!f) return <Modal title="Quotation" onClose={onClose}><Spinner /></Modal>;
  const q = quote.data;
  const locked = q && ["accepted", "rejected"].includes(q.status);
  const set = (k, v) => setF({ ...f, [k]: v });
  const setC = (k, v) => setF({ ...f, customer: { ...f.customer, [k]: v } });
  const pickCompany = (cid) => { const c = companies.find((x) => x._id === cid); setF({ ...f, company: cid, customer: c ? { name: c.name, email: c.email || f.customer.email, phone: c.phone || f.customer.phone, address: [c.address, c.city, c.state].filter(Boolean).join(", "), gstin: c.gstin || "" } : f.customer }); };
  const body = () => ({ deal: f.deal || null, company: f.company || null, subject: f.subject, customer: f.customer, items: f.items, adjustment: f.adjustment, adjustmentLabel: f.adjustmentLabel, validTill: f.validTill || null, terms: f.terms, notes: f.notes });

  async function save(after) {
    if (isNew && dealId && !f.items.length) { /* the server copies the deal's lines */ }
    else if (!f.items.some((x) => x.name?.trim())) return toast("Add at least one line", "error");
    if (!f.customer.name.trim() && !dealId) return toast("Customer name is required", "error");
    setBusy(true);
    try {
      const b = body();
      if (isNew && dealId && !f.items.length) delete b.items;
      const r = isNew ? await salesApi.createQuote(b) : await salesApi.updateQuote(id, b);
      toast(isNew ? `Quotation ${r.data.quoteNo} created` : "Saved");
      if (after === "send") { onSaved(r.data, "send"); return; }
      onSaved(r.data);
    } catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  }
  async function doSend() {
    setBusy(true);
    try { const r = await salesApi.sendQuote(id, send); toast(r.data.emailed ? "Quotation emailed" : "Marked as sent"); if (send.channel === "link") navigator.clipboard?.writeText(r.data.link); setSend(null); quote.reload(); onSaved(null, "keep"); }
    catch (e) {
      // a discount above the limit: ask for approval instead
      if (e.details?.needsApproval) { setSend(null); setAsk(e.details.status === "pending" ? null : { reason: "", pct: e.details.pct, limit: e.details.limit }); toast(e.message, e.details.status === "pending" ? undefined : "error"); }
      else toast(e.message, "error");
    } finally { setBusy(false); }
  }
  async function askApproval() {
    setBusy(true);
    try { await crmApi.requestQuoteApproval(id, ask.reason); toast("Sent for approval"); setAsk(null); quote.reload(); }
    catch (e) { toast(e.message, "error"); } finally { setBusy(false); }
  }
  async function markAs(status) { try { await salesApi.updateQuote(id, { status }); toast(`Marked ${status}`); quote.reload(); onSaved(null, "keep"); } catch (e) { toast(e.message, "error"); } }
  async function duplicate() { try { const r = await salesApi.duplicateQuote(id); toast(`Copy ${r.data.quoteNo} made`); onSaved(r.data, "open"); } catch (e) { toast(e.message, "error"); } }
  async function remove() { setBusy(true); try { await salesApi.removeQuote(id); toast("Quotation deleted"); onSaved(null); } catch (e) { toast(e.message, "error"); setBusy(false); } }
  const st = q ? QUOTE_STATUS[q.expired ? "expired" : q.status] : null;

  return (
    <Modal size="wide" title={isNew ? "New quotation" : <span className="flex items-center gap-2">{q?.quoteNo}<Chip color={st?.color}>{st?.label}</Chip>{q?.views > 0 && <Chip icon="eye">{q.views}</Chip>}{q?.approval?.status && <Chip color={{ pending: "var(--warning)", approved: "var(--success)", rejected: "var(--destructive)" }[q.approval.status]} icon="patch-check">Discount {q.approval.status === "pending" ? "waiting for approval" : q.approval.status}</Chip>}</span>} onClose={onClose}
      footer={<>
        {!isNew && can("leads", "del") && <button type="button" className="ui-btn ui-btn-outline me-auto" onClick={() => setDel(true)}><i className="bi bi-trash"></i></button>}
        {!isNew && <button type="button" className="ui-btn ui-btn-outline" onClick={duplicate}><i className="bi bi-copy"></i><span className="hidden sm:inline">Duplicate</span></button>}
        {!isNew && q?.status !== "draft" && <a className="ui-btn ui-btn-outline" href={q.link} target="_blank" rel="noreferrer"><i className="bi bi-printer"></i><span className="hidden sm:inline">View / PDF</span></a>}
        {!locked && can("leads", isNew ? "create" : "edit") && <button type="button" className="ui-btn ui-btn-outline" disabled={busy} onClick={() => save()}>Save</button>}
        {!isNew && !locked && <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => setSend({ channel: "email", email: f.customer.email, message: `Dear ${f.customer.name},\n\nPlease find our quotation ${q.quoteNo}.` })}><i className="bi bi-send"></i>Send</button>}
        {isNew && <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => save()}>Create</button>}
      </>}>
      <div className="space-y-4">
        {q?.status === "sent" && !locked && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Sent {formatDateTime(q.sentAt)}{q.viewedAt ? ` · first opened ${timeAgo(q.viewedAt)}` : " · not opened yet"}</span>
            <span className="ms-auto flex gap-1.5"><button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => markAs("accepted")}>Accepted</button><button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => markAs("rejected")}>Rejected</button></span>
          </div>
        )}
        {locked && <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: st.color }}><b style={{ color: st.color }}>{st.label}</b> by {q.response?.name} · {formatDateTime(q.respondedAt)}{q.response?.note ? ` · "${q.response.note}"` : ""}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>Company</label><select className="ui-input w-full" disabled={locked} value={f.company} onChange={(e) => pickCompany(e.target.value)}><option value="">None</option>{companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
          <div><label className={labelCls}>Subject</label><input className="ui-input w-full" disabled={locked} value={f.subject} onChange={(e) => set("subject", e.target.value)} /></div>
          <div><label className={labelCls}>Customer *</label><input className="ui-input w-full" disabled={locked} value={f.customer.name} onChange={(e) => setC("name", e.target.value)} /></div>
          <div><label className={labelCls}>Email</label><input type="email" className="ui-input w-full" disabled={locked} value={f.customer.email} onChange={(e) => setC("email", e.target.value)} /></div>
          <div><label className={labelCls}>Phone</label><input type="tel" className="ui-input w-full" disabled={locked} value={f.customer.phone} onChange={(e) => setC("phone", e.target.value)} /></div>
          <div><label className={labelCls}>GSTIN</label><input className="ui-input w-full font-mono" disabled={locked} value={f.customer.gstin} onChange={(e) => setC("gstin", e.target.value.toUpperCase())} /></div>
          <div className="sm:col-span-2"><label className={labelCls}>Billing address</label><input className="ui-input w-full" disabled={locked} value={f.customer.address} onChange={(e) => setC("address", e.target.value)} /></div>
          <div><label className={labelCls}>Valid till</label><DateInput className="ui-input w-full" disabled={locked} value={f.validTill} onChange={(e) => set("validTill", e.target.value)} /></div>
          {q?.deal && <div className="flex items-end text-sm"><Link to={`/crm/deals?deal=${idOf(q.deal)}`} className="hover:underline text-foreground"><i className="bi bi-briefcase me-1"></i>D-{q.deal.number} {q.deal.title}</Link></div>}
        </div>
        <Panel title="Lines">
          {isNew && dealId && !f.items.length ? <div className="text-sm text-muted-foreground">The deal's lines are copied in. <button type="button" className="p-0 border-0 bg-transparent" style={{ color: "var(--primary)" }} onClick={() => set("items", [{ product: "", name: "", description: "", qty: 1, unit: "Nos", price: 0, discountPct: 0, taxPct: 18 }])}>Write my own</button></div>
            : <LineItems items={f.items} setItems={(items) => set("items", items)} products={products} readOnly={locked} />}
          {f.items.length > 0 && (
            <div className="mt-3 flex flex-wrap items-start gap-3">
              {!locked && <div className="flex gap-2"><div><label className={labelCls}>Adjustment</label><input className="ui-input" style={{ width: 140 }} aria-label="Adjustment label" value={f.adjustmentLabel} onChange={(e) => set("adjustmentLabel", e.target.value)} title="e.g. Shipping, Round off" /></div><div><label className={labelCls}>₹</label><input type="number" step="any" className="ui-input" style={{ width: 100 }} aria-label="Adjustment amount" value={f.adjustment} onChange={(e) => set("adjustment", e.target.value)} /></div></div>}
              <Totals items={f.items} adjustment={f.adjustment} adjustmentLabel={f.adjustmentLabel} />
            </div>
          )}
        </Panel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>Terms</label><textarea className="ui-input w-full" disabled={locked} style={{ minHeight: 90, height: "auto", paddingTop: 6 }} value={f.terms} onChange={(e) => set("terms", e.target.value)} /></div>
          <div><label className={labelCls}>Note to customer</label><textarea className="ui-input w-full" disabled={locked} style={{ minHeight: 90, height: "auto", paddingTop: 6 }} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
        </div>
      </div>
      {send && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setSend(null)}>
          <div className="w-full max-w-md rounded-xl border bg-card shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-foreground">Send {q.quoteNo}</div>
            <Tabs value={send.channel} onChange={(v) => setSend({ ...send, channel: v })} tabs={[{ value: "email", label: "Email" }, { value: "link", label: "Copy link" }]} />
            {send.channel === "email" ? <>
              <div><label className={labelCls}>To *</label><input type="email" className="ui-input w-full" value={send.email} onChange={(e) => setSend({ ...send, email: e.target.value })} /></div>
              <div><label className={labelCls}>Message</label><textarea className="ui-input w-full" style={{ minHeight: 100, height: "auto", paddingTop: 6 }} value={send.message} onChange={(e) => setSend({ ...send, message: e.target.value })} /></div>
            </> : <div className="text-sm text-muted-foreground">The quotation is marked sent and its link is copied.{f.customer.phone && <> <a href={`${waLink(f.customer.phone)}?text=${encodeURIComponent(`Quotation ${q.quoteNo}: ${q.link}`)}`} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>Send on WhatsApp</a></>}</div>}
            <div className="flex justify-end gap-2"><button type="button" className="ui-btn ui-btn-outline" onClick={() => setSend(null)}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={busy || (send.channel === "email" && !send.email)} onClick={doSend}>{send.channel === "email" ? "Send" : "Copy & mark sent"}</button></div>
          </div>
        </div>
      )}
      {ask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setAsk(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-foreground">Ask approval for a {ask.pct}% discount</div>
            <div className="text-xs text-muted-foreground">Up to {ask.limit}% is allowed without approval.</div>
            <div><label className={labelCls}>Reason *</label><input className="ui-input w-full" autoFocus value={ask.reason} onChange={(e) => setAsk({ ...ask, reason: e.target.value })} /></div>
            <div className="flex justify-end gap-2"><button type="button" className="ui-btn ui-btn-outline" onClick={() => setAsk(null)}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={busy || !ask.reason.trim()} onClick={askApproval}>Ask for approval</button></div>
          </div>
        </div>
      )}
      {del && <Confirm title={`Delete ${q.quoteNo}?`} danger confirmLabel="Delete" busy={busy} onConfirm={remove} onCancel={() => setDel(false)} />}
    </Modal>
  );
}

export function Quotes() {
  const toast = useToast();
  const { can } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [q, setQ, term] = useSearch();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(() => sp.get("quote") || null);
  const list = useApi(() => salesApi.quotes({ q: term, status, page, perPage: 50 }), [term, status, page]);
  const rows = list.data || [];
  const stats = list.raw?.stats || {};
  useEffect(() => setPage(1), [term, status]);
  const close = () => { setOpen(null); if (sp.get("quote")) { sp.delete("quote"); setSp(sp, { replace: true }); } };
  async function exportAll() {
    try {
      const all = (await salesApi.quotes({ q: term, status, perPage: 200 })).data || [];
      await exportExcel(all.map((x) => ({ No: x.quoteNo, Customer: x.customer?.name, Company: x.company?.name || "", Subject: x.subject, Subtotal: x.subtotal, Discount: x.discountTotal, Tax: x.taxTotal, Total: x.total, Status: QUOTE_STATUS[x.expired ? "expired" : x.status].label, Created: formatDate(x.createdAt), "Valid till": x.validTill ? formatDate(x.validTill) : "", Views: x.views, Owner: x.owner })), "quotations");
    } catch (e) { toast(e.message, "error"); }
  }
  return (
    <div>
      <PageHeader title="Quotations" actions={<>
        <button type="button" className="ui-btn ui-btn-outline" disabled={!rows.length} onClick={exportAll}><i className="bi bi-file-earmark-excel"></i><span className="hidden sm:inline">Export Excel</span></button>
        {can("leads", "create") && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setOpen("new")}><i className="bi bi-plus-lg"></i>New quotation</button>}
      </>} />
      <Tabs value={status} onChange={setStatus} tabs={[
        { value: "", label: "All", count: Object.values(stats).reduce((a, x) => a + x.n, 0) },
        ...["draft", "sent", "accepted", "rejected"].map((k) => ({ value: k, label: QUOTE_STATUS[k].label, count: stats[k]?.n || 0 })),
        { value: "expired", label: "Expired" },
      ]} />
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SearchBox value={q} onChange={setQ} />
        <FilterSummary onClear={q ? () => setQ("") : undefined} text={list.loading ? "Loading…" : `${num.format(list.raw?.total || 0)} quotation${list.raw?.total === 1 ? "" : "s"}${stats.accepted ? ` · ${compactMoney(stats.accepted.value)} accepted` : ""}`} />
      </div>
      <ErrorBox error={list.error} />
      <div className="md:hidden space-y-2">
        {list.loading && !rows.length ? <Spinner /> : !rows.length ? <div className="rounded-xl border bg-card"><EmptyState icon="file-earmark-text" text="No quotations" /></div> : rows.map((x) => {
          const s = QUOTE_STATUS[x.expired ? "expired" : x.status];
          return <button key={x._id} type="button" className="w-full text-left rounded-xl border bg-card p-3" onClick={() => setOpen(x._id)}><div className="flex items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{x.quoteNo}</span><span className="text-sm font-semibold text-foreground truncate flex-1">{x.customer?.name}</span><Chip color={s.color}>{s.label}</Chip></div><div className="flex justify-between text-xs text-muted-foreground mt-1"><span>{formatDate(x.createdAt)}</span><span className="font-semibold text-foreground">{money(x.total)}</span></div></button>;
        })}
      </div>
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className={thead} style={{ background: "var(--muted-background)" }}><Th>No</Th><Th>Customer</Th><Th>Deal</Th><Th right>Total</Th><Th>Status</Th><Th>Valid till</Th><Th>Created</Th></tr></thead>
          <tbody>
            {list.loading && !rows.length ? <tr><td colSpan={99}><Spinner /></td></tr> : !rows.length ? <tr><td colSpan={99}><EmptyState icon="file-earmark-text" text="No quotations" /></td></tr> : rows.map((x) => {
              const s = QUOTE_STATUS[x.expired ? "expired" : x.status];
              return (
                <tr key={x._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setOpen(x._id)}>
                  <td className="px-3 py-2.5 font-mono text-xs">{x.quoteNo}</td>
                  <td className="px-3 py-2.5"><div className="font-medium text-foreground">{x.customer?.name}</div><div className="text-[11px] text-muted-foreground truncate" style={{ maxWidth: 240 }}>{x.subject}</div></td>
                  <td className="px-3 py-2.5">{x.deal ? `D-${x.deal.number}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{money(x.total)}</td>
                  <td className="px-3 py-2.5"><Chip color={s.color}>{s.label}</Chip>{x.views > 0 && x.status === "sent" && <i className="bi bi-eye ms-1 text-muted-foreground" title={`Opened ${x.views}×`}></i>}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{x.validTill ? formatDate(x.validTill) : "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(x.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div></div>
      <Pager page={page} pages={list.raw?.pages || 1} total={list.raw?.total || 0} unit="quotation" onPage={setPage} />
      {open && <QuoteEditor key={open} id={open === "new" ? null : open} onClose={close} onSaved={(r, how) => { list.reload(); if (how === "keep") return; if (r && (open === "new" || how === "open")) setOpen(r._id); else close(); }} />}
    </div>
  );
}
