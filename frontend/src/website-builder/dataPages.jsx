// Website Builder data screens: Content (collections + records), Data & APIs
// (API keys, webhooks, external sources), Form inbox and Apps.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Pencil, Database, KeyRound, Webhook, Plug, Copy, Send, RefreshCw, Upload, Inbox, Puzzle, Settings2, Search, Check, MailOpen, Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { askConfirm } from "../utils/dialog";
import { wbApi } from "./api";
import { Shell, useLoad, Loading, Failed, EmptyBox, Label, selectCls, fmtDate, base } from "./pages";
import { RichField } from "./BuilderPage";
import { SITE_APPS, buildAppPackage } from "./apps";

const FIELD_TYPES = [["text", "Text"], ["textarea", "Long text"], ["richtext", "Rich text"], ["number", "Number"], ["boolean", "Yes / No"], ["date", "Date"], ["image", "Image URL"], ["url", "Link"], ["email", "Email"], ["select", "Dropdown"], ["tags", "Tags"]];
const areaCls = "w-full rounded-md border border-input bg-background p-2 text-sm";
const copy = (text, what = "Copied") => navigator.clipboard.writeText(text).then(() => toast.success(what)).catch(() => toast.error("Could not copy"));
const Tabs = ({ value, onChange, items }) => <div className="flex gap-2 border-b pb-3 overflow-x-auto">{items.map(([key, label, Icon]) => <Button key={key} size="sm" variant={value === key ? "default" : "ghost"} onClick={() => onChange(key)}>{Icon && <Icon className="h-4 w-4" />}{label}</Button>)}</div>;
const Th = ({ children, className = "" }) => <th className={`text-left text-xs font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap ${className}`}>{children}</th>;
const Td = ({ children, className = "" }) => <td className={`px-3 py-2 text-sm align-middle ${className}`}>{children}</td>;
const Table = ({ head, children }) => <Card><CardContent className="p-0 overflow-x-auto"><table className="w-full"><thead className="bg-accent/40 border-b"><tr>{head}</tr></thead><tbody className="divide-y">{children}</tbody></table></CardContent></Card>;

/** Split CSV text into rows of cells (handles quotes, commas and line breaks inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some((c) => c.trim())) rows.push(row); row = []; }
    else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

/* ════════════════ Content ════════════════ */
function FieldsEditor({ fields, onChange }) {
  const set = (i, key, v) => onChange(fields.map((f, j) => (j === i ? { ...f, [key]: v } : f)));
  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={i} className="grid gap-2 grid-cols-2 md:grid-cols-[1fr_1fr_140px_auto] items-center rounded-md border p-2">
          <Input aria-label="Field name" value={f.label} onChange={(e) => onChange(fields.map((x, j) => (j === i ? { ...x, label: e.target.value, key: x.locked ? x.key : e.target.value.replace(/[^A-Za-z0-9]+(.)/g, (_m, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, "").replace(/^(\d)/, "f$1").replace(/^./, (c) => c.toLowerCase()) } : x)))} />
          <Input aria-label="Field key" value={f.key} disabled={f.locked} className="font-mono text-xs" onChange={(e) => set(i, "key", e.target.value.replace(/[^A-Za-z0-9_]/g, ""))} />
          <select aria-label="Type" className={selectCls} value={f.type} onChange={(e) => set(i, "type", e.target.value)}>{FIELD_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <div className="flex items-center gap-2 col-span-2 md:col-span-1">
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!f.required} onChange={(e) => set(i, "required", e.target.checked)} /> Required</label>
            <label className="flex items-center gap-1 text-xs" title="Never sent by the public API"><input type="checkbox" checked={!!f.hiddenFromApi} onChange={(e) => set(i, "hiddenFromApi", e.target.checked)} /> Private</label>
            <Button size="icon" variant="ghost" className="h-8 w-8 ml-auto" title="Remove field" aria-label="Remove field" onClick={() => onChange(fields.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
          {f.type === "select" && <Input aria-label="Options" className="col-span-2 md:col-span-4" value={(f.options || []).join(", ")} onChange={(e) => set(i, "options", e.target.value.split(",").map((o) => o.trim()).filter(Boolean))} />}
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange([...fields, { key: "", label: "", type: "text", required: false }])}><Plus className="h-4 w-4" /> Add field</Button>
    </div>
  );
}

function RecordField({ field, value, onChange }) {
  const id = `wb-r-${field.key}`;
  const f = field;
  if (f.type === "boolean") return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {f.label}</label>;
  let input;
  if (f.type === "textarea") input = <textarea id={id} rows={3} className={areaCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  else if (f.type === "richtext") input = <RichField value={value ?? ""} onChange={onChange} />;
  else if (f.type === "select") input = <select id={id} className={selectCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{(f.options || []).map((o) => <option key={o}>{o}</option>)}</select>;
  else if (f.type === "tags") input = <Input id={id} value={Array.isArray(value) ? value.join(", ") : value ?? ""} onChange={(e) => onChange(e.target.value.split(",").map((t) => t.trim()))} />;
  else if (f.type === "date") input = <Input id={id} type="datetime-local" value={value ? String(value).slice(0, 16) : ""} onChange={(e) => onChange(e.target.value)} />;
  else input = <Input id={id} type={f.type === "number" ? "number" : f.type === "email" ? "email" : "text"} inputMode={f.type === "image" || f.type === "url" ? "url" : undefined} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  return <div><Label htmlFor={id}>{f.label}{f.required && " *"}</Label>{input}</div>;
}

export function ContentPage() {
  const { siteId, key } = useParams();
  const navigate = useNavigate();
  const site = useLoad(() => wbApi.site(siteId), [siteId]);
  const cols = useLoad(() => wbApi.collections(siteId), [siteId]);
  const col = (cols.data || []).find((c) => c.key === key) || null;
  const [query, setQuery] = useState({ page: 1, search: "" });
  const recs = useLoad(() => (key ? wbApi.records(siteId, key, { page: query.page, search: query.search, limit: 20 }) : Promise.resolve(null)), [siteId, key, query.page, query.search]);
  const [colForm, setColForm] = useState(null);
  const [rec, setRec] = useState(null);
  const [imp, setImp] = useState(null);

  useEffect(() => { if (!key && cols.data?.length) navigate(`${base(siteId)}/content/${cols.data[0].key}`, { replace: true }); }, [key, cols.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setQuery({ page: 1, search: "" }); }, [key]);

  async function saveCol() {
    if (!colForm.name.trim()) return toast.error("Enter a collection name");
    if (colForm.fields.some((f) => !f.key || !f.label)) return toast.error("Every field needs a name");
    try {
      if (colForm.editing) await wbApi.updateCollection(siteId, colForm.key, { name: colForm.name, fields: colForm.fields, settings: { titleField: colForm.fields[0].key, apiEnabled: colForm.apiEnabled, publicWithoutKey: colForm.publicWithoutKey } });
      else { const c = await wbApi.createCollection(siteId, { name: colForm.name, fields: colForm.fields }); navigate(`${base(siteId)}/content/${c.key}`); }
      toast.success("Saved"); setColForm(null); cols.reload(); recs.reload();
    } catch (e) { toast.error(e.message); }
  }
  async function removeCol() {
    if (!(await askConfirm(`Delete "${col.name}" and all its records?`))) return;
    try { await wbApi.removeCollection(siteId, col.key); toast.success("Collection deleted"); navigate(`${base(siteId)}/content`); cols.reload(); } catch (e) { toast.error(e.message); }
  }
  async function saveRec(status) {
    try {
      const body = { data: rec.data, slug: rec.slug || undefined, status };
      if (rec.id) await wbApi.updateRecord(siteId, key, rec.id, body); else await wbApi.createRecord(siteId, key, body);
      toast.success("Saved"); setRec(null); recs.reload(); cols.reload();
    } catch (e) { toast.error(e.message); }
  }
  async function removeRec(r) { if (await askConfirm("Delete this record?")) { try { await wbApi.removeRecord(siteId, key, r.id); recs.reload(); cols.reload(); } catch (e) { toast.error(e.message); } } }
  async function readCsv(file) {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return toast.error("The file needs a header row and at least one record");
    const head = rows[0].map((h) => h.trim().toLowerCase());
    // match columns to fields by key or label
    const map = col.fields.map((f) => head.findIndex((h) => h === f.key.toLowerCase() || h === f.label.toLowerCase()));
    const data = rows.slice(1).map((r) => Object.fromEntries(col.fields.map((f, i) => [f.key, map[i] >= 0 ? r[map[i]] ?? "" : ""])));
    try { const report = await wbApi.importRecords(siteId, key, { rows: data, dryRun: true }); setImp({ rows: data, report, matched: col.fields.filter((_, i) => map[i] >= 0).map((f) => f.label) }); } catch (e) { toast.error(e.message); }
  }
  async function runImport(publish) {
    try { const out = await wbApi.importRecords(siteId, key, { rows: imp.rows, publish }); toast.success(`${out.created} records imported`); setImp(null); recs.reload(); cols.reload(); } catch (e) { toast.error(e.message); }
  }

  const newCol = () => setColForm({ name: "", fields: [{ key: "title", label: "Title", type: "text", required: true }], apiEnabled: false });
  const editCol = () => setColForm({ editing: true, key: col.key, name: col.name, fields: col.fields.map((f) => ({ ...f, locked: true })), apiEnabled: !!col.settings?.apiEnabled, publicWithoutKey: !!col.settings?.publicWithoutKey });
  const newBtn = <Button onClick={newCol}><Plus className="h-4 w-4" /> New collection</Button>;
  if (site.error) return <Shell title="Content"><Failed error={site.error} retry={site.reload} /></Shell>;
  if (!site.data || !cols.data) return <Shell title="Content"><Loading /></Shell>;
  const titleKey = col?.settings?.titleField || col?.fields[0]?.key;
  const shown = col ? col.fields.filter((f) => f.key !== titleKey && ["text", "number", "select", "date", "boolean"].includes(f.type)).slice(0, 3) : [];
  const cell = (f, v) => (f.type === "date" ? fmtDate(v) : f.type === "boolean" ? (v ? "Yes" : "No") : String(v ?? "—"));

  return (
    <Shell title="Content" crumb={site.data.name} actions={newBtn}>
      {cols.data.length === 0 ? <EmptyBox icon={Database} text="No collections" action={newBtn} /> : <>
        <div className="flex gap-2 border-b pb-3 overflow-x-auto">{cols.data.map((c) => <Button key={c.key} size="sm" variant={c.key === key ? "default" : "ghost"} onClick={() => navigate(`${base(siteId)}/content/${c.key}`)}>{c.name} <span className="opacity-70">{c.records}</span></Button>)}</div>
        {col && <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-sm"><Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search" placeholder="Search" className="pl-8" value={query.search} onChange={(e) => setQuery({ page: 1, search: e.target.value })} /></div>
            {col.settings?.apiEnabled && <Badge variant="outline">API on</Badge>}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={editCol}><Settings2 className="h-4 w-4" /> Fields</Button>
              <Button variant="outline" size="sm" asChild><label className="cursor-pointer"><Upload className="h-4 w-4" /> Import CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) readCsv(file); }} /></label></Button>
              <Button variant="outline" size="sm" title="Delete collection" aria-label="Delete collection" onClick={removeCol}><Trash2 className="h-4 w-4" /></Button>
              <Button size="sm" onClick={() => setRec({ data: {}, slug: "" })}><Plus className="h-4 w-4" /> Add record</Button>
            </div>
          </div>
          {recs.loading && !recs.data ? <Loading /> : recs.error ? <Failed error={recs.error} retry={recs.reload} /> : !recs.data || recs.data.items.length === 0 ? <EmptyBox icon={Database} text="No records" action={<Button onClick={() => setRec({ data: {}, slug: "" })}><Plus className="h-4 w-4" /> Add record</Button>} /> : <>
            <Table head={<><Th className="w-12">Sr No</Th><Th>{col.fields.find((f) => f.key === titleKey)?.label}</Th>{shown.map((f) => <Th key={f.key} className="hidden md:table-cell">{f.label}</Th>)}<Th>Status</Th><Th className="hidden sm:table-cell">Updated</Th><Th className="text-right">Action</Th></>}>
              {recs.data.items.map((r, i) => (
                <tr key={r.id}>
                  <Td>{(recs.data.page - 1) * recs.data.limit + i + 1}</Td>
                  <Td><div className="font-medium">{String(r[titleKey] ?? "—")}</div><div className="text-xs text-muted-foreground">{r.slug}</div></Td>
                  {shown.map((f) => <Td key={f.key} className="hidden md:table-cell">{cell(f, r[f.key])}</Td>)}
                  <Td><Badge variant={r.status === "published" ? "default" : "outline"}>{r.status === "published" ? "Live" : "Draft"}</Badge></Td>
                  <Td className="hidden sm:table-cell">{fmtDate(r.updatedAt)}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" aria-label="Edit" onClick={() => setRec({ id: r.id, slug: r.slug, status: r.status, data: Object.fromEntries(col.fields.map((f) => [f.key, r[f.key]])) })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Delete" aria-label="Delete" onClick={() => removeRec(r)}><Trash2 className="h-4 w-4" /></Button>
                  </Td>
                </tr>))}
            </Table>
            {recs.data.totalPages > 1 && <div className="flex items-center justify-end gap-2 text-sm"><Button size="sm" variant="outline" disabled={recs.data.page <= 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}>Previous</Button><span>{recs.data.page} / {recs.data.totalPages}</span><Button size="sm" variant="outline" disabled={recs.data.page >= recs.data.totalPages} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Next</Button></div>}
          </>}
        </>}
      </>}

      <Dialog open={!!colForm} onOpenChange={(o) => !o && setColForm(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{colForm?.editing ? "Collection fields" : "New collection"}</DialogTitle></DialogHeader>
          {colForm && <div className="space-y-4">
            <div><Label htmlFor="wb-col-name">Name *</Label><Input id="wb-col-name" autoFocus value={colForm.name} onChange={(e) => setColForm({ ...colForm, name: e.target.value })} /></div>
            <div><Label>Fields</Label><FieldsEditor fields={colForm.fields} onChange={(fields) => setColForm({ ...colForm, fields })} /></div>
            {colForm.editing && <div className="flex flex-wrap gap-4 border-t pt-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={colForm.apiEnabled} onChange={(e) => setColForm({ ...colForm, apiEnabled: e.target.checked })} /> Available in the Content API</label>
              {colForm.apiEnabled && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!colForm.publicWithoutKey} onChange={(e) => setColForm({ ...colForm, publicWithoutKey: e.target.checked })} /> Readable without an API key</label>}
            </div>}
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setColForm(null)}>Cancel</Button><Button onClick={saveCol}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rec} onOpenChange={(o) => !o && setRec(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{rec?.id ? "Edit record" : "Add record"}</DialogTitle></DialogHeader>
          {rec && col && <div className="space-y-3">
            {col.fields.map((f) => <RecordField key={f.key} field={f} value={rec.data[f.key]} onChange={(v) => setRec({ ...rec, data: { ...rec.data, [f.key]: v } })} />)}
            {rec.id && <div><Label htmlFor="wb-r-slug">Address slug</Label><Input id="wb-r-slug" className="font-mono text-xs" value={rec.slug} onChange={(e) => setRec({ ...rec, slug: e.target.value })} /></div>}
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setRec(null)}>Cancel</Button><Button variant="outline" onClick={() => saveRec("draft")}>Save as draft</Button><Button onClick={() => saveRec("published")}>Publish</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!imp} onOpenChange={(o) => !o && setImp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Import records</DialogTitle></DialogHeader>
          {imp && <div className="space-y-3 text-sm">
            <div className="flex gap-4"><span><b>{imp.report.total}</b> rows</span><span className="text-emerald-700"><b>{imp.report.valid}</b> ready</span><span className="text-destructive"><b>{imp.report.total - imp.report.valid}</b> with problems</span></div>
            <div className="text-xs text-muted-foreground">Matched columns: {imp.matched.join(", ") || "none"}</div>
            {imp.report.errors.length > 0 && <div className="max-h-40 overflow-y-auto rounded-md border p-2 text-xs space-y-1">{imp.report.errors.map((e, i) => <div key={i}>Row {e.row}: {e.error}</div>)}</div>}
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setImp(null)}>Cancel</Button><Button variant="outline" disabled={!imp?.report.valid} onClick={() => runImport(false)}>Import as drafts</Button><Button disabled={!imp?.report.valid} onClick={() => runImport(true)}>Import and publish</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

/* ════════════════ Data & APIs ════════════════ */
const EVENTS = ["record.created", "record.updated", "record.deleted", "record.published", "page.published", "page.unpublished", "form.submitted", "theme.published"];

function ApiKeys({ siteId, site }) {
  const keys = useLoad(() => wbApi.apiKeys(siteId), [siteId]);
  const [form, setForm] = useState(null);
  const [made, setMade] = useState(null);
  const endpoint = `${window.location.origin.replace(":5173", ":4001")}/api/content/v1/sites/${site.siteKey}`;
  async function create() {
    if (!form.name.trim()) return toast.error("Enter a key name");
    try { const k = await wbApi.createApiKey(siteId, { name: form.name, allowedOrigins: form.origins.split(",").map((o) => o.trim()).filter(Boolean), expiresInDays: Number(form.days) || 0 }); setForm(null); setMade(k); keys.reload(); } catch (e) { toast.error(e.message); }
  }
  const act = async (fn, msg) => { try { await fn(); toast.success(msg); keys.reload(); } catch (e) { toast.error(e.message); } };
  const add = <Button onClick={() => setForm({ name: "", origins: "", days: "" })}><Plus className="h-4 w-4" /> New API key</Button>;
  return (
    <div className="space-y-4">
      <Card><CardContent className="p-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">Endpoint</span><code className="text-xs break-all flex-1 min-w-[200px]">{endpoint}/collections/&lt;key&gt;/items</code><Button size="sm" variant="outline" onClick={() => copy(endpoint, "Endpoint copied")}><Copy className="h-4 w-4" /> Copy</Button>{add}</CardContent></Card>
      {keys.loading && !keys.data ? <Loading /> : keys.error ? <Failed error={keys.error} retry={keys.reload} /> : keys.data.length === 0 ? <EmptyBox icon={KeyRound} text="No API keys" action={add} /> : (
        <Table head={<><Th>Name</Th><Th>Key</Th><Th className="hidden md:table-cell">Origins</Th><Th className="hidden sm:table-cell">Last used</Th><Th>Uses</Th><Th>Status</Th><Th className="text-right">Action</Th></>}>
          {keys.data.map((k) => <tr key={k._id}><Td className="font-medium">{k.name}</Td><Td><code className="text-xs">{k.prefix}…</code></Td><Td className="hidden md:table-cell text-xs">{k.allowedOrigins.join(", ") || "—"}</Td><Td className="hidden sm:table-cell">{fmtDate(k.lastUsedAt)}</Td><Td>{k.uses}</Td><Td><Badge variant={k.status === "active" ? "default" : "outline"}>{k.status === "active" ? "Active" : "Revoked"}</Badge></Td>
            <Td className="text-right whitespace-nowrap">{k.status === "active" && <Button size="sm" variant="outline" onClick={() => act(() => wbApi.revokeApiKey(siteId, k._id), "Key revoked")}>Revoke</Button>} <Button size="icon" variant="ghost" className="h-8 w-8" title="Delete" aria-label="Delete" onClick={async () => (await askConfirm("Delete this key?")) && act(() => wbApi.removeApiKey(siteId, k._id), "Key deleted")}><Trash2 className="h-4 w-4" /></Button></Td></tr>)}
        </Table>)}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>New API key</DialogTitle></DialogHeader>
        {form && <div className="space-y-3">
          <div><Label htmlFor="wb-k-name">Name *</Label><Input id="wb-k-name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label htmlFor="wb-k-or">Allowed websites (comma separated)</Label><Input id="wb-k-or" value={form.origins} onChange={(e) => setForm({ ...form, origins: e.target.value })} /></div>
          <div><Label htmlFor="wb-k-days">Expires in days</Label><Input id="wb-k-days" type="number" min={0} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></div>
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button onClick={create}>Create</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!made} onOpenChange={(o) => !o && setMade(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Copy your key now</DialogTitle></DialogHeader>
        {made && <div className="space-y-2"><code className="block text-xs break-all rounded-md border bg-accent/40 p-2">{made.key}</code><p className="text-xs text-muted-foreground">It is shown only once.</p></div>}
        <DialogFooter><Button onClick={() => copy(made.key, "Key copied")}><Copy className="h-4 w-4" /> Copy</Button></DialogFooter></DialogContent></Dialog>
    </div>);
}

function Webhooks({ siteId }) {
  const hooks = useLoad(() => wbApi.webhooks(siteId), [siteId]);
  const [form, setForm] = useState(null);
  const [made, setMade] = useState(null);
  const [open, setOpen] = useState(null);
  async function create() {
    if (!form.name.trim() || !form.url.trim() || !form.events.length) return toast.error("Enter a name, an https address and at least one event");
    try { const h = await wbApi.createWebhook(siteId, form); setForm(null); setMade(h); hooks.reload(); } catch (e) { toast.error(e.message); }
  }
  const act = async (fn, msg) => { try { await fn(); if (msg) toast.success(msg); hooks.reload(); } catch (e) { toast.error(e.message); } };
  const add = <Button onClick={() => setForm({ name: "", url: "", events: ["record.published"] })}><Plus className="h-4 w-4" /> New webhook</Button>;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">{add}</div>
      {hooks.loading && !hooks.data ? <Loading /> : hooks.error ? <Failed error={hooks.error} retry={hooks.reload} /> : hooks.data.length === 0 ? <EmptyBox icon={Webhook} text="No webhooks" action={add} /> : hooks.data.map((h) => { const last = h.deliveries[0]; return (
        <Card key={h._id}><CardContent className="p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1"><div className="font-medium truncate">{h.name}</div><div className="text-xs text-muted-foreground truncate">{h.url}</div></div>
            <Badge variant={h.active ? "default" : "outline"}>{h.active ? "Active" : "Paused"}</Badge>
            {last && <Badge variant="outline" className={last.error ? "text-destructive" : ""}>{last.error || `HTTP ${last.status}`}</Badge>}
            <Button size="sm" variant="outline" onClick={() => act(() => wbApi.testWebhook(siteId, h._id), "Test event sent")}><Send className="h-4 w-4" /> Test</Button>
            <Button size="sm" variant="outline" onClick={() => act(() => wbApi.updateWebhook(siteId, h._id, { active: !h.active }))}>{h.active ? "Pause" : "Resume"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(open === h._id ? null : h._id)}>Log</Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Delete" aria-label="Delete" onClick={async () => (await askConfirm("Delete this webhook?")) && act(() => wbApi.removeWebhook(siteId, h._id), "Webhook deleted")}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-1">{h.events.map((e) => <Badge key={e} variant="outline" className="font-normal">{e}</Badge>)}</div>
          {open === h._id && (h.deliveries.length === 0 ? <p className="text-xs text-muted-foreground">No deliveries</p> : <div className="rounded-md border divide-y text-xs">{h.deliveries.map((d, i) => <div key={i} className="flex gap-3 p-2"><span className="text-muted-foreground">{new Date(d.at).toLocaleString("en-GB")}</span><span>{d.event}</span><span className={d.error ? "text-destructive" : "text-emerald-700"}>{d.error || `HTTP ${d.status}`}</span><span className="ml-auto text-muted-foreground">{d.ms} ms</span></div>)}</div>)}
        </CardContent></Card>); })}
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>New webhook</DialogTitle></DialogHeader>
        {form && <div className="space-y-3">
          <div><Label htmlFor="wb-h-name">Name *</Label><Input id="wb-h-name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label htmlFor="wb-h-url">Address (https) *</Label><Input id="wb-h-url" inputMode="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
          <div><Label>Events *</Label><div className="grid grid-cols-2 gap-1">{EVENTS.map((ev) => <label key={ev} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.events.includes(ev)} onChange={(e) => setForm({ ...form, events: e.target.checked ? [...form.events, ev] : form.events.filter((x) => x !== ev) })} /> {ev}</label>)}</div></div>
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button><Button onClick={create}>Create</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={!!made} onOpenChange={(o) => !o && setMade(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Copy the signing secret now</DialogTitle></DialogHeader>
        {made && <div className="space-y-2"><code className="block text-xs break-all rounded-md border bg-accent/40 p-2">{made.secret}</code><p className="text-xs text-muted-foreground">Each call carries X-WB-Signature: sha256=HMAC(body, secret). The secret is shown only once.</p></div>}
        <DialogFooter><Button onClick={() => copy(made.secret, "Secret copied")}><Copy className="h-4 w-4" /> Copy</Button></DialogFooter></DialogContent></Dialog>
    </div>);
}

/** Dot-paths of the plain values in an object, for field suggestions. */
function leafPaths(obj, prefix = "", out = [], depth = 0) {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj) || depth > 3) { if (prefix) out.push(prefix); return out; }
  for (const [k, v] of Object.entries(obj).slice(0, 40)) leafPaths(v, prefix ? `${prefix}.${k}` : k, out, depth + 1);
  return out;
}
const dig = (obj, path) => String(path || "").split(".").filter(Boolean).reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);

function DataSources({ siteId }) {
  const list = useLoad(() => wbApi.dataSources(siteId), [siteId]);
  const [form, setForm] = useState(null);
  const [sample, setSample] = useState(null);
  const [busy, setBusy] = useState(false);
  const headerObj = () => Object.fromEntries((form.headers || []).filter((h) => h.name && h.value).map((h) => [h.name, h.value]));
  async function test() {
    setBusy(true);
    try {
      const out = await wbApi.testDataSource(siteId, { url: form.url, headers: headerObj(), sourceId: form._id });
      setSample(out.body);
      const root = form.rootPath ? dig(out.body, form.rootPath) : out.body;
      const first = Array.isArray(root) ? root[0] : root;
      if (!form.fields.length && first && typeof first === "object") setForm((f) => ({ ...f, fields: leafPaths(first).slice(0, 8).map((p) => ({ key: p.split(".").pop().replace(/[^A-Za-z0-9_]/g, ""), path: p })) }));
      toast.success(`The API answered ${out.status}`);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  async function save() {
    if (!form.name.trim() || !form.url.trim()) return toast.error("Enter a name and an https address");
    const body = { name: form.name, url: form.url, rootPath: form.rootPath, fields: form.fields.filter((f) => f.key && f.path), ttlSeconds: Number(form.ttlSeconds) || 300, ...(form.headersTouched || !form._id ? { headers: headerObj() } : {}) };
    try { if (form._id) await wbApi.updateDataSource(siteId, form._id, body); else await wbApi.createDataSource(siteId, body); toast.success("Saved"); setForm(null); setSample(null); list.reload(); } catch (e) { toast.error(e.message); }
  }
  const act = async (fn, msg) => { try { const out = await fn(); toast.success(typeof msg === "function" ? msg(out) : msg); list.reload(); } catch (e) { toast.error(e.message); list.reload(); } };
  const blank = { name: "", url: "", rootPath: "", fields: [], ttlSeconds: 300, headers: [] };
  const add = <Button onClick={() => { setSample(null); setForm(blank); }}><Plus className="h-4 w-4" /> New data source</Button>;
  const root = sample && form ? (form.rootPath ? dig(sample, form.rootPath) : sample) : null;
  const rows = Array.isArray(root) ? root.slice(0, 3) : root && typeof root === "object" ? [root] : [];
  return (
    <div className="space-y-4">
      <div className="flex justify-end">{add}</div>
      {list.loading && !list.data ? <Loading /> : list.error ? <Failed error={list.error} retry={list.reload} /> : list.data.length === 0 ? <EmptyBox icon={Plug} text="No data sources" action={add} /> : (
        <Table head={<><Th>Name</Th><Th>Use as</Th><Th className="hidden md:table-cell">Address</Th><Th>State</Th><Th className="hidden sm:table-cell">Last success</Th><Th className="text-right">Action</Th></>}>
          {list.data.map((s) => <tr key={s._id}><Td className="font-medium">{s.name}</Td><Td><code className="text-xs">api:{s.key}</code></Td><Td className="hidden md:table-cell text-xs max-w-[260px] truncate">{s.url}</Td>
            <Td><Badge variant={s.state === "healthy" ? "default" : s.state === "new" ? "outline" : "outline"} className={s.state === "failing" || s.state === "circuit open" ? "text-destructive" : ""} title={s.lastError || undefined}>{s.state}</Badge></Td><Td className="hidden sm:table-cell">{fmtDate(s.lastSuccessAt)}</Td>
            <Td className="text-right whitespace-nowrap">
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Refresh now" aria-label="Refresh now" onClick={() => act(() => wbApi.refreshDataSource(siteId, s._id), (o) => `${o.total} items loaded`)}><RefreshCw className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" aria-label="Edit" onClick={() => { setSample(null); setForm({ ...blank, ...s, headers: [] }); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" title="Delete" aria-label="Delete" onClick={async () => (await askConfirm("Delete this data source?")) && act(() => wbApi.removeDataSource(siteId, s._id), "Data source deleted")}><Trash2 className="h-4 w-4" /></Button>
            </Td></tr>)}
        </Table>)}
      <Dialog open={!!form} onOpenChange={(o) => { if (!o) { setForm(null); setSample(null); } }}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{form?._id ? "Edit data source" : "New data source"}</DialogTitle></DialogHeader>
        {form && <div className="space-y-4">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-[1fr_2fr]">
            <div><Label htmlFor="wb-ds-name">Name *</Label><Input id="wb-ds-name" autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label htmlFor="wb-ds-url">JSON address (https) *</Label><div className="flex gap-2"><Input id="wb-ds-url" inputMode="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /><Button variant="outline" onClick={test} disabled={busy || !form.url}>{busy ? "Testing…" : "Test"}</Button></div></div>
          </div>
          <div><Label>Request headers{form.hasHeaders && !form.headersTouched ? " (saved — add a row to replace them)" : ""}</Label>
            <div className="space-y-2">{form.headers.map((h, i) => <div key={i} className="flex gap-2"><Input aria-label="Header name" value={h.name} onChange={(e) => setForm({ ...form, headersTouched: true, headers: form.headers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /><Input aria-label="Header value" type="password" autoComplete="off" value={h.value} onChange={(e) => setForm({ ...form, headersTouched: true, headers: form.headers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} /><Button size="icon" variant="ghost" aria-label="Remove header" onClick={() => setForm({ ...form, headersTouched: true, headers: form.headers.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button></div>)}
              <Button size="sm" variant="outline" onClick={() => setForm({ ...form, headersTouched: true, headers: [...form.headers, { name: "", value: "" }] })}><Plus className="h-4 w-4" /> Add header</Button></div></div>
          <div className="grid gap-3 grid-cols-2">
            <div><Label htmlFor="wb-ds-root">List path</Label><Input id="wb-ds-root" className="font-mono text-xs" value={form.rootPath} onChange={(e) => setForm({ ...form, rootPath: e.target.value })} /></div>
            <div><Label htmlFor="wb-ds-ttl">Refresh every (seconds)</Label><Input id="wb-ds-ttl" type="number" min={30} max={86400} value={form.ttlSeconds} onChange={(e) => setForm({ ...form, ttlSeconds: e.target.value })} /></div>
          </div>
          <div><Label>Fields</Label>
            <div className="space-y-2">{form.fields.map((f, i) => <div key={i} className="flex gap-2 items-center"><Input aria-label="Field key" className="font-mono text-xs" value={f.key} onChange={(e) => setForm({ ...form, fields: form.fields.map((x, j) => (j === i ? { ...x, key: e.target.value.replace(/[^A-Za-z0-9_]/g, "") } : x)) })} /><Input aria-label="Path in the response" className="font-mono text-xs" value={f.path} onChange={(e) => setForm({ ...form, fields: form.fields.map((x, j) => (j === i ? { ...x, path: e.target.value } : x)) })} /><span className="text-xs text-muted-foreground w-40 truncate hidden md:block">{rows[0] ? String(dig(rows[0], f.path) ?? "—") : ""}</span><Button size="icon" variant="ghost" aria-label="Remove field" onClick={() => setForm({ ...form, fields: form.fields.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button></div>)}
              <Button size="sm" variant="outline" onClick={() => setForm({ ...form, fields: [...form.fields, { key: "", path: "" }] })}><Plus className="h-4 w-4" /> Add field</Button></div></div>
          {sample && <div><Label>Response</Label><pre className="max-h-56 overflow-auto rounded-md border bg-accent/40 p-2 text-[11px] leading-snug">{JSON.stringify(sample, null, 2).slice(0, 6000)}</pre></div>}
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => { setForm(null); setSample(null); }}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter></DialogContent></Dialog>
    </div>);
}

export function DataApisPage() {
  const { siteId } = useParams();
  const site = useLoad(() => wbApi.site(siteId), [siteId]);
  const [tab, setTab] = useState("keys");
  if (site.error) return <Shell title="Data & APIs"><Failed error={site.error} retry={site.reload} /></Shell>;
  if (!site.data) return <Shell title="Data & APIs"><Loading /></Shell>;
  return (
    <Shell title="Data & APIs" crumb={site.data.name}>
      <Tabs value={tab} onChange={setTab} items={[["keys", "API keys", KeyRound], ["hooks", "Webhooks", Webhook], ["sources", "Data sources", Plug]]} />
      {tab === "keys" && <ApiKeys siteId={siteId} site={site.data} />}
      {tab === "hooks" && <Webhooks siteId={siteId} />}
      {tab === "sources" && <DataSources siteId={siteId} />}
    </Shell>);
}

/* ════════════════ Form inbox ════════════════ */
export function InboxPage() {
  const { siteId } = useParams();
  const site = useLoad(() => wbApi.site(siteId), [siteId]);
  const [page, setPage] = useState(1);
  const subs = useLoad(() => wbApi.submissions(siteId, page), [siteId, page]);
  const act = async (fn) => { try { await fn(); subs.reload(); } catch (e) { toast.error(e.message); } };
  if (site.error) return <Shell title="Form inbox"><Failed error={site.error} retry={site.reload} /></Shell>;
  if (!site.data || (subs.loading && !subs.data)) return <Shell title="Form inbox"><Loading /></Shell>;
  if (subs.error) return <Shell title="Form inbox"><Failed error={subs.error} retry={subs.reload} /></Shell>;
  return (
    <Shell title="Form inbox" crumb={site.data.name} actions={<Badge variant="outline">{subs.data.unread} unread</Badge>}>
      {subs.data.items.length === 0 ? <EmptyBox icon={Inbox} text="No form submissions" /> : <div className="space-y-3">
        {subs.data.items.map((s) => (
          <Card key={s._id} className={s.read ? "" : "border-primary"}><CardContent className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.form}</span>{!s.read && <Badge>New</Badge>}{s.leadCreated && <Badge variant="outline">CRM lead</Badge>}
              <span className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString("en-GB")} · {s.pagePath}</span>
              <div className="ml-auto flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" title={s.read ? "Mark unread" : "Mark read"} aria-label={s.read ? "Mark unread" : "Mark read"} onClick={() => act(() => wbApi.markSubmission(siteId, s._id, !s.read))}>{s.read ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}</Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Delete" aria-label="Delete" onClick={async () => (await askConfirm("Delete this submission?")) && act(() => wbApi.removeSubmission(siteId, s._id))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <dl className="grid gap-x-4 gap-y-1 grid-cols-1 sm:grid-cols-[160px_1fr] text-sm">{Object.entries(s.data || {}).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="whitespace-pre-wrap break-words">{String(v)}</dd></div>)}</dl>
          </CardContent></Card>))}
        {subs.data.totalPages > 1 && <div className="flex items-center justify-end gap-2 text-sm"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span>{page} / {subs.data.totalPages}</span><Button size="sm" variant="outline" disabled={page >= subs.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button></div>}
      </div>}
    </Shell>);
}

/* ════════════════ Apps ════════════════ */
export function AppsPage() {
  const { siteId } = useParams();
  const site = useLoad(() => wbApi.site(siteId), [siteId]);
  const [busy, setBusy] = useState("");
  const installed = useMemo(() => site.data?.settings?.apps || {}, [site.data]);
  async function install(key) {
    setBusy(key);
    try { const out = await wbApi.installApp(siteId, buildAppPackage(key), true); toast.success(`Installed: ${out.collections.length} collection, ${out.pages} pages (as drafts)`); site.reload(); } catch (e) { toast.error(e.message); } finally { setBusy(""); }
  }
  async function uninstall(key, name) {
    const removeContent = await askConfirm(`Remove "${name}". Also delete its pages, collections and records?`, { confirmLabel: "Delete everything" });
    if (!removeContent && !(await askConfirm(`Remove "${name}" but keep its content?`, { confirmLabel: "Keep content", danger: false }))) return;
    setBusy(key);
    try { await wbApi.uninstallApp(siteId, key, removeContent); toast.success("App removed"); site.reload(); } catch (e) { toast.error(e.message); } finally { setBusy(""); }
  }
  if (site.error) return <Shell title="Apps"><Failed error={site.error} retry={site.reload} /></Shell>;
  if (!site.data) return <Shell title="Apps"><Loading /></Shell>;
  return (
    <Shell title="Apps" crumb={site.data.name}>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {SITE_APPS.map((a) => { const on = !!installed[a.key]; return (
          <Card key={a.key}><CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3"><div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center shrink-0"><Puzzle className="h-5 w-5 text-primary" /></div><div className="min-w-0 flex-1"><div className="font-semibold flex items-center gap-2">{a.name}{on && <Badge><Check className="h-3 w-3" /> Installed</Badge>}</div><p className="text-sm text-muted-foreground">{a.description}</p></div></div>
            {on ? <Button size="sm" variant="outline" disabled={busy === a.key} onClick={() => uninstall(a.key, a.name)}>Remove</Button> : <Button size="sm" disabled={busy === a.key} onClick={() => install(a.key)}>{busy === a.key ? "Installing…" : "Install"}</Button>}
          </CardContent></Card>); })}
      </div>
    </Shell>);
}
