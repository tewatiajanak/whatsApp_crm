import { conversionApi } from "../api";
import { useApi } from "../hooks/useApi";
import { PageHeader, Spinner, ErrorBox } from "../components/ui";

export default function Conversion() {
  const stats = useApi(() => conversionApi.stats(), []);
  if (stats.loading) return <Spinner />;
  const d = stats.data || {};
  const t = d.totals || {};

  return (
    <div>
      <PageHeader title="Conversion Dashboard" />
      <ErrorBox error={stats.error} />

      <div className="row row-cols-2 row-cols-md-4 g-3 mb-4">
        {[
          ["Total leads", t.leads, "info"],
          ["Admitted", t.won, "success"],
          ["Lost", t.lost, "danger"],
          ["Conversion", (t.convRate ?? 0) + "%", "primary"],
        ].map(([label, val, tone]) => (
          <div className="col" key={label}>
            <div className="card h-100" style={{ borderRadius: 10, padding: "14px 14px 12px", minHeight: 84 }}><div style={{ fontSize: 12.5, color: "#4b5a5b", fontWeight: 500, marginBottom: 6 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.1, color: "#1e2d2d" }}>{val ?? 0}</div></div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header bg-white fw-semibold">Funnel</div>
            <div className="card-body">
              {(d.funnel || []).map((f) => {
                const max = Math.max(1, ...(d.funnel || []).map((x) => x.count));
                return (
                  <div className="mb-2" key={f.status}>
                    <div className="d-flex justify-content-between small mb-1"><span>{f.status}</span><strong>{f.count}</strong></div>
                    <div className="progress" style={{ height: 16 }}><div className="progress-bar" style={{ width: (f.count / max) * 100 + "%", background: f.color }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header bg-white fw-semibold">By counsellor</div>
            <div className="card-body p-0">
              <table className="table table-sm mb-0">
                <thead><tr><th>Counsellor</th><th className="text-end">Leads</th><th className="text-end">Won</th><th className="text-end">Rate</th></tr></thead>
                <tbody>
                  {(d.byOwner || []).map((r) => (
                    <tr key={r.owner}><td>{r.owner}</td><td className="text-end">{r.total}</td><td className="text-end">{r.won}</td><td className="text-end">{r.rate}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
