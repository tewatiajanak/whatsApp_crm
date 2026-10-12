import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Check, CircleCheck, Download, FileSpreadsheet, Upload } from "lucide-react";
import { pmApi } from "../../api";
import { useToast } from "../../context/ToastContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UIButton } from "../components/UIKit";
import { LABEL, Pill } from "../user-management/shared";
import { StatTile } from "./shared";

/** label in the sample sheet · key sent to the API · required · other headings that mean the same */
const FIELDS: { label: string; key: string; required?: boolean; also?: string[] }[] = [
  { label: "Module", key: "module", required: true },
  { label: "Module Incharge Email", key: "moduleIncharge", also: ["module incharge"] },
  { label: "Task", key: "title", required: true, also: ["task title", "title", "task name"] },
  { label: "Task Type", key: "taskType", also: ["type"] },
  { label: "Assignee Email", key: "assignee", also: ["assignee"] },
  { label: "TAT", key: "tatValue" },
  { label: "TAT Unit", key: "tatUnit", also: ["unit"] },
  { label: "Depends On", key: "dependsOn", also: ["dependency", "dependencies"] },
  { label: "Client Verification", key: "clientVerification" },
  { label: "Client Visible", key: "clientVisible" },
  { label: "Attachment Required", key: "attachmentRequired", also: ["attachment"] },
  { label: "Attachment Mandatory", key: "mandatoryAttachment", also: ["mandatory attachment"] },
  { label: "Description", key: "description" },
  { label: "Checklist", key: "checklist" },
];
const SAMPLE = [
  ["Fee Management", "", "Fee Head Master Setup", "", "", 2, "Day", "", "No", "Yes", "Yes", "No", "", "Fee heads created*; Fee groups created"],
  ["Fee Management", "", "Fee Structure Setup", "", "", 4, "Hour", "Fee Head Master Setup", "Yes", "Yes", "No", "No", "", "Class-wise fee mapped*"],
];
const STEPS = ["File", "Fields", "Verify"] as const;
const norm = (v: any) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type Result = { errors: { row: number; message: string }[]; summary?: { tasks: number; checklist: number; modules: { name: string; isNew: boolean; tasks: number }[] } };

/** Setup › Product: import modules, tasks and checklists from Excel — file → fields → verify → import. */
export default function ImportTasksDialog({ productId, open, onClose, onDone }: { productId: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast() as (msg: string, type?: string) => void;
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [heads, setHeads] = useState<string[]>([]);
  const [lines, setLines] = useState<{ row: number; cells: any[] }[]>([]);
  const [map, setMap] = useState<Record<string, string>>({}); // field key → column index ("" = not in the sheet)
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setStep(0); setFileName(""); setHeads([]); setLines([]); setMap({}); setResult(null); };
  const close = () => { reset(); onClose(); };

  const downloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([FIELDS.map((f) => f.label), ...SAMPLE]);
    ws["!cols"] = FIELDS.map((f) => ({ wch: Math.max(16, f.label.length + 4) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tasks");
    XLSX.writeFile(wb, "module-task-import-sample.xlsx");
  };

  const readFile = async (file?: File | null) => {
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const grid: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", blankrows: true });
      const head = (grid[0] || []).map((h) => String(h ?? "").trim());
      const body = grid.slice(1).map((cells, i) => ({ row: i + 2, cells })).filter((l) => l.cells.some((c) => String(c ?? "").trim() !== ""));
      if (!head.some(Boolean) || !body.length) return toast("The sheet has no rows", "error");
      const auto: Record<string, string> = {};
      FIELDS.forEach((f) => {
        const names = [f.label, f.key, ...(f.also || [])].map(norm);
        const at = head.findIndex((h) => h && names.includes(norm(h)));
        auto[f.key] = at >= 0 ? String(at) : "";
      });
      setFileName(file.name);
      setHeads(head);
      setLines(body);
      setMap(auto);
      setResult(null);
      setStep(1);
    } catch {
      toast("Could not read the file", "error");
    }
  };

  const rows = () => lines.map((l) => ({ row: l.row, ...Object.fromEntries(FIELDS.map((f) => [f.key, map[f.key] === "" || map[f.key] == null ? "" : l.cells[Number(map[f.key])] ?? ""])) }));
  const send = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const res: any = await pmApi.importTaskTemplates(productId, rows(), dryRun);
      if (dryRun || res.data.errors?.length) {
        setResult(res.data);
        setStep(2);
      } else {
        toast(`${res.data.created} tasks imported`);
        onDone();
        close();
      }
    } catch (e: any) {
      toast(e?.message || "Could not import", "error");
    } finally {
      setBusy(false);
    }
  };

  const missing = FIELDS.filter((f) => f.required && !map[f.key]);
  const errors = result?.errors || [];
  const sum = result?.summary;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="crm-theme sm:max-w-2xl p-0 gap-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="border-b px-4 py-3 pr-10">
          <DialogTitle className="text-base font-semibold">Import Excel</DialogTitle>
          <div className="mt-2.5 flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 text-[12.5px] font-medium" style={{ color: i <= step ? "var(--primary)" : "var(--muted-foreground)" }}>
                {i > 0 && <span className="h-px w-5 sm:w-8" style={{ background: i <= step ? "var(--primary)" : "var(--border)" }} />}
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]" style={i <= step ? { background: "var(--primary)", color: "#fff" } : { background: "var(--muted-background)" }}>
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {s}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={downloadSample} className="pm-import-card">
                <Download className="h-5 w-5" />
                <span className="text-sm font-medium text-foreground">Download sample</span>
              </button>
              <button type="button" onClick={() => fileInput.current?.click()} className="pm-import-card is-primary">
                <Upload className="h-5 w-5" />
                <span className="text-sm font-medium text-foreground">Choose file</span>
                <span className="text-[11px] text-muted-foreground">.xlsx · .xls · .csv</span>
              </button>
              <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          )}

          {step === 1 && (
            <>
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                <FileSpreadsheet className="h-4 w-4 shrink-0" /><span className="truncate">{fileName}</span><Pill tone="muted">{lines.length} rows</Pill>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className={LABEL}>{f.label}{f.required ? " *" : ""}</label>
                    <select className="ui-input w-full" value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value })}>
                      <option value="">—</option>
                      {heads.map((h, i) => h && <option key={i} value={i}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}

          {step === 2 && sum && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {([["Modules", sum.modules.length], ["Tasks", sum.tasks], ["Checklist", sum.checklist]] as [string, number][]).map(([label, n]) => (
                  <StatTile key={label} compact label={label} value={n} />
                ))}
              </div>
              {sum.modules.length > 0 && (
                <div className="mt-3 rounded-lg border overflow-hidden">
                  {sum.modules.map((m, i) => (
                    <div key={m.name} className={`flex items-center gap-2 px-3 py-2 text-sm ${i ? "border-t" : ""}`}>
                      <span className="min-w-0 flex-1 truncate text-foreground">{m.name}</span>
                      {m.isNew && <Pill tone="info">New</Pill>}
                      <span className="text-[12px] text-muted-foreground whitespace-nowrap">{m.tasks} tasks</span>
                    </div>
                  ))}
                </div>
              )}
              {errors.length === 0 ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
                  <CircleCheck className="h-4 w-4" />No problems
                </div>
              ) : (
                <div className="mt-3 rounded-lg border overflow-hidden" style={{ borderColor: "var(--destructive)" }}>
                  <div className="px-3 py-2 text-sm font-medium" style={{ background: "var(--destructive-bg)", color: "var(--destructive)" }}>{errors.length} problems</div>
                  {errors.map((e, i) => (
                    <div key={i} className="flex gap-3 border-t px-3 py-2 text-sm">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground" style={{ width: 56 }}>Row {e.row}</span>
                      <span className="text-foreground">{e.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t p-3 flex gap-2">
          {step === 0 && <UIButton variant="outline" onClick={close} className="flex-1">Cancel</UIButton>}
          {step === 1 && (
            <>
              <UIButton variant="outline" onClick={() => setStep(0)} className="flex-1">Back</UIButton>
              <UIButton onClick={() => send(true)} loading={busy} disabled={missing.length > 0} className="flex-1">Verify</UIButton>
            </>
          )}
          {step === 2 && (
            <>
              <UIButton variant="outline" onClick={() => setStep(errors.length ? 0 : 1)} className="flex-1">{errors.length ? "Upload again" : "Back"}</UIButton>
              <UIButton onClick={() => send(false)} loading={busy} disabled={errors.length > 0} leftIcon={<Upload className="h-3.5 w-3.5" />} className="flex-1">Import</UIButton>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
