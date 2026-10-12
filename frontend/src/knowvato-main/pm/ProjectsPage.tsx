import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ProjectWizardPage from "./ProjectWizardPage";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, Download, FolderKanban, Plus } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchInput, UIButton } from "../components/UIKit";
import { LABEL, TH } from "../user-management/shared";
import { fmtDate } from "@/utils/date";
import EmployeePicker from "./EmployeePicker";
import { usePm } from "./PmLayout";
import { MasterBadge, PageTitle, PersonAvatar, ProgressBar, ScheduleBadge, delayText, exportRows, scheduleLabel, StatTile } from "./shared";

const SCHEDULES = [["on_track", "On Track"], ["ahead", "Ahead"], ["delayed", "Delayed"], ["completed", "Completed"]];

/** Hand over everything an employee holds to someone else. */
function TransferDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { employees } = usePm();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [count, setCount] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCount(null);
    if (from) pmApi.transferWork({ from, preview: true }).then((r: any) => setCount(r.data)).catch(() => {});
  }, [from]);

  const submit = async () => {
    setSaving(true);
    try {
      const res: any = await pmApi.transferWork({ from, to, reason });
      toast(`Moved ${res.data.tasks} tasks, ${res.data.modules} modules, ${res.data.projects} projects`);
      onDone();
      onClose();
    } catch (e: any) {
      toast(e?.message || "Could not transfer", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="crm-theme sm:max-w-md">
        <DialogHeader><DialogTitle>Transfer work</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <label className={LABEL}>From *</label>
            <EmployeePicker employees={employees} value={from} onChange={setFrom} clearable={false} />
          </div>
          {count && (
            <div className="grid grid-cols-3 gap-2">
              {([["Open tasks", count.tasks], ["Modules", count.modules], ["Projects", count.projects]] as [string, number][]).map(([label, n]) => (
                <StatTile key={label} compact label={label} value={n} />
              ))}
            </div>
          )}
          <div>
            <label className={LABEL}>To *</label>
            <EmployeePicker employees={employees.filter((e) => e._id !== from)} value={to} onChange={setTo} clearable={false} />
          </div>
          <div>
            <label className={LABEL}>Reason *</label>
            <textarea className="ui-input w-full" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} style={{ height: "auto" }} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <UIButton variant="outline" onClick={onClose}>Cancel</UIButton>
          <UIButton onClick={submit} loading={saving} disabled={!from || !to || !reason.trim()}>Transfer</UIButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Project Management → Projects. */
export default function ProjectsPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const nav = useNavigate();
  const isMobile = useIsMobile();
  const { hasRight } = useAuth() as any;
  const { masters } = usePm();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [params] = useSearchParams();
  const [f, setF] = useState({ client: "", product: "", incharge: "", status: "", schedule: params.get("schedule") || "" });
  const [transfer, setTransfer] = useState(false);
  // the new-project form opens in a drawer; ?new=1 (the old address) opens it too
  const [adding, setAdding] = useState(params.get("new") === "1");

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await pmApi.projects();
      setRows(res?.data ?? []);
    } catch (e: any) {
      toast(e?.message || "Could not load projects", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filter choices come from the projects on screen
  const choices = (key: string) => [...new Map(rows.filter((p) => p[key]).map((p) => [p[key]._id, p[key]])).values()].sort((a: any, b: any) => a.name.localeCompare(b.name));
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (p) =>
        (!q || `${p.name} ${p.code} ${p.client?.name || ""}`.toLowerCase().includes(q)) &&
        (!f.client || p.client?._id === f.client) &&
        (!f.product || p.product?._id === f.product) &&
        (!f.incharge || p.incharge?._id === f.incharge) &&
        (!f.status || p.status?._id === f.status) &&
        (!f.schedule || (f.schedule === "completed" ? p.stats?.schedule?.startsWith("completed") : p.stats?.schedule === f.schedule))
    );
  }, [rows, search, f]);

  const exportExcel = () =>
    exportRows("projects.xlsx", "Projects", filtered.map((p) => ({
      Code: p.code, Client: p.client?.name || "", Product: p.product?.name || "", Incharge: p.incharge?.name || "",
      "Progress %": p.stats?.progress ?? 0, Schedule: scheduleLabel(p.stats?.schedule), "Delay (days)": p.stats?.delayDays ?? 0, Tasks: p.stats?.total ?? 0,
      Done: p.stats?.done ?? 0, Overdue: p.stats?.overdue ?? 0, Start: fmtDate(p.startDate), "Planned end": p.plannedEnd ? fmtDate(p.plannedEnd) : "", Status: p.status?.name || "",
    })));

  const select = (key: keyof typeof f, label: string, options: { _id: string; name: string }[]) => (
    <select className="ui-input" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>
      <option value="">{label}</option>
      {options.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
    </select>
  );
  const overdue = (p: any) => (
    <span className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-semibold" style={p.stats?.overdue ? { background: "var(--destructive-bg)", color: "var(--destructive)" } : { background: "var(--muted-background)", color: "var(--muted-foreground)" }}>
      {p.stats?.overdue ?? 0}
    </span>
  );

  return (
    <>
      <PageTitle
        icon={<FolderKanban className="h-4 w-4" />}
        title="Projects"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {hasRight("tasks", "reassign") && <UIButton variant="outline" onClick={() => setTransfer(true)} leftIcon={<ArrowLeftRight className="h-3.5 w-3.5" />}>Transfer work</UIButton>}
            {hasRight("projects", "export") && <UIButton variant="outline" onClick={exportExcel} disabled={!filtered.length} leftIcon={<Download className="h-3.5 w-3.5" />}>Export Excel</UIButton>}
            {hasRight("projects", "create") && <UIButton onClick={() => setAdding(true)} leftIcon={<Plus className="h-3.5 w-3.5" />}>New project</UIButton>}
          </div>
        }
      />

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" containerClassName="flex-1 min-w-[180px] max-w-sm" />
        {select("client", "All clients", choices("client"))}
        {select("product", "All products", choices("product"))}
        {select("incharge", "All incharges", choices("incharge"))}
        {select("status", "All status", (masters.project_status || []).filter((m) => m.active))}
        <select className="ui-input" value={f.schedule} onChange={(e) => setF({ ...f, schedule: e.target.value })}>
          <option value="">All schedules</option>
          {SCHEDULES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span className="ml-auto text-xs text-muted-foreground">{loading ? "Loading…" : `${filtered.length} of ${rows.length}`}</span>
      </div>

      {!loading && filtered.length === 0 && (
        <div className="mt-3 rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No projects
          {hasRight("projects", "create") && !rows.length && <div className="mt-3"><UIButton size="sm" onClick={() => setAdding(true)} leftIcon={<Plus className="h-3.5 w-3.5" />}>New project</UIButton></div>}
        </div>
      )}

      {filtered.length > 0 && isMobile && (
        <div className="mt-3 space-y-2">
          {filtered.map((p) => (
            <div key={p._id} className="rounded-xl border bg-card p-3" onClick={() => nav(`/modules/projects/p/${p._id}`)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{p.client?.name || p.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{p.code} · {p.product?.name}</div>
                </div>
                <ScheduleBadge schedule={p.stats?.schedule} />
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <ProgressBar value={p.stats?.progress ?? 0} />
                <span className="text-sm font-semibold tabular-nums">{p.stats?.progress ?? 0}%</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">{p.incharge && <PersonAvatar name={p.incharge.name} photo={p.incharge.photo} size={18} />}{p.incharge?.name}</span>
                <span>Overdue {overdue(p)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {filtered.length > 0 && !isMobile && (
        <div className="mt-3 rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                  <th className={TH} style={{ minWidth: 200 }}>Client</th>
                  <th className={TH}>Product</th>
                  <th className={TH} style={{ minWidth: 150 }}>Incharge</th>
                  <th className={TH} style={{ width: 170 }}>Progress</th>
                  <th className={TH}>Schedule</th>
                  <th className={TH} style={{ textAlign: "center" }}>Overdue</th>
                  <th className={TH}>Planned end</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => nav(`/modules/projects/p/${p._id}`)}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{p.client?.name || "—"}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{p.code}</div>
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{p.product?.name || "—"}</td>
                    <td className="px-4 py-2.5">
                      {p.incharge ? <span className="inline-flex items-center gap-2 whitespace-nowrap"><PersonAvatar name={p.incharge.name} photo={p.incharge.photo} size={24} />{p.incharge.name}</span> : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={p.stats?.progress ?? 0} />
                        <span className="text-xs font-semibold tabular-nums" style={{ width: 34, textAlign: "right" }}>{p.stats?.progress ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <ScheduleBadge schedule={p.stats?.schedule} />
                      {!!p.stats?.delayDays && <div className="mt-0.5 text-[11px] text-muted-foreground">{delayText(p.stats.delayDays)}</div>}
                    </td>
                    <td className="px-4 py-2.5" style={{ textAlign: "center" }}>{overdue(p)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{p.plannedEnd ? fmtDate(p.plannedEnd) : "—"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap"><MasterBadge item={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {transfer && <TransferDialog onClose={() => setTransfer(false)} onDone={load} />}

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent className="crm-theme w-full sm:max-w-xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>New project</SheetTitle></SheetHeader>
          {adding && <ProjectWizardPage onClose={() => setAdding(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
