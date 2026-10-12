import { useMemo, useState } from "react";
import { workflowsApi, workflowConfigApi, leadsApi, crmApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Modal, Chip, Tabs, Confirm } from "../components/ui";
import { formatDateTime } from "../utils/dateFormat";
import { PRIORITY, FU_TYPES, labelCls } from "../components/lead/leadUtils";

const UNITS = [["minutes", 1], ["hours", 60], ["days", 1440]];
const splitDelay = (mins) => { const m = Number(mins) || 0; if (m && m % 1440 === 0) return [m / 1440, "days"]; if (m && m % 60 === 0) return [m / 60, "hours"]; return [m, "minutes"]; };
const delayText = (mins) => { const [n, u] = splitDelay(mins); return n ? `after ${n} ${n === 1 ? u.slice(0, -1) : u}` : "at once"; };

// Ready-made rules to start from.
const STARTERS = [
  { name: "Welcome message for new leads", event: "lead.created", conditions: [], actions: [{ kind: "whatsapp", params: { message: "Hi {{first_name}}, thank you for your enquiry. {{owner}} will call you shortly." }, delayMinutes: 0 }] },
  { name: "Chase leads nobody has called", event: "lead.sla_breached", conditions: [], actions: [{ kind: "notify", params: { message: "{{name}} is still waiting for a first call", alsoManager: true }, delayMinutes: 0 }, { kind: "priority", params: { priority: "hot" }, delayMinutes: 0 }] },
  { name: "3-step nurture after enquiry", event: "lead.created", conditions: [], actions: [
    { kind: "whatsapp", params: { message: "Hi {{first_name}}, here are the details of {{course}} you asked about." }, delayMinutes: 60 },
    { kind: "followup", params: { type: "Call", note: "Check if {{first_name}} has questions", daysFromNow: 1 }, delayMinutes: 1440 },
    { kind: "whatsapp", params: { message: "Hi {{first_name}}, would you like to visit us this week?" }, delayMinutes: 4320 },
  ] },
  { name: "Thank the lead after payment", event: "payment.received", conditions: [], actions: [{ kind: "whatsapp", params: { message: "Thank you {{first_name}}, we have received your payment." }, delayMinutes: 0 }, { kind: "tag", params: { tag: "Paid" }, delayMinutes: 0 }] },
];
const BLANK = { name: "", type: "Alert", active: true, event: "lead.created", conditions: [], actions: [{ kind: "whatsapp", params: {}, delayMinutes: 0 }] };

export default function Automation() {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("setup", "edit");
  const [tab, setTab] = useState("rules");
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const rules = useApi(() => workflowsApi.list(), []);
  const cfg = useApi(() => workflowConfigApi.get(), []);
  const meta = useApi(() => leadsApi.meta(), []);
  const extra = useApi(() => crmApi.automationMeta(), []);
  const runs = useApi(() => (tab === "runs" ? crmApi.automationRuns() : Promise.resolve({ data: null })), [tab]);

  const alerts = (rules.data || []).filter((r) => r.type === "Alert");
  const events = cfg.data?.WORKFLOW_EVENTS || [];
  const eventLabel = (k) => events.find((e) => e.key === k)?.label || k;
  const actionLabel = (k) => (cfg.data?.ACTION_TYPES || []).find((a) => a.key === k)?.label || k;

  async function toggle(r) {
    try { await workflowsApi.update(r._id, { active: !r.active }); rules.reload(); }
    catch (e) { toast(e.message, "error"); }
  }

  return (
    <div>
      <PageHeader title="Automation"
        actions={canEdit && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setEditing(BLANK)}><i className="bi bi-plus-lg"></i>New rule</button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "rules", label: "Rules" }, { value: "runs", label: "Run log" }]} />
      <ErrorBox error={rules.error || cfg.error} />

      {tab === "rules" && (rules.loading && !rules.data ? <Spinner /> : (
        <div className="space-y-3">
          {!alerts.length && <div className="rounded-xl border bg-card"><EmptyState icon="lightning-charge" text="No rules yet. Start from one below." /></div>}
          {alerts.map((r) => (
            <div key={r._id} className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">When: {eventLabel(r.event)}{r.conditions?.length ? ` · ${r.conditions.length} condition${r.conditions.length === 1 ? "" : "s"}` : ""}</div>
                <div className="flex flex-wrap gap-1 mt-1.5">{(r.actions || []).map((a, i) => <Chip key={i} color="var(--primary)">{actionLabel(a.kind)} · {delayText(a.delayMinutes)}</Chip>)}</div>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-foreground"><input type="checkbox" checked={!!r.active} disabled={!canEdit} onChange={() => toggle(r)} />{r.active ? "On" : "Off"}</label>
              {canEdit && <>
                <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Edit" onClick={() => setEditing(r)}><i className="bi bi-pencil"></i></button>
                <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Delete" onClick={() => setRemoving(r)}><i className="bi bi-trash"></i></button>
              </>}
            </div>
          ))}
          {canEdit && (
            <div>
              <div className={labelCls}>Start from a ready-made rule</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STARTERS.map((s) => (
                  <button key={s.name} type="button" className="rounded-xl border bg-card p-3 text-left hover:bg-accent/30" onClick={() => setEditing({ ...BLANK, ...s })}>
                    <div className="text-sm font-medium text-foreground">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{eventLabel(s.event)} · {s.actions.length} step{s.actions.length === 1 ? "" : "s"}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {tab === "runs" && (runs.loading && !runs.data ? <Spinner /> : (
        <>
          {!!runs.data?.waiting && <div className="text-xs text-muted-foreground mb-2">{runs.data.waiting} delayed step{runs.data.waiting === 1 ? "" : "s"} waiting to run.</div>}
          <div className="rounded-xl border bg-card overflow-hidden">
            {!(runs.data?.runs || []).length ? <EmptyState icon="clock-history" text="Nothing has run yet." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-[11px] uppercase tracking-wider text-muted-foreground text-left" style={{ background: "var(--muted-background)" }}>
                    <th className="px-3 py-2.5 font-medium">When</th><th className="px-3 py-2.5 font-medium">Rule</th><th className="px-3 py-2.5 font-medium">Lead</th><th className="px-3 py-2.5 font-medium">Step</th><th className="px-3 py-2.5 font-medium">Result</th>
                  </tr></thead>
                  <tbody>{runs.data.runs.map((x) => (
                    <tr key={x._id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateTime(x.at)}</td>
                      <td className="px-3 py-2">{x.workflowName}</td>
                      <td className="px-3 py-2">{x.leadName}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{actionLabel(x.action)}</td>
                      <td className="px-3 py-2"><Chip color={x.ok ? "var(--success)" : "var(--destructive)"}>{x.ok ? "Done" : "Failed"}</Chip><span className="text-xs text-muted-foreground ms-2">{x.detail}</span></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ))}

      {editing && <RuleEditor rule={editing} cfg={cfg.data || {}} meta={meta.data || {}} extra={extra.data || {}} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); rules.reload(); }} />}
      {removing && <Confirm danger title={`Delete "${removing.name}"?`} confirmLabel="Delete" onCancel={() => setRemoving(null)}
        onConfirm={async () => { try { await workflowsApi.remove(removing._id); toast("Rule deleted"); setRemoving(null); rules.reload(); } catch (e) { toast(e.message, "error"); } }} />}
    </div>
  );
}

function RuleEditor({ rule, cfg, meta, extra, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(() => ({ ...rule, conditions: (rule.conditions || []).map((c) => ({ ...c })), actions: (rule.actions || []).map((a) => ({ ...a, params: { ...(a.params || {}) } })) }));
  const [saving, setSaving] = useState(false);
  const fields = cfg.CONDITION_FIELDS || [];
  const ops = cfg.CONDITION_OPERATORS || [];
  const actionTypes = cfg.ACTION_TYPES || [];

  const setCond = (i, patch) => setF((x) => ({ ...x, conditions: x.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const setAct = (i, patch) => setF((x) => ({ ...x, actions: x.actions.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const setParam = (i, k, v) => setF((x) => ({ ...x, actions: x.actions.map((a, j) => (j === i ? { ...a, params: { ...a.params, [k]: v } } : a)) }));

  // what a condition can be compared against, by the kind of field
  const choices = useMemo(() => ({
    "ref:LeadSource": (meta.sources || []).map((s) => [s._id, s.name]),
    "ref:LeadStatus": (meta.statuses || []).map((s) => [s._id, s.name]),
    "ref:SubStatus": (meta.subStatuses || []).map((s) => [s._id, s.name]),
    "ref:Service": (meta.services || []).map((s) => [s._id, s.name]),
    "ref:User": (meta.owners || []).map((o) => [o, o]),
  }), [meta]);
  const opsFor = (type) => ops.filter((o) => o.types.includes(type) || (type?.startsWith("ref:") && o.types.includes("ref:*")));

  async function save() {
    setSaving(true);
    try {
      const body = { name: f.name.trim(), type: "Alert", active: f.active !== false, event: f.event, conditions: f.conditions, actions: f.actions.map((a) => ({ kind: a.kind, params: a.params, delayMinutes: Number(a.delayMinutes) || 0 })) };
      if (f._id) await workflowsApi.update(f._id, body); else await workflowsApi.create(body);
      toast("Rule saved");
      onSaved();
    } catch (e) { toast(e.message, "error"); setSaving(false); }
  }

  const text = (i, k, placeholder, rows) => rows
    ? <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={rows} placeholder={placeholder} value={f.actions[i].params[k] || ""} onChange={(e) => setParam(i, k, e.target.value)} />
    : <input className="ui-input w-full" placeholder={placeholder} value={f.actions[i].params[k] || ""} onChange={(e) => setParam(i, k, e.target.value)} />;

  const paramInputs = (a, i) => {
    switch (a.kind) {
      case "whatsapp": return <>
        <select className="ui-input w-full" value={a.params.template || ""} onChange={(e) => setParam(i, "template", e.target.value)}>
          <option value="">Free text (only inside the 24-hour window)</option>
          {(extra.templates || []).filter((t) => (t.channel || "whatsapp") === "whatsapp").map((t) => <option key={t._id} value={t.name}>Template: {t.name}</option>)}
        </select>
        {!a.params.template && text(i, "message", "Message", 2)}
      </>;
      case "email": return <>{text(i, "subject", "Subject")}{text(i, "template", "Email text", 3)}</>;
      case "sms": return <>{text(i, "message", "SMS text", 2)}{text(i, "templateId", "DLT template id (if your gateway needs it)")}</>;
      case "notify": return <>{text(i, "message", "What to tell the owner")}<label className="flex items-center gap-2 text-xs text-foreground"><input type="checkbox" checked={!!a.params.alsoManager} onChange={(e) => setParam(i, "alsoManager", e.target.checked)} />Tell their manager too</label></>;
      case "followup": return <div className="grid grid-cols-[110px_90px_1fr] gap-2">
        <select className="ui-input w-full" value={a.params.type || "Call"} onChange={(e) => setParam(i, "type", e.target.value)}>{FU_TYPES.map((t) => <option key={t.value}>{t.value}</option>)}</select>
        <input className="ui-input w-full" type="number" min="1" title="Days from then" value={a.params.daysFromNow || 1} onChange={(e) => setParam(i, "daysFromNow", Number(e.target.value))} />
        {text(i, "note", "What to do")}
      </div>;
      case "status": return <select className="ui-input w-full" value={a.params.statusId || ""} onChange={(e) => setParam(i, "statusId", e.target.value)}><option value="">Choose a status</option>{(meta.statuses || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select>;
      case "assign_lead": return <select className="ui-input w-full" value={a.params.userId || ""} onChange={(e) => setParam(i, "userId", e.target.value)}><option value="">Choose a person</option>{(extra.users || []).map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select>;
      case "tag": return text(i, "tag", "Tag");
      case "priority": return <select className="ui-input w-full" value={a.params.priority || ""} onChange={(e) => setParam(i, "priority", e.target.value)}><option value="">Choose</option>{Object.entries(PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select>;
      default: return null;
    }
  };

  return (
    <Modal title={f._id ? "Edit rule" : "New rule"} size="lg" onClose={onClose}
      footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={saving || !f.name.trim() || !f.actions.length} onClick={save}>{saving ? "Saving…" : "Save rule"}</button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelCls}>Rule name *</label><input className="ui-input w-full" autoFocus value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} /></div>
          <div><label className={labelCls}>When this happens</label>
            <select className="ui-input w-full" value={f.event} onChange={(e) => setF((x) => ({ ...x, event: e.target.value }))}>{(cfg.WORKFLOW_EVENTS || []).map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select></div>
        </div>

        <section>
          <div className="flex items-center justify-between mb-1.5"><span className={labelCls + " mb-0"}>Only if</span>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setF((x) => ({ ...x, conditions: [...x.conditions, { field: "source", operator: "equals", value: "", logic: "and" }] }))}><i className="bi bi-plus-lg"></i>Condition</button></div>
          {!f.conditions.length && <div className="text-xs text-muted-foreground">Runs for every lead.</div>}
          {f.conditions.map((c, i) => {
            const type = fields.find((x) => x.key === c.field)?.type || "text";
            const list = choices[type];
            const noValue = c.operator === "is_empty" || c.operator === "is_not_empty";
            return (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_1fr_76px_32px] gap-2 mb-2 items-center">
                <select className="ui-input w-full" value={c.field} onChange={(e) => setCond(i, { field: e.target.value, value: "" })}>{fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
                <select className="ui-input w-full" value={c.operator} onChange={(e) => setCond(i, { operator: e.target.value })}>{opsFor(type).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
                {noValue ? <span /> : list ? (
                  <select className="ui-input w-full" value={c.value || ""} onChange={(e) => setCond(i, { value: e.target.value })}><option value="">Choose</option>{list.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                ) : <input className="ui-input w-full" type={type === "number" ? "number" : "text"} placeholder="Value" value={c.value ?? ""} onChange={(e) => setCond(i, { value: e.target.value })} />}
                {i < f.conditions.length - 1 ? <select className="ui-input w-full" value={c.logic || "and"} onChange={(e) => setCond(i, { logic: e.target.value })}><option value="and">and</option><option value="or">or</option></select> : <span />}
                <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Remove" onClick={() => setF((x) => ({ ...x, conditions: x.conditions.filter((_, j) => j !== i) }))}><i className="bi bi-x-lg"></i></button>
              </div>
            );
          })}
        </section>

        <section>
          <div className="flex items-center justify-between mb-1.5"><span className={labelCls + " mb-0"}>Then do</span>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setF((x) => ({ ...x, actions: [...x.actions, { kind: "whatsapp", params: {}, delayMinutes: 0 }] }))}><i className="bi bi-plus-lg"></i>Step</button></div>
          {f.actions.map((a, i) => {
            const [n, unit] = splitDelay(a.delayMinutes);
            const per = Object.fromEntries(UNITS)[unit];
            return (
              <div key={i} className="rounded-lg border p-2.5 mb-2 space-y-2">
                <div className="grid grid-cols-[1fr_70px_100px_32px] gap-2 items-center">
                  <select className="ui-input w-full" value={a.kind} onChange={(e) => setAct(i, { kind: e.target.value, params: {} })}>{actionTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
                  <input className="ui-input w-full" type="number" min="0" title="Wait before this step" value={n} onChange={(e) => setAct(i, { delayMinutes: (Number(e.target.value) || 0) * per })} />
                  <select className="ui-input w-full" value={unit} onChange={(e) => setAct(i, { delayMinutes: n * Object.fromEntries(UNITS)[e.target.value] })}>{UNITS.map(([u]) => <option key={u} value={u}>{u} later</option>)}</select>
                  <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Remove step" onClick={() => setF((x) => ({ ...x, actions: x.actions.filter((_, j) => j !== i) }))}><i className="bi bi-x-lg"></i></button>
                </div>
                {paramInputs(a, i)}
              </div>
            );
          })}
          <div className="text-[11px] text-muted-foreground">In messages: {"{{name}} {{first_name}} {{course}} {{city}} {{owner}}"}</div>
        </section>
      </div>
    </Modal>
  );
}
