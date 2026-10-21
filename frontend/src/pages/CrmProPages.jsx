import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { crmApi, leadsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Chip, Modal, Confirm, Tabs, StatCard, Avatar, SearchBox, FilterSummary } from "../components/ui";
import DateInput from "../components/DateInput";
import { formatDate, formatDateTime } from "../utils/dateFormat";
import { labelCls, PRIORITY, idOf, timeAgo } from "../components/lead/leadUtils";
import { QueryDrawer, NewQuery, QUERY_STATUS, QUERY_PRIORITY, dueText } from "../components/lead/LeadPro";

const num = new Intl.NumberFormat("en-IN");

/** Rows → .xlsx download. */
async function exportExcel(rows, name) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Sheet1");
  XLSX.writeFile(wb, `${name}.xlsx`);
}

function Pager({ page, perPage, total, loading, onPage, unit }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs text-muted-foreground">
      <span>{total ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${num.format(total)}` : `0 ${unit}`}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)} title="Previous"><i className="bi bi-chevron-left"></i></button>
        <span>{page} / {pages}</span>
        <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" disabled={page >= pages || loading} onClick={() => onPage(page + 1)} title="Next"><i className="bi bi-chevron-right"></i></button>
      </div>
    </div>
  );
}

const Th = ({ children, className = "" }) => <th className={`px-3 py-3 font-medium text-left whitespace-nowrap ${className}`}>{children}</th>;
const tableHead = "text-[11px] uppercase tracking-wider text-muted-foreground";

/* ───────────── query desk ───────────── */
export function Queries() {
  const toast = useToast();
  const { can } = useAuth();
  const [search, setSearch] = useSearchParams();
  const [status, setStatus] = useState("active");
  const [f, setF] = useState({ category: "", priority: "", assignedTo: "", overdue: "" });
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(() => search.get("q"));
  const [adding, setAdding] = useState(false);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setTerm(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const params = useMemo(() => ({ status: status === "all" ? "" : status, ...f, q: term }), [status, f, term]);
  const meta = useApi(() => crmApi.queryMeta(), []);
  const list = useApi(() => crmApi.queries({ ...params, page, perPage: 50 }), [params, page]);
  const rows = list.data || [];
  const stats = list.raw?.stats || {};
  const setFilter = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const close = () => { setOpen(null); if (search.get("q")) { search.delete("q"); setSearch(search, { replace: true }); } };

  async function exportAll() {
    setExporting(true);
    try {
      const all = (await crmApi.queries({ ...params, perPage: 200 })).data || [];
      await exportExcel(all.map((x) => ({ Number: x.number, Subject: x.subject, Name: x.name, Phone: x.phone, Email: x.email, Category: x.category, Priority: x.priority, Status: x.status, "Assigned to": x.assignedTo, Raised: formatDateTime(x.createdAt), Due: x.dueAt ? formatDateTime(x.dueAt) : "", Overdue: x.overdue ? "Yes" : "" })), "queries");
    } catch (e) { toast(e.message, "error"); }
    finally { setExporting(false); }
  }

  return (
    <div>
      <PageHeader title="Queries" actions={<>
        <button type="button" className="ui-btn ui-btn-outline" disabled={exporting || !rows.length} onClick={exportAll}><i className="bi bi-file-earmark-excel"></i>Export Excel</button>
        {can("leads", "create") && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setAdding(true)}><i className="bi bi-plus-lg"></i>New query</button>}
      </>} />
      <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} tabs={[
        { value: "active", label: "Active", count: (stats.open || 0) + (stats.pending || 0) },
        { value: "open", label: "Open", count: stats.open || 0 },
        { value: "pending", label: "Waiting", count: stats.pending || 0 },
        { value: "resolved", label: "Resolved", count: stats.resolved || 0 },
        { value: "closed", label: "Closed", count: stats.closed || 0 },
        { value: "all", label: "All", count: (stats.open || 0) + (stats.pending || 0) + (stats.resolved || 0) + (stats.closed || 0) },
      ]} />
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <SearchBox value={q} onChange={setQ} />
        <select className="ui-input min-w-[150px]" style={{ width: "auto" }} value={f.category} onChange={(e) => setFilter("category", e.target.value)} aria-label="Category"><option value="">All categories</option>{(meta.data?.categories || []).map((c) => <option key={c.name}>{c.name}</option>)}</select>
        <select className="ui-input min-w-[130px]" style={{ width: "auto" }} value={f.priority} onChange={(e) => setFilter("priority", e.target.value)} aria-label="Priority"><option value="">Any priority</option>{Object.entries(QUERY_PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select>
        <select className="ui-input min-w-[130px]" style={{ width: "auto" }} value={f.assignedTo} onChange={(e) => setFilter("assignedTo", e.target.value)} aria-label="Assigned to"><option value="">Anyone</option><option value="me">Me</option><option value="Unassigned">Unassigned</option>{(meta.data?.owners || []).map((o) => <option key={o}>{o}</option>)}</select>
        <button type="button" className={"ui-btn " + (f.overdue ? "ui-btn-danger" : "ui-btn-outline")} onClick={() => setFilter("overdue", f.overdue ? "" : "1")} aria-pressed={!!f.overdue}>
          <i className="bi bi-alarm"></i>Overdue<span className="text-[10px] font-semibold tabular-nums opacity-70">{stats.overdue || 0}</span>
        </button>
        <FilterSummary onClear={q || f.category || f.priority || f.assignedTo || f.overdue ? () => { setQ(""); setF({ category: "", priority: "", assignedTo: "", overdue: "" }); setPage(1); } : undefined} text={list.loading ? "Loading…" : `${num.format(list.raw?.total ?? rows.length)} ${(list.raw?.total ?? rows.length) === 1 ? "query" : "queries"}`} />
      </div>
      <ErrorBox error={list.error} />

      {/* phones: cards */}
      <div className="md:hidden space-y-2">
        {list.loading && !rows.length ? <Spinner /> : !rows.length ? <div className="rounded-xl border bg-card"><EmptyState icon="question-circle" text="No queries" />{can("leads", "create") && <div className="text-center pb-8 -mt-10"><button type="button" className="ui-btn ui-btn-primary" onClick={() => setAdding(true)}><i className="bi bi-plus-lg"></i>New query</button></div>}</div> : rows.map((x) => {
          const due = dueText(x);
          return (
            <button key={x._id} type="button" className="w-full text-left rounded-xl border bg-card p-3" onClick={() => setOpen(x._id)}>
              <div className="flex items-center gap-2"><span className="text-xs font-mono text-muted-foreground">#{x.number}</span><span className="text-sm font-semibold text-foreground truncate flex-1">{x.subject}</span><Chip color={QUERY_PRIORITY[x.priority].color}>{QUERY_PRIORITY[x.priority].label}</Chip></div>
              <div className="text-xs text-muted-foreground mt-1">{x.name}{x.category ? ` · ${x.category}` : ""} · {x.assignedTo}</div>
              <div className="flex items-center justify-between mt-1.5"><Chip color={QUERY_STATUS[x.status].color}>{QUERY_STATUS[x.status].label}</Chip><span className="text-xs" style={{ color: `var(--${due.tone})` }}>{due.text}</span></div>
            </button>
          );
        })}
      </div>
      {/* tablets and up: table */}
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className={tableHead} style={{ background: "var(--muted-background)" }}><Th>#</Th><Th>Subject</Th><Th>From</Th><Th>Category</Th><Th>Priority</Th><Th>Status</Th><Th>Assigned to</Th><Th>Due</Th></tr></thead>
            <tbody>
              {list.loading && !rows.length ? <tr><td colSpan={99}><Spinner /></td></tr> : !rows.length ? <tr><td colSpan={99}><EmptyState icon="question-circle" text="No queries" />{can("leads", "create") && <div className="text-center pb-8 -mt-10"><button type="button" className="ui-btn ui-btn-primary" onClick={() => setAdding(true)}><i className="bi bi-plus-lg"></i>New query</button></div>}</td></tr> : rows.map((x) => {
                const due = dueText(x);
                return (
                  <tr key={x._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setOpen(x._id)}>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{x.number}</td>
                    <td className="px-3 py-2.5"><div className="font-medium text-foreground truncate" style={{ maxWidth: 280 }}>{x.subject}</div><div className="text-[11px] text-muted-foreground">{timeAgo(x.createdAt)}</div></td>
                    <td className="px-3 py-2.5"><div className="text-foreground truncate" style={{ maxWidth: 180 }}>{x.name || "—"}</div><div className="text-[11px] text-muted-foreground">{x.phone}</div></td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{x.category || "—"}</td>
                    <td className="px-3 py-2.5"><Chip color={QUERY_PRIORITY[x.priority].color}>{QUERY_PRIORITY[x.priority].label}</Chip></td>
                    <td className="px-3 py-2.5"><Chip color={QUERY_STATUS[x.status].color}>{QUERY_STATUS[x.status].label}</Chip></td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{x.assignedTo}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs" style={{ color: `var(--${due.tone})` }} title={x.dueAt ? formatDateTime(x.dueAt) : ""}>{due.text}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Pager page={page} perPage={50} total={list.raw?.total || 0} loading={list.loading} onPage={setPage} unit="queries" />

      {adding && <NewQuery meta={meta.data} onClose={() => setAdding(false)} onSaved={(x) => { setAdding(false); list.reload(); setOpen(x._id); }} />}
      {open && <QueryDrawer id={open} meta={meta.data} onClose={close} onChanged={list.reload} />}
    </div>
  );
}

/* ───────────── lead lists ───────────── */
const FILTER_LABELS = { q: "Search", status: "Status", subStatus: "Sub-status", source: "Source", owner: "Owner", priority: "Priority", tag: "Tag", city: "City", branch: "Branch", course: "Course", createdFrom: "Created from", createdTo: "Created to", minScore: "Min score", maxScore: "Max score", followUp: "Follow-up", view: "View", service: "Service", partner: "Partner" };

export function LeadLists() {
  const toast = useToast();
  const { can } = useAuth();
  const canEdit = can("leads", "edit");
  const [search, setSearch] = useSearchParams();
  const lists = useApi(() => crmApi.lists(), []);
  const meta = useApi(() => leadsApi.meta(), []);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const openId = search.get("list");
  const rows = lists.data || [];

  const nameOf = (k, v) => {
    const m = meta.data || {};
    if (k === "status") return m.statuses?.find((s) => s._id === v)?.name || v;
    if (k === "source") return m.sources?.find((s) => s._id === v)?.name || v;
    if (k === "priority") return PRIORITY[v]?.label || v;
    if (k === "createdFrom" || k === "createdTo") return formatDate(v);
    return v;
  };
  const describe = (filters) => Object.entries(filters || {}).map(([k, v]) => `${FILTER_LABELS[k] || k.replace(/^cf_/, "")}: ${nameOf(k, v)}`).join(" · ");

  async function save() {
    try {
      const body = { name: editing.name, kind: editing.kind, filters: editing.kind === "dynamic" ? editing.filters : undefined };
      if (editing._id) await crmApi.updateList(editing._id, body); else await crmApi.createList(body);
      toast("List saved"); setEditing(null); lists.reload();
    } catch (e) { toast(e.message, "error"); }
  }

  if (openId) return <ListDetail id={openId} canEdit={canEdit} describe={describe} onBack={() => { search.delete("list"); setSearch(search); lists.reload(); }} />;

  return (
    <div>
      <PageHeader title="Lead lists" actions={canEdit && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setEditing({ name: "", kind: "static", filters: {} })}><i className="bi bi-plus-lg"></i>New list</button>} />
      <ErrorBox error={lists.error} />
      {lists.loading && !lists.data ? <Spinner /> : !rows.length ? (
        <div className="rounded-xl border bg-card"><EmptyState icon="collection" text="No lists yet." /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((l) => (
            <div key={l._id} className="rounded-xl border bg-card p-3 flex flex-col gap-2 cursor-pointer hover:bg-accent/20" onClick={() => setSearch({ list: l._id })}>
              <div className="flex items-start gap-2">
                <i className={`bi bi-${l.kind === "dynamic" ? "funnel" : "collection"} mt-0.5`} style={{ color: "var(--primary)" }}></i>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground truncate">{l.name}</div>
                  <div className="text-[11px] text-muted-foreground">{l.kind === "dynamic" ? "Smart list" : "Static list"} · {l.createdBy || "—"} · {formatDate(l.updatedAt)}</div>
                </div>
                <span className="text-xl font-semibold text-foreground">{num.format(l.count)}</span>
              </div>
              {l.kind === "dynamic" && <div className="text-xs text-muted-foreground line-clamp-2">{describe(l.filters)}</div>}
              {canEdit && (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Edit" onClick={() => setEditing({ ...l, filters: l.filters || {} })}><i className="bi bi-pencil"></i></button>
                  <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Delete" onClick={() => setRemoving(l)}><i className="bi bi-trash"></i></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing._id ? "Edit list" : "New list"} onClose={() => setEditing(null)}
          footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={!editing.name.trim() || (editing.kind === "dynamic" && !Object.values(editing.filters).some(Boolean))} onClick={save}>Save</button></>}>
          <div className="space-y-3">
            <div><label className={labelCls}>Name *</label><input className="ui-input w-full" autoFocus value={editing.name} onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} /></div>
            {!editing._id && (
              <div className="grid grid-cols-2 gap-2">
                {[["static", "collection", "Static", "Pick leads"], ["dynamic", "funnel", "Smart", "Matches filters"]].map(([k, icon, label, sub]) => (
                  <button key={k} type="button" className={"rounded-lg border p-2.5 text-left " + (editing.kind === k ? "border-primary" : "")} style={editing.kind === k ? { borderColor: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" } : undefined} onClick={() => setEditing((x) => ({ ...x, kind: k }))}>
                    <div className="text-sm font-medium text-foreground"><i className={`bi bi-${icon} me-1`}></i>{label}</div><div className="text-[11px] text-muted-foreground">{sub}</div>
                  </button>
                ))}
              </div>
            )}
            {editing.kind === "dynamic" && <ListFilters meta={meta.data} value={editing.filters} onChange={(filters) => setEditing((x) => ({ ...x, filters }))} />}
          </div>
        </Modal>
      )}
      {removing && <Confirm danger title={`Delete the list "${removing.name}"?`} text="The leads stay." confirmLabel="Delete" onCancel={() => setRemoving(null)}
        onConfirm={async () => { try { await crmApi.removeList(removing._id); setRemoving(null); lists.reload(); toast("List deleted"); } catch (e) { toast(e.message, "error"); } }} />}
    </div>
  );
}

function ListFilters({ meta, value, onChange }) {
  const m = meta || {};
  const set = (k, v) => onChange({ ...value, [k]: v });
  const sel = (k, label, options) => (
    <div><label className={labelCls}>{label}</label>
      <select className="ui-input w-full" value={value[k] || ""} onChange={(e) => set(k, e.target.value)}><option value="">Any</option>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
  );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {sel("status", "Status", (m.statuses || []).map((s) => [s._id, s.name]))}
      {sel("source", "Source", (m.sources || []).map((s) => [s._id, s.name]))}
      {sel("owner", "Owner", [["Unassigned", "Unassigned"], ...(m.owners || []).map((o) => [o, o])])}
      {sel("priority", "Priority", Object.entries(PRIORITY).map(([k, p]) => [k, p.label]))}
      {sel("view", "Stage", [["open", "Open"], ["won", "Won"], ["lost", "Lost"], ["untouched", "Not contacted"], ["stale", "Going cold"]])}
      {sel("followUp", "Follow-up", [["overdue", "Overdue"], ["today", "Today"], ["upcoming", "Upcoming"], ["none", "None"]])}
      <div><label className={labelCls}>Course</label><input className="ui-input w-full" list="ll-courses" value={value.course || ""} onChange={(e) => set("course", e.target.value)} /><datalist id="ll-courses">{(m.courses || []).map((c) => <option key={c.name || c} value={c.name || c} />)}</datalist></div>
      <div><label className={labelCls}>City</label><input className="ui-input w-full" value={value.city || ""} onChange={(e) => set("city", e.target.value)} /></div>
      <div><label className={labelCls}>Tag</label><input className="ui-input w-full" list="ll-tags" value={value.tag || ""} onChange={(e) => set("tag", e.target.value)} /><datalist id="ll-tags">{(m.tags || []).map((t) => <option key={t} value={t} />)}</datalist></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className={labelCls}>Min score</label><input className="ui-input w-full" type="number" min="0" max="100" value={value.minScore || ""} onChange={(e) => set("minScore", e.target.value)} /></div>
        <div><label className={labelCls}>Max score</label><input className="ui-input w-full" type="number" min="0" max="100" value={value.maxScore || ""} onChange={(e) => set("maxScore", e.target.value)} /></div>
      </div>
      <div><label className={labelCls}>Created from</label><DateInput className="ui-input w-full" value={value.createdFrom || ""} onChange={(e) => set("createdFrom", e.target.value)} /></div>
      <div><label className={labelCls}>Created to</label><DateInput className="ui-input w-full" value={value.createdTo || ""} onChange={(e) => set("createdTo", e.target.value)} /></div>
    </div>
  );
}

function ListDetail({ id, canEdit, describe, onBack }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [page, setPage] = useState(1);
  const data = useApi(() => crmApi.list(id, { page, perPage: 50 }), [id, page]);
  const list = data.raw?.list;
  const rows = data.data || [];
  const [exporting, setExporting] = useState(false);
  const [removing, setRemoving] = useState(null);

  async function exportAll() {
    setExporting(true);
    try {
      const all = [];
      for (let p = 1; p <= 100; p++) { const r = await crmApi.list(id, { page: p, perPage: 200 }); all.push(...(r.data || [])); if (all.length >= r.total) break; }
      await exportExcel(all.map((l) => ({ Name: l.name, Phone: l.phone, Email: l.email || "", Status: l.status?.name || "", Source: l.source?.name || "", Owner: l.owner, Course: l.course || "", City: l.city || "", Score: l.score, Created: formatDate(l.createdAt) })), (list?.name || "list").replace(/[^\w-]+/g, "-"));
    } catch (e) { toast(e.message, "error"); }
    finally { setExporting(false); }
  }

  return (
    <div>
      <PageHeader title={<span className="flex items-center gap-2"><button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Back to lists" onClick={onBack}><i className="bi bi-arrow-left"></i></button>{list?.name || "List"}</span>}
        actions={<>
          <button type="button" className="ui-btn ui-btn-outline" disabled={exporting || !rows.length} onClick={exportAll}><i className="bi bi-file-earmark-excel"></i>Export Excel</button>
          <button type="button" className="ui-btn ui-btn-outline" onClick={() => navigate(`/crm/leads?list=${id}`)}><i className="bi bi-box-arrow-up-right"></i>Open in Leads</button>
          {can("blast", "create") && <button type="button" className="ui-btn ui-btn-primary" disabled={!rows.length} onClick={() => navigate(`/crm/leads?list=${id}&bulk=message`)}><i className="bi bi-send"></i>Message all</button>}
        </>} />
      {list?.kind === "dynamic" && <div className="text-xs text-muted-foreground mb-2"><i className="bi bi-funnel me-1"></i>{describe(list.filters)}</div>}
      <ErrorBox error={data.error} />
      <div className="rounded-xl border bg-card overflow-hidden">
        {data.loading && !rows.length ? <Spinner /> : !rows.length ? <EmptyState icon="people" text={list?.kind === "static" ? "No leads yet. Select leads on the Leads page and choose Add to list." : "No leads match."} /> : rows.map((l) => (
          <div key={l._id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0">
            <Avatar name={l.name} size={30} />
            <Link to={`/crm/leads?lead=${l._id}`} className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate hover:underline">{l.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{l.phone}{l.course ? ` · ${l.course}` : ""}{l.city ? ` · ${l.city}` : ""}</div>
            </Link>
            <span className="hidden sm:inline">{l.status?.name && <Chip color={l.status.color}>{l.status.name}</Chip>}</span>
            <span className="hidden md:inline text-xs text-muted-foreground w-28 truncate">{l.owner}</span>
            <span className="text-xs font-semibold text-foreground w-8 text-right">{l.score}</span>
            {canEdit && list?.kind === "static" && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Remove from list" onClick={() => setRemoving(l)}><i className="bi bi-x-lg"></i></button>}
          </div>
        ))}
      </div>
      <Pager page={page} perPage={50} total={data.raw?.total || 0} loading={data.loading} onPage={setPage} unit="leads" />
      {removing && <Confirm title={`Remove ${removing.name} from this list?`} confirmLabel="Remove" onCancel={() => setRemoving(null)}
        onConfirm={async () => { try { await crmApi.listMembers(id, { leadIds: [removing._id], remove: true }); setRemoving(null); data.reload(); } catch (e) { toast(e.message, "error"); } }} />}
    </div>
  );
}

/* ───────────── activity register: every logged custom activity ───────────── */
export function ActivityRegister() {
  const toast = useToast();
  const [f, setF] = useState({ type: "", by: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const types = useApi(() => crmApi.activityTypes(), []);
  const meta = useApi(() => leadsApi.meta(), []);
  const list = useApi(() => crmApi.activities({ ...f, page, perPage: 50 }), [f, page]);
  const rows = list.data || [];
  const byType = list.raw?.byType || [];
  const [exporting, setExporting] = useState(false);
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };

  async function exportAll() {
    setExporting(true);
    try {
      const all = (await crmApi.activities({ ...f, perPage: 200 })).data || [];
      await exportExcel(all.map((a) => ({ When: formatDateTime(a.at), Activity: a.title, Lead: a.lead?.name || "", Phone: a.lead?.phone || "", Details: a.detail, Points: a.meta?.points || 0, By: a.by })), "activities");
    } catch (e) { toast(e.message, "error"); }
    finally { setExporting(false); }
  }

  return (
    <div>
      <PageHeader title="Activities" actions={<button type="button" className="ui-btn ui-btn-outline" disabled={exporting || !rows.length} onClick={exportAll}><i className="bi bi-file-earmark-excel"></i>Export Excel</button>} />
      {byType.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {byType.slice(0, 4).map((t) => {
            const type = (types.data || []).find((x) => x.name === t.name);
            return <StatCard key={t.name} label={t.name} value={num.format(t.count)} icon={type?.icon || "lightning"} active={f.type && f.type === type?._id} onClick={() => type && set("type", f.type === type._id ? "" : type._id)} />;
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-3">
        <select className="ui-input" style={{ width: "auto" }} value={f.type} onChange={(e) => set("type", e.target.value)} aria-label="Activity"><option value="">All activities</option>{(types.data || []).map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select>
        <select className="ui-input" style={{ width: "auto" }} value={f.by} onChange={(e) => set("by", e.target.value)} aria-label="By"><option value="">Anyone</option>{(meta.data?.owners || []).map((o) => <option key={o}>{o}</option>)}</select>
        <DateInput className="ui-input" style={{ width: 140 }} value={f.from} onChange={(e) => set("from", e.target.value)} title="From" />
        <DateInput className="ui-input" style={{ width: 140 }} value={f.to} onChange={(e) => set("to", e.target.value)} title="To" />
      </div>
      <ErrorBox error={list.error} />
      <div className="rounded-xl border bg-card overflow-hidden">
        {list.loading && !rows.length ? <Spinner /> : !rows.length ? <EmptyState icon="lightning" text="No activities logged." /> : rows.map((a) => (
          <div key={a._id} className="flex items-start gap-3 px-3 py-2.5 border-b last:border-b-0">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border flex-shrink-0" style={{ color: a.meta?.color || "var(--primary)" }}><i className={`bi bi-${a.meta?.icon || "lightning"}`}></i></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-foreground">{a.title}</span>
                {a.lead && <Link to={`/crm/leads?lead=${idOf(a.lead)}`} className="text-sm text-primary hover:underline">{a.lead.name}</Link>}
                {!!a.meta?.points && <span className="text-[11px] text-muted-foreground">{a.meta.points > 0 ? "+" : ""}{a.meta.points} pts</span>}
              </div>
              {a.detail && <div className="text-xs text-muted-foreground break-words">{a.detail}</div>}
            </div>
            <div className="text-right flex-shrink-0"><div className="text-xs text-foreground">{a.by}</div><div className="text-[11px] text-muted-foreground" title={formatDateTime(a.at)}>{timeAgo(a.at)}</div></div>
          </div>
        ))}
      </div>
      <Pager page={page} perPage={50} total={list.raw?.total || 0} loading={list.loading} onPage={setPage} unit="activities" />
    </div>
  );
}
