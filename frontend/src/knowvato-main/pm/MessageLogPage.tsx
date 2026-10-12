import { useEffect, useState } from "react";
import { Download, Mail, MessageCircle, RotateCw, ScrollText } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useIsMobile } from "@/hooks/use-mobile";
import DateInput from "../../components/DateInput";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SearchInput, UIButton } from "../components/UIKit";
import { Pill, TH } from "../user-management/shared";
import { fmtDateTime } from "@/utils/date";
import { PageTitle, exportRows } from "./shared";

const TONE: Record<string, "success" | "danger" | "warning" | "muted" | "info"> = { Sent: "success", Failed: "danger", Pending: "info", Sending: "info", Skipped: "muted" };
const PER_PAGE = 50;

/** Project Management → Message Log: every Email / WhatsApp sent, failed or skipped. */
export default function MessageLogPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const isMobile = useIsMobile();
  const { hasRight } = useAuth() as any;
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [f, setF] = useState({ channel: "", status: "", from: "", to: "" });
  const [open, setOpen] = useState<any>(null);
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
      const res: any = await pmApi.messages(query(p));
      setRows(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      toast(e?.message || "Could not load messages", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, search]);

  const resend = async (m: any) => {
    try {
      await pmApi.resendMessage(m._id);
      toast("Queued again");
      setOpen(null);
      load();
    } catch (e: any) {
      toast(e?.message || "Could not resend", "error");
    }
  };
  const exportExcel = async () => {
    try {
      const res: any = await pmApi.messages(query(1, 200));
      exportRows("message-log.xlsx", "Messages", (res.data ?? []).map((m: any) => ({
        Date: fmtDateTime(m.createdAt), Channel: m.channel === "email" ? "Email" : "WhatsApp", To: m.intendedTo || m.to, Name: m.toName, Template: m.templateName, Subject: m.subject,
        Project: m.project?.name || "", Client: m.client?.name || "", Task: m.task?.title || "", Status: m.status, Delivery: m.delivery, Error: m.error,
      })));
    } catch (e: any) {
      toast(e?.message || "Could not export", "error");
    }
  };
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const icon = (m: any) => (m.channel === "email" ? <Mail className="h-3.5 w-3.5" style={{ color: "var(--info)" }} /> : <MessageCircle className="h-3.5 w-3.5" style={{ color: "var(--success)" }} />);

  return (
    <>
      <PageTitle icon={<ScrollText className="h-4 w-4" />} title="Message Log" actions={hasRight("notification_rules", "export") && <UIButton variant="outline" onClick={exportExcel} disabled={!total} leftIcon={<Download className="h-3.5 w-3.5" />}>Export Excel</UIButton>} />

      <div className="mt-3 mb-3 flex items-center gap-2 flex-wrap">
        <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" containerClassName="flex-1 min-w-[180px] max-w-sm" />
        <select className="ui-input" value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>
          <option value="">All channels</option>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select className="ui-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="">All status</option>
          {["Sent", "Failed", "Pending", "Skipped"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ width: 150 }}><DateInput className="ui-input w-full" value={f.from} onChange={(e: any) => setF({ ...f, from: e.target.value })} /></div>
        <div style={{ width: 150 }}><DateInput className="ui-input w-full" value={f.to} onChange={(e: any) => setF({ ...f, to: e.target.value })} /></div>
        <span className="ml-auto text-xs text-muted-foreground">{loading ? "Loading…" : `${total} messages`}</span>
      </div>

      {!loading && rows.length === 0 && <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No messages</div>}

      {rows.length > 0 && isMobile && (
        <div className="space-y-2">
          {rows.map((m) => (
            <div key={m._id} className="rounded-xl border bg-card p-3" onClick={() => setOpen(m)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">{icon(m)}<span className="truncate">{m.toName || m.intendedTo || m.to}</span></div>
                  <div className="text-[11px] text-muted-foreground truncate">{m.templateName || m.subject}</div>
                </div>
                <Pill tone={TONE[m.status] || "muted"}>{m.status}</Pill>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{fmtDateTime(m.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && !isMobile && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                  <th className={TH}>Date</th><th className={TH}>To</th><th className={TH}>Template</th><th className={TH}>Project</th><th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setOpen(m)}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDateTime(m.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 font-medium text-foreground">{icon(m)}{m.toName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{m.intendedTo || m.to}{m.intendedTo && m.to !== m.intendedTo && <span> → test {m.to}</span>}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div>{m.templateName || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate" style={{ maxWidth: 280 }}>{m.subject}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div>{m.project?.name || "—"}</div>
                      {m.task && <div className="text-xs text-muted-foreground truncate" style={{ maxWidth: 220 }}>{m.task.title}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Pill tone={TONE[m.status] || "muted"}>{m.status}</Pill>
                      {m.delivery && m.delivery !== "sent" && <span className="ml-1"><Pill tone="info">{m.delivery}</Pill></span>}
                      {m.error && <div className="mt-0.5 text-[11px] text-muted-foreground truncate" style={{ maxWidth: 220 }}>{m.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <UIButton size="sm" variant="outline" disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }}>Previous</UIButton>
          <span className="text-xs text-muted-foreground">Page {page} of {pages}</span>
          <UIButton size="sm" variant="outline" disabled={page >= pages} onClick={() => { setPage(page + 1); load(page + 1); }}>Next</UIButton>
        </div>
      )}

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{open?.templateName || "Message"}</SheetTitle></SheetHeader>
          {open && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone={TONE[open.status] || "muted"}>{open.status}</Pill>
                {open.delivery && <Pill tone="info">{open.delivery}</Pill>}
                <span className="text-xs text-muted-foreground">{fmtDateTime(open.sentAt || open.createdAt)} · {open.attempts} attempt{open.attempts === 1 ? "" : "s"}</span>
              </div>
              <div className="text-sm"><span className="text-muted-foreground">To </span>{open.toName} {open.intendedTo || open.to}</div>
              {open.error && <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--destructive)", color: "var(--destructive)" }}>{open.error}</div>}
              <div className="rounded-lg border overflow-hidden">
                {open.subject && <div className="border-b px-3 py-2 text-sm font-semibold" style={{ background: "var(--muted-background)" }}>{open.subject}</div>}
                {open.channel === "email" ? <div className="px-3 py-2.5 text-sm" dangerouslySetInnerHTML={{ __html: open.body }} /> : <div className="px-3 py-2.5 text-sm whitespace-pre-wrap">{open.body}</div>}
              </div>
              {hasRight("notification_rules", "edit") && !["Pending", "Sending"].includes(open.status) && (
                <UIButton variant="outline" onClick={() => resend(open)} leftIcon={<RotateCw className="h-3.5 w-3.5" />}>Resend</UIButton>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
