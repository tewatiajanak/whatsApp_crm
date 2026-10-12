import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Ban, Check, Download, HelpCircle, ListPlus, Pencil, Plus, Users2, Video, X } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useIsMobile } from "@/hooks/use-mobile";
import DateInput from "../../components/DateInput";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchInput, UIButton } from "../components/UIKit";
import { LABEL, Pill, TH, Toggle } from "../user-management/shared";
import { fmtDate } from "@/utils/date";
import EmployeePicker from "./EmployeePicker";
import { usePm } from "./PmLayout";
import { MEETING_MODES, MasterBadge, PageTitle, PersonAvatar, addDays, exportRows, meetingMode, meetingWhere, todayYmd, ymd } from "./shared";

const REMINDERS: [number, string][] = [[1440, "1 day"], [120, "2 hours"], [30, "30 min"], [10, "10 min"]];
const REPLY: Record<string, [string, "success" | "danger" | "warning" | "muted"]> = { yes: ["Yes", "success"], no: ["No", "danger"], maybe: ["Maybe", "warning"], "": ["No reply", "muted"] };
type Form = {
  title: string; type: string; date: string; from: string; to: string; mode: "onsite" | "online" | "hybrid"; location: string; link: string; project: string; client: string;
  emailInvite: boolean; agenda: string; employees: string[]; teams: string[]; contacts: string[]; reminders: number[]; repeat: string; until: string;
};
const blank = (emailInvite = true): Form => ({ title: "", type: "", date: todayYmd(), from: "11:00", to: "12:00", mode: "onsite", location: "", link: "", project: "", client: "", emailInvite, agenda: "", employees: [], teams: [], contacts: [], reminders: [1440, 30], repeat: "none", until: "" });

/** Project Management → Meetings & Trainings. */
export default function MeetingsPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const { hasRight, user } = useAuth() as any;
  const { employees, masters } = usePm();
  const me = String(user?._id || user?.id || "");
  const canAdd = hasRight("meetings", "create");

  const [tab, setTab] = useState<"upcoming" | "past" | "training">("upcoming");
  const [rows, setRows] = useState<any[]>([]);
  const [report, setReport] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState<any>(null);
  const [notes, setNotes] = useState<{ minutes: string; attended: string[]; actions: any[] } | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [emailDefault, setEmailDefault] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "training") {
        const res: any = await pmApi.trainingReport();
        setReport(res.data ?? []);
      } else {
        const today = todayYmd();
        const res: any = await pmApi.meetings(tab === "upcoming" ? `from=${today}` : `to=${ymd(addDays(new Date(), -1))}&sort=desc`);
        setRows(res.data ?? []);
      }
    } catch (e: any) {
      toast(e?.message || "Could not load", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  useEffect(() => {
    if (hasRight("team", "view")) pmApi.hierarchy().then((r: any) => setTeams(r?.data?.teams ?? [])).catch(() => {});
    if (hasRight("projects", "view")) pmApi.projects().then((r: any) => setProjects(r?.data ?? [])).catch(() => {});
    if (hasRight("clients", "view")) pmApi.clients().then((r: any) => setClients(r?.data ?? [])).catch(() => {});
    pmApi.settings().then((r: any) => setEmailDefault(r?.data?.meetingEmail !== false)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // a link from a notification opens that meeting
  useEffect(() => {
    const id = params.get("open");
    if (id) show(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((m) => (!type || m.type?._id === type) && (!q || `${m.title} ${m.project?.name || ""} ${m.organizer?.name || ""}`.toLowerCase().includes(q)));
  }, [rows, search, type]);

  const show = async (id: string) => {
    try {
      const res: any = await pmApi.meeting(id);
      setOpen(res.data);
      setNotes({ minutes: res.data.minutes || "", attended: res.data.attendees.filter((a: any) => a.attended).map((a: any) => a._id), actions: res.data.actions.map((a: any) => ({ _id: a._id, text: a.text, assignee: a.assignee?._id || "", due: a.due, task: a.task })) });
    } catch (e: any) {
      toast(e?.message || "Could not open the meeting", "error");
    }
  };
  const close = () => { setOpen(null); if (params.get("open")) setParams({}, { replace: true }); };
  const openForm = (m?: any) => {
    setEditing(m || null);
    setForm(
      m
        ? {
            title: m.title, type: m.type?._id || "", date: m.date, from: m.from, to: m.to, mode: m.mode, location: m.location, link: m.link, project: m.project?._id || "", client: m.client?._id || "", emailInvite: m.emailInvite !== false, agenda: m.agenda,
            employees: m.attendees.filter((a: any) => a.user).map((a: any) => a.user._id), teams: [], contacts: [], reminders: m.reminders || [], repeat: "none", until: "",
          }
        : blank(emailDefault)
    );
  };
  const client = clients.find((c) => c._id === form?.client);

  const save = async () => {
    if (!form?.title.trim()) return;
    setSaving(true);
    try {
      const body: any = { ...form, type: form.type || null, project: form.project || null, client: form.client || null };
      if (editing) {
        // contacts already invited stay invited
        body.contacts = [...form.contacts, ...(client?.contacts || []).filter((c: any) => editing.attendees.some((a: any) => a.isClient && a.name === c.name)).map((c: any) => c._id)];
        await pmApi.updateMeeting(editing._id, body);
        toast("Saved");
      } else {
        const res: any = await pmApi.createMeeting(body);
        toast(res.data.created > 1 ? `${res.data.created} meetings created` : form.emailInvite ? "Invites sent" : "Meeting created");
      }
      setForm(null);
      setOpen(null);
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };
  const respond = async (response: string) => {
    try {
      await pmApi.respondMeeting(open._id, response);
      await show(open._id);
      load();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    }
  };
  const cancel = async () => {
    if (!window.confirm(`Cancel "${open.title}"? The attendees are told.`)) return;
    try {
      await pmApi.cancelMeeting(open._id);
      toast("Cancelled");
      close();
      load();
    } catch (e: any) {
      toast(e?.message || "Could not cancel", "error");
    }
  };
  const saveNotes = async () => {
    setSaving(true);
    try {
      const res: any = await pmApi.saveMinutes(open._id, { ...notes, actions: notes!.actions.map((a) => ({ ...a, assignee: a.assignee || null })) });
      setOpen(res.data);
      setNotes({ minutes: res.data.minutes || "", attended: res.data.attendees.filter((a: any) => a.attended).map((a: any) => a._id), actions: res.data.actions.map((a: any) => ({ _id: a._id, text: a.text, assignee: a.assignee?._id || "", due: a.due, task: a.task })) });
      toast("Saved");
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };
  const toTask = async (a: any) => {
    try {
      const res: any = await pmApi.actionToTask(open._id, a._id);
      toast(`Task ${res.data.number} created`);
      await show(open._id);
    } catch (e: any) {
      toast(e?.message || "Could not create the task", "error");
    }
  };
  const exportExcel = () =>
    tab === "training"
      ? exportRows("training-report.xlsx", "Trainings", report.flatMap((t) => t.people.map((p: any) => ({ Date: fmtDate(t.date), Training: t.title, Project: t.project, Person: p.name, Client: p.isClient ? "Yes" : "", Attended: p.attended ? "Yes" : "No" }))))
      : exportRows("meetings.xlsx", "Meetings", filtered.map((m) => ({
          Date: fmtDate(m.date), Time: `${m.from} – ${m.to}`, Title: m.title, Type: m.type?.name || "", Mode: meetingMode(m.mode), Where: [m.mode === "online" ? "" : m.location, m.mode === "onsite" ? "" : m.link].filter(Boolean).join(" · "),
          Project: m.project?.name || "", Organizer: m.organizer?.name || "", Attendees: m.attendees.length, Attended: m.attendees.filter((a: any) => a.attended).length, Status: m.status === "cancelled" ? "Cancelled" : "Scheduled",
        })));

  const mine = open?.attendees.find((a: any) => a.user?._id === me);
  const organizer = open && (open.organizer?._id === me || hasRight("meetings", "edit"));
  const started = open && `${open.date}T${open.from}` <= new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 16);

  return (
    <>
      <PageTitle
        icon={<Users2 className="h-4 w-4" />}
        title="Meetings & Trainings"
        actions={
          <div className="flex items-center gap-2">
            {hasRight("meetings", "export") && <UIButton variant="outline" onClick={exportExcel} leftIcon={<Download className="h-3.5 w-3.5" />}>Export Excel</UIButton>}
            {canAdd && <UIButton onClick={() => openForm()} leftIcon={<Plus className="h-3.5 w-3.5" />}>New</UIButton>}
          </div>
        }
      />
      <div className="mt-3 flex gap-1 border-b">
        {([["upcoming", "Upcoming"], ["past", "Past"], ["training", "Training report"]] as const).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setTab(v)} className="px-3 py-2 text-[13px] font-medium whitespace-nowrap" style={{ background: "transparent", border: 0, borderBottom: `2px solid ${tab === v ? "var(--primary)" : "transparent"}`, color: tab === v ? "var(--primary)" : "var(--muted-foreground)" }}>{label}</button>
        ))}
      </div>

      {tab !== "training" && (
        <>
          <div className="mt-3 mb-3 flex items-center gap-2 flex-wrap">
            <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" containerClassName="flex-1 min-w-[180px] max-w-sm" />
            <select className="ui-input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {(masters.meeting_type || []).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{loading ? "Loading…" : filtered.length}</span>
          </div>
          {!loading && filtered.length === 0 && (
            <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No meetings
              {canAdd && tab === "upcoming" && <div className="mt-3"><UIButton size="sm" onClick={() => openForm()} leftIcon={<Plus className="h-3.5 w-3.5" />}>New</UIButton></div>}
            </div>
          )}
          {filtered.length > 0 && isMobile && (
            <div className="space-y-2">
              {filtered.map((m) => (
                <div key={m._id} className="rounded-xl border bg-card p-3" style={{ opacity: m.status === "cancelled" ? 0.55 : 1 }} onClick={() => show(m._id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{m.title}</div>
                      <div className="text-[11px] text-muted-foreground">{fmtDate(m.date)} · {m.from} – {m.to}</div>
                    </div>
                    {m.status === "cancelled" ? <Pill tone="danger">Cancelled</Pill> : <MasterBadge item={m.type} fallback="" />}
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted-foreground truncate">{meetingWhere(m) || "—"} · {m.attendees.length} people</div>
                </div>
              ))}
            </div>
          )}
          {filtered.length > 0 && !isMobile && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                      <th className={TH}>When</th><th className={TH}>Title</th><th className={TH}>Type</th><th className={TH}>Where</th><th className={TH}>Organizer</th><th className={TH}>People</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((m) => (
                      <tr key={m._id} className="border-t hover:bg-accent/30 cursor-pointer" style={{ opacity: m.status === "cancelled" ? 0.55 : 1 }} onClick={() => show(m._id)}>
                        <td className="px-4 py-2.5 whitespace-nowrap"><div className="font-medium text-foreground">{fmtDate(m.date)}</div><div className="text-xs text-muted-foreground">{m.from} – {m.to}</div></td>
                        <td className="px-4 py-2.5"><div className="font-medium text-foreground">{m.title}</div>{m.project && <div className="text-xs text-muted-foreground">{m.project.name}</div>}</td>
                        <td className="px-4 py-2.5">{m.status === "cancelled" ? <Pill tone="danger">Cancelled</Pill> : <MasterBadge item={m.type} />}</td>
                        <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5">{m.mode !== "onsite" && <Video className="h-3.5 w-3.5 text-muted-foreground" />}{meetingWhere(m) || "—"}</span></td>
                        <td className="px-4 py-2.5">{m.organizer?.name}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{tab === "past" ? `${m.attendees.filter((a: any) => a.attended).length}/${m.attendees.length} attended` : `${m.attendees.filter((a: any) => a.response === "yes").length}/${m.attendees.length} yes`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "training" && (
        <div className="mt-3 space-y-2">
          {!loading && report.length === 0 && <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No trainings</div>}
          {report.map((t) => (
            <div key={t._id} className="rounded-xl border bg-card p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{t.title}</div>
                  <div className="text-[11px] text-muted-foreground">{fmtDate(t.date)} · {t.time}{t.project ? ` · ${t.project}` : ""}</div>
                </div>
                <Pill tone={t.attended === t.invited && t.invited ? "success" : "info"}>{t.attended}/{t.invited} attended</Pill>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.people.map((p: any, i: number) => <Pill key={i} tone={p.attended ? "success" : "muted"}>{p.name}</Pill>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* detail */}
      <Sheet open={!!open} onOpenChange={(o) => !o && close()}>
        <SheetContent className="crm-theme w-full sm:max-w-xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{open?.title}</SheetTitle></SheetHeader>
          {open && notes && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {open.status === "cancelled" ? <Pill tone="danger">Cancelled</Pill> : <MasterBadge item={open.type} fallback="" />}
                <Pill tone="muted">{fmtDate(open.date)} · {open.from} – {open.to}</Pill>
                <Pill tone="muted">{meetingMode(open.mode)}</Pill>
              </div>
              <dl className="rounded-lg border divide-y text-sm">
                {([
                  ["Where", open.mode === "online" ? "" : open.location || "—"],
                  ["Online", open.mode !== "onsite" && (open.link ? <a href={open.link} target="_blank" rel="noreferrer" style={{ color: "var(--primary)" }}>Join</a> : "—")],
                  ["Organizer", open.organizer?.name],
                  ["Project", open.project?.name],
                  ["Client", open.client?.name],
                ] as [string, any][]).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="m-0 text-right truncate">{v}</dd></div>
                ))}
              </dl>
              {open.agenda && <div><div className={LABEL}>Agenda</div><div className="text-sm whitespace-pre-wrap">{open.agenda}</div></div>}

              {mine && open.status !== "cancelled" && !started && (
                <div>
                  <div className={LABEL}>Will you attend?</div>
                  <div className="inline-flex rounded-lg border overflow-hidden">
                    {([["yes", "Yes", Check, "var(--success)"], ["maybe", "Maybe", HelpCircle, "var(--warning)"], ["no", "No", X, "var(--destructive)"]] as const).map(([v, label, Icon, color]) => (
                      <button key={v} type="button" onClick={() => respond(v)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-medium" style={{ border: 0, background: mine.response === v ? color : "transparent", color: mine.response === v ? "#fff" : "var(--foreground)" }}>
                        <Icon className="h-3.5 w-3.5" />{label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className={LABEL}>Attendees {started ? `· ${notes.attended.length}/${open.attendees.length} attended` : ""}</div>
                <div className="rounded-lg border divide-y">
                  {open.attendees.map((a: any) => (
                    <label key={a._id} className="flex items-center gap-2.5 px-3 py-2.5" style={{ marginBottom: 0 }}>
                      {started && organizer && (
                        <input type="checkbox" style={{ width: 20, height: 20 }} checked={notes.attended.includes(a._id)} onChange={(e) => setNotes({ ...notes, attended: e.target.checked ? [...notes.attended, a._id] : notes.attended.filter((x) => x !== a._id) })} />
                      )}
                      <PersonAvatar name={a.name} photo={a.user?.photo} size={26} />
                      <span className="min-w-0 flex-1 truncate text-sm">{a.name}{a.isClient && <span className="ml-1.5"><Pill tone="info">Client</Pill></span>}</span>
                      <Pill tone={REPLY[a.response][1]}>{REPLY[a.response][0]}</Pill>
                    </label>
                  ))}
                </div>
              </div>

              {started && open.status !== "cancelled" && (
                <>
                  <div>
                    <div className={LABEL}>Minutes</div>
                    <textarea className="ui-input w-full" rows={4} disabled={!organizer} value={notes.minutes} onChange={(e) => setNotes({ ...notes, minutes: e.target.value })} style={{ height: "auto" }} />
                  </div>
                  <div>
                    <div className={LABEL}>Action items</div>
                    <div className="space-y-2">
                      {notes.actions.map((a, i) => (
                        <div key={i} className="rounded-lg border p-2.5 space-y-2">
                          <div className="flex items-center gap-2">
                            <input className="ui-input flex-1 min-w-0" disabled={!organizer || !!a.task} value={a.text} aria-label="Action item" onChange={(e) => setNotes({ ...notes, actions: notes.actions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                            {organizer && !a.task && <UIButton size="icon-sm" variant="ghost" title="Remove" onClick={() => setNotes({ ...notes, actions: notes.actions.filter((_, j) => j !== i) })}><X className="h-3.5 w-3.5" /></UIButton>}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <EmployeePicker employees={employees} value={a.assignee} disabled={!organizer || !!a.task} onChange={(id) => setNotes({ ...notes, actions: notes.actions.map((x, j) => (j === i ? { ...x, assignee: id } : x)) })} />
                            <DateInput className="ui-input w-full" disabled={!organizer || !!a.task} value={a.due} onChange={(e: any) => setNotes({ ...notes, actions: notes.actions.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)) })} />
                          </div>
                          {a.task ? <Pill tone="success">Task {a.task.number}</Pill> : organizer && a._id && <UIButton size="sm" variant="outline" onClick={() => toTask(a)} leftIcon={<ListPlus className="h-3.5 w-3.5" />}>Make task</UIButton>}
                        </div>
                      ))}
                      {organizer && <UIButton size="sm" variant="outline" onClick={() => setNotes({ ...notes, actions: [...notes.actions, { text: "", assignee: "", due: "" }] })} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add action item</UIButton>}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {open && organizer && open.status !== "cancelled" && (
            <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
              {!started && <UIButton variant="danger" onClick={cancel} leftIcon={<Ban className="h-3.5 w-3.5" />}>Cancel</UIButton>}
              {!started && <UIButton variant="outline" onClick={() => openForm(open)} className="flex-1" leftIcon={<Pencil className="h-3.5 w-3.5" />}>Edit</UIButton>}
              {started && <UIButton onClick={saveNotes} loading={saving} className="flex-1">Save</UIButton>}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      {/* form */}
      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{editing ? "Edit meeting" : "New meeting / training"}</SheetTitle></SheetHeader>
          {form && (
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
              <div className="sm:col-span-2">
                <label className={LABEL}>Title *</label>
                <input autoFocus className="ui-input w-full" value={form.title} maxLength={140} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Type</label>
                <select className="ui-input w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="">—</option>
                  {(masters.meeting_type || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Date *</label>
                <DateInput className="ui-input w-full" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>From *</label>
                <input type="time" className="ui-input w-full" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>To *</label>
                <input type="time" className="ui-input w-full" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Mode</label>
                <select className="ui-input w-full" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as any })}>
                  {MEETING_MODES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </div>
              {form.mode !== "online" && (
                <div>
                  <label className={LABEL}>Location</label>
                  <input className="ui-input w-full" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
              )}
              {form.mode !== "onsite" && (
                <div className={form.mode === "hybrid" ? "sm:col-span-2" : ""}>
                  <label className={LABEL}>Meeting link</label>
                  <input className="ui-input w-full" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" />
                </div>
              )}
              {projects.length > 0 && (
                <div>
                  <label className={LABEL}>Project</label>
                  <select className="ui-input w-full" value={form.project} onChange={(e) => { const p = projects.find((x) => x._id === e.target.value); setForm({ ...form, project: e.target.value, client: p?.client?._id || form.client }); }}>
                    <option value="">— none —</option>
                    {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {clients.length > 0 && (
                <div>
                  <label className={LABEL}>Client</label>
                  <select className="ui-input w-full" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value, contacts: [] })}>
                    <option value="">— none —</option>
                    {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {teams.length > 0 && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>Teams</label>
                  <div className="pm-chips">
                    {teams.map((t) => {
                      const on = form.teams.includes(t._id);
                      return <button key={t._id} type="button" onClick={() => setForm({ ...form, teams: on ? form.teams.filter((x) => x !== t._id) : [...form.teams, t._id] })} className={on ? "is-on" : ""}>{t.name}</button>;
                    })}
                  </div>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className={LABEL}>Employees *</label>
                <div className="rounded-lg border overflow-y-auto" style={{ maxHeight: 190 }}>
                  {employees.filter((e) => e.status !== "Inactive").map((e) => (
                    <label key={e._id} className="flex items-center gap-2.5 px-3 py-2 text-sm border-b last:border-b-0 cursor-pointer" style={{ marginBottom: 0 }}>
                      <input type="checkbox" style={{ width: 18, height: 18 }} checked={form.employees.includes(e._id)} onChange={(ev) => setForm({ ...form, employees: ev.target.checked ? [...form.employees, e._id] : form.employees.filter((x) => x !== e._id) })} />
                      <PersonAvatar name={e.name} photo={e.photo} size={22} />{e.name}
                    </label>
                  ))}
                </div>
              </div>
              {client?.contacts?.length > 0 && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>Client contacts</label>
                  <div className="pm-chips">
                    {client.contacts.map((c: any) => {
                      const on = form.contacts.includes(c._id);
                      return <button key={c._id} type="button" onClick={() => setForm({ ...form, contacts: on ? form.contacts.filter((x) => x !== c._id) : [...form.contacts, c._id] })} className={on ? "is-on" : ""}>{c.name}</button>;
                    })}
                  </div>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className={LABEL}>Agenda</label>
                <textarea className="ui-input w-full" rows={3} value={form.agenda} onChange={(e) => setForm({ ...form, agenda: e.target.value })} style={{ height: "auto" }} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Remind before</label>
                <div className="pm-chips">
                  {REMINDERS.map(([mins, label]) => {
                    const on = form.reminders.includes(mins);
                    return <button key={mins} type="button" onClick={() => setForm({ ...form, reminders: on ? form.reminders.filter((x) => x !== mins) : [...form.reminders, mins] })} className={on ? "is-on" : ""}>{label}</button>;
                  })}
                </div>
              </div>
              <div className="sm:col-span-2 flex items-center justify-between gap-3 text-sm">
                <span>Email invite</span>
                <Toggle on={form.emailInvite} onChange={() => setForm({ ...form, emailInvite: !form.emailInvite })} labels={["On", "Off"]} />
              </div>
              {!editing && (
                <>
                  <div>
                    <label className={LABEL}>Repeat</label>
                    <select className="ui-input w-full" value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  {form.repeat !== "none" && (
                    <div>
                      <label className={LABEL}>Until *</label>
                      <DateInput className="ui-input w-full" value={form.until} onChange={(e: any) => setForm({ ...form, until: e.target.value })} />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setForm(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={save} loading={saving} disabled={!form?.title.trim()} className="flex-1">{editing ? "Save" : "Save and invite"}</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
