import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, BellOff, Clock, Download, Eye, EyeOff, Flag, Link2, ListPlus, Paperclip, Send, ShieldCheck, Trash2, UserRoundCog } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import DateInput from "../../components/DateInput";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UIButton } from "../components/UIKit";
import { LABEL, Pill, Toggle } from "../user-management/shared";
import { fmtDate, fmtDateTime, fmtRelative } from "@/utils/date";
import { usePm } from "./PmLayout";
import ReassignDialog from "./ReassignDialog";
import { MasterBadge, PersonAvatar, ProgressBar, TatBadge, tatText } from "./shared";

const IMAGE = /^image\//;
const TOKEN = /(@\[[^\]]+\]\([0-9a-f]{24}\)|!\[\]\([0-9a-f]{24}\))/g;

/** An image that needs the login: fetched as a blob. */
function AuthImage({ taskId, attId, className }: { taskId: string; attId: string; className?: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let made = "";
    let alive = true;
    pmApi.attachmentBlob(taskId, attId).then((b: Blob) => {
      if (!alive) return;
      made = URL.createObjectURL(b);
      setUrl(made);
    }).catch(() => {});
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [taskId, attId]);
  if (!url) return <span className="inline-block rounded-md" style={{ width: 120, height: 80, background: "var(--muted-background)" }} />;
  return <img src={url} alt="" className={className} style={{ maxWidth: "100%", borderRadius: 8 }} />;
}

/** Comment text: @[Name](id) → name, ![](attachmentId) → the pasted image. */
function CommentText({ text, taskId }: { text: string; taskId: string }) {
  return (
    <div className="text-sm whitespace-pre-wrap break-words">
      {text.split(TOKEN).map((part, i) => {
        const mention = /^@\[([^\]]+)\]/.exec(part);
        if (mention) return <span key={i} className="font-semibold" style={{ color: "var(--primary)" }}>@{mention[1]}</span>;
        const image = /^!\[\]\(([0-9a-f]{24})\)$/.exec(part);
        if (image) return <div key={i} className="my-1.5"><AuthImage taskId={taskId} attId={image[1]} /></div>;
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
}

const SECTION = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5";

/** Task detail: a drawer on desktop, full screen on a phone. Used from every task list. */
export default function TaskDrawer({ taskId, onClose, onChanged }: { taskId: string | null; onClose: () => void; onChanged?: () => void }) {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight, user } = useAuth() as any;
  const { employees, masters } = usePm();
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [clientVisible, setClientVisible] = useState(false);
  const [mention, setMention] = useState<string | null>(null);
  const [reassign, setReassign] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [verifications, setVerifications] = useState<any[]>([]);
  const [time, setTime] = useState<any>(null);
  const [hours, setHours] = useState("");
  const [labelText, setLabelText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async (id = taskId) => {
    if (!id) return;
    try {
      const res: any = await pmApi.task(id);
      setData(res.data);
      setTitle(res.data.task.title);
      setDescription(res.data.task.description || "");
      setLabelText((res.data.task.labels || []).join(", "));
      pmApi.taskTime(id).then((t: any) => setTime(t?.data ?? null)).catch(() => setTime(null));
      if (res.data.task.clientVerification) pmApi.taskVerifications(id).then((v: any) => setVerifications(v?.data ?? [])).catch(() => {});
      else setVerifications([]);
    } catch (e: any) {
      toast(e?.message || "Could not open the task", "error");
      onClose();
    }
  };
  useEffect(() => {
    setData(null);
    setComment("");
    setMention(null);
    if (taskId) load(taskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const task = data?.task;
  const canEdit = !!data?.canEdit;
  const canReassign = hasRight("tasks", "reassign") || hasRight("tasks", "assign");
  const me = String(user?._id || user?.id || "");
  const watching = !!task?.watchers?.some((w: any) => String(w._id || w) === me);
  const files = useMemo(() => (task?.attachments || []).filter((a: any) => !a.pasted), [task]);

  const run = async (fn: () => Promise<any>, done?: string) => {
    setBusy(true);
    try {
      const res = await fn();
      if (done) toast(done);
      await load();
      onChanged?.();
      return res;
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string) => {
    const res: any = await run(() => pmApi.setTaskStatus(task._id, status), "Status updated");
    if (res?.data?.moved) toast(`${res.data.moved} dependent task date${res.data.moved === 1 ? "" : "s"} moved`);
  };
  const tick = async (item: any) => {
    // show the tick at once; the server confirms
    setData((d: any) => ({ ...d, task: { ...d.task, checklist: d.task.checklist.map((c: any) => (c._id === item._id ? { ...c, done: !c.done } : c)) } }));
    try {
      await pmApi.tickChecklist(task._id, item._id, !item.done);
      onChanged?.();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
      load();
    }
  };
  const upload = (file?: File | null) => file && run(() => pmApi.uploadAttachment(task._id, file), "Attached");
  const openFile = async (a: any, download = false) => {
    try {
      const blob: Blob = await pmApi.attachmentBlob(task._id, a._id, download);
      const url = URL.createObjectURL(blob);
      if (download) {
        const link = document.createElement("a");
        link.href = url;
        link.download = a.name;
        link.click();
      } else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast(e?.message || "Could not open the file", "error");
    }
  };

  /* comment box: paste an image, @ to mention */
  const insert = (text: string, replaceFrom?: number) => {
    const el = box.current;
    const start = replaceFrom ?? el?.selectionStart ?? comment.length;
    const end = el?.selectionEnd ?? comment.length;
    const next = comment.slice(0, start) + text + comment.slice(end);
    setComment(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + text.length, start + text.length); });
  };
  const onPaste = async (e: React.ClipboardEvent) => {
    const file = [...e.clipboardData.items].find((i) => IMAGE.test(i.type))?.getAsFile();
    if (!file) return;
    e.preventDefault();
    setBusy(true);
    try {
      const res: any = await pmApi.uploadAttachment(task._id, file, { pasted: true });
      insert(`![](${res.data._id})`);
    } catch (err: any) {
      toast(err?.message || "Could not paste the image", "error");
    } finally {
      setBusy(false);
    }
  };
  const onType = (value: string) => {
    setComment(value);
    const upto = value.slice(0, box.current?.selectionStart ?? value.length);
    const m = /(?:^|\s)@([^\s@]{0,20})$/.exec(upto);
    setMention(m ? m[1].toLowerCase() : null);
  };
  const pickMention = (e: { _id: string; name: string }) => {
    const upto = comment.slice(0, box.current?.selectionStart ?? comment.length);
    insert(`@[${e.name}](${e._id}) `, upto.lastIndexOf("@"));
    setMention(null);
  };
  const send = async () => {
    if (!comment.trim()) return;
    const ok = await run(() => pmApi.addComment(task._id, { text: comment.trim(), clientVisible }));
    if (ok) {
      setComment("");
      setClientVisible(false);
    }
  };

  const statusSelect = task && (
    <select
      className="ui-input w-full"
      value={task.status?._id || ""}
      disabled={!canEdit || busy}
      onChange={(e) => setStatus(e.target.value)}
      style={{ fontWeight: 600, color: task.status?.color, borderColor: task.status?.color }}
    >
      {task.status && <option value={task.status._id}>{task.status.name}</option>}
      {(data.nextStatuses || []).map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
    </select>
  );
  const mandatoryOpen = (task?.checklist || []).filter((c: any) => c.mandatory && !c.done).length;

  return (
    <Sheet open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="crm-theme w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="border-b p-4 pr-10">
          <SheetTitle className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs text-muted-foreground shrink-0">{task?.number}</span>
            <span className="truncate">{task?.title || "Task"}</span>
          </SheetTitle>
        </SheetHeader>

        {!task && <div className="flex-1 p-6 text-center text-sm text-muted-foreground">Loading…</div>}
        {task && (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* header */}
            <div className="space-y-3">
              {canEdit ? (
                <input className="ui-input w-full" style={{ fontWeight: 600 }} value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== task.title && run(() => pmApi.updateTask(task._id, { title }))} />
              ) : null}
              <div className="flex flex-wrap items-center gap-1.5">
                <TatBadge task={task} />
                {task.priority && <MasterBadge item={task.priority} />}
                {task.project && <Pill tone="muted">{task.project.name}{task.projectModule ? ` › ${task.projectModule.name}` : ""}</Pill>}
                {task.kind === "adhoc" && <Pill tone="info">Ad-hoc</Pill>}
                {task.milestone && <Pill tone="warning"><Flag className="h-3 w-3 mr-1 inline" />Milestone</Pill>}
                {task.clientVerification && <Pill tone="warning"><ShieldCheck className="h-3 w-3 mr-1 inline" />Verification required</Pill>}
                {(task.labels || []).map((l: string) => <Pill key={l} tone="info">{l}</Pill>)}
                <span className="ml-auto inline-flex items-center gap-1">
                  {canEdit && task.project && (
                    <UIButton size="icon-sm" variant="ghost" title={task.milestone ? "Remove milestone" : "Mark as milestone"} onClick={() => run(() => pmApi.updateTask(task._id, { milestone: !task.milestone }))}>
                      <Flag className="h-3.5 w-3.5" style={task.milestone ? { color: "#f59e0b" } : undefined} fill={task.milestone ? "currentColor" : "none"} />
                    </UIButton>
                  )}
                  <UIButton size="icon-sm" variant="ghost" title={watching ? "Stop watching" : "Watch: tell me about changes"} onClick={() => run(() => pmApi.watchTask(task._id, !watching))}>
                    {watching ? <Bell className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} /> : <BellOff className="h-3.5 w-3.5" />}
                  </UIButton>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="hidden sm:block">
                  <label className={LABEL}>Status</label>
                  {statusSelect}
                </div>
                <div>
                  <label className={LABEL}>Due</label>
                  {canEdit && !task.isCompleted ? (
                    <DateInput className="ui-input w-full" value={task.due ? String(task.due).slice(0, 10) : ""} onChange={(e: any) => e.target.value && e.target.value !== String(task.due).slice(0, 10) && run(() => pmApi.updateTask(task._id, { due: e.target.value }), "Due date changed")} />
                  ) : (
                    <div className="ui-input w-full flex items-center">{task.due ? fmtDate(task.due) : "—"}</div>
                  )}
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={LABEL}>Assignee</label>
                  <div className="flex items-center gap-2">
                    <div className="ui-input flex-1 min-w-0 flex items-center gap-2">
                      {task.assignee ? <><PersonAvatar name={task.assignee.name} photo={task.assignee.photo} size={22} /><span className="truncate">{task.assignee.name}</span></> : "—"}
                    </div>
                    {canReassign && <UIButton size="icon" variant="outline" title="Reassign" onClick={() => setReassign(true)}><UserRoundCog className="h-4 w-4" /></UIButton>}
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className={LABEL}>TAT</label>
                  <div className="ui-input w-full flex items-center">{tatText(task.tatValue, task.tatUnit)}{task.plannedDue && String(task.plannedDue) !== String(task.due) ? ` · planned ${fmtDate(task.plannedDue)}` : ""}</div>
                </div>
              </div>
              {data.waitingFor?.length > 0 && !task.isCompleted && (
                <div className="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--warning)", color: "var(--warning)" }}>
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Waiting for: {data.waitingFor.map((d: any) => d.title).join(", ")}</span>
                </div>
              )}
            </div>

            {/* client verification */}
            {task.clientVerification && verifications.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={SECTION} style={{ marginBottom: 0 }}>Client verification</span>
                  {task.isWaitingForClient && canEdit && <UIButton size="sm" variant="outline" loading={busy} onClick={() => run(() => pmApi.resendVerification(task._id), "Sent again")}>Send again</UIButton>}
                </div>
                <div className="rounded-lg border divide-y">
                  {verifications.slice(0, 3).map((v: any) => (
                    <div key={v._id} className="px-3 py-2 text-[13px]">
                      <div className="flex items-center gap-2">
                        <Pill tone={v.status === "Approved" ? "success" : v.status === "Rejected" ? "danger" : v.status === "Pending" ? "warning" : "muted"}>{v.status}</Pill>
                        <span className="text-muted-foreground">{v.answeredAt ? `${v.answeredBy} · ${v.answeredVia} · ${fmtDateTime(v.answeredAt)}` : `Sent ${fmtDateTime(v.sentAt)} to ${v.contacts.map((c: any) => c.name).join(", ") || "—"}`}</span>
                      </div>
                      {v.comment && <div className="mt-1 text-foreground">{v.comment}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* checklist */}
            {task.checklist?.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={SECTION} style={{ marginBottom: 0 }}>Checklist {task.checklist.filter((c: any) => c.done).length}/{task.checklist.length}</span>
                  {mandatoryOpen > 0 && <Pill tone="warning">{mandatoryOpen} mandatory left</Pill>}
                </div>
                <ProgressBar value={(task.checklist.filter((c: any) => c.done).length / task.checklist.length) * 100} />
                <div className="mt-2 rounded-lg border divide-y">
                  {task.checklist.map((c: any) => (
                    <label key={c._id} className="flex items-center gap-3 px-3 py-3 cursor-pointer" style={{ marginBottom: 0 }}>
                      <input type="checkbox" checked={!!c.done} disabled={!canEdit} onChange={() => tick(c)} style={{ width: 22, height: 22, flexShrink: 0 }} />
                      <span className="min-w-0 flex-1 text-sm" style={c.done ? { textDecoration: "line-through", color: "var(--muted-foreground)" } : undefined}>
                        {c.text}{c.mandatory && <span style={{ color: "var(--destructive)" }}> *</span>}
                      </span>
                      {canEdit && !c.done && !c.mandatory && (
                        <span onClick={(e) => e.preventDefault()}>
                          <UIButton size="icon-sm" variant="ghost" title="Make this a task of its own" onClick={() => window.confirm(`Turn "${c.text}" into its own task?`) && run(() => pmApi.checklistToTask(task._id, c._id), "Task created")}><ListPlus className="h-3.5 w-3.5" /></UIButton>
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* description */}
            <div>
              <div className={SECTION}>Description</div>
              {canEdit ? (
                <textarea className="ui-input w-full" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} onBlur={() => description !== (task.description || "") && run(() => pmApi.updateTask(task._id, { description }))} style={{ height: "auto" }} />
              ) : (
                <div className="text-sm whitespace-pre-wrap">{task.description || "—"}</div>
              )}
            </div>

            {/* labels */}
            {canEdit && (
              <div>
                <div className={SECTION}>Labels</div>
                <input className="ui-input w-full" value={labelText} onChange={(e) => setLabelText(e.target.value)} onBlur={() => labelText !== (task.labels || []).join(", ") && run(() => pmApi.updateTask(task._id, { labels: labelText.split(",") }))} aria-label="Labels, comma separated" />
              </div>
            )}

            {/* time */}
            {time?.enabled && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={SECTION} style={{ marginBottom: 0 }}><Clock className="h-3 w-3 inline mr-1" />Time {time.total ? `· ${time.total}h` : ""}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <input type="number" min={0} max={24} step="0.5" className="ui-input" style={{ width: 76 }} value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Hours" />
                    <UIButton size="sm" variant="outline" loading={busy} disabled={!(Number(hours) > 0)} onClick={async () => { await run(() => pmApi.logTime(task._id, { hours: Number(hours) })); setHours(""); }}>Log hours</UIButton>
                  </span>
                </div>
                {time.logs.length > 0 && (
                  <div className="rounded-lg border divide-y">
                    {time.logs.slice(0, 5).map((l: any) => (
                      <div key={l._id} className="flex items-center gap-2 px-3 py-2 text-[13px]">
                        <span className="min-w-0 flex-1 truncate">{l.user?.name} · {fmtDate(l.date)}</span>
                        <span className="font-semibold tabular-nums">{l.hours}h</span>
                        {String(l.user?._id) === me && <button type="button" title="Delete" className="inline-flex" style={{ background: "transparent", border: 0, padding: 0, color: "var(--muted-foreground)" }} onClick={() => run(() => pmApi.removeTime(l._id))}><Trash2 className="h-3 w-3" /></button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* depends on */}
            {task.dependsOn?.length > 0 && (
              <div>
                <div className={SECTION}>Depends on</div>
                <div className="rounded-lg border divide-y">
                  {task.dependsOn.map((d: any) => (
                    <div key={d._id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      <MasterBadge item={d.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* attachments */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className={SECTION} style={{ marginBottom: 0 }}>
                  Attachments {data.limits.used}/{data.limits.maxAttachments}
                  {task.mandatoryAttachment ? <span style={{ color: "var(--destructive)" }}> *</span> : task.attachmentRequired && <span className="normal-case tracking-normal font-normal"> · Required</span>}
                </span>
                {canEdit && (
                  data.limits.used >= data.limits.maxAttachments
                    ? <span className="text-[11px] text-muted-foreground">Limit reached</span>
                    : <UIButton size="sm" variant="outline" loading={busy} onClick={() => fileInput.current?.click()} leftIcon={<Paperclip className="h-3.5 w-3.5" />}>Attach</UIButton>
                )}
                <input ref={fileInput} type="file" hidden accept={data.limits.allowedFileTypes.map((t: string) => `.${t}`).join(",")} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              {files.length === 0 && <div className="text-sm text-muted-foreground">No files</div>}
              <div className="space-y-2">
                {files.map((a: any) => (
                  <div key={a._id} className="rounded-lg border p-2.5">
                    {IMAGE.test(a.mime) && <div className="mb-2 cursor-pointer" onClick={() => openFile(a)}><AuthImage taskId={task._id} attId={a._id} /></div>}
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openFile(a)} className="min-w-0 flex-1 text-left text-sm truncate" style={{ background: "transparent", border: 0, padding: 0, color: "var(--primary)" }}>{a.name}</button>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{Math.max(1, Math.round(a.size / 1024))} KB</span>
                      {canEdit && (
                        <UIButton size="icon-sm" variant="ghost" title={a.clientVisible ? "Client can see this" : "Internal only"} onClick={() => run(() => pmApi.updateAttachment(task._id, a._id, { clientVisible: !a.clientVisible }))}>
                          {a.clientVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </UIButton>
                      )}
                      <UIButton size="icon-sm" variant="ghost" title="Download" onClick={() => openFile(a, true)}><Download className="h-3.5 w-3.5" /></UIButton>
                      {(String(a.by?._id || a.by) === me || hasRight("tasks", "del")) && (
                        <UIButton size="icon-sm" variant="danger" title="Delete" onClick={() => window.confirm(`Delete ${a.name}?`) && run(() => pmApi.removeAttachment(task._id, a._id), "Deleted")}><Trash2 className="h-3.5 w-3.5" /></UIButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* comments */}
            <div>
              <div className={SECTION}>Comments</div>
              <div className="space-y-3">
                {data.comments.map((c: any) => (
                  <div key={c._id} className="flex gap-2.5">
                    <PersonAvatar name={c.by?.name || c.byClient || "?"} photo={c.by?.photo} size={30} />
                    <div className="min-w-0 flex-1 rounded-lg border px-3 py-2" style={c.clientVisible ? { borderColor: "var(--info)" } : undefined}>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{c.by?.name || c.byClient}</span>
                        <span>{fmtRelative(c.createdAt)}</span>
                        {c.clientVisible && <Pill tone="info">Client visible</Pill>}
                        {(String(c.by?._id) === me || hasRight("tasks", "del")) && (
                          <button type="button" title="Delete" className="ml-auto inline-flex" style={{ background: "transparent", border: 0, padding: 0, color: "var(--muted-foreground)" }} onClick={() => window.confirm("Delete this comment?") && run(() => pmApi.removeComment(c._id))}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <CommentText text={c.text} taskId={task._id} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 relative">
                <textarea ref={box} className="ui-input w-full" rows={3} value={comment} onChange={(e) => onType(e.target.value)} onPaste={onPaste} style={{ height: "auto" }} aria-label="Comment" />
                {mention !== null && (
                  <div className="absolute z-50 left-0 bottom-full mb-1 w-64 rounded-lg border bg-card shadow-lg overflow-y-auto" style={{ maxHeight: 200 }}>
                    {employees.filter((e) => e.status !== "Inactive" && e.name.toLowerCase().includes(mention)).slice(0, 8).map((e) => (
                      <button key={e._id} type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => pickMention(e)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40" style={{ background: "transparent", border: 0 }}>
                        <PersonAvatar name={e.name} photo={e.photo} size={22} />{e.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                    Client visible
                    <Toggle on={clientVisible} onChange={() => setClientVisible((v) => !v)} labels={["Yes", "No"]} />
                  </span>
                  <UIButton size="sm" onClick={send} loading={busy} disabled={!comment.trim()} leftIcon={<Send className="h-3.5 w-3.5" />}>Comment</UIButton>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">@ mentions a person · Ctrl+V pastes an image</p>
              </div>
            </div>

            {/* history */}
            {data.activity.length > 0 && (
              <div>
                <div className={SECTION}>History</div>
                <div className="rounded-lg border divide-y">
                  {data.activity.map((a: any) => (
                    <div key={a._id} className="px-3 py-2 text-[13px]">
                      <div className="text-foreground">
                        {a.text}
                        {(a.from || a.to) && <span className="text-muted-foreground"> · {a.from} → <b className="text-foreground">{a.to}</b></span>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{a.byName} · {fmtDateTime(a.createdAt)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* phone: the status control stays at the bottom */}
        {task && canEdit && (
          <div className="sm:hidden border-t p-3">
            <label className={LABEL}>Update status</label>
            {statusSelect}
          </div>
        )}
      </SheetContent>

      {reassign && task && (
        <ReassignDialog
          title="Reassign task"
          current={task.assignee?._id}
          onClose={() => setReassign(false)}
          onSubmit={async (to, reason) => { await pmApi.reassignTask(task._id, { to, reason }); await load(); onChanged?.(); }}
        />
      )}
    </Sheet>
  );
}
