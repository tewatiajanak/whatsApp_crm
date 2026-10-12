import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Check, FileText, FolderKanban, LifeBuoy, LogOut, Paperclip, Plus, Send, ShieldCheck, Star } from "lucide-react";
import { portalApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UIButton } from "../components/UIKit";
import { LABEL, Pill } from "../user-management/shared";
import { fmtDate, fmtDateTime, fmtRelative } from "@/utils/date";
import { MasterBadge, ProgressBar, ScheduleBadge, downloadSignoffPdf, meetingWhere } from "./shared";
import "./pm.css";

/* The client portal: a client's own user sees only their client's projects,
   verifications, tickets, meetings and documents. */

const MENU = [
  { to: "/portal", label: "Projects", icon: FolderKanban, end: true },
  { to: "/portal/verifications", label: "Verifications", icon: ShieldCheck },
  { to: "/portal/tickets", label: "Tickets", icon: LifeBuoy },
  { to: "/portal/meetings", label: "Meetings", icon: CalendarDays },
  { to: "/portal/documents", label: "Documents", icon: FileText },
];
const useToastFn = () => useToast() as (msg: string, type?: string) => void;
const Empty = ({ text }: { text: string }) => <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">{text}</div>;
const Title = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 mb-3"><h2 className="text-base font-semibold text-foreground">{children}</h2>{action}</div>
);

/* ---- Projects ---- */
function Projects({ home }: { home: any }) {
  const nav = useNavigate();
  if (!home) return null;
  return (
    <>
      <Title>Projects</Title>
      {home.projects.length === 0 && <Empty text="No projects" />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {home.projects.map((p: any) => (
          <div key={p._id} className="rounded-xl border bg-card p-4 cursor-pointer hover:border-primary" onClick={() => nav(`/portal/projects/${p._id}`)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">{p.product}</div>
              </div>
              <ScheduleBadge schedule={p.schedule} />
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-3xl font-semibold leading-none tabular-nums text-foreground">{p.progress}%</span>
              <span className="pb-0.5 text-xs text-muted-foreground">Planned end {p.plannedEnd ? fmtDate(p.plannedEnd) : "—"}</span>
            </div>
            <div className="mt-2"><ProgressBar value={p.progress} height={8} /></div>
          </div>
        ))}
      </div>
    </>
  );
}

function ProjectDetail() {
  const { id = "" } = useParams();
  const toast = useToastFn();
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    portalApi.project(id).then((r: any) => setD(r.data)).catch((e: any) => toast(e?.message || "Could not load", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!d) return null;
  const p = d.project;
  return (
    <>
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start gap-2.5">
          <NavLink to="/portal" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon shrink-0" title="Projects"><ArrowLeft className="h-4 w-4" /></NavLink>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-foreground">{p.name}</h2><ScheduleBadge schedule={p.schedule} /><MasterBadge item={p.status} fallback="" /></div>
            <div className="text-xs text-muted-foreground">{p.product} · Incharge {p.incharge}</div>
          </div>
        </div>
        <div className="mt-4 flex items-end gap-2">
          <span className="text-4xl font-semibold leading-none tabular-nums text-foreground">{p.progress}%</span>
          <span className="pb-1 text-xs text-muted-foreground">{p.done}/{p.total} tasks · planned end {p.plannedEnd ? fmtDate(p.plannedEnd) : "—"}</span>
        </div>
        <div className="mt-2"><ProgressBar value={p.progress} height={8} /></div>
        {p.signedOffAt && <div className="mt-2"><Pill tone="success">Signed off {fmtDate(p.signedOffAt)}</Pill></div>}
      </div>

      {d.milestones.length > 0 && (
        <div className="mt-3">
          <div className={LABEL}>Milestones</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {d.milestones.map((m: any) => (
              <div key={m._id} className="shrink-0 rounded-lg border bg-card px-3 py-2" style={{ minWidth: 180 }}>
                <div className="text-[13px] font-medium text-foreground">{m.title}</div>
                <div className="text-[11px] text-muted-foreground">{m.isCompleted ? `Done ${fmtDate(m.completedOn)}` : m.due ? `Due ${fmtDate(m.due)}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 space-y-3">
        {d.modules.map((m: any) => {
          const tasks = d.tasks.filter((t: any) => String(t.module) === String(m._id));
          return (
            <div key={m._id} className="rounded-xl border bg-card overflow-hidden">
              <div className="px-3.5 py-3 border-b" style={{ background: "var(--muted-background)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground">{m.name}</span>
                  <span className="inline-flex items-center gap-2">{m.signedOffAt && <Pill tone="success">Signed off</Pill>}<span className="text-sm font-semibold tabular-nums">{m.progress}%</span></span>
                </div>
                <div className="mt-2"><ProgressBar value={m.progress} /></div>
              </div>
              {tasks.map((t: any) => (
                <div key={t._id} className="flex items-center gap-2.5 border-b last:border-b-0 px-3.5 py-2.5">
                  <Check className="h-4 w-4 shrink-0" style={{ color: t.isCompleted ? "var(--success)" : "var(--border)" }} />
                  <span className="min-w-0 flex-1 text-sm" style={t.isCompleted ? { color: "var(--muted-foreground)" } : undefined}>{t.title}</span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{t.isCompleted ? fmtDate(t.completedOn) : t.due ? fmtDate(t.due) : ""}</span>
                  <MasterBadge item={t.status} fallback="" />
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---- Verifications ---- */
function Verifications({ onChange }: { onChange: () => void }) {
  const toast = useToastFn();
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => portalApi.verifications().then((r: any) => { setRows(r.data ?? []); setLoaded(true); }).catch((e: any) => toast(e?.message || "Could not load", "error"));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const answer = async (approve: boolean) => {
    setBusy(true);
    try {
      await portalApi.answerVerification(open._id, { approve, comment });
      toast(approve ? "Approved" : "Rejected");
      setOpen(null);
      await load();
      onChange();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setBusy(false);
    }
  };
  const download = async (f: any) => {
    try {
      const url = URL.createObjectURL(await portalApi.file(open.taskId, f._id));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast(e?.message || "Could not open the file", "error");
    }
  };
  const tone = (s: string) => (s === "Approved" ? "success" : s === "Rejected" ? "danger" : s === "Pending" ? "warning" : "muted");
  return (
    <>
      <Title>Verifications</Title>
      {loaded && rows.length === 0 && <Empty text="Nothing to verify" />}
      <div className="space-y-2">
        {rows.map((v) => (
          <div key={v._id} className="rounded-xl border bg-card p-3.5 cursor-pointer hover:border-primary" onClick={() => { setOpen(v); setComment(""); }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{v.task}</div>
                <div className="text-[11px] text-muted-foreground">{v.project}{v.module ? ` · ${v.module}` : ""} · {fmtRelative(v.sentAt)}</div>
              </div>
              <Pill tone={tone(v.status) as any}>{v.status}</Pill>
            </div>
          </div>
        ))}
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{open?.task}</SheetTitle></SheetHeader>
          {open && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="text-xs text-muted-foreground">{open.project}{open.module ? ` · ${open.module}` : ""}</div>
              {open.checklist.length > 0 && (
                <div className="rounded-lg border divide-y">
                  {open.checklist.map((c: any, i: number) => <div key={i} className="flex items-center gap-2 px-3 py-2.5 text-sm"><Check className="h-4 w-4 shrink-0" style={{ color: c.done ? "var(--success)" : "var(--border)" }} />{c.text}</div>)}
                </div>
              )}
              {open.files.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {open.files.map((f: any) => <button key={f._id} type="button" onClick={() => download(f)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px]" style={{ background: "transparent", color: "var(--primary)" }}><Paperclip className="h-3 w-3" />{f.name}</button>)}
                </div>
              )}
              {open.status === "Pending" ? (
                <div>
                  <label className={LABEL}>Comment (needed to reject)</label>
                  <textarea className="ui-input w-full" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} style={{ height: "auto" }} />
                </div>
              ) : (
                <div className="rounded-lg border px-3 py-2.5 text-sm">
                  <Pill tone={tone(open.status) as any}>{open.status}</Pill>
                  {open.answeredBy && <span className="ml-2 text-muted-foreground">{open.answeredBy} · {fmtDate(open.answeredAt)}</span>}
                  {open.comment && <div className="mt-1.5 whitespace-pre-wrap">{open.comment}</div>}
                </div>
              )}
            </div>
          )}
          {open?.status === "Pending" && (
            <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
              <UIButton variant="danger" className="flex-1" loading={busy} disabled={!comment.trim()} onClick={() => answer(false)}>Reject</UIButton>
              <UIButton className="flex-1" loading={busy} onClick={() => answer(true)}>Approve</UIButton>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ---- Tickets ---- */
function Tickets({ onChange }: { onChange: () => void }) {
  const toast = useToastFn();
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [options, setOptions] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [open, setOpen] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () => portalApi.tickets().then((r: any) => { setRows(r.data ?? []); setLoaded(true); }).catch((e: any) => toast(e?.message || "Could not load", "error"));
  useEffect(() => {
    load();
    portalApi.ticketOptions().then((r: any) => setOptions(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const show = (id: string) => portalApi.ticket(id).then((r: any) => { setOpen(r.data); setReply(""); setStars(r.data.rating || 0); }).catch((e: any) => toast(e?.message || "Could not open", "error"));
  const run = async (fn: () => Promise<any>, done?: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (done) toast(done);
      return res || true;
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    const res: any = await run(() => portalApi.createTicket(form));
    if (!res) return;
    for (const f of files) await portalApi.uploadTicketFile(res.data._id, f).catch((e: any) => toast(e?.message || `Could not attach ${f.name}`, "error"));
    toast(`Ticket ${res.data.number} raised`);
    setForm(null);
    setFiles([]);
    load();
    onChange();
  };
  // an image on the clipboard becomes an attachment of the new ticket
  const paste = (e: React.ClipboardEvent) => {
    const img = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"))?.getAsFile();
    if (img) {
      e.preventDefault();
      setFiles((list) => [...list, new File([img], `pasted-${list.length + 1}.png`, { type: img.type })].slice(0, 5));
    }
  };
  const download = async (f: any) => {
    try {
      const url = URL.createObjectURL(await portalApi.ticketFile(open._id, f._id));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast(e?.message || "Could not open the file", "error");
    }
  };

  return (
    <>
      <Title action={<UIButton onClick={() => { setForm({ subject: "", project: "", projectModule: "", category: "", priority: "", description: "" }); setFiles([]); }} leftIcon={<Plus className="h-3.5 w-3.5" />}>Raise ticket</UIButton>}>Tickets</Title>
      {loaded && rows.length === 0 && <Empty text="No tickets" />}
      <div className="space-y-2">
        {rows.map((t) => (
          <div key={t._id} className="rounded-xl border bg-card p-3.5 cursor-pointer hover:border-primary" onClick={() => show(t._id)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-mono text-muted-foreground">{t.number}</div>
                <div className="text-sm font-semibold text-foreground">{t.subject}</div>
                <div className="text-[11px] text-muted-foreground">{t.project?.name ? `${t.project.name} · ` : ""}{fmtRelative(t.createdAt)}</div>
              </div>
              <MasterBadge item={t.status} />
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>Raise ticket</SheetTitle></SheetHeader>
          {form && options && (
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
              <div className="sm:col-span-2">
                <label className={LABEL}>Subject *</label>
                <input autoFocus className="ui-input w-full" value={form.subject} maxLength={160} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Project</label>
                <select className="ui-input w-full" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value, projectModule: "" })}>
                  <option value="">—</option>
                  {options.projects.map((p: any) => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Module</label>
                <select className="ui-input w-full" value={form.projectModule} disabled={!form.project} onChange={(e) => setForm({ ...form, projectModule: e.target.value })}>
                  <option value="">—</option>
                  {options.modules.filter((m: any) => m.project === form.project).map((m: any) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Category</label>
                <select className="ui-input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">—</option>
                  {options.categories.map((m: any) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Priority</label>
                <select className="ui-input w-full" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="">—</option>
                  {options.priorities.map((m: any) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Description</label>
                <textarea className="ui-input w-full" rows={5} value={form.description} onPaste={paste} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ height: "auto" }} />
                <p className="mt-1 text-[11px] text-muted-foreground">Ctrl+V pastes a screenshot</p>
              </div>
              <div className="sm:col-span-2">
                <UIButton size="sm" variant="outline" onClick={() => fileInput.current?.click()} leftIcon={<Paperclip className="h-3.5 w-3.5" />}>Attach</UIButton>
                <input ref={fileInput} type="file" multiple hidden onChange={(e) => { setFiles((l) => [...l, ...(e.target.files || [])].slice(0, 5)); e.target.value = ""; }} />
                <div className="mt-2 flex flex-wrap gap-1.5">{files.map((f, i) => <Pill key={i} tone="muted">{f.name}</Pill>)}</div>
              </div>
            </div>
          )}
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setForm(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={create} loading={busy} disabled={!form?.subject.trim()} className="flex-1">Raise ticket</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle className="flex items-center gap-2 min-w-0"><span className="font-mono text-xs text-muted-foreground shrink-0">{open?.number}</span><span className="truncate">{open?.subject}</span></SheetTitle></SheetHeader>
          {open && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-1.5"><MasterBadge item={open.status} /><MasterBadge item={open.priority} fallback="" />{open.project && <Pill tone="muted">{open.project.name}</Pill>}<span className="text-xs text-muted-foreground">{fmtDateTime(open.createdAt)}</span></div>
              {open.description && <div className="text-sm whitespace-pre-wrap">{open.description}</div>}
              {open.files.length > 0 && <div className="flex flex-wrap gap-1.5">{open.files.map((f: any) => <button key={f._id} type="button" onClick={() => download(f)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px]" style={{ background: "transparent", color: "var(--primary)" }}><Paperclip className="h-3 w-3" />{f.name}</button>)}</div>}
              <div className="space-y-2.5">
                {open.replies.map((x: any) => (
                  <div key={x._id} className="rounded-lg border px-3 py-2" style={x.mine ? { borderColor: "var(--primary)" } : undefined}>
                    <div className="text-[11px] text-muted-foreground"><span className="font-semibold text-foreground">{x.by}</span> · {fmtRelative(x.at)}</div>
                    <div className="mt-0.5 text-sm whitespace-pre-wrap">{x.text}</div>
                  </div>
                ))}
              </div>
              {open.isClosed ? (
                <div className="rounded-lg border p-3 space-y-3">
                  <div>
                    <div className={LABEL}>Rate the support</div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" title={`${n}`} onClick={async () => { setStars(n); if (await run(() => portalApi.rateTicket(open._id, { rating: n }), "Thank you")) load(); }} className="inline-flex h-10 w-10 items-center justify-center" style={{ background: "transparent", border: 0, color: n <= stars ? "#f59e0b" : "var(--border)" }}>
                          <Star className="h-6 w-6" fill={n <= stars ? "currentColor" : "none"} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <UIButton variant="outline" size="sm" loading={busy} onClick={async () => { if (await run(() => portalApi.reopenTicket(open._id, reply), "Reopened")) { setOpen(null); load(); onChange(); } }}>Reopen</UIButton>
                </div>
              ) : (
                <div>
                  <textarea className="ui-input w-full" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} style={{ height: "auto" }} aria-label="Reply" />
                  <div className="mt-2 flex justify-end">
                    <UIButton size="sm" loading={busy} disabled={!reply.trim()} onClick={async () => { const res: any = await run(() => portalApi.replyTicket(open._id, reply.trim())); if (res?.data) { setOpen(res.data); setReply(""); } }} leftIcon={<Send className="h-3.5 w-3.5" />}>Reply</UIButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ---- Meetings ---- */
function Meetings() {
  const toast = useToastFn();
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    portalApi.meetings().then((r: any) => { setRows(r.data ?? []); setLoaded(true); }).catch((e: any) => toast(e?.message || "Could not load", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <Title>Meetings</Title>
      {loaded && rows.length === 0 && <Empty text="No meetings" />}
      <div className="space-y-2">
        {rows.map((m) => (
          <div key={m._id} className="rounded-xl border bg-card p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{m.title}</div>
                <div className="text-[11px] text-muted-foreground">{fmtDate(m.date)} · {m.from} – {m.to} · {meetingWhere(m)}</div>
              </div>
              <MasterBadge item={m.type} fallback="" />
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              {m.token && <a href={`/pm/meeting/${m.token}`} className="ui-btn ui-btn-outline ui-btn-sm text-decoration-none">{m.response ? `You said ${m.response}` : "Respond"}</a>}
              {m.link && <a href={m.link} target="_blank" rel="noreferrer" className="pm-link ui-btn ui-btn-primary ui-btn-sm" style={{ "--pm-link-color": "#fff" } as any}>Join</a>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---- Documents ---- */
function Documents({ onChange }: { onChange: () => void }) {
  const toast = useToastFn();
  const [d, setD] = useState<any>(null);
  const [concern, setConcern] = useState<any>(null);
  const [comment, setComment] = useState("");
  const load = () => portalApi.documents().then((r: any) => setD(r.data)).catch((e: any) => toast(e?.message || "Could not load", "error"));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const answer = async (so: any, accept: boolean) => {
    try {
      await portalApi.answerSignoff(so._id, { accept, comment });
      toast(accept ? "Signed off" : "Concern sent");
      setConcern(null);
      setComment("");
      load();
      onChange();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    }
  };
  const download = async (f: any) => {
    try {
      const url = URL.createObjectURL(await portalApi.file(f.taskId, f._id));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast(e?.message || "Could not open the file", "error");
    }
  };
  if (!d) return null;
  const tone = (s: string) => (s === "Accepted" ? "success" : s === "Concern" ? "danger" : "warning");
  return (
    <>
      <Title>Documents</Title>
      {d.signoffs.length > 0 && (
        <div className="mb-4">
          <div className={LABEL}>Sign-off</div>
          <div className="space-y-2">
            {d.signoffs.map((so: any) => (
              <div key={so._id} className="rounded-xl border bg-card p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{so.title}</div>
                    <div className="text-[11px] text-muted-foreground">{so.summary.map((m: any) => `${m.module} (${m.tasks})`).join(" · ")}</div>
                  </div>
                  <Pill tone={tone(so.status) as any}>{so.status === "Accepted" ? `Signed off ${fmtDate(so.answeredAt)}` : so.status}</Pill>
                </div>
                {so.status !== "Pending" && (
                  <div className="mt-2.5"><UIButton size="sm" variant="outline" onClick={() => downloadSignoffPdf(so)} leftIcon={<FileText className="h-3.5 w-3.5" />}>Download PDF</UIButton></div>
                )}
                {so.status === "Pending" && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <UIButton size="sm" variant="outline" onClick={() => { setConcern(so); setComment(""); }}>Raise concern</UIButton>
                    <UIButton size="sm" onClick={() => answer(so, true)}>Accept and sign off</UIButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className={LABEL}>Files</div>
      {d.files.length === 0 && <Empty text="No documents" />}
      <div className="rounded-xl border bg-card overflow-hidden empty:hidden">
        {d.files.map((f: any) => (
          <button key={f._id} type="button" onClick={() => download(f)} className="flex w-full items-center gap-2.5 border-b last:border-b-0 px-3.5 py-3 text-left" style={{ background: "transparent", border: 0, borderBottom: "1px solid var(--border)" }}>
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium" style={{ color: "var(--primary)" }}>{f.name}</span><span className="block truncate text-[11px] text-muted-foreground">{f.project} · {f.task}</span></span>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDate(f.at)}</span>
          </button>
        ))}
      </div>
      <Sheet open={!!concern} onOpenChange={(o) => !o && setConcern(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>Raise concern</SheetTitle></SheetHeader>
          <div className="flex-1 p-4">
            <label className={LABEL}>Your concern *</label>
            <textarea autoFocus className="ui-input w-full" rows={5} value={comment} onChange={(e) => setComment(e.target.value)} style={{ height: "auto" }} />
          </div>
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setConcern(null)} className="flex-1">Cancel</UIButton>
            <UIButton disabled={!comment.trim()} onClick={() => answer(concern, false)} className="flex-1">Send</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ---- shell ---- */
export default function PortalApp() {
  const { user, logout } = useAuth() as any;
  const [home, setHome] = useState<any>(null);
  const loadHome = () => portalApi.home().then((r: any) => setHome(r.data)).catch(() => {});
  useEffect(() => {
    loadHome();
  }, []);
  if (!user?.pmClient) return <Navigate to="/" replace />;
  const badge = (to: string) => (to.endsWith("verifications") ? home?.pendingVerifications : to.endsWith("tickets") ? home?.openTickets : 0);

  return (
    <div className="crm-theme min-h-screen" style={{ background: "var(--page-bg)" }}>
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex items-center justify-between gap-3 px-4" style={{ maxWidth: 1040, height: 52 }}>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">{home?.client || "Client portal"}</div>
            <div className="text-[11px] text-muted-foreground truncate">{user?.name}</div>
          </div>
          <UIButton size="sm" variant="ghost" onClick={logout} leftIcon={<LogOut className="h-3.5 w-3.5" />}>Sign out</UIButton>
        </div>
        <nav className="mx-auto flex gap-1 overflow-x-auto px-3" style={{ maxWidth: 1040 }}>
          {MENU.map((m) => {
            const Icon = m.icon;
            const n = badge(m.to);
            return (
              <NavLink key={m.to} to={m.to} end={m.end} className="pm-link inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap" style={({ isActive }) => ({ borderBottom: `2px solid ${isActive ? "var(--primary)" : "transparent"}`, "--pm-link-color": isActive ? "var(--primary)" : "var(--muted-foreground)" } as any)}>
                <Icon className="h-3.5 w-3.5" />{m.label}
                {n > 0 && <span className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold" style={{ minWidth: 16, height: 16, padding: "0 4px", background: "var(--destructive)", color: "#fff" }}>{n}</span>}
              </NavLink>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto px-4 py-4" style={{ maxWidth: 1040 }}>
        <Routes>
          <Route index element={<Projects home={home} />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="verifications" element={<Verifications onChange={loadHome} />} />
          <Route path="tickets" element={<Tickets onChange={loadHome} />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="documents" element={<Documents onChange={loadHome} />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </main>
    </div>
  );
}
