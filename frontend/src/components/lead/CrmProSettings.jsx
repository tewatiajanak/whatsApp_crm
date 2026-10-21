import { useState } from "react";
import { crmApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { Panel, Spinner, EmptyState, Chip, Confirm, Modal } from "../ui";
import { labelCls } from "./leadUtils";

// CRM settings tabs: custom activity types, lead scoring, query categories.

const FIELD_TYPES = [["text", "Text"], ["number", "Number"], ["date", "Date"], ["select", "Dropdown"], ["yesno", "Yes / No"]];
const ICONS = ["lightning", "building", "people", "camera-video", "telephone", "geo-alt", "mortarboard", "file-earmark-text", "cash-coin", "calendar-event", "chat-dots", "star"];
const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#8b5cf6", "#ec4899", "#64748b"];

export function ActivityTypesTab({ canEdit }) {
  const toast = useToast();
  const types = useApi(() => crmApi.activityTypes(), []);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const blankField = () => ({ label: "", type: "text", options: "", required: false });

  async function save() {
    try {
      const body = { name: editing.name, icon: editing.icon, color: editing.color, points: Number(editing.points) || 0, fields: editing.fields.filter((f) => f.label.trim()).map((f) => ({ ...f, options: typeof f.options === "string" ? f.options.split(",").map((o) => o.trim()).filter(Boolean) : f.options })) };
      if (editing._id) await crmApi.updateActivityType(editing._id, body); else await crmApi.createActivityType(body);
      toast("Activity type saved"); setEditing(null); types.reload();
    } catch (e) { toast(e.message, "error"); }
  }
  const setField = (i, k, v) => setEditing((x) => ({ ...x, fields: x.fields.map((f, j) => (j === i ? { ...f, [k]: v } : f)) }));
  const toggle = async (t) => { try { await crmApi.updateActivityType(t._id, { active: t.active === false }); types.reload(); } catch (e) { toast(e.message, "error"); } };

  return <>
    <Panel title="Activity types" actions={canEdit && <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setEditing({ name: "", icon: "lightning", color: COLORS[0], points: 5, fields: [] })}><i className="bi bi-plus-lg"></i>Add</button>} bodyClass="p-0">
      {types.loading && !types.data ? <Spinner /> : !(types.data || []).length ? <EmptyState icon="lightning" text="No activity types yet." /> : types.data.map((t) => (
        <div key={t._id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-b last:border-b-0" style={{ opacity: t.active === false ? 0.55 : 1 }}>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border" style={{ color: t.color }}><i className={`bi bi-${t.icon}`}></i></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">{t.name} {!!t.points && <span className="text-xs font-normal text-muted-foreground">· {t.points > 0 ? "+" : ""}{t.points} pts</span>}</div>
            <div className="text-[11px] text-muted-foreground">{t.fields.length ? t.fields.map((f) => f.label).join(", ") : "No fields"} · logged {t.logged}×</div>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-foreground"><input type="checkbox" checked={t.active !== false} disabled={!canEdit} onChange={() => toggle(t)} />Active</label>
          {canEdit && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Edit" onClick={() => setEditing({ ...t, fields: t.fields.map((f) => ({ ...f, options: (f.options || []).join(", ") })) })}><i className="bi bi-pencil"></i></button>}
          {canEdit && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Delete" onClick={() => setRemoving(t)}><i className="bi bi-trash"></i></button>}
        </div>
      ))}
    </Panel>

    {editing && (
      <Modal size="lg" title={editing._id ? "Edit activity type" : "New activity type"} onClose={() => setEditing(null)}
        footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={!editing.name.trim() || editing.fields.some((f) => f.label.trim() && f.type === "select" && !String(f.options).trim())} onClick={save}>Save</button></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
            <div><label className={labelCls}>Name *</label><input className="ui-input w-full" autoFocus value={editing.name} onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} /></div>
            <div><label className={labelCls}>Score points</label><input className="ui-input w-full" type="number" min="-50" max="50" value={editing.points} onChange={(e) => setEditing((x) => ({ ...x, points: e.target.value }))} /></div>
          </div>
          <div>
            <label className={labelCls}>Icon</label>
            <div className="flex flex-wrap gap-1.5">{ICONS.map((i) => <button key={i} type="button" className={"ui-btn ui-btn-sm ui-btn-icon " + (editing.icon === i ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => setEditing((x) => ({ ...x, icon: i }))} aria-label={i}><i className={`bi bi-${i}`}></i></button>)}</div>
          </div>
          <div>
            <label className={labelCls}>Colour</label>
            <div className="flex flex-wrap gap-1.5">{COLORS.map((c) => <button key={c} type="button" className="h-7 w-7 rounded-full border-2" style={{ background: c, borderColor: editing.color === c ? "var(--foreground)" : "transparent" }} onClick={() => setEditing((x) => ({ ...x, color: c }))} aria-label={c}></button>)}</div>
          </div>
          <div>
            <label className={labelCls}>Fields</label>
            <div className="space-y-2">
              {editing.fields.map((f, i) => (
                <div key={i} className="rounded-lg border p-2 space-y-2">
                  <div className="grid grid-cols-[1fr_120px_auto_auto] gap-2 items-center">
                    <input className="ui-input w-full" aria-label="Field name" aria-label="Field name" title="Field name" value={f.label} onChange={(e) => setField(i, "label", e.target.value)} />
                    <select className="ui-input w-full" value={f.type} onChange={(e) => setField(i, "type", e.target.value)}>{FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    <label className="flex items-center gap-1 text-xs text-foreground whitespace-nowrap"><input type="checkbox" checked={!!f.required} onChange={(e) => setField(i, "required", e.target.checked)} />Required</label>
                    <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Remove field" onClick={() => setEditing((x) => ({ ...x, fields: x.fields.filter((_, j) => j !== i) }))}><i className="bi bi-x-lg"></i></button>
                  </div>
                  {f.type === "select" && <input className="ui-input w-full" aria-label="Choices" aria-label="Choices" title="Choices, comma separated" value={f.options} onChange={(e) => setField(i, "options", e.target.value)} />}
                </div>
              ))}
              {editing.fields.length < 15 && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setEditing((x) => ({ ...x, fields: [...x.fields, blankField()] }))}><i className="bi bi-plus"></i>Add field</button>}
            </div>
          </div>
        </div>
      </Modal>
    )}
    {removing && <Confirm danger title={`Delete "${removing.name}"?`} text={removing.logged ? "It has been logged before, so it is switched off and its history stays." : "This cannot be undone."} confirmLabel={removing.logged ? "Switch off" : "Delete"} onCancel={() => setRemoving(null)}
      onConfirm={async () => { try { await crmApi.removeActivityType(removing._id); setRemoving(null); types.reload(); } catch (e) { toast(e.message, "error"); } }} />}
  </>;
}

const SCORE_ROWS = [
  ["Profile", [["email", "Has email"], ["course", "Has course"], ["city", "Has city"], ["source", "Has source"]]],
  ["Progress", [["stageMax", "Furthest stage"], ["perEngagement", "Per call / message / note"], ["engagementMax", "Engagement cap"], ["activityMax", "Activity points cap"]]],
  ["Recency", [["recent2", "Active in 2 days"], ["recent7", "Active in 7 days"], ["recent14", "Active in 14 days"]]],
  ["Follow-up", [["followUpOnTime", "Next follow-up on time"], ["followUpOverdue", "Next follow-up overdue"]]],
];

export function ScoringTab({ s, setS, canEdit, saveSections }) {
  const toast = useToast();
  const info = useApi(() => crmApi.scoring(), []);
  const [busy, setBusy] = useState(false);
  const w = { ...(info.data?.defaults || {}), ...(s.scoring || {}) };
  const set = (k, v) => setS((x) => ({ ...x, scoring: { ...w, [k]: v } }));
  const band = (p) => (info.data?.bands || []).find((b) => b.priority === p) || { count: 0, avg: 0 };
  const rescore = async () => { setBusy(true); try { const r = await crmApi.rescore(); toast(r.data.running ? "Already running" : `Rescoring ${r.data.leads} leads`); } catch (e) { toast(e.message, "error"); } finally { setBusy(false); } };

  return <>
    <div className="grid grid-cols-3 gap-3">
      {[["hot", "Hot", "var(--destructive)", "fire"], ["warm", "Warm", "var(--warning)", "thermometer-half"], ["cold", "Cold", "var(--info)", "snow"]].map(([k, label, color, icon]) => (
        <div key={k} className="rounded-xl border bg-card p-3">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground"><i className={`bi bi-${icon}`} style={{ color }}></i>{label}</div>
          <div className="text-xl font-semibold text-foreground mt-1">{band(k).count}</div>
          <div className="text-[11px] text-muted-foreground">avg {band(k).avg}</div>
        </div>
      ))}
    </div>
    <Panel title="Priority bands" bodyClass="p-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Hot from</label><input className="ui-input w-full" type="number" min="1" max="100" disabled={!canEdit} value={w.hot ?? ""} onChange={(e) => set("hot", e.target.value)} /></div>
        <div><label className={labelCls}>Warm from</label><input className="ui-input w-full" type="number" min="0" max="99" disabled={!canEdit} value={w.warm ?? ""} onChange={(e) => set("warm", e.target.value)} /></div>
      </div>
    </Panel>
    {SCORE_ROWS.map(([title, rows]) => (
      <Panel key={title} title={title} bodyClass="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {rows.map(([k, label]) => <div key={k}><label className={labelCls}>{label}</label><input className="ui-input w-full" type="number" min={k === "followUpOverdue" ? -50 : 0} max="100" disabled={!canEdit} value={w[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></div>)}
        </div>
      </Panel>
    ))}
    {!!info.data?.activityTypes?.length && (
      <Panel title="Activity points" bodyClass="p-3">
        <div className="flex flex-wrap gap-1.5">{info.data.activityTypes.map((t) => <Chip key={t._id} color={t.color} icon={t.icon}>{t.name} {t.points > 0 ? "+" : ""}{t.points}</Chip>)}</div>
      </Panel>
    )}
    {canEdit && (
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="ui-btn ui-btn-outline" onClick={() => setS((x) => ({ ...x, scoring: { ...info.data.defaults } }))} disabled={!info.data}>Defaults</button>
        <button type="button" className="ui-btn ui-btn-outline" disabled={busy} onClick={rescore}><i className="bi bi-arrow-repeat"></i>Rescore all leads</button>
        <button type="button" className="ui-btn ui-btn-primary" onClick={() => saveSections(["scoring"]).then(info.reload)}>Save</button>
      </div>
    )}
  </>;
}

export function QueriesTab({ s, setS, canEdit, SaveBtn }) {
  const q = s.queries || { categories: [], defaultSlaHours: 24, assignToLeadOwner: true };
  const set = (k, v) => setS((x) => ({ ...x, queries: { ...q, [k]: v } }));
  const setCat = (i, k, v) => set("categories", q.categories.map((c, j) => (j === i ? { ...c, [k]: v } : c)));
  return <>
    <Panel title="Categories" bodyClass="p-3 space-y-2">
      <div className="grid grid-cols-[1fr_130px_auto] gap-2 text-[11px] uppercase tracking-wider text-muted-foreground"><span>Name</span><span>Reply within (h)</span><span className="w-8"></span></div>
      {q.categories.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_130px_auto] gap-2">
          <input className="ui-input w-full" aria-label="Category" disabled={!canEdit} value={c.name} onChange={(e) => setCat(i, "name", e.target.value)} />
          <input className="ui-input w-full" aria-label="Hours" type="number" min="1" disabled={!canEdit} value={c.slaHours} onChange={(e) => setCat(i, "slaHours", e.target.value)} />
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Remove" disabled={!canEdit} onClick={() => set("categories", q.categories.filter((_, j) => j !== i))}><i className="bi bi-x-lg"></i></button>
        </div>
      ))}
      {canEdit && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => set("categories", [...q.categories, { name: "", slaHours: q.defaultSlaHours || 24 }])}><i className="bi bi-plus"></i>Add category</button>}
    </Panel>
    <Panel title="Defaults" bodyClass="p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Reply within (h), no category</label><input className="ui-input w-full" type="number" min="1" disabled={!canEdit} value={q.defaultSlaHours} onChange={(e) => set("defaultSlaHours", e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" disabled={!canEdit} checked={!!q.assignToLeadOwner} onChange={(e) => set("assignToLeadOwner", e.target.checked)} />Assign new queries to the lead's owner</label>
    </Panel>
    <SaveBtn sections={["queries"]} />
  </>;
}
