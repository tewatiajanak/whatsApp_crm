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

const VARS = [["{{name}}", "Name"], ["{{first_name}}", "First name"], ["{{course}}", "Course"], ["{{city}}", "City"], ["{{owner}}", "Owner"]];
/** click a chip to put it where the cursor is */
function insertAt(id, token, value, set) {
  const el = document.getElementById(id);
  const at = el && typeof el.selectionStart === "number" ? el.selectionStart : (value || "").length;
  const end = el && typeof el.selectionEnd === "number" ? el.selectionEnd : at;
  const next = `${(value || "").slice(0, at)}${token}${(value || "").slice(end)}`;
  set(next);
  setTimeout(() => { if (el) { el.focus(); el.setSelectionRange(at + token.length, at + token.length); } }, 0);
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
  const moveStep = (i, d) => setF((x) => { const j = i + d; if (j < 0 || j >= x.actions.length) return x; const a = [...x.actions]; [a[i], a[j]] = [a[j], a[i]]; return { ...x, actions: a }; });

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

  /** a labelled box; message boxes get the variable chips */
  const text = (i, k, label, rows, { vars = false, hint } = {}) => {
    const id = `rule-${i}-${k}`;
    const value = f.actions[i].params[k] || "";
    return (
      <div>
        <label htmlFor={id} className={labelCls}>{label}</label>
        {rows
          ? <textarea id={id} className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={rows} value={value} onChange={(e) => setParam(i, k, e.target.value)} />
          : <input id={id} className="ui-input w-full" value={value} onChange={(e) => setParam(i, k, e.target.value)} />}
        {vars && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            <span className="text-[11px] text-muted-foreground me-0.5">Insert</span>
            {VARS.map(([t, l]) => <button key={t} type="button" className="ui-btn ui-btn-outline ui-btn-sm" style={{ height: 24, padding: "0 8px", fontSize: 11 }} title={t} onClick={() => insertAt(id, t, value, (v) => setParam(i, k, v))}>{l}</button>)}
          </div>
        )}
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </div>
    );
  };

  const paramInputs = (a, i) => {
    switch (a.kind) {
      case "whatsapp": return <>
        <div><label className={labelCls}>Message</label>
          <select className="ui-input w-full" value={a.params.template || ""} onChange={(e) => setParam(i, "template", e.target.value)}>
            <option value="">Free text</option>
            {(extra.templates || []).filter((t) => (t.channel || "whatsapp") === "whatsapp").map((t) => <option key={t._id} value={t.name}>Template: {t.name}</option>)}
          </select>
        </div>
        {!a.params.template && text(i, "message", "Text", 3, { vars: true, hint: "Free text reaches only leads who messaged you in the last 24 hours. Use a template for everyone." })}
      </>;
      case "email": return <>{text(i, "subject", "Subject", 0, { vars: true })}{text(i, "template", "Email text", 4, { vars: true })}</>;
      case "sms": return <>{text(i, "message", "SMS text", 3, { vars: true })}{text(i, "templateId", "DLT template ID", 0, { hint: "Only if your SMS gateway needs it" })}</>;
      case "notify": return <>{text(i, "message", "Message to the owner", 2, { vars: true })}<label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" className="form-check-input m-0" checked={!!a.params.alsoManager} onChange={(e) => setParam(i, "alsoManager", e.target.checked)} />Tell their manager too</label></>;
      case "followup": return <>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Type</label><select className="ui-input w-full" value={a.params.type || "Call"} onChange={(e) => setParam(i, "type", e.target.value)}>{FU_TYPES.map((t) => <option key={t.value}>{t.value}</option>)}</select></div>
          <div><label className={labelCls}>Due after (days)</label><input className="ui-input w-full" type="number" min="1" value={a.params.daysFromNow || 1} onChange={(e) => setParam(i, "daysFromNow", Number(e.target.value))} /></div>
        </div>
        {text(i, "note", "What to do")}
      </>;
      case "status": return <div><label className={labelCls}>New status</label><select className="ui-input w-full" value={a.params.statusId || ""} onChange={(e) => setParam(i, "statusId", e.target.value)}><option value="">Choose a status</option>{(meta.statuses || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>;
      case "assign_lead": return <div><label className={labelCls}>Give the lead to</label><select className="ui-input w-full" value={a.params.userId || ""} onChange={(e) => setParam(i, "userId", e.target.value)}><option value="">Choose a person</option>{(extra.users || []).map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select></div>;
      case "tag": return text(i, "tag", "Tag");
      case "priority": return <div><label className={labelCls}>Priority</label><select className="ui-input w-full" value={a.params.priority || ""} onChange={(e) => setParam(i, "priority", e.target.value)}><option value="">Choose</option>{Object.entries(PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></div>;
      default: return null;
    }
  };

  const eventLabel = (cfg.WORKFLOW_EVENTS || []).find((e) => e.key === f.event)?.label || "this happens";
  const sectionHead = (n, title, action) => (
    <div className="flex items-center justify-between mb-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="inline-flex h-6 w-6 items-center justify-center text-[11px] font-bold" style={{ borderRadius: 999, background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>{n}</span>{title}
      </span>
      {action}
    </div>
  );

  return (
    <Modal title={f._id ? "Edit rule" : "New rule"} size="wide" onClose={onClose}
      footer={<>
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer me-auto"><input type="checkbox" className="form-check-input m-0" checked={f.active !== false} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />Active</label>
        <button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn ui-btn-primary" disabled={saving || !f.name.trim() || !f.actions.length} onClick={save}>{saving ? "Saving…" : "Save rule"}</button>
      </>}>
      <div className="space-y-5">
        <div><label className={labelCls}>Rule name *</label><input className="ui-input w-full" autoFocus value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} /></div>

        <section>
          {sectionHead(1, "When")}
          <select className="ui-input w-full" aria-label="When this happens" value={f.event} onChange={(e) => setF((x) => ({ ...x, event: e.target.value }))}>{(cfg.WORKFLOW_EVENTS || []).map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select>
        </section>

        <section>
          {sectionHead(2, "Only if", <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setF((x) => ({ ...x, conditions: [...x.conditions, { field: "source", operator: "equals", value: "", logic: "and" }] }))}><i className="bi bi-plus-lg"></i>Condition</button>)}
          {!f.conditions.length ? <div className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">Every lead</div> : (
            <div className="space-y-2">
              {f.conditions.map((c, i) => {
                const type = fields.find((x) => x.key === c.field)?.type || "text";
                const list = choices[type];
                const noValue = c.operator === "is_empty" || c.operator === "is_not_empty";
                return (
                  <div key={i}>
                    <div className="rounded-lg border p-2 grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_32px] gap-2 items-center">
                      <select className="ui-input w-full" aria-label="Field" value={c.field} onChange={(e) => setCond(i, { field: e.target.value, value: "" })}>{fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
                      <select className="ui-input w-full" aria-label="Condition" value={c.operator} onChange={(e) => setCond(i, { operator: e.target.value })}>{opsFor(type).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
                      {noValue ? <span className="hidden sm:block" /> : list ? (
                        <select className="ui-input w-full" aria-label="Value" value={c.value || ""} onChange={(e) => setCond(i, { value: e.target.value })}><option value="">Choose</option>{list.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                      ) : <input className="ui-input w-full" aria-label="Value" title="Value" type={type === "number" ? "number" : "text"} value={c.value ?? ""} onChange={(e) => setCond(i, { value: e.target.value })} />}
                      <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost justify-self-end" title="Remove" onClick={() => setF((x) => ({ ...x, conditions: x.conditions.filter((_, j) => j !== i) }))}><i className="bi bi-x-lg"></i></button>
                    </div>
                    {i < f.conditions.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="inline-flex rounded-lg border p-0.5">{["and", "or"].map((l) => <button key={l} type="button" className={"ui-btn ui-btn-sm " + ((c.logic || "and") === l ? "ui-btn-primary" : "ui-btn-ghost")} style={{ height: 24 }} onClick={() => setCond(i, { logic: l })}>{l.toUpperCase()}</button>)}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          {sectionHead(3, "Then do", <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setF((x) => ({ ...x, actions: [...x.actions, { kind: "whatsapp", params: {}, delayMinutes: x.actions.length ? 60 : 0 }] }))}><i className="bi bi-plus-lg"></i>Step</button>)}
          {!f.actions.length && <div className="rounded-lg border border-dashed px-3 py-2.5 text-sm text-muted-foreground">Add at least one step</div>}
          <div className="space-y-0">
            {f.actions.map((a, i) => {
              const [n, unit] = splitDelay(a.delayMinutes);
              const later = Number(a.delayMinutes) > 0;
              return (
                <div key={i} className="relative">
                  {i > 0 && <div className="ms-5 h-3 border-s-2" style={{ borderColor: "var(--border)" }} />}
                  <div className="rounded-xl border bg-card">
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b" style={{ background: "var(--muted-background)", borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                      <span className="text-xs font-semibold text-muted-foreground">Step {i + 1}</span>
                      <select className="ui-input" style={{ width: 170 }} aria-label="Action" value={a.kind} onChange={(e) => setAct(i, { kind: e.target.value, params: {} })}>{actionTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
                      <select className="ui-input" style={{ width: 130 }} aria-label="When" value={later ? "later" : "now"} onChange={(e) => setAct(i, { delayMinutes: e.target.value === "later" ? 60 : 0 })}><option value="now">Right away</option><option value="later">After a wait</option></select>
                      {later && <>
                        <input className="ui-input" style={{ width: 70 }} type="number" min="1" aria-label="Wait" value={n} onChange={(e) => setAct(i, { delayMinutes: Math.max(1, Number(e.target.value) || 1) * Object.fromEntries(UNITS)[unit] })} />
                        <select className="ui-input" style={{ width: 100 }} aria-label="Unit" value={unit} onChange={(e) => setAct(i, { delayMinutes: n * Object.fromEntries(UNITS)[e.target.value] })}>{UNITS.map(([u]) => <option key={u} value={u}>{u}</option>)}</select>
                      </>}
                      <span className="ms-auto flex gap-0.5">
                        {f.actions.length > 1 && <>
                          <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Move up" disabled={i === 0} onClick={() => moveStep(i, -1)}><i className="bi bi-chevron-up"></i></button>
                          <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Move down" disabled={i === f.actions.length - 1} onClick={() => moveStep(i, 1)}><i className="bi bi-chevron-down"></i></button>
                        </>}
                        <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Remove step" onClick={() => setF((x) => ({ ...x, actions: x.actions.filter((_, j) => j !== i) }))}><i className="bi bi-trash"></i></button>
                      </span>
                    </div>
                    <div className="p-3 space-y-2.5">{paramInputs(a, i)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {f.name.trim() && f.actions.length > 0 && (
          <div className="rounded-lg px-3 py-2.5 text-sm" style={{ background: "color-mix(in srgb, var(--primary) 6%, transparent)", color: "var(--foreground)" }}>
            <i className="bi bi-lightning-charge me-1.5" style={{ color: "var(--primary)" }}></i>
            When <b>{eventLabel.toLowerCase()}</b>{f.conditions.length ? ` and ${f.conditions.length} condition${f.conditions.length === 1 ? "" : "s"} match` : ""}: {f.actions.map((a, i) => `${(actionTypes.find((t) => t.key === a.kind)?.label || a.kind).toLowerCase()} ${delayText(a.delayMinutes)}`).join(", then ")}.
          </div>
        )}
      </div>
    </Modal>
  );
}
