import { useEffect, useState } from "react";
import { GripVertical, Palette, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { pmApi } from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UIButton } from "../../components/UIKit";
import { LABEL, Pill, Toggle } from "../../user-management/shared";
import { PageTitle, moveItem, type Master } from "../shared";

export const FLAG_LABELS: Record<string, string> = {
  isCompleted: "Completed",
  isOnHold: "On hold",
  isCancelled: "Cancelled",
  isInitial: "Initial",
  isInProgress: "In progress",
  isWaitingForClient: "Waiting for client",
  pausesTat: "Pauses TAT",
  isOpen: "Open",
  isClosed: "Closed",
  isTraining: "Training",
  isOnsite: "Onsite",
};
const VALUE_LABELS: Record<string, string> = { responseHours: "Response hrs", resolveHours: "Resolve hrs" };
const SWATCHES = ["#64748b", "#2563eb", "#0891b2", "#16a34a", "#d97706", "#f97316", "#dc2626", "#a855f7"];

type Form = { name: string; color: string; active: boolean; flags: Record<string, boolean>; values: Record<string, number> };

/** One simple master (statuses, priorities, task types, …): list, drag to reorder, add / edit / delete. */
export default function MasterList({ type, title, icon: Icon, flags, values }: { type: string; title: string; icon: LucideIcon; flags: string[]; values: string[] }) {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const canAdd = hasRight("setup", "create");
  const canEdit = hasRight("setup", "edit");
  const canDelete = hasRight("setup", "del");
  const [rows, setRows] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Master | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await pmApi.masterList(type);
      setRows(res?.data ?? []);
    } catch (e: any) {
      toast(e?.message || "Could not load", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const blank = (): Form => ({ name: "", color: SWATCHES[1], active: true, flags: Object.fromEntries(flags.map((f) => [f, false])), values: Object.fromEntries(values.map((v) => [v, 0])) });
  const openAdd = () => { setEditing(null); setForm(blank()); };
  const openEdit = (m: Master) => {
    setEditing(m);
    setForm({ name: m.name, color: m.color, active: m.active, flags: { ...blank().flags, ...(m.flags || {}) }, values: { ...blank().values, ...(m.values || {}) } });
  };

  const save = async () => {
    if (!form?.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await pmApi.updateMaster(type, editing._id, form);
      else await pmApi.createMaster(type, form);
      toast("Saved");
      setForm(null);
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: Master) => {
    if (!window.confirm(`Delete "${m.name}"?`)) return;
    try {
      await pmApi.removeMaster(type, m._id);
      toast("Deleted");
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not delete", "error");
    }
  };

  const drop = async (to: number) => {
    if (dragFrom === null || dragFrom === to) return setDragFrom(null);
    const next = moveItem(rows, dragFrom, to);
    setRows(next);
    setDragFrom(null);
    try {
      await pmApi.orderMasters(type, next.map((x) => x._id));
    } catch (e: any) {
      toast(e?.message || "Could not save the order", "error");
      load();
    }
  };

  return (
    <div>
      <PageTitle
        icon={<Icon className="h-4 w-4" />}
        title={title}
        actions={canAdd && <UIButton onClick={openAdd} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add</UIButton>}
      />

      <div className="mt-3 rounded-xl border bg-card overflow-hidden">
        {!loading && rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No items
            {canAdd && <div className="mt-3"><UIButton size="sm" onClick={openAdd} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add</UIButton></div>}
          </div>
        )}
        {rows.map((m, i) => (
          <div
            key={m._id}
            draggable={canEdit}
            onDragStart={() => setDragFrom(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(i)}
            className={`flex items-center gap-2.5 px-3 py-2.5 ${i ? "border-t" : ""}`}
            style={{ opacity: dragFrom === i ? 0.4 : m.active ? 1 : 0.55 }}
          >
            {canEdit && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" style={{ cursor: "grab" }} />}
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: m.color }} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
              {(flags.some((f) => m.flags?.[f]) || values.length > 0) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {flags.filter((f) => m.flags?.[f]).map((f) => <Pill key={f} tone="info">{FLAG_LABELS[f] || f}</Pill>)}
                  {values.map((v) => <Pill key={v} tone="muted">{VALUE_LABELS[v] || v}: {m.values?.[v] ?? 0}</Pill>)}
                </div>
              )}
            </div>
            {!m.active && <Pill tone="muted">Inactive</Pill>}
            {canEdit && <UIButton size="icon-sm" variant="ghost" title="Edit" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></UIButton>}
            {canDelete && <UIButton size="icon-sm" variant="danger" title="Delete" onClick={() => remove(m)}><Trash2 className="h-3.5 w-3.5" /></UIButton>}
          </div>
        ))}
      </div>

      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{editing ? "Edit" : "Add"} — {title}</SheetTitle></SheetHeader>
          {form && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className={LABEL}>Name *</label>
                <input autoFocus className="ui-input w-full" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Colour</label>
                <div className="flex flex-wrap items-center gap-2">
                  {SWATCHES.map((c) => (
                    <button key={c} type="button" title={c} onClick={() => setForm({ ...form, color: c })} className="h-7 w-7 rounded-full" style={{ background: c, border: 0, outline: form.color === c ? "2px solid var(--foreground)" : "none", outlineOffset: 2 }} />
                  ))}
                  <label title="Custom colour" className="relative ml-auto inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[12.5px] font-medium text-foreground" style={{ marginBottom: 0, outline: SWATCHES.includes(form.color) ? "none" : "2px solid var(--foreground)", outlineOffset: 2 }}>
                    <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                    Custom
                    {!SWATCHES.includes(form.color) && <span className="h-3.5 w-3.5 rounded-full" style={{ background: form.color }} />}
                    <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer" style={{ opacity: 0, padding: 0, border: 0 }} />
                  </label>
                </div>
              </div>
              {values.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {values.map((v) => (
                    <div key={v}>
                      <label className={LABEL}>{VALUE_LABELS[v] || v}</label>
                      <input type="number" min={0} className="ui-input w-full" value={form.values[v] ?? 0} onChange={(e) => setForm({ ...form, values: { ...form.values, [v]: Number(e.target.value) } })} />
                    </div>
                  ))}
                </div>
              )}
              {flags.length > 0 && (
                <div className="rounded-lg border divide-y">
                  {flags.map((f) => (
                    <div key={f} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span>{FLAG_LABELS[f] || f}</span>
                      <Toggle on={!!form.flags[f]} onChange={() => setForm({ ...form, flags: { ...form.flags, [f]: !form.flags[f] } })} labels={["Yes", "No"]} />
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Active</span>
                <Toggle on={form.active} onChange={() => setForm({ ...form, active: !form.active })} labels={["Yes", "No"]} />
              </div>
            </div>
          )}
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setForm(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={save} loading={saving} disabled={!form?.name.trim()} className="flex-1">Save</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
