import { useEffect, useMemo, useRef, useState } from "react";
import { SheetFooter } from "@/components/ui/sheet";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BellRing, Check, CheckSquare, ChevronDown, ChevronRight, Plus, ShieldCheck, X } from "lucide-react";
import { pmApi } from "../../api";
import { useToast } from "../../context/ToastContext";
import DateInput from "../../components/DateInput";
import { UIButton } from "../components/UIKit";
import { LABEL, Pill } from "../user-management/shared";
import { fmtDate } from "@/utils/date";
import EmployeePicker from "./EmployeePicker";
import { usePm } from "./PmLayout";
import { PersonAvatar, todayYmd } from "./shared";

type Edit = { assignee?: string; tatValue?: number; tatUnit?: string };
type Extra = { title: string; assignee: string; tatValue: number; tatUnit: string };
type ModState = { on: boolean; incharge: string; excluded: string[]; edits: Record<string, Edit>; extra: Extra[] };

const STEPS = ["Project", "Modules", "Review"];

/** New project: 1 Project · 2 Modules and tasks (dates calculated live) · 3 Review. */
/** `onClose` = shown in the drawer of the Projects page: no title of its own, a fixed footer. */
export default function ProjectWizardPage({ onClose }: { onClose?: () => void }) {
  const drawer = !!onClose;
  const Footer: any = drawer ? SheetFooter : "div";
  // a task row: one line on the wide page; in the drawer the title and dates, then assignee and TAT below
  const ROW = drawer ? "grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5" : "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_210px_150px_170px] items-center gap-2";
  // drawer: title over two columns + dates, then (under the title) assignee and TAT
  const CELL = drawer ? { title: "col-span-2 order-1", who: "order-3 min-w-0 pl-7", tat: "order-4 max-w-[140px]", dates: "order-2 text-right" } : { title: "", who: "min-w-0", tat: "", dates: "" };
  // the unit choices here: hours and days, where a day is a working day; "cd" appears only for a task the template counts in calendar days
  const unitsFor = (unit: string) => [{ value: "hours", short: "h" }, { value: "working_days", short: "d" }, ...(unit === "days" ? [{ value: "days", short: "cd" }] : [])];
  const toast = useToast() as (msg: string, type?: string) => void;
  const nav = useNavigate();
  const { employees, masters } = usePm();
  const [step, setStep] = useState(0);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [head, setHead] = useState({ client: "", product: "", startDate: todayYmd(), incharge: "", priority: "", status: "" });
  const [template, setTemplate] = useState<{ modules: any[]; tasks: any[] } | null>(null);
  const [mods, setMods] = useState<Record<string, ModState>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    pmApi.clients("status=Active").then((r: any) => setClients(r?.data ?? [])).catch(() => {});
    pmApi.products().then((r: any) => setProducts((r?.data ?? []).filter((p: any) => p.active))).catch(() => {});
  }, []);

  const client = clients.find((c) => c._id === head.client);
  const product = products.find((p) => p._id === head.product);
  // products assigned to the client first; all products stay available
  const productChoices = useMemo(() => {
    const mine = new Set((client?.products || []).map((p: any) => p._id));
    return [...products].sort((a, b) => Number(mine.has(b._id)) - Number(mine.has(a._id)));
  }, [products, client]);

  // a project is known by its client and product; the server names it the same way
  const projectName = client && product ? `${client.name} – ${product.name}` : "";
  useEffect(() => {
    if (!head.status && masters.project_status?.length) setHead((h) => ({ ...h, status: masters.project_status.find((m) => m.active)?._id || "" }));
  }, [masters, head.status]);

  // the product's template: every module starts selected, with its default people
  useEffect(() => {
    setTemplate(null);
    setPreview(null);
    if (!head.product) return;
    pmApi.productFull(head.product).then((r: any) => {
      const modules = (r.data.modules || []).filter((m: any) => m.active);
      setTemplate({ modules, tasks: r.data.tasks || [] });
      setMods(Object.fromEntries(modules.map((m: any) => [m._id, { on: true, incharge: m.defaultIncharge?._id || "", excluded: [], edits: {}, extra: [] }])));
      setOpen({});
    }).catch((e: any) => toast(e?.message || "Could not load the product", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head.product]);

  const payload = useMemo(
    () => ({
      ...head,
      modules: (template?.modules || [])
        .filter((m) => mods[m._id]?.on)
        .map((m) => {
          const s = mods[m._id];
          return {
            module: m._id,
            incharge: s.incharge || null,
            excluded: s.excluded,
            tasks: Object.entries(s.edits).map(([task, e]) => ({ task, ...e, ...(e.assignee !== undefined ? { assignee: e.assignee || null } : {}) })),
            extra: s.extra.filter((x) => x.title.trim()),
          };
        }),
    }),
    [head, template, mods]
  );

  // dates are recalculated on the server whenever a choice changes
  useEffect(() => {
    if (step === 0 || !template || !head.client || !head.product || !head.startDate) return;
    if (!payload.modules.length) return setPreview(null);
    const mine = ++seq.current;
    setCalculating(true);
    const t = setTimeout(() => {
      pmApi.previewProject(payload)
        .then((r: any) => mine === seq.current && setPreview(r.data))
        .catch((e: any) => mine === seq.current && toast(e?.message || "Could not calculate the dates", "error"))
        .finally(() => mine === seq.current && setCalculating(false));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, step, template]);

  const setMod = (id: string, patch: Partial<ModState>) => setMods((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  const setEdit = (modId: string, taskId: string, patch: Edit) => setMod(modId, { edits: { ...mods[modId].edits, [taskId]: { ...mods[modId].edits[taskId], ...patch } } });
  const planned = (modId: string) => preview?.modules?.find((m: any) => m.module === modId);
  const headOk = head.client && head.product && head.startDate && head.incharge;
  const taskCount = preview?.modules?.reduce((n: number, m: any) => n + m.tasks.length, 0) || 0;
  const people = useMemo(() => {
    if (!preview) return [];
    const ids = new Set<string>([head.incharge]);
    preview.modules.forEach((m: any) => { if (m.incharge) ids.add(m.incharge); m.tasks.forEach((t: any) => t.assignee && ids.add(t.assignee)); });
    return employees.filter((e) => ids.has(e._id));
  }, [preview, employees, head.incharge]);

  const create = async () => {
    setSaving(true);
    try {
      const res: any = await pmApi.createProject(payload);
      toast("Project created");
      nav(`/modules/projects/p/${res.data._id}`);
    } catch (e: any) {
      toast(e?.message || "Could not create the project", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={drawer ? "flex min-h-0 flex-1 flex-col" : ""}>
      <div className={drawer ? "flex items-center justify-center border-b px-4 py-2.5" : "flex flex-wrap items-center justify-between gap-3 pb-3 border-b"}>
        {!drawer && (
          <div className="flex items-center gap-2.5 min-w-0">
            <Link to="/modules/projects/list" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Projects"><ArrowLeft className="h-4 w-4" /></Link>
            <h2 className="text-base font-semibold text-foreground leading-tight">New project</h2>
          </div>
        )}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 text-[12.5px] font-medium" style={{ color: i <= step ? "var(--primary)" : "var(--muted-foreground)" }}>
              {i > 0 && <span className="h-px w-4 sm:w-8" style={{ background: i <= step ? "var(--primary)" : "var(--border)" }} />}
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]" style={i <= step ? { background: "var(--primary)", color: "#fff" } : { background: "var(--muted-background)" }}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={i === step ? "" : "hidden sm:inline"}>{s}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={drawer ? "min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4" : "mx-auto w-full max-w-4xl"}>
      {/* 1. project */}
      {step === 0 && (
        <div className={`mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-3 ${drawer ? "" : "rounded-xl border bg-card p-4"}`}>
          <div>
            <label className={LABEL}>Client *</label>
            <select className="ui-input w-full" value={head.client} onChange={(e) => setHead({ ...head, client: e.target.value })}>
              <option value="">—</option>
              {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Product *</label>
            <select className="ui-input w-full" value={head.product} onChange={(e) => setHead({ ...head, product: e.target.value })}>
              <option value="">—</option>
              {productChoices.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Start date *</label>
            <DateInput className="ui-input w-full" value={head.startDate} onChange={(e: any) => setHead({ ...head, startDate: e.target.value })} />
          </div>
          <div>
            <label className={LABEL}>Project incharge *</label>
            <EmployeePicker employees={employees} value={head.incharge} onChange={(id) => setHead({ ...head, incharge: id })} />
          </div>
          <div>
            <label className={LABEL}>Priority</label>
            <select className="ui-input w-full" value={head.priority} onChange={(e) => setHead({ ...head, priority: e.target.value })}>
              <option value="">—</option>
              {(masters.priority || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Status</label>
            <select className="ui-input w-full" value={head.status} onChange={(e) => setHead({ ...head, status: e.target.value })}>
              {!head.status && <option value="">—</option>}
              {(masters.project_status || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* 2. modules and tasks */}
      {step === 1 && template && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{calculating ? "Calculating…" : preview ? `${taskCount} tasks` : ""}</span>
            {preview && <Pill tone="info">Planned end {fmtDate(preview.end)}</Pill>}
          </div>
          {template.modules.map((m) => {
            const s = mods[m._id];
            if (!s) return null;
            const plan = planned(m._id);
            const tasks = template.tasks.filter((t) => t.module === m._id);
            const extras = (plan?.tasks || []).filter((t: any) => !t.task);
            const isOpen = !!open[m._id];
            return (
              <div key={m._id} className="rounded-xl border bg-card overflow-hidden" style={{ opacity: s.on ? 1 : 0.6 }}>
                <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5">
                  <input type="checkbox" className="shrink-0" checked={s.on} onChange={() => setMod(m._id, { on: !s.on })} style={{ width: 18, height: 18 }} />
                  <button type="button" disabled={!s.on} onClick={() => setOpen({ ...open, [m._id]: !isOpen })} className="inline-flex items-center gap-1 min-w-0 flex-1 text-left text-sm font-semibold" style={{ background: "transparent", border: 0, padding: 0, color: "var(--foreground)" }}>
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{m.name}</span>
                    <span className="ml-1 text-[11px] font-normal text-muted-foreground whitespace-nowrap">{plan ? plan.tasks.length : tasks.length} tasks</span>
                  </button>
                  {s.on && <div style={{ width: drawer ? 190 : 220 }}><EmployeePicker employees={employees} value={s.incharge} onChange={(id) => setMod(m._id, { incharge: id })} /></div>}
                </div>

                {s.on && isOpen && (
                  <div className="border-t">
                    {tasks.map((t) => {
                      const out = s.excluded.includes(t._id);
                      const e = s.edits[t._id] || {};
                      const p = plan?.tasks.find((x: any) => x.task === t._id);
                      return (
                        <div key={t._id} className={`${ROW} border-b px-3 py-2.5 last:border-b-0`} style={{ opacity: out ? 0.5 : 1 }}>
                          <label className={`flex items-center gap-2.5 min-w-0 cursor-pointer ${CELL.title}`} style={{ marginBottom: 0 }}>
                            <input type="checkbox" className="shrink-0" checked={!out} onChange={() => setMod(m._id, { excluded: out ? s.excluded.filter((x) => x !== t._id) : [...s.excluded, t._id] })} style={{ width: 18, height: 18 }} />
                            <span className="min-w-0">
                              <span className="block text-sm truncate">{t.title}</span>
                              <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                {t.checklist?.length > 0 && <span className="inline-flex items-center gap-0.5"><CheckSquare className="h-3 w-3" />{t.checklist.length}</span>}
                                {t.autoMessages?.length > 0 && <span className="inline-flex items-center gap-0.5"><BellRing className="h-3 w-3" />{t.autoMessages.length}</span>}
                                {t.clientVerification && <ShieldCheck className="h-3 w-3" />}
                              </span>
                            </span>
                          </label>
                          {!out && (
                            <>
                              <div className={CELL.who}><EmployeePicker employees={employees} value={e.assignee ?? t.defaultAssignee?._id ?? ""} onChange={(id) => setEdit(m._id, t._id, { assignee: id })} /></div>
                              <div className={`flex items-center gap-1.5 ${CELL.tat}`}>
                                <input type="number" min={0} step="0.5" className="ui-input" style={{ width: 64 }} value={e.tatValue ?? t.tatValue} onChange={(ev) => setEdit(m._id, t._id, { tatValue: Number(ev.target.value) })} />
                                <select className="ui-input flex-1 min-w-0" value={e.tatUnit ?? t.tatUnit} onChange={(ev) => setEdit(m._id, t._id, { tatUnit: ev.target.value })}>
                                  {unitsFor(e.tatUnit ?? t.tatUnit).map((u) => <option key={u.value} value={u.value}>{u.short}</option>)}
                                </select>
                              </div>
                              <div className={`text-xs text-muted-foreground whitespace-nowrap ${CELL.dates}`}>{p ? `${fmtDate(p.start)} → ${fmtDate(p.due)}` : "—"}</div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {s.extra.map((x, i) => (
                      <div key={i} className={`${ROW} border-b px-3 py-2.5`}>
                        <div className={`flex items-center gap-2 min-w-0 ${CELL.title}`}>
                          <UIButton size="icon-sm" variant="ghost" title="Remove" onClick={() => setMod(m._id, { extra: s.extra.filter((_, j) => j !== i) })}><X className="h-3.5 w-3.5" /></UIButton>
                          <input className="ui-input flex-1 min-w-0" value={x.title} aria-label="Task title" onChange={(ev) => setMod(m._id, { extra: s.extra.map((y, j) => (j === i ? { ...y, title: ev.target.value } : y)) })} />
                        </div>
                        <div className={CELL.who}><EmployeePicker employees={employees} value={x.assignee} onChange={(id) => setMod(m._id, { extra: s.extra.map((y, j) => (j === i ? { ...y, assignee: id } : y)) })} /></div>
                        <div className={`flex items-center gap-1.5 ${CELL.tat}`}>
                          <input type="number" min={0} step="0.5" className="ui-input" style={{ width: 64 }} value={x.tatValue} onChange={(ev) => setMod(m._id, { extra: s.extra.map((y, j) => (j === i ? { ...y, tatValue: Number(ev.target.value) } : y)) })} />
                          <select className="ui-input flex-1 min-w-0" value={x.tatUnit} onChange={(ev) => setMod(m._id, { extra: s.extra.map((y, j) => (j === i ? { ...y, tatUnit: ev.target.value } : y)) })}>
                            {unitsFor(x.tatUnit).map((u) => <option key={u.value} value={u.value}>{u.short}</option>)}
                          </select>
                        </div>
                        <div className={`text-xs text-muted-foreground whitespace-nowrap ${CELL.dates}`}>{extras[s.extra.slice(0, i + 1).filter((y) => y.title.trim()).length - 1] && x.title.trim() ? `${fmtDate(extras[s.extra.slice(0, i + 1).filter((y) => y.title.trim()).length - 1].start)} → ${fmtDate(extras[s.extra.slice(0, i + 1).filter((y) => y.title.trim()).length - 1].due)}` : "—"}</div>
                      </div>
                    ))}
                    <div className="px-3 py-2">
                      <UIButton size="sm" variant="ghost" onClick={() => setMod(m._id, { extra: [...s.extra, { title: "", assignee: "", tatValue: 1, tatUnit: "working_days" }] })} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add task</UIButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. review */}
      {step === 2 && preview && (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-base font-semibold text-foreground">{projectName}</div>
            <div className="text-xs text-muted-foreground">{client?.name} · {product?.name}</div>
            <div className={`mt-3 grid grid-cols-2 gap-2 ${drawer ? "" : "sm:grid-cols-4"}`}>
              {[["Modules", preview.modules.length], ["Tasks", taskCount], ["Start", fmtDate(preview.start)], ["Planned end", fmtDate(preview.end)]].map(([label, value]) => (
                <div key={label} className="rounded-lg border p-3 text-center">
                  <div className="text-lg font-semibold leading-none text-foreground">{value}</div>
                  <div className="mt-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {people.map((p) => (
                <span key={p._id} className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[12px]">
                  <PersonAvatar name={p.name} photo={p.photo} size={18} />{p.name}{p._id === head.incharge && <Pill tone="info">Incharge</Pill>}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border bg-card overflow-hidden">
            {preview.modules.map((m: any, i: number) => {
              const who = employees.find((e) => e._id === m.incharge);
              const end = m.tasks.reduce((d: string, t: any) => (t.due > d ? t.due : d), "");
              return (
                <div key={m.module} className={`flex items-center gap-3 px-3 py-2.5 ${i ? "border-t" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground">{m.tasks.length} tasks · ends {end ? fmtDate(end) : "—"}</div>
                  </div>
                  {who ? <span className="inline-flex items-center gap-1.5 text-xs"><PersonAvatar name={who.name} photo={who.photo} size={22} />{who.name}</span> : <Pill tone="warning">No incharge</Pill>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>
      {/* in the drawer: the same footer as every other drawer */}
      <Footer className={drawer ? "border-t p-4 flex-row gap-2 sm:space-x-0" : "mx-auto mt-4 flex w-full max-w-4xl items-center gap-2"}>
        {drawer && step === 0 && <UIButton variant="outline" onClick={onClose} className="flex-1">Cancel</UIButton>}
        {step > 0 && <UIButton variant="outline" onClick={() => setStep(step - 1)} leftIcon={<ArrowLeft className="h-3.5 w-3.5" />} className={drawer ? "flex-1" : ""}>Back</UIButton>}
        {!drawer && <span className="flex-1" />}
        {step < 2 && <UIButton className={drawer ? "flex-1" : ""} onClick={() => setStep(step + 1)} disabled={step === 0 ? !headOk || !template : !preview || calculating} rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>Next</UIButton>}
        {step === 2 && <UIButton className={drawer ? "flex-1" : ""} onClick={create} loading={saving} disabled={!preview} leftIcon={<Check className="h-3.5 w-3.5" />}>Create project</UIButton>}
      </Footer>
    </div>
  );
}
