import { useMemo, useState } from "react";
import { leadsApi } from "../../api";
import { useToast } from "../../context/ToastContext";
import { Modal, StatCard } from "../ui";
import { labelCls } from "./leadUtils";

const FIELDS = [
  ["name", "Name", ["name", "full name", "student name", "lead name", "student"]],
  ["phone", "Phone", ["phone", "mobile", "mobile number", "phone number", "contact", "contact number", "whatsapp"]],
  ["email", "Email", ["email", "email id", "e-mail", "mail"]],
  ["altPhone", "Alternate phone", ["alternate phone", "alt phone", "parent phone", "second phone"]],
  ["course", "Course", ["course", "program", "programme", "course interested"]],
  ["grade", "Grade", ["grade", "class"]],
  ["city", "City", ["city", "town"]],
  ["state", "State", ["state", "province"]],
  ["source", "Source", ["source", "lead source", "channel"]],
  ["owner", "Owner", ["owner", "counsellor", "counselor", "assigned to", "assignee"]],
  ["status", "Status", ["status", "stage"]],
  ["tags", "Tags", ["tags", "tag", "labels"]],
  ["value", "Value", ["value", "amount", "fee", "deal value"]],
  ["note", "Note", ["note", "notes", "remark", "remarks", "comment", "comments"]],
  ["branch", "Branch", ["branch", "campus", "centre", "center"]],
];
const norm = (s) => String(s || "").trim().toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ");

// Bring leads in from a CSV or Excel file: pick the file, match its columns, check, import.
export default function ImportLeads({ meta, onClose, onDone }) {
  const toast = useToast();
  const [file, setFile] = useState(null); // { name, headers, rows }
  const [map, setMap] = useState({});
  const [opts, setOpts] = useState({ onDuplicate: "skip", source: "", owner: "" });
  const [check, setCheck] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  // the standard fields, then one row per custom field (sent to the server as cf_<key>)
  const allFields = useMemo(() => [...FIELDS, ...(meta.customFields || []).map((c) => [`cf_${c.key}`, c.label, [norm(c.label), norm(c.key)]])], [meta.customFields]);

  async function read(f) {
    if (!f) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheet = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
      const headers = (sheet[0] || []).map((h) => String(h).trim());
      const rows = sheet.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
      if (!headers.length || !rows.length) throw new Error("The file has no rows");
      // guess which column is which field from its heading
      const guess = {};
      for (const [key, , names] of allFields) {
        const i = headers.findIndex((h) => names.includes(norm(h)));
        if (i >= 0) guess[key] = i;
      }
      setFile({ name: f.name, headers, rows });
      setMap(guess);
      setCheck(null);
      setResult(null);
    } catch (e) { toast(e.message || "Could not read the file", "error"); }
  }

  const rows = useMemo(() => {
    if (!file) return [];
    return file.rows.map((r) => Object.fromEntries(Object.entries(map).filter(([, i]) => i !== "" && i !== undefined).map(([key, i]) => [key, String(r[i] ?? "").trim()])));
  }, [file, map]);
  const mapped = map.name !== undefined && map.name !== "" && map.phone !== undefined && map.phone !== "";

  async function send(dryRun) {
    setBusy(true);
    try {
      const res = await leadsApi.importRows({ rows, dryRun, onDuplicate: opts.onDuplicate, defaults: { source: opts.source, owner: opts.owner } });
      if (dryRun) setCheck(res.data);
      else { setResult(res.data); onDone?.(); }
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  async function sample() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([FIELDS.map(([, label]) => label), ["Aanya Sharma", "9876543210", "aanya@example.com", "", "Class XI Science", "XI", "Pune", "Maharashtra", "Website", "", "", "walk-in; scholarship", "45000", "Asked about hostel"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, "lead-import-sample.csv");
  }

  const s = (result || check)?.summary;
  return (
    <Modal
      title="Import leads"
      size="lg"
      onClose={onClose}
      footer={result ? <button type="button" className="ui-btn ui-btn-primary" onClick={onClose}>Done</button> : <>
        <button type="button" className="ui-btn ui-btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
        {file && !check && <button type="button" className="ui-btn ui-btn-primary" disabled={busy || !mapped} onClick={() => send(true)}>{busy ? "Checking…" : "Check file"}</button>}
        {check && <button type="button" className="ui-btn ui-btn-primary" disabled={busy || !(check.summary.created + check.summary.updated)} onClick={() => send(false)}>{busy ? "Importing…" : `Import ${check.summary.created + check.summary.updated} leads`}</button>}
      </>}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground truncate">{file ? file.name : "CSV or Excel file"}</div>
            <div className="text-xs text-muted-foreground">{file ? `${file.rows.length} rows` : "First row must be the column headings."}</div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="ui-btn ui-btn-ghost" onClick={sample}><i className="bi bi-download"></i>Sample</button>
            <label className="ui-btn ui-btn-outline m-0"><i className="bi bi-upload"></i>{file ? "Change file" : "Choose file"}
              <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        {file && !result && (
          <>
            <div>
              <div className="text-sm font-semibold text-foreground mb-2">Match columns</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2">
                {allFields.map(([key, label]) => (
                  <div key={key} className="grid grid-cols-[120px_1fr] items-center gap-2">
                    <span className="text-xs text-foreground">{label}{(key === "name" || key === "phone") && " *"}</span>
                    <select className="ui-input w-full" value={map[key] ?? ""} onChange={(e) => { setMap((m) => ({ ...m, [key]: e.target.value === "" ? "" : Number(e.target.value) })); setCheck(null); }}>
                      <option value="">Not in file</option>
                      {file.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><label className={labelCls}>If already a lead</label>
                <select className="ui-input w-full" value={opts.onDuplicate} onChange={(e) => { setOpts((o) => ({ ...o, onDuplicate: e.target.value })); setCheck(null); }}>
                  <option value="skip">Skip the row</option><option value="update">Fill in missing details</option>
                </select></div>
              <div><label className={labelCls}>Source when blank</label>
                <select className="ui-input w-full" value={opts.source} onChange={(e) => setOpts((o) => ({ ...o, source: e.target.value }))}><option value="">None</option>{(meta.sources || []).map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}</select></div>
              <div><label className={labelCls}>Owner when blank</label>
                <select className="ui-input w-full" value={opts.owner} onChange={(e) => setOpts((o) => ({ ...o, owner: e.target.value }))}><option value="">Auto-assign</option>{(meta.owners || []).map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
            </div>
          </>
        )}

        {s && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard label={result ? "Created" : "Will create"} value={s.created} icon="plus-circle" tone="success" />
              <StatCard label={result ? "Updated" : "Will update"} value={s.updated} icon="arrow-repeat" tone="info" />
              <StatCard label="Duplicates" value={s.duplicate} icon="union" tone="warning" />
              <StatCard label="Invalid" value={s.invalid} icon="exclamation-triangle" tone="destructive" />
            </div>
            {!!(check?.newSources || []).length && !result && <div className="text-xs text-muted-foreground">New sources will be added: {check.newSources.join(", ")}</div>}
            {!!(result || check).problems?.length && (
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-auto" style={{ maxHeight: 220 }}>
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-muted-foreground" style={{ background: "var(--muted-background)" }}><th className="px-2 py-1.5 font-medium">Row</th><th className="px-2 py-1.5 font-medium">Name</th><th className="px-2 py-1.5 font-medium">Phone</th><th className="px-2 py-1.5 font-medium">Skipped because</th></tr></thead>
                    <tbody>{(result || check).problems.map((p) => <tr key={p.row} className="border-t"><td className="px-2 py-1.5">{p.row + 1}</td><td className="px-2 py-1.5">{p.name || "—"}</td><td className="px-2 py-1.5">{p.phone || "—"}</td><td className="px-2 py-1.5">{p.reason}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
