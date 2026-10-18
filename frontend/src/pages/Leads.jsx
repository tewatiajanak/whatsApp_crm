import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { leadsApi } from "../api";
import { appStore } from "../api/appStore";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { formatDate } from "../utils/dateFormat";
import { PageHeader, Spinner, ErrorBox, Avatar, EmptyState, Modal, Chip, Confirm } from "../components/ui";
import DateInput from "../components/DateInput";
import LeadDrawer from "../components/lead/LeadDrawer";
import LeadBoard from "../components/lead/LeadBoard";
import ImportLeads from "../components/lead/ImportLeads";
import DuplicatesDrawer from "../components/lead/DuplicatesDrawer";
import { RecycleBin } from "./CrmMorePages";
import { crmApi, templatesApi } from "../api";
import MessagingSlider from "../components/MessagingSlider";
import FollowUpSlider from "../components/FollowUpSlider";
import { CustomFieldInputs, missingCustom } from "../components/lead/LeadExtras";
import { PRIORITY, FU_TYPES, LOST_REASONS, dueInfo, timeAgo, waLink, telLink, labelCls, idOf, isoDay } from "../components/lead/leadUtils";

// Ready-made views: each is just a set of list filters.
const VIEWS = [
  { key: "all", label: "All", params: {} },
  { key: "mine", label: "My leads", params: { owner: "me" } },
  { key: "new", label: "New today", params: { view: "new" } },
  { key: "untouched", label: "Not contacted", params: { view: "untouched" } },
  { key: "hot", label: "Hot", params: { priority: "hot", view: "open" } },
  { key: "overdue", label: "Overdue", params: { followUp: "overdue" } },
  { key: "today", label: "Due today", params: { followUp: "today" } },
  { key: "stale", label: "Going cold", params: { view: "stale" } },
  { key: "unassigned", label: "Unassigned", params: { view: "unassigned" } },
];
const NO_FILTERS = { q: "", list: "", status: "", source: "", owner: "", priority: "", tag: "", service: "", branch: "", course: "", createdFrom: "", createdTo: "" };
const SORTS = [
  ["-createdAt", "Newest first"], ["createdAt", "Oldest first"], ["-score", "Highest score"],
  ["nextFollowUp", "Follow-up soonest"], ["-lastActivity", "Recently active"], ["lastActivity", "Longest idle"], ["name", "Name A–Z"],
];
const COLUMNS = [
  ["status", "Status"], ["score", "Score"], ["owner", "Owner"], ["source", "Source"], ["course", "Course"], ["city", "City"],
  ["nextFollowUp", "Next follow-up"], ["remark", "Last remark"], ["lastActivity", "Last activity"], ["created", "Created"],
];
const DEFAULT_COLS = ["status", "score", "owner", "source", "nextFollowUp", "lastActivity"];
const readJson = (key, fallback) => { try { return JSON.parse(appStore.getItem(key)) || fallback; } catch { return fallback; } };

export default function Leads() {
  const toast = useToast();
  const { can } = useAuth();
  const [search, setSearch] = useSearchParams();
  const [view, setView] = useState(() => (VIEWS.some((v) => v.key === search.get("view")) ? search.get("view") : "all"));
  const [filters, setFilters] = useState(() => ({ ...NO_FILTERS, list: search.get("list") || "" }));
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [mode, setMode] = useState("list");
  const [showMore, setShowMore] = useState(false);
  const [cols, setCols] = useState(() => readJson("cols.crm-leads", DEFAULT_COLS));
  const [savedViews, setSavedViews] = useState(() => readJson("crm.leadViews", []));
  const [selected, setSelected] = useState(() => new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [bulk, setBulk] = useState(null);
  const [open, setOpen] = useState(() => search.get("lead"));
  const [panel, setPanel] = useState(null); // { kind: "add" | "import" | "duplicates" | "followup" | "message", lead? }
  const [exporting, setExporting] = useState(false);

  // search box updates the list a moment after typing stops
  useEffect(() => {
    const t = setTimeout(() => { setFilters((f) => (f.q === q ? f : { ...f, q })); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const listParams = useMemo(() => {
    const base = VIEWS.find((v) => v.key === view)?.params || {};
    const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    return { ...base, ...active };
  }, [view, filters]);

  const meta = useApi(() => leadsApi.meta(), []);
  const lists = useApi(() => (filters.list ? crmApi.lists() : Promise.resolve({ data: [] })), [filters.list]);
  const listName = (lists.data || []).find((x) => x._id === filters.list)?.name;
  const counts = useApi(() => leadsApi.viewCounts(), []);
  const leads = useApi(() => leadsApi.list({ ...listParams, sort, page, perPage }), [listParams, sort, page, perPage]);
  const total = leads.raw?.total || 0;
  const [tick, setTick] = useState(0);

  const rows = leads.data || [];

  const m = meta.data || {};
  const statusById = useMemo(() => Object.fromEntries((m.statuses || []).map((s) => [s._id, s])), [m.statuses]);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const activeFilters = Object.entries(filters).filter(([k, v]) => v && k !== "q").length;

  const reload = () => { leads.reload(); counts.reload(); setTick((t) => t + 1); };
  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); clearSelection(); };
  const clearSelection = () => { setSelected(new Set()); setAllMatching(false); };
  const pickView = (key) => { setView(key); setPage(1); clearSelection(); };
  const closeLead = () => { setOpen(null); if (search.get("lead")) { search.delete("lead"); setSearch(search, { replace: true }); } };

  function toggleCol(key) {
    const next = cols.includes(key) ? cols.filter((c) => c !== key) : [...cols, key];
    setCols(next);
    appStore.setItem("cols.crm-leads", JSON.stringify(next));
  }
  function storeViews(next) { setSavedViews(next); appStore.setItem("crm.leadViews", JSON.stringify(next)); }

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await leadsApi.exportCsv(listParams);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `leads-${isoDay(0)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast(e.message, "error"); }
    finally { setExporting(false); }
  }

  const allOnPage = rows.length > 0 && rows.every((l) => selected.has(l._id));
  const toggleRow = (id) => { setAllMatching(false); setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const togglePage = () => { setAllMatching(false); setSelected((s) => { const n = new Set(s); rows.forEach((l) => (allOnPage ? n.delete(l._id) : n.add(l._id))); return n; }); };
  const selectedCount = allMatching ? total : selected.size;

  // "Message all" on a lead list lands here with ?list=…&bulk=message
  useEffect(() => {
    if (search.get("bulk") !== "message" || !leads.raw) return;
    search.delete("bulk"); setSearch(search, { replace: true });
    if (total > 0 && can("blast", "create")) { setAllMatching(true); setBulk({ action: "message" }); }
  }, [leads.raw]); // eslint-disable-line react-hooks/exhaustive-deps
  const clearList = () => { setFilter("list", ""); if (search.get("list")) { search.delete("list"); setSearch(search, { replace: true }); } };

  const show = (c) => cols.includes(c);
  // the fixed columns, then one per custom field
  const columns = [...COLUMNS, ["branch", "Branch"], ...(m.customFields || []).map((f) => [`cf_${f.key}`, f.label])];
  const cell = {
    branch: (l) => l.branch || "—",
    ...Object.fromEntries((m.customFields || []).map((f) => [`cf_${f.key}`, (l) => l.customFields?.[f.key] || "—"])),
    status: (l) => { const s = statusById[idOf(l.status)] || l.status; return s?.name ? <div><Chip color={s.color}>{s.name}</Chip>{l.subStatus?.name && <div className="text-[11px] text-muted-foreground mt-0.5">{l.subStatus.name}</div>}</div> : "—"; },
    score: (l) => <ScoreBar lead={l} />,
    owner: (l) => (l.owner && l.owner !== "Unassigned" ? l.owner : <span className="text-muted-foreground">Unassigned</span>),
    source: (l) => l.source?.name || "—",
    course: (l) => l.course || "—",
    city: (l) => l.city || "—",
    nextFollowUp: (l) => { const d = dueInfo(l.nextFollowUp); return <span style={{ color: `var(--${d.tone})` }} title={l.nextRemark || ""}>{d.text}</span>; },
    remark: (l) => <span className="text-muted-foreground line-clamp-1" style={{ maxWidth: 220 }}>{l.currentRemark || "—"}</span>,
    lastActivity: (l) => <span className="text-muted-foreground">{timeAgo(l.lastActivity)}</span>,
    created: (l) => <span className="text-muted-foreground">{formatDate(l.createdAt)}</span>,
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        actions={<>
          {can("leads", "del") && <button type="button" className="ui-btn ui-btn-outline ui-btn-icon" title="Recycle bin" onClick={() => setPanel({ kind: "trash" })}><i className="bi bi-trash"></i></button>}
          {can("leads", "del") && <button type="button" className="ui-btn ui-btn-outline ui-btn-icon" title="Find duplicates" onClick={() => setPanel({ kind: "duplicates" })}><i className="bi bi-union"></i></button>}
          <button type="button" className="ui-btn ui-btn-outline ui-btn-icon" title="Export these leads" disabled={exporting} onClick={exportCsv}><i className="bi bi-download"></i></button>
          {can("leads", "create") && <button type="button" className="ui-btn ui-btn-outline" onClick={() => setPanel({ kind: "import" })}><i className="bi bi-upload"></i><span className="hidden sm:inline">Import</span></button>}
          {can("leads", "create") && <button type="button" className="ui-btn ui-btn-primary" onClick={() => setPanel({ kind: "add" })}><i className="bi bi-plus-lg"></i>Add lead</button>}
        </>}
      />

      {/* smart views */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-1" role="tablist">
        {VIEWS.filter((v) => m.leadVisibility !== "own" || !["mine", "unassigned"].includes(v.key)).map((v) => (
          <button key={v.key} type="button" role="tab" aria-selected={view === v.key} onClick={() => pickView(v.key)}
            className={"ui-btn ui-btn-sm flex-shrink-0 " + (view === v.key ? "ui-btn-primary" : "ui-btn-outline")}>
            {v.label}
            {counts.data && <span className="text-[11px] opacity-80">{counts.data[v.key] ?? 0}</span>}
          </button>
        ))}
        {savedViews.map((v, i) => (
          <span key={v.name} className="inline-flex flex-shrink-0">
            <button type="button" className="ui-btn ui-btn-sm ui-btn-ghost" title="Saved view" onClick={() => { setView("all"); setFilters({ ...NO_FILTERS, ...v.filters }); setQ(v.filters.q || ""); setSort(v.sort || "-createdAt"); setPage(1); clearSelection(); }}>
              <i className="bi bi-bookmark"></i>{v.name}
            </button>
            <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title={`Remove ${v.name}`} onClick={() => storeViews(savedViews.filter((_, j) => j !== i))}><i className="bi bi-x"></i></button>
          </span>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="ui-search flex-1" style={{ minWidth: 200, maxWidth: 340 }}>
          <span className="ui-search-icon"><i className="bi bi-search"></i></span>
          <input className="ui-search-input" placeholder="Name, phone, email, course, city" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="ui-input" value={filters.status} onChange={(e) => setFilter("status", e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {(m.statuses || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <select className="ui-input hidden md:block" value={filters.owner} onChange={(e) => setFilter("owner", e.target.value)} aria-label="Owner">
          <option value="">All owners</option>
          {m.leadVisibility !== "own" && <option value="Unassigned">Unassigned</option>}
          {(m.visibleOwners || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <button type="button" className={"ui-btn " + (showMore || activeFilters ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => setShowMore((s) => !s)}>
          <i className="bi bi-funnel"></i>Filters{activeFilters ? ` · ${activeFilters}` : ""}
        </button>
        <div className="flex items-center gap-2 ms-auto">
          <select className="ui-input hidden sm:block" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort">
            {SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <div className="inline-flex rounded-lg border overflow-hidden">
            {[["list", "list-ul", "List"], ["board", "kanban", "Board"]].map(([v, icon, label]) => (
              <button key={v} type="button" title={label} onClick={() => { setMode(v); clearSelection(); }} className="h-[34px] w-9 inline-flex items-center justify-center border-0"
                style={mode === v ? { background: "var(--primary)", color: "var(--primary-foreground, #fff)" } : { background: "var(--card)", color: "var(--muted-foreground)" }}>
                <i className={`bi bi-${icon}`}></i>
              </button>
            ))}
          </div>
        </div>
      </div>

      {filters.list && (
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-foreground" style={{ borderColor: "var(--primary)" }}>
            <i className="bi bi-collection" style={{ color: "var(--primary)" }}></i>List: {listName || "…"}
            <button type="button" className="text-muted-foreground" title="Show all leads" onClick={clearList}><i className="bi bi-x"></i></button>
          </span>
        </div>
      )}

      {showMore && (
        <div className="rounded-xl border bg-card p-3 mb-2 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 items-end">
          <div className="md:hidden"><label className={labelCls}>Owner</label>
            <select className="ui-input w-full" value={filters.owner} onChange={(e) => setFilter("owner", e.target.value)}>
              <option value="">All</option>{m.leadVisibility !== "own" && <option value="Unassigned">Unassigned</option>}{(m.visibleOwners || []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select></div>
          <div><label className={labelCls}>Source</label>
            <select className="ui-input w-full" value={filters.source} onChange={(e) => setFilter("source", e.target.value)}>
              <option value="">All</option>{(m.sources || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select></div>
          <div><label className={labelCls}>Priority</label>
            <select className="ui-input w-full" value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)}>
              <option value="">All</option>{Object.entries(PRIORITY).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            </select></div>
          <div><label className={labelCls}>Service</label>
            <select className="ui-input w-full" value={filters.service} onChange={(e) => setFilter("service", e.target.value)}>
              <option value="">All</option>{(m.services || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select></div>
          {!!(m.branches || []).length && <div><label className={labelCls}>Branch</label>
            <select className="ui-input w-full" value={filters.branch} onChange={(e) => setFilter("branch", e.target.value)}>
              <option value="">All</option>{m.branches.map((b) => <option key={b._id}>{b.name}</option>)}
            </select></div>}
          {!!(m.courses || []).length && <div><label className={labelCls}>Course</label>
            <select className="ui-input w-full" value={filters.course} onChange={(e) => setFilter("course", e.target.value)}>
              <option value="">All</option>{m.courses.map((c) => <option key={c._id}>{c.name}</option>)}
            </select></div>}
          <div><label className={labelCls}>Tag</label>
            <select className="ui-input w-full" value={filters.tag} onChange={(e) => setFilter("tag", e.target.value)}>
              <option value="">All</option>{(m.tags || []).map((t) => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <div><label className={labelCls}>Created from</label><DateInput className="ui-input w-full" value={filters.createdFrom} onChange={(e) => setFilter("createdFrom", e.target.value)} /></div>
          <div><label className={labelCls}>Created to</label><DateInput className="ui-input w-full" value={filters.createdTo} onChange={(e) => setFilter("createdTo", e.target.value)} /></div>
          <div className="sm:hidden"><label className={labelCls}>Sort</label>
            <select className="ui-input w-full" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>{SORTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></div>
          <div className="col-span-2 flex flex-wrap gap-2">
            <button type="button" className="ui-btn ui-btn-ghost" disabled={!activeFilters && !q} onClick={() => { setFilters(NO_FILTERS); setQ(""); setPage(1); clearSelection(); }}>Clear</button>
            <SaveView disabled={!activeFilters && !q} onSave={(name) => storeViews([...savedViews.filter((v) => v.name !== name), { name, filters: { ...filters, q }, sort }])} />
            {mode === "list" && <ColumnMenu cols={cols} all={columns} onToggle={toggleCol} />}
          </div>
        </div>
      )}

      <ErrorBox error={leads.error || meta.error} />

      {mode === "board" ? (
        <LeadBoard params={listParams} meta={m} reloadKey={tick} onOpen={setOpen} onChanged={reload} />
      ) : (
        <>
          {/* bulk bar */}
          {selectedCount > 0 && can("leads", "edit") && (
            <div className="rounded-xl border bg-card px-3 py-2 mb-2 flex flex-wrap items-center gap-2" style={{ borderColor: "var(--primary)" }}>
              <span className="text-sm font-medium text-foreground">{selectedCount} selected</span>
              {!allMatching && allOnPage && total > rows.length && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setAllMatching(true)}>Select all {total}</button>}
              <span className="flex flex-wrap gap-1.5 ms-auto">
                {[["assign", "person-check", "Assign"], ["status", "flag", "Status"], ["followup", "calendar-plus", "Follow-up"], ["addTag", "tag", "Tag"], ["priority", "thermometer-half", "Priority"], ["list", "collection", "Add to list"]].map(([action, icon, label]) => (
                  <button key={action} type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setBulk({ action })}><i className={`bi bi-${icon}`}></i>{label}</button>
                ))}
                {can("blast", "create") && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => setBulk({ action: "message" })}><i className="bi bi-send"></i>Message</button>}
                {can("leads", "del") && <button type="button" className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => setBulk({ action: "delete" })}><i className="bi bi-trash"></i>Delete</button>}
                <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Clear selection" onClick={clearSelection}><i className="bi bi-x-lg"></i></button>
              </span>
            </div>
          )}

          {/* phones: cards */}
          <div className="md:hidden space-y-2">
            {leads.loading && !rows.length ? <Spinner /> : !rows.length ? <div className="rounded-xl border bg-card"><EmptyState icon="flag" text="No leads match." /></div> : rows.map((l) => {
              const s = statusById[idOf(l.status)] || l.status; const d = dueInfo(l.nextFollowUp); const pr = PRIORITY[l.priority] || PRIORITY.warm;
              return (
                <div key={l._id} className="rounded-xl border bg-card p-3" onClick={() => setOpen(l._id)}>
                  <div className="flex items-start gap-2.5">
                    <Avatar name={l.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5"><span className="text-sm font-semibold text-foreground truncate">{l.name}</span><i className={`bi bi-${pr.icon}`} style={{ color: pr.color, fontSize: 12 }} title={pr.label}></i></div>
                      <div className="text-xs text-muted-foreground">{l.phone}</div>
                    </div>
                    {s?.name && <Chip color={s.color}>{s.name}</Chip>}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 text-xs">
                    <span className="text-muted-foreground truncate">{l.owner || "Unassigned"} · {l.source?.name || "No source"}</span>
                    <span style={{ color: `var(--${d.tone})` }}>{d.text}</span>
                  </div>
                  <div className="flex gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                    {!l.contactsHidden && <a className="ui-btn ui-btn-outline ui-btn-sm flex-1" href={telLink(l.phone)}><i className="bi bi-telephone"></i>Call</a>}
                    {!l.contactsHidden && <a className="ui-btn ui-btn-outline ui-btn-sm flex-1" href={waLink(l.phone)} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp"></i>Chat</a>}
                    {can("followups", "create") && <button type="button" className="ui-btn ui-btn-outline ui-btn-sm flex-1" onClick={() => setPanel({ kind: "followup", lead: l })}><i className="bi bi-calendar-plus"></i>Follow-up</button>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* tablets and up: table */}
          <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                    <th className="px-3 py-3 w-8"><input type="checkbox" aria-label="Select page" checked={allOnPage} onChange={togglePage} /></th>
                    <th className="px-3 py-3 font-medium text-left">Lead</th>
                    {columns.filter(([k]) => show(k)).map(([k, label]) => <th key={k} className="px-3 py-3 font-medium text-left whitespace-nowrap">{label}</th>)}
                    <th className="px-3 py-3 w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.loading && !rows.length ? <tr><td colSpan={99}><Spinner /></td></tr> : !rows.length ? <tr><td colSpan={99}><EmptyState icon="flag" text="No leads match." /></td></tr> : rows.map((l) => {
                    const pr = PRIORITY[l.priority] || PRIORITY.warm;
                    return (
                      <tr key={l._id} className="border-t hover:bg-accent/30 cursor-pointer" onClick={() => setOpen(l._id)}>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${l.name}`} checked={allMatching || selected.has(l._id)} onChange={() => toggleRow(l._id)} /></td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={l.name} size={30} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5"><span className="font-medium text-foreground truncate" style={{ maxWidth: 200 }}>{l.name}</span><i className={`bi bi-${pr.icon}`} style={{ color: pr.color, fontSize: 12 }} title={pr.label}></i></div>
                              <div className="text-xs text-muted-foreground">{l.phone}</div>
                            </div>
                          </div>
                        </td>
                        {columns.filter(([k]) => show(k)).map(([k]) => <td key={k} className="px-3 py-2.5 whitespace-nowrap">{cell[k](l)}</td>)}
                        <td className="px-3 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {!l.contactsHidden && <a className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Call" href={telLink(l.phone)}><i className="bi bi-telephone" style={{ fontSize: 13 }}></i></a>}
                          {!l.contactsHidden && <a className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="WhatsApp" href={waLink(l.phone)} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp" style={{ fontSize: 13 }}></i></a>}
                          {can("followups", "create") && <button type="button" className="ui-btn ui-btn-sm ui-btn-icon ui-btn-ghost" title="Follow-up" onClick={() => setPanel({ kind: "followup", lead: l })}><i className="bi bi-calendar-plus" style={{ fontSize: 13 }}></i></button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* pages */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-xs text-muted-foreground">
            <span>{total ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total}` : "0 leads"}</span>
            <div className="flex items-center gap-2">
              <select className="ui-input" style={{ height: 28 }} value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} aria-label="Rows per page">
                {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} / page</option>)}
              </select>
              <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" disabled={page <= 1 || leads.loading} onClick={() => setPage((p) => p - 1)} title="Previous"><i className="bi bi-chevron-left"></i></button>
              <span>{page} / {pages}</span>
              <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" disabled={page >= pages || leads.loading} onClick={() => setPage((p) => p + 1)} title="Next"><i className="bi bi-chevron-right"></i></button>
            </div>
          </div>
        </>
      )}

      {open && <LeadDrawer id={open} meta={m} onClose={closeLead} onChanged={reload} onFollowUp={(lead) => setPanel({ kind: "followup", lead })} onMessage={(lead) => setPanel({ kind: "message", lead })} />}
      {panel?.kind === "followup" && <FollowUpSlider lead={panel.lead} owners={m.owners || []} onClose={() => setPanel(null)} onSaved={reload} />}
      {panel?.kind === "message" && <MessagingSlider lead={panel.lead} canSms={m.canSms} onClose={() => setPanel(null)} />}
      {panel?.kind === "add" && <AddLead meta={m} onClose={() => setPanel(null)} onSaved={(id) => { setPanel(null); reload(); meta.reload(); if (id) setOpen(id); }} onOpen={(id) => { setPanel(null); setOpen(id); }} />}
      {panel?.kind === "import" && <ImportLeads meta={m} onClose={() => setPanel(null)} onDone={() => { reload(); meta.reload(); }} />}
      {panel?.kind === "duplicates" && <DuplicatesDrawer onClose={() => setPanel(null)} onChanged={reload} />}
      {panel?.kind === "trash" && <RecycleBin onClose={() => setPanel(null)} onChanged={reload} />}
      {bulk?.action === "message" && (
        <BulkMessage count={selectedCount} canSms={m.canSms} target={allMatching ? { allMatching: true, filters: listParams } : { ids: [...selected] }}
          onClose={() => setBulk(null)} onDone={() => { setBulk(null); clearSelection(); reload(); }} />
      )}
      {bulk?.action === "list" && (
        <AddToList count={selectedCount} target={allMatching ? { allMatching: true, filters: listParams } : { leadIds: [...selected] }}
          onClose={() => setBulk(null)} onDone={() => { setBulk(null); clearSelection(); }} />
      )}
      {bulk && !["message", "list"].includes(bulk.action) && (
        <BulkDialog
          action={bulk.action} count={selectedCount} meta={m}
          target={allMatching ? { allMatching: true, filters: listParams } : { ids: [...selected] }}
          onClose={() => setBulk(null)}
          onDone={() => { setBulk(null); clearSelection(); reload(); meta.reload(); }}
        />
      )}
    </div>
  );
}

function ScoreBar({ lead }) {
  const pr = PRIORITY[lead.priority] || PRIORITY.warm;
  return (
    <div className="flex items-center gap-2" title={`${pr.label} · ${lead.score}/100`}>
      <span className="h-1.5 rounded-full overflow-hidden" style={{ width: 44, background: "var(--muted-background)" }}>
        <span className="block h-full" style={{ width: `${lead.score || 0}%`, background: pr.color }} />
      </span>
      <span className="text-xs text-foreground">{lead.score ?? 0}</span>
    </div>
  );
}

function ColumnMenu({ cols, all, onToggle }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button type="button" className="ui-btn ui-btn-ghost" onClick={() => setOpen((o) => !o)}><i className="bi bi-layout-three-columns"></i>Columns</button>
      {open && (
        <>
          <span className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 left-0 mt-1 w-48 rounded-lg border bg-card shadow-lg p-1">
            {all.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 px-2 py-1.5 text-sm text-foreground rounded cursor-pointer hover:bg-accent/40">
                <input type="checkbox" checked={cols.includes(k)} onChange={() => onToggle(k)} />{label}
              </label>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

function SaveView({ disabled, onSave }) {
  const [name, setName] = useState(null);
  if (name === null) return <button type="button" className="ui-btn ui-btn-ghost" disabled={disabled} onClick={() => setName("")}><i className="bi bi-bookmark-plus"></i>Save view</button>;
  return (
    <span className="inline-flex gap-1">
      <input className="ui-input" style={{ width: 140 }} autoFocus placeholder="View name" value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { onSave(name.trim()); setName(null); } if (e.key === "Escape") setName(null); }} />
      <button type="button" className="ui-btn ui-btn-primary" disabled={!name.trim()} onClick={() => { onSave(name.trim()); setName(null); }}>Save</button>
    </span>
  );
}

/* ───────────── add lead ───────────── */
function AddLead({ meta, onClose, onSaved, onOpen }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", course: "", city: "", source: "", owner: "", statusId: "", note: "" });
  const [custom, setCustom] = useState({});
  const [dup, setDup] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const digits = form.phone.replace(/\D/g, "");

  // warn about an existing lead with this number before the user fills in the rest
  useEffect(() => {
    setDup(null);
    if (digits.length < 10) return undefined;
    let live = true;
    const t = setTimeout(() => leadsApi.checkDuplicate(form.phone).then((r) => live && setDup(r.data.duplicate ? r.data.lead : null)).catch(() => undefined), 350);
    return () => { live = false; clearTimeout(t); };
  }, [form.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    setBusy(true);
    try {
      const res = await leadsApi.convert({ ...Object.fromEntries(Object.entries(form).filter(([, v]) => v !== "")), customFields: custom });
      toast(res.data.created ? "Lead added" : "Already a lead — enquiry recorded");
      onSaved(res.data.lead._id);
    } catch (e) { toast(e.message, "error"); setBusy(false); }
  }

  const input = (k, label, props = {}) => (
    <div className={props.wide ? "sm:col-span-2" : ""}>
      <label className={labelCls}>{label}</label>
      <input className="ui-input w-full" value={form[k]} onChange={(e) => set(k, e.target.value)} {...props.input} />
    </div>
  );
  return (
    <Modal title="Add lead" onClose={onClose}
      footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={busy || !form.name.trim() || digits.length < 7 || !!dup || missingCustom(meta.customFields, custom).length > 0} onClick={save}>{busy ? "Saving…" : "Add lead"}</button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {input("name", "Name *", { input: { autoFocus: true } })}
        {input("phone", "Phone *", { input: { type: "tel", inputMode: "tel", placeholder: "+91" } })}
        {dup && (
          <div className="sm:col-span-2 rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
            <span>{dup.name} ({dup.owner || "Unassigned"}) already has this number.</span>
            <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => onOpen(dup._id)}>Open</button>
          </div>
        )}
        {input("email", "Email", { input: { type: "email" } })}
        {input("course", "Course")}
        {input("city", "City")}
        <div><label className={labelCls}>Source</label>
          <select className="ui-input w-full" value={form.source} onChange={(e) => set("source", e.target.value)}><option value="">—</option>{(meta.sources || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
        <div><label className={labelCls}>Owner</label>
          <select className="ui-input w-full" value={form.owner} onChange={(e) => set("owner", e.target.value)}><option value="">Auto-assign</option>{(meta.owners || []).map((o) => <option key={o} value={o}>{o}</option>)}</select></div>
        <div><label className={labelCls}>Status</label>
          <select className="ui-input w-full" value={form.statusId} onChange={(e) => set("statusId", e.target.value)}><option value="">First status</option>{(meta.statuses || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></div>
        <CustomFieldInputs fields={meta.customFields} values={custom} onChange={setCustom} />
        {input("note", "Note", { wide: true })}
      </div>
    </Modal>
  );
}

/* ───────────── message the selected leads ───────────── */
function BulkMessage({ count, target, canSms, onClose, onDone }) {
  const toast = useToast();
  const templates = useApi(() => templatesApi.list({ status: "Approved" }), []);
  const [v, setV] = useState({ channel: "whatsapp", template: "", text: "", subject: "" });
  const [busy, setBusy] = useState(false);
  const set = (k, val) => setV((x) => ({ ...x, [k]: val }));
  const options = (templates.data || []).filter((t) => (t.channel || "whatsapp") === v.channel);

  async function send() {
    setBusy(true);
    try {
      const res = await crmApi.bulkMessage({ ...target, ...v });
      const r = res.data;
      toast(`${r.sent} sent${r.skipped ? `, ${r.skipped} skipped` : ""}${r.failed ? `, ${r.failed} failed` : ""}${r.reasons?.length ? ` · ${r.reasons[0]}` : ""}`, r.failed ? "error" : "success");
      onDone();
    } catch (e) { toast(e.message, "error"); setBusy(false); }
  }

  return (
    <Modal title={`Message ${count} lead${count === 1 ? "" : "s"}`} onClose={onClose}
      footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={busy || (!v.template && !v.text.trim())} onClick={send}><i className="bi bi-send"></i>{busy ? "Sending…" : "Send"}</button></>}>
      <div className="space-y-3">
        <div className="flex gap-1.5">
          {[["whatsapp", "whatsapp", "WhatsApp"], ["sms", "chat-left-text", "SMS"], ["email", "envelope", "Email"]].filter(([c]) => c !== "sms" || canSms).map(([c, icon, label]) => (
            <button key={c} type="button" className={"ui-btn ui-btn-sm flex-1 " + (v.channel === c ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => setV((x) => ({ ...x, channel: c, template: "" }))}><i className={`bi bi-${icon}`}></i>{label}</button>
          ))}
        </div>
        <div><label className={labelCls}>Template</label>
          <select className="ui-input w-full" value={v.template} onChange={(e) => set("template", e.target.value)}><option value="">Write a message</option>{options.map((t) => <option key={t._id} value={t.name}>{t.name}</option>)}</select></div>
        {v.channel === "email" && <div><label className={labelCls}>Subject</label><input className="ui-input w-full" value={v.subject} onChange={(e) => set("subject", e.target.value)} /></div>}
        {!v.template && <div><label className={labelCls}>Message</label>
          <textarea className="ui-input w-full" style={{ height: "auto", padding: "8px 12px" }} rows={5} value={v.text} onChange={(e) => set("text", e.target.value)} />
          <div className="text-[11px] text-muted-foreground mt-1">{"{{first_name}} {{name}} {{course}} {{owner}}"} are filled in for each lead.</div></div>}
        {v.channel === "whatsapp" && !v.template && <div className="text-[11px]" style={{ color: "var(--warning)" }}>WhatsApp delivers free text only to people who messaged you in the last 24 hours. Use a template for everyone else.</div>}
      </div>
    </Modal>
  );
}

/* ───────────── bulk actions ───────────── */
function BulkDialog({ action, count, meta, target, onClose, onDone }) {
  const toast = useToast();
  const [v, setV] = useState({ owner: "Unassigned", statusId: "", lostReason: "", tag: "", priority: "hot", date: isoDay(1), time: "10:00", type: "Call", note: "", remove: false });
  const [busy, setBusy] = useState(false);
  const set = (k, val) => setV((x) => ({ ...x, [k]: val }));
  const lost = (meta.statuses || []).find((s) => s._id === v.statusId)?.isLost;
  const many = `${count} lead${count === 1 ? "" : "s"}`;

  async function run() {
    setBusy(true);
    try {
      const body = { ...target, action: action === "addTag" && v.remove ? "removeTag" : action };
      if (action === "assign") body.owner = v.owner;
      if (action === "status") Object.assign(body, { statusId: v.statusId, lostReason: v.lostReason });
      if (action === "addTag") body.tag = v.tag.trim();
      if (action === "priority") body.priority = v.priority;
      if (action === "followup") Object.assign(body, { date: v.date, time: v.time, type: v.type, note: v.note });
      const res = await leadsApi.bulk(body);
      toast(`${res.data.done} of ${res.data.matched} updated`, res.data.errors?.length ? "error" : "success");
      onDone();
    } catch (e) { toast(e.message, "error"); setBusy(false); }
  }

  if (action === "delete") return <Confirm danger title={`Delete ${many}?`} text="Their follow-ups and history are deleted too. This cannot be undone." confirmLabel="Delete" busy={busy} onCancel={onClose} onConfirm={run} />;

  const ready = { assign: true, status: !!v.statusId && (!lost || v.lostReason.trim()), addTag: !!v.tag.trim(), priority: true, followup: !!v.date }[action];
  const title = { assign: "Assign", status: "Change status of", addTag: "Tag", priority: "Set priority of", followup: "Schedule a follow-up for" }[action];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border bg-card shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-foreground">{title} {many}</div>
        {action === "assign" && (
          <select className="ui-input w-full" value={v.owner} onChange={(e) => set("owner", e.target.value)}><option value="Unassigned">Unassigned</option>{(meta.owners || []).map((o) => <option key={o} value={o}>{o}</option>)}</select>
        )}
        {action === "status" && <>
          <select className="ui-input w-full" value={v.statusId} onChange={(e) => set("statusId", e.target.value)}><option value="">Choose a status</option>{(meta.statuses || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select>
          {lost && <><input className="ui-input w-full" list="bulk-lost" placeholder="Lost reason" value={v.lostReason} onChange={(e) => set("lostReason", e.target.value)} /><datalist id="bulk-lost">{LOST_REASONS.map((r) => <option key={r} value={r} />)}</datalist></>}
        </>}
        {action === "addTag" && <>
          <input className="ui-input w-full" list="bulk-tags" autoFocus placeholder="Tag" value={v.tag} onChange={(e) => set("tag", e.target.value)} />
          <datalist id="bulk-tags">{(meta.tags || []).map((t) => <option key={t} value={t} />)}</datalist>
          <label className="flex items-center gap-2 text-xs text-foreground"><input type="checkbox" checked={v.remove} onChange={(e) => set("remove", e.target.checked)} />Remove this tag instead</label>
        </>}
        {action === "priority" && (
          <div className="flex gap-1.5">{Object.entries(PRIORITY).map(([k, p]) => <button key={k} type="button" className={"ui-btn flex-1 " + (v.priority === k ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => set("priority", k)}><i className={`bi bi-${p.icon}`}></i>{p.label}</button>)}</div>
        )}
        {action === "followup" && <>
          <div className="grid grid-cols-[1fr_1fr_100px] gap-2">
            <select className="ui-input w-full" value={v.type} onChange={(e) => set("type", e.target.value)}>{FU_TYPES.map((t) => <option key={t.value}>{t.value}</option>)}</select>
            <DateInput className="ui-input w-full" value={v.date} onChange={(e) => set("date", e.target.value)} />
            <input type="time" className="ui-input w-full" value={v.time} onChange={(e) => set("time", e.target.value)} />
          </div>
          <input className="ui-input w-full" placeholder="What to do" value={v.note} onChange={(e) => set("note", e.target.value)} />
        </>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="ui-btn ui-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={run} disabled={busy || !ready}>{busy ? "Working…" : "Apply"}</button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── put the selected leads on a list ───────────── */
function AddToList({ count, target, onClose, onDone }) {
  const toast = useToast();
  const lists = useApi(() => crmApi.lists(), []);
  const statics = (lists.data || []).filter((l) => l.kind === "static");
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const isNew = pick === "__new" || (!statics.length && lists.data);
  async function save() {
    setSaving(true);
    try {
      if (isNew) { const r = await crmApi.createList({ name: name.trim(), kind: "static", ...target }); toast(`List "${r.data.name}" made with ${r.data.count} lead${r.data.count === 1 ? "" : "s"}`); }
      else { const r = await crmApi.listMembers(pick, target); toast(`${r.data.changed} added · ${r.data.count} on the list`); }
      onDone();
    } catch (e) { toast(e.message, "error"); }
    finally { setSaving(false); }
  }
  return (
    <Modal title={`Add ${count} lead${count === 1 ? "" : "s"} to a list`} onClose={onClose}
      footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={saving || (isNew ? !name.trim() : !pick)} onClick={save}>{saving ? "Saving…" : "Add"}</button></>}>
      {lists.loading && !lists.data ? <Spinner /> : (
        <div className="space-y-3">
          {!!statics.length && (
            <div><label className={labelCls}>List</label>
              <select className="ui-input w-full" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Choose…</option>{statics.map((l) => <option key={l._id} value={l._id}>{l.name} ({l.count})</option>)}<option value="__new">+ New list</option>
              </select></div>
          )}
          {isNew && <div><label className={labelCls}>New list name *</label><input className="ui-input w-full" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>}
        </div>
      )}
    </Modal>
  );
}
