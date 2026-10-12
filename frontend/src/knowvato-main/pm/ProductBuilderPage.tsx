import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, BellRing, CheckSquare, Copy, Eye, GripVertical, Link2, Paperclip, Pencil, Plus, ShieldCheck, Trash2, Upload, X,
} from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchInput, UIButton } from "../components/UIKit";
import { LABEL, Pill, Toggle } from "../user-management/shared";
import EmployeePicker from "./EmployeePicker";
import ImportTasksDialog from "./ImportTasksDialog";
import RulesEditor, { type Rule, type RuleMeta } from "./RulesEditor";
import { MasterBadge, PersonAvatar, moveItem, tatText, type Employee, type Master } from "./shared";

type Person = { _id: string; name: string; photo?: string } | null;
type Mod = { _id: string; name: string; order: number; defaultIncharge: Person; active: boolean; days: number; autoMessages: Rule[] };
type Check = { _id?: string; text: string; mandatory: boolean };
type Task = {
  _id: string; module: string; title: string; taskType: string | null; priority: string | null; defaultAssignee: Person;
  tatValue: number; tatUnit: string; order: number; dependsOn: string[]; clientVerification: boolean; clientVisible: boolean;
  attachmentRequired: boolean; mandatoryAttachment: boolean; description: string; checklist: Check[]; autoMessages: Rule[];
};
type TaskForm = Omit<Task, "_id" | "order" | "defaultAssignee"> & { _id?: string; defaultAssignee: string };

const TABS = ["Details", "Checklist", "Dependencies", "Auto Messages"] as const;

/** Setup › Products › one product: modules on the left, the selected module's tasks on the right. */
export default function ProductBuilderPage() {
  const { productId = "" } = useParams();
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const canAdd = hasRight("setup", "create");
  const canEdit = hasRight("setup", "edit");
  const canDelete = hasRight("setup", "del");

  const [product, setProduct] = useState<any>(null);
  const [modules, setModules] = useState<Mod[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [days, setDays] = useState(0);
  const [loop, setLoop] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [masters, setMasters] = useState<Record<string, Master[]>>({});
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modForm, setModForm] = useState<{ _id?: string; name: string; defaultIncharge: string; active: boolean; autoMessages: Rule[] } | null>(null);
  const [ruleMeta, setRuleMeta] = useState<RuleMeta | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [projectRules, setProjectRules] = useState<Rule[] | null>(null);
  const [taskForm, setTaskForm] = useState<TaskForm | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Details");
  const [newCheck, setNewCheck] = useState("");
  const [depSearch, setDepSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [drag, setDrag] = useState<{ kind: "module" | "task" | "check"; from: number } | null>(null);

  const load = async () => {
    try {
      const res: any = await pmApi.productFull(productId);
      const d = res.data;
      setProduct(d.product);
      setModules(d.modules);
      setTasks(d.tasks);
      setDays(d.days);
      setLoop(d.loop || []);
      setSelected((cur) => (d.modules.some((m: Mod) => m._id === cur) ? cur : d.modules[0]?._id || ""));
    } catch (e: any) {
      toast(e?.message || "Could not load the product", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    pmApi.employees().then((r: any) => setEmployees(r?.data ?? [])).catch(() => {});
    pmApi.masters().then((r: any) => setMasters(r?.data ?? {})).catch(() => {});
    pmApi.templateMeta().then((r: any) => setRuleMeta(r?.data ?? null)).catch(() => {});
    pmApi.templates().then((r: any) => setTemplates(r?.data ?? [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const masterOf = (type: string, id?: string | null) => (masters[type] || []).find((m) => m._id === id) || null;
  const taskById = useMemo(() => new Map(tasks.map((t) => [t._id, t])), [tasks]);
  const moduleTasks = useMemo(() => tasks.filter((t) => t.module === selected).sort((a, b) => a.order - b.order), [tasks, selected]);
  const current = modules.find((m) => m._id === selected);
  const run = async (fn: () => Promise<any>, done?: string) => {
    setSaving(true);
    try {
      await fn();
      if (done) toast(done);
      await load();
      return true;
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  /* ---- modules ---- */
  const saveModule = async () => {
    if (!modForm?.name.trim()) return;
    const body = { name: modForm.name, defaultIncharge: modForm.defaultIncharge || null, active: modForm.active, autoMessages: modForm.autoMessages };
    const done = await run(async () => {
      if (modForm._id) await pmApi.updateModule(modForm._id, body);
      else {
        const res: any = await pmApi.createModule(productId, body);
        setSelected(res.data._id);
      }
    }, "Saved");
    if (done) setModForm(null);
  };
  const removeModule = (m: Mod) => {
    const n = tasks.filter((t) => t.module === m._id).length;
    if (window.confirm(`Delete "${m.name}"${n ? ` and its ${n} tasks` : ""}?`)) run(() => pmApi.removeModule(m._id), "Deleted");
  };
  const dropModule = (to: number) => {
    if (!drag || drag.kind !== "module" || drag.from === to) return setDrag(null);
    const next = moveItem(modules, drag.from, to);
    setModules(next);
    setDrag(null);
    pmApi.orderModules(productId, next.map((m) => m._id)).catch((e: any) => { toast(e?.message || "Could not save the order", "error"); load(); });
  };

  /* ---- tasks ---- */
  const openTask = (t?: Task) => {
    setTab("Details");
    setNewCheck("");
    setDepSearch("");
    setTaskForm(
      t
        ? { ...t, attachmentRequired: !!(t.attachmentRequired || t.mandatoryAttachment), defaultAssignee: t.defaultAssignee?._id || "", checklist: t.checklist.map((c) => ({ ...c })), dependsOn: [...t.dependsOn], autoMessages: (t.autoMessages || []).map((r) => ({ ...r })) }
        : {
            module: selected, title: "", taskType: null, priority: null, defaultAssignee: "", tatValue: 1, tatUnit: "working_days", dependsOn: [],
            clientVerification: false, clientVisible: true, attachmentRequired: false, mandatoryAttachment: false, description: "", checklist: [], autoMessages: [],
          }
    );
  };
  const saveTask = async () => {
    if (!taskForm?.title.trim()) return;
    const { _id, ...rest } = taskForm;
    const body = { ...rest, defaultAssignee: rest.defaultAssignee || null };
    const done = await run(() => (_id ? pmApi.updateTaskTemplate(_id, body) : pmApi.createTaskTemplate(productId, body)), "Saved");
    if (done) setTaskForm(null);
  };
  const removeTask = (t: Task) => {
    if (window.confirm(`Delete "${t.title}"?`)) run(() => pmApi.removeTaskTemplate(t._id), "Deleted");
  };
  const dropTask = (to: number) => {
    if (!drag || drag.kind !== "task" || drag.from === to) return setDrag(null);
    const next = moveItem(moduleTasks, drag.from, to).map((t, i) => ({ ...t, order: i + 1 }));
    setTasks((all) => [...all.filter((t) => t.module !== selected), ...next]);
    setDrag(null);
    pmApi.orderTaskTemplates(selected, next.map((t) => t._id)).catch((e: any) => { toast(e?.message || "Could not save the order", "error"); load(); });
  };
  const saveProjectRules = async () => {
    if (!projectRules) return;
    const done = await run(() => pmApi.updateProduct(productId, { autoMessages: projectRules }), "Saved");
    if (done) setProjectRules(null);
  };
  const rulesProps = { meta: ruleMeta, templates, employees, statuses: masters.task_status || [] };
  const setF = (patch: Partial<TaskForm>) => setTaskForm((f) => (f ? { ...f, ...patch } : f));
  const addCheck = () => {
    if (!taskForm || !newCheck.trim()) return;
    setF({ checklist: [...taskForm.checklist, { text: newCheck.trim(), mandatory: false }] });
    setNewCheck("");
  };

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!product) return <div className="py-12 text-center text-sm text-muted-foreground">Product not found</div>;

  const depChoices = tasks.filter((t) => t._id !== taskForm?._id && (!depSearch.trim() || t.title.toLowerCase().includes(depSearch.trim().toLowerCase())));

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link to="/modules/projects/setup/products" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Products"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground leading-tight truncate">{product.name}</h2>
            <div className="text-[11px] font-mono text-muted-foreground">{product.code}</div>
          </div>
          <Pill tone="info">{days} days</Pill>
          <Pill tone="muted">{tasks.length} tasks</Pill>
        </div>
        {canAdd && (
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && <UIButton size="sm" variant="outline" onClick={() => setProjectRules((product.autoMessages || []).map((r: Rule) => ({ ...r })))} leftIcon={<BellRing className="h-3.5 w-3.5" />}>Auto Messages{product.autoMessages?.length ? ` (${product.autoMessages.length})` : ""}</UIButton>}
            <UIButton size="sm" variant="outline" onClick={() => setImporting(true)} leftIcon={<Upload className="h-3.5 w-3.5" />}>Import Excel</UIButton>
          </div>
        )}
      </div>

      {loop.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--destructive)", color: "var(--destructive)" }}>
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Circular dependency: {loop.map((id) => taskById.get(id)?.title || "?").join(" → ")}</span>
        </div>
      )}

      <div className="mt-3 flex flex-col lg:flex-row gap-3">
        {/* modules */}
        <div className="lg:w-[300px] shrink-0 rounded-xl border bg-card overflow-hidden self-start w-full">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b" style={{ background: "var(--muted-background)" }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Modules</span>
            {canAdd && <UIButton size="icon-sm" variant="ghost" title="Add module" onClick={() => setModForm({ name: "", defaultIncharge: "", active: true, autoMessages: [] })}><Plus className="h-4 w-4" /></UIButton>}
          </div>
          {modules.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No modules
              {canAdd && <div className="mt-3"><UIButton size="sm" onClick={() => setModForm({ name: "", defaultIncharge: "", active: true, autoMessages: [] })} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add module</UIButton></div>}
            </div>
          )}
          {modules.map((m, i) => {
            const count = tasks.filter((t) => t.module === m._id).length;
            const active = m._id === selected;
            return (
              <div
                key={m._id}
                draggable={canEdit}
                onDragStart={() => setDrag({ kind: "module", from: i })}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropModule(i)}
                onClick={() => setSelected(m._id)}
                className={`flex items-center gap-2 px-2.5 py-2.5 cursor-pointer ${i ? "border-t" : ""}`}
                style={{ background: active ? "color-mix(in srgb, var(--primary) 10%, transparent)" : undefined, opacity: m.active ? 1 : 0.55, boxShadow: active ? "inset 3px 0 0 var(--primary)" : undefined }}
              >
                {canEdit && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" style={{ cursor: "grab" }} />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {m.defaultIncharge && <PersonAvatar name={m.defaultIncharge.name} photo={m.defaultIncharge.photo} size={16} />}
                    <span>{count} tasks · {m.days} days</span>
                  </div>
                </div>
                <div className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
                  {canAdd && <UIButton size="icon-sm" variant="ghost" title="Copy module" onClick={() => run(() => pmApi.copyModule(m._id), "Module copied")}><Copy className="h-3.5 w-3.5" /></UIButton>}
                  {canEdit && <UIButton size="icon-sm" variant="ghost" title="Edit" onClick={() => setModForm({ _id: m._id, name: m.name, defaultIncharge: m.defaultIncharge?._id || "", active: m.active, autoMessages: (m.autoMessages || []).map((r) => ({ ...r })) })}><Pencil className="h-3.5 w-3.5" /></UIButton>}
                  {canDelete && <UIButton size="icon-sm" variant="danger" title="Delete" onClick={() => removeModule(m)}><Trash2 className="h-3.5 w-3.5" /></UIButton>}
                </div>
              </div>
            );
          })}
        </div>

        {/* tasks of the selected module */}
        <div className="min-w-0 flex-1 rounded-xl border bg-card overflow-hidden self-start w-full">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b" style={{ background: "var(--muted-background)" }}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{current ? current.name : "Tasks"}</span>
            {canAdd && current && <UIButton size="sm" onClick={() => openTask()} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add task</UIButton>}
          </div>
          {current && moduleTasks.length === 0 && (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">No tasks</div>
          )}
          {moduleTasks.map((t, i) => (
            <div
              key={t._id}
              draggable={canEdit}
              onDragStart={() => setDrag({ kind: "task", from: i })}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropTask(i)}
              onClick={() => openTask(t)}
              className={`flex items-center gap-2.5 px-2.5 py-2.5 cursor-pointer hover:bg-accent/30 ${i ? "border-t" : ""}`}
              style={{ outline: loop.includes(t._id) ? "1px solid var(--destructive)" : undefined }}
            >
              {canEdit && <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" style={{ cursor: "grab" }} />}
              <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground truncate">{t.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {t.taskType && <Pill tone="muted">{masterOf("task_type", t.taskType)?.name || "—"}</Pill>}
                  {t.priority && <MasterBadge item={masterOf("priority", t.priority)} />}
                  <Pill tone="info">{tatText(t.tatValue, t.tatUnit)}</Pill>
                  {t.dependsOn.length > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground" title={t.dependsOn.map((d) => taskById.get(d)?.title).join(", ")}><Link2 className="h-3 w-3" />{t.dependsOn.length}</span>}
                  {t.checklist.length > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground" title="Checklist"><CheckSquare className="h-3 w-3" />{t.checklist.length}</span>}
                  {t.clientVerification && <span title="Client verification" className="inline-flex text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /></span>}
                  {t.clientVisible && <span title="Client visible" className="inline-flex text-muted-foreground"><Eye className="h-3.5 w-3.5" /></span>}
                  {(t.attachmentRequired || t.mandatoryAttachment) && <span title={t.mandatoryAttachment ? "Attachment mandatory" : "Attachment required"} className="inline-flex" style={{ color: t.mandatoryAttachment ? "var(--destructive)" : "var(--muted-foreground)" }}><Paperclip className="h-3.5 w-3.5" /></span>}
                </div>
              </div>
              {t.defaultAssignee && <span title={t.defaultAssignee.name}><PersonAvatar name={t.defaultAssignee.name} photo={t.defaultAssignee.photo} size={26} /></span>}
              {canDelete && <span onClick={(e) => e.stopPropagation()}><UIButton size="icon-sm" variant="danger" title="Delete" onClick={() => removeTask(t)}><Trash2 className="h-3.5 w-3.5" /></UIButton></span>}
            </div>
          ))}
        </div>
      </div>

      {/* module form */}
      <Sheet open={!!modForm} onOpenChange={(o) => !o && setModForm(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{modForm?._id ? "Edit module" : "Add module"}</SheetTitle></SheetHeader>
          {modForm && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className={LABEL}>Name *</label>
                <input autoFocus className="ui-input w-full" value={modForm.name} maxLength={80} onChange={(e) => setModForm({ ...modForm, name: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Module incharge</label>
                <EmployeePicker employees={employees} value={modForm.defaultIncharge} onChange={(id) => setModForm({ ...modForm, defaultIncharge: id })} />
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Active</span>
                <Toggle on={modForm.active} onChange={() => setModForm({ ...modForm, active: !modForm.active })} labels={["Yes", "No"]} />
              </div>
              <div>
                <label className={LABEL}>Auto messages</label>
                <RulesEditor level="module" value={modForm.autoMessages} onChange={(autoMessages) => setModForm({ ...modForm, autoMessages })} {...rulesProps} />
              </div>
            </div>
          )}
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setModForm(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={saveModule} loading={saving} disabled={!modForm?.name.trim()} className="flex-1">Save</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* task drawer */}
      <Sheet open={!!taskForm} onOpenChange={(o) => !o && setTaskForm(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10">
            <SheetTitle>{taskForm?._id ? taskForm.title || "Task" : "Add task"}</SheetTitle>
            {taskForm && <div className="text-[12px] text-muted-foreground truncate">{modules.find((m) => m._id === taskForm.module)?.name}</div>}
          </SheetHeader>
          {taskForm && (
            <>
              <div className="flex gap-1 border-b px-3 pt-2 overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className="px-3 py-2 text-[13px] font-medium whitespace-nowrap"
                    style={{ background: "transparent", border: 0, borderBottom: `2px solid ${tab === t ? "var(--primary)" : "transparent"}`, color: tab === t ? "var(--primary)" : "var(--muted-foreground)" }}
                  >
                    {t}
                    {t === "Checklist" && taskForm.checklist.length > 0 && ` (${taskForm.checklist.length})`}
                    {t === "Dependencies" && taskForm.dependsOn.length > 0 && ` (${taskForm.dependsOn.length})`}
                    {t === "Auto Messages" && taskForm.autoMessages.length > 0 && ` (${taskForm.autoMessages.length})`}
                  </button>
                ))}
              </div>
              <fieldset disabled={!canEdit && !!taskForm._id} className="flex-1 overflow-y-auto p-4" style={{ border: 0, margin: 0, minWidth: 0 }}>
                {tab === "Details" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className={LABEL}>Task *</label>
                      <input autoFocus className="ui-input w-full" value={taskForm.title} maxLength={160} onChange={(e) => setF({ title: e.target.value })} />
                    </div>
                    <div>
                      <label className={LABEL}>Assignee</label>
                      <EmployeePicker employees={employees} value={taskForm.defaultAssignee} onChange={(id) => setF({ defaultAssignee: id })} />
                    </div>
                    <div>
                      <label className={LABEL}>Task type</label>
                      <select className="ui-input w-full" value={taskForm.taskType || ""} onChange={(e) => setF({ taskType: e.target.value || null })}>
                        <option value="">—</option>
                        {(masters.task_type || []).filter((m) => m.active || m._id === taskForm.taskType).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL}>TAT</label>
                      <input type="number" min={0} step="0.5" className="ui-input w-full" value={taskForm.tatValue} onChange={(e) => setF({ tatValue: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className={LABEL}>Unit</label>
                      <select className="ui-input w-full" value={taskForm.tatUnit} onChange={(e) => setF({ tatUnit: e.target.value })}>
                        <option value="hours">Hour</option>
                        <option value="working_days">Day</option>
                        {taskForm.tatUnit === "days" && <option value="days">Calendar Day</option>}
                      </select>
                    </div>
                    <div className="sm:col-span-2 rounded-lg border divide-y">
                      {([
                        ["clientVerification", "Client verification"],
                        ["clientVisible", "Client visible"],
                        ["attachmentRequired", "Attachment required"],
                        ...(taskForm.attachmentRequired ? [["mandatoryAttachment", "Attachment mandatory"]] : []),
                      ] as [keyof TaskForm, string][]).map(([k, label]) => (
                        <div key={k} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                          <span>{label}</span>
                          <Toggle on={!!taskForm[k]} onChange={() => setF({ [k]: !taskForm[k], ...(k === "attachmentRequired" && taskForm[k] ? { mandatoryAttachment: false } : {}) } as any)} labels={["Yes", "No"]} />
                        </div>
                      ))}
                    </div>
                    <div className="sm:col-span-2">
                      <label className={LABEL}>Description</label>
                      <textarea className="ui-input w-full" rows={4} value={taskForm.description} onChange={(e) => setF({ description: e.target.value })} style={{ height: "auto" }} />
                    </div>
                  </div>
                )}

                {tab === "Checklist" && (
                  <div className="space-y-2">
                    {taskForm.checklist.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No checklist items</div>}
                    {taskForm.checklist.map((c, i) => (
                      <div
                        key={i}
                        draggable
                        onDragStart={() => setDrag({ kind: "check", from: i })}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => { if (drag?.kind === "check") setF({ checklist: moveItem(taskForm.checklist, drag.from, i) }); setDrag(null); }}
                        className="flex items-center gap-2"
                      >
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" style={{ cursor: "grab" }} />
                        <input className="ui-input flex-1 min-w-0" value={c.text} onChange={(e) => setF({ checklist: taskForm.checklist.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                        <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground whitespace-nowrap" style={{ marginBottom: 0 }}>
                          <input type="checkbox" checked={c.mandatory} onChange={(e) => setF({ checklist: taskForm.checklist.map((x, j) => (j === i ? { ...x, mandatory: e.target.checked } : x)) })} />
                          Mandatory
                        </label>
                        <UIButton size="icon-sm" variant="ghost" title="Remove" onClick={() => setF({ checklist: taskForm.checklist.filter((_, j) => j !== i) })}><X className="h-3.5 w-3.5" /></UIButton>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2">
                      <input className="ui-input flex-1 min-w-0" value={newCheck} onChange={(e) => setNewCheck(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheck(); } }} />
                      <UIButton size="sm" variant="outline" onClick={addCheck} disabled={!newCheck.trim()} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add</UIButton>
                    </div>
                  </div>
                )}

                {tab === "Dependencies" && (
                  <div className="space-y-2">
                    <SearchInput value={depSearch} onChange={(e) => setDepSearch(e.target.value)} placeholder="Search" />
                    {depChoices.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">No other tasks</div>}
                    {modules.map((m) => {
                      const list = depChoices.filter((t) => t.module === m._id);
                      if (!list.length) return null;
                      return (
                        <div key={m._id} className="rounded-lg border overflow-hidden">
                          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>{m.name}</div>
                          {list.map((t) => (
                            <label key={t._id} className="flex items-center gap-2.5 border-t px-3 py-2.5 text-sm cursor-pointer" style={{ marginBottom: 0 }}>
                              <input
                                type="checkbox"
                                style={{ width: 18, height: 18 }}
                                checked={taskForm.dependsOn.includes(t._id)}
                                onChange={(e) => setF({ dependsOn: e.target.checked ? [...taskForm.dependsOn, t._id] : taskForm.dependsOn.filter((d) => d !== t._id) })}
                              />
                              <span className="min-w-0 flex-1 truncate">{t.title}</span>
                              <span className="text-[11px] text-muted-foreground">{tatText(t.tatValue, t.tatUnit)}</span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
                {tab === "Auto Messages" && (
                  <RulesEditor level="task" value={taskForm.autoMessages} onChange={(autoMessages) => setF({ autoMessages })} {...rulesProps} />
                )}
              </fieldset>
            </>
          )}
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setTaskForm(null)} className="flex-1">Cancel</UIButton>
            {(canEdit || (canAdd && !taskForm?._id)) && <UIButton onClick={saveTask} loading={saving} disabled={!taskForm?.title.trim()} className="flex-1">Save</UIButton>}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* project-level auto messages */}
      <Sheet open={!!projectRules} onOpenChange={(o) => !o && setProjectRules(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>Project auto messages</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {projectRules && <RulesEditor level="project" value={projectRules} onChange={setProjectRules} {...rulesProps} />}
          </div>
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setProjectRules(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={saveProjectRules} loading={saving} className="flex-1">Save</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ImportTasksDialog productId={productId} open={importing} onClose={() => setImporting(false)} onDone={load} />
    </div>
  );
}
