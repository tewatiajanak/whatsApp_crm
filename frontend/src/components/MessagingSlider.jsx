import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { useToast } from "../context/ToastContext";
import { templatesApi, messagesApi } from "../api";
import { Modal, Spinner, EmptyState, Chip } from "./ui";
import { formatDateTime } from "../utils/dateFormat";
import { labelCls } from "./lead/leadUtils";

const CHANNELS = [["whatsapp", "whatsapp", "WhatsApp"], ["sms", "chat-left-text", "SMS"], ["email", "envelope", "Email"]];

// Send a WhatsApp message, an SMS or an email to one lead and see what was sent before.
export default function MessagingSlider({ lead, canSms, onClose }) {
  const toast = useToast();
  const templates = useApi(() => templatesApi.list({ status: "Approved" }), []);
  const history = useApi(() => messagesApi.list({ phone: lead.phone, perPage: 20 }), [lead.phone]);
  const [channel, setChannel] = useState("whatsapp");
  const [template, setTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const options = (templates.data || []).filter((t) => (t.channel || "whatsapp") === channel);
  const picked = options.find((t) => t.name === template);
  const body = template ? picked?.body || "" : text;
  const to = channel === "email" ? lead.email : lead.phone;

  async function send() {
    setSending(true);
    try {
      await messagesApi.send({ channel, to, template: template || undefined, text: template ? undefined : text, subject: channel === "email" ? subject || undefined : undefined });
      toast("Message sent");
      setTemplate("");
      setText("");
      history.reload();
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      title={<div><div>Send message</div><div className="text-xs font-normal text-muted-foreground">{lead.name} · {to || `no ${channel === "email" ? "email" : "phone"}`}</div></div>}
      onClose={onClose}
      footer={<>
        <button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Close</button>
        <button type="button" className="ui-btn ui-btn-primary" disabled={sending || !to || !body.trim()} onClick={send}><i className="bi bi-send"></i>{sending ? "Sending…" : "Send"}</button>
      </>}
    >
      <div className="space-y-3">
        <div className="flex gap-1.5">
          {CHANNELS.filter(([v]) => v !== "sms" || canSms).map(([v, icon, label]) => (
            <button key={v} type="button" className={"ui-btn ui-btn-sm flex-1 " + (channel === v ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => { setChannel(v); setTemplate(""); }}>
              <i className={`bi bi-${icon}`}></i>{label}
            </button>
          ))}
        </div>
        <div>
          <label className={labelCls}>Template</label>
          <select className="ui-input w-full" value={template} onChange={(e) => setTemplate(e.target.value)}>
            <option value="">Custom message</option>
            {options.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        {channel === "email" && (
          <div><label className={labelCls}>Subject</label><input className="ui-input w-full" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        )}
        <div>
          <label className={labelCls}>Message</label>
          {template ? (
            <div className="rounded-lg border p-3 text-sm whitespace-pre-wrap" style={{ background: "var(--muted-background)", minHeight: 96 }}>{body}</div>
          ) : (
            <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={5} value={text} onChange={(e) => setText(e.target.value)} />
          )}
        </div>

        <div className="border-t pt-3">
          <div className={labelCls}>Sent before</div>
          {history.loading ? <Spinner /> : !(history.data || []).length ? <EmptyState icon="chat-dots" text="Nothing sent yet." /> : (
            <ul className="list-none m-0 p-0 space-y-2">
              {history.data.map((m) => (
                <li key={m._id} className="rounded-lg border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground truncate">{m.template || m.channel || "Message"}</span>
                    <Chip color={m.status === "failed" ? "var(--destructive)" : "var(--success)"}>{m.status || "sent"}</Chip>
                  </div>
                  {(m.body || m.text) && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.body || m.text}</div>}
                  <div className="text-[11px] text-muted-foreground mt-1">{formatDateTime(m.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
