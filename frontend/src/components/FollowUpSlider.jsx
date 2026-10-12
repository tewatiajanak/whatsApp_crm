import { useEffect, useState } from "react";
import DateInput from "./DateInput";
import { Modal } from "./ui";
import { useToast } from "../context/ToastContext";
import { leadsApi, followUpsApi } from "../api";
import { FU_TYPES, isoDay, labelCls } from "./lead/leadUtils";

const QUICK = [["Today", 0], ["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]];

// Log what just happened with a lead and/or schedule the next follow-up.
export default function FollowUpSlider({ lead, owners = [], onClose, onSaved }) {
  const toast = useToast();
  const [done, setDone] = useState({ type: "Call", remark: "" });
  const [next, setNext] = useState({ type: "Call", date: isoDay(1), time: "10:00", remark: "", assignedTo: lead.owner && lead.owner !== "Unassigned" ? lead.owner : "" });
  const [workload, setWorkload] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    setWorkload(null);
    if (!next.assignedTo) return undefined;
    followUpsApi.getWorkload(next.assignedTo).then((res) => live && setWorkload(res.data)).catch(() => undefined);
    return () => { live = false; };
  }, [next.assignedTo]);

  const hasLog = !!done.remark.trim();
  const hasNext = !!next.date;

  async function save() {
    setSaving(true);
    try {
      await leadsApi.addFollowUp(lead._id, {
        current: hasLog ? { type: done.type, date: isoDay(0), time: new Date().toTimeString().slice(0, 5), remark: done.remark.trim() } : undefined,
        next: hasNext ? { ...next, remark: next.remark.trim() } : undefined,
      });
      toast(hasLog && hasNext ? "Logged, next follow-up scheduled" : hasLog ? "Conversation logged" : "Follow-up scheduled");
      onSaved?.();
      onClose();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const typeSelect = (value, onChange) => (
    <select className="ui-input w-full" value={value} onChange={(e) => onChange(e.target.value)}>
      {FU_TYPES.map((t) => <option key={t.value} value={t.value}>{t.value}</option>)}
    </select>
  );
  const full = workload && workload.pending >= workload.capacity;

  return (
    <Modal
      title={<div><div>Follow-up</div><div className="text-xs font-normal text-muted-foreground">{lead.name} · {lead.phone}</div></div>}
      onClose={onClose}
      footer={<>
        <button type="button" className="ui-btn ui-btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
        <button type="button" className="ui-btn ui-btn-primary" disabled={saving || (!hasLog && !hasNext)} onClick={save}>{saving ? "Saving…" : "Save"}</button>
      </>}
    >
      <div className="space-y-4">
        <section className="rounded-lg border p-3 space-y-2">
          <div className="text-sm font-semibold text-foreground">What happened now</div>
          <div className="grid grid-cols-[130px_1fr] gap-2">
            {typeSelect(done.type, (v) => setDone((d) => ({ ...d, type: v })))}
            <input className="ui-input w-full" placeholder="What was discussed? (optional)" value={done.remark} onChange={(e) => setDone((d) => ({ ...d, remark: e.target.value }))} />
          </div>
        </section>

        <section className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-foreground">Next follow-up</div>
            {hasNext && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setNext((n) => ({ ...n, date: "" }))}>No follow-up</button>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map(([label, days]) => (
              <button key={label} type="button" className={"ui-btn ui-btn-sm " + (next.date === isoDay(days) ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => setNext((n) => ({ ...n, date: isoDay(days) }))}>{label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div><label className={labelCls}>Type</label>{typeSelect(next.type, (v) => setNext((n) => ({ ...n, type: v })))}</div>
            <div><label className={labelCls}>Date</label><DateInput className="ui-input w-full" value={next.date} min={isoDay(0)} onChange={(e) => setNext((n) => ({ ...n, date: e.target.value }))} /></div>
            <div><label className={labelCls}>Time</label><input type="time" className="ui-input w-full" value={next.time} onChange={(e) => setNext((n) => ({ ...n, time: e.target.value }))} /></div>
          </div>
          <div>
            <label className={labelCls}>What to do next</label>
            <input className="ui-input w-full" value={next.remark} onChange={(e) => setNext((n) => ({ ...n, remark: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Assign to</label>
            <select className="ui-input w-full" value={next.assignedTo} onChange={(e) => setNext((n) => ({ ...n, assignedTo: e.target.value }))}>
              <option value="">Lead owner</option>
              {owners.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {workload && (
              <div className="mt-2">
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                  <span>{workload.pending} open · {workload.overdue} overdue · {workload.completed} done today</span>
                  <span style={{ color: full ? "var(--destructive)" : undefined }}>{workload.pending}/{workload.capacity}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted-background)" }}>
                  <div className="h-full" style={{ width: `${Math.min(100, (workload.pending / workload.capacity) * 100)}%`, background: full ? "var(--destructive)" : "var(--primary)" }} />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}
