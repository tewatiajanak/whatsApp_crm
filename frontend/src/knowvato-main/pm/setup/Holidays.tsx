import { useEffect, useRef, useState } from "react";
import { CalendarOff, Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { pmApi } from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import DateInput from "../../../components/DateInput";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { UIButton } from "../../components/UIKit";
import { LABEL, Pill } from "../../user-management/shared";
import { fmtDate } from "@/utils/date";
import { PageTitle } from "../shared";

type Holiday = { _id: string; date: string; name: string };
type ImportRow = { row: number; date: string; name: string; error: string };
const pad = (n: number) => String(n).padStart(2, "0");
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Holidays() {
  const toast = useToast() as (msg: string, type?: string) => void;
  const { hasRight } = useAuth() as any;
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [rows, setRows] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState<{ date: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res: any = await pmApi.holidays(year);
      setRows(res?.data ?? []);
    } catch (e: any) {
      toast(e?.message || "Could not load", "error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const save = async () => {
    if (!form?.date || !form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) await pmApi.updateHoliday(editing._id, form);
      else await pmApi.createHoliday(form);
      toast("Saved");
      setForm(null);
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not save", "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (h: Holiday) => {
    if (!window.confirm(`Delete "${h.name}"?`)) return;
    try {
      await pmApi.removeHoliday(h._id);
      toast("Deleted");
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not delete", "error");
    }
  };
  // ---- import from Excel: a Date column and a Name column ----
  const fileInput = useRef<HTMLInputElement>(null);
  const [imp, setImp] = useState<{ file: string; rows: ImportRow[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const downloadSample = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([["Date", "Name"], [`26-01-${year}`, "Republic Day"], [`15-08-${year}`, "Independence Day"], [`02-10-${year}`, "Gandhi Jayanti"]]);
    ws["!cols"] = [{ wch: 14 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Holidays");
    XLSX.writeFile(wb, "holidays-import-sample.xlsx");
  };
  const readFile = async (file?: File | null) => {
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const grid: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", blankrows: false });
      // an Excel date number, dd-mm-yyyy, dd/mm/yyyy or yyyy-mm-dd → yyyy-mm-dd ("" = not a date)
      const toYmd = (v: any) => {
        if (typeof v === "number") {
          const d = XLSX.SSF.parse_date_code(v);
          return d && d.y > 1990 ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : "";
        }
        const t = String(v).trim();
        let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
        if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
        m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
        if (!m) return "";
        const out = `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
        const d = new Date(`${out}T00:00:00`);
        return d.getMonth() + 1 === +m[2] && d.getDate() === +m[1] ? out : "";
      };
      const head = (grid[0] || []).map((c) => String(c).trim().toLowerCase());
      const titled = head.some((c) => c === "date" || c === "name" || c === "holiday");
      const dateCol = titled ? Math.max(0, head.indexOf("date")) : 0;
      const nameCol = titled ? Math.max(head.indexOf("name"), head.indexOf("holiday"), dateCol === 0 ? 1 : 0) : 1;
      const seen = new Set<string>();
      const rows: ImportRow[] = grid.slice(titled ? 1 : 0).map((cells, i) => {
        const date = toYmd(cells[dateCol]);
        const name = String(cells[nameCol] ?? "").trim();
        const error = !date ? "Date not understood" : !name ? "Name missing" : seen.has(date) ? "Date repeated" : "";
        if (!error) seen.add(date);
        return { row: i + (titled ? 2 : 1), date, name, error };
      });
      if (!rows.length) return toast("The file has no holidays", "error");
      setImp({ file: file.name, rows });
    } catch {
      toast("Could not read the file", "error");
    }
  };
  const good = imp?.rows.filter((r) => !r.error) || [];
  const runImport = async () => {
    setImporting(true);
    try {
      const res: any = await pmApi.importHolidays(good.map(({ date, name }) => ({ date, name })));
      toast(`${res.data.added} added${res.data.updated ? `, ${res.data.updated} updated` : ""}`);
      setImp(null);
      await load();
    } catch (e: any) {
      toast(e?.message || "Could not import", "error");
    } finally {
      setImporting(false);
    }
  };

  const openAdd = () => { setEditing(null); setForm({ date: "", name: "" }); };

  return (
    <div>
      <PageTitle
        icon={<CalendarOff className="h-4 w-4" />}
        title="Holidays"
        actions={
          <div className="flex items-center gap-2">
            <select className="ui-input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {hasRight("setup", "create") && <UIButton variant="outline" onClick={() => setImp({ file: "", rows: [] })} leftIcon={<Upload className="h-3.5 w-3.5" />}>Import</UIButton>}
            {hasRight("setup", "create") && <UIButton onClick={openAdd} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add</UIButton>}
          </div>
        }
      />
      <div className="mt-3 rounded-xl border bg-card overflow-hidden">
        {!loading && rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            No holidays
            {hasRight("setup", "create") && <div className="mt-3"><UIButton size="sm" onClick={openAdd} leftIcon={<Plus className="h-3.5 w-3.5" />}>Add</UIButton></div>}
          </div>
        )}
        {rows.map((h, i) => (
          <div key={h._id} className={`flex items-center gap-3 px-3 py-2.5 ${i ? "border-t" : ""}`}>
            <div className="shrink-0" style={{ width: 110 }}>
              <div className="text-sm font-medium text-foreground">{fmtDate(h.date)}</div>
              <div className="text-[11px] text-muted-foreground">{DAYS[new Date(`${h.date}T00:00:00`).getDay()]}</div>
            </div>
            <div className="min-w-0 flex-1 text-sm truncate">{h.name}</div>
            {hasRight("setup", "edit") && <UIButton size="icon-sm" variant="ghost" title="Edit" onClick={() => { setEditing(h); setForm({ date: h.date, name: h.name }); }}><Pencil className="h-3.5 w-3.5" /></UIButton>}
            {hasRight("setup", "del") && <UIButton size="icon-sm" variant="danger" title="Delete" onClick={() => remove(h)}><Trash2 className="h-3.5 w-3.5" /></UIButton>}
          </div>
        ))}
      </div>

      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>{editing ? "Edit holiday" : "Add holiday"}</SheetTitle></SheetHeader>
          {form && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div>
                <label className={LABEL}>Date *</label>
                <DateInput className="ui-input w-full" value={form.date} onChange={(e: any) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <label className={LABEL}>Name *</label>
                <input className="ui-input w-full" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
          )}
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setForm(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={save} loading={saving} disabled={!form?.date || !form?.name.trim()} className="flex-1">Save</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={!!imp} onOpenChange={(o) => !o && setImp(null)}>
        <SheetContent className="crm-theme w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="border-b p-4 pr-10"><SheetTitle>Import holidays</SheetTitle></SheetHeader>
          {imp && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={downloadSample} className="pm-import-card">
                  <Download className="h-5 w-5" />
                  <span className="text-sm font-medium text-foreground">Download sample</span>
                </button>
                <button type="button" onClick={() => fileInput.current?.click()} className="pm-import-card is-primary">
                  <Upload className="h-5 w-5" />
                  <span className="text-sm font-medium text-foreground truncate max-w-full">{imp.file || "Choose file"}</span>
                  <span className="text-[11px] text-muted-foreground">.xlsx · .xls · .csv</span>
                </button>
                <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
              </div>
              {imp.rows.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Pill tone="success">{good.length} ready</Pill>
                    {imp.rows.length > good.length && <Pill tone="danger">{imp.rows.length - good.length} skipped</Pill>}
                  </div>
                  <div className="rounded-lg border overflow-hidden">
                    {imp.rows.map((r, i) => (
                      <div key={r.row} className={`flex items-center gap-3 px-3 py-2 text-sm ${i ? "border-t" : ""}`}>
                        <span className="shrink-0 tabular-nums" style={{ width: 84 }}>{r.date ? fmtDate(r.date) : "—"}</span>
                        <span className="min-w-0 flex-1 truncate">{r.name || "—"}</span>
                        {r.error && <span className="shrink-0 text-[11px]" style={{ color: "var(--destructive)" }}>Row {r.row}: {r.error}</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          <SheetFooter className="border-t p-4 flex-row gap-2 sm:space-x-0">
            <UIButton variant="outline" onClick={() => setImp(null)} className="flex-1">Cancel</UIButton>
            <UIButton onClick={runImport} loading={importing} disabled={!good.length} className="flex-1">Import{good.length ? ` ${good.length}` : ""}</UIButton>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
