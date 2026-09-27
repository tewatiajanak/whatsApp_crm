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
    <div style={{ minHeight: "100vh", background: "#f3f6f4", color: "#15241b", fontFamily: '"DM Sans", "Segoe UI", sans-serif', fontSize: 13 }}>
      <main style={{ padding: "24px 28px 56px", maxWidth: 1400, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.02em", fontWeight: 700, fontFamily: '"DM Sans", "Segoe UI", sans-serif' }}>CRM dashboard</h1>
            <p style={{ margin: "6px 0 0", color: "#586a5f" }}>Live admissions pipeline for the current tenant. Updated from the existing CRM data.</p>
          </div>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 8, border: 0, borderRadius: 10, padding: "10px 16px", fontWeight: 600, background: "#147a3d", color: "#fff" }}>
            <i className="bi bi-download" /> Export
          </button>
        </div>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 1, background: "#e1e8e3", border: "1px solid #e1e8e3", borderRadius: 14, overflow: "hidden", marginBottom: 16 }}>
          {metrics.map((metric) => (
            <div key={metric.label} style={{ background: metric.dark ? "#0e4a2a" : "#ffffff", color: metric.dark ? "#fff" : "#15241b", padding: "18px 20px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: metric.dark ? "rgba(255,255,255,0.78)" : "#586a5f", fontWeight: 500 }}>
                <i className={`bi ${metric.icon}`} style={{ color: metric.dark ? "#7be0a3" : "#147a3d" }} />
                {metric.label}
              </div>
              <div style={{ fontWeight: 700, fontSize: 36, letterSpacing: "-0.02em", marginTop: 10 }}>{metric.value}</div>
            </div>
          ))}
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 16, marginBottom: 16 }}>
          <section style={{ background: "#fff", border: "1px solid #e1e8e3", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 14px" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Lead pipeline</h2>
              <p style={{ margin: "4px 0 0", color: "#586a5f", fontSize: 13 }}>Stage-wise totals from your current lead and conversion data.</p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "left" }}>Stage</th>
                    <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>Total</th>
                    <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "left", width: "34%" }}>Progress</th>
                    <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "left" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stageRows.map((row) => (
                    <tr key={row.stage}>
                      <th scope="row" style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3", fontWeight: 500, textAlign: "left" }}>{row.stage}</th>
                      <td style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3", textAlign: "right" }}>{row.total}</td>
                      <td style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ flex: 1, height: 6, background: "#e3eee6", borderRadius: 3, overflow: "hidden", display: "inline-block" }}>
                            <i style={{ display: "block", borderRadius: 3, width: `${row.pct}%`, height: "100%", background: "#25b25f" }} />
                          </span>
                          <b style={{ fontWeight: 600, minWidth: 44, textAlign: "right" }}>{row.pct}%</b>
                        </div>
                      </td>
                      <td style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3", color: "#586a5f" }}>{row.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{ background: "#fff", border: "1px solid #e1e8e3", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "18px 20px 14px" }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Source performance</h2>
              <p style={{ margin: "4px 0 0", color: "#586a5f", fontSize: 13 }}>Lead generation by source from your live dataset.</p>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "left" }}>Channel</th>
                    <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>Count</th>
                    <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "left", width: "34%" }}>Share</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map((row) => (
                    <tr key={row.channel}>
                      <th scope="row" style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3", fontWeight: 500, textAlign: "left" }}>{row.channel}</th>
                      <td style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3", textAlign: "right" }}>{row.total}</td>
                      <td style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ flex: 1, height: 6, background: "#e3eee6", borderRadius: 3, overflow: "hidden", display: "inline-block" }}>
                            <i style={{ display: "block", borderRadius: 3, width: `${row.pct}%`, height: "100%", background: "#25b25f" }} />
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

        <section style={{ background: "#fff", border: "1px solid #e1e8e3", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "18px 20px 14px" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Operations snapshot</h2>
            <p style={{ margin: "4px 0 0", color: "#586a5f", fontSize: 13 }}>Current activity across lead sources and follow-up operations.</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "left" }}>Service</th>
                  <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "left" }}>Status</th>
                  <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>Today</th>
                  <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>Week</th>
                  <th style={{ padding: "9px 20px", borderTop: "1px solid #e1e8e3", borderBottom: "1px solid #e1e8e3", background: "#f3f6f4", color: "#586a5f", fontSize: 12.5, fontWeight: 600, textAlign: "left" }}>Last sync</th>
                </tr>
              </thead>
              <tbody>
                {integrationRows.map((group) => (
                  <div key={group.group} style={{ display: "contents" }}>
                    <tr>
                      <th colSpan="5" style={{ background: "#f3f6f4", color: "#586a5f", padding: "8px 20px", fontSize: 12.5, fontWeight: 700, borderBottom: "1px solid #e1e8e3", borderTop: "1px solid #e1e8e3" }}>{group.group}</th>
                    </tr>
                    {group.items.map((item) => (
                      <tr key={`${group.group}-${item.name}`}>
                        <th scope="row" style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3", fontWeight: 500 }}>{item.name}</th>
                        <td style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 11px 3px 9px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: item.status === "Active" ? "#e7f4eb" : "#fdecea", color: item.status === "Active" ? "#147a3d" : "#b42318" }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                            {item.status}
                          </span>
                        </td>
                        <td style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3", textAlign: "right" }}>{item.today}</td>
                        <td style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3", textAlign: "right" }}>{item.week}</td>
                        <td style={{ padding: "12px 20px", borderBottom: "1px solid #e1e8e3", color: "#586a5f" }}>{item.last}</td>
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
