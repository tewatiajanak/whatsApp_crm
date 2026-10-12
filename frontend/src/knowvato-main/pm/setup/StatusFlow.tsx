import { useEffect, useState } from "react";
import { GitBranch, Save } from "lucide-react";
import { pmApi } from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { UIButton } from "../../components/UIKit";
import { MasterBadge, PageTitle, type Master } from "../shared";

/** Allowed task status changes: a from → to grid. */
export default function StatusFlow() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const canSave = hasRight("setup", "configure");
  const [statuses, setStatuses] = useState<Master[]>([]);
  const [flow, setFlow] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, s]: any[] = await Promise.all([pmApi.masterList("task_status"), pmApi.settings()]);
        setStatuses((m?.data ?? []).filter((x: Master) => x.active));
        setFlow(new Set((s?.data?.taskStatusFlow ?? []).map((f: any) => `${f.from}>${f.to}`)));
      } catch (e: any) {
        toast(e?.message || "Could not load", "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key: string) =>
    setFlow((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await pmApi.saveSettings({ taskStatusFlow: [...flow].map((k) => ({ from: k.split(">")[0], to: k.split(">")[1] })) });
      toast("Saved");
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageTitle
        icon={<GitBranch className="h-4 w-4" />}
        title="Status Flow"
        actions={canSave && <UIButton onClick={save} loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />}>Save</UIButton>}
      />
      <p className="mt-2 text-xs text-muted-foreground">Nothing ticked = every change is allowed.</p>
      <div className="mt-2 rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
              <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">From ↓ / To →</th>
              {statuses.map((s) => <th key={s._id} className="px-3 py-2.5 font-medium" style={{ textAlign: "center" }}><MasterBadge item={s} /></th>)}
            </tr>
          </thead>
          <tbody>
            {statuses.map((from) => (
              <tr key={from._id} className="border-t">
                <td className="px-3 py-2"><MasterBadge item={from} /></td>
                {statuses.map((to) => (
                  <td key={to._id} className="px-3 py-2" style={{ textAlign: "center" }}>
                    {from._id !== to._id && (
                      <input type="checkbox" disabled={!canSave} checked={flow.has(`${from._id}>${to._id}`)} onChange={() => toggle(`${from._id}>${to._id}`)} style={{ width: 18, height: 18 }} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
