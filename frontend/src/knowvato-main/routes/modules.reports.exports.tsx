import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, ArrowLeft, Search, FileText, Trash2 } from "lucide-react";

type ExportJob = {
  id: string;
  name: string;
  entity: string;
  format: string;
  rows: number;
  createdAt: string;
};

const STORAGE = "em_export_history";
const load = (): ExportJob[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE) || "[]");
  } catch {
    return [];
  }
};
const save = (jobs: ExportJob[]) => {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(jobs));
  } catch {}
};

export default function ReportsExportsPage() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let existing = load();
    if (existing.length === 0) {
      // seed a few demo exports
      const now = Date.now();
      existing = [
        { id: "1", name: "All confirmed attendees", entity: "attendees", format: "CSV", rows: 1247, createdAt: new Date(now - 3_600_000).toISOString() },
        { id: "2", name: "Q3 revenue summary", entity: "orders", format: "XLSX", rows: 823, createdAt: new Date(now - 2 * 86_400_000).toISOString() },
        { id: "3", name: "October events list", entity: "events", format: "CSV", rows: 42, createdAt: new Date(now - 3 * 86_400_000).toISOString() },
      ];
      save(existing);
    }
    setJobs(existing);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => `${j.name} ${j.entity} ${j.format}`.toLowerCase().includes(q));
  }, [jobs, search]);

  const remove = (id: string) => {
    const next = jobs.filter((j) => j.id !== id);
    setJobs(next);
    save(next);
  };

  const clearAll = () => {
    if (!confirm("Clear all export history?")) return;
    setJobs([]);
    save([]);
  };

  return (
    <div className="p-4 max-w-[1400px] mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link to="/modules/reports" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1" style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-3 w-3" /> Back to Reports
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" }}>
              <Download className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Exports & Downloads</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">History of every export job — click Report Builder to run a new one.</p>
        </div>
        {jobs.length > 0 && (
          <button onClick={clearAll} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-red-50 text-muted-foreground hover:text-red-600">
            Clear history
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total exports", value: jobs.length },
          { label: "This week", value: jobs.filter((j) => Date.now() - new Date(j.createdAt).getTime() < 7 * 86_400_000).length, color: "var(--info)" },
          { label: "Total rows exported", value: jobs.reduce((a, b) => a + b.rows, 0).toLocaleString(), color: "var(--primary)" },
          { label: "CSV / XLSX / PDF", value: `${jobs.filter((j) => j.format === "CSV").length} / ${jobs.filter((j) => j.format === "XLSX").length} / ${jobs.filter((j) => j.format === "PDF").length}`, color: "var(--muted-foreground)" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-3">
            <div className="text-lg font-semibold text-foreground tabular-nums">{s.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-3 flex items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm" />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {jobs.length}</div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>
                <th className="px-4 py-3 text-left font-medium">Report</th>
                <th className="px-4 py-3 text-left font-medium">Entity</th>
                <th className="px-4 py-3 text-left font-medium">Format</th>
                <th className="px-4 py-3 text-left font-medium">Rows</th>
                <th className="px-4 py-3 text-left font-medium">Generated</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No exports yet. Head to the <Link to="/modules/reports/builder" className="text-primary hover:underline">Report Builder</Link>.
                </td></tr>
              )}
              {filtered.map((j) => (
                <tr key={j.id} className="border-t hover:bg-accent/30">
                  <td className="px-4 py-2.5">
                    <div className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate">{j.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{j.entity}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
                      {j.format}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs tabular-nums">{j.rows.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(j.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => remove(j.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
