import { useEffect, useMemo, useState } from "react";
import { http, messagesApi, templatesApi } from "../../api";
import { UIButton } from "./UIKit";

/**
 * Compose and send a WhatsApp or email message to a list of people. WhatsApp
 * goes through the organisation's connected WhatsApp account, email through
 * its mail server — both via /messages/send, which also keeps the history.
 */
export type Recipient = { id: string; name: string; phone?: string; email?: string; eventId?: string; eventName?: string };
export type Channel = "whatsapp" | "email";
type WaTpl = { _id: string; name: string; body?: string; status?: string; language?: string };
type MailTpl = { _id: string; name: string; subject?: string; body?: string; active?: boolean };

const LABEL = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
const digits = (s?: string) => String(s || "").replace(/\D/g, "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const paramCount = (body = "") => new Set((body.match(/\{\{\s*\d+\s*\}\}/g) || []).map((m) => m.replace(/\D/g, ""))).size;
// {{name}} and {{event}} in typed text are replaced per person
const fill = (text: string, r: Recipient) => text.replace(/\{\{\s*name\s*\}\}/gi, r.name || "").replace(/\{\{\s*event\s*\}\}/gi, r.eventName || "");
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// plain text keeps its line breaks in the email; a body written as HTML is sent as it is
const toHtml = (s: string) => (/<[a-z][\s\S]*>/i.test(s) ? s : escapeHtml(s).replace(/\n/g, "<br>"));

export default function MessageComposer({
  channel,
  recipients,
  onNotify,
  onClose,
  onBusy,
  wide,
}: {
  channel: Channel;
  recipients: Recipient[];
  onNotify: (msg: string, type?: string) => void;
  /** Shown as Cancel / Close when the composer sits in a drawer. */
  onClose?: () => void;
  onBusy?: (busy: boolean) => void;
  /** On a full-width page, short fields sit side by side. */
  wide?: boolean;
}) {
  const isWa = channel === "whatsapp";
  const PAIR = wide ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "space-y-3";
  // one message per mobile number / email, even if the person is in several events
  const targets = useMemo(() => {
    const seen = new Set<string>();
    return recipients.filter((r) => {
      const key = isWa ? digits(r.phone) : String(r.email || "").trim().toLowerCase();
      if (isWa ? key.length < 7 : !EMAIL.test(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [recipients, isWa]);
  const skipped = recipients.length - targets.length;

  const [waTemplates, setWaTemplates] = useState<WaTpl[]>([]);
  const [mailTemplates, setMailTemplates] = useState<MailTpl[]>([]);
  const [mode, setMode] = useState<"template" | "text">(isWa ? "template" : "text");
  const [template, setTemplate] = useState("");
  const [params, setParams] = useState<string[]>([]);
  const [mailTemplate, setMailTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ sent: number; failed: number; simulated: boolean; firstError: string } | null>(null);

  useEffect(() => {
    if (isWa)
      templatesApi
        .list({ perPage: 200 })
        .then((res: any) => setWaTemplates((res?.data ?? []).filter((t: WaTpl) => !t.status || String(t.status).toUpperCase() === "APPROVED")))
        .catch(() => setWaTemplates([]));
    else
      http
        .get("/module-templates?module=events&channel=email&perPage=200")
        .then((res: any) => setMailTemplates((res?.data ?? []).filter((t: MailTpl) => t.active !== false)))
        .catch(() => setMailTemplates([]));
  }, [isWa]);

  const tpl = waTemplates.find((t) => t.name === template);
  const needed = paramCount(tpl?.body);
  useEffect(() => {
    setParams((p) => Array.from({ length: needed }, (_, i) => p[i] ?? (i === 0 ? "{{name}}" : "")));
  }, [needed]);

  const pickMailTemplate = (id: string) => {
    setMailTemplate(id);
    const t = mailTemplates.find((x) => x._id === id);
    if (t) {
      setSubject(t.subject || "");
      setText(t.body || "");
    }
  };

  const ready = targets.length > 0 && (mode === "template" ? !!template && params.every((p) => p.trim()) : !!text.trim() && (isWa || !!subject.trim()));

  const send = async () => {
    if (!ready) return;
    if (!window.confirm(`Send this ${isWa ? "WhatsApp message" : "email"} to ${targets.length} ${targets.length === 1 ? "person" : "people"}?`)) return;
    setSending(true);
    onBusy?.(true);
    setProgress(0);
    let sent = 0, failed = 0, simulated = false, firstError = "";
    const mailTplName = mailTemplates.find((t) => t._id === mailTemplate)?.name;
    for (let i = 0; i < targets.length; i++) {
      const r = targets[i];
      try {
        const meta: any = { source: "events", eventId: r.eventId, eventName: r.eventName, contactName: r.name };
        const payload: any = isWa ? { channel, to: digits(r.phone), meta } : { channel, to: String(r.email).trim(), subject: fill(subject, r), meta };
        if (mode === "template") {
          payload.template = template;
          payload.languageCode = tpl?.language || "en";
          payload.params = params.map((p) => fill(p, r));
          meta.preview = (tpl?.body || "").replace(/\{\{\s*(\d+)\s*\}\}/g, (_m, n) => payload.params[Number(n) - 1] ?? "");
        } else {
          payload.text = isWa ? fill(text, r) : toHtml(fill(text, r));
          if (!isWa && mailTplName) meta.templateName = mailTplName;
        }
        const res: any = await messagesApi.send(payload);
        if (res?.data?.simulated) simulated = true;
        sent++;
      } catch (e: any) {
        failed++;
        if (!firstError) firstError = e?.message || "Send failed";
      }
      setProgress(i + 1);
    }
    setSending(false);
    onBusy?.(false);
    setResult({ sent, failed, simulated, firstError });
    if (!failed && !simulated) onNotify(`${isWa ? "WhatsApp message" : "Email"} sent to ${sent} ${sent === 1 ? "person" : "people"}`);
  };

  if (result)
    return (
      <div className="flex-1 p-4 space-y-3">
        <div className="text-sm text-foreground">
          Sent: <strong>{result.sent}</strong> · Failed: <strong>{result.failed}</strong>
        </div>
        {result.simulated && (
          <div className="rounded-lg border px-3 py-2 text-xs" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
            {isWa
              ? "WhatsApp is in simulation mode — these messages were recorded but not delivered."
              : "No mail server (SMTP) is set up — these emails were recorded but not delivered."}
          </div>
        )}
        {result.firstError && <div className="text-xs" style={{ color: "var(--destructive)" }}>{result.firstError}</div>}
        <div className="flex justify-end gap-2">
          <UIButton variant="outline" onClick={() => setResult(null)}>Send another</UIButton>
          {onClose && <UIButton onClick={onClose}>Close</UIButton>}
        </div>
      </div>
    );

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="rounded-lg border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-x-4 gap-y-1" style={{ background: "var(--muted-background)" }}>
          <span>
            <strong className="text-foreground">{targets.length}</strong> {targets.length === 1 ? "recipient" : "recipients"}
            {skipped > 0 && <span className="text-muted-foreground"> · {skipped} skipped (no {isWa ? "mobile number" : "email"} or repeated)</span>}
          </span>
          <span className="text-muted-foreground">{"{{name}}"} and {"{{event}}"} are replaced for each person.</span>
        </div>

        {isWa && (
          <div className="inline-flex rounded-md border overflow-hidden">
            {(["template", "text"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="h-7 px-3 text-xs font-medium"
                style={mode === m ? { background: "var(--primary)", color: "var(--primary-foreground)", border: 0 } : { background: "var(--card)", color: "var(--muted-foreground)", border: 0 }}
              >
                {m === "template" ? "Approved template" : "Free text"}
              </button>
            ))}
          </div>
        )}

        {mode === "template" ? (
          <div className={PAIR}>
            <div>
              <label className={LABEL}>Template *</label>
              <select className="ui-input w-full" value={template} onChange={(e) => setTemplate(e.target.value)}>
                <option value="">— select —</option>
                {waTemplates.map((t) => (
                  <option key={t._id} value={t.name}>{t.name}</option>
                ))}
              </select>
              {waTemplates.length === 0 && <p className="text-[11px] text-muted-foreground mt-1">No approved WhatsApp templates found.</p>}
            </div>
            {tpl?.body && (
              <div>
                <label className={LABEL}>Preview</label>
                <div className="rounded-lg border px-3 py-2 text-xs text-muted-foreground" style={{ whiteSpace: "pre-wrap" }}>{tpl.body}</div>
              </div>
            )}
            {params.map((p, i) => (
              <div key={i}>
                <label className={LABEL}>Value for {`{{${i + 1}}}`} *</label>
                <input className="ui-input w-full" value={p} onChange={(e) => setParams(params.map((x, idx) => (idx === i ? e.target.value : x)))} />
              </div>
            ))}
          </div>
        ) : (
          <>
            {!isWa && (
              <div className={PAIR}>
                <div>
                  <label className={LABEL}>Template</label>
                  <select className="ui-input w-full" value={mailTemplate} onChange={(e) => pickMailTemplate(e.target.value)}>
                    <option value="">— select —</option>
                    {mailTemplates.map((t) => (
                      <option key={t._id} value={t._id}>{t.name}</option>
                    ))}
                  </select>
                  {mailTemplates.length === 0 && <p className="text-[11px] text-muted-foreground mt-1">No email templates yet — add them in Setup → Email Template.</p>}
                </div>
                <div>
                  <label className={LABEL}>Subject *</label>
                  <input className="ui-input w-full" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
                </div>
              </div>
            )}
            <div>
              <label className={LABEL}>Message *</label>
              <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={isWa ? 5 : 9} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            {isWa && (
              <p className="text-[11px]" style={{ color: "var(--warning)" }}>
                WhatsApp delivers free text only to people who messaged you in the last 24 hours. Use a template for everyone else.
              </p>
            )}
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
        <span className="text-xs text-muted-foreground">{sending ? `Sending ${progress} of ${targets.length}…` : ""}</span>
        <div className="flex items-center gap-2">
          {onClose && <UIButton variant="outline" onClick={onClose} disabled={sending}>Cancel</UIButton>}
          <UIButton onClick={send} loading={sending} disabled={!ready}>Send to {targets.length}</UIButton>
        </div>
      </div>
    </>
  );
}
