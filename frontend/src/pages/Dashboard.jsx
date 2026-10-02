import { useMemo } from "react";
import { conversionApi, leadsApi, followUpsApi } from "../api";
import { useApi } from "../hooks/useApi";

const numberFmt = new Intl.NumberFormat("en-IN");

const formatMoney = (value) => {
  const num = Number(value || 0);
  if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num}`;
};

const toSafeArray = (value) => (Array.isArray(value) ? value : []);

export default function Dashboard() {
  const conversionStats = useApi(() => conversionApi.stats(), []);
  const leadsList = useApi(() => leadsApi.list({ page: 1, perPage: 200 }), []);
  const followups = useApi(() => followUpsApi.buckets({ owner: "All" }), []);

  const leadItems = toSafeArray(leadsList.data?.items || leadsList.data);
  const funnel = toSafeArray(conversionStats.data?.funnel);
  const totals = conversionStats.data?.totals || {};
  const followupCounts = followups.data?.counts || {};

  const metrics = useMemo(() => {
    const totalLeads = Number(totals.leads ?? leadItems.length ?? 0);
    const won = Number(totals.won ?? 0);
    const lost = Number(totals.lost ?? 0);
    const open = Number(totals.open ?? Math.max(0, totalLeads - won - lost));
    const followUpCount = Number(followupCounts.today ?? 0) + Number(followupCounts.overdue ?? 0) + Number(followupCounts.upcoming ?? 0);
    const collected = leadItems.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0);

    return [
      { label: "Leads", value: numberFmt.format(totalLeads), icon: "bi-search" },
      { label: "Registrations", value: numberFmt.format(Math.max(0, won)), icon: "bi-file-earmark-text" },
      { label: "Conversions", value: numberFmt.format(Math.max(0, won)), icon: "bi-check-circle" },
      { label: "Follow-ups", value: numberFmt.format(followUpCount || open), icon: "bi-telephone" },
      { label: "Collected amount", value: formatMoney(collected), icon: "bi-currency-rupee", dark: true },
    ];
  }, [leadItems, followupCounts, totals]);

  const stageRows = useMemo(() => {
    const rows = funnel.length ? funnel : [
      { status: "Leads", count: Number(totals.leads ?? leadItems.length ?? 0) },
      { status: "Registrations", count: Number(totals.won ?? 0) },
      { status: "Follow-ups", count: Number(followupCounts.today ?? 0) },
      { status: "Conversions", count: Number(totals.won ?? 0) },
    ];

    const maxCount = Math.max(1, ...rows.map((r) => Number(r.count || 0)));

    return rows.map((row) => ({
      stage: row.status,
      today: Number(row.count || 0),
      total: Number(row.count || 0),
      pct: Math.round((Number(row.count || 0) / maxCount) * 100),
      date: "Today",
    }));
  }, [funnel, followupCounts, leadItems.length, totals]);

  const sourceRows = useMemo(() => {
    const sourceData = Array.isArray(conversionStats.data?.bySource) ? conversionStats.data.bySource : [];
    if (!sourceData.length && leadItems.length) {
      const map = {};
      for (const lead of leadItems) {
        const sourceName = lead.source?.name || "Direct";
        map[sourceName] = (map[sourceName] || 0) + 1;
      }
      return Object.entries(map).map(([name, total]) => ({ channel: name, total, pct: Math.min(100, Math.round((total / Math.max(1, leadItems.length)) * 100)) }));
    }
    return sourceData.slice(0, 4).map((item) => ({
      channel: item.source || "Source",
      total: Number(item.total || 0),
      pct: Math.min(100, Math.max(10, Number(item.rate || 0))),
    }));
  }, [conversionStats.data, leadItems]);

  const integrationRows = useMemo(() => {
    const sourceData = Array.isArray(conversionStats.data?.bySource) ? conversionStats.data.bySource : [];
    const rows = sourceData.length ? sourceData.slice(0, 3) : [
      { source: "Website", total: Number(totals.leads || leadItems.length || 0), rate: 62 },
      { source: "WhatsApp", total: Number(followupCounts.today || 0), rate: 44 },
      { source: "Instagram", total: Number(totals.won || 0), rate: 31 },
    ];

    return [
      {
        group: "Lead sources",
        items: rows.map((item) => ({
          name: item.source || "Lead source",
          status: "Active",
          today: Number(item.total || 0),
          week: Number(item.total || 0),
          last: "Today",
        })),
      },
      {
        group: "Operations",
        items: [
          {
            name: "WhatsApp follow-ups",
            status: followupCounts.today ? "Active" : "Idle",
            today: Number(followupCounts.today || 0),
            week: Number(followupCounts.overdue || 0) + Number(followupCounts.upcoming || 0),
            last: "Today",
          },
          {
            name: "Lead conversion",
            status: Number(totals.convRate || 0) > 0 ? "Active" : "Monitoring",
            today: Number(totals.won || 0),
            week: Number(totals.leads || 0),
            last: `${Number(totals.convRate || 0)}%`,
          },
        ],
      },
    ];
  }, [conversionStats.data, followupCounts, leadItems.length, totals]);

  return (
    <div style={{ color: "var(--foreground)", fontSize: 13 }}>
      <main style={{ maxWidth: 1280, width: "100%", margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "12px 0 18px", borderBottom: "1px solid var(--border)" }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1f2a2c", letterSpacing: "-0.04em", lineHeight: 1.2 }}>CRM dashboard</h1>
          <button className="ui-btn ui-btn-primary">
            <i className="bi bi-download" style={{ fontSize: 12.5, lineHeight: 1 }} /> Export
          </button>
        </header>

        <div style={{ marginTop: 18, marginBottom: 16, color: "#6d787a", fontSize: 12.5, lineHeight: 1.5 }}>
          Live admissions pipeline for the current tenant. Updated from the existing CRM data.
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 16, marginBottom: 22 }}>
          {metrics.map((metric) => (
            <div
              key={metric.label}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "14px 14px 12px",
                minHeight: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: "#4b5a5b", fontWeight: 500, marginBottom: 6 }}>{metric.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: "#1e2d2d" }}>{metric.value}</div>
              </div>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-foreground)",
                  fontSize: 14,
                  marginLeft: 10,
                  flexShrink: 0,
                }}
              >
                <i className={`bi ${metric.icon}`} />
              </div>
            </div>
          ))}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 20, marginBottom: 20 }}>
          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px 12px" }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1f2d2b" }}>Lead pipeline</h2>
              <p style={{ margin: "2px 0 0", color: "#6d787a", fontSize: 11 }}>Stage-wise totals from your current lead and conversion data.</p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "left" }}>Stage</th>
                    <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "right" }}>Total</th>
                    <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "left", width: "34%" }}>Progress</th>
                    <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "left" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stageRows.map((row) => (
                    <tr key={row.stage}>
                      <th scope="row" style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", fontWeight: 500, textAlign: "left" }}>{row.stage}</th>
                      <td style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", textAlign: "right" }}>{row.total}</td>
                      <td style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ flex: 1, height: 6, background: "var(--accent)", borderRadius: 3, overflow: "hidden", display: "inline-block" }}>
                            <i style={{ display: "block", borderRadius: 3, width: `${row.pct}%`, height: "100%", background: "var(--primary)" }} />
                          </span>
                          <b style={{ fontWeight: 600, minWidth: 44, textAlign: "right" }}>{row.pct}%</b>
                        </div>
                      </td>
                      <td style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", color: "#6d787a" }}>{row.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px 12px" }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1f2d2b" }}>Source performance</h2>
              <p style={{ margin: "2px 0 0", color: "#6d787a", fontSize: 11 }}>Lead generation by source from your live dataset.</p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "left" }}>Channel</th>
                    <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "right" }}>Count</th>
                    <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "left", width: "34%" }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map((row) => (
                    <tr key={row.channel}>
                      <th scope="row" style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", fontWeight: 500, textAlign: "left" }}>{row.channel}</th>
                      <td style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", textAlign: "right" }}>{row.total}</td>
                      <td style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ flex: 1, height: 6, background: "var(--accent)", borderRadius: 3, overflow: "hidden", display: "inline-block" }}>
                            <i style={{ display: "block", borderRadius: 3, width: `${row.pct}%`, height: "100%", background: "var(--primary)" }} />
                          </span>
                          <b style={{ fontWeight: 600, minWidth: 44, textAlign: "right" }}>{row.pct}%</b>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "16px 18px 12px" }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1f2d2b" }}>Operations snapshot</h2>
            <p style={{ margin: "2px 0 0", color: "#6d787a", fontSize: 11 }}>Current activity across lead sources and follow-up operations.</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "left" }}>Service</th>
                  <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "left" }}>Status</th>
                  <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "right" }}>Today</th>
                  <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "right" }}>Week</th>
                  <th style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", background: "var(--surface-2)", color: "#5d6d6d", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", textAlign: "left" }}>Last sync</th>
                </tr>
              </thead>
              <tbody>
                {integrationRows.map((group) => (
                  <div key={group.group} style={{ display: "contents" }}>
                    <tr>
                      <th colSpan="5" style={{ background: "var(--surface-2)", color: "#5d6d6d", padding: "8px 18px", fontSize: 12, fontWeight: 700, borderTop: "1px solid var(--border)" }}>{group.group}</th>
                    </tr>
                    {group.items.map((item) => (
                      <tr key={`${group.group}-${item.name}`}>
                        <th scope="row" style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", fontWeight: 500 }}>{item.name}</th>
                        <td style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 11px 3px 9px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: item.status === "Active" ? "var(--success-bg)" : "var(--destructive-bg)", color: item.status === "Active" ? "var(--success)" : "var(--destructive)" }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", textAlign: "right" }}>{item.today}</td>
                        <td style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", textAlign: "right" }}>{item.week}</td>
                        <td style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", color: "#6d787a" }}>{item.last}</td>
                      </tr>
                    ))}
                  </div>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
