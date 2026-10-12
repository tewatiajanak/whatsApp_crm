import { useEffect, useRef, useState } from "react";
import { crmApi, conversationsApi, messagesApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../context/ToastContext";
import { Spinner, EmptyState, Chip } from "../ui";
import { formatDateTime } from "../../utils/dateFormat";
import { timeAgo } from "./leadUtils";

const ACTION_ICON = { call: "telephone", followup: "calendar-plus", message: "chat-dots", fee: "cash-coin", none: "check2-circle" };

/* ───────────── the one thing to do next, plus an optional AI summary ───────────── */
export function Brief({ leadId, stamp, onFollowUp, onMessage }) {
  const brief = useApi(() => crmApi.brief(leadId), [leadId, stamp]);
  const [summary, setSummary] = useState(null);
  const [asking, setAsking] = useState(false);
  useEffect(() => setSummary(null), [leadId]);
  const b = brief.data;
  if (!b) return null;
  const go = b.action.kind === "followup" ? onFollowUp : b.action.kind === "message" ? onMessage : null;

  async function ask() {
    setAsking(true);
    try { const r = await crmApi.brief(leadId, true); setSummary(r.data.summary || "AI is not switched on. Turn it on in AI settings."); }
    catch (e) { setSummary(e.message); }
    finally { setAsking(false); }
  }

  return (
    <div className="rounded-lg border px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--primary) 6%, transparent)", borderColor: "color-mix(in srgb, var(--primary) 25%, var(--border))" }}>
      <div className="flex items-center gap-2.5">
        <i className={`bi bi-${ACTION_ICON[b.action.kind] || "lightbulb"}`} style={{ color: "var(--primary)", fontSize: 16 }}></i>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Next step</div>
          <div className="text-sm font-medium text-foreground">{b.action.text}</div>
        </div>
        {go && <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={go}>Do it</button>}
        <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Summarise with AI" disabled={asking} onClick={ask}><i className={`bi bi-${asking ? "hourglass-split" : "stars"}`}></i></button>
      </div>
      {summary && <div className="text-xs text-foreground mt-2 whitespace-pre-wrap">{summary}</div>}
    </div>
  );
}

/* ───────────── the lead's WhatsApp chat ───────────── */
export function Chat({ lead, canSend }) {
  const toast = useToast();
  const chat = useApi(() => crmApi.conversation(lead._id), [lead._id]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef(null);
  const d = chat.data;
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [d?.messages?.length]);
  // new replies show up without a manual refresh
  useEffect(() => { const t = setInterval(() => document.visibilityState === "visible" && chat.reload(), 20000); return () => clearInterval(t); }, [lead._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      if (d?.conversation) await conversationsApi.reply(d.conversation._id, { text: body });
      else await messagesApi.send({ channel: "whatsapp", to: lead.phone, text: body });
      setText("");
      chat.reload();
    } catch (e) { toast(e.message, "error"); }
    finally { setSending(false); }
  }

  if (chat.loading && !d) return <Spinner />;
  const blocked = lead.doNotContact?.whatsapp;
  return (
    <div className="flex flex-col" style={{ minHeight: 320 }}>
      <div className="flex-1 space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: "48vh" }}>
        {!(d?.messages || []).length ? <EmptyState icon="whatsapp" text="No WhatsApp messages yet." /> : d.messages.map((m, i) => (
          <div key={i} className={"flex " + (m.from === "me" ? "justify-end" : "justify-start")}>
            <div className="rounded-lg px-2.5 py-1.5 text-sm" style={{ maxWidth: "82%", background: m.from === "me" ? "color-mix(in srgb, var(--primary) 14%, transparent)" : "var(--muted-background)" }}>
              <div className="text-foreground whitespace-pre-wrap break-words">{m.text || (m.template ? `Template: ${m.template}` : `(${m.type})`)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 text-right" title={formatDateTime(m.at)}>{m.from === "me" && m.agent ? `${m.agent} · ` : ""}{timeAgo(m.at)}</div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {canSend && (blocked ? (
        <div className="text-xs mt-2" style={{ color: "var(--warning)" }}>This lead asked not to be contacted on WhatsApp.</div>
      ) : (
        <>
          {d && !d.windowOpen && <div className="text-[11px] text-muted-foreground mt-2">Outside the 24-hour window — WhatsApp only delivers approved templates. Use Message to send one.</div>}
          <div className="flex gap-2 mt-2">
            <input className="ui-input flex-1" placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button type="button" className="ui-btn ui-btn-primary" disabled={sending || !text.trim()} onClick={send}><i className="bi bi-send"></i></button>
          </div>
        </>
      ))}
    </div>
  );
}

/* ───────────── pages the lead viewed on the website, and emails they opened ───────────── */
export function WebActivity({ leadId }) {
  const web = useApi(() => crmApi.webActivity(leadId), [leadId]);
  const d = web.data;
  if (!d || (!d.visits.length && !d.emails.length)) return null;
  return (
    <div className="border-t pt-3 space-y-3">
      {!!d.emails.length && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Emails sent</div>
          {d.emails.slice(0, 8).map((e) => (
            <div key={e._id} className="flex items-center justify-between gap-2 text-xs py-1">
              <span className="text-foreground truncate">{e.subject || "(no subject)"}</span>
              <span className="flex gap-1 flex-shrink-0">
                <Chip color={e.opens ? "var(--success)" : "var(--muted-foreground)"}>{e.opens ? `Opened ${e.opens}×` : "Not opened"}</Chip>
                {e.clicks > 0 && <Chip color="var(--info)">{e.clicks} click{e.clicks === 1 ? "" : "s"}</Chip>}
              </span>
            </div>
          ))}
        </div>
      )}
      {!!d.visits.length && (
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Website pages viewed · {d.visits.length}</div>
          {d.visits.slice(0, 12).map((v) => (
            <div key={v._id} className="flex items-center justify-between gap-2 text-xs py-1">
              <a className="text-foreground truncate" href={v.url} target="_blank" rel="noreferrer">{v.title || v.url}</a>
              <span className="text-muted-foreground flex-shrink-0">{timeAgo(v.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
