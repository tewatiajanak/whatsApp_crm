import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import DateInput from "../../components/DateInput";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UIButton } from "../components/UIKit";
import { LABEL } from "../user-management/shared";
import EmployeePicker from "./EmployeePicker";
import { usePm } from "./PmLayout";
import { TAT_UNITS } from "./shared";

type Form = {
  title: string; project: string; projectModule: string; assignee: string; mode: "due" | "tat"; due: string; tatValue: number; tatUnit: string;
  priority: string; description: string; checklist: string[];
};

/** "+ Task": an ad-hoc task, with or without a project. */
export default function QuickTask({ open, onClose, onCreated, project, projectModule }: { open: boolean; onClose: () => void; onCreated?: (task: any) => void; project?: string; projectModule?: string }) {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { user, hasRight } = useAuth() as any;
  const { employees, masters } = usePm();
  const me = String(user?._id || user?.id || "");
  const canAssign = hasRight("tasks", "create") || hasRight("tasks", "assign");
  const blank = (): Form => ({ title: "", project: project || "", projectModule: projectModule || "", assignee: me, mode: "due", due: "", tatValue: 1, tatUnit: "working_days", priority: "", description: "", checklist: [] });
  const [form, setForm] = useState<Form>(blank());
  const [projects, setProjects] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [item, setItem] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(blank());
    setFiles([]);
    setItem("");
    if (hasRight("projects", "view")) pmApi.projects().then((r: any) => setProjects((r?.data ?? []).filter((p: any) => !p.actualEnd))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project, projectModule]);
  useEffect(() => {
    if (!form.project) return setModules([]);
    pmApi.project(form.project).then((r: any) => setModules(r?.data?.modules ?? [])).catch(() => setModules([]));
  }, [form.project]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body: any = { ...form, checklist: form.checklist.map((text) => ({ text })) };
      if (form.mode === "due") { delete body.tatValue; delete body.tatUnit; } else delete body.due;
      const res: any = await pmApi.createTask(body);
      for (const f of files) await pmApi.uploadAttachment(res.data._id, f).catch((e: any) => toast(e?.message || `Could not attach ${f.name}`, "error"));
      toast("Task added");
      onCreated?.(res.data);
      onClose();
    } catch (e: any) {
      toast(e?.message || "Could not add the task", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="crm-theme w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="border-b p-4 pr-10"><SheetTitle>Add task</SheetTitle></SheetHeader>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
          <div className="sm:col-span-2">
            <label className={LABEL}>Title *</label>
            <input autoFocus className="ui-input w-full" value={form.title} maxLength={160} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className={LABEL}>Project</label>
            <select className="ui-input w-full" value={form.project} disabled={!!project} onChange={(e) => setForm({ ...form, project: e.target.value, projectModule: "" })}>
              <option value="">— none —</option>
              {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Module</label>
            <select className="ui-input w-full" value={form.projectModule} disabled={!form.project} onChange={(e) => setForm({ ...form, projectModule: e.target.value })}>
              <option value="">— none —</option>
              {modules.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Assignee</label>
            <EmployeePicker employees={employees} value={form.assignee} onChange={(id) => setForm({ ...form, assignee: id || me })} disabled={!canAssign} clearable={false} />
          </div>
          <div>
            <label className={LABEL}>Priority</label>
            <select className="ui-input w-full" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="">—</option>
              {(masters.priority || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Deadline by</label>
            <select className="ui-input w-full" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as any })}>
              <option value="due">Due date</option>
              <option value="tat">TAT</option>
            </select>
          </div>
          {form.mode === "due" ? (
            <div>
              <label className={LABEL}>Due date</label>
              <DateInput className="ui-input w-full" value={form.due} onChange={(e: any) => setForm({ ...form, due: e.target.value })} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={LABEL}>TAT</label>
                <input type="number" min={0} step="0.5" className="ui-input w-full" value={form.tatValue} onChange={(e) => setForm({ ...form, tatValue: Number(e.target.value) })} />
              </div>
              <div>
                <label className={LABEL}>Unit</label>
                <select className="ui-input w-full" value={form.tatUnit} onChange={(e) => setForm({ ...form, tatUnit: e.target.value })}>
                  {TAT_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className="sm:col-span-2">
            <label className={LABEL}>Description</label>
            <textarea className="ui-input w-full" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ height: "auto" }} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Checklist</label>
            <div className="space-y-1.5">
              {form.checklist.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-sm truncate">{c}</span>
                  <UIButton size="icon-sm" variant="ghost" title="Remove" onClick={() => setForm({ ...form, checklist: form.checklist.filter((_, j) => j !== i) })}><X className="h-3.5 w-3.5" /></UIButton>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input className="ui-input flex-1 min-w-0" value={item} onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && item.trim()) { e.preventDefault(); setForm({ ...form, checklist: [...form.checklist, item.trim()] }); setItem(""); } }} />
                <UIButton size="sm" variant="outline" disabled={!item.trim()} onClick={() => { setForm({ ...form, checklist: [...form.checklist, item.trim()] }); setItem(""); }} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add</UIButton>
              </div>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL}>Attachments</label>
            <input type="file" multiple className="ui-input w-full" style={{ height: "auto", padding: 6 }} onChange={(e) => setFiles([...(e.target.files || [])].slice(0, 3))} />
          </div>
        </div>
        <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
          <UIButton variant="outline" onClick={onClose} className="flex-1">Cancel</UIButton>
          <UIButton onClick={save} loading={saving} disabled={!form.title.trim()} className="flex-1">Add task</UIButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
