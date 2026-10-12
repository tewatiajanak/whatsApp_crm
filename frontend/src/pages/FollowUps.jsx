import { useState } from "react";
import { Link } from "react-router-dom";
import { followUpsApi, leadsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, StatCard, Chip, Confirm } from "../components/ui";
import DateInput from "../components/DateInput";
import { formatDateTime } from "../utils/dateFormat";
import { FollowUpCalendar } from "../components/lead/MyCrm";
import { FU_TYPES, FU_OUTCOMES, PRIORITY, fuIcon, dueInfo, isoDay, waLink, telLink, labelCls } from "../components/lead/leadUtils";

const BUCKETS = [
  { key: "overdue", label: "Overdue", icon: "exclamation-triangle", tone: "destructive" },
  { key: "today", label: "Due today", icon: "bell", tone: "warning" },
  { key: "upcoming", label: "Upcoming", icon: "clock-history", tone: "info" },
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
  const items = fu.data?.[bucket] || [];
  const label = BUCKETS.find((b) => b.key === bucket).label;

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
  const actions = (f) => f.done ? null : (
    <span className="inline-flex gap-1">
      {!f.contactsHidden && <a className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Call" href={telLink(f.phone)}><i className="bi bi-telephone" style={{ fontSize: 13 }}></i></a>}
      {!f.contactsHidden && <a className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="WhatsApp" href={waLink(f.phone)} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp" style={{ fontSize: 13 }}></i></a>}
      {canEdit && <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Reschedule" onClick={() => setMoving({ f, date: isoDay(1), time: "10:00" })}><i className="bi bi-calendar2-week" style={{ fontSize: 13 }}></i></button>}
      {can("followups", "del") && <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Cancel follow-up" onClick={() => setRemoving(f)}><i className="bi bi-x-lg" style={{ fontSize: 12 }}></i></button>}
      {canEdit && <button type="button" className="ui-btn ui-btn-sm ui-btn-primary" onClick={() => setClosing({ f, outcome: "Completed", note: "", next: false, date: isoDay(2), time: "10:00", type: f.type, nextNote: "" })}><i className="bi bi-check-lg"></i>Done</button>}
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {BUCKETS.map((b) => <StatCard key={b.key} label={b.label} value={counts[b.key] ?? "—"} icon={b.icon} tone={b.tone} active={bucket === b.key} onClick={() => setBucket(b.key)} />)}
      </div>

      {mode === "calendar" ? <FollowUpCalendar owner={owner} /> : fu.loading && !fu.data ? <Spinner /> : !items.length ? (
        <div className="rounded-xl border bg-card"><EmptyState icon="check2-circle" text={`Nothing under ${label.toLowerCase()}.`} /></div>
      ) : (
        <>
          <div className="md:hidden space-y-2">
            {items.map((f) => (
              <div key={f._id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">{leadLine(f)}<span className="text-xs whitespace-nowrap">{dueCell(f)}</span></div>
                <div className="text-xs text-muted-foreground mt-1.5"><i className={`bi bi-${fuIcon(f.type)} me-1`}></i>{f.type} · {f.owner || "Unassigned"}</div>
                {(f.note || f.completionNote) && <div className="text-xs text-foreground mt-1">{f.done ? f.completionNote || f.note : f.note}</div>}
                {!f.done && <div className="mt-2 flex justify-end">{actions(f)}</div>}
              </div>
            ))}
          </div>
          <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground text-left" style={{ background: "var(--muted-background)" }}>
                    <th className="px-4 py-3 font-medium">Lead</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Note</th>
                    <th className="px-4 py-3 font-medium">Owner</th><th className="px-4 py-3 font-medium">{bucket === "done" ? "Outcome" : "Due"}</th><th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((f) => (
                    <tr key={f._id} className="border-t hover:bg-accent/30">
                      <td className="px-4 py-2.5">{leadLine(f)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><i className={`bi bi-${fuIcon(f.type)} me-1.5`} style={{ color: "var(--primary)" }}></i>{f.type}</td>
                      <td className="px-4 py-2.5 text-muted-foreground" style={{ maxWidth: 320 }}><span className="line-clamp-2">{(f.done ? f.completionNote || f.note : f.note) || "—"}</span></td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{f.owner || "Unassigned"}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">{dueCell(f)}{f.done && <div className="text-[11px] text-muted-foreground">{formatDateTime(f.completedAt || f.updatedAt)}</div>}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">{actions(f)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {counts[bucket] > items.length && <div className="text-xs text-muted-foreground mt-2">Showing the first {items.length} of {counts[bucket]}.</div>}
        </>
      )}

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
            <input className="ui-input w-full" placeholder="What to do next" value={closing.nextNote} onChange={(e) => setClosing((c) => ({ ...c, nextNote: e.target.value }))} />
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-card shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {children}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="ui-btn ui-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={onConfirm} disabled={busy || disabled}>{busy ? "Working…" : confirm}</button>
        </div>
      </div>
    </div>
  );
}
