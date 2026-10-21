import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { crmApi, leadsApi } from "../api";
import { appStore } from "../api/appStore";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Chip, Modal, Confirm, Tabs, StatCard, FilterSummary } from "../components/ui";
import DateInput from "../components/DateInput";
import { formatDate, formatDateTime } from "../utils/dateFormat";
import { money, compactMoney, labelCls, isoDay } from "../components/lead/leadUtils";

const num = new Intl.NumberFormat("en-IN");
const copyText = (toast, text, what) => navigator.clipboard?.writeText(text).then(() => toast(`${what} copied`), () => toast("Could not copy", "error"));
const saveBlob = (blob, name) => { const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); };

/* ───────────── approvals: concessions, refunds and quotation discounts ───────────── */
const APPROVAL_KIND = { fee_discount: { label: "Fee concession", icon: "percent", color: "var(--warning)" }, refund: { label: "Refund", icon: "arrow-counterclockwise", color: "var(--destructive)" }, quote_discount: { label: "Quotation discount", icon: "file-earmark-text", color: "var(--info)" } };
const APPROVAL_STATUS = { pending: { label: "Waiting", color: "var(--warning)" }, approved: { label: "Approved", color: "var(--success)" }, rejected: { label: "Rejected", color: "var(--destructive)" }, cancelled: { label: "Withdrawn", color: "var(--muted-foreground)" } };
const what = (a) => (a.kind === "quote_discount" ? `${a.percent}% discount${a.amount ? ` · ${money(a.amount)}` : ""}` : a.kind === "refund" ? `${money(a.amount)} refund` : `${money(a.amount)} off`);

function ApprovalRules({ onClose }) {
  const toast = useToast();
  const r = useApi(() => crmApi.approvalRules(), []);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (r.data) setF(JSON.parse(JSON.stringify(r.data.rules))); }, [r.data]);
  const users = r.data?.users || [];
  const set = (k, patch) => setF((x) => ({ ...x, [k]: { ...x[k], ...patch } }));
  async function save() {
    setBusy(true);
    try { await crmApi.saveApprovalRules(f); toast("Approval rules saved"); onClose(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  const Users = ({ value, onChange }) => (
    <div className="flex flex-wrap gap-1.5">
      {users.map((u) => { const on = (value || []).includes(u); return <button key={u} type="button" className={"ui-btn ui-btn-sm " + (on ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => onChange(on ? value.filter((x) => x !== u) : [...(value || []), u])}>{on && <i className="bi bi-check-lg"></i>}{u}</button>; })}
    </div>
  );
  const block = (key, title, unit) => (
    <div className="rounded-xl border p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><i className={`bi bi-${APPROVAL_KIND[key].icon}`} style={{ color: APPROVAL_KIND[key].color }}></i>{title}</span>
        {key !== "fee_discount" && <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" className="form-check-input m-0" checked={!!f[key].enabled} onChange={(e) => set(key, { enabled: e.target.checked })} />Needs approval</label>}
      </div>
      {(key === "fee_discount" || f[key].enabled) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {key === "quote_discount"
            ? <div><label className={labelCls}>Allowed without approval (%)</label><input type="number" min="0" max="100" className="ui-input w-full" value={f[key].maxPct} onChange={(e) => set(key, { maxPct: e.target.value })} /></div>
            : <div><label className={labelCls}>Approve on its own up to (₹)</label><input type="number" min="0" className="ui-input w-full" value={f[key].autoUpTo || ""} onChange={(e) => set(key, { autoUpTo: e.target.value })} /></div>}
          <div><label className={labelCls}>Second approver above ({unit})</label><input type="number" min="0" className="ui-input w-full" value={f[key].level2Above || ""} onChange={(e) => set(key, { level2Above: e.target.value })} /></div>
          {Number(f[key].level2Above) > 0 && <div className="sm:col-span-2"><label className={labelCls}>Second approvers</label><Users value={f[key].level2Users} onChange={(v) => set(key, { level2Users: v })} />{!(f[key].level2Users || []).length && <div className="text-[11px] text-muted-foreground mt-1">None picked: CRM admins approve</div>}</div>}
        </div>
      )}
    </div>
  );
  return (
    <Modal size="wide" title="Approval rules" onClose={onClose} footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={busy || !f} onClick={save}>{busy ? "Saving…" : "Save"}</button></>}>
      {!f ? <Spinner /> : (
        <div className="space-y-3">
          <div className="rounded-xl border p-3">
            <div className="text-sm font-semibold text-foreground mb-1">First approvers</div>
            <div className="text-[11px] text-muted-foreground mb-2">The requester's reporting manager and CRM admins always can. Add more:</div>
            <Users value={f.approvers} onChange={(v) => setF((x) => ({ ...x, approvers: v }))} />
          </div>
          {block("fee_discount", "Fee concession", "₹")}
          {block("refund", "Refund", "₹")}
          {block("quote_discount", "Quotation discount", "%")}
        </div>
      )}
    </Modal>
  );
}

export function Approvals() {
  const toast = useToast();
  const { can } = useAuth();
  const [box, setBox] = useState("mine");
  const [status, setStatus] = useState("pending");
  const [kind, setKind] = useState("");
  const [picked, setPicked] = useState([]);
  const [deciding, setDeciding] = useState(null); // { ids, approve, note, title }
  const [busy, setBusy] = useState(false);
  const [rules, setRules] = useState(false);
  const list = useApi(() => crmApi.approvals(box === "all" ? status : box === "mine" ? "" : status, { box: box === "all" ? "" : box, kind }), [box, status, kind]);
  const items = list.data?.items || [];
  const counts = list.data?.counts || {};
  const decidable = items.filter((a) => a.canDecide);

  async function decide() {
    const { ids, approve, note } = deciding;
    if (!approve && !note.trim()) return toast("Say why it is rejected", "error");
    setBusy(true);
    try {
      if (ids.length === 1) await crmApi.decideApproval(ids[0], approve, note);
      else { const r = await crmApi.bulkDecide(ids, approve, note); if (r.data.failed.length) toast(`${r.data.failed.length} could not be decided: ${r.data.failed[0].error}`, "error"); }
      toast(approve ? (ids.length > 1 ? `${ids.length} approved` : "Approved") : "Rejected");
      setDeciding(null); setPicked([]); list.reload();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  async function cancel(a) {
    try { await crmApi.cancelApproval(a._id); toast("Request withdrawn"); list.reload(); } catch (e) { toast(e.message, "error"); }
  }

  return (
    <div>
      <PageHeader title="Approvals" actions={can("setup", "edit") && <button type="button" className="ui-btn ui-btn-outline" onClick={() => setRules(true)}><i className="bi bi-sliders"></i>Rules</button>} />
      <Tabs value={box} onChange={(v) => { setBox(v); setPicked([]); }} tabs={[{ value: "mine", label: "For me", count: counts.mine || 0 }, { value: "requested", label: "My requests", count: counts.requested || 0 }, { value: "all", label: "All" }]} />
      <div className="flex flex-wrap items-center gap-3 mb-3">
        {box !== "mine" && <select className="ui-input min-w-[130px]" style={{ width: "auto" }} aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{Object.entries(APPROVAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>}
        <select className="ui-input min-w-[160px]" style={{ width: "auto" }} aria-label="Type" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">All types</option>{Object.entries(APPROVAL_KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        {decidable.length > 1 && <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" className="form-check-input m-0" checked={picked.length === decidable.length} onChange={(e) => setPicked(e.target.checked ? decidable.map((a) => a._id) : [])} />Select all</label>}
        {picked.length > 0 && <>
          <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setDeciding({ ids: picked, approve: true, note: "", title: `Approve ${picked.length} requests?` })}><i className="bi bi-check-lg"></i>Approve {picked.length}</button>
          <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setDeciding({ ids: picked, approve: false, note: "", title: `Reject ${picked.length} requests?` })}>Reject</button>
        </>}
        <FilterSummary text={list.loading ? "Loading…" : `${items.length} request${items.length === 1 ? "" : "s"}`} />
      </div>
      <ErrorBox error={list.error} />
      {list.loading && !list.data ? <Spinner /> : !items.length ? (
        <div className="rounded-xl border bg-card"><EmptyState icon="patch-check" text={box === "mine" ? "Nothing waiting for you" : "No requests"} /></div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const k = APPROVAL_KIND[a.kind] || APPROVAL_KIND.fee_discount;
            const st = APPROVAL_STATUS[a.status] || APPROVAL_STATUS.pending;
            return (
              <div key={a._id} className="rounded-xl border bg-card p-3 flex flex-wrap items-start gap-3">
                {a.canDecide && <input type="checkbox" className="form-check-input mt-2.5" aria-label="Select" checked={picked.includes(a._id)} onChange={(e) => setPicked(e.target.checked ? [...picked, a._id] : picked.filter((x) => x !== a._id))} />}
                <span className="inline-flex h-9 w-9 items-center justify-center flex-shrink-0" style={{ borderRadius: 8, background: `color-mix(in srgb, ${k.color} 12%, transparent)`, color: k.color }}><i className={`bi bi-${k.icon}`}></i></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.link ? <Link to={a.link} className="text-sm font-semibold text-foreground hover:underline">{a.leadName || a.entityTitle}</Link> : <span className="text-sm font-semibold text-foreground">{a.leadName || a.entityTitle}</span>}
                    <Chip color={k.color}>{k.label}</Chip>
                    <span className="text-sm font-semibold text-foreground">{what(a)}</span>
                    <Chip color={st.color}>{st.label}{a.status === "pending" && a.levels > 1 ? ` · step ${a.level} of ${a.levels}` : ""}</Chip>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{a.feeTitle || a.entityTitle} · asked by {a.requestedBy} · {formatDateTime(a.createdAt)}</div>
                  {a.reason && <div className="text-sm text-foreground mt-1">"{a.reason}"</div>}
                  {(a.trail || []).length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                      {a.trail.map((t, i) => <span key={i} className="text-[11px]" style={{ color: t.status === "approved" ? "var(--success)" : "var(--destructive)" }}><i className={`bi bi-${t.status === "approved" ? "check-circle" : "x-circle"} me-1`}></i>{t.by} · {formatDateTime(t.at)}{t.note ? ` · ${t.note}` : ""}</span>)}
                    </div>
                  )}
                  {a.status === "pending" && a.waitingOn?.length > 0 && !a.canDecide && <div className="text-[11px] text-muted-foreground mt-1"><i className="bi bi-hourglass-split me-1"></i>Waiting on {a.waitingOn.join(", ")}</div>}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  {a.canDecide && <>
                    <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setDeciding({ ids: [a._id], approve: false, note: "", title: `Reject ${what(a)} for ${a.leadName || a.entityTitle}?` })}>Reject</button>
                    <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setDeciding({ ids: [a._id], approve: true, note: "", title: `Approve ${what(a)} for ${a.leadName || a.entityTitle}?` })}><i className="bi bi-check-lg"></i>Approve</button>
                  </>}
                  {a.canCancel && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => cancel(a)}>Withdraw</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {deciding && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setDeciding(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-foreground">{deciding.title}</div>
            <div><label className={labelCls}>{deciding.approve ? "Note" : "Reason *"}</label><input className="ui-input w-full" autoFocus value={deciding.note} onChange={(e) => setDeciding((d) => ({ ...d, note: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && decide()} /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className="ui-btn ui-btn-outline" disabled={busy} onClick={() => setDeciding(null)}>Cancel</button>
              <button type="button" className={"ui-btn " + (deciding.approve ? "ui-btn-primary" : "ui-btn-danger")} disabled={busy || (!deciding.approve && !deciding.note.trim())} onClick={decide}>{busy ? "Working…" : deciding.approve ? "Approve" : "Reject"}</button>
            </div>
          </div>
        </div>
      )}
      {rules && <ApprovalRules onClose={() => { setRules(false); list.reload(); }} />}
    </div>
  );
}

/* ───────────── referral partners and their commission ───────────── */
export function Partners() {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("setup", "edit");
  const list = useApi(() => crmApi.master("partners"), []);
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);
  const [removing, setRemoving] = useState(null);
  const rows = list.data || [];

  async function save() {
    try {
      const body = { name: editing.name, phone: editing.phone, email: editing.email, commissionType: editing.commissionType, rate: Number(editing.rate) || 0, code: editing.code };
      if (editing._id) await crmApi.updateMaster("partners", editing._id, body); else await crmApi.createMaster("partners", body);
      toast("Partner saved"); setEditing(null); list.reload();
    } catch (e) { toast(e.message, "error"); }
  }
  const refLink = (p) => `${window.location.origin}/?ref=${p.code}`;

  return (
    <div>
      <PageHeader title="Referral partners"
        actions={canEdit && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setEditing({ name: "", phone: "", email: "", commissionType: "per_win", rate: "", code: "" })}><i className="bi bi-plus-lg"></i>Add partner</button>} />
      <ErrorBox error={list.error} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <StatCard label="Partners" value={rows.length} icon="people" />
        <StatCard label="Leads referred" value={num.format(rows.reduce((a, p) => a + p.leads, 0))} icon="flag" tone="info" />
        <StatCard label="Won" value={num.format(rows.reduce((a, p) => a + p.won, 0))} icon="trophy" tone="success" />
        <StatCard label="Commission due" value={compactMoney(rows.reduce((a, p) => a + p.due, 0))} icon="cash-coin" tone="warning" />
      </div>
      {list.loading && !list.data ? <Spinner /> : !rows.length ? <div className="rounded-xl border bg-card"><EmptyState icon="people" text="No partners yet." /></div> : (
        <div className="space-y-2">
          {rows.map((p) => (
            <div key={p._id} className="rounded-xl border bg-card p-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-foreground">{p.name}</span><span className="text-xs font-mono text-muted-foreground">{p.code}</span>{!p.active && <Chip>Off</Chip>}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{p.commissionType === "percent_paid" ? `${p.rate}% of fees received` : `${money(p.rate)} per admission`}{p.phone ? ` · ${p.phone}` : ""}</div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap"><span className="font-semibold text-foreground">{p.leads}</span> leads · <span className="font-semibold text-foreground">{p.won}</span> won · earned {money(p.earned)} · <span style={{ color: p.due ? "var(--warning)" : undefined }}>due {money(p.due)}</span></div>
              <div className="flex gap-1.5 justify-end">
                <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Copy referral link" onClick={() => copyText(toast, refLink(p), "Referral link")}><i className="bi bi-link-45deg"></i></button>
                <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Copy the partner's own status page" onClick={() => copyText(toast, p.link, "Partner page link")}><i className="bi bi-person-badge"></i></button>
                {canEdit && p.due > 0 && <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setPaying({ p, amount: p.due })}>Pay out</button>}
                {canEdit && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Edit" onClick={() => setEditing({ ...p })}><i className="bi bi-pencil"></i></button>}
                {canEdit && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Delete" onClick={() => setRemoving(p)}><i className="bi bi-trash"></i></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing._id ? "Edit partner" : "Add partner"} onClose={() => setEditing(null)}
          footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={!editing.name.trim()} onClick={save}>Save</button></>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[["name", "Name *"], ["phone", "Phone"], ["email", "Email"]].map(([k, label]) => <div key={k}><label className={labelCls}>{label}</label><input className="ui-input w-full" value={editing[k] || ""} onChange={(e) => setEditing((x) => ({ ...x, [k]: e.target.value }))} /></div>)}
            {!editing._id && <div><label className={labelCls}>Referral code</label><input className="ui-input w-full" title="Made for you if left blank" value={editing.code} onChange={(e) => setEditing((x) => ({ ...x, code: e.target.value.toUpperCase() }))} /></div>}
            <div><label className={labelCls}>Commission</label>
              <select className="ui-input w-full" value={editing.commissionType} onChange={(e) => setEditing((x) => ({ ...x, commissionType: e.target.value }))}><option value="per_win">Fixed amount per admission</option><option value="percent_paid">% of fees received</option></select></div>
            <div><label className={labelCls}>{editing.commissionType === "percent_paid" ? "Percent" : "Amount (₹)"}</label><input className="ui-input w-full" type="number" min="0" value={editing.rate} onChange={(e) => setEditing((x) => ({ ...x, rate: e.target.value }))} /></div>
          </div>
        </Modal>
      )}
      {paying && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setPaying(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-foreground">Commission paid to {paying.p.name}</div>
            <input className="ui-input w-full" type="number" min="1" autoFocus value={paying.amount} onChange={(e) => setPaying((x) => ({ ...x, amount: e.target.value }))} />
            <div className="flex justify-end gap-2">
              <button type="button" className="ui-btn ui-btn-outline" onClick={() => setPaying(null)}>Cancel</button>
              <button type="button" className="ui-btn ui-btn-primary" disabled={!(Number(paying.amount) > 0)} onClick={async () => { try { await crmApi.updateMaster("partners", paying.p._id, { payout: Number(paying.amount) }); toast("Payout recorded"); setPaying(null); list.reload(); } catch (e) { toast(e.message, "error"); } }}>Record payout</button>
            </div>
          </div>
        </div>
      )}
      {removing && <Confirm danger title={`Delete ${removing.name}?`} text="Their leads stay, without the referral." confirmLabel="Delete" onCancel={() => setRemoving(null)}
        onConfirm={async () => { try { await crmApi.removeMaster("partners", removing._id); setRemoving(null); list.reload(); } catch (e) { toast(e.message, "error"); } }} />}
    </div>
  );
}

/* ───────────── report builder ───────────── */
const savedReports = () => { try { return JSON.parse(appStore.getItem("cols.crm-reports")) || []; } catch { return []; } };

export function Reports() {
  const toast = useToast();
  const [cfg, setCfg] = useState({ groupBy: "source", groupBy2: "", createdFrom: isoDay(-29), createdTo: isoDay(0), owner: "", source: "", view: "" });
  const [saved, setSaved] = useState(savedReports);
  const [name, setName] = useState(null);
  const params = useMemo(() => Object.fromEntries(Object.entries(cfg).filter(([, v]) => v)), [cfg]);
  const meta = useApi(() => leadsApi.meta(), []);
  const report = useApi(() => crmApi.report(params), [params]);
  const d = report.data;
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const rows = d?.rows || [];
  const total = rows.reduce((a, r) => ({ leads: a.leads + r.leads, open: a.open + r.open, won: a.won + r.won, lost: a.lost + r.lost, value: a.value + r.value, wonValue: a.wonValue + r.wonValue }), { leads: 0, open: 0, won: 0, lost: 0, value: 0, wonValue: 0 });
  const max = Math.max(1, ...rows.map((r) => r.leads));
  const store = (next) => { setSaved(next); appStore.setItem("cols.crm-reports", JSON.stringify(next)); };

  return (
    <div>
      <PageHeader title="Report builder"
        actions={<>
          <button type="button" className="ui-btn ui-btn-outline" onClick={async () => { try { saveBlob(await crmApi.reportCsv(params), `lead-report-${isoDay(0)}.csv`); } catch (e) { toast(e.message, "error"); } }}><i className="bi bi-download"></i>Export</button>
          {name === null
            ? <button type="button" className="ui-btn ui-btn-outline" onClick={() => setName("")}><i className="bi bi-bookmark-plus"></i>Save</button>
            : <span className="inline-flex gap-1"><input className="ui-input" style={{ width: 150 }} autoFocus aria-label="Report name" title="Report name" value={name} onChange={(e) => setName(e.target.value)} />
                <button type="button" className="ui-btn ui-btn-primary" disabled={!name.trim()} onClick={() => { store([...saved.filter((x) => x.name !== name.trim()), { name: name.trim(), cfg }]); setName(null); }}>Save</button></span>}
        </>} />
      {!!saved.length && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {saved.map((x, i) => (
            <span key={x.name} className="inline-flex">
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setCfg(x.cfg)}><i className="bi bi-bookmark"></i>{x.name}</button>
              <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title={`Remove ${x.name}`} onClick={() => store(saved.filter((_, j) => j !== i))}><i className="bi bi-x"></i></button>
            </span>
          ))}
        </div>
      )}
      <div className="rounded-xl border bg-card p-3 mb-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 items-end">
        <div><label className={labelCls}>Group by</label><select className="ui-input w-full" value={cfg.groupBy} onChange={(e) => set("groupBy", e.target.value)}>{(d?.groups || [{ key: cfg.groupBy, label: cfg.groupBy }]).map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select></div>
        <div><label className={labelCls}>Then by</label><select className="ui-input w-full" value={cfg.groupBy2} onChange={(e) => set("groupBy2", e.target.value)}><option value="">—</option>{(d?.groups || []).filter((g) => g.key !== cfg.groupBy).map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select></div>
        <div><label className={labelCls}>Created from</label><DateInput className="ui-input w-full" value={cfg.createdFrom} onChange={(e) => set("createdFrom", e.target.value)} /></div>
        <div><label className={labelCls}>Created to</label><DateInput className="ui-input w-full" value={cfg.createdTo} onChange={(e) => set("createdTo", e.target.value)} /></div>
        <div><label className={labelCls}>Owner</label><select className="ui-input w-full" value={cfg.owner} onChange={(e) => set("owner", e.target.value)}><option value="">Everyone</option>{(meta.data?.visibleOwners || []).map((o) => <option key={o}>{o}</option>)}</select></div>
        <div><label className={labelCls}>Source</label><select className="ui-input w-full" value={cfg.source} onChange={(e) => set("source", e.target.value)}><option value="">All</option>{(meta.data?.sources || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
        <div><label className={labelCls}>Leads</label><select className="ui-input w-full" value={cfg.view} onChange={(e) => set("view", e.target.value)}><option value="">All</option><option value="open">Open</option><option value="won">Won</option><option value="lost">Lost</option></select></div>
      </div>
      <ErrorBox error={report.error} />
      {report.loading && !d ? <Spinner /> : !rows.length ? <div className="rounded-xl border bg-card"><EmptyState icon="table" text="No leads match." /></div> : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className="px-3 py-2.5 font-medium text-left">{d.groups.find((g) => g.key === d.groupBy)?.label}</th>
                {d.groupBy2 && <th className="px-3 py-2.5 font-medium text-left">{d.groups.find((g) => g.key === d.groupBy2)?.label}</th>}
                {["Leads", "", "Open", "Won", "Lost", "Conversion", "Pipeline", "Won value", "Avg score"].map((h, i) => <th key={i} className="px-3 py-2.5 font-medium text-right whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">{r.a}</td>
                    {d.groupBy2 && <td className="px-3 py-2 text-muted-foreground">{r.b}</td>}
                    <td className="px-3 py-2 text-right font-medium">{r.leads}</td>
                    <td className="px-3 py-2" style={{ width: 110 }}><span className="block h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted-background)" }}><span className="block h-full" style={{ width: `${(r.leads / max) * 100}%`, background: "var(--primary)" }} /></span></td>
                    <td className="px-3 py-2 text-right">{r.open}</td><td className="px-3 py-2 text-right">{r.won}</td><td className="px-3 py-2 text-right">{r.lost}</td>
                    <td className="px-3 py-2 text-right">{r.conversion}%</td><td className="px-3 py-2 text-right">{compactMoney(r.value)}</td><td className="px-3 py-2 text-right">{compactMoney(r.wonValue)}</td><td className="px-3 py-2 text-right">{r.avgScore}</td>
                  </tr>
                ))}
                <tr className="border-t font-semibold" style={{ background: "var(--muted-background)" }}>
                  <td className="px-3 py-2" colSpan={d.groupBy2 ? 2 : 1}>Total</td>
                  <td className="px-3 py-2 text-right">{total.leads}</td><td></td><td className="px-3 py-2 text-right">{total.open}</td><td className="px-3 py-2 text-right">{total.won}</td><td className="px-3 py-2 text-right">{total.lost}</td>
                  <td className="px-3 py-2 text-right">{total.leads ? ((total.won / total.leads) * 100).toFixed(1) : 0}%</td><td className="px-3 py-2 text-right">{compactMoney(total.value)}</td><td className="px-3 py-2 text-right">{compactMoney(total.wonValue)}</td><td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── recycle bin ───────────── */
export function RecycleBin({ onClose, onChanged }) {
  const toast = useToast();
  const bin = useApi(() => crmApi.trash(), []);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(null);

  async function restore(t) {
    setBusy(t._id);
    try { await crmApi.restoreLead(t._id); toast(`${t.name} restored`); bin.reload(); onChanged?.(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(null); }
  }

  return (
    <>
      <Modal title="Recycle bin" onClose={onClose}>
        <ErrorBox error={bin.error} />
        {bin.loading && !bin.data ? <Spinner /> : !(bin.data?.items || []).length ? <EmptyState icon="trash" text="The recycle bin is empty." /> : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Deleted leads are kept for {bin.data.keepDays} days.</div>
            {bin.data.items.map((t) => (
              <div key={t._id} className="rounded-lg border p-2.5 flex items-center gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground">{t.phone} · {t.owner || "Unassigned"} · deleted by {t.deletedBy} · {formatDateTime(t.deletedAt)}</div>
                </div>
                <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy === t._id} onClick={() => restore(t)}>{busy === t._id ? "Restoring…" : "Restore"}</button>
                <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Delete for good" onClick={() => setRemoving(t)}><i className="bi bi-x-lg"></i></button>
              </div>
            ))}
          </div>
        )}
      </Modal>
      {removing && <Confirm danger title={`Delete ${removing.name} for good?`} text="This cannot be undone." confirmLabel="Delete for good" onCancel={() => setRemoving(null)}
        onConfirm={async () => { try { await crmApi.purgeLead(removing._id); setRemoving(null); bin.reload(); } catch (e) { toast(e.message, "error"); } }} />}
    </>
  );
}
