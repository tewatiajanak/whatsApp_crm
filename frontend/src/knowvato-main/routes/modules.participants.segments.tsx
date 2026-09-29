import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Filter,
  ArrowLeft,
  Plus,
  X,
  Users,
  Trash2,
  Play,
  Save,
} from "lucide-react";

type Op = "contains" | "equals" | "starts_with" | "not_empty" | "is_empty";
type Condition = { field: string; op: Op; value: string };
type Segment = {
  id: string;
  name: string;
  combinator: "and" | "or";
  conditions: Condition[];
  createdAt: string;
};

const FIELDS = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "mobile", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "status", label: "Status" },
];

const OPS: { key: Op; label: string; needsValue: boolean }[] = [
  { key: "contains", label: "contains", needsValue: true },
  { key: "equals", label: "equals", needsValue: true },
  { key: "starts_with", label: "starts with", needsValue: true },
  { key: "not_empty", label: "is not empty", needsValue: false },
  { key: "is_empty", label: "is empty", needsValue: false },
];

const STORAGE_ATTENDEES = "em_mock_attendees";
const STORAGE_SEGMENTS = "em_participant_segments";

const load = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_ATTENDEES) || "[]");
  } catch {
    return [];
  }
};
const loadSegs = (): Segment[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_SEGMENTS) || "[]");
  } catch {
    return [];
  }
};
const saveSegs = (s: Segment[]) => {
  try {
    localStorage.setItem(STORAGE_SEGMENTS, JSON.stringify(s));
  } catch {}
};
const uid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

const applyCondition = (row: any, c: Condition): boolean => {
  const v = (row?.[c.field] ?? "").toString().toLowerCase();
  const q = (c.value ?? "").toLowerCase();
  switch (c.op) {
    case "contains":
      return v.includes(q);
    case "equals":
      return v === q;
    case "starts_with":
      return v.startsWith(q);
    case "not_empty":
      return v !== "";
    case "is_empty":
      return v === "";
    default:
      return false;
  }
};

const evaluate = (rows: any[], seg: Segment): any[] => {
  if (seg.conditions.length === 0) return rows;
  return rows.filter((r) =>
    seg.combinator === "and"
      ? seg.conditions.every((c) => applyCondition(r, c))
      : seg.conditions.some((c) => applyCondition(r, c))
  );
};

export default function ParticipantsSegmentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [name, setName] = useState("");
  const [combinator, setCombinator] = useState<"and" | "or">("and");
  const [conditions, setConditions] = useState<Condition[]>([
    { field: "status", op: "equals", value: "confirmed" },
  ]);

  useEffect(() => {
    setRows(load());
    setSegments(loadSegs());
  }, []);

  const draft: Segment = { id: "draft", name: name || "Untitled", combinator, conditions, createdAt: "" };
  const preview = useMemo(() => evaluate(rows, draft), [rows, draft]);

  const addCondition = () =>
    setConditions([...conditions, { field: "email", op: "not_empty", value: "" }]);
  const updateCondition = (i: number, patch: Partial<Condition>) =>
    setConditions(conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeCondition = (i: number) => setConditions(conditions.filter((_, idx) => idx !== i));

  const saveSegment = () => {
    if (!name.trim()) {
      alert("Give the segment a name first");
      return;
    }
    const seg: Segment = {
      id: uid(),
      name: name.trim(),
      combinator,
      conditions,
      createdAt: new Date().toISOString(),
    };
    const next = [seg, ...segments];
    setSegments(next);
    saveSegs(next);
    setName("");
    setConditions([{ field: "status", op: "equals", value: "confirmed" }]);
  };

  const loadSegment = (s: Segment) => {
    setName(s.name);
    setCombinator(s.combinator);
    setConditions(s.conditions);
  };

  const deleteSegment = (id: string) => {
    if (!confirm("Delete this segment?")) return;
    const next = segments.filter((s) => s.id !== id);
    setSegments(next);
    saveSegs(next);
  };

  return (
    <div className="p-4 max-w-[1400px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b">
        <div>
          <Link
            to="/modules/participants"
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 transition-colors"
            style={{ textDecoration: "none" }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to Participants
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{
                background: "color-mix(in srgb, var(--info) 15%, transparent)",
                color: "var(--info)",
              }}
            >
              <Filter className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Segments</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Define audiences with a condition builder — save and reuse for messaging and reports.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Builder */}
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Segment name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP attendees who checked in"
              className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Conditions
              </label>
              <div className="inline-flex items-center rounded-md border p-0.5" style={{ background: "var(--muted-background)" }}>
                {(["and", "or"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCombinator(c)}
                    className={`h-6 px-2 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                      combinator === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {conditions.map((c, i) => {
                const op = OPS.find((o) => o.key === c.op)!;
                return (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    {i > 0 && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-8 text-center">
                        {combinator}
                      </span>
                    )}
                    <select
                      value={c.field}
                      onChange={(e) => updateCondition(i, { field: e.target.value })}
                      className="h-9 px-2 rounded-md border border-input bg-background text-sm min-w-[110px]"
                    >
                      {FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </select>
                    <select
                      value={c.op}
                      onChange={(e) => updateCondition(i, { op: e.target.value as Op })}
                      className="h-9 px-2 rounded-md border border-input bg-background text-sm min-w-[140px]"
                    >
                      {OPS.map((o) => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                    {op.needsValue && (
                      <input
                        value={c.value}
                        onChange={(e) => updateCondition(i, { value: e.target.value })}
                        placeholder="value"
                        className="h-9 px-2 rounded-md border border-input bg-background text-sm flex-1 min-w-[120px]"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeCondition(i)}
                      className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addCondition}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Add condition
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-3 border-t">
            <div className="inline-flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Matches:</span>
              <strong className="text-foreground tabular-nums">{preview.length}</strong>
              <span className="text-muted-foreground">/ {rows.length}</span>
            </div>
            <button
              type="button"
              onClick={saveSegment}
              disabled={!name.trim() || conditions.length === 0}
              className="ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-medium text-white shadow-sm disabled:opacity-40"
              style={{ background: "var(--primary)" }}
            >
              <Save className="h-3.5 w-3.5" />
              Save segment
            </button>
          </div>
        </div>

        {/* Saved list */}
        <div className="rounded-xl border bg-card p-4 h-fit">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Saved segments
          </div>
          {segments.length === 0 && (
            <div className="text-xs text-muted-foreground italic text-center py-6">
              No segments yet. Build one on the left and save it.
            </div>
          )}
          <div className="space-y-1.5">
            {segments.map((s) => (
              <div key={s.id} className="rounded-lg border p-2.5 hover:bg-accent/30 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{s.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
                      {s.conditions.length} conditions · {s.combinator}
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5 transition-opacity">
                    <button
                      type="button"
                      onClick={() => loadSegment(s)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground"
                      title="Load"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSegment(s.id)}
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-red-50 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-3 border-b flex items-center justify-between" style={{ background: "var(--muted-background)" }}>
          <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Preview ({preview.length})
          </div>
          <div className="text-[11px] text-muted-foreground">Live results as you edit</div>
        </div>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0" style={{ background: "var(--muted-background)" }}>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {FIELDS.map((f) => (
                  <th key={f.key} className="px-4 py-2 text-left font-medium">{f.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.length === 0 && (
                <tr>
                  <td colSpan={FIELDS.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No participants match. Loosen your conditions.
                  </td>
                </tr>
              )}
              {preview.slice(0, 100).map((r) => (
                <tr key={r.id} className="border-t hover:bg-accent/20">
                  {FIELDS.map((f) => (
                    <td key={f.key} className="px-4 py-2 text-xs text-foreground truncate max-w-[180px]">
                      {r[f.key] || <span className="text-muted-foreground italic">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
