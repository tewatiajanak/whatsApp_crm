// Page builder: element/block library and layers on the left, the live canvas in the
// middle, content and style on the right. The canvas is the real renderer in "editor" mode.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Undo2, Redo2, Eye, Upload, Search, Trash2, Copy, ChevronUp, ChevronDown, EyeOff, Plus, X, PanelLeft, SlidersHorizontal,
  BookmarkPlus, GripVertical, Database, GitBranch, Wand2, Bold, Italic, Underline, List, ListOrdered, ClipboardPaste, CornerLeftUp, CloudOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askConfirm } from "../utils/dialog";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import { wbApi } from "./api";
import { CATEGORIES, ICONS, ANIMATIONS, listComponents, getComponent, createNode, cloneWithNewIds } from "./registry";
import { CONDITION_OPS, validate } from "./expressions";
import { BLOCKS, BLOCK_CATEGORIES } from "./blocks";
import SiteView, { DeviceSwitch, DeviceFrame, liveChannel } from "./SiteView";

/* ───────────── tree helpers (all return new trees; the stored JSON is never mutated) ───────────── */
function findNode(node, id) { if (node.id === id) return node; for (const c of node.children || []) { const hit = findNode(c, id); if (hit) return hit; } return null; }
function findParent(node, id) { for (const c of node.children || []) { if (c.id === id) return node; const hit = findParent(c, id); if (hit) return hit; } return null; }
const mapNode = (node, id, fn) => (node.id === id ? fn(node) : { ...node, children: (node.children || []).map((c) => mapNode(c, id, fn)) });
const removeNode = (node, id) => ({ ...node, children: (node.children || []).filter((c) => c.id !== id).map((c) => removeNode(c, id)) });
const insertAt = (root, parentId, index, child) => mapNode(root, parentId, (p) => { const kids = (p.children || []).slice(); kids.splice(index < 0 ? kids.length : index, 0, child); return { ...p, children: kids }; });
/** The top-level section that contains the node (or the node itself). */
function topLevelOf(root, id) { let cur = id; for (let p = findParent(root, cur); p && p.id !== root.id; p = findParent(root, cur)) cur = p.id; return cur; }
const ROOT_ONLY = new Set(["Sections", "Navigation"]);
const CLIP_KEY = "wb-clipboard";
const STYLE_CLIP_KEY = "wb-style-clipboard";
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const Label = ({ children }) => <span className="block text-xs font-medium text-muted-foreground mb-1">{children}</span>;
const typing = (e) => { const t = e.target; return t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName); };

/* ───────────── property controls ───────────── */
export function RichField({ value, onChange }) {
  const ref = useRef(null);
  // write the HTML in once; after that the browser owns the editing surface
  useEffect(() => { if (ref.current && ref.current.innerHTML !== sanitizeHtml(value)) ref.current.innerHTML = sanitizeHtml(value); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cmd = (name) => { ref.current.focus(); document.execCommand(name, false, null); onChange(sanitizeHtml(ref.current.innerHTML)); };
  const tools = [["bold", Bold, "Bold"], ["italic", Italic, "Italic"], ["underline", Underline, "Underline"], ["insertUnorderedList", List, "Bullet list"], ["insertOrderedList", ListOrdered, "Numbered list"]];
  return (
    <div className="rounded-md border border-input overflow-hidden">
      <div className="flex gap-0.5 border-b bg-accent/40 p-1">{tools.map(([name, I, title]) => <button key={name} type="button" title={title} aria-label={title} className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-background" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd(name)}><I className="h-4 w-4" /></button>)}</div>
      <div ref={ref} contentEditable suppressContentEditableWarning className="min-h-[120px] max-h-[260px] overflow-y-auto p-2 text-sm outline-none bg-background" onInput={() => onChange(sanitizeHtml(ref.current.innerHTML))} />
    </div>
  );
}

function ItemsField({ control, value, onChange, paths }) {
  const [open, setOpen] = useState(0);
  const items = Array.isArray(value) ? value : [];
  const set = (i, key, v) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= items.length) return; const next = items.slice(); [next[i], next[j]] = [next[j], next[i]]; onChange(next); setOpen(j); };
  const blank = Object.fromEntries(control.fields.map((f) => [f.key, f.type === "toggle" ? false : ""]));
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="rounded-md border">
          <div className="flex items-center gap-1 p-1.5">
            <button type="button" className="flex-1 text-left text-sm truncate px-1" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>{String(it[control.fields[0].key] || `Item ${i + 1}`).slice(0, 40)}</button>
            <button type="button" className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent" title="Move up" aria-label="Move up" onClick={() => move(i, -1)}><ChevronUp className="h-3.5 w-3.5" /></button>
            <button type="button" className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent" title="Move down" aria-label="Move down" onClick={() => move(i, 1)}><ChevronDown className="h-3.5 w-3.5" /></button>
            <button type="button" className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-accent" title="Remove" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          {open === i && <div className="border-t p-2 space-y-2">{control.fields.map((f) => <Field key={f.key} control={f} value={it[f.key]} onChange={(v) => set(i, f.key, v)} paths={paths} />)}</div>}
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={() => { onChange([...items, blank]); setOpen(items.length); }}><Plus className="h-4 w-4" /> Add</Button>
    </div>
  );
}

function Field({ control, value, onChange, paths, dataFields = [] }) {
  const c = control;
  let input;
  // text-like controls can take record fields: picking one adds {{ item.field }}
  const bindable = dataFields.length > 0 && ["text", "textarea", "link", "image", undefined].includes(c.type);
  const problems = bindable ? validate(String(value ?? ""), dataFields.map((f) => f.key).concat("url", "id", "publishedAt", "updatedAt")) : [];
  if (c.type === "textarea") input = <textarea rows={3} className="w-full rounded-md border border-input bg-background p-2 text-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  else if (c.type === "richtext") input = <RichField value={value ?? ""} onChange={onChange} />;
  else if (c.type === "select") input = <select className={selectCls} value={value ?? ""} onChange={(e) => { const raw = e.target.value; const hit = c.options.find(([v]) => String(v) === raw); onChange(hit ? hit[0] : raw); }}>{c.options.map(([v, label]) => <option key={String(v)} value={v}>{label}</option>)}</select>;
  else if (c.type === "toggle") return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {c.label}</label>;
  else if (c.type === "number") input = <Input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
  else if (c.type === "icon") input = <select className={selectCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>{Object.keys(ICONS).map((k) => <option key={k}>{k}</option>)}</select>;
  else if (c.type === "items") input = <ItemsField control={c} value={value} onChange={onChange} paths={paths} />;
  else if (c.type === "link") input = <><Input value={value ?? ""} list="wb-page-paths" onChange={(e) => onChange(e.target.value)} /><datalist id="wb-page-paths">{paths.map((p) => <option key={p} value={p} />)}</datalist></>;
  else if (c.type === "image") input = <><Input value={value ?? ""} inputMode="url" onChange={(e) => onChange(e.target.value)} />{/^https:\/\//.test(value || "") && <img src={value} alt="" className="mt-1 h-16 w-full object-cover rounded border" />}</>;
  else if (c.type === "datetime") input = <Input type={String(value ?? "").includes("{{") ? "text" : "datetime-local"} value={String(value ?? "").includes("{{") ? value : String(value ?? "").slice(0, 16)} onChange={(e) => onChange(e.target.value)} />;
  else input = <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  if (c.type === "items" || c.type === "richtext") return <div><Label>{c.label}</Label>{input}</div>;
  if (bindable) return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1"><span className="text-xs font-medium text-muted-foreground">{c.label}</span>
        <select aria-label={`Insert a data field into ${c.label}`} className="h-6 max-w-[120px] rounded border border-input bg-background text-[11px] px-1" value="" onChange={(e) => { if (e.target.value) onChange(`${c.type === "text" || c.type === "textarea" ? value ?? "" : ""}{{ item.${e.target.value} }}`); }}>
          <option value="">+ Data</option>{dataFields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}<option value="url">Item page link</option>
        </select>
      </div>
      {input}
      {problems.map((m) => <div key={m} className="text-[11px] text-destructive mt-0.5">{m}</div>)}
    </div>);
  return <label className="block"><Label>{c.label}</Label>{input}</label>;
}

/* ───────────── style panel (edits the bucket of the device being viewed) ───────────── */
const COLOR_TOKENS = [["", "Default"], ["token:color.background", "Background"], ["token:color.surface", "Surface"], ["token:color.primary", "Primary"], ["token:color.secondary", "Secondary"], ["token:color.accent", "Accent"], ["token:color.text", "Text"], ["token:color.muted", "Muted"], ["#ffffff", "White"], ["custom", "Custom…"]];
function ColorField({ label, value, onChange }) {
  const known = COLOR_TOKENS.some(([v]) => v === (value || ""));
  return (
    <div><Label>{label}</Label>
      <div className="flex gap-1">
        <select aria-label={label} className={selectCls} value={known ? value || "" : "custom"} onChange={(e) => onChange(e.target.value === "custom" ? "#000000" : e.target.value)}>{COLOR_TOKENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        {!known && <input type="color" aria-label={`${label} custom`} className="h-9 w-10 rounded border bg-background p-0.5 shrink-0" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} />}
      </div>
    </div>
  );
}
function StylePanel({ node, device, onChange, presets = [], onPreset, onSavePreset, onCopyStyle, onPasteStyle }) {
  const style = node.style?.[device] || {};
  const px = (key, label) => (
    <label className="block"><Label>{label}</Label><Input type="number" min={0} max={2000} value={style[key] ? parseInt(style[key], 10) : ""} onChange={(e) => onChange(key, e.target.value === "" ? "" : `${Math.max(0, Number(e.target.value))}px`)} /></label>
  );
  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">Editing: <b className="text-foreground capitalize">{device}</b></div>
      <div><Label>Style preset</Label>
        <div className="flex gap-1">
          <select aria-label="Style preset" className={selectCls} value={(node.presetIds || [])[0] || ""} onChange={(e) => onPreset(e.target.value)}><option value="">None</option>{presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <Button size="icon" variant="outline" className="shrink-0" title="Save this style as a preset" aria-label="Save this style as a preset" onClick={onSavePreset}><BookmarkPlus className="h-4 w-4" /></Button>
        </div>
      </div>
      <div><div className="text-xs font-semibold mb-2">Padding</div><div className="grid grid-cols-2 gap-2">{px("paddingTop", "Top")}{px("paddingBottom", "Bottom")}{px("paddingLeft", "Left")}{px("paddingRight", "Right")}</div></div>
      <div><div className="text-xs font-semibold mb-2">Margin</div><div className="grid grid-cols-2 gap-2">{px("marginTop", "Top")}{px("marginBottom", "Bottom")}</div></div>
      <ColorField label="Background" value={style.backgroundColor} onChange={(v) => onChange("backgroundColor", v)} />
      <label className="block"><Label>Background image URL</Label><Input value={style.backgroundImage || ""} inputMode="url" onChange={(e) => onChange("backgroundImage", e.target.value)} /></label>
      <ColorField label="Text colour" value={style.color} onChange={(v) => onChange("color", v)} />
      <div><Label>Align</Label><select aria-label="Align" className={selectCls} value={style.textAlign || ""} onChange={(e) => onChange("textAlign", e.target.value)}><option value="">Default</option><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></div>
      <div className="grid grid-cols-2 gap-2">{px("fontSize", "Text size")}{px("borderRadius", "Corners")}{px("maxWidth", "Max width")}{px("minHeight", "Min height")}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!style.hidden} onChange={(e) => onChange("hidden", e.target.checked)} /> Hide on {device}</label>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" title="Ctrl+Alt+C" onClick={onCopyStyle}><Copy className="h-4 w-4" /> Copy style</Button>
        <Button size="sm" variant="outline" title="Ctrl+Alt+V" onClick={onPasteStyle}><ClipboardPaste className="h-4 w-4" /> Paste style</Button>
      </div>
      <Button size="sm" variant="outline" className="w-full" onClick={() => onChange(null)}>Reset {device} style</Button>
    </div>
  );
}

/* ───────────── layers ───────────── */
function Layers({ root, selectedId, onSelect, onMove, onDragNode }) {
  const drag = useRef(null);
  const row = (node, depth) => {
    const def = getComponent(node.type);
    const hidden = Object.values(node.style || {}).some((s) => s?.hidden);
    return (
      <div key={node.id}>
        <div
          draggable role="button" tabIndex={0}
          onClick={(e) => onSelect(node.id, e.shiftKey || e.metaKey || e.ctrlKey)} onKeyDown={(e) => e.key === "Enter" && onSelect(node.id)}
          onDragStart={(e) => { drag.current = node.id; onDragNode?.(node.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", node.id); }}
          onDragEnd={() => onDragNode?.(null)}
          onDragOver={(e) => { if (drag.current && drag.current !== node.id) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); const id = drag.current; drag.current = null; const box = e.currentTarget.getBoundingClientRect(); if (id) onMove(id, node.id, !!def?.isContainer && e.clientY - box.top > box.height / 3); }}
          className={`flex items-center gap-1 rounded px-1.5 py-1 text-sm cursor-pointer ${selectedId === node.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          style={{ paddingLeft: 6 + depth * 14 }}
        >
          <GripVertical className="h-3.5 w-3.5 opacity-50 shrink-0" />
          <span className="truncate flex-1">{node.label || def?.label || node.type}</span>
          {node.repeat?.source && <Database className="h-3.5 w-3.5 opacity-70 shrink-0" aria-label="Repeats over data" />}
          {node.conditions?.rules?.length > 0 && <GitBranch className="h-3.5 w-3.5 opacity-70 shrink-0" aria-label="Has conditions" />}
          {hidden && <EyeOff className="h-3.5 w-3.5 opacity-70 shrink-0" />}
        </div>
        {(node.children || []).map((c) => row(c, depth + 1))}
      </div>
    );
  };
  return root.children.length ? <div className="space-y-0.5">{root.children.map((c) => row(c, 0))}</div> : <p className="text-sm text-muted-foreground p-2">No elements</p>;
}

/* ───────────── builder ───────────── */
export default function BuilderPage() {
  const { siteId, pageId } = useParams();
  const [site, setSite] = useState(null);
  const [page, setPage] = useState(null);
  const [menus, setMenus] = useState({});
  const [paths, setPaths] = useState([]);
  const [saved, setSaved] = useState([]);
  const [error, setError] = useState(null);
  const [content, setContent] = useState(null);
  const [hist, setHist] = useState({ past: [], future: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [device, setDevice] = useState("desktop");
  const [leftTab, setLeftTab] = useState("elements");
  const [rightTab, setRightTab] = useState("content");
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState("saved");
  const [panel, setPanel] = useState(null); // which drawer is open on small screens
  const [extraIds, setExtraIds] = useState([]); // more selected elements (Shift/Ctrl-click)
  const [sources, setSources] = useState([]);   // data sources with their fields
  const [bundle, setBundle] = useState({});     // sample record + item page addresses for this page
  const [repeatData, setRepeatData] = useState({});
  const [dropHint, setDropHint] = useState(null); // { id, after } while dragging over the canvas
  const dragItem = useRef(null);                  // { node } for new elements, { moveId } for existing ones
  const channel = useRef(null);
  const version = useRef(1);
  const latest = useRef(null);
  const timer = useRef(null);
  const saving = useRef(Promise.resolve());

  useEffect(() => {
    let live = true;
    Promise.all([wbApi.site(siteId), wbApi.page(siteId, pageId), wbApi.pages(siteId), wbApi.menus(siteId), wbApi.blocks(siteId)])
      .then(([s, p, all, m, b]) => {
        if (!live) return;
        const pathById = new Map(all.map((x) => [x._id, x.path]));
        // the canvas shows menus the same way the public site resolves them
        const resolve = (items) => (items || []).flatMap((it) => ((it.type === "page" && !pathById.has(it.pageId)) || it.type === "auto" ? [] : [{ ...it, href: it.type === "page" ? pathById.get(it.pageId) : it.url, children: resolve(it.children) }]));
        setSite(s); setPage(p); setPaths(all.map((x) => x.path)); setSaved(b);
        setMenus(Object.fromEntries(m.map((x) => [x.location, resolve(x.items)])));
        const draft = p.draft?.root ? p.draft : { schemaVersion: 2, settings: {}, root: { id: "root", type: "Page", props: {}, children: [] } };
        setContent(draft); latest.current = draft; version.current = p.version;
        wbApi.sources(siteId).then((x) => live && setSources(x)).catch(() => {});
        wbApi.preview(siteId, p.path).then((x) => live && setBundle({ item: x.item, itemPaths: x.itemPaths, page: x.page })).catch(() => {});
      })
      .catch((e) => live && setError(e));
    return () => { live = false; };
  }, [siteId, pageId]);

  /* ---- saving: debounced, one request at a time, refused if the page changed elsewhere ---- */
  const flush = useCallback(() => {
    clearTimeout(timer.current); timer.current = null;
    const run = saving.current.catch(() => {}).then(async () => {
      const snapshot = latest.current;
      setSaveState("saving");
      try {
        const res = await wbApi.saveDraft(siteId, pageId, snapshot, version.current);
        version.current = res.version;
        setSaveState(latest.current === snapshot ? "saved" : "unsaved");
      } catch (e) {
        setSaveState(e.status === 409 ? "conflict" : "error");
        toast.error(e.message);
        e.saveFailed = true;
        throw e;
      }
    });
    saving.current = run;
    return run;
  }, [siteId, pageId]);
  const queueSave = useCallback(() => { setSaveState("unsaved"); clearTimeout(timer.current); timer.current = setTimeout(() => flush().catch(() => {}), 1200); }, [flush]);
  useEffect(() => () => { if (timer.current) flush().catch(() => {}); }, [flush]);
  useEffect(() => {
    const warn = (e) => { if (timer.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  /** Every edit goes through here, so every edit can be undone. */
  const history = useRef({ past: [], future: [] });
  const syncHist = () => setHist({ past: history.current.past, future: history.current.future });
  const show = useCallback((next) => { latest.current = next; setContent(next); queueSave(); }, [queueSave]);
  // an open preview window follows unsaved edits
  useEffect(() => { channel.current = liveChannel(siteId); return () => channel.current?.close(); }, [siteId]);
  useEffect(() => { if (content && page) channel.current?.postMessage({ type: "page", path: page.path, content }); }, [content, page]);
  const commit = useCallback((next) => {
    const prev = latest.current;
    if (next === prev) return;
    history.current = { past: [...history.current.past.slice(-99), prev], future: [] };
    syncHist(); show(next);
  }, [show]);
  const edit = useCallback((fn) => commit({ ...latest.current, root: fn(latest.current.root) }), [commit]);
  const undo = useCallback(() => {
    const h = history.current;
    if (!h.past.length) return;
    history.current = { past: h.past.slice(0, -1), future: [latest.current, ...h.future] };
    syncHist(); show(h.past[h.past.length - 1]);
  }, [show]);
  const redo = useCallback(() => {
    const h = history.current;
    if (!h.future.length) return;
    history.current = { past: [...h.past, latest.current], future: h.future.slice(1) };
    syncHist(); show(h.future[0]);
  }, [show]);

  const root = content?.root;
  const select = useCallback((id, add = false) => {
    if (!id) { setSelectedId(null); setExtraIds([]); return; }
    if (!add || !selectedId) { setSelectedId(id); setExtraIds([]); return; }
    if (id === selectedId) return;
    setExtraIds((x) => (x.includes(id) ? x.filter((v) => v !== id) : [...x, id]));
  }, [selectedId]);
  const allIds = selectedId ? [selectedId, ...extraIds] : [];
  // data for every element that repeats over a source, refetched when its settings change
  const repeatSig = useMemo(() => { const out = []; (function walk(nd) { if (!nd) return; if (nd.repeat?.source) out.push([nd.id, nd.repeat.source, nd.repeat.limit || 12, nd.repeat.sort || ""]); (nd.children || []).forEach(walk); })(root); return JSON.stringify(out); }, [root]);
  useEffect(() => {
    let live = true;
    const list = JSON.parse(repeatSig);
    Promise.all(list.map(([id, source, limit, sort]) => wbApi.resolve(siteId, source, { limit, sort }).then((res) => [id, res]).catch(() => [id, { items: [], total: 0, page: 1, totalPages: 1 }]))).then((rows) => live && setRepeatData(Object.fromEntries(rows)));
    return () => { live = false; };
  }, [repeatSig, siteId]);
  const selected = root && selectedId ? findNode(root, selectedId) : null;
  const selectedDef = selected ? getComponent(selected.type) : null;

  /* ---- actions ---- */
  const insert = useCallback((node) => {
    const r = latest.current.root;
    const def = getComponent(node.type);
    const sel = selectedId && findNode(r, selectedId) ? selectedId : null;
    let parentId = r.id, index = -1;
    if (sel && ROOT_ONLY.has(def?.category)) { const top = topLevelOf(r, sel); index = r.children.findIndex((c) => c.id === top) + 1; }
    else if (sel) {
      const selNode = findNode(r, sel);
      if (getComponent(selNode.type)?.isContainer) parentId = sel;
      else { const parent = findParent(r, sel); parentId = parent.id; index = parent.children.findIndex((c) => c.id === sel) + 1; }
    } else if (ROOT_ONLY.has(def?.category) || def?.isContainer) {
      // keep a footer at the bottom
      const footer = r.children.findIndex((c) => c.type === "Footer");
      index = footer;
    } else {
      // loose elements need a section to live in
      node = createNode("Section", {}, [node]);
      index = r.children.findIndex((c) => c.type === "Footer");
    }
    edit((rt) => insertAt(rt, parentId, index, node));
    setSelectedId(node.id); setPanel(null);
  }, [selectedId, edit]);

  const removeSel = useCallback(() => { if (!selectedId) return; edit((r) => [selectedId, ...extraIds].reduce((acc, id) => removeNode(acc, id), r)); setSelectedId(null); setExtraIds([]); }, [selectedId, extraIds, edit]);
  const duplicateSel = useCallback(() => {
    if (!selectedId) return;
    const r = latest.current.root; const parent = findParent(r, selectedId); if (!parent) return;
    const copy = cloneWithNewIds(findNode(r, selectedId));
    edit((rt) => insertAt(rt, parent.id, parent.children.findIndex((c) => c.id === selectedId) + 1, copy));
    setSelectedId(copy.id);
  }, [selectedId, edit]);
  const moveSel = useCallback((dir) => {
    if (!selectedId) return;
    const parent = findParent(latest.current.root, selectedId); if (!parent) return;
    const i = parent.children.findIndex((c) => c.id === selectedId); const j = i + dir;
    if (j < 0 || j >= parent.children.length) return;
    edit((r) => mapNode(r, parent.id, (p) => { const kids = p.children.slice(); [kids[i], kids[j]] = [kids[j], kids[i]]; return { ...p, children: kids }; }));
  }, [selectedId, edit]);
  const moveTo = useCallback((id, targetId, inside) => {
    const r = latest.current.root; const node = findNode(r, id);
    if (!node || findNode(node, targetId)) return; // never into itself
    const without = removeNode(r, id);
    if (inside) commit({ ...latest.current, root: insertAt(without, targetId, -1, node) });
    else { const parent = findParent(without, targetId); if (!parent) return; commit({ ...latest.current, root: insertAt(without, parent.id, parent.children.findIndex((c) => c.id === targetId), node) }); }
  }, [commit]);
  const copySel = useCallback(() => { if (!selected) return; try { localStorage.setItem(CLIP_KEY, JSON.stringify(selected)); toast.success("Copied"); } catch { toast.error("Could not copy"); } }, [selected]);
  const paste = useCallback(() => {
    try {
      const node = JSON.parse(localStorage.getItem(CLIP_KEY) || "null");
      if (!node?.type || !getComponent(node.type)) return toast.error("Nothing to paste");
      insert(cloneWithNewIds(node));
    } catch { toast.error("Nothing to paste"); }
  }, [insert]);
  const setProp = (key, value) => edit((r) => mapNode(r, selectedId, (nd) => ({ ...nd, props: { ...nd.props, [key]: value } })));
  const setStyle = (key, value) => edit((r) => allIds.reduce((acc, id) => mapNode(acc, id, (nd) => {
    const bucket = { ...(nd.style?.[device] || {}) };
    if (key === null) return { ...nd, style: { ...nd.style, [device]: {} } };
    if (value === "" || value === false) delete bucket[key]; else bucket[key] = value;
    return { ...nd, style: { ...nd.style, [device]: bucket } };
  }), r));
  /** Copy the look of the selected element (all devices + preset); paste it onto every selected element. */
  const copyStyle = () => { if (!selected) return; try { localStorage.setItem(STYLE_CLIP_KEY, JSON.stringify({ style: selected.style || {}, presetIds: selected.presetIds || [] })); toast.success("Style copied"); } catch { toast.error("Could not copy"); } };
  const pasteStyle = () => {
    let clip = null;
    try { clip = JSON.parse(localStorage.getItem(STYLE_CLIP_KEY) || "null"); } catch { /* nothing usable */ }
    if (!clip || typeof clip.style !== "object" || !allIds.length) return toast.error("No style to paste");
    // preset ids from another website mean nothing here
    const known = new Set(presets.map((p) => p.id));
    edit((r) => allIds.reduce((acc, id) => mapNode(acc, id, (nd) => ({ ...nd, style: structuredClone(clip.style), presetIds: (clip.presetIds || []).filter((x) => known.has(x)) })), r));
  };
  /** Set (or clear, with null/undefined) a node-level field such as repeat, conditions, interactions. */
  const setNodeField = (key, value) => edit((r) => mapNode(r, selectedId, (nd) => { const next = { ...nd }; if (value == null) delete next[key]; else next[key] = value; return next; }));
  const presets = site?.themeDraft?.stylePresets || [];
  const applyPreset = (id) => edit((r) => allIds.reduce((acc, nid) => mapNode(acc, nid, (nd) => ({ ...nd, presetIds: id ? [id] : [] })), r));
  async function savePreset() {
    if (!selected) return;
    const preset = { id: `sp_${Math.random().toString(36).slice(2, 8)}`, name: `${selectedDef.label} style ${presets.length + 1}`, style: selected.style || {} };
    const theme = { ...site.themeDraft, stylePresets: [...presets, preset] };
    try { await wbApi.saveTheme(siteId, theme); setSite({ ...site, themeDraft: theme }); edit((r) => mapNode(r, selectedId, (nd) => ({ ...nd, presetIds: [preset.id], style: { desktop: {}, tablet: {}, mobile: {} } }))); toast.success("Style preset saved"); } catch (e) { toast.error(e.message); }
  }
  // record fields the selected element can show: from the list it sits in, else from this item page's collection
  const dataFields = useMemo(() => {
    if (!root || !selectedId) return [];
    let source = "";
    for (let cur = selectedId; cur && !source; ) { const nd = findNode(root, cur); if (nd?.repeat?.source && cur !== selectedId) source = nd.repeat.source; cur = findParent(root, cur)?.id; }
    if (!source && page?.pageType === "collectionItem") source = `collection:${page.collectionKey}`;
    return sources.find((x) => x.ref === source)?.fields || [];
  }, [root, selectedId, sources, page]);
  /** Fill an empty data list with a card built from the source's own fields. */
  function fillCards() {
    const src = sources.find((x) => x.ref === selected.repeat?.source);
    if (!src) return;
    const pick = (...types) => src.fields.find((f) => types.includes(f.type) && f.key !== "slug")?.key;
    const title = pick("text"), text = pick("textarea"), image = pick("image");
    const card = createNode("ImageCard", { title: title ? `{{ item.${title} }}` : "", text: text ? `{{ item.${text} | truncate:110 }}` : "", image: image ? `{{ item.${image} }}` : "", eyebrow: "", href: "{{ item.url }}", linkLabel: "Open" });
    edit((r) => mapNode(r, selectedId, (nd) => ({ ...nd, children: [...(nd.children || []), card] })));
  }

  /* ---- drag and drop onto the canvas ---- */
  const overCanvas = (e) => {
    if (!dragItem.current) return;
    const el = e.target.closest?.("[data-wb]");
    const id = el?.getAttribute("data-wb");
    if (!id || id === root.id) { e.preventDefault(); setDropHint(root.children.length ? null : { id: root.id, after: true }); return; }
    e.preventDefault();
    const box = el.getBoundingClientRect();
    const after = e.clientY > box.top + box.height / 2;
    setDropHint((h) => (h && h.id === id && h.after === after ? h : { id, after }));
  };
  const dropOnCanvas = (e) => {
    const item = dragItem.current, hint = dropHint;
    dragItem.current = null; setDropHint(null);
    if (!item) return;
    e.preventDefault();
    const r = latest.current.root;
    let node = item.node ? item.node() : findNode(r, item.moveId);
    if (!node) return;
    const def = getComponent(node.type);
    let base = item.moveId ? removeNode(r, item.moveId) : r;
    let targetId = hint?.id && hint.id !== r.id && findNode(base, hint.id) ? hint.id : null;
    if (item.moveId && targetId && findNode(node, targetId)) return; // never into itself
    // whole sections and loose elements dropped at page level sit between top-level sections
    if (targetId && ROOT_ONLY.has(def?.category)) targetId = topLevelOf(base, targetId);
    let parentId = base.id, index = -1;
    if (targetId) { const parent = findParent(base, targetId); parentId = parent.id; index = parent.children.findIndex((c) => c.id === targetId) + (hint.after ? 1 : 0); }
    if (parentId === base.id && !ROOT_ONLY.has(def?.category) && !def?.isContainer) node = createNode("Section", {}, [node]);
    commit({ ...latest.current, root: insertAt(base, parentId, index, node) });
    select(item.moveId || node.id);
  };
  const onInlineEdit = useCallback((id, prop, text) => edit((r) => mapNode(r, id, (nd) => ((nd.props?.[prop] ?? getComponent(nd.type)?.defaultProps?.[prop]) === text ? nd : { ...nd, props: { ...nd.props, [prop]: text } }))), [edit]);

  async function saveAsBlock() {
    if (!selected) return;
    try { const b = await wbApi.saveBlock(siteId, { name: `${selectedDef.label} ${saved.length + 1}`, category: "Saved", content: selected }); setSaved([b, ...saved]); setLeftTab("blocks"); toast.success("Saved to blocks"); } catch (e) { toast.error(e.message); }
  }
  async function removeBlock(b) {
    if (!(await askConfirm(`Delete saved block "${b.name}"?`))) return;
    try { await wbApi.removeBlock(siteId, b._id); setSaved(saved.filter((x) => x._id !== b._id)); } catch (e) { toast.error(e.message); }
  }
  async function publish() {
    try { await flush(); const p = await wbApi.publishPage(siteId, pageId); setPage({ ...page, status: p.status }); toast.success("Page published"); } catch (e) { if (!e.saveFailed) toast.error(e.message); }
  }

  /* ---- keyboard ---- */
  const copyStyleRef = useRef(() => {}), pasteStyleRef = useRef(() => {});
  copyStyleRef.current = copyStyle; pasteStyleRef.current = pasteStyle;
  useEffect(() => {
    const onKey = (e) => {
      if (typing(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.altKey && e.code === "KeyC") { e.preventDefault(); copyStyleRef.current(); }
      else if (mod && e.altKey && e.code === "KeyV") { e.preventDefault(); pasteStyleRef.current(); }
      else if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSel(); }
      else if (mod && e.key.toLowerCase() === "c") copySel();
      else if (mod && e.key.toLowerCase() === "v") paste();
      else if (e.key === "Delete" || e.key === "Backspace") { if (selectedId) { e.preventDefault(); removeSel(); } }
      else if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, duplicateSel, copySel, paste, removeSel, selectedId, select]);

  const components = useMemo(() => listComponents(), []);
  const q = query.trim().toLowerCase();
  const matches = (label, extra = []) => !q || [label, ...extra].some((s) => String(s).toLowerCase().includes(q));

  if (error) return <div className="fixed inset-0 z-[60] bg-background flex items-center justify-center p-6 text-center"><div className="space-y-3"><p className="text-sm text-destructive">{error.message}</p><Button asChild variant="outline"><Link to={`/modules/website/s/${siteId}/pages`} className="no-underline">Back to pages</Link></Button></div></div>;
  if (!content || !site) return <div className="fixed inset-0 z-[60] bg-background flex items-center justify-center text-sm text-muted-foreground" aria-busy="true">Loading…</div>;

  const selCss = allIds.map((id) => `.wb-root [data-wb="${id}"]{outline:2px solid #2563eb;outline-offset:-2px}`).join("");
  const dropCss = dropHint && dropHint.id !== root.id ? `.wb-root [data-wb="${dropHint.id}"]{box-shadow:${dropHint.after ? "0 4px 0 #2563eb" : "0 -4px 0 #2563eb"}}` : "";
  const editCss = `.wb-root [data-wb]{cursor:pointer}.wb-root [data-wb-cond=off]{opacity:.35}${selCss}${dropCss}`;
  const saveLabel = { saved: "Saved", saving: "Saving…", unsaved: "Unsaved", error: "Not saved", conflict: "Changed elsewhere" }[saveState];
  const parentOfSel = selected ? findParent(root, selectedId) : null;
  const tabBtn = (cur, set, key, label) => <button type="button" key={key} onClick={() => set(key)} aria-pressed={cur === key} className={`flex-1 py-2 text-xs font-semibold border-b-2 ${cur === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>;
  const tile = (key, label, onClick, extra, make) => <button key={key} type="button" onClick={onClick} draggable={!!make} onDragStart={(e) => { dragItem.current = { node: make }; e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", label); }} onDragEnd={() => { dragItem.current = null; setDropHint(null); }} className="rounded-md border bg-card px-2 py-2 text-left text-xs font-medium hover:border-primary hover:bg-accent/40 flex items-center gap-1"><span className="truncate flex-1">{label}</span>{extra}</button>;

  const leftPanel = (
    <div className="flex h-full flex-col">
      <div className="flex border-b shrink-0">{[["elements", "Elements"], ["blocks", "Blocks"], ["layers", "Layers"]].map(([k, l]) => tabBtn(leftTab, setLeftTab, k, l))}</div>
      {leftTab !== "layers" && <div className="p-2 border-b shrink-0 relative"><Search className="h-4 w-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search" placeholder="Search" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} /></div>}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {leftTab === "elements" && CATEGORIES.map((cat) => {
          const list = components.filter((c) => c.category === cat && matches(c.label, c.keywords));
          return list.length ? <div key={cat}><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{cat}</div><div className="grid grid-cols-2 gap-1.5">{list.map((c) => tile(c.type, c.label, () => insert(createNode(c.type)), null, () => createNode(c.type)))}</div></div> : null;
        })}
        {leftTab === "blocks" && <>
          {saved.filter((b) => matches(b.name)).length > 0 && <div><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Saved</div><div className="grid grid-cols-1 gap-1.5">{saved.filter((b) => matches(b.name)).map((b) => tile(b._id, b.name, () => insert(cloneWithNewIds(b.content)), <span role="button" tabIndex={0} title="Delete" aria-label={`Delete ${b.name}`} className="p-0.5 rounded hover:bg-accent" onClick={(e) => { e.stopPropagation(); removeBlock(b); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeBlock(b); } }}><Trash2 className="h-3.5 w-3.5" /></span>))}</div></div>}
          {BLOCK_CATEGORIES.map((cat) => {
            const list = BLOCKS.filter((b) => b.category === cat && matches(b.name, [cat]));
            return list.length ? <div key={cat}><div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{cat}</div><div className="grid grid-cols-1 gap-1.5">{list.map((b) => tile(b.key, b.name, () => insert(b.build()), null, () => b.build()))}</div></div> : null;
          })}
        </>}
        {leftTab === "layers" && <Layers root={root} selectedId={selectedId} onSelect={select} onMove={moveTo} onDragNode={(id) => { dragItem.current = id ? { moveId: id } : null; if (!id) setDropHint(null); }} />}
      </div>
    </div>
  );

  const rightPanel = !selected ? <p className="p-4 text-sm text-muted-foreground">Select an element</p> : (
    <div className="flex h-full flex-col">
      <div className="p-2 border-b shrink-0 space-y-2">
        <div className="flex items-center gap-1">
          <span className="text-sm font-semibold truncate flex-1">{selectedDef?.label || selected.type}</span>
          {parentOfSel && parentOfSel.id !== root.id && <Button size="icon" variant="ghost" className="h-7 w-7" title="Select parent" aria-label="Select parent" onClick={() => setSelectedId(parentOfSel.id)}><CornerLeftUp className="h-4 w-4" /></Button>}
        </div>
        <div className="flex gap-1">
          {[[ChevronUp, "Move up", () => moveSel(-1)], [ChevronDown, "Move down", () => moveSel(1)], [Copy, "Duplicate", duplicateSel], [BookmarkPlus, "Save as block", saveAsBlock], [Trash2, "Delete", removeSel]].map(([I, title, fn]) => <Button key={title} size="icon" variant="outline" className="h-8 flex-1" title={title} aria-label={title} onClick={fn}><I className="h-4 w-4" /></Button>)}
        </div>
      </div>
      {extraIds.length > 0 && <div className="px-3 py-1.5 text-xs bg-accent/60 border-b">{allIds.length} selected — style, preset and delete apply to all</div>}
      <div className="flex border-b shrink-0">{[["content", "Content"], ["style", "Style"], ["data", "Data"], ["motion", "Motion"]].map(([k, l]) => tabBtn(rightTab, setRightTab, k, l))}</div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3" key={selectedId}>
        {rightTab === "content" && ((selectedDef?.controls || []).length ? selectedDef.controls.map((c) => <Field key={c.key} control={c} value={selected.props?.[c.key] ?? selectedDef.defaultProps?.[c.key]} onChange={(v) => setProp(c.key, v)} paths={paths} dataFields={dataFields} />) : <p className="text-sm text-muted-foreground">No content settings</p>)}
        {rightTab === "style" && <StylePanel node={selected} device={device} onChange={setStyle} presets={presets} onPreset={applyPreset} onSavePreset={savePreset} onCopyStyle={copyStyle} onPasteStyle={pasteStyle} />}
        {rightTab === "data" && (() => {
          const rep = selected.repeat || {};
          const src = sources.find((x) => x.ref === rep.source);
          const cond = selected.conditions || { match: "all", rules: [] };
          const setRep = (patch) => setNodeField("repeat", { limit: 9, sort: "", paginate: false, ...rep, ...patch });
          const setCond = (next) => setNodeField("conditions", next.rules.length ? next : null);
          return <>
            {selectedDef?.repeatable ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold">Repeat for each record</div>
                <div><Label>Source</Label><select aria-label="Source" className={selectCls} value={rep.source || ""} onChange={(e) => (e.target.value ? setRep({ source: e.target.value }) : setNodeField("repeat", null))}><option value="">None</option>{sources.map((x) => <option key={x.ref} value={x.ref}>{x.name}{x.kind === "api" ? " (API)" : ""}</option>)}</select></div>
                {sources.length === 0 && <p className="text-xs text-muted-foreground">No data yet — add a collection in Content or install an app.</p>}
                {rep.source && <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block"><Label>Records</Label><Input type="number" min={1} max={100} value={rep.limit || 9} onChange={(e) => setRep({ limit: Math.max(1, Math.min(100, Number(e.target.value) || 9)) })} /></label>
                    <div><Label>Sort</Label><select aria-label="Sort" className={selectCls} value={rep.sort || ""} onChange={(e) => setRep({ sort: e.target.value })}><option value="">Newest first</option>{(src?.fields || []).flatMap((f) => [<option key={f.key} value={f.key}>{f.label} ↑</option>, <option key={`-${f.key}`} value={`-${f.key}`}>{f.label} ↓</option>])}</select></div>
                  </div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!rep.paginate} onChange={(e) => setRep({ paginate: e.target.checked })} /> Pages and search follow the address</label>
                  {(selected.children || []).length === 0 && <Button size="sm" variant="outline" className="w-full" onClick={fillCards}><Wand2 className="h-4 w-4" /> Fill with cards</Button>}
                  <p className="text-xs text-muted-foreground">{repeatData[selectedId]?.total ?? 0} records</p>
                </>}
              </div>
            ) : dataFields.length > 0 ? <p className="text-xs text-muted-foreground">This element can show record fields: use “+ Data” next to a field in Content.</p> : <p className="text-xs text-muted-foreground">To list records, add a “Data list” element.</p>}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold">Show only when</span>{cond.rules.length > 1 && <select aria-label="Match" className="h-7 rounded border border-input bg-background text-xs px-1" value={cond.match} onChange={(e) => setCond({ ...cond, match: e.target.value })}><option value="all">all match</option><option value="any">any matches</option></select>}</div>
              {cond.rules.map((rule, i) => { const setRule = (patch) => setCond({ ...cond, rules: cond.rules.map((x, j) => (j === i ? { ...x, ...patch } : x)) }); return (
                <div key={i} className="rounded-md border p-2 space-y-1.5">
                  <div className="flex gap-1"><Input aria-label="Value to test" className="font-mono text-xs" value={rule.left} onChange={(e) => setRule({ left: e.target.value })} /><Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" aria-label="Remove rule" onClick={() => setCond({ ...cond, rules: cond.rules.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button></div>
                  <select aria-label="Test" className={selectCls} value={rule.op} onChange={(e) => setRule({ op: e.target.value })}>{CONDITION_OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  {!["empty", "notEmpty"].includes(rule.op) && <Input aria-label="Compare with" value={rule.right} onChange={(e) => setRule({ right: e.target.value })} />}
                </div>); })}
              <Button size="sm" variant="outline" className="w-full" onClick={() => setCond({ ...cond, rules: [...cond.rules, { left: dataFields[0] ? `{{ item.${dataFields[0].key} }}` : "{{ query.q }}", op: "notEmpty", right: "" }] })}><Plus className="h-4 w-4" /> Add rule</Button>
            </div>
          </>;
        })()}
        {rightTab === "motion" && (() => {
          const anim = (selected.interactions || []).find((i) => i.action === "animate");
          const setAnim = (patch) => setNodeField("interactions", patch ? [{ trigger: "inView", action: "animate", animation: "fade-up", duration: 600, delay: 0, ...anim, ...patch }] : null);
          return <div className="space-y-3">
            <div><Label>Entrance animation</Label><select aria-label="Entrance animation" className={selectCls} value={anim?.animation || ""} onChange={(e) => setAnim(e.target.value ? { animation: e.target.value } : null)}><option value="">None</option>{ANIMATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            {anim && <div className="grid grid-cols-2 gap-2">
              <label className="block"><Label>Duration (ms)</Label><Input type="number" min={100} max={3000} step={50} value={anim.duration ?? 600} onChange={(e) => setAnim({ duration: Number(e.target.value) || 600 })} /></label>
              <label className="block"><Label>Delay (ms)</Label><Input type="number" min={0} max={3000} step={50} value={anim.delay ?? 0} onChange={(e) => setAnim({ delay: Number(e.target.value) || 0 })} /></label>
            </div>}
            {anim && <p className="text-xs text-muted-foreground">Plays in Preview and on the live site.</p>}
          </div>;
        })()}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background text-foreground">
      <div className="flex items-center gap-2 border-b bg-card px-2 h-12 shrink-0">
        <Button asChild size="icon" variant="ghost" title="Back to pages" aria-label="Back to pages"><Link to={`/modules/website/s/${siteId}/pages`} onClick={() => timer.current && flush().catch(() => {})}><ArrowLeft className="h-4 w-4" /></Link></Button>
        <Button size="icon" variant="ghost" className="lg:hidden" title="Library" aria-label="Library" onClick={() => setPanel(panel === "left" ? null : "left")}><PanelLeft className="h-4 w-4" /></Button>
        <div className="min-w-0 hidden sm:block"><div className="text-sm font-semibold truncate leading-tight">{page.title}</div><div className="text-[11px] text-muted-foreground truncate leading-tight">{site.name} · {page.path}</div></div>
        <div className="mx-auto"><DeviceSwitch value={device} onChange={setDevice} /></div>
        <span className={`text-xs hidden md:inline-flex items-center gap-1 ${saveState === "error" || saveState === "conflict" ? "text-destructive" : "text-muted-foreground"}`}>{(saveState === "error" || saveState === "conflict") && <CloudOff className="h-3.5 w-3.5" />}{saveLabel}</span>
        {saveState === "conflict" && <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload</Button>}
        <Button size="icon" variant="ghost" title="Undo" aria-label="Undo" disabled={!hist.past.length} onClick={undo}><Undo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" title="Redo" aria-label="Redo" disabled={!hist.future.length} onClick={redo}><Redo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="hidden sm:inline-flex" title="Paste" aria-label="Paste" onClick={paste}><ClipboardPaste className="h-4 w-4" /></Button>
        <Button asChild size="icon" variant="ghost" title="Preview" aria-label="Preview"><Link to={`/modules/website/s/${siteId}/preview?path=${encodeURIComponent(page.path)}`} onClick={() => timer.current && flush().catch(() => {})}><Eye className="h-4 w-4" /></Link></Button>
        <Button size="icon" variant="ghost" className="lg:hidden" title="Properties" aria-label="Properties" onClick={() => setPanel(panel === "right" ? null : "right")}><SlidersHorizontal className="h-4 w-4" /></Button>
        <Button size="sm" onClick={publish}><Upload className="h-4 w-4" /><span className="hidden sm:inline">Publish</span></Button>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        <aside className={`${panel === "left" ? "absolute inset-y-0 left-0 z-20 flex w-[86vw] max-w-[300px] shadow-xl" : "hidden"} lg:static lg:flex lg:w-[270px] lg:shadow-none flex-col border-r bg-card shrink-0`} aria-label="Library">{leftPanel}</aside>

        <main className="flex-1 min-w-0 overflow-auto p-2 md:p-4" onClick={(e) => { if (e.target === e.currentTarget) select(null); }}>
          <DeviceFrame device={device}>
            <div onDragOver={overCanvas} onDrop={dropOnCanvas} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDropHint(null); }}
              onClick={(e) => { const el = e.target.closest("[data-wb]"); const id = el?.getAttribute("data-wb"); select(id && id !== root.id ? id : null, e.shiftKey || e.metaKey || e.ctrlKey); if (id && id !== root.id && window.innerWidth < 1024) setPanel(null); }}>
              <SiteView theme={site.themeDraft} content={content} site={{ name: site.name, siteKey: site.siteKey, logoText: site.settings?.logoText || site.name, logoUrl: site.settings?.logoUrl }} menus={menus} mode="editor" path={page.path} onInlineEdit={onInlineEdit} extraCss={editCss} bundle={{ ...bundle, data: repeatData, query: { page: 1, q: "" } }} />
            </div>
          </DeviceFrame>
        </main>

        <aside className={`${panel === "right" ? "absolute inset-y-0 right-0 z-20 flex w-[86vw] max-w-[320px] shadow-xl" : "hidden"} lg:static lg:flex lg:w-[300px] lg:shadow-none flex-col border-l bg-card shrink-0`} aria-label="Properties">{rightPanel}</aside>
        {panel && <button type="button" aria-label="Close panel" className="lg:hidden absolute inset-0 z-10 bg-black/30" onClick={() => setPanel(null)}><X className="sr-only" /></button>}
      </div>
    </div>
  );
}
