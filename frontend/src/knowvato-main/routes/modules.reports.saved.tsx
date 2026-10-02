import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FolderOpen, ArrowLeft, Play, Trash2, Star, Search } from "lucide-react";
import { fmtDate } from "@/utils/date";
import { appStore } from "../../api/appStore";

type SavedReport = {
  id: string;
  name: string;
  source: string;
  fields: string[];
  conditions: any[];
  createdAt: string;
  favorite?: boolean;
};

const STORAGE = "em_saved_reports";
const load = (): SavedReport[] => {
  try {
    return JSON.parse(appStore.getItem(STORAGE) || "[]");
  } catch {
    return [];
  }
};
const save = (r: SavedReport[]) => {
  try {
    appStore.setItem(STORAGE, JSON.stringify(r));
  } catch {}
};

const SEEDED: Omit<SavedReport, "id" | "createdAt">[] = [
  { name: "All confirmed attendees", source: "attendees", fields: ["name", "email", "mobile", "status", "eventId"], conditions: [{ field: "status", op: "equals", value: "confirmed" }], favorite: true },
  { name: "Recent events with capacity", source: "events", fields: ["eventName", "eventType", "startDate", "venue", "capacity"], conditions: [] },
  { name: "Attendees without email", source: "attendees", fields: ["name", "mobile", "company", "status"], conditions: [{ field: "email", op: "is_empty", value: "" }] },
];

export default function ReportsSavedPage() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const existing = load();
    if (existing.length === 0) {
      const seeded = SEEDED.map((s) => ({ ...s, id: Math.random().toString(36).slice(2), createdAt: new Date().toISOString() }));
      save(seeded);
      setReports(seeded);
    } else setReports(existing);
  }, []);

  const persist = (next: SavedReport[]) => {
    setReports(next);
    save(next);
  };

  const filtered = reports.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));
  const favs = filtered.filter((r) => r.favorite);
  const rest = filtered.filter((r) => !r.favorite);

  const toggleFav = (id: string) => persist(reports.map((r) => (r.id === id ? { ...r, favorite: !r.favorite } : r)));
  const remove = (id: string) => {
    if (!confirm("Delete this saved report?")) return;
    persist(reports.filter((r) => r.id !== id));
  };

  const renderCard = (r: SavedReport) => (
    <div key={r.id} className="rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="text-sm font-semibold text-foreground truncate">{r.name}</div>
            {r.favorite && <Star className="h-3.5 w-3.5 fill-current" style={{ color: "var(--warning)" }} />}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 uppercase tracking-wider">
            {r.source} · {r.fields.length} fields · {r.conditions.length} filters
          </div>
        </div>
        <div className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5 transition-opacity">
          <button onClick={() => toggleFav(r.id)} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground">
            <Star className={`h-3.5 w-3.5 ${r.favorite ? "fill-current" : ""}`} />
          </button>
          <button onClick={() => remove(r.id)} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">
          Saved {fmtDate(r.createdAt)}
        </div>
        <Link
          to="/modules/reports/builder"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          style={{ textDecoration: "none" }}
        >
          <Play className="h-3 w-3" />
          Run
        </Link>
      </div>
    </div>
  );

  return (
    <div className="px-4 py-3 max-w-[1600px] mx-auto space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link to="/modules/reports" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1" style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-3 w-3" /> Back to Reports
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
              <FolderOpen className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Saved Reports</h1>
          </div>
        </div>
        <Link to="/modules/reports/builder" className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium text-white shadow-sm" style={{ background: "var(--primary)", textDecoration: "none" }}>
          New Report
        </Link>
      </div>

      <div className="rounded-xl border bg-card p-3 flex items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports…" className="w-full h-9 pl-8 pr-3 rounded-md border border-input bg-background text-sm" />
        </div>
        <div className="ml-auto text-xs text-muted-foreground">{filtered.length} of {reports.length}</div>
      </div>

      {favs.length > 0 && (
        <>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Favorites</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{favs.map(renderCard)}</div>
        </>
      )}

      {rest.length > 0 && (
        <>
          {favs.length > 0 && <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pt-2">All</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{rest.map(renderCard)}</div>
        </>
      )}

      {filtered.length === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <div className="text-sm font-medium text-foreground">No saved reports</div>
          <div className="text-xs text-muted-foreground mt-1">
            Build one in the Report Builder and hit Save.
          </div>
        </div>
      )}
    </div>
  );
}
