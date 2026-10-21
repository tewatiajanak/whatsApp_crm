import { useState } from "react";
import { leadsApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Spinner, ErrorBox, Chip } from "../ui";
import { PRIORITY, LOST_REASONS, dueInfo, compactMoney } from "./leadUtils";

// Pipeline board: a column per status. Drag a card to another column to move the lead.
export default function LeadBoard({ params, meta, reloadKey, onOpen, onChanged }) {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("leads", "edit");
  const [pipeline, setPipeline] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);
  const board = useApi(() => leadsApi.board({ ...params, pipeline }), [params, pipeline, reloadKey]);
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const [lost, setLost] = useState(null);

  const columns = (board.data?.columns || []).filter((c) => !hideEmpty || c.count > 0 || over === c.status._id || dragging);

  async function move(lead, status, lostReason) {
    try {
      await leadsApi.setStatus(lead._id, status._id, null, lostReason);
      toast(`${lead.name} → ${status.name}`);
      board.reload();
      onChanged?.();
    } catch (e) { toast(e.message, "error"); }
  }
  function drop(status) {
    const d = dragging;
    setDragging(null);
    setOver(null);
    if (!d || d.from === status._id) return;
    if (status.isLost) return setLost({ lead: d.lead, status, reason: "" });
    move(d.lead, status);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <select className="ui-input" value={pipeline} onChange={(e) => setPipeline(e.target.value)} aria-label="Pipeline">
          <option value="">All statuses</option>
          {(meta.services || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />Hide empty stages</label>
      </div>
      <ErrorBox error={board.error} />
      {board.loading && !board.data ? <Spinner /> : (
        <div className="flex gap-3 overflow-x-auto pb-3" style={{ minHeight: 320 }}>
          {columns.map((c) => (
            <div
              key={c.status._id}
              className="flex-shrink-0 rounded-xl border flex flex-col"
              style={{ width: 268, background: "var(--muted-background)", borderColor: over === c.status._id ? "var(--primary)" : undefined, maxHeight: "calc(100vh - 290px)" }}
              onDragOver={(e) => { if (dragging) { e.preventDefault(); setOver(c.status._id); } }}
              onDragLeave={() => setOver((o) => (o === c.status._id ? null : o))}
              onDrop={() => drop(c.status)}
            >
              <div className="px-3 py-2 border-b flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: c.status.color }} />
                  <span className="text-sm font-semibold text-foreground truncate">{c.status.name}</span>
                </span>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{c.count}{c.value ? ` · ${compactMoney(c.value)}` : ""}</span>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {c.leads.map((l) => {
                  const pr = PRIORITY[l.priority] || PRIORITY.warm;
                  const due = dueInfo(l.nextFollowUp);
                  return (
                    <div
                      key={l._id}
                      draggable={canEdit}
                      onDragStart={() => setDragging({ lead: l, from: c.status._id })}
                      onDragEnd={() => { setDragging(null); setOver(null); }}
                      onClick={() => onOpen(l._id)}
                      className="rounded-lg border bg-card p-2.5 cursor-pointer hover:shadow-sm"
                      style={{ opacity: dragging?.lead._id === l._id ? 0.5 : 1 }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{l.name}</span>
                        <i className={`bi bi-${pr.icon} flex-shrink-0`} style={{ color: pr.color, fontSize: 12 }} title={`${pr.label} · ${l.score}`}></i>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{l.course || l.phone}</div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-[11px] text-muted-foreground truncate">{l.owner && l.owner !== "Unassigned" ? l.owner.split(" ")[0] : "Unassigned"}</span>
                        {l.nextFollowUp && <Chip color={`var(--${due.tone})`} icon="calendar-event">{due.text}</Chip>}
                      </div>
                      {canEdit && (
                        <select className="ui-input w-full mt-2 md:hidden" style={{ height: 28, fontSize: 12 }} value="" aria-label="Move to stage" onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { const to = (board.data?.columns || []).find((x) => x.status._id === e.target.value)?.status; if (to) (to.isLost ? setLost({ lead: l, status: to, reason: "" }) : move(l, to)); }}>
                          <option value="">Move to…</option>
                          {(board.data?.columns || []).filter((x) => x.status._id !== c.status._id).map((x) => <option key={x.status._id} value={x.status._id}>{x.status.name}</option>)}
                        </select>
                      )}
                    </div>
                  );
                })}
                {c.count > c.leads.length && <div className="text-[11px] text-center text-muted-foreground py-1">+{c.count - c.leads.length} more</div>}
              </div>
            </div>
          ))}
          {!columns.length && <div className="text-sm text-muted-foreground p-6">No leads match.</div>}
        </div>
      )}

      {lost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setLost(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-foreground">Why was {lost.lead.name} lost?</div>
            <input className="ui-input w-full" list="board-lost" autoFocus aria-label="Reason" value={lost.reason} onChange={(e) => setLost((x) => ({ ...x, reason: e.target.value }))} />
            <datalist id="board-lost">{[...new Set([...(meta.lostReasons || []), ...LOST_REASONS])].map((r) => <option key={r} value={r} />)}</datalist>
            <div className="flex justify-end gap-2">
              <button type="button" className="ui-btn ui-btn-outline" onClick={() => setLost(null)}>Cancel</button>
              <button type="button" className="ui-btn ui-btn-primary" disabled={!lost.reason.trim()} onClick={() => { const x = lost; setLost(null); move(x.lead, x.status, x.reason.trim()); }}>Mark lost</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
