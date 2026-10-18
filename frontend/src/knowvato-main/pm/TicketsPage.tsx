import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Columns3, Download, LayoutList, LifeBuoy, ListPlus, Lock, Merge, Plus, Send, Star, UserRoundCog } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchInput, UIButton } from "../components/UIKit";
import { LABEL, Pill, TH, Toggle } from "../user-management/shared";
import { fmtDate, fmtDateTime, fmtRelative } from "@/utils/date";
import EmployeePicker from "./EmployeePicker";
import { usePm } from "./PmLayout";
import ReassignDialog from "./ReassignDialog";
import { MasterBadge, PageTitle, PersonAvatar, exportRows } from "./shared";

const PER_PAGE = 50;
const slaPill = (t: any) => (t.isClosed ? null : t.resolveLate ? <Pill tone="danger">SLA missed</Pill> : t.responseLate ? <Pill tone="warning">Response late</Pill> : null);

/** Project Management → Tickets: the support desk. */
export default function TicketsPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const { hasRight } = useAuth() as any;
  const { employees, masters } = usePm();
  const canEdit = hasRight("tickets", "edit");
  const statuses = (masters.ticket_status || []).filter((m) => m.active);

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "board">("list");
  const [search, setSearch] = useState("");
  const [f, setF] = useState({ state: "open", client: "", priority: "", assignee: "", overdue: "" });
  const [clients, setClients] = useState<any[]>([]);
  const [open, setOpen] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [assign, setAssign] = useState(false);
  const [mergeInto, setMergeInto] = useState("");
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drag, setDrag] = useState("");

  const query = (p: number, perPage = PER_PAGE) => {
    const q = new URLSearchParams({ page: String(p), perPage: String(view === "board" ? 300 : perPage) });
    Object.entries(f).forEach(([k, v]) => v && q.set(k, v));
    if (search.trim()) q.set("q", search.trim());
    return q.toString();
  };
  const load = async (p = page) => {
    setLoading(true);
    try {
      const res: any = await pmApi.tickets(query(p));
      setRows(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      toast(e?.message || "Could not load tickets", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, search, view]);
  useEffect(() => {
    if (hasRight("clients", "view")) pmApi.clients().then((r: any) => setClients(r?.data ?? [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const id = params.get("open");
    if (id) show(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const show = async (id: string) => {
    try {
      const res: any = await pmApi.ticket(id);
      setOpen(res.data);
      setReply("");
      setInternal(false);
      setMergeInto("");
    } catch (e: any) {
      toast(e?.message || "Could not open the ticket", "error");
    }
  };
  const close = () => { setOpen(null); if (params.get("open")) setParams({}, { replace: true }); };
  const run = async (fn: () => Promise<any>, done?: string) => {
    setBusy(true);
    try {
      const res: any = await fn();
      if (done) toast(done);
      if (res?.data?._id && res.data.number) setOpen(res.data);
      else if (open) await show(open._id);
      load();
      return res;
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setBusy(false);
    }
  };
  const openFile = async (file: any) => {
    try {
      const url = URL.createObjectURL(await pmApi.ticketFile(open._id, file._id));
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: any) {
      toast(e?.message || "Could not open the file", "error");
    }
  };
  const create = async () => {
    setBusy(true);
    try {
      await pmApi.createTicket(form);
      toast("Ticket created");
      setForm(null);
      load();
    } catch (e: any) {
      toast(e?.message || "Could not create the ticket", "error");
    } finally {
      setBusy(false);
    }
  };
  const drop = async (status: string) => {
    const id = drag;
    setDrag("");
    const t = rows.find((x) => x._id === id);
    if (!t || t.status?._id === status) return;
    try {
      await pmApi.updateTicket(id, { status });
      load();
    } catch (e: any) {
      toast(e?.message || "Could not move the ticket", "error");
    }
  };
  const exportExcel = async () => {
    try {
      const res: any = await pmApi.tickets(query(1, 300));
      exportRows("tickets.xlsx", "Tickets", (res.data ?? []).map((t: any) => ({
        Number: t.number, Subject: t.subject, Client: t.client?.name || "", Project: t.project?.name || "", Category: t.category?.name || "", Priority: t.priority?.name || "", Status: t.status?.name || "",
        Assignee: t.assignee?.name || "", Raised: fmtDateTime(t.createdAt), "Resolve by": t.resolveDue ? fmtDateTime(t.resolveDue) : "", Resolved: t.resolvedAt ? fmtDateTime(t.resolvedAt) : "", "SLA missed": t.resolveLate ? "Yes" : "", Rating: t.rating || "",
      })));
    } catch (e: any) {
      toast(e?.message || "Could not export", "error");
    }
  };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const select = (key: keyof typeof f, label: string, options: { _id: string; name: string }[]) => (
    <select className="ui-input" value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>
      <option value="">{label}</option>
      {options.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
    </select>
  );

  return (
    <>
      <PageTitle
        icon={<LifeBuoy className="h-4 w-4" />}
        title="Tickets"
        actions={
          <div className="flex items-center gap-2">
            {hasRight("tickets", "export") && <UIButton variant="outline" onClick={exportExcel} disabled={!total} leftIcon={<Download className="h-3.5 w-3.5" />}>Export Excel</UIButton>}
            {hasRight("tickets", "create") && <UIButton onClick={() => setForm({ client: "", subject: "", description: "", category: "", priority: "", assignee: "" })} leftIcon={<Plus className="h-3.5 w-3.5" />}>Ticket</UIButton>}
          </div>
        }
      />

      <div className="mt-3 mb-3 flex items-center gap-2 flex-wrap">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" containerClassName="flex-1 min-w-[180px] max-w-sm" />
        <select className="ui-input" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="">All</option>
        </select>
        {clients.length > 0 && select("client", "All clients", clients)}
        {select("priority", "All priorities", (masters.ticket_priority || []).filter((m) => m.active))}
        <div style={{ width: 200 }}><EmployeePicker employees={employees} value={f.assignee} onChange={(id) => setF({ ...f, assignee: id })} emptyLabel="All employees" /></div>
        <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">SLA missed<Toggle on={!!f.overdue} onChange={() => setF({ ...f, overdue: f.overdue ? "" : "1" })} labels={["Yes", "No"]} /></span>
        <span className="ml-auto text-xs text-muted-foreground">{loading ? "Loading…" : `${total} tickets`}</span>
        <div className="inline-flex rounded-lg border overflow-hidden">
          {([["list", LayoutList], ["board", Columns3]] as const).map(([v, Icon]) => (
            <button key={v} type="button" title={v} onClick={() => setView(v)} className="inline-flex h-9 w-10 items-center justify-center" style={{ border: 0, background: view === v ? "var(--primary)" : "transparent", color: view === v ? "#fff" : "var(--muted-foreground)" }}><Icon className="h-4 w-4" /></button>
          ))}
        </div>
      </div>

      {!loading && rows.length === 0 && <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No tickets</div>}

      {view === "board" && rows.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {statuses.map((s) => {
            const list = rows.filter((t) => t.status?._id === s._id);
            return (
              <div key={s._id} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(s._id)} className="shrink-0 rounded-xl border bg-card" style={{ width: 270 }}>
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b"><MasterBadge item={s} /><span className="text-xs font-semibold text-muted-foreground">{list.length}</span></div>
                <div className="p-2 space-y-2 overflow-y-auto" style={{ maxHeight: "60vh", minHeight: 80 }}>
                  {list.map((t) => (
                    <div key={t._id} draggable={canEdit} onDragStart={() => setDrag(t._id)} onClick={() => show(t._id)} className="rounded-lg border bg-card p-2.5 cursor-pointer hover:border-primary" style={t.resolveLate ? { borderColor: "var(--destructive)" } : undefined}>
                      <div className="text-[11px] font-mono text-muted-foreground">{t.number}</div>
                      <div className="text-[13px] font-medium text-foreground">{t.subject}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground truncate">{t.client?.name}</div>
                      <div className="mt-2 flex items-center justify-between gap-2"><MasterBadge item={t.priority} fallback="" />{t.assignee && <PersonAvatar name={t.assignee.name} photo={t.assignee.photo} size={20} />}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "list" && rows.length > 0 && isMobile && (
        <div className="space-y-2">
          {rows.map((t) => (
            <div key={t._id} className="rounded-xl border bg-card p-3" onClick={() => show(t._id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-muted-foreground">{t.number}</div>
                  <div className="text-sm font-medium text-foreground">{t.subject}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{t.client?.name}</div>
                </div>
                <MasterBadge item={t.status} />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2"><span className="inline-flex gap-1"><MasterBadge item={t.priority} fallback="" />{slaPill(t)}</span>{t.assignee && <PersonAvatar name={t.assignee.name} photo={t.assignee.photo} size={20} />}</div>
            </div>
          ))}
        </div>
      )}

      {view === "list" && rows.length > 0 && !isMobile && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                  <th className={TH}>Ticket</th><th className={TH}>Client</th><th className={TH}>Priority</th><th className={TH}>Status</th><th className={TH}>Assignee</th><th className={TH}>Resolve by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t._id} className="border-t hover:bg-accent/30 cursor-pointer" style={t.resolveLate ? { background: "color-mix(in srgb, var(--destructive) 6%, transparent)" } : undefined} onClick={() => show(t._id)}>
                    <td className="px-4 py-2.5"><div className="font-medium text-foreground">{t.subject}</div><div className="text-[11px] text-muted-foreground"><span className="font-mono">{t.number}</span>{t.category ? ` · ${t.category.name}` : ""} · {fmtRelative(t.createdAt)}</div></td>
                    <td className="px-4 py-2.5"><div>{t.client?.name}</div>{t.project && <div className="text-xs text-muted-foreground">{t.project.name}</div>}</td>
                    <td className="px-4 py-2.5"><MasterBadge item={t.priority} /></td>
                    <td className="px-4 py-2.5"><MasterBadge item={t.status} /></td>
                    <td className="px-4 py-2.5">{t.assignee ? <span className="inline-flex items-center gap-2"><PersonAvatar name={t.assignee.name} photo={t.assignee.photo} size={22} />{t.assignee.name}</span> : <Pill tone="warning">Unassigned</Pill>}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{t.resolveDue ? fmtDateTime(t.resolveDue) : "—"} {slaPill(t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === "list" && pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <UIButton size="sm" variant="outline" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }}>Previous</UIButton>
          <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
          <UIButton size="sm" variant="outline" disabled={page >= pages} onClick={() => { setPage(page + 1); load(page + 1); }}>Next</UIButton>
        </div>
      )}

      {/* detail */}
      <Sheet open={!!open} onOpenChange={(o) => !o && close()}>
        <SheetContent size="wide" className="crm-theme w-full sm:max-w-2xl flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10">
            <SheetTitle className="flex items-center gap-2 min-w-0"><span className="font-mono text-xs text-muted-foreground shrink-0">{open?.number}</span><span className="truncate">{open?.subject}</span></SheetTitle>
          </SheetHeader>
          {open && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-1.5">
                {slaPill(open)}
                <Pill tone="muted">{open.client?.name}</Pill>
                {open.project && <Pill tone="muted">{open.project.name}{open.projectModule ? ` › ${open.projectModule.name}` : ""}</Pill>}
                {open.rating > 0 && <Pill tone="success"><Star className="h-3 w-3 mr-1 inline" fill="currentColor" />{open.rating}/5</Pill>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Status</label>
                  <select className="ui-input w-full" disabled={!canEdit || busy} value={open.status?._id || ""} onChange={(e) => run(() => pmApi.updateTicket(open._id, { status: e.target.value }), "Status updated")} style={{ fontWeight: 600, color: open.status?.color }}>
                    {statuses.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Priority</label>
                  <select className="ui-input w-full" disabled={!canEdit || busy} value={open.priority?._id || ""} onChange={(e) => run(() => pmApi.updateTicket(open._id, { priority: e.target.value }))}>
                    {(masters.ticket_priority || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Category</label>
                  <select className="ui-input w-full" disabled={!canEdit || busy} value={open.category?._id || ""} onChange={(e) => run(() => pmApi.updateTicket(open._id, { category: e.target.value || null }))}>
                    <option value="">—</option>
                    {(masters.ticket_category || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Assignee</label>
                  <div className="flex items-center gap-2">
                    <div className="ui-input flex-1 min-w-0 flex items-center gap-2">{open.assignee ? <><PersonAvatar name={open.assignee.name} photo={open.assignee.photo} size={22} /><span className="truncate">{open.assignee.name}</span></> : "—"}</div>
                    {hasRight("tickets", "assign") && <UIButton size="icon" variant="outline" title="Assign" onClick={() => setAssign(true)}><UserRoundCog className="h-4 w-4" /></UIButton>}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                Raised by {open.raisedBy?.name} · {fmtDateTime(open.createdAt)}
                {open.responseDue && <> · respond by {fmtDateTime(open.responseDue)}</>}
                {open.resolveDue && <> · resolve by {fmtDateTime(open.resolveDue)}</>}
              </div>
              {open.description && <div className="text-sm whitespace-pre-wrap">{open.description}</div>}
              {open.files?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {open.files.map((x: any) => <button key={x._id} type="button" onClick={() => openFile(x)} className="rounded-lg border px-2.5 py-1.5 text-[12.5px]" style={{ background: "transparent", color: "var(--primary)" }}>{x.name}</button>)}
                </div>
              )}

              {canEdit && (
                <div className="flex flex-wrap items-center gap-2">
                  {open.linkedTask ? <Pill tone="info">Task {open.linkedTask.number}{open.linkedTask.isCompleted ? " ✓" : ""}</Pill> : <UIButton size="sm" variant="outline" onClick={() => run(() => pmApi.ticketToTask(open._id), "Task created")} leftIcon={<ListPlus className="h-3.5 w-3.5" />}>Make task</UIButton>}
                  <span className="inline-flex items-center gap-1.5">
                    <select className="ui-input" style={{ maxWidth: 190 }} value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} aria-label="Merge into">
                      <option value="">Merge into…</option>
                      {rows.filter((t) => t._id !== open._id && t.client?._id === open.client?._id).map((t) => <option key={t._id} value={t._id}>{t.number} {t.subject}</option>)}
                    </select>
                    {mergeInto && <UIButton size="sm" variant="outline" onClick={() => window.confirm("Merge this ticket into the chosen one? It will be closed.") && run(() => pmApi.mergeTicket(open._id, mergeInto), "Merged").then(close)} leftIcon={<Merge className="h-3.5 w-3.5" />}>Merge</UIButton>}
                  </span>
                </div>
              )}

              <div>
                <div className={LABEL}>Conversation</div>
                <div className="space-y-2.5">
                  {open.replies.length === 0 && <div className="text-sm text-muted-foreground">No replies</div>}
                  {open.replies.map((x: any) => (
                    <div key={x._id} className="rounded-lg border px-3 py-2" style={x.internal ? { background: "var(--warning-bg)", borderColor: "var(--warning)" } : x.byClient ? { borderColor: "var(--info)" } : undefined}>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{x.byClient || x.by?.name || "Support"}</span>
                        {x.byClient && <Pill tone="info">Client</Pill>}
                        {x.internal && <Pill tone="warning"><Lock className="h-3 w-3 mr-1 inline" />Internal</Pill>}
                        <span>{fmtRelative(x.at)}</span>
                      </div>
                      <div className="mt-0.5 text-sm whitespace-pre-wrap">{x.text}</div>
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <div className="mt-3">
                    <textarea className="ui-input w-full" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} style={{ height: "auto", ...(internal ? { background: "var(--warning-bg)" } : {}) }} aria-label="Reply" />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">Internal note<Toggle on={internal} onChange={() => setInternal((v) => !v)} labels={["Yes", "No"]} /></span>
                      <UIButton size="sm" loading={busy} disabled={!reply.trim()} onClick={async () => { if (await run(() => pmApi.replyTicket(open._id, { text: reply.trim(), internal }))) setReply(""); }} leftIcon={<Send className="h-3.5 w-3.5" />}>{internal ? "Add note" : "Reply to client"}</UIButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {assign && open && (
        <ReassignDialog title={open.assignee ? "Reassign ticket" : "Assign ticket"} current={open.assignee?._id} onClose={() => setAssign(false)} onSubmit={async (to, reason) => { await pmApi.assignTicket(open._id, { to, reason }); await show(open._id); load(); }} />
      )}

      {/* a ticket raised by the team for a client */}
      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>New ticket</SheetTitle></SheetHeader>
          {form && (
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
              <div className="sm:col-span-2">
                <label className={LABEL}>Client *</label>
                <select className="ui-input w-full" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
                  <option value="">—</option>
                  {clients.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Subject *</label>
                <input className="ui-input w-full" value={form.subject} maxLength={160} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Category</label>
                <select className="ui-input w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">—</option>
                  {(masters.ticket_category || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Priority</label>
                <select className="ui-input w-full" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option value="">—</option>
                  {(masters.ticket_priority || []).filter((m) => m.active).map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Assignee</label>
                <EmployeePicker employees={employees} value={form.assignee} onChange={(id) => setForm({ ...form, assignee: id })} />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Description</label>
                <textarea className="ui-input w-full" rows={5} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ height: "auto" }} />
              </div>
            </div>
          )}
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setForm(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={create} loading={busy} disabled={!form?.client || !form?.subject.trim()} className="flex-1">Create</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
