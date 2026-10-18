import { useState } from "react";
import { useParams } from "react-router-dom";
import { prerequisitesApi, templatesApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Spinner, ErrorBox, Modal, Chip, Confirm } from "../components/ui";
import { formatDateTime } from "../utils/dateFormat";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

/** The client's form: /prerequisites/:token (no login). The form itself is a standalone page. */
export function PublicPrerequisitePage() {
  const { token } = useParams();
  const src = `/prerequisite-form.html?t=${encodeURIComponent(token || "")}${API_BASE ? `&api=${encodeURIComponent(API_BASE)}` : ""}`;
  return <iframe title="Admission Pre-Requisite" src={src} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }} />;
}

const STATE_COLOR = { "Not started": "var(--muted-foreground)", Opened: "var(--info, #2563eb)", "In progress": "var(--warning, #b45309)", Submitted: "var(--success)" };

const DEFAULT_SUBJECT = "{{institute}} — admission set-up details";
const DEFAULT_BODY = `Dear {{name}},

To set up your admission CRM, please fill in the pre-requisite details using the link below. You can save and come back any time; once everything is complete, press Final Submit.

{{link}}

Regards,
Implementation Team`;

/** Setup › Implementation › Pre-requisites */
export function Prerequisites() {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("setup", "edit");
  const rec = useApi(() => prerequisitesApi.get({ origin: ORIGIN }), []);
  const [clientUrl, setClientUrl] = useState(null);
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(null); // "regenerate" | "reopen"
  const [busy, setBusy] = useState(false);
  const d = rec.data;
  const urlValue = clientUrl ?? d?.clientUrl ?? "";

  async function run(fn, msg) {
    setBusy(true);
    try { await fn(); toast(msg); setConfirm(null); rec.reload(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  const saveUrl = () => run(async () => { await prerequisitesApi.update({ clientUrl: urlValue, origin: ORIGIN }); setClientUrl(null); }, "Client URL saved");
  const copy = async () => { try { await navigator.clipboard.writeText(d.link); toast("Link copied"); } catch { toast("Copy failed", "error"); } };
  const viewAnswers = () => window.open(`/prerequisite-form.html?view=1${API_BASE ? `&api=${encodeURIComponent(API_BASE)}` : ""}`, "_blank", "noopener");

  if (rec.loading && !d) return <Spinner />;
  if (!d) return <ErrorBox error={rec.error} />;
  const pct = Math.round((d.progress.done / d.progress.total) * 100);
  const sends = [...(d.sends || [])].reverse();

  return (
    <div className="d-flex flex-column gap-3">
      <ErrorBox error={rec.error} />

      <div className="card" style={{ borderRadius: "var(--radius)" }}>
        <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-semibold" style={{ fontSize: 14 }}>Pre-requisites</span>
            <Chip color={STATE_COLOR[d.state]}>{d.state}</Chip>
          </div>
          <div className="d-flex flex-wrap gap-2">
            <button className="ui-btn ui-btn-outline ui-btn-sm" onClick={viewAnswers} disabled={!d.hasData}><i className="bi bi-eye"></i>View answers</button>
            {canEdit && d.status === "submitted" && <button className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setConfirm("reopen")}><i className="bi bi-unlock"></i>Reopen</button>}
            {canEdit && <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setSending(true)}><i className="bi bi-envelope"></i>Email link</button>}
          </div>
        </div>
        <div className="card-body d-flex flex-column gap-3">
          <div className="row g-3">
            <div className="col-md-5">
              <label className="form-label">Client URL</label>
              <div className="d-flex gap-2">
                <input className="ui-input flex-grow-1" aria-label="Client URL" value={urlValue} disabled={!canEdit} onChange={(e) => setClientUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveUrl()} />
                {canEdit && clientUrl !== null && clientUrl !== (d.clientUrl || "") && <button className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy} onClick={saveUrl}>Save</button>}
              </div>
              <div className="small text-muted mt-1">e.g. https://dps.knowvato.in — the link uses this address</div>
            </div>
            <div className="col-md-7">
              <label className="form-label">Form link</label>
              <div className="d-flex gap-2">
                <input className="ui-input flex-grow-1 font-monospace" style={{ fontSize: 12 }} readOnly value={d.link} onFocus={(e) => e.target.select()} aria-label="Form link" />
                <button className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Copy" onClick={copy}><i className="bi bi-clipboard"></i></button>
                <a className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Open" href={d.link} target="_blank" rel="noreferrer"><i className="bi bi-box-arrow-up-right"></i></a>
                {canEdit && <button className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="New link (old link stops working)" onClick={() => setConfirm("regenerate")}><i className="bi bi-arrow-repeat"></i></button>}
              </div>
            </div>
          </div>

          <div>
            <div className="d-flex justify-content-between small mb-1">
              <span className="fw-semibold">{d.progress.done} of {d.progress.total} sections received</span>
              <span className="text-muted">{pct}%</span>
            </div>
            <div className="progress" style={{ height: 8 }}>
              <div className="progress-bar" style={{ width: `${pct}%`, background: d.status === "submitted" ? "var(--success)" : "var(--primary)" }} />
            </div>
          </div>

          <div className="d-flex flex-wrap gap-4 small">
            <Meta label="Opened" value={d.firstOpenedAt ? formatDateTime(d.firstOpenedAt) : "—"} />
            <Meta label="Last saved" value={d.lastSavedAt ? formatDateTime(d.lastSavedAt) : "—"} />
            <Meta label="Submitted" value={d.submittedAt ? `${formatDateTime(d.submittedAt)}${d.submittedBy?.name ? ` · ${d.submittedBy.name}` : ""}` : "—"} />
            {d.reopenedAt && <Meta label="Reopened" value={formatDateTime(d.reopenedAt)} />}
          </div>
        </div>
      </div>

      <div className="card" style={{ borderRadius: "var(--radius)" }}>
        <div className="card-header bg-white fw-semibold" style={{ fontSize: 14 }}>Sections</div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table mb-0 align-middle" style={{ fontSize: 12.5 }}>
              <thead><tr className="table-light">
                <th style={{ width: 50 }}>#</th><th>Section</th><th>Status</th><th>Received</th><th style={{ whiteSpace: "nowrap" }}>Saved on</th>
              </tr></thead>
              <tbody>
                {d.sections.map((s, i) => (
                  <tr key={s.key}>
                    <td>{i + 1}</td>
                    <td className="fw-semibold">{s.label}</td>
                    <td>{!s.required ? <Chip color="var(--muted-foreground)">{d.status === "submitted" ? "Submitted" : "Summary"}</Chip> : s.savedAt ? <Chip color="var(--success)" icon="check2">Received</Chip> : <Chip color="var(--warning, #b45309)" icon="hourglass-split">Pending</Chip>}</td>
                    <td className="text-muted">{s.summary || "—"}</td>
                    <td className="text-muted" style={{ whiteSpace: "nowrap" }}>{s.savedAt ? formatDateTime(s.savedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {sends.length > 0 && (
        <div className="card" style={{ borderRadius: "var(--radius)" }}>
          <div className="card-header bg-white fw-semibold" style={{ fontSize: 14 }}>Emails sent</div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table mb-0 align-middle" style={{ fontSize: 12.5 }}>
                <thead><tr className="table-light"><th>To</th><th>Subject</th><th>By</th><th>Sent</th></tr></thead>
                <tbody>
                  {sends.slice(0, 20).map((s, i) => (
                    <tr key={i}>
                      <td>{s.to}{s.simulated && <span className="ms-1"><Chip color="var(--muted-foreground)">Test mode</Chip></span>}</td>
                      <td className="text-muted">{s.subject}</td>
                      <td>{s.by || "—"}</td>
                      <td className="text-muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(s.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {sending && <SendLink institute={d.institute} onClose={() => setSending(false)} onSent={() => { setSending(false); rec.reload(); }} />}
      {confirm === "regenerate" && (
        <Confirm danger title="Create a new link?" text="The current link will stop working. Answers are kept." confirmLabel="New link" busy={busy}
          onCancel={() => setConfirm(null)} onConfirm={() => run(() => prerequisitesApi.regenerate({ origin: ORIGIN }), "New link created")} />
      )}
      {confirm === "reopen" && (
        <Confirm title="Reopen the form?" text="The client will be able to change the details and submit again." confirmLabel="Reopen" busy={busy}
          onCancel={() => setConfirm(null)} onConfirm={() => run(() => prerequisitesApi.reopen({ origin: ORIGIN }), "Form reopened")} />
      )}
    </div>
  );
}

function Meta({ label, value }) {
  return <div><div className="text-muted" style={{ fontSize: 11 }}>{label}</div><div className="fw-medium">{value}</div></div>;
}

function SendLink({ institute, onClose, onSent }) {
  const toast = useToast();
  const templates = useApi(() => templatesApi.list({ perPage: 200 }).catch(() => ({ data: [] })), []);
  const emailTemplates = (templates.data || []).filter((t) => t.channel === "email");
  const [f, setF] = useState({ to: "", name: "", template: "", subject: DEFAULT_SUBJECT, body: DEFAULT_BODY });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErr((x) => ({ ...x, [k]: "" })); };

  function pickTemplate(id) {
    const t = emailTemplates.find((x) => x._id === id);
    setF((x) => ({ ...x, template: id, subject: t ? t.subject || t.name || x.subject : DEFAULT_SUBJECT, body: t ? t.body || "" : DEFAULT_BODY }));
  }
  async function send() {
    const e = {};
    if (!f.to.trim()) e.to = "Required";
    if (!f.subject.trim()) e.subject = "Required";
    if (!f.body.trim()) e.body = "Required";
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res = await prerequisitesApi.send({ to: f.to, name: f.name, subject: f.subject, body: f.body, origin: ORIGIN });
      const out = res?.data || res;
      toast(out?.simulated ? "Email logged (test mode — SMTP not set up)" : `Email sent to ${out?.sent || 1} recipient${out?.sent === 1 ? "" : "s"}`);
      onSent();
    } catch (x) { toast(x.message, "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      title="Email form link"
      onClose={onClose}
      footer={<>
        <button className="ui-btn ui-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="ui-btn ui-btn-primary" onClick={send} disabled={busy}><i className="bi bi-send"></i>{busy ? "Sending…" : "Send"}</button>
      </>}
    >
      <div className="d-flex flex-column gap-3">
        <div className="row g-2">
          <div className="col-sm-7">
            <label className="form-label">To *</label>
            <input className="ui-input w-100" type="email" multiple value={f.to} onChange={set("to")} autoFocus />
            {err.to ? <div className="small text-danger mt-1">{err.to}</div> : <div className="small text-muted mt-1">Separate several with commas</div>}
          </div>
          <div className="col-sm-5">
            <label className="form-label">Contact name</label>
            <input className="ui-input w-100" value={f.name} onChange={set("name")} />
          </div>
        </div>
        <div>
          <label className="form-label">Email template</label>
          <select className="ui-input w-100" value={f.template} onChange={(e) => pickTemplate(e.target.value)}>
            <option value="">Default message</option>
            {emailTemplates.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Subject *</label>
          <input className="ui-input w-100" value={f.subject} onChange={set("subject")} />
          {err.subject && <div className="small text-danger mt-1">{err.subject}</div>}
        </div>
        <div>
          <label className="form-label">Message *</label>
          <textarea className="ui-input w-100" rows={10} style={{ height: "auto", padding: "8px 12px" }} value={f.body} onChange={set("body")} />
          {err.body ? <div className="small text-danger mt-1">{err.body}</div> : (
            <div className="small text-muted mt-1">
              <code>{"{{link}}"}</code> form link · <code>{"{{name}}"}</code> contact · <code>{"{{institute}}"}</code> {institute || "institute"} — the link is added at the end if missing
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
