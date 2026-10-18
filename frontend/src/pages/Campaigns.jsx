import { useEffect, useMemo, useRef, useState } from "react";
import { campaignsApi, campaignListsApi, campaignsAudienceApi, templatesApi, crmApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, ErrorBox, DataTable, Modal, Tabs, FilterBar, IconBtn, StatCard, Confirm, Spinner } from "../components/ui";
import DateInput from "../components/DateInput";
import TimeInput from "../components/TimeInput";
import { formatDate, formatDateTime } from "../utils/dateFormat";

// neutral status pill colours (meaning only)
const STATUS_STYLE = {
  Running: { background: "var(--ok-bg)", color: "var(--ok)" },
  Scheduled: { background: "var(--info-bg)", color: "var(--info)" },
  Completed: { background: "var(--pill-bg)", color: "var(--pill-ink)" },
  Paused: { background: "var(--warn-bg)", color: "var(--warn)" },
  Draft: { background: "var(--pill-bg)", color: "var(--pill-ink)" },
};

// a recipient's latest delivery status
const DELIVERY = {
  pending: { label: "Not sent", style: { background: "var(--pill-bg)", color: "var(--muted-foreground)" } },
  queued: { label: "Queued", style: { background: "var(--pill-bg)", color: "var(--pill-ink)" } },
  sent: { label: "Sent", style: { background: "var(--pill-bg)", color: "var(--pill-ink)" } },
  delivered: { label: "Delivered", style: { background: "var(--ok-bg)", color: "var(--ok)" } },
  read: { label: "Read", style: { background: "var(--info-bg)", color: "var(--info)" } },
  failed: { label: "Failed", style: { background: "var(--err-bg)", color: "var(--err)" } },
};

// who a resend can go to (latest status in the original campaign)
const RESEND_OPTIONS = [
  { value: "failed", label: "Failed" },
  { value: "sent", label: "Sent, not delivered" },
  { value: "delivered", label: "Delivered, not read" },
  { value: "read", label: "Read" },
  { value: "pending", label: "Not sent" },
  { value: "queued", label: "Queued" },
];

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const varCount = (body) => {
  const nums = [...String(body || "").matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1]));
  return nums.length ? Math.max(...nums) : 0;
};
const unwrap = (res) => (res && Object.prototype.hasOwnProperty.call(res, "data") ? res.data : res);

async function writeExcel(name, header, rows) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${name.replace(/[^\w\- ]+/g, "").trim() || "export"}.xlsx`);
}

export default function Campaigns() {
  const { can } = useAuth();
  const [tab, setTab] = useState("campaigns");
  const [creating, setCreating] = useState(null); // {} or { audienceType, audienceRefs }
  const [manual, setManual] = useState(false);
  const [bump, setBump] = useState(0);

  return (
    <div>
      <PageHeader
        title="Bulk Campaigns"
        actions={
          tab === "campaigns"
            ? can("blast", "create") && (
                <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setCreating({})}>
                  <i className="bi bi-plus-lg"></i>New Campaign
                </button>
              )
            : can("blast", "create") && (
                <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => setManual(true)}>
                  <i className="bi bi-plus-lg"></i>New List
                </button>
              )
        }
      />
      <Tabs
        tabs={[
          { value: "campaigns", label: <><i className="bi bi-send"></i>Campaigns</> },
          { value: "lists", label: <><i className="bi bi-people"></i>Recipient Lists</> },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "campaigns" ? (
        <CampaignsTab key={bump} onNew={() => setCreating({})} />
      ) : (
        <ListsTab
          key={bump}
          onManual={() => setManual(true)}
          onUse={(list) => { setTab("campaigns"); setCreating({ audienceType: "list", audienceRefs: [list._id] }); }}
        />
      )}
      {creating && (
        <CampaignForm
          initial={creating}
          listsVersion={bump}
          onClose={() => setCreating(null)}
          onSaved={() => { setCreating(null); setTab("campaigns"); setBump((b) => b + 1); }}
          onNewList={() => setManual(true)}
        />
      )}
      {manual && (
        <ListForm
          onClose={() => setManual(false)}
          onSaved={() => { setManual(false); setBump((b) => b + 1); }}
        />
      )}
    </div>
  );
}

/* ───────────── campaigns tab ───────────── */

function CampaignsTab({ onNew }) {
  const toast = useToast();
  const { can } = useAuth();
  const [filters, setFilters] = useState({ q: "", status: "" });
  const list = useApi(() => campaignsApi.list({ perPage: 200, ...filters }), [filters.q, filters.status]);
  const [report, setReport] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const rows = list.data || [];
  const running = rows.some((c) => c.status === "Running");

  // live counts while something is sending
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(async () => {
      try { list.setData(unwrap(await campaignsApi.list({ perPage: 200, ...filters }))); } catch { /* keep current */ }
    }, 4000);
    return () => clearInterval(t);
  }, [running, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  async function launch(c) {
    try {
      const r = unwrap(await campaignsApi.launch(c._id));
      toast(r?.scheduled ? `Scheduled for ${r.recipients} recipients` : `Sending to ${r?.recipients || 0} recipients`);
      list.reload();
    } catch (e) { toast(e.message, "error"); }
  }
  async function pause(c) {
    try { await campaignsApi.pause(c._id, c.status === "Running" ? "Paused" : "Running"); list.reload(); }
    catch (e) { toast(e.message, "error"); }
  }
  async function remove() {
    try { await campaignsApi.remove(confirmDel._id); toast("Campaign deleted"); setConfirmDel(null); list.reload(); }
    catch (e) { toast(e.message, "error"); }
  }

  const totals = rows.reduce((a, c) => ({ sent: a.sent + (c.sent || 0), delivered: a.delivered + (c.delivered || 0), read: a.read + (c.read || 0), failed: a.failed + (c.failed || 0) }), { sent: 0, delivered: 0, read: 0, failed: 0 });

  function exportExcel() {
    writeExcel("campaigns", ["Campaign", "Audience", "Template", "Status", "Recipients", "Sent", "Delivered", "Read", "Failed", "Created"],
      rows.map((c) => [c.name, c.audienceLabel || "", c.template, c.status, c.audienceSize || 0, c.sent, c.delivered, c.read, c.failed, formatDate(c.createdAt)]));
  }

  const columns = [
    { key: "name", label: "Campaign", render: (c) => (
      <div className="min-w-0">
        <div className="row-name">{c.name}</div>
        <div className="row-sub">
          {c.parentName ? <><i className="bi bi-arrow-repeat"></i> Resend of {c.parentName}</> : formatDate(c.createdAt)}
          {c.resends > 0 && <> · {c.resends} resend{c.resends > 1 ? "s" : ""}</>}
        </div>
        <div className="row-sub text-truncate" style={{ maxWidth: 320 }} title={c.template}>
          <i className="bi bi-file-earmark-text"></i> {c.template}{c.audienceSize > 0 ? ` · ${c.audienceSize} recipients` : ""}
        </div>
      </div>
    ) },
    { key: "status", label: "Status", render: (c) => (
      <div>
        <span className="pill" style={STATUS_STYLE[c.status]}>{c.status}</span>
        {c.status === "Scheduled" && c.scheduledFor && <div className="row-sub mt-1">{formatDateTime(c.scheduledFor)}</div>}
      </div>
    ) },
    { key: "progress", label: "Delivery", render: (c) => <MiniFunnel c={c} /> },
    { key: "act", label: "", align: "right", render: (c) => (
      <div className="d-inline-flex align-items-center gap-1 text-nowrap">
        {can("blast", "create") && (c.status === "Draft" || c.status === "Scheduled") && (
          <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={(e) => { e.stopPropagation(); launch(c); }}>
            <i className="bi bi-play-fill"></i>{c.status === "Scheduled" ? "Update" : "Launch"}
          </button>
        )}
        {can("blast", "edit") && (c.status === "Running" || c.status === "Paused") && (
          <IconBtn icon={c.status === "Running" ? "pause-fill" : "play-fill"} title={c.status === "Running" ? "Pause" : "Resume"} onClick={() => pause(c)} />
        )}
        <IconBtn icon="bar-chart-line" title="Report & resend" onClick={() => setReport(c._id)} />
        {can("blast", "del") && c.status !== "Running" && <IconBtn icon="trash3" title="Delete" danger onClick={() => setConfirmDel(c)} />}
      </div>
    ) },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatCard label="Sent" value={totals.sent} icon="send" tone="primary" hint={`${rows.length} campaigns`} />
        <StatCard label="Delivered" value={totals.delivered} icon="check2-all" tone="success" hint={`${pct(totals.delivered, totals.sent)}% of sent`} />
        <StatCard label="Read" value={totals.read} icon="eye" tone="info" hint={`${pct(totals.read, totals.delivered)}% of delivered`} />
        <StatCard label="Failed" value={totals.failed} icon="x-octagon" tone="destructive" hint={`${pct(totals.failed, totals.sent + totals.failed)}%`} />
      </div>
      <FilterBar>
        <div className="ui-search" style={{ minWidth: 240 }}>
          <span className="ui-search-icon"><i className="bi bi-search"></i></span>
          <input className="ui-search-input" placeholder="Search" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
        </div>
        <select className="ui-input" aria-label="Status" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All status</option>
          {Object.keys(STATUS_STYLE).map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="ui-btn ui-btn-outline ui-btn-sm ms-auto" onClick={exportExcel} disabled={!rows.length}>
          <i className="bi bi-file-earmark-excel"></i>Export Excel
        </button>
      </FilterBar>
      <ErrorBox error={list.error} />
      <DataTable
        columns={columns}
        rows={rows}
        loading={list.loading && !list.data}
        onRowClick={(c) => setReport(c._id)}
        empty={{ icon: "send", text: "No campaigns" }}
      />
      {!list.loading && !rows.length && can("blast", "create") && (
        <div className="text-center -mt-10 mb-4">
          <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={onNew}><i className="bi bi-plus-lg"></i>New Campaign</button>
        </div>
      )}
      {report && <CampaignReport id={report} onOpen={setReport} onClose={() => { setReport(null); list.reload(); }} />}
      {confirmDel && <Confirm title={`Delete "${confirmDel.name}"?`} danger confirmLabel="Delete" onConfirm={remove} onCancel={() => setConfirmDel(null)} />}
    </>
  );
}

// thin stacked bar: read / delivered / sent / failed out of the audience
function MiniFunnel({ c }) {
  const total = Math.max(c.audienceSize || 0, (c.sent || 0) + (c.failed || 0));
  const seg = [
    { n: c.read, color: "var(--info)" },
    { n: c.delivered - c.read, color: "var(--success)" },
    { n: c.sent - c.delivered, color: "color-mix(in srgb, var(--muted-foreground) 55%, transparent)" },
    { n: c.failed, color: "var(--destructive)" },
  ];
  const nums = [["Sent", c.sent, "var(--foreground)"], ["Delivered", c.delivered, "var(--success)"], ["Read", c.read, "var(--info)"], ["Failed", c.failed, c.failed ? "var(--destructive)" : "var(--foreground)"]];
  return (
    <div style={{ minWidth: 230, maxWidth: 320 }}>
      <div className="d-flex overflow-hidden" style={{ height: 6, borderRadius: 999, background: "var(--muted-background)" }}>
        {total > 0 && seg.map((x, i) => x.n > 0 && <span key={i} style={{ width: `${(x.n / total) * 100}%`, background: x.color }} />)}
      </div>
      <div className="d-flex justify-content-between gap-2 mt-1">
        {nums.map(([l, n, col]) => (
          <div key={l} className="text-center" style={{ lineHeight: 1.15 }}>
            <div className="fw-semibold small" style={{ color: col }}>{n || 0}</div>
            <div style={{ fontSize: 10.5, color: "var(--muted-foreground)" }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── new campaign ───────────── */

function ScheduleField({ when, setWhen }) {
  return (
    <div>
      <label className="form-label">Send</label>
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <div className="wa-chips">
          {[["now", "Now"], ["later", "Schedule"]].map(([v, l]) => (
            <button key={v} type="button" className={"wa-chip" + (when.mode === v ? " active" : "")} onClick={() => setWhen((w) => ({ ...w, mode: v }))}>{l}</button>
          ))}
        </div>
        {when.mode === "later" && (
          <>
            <DateInput className="ui-input" value={when.date} onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))} />
            <TimeInput value={when.time} onChange={(e) => setWhen((w) => ({ ...w, time: e.target.value }))} />
          </>
        )}
      </div>
    </div>
  );
}
const scheduleOf = (when) => {
  if (when.mode !== "later") return null;
  if (!when.date) throw new Error("Pick a date");
  const d = new Date(`${when.date}T${when.time || "09:00"}:00`);
  if (isNaN(d.getTime()) || d <= new Date()) throw new Error("Pick a time in the future");
  return d.toISOString();
};

// {{1}}, {{2}}… → name / phone / a list column / fixed text
function VariableFields({ count, variables, setVariables, columns }) {
  if (!count) return null;
  const set = (i, patch) => setVariables((vs) => { const n = [...vs]; n[i] = { ...(n[i] || { source: "name" }), ...patch }; return n; });
  return (
    <div>
      <label className="form-label">Template variables</label>
      <div className="d-flex flex-column gap-2">
        {Array.from({ length: count }, (_, i) => {
          const v = variables[i] || { source: i === 0 ? "name" : "text", value: "" };
          return (
            <div key={i} className="d-flex gap-2 align-items-center">
              <code className="flex-shrink-0" style={{ width: 44 }}>{`{{${i + 1}}}`}</code>
              <select className="ui-input" style={{ width: 140 }} value={v.source} onChange={(e) => set(i, { source: e.target.value, value: "" })}>
                <option value="name">Name</option>
                <option value="phone">Phone</option>
                {columns.length > 0 && <option value="column">List column</option>}
                <option value="text">Fixed text</option>
              </select>
              {v.source === "column" && (
                <select className="ui-input flex-grow-1" value={v.value} onChange={(e) => set(i, { value: e.target.value })}>
                  <option value="">—</option>
                  {columns.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
              {v.source === "text" && <input className="ui-input flex-grow-1" aria-label={`Value ${i + 1}`} value={v.value} onChange={(e) => set(i, { value: e.target.value })} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useApprovedTemplates() {
  const t = useApi(() => templatesApi.list({ status: "Approved", perPage: 200 }), []);
  return useMemo(() => (t.data || []).filter((x) => !x.channel || x.channel === "whatsapp"), [t.data]);
}

function CampaignForm({ initial, listsVersion, onClose, onSaved, onNewList }) {
  const toast = useToast();
  const templates = useApprovedTemplates();
  const lists = useApi(() => campaignListsApi.list(), [listsVersion]);
  const leadLists = useApi(() => crmApi.lists().catch(() => ({ data: [] })), []);
  const [form, setForm] = useState({ name: "", template: "", audienceType: initial.audienceType || "list", audienceRefs: initial.audienceRefs || [], category: "All" });
  const [variables, setVariables] = useState([]);
  const [when, setWhen] = useState({ mode: "now", date: "", time: "09:00" });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const tpl = templates.find((t) => t.name === form.template);
  const count = varCount(tpl?.body);
  const pickedLists = (lists.data || []).filter((l) => form.audienceRefs.includes(l._id));
  // columns any of the picked imported lists has (for template variables)
  const pickedColumns = [...new Set(pickedLists.flatMap((l) => l.columns || []))];
  const ready = form.name.trim() && form.template && (form.audienceType === "contacts" || form.audienceRefs.length > 0);

  async function save(launch) {
    setBusy(true);
    try {
      const body = { ...form, variables: Array.from({ length: count }, (_, i) => variables[i] || { source: i === 0 ? "name" : "text", value: "" }), scheduledFor: scheduleOf(when), launch };
      const r = unwrap(await campaignsApi.create(body));
      toast(!launch ? "Draft saved" : r?.launch?.scheduled ? "Campaign scheduled" : `Sending to ${r?.launch?.recipients || 0} recipients`);
      onSaved();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  const audienceTabs = [["list", "Imported list"], ["leadList", "Lead list"], ["contacts", "Contacts"]];

  return (
    <Modal
      title="New Campaign"
      size="lg"
      onClose={onClose}
      footer={<>
        <button className="ui-btn ui-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="ui-btn ui-btn-outline" disabled={!ready || busy} onClick={() => save(false)}>Save draft</button>
        <button className="ui-btn ui-btn-primary" disabled={!ready || busy} onClick={() => save(true)}>
          <i className="bi bi-send"></i>{busy ? "Working…" : when.mode === "later" ? "Schedule" : "Send now"}
        </button>
      </>}
    >
      <div className="d-flex flex-column gap-3">
        <div>
          <label className="form-label">Name *</label>
          <input className="ui-input w-100" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>

        <div>
          <label className="form-label">Recipients *</label>
          <div className="wa-chips mb-2">
            {audienceTabs.map(([v, l]) => (
              <button key={v} type="button" className={"wa-chip" + (form.audienceType === v ? " active" : "")} onClick={() => setForm((f) => ({ ...f, audienceType: v, audienceRefs: [] }))}>{l}</button>
            ))}
          </div>
          {form.audienceType === "list" && (
            <ListPicker type="list" items={lists.data || []} loading={lists.loading} value={form.audienceRefs} onChange={(v) => set("audienceRefs", v)} empty="No lists"
              extra={<button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={onNewList}><i className="bi bi-plus-lg"></i>New List</button>} />
          )}
          {form.audienceType === "leadList" && (
            <ListPicker type="leadList" items={leadLists.data || []} loading={leadLists.loading} value={form.audienceRefs} onChange={(v) => set("audienceRefs", v)} empty="No lead lists" />
          )}
          {form.audienceType === "contacts" && (
            <select className="ui-input w-100" aria-label="Category" value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="All">All opted-in contacts</option>
              <option>Utility</option><option>Marketing</option><option>Authentication</option>
            </select>
          )}
        </div>

        <div>
          <label className="form-label">Template *</label>
          <select className="ui-input w-100" value={form.template} onChange={(e) => { set("template", e.target.value); setVariables([]); }}>
            <option value="">Select template</option>
            {templates.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
          </select>
          {tpl?.body && <TemplatePreview body={tpl.body} />}
        </div>

        <VariableFields count={count} variables={variables} setVariables={setVariables} columns={form.audienceType === "list" ? pickedColumns : []} />
        <ScheduleField when={when} setWhen={setWhen} />
      </div>
    </Modal>
  );
}

/** Pick one or more lists; a number found in several lists is sent once. */
function ListPicker({ type, items, loading, value, onChange, empty, extra }) {
  const [q, setQ] = useState("");
  const [unique, setUnique] = useState(null);
  const key = value.join(",");
  useEffect(() => {
    setUnique(null);
    if (value.length < 2) return undefined;
    let live = true;
    const t = setTimeout(() => {
      campaignsAudienceApi.preview({ audienceType: type, audienceRefs: value }).then((r) => live && setUnique(unwrap(r)?.count ?? null)).catch(() => {});
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [type, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = items.filter((l) => !q.trim() || l.name.toLowerCase().includes(q.trim().toLowerCase()));
  const picked = items.filter((l) => value.includes(l._id));
  const total = picked.reduce((n, l) => n + (l.count || 0), 0);
  const allShownOn = shown.length > 0 && shown.every((l) => value.includes(l._id));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const toggleShown = () => onChange(allShownOn ? value.filter((id) => !shown.some((l) => l._id === id)) : [...new Set([...value, ...shown.map((l) => l._id)])]);

  return (
    <div className="border rounded-3 overflow-hidden">
      <div className="d-flex align-items-center gap-2 p-2 border-bottom" style={{ background: "var(--muted-background)" }}>
        <div className="ui-search flex-grow-1">
          <span className="ui-search-icon"><i className="bi bi-search"></i></span>
          <input className="ui-search-input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {shown.length > 1 && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={toggleShown}>{allShownOn ? "Clear" : "Select all"}</button>}
        {extra}
      </div>
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {loading && !items.length ? <div className="p-3 small text-muted">Loading…</div> : !shown.length ? <div className="p-3 small text-muted">{q ? "No match" : empty}</div> : shown.map((l) => {
          const on = value.includes(l._id);
          return (
            <label key={l._id} className="d-flex align-items-center gap-2 px-3 py-2 border-bottom mb-0" style={{ cursor: "pointer", background: on ? "color-mix(in srgb, var(--primary) 6%, transparent)" : undefined }}>
              <input type="checkbox" className="form-check-input m-0" checked={on} onChange={() => toggle(l._id)} />
              <span className="flex-grow-1 text-truncate small fw-medium">{l.name}</span>
              <span className="small text-muted">{l.count ?? 0}</span>
            </label>
          );
        })}
      </div>
      {picked.length > 0 && (
        <div className="px-3 py-2 small d-flex flex-wrap gap-2 align-items-center border-top" style={{ background: "var(--muted-background)" }}>
          <span className="fw-semibold"><i className="bi bi-people"></i> {picked.length} list{picked.length > 1 ? "s" : ""} · {picked.length > 1 && unique != null ? `${unique} unique numbers` : `${total} numbers`}</span>
          {picked.length > 1 && <span className="text-muted">{unique != null && unique < total ? `${total - unique} duplicates sent once` : "duplicates sent once"}</span>}
        </div>
      )}
    </div>
  );
}

function TemplatePreview({ body }) {
  return (
    <div className="mt-2 p-3 rounded-3" style={{ background: "color-mix(in srgb, var(--primary) 3%, var(--muted-background))", border: "1px solid var(--border)" }}>
      <div className="p-2 px-3 small" style={{ background: "color-mix(in srgb, var(--primary) 13%, var(--card))", border: "1px solid color-mix(in srgb, var(--primary) 22%, var(--card))", borderRadius: 10, borderTopRightRadius: 3, whiteSpace: "pre-wrap", maxWidth: 420, marginLeft: "auto" }}>
        {body}
      </div>
    </div>
  );
}

/* ───────────── report + resend + history ───────────── */

function CampaignReport({ id, onOpen, onClose }) {
  const toast = useToast();
  const { can } = useAuth();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const rep = useApi(() => campaignsApi.report(id, { status, q, page, perPage: 50 }), [id, status, q, page]);
  const [resending, setResending] = useState(null);
  const d = rep.data;
  const c = d?.campaign;

  useEffect(() => { setPage(1); }, [status, q, id]);
  useEffect(() => {
    if (c?.status !== "Running") return undefined;
    const t = setInterval(async () => {
      try { rep.setData(unwrap(await campaignsApi.report(id, { status, q, page, perPage: 50 }))); } catch { /* keep */ }
    }, 4000);
    return () => clearInterval(t);
  }, [c?.status, id, status, q, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function exportExcel() {
    try {
      const all = unwrap(await campaignsApi.report(id, { status, q, all: 1 }));
      writeExcel(`${c.name} report`, ["Name", "Phone", "Status", "Sent", "Delivered", "Read", "Failure reason", "How to fix", "Error code", "Raw error"],
        all.rows.map((r) => [r.name, r.phone, DELIVERY[r.status]?.label || r.status, formatDateTime(r.sentAt), formatDateTime(r.deliveredAt), formatDateTime(r.readAt), r.failTitle || "", r.failFix || "", r.failCode || "", r.failReason || ""]));
    } catch (e) { toast(e.message, "error"); }
  }

  if (!d) {
    return <Modal title="Campaign report" size="xl" onClose={onClose}>{rep.error ? <ErrorBox error={rep.error} /> : <Spinner />}</Modal>;
  }
  const s = d.summary;
  const ex = s.exact || {};
  const chips = [
    { v: "all", l: "All", n: s.audience },
    { v: "read", l: "Read", n: ex.read },
    { v: "delivered", l: "Delivered", n: ex.delivered },
    { v: "sent", l: "Sent", n: ex.sent },
    { v: "failed", l: "Failed", n: ex.failed },
    { v: "pending", l: "Not sent", n: ex.pending },
    ...(ex.queued ? [{ v: "queued", l: "Queued", n: ex.queued }] : []),
  ];
  const pages = Math.max(1, Math.ceil(d.total / d.perPage));

  return (
    <Modal
      title={
        <span className="d-inline-flex align-items-center gap-2 flex-wrap">
          {c.name}
          <span className="pill" style={STATUS_STYLE[c.status]}>{c.status}</span>
        </span>
      }
      size="xl"
      onClose={onClose}
      footer={<>
        <button className="ui-btn ui-btn-outline" onClick={exportExcel}><i className="bi bi-file-earmark-excel"></i>Export Excel</button>
        {can("blast", "create") && (
          <button className="ui-btn ui-btn-primary" onClick={() => setResending(ex.failed ? ["failed"] : ex.delivered ? ["delivered"] : [])}>
            <i className="bi bi-arrow-repeat"></i>Resend
          </button>
        )}
      </>}
    >
      <div className="d-flex flex-wrap gap-3 small text-muted mb-3">
        <span><i className="bi bi-people"></i> {c.audienceLabel || "Opted-in contacts"}</span>
        <span><i className="bi bi-file-earmark-text"></i> <span className="font-monospace">{c.template}</span></span>
        {c.launchedAt && <span><i className="bi bi-clock"></i> {formatDateTime(c.launchedAt)}</span>}
        {c.createdBy && <span><i className="bi bi-person"></i> {c.createdBy}</span>}
        {d.parent && (
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" style={{ height: "auto", padding: 0 }} onClick={() => onOpen(d.parent._id)}>
            <i className="bi bi-arrow-repeat"></i>Resend of {d.parent.name}
          </button>
        )}
      </div>

      <div className="rep-tiles mb-3">
        {chips.map((ch) => (
          <button key={ch.v} type="button" className={"rep-tile" + (status === ch.v ? " on" : "")} style={{ "--tone": TILE_TONE[ch.v] }} onClick={() => setStatus(ch.v)}>
            <span className="rep-tile-label"><i className={`bi bi-${TILE_ICON[ch.v]}`}></i>{ch.v === "all" ? "Recipients" : ch.l}</span>
            <span className="rep-tile-value">{ch.n || 0}</span>
            <span className="rep-tile-hint">{tileHint(ch.v, s, ex)}</span>
          </button>
        ))}
      </div>

      <FunnelBar s={s} />

      {(d.failures || []).length > 0 && (
        <div className="rounded-3 border mt-3 overflow-hidden" style={{ borderColor: "color-mix(in srgb, var(--destructive) 30%, var(--border))" }}>
          <div className="px-3 py-2 small fw-semibold d-flex align-items-center gap-2" style={{ background: "var(--destructive-bg)", color: "var(--destructive)" }}>
            <i className="bi bi-exclamation-triangle"></i>Why messages failed
          </div>
          {d.failures.map((f) => (
            <button key={f.code || f.title} type="button" className="w-100 text-start d-flex gap-3 px-3 py-2 border-top bg-transparent border-0" style={{ borderTop: "1px solid var(--border)" }} onClick={() => setStatus("failed")} title="Show these recipients">
              <span className="fw-bold small" style={{ color: "var(--destructive)", minWidth: 28 }}>{f.count}</span>
              <span className="flex-grow-1">
                <span className="small fw-semibold d-block">{f.title}{f.code ? <span className="fw-normal text-muted"> · #{f.code}</span> : null}</span>
                {f.fix && <span className="small text-muted d-block" style={{ lineHeight: 1.35 }}>{f.fix}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="d-flex flex-wrap align-items-center gap-2 my-3">
        <span className="small text-muted">{d.total} {status === "all" ? "recipients" : (chips.find((x) => x.v === status)?.l || "").toLowerCase()}</span>
        <div className="ui-search ms-auto" style={{ minWidth: 200 }}>
          <span className="ui-search-icon"><i className="bi bi-search"></i></span>
          <input className="ui-search-input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <DataTable
        rowKey="phone"
        loading={rep.loading && !d.rows}
        rows={d.rows}
        empty={{ icon: "inbox", text: "No recipients" }}
        columns={[
          { key: "name", label: "Recipient", render: (r) => <div><div className="row-name">{r.name || "—"}</div><div className="row-sub">{r.phone}</div></div> },
          { key: "status", label: "Status", render: (r) => <span className="pill" style={DELIVERY[r.status]?.style}>{DELIVERY[r.status]?.label || r.status}</span> },
          { key: "sentAt", label: "Sent", render: (r) => <span className="small">{formatDateTime(r.sentAt)}</span> },
          { key: "deliveredAt", label: "Delivered", render: (r) => <span className="small">{formatDateTime(r.deliveredAt)}</span> },
          { key: "readAt", label: "Read", render: (r) => <span className="small">{formatDateTime(r.readAt)}</span> },
          { key: "failReason", label: "Reason", render: (r) => r.status === "failed" ? (
            <div style={{ maxWidth: 260 }}>
              <div className="small fw-semibold" style={{ color: "var(--destructive)" }}>{r.failTitle || "Failed"}{r.failCode ? <span className="fw-normal text-muted"> · #{r.failCode}</span> : null}</div>
              {r.failFix && <div className="small text-muted" style={{ lineHeight: 1.35 }}>{r.failFix}</div>}
            </div>
          ) : <span className="text-muted">—</span> },
        ]}
      />
      {pages > 1 && (
        <div className="d-flex justify-content-end align-items-center gap-2 mt-2 small">
          <span className="text-muted">{d.total} · page {page} of {pages}</span>
          <IconBtn icon="chevron-left" title="Previous" onClick={() => setPage((p) => Math.max(1, p - 1))} />
          <IconBtn icon="chevron-right" title="Next" onClick={() => setPage((p) => Math.min(pages, p + 1))} />
        </div>
      )}

      <div className="mt-4">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="text-sm font-semibold text-foreground">Resend history</div>
        </div>
        {!d.resends.length ? (
          <div className="rounded-xl border p-3 small text-muted">No resends</div>
        ) : (
          <DataTable
            rows={d.resends}
            onRowClick={(x) => onOpen(x._id)}
            columns={[
              { key: "name", label: "Campaign", render: (x) => <div><div className="row-name">{x.name}</div><div className="row-sub">{formatDateTime(x.launchedAt || x.createdAt)}{x.createdBy ? ` · ${x.createdBy}` : ""}</div></div> },
              { key: "to", label: "Sent to", render: (x) => <span className="small">{(x.resendStatuses || []).map((v) => RESEND_OPTIONS.find((o) => o.value === v)?.label || v).join(", ")}</span> },
              { key: "status", label: "Status", render: (x) => <span className="pill" style={STATUS_STYLE[x.status]}>{x.status}</span> },
              { key: "audienceSize", label: "Recipients", align: "right", render: (x) => x.audienceSize || 0 },
              { key: "delivered", label: "Delivered", align: "right", render: (x) => x.delivered },
              { key: "read", label: "Read", align: "right", render: (x) => x.read },
              { key: "failed", label: "Failed", align: "right", render: (x) => <span style={{ color: x.failed ? "var(--err)" : "inherit" }}>{x.failed}</span> },
            ]}
          />
        )}
      </div>

      {resending && (
        <ResendForm
          campaign={c}
          exact={ex}
          initialStatuses={resending}
          onClose={() => setResending(null)}
          onDone={(newId) => { setResending(null); rep.reload(); if (newId) onOpen(newId); }}
        />
      )}
    </Modal>
  );
}

const TILE_TONE = { all: "var(--primary)", read: "var(--info)", delivered: "var(--success)", sent: "var(--primary)", failed: "var(--destructive)", pending: "var(--muted-foreground)", queued: "var(--warning, #b45309)" };
const TILE_ICON = { all: "people", read: "eye", delivered: "check2-all", sent: "send", failed: "x-octagon", pending: "hourglass", queued: "clock" };
function tileHint(v, s, ex) {
  if (v === "all") return s.audience ? "in this campaign" : "—";
  if (v === "sent") return `${pct(s.sent, s.audience)}% of recipients`;
  if (v === "delivered") return `${pct(s.delivered, s.sent)}% of sent`;
  if (v === "read") return `${pct(s.read, s.delivered)}% of delivered`;
  if (v === "failed") return `${pct(s.failed, s.audience)}% of recipients`;
  if (v === "pending") return "not sent yet";
  return "";
}

function FunnelBar({ s }) {
  const total = s.audience || 1;
  const seg = [
    { n: s.read, color: "var(--info)", l: "Read" },
    { n: s.delivered - s.read, color: "var(--success)", l: "Delivered" },
    { n: s.sent - s.delivered, color: "color-mix(in srgb, var(--muted-foreground) 55%, transparent)", l: "Sent" },
    { n: s.failed, color: "var(--destructive)", l: "Failed" },
  ];
  return (
    <div>
      <div className="d-flex overflow-hidden" style={{ height: 10, borderRadius: 999, background: "var(--muted-background)" }}>
        {seg.map((x) => x.n > 0 && <span key={x.l} title={`${x.l}: ${x.n}`} style={{ width: `${(x.n / total) * 100}%`, background: x.color }} />)}
      </div>
      <div className="d-flex flex-wrap gap-3 mt-2 small text-muted">
        {seg.filter((x) => x.n > 0).map((x) => (
          <span key={x.l} className="d-inline-flex align-items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: 2, background: x.color }} />{x.l} {Math.max(0, x.n)}
          </span>
        ))}
        {s.pending > 0 && <span className="d-inline-flex align-items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--muted-background)", border: "1px solid var(--border)" }} />Not sent {s.pending}</span>}
      </div>
    </div>
  );
}

function ResendForm({ campaign, exact, initialStatuses, onClose, onDone }) {
  const toast = useToast();
  const templates = useApprovedTemplates();
  const [statuses, setStatuses] = useState(initialStatuses);
  const [name, setName] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [template, setTemplate] = useState(campaign.template);
  const [variables, setVariables] = useState(campaign.variables || []);
  const [when, setWhen] = useState({ mode: "now", date: "", time: "09:00" });
  const [busy, setBusy] = useState(false);
  const tpl = templates.find((t) => t.name === template);
  const count = varCount(tpl?.body);
  const recipients = statuses.reduce((n, st) => n + (exact[st] || 0), 0);
  const toggle = (v) => setStatuses((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  async function save(launch) {
    if (!name.trim()) { setNameErr("Required"); return; }
    setBusy(true);
    try {
      const r = unwrap(await campaignsApi.resend(campaign._id, {
        name, template, statuses, launch, scheduledFor: scheduleOf(when),
        variables: Array.from({ length: count }, (_, i) => variables[i] || { source: i === 0 ? "name" : "text", value: "" }),
      }));
      toast(!launch ? "Resend saved as draft" : r?.launch?.scheduled ? "Resend scheduled" : `Resending to ${r?.launch?.recipients || 0} recipients`);
      onDone(r?.campaign?._id);
    } catch (e) { if (/name/i.test(e.message)) setNameErr(e.message); else toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      title={`Resend · ${campaign.name}`}
      onClose={onClose}
      footer={<>
        <button className="ui-btn ui-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="ui-btn ui-btn-outline" disabled={busy || !recipients} onClick={() => save(false)}>Save draft</button>
        <button className="ui-btn ui-btn-primary" disabled={busy || !recipients || !template} onClick={() => save(true)}>
          <i className="bi bi-send"></i>{busy ? "Working…" : `${when.mode === "later" ? "Schedule" : "Send"} to ${recipients}`}
        </button>
      </>}
    >
      <div className="d-flex flex-column gap-3">
        <div>
          <label className="form-label">New campaign name *</label>
          <input className="ui-input w-100" value={name} autoFocus onChange={(e) => { setName(e.target.value); setNameErr(""); }} />
          {nameErr ? <div className="small text-danger mt-1">{nameErr}</div> : <div className="small text-muted mt-1">Saved as a new campaign in the list</div>}
        </div>
        <div>
          <label className="form-label">Send to *</label>
          <div className="d-flex flex-column gap-1">
            {RESEND_OPTIONS.filter((o) => o.value !== "queued" || exact.queued).map((o) => (
              <label key={o.value} className={"d-flex align-items-center gap-2 rounded-3 border px-3 py-2 m-0 cursor-pointer" + (!exact[o.value] ? " opacity-50" : "")}
                style={statuses.includes(o.value) ? { borderColor: "var(--primary)", background: "var(--accent)" } : undefined}>
                <input type="checkbox" className="form-check-input m-0" style={{ minHeight: 0 }} checked={statuses.includes(o.value)} disabled={!exact[o.value]} onChange={() => toggle(o.value)} />
                <span className="flex-grow-1 small">{o.label}</span>
                <span className="pill" style={DELIVERY[o.value]?.style}>{exact[o.value] || 0}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="form-label">Template *</label>
          <select className="ui-input w-100" value={template} onChange={(e) => { setTemplate(e.target.value); setVariables([]); }}>
            <option value="">Select template</option>
            {templates.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}
          </select>
          {tpl?.body && <TemplatePreview body={tpl.body} />}
        </div>
        <VariableFields count={count} variables={variables} setVariables={setVariables} columns={[]} />
        <ScheduleField when={when} setWhen={setWhen} />
      </div>
    </Modal>
  );
}

/* ───────────── recipient lists ───────────── */

function ListsTab({ onManual, onUse }) {
  const toast = useToast();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [source, setSource] = useState("");
  const [owner, setOwner] = useState("");
  const lists = useApi(() => campaignListsApi.list({ q, source, owner }), [q, source, owner]);
  const sources = useListSources();
  const owners = useListOwners();
  const [viewing, setViewing] = useState(null);
  const [appending, setAppending] = useState(null);
  const [adding, setAdding] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  async function remove() {
    try { await campaignListsApi.remove(confirmDel._id); toast("List deleted"); setConfirmDel(null); lists.reload(); }
    catch (e) { toast(e.message, "error"); setConfirmDel(null); }
  }

  return (
    <>
      <FilterBar>
        <div className="ui-search" style={{ minWidth: 240 }}>
          <span className="ui-search-icon"><i className="bi bi-search"></i></span>
          <input className="ui-search-input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="ui-input" style={{ width: "auto" }} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          {sources.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
        </select>
        <select className="ui-input" style={{ width: "auto" }} value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">All owners</option>
          {owners.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
        </select>
      </FilterBar>
      <ErrorBox error={lists.error} />
      <DataTable
        rows={lists.data}
        loading={lists.loading}
        onRowClick={(l) => setViewing(l)}
        empty={{ icon: "people", text: "No lists" }}
        columns={[
          { key: "name", label: "List", render: (l) => <div><div className="row-name">{l.name}</div>{l.fileName && <div className="row-sub"><i className="bi bi-file-earmark-spreadsheet"></i> {l.fileName}</div>}</div> },
          { key: "source", label: "Source", render: (l) => <SourceBadge source={l.source} /> },
          { key: "owner", label: "Owner", render: (l) => l.owner?.name || <span className="text-muted">—</span> },
          { key: "count", label: "Numbers", align: "right", render: (l) => <span className="fw-semibold">{l.count}</span> },
          { key: "campaigns", label: "Campaigns", align: "right", render: (l) => l.campaigns || 0 },
          { key: "createdAt", label: "Imported", render: (l) => <div><div className="small">{formatDate(l.createdAt)}</div>{l.createdBy && <div className="row-sub">{l.createdBy}</div>}</div> },
          { key: "act", label: "", align: "right", render: (l) => (
            <div className="d-inline-flex align-items-center gap-1">
              {can("blast", "create") && l.count > 0 && (
                <button className="ui-btn ui-btn-outline ui-btn-sm" onClick={(e) => { e.stopPropagation(); onUse(l); }}>
                  <i className="bi bi-send"></i>Send
                </button>
              )}
              {can("blast", "create") && <IconBtn icon="upload" title="Import recipients" onClick={() => setAppending(l)} />}
              {can("blast", "create") && <IconBtn icon="person-plus" title="Add recipient" onClick={() => setAdding(l)} />}
              <IconBtn icon="eye" title="View" onClick={() => setViewing(l)} />
              {can("blast", "edit") && <IconBtn icon="pencil" title="Edit" onClick={() => setEditing(l)} />}
              {can("blast", "del") && <IconBtn icon="trash3" title="Delete" danger onClick={() => setConfirmDel(l)} />}
            </div>
          ) },
        ]}
      />
      {!lists.loading && !(lists.data || []).length && can("blast", "create") && (
        <div className="text-center -mt-10 mb-4">
          <button className="ui-btn ui-btn-primary ui-btn-sm" onClick={onManual}><i className="bi bi-plus-lg"></i>New List</button>
        </div>
      )}
      {viewing && <ListView list={viewing} onClose={() => { setViewing(null); lists.reload(); }} onUse={() => { const l = viewing; setViewing(null); onUse(l); }} />}
      {appending && <ImportList appendTo={appending} onClose={() => setAppending(null)} onDone={() => { setAppending(null); lists.reload(); }} />}
      {adding && <ContactForm list={adding} onClose={() => { setAdding(null); lists.reload(); }} onSaved={() => { setAdding(null); lists.reload(); }} />}
      {editing && <ListForm list={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); lists.reload(); }} />}
      {confirmDel && <Confirm title={`Delete "${confirmDel.name}"?`} text={`${confirmDel.count} numbers`} danger confirmLabel="Delete" onConfirm={remove} onCancel={() => setConfirmDel(null)} />}
    </>
  );
}

function ListView({ list, onClose, onUse }) {
  const toast = useToast();
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const data = useApi(() => campaignListsApi.get(list._id, { q, page, perPage: 50 }), [list._id, q, page]);
  const [name, setName] = useState(list.name);
  const [source, setSource] = useState(list.source?._id || list.source || "");
  const [owner, setOwner] = useState(list.owner?._id || list.owner || "");
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const sources = useListSources();
  const owners = useListOwners();
  const d = data.data;
  const pages = d ? Math.max(1, Math.ceil(d.total / d.perPage)) : 1;
  const columns = d?.columns || list.columns || [];

  useEffect(() => { setPage(1); }, [q]);

  async function rename() {
    if (!name.trim() || name === list.name) return;
    try { await campaignListsApi.rename(list._id, name.trim()); toast("Renamed"); } catch (e) { toast(e.message, "error"); setName(list.name); }
  }
  async function changeSource(v) {
    const prev = source;
    setSource(v);
    try { await campaignListsApi.update(list._id, { source: v || null }); toast("Source updated"); } catch (e) { toast(e.message, "error"); setSource(prev); }
  }
  async function changeOwner(v) {
    const prev = owner;
    setOwner(v);
    try { await campaignListsApi.update(list._id, { owner: v || null }); toast("Owner updated"); } catch (e) { toast(e.message, "error"); setOwner(prev); }
  }
  async function removeRow(phone) {
    try { await campaignListsApi.removeRow(list._id, phone); data.reload(); } catch (e) { toast(e.message, "error"); }
  }
  async function exportExcel() {
    const all = unwrap(await campaignListsApi.get(list._id, { all: 1 }));
    const cols = all.columns || columns;
    writeExcel(list.name, ["Name", "Mobile Number", ...cols], all.rows.map((r) => [r.name, r.phone, ...cols.map((c) => r.extra?.[c] || "")]));
  }

  return (
    <Modal
      title={list.name}
      size="wide"
      onClose={onClose}
      footer={<>
        <button className="ui-btn ui-btn-outline" onClick={exportExcel}><i className="bi bi-file-earmark-excel"></i>Export Excel</button>
        {can("blast", "create") && <button className="ui-btn ui-btn-outline" onClick={() => setUploading(true)}><i className="bi bi-upload"></i>Import recipients</button>}
        {can("blast", "create") && <button className="ui-btn ui-btn-outline" onClick={() => setAdding(true)}><i className="bi bi-person-plus"></i>Add recipient</button>}
        {can("blast", "create") && (d?.total ?? list.count) > 0 && <button className="ui-btn ui-btn-primary" onClick={onUse}><i className="bi bi-send"></i>Send campaign</button>}
      </>}
    >
      <div className="row g-2 mb-3">
        <div className="col-12">
          <label className="form-label">Name</label>
          <input className="ui-input w-100" value={name} disabled={!can("blast", "edit")} onChange={(e) => setName(e.target.value)} onBlur={rename} />
        </div>
        <div className="col-6">
          <label className="form-label">Source</label>
          <select className="ui-input w-100" value={source} disabled={!can("blast", "edit")} onChange={(e) => changeSource(e.target.value)}>
            <option value="">None</option>
            {sources.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
          </select>
        </div>
        <div className="col-6">
          <label className="form-label">Owner</label>
          <select className="ui-input w-100" value={owner} disabled={!can("blast", "edit")} onChange={(e) => changeOwner(e.target.value)}>
            <option value="">None</option>
            {owners.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
          </select>
        </div>
        <div className="col-12">
          <div className="ui-search w-100">
            <span className="ui-search-icon"><i className="bi bi-search"></i></span>
            <input className="ui-search-input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>
      <DataTable
        rowKey="phone"
        rows={d?.rows}
        loading={data.loading && !d}
        empty={{ icon: "people", text: "No numbers" }}
        columns={[
          { key: "name", label: "Name", render: (r) => r.name || "—" },
          { key: "phone", label: "Mobile", render: (r) => <span className="font-monospace small">{r.phone}</span> },
          ...[...columns.filter((c) => VIEW_COLS.includes(c)), ...columns.filter((c) => !VIEW_COLS.includes(c))].slice(0, 2).map((col) => ({ key: col, label: col, render: (r) => <span className="small">{r.extra?.[col] || "—"}</span> })),
          ...(can("blast", "edit") ? [{ key: "act", label: "", align: "right", render: (r) => <IconBtn icon="x-lg" title="Remove" danger onClick={() => removeRow(r.phone)} /> }] : []),
        ]}
      />
      {d && (
        <div className="d-flex justify-content-end align-items-center gap-2 mt-2 small">
          <span className="text-muted">{d.total} numbers{pages > 1 ? ` · page ${page} of ${pages}` : ""}</span>
          {pages > 1 && <>
            <IconBtn icon="chevron-left" title="Previous" onClick={() => setPage((p) => Math.max(1, p - 1))} />
            <IconBtn icon="chevron-right" title="Next" onClick={() => setPage((p) => Math.min(pages, p + 1))} />
          </>}
        </div>
      )}
      {uploading && <ImportList appendTo={{ ...list, source: sources.find((x) => x._id === source) || null }} onClose={() => setUploading(false)} onDone={() => { setUploading(false); data.reload(); }} />}
      {adding && <ContactForm list={{ ...list, source: sources.find((x) => x._id === source) || null }} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); data.reload(); }} />}
    </Modal>
  );
}

function SourceBadge({ source }) {
  if (!source?.name) return <span className="text-muted">—</span>;
  const c = source.color || "#6366f1";
  return <span className="badge rounded-pill" style={{ background: `${c}1f`, color: c }}>{source.name}</span>;
}

function useListOwners() {
  const [list, setList] = useState([]);
  useEffect(() => { campaignListsApi.owners().then((r) => setList(unwrap(r) || [])).catch(() => {}); }, []);
  return list;
}

/** Create or edit a list (name, source, owner). Recipients are added from the list's actions. */
function ListForm({ list, onClose, onSaved }) {
  const toast = useToast();
  const { user } = useAuth();
  const sources = useListSources();
  const owners = useListOwners();
  const [f, setF] = useState({ name: list?.name || "", source: list?.source?._id || "", owner: list?.owner?._id || "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const me = String(user?.id || user?._id || "");
    if (!list && !f.owner && me && owners.some((o) => o._id === me)) setF((x) => ({ ...x, owner: me }));
  }, [owners]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!f.name.trim()) return setErr("Required");
    setBusy(true);
    try {
      const body = { name: f.name.trim(), source: f.source || null, owner: f.owner || null };
      if (list) await campaignListsApi.update(list._id, body); else await campaignListsApi.create(body);
      toast(list ? "List updated" : "List created");
      onSaved();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  return (
    <Modal
      title={list ? "Edit List" : "New List"}
      onClose={onClose}
      footer={<>
        <button className="ui-btn ui-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        <button className="ui-btn ui-btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </>}
    >
      <div className="d-flex flex-column gap-3">
        <div>
          <label className="form-label">List name *</label>
          <input className="ui-input w-100" value={f.name} autoFocus onChange={(e) => { setF((x) => ({ ...x, name: e.target.value })); setErr(""); }} />
          {err && <div className="small text-danger mt-1">{err}</div>}
        </div>
        <div>
          <label className="form-label">Source</label>
          <select className="ui-input w-100" value={f.source} onChange={(e) => setF((x) => ({ ...x, source: e.target.value }))}>
            <option value="">None</option>
            {sources.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Owner</label>
          <select className="ui-input w-100" value={f.owner} onChange={(e) => setF((x) => ({ ...x, owner: e.target.value }))}>
            <option value="">None</option>
            {owners.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

function useListSources() {
  const [list, setList] = useState([]);
  useEffect(() => { campaignListsApi.sources().then((r) => setList(unwrap(r) || [])).catch(() => {}); }, []);
  return list;
}

/* Standard contact fields kept on every list row (Name and Mobile Number are the row's own name / phone). */
const CONTACT_FIELDS = [
  { label: "Email ID", match: ["email", "email id", "mail", "email address"] },
  { label: "Father Name", match: ["father name", "fathers name", "father"] },
  { label: "Father Mobile", match: ["father mobile", "father mobile number", "father phone", "father contact"] },
  { label: "Father Email", match: ["father email", "father email id"] },
  { label: "Mother Name", match: ["mother name", "mothers name", "mother"] },
  { label: "Mother Mobile", match: ["mother mobile", "mother mobile number", "mother phone", "mother contact"] },
  { label: "Mother Email", match: ["mother email", "mother email id"] },
  { label: "Location", match: ["location", "area", "locality"] },
  { label: "City", match: ["city", "town"] },
  { label: "State", match: ["state", "province"] },
  { label: "Country", match: ["country"] },
  { label: "Address", match: ["address", "full address", "postal address"] },
  { label: "Source", match: ["source", "lead source"] },
];
const FIELD_LABELS = CONTACT_FIELDS.map((f) => f.label);
const VIEW_COLS = ["Email ID", "Father Name", "City", "Source"];

/** Manual entry of recipients into a list. */
function ContactForm({ list, onClose, onSaved }) {
  const toast = useToast();
  const sources = useListSources();
  const blank = (src) => ({ name: "", phone: "", Source: src || "" });
  const [f, setF] = useState(blank(list?.source?.name));
  const [open, setOpen] = useState({ parents: false, address: false });
  const [err, setErr] = useState("");
  const [added, setAdded] = useState(0);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); if (k === "phone") setErr(""); };
  const filledIn = (keys) => keys.filter((k) => String(f[k] || "").trim()).length;

  const toRow = (x) => ({
    name: String(x.name || "").trim(),
    phone: String(x.phone || "").trim(),
    extra: Object.fromEntries(FIELD_LABELS.map((l) => [l, String(x[l] || "").trim()]).filter(([, v]) => v)),
  });

  async function save(again) {
    if (!f.phone.trim()) return setErr("Required");
    setBusy(true);
    try {
      const res = unwrap(await campaignListsApi.append(list._id, { columns: FIELD_LABELS, rows: [toRow(f)] }));
      if (!res.summary.valid) return setErr(res.summary.duplicates ? "Already in this list" : "Invalid number");
      if (!again) { toast("Recipient added"); return onSaved(); }
      setAdded((n) => n + 1);
      setF(blank(f.Source));
      nameRef.current?.focus();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  const field = (k, type = "text", extra = {}) => (
    <input className="ui-input w-100" type={type} value={f[k] || ""} onChange={set(k)} {...extra} />
  );
  // a plain render helper (not a component) so inputs inside keep focus while typing
  const section = (id, icon, label, keys, children) => {
    const n = filledIn(keys);
    return (
      <div className="border rounded-3">
        <button type="button" className="w-100 d-flex align-items-center gap-2 px-3 py-2 bg-transparent border-0 small fw-semibold" onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}>
          <i className={`bi bi-${icon} text-muted`}></i>{label}
          {n > 0 && <span className="badge rounded-pill text-bg-light border">{n}</span>}
          <i className={`bi bi-chevron-${open[id] ? "up" : "down"} ms-auto text-muted`}></i>
        </button>
        {open[id] && <div className="px-3 pb-3">{children}</div>}
      </div>
    );
  };
  const PARENT_KEYS = ["Father Name", "Father Mobile", "Father Email", "Mother Name", "Mother Mobile", "Mother Email"];
  const ADDRESS_KEYS = ["Address", "Location", "City", "State", "Country"];

  return (
    <Modal
      title={`Add recipient · ${list.name}`}
      onClose={onClose}
      footer={<>
        {added > 0 && <span className="small text-muted me-auto"><i className="bi bi-check2-circle text-success"></i> {added} added</span>}
        <button className="ui-btn ui-btn-outline" onClick={() => (added ? onSaved() : onClose())} disabled={busy}>{added ? "Done" : "Cancel"}</button>
        <button className="ui-btn ui-btn-outline" onClick={() => save(true)} disabled={busy}><i className="bi bi-plus-lg"></i>Add another</button>
        <button className="ui-btn ui-btn-primary" onClick={() => save(false)} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </>}
    >
      <form className="d-flex flex-column gap-3" onSubmit={(e) => { e.preventDefault(); save(true); }}>
        <div className="row g-2">
          <div className="col-sm-6">
            <label className="form-label">Name</label>
            {field("name", "text", { ref: nameRef, autoFocus: true })}
          </div>
          <div className="col-sm-6">
            <label className="form-label">Mobile *</label>
            {field("phone", "tel", { inputMode: "tel" })}
            {err && <div className="small text-danger mt-1">{err}</div>}
          </div>
          <div className="col-sm-6">
            <label className="form-label">Email</label>
            {field("Email ID", "email")}
          </div>
          <div className="col-sm-6">
            <label className="form-label">Source</label>
            <select className="ui-input w-100" value={f.Source || ""} onChange={set("Source")}>
              <option value="">None</option>
              {sources.map((x) => <option key={x._id} value={x.name}>{x.name}</option>)}
            </select>
          </div>
        </div>

        {section("parents", "people", "Parents", PARENT_KEYS, <>
          <div className="row g-2 d-none d-sm-flex small text-muted fw-semibold">
            <div className="col-sm-2"></div><div className="col-sm-4">Name</div><div className="col-sm-3">Mobile</div><div className="col-sm-3">Email</div>
          </div>
          {["Father", "Mother"].map((p) => (
            <div className="row g-2 align-items-center mt-1" key={p}>
              <div className="col-12 col-sm-2 small fw-semibold">{p}</div>
              <div className="col-sm-4"><label className="form-label d-sm-none">Name</label>{field(`${p} Name`)}</div>
              <div className="col-6 col-sm-3"><label className="form-label d-sm-none">Mobile</label>{field(`${p} Mobile`, "tel", { inputMode: "tel" })}</div>
              <div className="col-6 col-sm-3"><label className="form-label d-sm-none">Email</label>{field(`${p} Email`, "email")}</div>
            </div>
          ))}
        </>)}

        {section("address", "geo-alt", "Address", ADDRESS_KEYS, <>
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label">Address</label>
              <textarea className="ui-input w-100" rows={2} value={f.Address || ""} onChange={set("Address")} />
            </div>
            {["Location", "City", "State", "Country"].map((k) => (
              <div className="col-6 col-md-3" key={k}>
                <label className="form-label">{k}</label>
                {field(k)}
              </div>
            ))}
          </div>
        </>)}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

const norm = (s) => String(s || "").trim().toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ");
const NAME_COLS = ["name", "full name", "contact name", "student name", "customer name", "lead name"];
const PHONE_COLS = ["phone", "mobile", "mobile number", "phone number", "whatsapp", "whatsapp number", "contact", "contact number", "number"];

// Import a CSV / Excel file as a new list, or add its numbers to an existing one.
function ImportList({ appendTo, onClose, onDone }) {
  const toast = useToast();
  const [file, setFile] = useState(null); // { name, headers, rows }
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const sources = useListSources();
  const [map, setMap] = useState({ name: "", phone: "" });
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);

  async function read(f) {
    if (!f) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheet = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
      const headers = (sheet[0] || []).map((h, i) => String(h).trim() || `Column ${i + 1}`);
      const rows = sheet.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
      if (!headers.length || !rows.length) throw new Error("The file has no rows");
      const ni = headers.findIndex((h) => NAME_COLS.includes(norm(h)));
      const pi = headers.findIndex((h) => PHONE_COLS.includes(norm(h)));
      const auto = { name: ni >= 0 ? ni : "", phone: pi >= 0 ? pi : "" };
      for (const fd of CONTACT_FIELDS) {
        const i = headers.findIndex((h, idx) => idx !== ni && idx !== pi && (fd.match.includes(norm(h)) || norm(h) === norm(fd.label)));
        auto[fd.label] = i >= 0 ? i : "";
      }
      setFile({ name: f.name, headers, rows });
      setMap(auto);
      if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
      setCheck(null);
    } catch (e) { toast(e.message || "Could not read the file", "error"); }
  }

  const usedIdx = new Set(Object.values(map).filter((v) => v !== ""));
  // standard fields keep their standard label; any other file column is kept under its own header
  const extraCols = file ? [
    ...CONTACT_FIELDS.filter((fd) => map[fd.label] !== "" && map[fd.label] !== undefined).map((fd) => [fd.label, map[fd.label]]),
    ...file.headers.map((h, i) => [h, i]).filter(([, i]) => !usedIdx.has(i)),
  ] : [];
  const setCol = (k) => (e) => { setMap((m) => ({ ...m, [k]: e.target.value === "" ? "" : Number(e.target.value) })); setCheck(null); };
  // rows without their own Source column take the list's source
  const listSrcName = appendTo ? appendTo.source?.name || "" : sources.find((x) => x._id === source)?.name || "";
  const fillSource = listSrcName && (map.Source === "" || map.Source === undefined);
  const payload = () => ({
    name: name.trim(),
    ...(appendTo ? {} : { source: source || null }),
    fileName: file.name,
    columns: [...extraCols.map(([h]) => h), ...(fillSource ? ["Source"] : [])],
    rows: file.rows.map((r) => ({
      name: map.name === "" ? "" : String(r[map.name] ?? "").trim(),
      phone: String(r[map.phone] ?? "").trim(),
      extra: { ...Object.fromEntries(extraCols.map(([h, i]) => [h, String(r[i] ?? "").trim()])), ...(fillSource ? { Source: listSrcName } : {}) },
    })),
  });

  async function send(dryRun) {
    setBusy(true);
    try {
      const body = { ...payload(), dryRun };
      const res = unwrap(appendTo ? await campaignListsApi.append(appendTo._id, body) : await campaignListsApi.importRows(body));
      if (dryRun) setCheck(res.summary);
      else { toast(appendTo ? `${res.summary.valid} numbers added` : `List imported · ${res.summary.valid} numbers`); onDone(); }
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  async function sample() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["Name", "Mobile Number", ...FIELD_LABELS],
      ["Aanya Sharma", "+919876543210", "aanya@example.com", "Rajesh Sharma", "9876500001", "rajesh@example.com", "Neha Sharma", "9876500002", "neha@example.com", "Kothrud", "Pune", "Maharashtra", "India", "12 MG Road, Kothrud", "Website"],
      ["Rohan Mehta", "9123456780", "rohan@example.com", "Sunil Mehta", "9123400001", "", "Kavita Mehta", "9123400002", "", "Dwarka", "Delhi", "Delhi", "India", "B-4 Sector 7, Dwarka", "Walk-in"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recipients");
    XLSX.writeFile(wb, "recipient-list-sample.xlsx");
  }

  const mapped = map.phone !== "" && (appendTo || name.trim());
  return (
    <Modal
      title={appendTo ? `Import recipients · ${appendTo.name}` : "Import List"}
      size="lg"
      onClose={onClose}
      footer={<>
        <button className="ui-btn ui-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        {file && !check && <button className="ui-btn ui-btn-primary" disabled={busy || !mapped} onClick={() => send(true)}>{busy ? "Checking…" : "Check file"}</button>}
        {check && <button className="ui-btn ui-btn-primary" disabled={busy || !check.valid || !mapped} onClick={() => send(false)}>{busy ? "Importing…" : `Import ${check.valid} numbers`}</button>}
      </>}
    >
      <div className="d-flex flex-column gap-3">
        <div className="rounded-3 border border-dashed p-3 d-flex flex-wrap align-items-center justify-content-between gap-2" style={{ borderStyle: "dashed" }}>
          <div className="min-w-0">
            <div className="small fw-semibold text-truncate">{file ? file.name : "CSV or Excel"}</div>
            {file && <div className="row-sub">{file.rows.length} rows</div>}
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={sample}><i className="bi bi-download"></i>Sample</button>
            <label className="ui-btn ui-btn-outline ui-btn-sm m-0">
              <i className="bi bi-upload"></i>{file ? "Change file" : "Choose file"}
              <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        {file && (
          <>
            {!appendTo && (
              <div className="row g-2">
                <div className="col-sm-8">
                  <label className="form-label">List name *</label>
                  <input className="ui-input w-100" value={name} onChange={(e) => { setName(e.target.value); setCheck(null); }} />
                </div>
                <div className="col-sm-4">
                  <label className="form-label">Source</label>
                  <select className="ui-input w-100" value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="">None</option>
                    {sources.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="row g-2">
              {[["phone", "Mobile Number *"], ["name", "Name"], ...CONTACT_FIELDS.map((fd) => [fd.label, fd.label])].map(([k, label]) => (
                <div className="col-6 col-md-4" key={k}>
                  <label className="form-label">{label}</label>
                  <select className="ui-input w-100" value={map[k] ?? ""} onChange={setCol(k)}>
                    <option value="">{k === "phone" ? "Select" : "Not in file"}</option>
                    {file.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                      {file.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 font-medium" style={{ whiteSpace: "nowrap", color: usedIdx.has(i) ? "var(--primary)" : undefined }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {file.rows.slice(0, 5).map((r, ri) => (
                      <tr key={ri} className="border-t">
                        {file.headers.map((_, i) => <td key={i} className="px-3 py-1.5 small" style={{ whiteSpace: "nowrap" }}>{r[i]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {check && (
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Valid" value={check.valid} icon="check-circle" tone="success" />
                <StatCard label="Invalid" value={check.invalid} icon="exclamation-circle" tone="destructive" />
                <StatCard label="Duplicates" value={check.duplicates} icon="files" tone="warning" />
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
