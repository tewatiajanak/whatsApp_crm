import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookmarkPlus, Download, Plus, Repeat, SlidersHorizontal, Trash2, UserRoundCog } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { SearchInput, UIButton } from "../components/UIKit";
import { fmtDate } from "@/utils/date";
import EmployeePicker from "./EmployeePicker";
import { usePm } from "./PmLayout";
import QuickTask from "./QuickTask";
import ReassignDialog from "./ReassignDialog";
import TaskDrawer from "./TaskDrawer";
import { TaskList, type TaskRow } from "./TaskViews";
import { exportRows } from "./shared";
import WorkTitle from "./WorkTabs";
import RecurringTasks from "./RecurringTasks";
import DateInput from "../../components/DateInput";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LABEL } from "../user-management/shared";

const BUCKETS = [["open", "Open"], ["overdue", "Overdue"], ["today", "Due today"], ["week", "This week"], ["waiting", "Waiting for client"], ["completed", "Completed"], ["", "All"]];
const PER_PAGE = 50;

/** Project Management → Tasks: every task the user may see, across projects. */
export default function TasksPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const { employees, masters } = usePm();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [params] = useSearchParams();
  const [f, setF] = useState({ bucket: params.get("bucket") ?? "open", assignee: params.get("assignee") || "", status: "", kind: "", label: "" });
  const [views, setViews] = useState<any[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [bulkEdit, setBulkEdit] = useState<{ status: string; priority: string; due: string; labels: string } | null>(null);
  const [recurring, setRecurring] = useState(false);
  const loadViews = () => pmApi.views("tasks").then((r: any) => setViews(r?.data ?? [])).catch(() => {});
  useEffect(() => {
    loadViews();
    pmApi.labels().then((r: any) => setLabels(r?.data ?? [])).catch(() => {});
  }, []);
  const saveView = async () => {
    const name = window.prompt("Name of this view");
    if (!name?.trim()) return;
    try {
      await pmApi.saveView({ screen: "tasks", name: name.trim(), filters: { ...f, q: search }, shared: window.confirm("Share this view with the team?") });
      loadViews();
      toast("View saved");
    } catch (e: any) {
      toast(e?.message || "Could not save the view", "error");
    }
  };
  const applyBulk = async () => {
    if (!bulkEdit) return;
    try {
      const res: any = await pmApi.bulkTasks({ ids: selected, status: bulkEdit.status || undefined, priority: bulkEdit.priority || undefined, due: bulkEdit.due || undefined, labels: bulkEdit.labels.split(",").map((x) => x.trim()).filter(Boolean) });
      toast(`${res.data.changed} tasks changed${res.data.failed.length ? `, ${res.data.failed.length} could not be changed: ${res.data.failed[0].error}` : ""}`, res.data.failed.length ? "error" : "success");
      setBulkEdit(null);
      setSelected([]);
      load();
    } catch (e: any) {
      toast(e?.message || "Could not change the tasks", "error");
    }
  };
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState(false);
  const [openTask, setOpenTask] = useState<string | null>(params.get("task"));
  const [add, setAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const query = (p: number, perPage = PER_PAGE) => {
    const q = new URLSearchParams({ page: String(p), perPage: String(perPage) });
    Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
    if (search.trim()) q.set("q", search.trim());
    return q.toString();
  };
  const load = async (p = page) => {
    setLoading(true);
    try {
      const res: any = await pmApi.tasks(query(p));
      setTasks(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      toast(e?.message || "Could not load tasks", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setSelected([]); load(1); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, search]);

  const exportExcel = async () => {
    try {
      const res: any = await pmApi.tasks(query(1, 500));
      exportRows("tasks.xlsx", "Tasks", (res.data ?? []).map((t: TaskRow) => ({
        Number: t.number, Task: t.title, Project: t.project?.name || "", Module: t.projectModule?.name || "", Type: t.kind === "adhoc" ? "Ad-hoc" : "Project", Assignee: t.assignee?.name || "",
        Status: t.status?.name || "", Due: t.due ? fmtDate(t.due) : "", Completed: t.actualEnd ? fmtDate(t.actualEnd) : "", Overdue: t.overdue ? "Yes" : "",
      })));
    } catch (e: any) {
      toast(e?.message || "Could not export", "error");
    }
  };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <>
      <WorkTitle
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selected.length > 0 && hasRight("tasks", "edit") && <UIButton variant="outline" onClick={() => setBulkEdit({ status: "", priority: "", due: "", labels: "" })} leftIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}>Change {selected.length}</UIButton>}
            {selected.length > 0 && hasRight("tasks", "reassign") && <UIButton variant="outline" onClick={() => setBulk(true)} leftIcon={<UserRoundCog className="h-3.5 w-3.5" />}>Reassign {selected.length}</UIButton>}
            <UIButton variant="outline" onClick={() => setRecurring(true)} leftIcon={<Repeat className="h-3.5 w-3.5" />}>Recurring</UIButton>
            <UIButton variant="outline" onClick={saveView} leftIcon={<BookmarkPlus className="h-3.5 w-3.5" />}>Save view</UIButton>
            {hasRight("tasks", "export") && <UIButton variant="outline" onClick={exportExcel} disabled={!total} leftIcon={<Download className="h-3.5 w-3.5" />}>Export Excel</UIButton>}
            {hasRight("tasks", "create") && <UIButton onClick={() => setAdd(true)} leftIcon={<Plus className="h-3.5 w-3.5" />}>Task</UIButton>}
          </div>
        }
      />

      <div className="mt-3 mb-3 flex items-center gap-2 flex-wrap">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" containerClassName="flex-1 min-w-[180px] max-w-sm" />
        <select className="ui-input" value={f.bucket} onChange={(e) => setF({ ...f, bucket: e.target.value })}>
          {BUCKETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="ui-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="">All status</option>
          {(masters.task_status || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
        </select>
        <select className="ui-input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          <option value="">All types</option>
          <option value="template">Project</option>
          <option value="adhoc">Ad-hoc</option>
        </select>
        {labels.length > 0 && (
          <select className="ui-input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })}>
            <option value="">All labels</option>
            {labels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <div style={{ width: 210 }}><EmployeePicker employees={employees} value={f.assignee} onChange={(id) => setF({ ...f, assignee: id })} emptyLabel="All employees" /></div>
        <span className="ml-auto text-xs text-muted-foreground">{loading ? "Loading…" : `${total} tasks`}</span>
      </div>
      {views.length > 0 && (
        <div className="-mt-1 mb-3 flex flex-wrap items-center gap-1.5">
          {views.map((v) => (
            <span key={v._id} className="inline-flex items-center gap-1 rounded-full border bg-card pl-2.5 pr-1 py-0.5 text-[12px]">
              <button type="button" onClick={() => { const { q, ...rest } = v.filters || {}; setSearch(q || ""); setF({ bucket: "", assignee: "", status: "", kind: "", label: "", ...rest }); }} style={{ background: "transparent", border: 0, padding: 0, color: "var(--foreground)" }}>{v.name}{v.shared ? " ·shared" : ""}</button>
              <button type="button" title="Delete view" onClick={() => pmApi.removeView(v._id).then(loadViews).catch((e: any) => toast(e?.message || "Could not delete", "error"))} className="inline-flex h-5 w-5 items-center justify-center" style={{ background: "transparent", border: 0, color: "var(--muted-foreground)" }}><Trash2 className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}

      <TaskList tasks={tasks} onOpen={setOpenTask} showProject selected={hasRight("tasks", "reassign") ? selected : undefined} onSelect={setSelected} />

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <UIButton size="sm" variant="outline" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }}>Previous</UIButton>
          <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
          <UIButton size="sm" variant="outline" disabled={page >= pages} onClick={() => { setPage(page + 1); load(page + 1); }}>Next</UIButton>
        </div>
      )}

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} onChanged={() => load()} />
      <RecurringTasks open={recurring} onClose={() => setRecurring(false)} />
      <Dialog open={!!bulkEdit} onOpenChange={(o) => !o && setBulkEdit(null)}>
        <DialogContent className="crm-theme sm:max-w-md">
          <DialogHeader><DialogTitle>Change {selected.length} tasks</DialogTitle></DialogHeader>
          {bulkEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Status</label>
                <select className="ui-input w-full" value={bulkEdit.status} onChange={(e) => setBulkEdit({ ...bulkEdit, status: e.target.value })}>
                  <option value="">No change</option>
                  {(masters.task_status || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Priority</label>
                <select className="ui-input w-full" value={bulkEdit.priority} onChange={(e) => setBulkEdit({ ...bulkEdit, priority: e.target.value })}>
                  <option value="">No change</option>
                  {(masters.priority || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Due date</label>
                <DateInput className="ui-input w-full" value={bulkEdit.due} onChange={(e: any) => setBulkEdit({ ...bulkEdit, due: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Add labels</label>
                <input className="ui-input w-full" value={bulkEdit.labels} onChange={(e) => setBulkEdit({ ...bulkEdit, labels: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <UIButton variant="outline" onClick={() => setBulkEdit(null)}>Cancel</UIButton>
            <UIButton onClick={applyBulk}>Apply</UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <QuickTask open={add} onClose={() => setAdd(false)} onCreated={() => load()} />
      {bulk && (
        <ReassignDialog title="Reassign tasks" count={selected.length} onClose={() => setBulk(false)} onSubmit={async (to, reason) => { await pmApi.bulkReassign({ ids: selected, to, reason }); setSelected([]); await load(); }} />
      )}
    </>
  );
}
