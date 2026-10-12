import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import DateInput from "../../components/DateInput";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UIButton } from "../components/UIKit";
import { LABEL, Pill, Toggle } from "../user-management/shared";
import { fmtDate } from "@/utils/date";
import EmployeePicker from "./EmployeePicker";
import { usePm } from "./PmLayout";
import { PersonAvatar, todayYmd } from "./shared";

const FREQ: Record<string, string> = { daily: "day", weekly: "week", monthly: "month" };
const blank = () => ({ title: "", assignee: "", freq: "weekly", every: 1, dueInDays: 1, next: todayYmd(), until: "", priority: "", description: "", active: true });

/** Tasks that are created again and again (weekly status call, monthly backup check). */
export default function RecurringTasks({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const { employees, masters } = usePm();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const canAdd = hasRight("tasks", "create");

  const load = () => pmApi.recurring().then((r: any) => setRows(r?.data ?? [])).catch((e: any) => toast(e?.message || "Could not load", "error"));
  useEffect(() => {
    if (open) { load(); setForm(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const { _id, ...body } = form;
      if (_id) await pmApi.updateRecurring(_id, body);
      else await pmApi.createRecurring(body);
      toast("Saved");
      setForm(null);
      load();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (x: any) => {
    if (!window.confirm(`Delete the recurring task "${x.title}"? Tasks already created stay.`)) return;
    try {
      await pmApi.removeRecurring(x._id);
      load();
    } catch (e: any) {
      toast(e?.message || "Could not delete", "error");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="crm-theme w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{form ? (form._id ? "Edit recurring task" : "New recurring task") : "Recurring tasks"}</SheetTitle></SheetHeader>

        {!form && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {rows.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No recurring tasks</div>}
            {rows.map((x) => (
              <div key={x._id} className="rounded-lg border p-3" style={{ opacity: x.active ? 1 : 0.55 }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{x.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {x.assignee && <span className="inline-flex items-center gap-1"><PersonAvatar name={x.assignee.name} photo={x.assignee.photo} size={16} />{x.assignee.name}</span>}
                      <span>· every {x.every > 1 ? `${x.every} ${FREQ[x.freq]}s` : FREQ[x.freq]}</span>
                      <span>· next {fmtDate(x.next)}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 shrink-0">
                    {!x.active && <Pill tone="muted">Off</Pill>}
                    {hasRight("tasks", "edit") && <UIButton size="icon-sm" variant="ghost" title="Edit" onClick={() => setForm({ _id: x._id, title: x.title, assignee: x.assignee?._id || "", freq: x.freq, every: x.every, dueInDays: x.dueInDays, next: x.next, until: x.until, priority: x.priority?._id || "", description: x.description, active: x.active })}><Pencil className="h-3.5 w-3.5" /></UIButton>}
                    {hasRight("tasks", "del") && <UIButton size="icon-sm" variant="danger" title="Delete" onClick={() => remove(x)}><Trash2 className="h-3.5 w-3.5" /></UIButton>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {form && (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 content-start">
            <div className="col-span-2">
              <label className={LABEL}>Title *</label>
              <input autoFocus className="ui-input w-full" value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Assignee *</label>
              <EmployeePicker employees={employees} value={form.assignee} onChange={(id) => setForm({ ...form, assignee: id })} clearable={false} />
            </div>
            <div>
              <label className={LABEL}>Repeat</label>
              <select className="ui-input w-full" value={form.freq} onChange={(e) => setForm({ ...form, freq: e.target.value })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Every</label>
              <input type="number" min={1} max={30} className="ui-input w-full" value={form.every} onChange={(e) => setForm({ ...form, every: Number(e.target.value) })} />
            </div>
            <div>
              <label className={LABEL}>Next on *</label>
              <DateInput className="ui-input w-full" value={form.next} onChange={(e: any) => setForm({ ...form, next: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Until</label>
              <DateInput className="ui-input w-full" value={form.until} onChange={(e: any) => setForm({ ...form, until: e.target.value })} />
            </div>
            <div>
              <label className={LABEL}>Due after (days)</label>
              <input type="number" min={0} max={90} className="ui-input w-full" value={form.dueInDays} onChange={(e) => setForm({ ...form, dueInDays: Number(e.target.value) })} />
            </div>
            <div>
              <label className={LABEL}>Priority</label>
              <select className="ui-input w-full" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="">—</option>
                {(masters.priority || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Description</label>
              <textarea className="ui-input w-full" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ height: "auto" }} />
            </div>
            <div className="col-span-2 flex items-center justify-between gap-3 text-sm">
              <span>Active</span>
              <Toggle on={form.active} onChange={() => setForm({ ...form, active: !form.active })} labels={["Yes", "No"]} />
            </div>
          </div>
        )}

        <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
          {form ? (
            <>
              <UIButton variant="outline" onClick={() => setForm(null)} className="flex-1">Back</UIButton>
              <UIButton onClick={save} loading={saving} disabled={!form.title.trim() || !form.assignee || !form.next} className="flex-1">Save</UIButton>
            </>
          ) : (
            canAdd && <UIButton onClick={() => setForm(blank())} className="flex-1" leftIcon={<Plus className="h-3.5 w-3.5" />}>New recurring task</UIButton>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
