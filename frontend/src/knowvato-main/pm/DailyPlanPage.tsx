import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import DateInput from "../../components/DateInput";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UIButton } from "../components/UIKit";
import { LABEL, Pill } from "../user-management/shared";
import { fmtDate } from "@/utils/date";
import { usePm } from "./PmLayout";
import { MonthNav, monthGrid } from "./TaskViews";
import { MasterBadge, addDays, todayYmd, ymd } from "./shared";
import WorkTitle from "./WorkTabs";

type Entry = { _id?: string; project: string; task: string; description: string; location: string; site: string; hours: number; from: string; to: string; result?: string; remarks?: string };
const BLANK: Entry = { project: "", task: "", description: "", location: "", site: "", hours: 0, from: "", to: "" };
const RESULTS: [string, string, "success" | "warning" | "danger"][] = [["done", "Done", "success"], ["partial", "Partial", "warning"], ["not_done", "Not done", "danger"]];

/** Planner → My Task → Daily Plan: plan my day, and say at the end of the day how it went. The team's plans are in the calendar. */
export default function DailyPlanPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const { masters } = usePm();
  const locations = (masters.work_location || []).filter((m) => m.active);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [plans, setPlans] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // the form
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState({ from: todayYmd(), to: todayYmd() });
  const [entries, setEntries] = useState<Entry[]>([{ ...BLANK }]);

  const grid = useMemo(() => monthGrid(month), [month]);
  const load = async () => {
    setLoading(true);
    try {
      const res: any = await pmApi.plans(ymd(grid[0]), ymd(grid[grid.length - 1]));
      setPlans(res.data ?? []);
    } catch (e: any) {
      toast(e?.message || "Could not load plans", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);
  useEffect(() => {
    pmApi.tasks("mine=1&bucket=open&perPage=300").then((r: any) => setMyTasks(r?.data ?? [])).catch(() => {});
  }, []);

  // my own plan of each day (the form and the copy button work on these)
  const byDate = useMemo(() => new Map(plans.filter((p) => p.mine).map((p) => [p.date, p])), [plans]);

  const projects = useMemo(() => [...new Map(myTasks.filter((t) => t.project).map((t) => [t.project._id, t.project])).values()], [myTasks]);
  const toForm = (e: any): Entry => ({ _id: e._id, project: e.project?._id || "", task: e.task?._id || "", description: e.description || "", location: e.location?._id || "", site: e.site || "", hours: e.hours ?? 0, from: e.from || "", to: e.to || "", result: e.result, remarks: e.remarks });

  const openNew = (date = todayYmd()) => {
    const existing = byDate.get(date);
    setRange({ from: date, to: date });
    setEntries(existing ? existing.entries.map(toForm) : [{ ...BLANK, location: locations[0]?._id || "" }]);
    setOpen(true);
  };
  const setEntry = (i: number, patch: Partial<Entry>) => setEntries((list) => list.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const chosenDates = () => {
    const out: string[] = [];
    for (let d = new Date(`${range.from}T00:00:00`); ymd(d) <= range.to && out.length < 62; d = addDays(d, 1)) out.push(ymd(d));
    return out;
  };
  const save = async () => {
    const list = chosenDates();
    if (!list.length) return toast("Choose the dates", "error");
    setSaving(true);
    try {
      await pmApi.savePlan({ dates: list, entries: entries.map((e) => ({ ...e, project: e.project || null, task: e.task || null })) });
      toast(list.length > 1 ? `Plan saved for ${list.length} days` : "Plan saved");
      setOpen(false);
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not save the plan", "error");
    } finally {
      setSaving(false);
    }
  };
  const copyYesterday = async () => {
    try {
      await pmApi.copyPlan(ymd(addDays(new Date(), -1)), todayYmd());
      toast("Copied yesterday's plan");
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not copy", "error");
    }
  };
  const update = async (plan: any, entry: any, patch: any) => {
    try {
      await pmApi.updatePlanEntry(plan._id, entry._id, patch);
      setPlans((all) => all.map((p) => (p._id === plan._id ? { ...p, entries: p.entries.map((e: any) => (e._id === entry._id ? { ...e, ...patch } : e)) } : p)));
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    }
  };
  const remove = async (plan: any) => {
    if (!window.confirm(`Delete the plan of ${fmtDate(plan.date)}?`)) return;
    try {
      await pmApi.removePlan(plan._id);
      toast("Deleted");
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not delete", "error");
    }
  };

  const today = todayYmd();
  const listed = plans.filter((p) => p.date.slice(0, 7) === ymd(month).slice(0, 7)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.employee.name.localeCompare(b.employee.name)));

  return (
    <>
      <WorkTitle
        actions={
          hasRight("daily_plan", "create") && (
            <div className="flex items-center gap-2">
              {!byDate.get(today) && <UIButton variant="outline" onClick={copyYesterday} leftIcon={<Copy className="h-3.5 w-3.5" />}>Copy yesterday</UIButton>}
              <UIButton onClick={() => openNew()} leftIcon={<Plus className="h-3.5 w-3.5" />}>Plan My Day</UIButton>
            </div>
          )
        }
      />

      <div className="mt-3 mb-3 flex flex-wrap items-center justify-between gap-2">
        <MonthNav month={month} onChange={setMonth} />
      </div>

      <div className="space-y-3">
          {!loading && listed.length === 0 && (
            <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No plans
              {hasRight("daily_plan", "create") && <div className="mt-3"><UIButton size="sm" onClick={() => openNew()} leftIcon={<Plus className="h-3.5 w-3.5" />}>Plan My Day</UIButton></div>}
            </div>
          )}
          {listed.map((p) => (
            <div key={p._id} className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b" style={{ background: "var(--muted-background)" }}>
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="truncate">{fmtDate(p.date)}</span>
                  {p.date === today && <Pill tone="info">Today</Pill>}
                </span>
                {p.mine && hasRight("daily_plan", "edit") && (
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <UIButton size="icon-sm" variant="ghost" title="Edit" onClick={() => openNew(p.date)}><Pencil className="h-3.5 w-3.5" /></UIButton>
                    <UIButton size="icon-sm" variant="danger" title="Delete" onClick={() => remove(p)}><Trash2 className="h-3.5 w-3.5" /></UIButton>
                  </span>
                )}
              </div>
              {p.entries.map((e: any) => (
                <div key={e._id} className="border-b last:border-b-0 px-3 py-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">{e.task?.title || e.description}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <MasterBadge item={e.location} />
                        {e.site && <span>{e.site}</span>}
                        {e.project && <span>· {e.project.name}</span>}
                        {e.from && e.to && <span>· {e.from}–{e.to}</span>}
                      </div>
                    </div>
                    {p.date <= today && (p.mine && hasRight("daily_plan", "edit") ? (
                      <div className="pm-seg">
                        {RESULTS.map(([v, label, tone]) => {
                          const on = e.result === v;
                          const color = { success: "var(--success)", warning: "var(--warning)", danger: "var(--destructive)" }[tone];
                          return (
                            <button key={v} type="button" onClick={() => update(p, e, { result: on ? "" : v })} style={on ? { background: color, color: "#fff" } : undefined}>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      RESULTS.filter(([v]) => v === e.result).map(([v, label, tone]) => <Pill key={v} tone={tone}>{label}</Pill>)
                    ))}
                  </div>
                  {p.date <= today && e.result && (p.mine && hasRight("daily_plan", "edit") ? (
                    <input className="ui-input w-full mt-2" defaultValue={e.remarks} aria-label="Remarks" onBlur={(ev) => ev.target.value !== (e.remarks || "") && update(p, e, { remarks: ev.target.value })} />
                  ) : (
                    e.remarks && <div className="mt-1.5 text-xs text-muted-foreground">{e.remarks}</div>
                  ))}
                </div>
              ))}
            </div>
          ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="crm-theme w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>Plan My Day</SheetTitle></SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className={LABEL}>From</label><DateInput className="ui-input w-full" value={range.from} onChange={(e: any) => setRange({ from: e.target.value, to: e.target.value > range.to ? e.target.value : range.to })} /></div>
              <div><label className={LABEL}>To</label><DateInput className="ui-input w-full" value={range.to} onChange={(e: any) => setRange({ ...range, to: e.target.value })} /></div>
            </div>

            {entries.map((e, i) => {
              const tasks = myTasks.filter((t) => !e.project || t.project?._id === e.project);
              return (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Entry {i + 1}</span>
                    {entries.length > 1 && <UIButton size="icon-sm" variant="ghost" title="Remove" onClick={() => setEntries(entries.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></UIButton>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className={LABEL}>Project</label>
                      <select className="ui-input w-full" value={e.project} onChange={(ev) => setEntry(i, { project: ev.target.value, task: "" })}>
                        <option value="">— none —</option>
                        {projects.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL}>Task</label>
                      <select className="ui-input w-full" value={e.task} onChange={(ev) => setEntry(i, { task: ev.target.value })}>
                        <option value="">— none —</option>
                        {tasks.map((t) => <option key={t._id} value={t._id}>{t.title}</option>)}
                      </select>
                    </div>
                    {!e.task && (
                      <div className="sm:col-span-2">
                        <label className={LABEL}>Work *</label>
                        <input className="ui-input w-full" value={e.description} maxLength={200} onChange={(ev) => setEntry(i, { description: ev.target.value })} />
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <label className={LABEL}>Location *</label>
                      <div className="pm-chips">
                        {locations.map((l) => (
                          <button key={l._id} type="button" onClick={() => setEntry(i, { location: l._id })} className={e.location === l._id ? "is-on" : ""} style={{ "--chip": l.color } as React.CSSProperties}>
                            {l.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={LABEL}>Client / site</label>
                      <input className="ui-input w-full" value={e.site} maxLength={120} onChange={(ev) => setEntry(i, { site: ev.target.value })} />
                    </div>
                  </div>
                </div>
              );
            })}
            <UIButton variant="outline" onClick={() => setEntries([...entries, { ...BLANK, location: entries[entries.length - 1]?.location || "" }])} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add entry</UIButton>
          </div>
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={save} loading={saving} className="flex-1">Save plan</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
