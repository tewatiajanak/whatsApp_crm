import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, BookmarkPlus, Download, Trash2 } from "lucide-react";
import { pmApi } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import DateInput from "../../components/DateInput";
import { UIButton } from "../components/UIKit";
import { TH } from "../user-management/shared";
import EmployeePicker from "./EmployeePicker";
import { usePm } from "./PmLayout";
import { PageTitle } from "./shared";

type Def = { key: string; title: string; filters: string[]; groupBy: [string, string][] };
const EMPTY = { from: "", to: "", year: "", client: "", product: "", project: "", incharge: "", employee: "", team: "", groupBy: "" };
const thisYear = new Date().getFullYear();

/** Project Management → Reports. */
export default function ReportsPage() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const { employees } = usePm();
  const [defs, setDefs] = useState<Def[]>([]);
  const [key, setKey] = useState("");
  const [f, setF] = useState({ ...EMPTY });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [views, setViews] = useState<any[]>([]);
  const [lists, setLists] = useState<{ clients: any[]; products: any[]; projects: any[]; teams: any[] }>({ clients: [], products: [], projects: [], teams: [] });

  useEffect(() => {
    pmApi.reports().then((r: any) => { setDefs(r.data ?? []); setKey((k) => k || r.data?.[0]?.key || ""); }).catch((e: any) => toast(e?.message || "Could not load reports", "error"));
    Promise.all([
      hasRight("clients", "view") ? pmApi.clients() : null,
      pmApi.products(),
      hasRight("projects", "view") ? pmApi.projects() : null,
      hasRight("team", "view") ? pmApi.hierarchy() : null,
    ].map((p: any) => (p ? p.catch(() => null) : null))).then(([c, p, pr, h]: any[]) => setLists({ clients: c?.data ?? [], products: p?.data ?? [], projects: pr?.data ?? [], teams: h?.data?.teams ?? [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const def = defs.find((d) => d.key === key);
  const query = () => {
    const q = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && (def?.filters.includes(k) || (def?.filters.includes("range") && (k === "from" || k === "to"))) && q.set(k, v));
    return q.toString();
  };
  const run = async () => {
    if (!key) return;
    setLoading(true);
    try {
      const res: any = await pmApi.report(key, query());
      setData(res.data);
    } catch (e: any) {
      toast(e?.message || "Could not run the report", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setData(null);
    if (key) {
      run();
      pmApi.views(`report:${key}`).then((r: any) => setViews(r?.data ?? [])).catch(() => setViews([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, f]);

  // the Excel file is made on the server, with the same filters and the same visibility
  const exportExcel = async () => {
    try {
      const blob: Blob = await pmApi.reportFile(key, query());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${key}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e: any) {
      toast(e?.message || "Could not export", "error");
    }
  };
  const saveView = async () => {
    const name = window.prompt("Name of this view");
    if (!name?.trim()) return;
    try {
      await pmApi.saveView({ screen: `report:${key}`, name: name.trim(), filters: f, shared: window.confirm("Share this view with the team?") });
      const r: any = await pmApi.views(`report:${key}`);
      setViews(r?.data ?? []);
      toast("View saved");
    } catch (e: any) {
      toast(e?.message || "Could not save the view", "error");
    }
  };
  const removeView = async (v: any) => {
    try {
      await pmApi.removeView(v._id);
      setViews(views.filter((x) => x._id !== v._id));
    } catch (e: any) {
      toast(e?.message || "Could not delete", "error");
    }
  };

  const has = (name: string) => !!def?.filters.includes(name);
  const select = (name: keyof typeof EMPTY, label: string, options: any[]) =>
    has(name) && options.length > 0 && (
      <select className="ui-input" value={f[name]} onChange={(e) => setF({ ...f, [name]: e.target.value })}>
        <option value="">{label}</option>
        {options.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
      </select>
    );
  const chartRows = data?.chart ? data.rows.slice(0, 14) : [];
  const total = (c: any) => (c.type === "number" ? Math.round(data.rows.reduce((n: number, row: any) => n + (Number(row[c.key]) || 0), 0) * 10) / 10 : "");

  return (
    <>
      <PageTitle
        icon={<BarChart3 className="h-4 w-4" />}
        title="Reports"
        actions={
          <div className="flex items-center gap-2">
            <UIButton variant="outline" onClick={saveView} disabled={!key} leftIcon={<BookmarkPlus className="h-3.5 w-3.5" />}>Save view</UIButton>
            {hasRight("reports", "export") && <UIButton variant="outline" onClick={exportExcel} disabled={!data?.rows?.length} leftIcon={<Download className="h-3.5 w-3.5" />}>Export Excel</UIButton>}
          </div>
        }
      />

      <div className="mt-3 flex flex-col md:flex-row gap-4">
        <select className="ui-input w-full md:hidden" value={key} onChange={(e) => setKey(e.target.value)}>
          {defs.map((d) => <option key={d.key} value={d.key}>{d.title}</option>)}
        </select>
        <nav className="hidden md:block shrink-0 rounded-xl border bg-card p-2 self-start" style={{ width: 232 }}>
          {defs.map((d) => (
            <button key={d.key} type="button" onClick={() => setKey(d.key)} className="block w-full rounded-lg px-2.5 py-2 text-left text-[13px]" style={d.key === key ? { background: "var(--primary)", color: "#fff", border: 0 } : { background: "transparent", color: "var(--foreground)", border: 0 }}>
              {d.title}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {has("year") && (
              <select className="ui-input" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}>
                <option value="">All years</option>
                {[thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {has("range") && (
              <>
                <div style={{ width: 150 }}><DateInput className="ui-input w-full" value={f.from} onChange={(e: any) => setF({ ...f, from: e.target.value })} /></div>
                <div style={{ width: 150 }}><DateInput className="ui-input w-full" value={f.to} onChange={(e: any) => setF({ ...f, to: e.target.value })} /></div>
              </>
            )}
            {select("client", "All clients", lists.clients)}
            {select("product", "All products", lists.products)}
            {select("project", "All projects", lists.projects)}
            {select("team", "All teams", lists.teams)}
            {has("incharge") && <div style={{ width: 200 }}><EmployeePicker employees={employees} value={f.incharge} onChange={(id) => setF({ ...f, incharge: id })} emptyLabel="All incharges" /></div>}
            {has("employee") && <div style={{ width: 200 }}><EmployeePicker employees={employees} value={f.employee} onChange={(id) => setF({ ...f, employee: id })} emptyLabel="All employees" /></div>}
            {has("groupBy") && def && (
              <select className="ui-input" value={f.groupBy || def.groupBy[0]?.[0]} onChange={(e) => setF({ ...f, groupBy: e.target.value })}>
                {def.groupBy.map(([v, l]) => <option key={v} value={v}>By {l.toLowerCase()}</option>)}
              </select>
            )}
            <span className="ml-auto text-xs text-muted-foreground">{loading ? "Loading…" : data ? `${data.rows.length} rows` : ""}</span>
          </div>

          {views.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {views.map((v) => (
                <span key={v._id} className="inline-flex items-center gap-1 rounded-full border bg-card pl-2.5 pr-1 py-0.5 text-[12px]">
                  <button type="button" onClick={() => setF({ ...EMPTY, ...v.filters })} style={{ background: "transparent", border: 0, padding: 0, color: "var(--foreground)" }}>{v.name}{v.shared ? " ·shared" : ""}</button>
                  <button type="button" title="Delete view" onClick={() => removeView(v)} className="inline-flex h-5 w-5 items-center justify-center" style={{ background: "transparent", border: 0, color: "var(--muted-foreground)" }}><Trash2 className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}

          {data?.chart && chartRows.length > 0 && (
            <div className="mt-3 rounded-xl border bg-card p-3" style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey={data.chart.x} tick={{ fontSize: 10.5 }} interval={0} tickFormatter={(v: string) => (String(v).length > 12 ? `${String(v).slice(0, 11)}…` : v)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12, border: "1px solid var(--border)" }} />
                  {data.chart.bars.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
                  {data.chart.bars.map((b: any) => <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[4, 4, 0, 0]} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {data && data.rows.length === 0 && <div className="mt-3 rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No data</div>}
          {data && data.rows.length > 0 && (
            <div className="mt-3 rounded-xl border bg-card overflow-hidden">
              <div className="overflow-auto" style={{ maxHeight: "62vh" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {data.columns.map((c: any) => <th key={c.key} className={`${TH} sticky top-0 whitespace-nowrap`} style={{ background: "var(--muted-background)", textAlign: c.type ? "right" : "left" }}>{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row: any, i: number) => (
                      <tr key={i} className="border-t">
                        {data.columns.map((c: any) => <td key={c.key} className="px-4 py-2.5" style={{ textAlign: c.type ? "right" : "left", fontVariantNumeric: "tabular-nums" }}>{row[c.key] === "" || row[c.key] == null ? "—" : c.type === "percent" ? `${row[c.key]}%` : row[c.key]}</td>)}
                      </tr>
                    ))}
                    {data.columns.some((c: any) => c.type === "number") && data.rows.length > 1 && (
                      <tr className="border-t font-semibold" style={{ background: "var(--muted-background)" }}>
                        {data.columns.map((c: any, i: number) => <td key={c.key} className="px-4 py-2.5" style={{ textAlign: c.type ? "right" : "left" }}>{i === 0 ? "Total" : total(c)}</td>)}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
