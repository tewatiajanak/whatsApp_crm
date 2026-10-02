import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { http } from "../../api";
import { useToast } from "../../context/ToastContext";
import { UIButton } from "../components/UIKit";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { type TaskTemplate, loadTaskTemplates, newId, saveTaskTemplates } from "@/lib/task-checklists";

/** Setup → Events → Task Checklist: tasks and their checklist points, per event category. */
type Category = { _id: string; name: string };
const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
const TH = "px-4 py-3 text-left font-medium";
const ALL = "";
const CHECK = "flex items-center gap-2 text-sm text-foreground cursor-pointer";

export default function TaskChecklistPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const [searchParams] = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  // "all" = show every task; otherwise one category id ("" is the "All categories" bucket)
  const [filter, setFilter] = useState<string>(searchParams.get("category") || "all");
  const [rows, setRows] = useState<TaskTemplate[]>(loadTaskTemplates);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [form, setForm] = useState({ task: "", categoryIds: [] as string[], order: 1 });
  const [formOpen, setFormOpen] = useState(false);
  const [newPoint, setNewPoint] = useState<Record<string, string>>({});

  useEffect(() => {
    http
      .get("/event-types?perPage=200&sort=sortOrder")
      .then((res: any) => setCategories(res?.data ?? []))
      .catch(() => toast("Could not load event categories", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // rows are kept in Sr No order; saving renumbers them 1…n
  const persist = (next: TaskTemplate[]) => {
    const numbered = next.map((r, i) => ({ ...r, order: i + 1 }));
    setRows(numbered);
    saveTaskTemplates(numbered);
  };
  const categoryNames = (ids: string[]) =>
    ids.length ? ids.map((id) => categories.find((c) => c._id === id)?.name || "Deleted category").join(", ") : "All categories";
  const placeAt = (list: TaskTemplate[], row: TaskTemplate, position: number) => {
    const next = list.filter((r) => r.id !== row.id);
    next.splice(Math.max(0, Math.min(next.length, (Math.floor(position) || 1) - 1)), 0, row);
    return next;
  };
  // Sr No: move a task to the position typed
  const moveRow = (r: TaskTemplate, position: number) => {
    if ((Math.floor(position) || 1) !== rows.indexOf(r) + 1) persist(placeAt(rows, r, position));
  };

  const visible = useMemo(
    () => rows.filter((r) => filter === "all" || (filter === ALL ? !r.categoryIds.length : r.categoryIds.includes(filter))),
    [rows, filter]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({ task: "", categoryIds: filter === "all" || filter === ALL ? [] : [filter], order: rows.length + 1 });
    setFormOpen(true);
  };
  const openEdit = (r: TaskTemplate) => {
    setEditing(r);
    setForm({ task: r.task, categoryIds: r.categoryIds, order: rows.indexOf(r) + 1 });
    setFormOpen(true);
  };
  const toggleCategory = (id: string) =>
    setForm((f) => ({ ...f, categoryIds: f.categoryIds.includes(id) ? f.categoryIds.filter((c) => c !== id) : [...f.categoryIds, id] }));
  const save = () => {
    const task = form.task.trim();
    if (!task) return;
    const { order, ...values } = form;
    if (editing) persist(placeAt(rows, { ...editing, ...values, task }, order));
    else {
      const created: TaskTemplate = { id: newId(), ...values, task, order, points: [] };
      persist(placeAt(rows, created, order));
      setOpen((o) => ({ ...o, [created.id]: true }));
    }
    setFormOpen(false);
    toast(editing ? "Task updated" : "Task added — now add its checklist points");
  };
  const remove = (r: TaskTemplate) => {
    if (!window.confirm(`Delete the task "${r.task}" and its ${r.points.length} checklist point${r.points.length === 1 ? "" : "s"}? Events that already have it keep their copy.`)) return;
    persist(rows.filter((x) => x.id !== r.id));
  };

  const addPoint = (r: TaskTemplate) => {
    const text = (newPoint[r.id] || "").trim();
    if (!text) return;
    persist(rows.map((x) => (x.id === r.id ? { ...x, points: [...x.points, { id: newId(), text }] } : x)));
    setNewPoint((p) => ({ ...p, [r.id]: "" }));
  };
  const editPoint = (r: TaskTemplate, pid: string, text: string) =>
    persist(rows.map((x) => (x.id === r.id ? { ...x, points: x.points.map((p) => (p.id === pid ? { ...p, text } : p)) } : x)));
  const removePoint = (r: TaskTemplate, pid: string) =>
    persist(rows.map((x) => (x.id === r.id ? { ...x, points: x.points.filter((p) => p.id !== pid) } : x)));

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
            <ListChecks className="h-4 w-4" />
          </span>
          <h2 className="text-base font-semibold text-foreground leading-tight">Task Checklist</h2>
        </div>
        <UIButton onClick={openCreate} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add task</UIButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="ui-input" style={{ minWidth: 220 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Every event category</option>
          <option value={ALL}>Common to all categories</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <div className="ml-auto text-xs text-muted-foreground">{visible.length} task{visible.length === 1 ? "" : "s"}</div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className={TH} style={{ width: 84 }}>Sr No</th>
                <th className={TH}>Task</th>
                <th className={TH}>Event category</th>
                <th className={TH} style={{ width: 150 }}>Checklist points</th>
                <th className="px-4 py-3 font-medium" style={{ width: 110, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No tasks yet for this selection.</td></tr>
              )}
              {visible.map((r) => {
                const isOpen = !!open[r.id];
                return (
                  <Fragment key={r.id}>
                    <tr className="border-t hover:bg-accent/30">
                      <td className="px-4 py-1.5">
                        <input
                          key={`${r.id}:${r.order}`}
                          type="number"
                          min={1}
                          max={rows.length}
                          className="ui-input"
                          style={{ height: 30, width: 52, padding: "0 6px", textAlign: "center" }}
                          defaultValue={rows.indexOf(r) + 1}
                          onBlur={(e) => moveRow(r, Number(e.target.value))}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => setOpen((o) => ({ ...o, [r.id]: !isOpen }))} className="inline-flex items-center gap-1.5 font-medium text-foreground" style={{ background: "transparent", border: 0, padding: 0 }}>
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                          {r.task}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">{categoryNames(r.categoryIds)}</td>
                      <td className="px-4 py-2.5">{r.points.length}</td>
                      <td className="px-4 py-2.5" style={{ textAlign: "right" }}>
                        <div className="inline-flex items-center gap-1">
                          <UIButton size="icon-sm" variant="ghost" onClick={() => openEdit(r)} title="Edit task"><Pencil className="h-3.5 w-3.5" /></UIButton>
                          <UIButton size="icon-sm" variant="danger" onClick={() => remove(r)} title="Delete task"><Trash2 className="h-3.5 w-3.5" /></UIButton>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3" style={{ background: "var(--muted-background)" }}>
                          <div className={LABEL}>Checklist of “{r.task}”</div>
                          <div className="space-y-1.5" style={{ maxWidth: 720 }}>
                            {r.points.map((p, n) => (
                              <div key={p.id} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground" style={{ width: 22, textAlign: "right" }}>{n + 1}.</span>
                                <input className="ui-input flex-1" style={{ height: 30 }} value={p.text} onChange={(e) => editPoint(r, p.id, e.target.value)} />
                                <UIButton size="icon-sm" variant="danger" onClick={() => removePoint(r, p.id)} title="Remove point"><X className="h-3.5 w-3.5" /></UIButton>
                              </div>
                            ))}
                            <div className="flex items-center gap-2">
                              <span style={{ width: 22 }} />
                              <input
                                className="ui-input flex-1"
                                style={{ height: 30 }}
                                value={newPoint[r.id] || ""}
                                placeholder="New checklist point"
                                onChange={(e) => setNewPoint({ ...newPoint, [r.id]: e.target.value })}
                                onKeyDown={(e) => e.key === "Enter" && addPoint(r)}
                              />
                              <UIButton size="sm" variant="outline" onClick={() => addPoint(r)} disabled={!(newPoint[r.id] || "").trim()} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add</UIButton>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="crm-theme w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{editing ? "Edit task" : "Add task"}</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div>
              <label className={LABEL}>Task *</label>
              <input autoFocus className="ui-input w-full" value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save()} maxLength={80} />
            </div>
            <div>
              <label className={LABEL}>Event category</label>
              <div className="rounded-lg border p-3 space-y-2">
                <label className={CHECK}>
                  <input type="checkbox" checked={!form.categoryIds.length} onChange={() => setForm({ ...form, categoryIds: [] })} />
                  All categories
                </label>
                {categories.map((c) => (
                  <label key={c._id} className={CHECK}>
                    <input type="checkbox" checked={form.categoryIds.includes(c._id)} onChange={() => toggleCategory(c._id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ maxWidth: 140 }}>
              <label className={LABEL}>Sr No</label>
              <input type="number" min={1} max={rows.length + (editing ? 0 : 1)} className="ui-input w-full" value={form.order} onChange={(e) => setForm({ ...form, order: Math.max(1, parseInt(e.target.value) || 1) })} />
            </div>
          </div>
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setFormOpen(false)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={save} disabled={!form.task.trim()} className="flex-1">{editing ? "Save changes" : "Add task"}</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
