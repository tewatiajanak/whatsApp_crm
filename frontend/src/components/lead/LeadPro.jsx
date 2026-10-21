import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { crmApi, leadsApi } from "../../api";
import { useApi } from "../../hooks/useApi";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Modal, Spinner, EmptyState, Chip, Confirm, Avatar, SearchBox } from "../ui";
import DateInput from "../DateInput";
import { formatDate, formatDateTime } from "../../utils/dateFormat";
import { labelCls, isoDay, timeAgo } from "./leadUtils";

// Lead CRM part three on the lead screen: custom activities, queries, lists, source history.

/* ───────────── custom activity: fields of one type ───────────── */
export function ActivityFields({ type, values, onChange }) {
  const set = (k, v) => onChange({ ...values, [k]: v });
  if (!type?.fields?.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {type.fields.map((f) => (
        <div key={f.key}>
          <label className={labelCls}>{f.label}{f.required ? " *" : ""}</label>
          {f.type === "select" ? (
            <select className="ui-input w-full" value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}>
              <option value="">—</option>{f.options.map((o) => <option key={o}>{o}</option>)}
            </select>
          ) : f.type === "yesno" ? (
            <select className="ui-input w-full" value={values[f.key] === undefined ? "" : values[f.key] ? "yes" : "no"} onChange={(e) => set(f.key, e.target.value === "" ? undefined : e.target.value === "yes")}>
              <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
            </select>
          ) : f.type === "date" ? (
            <DateInput className="ui-input w-full" value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)} />
          ) : (
            <input className="ui-input w-full" type={f.type === "number" ? "number" : "text"} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
          )}
        </div>
      ))}
    </div>
  );
}

const missingRequired = (type, values) => (type?.fields || []).filter((f) => f.required && (values[f.key] === undefined || values[f.key] === "")).map((f) => f.label);

/** "Activity" mode of the timeline composer. */
export function LogActivity({ leadId, types, onDone }) {
  const toast = useToast();
  const active = (types || []).filter((t) => t.active !== false);
  const [typeId, setTypeId] = useState(active[0]?._id || "");
  const [values, setValues] = useState({});
  const [note, setNote] = useState("");
  const [date, setDate] = useState(isoDay(0));
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [saving, setSaving] = useState(false);
  const type = active.find((t) => t._id === typeId);
  useEffect(() => { setValues({}); }, [typeId]);

  if (!active.length) return <div className="text-xs text-muted-foreground py-1">No activity types yet. Add them in CRM settings.</div>;
  const missing = missingRequired(type, values);
  async function save() {
    setSaving(true);
    try {
      const res = await crmApi.logActivity(leadId, { typeId, values, note: note.trim(), date, time });
      toast(`${type.name} logged · score ${res.data.score}`);
      setValues({}); setNote("");
      onDone();
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_100px] gap-2">
        <select className="ui-input w-full" value={typeId} onChange={(e) => setTypeId(e.target.value)} aria-label="Activity">
          {active.map((t) => <option key={t._id} value={t._id}>{t.name}{t.points ? ` (${t.points > 0 ? "+" : ""}${t.points})` : ""}</option>)}
        </select>
        <DateInput className="ui-input w-full" value={date} max={isoDay(0)} onChange={(e) => setDate(e.target.value)} />
        <input type="time" className="ui-input w-full" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
      </div>
      <ActivityFields type={type} values={values} onChange={setValues} />
      <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={2} aria-label="Notes" title="Notes" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex justify-end">
        <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={saving || !type || missing.length > 0} title={missing.length ? `Fill ${missing.join(", ")}` : undefined} onClick={save}>{saving ? "Saving…" : "Log activity"}</button>
      </div>
    </div>
  );
}

/* ───────────── where the lead came from, enquiry by enquiry ───────────── */
const ORDINAL = ["Primary", "Secondary", "Tertiary"];
export function SourceHistory({ lead }) {
  const rows = lead.sourceHistory || [];
  if (rows.length < 1) return null;
  return (
    <div className="border-t pt-3">
      <div className={labelCls}>Source history</div>
      <div className="space-y-1.5">
        {rows.map((h, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className="w-20 text-muted-foreground">{ORDINAL[i] || `Enquiry ${i + 1}`}</span>
            <span className="font-medium text-foreground">{h.sourceName || "—"}</span>
            {h.capturedFrom && <span className="text-muted-foreground">· {h.capturedFrom}</span>}
            {h.campaign && <Chip>{h.campaign}</Chip>}
            <span className="text-muted-foreground ms-auto">{formatDate(h.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── lists this lead is on ───────────── */
export function LeadListChips({ leadId, canEdit, stamp }) {
  const toast = useToast();
  const lists = useApi(() => crmApi.leadLists(leadId), [leadId, stamp]);
  const all = useApi(() => (canEdit ? crmApi.lists() : Promise.resolve({ data: [] })), [canEdit]);
  const mine = lists.data || [];
  const free = (all.data || []).filter((l) => l.kind === "static" && !mine.some((m) => m._id === l._id));
  const [adding, setAdding] = useState(false);
  async function change(listId, remove) {
    try { await crmApi.listMembers(listId, { leadIds: [leadId], remove }); lists.reload(); all.reload(); setAdding(false); }
    catch (e) { toast(e.message, "error"); }
  }
  if (!mine.length && !free.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <i className="bi bi-collection text-muted-foreground" title="Lists" style={{ fontSize: 13 }}></i>
      {mine.map((l) => (
        <span key={l._id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-foreground">
          <Link to={`/crm/lists?list=${l._id}`} className="hover:underline">{l.name}</Link>
          {canEdit && <button type="button" className="text-muted-foreground" title={`Remove from ${l.name}`} onClick={() => change(l._id, true)}><i className="bi bi-x"></i></button>}
        </span>
      ))}
      {canEdit && free.length > 0 && (adding
        ? <select className="ui-input" style={{ height: 26, fontSize: 12 }} autoFocus value="" onBlur={() => setAdding(false)} onChange={(e) => e.target.value && change(e.target.value, false)}>
            <option value="">Add to list…</option>{free.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
          </select>
        : <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" style={{ height: 24 }} onClick={() => setAdding(true)}><i className="bi bi-plus"></i>List</button>)}
    </div>
  );
}

/* ───────────── queries ───────────── */
export const QUERY_STATUS = {
  open: { label: "Open", color: "var(--info)" },
  pending: { label: "Waiting on customer", color: "var(--warning)" },
  resolved: { label: "Resolved", color: "var(--success)" },
  closed: { label: "Closed", color: "var(--muted-foreground)" },
};
export const QUERY_PRIORITY = {
  low: { label: "Low", color: "var(--muted-foreground)" },
  medium: { label: "Medium", color: "var(--info)" },
  high: { label: "High", color: "var(--warning)" },
  urgent: { label: "Urgent", color: "var(--destructive)" },
};
export function dueText(q) {
  if (q.status === "resolved" || q.status === "closed") return { text: q.resolvedAt ? `Done ${formatDate(q.resolvedAt)}` : "Done", tone: "muted-foreground" };
  if (!q.dueAt) return { text: "—", tone: "muted-foreground" };
  const mins = Math.round((new Date(q.dueAt).getTime() - Date.now()) / 60000);
  const span = (m) => (Math.abs(m) < 60 ? `${Math.abs(m)}m` : Math.abs(m) < 1440 ? `${Math.round(Math.abs(m) / 60)}h` : `${Math.round(Math.abs(m) / 1440)}d`);
  return mins < 0 ? { text: `Overdue ${span(mins)}`, tone: "destructive" } : { text: `Due in ${span(mins)}`, tone: mins < 240 ? "warning" : "muted-foreground" };
}

/** Raise a query — for a known lead, or for anyone by name and phone. */
export function NewQuery({ lead, meta, onClose, onSaved }) {
  const toast = useToast();
  const [v, setV] = useState({ subject: "", category: meta?.categories?.[0]?.name || "", priority: "medium", assignedTo: "", description: "", name: "", phone: "", email: "", leadId: lead?._id || "" });
  const [leadQ, setLeadQ] = useState("");
  const [found, setFound] = useState([]);
  const [picked, setPicked] = useState(lead || null);
  const [saving, setSaving] = useState(false);
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));

  useEffect(() => {
    if (picked || leadQ.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => leadsApi.list({ q: leadQ.trim(), perPage: 6 }).then((r) => setFound(r.data || []), () => setFound([])), 250);
    return () => clearTimeout(t);
  }, [leadQ, picked]);

  async function save() {
    setSaving(true);
    try {
      const body = { subject: v.subject, category: v.category, priority: v.priority, assignedTo: v.assignedTo, description: v.description };
      if (picked) body.lead = picked._id; else Object.assign(body, { name: v.name, phone: v.phone, email: v.email });
      const res = await crmApi.createQuery(body);
      toast(`Query #${res.data.number} raised`);
      onSaved?.(res.data);
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }
  const ready = v.subject.trim() && (picked || v.name.trim() || v.phone.trim());

  return (
    <Modal title="New query" onClose={onClose}
      footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={!ready || saving} onClick={save}>{saving ? "Saving…" : "Raise query"}</button></>}>
      <div className="space-y-3">
        {!lead && (picked ? (
          <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2">
            <Avatar name={picked.name} size={26} /><div className="min-w-0 flex-1"><div className="text-sm font-medium text-foreground truncate">{picked.name}</div><div className="text-[11px] text-muted-foreground">{picked.phone}</div></div>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Change" onClick={() => { setPicked(null); setLeadQ(""); }}><i className="bi bi-x-lg"></i></button>
          </div>
        ) : (
          <div className="relative">
            <label className={labelCls}>Lead</label>
            <SearchBox value={leadQ} onChange={setLeadQ} className="w-full max-w-none" />
            {found.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg border bg-card shadow-lg overflow-hidden">
                {found.map((l) => <button key={l._id} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-accent/40" onClick={() => setPicked(l)}>{l.name} <span className="text-xs text-muted-foreground">{l.phone}</span></button>)}
              </div>
            )}
            {!found.length && leadQ.trim().length >= 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <div><label className={labelCls}>Name</label><input className="ui-input w-full" value={v.name} onChange={(e) => set("name", e.target.value)} /></div>
                <div><label className={labelCls}>Phone</label><input className="ui-input w-full" value={v.phone} onChange={(e) => set("phone", e.target.value)} /></div>
                <div><label className={labelCls}>Email</label><input className="ui-input w-full" value={v.email} onChange={(e) => set("email", e.target.value)} /></div>
              </div>
            )}
          </div>
        ))}
        <div><label className={labelCls}>Subject *</label><input className="ui-input w-full" autoFocus={!!lead} value={v.subject} onChange={(e) => set("subject", e.target.value)} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div><label className={labelCls}>Category</label><select className="ui-input w-full" value={v.category} onChange={(e) => set("category", e.target.value)}><option value="">—</option>{(meta?.categories || []).map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
          <div><label className={labelCls}>Priority</label><select className="ui-input w-full" value={v.priority} onChange={(e) => set("priority", e.target.value)}>{Object.entries(QUERY_PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></div>
          <div><label className={labelCls}>Assign to</label><select className="ui-input w-full" value={v.assignedTo} onChange={(e) => set("assignedTo", e.target.value)}><option value="">Lead owner</option>{(meta?.owners || []).map((o) => <option key={o}>{o}</option>)}</select></div>
        </div>
        <div><label className={labelCls}>Question</label><textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} /></div>
      </div>
    </Modal>
  );
}

/** One query: its thread, reply box and controls. */
export function QueryDrawer({ id, meta, onClose, onChanged }) {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("leads", "edit");
  const q = useApi(() => crmApi.query(id), [id]);
  const [reply, setReply] = useState({ text: "", mode: "reply", channel: "" });
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const d = q.data;

  async function run(fn, done) {
    setBusy(true);
    try { const res = await fn(); if (res?.data) q.setData(res.data); if (done) toast(done); onChanged?.(); }
    catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  const send = () => run(() => crmApi.replyQuery(id, { text: reply.text.trim(), internal: reply.mode === "note", fromCustomer: reply.mode === "customer", channel: reply.mode === "reply" ? reply.channel : "" }), reply.mode === "note" ? "Note added" : "Saved").then(() => setReply((r) => ({ ...r, text: "" })));
  const due = d ? dueText(d) : null;

  return (
    <>
      <Modal size="lg" onClose={onClose} title={d ? <div className="min-w-0"><div className="truncate">#{d.number} · {d.subject}</div><div className="text-xs font-normal text-muted-foreground truncate">{d.name}{d.phone ? ` · ${d.phone}` : ""}{d.email ? ` · ${d.email}` : ""}</div></div> : "Query"}>
        {q.loading && !d ? <Spinner /> : !d ? <EmptyState icon="question-circle" text="Query not found." /> : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip color={QUERY_STATUS[d.status].color}>{QUERY_STATUS[d.status].label}</Chip>
              <Chip color={QUERY_PRIORITY[d.priority].color}>{QUERY_PRIORITY[d.priority].label}</Chip>
              {d.category && <Chip>{d.category}</Chip>}
              <span className="text-xs" style={{ color: `var(--${due.tone})` }}>{due.text}</span>
              {d.lead && <Link className="ui-btn ui-btn-ghost ui-btn-sm ms-auto" to={`/crm/leads?lead=${d.lead}`}><i className="bi bi-person"></i>Open lead</Link>}
              {can("leads", "del") && <button type="button" className={"ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" + (d.lead ? "" : " ms-auto")} title="Delete query" onClick={() => setRemoving(true)}><i className="bi bi-trash"></i></button>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><label className={labelCls}>Status</label><select className="ui-input w-full" disabled={!canEdit || busy} value={d.status} onChange={(e) => run(() => crmApi.updateQuery(id, { status: e.target.value }), "Status updated")}>{Object.entries(QUERY_STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select></div>
              <div><label className={labelCls}>Priority</label><select className="ui-input w-full" disabled={!canEdit || busy} value={d.priority} onChange={(e) => run(() => crmApi.updateQuery(id, { priority: e.target.value }))}>{Object.entries(QUERY_PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select></div>
              <div><label className={labelCls}>Category</label><select className="ui-input w-full" disabled={!canEdit || busy} value={d.category} onChange={(e) => run(() => crmApi.updateQuery(id, { category: e.target.value }))}><option value="">—</option>{[...new Set([...(meta?.categories || []).map((c) => c.name), d.category].filter(Boolean))].map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label className={labelCls}>Assigned to</label><select className="ui-input w-full" disabled={!canEdit || busy} value={d.assignedTo} onChange={(e) => run(() => crmApi.updateQuery(id, { assignedTo: e.target.value }), "Reassigned")}><option value="Unassigned">Unassigned</option>{[...new Set([...(meta?.owners || []), d.assignedTo].filter((o) => o && o !== "Unassigned"))].map((o) => <option key={o}>{o}</option>)}</select></div>
            </div>

            <div className="space-y-2">
              {!d.messages.length && <EmptyState icon="chat-left-text" text="No messages yet." />}
              {d.messages.map((m, i) => m.channel === "system" ? (
                <div key={i} className="text-[11px] text-center text-muted-foreground">{m.text} · {m.by} · {timeAgo(m.at)}</div>
              ) : (
                <div key={i} className={"flex " + (m.fromCustomer ? "justify-start" : "justify-end")}>
                  <div className="max-w-[85%] rounded-xl border px-3 py-2" style={{ background: m.internal ? "color-mix(in srgb, var(--warning) 12%, transparent)" : m.fromCustomer ? "var(--card)" : "color-mix(in srgb, var(--primary) 10%, transparent)" }}>
                    <div className="text-sm text-foreground whitespace-pre-wrap break-words">{m.text}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{m.by}{m.internal ? " · internal note" : ""}{m.channel && !["manual", ""].includes(m.channel) ? ` · ${m.channel}` : ""} · <span title={formatDateTime(m.at)}>{timeAgo(m.at)}</span></div>
                  </div>
                </div>
              ))}
            </div>

            {canEdit && (
              <div className="rounded-lg border p-2.5 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {[["reply", "reply", "Reply"], ["note", "sticky", "Internal note"], ["customer", "person", "Customer said"]].map(([k, icon, label]) => (
                    <button key={k} type="button" className={"ui-btn ui-btn-sm " + (reply.mode === k ? "ui-btn-primary" : "ui-btn-ghost")} onClick={() => setReply((r) => ({ ...r, mode: k }))}><i className={`bi bi-${icon}`}></i>{label}</button>
                  ))}
                  {reply.mode === "reply" && (
                    <select className="ui-input ms-auto" style={{ height: 30, width: "auto" }} value={reply.channel} onChange={(e) => setReply((r) => ({ ...r, channel: e.target.value }))} aria-label="Send by">
                      <option value="">Save only</option>
                      {d.phone && can("chat", "create") && <option value="whatsapp">Send on WhatsApp</option>}
                      {d.email && <option value="email">Send by email</option>}
                    </select>
                  )}
                </div>
                <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={3} value={reply.text} onChange={(e) => setReply((r) => ({ ...r, text: e.target.value }))} />
                <div className="flex justify-end">
                  <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" disabled={busy || !reply.text.trim()} onClick={send}><i className={`bi bi-${reply.channel && reply.mode === "reply" ? "send" : "check2"}`}></i>{reply.mode === "reply" ? (reply.channel ? "Send" : "Save reply") : "Add"}</button>
                </div>
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">Raised {formatDateTime(d.createdAt)} by {d.createdBy || d.raisedVia}{d.firstResponseAt ? ` · first reply ${formatDateTime(d.firstResponseAt)}` : ""}</div>
          </div>
        )}
      </Modal>
      {removing && <Confirm danger title={`Delete query #${d?.number}?`} text="Its messages are deleted too." confirmLabel="Delete" onCancel={() => setRemoving(false)}
        onConfirm={async () => { try { await crmApi.removeQuery(id); toast("Query deleted"); setRemoving(false); onChanged?.(); onClose(); } catch (e) { toast(e.message, "error"); } }} />}
    </>
  );
}

/** Queries tab on the lead. */
export function LeadQueries({ lead, canEdit }) {
  const list = useApi(() => crmApi.leadQueries(lead._id), [lead._id]);
  const meta = useApi(() => crmApi.queryMeta(), []);
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-2">
      {canEdit && <div className="flex justify-end"><button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setAdding(true)}><i className="bi bi-plus-lg"></i>New query</button></div>}
      {list.loading && !list.data ? <Spinner /> : !(list.data || []).length ? <EmptyState icon="question-circle" text="No queries." /> : list.data.map((q) => {
        const due = dueText(q);
        return (
          <button key={q._id} type="button" className="w-full text-left rounded-lg border p-2.5 hover:bg-accent/30" onClick={() => setOpen(q._id)}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">#{q.number}</span>
              <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{q.subject}</span>
              <Chip color={QUERY_STATUS[q.status].color}>{QUERY_STATUS[q.status].label}</Chip>
            </div>
            <div className="text-[11px] mt-0.5 text-muted-foreground">{[q.category, q.assignedTo].filter(Boolean).join(" · ")} · <span style={{ color: `var(--${due.tone})` }}>{due.text}</span></div>
          </button>
        );
      })}
      {adding && <NewQuery lead={lead} meta={meta.data} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); list.reload(); }} />}
      {open && <QueryDrawer id={open} meta={meta.data} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </div>
  );
}
