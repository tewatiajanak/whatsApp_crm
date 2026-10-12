import { useEffect, useState } from "react";
import { crmApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Avatar } from "../components/ui";
import { compactMoney } from "../components/lead/leadUtils";

const MEASURES = [["wins", "Wins"], ["value", "Won value"], ["calls", "Calls"], ["followUps", "Follow-ups done"]];
const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const show = (k, v) => (k === "value" ? compactMoney(v) : v);

// Monthly targets per counsellor and the leaderboard against them.
export default function Targets() {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("setup", "edit");
  const [month, setMonth] = useState(thisMonth);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const board = useApi(() => crmApi.targets(month), [month]);
  const rows = board.data?.rows || [];

  useEffect(() => { setDraft(Object.fromEntries(rows.map((r) => [r.owner, { ...r.target }]))); }, [board.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setSaving(true);
    try {
      await crmApi.saveTargets(month, Object.entries(draft).map(([owner, t]) => ({ owner, ...t })));
      toast("Targets saved");
      setEditing(false);
      board.reload();
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <PageHeader title="Targets"
        actions={<>
          <input type="month" className="ui-input" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label="Month" />
          {canEdit && !editing && <button type="button" className="ui-btn ui-btn-outline" onClick={() => setEditing(true)}><i className="bi bi-bullseye"></i>Set targets</button>}
          {editing && <><button type="button" className="ui-btn ui-btn-outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button></>}
        </>} />
      <ErrorBox error={board.error} />
      {board.loading && !board.data ? <Spinner /> : !rows.length ? <div className="rounded-xl border bg-card"><EmptyState icon="people" text="No counsellors to show." /></div> : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={r.owner} className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-sm font-semibold text-muted-foreground w-5 text-center">{i + 1}</span>
                <Avatar name={r.owner} size={30} />
                <span className="text-sm font-semibold text-foreground flex-1 truncate">{r.owner}</span>
                {r.progress !== null && <span className="text-sm font-semibold" style={{ color: r.progress >= 100 ? "var(--success)" : r.progress >= 60 ? "var(--foreground)" : "var(--warning)" }}>{r.progress}%</span>}
                <span className="text-xs text-muted-foreground hidden sm:inline">{r.achieved.leads} new leads</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {MEASURES.map(([k, label]) => {
                  const target = r.target[k];
                  const pct = target ? Math.min(100, (r.achieved[k] / target) * 100) : 0;
                  return (
                    <div key={k}>
                      <div className="flex justify-between text-[11px] text-muted-foreground mb-1"><span>{label}</span>
                        <span><span className="font-semibold text-foreground">{show(k, r.achieved[k])}</span>{target ? ` / ${show(k, target)}` : ""}</span></div>
                      {editing ? (
                        <input className="ui-input w-full" type="number" min="0" placeholder="Target" value={draft[r.owner]?.[k] || ""} onChange={(e) => setDraft((d) => ({ ...d, [r.owner]: { ...d[r.owner], [k]: Number(e.target.value) || 0 } }))} />
                      ) : (
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--muted-background)" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--success)" : "var(--primary)" }} /></div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
