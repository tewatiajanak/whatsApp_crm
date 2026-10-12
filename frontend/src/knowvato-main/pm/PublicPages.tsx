import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Check, CheckCircle2, HelpCircle, X, XCircle } from "lucide-react";
import { pmApi } from "../../api";
import { fmtDate } from "@/utils/date";
import { meetingWhere } from "./shared";

/* Pages opened from a link in an email or WhatsApp message — no login. */

const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="crm-theme min-h-screen flex items-start sm:items-center justify-center p-4" style={{ background: "var(--page-bg)" }}>
      <div className="rounded-xl border bg-card w-full" style={{ maxWidth: 520 }}>
        <div className="border-b px-4 py-3 text-base font-semibold text-foreground">{title}</div>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}
function Result({ ok, text, sub }: { ok: boolean; text: string; sub?: string }) {
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div className="py-4 text-center">
      <Icon className="h-10 w-10 mx-auto" style={{ color: ok ? "var(--success)" : "var(--destructive)" }} />
      <div className="mt-2 text-base font-semibold text-foreground">{text}</div>
      {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}
const useLink = (path: string) => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    pmApi.publicGet(path).then((r: any) => setData(r.data)).catch((e: any) => setError(e?.message || "This link is not valid"));
  }, [path]);
  const post = async (body: any) => {
    setBusy(true);
    setError("");
    try {
      const r: any = await pmApi.publicPost(path, body);
      setData(r.data);
      return true;
    } catch (e: any) {
      setError(e?.message || "Could not save");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { data, error, busy, post };
};
const ErrorLine = ({ error }: { error: string }) => (error ? <div className="text-sm" style={{ color: "var(--destructive)" }}>{error}</div> : null);

/* ---- meeting invitation ---- */
export function PublicMeetingPage() {
  const { token = "" } = useParams();
  const { data, error, busy, post } = useLink(`meeting/${token}`);
  if (!data) return <Shell title="Meeting">{error ? <Result ok={false} text={error} /> : <div className="text-sm text-muted-foreground">Loading…</div>}</Shell>;
  return (
    <Shell title={data.title}>
      {data.status === "cancelled" && <Result ok={false} text="This meeting was cancelled" />}
      <dl className="rounded-lg border divide-y text-sm">
        {([["When", `${fmtDate(data.date)}, ${data.from} – ${data.to}`], ["Where", meetingWhere(data)], ["Organizer", data.organizer], ["Type", data.type]] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="m-0 text-right">{v}</dd></div>
        ))}
      </dl>
      {data.link && <a href={data.link} target="_blank" rel="noreferrer" className="ui-btn ui-btn-outline w-full text-decoration-none">Join online</a>}
      {data.agenda && <div><div className={LABEL}>Agenda</div><div className="text-sm whitespace-pre-wrap">{data.agenda}</div></div>}
      {data.status !== "cancelled" && (
        <div>
          <div className={LABEL}>{data.name}, will you attend?</div>
          <div className="grid grid-cols-3 gap-2">
            {([["yes", "Yes", Check, "var(--success)"], ["maybe", "Maybe", HelpCircle, "var(--warning)"], ["no", "No", X, "var(--destructive)"]] as const).map(([v, label, Icon, color]) => (
              <button key={v} type="button" disabled={busy} onClick={() => post({ response: v })} className="inline-flex items-center justify-center gap-1.5 rounded-lg border py-3 text-sm font-medium" style={data.response === v ? { background: color, borderColor: color, color: "#fff" } : { background: "transparent", color: "var(--foreground)" }}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
        </div>
      )}
      <ErrorLine error={error} />
    </Shell>
  );
}

/* ---- client verification of a task ---- */
export function PublicVerifyPage() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const { data, error, busy, post } = useLink(`verify/${token}`);
  const [choice, setChoice] = useState<"approve" | "reject" | "">(params.get("a") === "approve" || params.get("a") === "reject" ? (params.get("a") as any) : "");
  const [comment, setComment] = useState("");
  if (!data) return <Shell title="Verification">{error ? <Result ok={false} text={error} /> : <div className="text-sm text-muted-foreground">Loading…</div>}</Shell>;
  return (
    <Shell title="Verification">
      <div>
        <div className="text-base font-semibold text-foreground">{data.task}</div>
        <div className="text-xs text-muted-foreground">{data.project}</div>
      </div>
      {data.checklist?.length > 0 && (
        <div className="rounded-lg border divide-y">
          {data.checklist.map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm"><Check className="h-4 w-4 shrink-0" style={{ color: c.done ? "var(--success)" : "var(--border)" }} />{c.text}</div>
          ))}
        </div>
      )}
      {data.files?.length > 0 && <div className="text-xs text-muted-foreground">Files: {data.files.join(", ")}</div>}

      {data.status === "Approved" && <Result ok text="Approved" sub={`${data.answeredBy} · ${fmtDate(data.answeredAt)}`} />}
      {data.status === "Rejected" && <Result ok={false} text="Rejected" sub={data.comment} />}
      {data.status === "Expired" && <Result ok={false} text="This link has expired" sub="Ask the team to send it again." />}

      {data.status === "Pending" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {([["approve", "Approve", "var(--success)"], ["reject", "Reject", "var(--destructive)"]] as const).map(([v, label, color]) => (
              <button key={v} type="button" onClick={() => setChoice(v)} className="rounded-lg border py-3 text-sm font-semibold" style={choice === v ? { background: color, borderColor: color, color: "#fff" } : { background: "transparent", color }}>{label}</button>
            ))}
          </div>
          {choice && (
            <>
              <div>
                <label className={LABEL}>{choice === "reject" ? "What needs to change? *" : "Comment"}</label>
                <textarea className="ui-input w-full" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} style={{ height: "auto" }} />
              </div>
              <button type="button" className="ui-btn ui-btn-primary w-full" disabled={busy || (choice === "reject" && !comment.trim())} onClick={() => post({ approve: choice === "approve", comment })}>
                {busy ? "Saving…" : `Confirm ${choice === "approve" ? "approval" : "rejection"}`}
              </button>
            </>
          )}
        </>
      )}
      <ErrorLine error={error} />
    </Shell>
  );
}

/* ---- sign-off ---- */
export function PublicSignoffPage() {
  const { token = "" } = useParams();
  const { data, error, busy, post } = useLink(`signoff/${token}`);
  const [concern, setConcern] = useState(false);
  const [comment, setComment] = useState("");
  if (!data) return <Shell title="Sign-off">{error ? <Result ok={false} text={error} /> : <div className="text-sm text-muted-foreground">Loading…</div>}</Shell>;
  return (
    <Shell title="Sign-off">
      <div>
        <div className="text-base font-semibold text-foreground">{data.title}</div>
        <div className="text-xs text-muted-foreground">{data.client}</div>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}><th className="px-3 py-2 text-left font-medium">Module</th><th className="px-3 py-2 font-medium" style={{ textAlign: "center" }}>Tasks</th><th className="px-3 py-2 text-right font-medium">Completed</th></tr></thead>
          <tbody>{data.summary.map((m: any, i: number) => <tr key={i} className="border-t"><td className="px-3 py-2">{m.module}</td><td className="px-3 py-2" style={{ textAlign: "center" }}>{m.tasks}</td><td className="px-3 py-2 text-right whitespace-nowrap">{m.completedOn || "—"}</td></tr>)}</tbody>
        </table>
      </div>

      {data.status === "Accepted" && <Result ok text="Signed off" sub={`${data.answeredBy} · ${fmtDate(data.answeredAt)}`} />}
      {data.status === "Concern" && <Result ok={false} text="Concern raised" sub={data.comment} />}
      {data.status === "Expired" && <Result ok={false} text="This link has expired" sub="Ask the team to send it again." />}

      {data.status === "Pending" && (
        concern ? (
          <>
            <div>
              <label className={LABEL}>Your concern *</label>
              <textarea autoFocus className="ui-input w-full" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} style={{ height: "auto" }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="ui-btn ui-btn-outline" onClick={() => setConcern(false)}>Back</button>
              <button type="button" className="ui-btn ui-btn-primary" disabled={busy || !comment.trim()} onClick={() => post({ accept: false, comment })}>{busy ? "Saving…" : "Send concern"}</button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="ui-btn ui-btn-outline" onClick={() => setConcern(true)}>Raise concern</button>
            <button type="button" className="ui-btn ui-btn-primary" disabled={busy} onClick={() => post({ accept: true })}>{busy ? "Saving…" : "Accept and sign off"}</button>
          </div>
        )
      )}
      <ErrorLine error={error} />
    </Shell>
  );
}
