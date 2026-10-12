import { useEffect, useState } from "react";
import { crmApi, leadsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Tabs, Panel, Chip, Confirm } from "../components/ui";
import { formatDateTime } from "../utils/dateFormat";
import { labelCls } from "../components/lead/leadUtils";

const TABS = [
  { value: "alerts", label: "Reminders & alerts" }, { value: "telephony", label: "Telephony" }, { value: "sms", label: "SMS" },
  { value: "reports", label: "Scheduled report" }, { value: "capture", label: "Lead capture" }, { value: "fields", label: "Custom fields" }, { value: "stages", label: "Application stages" },
  { value: "assignment", label: "Assignment & rules" }, { value: "billing", label: "Billing & GST" }, { value: "masters", label: "Courses & branches" },
  { value: "mail", label: "Mailbox & calendar" },
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hourLabel = (h) => `${String(h).padStart(2, "0")}:00`;
const Hours = ({ value, onChange }) => <select className="ui-input w-full" value={value} onChange={(e) => onChange(Number(e.target.value))}>{[...Array(24)].map((_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</select>;
const Check = ({ checked, onChange, children }) => <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />{children}</label>;
const Row = ({ label, children, hint }) => <div><label className={labelCls}>{label}</label>{children}{hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}</div>;

export default function CrmSettings() {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("setup", "edit");
  const [tab, setTab] = useState("alerts");
  const saved = useApi(() => crmApi.settings(), []);
  const meta = useApi(() => leadsApi.meta(), []);
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (saved.data) setS(saved.data); }, [saved.data]);

  const set = (section, key, value) => setS((x) => ({ ...x, [section]: { ...x[section], [key]: value } }));
  async function save(sections) {
    setSaving(true);
    try {
      const res = await crmApi.saveSettings(Object.fromEntries(sections.map((k) => [k, s[k]])));
      setS(res.data);
      toast("Settings saved");
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }
  const SaveBtn = ({ sections }) => canEdit && <div className="flex justify-end"><button type="button" className="ui-btn ui-btn-primary" disabled={saving} onClick={() => save(sections)}>{saving ? "Saving…" : "Save"}</button></div>;
  const input = (section, key, props = {}) => <input className="ui-input w-full" disabled={!canEdit} value={s[section][key] ?? ""} onChange={(e) => set(section, key, e.target.value)} {...props} />;

  return (
    <div>
      <PageHeader title="CRM settings" />
      <Tabs value={tab} onChange={setTab} tabs={TABS} />
      <ErrorBox error={saved.error} />
      {!s ? <Spinner /> : (
        <div className="max-w-3xl space-y-3">
          {tab === "alerts" && <>
            <Panel title="Follow-up reminders" bodyClass="p-3 space-y-3">
              <Check checked={s.reminders.enabled} onChange={(v) => set("reminders", "enabled", v)}>Remind the owner when a follow-up is due</Check>
              <div className="grid grid-cols-2 gap-3">
                <Row label="Minutes before it is due"><input className="ui-input w-full" type="number" min="0" max="1440" disabled={!canEdit} value={s.reminders.minutesBefore} onChange={(e) => set("reminders", "minutesBefore", e.target.value)} /></Row>
                <Row label="Morning summary at"><Hours value={s.reminders.digestHour} onChange={(v) => set("reminders", "digestHour", v)} /></Row>
              </div>
              <Check checked={s.reminders.morningDigest} onChange={(v) => set("reminders", "morningDigest", v)}>Send each person a morning count of today's and overdue follow-ups</Check>
            </Panel>
            <Panel title="First response time" bodyClass="p-3 space-y-3">
              <Check checked={s.sla.enabled} onChange={(v) => set("sla", "enabled", v)}>Alert when a new lead is not contacted in time</Check>
              <div className="grid grid-cols-2 gap-3">
                <Row label="Contact within (minutes)"><input className="ui-input w-full" type="number" min="1" disabled={!canEdit} value={s.sla.firstResponseMins} onChange={(e) => set("sla", "firstResponseMins", e.target.value)} /></Row>
                <Row label="Also alert">
                  <select className="ui-input w-full" value="" disabled={!canEdit} onChange={(e) => e.target.value && set("sla", "alsoNotify", [...new Set([...s.sla.alsoNotify, e.target.value])])}>
                    <option value="">Add a person…</option>{(meta.data?.owners || []).filter((o) => !s.sla.alsoNotify.includes(o)).map((o) => <option key={o}>{o}</option>)}
                  </select>
                </Row>
              </div>
              {!!s.sla.alsoNotify.length && <div className="flex flex-wrap gap-1.5">{s.sla.alsoNotify.map((n) => <button key={n} type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => set("sla", "alsoNotify", s.sla.alsoNotify.filter((x) => x !== n))}>{n}<i className="bi bi-x"></i></button>)}</div>}
              <Check checked={s.sla.notifyManager} onChange={(v) => set("sla", "notifyManager", v)}>Alert the owner's reporting manager too</Check>
            </Panel>
            <SaveBtn sections={["reminders", "sla"]} />
          </>}

          {tab === "telephony" && <>
            <Panel title="Click-to-call" actions={<Chip color={s.telephonyReady ? "var(--success)" : "var(--muted-foreground)"}>{s.telephonyReady ? "Ready" : "Not set up"}</Chip>} bodyClass="p-3 space-y-3">
              <Row label="Provider">
                <select className="ui-input w-full" disabled={!canEdit} value={s.telephony.provider} onChange={(e) => set("telephony", "provider", e.target.value)}>
                  <option value="none">None — open the phone's dialler</option><option value="exotel">Exotel</option><option value="custom">Other provider (HTTPS API)</option>
                </select>
              </Row>
              {s.telephony.provider === "exotel" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Row label="Account SID">{input("telephony", "sid")}</Row>
                <Row label="API key">{input("telephony", "apiKey")}</Row>
                <Row label="API token">{input("telephony", "apiToken", { type: "password", autoComplete: "new-password" })}</Row>
                <Row label="API host">{input("telephony", "subdomain", { placeholder: "api.exotel.com" })}</Row>
                <Row label="Caller ID (your ExoPhone)">{input("telephony", "callerId")}</Row>
              </div>}
              {s.telephony.provider === "custom" && <div className="space-y-3">
                <Row label="Call URL" hint='Receives a POST with { from, to, callerId, callbackUrl, reference }.'>{input("telephony", "customUrl", { placeholder: "https://" })}</Row>
                <Row label="Caller ID">{input("telephony", "callerId")}</Row>
                <Row label="Extra headers (JSON)">{input("telephony", "customHeaders", { placeholder: '{"Authorization": "Bearer …"}' })}</Row>
              </div>}
              {s.telephony.provider !== "none" && <Row label="Call result URL" hint="The provider reports each call here, so it is logged on the lead with its recording."><CopyBox value={s.telephonyCallbackUrl} /></Row>}
              <Row label="Incoming call URL" hint="Point your number's incoming-call (or missed-call) hook here. The caller is logged on their lead, unknown callers become leads, and the reply is the owner's number to ring."><CopyBox value={s.incomingCallUrl} /></Row>
            </Panel>
            <Panel title="IVR menu" actions={<Chip color={s.ivr.enabled ? "var(--success)" : "var(--muted-foreground)"}>{s.ivr.enabled ? "On" : "Off"}</Chip>} bodyClass="p-3 space-y-3">
              <Check checked={s.ivr.enabled} onChange={(v) => set("ivr", "enabled", v)}>Answer incoming calls with a menu</Check>
              <Row label="What the caller hears"><input className="ui-input w-full" disabled={!canEdit} value={s.ivr.greeting} onChange={(e) => set("ivr", "greeting", e.target.value)} /></Row>
              {s.ivr.options.map((o, i) => (
                <div key={i} className="grid grid-cols-[56px_1fr_1fr_32px] gap-2">
                  <input className="ui-input w-full text-center" maxLength={1} placeholder="Key" value={o.digit} onChange={(e) => set("ivr", "options", s.ivr.options.map((x, j) => (j === i ? { ...x, digit: e.target.value } : x)))} />
                  <input className="ui-input w-full" placeholder="What it is for" value={o.label} onChange={(e) => set("ivr", "options", s.ivr.options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <select className="ui-input w-full" value={o.target.startsWith("user:") || o.target === "owner" ? o.target : o.target ? "number" : ""} onChange={(e) => set("ivr", "options", s.ivr.options.map((x, j) => (j === i ? { ...x, target: e.target.value === "number" ? "+91" : e.target.value } : x)))}>
                    <option value="">Ring…</option><option value="owner">The caller's own counsellor</option>
                    {(meta.data?.owners || []).map((n) => <option key={n} value={`user:${n}`}>{n}</option>)}
                    <option value="number">A phone number</option>
                  </select>
                  <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Remove" onClick={() => set("ivr", "options", s.ivr.options.filter((_, j) => j !== i))}><i className="bi bi-x-lg"></i></button>
                  {o.target && o.target !== "owner" && !o.target.startsWith("user:") && <input className="ui-input w-full col-span-4" type="tel" placeholder="Phone number to ring" value={o.target} onChange={(e) => set("ivr", "options", s.ivr.options.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))} />}
                </div>
              ))}
              {canEdit && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => set("ivr", "options", [...s.ivr.options, { digit: String(s.ivr.options.length + 1), label: "", target: "" }])}><i className="bi bi-plus-lg"></i>Add a key</button>}
              <Row label="IVR URL" hint="Twilio / Plivo style providers: use this address with &format=xml as the voice URL. Exotel: in your flow, read the key with Gather, then let Connect fetch the number from this address with digits added."><CopyBox value={s.ivrUrl} /></Row>
            </Panel>
            <SaveBtn sections={["telephony", "ivr"]} />
          </>}

          {tab === "sms" && <SmsTab s={s} set={set} input={input} canEdit={canEdit} SaveBtn={SaveBtn} />}

          {tab === "reports" && <>
            <Panel title="Lead summary by email" bodyClass="p-3 space-y-3">
              <Check checked={s.reports.enabled} onChange={(v) => set("reports", "enabled", v)}>Send the summary automatically</Check>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Row label="How often"><select className="ui-input w-full" disabled={!canEdit} value={s.reports.frequency} onChange={(e) => set("reports", "frequency", e.target.value)}><option value="daily">Every day</option><option value="weekly">Every week</option></select></Row>
                {s.reports.frequency === "weekly" && <Row label="On"><select className="ui-input w-full" disabled={!canEdit} value={s.reports.weekday} onChange={(e) => set("reports", "weekday", Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></Row>}
                <Row label="At"><Hours value={s.reports.hour} onChange={(v) => set("reports", "hour", v)} /></Row>
              </div>
              <Row label="Send to" hint="Email addresses, separated by commas.">
                <input className="ui-input w-full" disabled={!canEdit} value={Array.isArray(s.reports.recipients) ? s.reports.recipients.join(", ") : s.reports.recipients} onChange={(e) => set("reports", "recipients", e.target.value)} />
              </Row>
            </Panel>
            {canEdit && <div className="flex justify-end gap-2">
              <button type="button" className="ui-btn ui-btn-outline" disabled={saving} onClick={async () => { try { const r = await crmApi.sendReport(); toast(`Sent to ${r.data.sent} recipient${r.data.sent === 1 ? "" : "s"}`); } catch (e) { toast(e.message, "error"); } }}>Send now</button>
              <button type="button" className="ui-btn ui-btn-primary" disabled={saving} onClick={() => save(["reports"])}>{saving ? "Saving…" : "Save"}</button>
            </div>}
          </>}

          {tab === "capture" && <>
            <CaptureTab meta={meta.data || {}} canEdit={canEdit} />
            <Panel title="Website tracking and enquiry button" bodyClass="p-3 space-y-2">
              <CopyBox value={`<script src="${s.apiBase}/webhooks/track.js?k=YOUR_CAPTURE_KEY" async></script>`} />
              <div className="text-[11px] text-muted-foreground">Paste before &lt;/body&gt; on your website, with a capture key from above. It records the pages a visitor views and adds an "Enquire now" button. Add data-widget="off" to hide the button.</div>
            </Panel>
            <Panel title="Email replies" bodyClass="p-3 space-y-2">
              <CopyBox value={`${s.apiBase}/webhooks/email/YOUR_CAPTURE_KEY`} />
              <div className="text-[11px] text-muted-foreground">Set this as the inbound-parse address in your mail service (SendGrid, Mailgun). Replies from a lead's email land on their timeline.</div>
            </Panel>
            <Panel title="IndiaMART" actions={<Chip color={s.portals?.indiamartEnabled ? "var(--success)" : "var(--muted-foreground)"}>{s.portals?.indiamartEnabled ? "On" : "Off"}</Chip>} bodyClass="p-3 space-y-3">
              <Check checked={s.portals?.indiamartEnabled} onChange={(v) => set("portals", "indiamartEnabled", v)}>Fetch new enquiries every 10 minutes</Check>
              <Row label="CRM key" hint="IndiaMART Lead Manager → Settings → Account → Pull API.">{input("portals", "indiamartKey", { type: "password", autoComplete: "new-password" })}</Row>
              {s.portals?.indiamartLastPull && <div className="text-[11px] text-muted-foreground">Last fetched {formatDateTime(s.portals.indiamartLastPull)}</div>}
              {s.portals?.indiamartLastError && <div className="text-[11px]" style={{ color: "var(--destructive)" }}>Last error: {s.portals.indiamartLastError}</div>}
              <div className="text-[11px] text-muted-foreground">Justdial, Shiksha, CollegeDekho and Careers360 push leads: give them a capture key's webhook URL — their field names are understood.</div>
            </Panel>
            <Panel title="Other portals with an API" bodyClass="p-3 space-y-3"
              actions={canEdit && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setS((x) => ({ ...x, pulls: [...(x.pulls || []), { name: "", url: "", headers: "", listPath: "", map: {}, enabled: true }] }))}><i className="bi bi-plus-lg"></i>Add</button>}>
              {!(s.pulls || []).length && <div className="text-xs text-muted-foreground">Fetch leads every 10 minutes from any portal that gives you a JSON address.</div>}
              {(s.pulls || []).map((p, i) => {
                const edit = (patch) => setS((x) => ({ ...x, pulls: x.pulls.map((y, j) => (j === i ? { ...y, ...patch } : y)) }));
                return (
                  <div key={i} className="rounded-lg border p-2.5 space-y-2">
                    <div className="grid grid-cols-[1fr_2fr_32px] gap-2">
                      <input className="ui-input w-full" placeholder="Portal name" value={p.name} onChange={(e) => edit({ name: e.target.value })} />
                      <input className="ui-input w-full" placeholder="https://…" value={p.url} onChange={(e) => edit({ url: e.target.value })} />
                      <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Remove" onClick={() => setS((x) => ({ ...x, pulls: x.pulls.filter((_, j) => j !== i) }))}><i className="bi bi-x-lg"></i></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className="ui-input w-full" placeholder='Headers (JSON), e.g. {"Authorization":"Bearer …"}' value={p.headers || ""} onChange={(e) => edit({ headers: e.target.value })} />
                      <input className="ui-input w-full" placeholder="Where the list is, e.g. data.leads" value={p.listPath || ""} onChange={(e) => edit({ listPath: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {["id", "name", "phone", "email", "city", "course", "message"].map((k) => <input key={k} className="ui-input w-full" placeholder={`${k} field`} value={p.map?.[k] || ""} onChange={(e) => edit({ map: { ...(p.map || {}), [k]: e.target.value } })} />)}
                    </div>
                    {p.lastPull && <div className="text-[11px] text-muted-foreground">Last fetched {formatDateTime(p.lastPull)}</div>}
                    {p.lastError && <div className="text-[11px]" style={{ color: "var(--destructive)" }}>Last error: {p.lastError}</div>}
                  </div>
                );
              })}
            </Panel>
            <SaveBtn sections={["portals", "pulls"]} />
          </>}

          {tab === "assignment" && <>
            <Panel title="Who gets new leads" bodyClass="p-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Row label="Most open leads per person" hint="0 = no limit"><input className="ui-input w-full" type="number" min="0" disabled={!canEdit} value={s.assignment.maxOpenLeads} onChange={(e) => set("assignment", "maxOpenLeads", e.target.value)} /></Row>
                <Row label="Assign from"><Hours value={s.assignment.startHour} onChange={(v) => set("assignment", "startHour", v)} /></Row>
                <Row label="Until"><Hours value={Math.min(23, s.assignment.endHour)} onChange={(v) => set("assignment", "endHour", v)} /></Row>
              </div>
              <Check checked={s.assignment.respectHours} onChange={(v) => set("assignment", "respectHours", v)}>Only assign during these hours (leads arriving later wait, unassigned)</Check>
              <Check checked={s.assignment.reassignOnSla} onChange={(v) => set("assignment", "reassignOnSla", v)}>Pass a lead to someone else when its owner misses the first-response time</Check>
            </Panel>
            <Availability canEdit={canEdit} />
            <Panel title="Other rules" bodyClass="p-3 space-y-3">
              <Check checked={s.duplicates.matchEmail} onChange={(v) => set("duplicates", "matchEmail", v)}>Treat the same email as the same person (as well as the same phone)</Check>
              <Check checked={s.duplicates.matchAltPhone} onChange={(v) => set("duplicates", "matchAltPhone", v)}>Also match a lead's alternate phone number</Check>
              <Row label="When someone adds a person who is already a lead">
                <select className="ui-input w-full" disabled={!canEdit} value={s.duplicates.action} onChange={(e) => set("duplicates", "action", e.target.value)}>
                  <option value="enquiry">Record it as a repeat enquiry on the existing lead</option>
                  <option value="block">Stop them and show the existing lead</option>
                  <option value="allow">Let them create a second lead</option>
                </select>
              </Row>
              <div className="grid grid-cols-2 gap-3">
                <Row label="Keep deleted leads for (days)"><input className="ui-input w-full" type="number" min="1" max="365" disabled={!canEdit} value={s.trashDays} onChange={(e) => setS((x) => ({ ...x, trashDays: e.target.value }))} /></Row>
              </div>
            </Panel>
            <Panel title="Booking pages" bodyClass="p-3 space-y-3">
              <Check checked={s.booking.enabled} onChange={(v) => set("booking", "enabled", v)}>Let leads book a call or visit from each counsellor's link</Check>
              <div className="grid grid-cols-3 gap-3">
                <Row label="Slot length"><select className="ui-input w-full" disabled={!canEdit} value={s.booking.slotMinutes} onChange={(e) => set("booking", "slotMinutes", Number(e.target.value))}>{[15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</select></Row>
                <Row label="From"><Hours value={s.booking.startHour} onChange={(v) => set("booking", "startHour", v)} /></Row>
                <Row label="Until"><Hours value={Math.min(23, s.booking.endHour)} onChange={(v) => set("booking", "endHour", v)} /></Row>
              </div>
              <div className="flex flex-wrap gap-1.5">{DAYS.map((d, i) => <button key={d} type="button" disabled={!canEdit} className={"ui-btn ui-btn-sm " + (s.booking.days.includes(i) ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => set("booking", "days", s.booking.days.includes(i) ? s.booking.days.filter((x) => x !== i) : [...s.booking.days, i])}>{d.slice(0, 3)}</button>)}</div>
            </Panel>
            <SaveBtn sections={["assignment", "duplicates", "booking", "trashDays"]} />
          </>}

          {tab === "billing" && <>
            <Panel title="Shown on invoices and receipts" bodyClass="p-3 space-y-3">
              <Row label="Legal name">{input("billing", "legalName")}</Row>
              <Row label="Address"><textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={3} disabled={!canEdit} value={s.billing.address} onChange={(e) => set("billing", "address", e.target.value)} /></Row>
              <div className="grid grid-cols-3 gap-3">
                <Row label="GSTIN">{input("billing", "gstin")}</Row>
                <Row label="GST %" hint="0 if fees are exempt. Fee amounts are taken as GST-inclusive."><input className="ui-input w-full" type="number" min="0" max="28" disabled={!canEdit} value={s.billing.gstPercent} onChange={(e) => set("billing", "gstPercent", e.target.value)} /></Row>
                <Row label="Invoice prefix">{input("billing", "invoicePrefix")}</Row>
              </div>
            </Panel>
            <SaveBtn sections={["billing"]} />
          </>}

          {tab === "mail" && <>
            <Panel title="Mailbox for replies" actions={<Chip color={s.inbox.enabled ? "var(--success)" : "var(--muted-foreground)"}>{s.inbox.enabled ? "On" : "Off"}</Chip>} bodyClass="p-3 space-y-3">
              <Check checked={s.inbox.enabled} onChange={(v) => set("inbox", "enabled", v)}>Read this mailbox every 2 minutes and put leads' replies on their timeline</Check>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-3">
                <Row label="IMAP server">{input("inbox", "host", { placeholder: "imap.gmail.com" })}</Row>
                <Row label="Port"><input className="ui-input w-full" type="number" disabled={!canEdit} value={s.inbox.port} onChange={(e) => set("inbox", "port", e.target.value)} /></Row>
                <Row label="Email address">{input("inbox", "user", { autoComplete: "off" })}</Row>
                <Row label="SSL"><select className="ui-input w-full" disabled={!canEdit} value={s.inbox.secure ? "1" : "0"} onChange={(e) => set("inbox", "secure", e.target.value === "1")}><option value="1">Yes</option><option value="0">No</option></select></Row>
              </div>
              <Row label="Password" hint="For Gmail or Outlook, use an app password.">{input("inbox", "pass", { type: "password", autoComplete: "new-password" })}</Row>
              {s.inbox.lastCheck && <div className="text-[11px] text-muted-foreground">Last checked {formatDateTime(s.inbox.lastCheck)}</div>}
              {s.inbox.lastError && <div className="text-[11px]" style={{ color: "var(--destructive)" }}>Last error: {s.inbox.lastError}</div>}
            </Panel>
            <Panel title="Google Calendar" bodyClass="p-3 space-y-3">
              <Row label="OAuth client ID">{input("google", "clientId")}</Row>
              <Row label="OAuth client secret">{input("google", "clientSecret", { type: "password", autoComplete: "new-password" })}</Row>
              <Row label="Authorised redirect URI" hint="Add this in Google Cloud Console → Credentials for that client. Each person then connects their own calendar from Dashboard → My settings."><CopyBox value={s.googleRedirectUrl} /></Row>
            </Panel>
            {canEdit && <div className="flex justify-end gap-2">
              <button type="button" className="ui-btn ui-btn-outline" disabled={saving} onClick={async () => { try { const r = await crmApi.testInbox(); toast(`Mailbox opened — ${r.data.messages} messages`); } catch (e) { toast(e.message, "error"); } }}>Test saved mailbox</button>
              <button type="button" className="ui-btn ui-btn-primary" disabled={saving} onClick={() => save(["inbox", "google"])}>{saving ? "Saving…" : "Save"}</button>
            </div>}
          </>}

          {tab === "masters" && <>
            <MasterList kind="courses" title="Courses" canEdit={canEdit} seats
              fields={[["name", "Course name *", "text"], ["fee", "Fee ₹", "number"], ["seats", "Seats", "number"], ["intake", "Intake", "text"]]} />
            <MasterList kind="branches" title="Branches" canEdit={canEdit} fields={[["name", "Branch name *", "text"], ["city", "City", "text"]]} />
          </>}
          {tab === "fields" && <FieldsTab canEdit={canEdit} />}

          {tab === "stages" && <>
            <Panel title="Stages an application moves through" bodyClass="p-3 space-y-2">
              <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={8} disabled={!canEdit} value={(s.applicationStages || []).join("\n")} onChange={(e) => setS((x) => ({ ...x, applicationStages: e.target.value.split("\n") }))} />
              <div className="text-[11px] text-muted-foreground">One per line, in order. A stage starting with "Enrol" marks the lead as won.</div>
            </Panel>
            <SaveBtn sections={["applicationStages"]} />
          </>}
        </div>
      )}
    </div>
  );
}

function CopyBox({ value }) {
  const toast = useToast();
  return (
    <div className="flex gap-2">
      <input className="ui-input flex-1 font-mono" style={{ fontSize: 12 }} readOnly value={value} onFocus={(e) => e.target.select()} />
      <button type="button" className="ui-btn ui-btn-outline ui-btn-icon" title="Copy" onClick={() => navigator.clipboard?.writeText(value).then(() => toast("Copied"), () => toast("Could not copy", "error"))}><i className="bi bi-clipboard"></i></button>
    </div>
  );
}

function SmsTab({ s, set, input, canEdit, SaveBtn }) {
  const toast = useToast();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  return <>
    <Panel title="SMS gateway" actions={<Chip color={s.smsReady ? "var(--success)" : "var(--muted-foreground)"}>{s.smsReady ? "Ready" : "Not set up"}</Chip>} bodyClass="p-3 space-y-3">
      <Row label="Provider">
        <select className="ui-input w-full" disabled={!canEdit} value={s.sms.provider} onChange={(e) => set("sms", "provider", e.target.value)}>
          <option value="none">None</option><option value="msg91">MSG91</option><option value="custom">Other gateway (HTTPS API)</option>
        </select>
      </Row>
      {s.sms.provider !== "none" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Row label="Sender ID">{input("sms", "senderId")}</Row>
        <Row label="DLT entity ID">{input("sms", "entityId")}</Row>
        {s.sms.provider === "msg91" && <Row label="Auth key">{input("sms", "authKey", { type: "password", autoComplete: "new-password" })}</Row>}
      </div>}
      {s.sms.provider === "custom" && <div className="space-y-3">
        <Row label="Gateway URL" hint="Use {to} {message} {sender} {entityId} {templateId} where the values go.">{input("sms", "customUrl", { placeholder: "https://…?to={to}&text={message}" })}</Row>
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Row label="Method"><select className="ui-input w-full" disabled={!canEdit} value={s.sms.customMethod} onChange={(e) => set("sms", "customMethod", e.target.value)}><option>GET</option><option>POST</option></select></Row>
          <Row label="Extra headers (JSON)">{input("sms", "customHeaders", { placeholder: '{"Authorization": "Bearer …"}' })}</Row>
        </div>
        {s.sms.customMethod === "POST" && <Row label="Request body">{input("sms", "customBody", { placeholder: '{"to":"{to}","message":"{message}"}' })}</Row>}
      </div>}
    </Panel>
    <SaveBtn sections={["sms"]} />
    {canEdit && s.smsReady && (
      <Panel title="Send a test" bodyClass="p-3 flex gap-2">
        <input className="ui-input flex-1" type="tel" placeholder="Phone number" value={to} onChange={(e) => setTo(e.target.value)} />
        <button type="button" className="ui-btn ui-btn-outline" disabled={busy || !to.trim()} onClick={async () => { setBusy(true); try { await crmApi.testSms({ to }); toast("Test SMS sent"); } catch (e) { toast(e.message, "error"); } finally { setBusy(false); } }}>{busy ? "Sending…" : "Send test"}</button>
      </Panel>
    )}
  </>;
}

/* ───────────── keys that let other systems push leads in ───────────── */
function CaptureTab({ meta, canEdit }) {
  const toast = useToast();
  const keys = useApi(() => crmApi.apiKeys(), []);
  const [form, setForm] = useState({ name: "", source: "", owner: "" });
  const [fresh, setFresh] = useState(null);
  const [removing, setRemoving] = useState(null);

  async function create() {
    try {
      const res = await crmApi.createApiKey(form);
      setFresh(res.data);
      setForm({ name: "", source: "", owner: "" });
      keys.reload();
    } catch (e) { toast(e.message, "error"); }
  }

  return <>
    {canEdit && (
      <Panel title="New capture key" bodyClass="p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Row label="Where the leads come from *"><input className="ui-input w-full" placeholder="Google Ads, IndiaMART, website…" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Row>
          <Row label="Source"><select className="ui-input w-full" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}><option value="">From the data</option>{(meta.sources || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select></Row>
          <Row label="Owner"><select className="ui-input w-full" value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}><option value="">Auto-assign</option>{(meta.owners || []).map((x) => <option key={x}>{x}</option>)}</select></Row>
        </div>
        <div className="flex justify-end"><button type="button" className="ui-btn ui-btn-primary" disabled={!form.name.trim()} onClick={create}>Create key</button></div>
      </Panel>
    )}
    {fresh && (
      <Panel title={`Key for ${fresh.name}`} bodyClass="p-3 space-y-2" className="border-[var(--primary)]">
        <div className="text-xs" style={{ color: "var(--warning)" }}>Copy it now — the key is not shown again.</div>
        <Row label="Webhook URL (POST the lead as JSON)"><CopyBox value={fresh.url} /></Row>
        <Row label="Key (for Google Ads lead forms, paste as the webhook key)"><CopyBox value={fresh.key} /></Row>
        <div className="text-[11px] text-muted-foreground">Fields read: name, phone / mobile, email, city, state, course, message, utm_source, utm_campaign.</div>
      </Panel>
    )}
    <Panel title="Capture keys" bodyClass="p-0">
      {keys.loading && !keys.data ? <Spinner /> : !(keys.data || []).length ? <EmptyState icon="key" text="No keys yet." /> : keys.data.map((k) => (
        <div key={k._id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-b last:border-b-0">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">{k.name} <span className="text-xs font-normal text-muted-foreground font-mono">…{k.hint}</span></div>
            <div className="text-[11px] text-muted-foreground">{k.hits} lead{k.hits === 1 ? "" : "s"} received{k.lastUsedAt ? ` · last ${formatDateTime(k.lastUsedAt)}` : ""}{k.source?.name ? ` · ${k.source.name}` : ""}</div>
            {k.lastError && <div className="text-[11px]" style={{ color: "var(--destructive)" }}>Last error: {k.lastError}</div>}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-foreground"><input type="checkbox" checked={k.active} disabled={!canEdit} onChange={async () => { try { await crmApi.updateApiKey(k._id, { active: !k.active }); keys.reload(); } catch (e) { toast(e.message, "error"); } }} />{k.active ? "On" : "Off"}</label>
          {canEdit && <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Delete" onClick={() => setRemoving(k)}><i className="bi bi-trash"></i></button>}
        </div>
      ))}
    </Panel>
    {removing && <Confirm danger title={`Delete the key for ${removing.name}?`} text="Anything still sending leads with it will be refused." confirmLabel="Delete" onCancel={() => setRemoving(null)}
      onConfirm={async () => { try { await crmApi.removeApiKey(removing._id); setRemoving(null); keys.reload(); } catch (e) { toast(e.message, "error"); } }} />}
  </>;
}

/* ───────────── extra fields on a lead ───────────── */
const FIELD_TYPES = [["text", "Text"], ["number", "Number"], ["dropdown", "Dropdown"], ["date", "Date"], ["phone", "Phone"], ["email", "Email"], ["consent", "Yes / No"]];
function FieldsTab({ canEdit }) {
  const toast = useToast();
  const fields = useApi(() => crmApi.customFields(), []);
  const blank = { label: "", type: "text", options: "", required: "no" };
  const [form, setForm] = useState(blank);
  const [removing, setRemoving] = useState(null);
  const keyOf = (label) => label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  async function add() {
    try { await crmApi.createCustomField({ ...form, label: form.label.trim(), key: keyOf(form.label), isActive: true }); setForm(blank); fields.reload(); toast("Field added"); }
    catch (e) { toast(e.message, "error"); }
  }
  const patch = async (f, body) => { try { await crmApi.updateCustomField(f._id, body); fields.reload(); } catch (e) { toast(e.message, "error"); } };

  return <>
    {canEdit && (
      <Panel title="New field" bodyClass="p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px_130px] gap-3">
          <Row label="Field name *"><input className="ui-input w-full" placeholder="Father's occupation" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} /></Row>
          <Row label="Type"><select className="ui-input w-full" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>{FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Row>
          <Row label="Required"><select className="ui-input w-full" value={form.required} onChange={(e) => setForm((f) => ({ ...f, required: e.target.value }))}><option value="no">Optional</option><option value="yes">Required</option></select></Row>
        </div>
        {form.type === "dropdown" && <Row label="Choices" hint="Separated by commas."><input className="ui-input w-full" value={form.options} onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))} /></Row>}
        <div className="flex justify-end"><button type="button" className="ui-btn ui-btn-primary" disabled={!keyOf(form.label) || (form.type === "dropdown" && !form.options.trim())} onClick={add}>Add field</button></div>
      </Panel>
    )}
    <Panel title="Fields on every lead" bodyClass="p-0">
      {fields.loading && !fields.data ? <Spinner /> : !(fields.data || []).length ? <EmptyState icon="input-cursor-text" text="No custom fields yet." /> : fields.data.map((f) => (
        <div key={f._id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-b last:border-b-0">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">{f.label}{f.required === "yes" && <span className="text-xs font-normal text-muted-foreground"> · required</span>}</div>
            <div className="text-[11px] text-muted-foreground">{FIELD_TYPES.find(([v]) => v === f.type)?.[1] || f.type}{f.options ? ` · ${f.options}` : ""}</div>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-foreground"><input type="checkbox" checked={f.isActive !== false} disabled={!canEdit} onChange={() => patch(f, { isActive: f.isActive === false })} />Shown</label>
          {canEdit && <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Delete" onClick={() => setRemoving(f)}><i className="bi bi-trash"></i></button>}
        </div>
      ))}
    </Panel>
    {removing && <Confirm danger title={`Delete the field "${removing.label}"?`} text="Values already saved on leads are kept but no longer shown." confirmLabel="Delete" onCancel={() => setRemoving(null)}
      onConfirm={async () => { try { await crmApi.removeCustomField(removing._id); setRemoving(null); fields.reload(); } catch (e) { toast(e.message, "error"); } }} />}
  </>;
}

/* ───────────── who is on leave, and how many open leads each person holds ───────────── */
function Availability({ canEdit }) {
  const toast = useToast();
  const team = useApi(() => crmApi.availability(), []);
  const branchList = useApi(() => crmApi.master("branches"), []);
  const branches = (branchList.data || []).filter((b) => b.active !== false).map((b) => b.name);
  if (!team.data) return null;
  return (
    <Panel title="Team availability" bodyClass="p-0">
      {team.data.users.map((u) => (
        <div key={u._id} className="flex items-center justify-between gap-3 px-3 py-2 border-b last:border-b-0">
          <span className="text-sm text-foreground">{u.name}</span>
          <span className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{u.openLeads}{team.data.limit ? ` / ${team.data.limit}` : ""} open</span>
            {!!branches.length && (
              <select className="ui-input" style={{ height: 28, maxWidth: 170 }} disabled={!canEdit} value="" title="Branches this person may see"
                onChange={async (e) => { const b = e.target.value; if (!b) return; const next = b === "__all" ? [] : u.branches.includes(b) ? u.branches.filter((x) => x !== b) : [...u.branches, b]; try { await crmApi.setBranches(u._id, next); team.reload(); } catch (err) { toast(err.message, "error"); } }}>
                <option value="">{u.branches.length ? u.branches.join(", ") : "All branches"}</option>
                {u.branches.length > 0 && <option value="__all">→ All branches</option>}
                {branches.map((b) => <option key={b} value={b}>{u.branches.includes(b) ? `✓ ${b}` : b}</option>)}
              </select>
            )}
            <label className="flex items-center gap-1.5 text-xs text-foreground"><input type="checkbox" checked={u.away} disabled={!canEdit} onChange={async () => { try { await crmApi.setAvailability(u._id, !u.away); team.reload(); } catch (e) { toast(e.message, "error"); } }} />On leave</label>
          </span>
        </div>
      ))}
    </Panel>
  );
}

/* ───────────── a simple master list: courses, branches ───────────── */
function MasterList({ kind, title, fields, canEdit, seats }) {
  const toast = useToast();
  const list = useApi(() => (seats ? crmApi.courseSeats() : crmApi.master(kind)), [kind]);
  const blank = Object.fromEntries(fields.map(([k]) => [k, ""]));
  const [form, setForm] = useState(blank);
  const [removing, setRemoving] = useState(null);

  async function add() {
    try { await crmApi.createMaster(kind, form); setForm(blank); list.reload(); toast("Added"); }
    catch (e) { toast(e.message, "error"); }
  }
  const patch = async (row, body) => { try { await crmApi.updateMaster(kind, row._id, body); list.reload(); } catch (e) { toast(e.message, "error"); } };

  return <>
    <Panel title={title} bodyClass="p-0">
      {canEdit && (
        <div className="p-3 border-b grid gap-2 items-end" style={{ gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr)) auto` }}>
          {fields.map(([k, label, type]) => <input key={k} className="ui-input w-full" type={type} min={type === "number" ? 0 : undefined} placeholder={label} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />)}
          <button type="button" className="ui-btn ui-btn-primary" disabled={!String(form.name).trim()} onClick={add}>Add</button>
        </div>
      )}
      {list.loading && !list.data ? <Spinner /> : !(list.data || []).length ? <EmptyState icon="list-ul" text={`No ${title.toLowerCase()} yet.`} /> : list.data.map((row) => (
        <div key={row._id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-b last:border-b-0">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-foreground">{row.name}</div>
            <div className="text-[11px] text-muted-foreground">
              {seats ? [row.fee ? `₹${Number(row.fee).toLocaleString("en-IN")}` : "", row.intake, `${row.leads} leads`, row.seats ? `${row.filled} of ${row.seats} seats filled` : `${row.filled} admitted`].filter(Boolean).join(" · ") : row.city}
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-foreground"><input type="checkbox" checked={row.active !== false} disabled={!canEdit} onChange={() => patch(row, { active: row.active === false })} />In use</label>
          {canEdit && <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Delete" onClick={() => setRemoving(row)}><i className="bi bi-trash"></i></button>}
        </div>
      ))}
    </Panel>
    {removing && <Confirm danger title={`Delete ${removing.name}?`} text="Leads that already have it keep it." confirmLabel="Delete" onCancel={() => setRemoving(null)}
      onConfirm={async () => { try { await crmApi.removeMaster(kind, removing._id); setRemoving(null); list.reload(); } catch (e) { toast(e.message, "error"); } }} />}
  </>;
}
