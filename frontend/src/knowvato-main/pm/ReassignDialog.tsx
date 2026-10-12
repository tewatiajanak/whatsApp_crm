import { useEffect, useState } from "react";
import { pmApi } from "../../api";
import { useToast } from "../../context/ToastContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UIButton } from "../components/UIKit";
import { LABEL } from "../user-management/shared";
import EmployeePicker from "./EmployeePicker";
import { usePm } from "./PmLayout";

/**
 * "Give this to someone else": new person + reason.
 * `onSubmit` does the call; the dialog closes when it resolves.
 */
export default function ReassignDialog({
  title, current, count, onSubmit, onClose,
}: {
  title: string;
  /** id of the present holder (left out of nothing, only shown as the start value) */
  current?: string;
  /** bulk: how many tasks are selected */
  count?: number;
  onSubmit: (to: string, reason: string) => Promise<any>;
  onClose: () => void;
}) {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { employees } = usePm();
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [load, setLoad] = useState<any>(null);
  useEffect(() => {
    setLoad(null);
    if (to) pmApi.personLoad(to).then((r: any) => setLoad(r.data)).catch(() => {});
  }, [to]);

  const submit = async () => {
    if (!to || !reason.trim()) return;
    setSaving(true);
    try {
      await onSubmit(to, reason.trim());
      toast("Reassigned");
      onClose();
    } catch (e: any) {
      toast(e?.message || "Could not reassign", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="crm-theme sm:max-w-md">
        <DialogHeader><DialogTitle>{title}{count ? ` (${count})` : ""}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={LABEL}>New person *</label>
            <EmployeePicker employees={employees.filter((e) => e._id !== current)} value={to} onChange={setTo} clearable={false} />
            {load && (
              <div className="mt-1.5 text-xs" style={{ color: load.overloaded ? "var(--destructive)" : "var(--muted-foreground)" }}>
                {load.overloaded ? "Overloaded: " : ""}{load.open} open tasks · {load.overdue} overdue · {load.plannedHours}h planned today
              </div>
            )}
          </div>
          <div>
            <label className={LABEL}>Reason *</label>
            <textarea className="ui-input w-full" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} style={{ height: "auto" }} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <UIButton variant="outline" onClick={onClose}>Cancel</UIButton>
          <UIButton onClick={submit} loading={saving} disabled={!to || !reason.trim()}>Reassign</UIButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
