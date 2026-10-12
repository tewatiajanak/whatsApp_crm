import { useState } from "react";
import { leadsApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { Modal, Spinner, ErrorBox, EmptyState, Chip } from "../ui";
import { formatDate } from "../../utils/dateFormat";

// Leads that share a phone number or email, with one-click merge into the lead you keep.
export default function DuplicatesDrawer({ onClose, onChanged }) {
  const toast = useToast();
  const groups = useApi(() => leadsApi.duplicates(), []);
  const [keep, setKeep] = useState({});
  const [busy, setBusy] = useState(null);

  async function merge(g, i) {
    const primary = keep[i] || g.leads[0]._id;
    setBusy(i);
    try {
      await leadsApi.merge(primary, g.leads.map((l) => l._id).filter((id) => id !== primary));
      toast("Merged");
      setKeep({});
      groups.reload();
      onChanged?.();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(null); }
  }

  return (
    <Modal title="Duplicate leads" size="lg" onClose={onClose}>
      <ErrorBox error={groups.error} />
      {groups.loading && !groups.data ? <Spinner /> : !(groups.data || []).length ? <EmptyState icon="check2-circle" text="No duplicates found." /> : (
        <div className="space-y-3">
          {groups.data.map((g, i) => (
            <div key={g.reason + g.key} className="rounded-lg border overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b" style={{ background: "var(--muted-background)" }}>
                <span className="text-xs text-foreground"><span className="font-semibold">{g.reason}</span> · {g.key}</span>
                <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy !== null} onClick={() => merge(g, i)}>{busy === i ? "Merging…" : `Merge ${g.leads.length} into one`}</button>
              </div>
              {g.leads.map((l, j) => {
                const picked = (keep[i] || g.leads[0]._id) === l._id;
                return (
                  <label key={l._id} className={"flex items-start gap-2.5 px-3 py-2 cursor-pointer" + (j ? " border-t" : "")}>
                    <input type="radio" className="mt-1" name={`keep-${i}`} checked={picked} onChange={() => setKeep((k) => ({ ...k, [i]: l._id }))} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-foreground">{l.name}</span>
                        {l.status?.name && <Chip color={l.status.color}>{l.status.name}</Chip>}
                        {picked && <Chip color="var(--primary)" icon="check2">Keep</Chip>}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">{l.phone}{l.email ? ` · ${l.email}` : ""}</span>
                      <span className="block text-[11px] text-muted-foreground">{l.owner || "Unassigned"} · {l.source?.name || "No source"} · created {formatDate(l.createdAt)} · score {l.score}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
