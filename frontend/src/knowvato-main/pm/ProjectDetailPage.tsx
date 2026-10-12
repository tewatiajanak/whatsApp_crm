import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Copy, Download, FileSignature, MoreHorizontal, Plus, Star, Trash2, UserRoundCog } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SearchInput, UIButton } from "../components/UIKit";
import { LABEL, Pill, TH } from "../user-management/shared";
import { fmtDate, fmtDateTime } from "@/utils/date";
import { usePm } from "./PmLayout";
import QuickTask from "./QuickTask";
import ReassignDialog from "./ReassignDialog";
import TaskDrawer from "./TaskDrawer";
import { TaskBoard, TaskCalendar, TaskList, TaskTimeline, type TaskRow } from "./TaskViews";
import { MasterBadge, PersonAvatar, ProgressBar, ScheduleBadge, delayText, downloadSignoffPdf, exportRows, StatTile, type Tone } from "./shared";
import ProjectOverview from "./ProjectOverview";
import { useBookmarks } from "@/lib/bookmarks";

const TABS = ["Overview", "Modules", "Tasks", "Board", "Timeline", "Calendar", "Team", "Files", "Activity"] as const;
type Tab = (typeof TABS)[number];

/** One project: everything about it, understandable at a glance. */
export default function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const { masters } = usePm();

  const tab = (TABS.includes(params.get("tab") as Tab) ? params.get("tab") : "Overview") as Tab;
  const pins = useBookmarks();
  const pinUrl = `/modules/projects/p/${projectId}`;
  const setTab = (t: Tab) => setParams((p) => { p.set("tab", t); return p; }, { replace: true });

  const [project, setProject] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTask, setOpenTask] = useState<string | null>(params.get("task"));
  const [moduleFilter, setModuleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState(false);
  const [reassign, setReassign] = useState<{ kind: "project" | "module"; id: string; current?: string; title: string } | null>(null);
  const [addTask, setAddTask] = useState(false);
  const [addModule, setAddModule] = useState<{ choices: any[]; module: string } | null>(null);
  const [asTemplate, setAsTemplate] = useState<{ name: string; code: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [signoffs, setSignoffs] = useState<any[]>([]);
  const requestSignoff = async (moduleId?: string, name?: string) => {
    if (!window.confirm(`Ask the client to sign off ${name || "the whole project"}?`)) return;
    await run(() => pmApi.requestSignoff(projectId, moduleId || null), "Sign-off request sent");
  };

  const load = async () => {
    try {
      pmApi.signoffs(projectId).then((r: any) => setSignoffs(r?.data ?? [])).catch(() => {});
      const [p, t]: any[] = await Promise.all([pmApi.project(projectId), pmApi.tasks(`project=${projectId}&perPage=500&sort=order`)]);
      setProject(p.data.project);
      setModules(p.data.modules);
      setTasks(t.data ?? []);
    } catch (e: any) {
      toast(e?.message || "Could not load the project", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);
  useEffect(() => {
    if (tab === "Team") pmApi.projectTeam(projectId).then((r: any) => setTeam(r?.data ?? [])).catch(() => {});
    if (tab === "Files") pmApi.projectFiles(projectId).then((r: any) => setFiles(r?.data ?? [])).catch(() => {});
    if (tab === "Activity") pmApi.projectActivity(projectId).then((r: any) => setActivity(r?.data ?? [])).catch(() => {});
  }, [tab, projectId, tasks]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => (!moduleFilter || t.projectModule?._id === moduleFilter) && (!q || `${t.title} ${t.number} ${t.assignee?.name || ""}`.toLowerCase().includes(q)));
  }, [tasks, moduleFilter, search]);

  const run = async (fn: () => Promise<any>, done: string) => {
    setSaving(true);
    try {
      const res = await fn();
      toast(done);
      await load();
      return res;
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };
  const openAddModule = async () => {
    try {
      const res: any = await pmApi.productFull(project.product._id);
      const have = new Set(modules.map((m) => String(m.sourceModule || "")));
      const choices = (res.data.modules || []).filter((m: any) => m.active && !have.has(m._id));
      if (!choices.length) return toast("Every module of this product is already in the project", "error");
      setAddModule({ choices, module: choices[0]._id });
    } catch (e: any) {
      toast(e?.message || "Could not load the product", "error");
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete the project ${project.name} with all its tasks? This cannot be undone.`)) return;
    try {
      await pmApi.removeProject(projectId);
      toast("Project deleted");
      nav("/modules/projects/list");
    } catch (e: any) {
      toast(e?.message || "Could not delete", "error");
    }
  };
  const exportTasks = () =>
    exportRows(`${project.code}-tasks.xlsx`, "Tasks", shown.map((t) => ({
      Number: t.number, Task: t.title, Module: t.projectModule?.name || "", Assignee: t.assignee?.name || "", Status: t.status?.name || "",
      Due: t.due ? fmtDate(t.due) : "", "Planned due": t.plannedDue ? fmtDate(t.plannedDue) : "", Completed: t.actualEnd ? fmtDate(t.actualEnd) : "", Overdue: t.overdue ? "Yes" : "", Checklist: t.checklistTotal ? `${t.checklistDone}/${t.checklistTotal}` : "",
    })));

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!project) return <div className="py-12 text-center text-sm text-muted-foreground">Project not found</div>;
  const s = project.stats;
  const counts: [string, number, Tone][] = [
    ["Total", s.total, "neutral"],
    ["Done", s.done, "success"],
    ["In progress", s.inProgress, "info"],
    ["Overdue", s.overdue, "danger"],
    ["Waiting for client", s.waiting, "warning"],
  ];


  return (
    <div>
      {/* top strip */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Link to="/modules/projects/list" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon shrink-0" title="Projects"><ArrowLeft className="h-4 w-4" /></Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-foreground leading-tight">{project.name}</h2>
                <button type="button" title={pins.has(pinUrl) ? "Unpin from the sidebar" : "Pin to the sidebar"} onClick={() => (pins.has(pinUrl) ? pins.remove(pinUrl) : pins.add({ title: project.name, url: pinUrl }))} className="inline-flex" style={{ background: "transparent", border: 0, padding: 0, color: pins.has(pinUrl) ? "#f59e0b" : "var(--muted-foreground)" }}>
                  <Star className="h-4 w-4" fill={pins.has(pinUrl) ? "currentColor" : "none"} />
                </button>
                <ScheduleBadge schedule={s.schedule} />
                <MasterBadge item={project.status} />
                {project.signedOffAt && <Pill tone="success">Signed off {fmtDate(project.signedOffAt)}</Pill>}
                {!project.signedOffAt && signoffs.some((x) => !x.projectModule && x.status === "Pending") && <Pill tone="warning">Sign-off waiting</Pill>}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{project.code} · {project.client?.name} · {project.product?.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm">
              <PersonAvatar name={project.incharge?.name || "?"} photo={project.incharge?.photo} size={22} />
              <span className="hidden sm:inline">{project.incharge?.name}</span>
              {hasRight("projects", "reassign") && (
                <button type="button" title="Change project incharge" className="inline-flex" style={{ background: "transparent", border: 0, padding: 0, color: "var(--muted-foreground)" }} onClick={() => setReassign({ kind: "project", id: project._id, current: project.incharge?._id, title: "Change project incharge" })}>
                  <UserRoundCog className="h-4 w-4" />
                </button>
              )}
            </span>
            {hasRight("tasks", "create") && <UIButton onClick={() => setAddTask(true)} leftIcon={<Plus className="h-3.5 w-3.5" />}>Task</UIButton>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><UIButton size="icon" variant="outline" title="More"><MoreHorizontal className="h-4 w-4" /></UIButton></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="crm-theme">
                {hasRight("projects", "edit") && <DropdownMenuItem onClick={openAddModule}><Plus className="h-3.5 w-3.5 mr-2" />Add module</DropdownMenuItem>}
                {hasRight("setup", "create") && <DropdownMenuItem onClick={() => setAsTemplate({ name: `${project.product?.name} (from ${project.code})`, code: "" })}><Copy className="h-3.5 w-3.5 mr-2" />Save as template</DropdownMenuItem>}
                {hasRight("projects", "approve") && s.total > 0 && s.done === s.total && !project.signedOffAt && <DropdownMenuItem onClick={() => requestSignoff()}><FileSignature className="h-3.5 w-3.5 mr-2" />Request project sign-off</DropdownMenuItem>}
                {hasRight("projects", "export") && <DropdownMenuItem onClick={exportTasks}><Download className="h-3.5 w-3.5 mr-2" />Export tasks</DropdownMenuItem>}
                {hasRight("projects", "del") && <DropdownMenuItem onClick={remove} style={{ color: "var(--destructive)" }}><Trash2 className="h-3.5 w-3.5 mr-2" />Delete project</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-center">
          <div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-semibold leading-none text-foreground tabular-nums">{s.progress}%</span>
              <span className="pb-1 text-xs text-muted-foreground">planned {s.planned}%</span>
            </div>
            <div className="mt-2"><ProgressBar value={s.progress} height={8} /></div>
            <div className="mt-2 text-xs" style={{ color: s.delayDays > 0 ? "var(--destructive)" : "var(--muted-foreground)" }}>
              {delayText(s.delayDays)} · planned {project.plannedEnd ? fmtDate(project.plannedEnd) : "—"}{s.expectedEnd && s.delayDays ? ` · expected ${fmtDate(s.expectedEnd)}` : ""}
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {counts.map(([label, n, tone]) => (
              <StatTile key={label} compact label={label} value={n} tone={tone} />
            ))}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="mt-3 flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className="px-3 py-2 text-[13px] font-medium whitespace-nowrap" style={{ background: "transparent", border: 0, borderBottom: `2px solid ${tab === t ? "var(--primary)" : "transparent"}`, color: tab === t ? "var(--primary)" : "var(--muted-foreground)" }}>
            {t}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "Overview" && <ProjectOverview projectId={projectId} stats={s} modules={modules} onOpenTask={setOpenTask} refresh={tasks} />}
        {tab === "Modules" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {modules.map((m) => (
              <div key={m._id} className="rounded-xl border bg-card p-3.5 cursor-pointer hover:border-primary transition-colors" onClick={() => { setModuleFilter(m._id); setTab("Tasks"); }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">{m.name}</div>
                  <ScheduleBadge schedule={m.stats.schedule} />
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <ProgressBar value={m.stats.progress} />
                  <span className="text-sm font-semibold tabular-nums">{m.stats.progress}%</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
                    {m.incharge ? <><PersonAvatar name={m.incharge.name} photo={m.incharge.photo} size={20} /><span className="truncate">{m.incharge.name}</span></> : "No incharge"}
                    {hasRight("projects", "reassign") && (
                      <button type="button" title="Change module incharge" className="inline-flex" style={{ background: "transparent", border: 0, padding: 0, color: "var(--muted-foreground)" }} onClick={() => setReassign({ kind: "module", id: m._id, current: m.incharge?._id, title: `${m.name}: change incharge` })}>
                        <UserRoundCog className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                  <span className="whitespace-nowrap">{m.stats.done}/{m.stats.total}{m.stats.overdue > 0 && <span style={{ color: "var(--destructive)" }}> · {m.stats.overdue} overdue</span>}</span>
                </div>
                {(m.signedOffAt || (m.stats.total > 0 && m.stats.done === m.stats.total)) && (
                  <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
                    {m.signedOffAt ? (
                      <Pill tone="success">Signed off {fmtDate(m.signedOffAt)} · {m.signedOffBy}</Pill>
                    ) : signoffs.some((x) => x.projectModule?._id === m._id && x.status === "Pending") ? (
                      <Pill tone="warning">Sign-off waiting for the client</Pill>
                    ) : (
                      hasRight("projects", "approve") && <UIButton size="sm" variant="outline" onClick={() => requestSignoff(m._id, m.name)} leftIcon={<FileSignature className="h-3.5 w-3.5" />}>Request sign-off</UIButton>
                    )}
                  </div>
                )}
              </div>
            ))}
            {modules.length === 0 && <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">No modules</div>}
          </div>
        )}

        {["Tasks", "Board", "Timeline", "Calendar"].includes(tab) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" containerClassName="flex-1 min-w-[180px] max-w-sm" />
            <select className="ui-input" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value="">All modules</option>
              {modules.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
            {tab === "Tasks" && selected.length > 0 && hasRight("tasks", "reassign") && (
              <UIButton variant="outline" onClick={() => setBulk(true)} leftIcon={<UserRoundCog className="h-3.5 w-3.5" />}>Reassign {selected.length}</UIButton>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{shown.length} tasks</span>
          </div>
        )}
        {tab === "Tasks" && <TaskList tasks={shown} onOpen={setOpenTask} groupByModule selected={hasRight("tasks", "reassign") ? selected : undefined} onSelect={setSelected} />}
        {tab === "Board" && <TaskBoard tasks={shown} onOpen={setOpenTask} onChanged={load} />}
        {tab === "Timeline" && <TaskTimeline tasks={shown} onOpen={setOpenTask} />}
        {tab === "Calendar" && <TaskCalendar tasks={shown} onOpen={setOpenTask} />}

        {tab === "Team" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {team.map((p) => (
              <div key={p._id} className="rounded-xl border bg-card p-3.5">
                <div className="flex items-center gap-2.5">
                  <PersonAvatar name={p.name} photo={p.photo} size={38} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.roles.join(", ") || p.designation || "—"}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {([["Open", p.open, "neutral"], ["Overdue", p.overdue, "danger"], ["Done", p.done, "success"]] as [string, number, Tone][]).map(([label, n, tone]) => (
                    <StatTile key={label} compact label={label} value={n} tone={tone} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "Files" && signoffs.length > 0 && (
          <div className="mb-3 rounded-xl border bg-card divide-y">
            {signoffs.map((so) => (
              <div key={so._id} className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
                <span className="min-w-0 flex-1 text-sm"><span className="font-medium text-foreground">Sign-off: {so.title}</span><span className="block text-[11px] text-muted-foreground">{so.contact?.name}{so.answeredAt ? ` · ${fmtDate(so.answeredAt)}` : ` · sent ${fmtDate(so.sentAt)}`}{so.ticket ? ` · ticket ${so.ticket.number}` : ""}</span></span>
                <Pill tone={so.status === "Accepted" ? "success" : so.status === "Concern" ? "danger" : so.status === "Pending" ? "warning" : "muted"}>{so.status === "Accepted" ? "Signed off" : so.status}</Pill>
                <UIButton size="sm" variant="outline" onClick={() => downloadSignoffPdf(so, project.client?.name)} leftIcon={<Download className="h-3.5 w-3.5" />}>PDF</UIButton>
              </div>
            ))}
          </div>
        )}
        {tab === "Files" && (
          files.length === 0 ? <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No files</div> : (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                      <th className={TH}>File</th><th className={TH}>Task</th><th className={TH}>By</th><th className={TH}>Date</th><th className={TH}>Client</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setOpenTask(f.task._id)}>
                        <td className="px-4 py-2.5 font-medium text-foreground">{f.name}</td>
                        <td className="px-4 py-2.5">{f.task.title}</td>
                        <td className="px-4 py-2.5">{f.by?.name || "—"}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(f.at)}</td>
                        <td className="px-4 py-2.5">{f.clientVisible ? <Pill tone="info">Visible</Pill> : <Pill tone="muted">Internal</Pill>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}

        {tab === "Activity" && (
          activity.length === 0 ? <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No activity</div> : (
            <div className="rounded-xl border bg-card divide-y">
              {activity.map((a) => (
                <div key={a._id} className="px-3.5 py-2.5 text-sm" style={a.task ? { cursor: "pointer" } : undefined} onClick={() => a.task && setOpenTask(a.task._id)}>
                  <div className="text-foreground">
                    {a.task && <span className="font-medium">{a.task.title}: </span>}
                    {a.text}
                    {(a.from || a.to) && <span className="text-muted-foreground"> · {a.from} → <b className="text-foreground">{a.to}</b></span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{a.byName} · {fmtDateTime(a.createdAt)}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <TaskDrawer taskId={openTask} onClose={() => setOpenTask(null)} onChanged={load} />
      <QuickTask open={addTask} onClose={() => setAddTask(false)} onCreated={load} project={projectId} projectModule={moduleFilter || undefined} />

      {reassign && (
        <ReassignDialog
          title={reassign.title}
          current={reassign.current}
          onClose={() => setReassign(null)}
          onSubmit={async (to, reason) => { await (reassign.kind === "project" ? pmApi.reassignProject(reassign.id, { to, reason }) : pmApi.reassignModule(reassign.id, { to, reason })); await load(); }}
        />
      )}
      {bulk && (
        <ReassignDialog
          title="Reassign tasks"
          count={selected.length}
          onClose={() => setBulk(false)}
          onSubmit={async (to, reason) => { await pmApi.bulkReassign({ ids: selected, to, reason }); setSelected([]); await load(); }}
        />
      )}

      <Dialog open={!!addModule} onOpenChange={(o) => !o && setAddModule(null)}>
        <DialogContent className="crm-theme sm:max-w-md">
          <DialogHeader><DialogTitle>Add module</DialogTitle></DialogHeader>
          {addModule && (
            <div>
              <label className={LABEL}>Module *</label>
              <select className="ui-input w-full" value={addModule.module} onChange={(e) => setAddModule({ ...addModule, module: e.target.value })}>
                {addModule.choices.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </select>
            </div>
          )}
          <DialogFooter className="gap-2">
            <UIButton variant="outline" onClick={() => setAddModule(null)}>Cancel</UIButton>
            <UIButton loading={saving} onClick={async () => { if (await run(() => pmApi.addProjectModule(projectId, { module: addModule!.module }), "Module added")) setAddModule(null); }}>Add</UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!asTemplate} onOpenChange={(o) => !o && setAsTemplate(null)}>
        <DialogContent className="crm-theme sm:max-w-md">
          <DialogHeader><DialogTitle>Save as template</DialogTitle></DialogHeader>
          {asTemplate && (
            <div className="space-y-3">
              <div>
                <label className={LABEL}>Product name *</label>
                <input className="ui-input w-full" value={asTemplate.name} onChange={(e) => setAsTemplate({ ...asTemplate, name: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Code *</label>
                <input className="ui-input w-full" value={asTemplate.code} maxLength={20} onChange={(e) => setAsTemplate({ ...asTemplate, code: e.target.value.toUpperCase() })} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <UIButton variant="outline" onClick={() => setAsTemplate(null)}>Cancel</UIButton>
            <UIButton loading={saving} disabled={!asTemplate?.name.trim() || !asTemplate?.code.trim()} onClick={async () => { if (await run(() => pmApi.saveProjectAsTemplate(projectId, asTemplate), "Template saved")) setAsTemplate(null); }}>Save</UIButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
