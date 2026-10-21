import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { reportsApi } from "../api";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { PageHeader, Spinner, ErrorBox, EmptyState, Chip, Modal, Confirm, Tabs, Panel } from "../components/ui";
import DateInput from "../components/DateInput";
import { formatDate, formatDateTime } from "../utils/dateFormat";
import { money, compactMoney, labelCls } from "../components/lead/leadUtils";

const num = new Intl.NumberFormat("en-IN");
const PALETTE = ["var(--primary)", "#6366f1", "#f59e0b", "#10b981", "#ef4444", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6", "#84cc16"];
// recharts needs real colours, not CSS variables
const cssColor = (c) => (c?.startsWith("var(") ? getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1)).trim() || "#0f766e" : c);
const PERIODS = [["all", "All time"], ["today", "Today"], ["yesterday", "Yesterday"], ["this_week", "This week"], ["last_7", "Last 7 days"], ["this_month", "This month"], ["last_month", "Last month"], ["last_30", "Last 30 days"], ["last_90", "Last 90 days"], ["this_quarter", "This quarter"], ["this_year", "This year"], ["fy", "Financial year"], ["custom", "Custom"]];
const OPS_FOR = {
  string: [["contains", "contains"], ["eq", "is"], ["ne", "is not"], ["starts", "starts with"], ["in", "is any of"], ["empty", "is empty"], ["notEmpty", "is filled"]],
  enum: [["eq", "is"], ["ne", "is not"], ["in", "is any of"], ["nin", "is none of"]],
  ref: [["eq", "is"], ["ne", "is not"], ["in", "is any of"], ["nin", "is none of"], ["empty", "is empty"]],
  number: [["gte", "at least"], ["lte", "at most"], ["eq", "equals"], ["gt", "more than"], ["lt", "less than"], ["between", "between"]],
  date: [["gte", "on or after"], ["lte", "on or before"], ["between", "between"], ["empty", "is empty"], ["notEmpty", "is filled"]],
  bool: [["true", "is yes"], ["false", "is no"]],
  array: [["contains", "has"], ["empty", "is empty"], ["notEmpty", "is filled"]],
};
const AGG_LABEL = { count: "Count", sum: "Total", avg: "Average", min: "Lowest", max: "Highest", distinct: "Unique count" };
const NOVALUE = new Set(["empty", "notEmpty", "true", "false"]);
const fmt = (col, v) => (v === null || v === undefined || v === "" ? "—" : col.type === "date" && typeof v === "string" && v.length > 10 ? formatDate(v) : col.money ? money(v) : typeof v === "number" ? num.format(v) : String(v));

async function exportExcel(result, name) {
  const XLSX = await import("xlsx");
  const rows = result.rows.map((r) => Object.fromEntries(result.columns.map((c) => [c.label, c.type === "date" && r[c.key] ? formatDate(r[c.key]) : r[c.key] ?? ""])));
  if (result.mode === "summary" && result.totals && Object.keys(result.totals).length) rows.push(Object.fromEntries(result.columns.map((c, i) => [c.label, i === 0 ? "Total" : result.totals[c.key] ?? ""])));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = result.columns.map((c) => ({ wch: Math.min(40, Math.max(10, c.label.length + 4)) }));
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${name.replace(/[^\w\- ]+/g, "") || "report"}.xlsx`);
}

/* ───────────── what to report on ───────────── */
export const blankSpec = (source = "leads") => ({ source, mode: "summary", period: { preset: "this_month" }, dateField: "", columns: [], filters: [], groupBy: [{ field: source === "deals" ? "stage" : source === "leads" ? "source" : "", bucket: "month" }].filter((g) => g.field), measures: [{ agg: "count" }], sort: { by: "", dir: "desc" }, limit: 500 });

function FilterRow({ src, f, set, remove }) {
  const field = src.fields.find((x) => x.key === f.field) || src.fields[0];
  const ops = OPS_FOR[field.type] || OPS_FOR.string;
  const op = ops.some(([k]) => k === f.op) ? f.op : ops[0][0];
  const multi = op === "in" || op === "nin";
  const valueInput = () => {
    if (NOVALUE.has(op)) return null;
    if (field.options) {
      if (multi) return (
        <div className="flex flex-wrap gap-1 flex-1 min-w-[160px]">
          {field.options.map((o) => { const on = (f.value || []).includes(o.value); return <button key={o.value} type="button" className={"ui-btn ui-btn-sm " + (on ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => set({ ...f, op, value: on ? f.value.filter((x) => x !== o.value) : [...(f.value || []), o.value] })}>{o.label}</button>; })}
        </div>
      );
      return <select className="ui-input flex-1 min-w-[140px]" aria-label="Value" value={f.value || ""} onChange={(e) => set({ ...f, op, value: e.target.value })}><option value="">Select</option>{field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    }
    if (field.type === "date") {
      if (op === "between") { const [a = "", b = ""] = Array.isArray(f.value) ? f.value : []; return <span className="flex gap-1.5 flex-1"><DateInput className="ui-input" value={a} onChange={(e) => set({ ...f, op, value: [e.target.value, b] })} /><DateInput className="ui-input" value={b} onChange={(e) => set({ ...f, op, value: [a, e.target.value] })} /></span>; }
      return <DateInput className="ui-input flex-1" value={f.value || ""} onChange={(e) => set({ ...f, op, value: e.target.value })} />;
    }
    if (field.type === "number" && op === "between") { const [a = "", b = ""] = Array.isArray(f.value) ? f.value : []; return <span className="flex gap-1.5 flex-1"><input type="number" className="ui-input w-full" aria-label="From" value={a} onChange={(e) => set({ ...f, op, value: [e.target.value, b] })} /><input type="number" className="ui-input w-full" aria-label="To" value={b} onChange={(e) => set({ ...f, op, value: [a, e.target.value] })} /></span>; }
    return <input type={field.type === "number" ? "number" : "text"} className="ui-input flex-1 min-w-[120px]" aria-label="Value" value={Array.isArray(f.value) ? f.value.join(", ") : f.value || ""} onChange={(e) => set({ ...f, op, value: multi ? e.target.value.split(",").map((x) => x.trim()) : e.target.value })} />;
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select className="ui-input" style={{ width: 160 }} aria-label="Field" value={field.key} onChange={(e) => set({ field: e.target.value, op: "", value: "" })}>{src.fields.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
      <select className="ui-input" style={{ width: 130 }} aria-label="Condition" value={op} onChange={(e) => set({ ...f, op: e.target.value, value: ["in", "nin"].includes(e.target.value) ? [] : "" })}>{ops.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      {valueInput()}
      <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Remove filter" onClick={remove}><i className="bi bi-x-lg"></i></button>
    </div>
  );
}

export function SpecEditor({ meta, spec, setSpec, compact = false, lockMode }) {
  const src = meta.sources.find((s) => s.key === spec.source) || meta.sources[0];
  const set = (patch) => setSpec({ ...spec, ...patch });
  const dates = src.fields.filter((f) => f.type === "date");
  const numbers = src.fields.filter((f) => f.type === "number");
  const groupable = src.fields.filter((f) => f.type !== "number" || f.key === "score");
  const mode = lockMode || spec.mode;
  const g = "grid grid-cols-1 sm:grid-cols-2 gap-2";
  return (
    <div className="space-y-3">
      <div className={g}>
        <div><label className={labelCls}>Report on</label><select className="ui-input w-full" value={spec.source} onChange={(e) => setSpec({ ...blankSpec(e.target.value), mode: lockMode || spec.mode, period: spec.period })}>{meta.sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
        {!lockMode && <div><label className={labelCls}>Show as</label><div className="grid grid-cols-2 gap-1 rounded-lg border p-1">{[["summary", "Summary"], ["list", "List of records"]].map(([k, l]) => <button key={k} type="button" className={"ui-btn ui-btn-sm " + (spec.mode === k ? "ui-btn-primary" : "ui-btn-ghost")} onClick={() => set({ mode: k })}>{l}</button>)}</div></div>}
        <div><label className={labelCls}>Period</label><select className="ui-input w-full" value={spec.period?.preset || "all"} onChange={(e) => set({ period: { ...spec.period, preset: e.target.value } })}>{PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label className={labelCls}>Period applies to</label><select className="ui-input w-full" value={spec.dateField || src.date} onChange={(e) => set({ dateField: e.target.value })}>{dates.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></div>
        {spec.period?.preset === "custom" && <><div><label className={labelCls}>From</label><DateInput className="ui-input w-full" value={spec.period.from || ""} onChange={(e) => set({ period: { ...spec.period, from: e.target.value } })} /></div><div><label className={labelCls}>To</label><DateInput className="ui-input w-full" value={spec.period.to || ""} onChange={(e) => set({ period: { ...spec.period, to: e.target.value } })} /></div></>}
      </div>

      {mode === "summary" ? (
        <div className="space-y-2">
          {[0, 1].map((i) => {
            const gb = spec.groupBy?.[i];
            if (i === 1 && !spec.groupBy?.[0]) return null;
            const f = src.fields.find((x) => x.key === gb?.field);
            return (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[160px]"><label className={labelCls}>{i === 0 ? "Group by" : "Then by"}</label>
                  <select className="ui-input w-full" value={gb?.field || ""} onChange={(e) => { const next = [...(spec.groupBy || [])]; if (e.target.value) next[i] = { field: e.target.value, bucket: gb?.bucket || "month" }; else next.splice(i); set({ groupBy: next.filter(Boolean) }); }}>
                    <option value="">{i === 0 ? "Nothing (one total)" : "—"}</option>{groupable.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                  </select>
                </div>
                {f?.type === "date" && <div><label className={labelCls}>By</label><select className="ui-input" value={gb.bucket || "month"} onChange={(e) => { const next = [...spec.groupBy]; next[i] = { ...gb, bucket: e.target.value }; set({ groupBy: next }); }}>{["day", "week", "month", "quarter", "year"].map((b) => <option key={b} value={b}>{b[0].toUpperCase() + b.slice(1)}</option>)}</select></div>}
              </div>
            );
          })}
          <div>
            <label className={labelCls}>Show</label>
            <div className="space-y-1.5">
              {(spec.measures || []).map((m, i) => (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <select className="ui-input" style={{ width: 150 }} aria-label="Calculation" value={m.agg} onChange={(e) => { const next = [...spec.measures]; next[i] = { ...m, agg: e.target.value, field: e.target.value === "count" ? "" : m.field || numbers[0]?.key || "" }; set({ measures: next }); }}>
                    {Object.entries(AGG_LABEL).filter(([k]) => k === "count" || k === "distinct" || numbers.length).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  {m.agg !== "count" && <select className="ui-input flex-1 min-w-[140px]" aria-label="Of" value={m.field || ""} onChange={(e) => { const next = [...spec.measures]; next[i] = { ...m, field: e.target.value }; set({ measures: next }); }}>{(m.agg === "distinct" ? src.fields : numbers).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</select>}
                  {!compact && <input className="ui-input" style={{ width: 150 }} aria-label="Column name" title="Column name" value={m.label || ""} onChange={(e) => { const next = [...spec.measures]; next[i] = { ...m, label: e.target.value }; set({ measures: next }); }} />}
                  {spec.measures.length > 1 && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Remove" onClick={() => set({ measures: spec.measures.filter((_, j) => j !== i) })}><i className="bi bi-x-lg"></i></button>}
                </div>
              ))}
              {(spec.measures || []).length < (compact ? 2 : 6) && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => set({ measures: [...(spec.measures || []), { agg: numbers.length ? "sum" : "count", field: numbers[0]?.key || "" }] })}><i className="bi bi-plus-lg"></i>Add a number</button>}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <label className={labelCls}>Columns</label>
          <div className="flex flex-wrap gap-1.5">
            {src.fields.map((f) => { const on = (spec.columns || []).includes(f.key); return <button key={f.key} type="button" className={"ui-btn ui-btn-sm " + (on ? "ui-btn-primary" : "ui-btn-outline")} onClick={() => set({ columns: on ? spec.columns.filter((x) => x !== f.key) : [...(spec.columns || []), f.key] })}>{on && <i className="bi bi-check-lg"></i>}{f.label}</button>; })}
          </div>
          {!(spec.columns || []).length && <div className="text-[11px] text-muted-foreground mt-1">None picked: the first few columns are shown</div>}
        </div>
      )}

      <div>
        <label className={labelCls}>Filters</label>
        <div className="space-y-1.5">
          {(spec.filters || []).map((f, i) => <FilterRow key={i} src={src} f={f} set={(nf) => { const next = [...spec.filters]; next[i] = nf; set({ filters: next }); }} remove={() => set({ filters: spec.filters.filter((_, j) => j !== i) })} />)}
          <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => set({ filters: [...(spec.filters || []), { field: src.fields[0].key, op: "", value: "" }] })}><i className="bi bi-funnel"></i>Add filter</button>
        </div>
      </div>

      {!compact && (
        <div className="flex flex-wrap items-end gap-2">
          <div><label className={labelCls}>Sort by</label>
            <select className="ui-input" style={{ width: 180 }} value={spec.sort?.by || ""} onChange={(e) => set({ sort: { ...spec.sort, by: e.target.value } })}>
              <option value="">Default</option>
              {mode === "summary" ? [...(spec.groupBy || []).map((x, i) => [`g${i}`, src.fields.find((f) => f.key === x.field)?.label]), ...(spec.measures || []).map((m, i) => [`m${i}`, m.label || (m.agg === "count" ? "Count" : `${AGG_LABEL[m.agg]} ${src.fields.find((f) => f.key === m.field)?.label || ""}`)])].map(([k, l]) => <option key={k} value={k}>{l}</option>) : src.fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg border p-1">{[["desc", "High → low"], ["asc", "Low → high"]].map(([k, l]) => <button key={k} type="button" className={"ui-btn ui-btn-sm " + ((spec.sort?.dir || "desc") === k ? "ui-btn-primary" : "ui-btn-ghost")} onClick={() => set({ sort: { ...spec.sort, dir: k } })}>{l}</button>)}</div>
          <div><label className={labelCls}>Rows</label><select className="ui-input" value={spec.limit || 500} onChange={(e) => set({ limit: Number(e.target.value) })}>{[10, 25, 50, 100, 500, 2000, 5000].map((n) => <option key={n} value={n}>{n === 5000 ? "Up to 5,000" : `Top ${n}`}</option>)}</select></div>
        </div>
      )}
    </div>
  );
}

/* ───────────── showing a result ───────────── */
export function ResultChart({ result, type, height = 260 }) {
  if (!result || result.mode !== "summary" || !result.rows.length) return <div className="text-sm text-muted-foreground text-center py-10">Nothing to show</div>;
  const g = result.columns.filter((c) => c.group);
  const ms = result.columns.filter((c) => c.measure);
  const data = result.rows.map((r) => ({ name: String(r.g0 ?? "Total"), ...Object.fromEntries(ms.map((m) => [m.label, r[m.key]])), _c: r.c0 }));
  const primary = cssColor("var(--primary)");
  const tick = { fontSize: 11, fill: cssColor("var(--muted-foreground)") };
  const tf = (v) => (ms[0]?.money ? compactMoney(v) : num.format(v));
  if (type === "pie") return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data.slice(0, 12)} dataKey={ms[0].label} nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={1}>
          {data.slice(0, 12).map((d, i) => <Cell key={i} fill={d._c || cssColor(PALETTE[i % PALETTE.length])} />)}
        </Pie>
        <Tooltip formatter={(v) => tf(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
  const Chart = type === "line" ? LineChart : BarChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data.slice(0, 60)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={cssColor("var(--border)")} />
        <XAxis dataKey="name" tick={tick} interval="preserveStartEnd" />
        <YAxis tick={tick} tickFormatter={tf} width={56} />
        <Tooltip formatter={(v) => tf(v)} />
        {ms.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {ms.map((m, i) => (type === "line"
          ? <Line key={m.key} type="monotone" dataKey={m.label} stroke={i ? cssColor(PALETTE[i % PALETTE.length]) : primary} strokeWidth={2} dot={false} />
          : <Bar key={m.key} dataKey={m.label} fill={i ? cssColor(PALETTE[i % PALETTE.length]) : primary} radius={[4, 4, 0, 0]}>{ms.length === 1 && g.length && data.some((d) => d._c) ? data.map((d, j) => <Cell key={j} fill={d._c || primary} />) : null}</Bar>))}
      </Chart>
    </ResponsiveContainer>
  );
}

export function ResultTable({ result, maxRows, onPage }) {
  if (!result) return null;
  if (!result.rows.length) return <EmptyState icon="table" text="No records match" />;
  const rows = maxRows ? result.rows.slice(0, maxRows) : result.rows;
  const totals = result.mode === "summary" ? result.totals : null;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-[11px] uppercase tracking-wider text-muted-foreground" style={{ background: "var(--muted-background)" }}>{result.columns.map((c) => <th key={c.key} className={"px-3 py-2.5 font-medium whitespace-nowrap " + (c.type === "number" ? "text-right" : "text-left")}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r._id || i} className="border-t">
                {result.columns.map((c, j) => (
                  <td key={c.key} className={"px-3 py-2 " + (c.type === "number" ? "text-right tabular-nums" : "")}>
                    {r[`${c.key}__color`] || (c.group && r[`c${j}`]) ? <Chip color={r[`${c.key}__color`] || r[`c${j}`]}>{fmt(c, r[c.key])}</Chip>
                      : j === 0 && r._lead && result.source === "leads" ? <Link to={`/crm/leads?lead=${r._lead}`} className="text-foreground hover:underline">{fmt(c, r[c.key])}</Link> : fmt(c, r[c.key])}
                  </td>
                ))}
              </tr>
            ))}
            {totals && Object.keys(totals).length > 0 && !maxRows && (
              <tr className="border-t font-semibold" style={{ background: "var(--muted-background)" }}>
                {result.columns.map((c, j) => <td key={c.key} className={"px-3 py-2 " + (c.type === "number" ? "text-right tabular-nums" : "")}>{j === 0 ? "Total" : totals[c.key] !== undefined ? fmt(c, totals[c.key]) : ""}</td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {result.mode === "list" && onPage && result.pages > 1 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t text-xs text-muted-foreground">
          <span>{num.format(result.total)} records</span>
          <span className="inline-flex items-center gap-2">
            <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Previous" disabled={result.page <= 1} onClick={() => onPage(result.page - 1)}><i className="bi bi-chevron-left"></i></button>
            {result.page} / {result.pages}
            <button type="button" className="ui-btn ui-btn-outline ui-btn-sm ui-btn-icon" title="Next" disabled={result.page >= result.pages} onClick={() => onPage(result.page + 1)}><i className="bi bi-chevron-right"></i></button>
          </span>
        </div>
      )}
    </div>
  );
}

/* ───────────── Reports tab ───────────── */
const PRESETS = [
  { name: "Leads by source", spec: { ...blankSpec("leads"), groupBy: [{ field: "source" }], measures: [{ agg: "count", label: "Leads" }, { agg: "sum", field: "value", label: "Pipeline value" }, { agg: "avg", field: "score", label: "Average score" }] }, chart: "bar" },
  { name: "Leads per month", spec: { ...blankSpec("leads"), period: { preset: "this_year" }, groupBy: [{ field: "createdAt", bucket: "month" }], measures: [{ agg: "count", label: "Leads" }] }, chart: "line" },
  { name: "Counsellor performance", spec: { ...blankSpec("leads"), groupBy: [{ field: "owner" }, { field: "status" }], measures: [{ agg: "count", label: "Leads" }] }, chart: "bar" },
  { name: "Overdue follow-ups", spec: { ...blankSpec("followups"), period: { preset: "all" }, groupBy: [{ field: "owner" }], filters: [{ field: "done", op: "false" }, { field: "due", op: "lte", value: new Date().toISOString().slice(0, 10) }], measures: [{ agg: "count", label: "Overdue" }] }, chart: "bar" },
  { name: "Fees collected", spec: { ...blankSpec("fees"), dateField: "paidAt", groupBy: [{ field: "paidAt", bucket: "month" }], measures: [{ agg: "sum", field: "paidAmount", label: "Collected", money: true }] }, chart: "bar" },
  { name: "Deal pipeline", spec: { ...blankSpec("deals"), period: { preset: "all" }, groupBy: [{ field: "stage" }], measures: [{ agg: "count", label: "Deals" }, { agg: "sum", field: "value", label: "Value", money: true }] }, chart: "bar" },
  { name: "Applications by stage", spec: { ...blankSpec("applications"), period: { preset: "all" }, groupBy: [{ field: "stage" }], measures: [{ agg: "count", label: "Applications" }] }, chart: "pie" },
  { name: "Lead list (Excel)", spec: { ...blankSpec("leads"), mode: "list", groupBy: [], columns: ["name", "phone", "email", "course", "city", "status", "source", "owner", "score", "createdAt"] }, chart: "" },
];

function ReportsTab({ meta }) {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const saved = useApi(() => reportsApi.saved("report"), []);
  const dashboards = useApi(() => reportsApi.saved("dashboard"), []);
  const [spec, setSpec] = useState(() => PRESETS[0].spec);
  const [chart, setChart] = useState("bar");
  const [current, setCurrent] = useState(null); // saved report being edited
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [saveAs, setSaveAs] = useState(null);
  const [toDash, setToDash] = useState(null);
  const [del, setDel] = useState(null);
  const key = JSON.stringify(spec);

  useEffect(() => {
    const id = sp.get("report");
    if (id && saved.data) { const r = saved.data.find((x) => x._id === id); if (r) open(r); }
  }, [saved.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function run(page = 1) {
    setRunning(true); setError(null);
    try { const r = await reportsApi.run({ ...spec, page }); setResult(r.data); }
    catch (e) { setError(e); }
    finally { setRunning(false); }
  }
  useEffect(() => { const t = setTimeout(() => run(1), 350); return () => clearTimeout(t); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  function open(r) { setCurrent(r); setSpec(r.spec); setChart(r.spec.chart || "bar"); sp.set("report", r._id); setSp(sp, { replace: true }); }
  async function exportAll() {
    try { const r = await reportsApi.exportRows(spec); await exportExcel(r.data, current?.name || `${r.data.sourceLabel} report`); } catch (e) { toast(e.message, "error"); }
  }
  async function save(asNew) {
    try {
      const body = { kind: "report", name: saveAs.name.trim(), spec: { ...spec, chart }, shared: saveAs.shared };
      const r = !asNew && current ? await reportsApi.update(current._id, body) : await reportsApi.create(body);
      toast("Report saved"); setSaveAs(null); setCurrent(r.data); saved.reload();
    } catch (e) { toast(e.message, "error"); }
  }
  async function addToDashboard() {
    try {
      let dash = toDash.dashboard === "new" ? (await reportsApi.create({ kind: "dashboard", name: toDash.newName.trim() || "My dashboard", widgets: [] })).data : (await reportsApi.get(toDash.dashboard)).data;
      const w = { id: `w${Date.now().toString(36)}`, type: toDash.type, title: toDash.title || current?.name || "", w: toDash.type === "kpi" ? 1 : 2, spec: toDash.type === "kpi" ? { ...spec, groupBy: [], mode: "summary", compare: true } : { ...spec } };
      await reportsApi.update(dash._id, { widgets: [...(dash.widgets || []), w] });
      toast(`Added to ${dash.name}`); setToDash(null); dashboards.reload();
    } catch (e) { toast(e.message, "error"); }
  }
  async function remove() {
    try { await reportsApi.remove(del._id); toast("Report deleted"); if (current?._id === del._id) { setCurrent(null); sp.delete("report"); setSp(sp, { replace: true }); } setDel(null); saved.reload(); } catch (e) { toast(e.message, "error"); }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-3 items-start">
      <div className="space-y-3">
        <Panel title={current ? current.name : "New report"} actions={current && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm" onClick={() => { setCurrent(null); sp.delete("report"); setSp(sp, { replace: true }); setSpec(blankSpec("leads")); }}><i className="bi bi-plus-lg"></i>New</button>}>
          <SpecEditor meta={meta} spec={spec} setSpec={setSpec} />
        </Panel>
        <Panel title="Saved reports" bodyClass="p-1.5">
          {!(saved.data || []).length ? <div className="text-sm text-muted-foreground text-center py-3">None yet</div> : saved.data.map((r) => (
            <div key={r._id} className={"flex items-center gap-1 rounded-lg px-1.5 " + (current?._id === r._id ? "bg-accent/40" : "")}>
              <button type="button" className="flex-1 min-w-0 text-left text-sm py-1.5 bg-transparent border-0 text-foreground truncate" onClick={() => open(r)}><i className="bi bi-file-earmark-bar-graph me-1.5 text-muted-foreground"></i>{r.name}<span className="text-[11px] text-muted-foreground"> · {r.createdBy}</span></button>
              {r.canEdit && <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Delete" onClick={() => setDel(r)}><i className="bi bi-trash"></i></button>}
            </div>
          ))}
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1.5 pt-2 pb-1">Ready-made</div>
          {PRESETS.map((p) => <button key={p.name} type="button" className="w-full text-left text-sm py-1.5 px-1.5 bg-transparent border-0 text-foreground hover:underline" onClick={() => { setCurrent(null); sp.delete("report"); setSp(sp, { replace: true }); setSpec(p.spec); if (p.chart) setChart(p.chart); }}><i className="bi bi-lightning me-1.5 text-muted-foreground"></i>{p.name}</button>)}
        </Panel>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">{result?.sourceLabel || "…"} · {result?.period}</div>
            <div className="text-[11px] text-muted-foreground">{running ? "Working…" : result ? `${num.format(result.total)} ${result.mode === "summary" ? "groups" : "records"}` : ""}</div>
          </div>
          {spec.mode === "summary" && <div className="inline-flex rounded-lg border p-0.5">{[["bar", "bar-chart"], ["line", "graph-up"], ["pie", "pie-chart"], ["", "table"]].map(([k, ic]) => <button key={k} type="button" title={k || "Table only"} className={"ui-btn ui-btn-sm ui-btn-icon " + (chart === k ? "ui-btn-primary" : "ui-btn-ghost")} onClick={() => setChart(k)}><i className={`bi bi-${ic}`}></i></button>)}</div>}
          <button type="button" className="ui-btn ui-btn-outline" disabled={!result?.rows.length} onClick={exportAll}><i className="bi bi-file-earmark-excel"></i>Export Excel</button>
          <button type="button" className="ui-btn ui-btn-outline" disabled={!result} onClick={() => setToDash({ dashboard: (dashboards.data || [])[0]?._id || "new", newName: "", type: spec.mode === "list" ? "table" : spec.groupBy?.length ? chart || "bar" : "kpi", title: current?.name || "" })}><i className="bi bi-grid-1x2"></i>Add to dashboard</button>
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setSaveAs({ name: current?.name || "", shared: current?.shared ?? true })}><i className="bi bi-bookmark"></i>Save</button>
        </div>
        <ErrorBox error={error} />
        {spec.mode === "summary" && chart && result?.rows.length > 0 && <Panel bodyClass="p-3"><ResultChart result={result} type={chart} height={300} /></Panel>}
        <div className="rounded-xl border bg-card overflow-hidden">
          {running && !result ? <Spinner /> : <ResultTable result={result} onPage={(p) => run(p)} />}
        </div>
      </div>

      {saveAs && (
        <Modal title={current ? "Save report" : "Save as report"} onClose={() => setSaveAs(null)} footer={<>
          <button type="button" className="ui-btn ui-btn-outline" onClick={() => setSaveAs(null)}>Cancel</button>
          {current && current.canEdit && <button type="button" className="ui-btn ui-btn-outline" disabled={!saveAs.name.trim()} onClick={() => save(true)}>Save as new</button>}
          <button type="button" className="ui-btn ui-btn-primary" disabled={!saveAs.name.trim()} onClick={() => save(!(current?.canEdit))}>Save</button></>}>
          <label className={labelCls}>Name *</label>
          <input className="ui-input w-full mb-3" autoFocus value={saveAs.name} onChange={(e) => setSaveAs({ ...saveAs, name: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" className="form-check-input m-0" checked={saveAs.shared} onChange={(e) => setSaveAs({ ...saveAs, shared: e.target.checked })} />Everyone can see it</label>
        </Modal>
      )}
      {toDash && (
        <Modal title="Add to dashboard" onClose={() => setToDash(null)} footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={() => setToDash(null)}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" onClick={addToDashboard}>Add</button></>}>
          <div className="space-y-3">
            <div><label className={labelCls}>Dashboard</label><select className="ui-input w-full" value={toDash.dashboard} onChange={(e) => setToDash({ ...toDash, dashboard: e.target.value })}>{(dashboards.data || []).filter((d) => d.canEdit).map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}<option value="new">New dashboard…</option></select></div>
            {toDash.dashboard === "new" && <div><label className={labelCls}>New dashboard name</label><input className="ui-input w-full" value={toDash.newName} onChange={(e) => setToDash({ ...toDash, newName: e.target.value })} /></div>}
            <div><label className={labelCls}>Show as</label><WidgetTypes value={toDash.type} onChange={(type) => setToDash({ ...toDash, type })} /></div>
            <div><label className={labelCls}>Title</label><input className="ui-input w-full" value={toDash.title} onChange={(e) => setToDash({ ...toDash, title: e.target.value })} /></div>
          </div>
        </Modal>
      )}
      {del && <Confirm title={`Delete ${del.name}?`} danger confirmLabel="Delete" onConfirm={remove} onCancel={() => setDel(null)} />}
    </div>
  );
}

/* ───────────── dashboards ───────────── */
const WIDGET_TYPES = [["kpi", "123", "Card"], ["bar", "bar-chart", "Bar"], ["line", "graph-up", "Line"], ["pie", "pie-chart", "Pie"], ["table", "table", "Table"]];
function WidgetTypes({ value, onChange }) {
  return <div className="grid grid-cols-5 gap-1 rounded-lg border p-1">{WIDGET_TYPES.map(([k, ic, l]) => <button key={k} type="button" className={"ui-btn ui-btn-sm " + (value === k ? "ui-btn-primary" : "ui-btn-ghost")} onClick={() => onChange(k)}><i className={`bi bi-${ic}`}></i><span className="hidden sm:inline">{l}</span></button>)}</div>;
}

function Widget({ w, period, editing, onEdit, onRemove, onMove, onResize }) {
  const spec = useMemo(() => ({ ...w.spec, ...(period ? { period } : {}), ...(w.type === "kpi" ? { groupBy: [], mode: "summary" } : w.type === "table" ? {} : { mode: "summary" }) }), [w, period]);
  const res = useApi(() => reportsApi.run(spec), [JSON.stringify(spec)]);
  const d = res.data;
  const span = { 1: "md:col-span-1", 2: "md:col-span-2", 3: "md:col-span-3", 4: "md:col-span-4" }[w.w] || "md:col-span-1";
  let body;
  if (res.loading && !d) body = <Spinner label="" />;
  else if (res.error) body = <div className="text-xs" style={{ color: "var(--destructive)" }}>{res.error.message}</div>;
  else if (w.type === "kpi") {
    const col = d.columns.find((c) => c.measure);
    const v = d.rows[0]?.[col?.key] || 0;
    const prev = d.previous?.[col?.key];
    const diff = prev === undefined || prev === null ? null : prev === 0 ? (v ? 100 : 0) : Math.round(((v - prev) / prev) * 1000) / 10;
    body = (
      <div>
        <div className="text-3xl font-semibold text-foreground leading-tight">{col?.money ? compactMoney(v) : num.format(v)}</div>
        {diff !== null && <div className="text-xs mt-1" style={{ color: diff >= 0 ? "var(--success)" : "var(--destructive)" }}><i className={`bi bi-arrow-${diff >= 0 ? "up" : "down"}-right me-1`}></i>{Math.abs(diff)}% vs previous period</div>}
        <div className="text-[11px] text-muted-foreground mt-0.5">{d.period}</div>
      </div>
    );
  } else if (w.type === "table") body = <div className="-mx-3 -mb-3"><ResultTable result={d} maxRows={10} /></div>;
  else body = <ResultChart result={d} type={w.type} height={220} />;
  return (
    <div className={`rounded-xl border bg-card p-3 ${span}`} style={editing ? { outline: "2px dashed var(--border)", outlineOffset: 2 } : undefined}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{w.title || d?.columns?.find((c) => c.measure)?.label || "Widget"}</div>
        {editing && (
          <span className="flex gap-0.5 flex-shrink-0">
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Move left" onClick={() => onMove(-1)}><i className="bi bi-arrow-left"></i></button>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Move right" onClick={() => onMove(1)}><i className="bi bi-arrow-right"></i></button>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Width" onClick={onResize}><i className="bi bi-arrows"></i></button>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Edit" onClick={onEdit}><i className="bi bi-pencil"></i></button>
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-sm ui-btn-icon" title="Remove" onClick={onRemove}><i className="bi bi-trash"></i></button>
          </span>
        )}
      </div>
      {body}
    </div>
  );
}

function WidgetEditor({ meta, widget, onClose, onSave }) {
  const [w, setW] = useState(widget);
  const [preview, setPreview] = useState(null);
  const spec = { ...w.spec, ...(w.type === "kpi" ? { groupBy: [], mode: "summary", compare: true } : w.type === "table" ? {} : { mode: "summary" }) };
  useEffect(() => { const t = setTimeout(() => reportsApi.run(spec).then((r) => setPreview(r.data)).catch(() => setPreview(null)), 400); return () => clearTimeout(t); }, [JSON.stringify(spec)]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modal size="wide" title={widget.id ? "Edit widget" : "Add widget"} onClose={onClose} footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" onClick={() => onSave({ ...w, spec })}>{widget.id ? "Save" : "Add"}</button></>}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div><label className={labelCls}>Show as</label><WidgetTypes value={w.type} onChange={(type) => setW({ ...w, type, w: type === "kpi" ? 1 : Math.max(2, w.w) })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls}>Title</label><input className="ui-input w-full" value={w.title} onChange={(e) => setW({ ...w, title: e.target.value })} /></div>
            <div><label className={labelCls}>Width</label><select className="ui-input w-full" value={w.w} onChange={(e) => setW({ ...w, w: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} of 4</option>)}</select></div>
          </div>
          <SpecEditor meta={meta} spec={w.spec} setSpec={(s) => setW({ ...w, spec: s })} compact lockMode={w.type === "table" ? undefined : "summary"} />
        </div>
        <div>
          <label className={labelCls}>Preview</label>
          <div className="rounded-xl border bg-card p-3">{!preview ? <Spinner label="" /> : w.type === "kpi" ? <div className="text-3xl font-semibold text-foreground">{(() => { const c = preview.columns.find((x) => x.measure); const v = preview.rows[0]?.[c?.key] || 0; return c?.money ? compactMoney(v) : num.format(v); })()}</div> : w.type === "table" ? <ResultTable result={preview} maxRows={8} /> : <ResultChart result={preview} type={w.type} height={240} />}</div>
          <div className="text-[11px] text-muted-foreground mt-1">On the dashboard, its period follows the dashboard's period.</div>
        </div>
      </div>
    </Modal>
  );
}

const STARTER = () => [
  { type: "kpi", title: "New leads", w: 1, spec: { ...blankSpec("leads"), groupBy: [], measures: [{ agg: "count" }], compare: true } },
  { type: "kpi", title: "Hot leads", w: 1, spec: { ...blankSpec("leads"), groupBy: [], filters: [{ field: "priority", op: "eq", value: "hot" }], measures: [{ agg: "count" }], compare: true } },
  { type: "kpi", title: "Applications", w: 1, spec: { ...blankSpec("applications"), groupBy: [], measures: [{ agg: "count" }], compare: true } },
  { type: "kpi", title: "Fees collected", w: 1, spec: { ...blankSpec("fees"), dateField: "paidAt", groupBy: [], measures: [{ agg: "sum", field: "paidAmount", money: true }], compare: true } },
  { type: "line", title: "Leads per day", w: 2, spec: { ...blankSpec("leads"), groupBy: [{ field: "createdAt", bucket: "day" }], measures: [{ agg: "count", label: "Leads" }] } },
  { type: "pie", title: "Leads by source", w: 2, spec: { ...blankSpec("leads"), groupBy: [{ field: "source" }], measures: [{ agg: "count", label: "Leads" }] } },
  { type: "bar", title: "Leads by status", w: 2, spec: { ...blankSpec("leads"), groupBy: [{ field: "status" }], measures: [{ agg: "count", label: "Leads" }] } },
  { type: "table", title: "Counsellor league", w: 2, spec: { ...blankSpec("leads"), groupBy: [{ field: "owner" }], measures: [{ agg: "count", label: "Leads" }, { agg: "avg", field: "score", label: "Avg score" }, { agg: "sum", field: "value", label: "Pipeline", money: true }] } },
  { type: "bar", title: "Deal pipeline", w: 2, spec: { ...blankSpec("deals"), period: { preset: "all" }, groupBy: [{ field: "stage" }], measures: [{ agg: "sum", field: "value", label: "Value", money: true }] } },
  { type: "kpi", title: "Overdue follow-ups", w: 1, spec: { ...blankSpec("followups"), period: { preset: "all" }, groupBy: [], filters: [{ field: "done", op: "false" }, { field: "due", op: "lte", value: new Date().toISOString().slice(0, 10) }], measures: [{ agg: "count" }] } },
  { type: "kpi", title: "Open queries", w: 1, spec: { ...blankSpec("queries"), period: { preset: "all" }, groupBy: [], filters: [{ field: "status", op: "in", value: ["open", "pending"] }], measures: [{ agg: "count" }] } },
].map((w, i) => ({ ...w, id: `w${Date.now().toString(36)}${i}` }));

function DashboardsTab({ meta }) {
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const list = useApi(() => reportsApi.saved("dashboard"), []);
  const [openId, setOpenId] = useState(() => sp.get("dashboard") || "");
  const dash = useApi(() => (openId ? reportsApi.get(openId) : Promise.resolve({ data: null })), [openId]);
  const [period, setPeriod] = useState({ preset: "this_month" });
  const [editing, setEditing] = useState(false);
  const [widgets, setWidgets] = useState([]);
  const [edit, setEdit] = useState(null);
  const [newDash, setNewDash] = useState(null);
  const [del, setDel] = useState(false);
  const d = dash.data;
  useEffect(() => { if (d) { setWidgets(d.widgets || []); if (d.spec?.period) setPeriod(d.spec.period); } }, [d]);
  useEffect(() => { if (!openId && list.data?.length) setOpenId(list.data[0]._id); }, [list.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (id) => { setOpenId(id); setEditing(false); if (id) sp.set("dashboard", id); else sp.delete("dashboard"); setSp(sp, { replace: true }); };

  async function persist(next, msg) {
    try { await reportsApi.update(d._id, { widgets: next, spec: { ...(d.spec || {}), period } }); setWidgets(next); if (msg) toast(msg); }
    catch (e) { toast(e.message, "error"); }
  }
  async function create() {
    try {
      const r = await reportsApi.create({ kind: "dashboard", name: newDash.name.trim(), widgets: newDash.starter ? STARTER() : [], spec: { period: { preset: "this_month" } }, shared: newDash.shared });
      toast("Dashboard created"); setNewDash(null); await list.reload(); choose(r.data._id); if (!newDash.starter) setEditing(true);
    } catch (e) { toast(e.message, "error"); }
  }
  async function remove() {
    try { await reportsApi.remove(d._id); toast("Dashboard deleted"); setDel(false); choose(""); list.reload(); } catch (e) { toast(e.message, "error"); }
  }
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= widgets.length) return; const n = [...widgets]; [n[i], n[j]] = [n[j], n[i]]; persist(n); };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select className="ui-input min-w-[200px]" style={{ width: "auto" }} aria-label="Dashboard" value={openId} onChange={(e) => choose(e.target.value)}>
          {!(list.data || []).length && <option value="">No dashboards</option>}
          {(list.data || []).map((x) => <option key={x._id} value={x._id}>{x.name}{x.shared ? "" : " (only me)"}</option>)}
        </select>
        {d && <select className="ui-input" style={{ width: "auto" }} aria-label="Period" value={period.preset} onChange={(e) => setPeriod({ ...period, preset: e.target.value })}>{PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>}
        {d && period.preset === "custom" && <><DateInput className="ui-input" style={{ width: 140 }} value={period.from || ""} onChange={(e) => setPeriod({ ...period, from: e.target.value })} /><DateInput className="ui-input" style={{ width: 140 }} value={period.to || ""} onChange={(e) => setPeriod({ ...period, to: e.target.value })} /></>}
        <span className="ms-auto flex flex-wrap gap-2">
          {d?.canEdit && (editing
            ? <>
              <button type="button" className="ui-btn ui-btn-outline" onClick={() => setEdit({ type: "kpi", title: "", w: 1, spec: { ...blankSpec("leads"), groupBy: [] } })}><i className="bi bi-plus-lg"></i>Add widget</button>
              <button type="button" className="ui-btn ui-btn-outline" onClick={() => setDel(true)}><i className="bi bi-trash"></i></button>
              <button type="button" className="ui-btn ui-btn-primary" onClick={() => { persist(widgets, "Dashboard saved"); setEditing(false); }}><i className="bi bi-check-lg"></i>Done</button>
            </>
            : <button type="button" className="ui-btn ui-btn-outline" onClick={() => setEditing(true)}><i className="bi bi-pencil"></i>Edit</button>)}
          <button type="button" className="ui-btn ui-btn-primary" onClick={() => setNewDash({ name: "", starter: !(list.data || []).length, shared: true })}><i className="bi bi-plus-lg"></i>New dashboard</button>
        </span>
      </div>
      {list.loading && !list.data ? <Spinner /> : !d ? (
        <div className="rounded-xl border bg-card"><EmptyState icon="grid-1x2" text="No dashboards" /><div className="text-center pb-8 -mt-10"><button type="button" className="ui-btn ui-btn-primary" onClick={() => setNewDash({ name: "Admissions overview", starter: true, shared: true })}><i className="bi bi-lightning"></i>Make a starter dashboard</button></div></div>
      ) : !widgets.length ? (
        <div className="rounded-xl border bg-card"><EmptyState icon="grid-1x2" text="No widgets" />{d.canEdit && <div className="text-center pb-8 -mt-10"><button type="button" className="ui-btn ui-btn-primary" onClick={() => { setEditing(true); setEdit({ type: "kpi", title: "", w: 1, spec: { ...blankSpec("leads"), groupBy: [] } }); }}><i className="bi bi-plus-lg"></i>Add widget</button></div>}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {widgets.map((w, i) => (
            <Widget key={w.id} w={w} period={period} editing={editing}
              onEdit={() => setEdit(w)} onRemove={() => persist(widgets.filter((x) => x.id !== w.id), "Widget removed")}
              onMove={(dir) => move(i, dir)} onResize={() => persist(widgets.map((x) => (x.id === w.id ? { ...x, w: (x.w % 4) + 1 } : x)))} />
          ))}
        </div>
      )}
      {d && <div className="text-[11px] text-muted-foreground mt-2">By {d.createdBy} · updated {formatDateTime(d.updatedAt)}</div>}

      {edit && <WidgetEditor meta={meta} widget={edit} onClose={() => setEdit(null)} onSave={(w) => { const next = w.id ? widgets.map((x) => (x.id === w.id ? w : x)) : [...widgets, { ...w, id: `w${Date.now().toString(36)}` }]; setEdit(null); persist(next, w.id ? "Widget saved" : "Widget added"); }} />}
      {newDash && (
        <Modal title="New dashboard" onClose={() => setNewDash(null)} footer={<><button type="button" className="ui-btn ui-btn-outline" onClick={() => setNewDash(null)}>Cancel</button><button type="button" className="ui-btn ui-btn-primary" disabled={!newDash.name.trim()} onClick={create}>Create</button></>}>
          <label className={labelCls}>Name *</label>
          <input className="ui-input w-full mb-3" autoFocus value={newDash.name} onChange={(e) => setNewDash({ ...newDash, name: e.target.value })} />
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer mb-1.5"><input type="checkbox" className="form-check-input m-0" checked={newDash.starter} onChange={(e) => setNewDash({ ...newDash, starter: e.target.checked })} />Start with the admissions widgets</label>
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer"><input type="checkbox" className="form-check-input m-0" checked={newDash.shared} onChange={(e) => setNewDash({ ...newDash, shared: e.target.checked })} />Everyone can see it</label>
        </Modal>
      )}
      {del && <Confirm title={`Delete ${d.name}?`} danger confirmLabel="Delete" onConfirm={remove} onCancel={() => setDel(false)} />}
    </div>
  );
}

/* ───────────── the page ───────────── */
export default function ReportBuilder() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get("tab") || (sp.get("dashboard") ? "dashboards" : "reports");
  const meta = useApi(() => reportsApi.meta(), []);
  return (
    <div>
      <PageHeader title="Report builder" />
      <Tabs value={tab} onChange={(v) => { const n = new URLSearchParams(); n.set("tab", v); setSp(n, { replace: true }); }} tabs={[{ value: "reports", label: "Reports" }, { value: "dashboards", label: "Dashboards" }]} />
      <ErrorBox error={meta.error} />
      {meta.loading && !meta.data ? <Spinner /> : meta.data && (tab === "dashboards" ? <DashboardsTab meta={meta.data} /> : <ReportsTab meta={meta.data} />)}
    </div>
  );
}
