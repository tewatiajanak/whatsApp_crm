import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wrench,
  ArrowLeft,
  Save,
  Plus,
  X,
  Download,
  Database,
} from "lucide-react";

const SOURCES = [
  { key: "events", label: "Events", storage: "em_mock_events", fields: ["eventName", "eventType", "startDate", "endDate", "venue", "organizer", "capacity"] },
  { key: "attendees", label: "Registrations", storage: "em_mock_attendees", fields: ["name", "email", "mobile", "company", "status", "eventId", "createdAt"] },
  { key: "categories", label: "Categories", storage: "em_mock_categories", fields: ["name", "label", "active"] },
];

type Op = "contains" | "equals" | "not_equals" | "is_empty" | "not_empty";
type Condition = { field: string; op: Op; value: string };

const STORAGE_SAVED = "em_saved_reports";
const uid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const loadStorage = (key: string): any[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
};

const applyCondition = (row: any, c: Condition): boolean => {
  const v = (row?.[c.field] ?? "").toString().toLowerCase();
  const q = (c.value ?? "").toLowerCase();
  switch (c.op) {
    case "contains": return v.includes(q);
    case "equals": return v === q;
    case "not_equals": return v !== q;
    case "not_empty": return v !== "";
    case "is_empty": return v === "";
    default: return false;
  }
};

export default function ReportsBuilderPage() {
  const [sourceKey, setSourceKey] = useState("attendees");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [sortField, setSortField] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [limit, setLimit] = useState(100);
  const [reportName, setReportName] = useState("");

  const source = useMemo(() => SOURCES.find((s) => s.key === sourceKey)!, [sourceKey]);
  const [rawData, setRawData] = useState<any[]>([]);

  useEffect(() => {
    setRawData(loadStorage(source.storage));
    setSelectedFields(source.fields.slice(0, 4));
    setConditions([]);
  }, [source]);

  const results = useMemo(() => {
    let data = [...rawData];
    if (conditions.length > 0) {
      data = data.filter((r) => conditions.every((c) => applyCondition(r, c)));
    }
    if (sortField) {
      data.sort((a, b) => {
        const av = (a[sortField] || "").toString();
        const bv = (b[sortField] || "").toString();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return data.slice(0, limit);
  }, [rawData, conditions, sortField, sortDir, limit]);

  const toggleField = (f: string) => {
    setSelectedFields((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const addCondition = () => setConditions([...conditions, { field: source.fields[0], op: "not_empty", value: "" }]);
  const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, patch: Partial<Condition>) =>
    setConditions(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  const saveReport = () => {
    if (!reportName.trim()) {
      alert("Give the report a name first");
      return;
    }
    const saved = loadStorage(STORAGE_SAVED);
    const report = {
      id: uid(),
      name: reportName.trim(),
      source: sourceKey,
      fields: selectedFields,
      conditions,
      sort: { field: sortField, dir: sortDir },
      limit,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_SAVED, JSON.stringify([report, ...saved]));
    alert(`Saved "${reportName}"`);
    setReportName("");
  };

  const exportCsv = () => {
    if (selectedFields.length === 0) return;
    const csv = [
      selectedFields.join(","),
      ...results.map((r) => selectedFields.map((f) => `"${(r[f] ?? "").toString().replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportName || "report"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    // Log to exports history
    const exports = loadStorage("em_export_history");
    exports.unshift({
      id: uid(),
      name: reportName || "Ad-hoc export",
      entity: sourceKey,
      format: "CSV",
      rows: results.length,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("em_export_history", JSON.stringify(exports.slice(0, 50)));
  };

  return (
    <div className="p-4 max-w-[1600px] mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link to="/modules/reports" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1" style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-3 w-3" /> Back to Reports
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
              <Wrench className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Report Builder</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            No-code data explorer — pick a source, choose fields, filter, sort, and export.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* Builder rail */}
        <div className="space-y-3">
          {/* Source */}
          <div className="rounded-xl border bg-card p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Database className="h-3 w-3" />
              Data Source
            </div>
            <select
              value={sourceKey}
              onChange={(e) => setSourceKey(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <div className="text-[11px] text-muted-foreground mt-1.5">{rawData.length} records available</div>
          </div>

          {/* Fields */}
          <div className="rounded-xl border bg-card p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Fields</div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {source.fields.map((f) => (
                <label key={f} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/30 rounded px-2 py-1">
                  <input type="checkbox" checked={selectedFields.includes(f)} onChange={() => toggleField(f)} className="accent-[var(--primary)]" />
                  <span className="text-foreground font-mono">{f}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Filters</div>
              <button onClick={addCondition} className="text-xs text-primary hover:underline inline-flex items-center gap-0.5">
                <Plus className="h-3 w-3" />
                Add
              </button>
            </div>
            <div className="space-y-1.5">
              {conditions.length === 0 && <div className="text-[11px] text-muted-foreground italic">No filters</div>}
              {conditions.map((c, i) => (
                <div key={i} className="rounded border p-2 space-y-1.5">
                  <div className="flex items-center gap-1">
                    <select value={c.field} onChange={(e) => updateCondition(i, { field: e.target.value })} className="h-7 px-1.5 rounded-md border border-input bg-background text-xs flex-1">
                      {source.fields.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <button onClick={() => removeCondition(i)} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <select value={c.op} onChange={(e) => updateCondition(i, { op: e.target.value as Op })} className="w-full h-7 px-1.5 rounded-md border border-input bg-background text-xs">
                    <option value="contains">contains</option>
                    <option value="equals">equals</option>
                    <option value="not_equals">not equals</option>
                    <option value="not_empty">is not empty</option>
                    <option value="is_empty">is empty</option>
                  </select>
                  {!["not_empty", "is_empty"].includes(c.op) && (
                    <input value={c.value} onChange={(e) => updateCondition(i, { value: e.target.value })} className="w-full h-7 px-1.5 rounded-md border border-input bg-background text-xs" placeholder="value" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="rounded-xl border bg-card p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sort</div>
            <select value={sortField} onChange={(e) => setSortField(e.target.value)} className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs mb-1.5">
              <option value="">— none —</option>
              {source.fields.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <div className="inline-flex items-center rounded-md border p-0.5 w-full" style={{ background: "var(--muted-background)" }}>
              {(["asc", "desc"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setSortDir(d)}
                  className={`flex-1 h-6 rounded text-[11px] font-medium uppercase transition-colors ${sortDir === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Limit</div>
            <input type="number" value={limit} onChange={(e) => setLimit(parseInt(e.target.value) || 100)} className="w-full h-8 px-2 rounded-md border border-input bg-background text-xs" />
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-2">
            <input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Report name to save…"
              className="flex-1 min-w-[200px] h-9 px-3 rounded-md border border-input bg-background text-sm"
            />
            <button onClick={saveReport} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-xs font-medium hover:bg-accent">
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              onClick={exportCsv}
              disabled={selectedFields.length === 0 || results.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-medium text-white shadow-sm disabled:opacity-40"
              style={{ background: "var(--primary)" }}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-3 border-b flex items-center justify-between" style={{ background: "var(--muted-background)" }}>
              <div className="text-xs font-semibold text-foreground uppercase tracking-wider">Preview ({results.length})</div>
              <div className="text-[11px] text-muted-foreground">Live results</div>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: "var(--muted-background)" }}>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {selectedFields.map((f) => <th key={f} className="px-3 py-2 text-left font-medium font-mono">{f}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {selectedFields.length === 0 && (
                    <tr><td className="px-3 py-8 text-center text-muted-foreground text-sm">Select at least one field to preview</td></tr>
                  )}
                  {selectedFields.length > 0 && results.length === 0 && (
                    <tr><td colSpan={selectedFields.length} className="px-3 py-8 text-center text-muted-foreground text-sm">No results</td></tr>
                  )}
                  {results.map((r, i) => (
                    <tr key={i} className="border-t hover:bg-accent/20">
                      {selectedFields.map((f) => (
                        <td key={f} className="px-3 py-1.5 text-xs text-foreground truncate max-w-[180px]">
                          {r[f]?.toString() || <span className="text-muted-foreground italic">—</span>}
                        </td>
                      ))}
                    </tr>
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
