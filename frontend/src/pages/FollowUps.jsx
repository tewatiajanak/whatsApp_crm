import { useState } from "react";
import { Link } from "react-router-dom";
import { followUpsApi, leadsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Chip, Confirm, Tabs, FilterBar, IconBtn, DataTable, Modal } from "../components/ui";
import MessagingSlider from "../components/MessagingSlider";
import FollowUpSlider from "../components/FollowUpSlider";
import DateInput from "../components/DateInput";
import { formatDateTime } from "../utils/dateFormat";
import { FollowUpCalendar } from "../components/lead/MyCrm";
import { FU_TYPES, FU_OUTCOMES, PRIORITY, LOST_REASONS, fuIcon, dueInfo, isoDay, telLink, labelCls, idOf } from "../components/lead/leadUtils";

const BUCKETS = [
  { key: "today", label: "Today", icon: "bell", tone: "warning" },
  { key: "upcoming", label: "Upcoming", icon: "clock-history", tone: "info" },
  { key: "overdue", label: "Overdue", icon: "exclamation-triangle", tone: "destructive" },
  { key: "done", label: "Completed", icon: "check-circle", tone: "success" },
];

export default function FollowUps() {
  const toast = useToast();
  const { can } = useAuth();
  const [bucket, setBucket] = useState("today");
  const [mode, setMode] = useState("list");
  const [owner, setOwner] = useState("");
  const [type, setType] = useState("");
  const [closing, setClosing] = useState(null);
  const [moving, setMoving] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [panel, setPanel] = useState(null); // { kind: "followup" | "message" | "status", f }
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const fu = useApi(() => followUpsApi.buckets({ owner, type }), [owner, type]);
  const meta = useApi(() => (can("leads", "view") ? leadsApi.meta() : Promise.resolve({ data: {} })), []);
  const canEdit = can("followups", "edit");

  async function act(fn, msg) {
    setBusy(true);
    try { await fn(); toast(msg); setClosing(null); setMoving(null); setRemoving(null); fu.reload(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  const counts = fu.data?.counts || {};
  const needle = q.trim().toLowerCase();
  const items = (fu.data?.[bucket] || []).filter((f) => !needle || String(f.leadName || f.lead?.name || "").toLowerCase().includes(needle) || String(f.phone || "").includes(needle));
  const label = BUCKETS.find((b) => b.key === bucket).label;
  const m = meta.data || {};
  const leadOf = (f) => ({ ...(f.lead && typeof f.lead === "object" ? f.lead : {}), _id: idOf(f.lead), name: f.leadName || f.lead?.name, phone: f.phone || f.lead?.phone, owner: f.lead?.owner || f.owner });
  const hasLead = (f) => !!idOf(f.lead);

  const leadLine = (f) => {
    const l = f.lead && typeof f.lead === "object" ? f.lead : null;
    const pr = l ? PRIORITY[l.priority] : null;
    return (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {l && can("leads", "view") ? <Link to={`/crm/leads?lead=${l._id}`} className="text-sm font-medium text-foreground truncate hover:underline">{f.leadName || l.name}</Link> : <span className="text-sm font-medium text-foreground truncate">{f.leadName}</span>}
          {pr && <i className={`bi bi-${pr.icon}`} style={{ color: pr.color, fontSize: 12 }} title={pr.label}></i>}
        </div>
        <div className="text-xs text-muted-foreground">{f.phone}</div>
      </div>
    );
  };
  const dueCell = (f) => {
    if (f.done) return <Chip color="var(--success)" icon="check2">{f.outcome || "Done"}</Chip>;
    const d = dueInfo(f.due);
    return <span style={{ color: `var(--${d.tone})` }} title={formatDateTime(f.due)}>{d.text}</span>;
  };
  const statusCell = (f) => {
    const st = f.lead?.status;
    return st?.name ? <Chip color={st.color || "var(--primary)"}>{st.name}</Chip> : <span className="text-muted-foreground">—</span>;
  };
  const actions = (f) => (
    <span className="inline-flex items-center gap-1">
      {!f.done && canEdit && <button type="button" className="ui-btn ui-btn-sm ui-btn-primary" onClick={() => setClosing({ f, outcome: "Completed", note: "", next: false, date: isoDay(2), time: "10:00", type: f.type, nextNote: "" })}><i className="bi bi-check-lg"></i>Done</button>}
      {!f.contactsHidden && f.phone && <a className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Call" href={telLink(f.phone)}><i className="bi bi-telephone" style={{ fontSize: 13 }}></i></a>}
      {!f.contactsHidden && f.phone && <IconBtn icon="chat-dots" title="Communication" onClick={() => setPanel({ kind: "message", f })} />}
      {hasLead(f) && can("leads", "edit") && <IconBtn icon="flag" title="Update status" onClick={() => setPanel({ kind: "status", f })} />}
      {hasLead(f) && can("followups", "create") && <IconBtn icon="calendar-plus" title="New follow-up" onClick={() => setPanel({ kind: "followup", f })} />}
      {!f.done && canEdit && <IconBtn icon="calendar2-week" title="Reschedule" onClick={() => setMoving({ f, date: isoDay(1), time: "10:00" })} />}
      {!f.done && can("followups", "del") && <IconBtn icon="x-lg" title="Cancel follow-up" danger onClick={() => setRemoving(f)} />}
    </span>
  );

  return (
    <div>
      <PageHeader
        title="Follow-ups"
        actions={<>
          <div className="inline-flex rounded-lg border overflow-hidden">
            {[["list", "list-ul", "List"], ["calendar", "calendar3", "Calendar"]].map(([v, icon, label]) => (
              <button key={v} type="button" title={label} onClick={() => setMode(v)} className="h-[34px] w-9 inline-flex items-center justify-center border-0"
                style={mode === v ? { background: "var(--primary)", color: "var(--primary-foreground, #fff)" } : { background: "var(--card)", color: "var(--muted-foreground)" }}>
                <i className={`bi bi-${icon}`}></i>
              </button>
            ))}
          </div>
          <select className="ui-input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
            <option value="">All types</option>{FU_TYPES.map((t) => <option key={t.value} value={t.value}>{t.value}</option>)}
          </select>
          <select className="ui-input" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
            <option value="">Everyone</option><option value="me">Mine</option>
            {(meta.data?.visibleOwners || []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </>}
      />
      <ErrorBox error={fu.error} />

      {mode === "calendar" ? <FollowUpCalendar owner={owner} /> : <>
        <Tabs
          tabs={BUCKETS.map((b) => ({
            value: b.key,
            label: <><i className={`bi bi-${b.icon}`} style={{ color: `var(--${b.tone})` }}></i>{b.label}<span className="badge rounded-pill" style={{ background: `color-mix(in srgb, var(--${b.tone}) 15%, transparent)`, color: `var(--${b.tone})` }}>{counts[b.key] ?? 0}</span></>,
          }))}
          value={bucket}
          onChange={setBucket}
        />
        <FilterBar>
          <div className="ui-search" style={{ minWidth: 240 }}>
            <span className="ui-search-icon"><i className="bi bi-search"></i></span>
            <input className="ui-search-input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </FilterBar>
        {fu.loading && !fu.data ? <Spinner /> : !items.length ? (
          <div className="rounded-xl border bg-card"><EmptyState icon="check2-circle" text={needle ? "No match" : `No ${label.toLowerCase()} follow-ups`} /></div>
        ) : (
          <>
            <div className="md:hidden space-y-2">
              {items.map((f) => (
                <div key={f._id} className="rounded-xl border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">{leadLine(f)}<span className="text-xs whitespace-nowrap">{dueCell(f)}</span></div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5"><span><i className={`bi bi-${fuIcon(f.type)} me-1`}></i>{f.type} · {f.owner || "Unassigned"}</span>{statusCell(f)}</div>
                  {(f.note || f.completionNote) && <div className="text-xs text-foreground mt-1">{f.done ? f.completionNote || f.note : f.note}</div>}
                  <div className="mt-2 flex justify-end">{actions(f)}</div>
                </div>
              ))}
            </div>
            <div className="hidden md:block">
              <DataTable
                rows={items}
                columns={[
                  { key: "lead", label: "Lead", render: leadLine },
                  { key: "type", label: "Type", render: (f) => <span className="whitespace-nowrap"><i className={`bi bi-${fuIcon(f.type)} me-1.5`} style={{ color: "var(--primary)" }}></i>{f.type}</span> },
                  { key: "status", label: "Status", render: statusCell },
                  { key: "note", label: "Note", render: (f) => <span className="line-clamp-2 text-muted-foreground" style={{ maxWidth: 280 }}>{(f.done ? f.completionNote || f.note : f.note) || "—"}</span> },
                  { key: "owner", label: "Owner", render: (f) => <span className="whitespace-nowrap">{f.owner || "Unassigned"}</span> },
                  { key: "due", label: bucket === "done" ? "Outcome" : "Due", render: (f) => <span className="whitespace-nowrap">{dueCell(f)}{f.done && <div className="text-[11px] text-muted-foreground">{formatDateTime(f.completedAt || f.updatedAt)}</div>}</span> },
                  { key: "act", label: "", align: "right", render: (f) => <span className="whitespace-nowrap">{actions(f)}</span> },
                ]}
              />
            </div>
            {counts[bucket] > (fu.data?.[bucket] || []).length && <div className="text-xs text-muted-foreground mt-2">Showing the first {(fu.data?.[bucket] || []).length} of {counts[bucket]}.</div>}
          </>
        )}
      </>}

      {panel?.kind === "message" && <MessagingSlider lead={leadOf(panel.f)} canSms={m.canSms} onClose={() => setPanel(null)} />}
      {panel?.kind === "followup" && <FollowUpSlider lead={leadOf(panel.f)} owners={m.owners || []} onClose={() => setPanel(null)} onSaved={() => { setPanel(null); fu.reload(); }} />}
      {panel?.kind === "status" && <StatusDialog f={panel.f} meta={m} onClose={() => setPanel(null)} onSaved={() => { setPanel(null); fu.reload(); }} />}
      {closing && (
        <Dialog title={`Complete · ${closing.f.leadName}`} onClose={() => setClosing(null)} busy={busy} confirm="Complete"
          onConfirm={() => act(() => followUpsApi.complete(closing.f._id, { outcome: closing.outcome, note: closing.note, next: closing.next ? { date: closing.date, time: closing.time, type: closing.type, note: closing.nextNote } : undefined }), closing.next ? "Completed, next follow-up scheduled" : "Follow-up completed")}>
          <div><label className={labelCls}>Outcome</label>
            <select className="ui-input w-full" value={closing.outcome} onChange={(e) => setClosing((c) => ({ ...c, outcome: e.target.value }))}>{FU_OUTCOMES.map((o) => <option key={o}>{o}</option>)}</select></div>
          <div><label className={labelCls}>What happened</label>
            <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={2} autoFocus value={closing.note} onChange={(e) => setClosing((c) => ({ ...c, note: e.target.value }))} /></div>
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={closing.next} onChange={(e) => setClosing((c) => ({ ...c, next: e.target.checked }))} />Schedule the next follow-up</label>
          {closing.next && <>
            <div className="grid grid-cols-[1fr_1fr_100px] gap-2">
              <select className="ui-input w-full" value={closing.type} onChange={(e) => setClosing((c) => ({ ...c, type: e.target.value }))}>{FU_TYPES.map((t) => <option key={t.value}>{t.value}</option>)}</select>
              <DateInput className="ui-input w-full" value={closing.date} onChange={(e) => setClosing((c) => ({ ...c, date: e.target.value }))} />
              <input type="time" className="ui-input w-full" value={closing.time} onChange={(e) => setClosing((c) => ({ ...c, time: e.target.value }))} />
            </div>
            <div><label className={labelCls}>Next step</label><input className="ui-input w-full" value={closing.nextNote} onChange={(e) => setClosing((c) => ({ ...c, nextNote: e.target.value }))} /></div>
          </>}
        </Dialog>
      )}
      {moving && (
        <Dialog title={`Reschedule · ${moving.f.leadName}`} onClose={() => setMoving(null)} busy={busy} confirm="Reschedule" disabled={!moving.date}
          onConfirm={() => act(() => followUpsApi.reschedule(moving.f._id, { date: moving.date, time: moving.time }), "Rescheduled")}>
          <div className="flex flex-wrap gap-1.5">
            {[["Today", 0], ["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]].map(([l, d]) => (
              <button key={l} type="button" className={"ui-btn ui-btn-sm " + (moving.date === isoDay(d) ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => setMoving((m) => ({ ...m, date: isoDay(d) }))}>{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <DateInput className="ui-input w-full" value={moving.date} onChange={(e) => setMoving((m) => ({ ...m, date: e.target.value }))} />
            <input type="time" className="ui-input w-full" value={moving.time} onChange={(e) => setMoving((m) => ({ ...m, time: e.target.value }))} />
          </div>
        </Dialog>
      )}
      {removing && <Confirm danger title={`Cancel the follow-up with ${removing.leadName}?`} confirmLabel="Cancel follow-up" busy={busy} onCancel={() => setRemoving(null)} onConfirm={() => act(() => followUpsApi.remove(removing._id), "Follow-up cancelled")} />}
    </div>
  );
}

function Dialog({ title, children, onClose, onConfirm, confirm, busy, disabled }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={<>
        <button type="button" className="ui-btn ui-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="ui-btn ui-btn-primary" onClick={onConfirm} disabled={busy || disabled}>{busy ? "Working…" : confirm}</button>
      </>}
    >
      <div className="space-y-3">{children}</div>
    </Modal>
  );
}

/** Change the lead's status (and sub-status / lost reason) straight from a follow-up. */
function StatusDialog({ f, meta, onClose, onSaved }) {
  const toast = useToast();
  const statuses = meta.statuses || [];
  const [v, setV] = useState({ statusId: idOf(f.lead?.status) || "", subId: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const status = statuses.find((x) => x._id === v.statusId);
  const subs = (meta.subStatuses || []).filter((x) => idOf(x.status) === v.statusId);
  const ready = v.statusId && (!status?.isLost || v.reason.trim());

  async function save() {
    setBusy(true);
    try { await leadsApi.setStatus(idOf(f.lead), v.statusId, v.subId || null, status?.isLost ? v.reason.trim() : undefined); toast("Status updated"); onSaved(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      title={`Update status · ${f.leadName || f.lead?.name || ""}`}
      onClose={onClose}
      footer={<>
        <button className="ui-btn ui-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="ui-btn ui-btn-primary" onClick={save} disabled={busy || !ready}>{busy ? "Saving…" : "Save"}</button>
      </>}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((x) => (
            <button key={x._id} type="button" className="ui-btn ui-btn-sm" onClick={() => setV({ statusId: x._id, subId: "", reason: "" })}
              style={v.statusId === x._id ? { background: x.color || "var(--primary)", color: "#fff", borderColor: x.color || "var(--primary)" } : { background: `color-mix(in srgb, ${x.color || "var(--primary)"} 12%, transparent)`, color: x.color || "var(--primary)", borderColor: "transparent" }}>
              {x.name}
            </button>
          ))}
        </div>
        {subs.length > 0 && (
          <div><label className={labelCls}>Sub-status</label>
            <select className="ui-input w-full" value={v.subId} onChange={(e) => setV((x) => ({ ...x, subId: e.target.value }))}>
              <option value="">None</option>{subs.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
            </select></div>
        )}
        {status?.isLost && (
          <div><label className={labelCls}>Lost reason *</label>
            <input className="ui-input w-full" list="fu-lost-reasons" value={v.reason} onChange={(e) => setV((x) => ({ ...x, reason: e.target.value }))} />
            <datalist id="fu-lost-reasons">{[...new Set([...(meta.lostReasons || []), ...LOST_REASONS])].map((r) => <option key={r} value={r} />)}</datalist></div>
        )}
      </div>
    </Modal>
  );
}
