import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { leadsApi, conversionApi, crmApi } from "../api";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi";
import { PageHeader, Spinner, ErrorBox, StatCard, Panel, EmptyState } from "../components/ui";
import DateInput from "../components/DateInput";
import { compactMoney, isoDay } from "../components/lead/leadUtils";

const RANGES = [["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["all", "All time"]];
const num = new Intl.NumberFormat("en-IN");

// Lead analytics: conversion, sources, counsellors, lost reasons and pipeline health.
export default function Conversion() {
  const [range, setRange] = useState("30");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [owner, setOwner] = useState("");
  const [source, setSource] = useState("");

  const params = useMemo(() => {
    const p = { owner, source };
    if (range === "custom") Object.assign(p, { createdFrom: custom.from, createdTo: custom.to });
    else if (range !== "all") Object.assign(p, { createdFrom: isoDay(1 - Number(range)), createdTo: isoDay(0) });
    return p;
  }, [range, custom, owner, source]);

  const { can } = useAuth();
  const toast = useToast();
  const spendMonth = isoDay(0).slice(0, 7);
  const spend = useApi(() => crmApi.spend(spendMonth), []);
  const [spending, setSpending] = useState(null);
  const seeLeads = can("leads", "view");
  const meta = useApi(() => (seeLeads ? leadsApi.meta() : Promise.resolve({ data: {} })), []);
  const stats = useApi(() => conversionApi.stats(params), [params]);
  const d = stats.data;
  const t = d?.totals || {};
  const funnelMax = Math.max(1, ...(d?.funnel || []).map((f) => f.count));

  return (
    <div>
      <PageHeader
        title="Conversion"
        actions={<>
          <select className="ui-input hidden sm:block" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
            <option value="">All sources</option>{(meta.data?.sources || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </select>
          <select className="ui-input" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner">
            <option value="">Everyone</option><option value="me">Mine</option>{(meta.data?.visibleOwners || []).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </>}
      />

      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {RANGES.map(([v, label]) => <button key={v} type="button" className={"ui-btn ui-btn-sm " + (range === v ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => setRange(v)}>{label}</button>)}
        <button type="button" className={"ui-btn ui-btn-sm " + (range === "custom" ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => setRange("custom")}>Custom</button>
        {range === "custom" && <>
          <DateInput className="ui-input" wrapperStyle={{ width: 140 }} value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} title="From" />
          <DateInput className="ui-input" wrapperStyle={{ width: 140 }} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} title="To" />
        </>}
      </div>

      <ErrorBox error={stats.error} />
      {stats.loading && !d ? <Spinner /> : !d ? null : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Leads" value={num.format(t.leads)} icon="flag" hint={`${num.format(t.open)} open`} />
            <StatCard label="Won" value={num.format(t.won)} icon="trophy" tone="success" hint={`${t.convRate}% conversion`} />
            <StatCard label="Lost" value={num.format(t.lost)} icon="x-circle" tone="destructive" />
            <StatCard label="Pipeline value" value={compactMoney(t.pipelineValue)} icon="currency-rupee" tone="info" hint={`${compactMoney(t.wonValue)} won`} />
            <StatCard label="First response" value={t.avgResponseHours === null ? "—" : `${t.avgResponseHours} h`} icon="stopwatch" tone="warning" hint="Average time to first contact" />
            <StatCard label="Time to win" value={t.avgDaysToWin === null ? "—" : `${t.avgDaysToWin} d`} icon="hourglass-split" tone="info" hint="Average days, created to won" />
            <StatCard label="Not contacted" value={num.format(t.untouched)} icon="person-exclamation" tone="warning" hint="Open leads never reached" />
            <StatCard label="Overdue follow-ups" value={num.format(t.overdueFollowUps)} icon="alarm" tone="destructive" hint={`${num.format(t.noFollowUp)} open leads have none`} />
          </div>

          <Panel title="Leads and wins by day" bodyClass="p-3">
            {d.trend.some((x) => x.leads || x.won) ? (
              <div style={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={d.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={(v) => v.slice(8) + "/" + v.slice(5, 7)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={{ stroke: "var(--border)" }} minTickGap={18} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} labelFormatter={(v) => v.split("-").reverse().join("-")} />
                    <Bar dataKey="leads" name="New leads" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                    <Line dataKey="won" name="Won" stroke="var(--success)" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyState icon="bar-chart" text="No leads in this period." />}
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Panel title="Funnel">
              {!d.funnel.length ? <EmptyState icon="funnel" text="No statuses set up." /> : d.funnel.map((f, i) => {
                const prev = i ? d.funnel[i - 1].count : null;
                return (
                  <div key={f.status + i} className="mb-2.5 last:mb-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground">{f.status}</span>
                      <span className="text-muted-foreground"><span className="font-semibold text-foreground">{f.count}</span>{prev ? ` · ${Math.round((f.count / prev) * 100)}% of previous` : ""}</span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--muted-background)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(f.count / funnelMax) * 100}%`, background: f.color || "var(--primary)" }} />
                    </div>
                  </div>
                );
              })}
            </Panel>

            <Panel title="Needs attention" bodyClass="p-0">
              {[
                ["Not contacted yet", t.untouched, "untouched", "person-exclamation"],
                ["Overdue follow-ups", t.overdueFollowUps, "overdue", "alarm"],
                ["Going cold (idle a week)", t.stale, "stale", "snow"],
                ...d.byPriority.filter((p) => p.priority === "hot").map((p) => ["Hot leads", p.count, "hot", "fire"]),
              ].map(([label, count, view, icon]) => (
                <Link key={view} to={seeLeads ? `/crm/leads?view=${view}` : "#"} className="flex items-center justify-between gap-2 px-3 py-2.5 border-b last:border-b-0 hover:bg-accent/30 no-underline">
                  <span className="flex items-center gap-2 text-sm text-foreground"><i className={`bi bi-${icon} text-muted-foreground`}></i>{label}</span>
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">{num.format(count)}<i className="bi bi-chevron-right text-muted-foreground" style={{ fontSize: 11 }}></i></span>
                </Link>
              ))}
              <div className="px-3 py-2.5">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Age of open leads</div>
                <Bars rows={d.aging.map((a) => ({ label: a.label, count: a.count }))} />
              </div>
            </Panel>
          </div>

          <Panel title="Source performance" bodyClass="p-0"
            actions={can("setup", "edit") && seeLeads && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => setSpending(Object.fromEntries((meta.data?.sources || []).map((x) => [x._id, (spend.data?.rows || []).find((r) => r.source === x._id)?.amount || ""])))}><i className="bi bi-currency-rupee"></i>Spend this month</button>}>
            <Table
              head={["Source", "Leads", "Open", "Won", "Lost", "Conversion", "Won value", "Spend", "Cost per lead", "Cost per win"]}
              rows={d.bySource.map((r) => {
                // spend is recorded per calendar month; it is compared with the leads in the chosen period
                const src = (meta.data?.sources || []).find((x) => x.name === r.source);
                const cost = (spend.data?.rows || []).find((x) => x.source === src?._id)?.amount || 0;
                return [<span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: r.color }} />{r.source}</span>, r.total, r.open, r.won, r.lost, <Rate v={r.rate} />, compactMoney(r.wonValue),
                  cost ? compactMoney(cost) : "—", cost && r.total ? compactMoney(Math.round(cost / r.total)) : "—", cost && r.won ? compactMoney(Math.round(cost / r.won)) : "—"];
              })}
            />
          </Panel>

          <Panel title="Counsellor performance" bodyClass="p-0">
            <Table
              head={["Counsellor", "Leads", "Open", "Won", "Conversion", "Calls", "Follow-ups done", "Overdue"]}
              rows={d.byOwner.map((r) => [r.owner, r.total, r.open, r.won, <Rate v={r.rate} />, r.calls, r.followUpsDone, r.followUpsOverdue ? <span style={{ color: "var(--destructive)" }}>{r.followUpsOverdue}</span> : 0])}
            />
          </Panel>

          <Panel title="Why leads are lost">
            {d.lostReasons.length ? <Bars rows={d.lostReasons.map((r) => ({ label: r.reason, count: r.count }))} tone="destructive" /> : <EmptyState icon="emoji-smile" text="No lost leads in this period." />}
          </Panel>
        </div>
      )}
      {spending && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" onClick={() => setSpending(null)}>
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-foreground">Spent on each source · {spendMonth.split("-").reverse().join("-")}</div>
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "50vh" }}>
              {(meta.data?.sources || []).map((x) => (
                <div key={x._id} className="grid grid-cols-[1fr_120px] gap-2 items-center">
                  <span className="text-sm text-foreground truncate">{x.name}</span>
                  <input className="ui-input w-full" type="number" min="0" placeholder="₹" value={spending[x._id]} onChange={(e) => setSpending((v) => ({ ...v, [x._id]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="ui-btn ui-btn-outline" onClick={() => setSpending(null)}>Cancel</button>
              <button type="button" className="ui-btn ui-btn-primary" onClick={async () => { try { await crmApi.saveSpend(spendMonth, Object.entries(spending).map(([source, amount]) => ({ source, amount: Number(amount) || 0 }))); toast("Spend saved"); setSpending(null); spend.reload(); } catch (e) { toast(e.message, "error"); } }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Rate = ({ v }) => <span className="font-medium" style={{ color: v >= 25 ? "var(--success)" : v > 0 ? "var(--foreground)" : "var(--muted-foreground)" }}>{v}%</span>;

function Bars({ rows, tone = "primary" }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows.map((r) => (
    <div key={r.label} className="grid grid-cols-[minmax(90px,35%)_1fr_32px] items-center gap-2 mb-1.5 last:mb-0">
      <span className="text-xs text-foreground truncate" title={r.label}>{r.label}</span>
      <span className="h-2 rounded-full overflow-hidden" style={{ background: "var(--muted-background)" }}>
        <span className="block h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: `var(--${tone})` }} />
      </span>
      <span className="text-xs text-right font-medium text-foreground">{r.count}</span>
    </div>
  ));
}

function Table({ head, rows }) {
  if (!rows.length) return <EmptyState icon="table" text="Nothing in this period." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
            {head.map((h, i) => <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap" style={{ textAlign: i ? "right" : "left" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {r.map((c, j) => <td key={j} className="px-3 py-2 whitespace-nowrap" style={{ textAlign: j ? "right" : "left" }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
