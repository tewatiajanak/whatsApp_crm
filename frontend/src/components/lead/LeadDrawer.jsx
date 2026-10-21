import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { leadsApi, followUpsApi, crmApi } from "../../api";
import { Documents, CustomFieldInputs, missingCustom } from "./LeadExtras";
import Fees from "./LeadFees";
import { Brief, Chat, WebActivity } from "./LeadMore";
import { LogActivity, SourceHistory, LeadListChips, LeadQueries } from "./LeadPro";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Modal, Spinner, ErrorBox, Avatar, Chip, Tabs, Confirm, EmptyState } from "../ui";
import DateInput from "../DateInput";
import { formatDate, formatDateTime } from "../../utils/dateFormat";
import { PRIORITY, ACTIVITY, CALL_OUTCOMES, FU_OUTCOMES, LOST_REASONS, fuIcon, dueInfo, timeAgo, money, waLink, telLink, labelCls, idOf, isoDay } from "./leadUtils";

const DETAIL_FIELDS = [
  ["name", "Name"], ["phone", "Phone"], ["altPhone", "Alternate phone"], ["email", "Email"],
  ["course", "Course"], ["grade", "Grade"], ["city", "City"], ["state", "State"], ["country", "Country"], ["value", "Value (₹)"],
];

// Lead 360: everything about one lead — stage, details, history, follow-ups, services.
export default function LeadDrawer({ id, meta, onClose, onChanged, onFollowUp, onMessage }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEdit = can("leads", "edit");
  const lead = useApi(() => leadsApi.get(id), [id]);
  const timeline = useApi(() => leadsApi.timeline(id), [id]);
  const followUps = useApi(() => leadsApi.followUps(id), [id]);
  const activityTypes = useApi(() => crmApi.activityTypes(), []);
  const [tab, setTab] = useState("timeline");
  const [pendingLost, setPendingLost] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const l = lead.data;

  const statuses = meta?.statuses || [];
  const statusId = idOf(l?.status);
  const status = statuses.find((s) => s._id === statusId);
  const subs = (meta?.subStatuses || []).filter((s) => idOf(s.status) === statusId);
  const pr = PRIORITY[l?.priority] || PRIORITY.warm;

  const refresh = () => { lead.reload(); timeline.reload(); followUps.reload(); onChanged?.(); };
  async function run(fn, done) {
    setBusy(true);
    try { await fn(); if (done) toast(done); refresh(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  function changeStatus(nextId, subId) {
    const next = statuses.find((s) => s._id === nextId);
    if (!next) return;
    if (next.isLost) return setPendingLost({ statusId: nextId, reason: "" });
    run(() => leadsApi.setStatus(id, nextId, subId || null), "Status updated");
  }

  return (
    <>
      <Modal
        size="wide"
        onClose={onClose}
        title={
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={l?.name || "?"} size={36} />
            <div className="min-w-0">
              <div className="truncate">{l?.name || "…"}</div>
              <div className="text-xs font-normal text-muted-foreground truncate">{l?.phone}{l?.email ? ` · ${l.email}` : ""}</div>
            </div>
          </div>
        }
      >
        {lead.loading && !l ? <Spinner /> : !l ? <ErrorBox error={lead.error} /> : (
          <div className="space-y-4">
            {/* quick actions */}
            <div className="flex flex-wrap items-center gap-2">
              {meta?.canCall && canEdit
                ? <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" disabled={busy} title="Rings your phone, then connects the lead" onClick={() => run(() => crmApi.call(l._id), "Calling — pick up your phone")}><i className="bi bi-telephone-outbound"></i>Call</button>
                : !l.contactsHidden && <a className="ui-btn ui-btn-outline ui-btn-sm" href={telLink(l.phone)}><i className="bi bi-telephone"></i>Call</a>}
              {!l.contactsHidden && <a className="ui-btn ui-btn-outline ui-btn-sm" href={waLink(l.phone)} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp"></i>WhatsApp</a>}
              {can("blast", "create") && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => onMessage?.(l)}><i className="bi bi-send"></i>Message</button>}
              {can("followups", "create") && <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => onFollowUp?.(l)}><i className="bi bi-calendar-plus"></i>Follow-up</button>}
              {canEdit && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => navigate(`/crm/leads/registration/${l._id}`)}><i className="bi bi-clipboard-check"></i>Register</button>}
              {can("leads", "create") && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => navigate(`/crm/deals?lead=${l._id}`)}><i className="bi bi-briefcase"></i>Deal</button>}
              {can("leads", "del") && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon ms-auto" title="Delete lead" onClick={() => setConfirmDelete(true)}><i className="bi bi-trash"></i></button>}
            </div>

            <Brief leadId={id} stamp={l.updatedAt} onFollowUp={can("followups", "create") ? () => onFollowUp?.(l) : null} onMessage={can("blast", "create") ? () => onMessage?.(l) : null} />

            {/* at a glance */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Fact label="Score"><span className="font-semibold">{l.score}</span><span className="text-muted-foreground"> / 100</span></Fact>
              <Fact label="Priority"><Chip color={pr.color} icon={pr.icon}>{pr.label}</Chip></Fact>
              <Fact label="Next follow-up"><span style={{ color: `var(--${dueInfo(l.nextFollowUp).tone})` }}>{dueInfo(l.nextFollowUp).text}</span></Fact>
              <Fact label="Last activity">{timeAgo(l.lastActivity)}</Fact>
            </div>
            <LeadListChips leadId={id} canEdit={canEdit} stamp={l.updatedAt} />

            {/* stage + owner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Status</label>
                <select className="ui-input w-full" value={statusId || ""} disabled={!canEdit || busy} onChange={(e) => changeStatus(e.target.value)}>
                  {statuses.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Sub-status</label>
                <select className="ui-input w-full" value={idOf(l.subStatus) || ""} disabled={!canEdit || busy || !subs.length} onChange={(e) => run(() => leadsApi.setStatus(id, statusId, e.target.value || null, l.lostReason), "Status updated")}>
                  <option value="">—</option>
                  {subs.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Owner</label>
                <select className="ui-input w-full" value={l.owner || "Unassigned"} disabled={!canEdit || busy} onChange={(e) => run(() => leadsApi.update(id, { owner: e.target.value }), "Owner changed")}>
                  <option value="Unassigned">Unassigned</option>
                  {[...new Set([...(meta?.owners || []), l.owner].filter((o) => o && o !== "Unassigned"))].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            {status?.isLost && l.lostReason && <div className="text-xs text-muted-foreground">Lost reason: <span className="text-foreground">{l.lostReason}</span></div>}

            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "timeline", label: "Timeline" },
                { value: "followups", label: `Follow-ups${followUps.data?.filter((f) => !f.done).length ? ` (${followUps.data.filter((f) => !f.done).length})` : ""}` },
                { value: "chat", label: "Chat" },
                { value: "details", label: "Details" },
                { value: "fees", label: "Fees" },
                { value: "documents", label: "Documents" },
                { value: "services", label: "Services" },
                { value: "queries", label: "Queries" },
              ]}
            />

            {tab === "timeline" && <Timeline id={id} items={timeline.data} loading={timeline.loading} canEdit={canEdit} onDone={refresh} activityTypes={activityTypes.data} />}
            {tab === "queries" && <LeadQueries lead={l} canEdit={canEdit} />}
            {tab === "followups" && <FollowUpList items={followUps.data} loading={followUps.loading} onDone={refresh} />}
            {tab === "details" && <Details lead={l} meta={meta} canEdit={canEdit} onSaved={refresh} />}
            {tab === "chat" && <Chat lead={l} canSend={can("chat", "create") || can("blast", "create")} />}
            {tab === "fees" && <Fees lead={l} canEdit={canEdit} onChanged={refresh} />}
            {tab === "documents" && <Documents leadId={id} canEdit={canEdit} onChanged={refresh} />}
            {tab === "services" && <Services lead={l} meta={meta} canEdit={canEdit} onDone={refresh} />}
          </div>
        )}
      </Modal>

      {pendingLost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setPendingLost(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-foreground">Why was this lead lost?</div>
            <input className="ui-input w-full" list="lost-reasons" autoFocus aria-label="Reason" title="Reason" value={pendingLost.reason} onChange={(e) => setPendingLost((p) => ({ ...p, reason: e.target.value }))} />
            <datalist id="lost-reasons">{[...new Set([...(meta?.lostReasons || []), ...LOST_REASONS])].map((r) => <option key={r} value={r} />)}</datalist>
            <div className="flex justify-end gap-2">
              <button type="button" className="ui-btn ui-btn-outline" onClick={() => setPendingLost(null)}>Cancel</button>
              <button type="button" className="ui-btn ui-btn-primary" disabled={!pendingLost.reason.trim() || busy} onClick={() => { const p = pendingLost; setPendingLost(null); run(() => leadsApi.setStatus(id, p.statusId, null, p.reason.trim()), "Marked as lost"); }}>
                Mark lost
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <Confirm
          danger
          title={`Delete ${l?.name}?`}
          text="The lead's follow-ups and history are deleted too."
          confirmLabel="Delete"
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setBusy(true);
            try { await leadsApi.remove(id); toast("Lead deleted"); onChanged?.(); onClose(); }
            catch (e) { toast(e.message, "error"); setBusy(false); setConfirmDelete(false); }
          }}
        />
      )}
    </>
  );
}

function Fact({ label, children }) {
  return (
    <div className="rounded-lg border px-2.5 py-2" style={{ background: "var(--muted-background)" }}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground mt-0.5 truncate">{children}</div>
    </div>
  );
}

/* ───────────── timeline: note + call composer, then history ───────────── */
function Timeline({ id, items, loading, canEdit, onDone, activityTypes }) {
  const toast = useToast();
  const [mode, setMode] = useState("note");
  const [text, setText] = useState("");
  const [call, setCall] = useState({ outcome: "Connected", durationMin: "", direction: "outgoing" });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (mode === "note" && !text.trim()) return;
    setSaving(true);
    try {
      if (mode === "note") await leadsApi.addNote(id, text.trim());
      else await leadsApi.logCall(id, { ...call, note: text.trim() });
      setText("");
      toast(mode === "note" ? "Note added" : "Call logged");
      onDone();
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="rounded-lg border p-2.5 space-y-2">
          <div className="flex gap-1">
            {[["note", "sticky", "Note"], ["call", "telephone", "Log call"], ...((activityTypes || []).some((t) => t.active !== false) ? [["activity", "lightning", "Activity"]] : [])].map(([v, icon, label]) => (
              <button key={v} type="button" className={"ui-btn ui-btn-sm " + (mode === v ? "ui-btn-primary" : "ui-btn-ghost")} onClick={() => setMode(v)}>
                <i className={`bi bi-${icon}`}></i>{label}
              </button>
            ))}
          </div>
          {mode === "call" && (
            <div className="grid grid-cols-3 gap-2">
              <select className="ui-input w-full" value={call.direction} onChange={(e) => setCall((c) => ({ ...c, direction: e.target.value }))}>
                <option value="outgoing">Outgoing</option><option value="incoming">Incoming</option>
              </select>
              <select className="ui-input w-full" value={call.outcome} onChange={(e) => setCall((c) => ({ ...c, outcome: e.target.value }))}>
                {CALL_OUTCOMES.map((o) => <option key={o}>{o}</option>)}
              </select>
              <input className="ui-input w-full" type="number" min="0" aria-label="Minutes" title="Minutes" value={call.durationMin} onChange={(e) => setCall((c) => ({ ...c, durationMin: e.target.value }))} />
            </div>
          )}
          {mode === "activity" ? <LogActivity leadId={id} types={activityTypes} onDone={onDone} /> : <>
          <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={2} placeholder={mode === "note" ? "Write a note…" : "What was discussed?"} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex justify-end">
            <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={saving || (mode === "note" && !text.trim())} onClick={save}>{saving ? "Saving…" : "Save"}</button>
          </div>
          </>}
        </div>
      )}

      {loading && !items ? <Spinner /> : !(items || []).length ? <EmptyState icon="clock-history" text="No activity yet." /> : (
        <ol className="relative m-0 p-0 list-none">
          <span className="absolute top-1 bottom-1 w-px" style={{ left: 13, background: "var(--border)" }} />
          {items.map((a) => {
            const look = a.type === "activity" ? { icon: a.meta?.icon || "lightning", color: a.meta?.color || "var(--primary)" } : ACTIVITY[a.type] || ACTIVITY.note;
            return (
              <li key={a._id} className="relative flex gap-3 pb-3">
                <span className="relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 border bg-card" style={{ color: look.color }}>
                  <i className={`bi bi-${look.icon}`} style={{ fontSize: 12 }}></i>
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-sm font-medium text-foreground">{a.title}{a.type === "activity" && a.meta?.points ? <span className="text-[11px] font-normal text-muted-foreground"> · {a.meta.points > 0 ? "+" : ""}{a.meta.points} pts</span> : null}</span>
                    <span className="text-[11px] text-muted-foreground" title={formatDateTime(a.at)}>{timeAgo(a.at)}</span>
                  </div>
                  {a.detail && <div className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{a.detail}</div>}
                  {a.meta?.recordingUrl && /^https:\/\//.test(a.meta.recordingUrl) && <audio controls preload="none" src={a.meta.recordingUrl} className="mt-1 w-full" style={{ height: 32 }} />}
                  {a.by && <div className="text-[11px] text-muted-foreground mt-0.5">{a.by}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ───────────── follow-ups of this lead ───────────── */
function FollowUpList({ items, loading, onDone }) {
  const toast = useToast();
  const { can } = useAuth();
  const [closing, setClosing] = useState(null);
  const [moving, setMoving] = useState(null);

  async function act(fn, msg) {
    try { await fn(); toast(msg); setClosing(null); setMoving(null); onDone(); }
    catch (e) { toast(e.message, "error"); }
  }

  if (loading && !items) return <Spinner />;
  if (!(items || []).length) return <EmptyState icon="calendar-check" text="No follow-ups yet." />;
  return (
    <div className="space-y-2">
      {items.map((f) => {
        const due = dueInfo(f.due);
        return (
          <div key={f._id} className="rounded-lg border p-2.5">
            <div className="flex items-start gap-2">
              <i className={`bi bi-${fuIcon(f.type)} mt-0.5`} style={{ color: "var(--primary)" }}></i>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-foreground">{f.type}</span>
                  {f.done ? <Chip color="var(--success)" icon="check2">{f.outcome || "Done"}</Chip> : <Chip color={`var(--${due.tone})`}>{due.text}</Chip>}
                  <span className="text-[11px] text-muted-foreground">{f.owner}</span>
                </div>
                {(f.note || f.completionNote) && <div className="text-xs text-muted-foreground mt-0.5 break-words">{f.done ? f.completionNote || f.note : f.note}</div>}
                <div className="text-[11px] text-muted-foreground mt-0.5">{formatDateTime(f.done ? f.completedAt || f.due : f.due)}</div>
              </div>
              {!f.done && can("followups", "edit") && (
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-outline" title="Complete" onClick={() => { setMoving(null); setClosing({ id: f._id, outcome: "Completed", note: "" }); }}><i className="bi bi-check-lg"></i></button>
                  <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Reschedule" onClick={() => { setClosing(null); setMoving({ id: f._id, date: isoDay(1), time: "10:00" }); }}><i className="bi bi-calendar2-week"></i></button>
                </div>
              )}
            </div>
            {closing?.id === f._id && (
              <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2 mt-2">
                <select className="ui-input w-full" value={closing.outcome} onChange={(e) => setClosing((c) => ({ ...c, outcome: e.target.value }))}>{FU_OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select>
                <input className="ui-input w-full" aria-label="What happened" title="What happened" value={closing.note} onChange={(e) => setClosing((c) => ({ ...c, note: e.target.value }))} />
                <button type="button" className="ui-btn ui-btn-primary" onClick={() => act(() => followUpsApi.complete(f._id, { outcome: closing.outcome, note: closing.note }), "Follow-up completed")}>Done</button>
              </div>
            )}
            {moving?.id === f._id && (
              <div className="grid grid-cols-[1fr_110px_auto] gap-2 mt-2">
                <DateInput className="ui-input w-full" value={moving.date} onChange={(e) => setMoving((m) => ({ ...m, date: e.target.value }))} />
                <input type="time" className="ui-input w-full" value={moving.time} onChange={(e) => setMoving((m) => ({ ...m, time: e.target.value }))} />
                <button type="button" className="ui-btn ui-btn-primary" disabled={!moving.date} onClick={() => act(() => followUpsApi.reschedule(f._id, { date: moving.date, time: moving.time }), "Rescheduled")}>Move</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── details: profile, tags, source, capture info ───────────── */
function Details({ lead, meta, canEdit, onSaved }) {
  const toast = useToast();
  const blank = () => ({ ...Object.fromEntries(DETAIL_FIELDS.map(([k]) => [k, lead[k] ?? ""])), source: idOf(lead.source) || "", priority: lead.priorityManual ? lead.priority : "auto", tags: (lead.tags || []).join(", "), customFields: lead.customFields || {}, branch: lead.branch || "", partner: idOf(lead.partner) || "", doNotContact: { whatsapp: false, sms: false, email: false, call: false, ...(lead.doNotContact || {}) } });
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const hiddenFields = meta?.hiddenFields || [];
  const lockedFields = meta?.readOnlyFields || [];
  useEffect(() => { setForm(blank()); }, [lead._id, lead.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(blank());

  async function save() {
    setSaving(true);
    try {
      // send only what changed, so the timeline names the right fields
      const base = blank();
      const changes = Object.fromEntries(Object.keys(form).filter((k) => JSON.stringify(form[k]) !== JSON.stringify(base[k])).map((k) => [k, form[k]]));
      for (const f of [...hiddenFields, ...lockedFields]) delete changes[f];
      if ("value" in changes) changes.value = Number(form.value) || 0;
      if ("tags" in changes) changes.tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
      await leadsApi.update(lead._id, changes);
      toast("Lead updated");
      onSaved();
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }

  const utm = lead.utm || {};
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DETAIL_FIELDS.filter(([k]) => !hiddenFields.includes(k)).map(([k, label]) => (
          <div key={k}>
            <label className={labelCls}>{label}</label>
            <input className="ui-input w-full" type={k === "value" ? "number" : k === "email" ? "email" : "text"} min={k === "value" ? 0 : undefined} list={k === "course" ? "lead-courses" : undefined}
              disabled={!canEdit || lockedFields.includes(k) || (lead.contactsHidden && ["phone", "altPhone", "email"].includes(k))} value={form[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}
        <datalist id="lead-courses">{(meta?.courses || []).map((c) => <option key={c._id} value={c.name} />)}</datalist>
        {!!(meta?.branches || []).length && (
          <div>
            <label className={labelCls}>Branch</label>
            <select className="ui-input w-full" disabled={!canEdit} value={form.branch} onChange={(e) => set("branch", e.target.value)}>
              <option value="">—</option>
              {[...new Set([...(meta.branches || []).map((b) => b.name), form.branch].filter(Boolean))].map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
        )}
        {!!(meta?.partners || []).length && (
          <div>
            <label className={labelCls}>Referred by</label>
            <select className="ui-input w-full" disabled={!canEdit} value={form.partner} onChange={(e) => set("partner", e.target.value)}>
              <option value="">Nobody</option>
              {(meta.partners || []).map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={labelCls}>Source</label>
          <select className="ui-input w-full" disabled={!canEdit} value={form.source} onChange={(e) => set("source", e.target.value)}>
            <option value="">—</option>
            {(meta?.sources || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Priority</label>
          <select className="ui-input w-full" disabled={!canEdit} value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            <option value="auto">Auto (from score)</option>
            {Object.entries(PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Tags</label>
          <input className="ui-input w-full" disabled={!canEdit} title="Comma separated" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
        </div>
        <CustomFieldInputs fields={meta?.customFields} values={form.customFields} onChange={(v) => set("customFields", v)} disabled={!canEdit} />
        <div className="sm:col-span-2">
          <label className={labelCls}>Do not contact on</label>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {[["call", "Call"], ["whatsapp", "WhatsApp"], ["sms", "SMS"], ["email", "Email"]].map(([k, label]) => (
              <label key={k} className="flex items-center gap-1.5 text-sm text-foreground"><input type="checkbox" disabled={!canEdit} checked={!!form.doNotContact[k]} onChange={(e) => set("doNotContact", { ...form.doNotContact, [k]: e.target.checked })} />{label}</label>
            ))}
          </div>
        </div>
      </div>
      {canEdit && (
        <div className="flex justify-end gap-2">
          <button type="button" className="ui-btn ui-btn-outline" disabled={!dirty || saving} onClick={() => setForm(blank())}>Reset</button>
          <button type="button" className="ui-btn ui-btn-primary" disabled={!dirty || saving || !String(form.name).trim() || missingCustom(meta?.customFields, form.customFields).length > 0} onClick={save}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      )}
      <WebActivity leadId={lead._id} />
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs border-t pt-3 m-0">
        {[
          ["Created", formatDateTime(lead.createdAt)],
          ["Captured from", lead.capturedFrom || "—"],
          ["Enquiries", lead.enquiryCount || 1],
          ["First contacted", lead.firstContactedAt ? formatDateTime(lead.firstContactedAt) : "Not yet"],
          ["Follow-ups done", lead.followUpCount || 0],
          ["Pipeline value", money(lead.value)],
          ...(utm.source || utm.campaign ? [["Campaign", [utm.source, utm.medium, utm.campaign].filter(Boolean).join(" / ")]] : []),
        ].map(([k, v]) => (
          <div key={k}><dt className="text-muted-foreground font-normal">{k}</dt><dd className="text-foreground m-0">{v}</dd></div>
        ))}
      </dl>
      <SourceHistory lead={lead} />
    </div>
  );
}

/* ───────────── services (pipelines) this lead is in ───────────── */
function Services({ lead, meta, canEdit, onDone }) {
  const toast = useToast();
  const [adding, setAdding] = useState("");
  const services = meta?.services || [];
  const tracks = lead.serviceTracks || [];
  const free = services.filter((s) => !tracks.some((t) => idOf(t.service) === s._id));
  const statusesFor = (serviceId) => (meta?.statuses || []).filter((s) => !(s.offerings || []).length || s.offerings.map(String).includes(String(serviceId)));

  async function act(fn, msg) {
    try { await fn(); toast(msg); onDone(); } catch (e) { toast(e.message, "error"); }
  }

  return (
    <div className="space-y-2">
      {!tracks.length && <EmptyState icon="briefcase" text="Not in any service yet." />}
      {tracks.map((t) => {
        const sid = idOf(t.service);
        const svc = services.find((s) => s._id === sid);
        return (
          <div key={sid} className="rounded-lg border p-2.5 grid grid-cols-1 sm:grid-cols-[1fr_200px_auto] gap-2 items-center">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground truncate">{svc?.name || "Service"}</div>
              <div className="text-[11px] text-muted-foreground">{t.owner || "Unassigned"}{t.nextFollowUp ? ` · next ${formatDate(t.nextFollowUp)}` : ""}{t.isClosed ? " · closed" : ""}</div>
            </div>
            <select className="ui-input w-full" value={idOf(t.status) || ""} disabled={!canEdit} onChange={(e) => e.target.value && act(() => leadsApi.setServiceStatus(lead._id, sid, e.target.value), "Status updated")}>
              <option value="">Select status</option>
              {statusesFor(sid).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            {canEdit && <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Remove from service" onClick={() => act(() => leadsApi.removeService(lead._id, sid), "Removed")}><i className="bi bi-x-lg"></i></button>}
          </div>
        );
      })}
      {canEdit && free.length > 0 && (
        <div className="flex gap-2 pt-1">
          <select className="ui-input flex-1" value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Add to a service…</option>
            {free.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <button type="button" className="ui-btn ui-btn-primary" disabled={!adding} onClick={() => act(() => leadsApi.addService(lead._id, adding), "Service added").then(() => setAdding(""))}>Add</button>
        </div>
      )}
    </div>
  );
}
