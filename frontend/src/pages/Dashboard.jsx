import { Link } from "react-router-dom";
import { leadsApi, followUpsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { PageHeader, Spinner, ErrorBox, StatCard, Panel, EmptyState, Chip, Avatar } from "../components/ui";
import { MyCrmPanel } from "../components/lead/MyCrm";
import { PRIORITY, fuIcon, dueInfo, timeAgo, compactMoney, isoDay, idOf } from "../components/lead/leadUtils";

const num = new Intl.NumberFormat("en-IN");
const none = () => Promise.resolve({ data: null });

// CRM home: what needs doing today, then how the pipeline is doing.
export default function Dashboard() {
  const { can, user } = useAuth();
  const seeLeads = can("leads", "view");
  const seeFollowUps = can("followups", "view");
  const counts = useApi(() => (seeLeads ? leadsApi.viewCounts() : none()), []);
  const stats = useApi(() => (seeLeads ? leadsApi.analytics({ createdFrom: isoDay(-29), createdTo: isoDay(0) }) : none()), []);
  const recent = useApi(() => (seeLeads ? leadsApi.list({ perPage: 6, sort: "-createdAt" }) : none()), []);
  const mine = useApi(() => (seeFollowUps ? followUpsApi.buckets({ owner: "me" }) : none()), []);

  const c = counts.data || {};
  const t = stats.data?.totals || {};
  const due = [...(mine.data?.overdue || []), ...(mine.data?.today || [])].slice(0, 7);
  const funnel = stats.data?.funnel || [];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));
  const tiles = [
    ["New today", c.new, "new", "stars", "info"],
    ["Not contacted", c.untouched, "untouched", "person-exclamation", "warning"],
    ["Overdue follow-ups", c.overdue, "overdue", "alarm", "destructive"],
    ["Due today", c.today, "today", "bell", "warning"],
    ["Hot leads", c.hot, "hot", "fire", "destructive"],
    ["Unassigned", c.unassigned, "unassigned", "person-dash", "info"],
  ];

  return (
    <div>
      <PageHeader title="CRM dashboard" subtitle={user?.name ? `Signed in as ${user.name}` : undefined}
        actions={seeLeads && <Link to="/crm/leads" className="ui-btn ui-btn-primary no-underline"><i className="bi bi-flag"></i>Open leads</Link>} />
      <ErrorBox error={counts.error || stats.error} />

      {seeLeads && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-3">
          {tiles.map(([label, value, view, icon, tone]) => (
            <Link key={view} to={`/crm/leads?view=${view}`} className="no-underline">
              <StatCard label={label} value={counts.loading && !counts.data ? "…" : num.format(value || 0)} icon={icon} tone={tone} />
            </Link>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
        {seeFollowUps && (
          <Panel title="My follow-ups" bodyClass="p-0" actions={<Link to="/crm/followups" className="text-xs no-underline" style={{ color: "var(--primary)" }}>All follow-ups</Link>}>
            {mine.loading && !mine.data ? <Spinner /> : !due.length ? <EmptyState icon="check2-circle" text="Nothing due today." /> : due.map((f) => {
              const d = dueInfo(f.due);
              const leadId = idOf(f.lead);
              return (
                <Link key={f._id} to={seeLeads && leadId ? `/crm/leads?lead=${leadId}` : "/crm/followups"} className="flex items-center gap-2.5 px-3 py-2 border-b last:border-b-0 hover:bg-accent/30 no-underline">
                  <i className={`bi bi-${fuIcon(f.type)}`} style={{ color: "var(--primary)" }}></i>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground truncate">{f.leadName}</span>
                    <span className="block text-xs text-muted-foreground truncate">{f.note || f.type}</span>
                  </span>
                  <Chip color={`var(--${d.tone})`}>{d.text}</Chip>
                </Link>
              );
            })}
          </Panel>
        )}

        {seeLeads && (
          <Panel title="Newest leads" bodyClass="p-0" actions={<Link to="/crm/leads" className="text-xs no-underline" style={{ color: "var(--primary)" }}>All leads</Link>}>
            {recent.loading && !recent.data ? <Spinner /> : !(recent.data || []).length ? <EmptyState icon="flag" text="No leads yet." /> : recent.data.map((l) => {
              const pr = PRIORITY[l.priority] || PRIORITY.warm;
              return (
                <Link key={l._id} to={`/crm/leads?lead=${l._id}`} className="flex items-center gap-2.5 px-3 py-2 border-b last:border-b-0 hover:bg-accent/30 no-underline">
                  <Avatar name={l.name} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5"><span className="text-sm font-medium text-foreground truncate">{l.name}</span><i className={`bi bi-${pr.icon}`} style={{ color: pr.color, fontSize: 11 }}></i></span>
                    <span className="block text-xs text-muted-foreground truncate">{l.source?.name || "No source"} · {l.owner || "Unassigned"}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo(l.createdAt)}</span>
                </Link>
              );
            })}
          </Panel>
        )}
      </div>

      <div className="mb-3" style={{ maxWidth: 520 }}><MyCrmPanel /></div>

      {seeLeads && (
        <>
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Last 30 days</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <StatCard label="Leads" value={num.format(t.leads || 0)} icon="flag" hint={`${num.format(t.open || 0)} open`} />
            <StatCard label="Won" value={num.format(t.won || 0)} icon="trophy" tone="success" hint={`${t.convRate || 0}% conversion`} />
            <StatCard label="Pipeline value" value={compactMoney(t.pipelineValue)} icon="currency-rupee" tone="info" />
            <StatCard label="First response" value={t.avgResponseHours == null ? "—" : `${t.avgResponseHours} h`} icon="stopwatch" tone="warning" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Panel title="Pipeline" actions={can("conversion", "view") && <Link to="/crm/conversion" className="text-xs no-underline" style={{ color: "var(--primary)" }}>Full report</Link>}>
              {stats.loading && !stats.data ? <Spinner /> : !funnel.some((f) => f.count) ? <EmptyState icon="funnel" text="No leads in the last 30 days." /> : funnel.filter((f) => f.count).map((f, i) => (
                <div key={f.status + i} className="grid grid-cols-[minmax(90px,35%)_1fr_32px] items-center gap-2 mb-1.5 last:mb-0">
                  <span className="text-xs text-foreground truncate">{f.status}</span>
                  <span className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted-background)" }}><span className="block h-full rounded-full" style={{ width: `${(f.count / funnelMax) * 100}%`, background: f.color || "var(--primary)" }} /></span>
                  <span className="text-xs text-right font-medium text-foreground">{f.count}</span>
                </div>
              ))}
            </Panel>
            <Panel title="Top sources" bodyClass="p-0">
              {!(stats.data?.bySource || []).length ? <EmptyState icon="broadcast" text="No leads in the last 30 days." /> : stats.data.bySource.slice(0, 6).map((s) => (
                <div key={s.source} className="flex items-center justify-between gap-2 px-3 py-2 border-b last:border-b-0">
                  <span className="flex items-center gap-2 text-sm text-foreground min-w-0"><span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: s.color }} /><span className="truncate">{s.source}</span></span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap"><span className="font-semibold text-foreground">{s.total}</span> leads · {s.won} won · {s.rate}%</span>
                </div>
              ))}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
