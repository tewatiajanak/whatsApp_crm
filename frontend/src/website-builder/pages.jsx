// Website Builder admin screens: Websites, Pages, Designer, Menus, Settings.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Plus, Globe2, ExternalLink, Trash2, Pencil, Eye, Copy, Home, Settings2, Upload, Undo2, Redo2, AlertTriangle, ChevronUp, ChevronDown,
  IndentIncrease, IndentDecrease, ListTree, Check, LayoutTemplate, FileText, Palette, CloudOff, Search, Download, Database, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { askConfirm } from "../utils/dialog";
import { wbApi } from "./api";
import { THEME_PRESETS, FONTS, mergeTheme, contrastWarnings, isHex } from "./theme";
import { createNode, uid } from "./registry";
import SiteView, { DeviceSwitch, DeviceFrame, liveChannel } from "./SiteView";
import { CommandPalette, SiteSwitcher } from "./palette";

export const fmtDate = (d) => { if (!d) return "—"; const x = new Date(d); const p = (n) => String(n).padStart(2, "0"); return `${p(x.getDate())}-${p(x.getMonth() + 1)}-${x.getFullYear()}`; };
export const base = (siteId) => `/modules/website/s/${siteId}`;
export const Label = ({ children, htmlFor }) => <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground mb-1">{children}</label>;
export const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/** Load something from the API with loading / error / reload. */
export function useLoad(fn, deps) {
  const [state, setState] = useState({ loading: true });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return fn().then((data) => setState({ data, loading: false })).catch((error) => setState({ error, loading: false }));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload, setData: (data) => setState({ data, loading: false }) };
}

export function Shell({ title, crumb, actions, children }) {
  const { siteId } = useParams();
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-5">
      <CommandPalette siteId={siteId} />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          {crumb && <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5 flex-wrap"><Link to="/modules/website" className="hover:underline text-muted-foreground no-underline">Websites</Link> / <SiteSwitcher siteId={siteId} name={crumb} /></div>}
          <h1 className="text-2xl font-semibold tracking-tight truncate">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))} className="hidden md:inline-flex items-center gap-2 h-9 rounded-md border bg-card px-3 text-xs text-muted-foreground hover:bg-accent" aria-label="Search (Ctrl+K)"><Search className="h-3.5 w-3.5" /> Search <kbd className="border rounded px-1 text-[10px]">Ctrl K</kbd></button>
          {actions}
        </div>
      </div>
      {children}
    </div>
  );
}
export const Loading = () => <div className="py-16 text-center text-sm text-muted-foreground" aria-busy="true">Loading…</div>;
export const Failed = ({ error, retry }) => <Card><CardContent className="py-10 text-center space-y-3"><p className="text-sm text-destructive">{error.message}</p><Button variant="outline" size="sm" onClick={retry}>Try again</Button></CardContent></Card>;
export const EmptyBox = ({ icon: Icon, text, action }) => <Card><CardContent className="py-14 text-center space-y-3"><Icon className="h-8 w-8 mx-auto text-muted-foreground" /><p className="text-sm text-muted-foreground">{text}</p>{action}</CardContent></Card>;

/* ════════════════ Websites ════════════════ */
export function WebsitesPage() {
  const navigate = useNavigate();
  const sites = useLoad(() => wbApi.sites(), []);
  async function remove(site) {
    if (!(await askConfirm(`Delete "${site.name}" and all its pages?`))) return;
    try { await wbApi.removeSite(site._id); toast.success("Website deleted"); sites.reload(); } catch (e) { toast.error(e.message); }
  }
  const newBtn = <Button asChild><Link to="/modules/website/templates" className="no-underline"><Plus className="h-4 w-4" /> New website</Link></Button>;
  /** Create a website from an exported template file. The server checks every page before anything is written. */
  async function importFile(file) {
    try {
      if (file.size > 3_000_000) throw new Error("The file is too large");
      const pkg = JSON.parse(await file.text());
      if (!pkg || pkg.templateSchemaVersion !== 1 || !Array.isArray(pkg.pages)) throw new Error("This is not a website template file");
      const site = await wbApi.createSite({ name: `${String(pkg.name || "Imported website").slice(0, 100)} (imported)`, template: pkg });
      toast.success("Website imported");
      navigate(`${base(site._id)}/pages`);
    } catch (e) { toast.error(e.message); }
  }
  const importBtn = <Button asChild variant="outline"><label className="cursor-pointer"><Upload className="h-4 w-4" /> Import<input type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) importFile(file); }} /></label></Button>;

  return (
    <Shell title="Websites" actions={<><Button asChild variant="outline"><Link to="/modules/website/templates" className="no-underline"><LayoutTemplate className="h-4 w-4" /> Website Templates</Link></Button>{importBtn}{newBtn}</>}>
      {sites.loading ? <Loading /> : sites.error ? <Failed error={sites.error} retry={sites.reload} /> : sites.data.length === 0 ? (
        <EmptyBox icon={Globe2} text="No websites" action={newBtn} />
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {sites.data.map((s) => (
            <Card key={s._id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`${base(s._id)}/pages`} className="font-semibold text-foreground no-underline hover:underline block truncate">{s.name}</Link>
                    <div className="text-xs text-muted-foreground truncate">/site/{s.siteKey}</div>
                  </div>
                  <Badge variant={s.status === "published" ? "default" : "outline"}>{s.status === "published" ? "Live" : "Draft"}</Badge>
                </div>
                <div className="flex gap-4 text-sm"><span><b>{s.pages}</b> <span className="text-muted-foreground">pages</span></span><span><b>{s.livePages}</b> <span className="text-muted-foreground">live</span></span><span className="text-muted-foreground ml-auto text-xs self-center">{fmtDate(s.updatedAt)}</span></div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm"><Link to={`${base(s._id)}/pages`} className="no-underline"><Pencil className="h-4 w-4" /> Open</Link></Button>
                  {s.status === "published" && <Button asChild size="sm" variant="outline"><a href={`/site/${s.siteKey}`} target="_blank" rel="noreferrer" className="no-underline"><ExternalLink className="h-4 w-4" /> View</a></Button>}
                  <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" title="Delete" aria-label={`Delete ${s.name}`} onClick={() => remove(s)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

    </Shell>
  );
}

/* ════════════════ Pages ════════════════ */
export function SitePagesPage() {
  const { siteId } = useParams();
  const site = useLoad(() => wbApi.site(siteId), [siteId]);
  const pages = useLoad(() => wbApi.pages(siteId), [siteId]);
  const [edit, setEdit] = useState(null); // { _id?, title, path, seoTitle, seoDescription, collectionKey }
  const cols = useLoad(() => wbApi.collections(siteId), [siteId]);

  const run = async (fn, done) => { try { await fn(); if (done) toast.success(done); pages.reload(); site.reload(); } catch (e) { toast.error(e.message); } };
  async function save() {
    if (!edit.title.trim()) return toast.error("Enter a page title");
    await run(async () => {
      if (edit._id) await wbApi.updatePage(siteId, edit._id, { title: edit.title, path: edit.path, seo: { title: edit.seoTitle, description: edit.seoDescription } });
      else await wbApi.createPage(siteId, { title: edit.title, path: edit.collectionKey ? `/${(edit.path || edit.collectionKey).replace(/^\/+|\/:slug$|\/+$/g, "")}/:slug` : edit.path, collectionKey: edit.collectionKey || undefined, content: { schemaVersion: 2, settings: {}, root: { id: "root", type: "Page", props: {}, children: [createNode("Navbar"), createNode("Footer")] } } });
      setEdit(null);
    }, "Saved");
  }
  async function remove(p) { if (await askConfirm(`Delete page "${p.title}"?`)) run(() => wbApi.removePage(siteId, p._id), "Page deleted"); }

  if (site.loading && !site.data) return <Shell title="Pages"><Loading /></Shell>;
  if (site.error) return <Shell title="Pages"><Failed error={site.error} retry={site.reload} /></Shell>;
  const addBtn = <Button onClick={() => setEdit({ title: "", path: "", seoTitle: "", seoDescription: "" })}><Plus className="h-4 w-4" /> Add page</Button>;

  return (
    <Shell title="Pages" crumb={site.data.name} actions={<>
      <Button asChild variant="outline"><Link to={`${base(siteId)}/preview`} className="no-underline"><Eye className="h-4 w-4" /> Preview</Link></Button>
      {site.data.status === "published" && <Button asChild variant="outline"><a href={`/site/${site.data.siteKey}`} target="_blank" rel="noreferrer" className="no-underline"><ExternalLink className="h-4 w-4" /> View live</a></Button>}
      <Button variant="outline" disabled={!(pages.data || []).some((p) => p.status !== "published" || p.hasUnpublished)} onClick={() => run(async () => { for (const p of pages.data.filter((x) => x.status !== "published" || x.hasUnpublished)) await wbApi.publishPage(siteId, p._id); }, "All pages published")}><Upload className="h-4 w-4" /> Publish all</Button>
      {addBtn}</>}>
      {pages.loading && !pages.data ? <Loading /> : pages.error ? <Failed error={pages.error} retry={pages.reload} /> : pages.data.length === 0 ? <EmptyBox icon={FileText} text="No pages" action={addBtn} /> : (
        <Card><CardContent className="p-0 divide-y">
          {pages.data.map((p, i) => (
            <div key={p._id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">{p.title}{p.isHome && <Home className="h-3.5 w-3.5 text-muted-foreground" aria-label="Home page" />}{p.pageType === "collectionItem" && <Badge variant="outline" className="font-normal"><Database className="h-3 w-3" /> {p.collectionKey}</Badge>}</div>
                  <div className="text-xs text-muted-foreground truncate">{p.path} · {fmtDate(p.updatedAt)}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant={p.status === "published" ? "default" : "outline"}>{p.status === "published" ? "Live" : "Draft"}</Badge>
                {p.status === "published" && p.hasUnpublished && <Badge variant="outline">Unpublished changes</Badge>}
              </div>
              <div className="flex flex-wrap items-center gap-1 shrink-0">
                <Button asChild size="sm"><Link to={`${base(siteId)}/builder/${p._id}`} className="no-underline"><Pencil className="h-4 w-4" /> Edit</Link></Button>
                <Button size="sm" variant="outline" onClick={() => run(() => (p.status === "published" && !p.hasUnpublished ? wbApi.unpublishPage(siteId, p._id) : wbApi.publishPage(siteId, p._id)), p.status === "published" && !p.hasUnpublished ? "Unpublished" : "Published")}>
                  <Upload className="h-4 w-4" /> {p.status === "published" && !p.hasUnpublished ? "Unpublish" : "Publish"}
                </Button>
                <Button asChild size="sm" variant="ghost" title="Preview" aria-label="Preview"><Link to={`${base(siteId)}/preview?path=${encodeURIComponent(p.path)}`}><Eye className="h-4 w-4" /></Link></Button>
                <Button size="sm" variant="ghost" title="Page settings" aria-label="Page settings" onClick={() => setEdit({ _id: p._id, isHome: p.isHome, title: p.title, path: p.path, seoTitle: p.seo?.title || "", seoDescription: p.seo?.description || "" })}><Settings2 className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" title="Duplicate" aria-label="Duplicate" onClick={() => run(() => wbApi.duplicatePage(siteId, p._id), "Page duplicated")}><Copy className="h-4 w-4" /></Button>
                {!p.isHome && <Button size="sm" variant="ghost" title="Make home page" aria-label="Make home page" onClick={() => run(() => wbApi.updatePage(siteId, p._id, { isHome: true }), "Home page changed")}><Home className="h-4 w-4" /></Button>}
                {!p.isHome && <Button size="sm" variant="ghost" title="Delete" aria-label="Delete" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </CardContent></Card>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{edit?._id ? "Page settings" : "Add page"}</DialogTitle></DialogHeader>
          {edit && <div className="space-y-3">
            <div><Label htmlFor="wb-p-title">Title *</Label><Input id="wb-p-title" autoFocus value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></div>
            {!edit._id && (cols.data || []).length > 0 && <div><Label htmlFor="wb-p-col">Shows one record of</Label><select id="wb-p-col" className={selectCls} value={edit.collectionKey || ""} onChange={(e) => setEdit({ ...edit, collectionKey: e.target.value, path: e.target.value ? `/${e.target.value}` : "" })}><option value="">Nothing — a normal page</option>{cols.data.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></div>}
            {!edit.isHome && <div><Label htmlFor="wb-p-path">Address{edit.collectionKey ? " (each record gets its own: /address/record-name)" : ""}</Label><Input id="wb-p-path" value={edit.path} onChange={(e) => setEdit({ ...edit, path: e.target.value })} /></div>}
            {edit._id && <>
              <div><Label htmlFor="wb-p-seot">Search title</Label><Input id="wb-p-seot" value={edit.seoTitle} maxLength={160} onChange={(e) => setEdit({ ...edit, seoTitle: e.target.value })} /></div>
              <div><Label htmlFor="wb-p-seod">Search description</Label><textarea id="wb-p-seod" rows={3} maxLength={320} className="w-full rounded-md border border-input bg-background p-2 text-sm" value={edit.seoDescription} onChange={(e) => setEdit({ ...edit, seoDescription: e.target.value })} /></div>
            </>}
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

/* ════════════════ Designer ════════════════ */
const COLOR_FIELDS = [["primary", "Primary"], ["primaryContrast", "Text on primary"], ["secondary", "Secondary"], ["accent", "Accent"], ["background", "Background"], ["surface", "Surface"], ["text", "Text"], ["mutedText", "Muted text"], ["border", "Border"]];

const Group = ({ title, children }) => <div className="border-b p-4 space-y-3"><h2 className="text-sm font-semibold">{title}</h2>{children}</div>;

/** A page that shows every themed piece, so a change is visible at once. */
function styleGuide() {
  const n = createNode;
  return { root: { id: "root", type: "Page", props: {}, children: [
    n("Navbar", { logoText: "Your brand", ctaLabel: "Contact" }),
    n("Hero", { layout: "center", tone: "soft" }),
    n("Section", {}, [n("Eyebrow", { text: "Typography" }), n("Heading", { text: "Heading one", level: "h1" }), n("Heading", { text: "Heading two", level: "h2" }), n("Heading", { text: "Heading three", level: "h3" }), n("Text", { text: "Lead paragraph that introduces a section in a slightly larger size.", lead: true }), n("Text", { text: "Body text. The quick brown fox jumps over the lazy dog, and this sentence shows how normal paragraphs read on your website." }),
      n("Stack", { direction: "row" }, [n("Button", { label: "Primary" }), n("Button", { label: "Outline", variant: "outline" }), n("Button", { label: "Text link", variant: "link" })])]),
    n("Features", { tone: "soft", cards: true }), n("Pricing", { tone: "none" }), n("Testimonials", {}), n("CTA", {}), n("Footer", {}),
  ] } };
}

export function DesignerPage() {
  const { siteId } = useParams();
  const site = useLoad(() => wbApi.site(siteId), [siteId]);
  const pages = useLoad(() => wbApi.pages(siteId), [siteId]);
  const [theme, setTheme] = useState(null);
  const [history, setHistory] = useState({ past: [], future: [] });
  const [saveState, setSaveState] = useState("saved");
  const [device, setDevice] = useState("desktop");
  const [previewPage, setPreviewPage] = useState("guide");
  const [pageContent, setPageContent] = useState(null);
  const guide = useMemo(styleGuide, []);
  const timer = useRef(null);
  const latest = useRef(null);
  const channel = useRef(null);
  // an open preview window follows theme changes before they are saved
  useEffect(() => { channel.current = liveChannel(siteId); return () => channel.current?.close(); }, [siteId]);

  useEffect(() => { if (site.data && !theme) setTheme({ ...mergeTheme(site.data.themeDraft), stylePresets: site.data.themeDraft?.stylePresets || [] }); }, [site.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (previewPage === "guide") return setPageContent(null);
    let live = true;
    wbApi.page(siteId, previewPage).then((p) => live && setPageContent(p.draft)).catch((e) => toast.error(e.message));
    return () => { live = false; };
  }, [previewPage, siteId]);

  const save = useCallback(async () => {
    setSaveState("saving");
    try { await wbApi.saveTheme(siteId, latest.current); setSaveState("saved"); } catch (e) { setSaveState("error"); toast.error(e.message); }
  }, [siteId]);
  // flush a pending save when leaving the screen
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); wbApi.saveTheme(siteId, latest.current).catch(() => {}); } }, [siteId]);

  function change(next, track = true) {
    if (track) setHistory((h) => ({ past: [...h.past.slice(-49), theme], future: [] }));
    setTheme(next); latest.current = next; setSaveState("unsaved");
    channel.current?.postMessage({ type: "theme", theme: next });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; save(); }, 800);
  }
  const set = (group, key, value) => change({ ...theme, [group]: { ...theme[group], [key]: value } });
  const undo = () => { if (!history.past.length) return; const prev = history.past[history.past.length - 1]; setHistory({ past: history.past.slice(0, -1), future: [theme, ...history.future] }); change(prev, false); };
  const redo = () => { if (!history.future.length) return; const next = history.future[0]; setHistory({ past: [...history.past, theme], future: history.future.slice(1) }); change(next, false); };
  async function publish() {
    try { clearTimeout(timer.current); timer.current = null; await wbApi.saveTheme(siteId, theme); await wbApi.publishTheme(siteId); setSaveState("saved"); toast.success("Theme published"); site.reload(); } catch (e) { toast.error(e.message); }
  }

  if (site.error) return <Shell title="Designer"><Failed error={site.error} retry={site.reload} /></Shell>;
  if (!theme) return <Shell title="Designer"><Loading /></Shell>;
  const warnings = contrastWarnings(theme);
  const num = (group, key, label, min, max, step = 1) => (
    <div><Label htmlFor={`wb-d-${group}-${key}`}>{label}</Label><Input id={`wb-d-${group}-${key}`} type="number" min={min} max={max} step={step} value={theme[group][key]} onChange={(e) => set(group, key, Number(e.target.value))} /></div>
  );
  const unpublished = JSON.stringify(theme) !== JSON.stringify(mergeTheme(site.data.themePublished || {})) || !site.data.themePublished;

  return (
    <Shell title="Designer" crumb={site.data.name} actions={<>
      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">{saveState === "error" && <CloudOff className="h-3.5 w-3.5" />}{{ saved: "Saved", saving: "Saving…", unsaved: "Unsaved", error: "Not saved" }[saveState]}</span>
      <Button variant="outline" size="icon" title="Undo" aria-label="Undo" disabled={!history.past.length} onClick={undo}><Undo2 className="h-4 w-4" /></Button>
      <Button variant="outline" size="icon" title="Redo" aria-label="Redo" disabled={!history.future.length} onClick={redo}><Redo2 className="h-4 w-4" /></Button>
      <Button onClick={publish} disabled={!unpublished && saveState === "saved"}><Upload className="h-4 w-4" /> Publish theme</Button></>}>
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
        <Card className="lg:sticky lg:top-[70px] lg:max-h-[calc(100vh-90px)] overflow-y-auto"><CardContent className="p-0">
          <Group title="Presets">
            <div className="grid grid-cols-2 gap-2">
              {THEME_PRESETS.map((p) => (
                <button key={p.key} type="button" onClick={() => change({ ...mergeTheme(p.theme), stylePresets: theme.stylePresets || [] })} className="rounded-md border p-2 text-left hover:bg-accent">
                  <span className="flex gap-1 mb-1">{[p.theme.colors.primary, p.theme.colors.secondary, p.theme.colors.accent, p.theme.colors.surface].map((c, i) => <span key={i} className="h-4 flex-1 rounded-sm border" style={{ background: c }} />)}</span>
                  <span className="text-xs font-medium block truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </Group>
          <Group title="Colours">
            <div className="grid grid-cols-2 gap-3">
              {COLOR_FIELDS.map(([key, label]) => (
                <div key={key}><Label htmlFor={`wb-c-${key}`}>{label}</Label>
                  <div className="flex gap-1">
                    <input type="color" aria-label={label} className="h-9 w-10 rounded border bg-background p-0.5 shrink-0" value={isHex(theme.colors[key]) && theme.colors[key].length === 7 ? theme.colors[key] : "#000000"} onChange={(e) => set("colors", key, e.target.value)} />
                    <Input id={`wb-c-${key}`} value={theme.colors[key]} maxLength={7} onChange={(e) => set("colors", key, e.target.value)} className="font-mono text-xs px-2" />
                  </div>
                </div>
              ))}
            </div>
            {warnings.length > 0 && <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 p-2 text-xs space-y-1">{warnings.map((w) => <div key={w.label} className="flex gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w.label}: contrast {w.ratio.toFixed(1)} (needs 4.5)</div>)}</div>}
          </Group>
          <Group title="Typography">
            {[["headingFont", "Heading font"], ["bodyFont", "Body font"]].map(([key, label]) => (
              <div key={key}><Label htmlFor={`wb-f-${key}`}>{label}</Label><select id={`wb-f-${key}`} className={selectCls} value={theme.typography[key]} onChange={(e) => set("typography", key, e.target.value)}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select></div>
            ))}
            <div className="grid grid-cols-2 gap-3">{num("typography", "baseSize", "Base size", 12, 22)}{num("typography", "scaleRatio", "Scale", 1.1, 1.5, 0.05)}{num("typography", "lineHeight", "Line height", 1.1, 2.2, 0.1)}{num("typography", "headingWeight", "Heading weight", 300, 900, 100)}</div>
          </Group>
          <Group title="Spacing"><div className="grid grid-cols-3 gap-3">{num("spacing", "sectionY", "Section", 24, 200, 4)}{num("spacing", "containerMax", "Width", 720, 1600, 20)}{num("spacing", "gutter", "Gutter", 8, 64, 2)}</div></Group>
          <Group title="Corners & shadow">
            <div className="grid grid-cols-3 gap-3">{num("radius", "sm", "Small", 0, 40)}{num("radius", "md", "Medium", 0, 40)}{num("radius", "lg", "Large", 0, 60)}</div>
            <div><Label htmlFor="wb-shadow">Shadow</Label><select id="wb-shadow" className={selectCls} value={theme.shadow} onChange={(e) => change({ ...theme, shadow: e.target.value })}><option value="none">None</option><option value="soft">Soft</option><option value="strong">Strong</option></select></div>
          </Group>
          <Group title="Buttons">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="wb-b-shape">Shape</Label><select id="wb-b-shape" className={selectCls} value={theme.buttons.shape} onChange={(e) => set("buttons", "shape", e.target.value)}><option value="none">Square</option><option value="sm">Slightly round</option><option value="md">Round</option><option value="pill">Pill</option></select></div>
              {num("buttons", "weight", "Weight", 400, 800, 100)}
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!theme.buttons.uppercase} onChange={(e) => set("buttons", "uppercase", e.target.checked)} /> Uppercase</label>
          </Group>
          {(theme.stylePresets || []).length > 0 && <Group title="Style presets">
            {theme.stylePresets.map((p, i) => (
              <div key={p.id} className="flex gap-1">
                <Input aria-label="Preset name" value={p.name} onChange={(e) => change({ ...theme, stylePresets: theme.stylePresets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                <Button size="icon" variant="ghost" title="Delete preset" aria-label="Delete preset" onClick={() => change({ ...theme, stylePresets: theme.stylePresets.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>))}
          </Group>}
        </CardContent></Card>

        <Card className="overflow-hidden"><CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b p-2">
            <select aria-label="Preview page" className={`${selectCls} max-w-[220px]`} value={previewPage} onChange={(e) => setPreviewPage(e.target.value)}>
              <option value="guide">Style guide</option>
              {(pages.data || []).map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}
            </select>
            <div className="ml-auto"><DeviceSwitch value={device} onChange={setDevice} /></div>
          </div>
          <div className="bg-background p-2 md:p-4 overflow-auto max-h-[calc(100vh-170px)]">
            <DeviceFrame device={device}>
              <SiteView theme={theme} content={pageContent || guide} site={{ name: site.data.name, logoText: site.data.settings?.logoText || site.data.name, logoUrl: site.data.settings?.logoUrl }} menus={{ primary: (pages.data || []).slice(0, 5).map((p) => ({ id: p._id, label: p.title, href: p.path, children: [] })) }} mode="editor" />
            </DeviceFrame>
          </div>
        </CardContent></Card>
      </div>
    </Shell>
  );
}

/* ════════════════ Menus ════════════════ */
const LOCATIONS = [["primary", "Main menu"], ["footer", "Footer"], ["legal", "Legal links"], ["mobile", "Mobile"]];
const getAt = (items, path) => path.reduce((list, idx, i) => (i === path.length - 1 ? list[idx] : list[idx].children), items);
/** Immutable edit of the list that holds the item at `path`. */
function editList(items, path, fn) {
  if (path.length === 1) return fn(items.slice(), path[0]);
  return items.map((it, i) => (i === path[0] ? { ...it, children: editList(it.children || [], path.slice(1), fn) } : it));
}

export function MenusPage() {
  const { siteId } = useParams();
  const site = useLoad(() => wbApi.site(siteId), [siteId]);
  const pages = useLoad(() => wbApi.pages(siteId), [siteId]);
  const menus = useLoad(() => wbApi.menus(siteId), [siteId]);
  const cols = useLoad(() => wbApi.collections(siteId), [siteId]);
  const [loc, setLoc] = useState("primary");
  const [draft, setDraft] = useState({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (menus.data) { setDraft(Object.fromEntries(menus.data.map((m) => [m.location, m.items]))); setDirty(false); } }, [menus.data]);
  const items = draft[loc] || [];
  const setItems = (next) => { setDraft({ ...draft, [loc]: next }); setDirty(true); };
  const newItem = (over = {}) => ({ id: uid(), label: "New link", type: "page", pageId: pages.data?.[0]?._id || "", url: "", newTab: false, highlight: false, children: [], ...over });

  const patch = (path, change) => setItems(editList(items, path, (list, i) => { list[i] = { ...list[i], ...change }; return list; }));
  const remove = (path) => setItems(editList(items, path, (list, i) => { list.splice(i, 1); return list; }));
  const move = (path, dir) => setItems(editList(items, path, (list, i) => { const j = i + dir; if (j < 0 || j >= list.length) return list; [list[i], list[j]] = [list[j], list[i]]; return list; }));
  /** Make the item a child of the item just above it (max three levels). */
  const indent = (path) => {
    const i = path[path.length - 1];
    if (i === 0 || path.length >= 3) return;
    const item = getAt(items, path);
    setItems(editList(items, path, (list) => { list.splice(i, 1); list[i - 1] = { ...list[i - 1], children: [...(list[i - 1].children || []), item] }; return list; }));
  };
  const outdent = (path) => {
    if (path.length < 2) return;
    const item = getAt(items, path);
    const without = editList(items, path, (list, i) => { list.splice(i, 1); return list; });
    const parentPath = path.slice(0, -1);
    setItems(editList(without, parentPath, (list, i) => { list.splice(i + 1, 0, item); return list; }));
  };
  async function save() {
    try { await wbApi.saveMenu(siteId, loc, items); toast.success("Menu saved"); setDirty(false); } catch (e) { toast.error(e.message); }
  }
  function fromPages() { setItems((pages.data || []).map((p) => newItem({ label: p.title, pageId: p._id }))); }
  async function switchLoc(next) {
    if (dirty && !(await askConfirm("Discard unsaved menu changes?", { confirmLabel: "Discard" }))) return;
    if (dirty) setDraft(Object.fromEntries(menus.data.map((m) => [m.location, m.items])));
    setDirty(false); setLoc(next);
  }

  const pageIds = new Set((pages.data || []).map((p) => p._id));
  const row = (it, path) => {
    const broken = it.type === "page" && !pageIds.has(it.pageId);
    const key = path.join("-");
    return (
      <div key={it.id}>
        <div className="flex flex-col gap-2 rounded-md border bg-card p-2 lg:flex-row lg:items-center" style={{ marginLeft: (path.length - 1) * 24 }}>
          <Input aria-label="Label" className="lg:w-44" value={it.label} onChange={(e) => patch(path, { label: e.target.value })} />
          <select aria-label="Type" className={`${selectCls} lg:w-32`} value={it.type} onChange={(e) => patch(path, { type: e.target.value })}><option value="page">Page</option><option value="url">Custom link</option><option value="anchor">Anchor</option><option value="heading">Heading</option><option value="auto">Auto list</option></select>
          {it.type === "page" && <select aria-label="Page" className={`${selectCls} lg:flex-1 ${broken ? "border-destructive" : ""}`} value={it.pageId || ""} onChange={(e) => patch(path, { pageId: e.target.value })}>{broken && <option value="">Page missing</option>}{(pages.data || []).map((p) => <option key={p._id} value={p._id}>{p.title}</option>)}</select>}
          {(it.type === "url" || it.type === "anchor") && <Input aria-label="Link" className="lg:flex-1" value={it.url} onChange={(e) => patch(path, { url: e.target.value })} />}
          {it.type === "heading" && <span className="lg:flex-1 text-xs text-muted-foreground">Column title</span>}
          {it.type === "auto" && <select aria-label="Collection" className={`${selectCls} lg:flex-1`} value={it.collectionKey || ""} onChange={(e) => patch(path, { collectionKey: e.target.value })}><option value="">Choose a collection</option>{(cols.data || []).map((c) => <option key={c.key} value={c.key}>Newest {c.name}</option>)}</select>}
          <div className="flex items-center gap-1 flex-wrap">
            {it.type !== "heading" && it.type !== "auto" && <label className="flex items-center gap-1 text-xs mr-1"><input type="checkbox" checked={!!it.newTab} onChange={(e) => patch(path, { newTab: e.target.checked })} /> New tab</label>}
            {path.length === 1 && it.type !== "heading" && it.type !== "auto" && <label className="flex items-center gap-1 text-xs mr-1"><input type="checkbox" checked={!!it.highlight} onChange={(e) => patch(path, { highlight: e.target.checked })} /> Button</label>}
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Move up" aria-label="Move up" onClick={() => move(path, -1)}><ChevronUp className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Move down" aria-label="Move down" onClick={() => move(path, 1)}><ChevronDown className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Make sub-item" aria-label="Make sub-item" disabled={path[path.length - 1] === 0 || path.length >= 3} onClick={() => indent(path)}><IndentIncrease className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Move out" aria-label="Move out" disabled={path.length < 2} onClick={() => outdent(path)}><IndentDecrease className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Delete" aria-label="Delete" onClick={() => remove(path)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        {(it.children || []).length > 0 && <div className="mt-2 space-y-2" data-key={key}>{it.children.map((c, i) => row(c, [...path, i]))}</div>}
      </div>
    );
  };

  if (site.error) return <Shell title="Menus"><Failed error={site.error} retry={site.reload} /></Shell>;
  if (!site.data || !menus.data || !pages.data) return <Shell title="Menus"><Loading /></Shell>;
  return (
    <Shell title="Menus" crumb={site.data.name} actions={<>
      <Button variant="outline" onClick={fromPages}><ListTree className="h-4 w-4" /> Create from pages</Button>
      <Button variant="outline" onClick={() => setItems([...items, newItem()])}><Plus className="h-4 w-4" /> Add item</Button>
      <Button onClick={save} disabled={!dirty}>Save</Button></>}>
      <div className="flex gap-2 border-b pb-3 overflow-x-auto">
        {LOCATIONS.map(([key, label]) => <Button key={key} size="sm" variant={loc === key ? "default" : "ghost"} onClick={() => switchLoc(key)}>{label}</Button>)}
      </div>
      {items.length === 0 ? <EmptyBox icon={ListTree} text="No menu items" action={<Button onClick={() => setItems([newItem()])}><Plus className="h-4 w-4" /> Add item</Button>} /> : <div className="space-y-2">{items.map((it, i) => row(it, [i]))}</div>}
    </Shell>
  );
}

/* ════════════════ Settings ════════════════ */
export function SiteSettingsPage() {
  const { siteId } = useParams();
  const navigate = useNavigate();
  const site = useLoad(() => wbApi.site(siteId), [siteId]);
  const [f, setF] = useState(null);
  const links = useLoad(() => wbApi.shareLinks(siteId), [siteId]);
  const health = useLoad(() => wbApi.health(siteId), [siteId]);
  useEffect(() => { if (site.data) setF({ name: site.data.name, siteKey: site.data.siteKey, logoText: site.data.settings?.logoText || "", logoUrl: site.data.settings?.logoUrl || "", description: site.data.settings?.description || "", leadCapture: !!site.data.settings?.leadCapture }); }, [site.data]);

  async function save() {
    try { await wbApi.updateSite(siteId, { name: f.name, siteKey: f.siteKey, settings: { logoText: f.logoText, logoUrl: f.logoUrl, description: f.description, leadCapture: f.leadCapture } }); toast.success("Saved"); site.reload(); } catch (e) { toast.error(e.message); }
  }
  async function remove() {
    if (!(await askConfirm(`Delete "${site.data.name}" and all its pages?`))) return;
    try { await wbApi.removeSite(siteId); toast.success("Website deleted"); navigate("/modules/website"); } catch (e) { toast.error(e.message); }
  }
  async function exportSite() {
    try {
      const pkg = await wbApi.exportSite(siteId);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" }));
      a.download = `${site.data.siteKey}-template.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { toast.error(e.message); }
  }
  async function newLink() {
    try { const l = await wbApi.createShareLink(siteId, { hours: 72 }); const url = `${window.location.origin}/site-preview/${l.token}`; await navigator.clipboard.writeText(url).catch(() => {}); toast.success("Preview link copied (valid 3 days)"); links.reload(); } catch (e) { toast.error(e.message); }
  }
  if (site.error) return <Shell title="Settings"><Failed error={site.error} retry={site.reload} /></Shell>;
  if (!f) return <Shell title="Settings"><Loading /></Shell>;
  const url = `${window.location.origin}/site/${site.data.siteKey}`;
  return (
    <Shell title="Settings" crumb={site.data.name} actions={<Button onClick={save}>Save</Button>}>
      <Card><CardContent className="p-4 grid gap-4 grid-cols-1 md:grid-cols-2">
        <div><Label htmlFor="wb-s-name">Website name *</Label><Input id="wb-s-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label htmlFor="wb-s-key">Address</Label><div className="flex items-center gap-1"><span className="text-sm text-muted-foreground shrink-0">/site/</span><Input id="wb-s-key" value={f.siteKey} onChange={(e) => setF({ ...f, siteKey: e.target.value })} /></div></div>
        <div><Label htmlFor="wb-s-logo">Logo text</Label><Input id="wb-s-logo" value={f.logoText} onChange={(e) => setF({ ...f, logoText: e.target.value })} /></div>
        <div><Label htmlFor="wb-s-logourl">Logo image URL</Label><Input id="wb-s-logourl" value={f.logoUrl} onChange={(e) => setF({ ...f, logoUrl: e.target.value })} /></div>
        <div className="md:col-span-2"><Label htmlFor="wb-s-desc">Description</Label><textarea id="wb-s-desc" rows={2} className="w-full rounded-md border border-input bg-background p-2 text-sm" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <label className="md:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.leadCapture} onChange={(e) => setF({ ...f, leadCapture: e.target.checked })} /> Create a CRM lead from form submissions that have a name and a phone number</label>
        <div className="md:col-span-2 flex flex-wrap items-center gap-2 border-t pt-4">
          <Badge variant={site.data.status === "published" ? "default" : "outline"}>{site.data.status === "published" ? "Live" : "Draft"}</Badge>
          <span className="text-sm text-muted-foreground truncate">{url}</span>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied"); }}><Copy className="h-4 w-4" /> Copy</Button>
          <Button size="sm" variant="outline" className="ml-auto" onClick={exportSite}><Download className="h-4 w-4" /> Export as template</Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={remove}><Trash2 className="h-4 w-4" /> Delete website</Button>
        </div>
      </CardContent></Card>
      {health.data && <Card><CardContent className="p-4 space-y-3">
        <h2 className="text-sm font-semibold">Site health</h2>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[["Cached pages", health.data.cachedPages], ["Cache hits", `${health.data.hitRatio}%`], ["Pages rendered", health.data.renders], ["Average render", `${health.data.averageMs} ms`]].map(([label, value]) => <div key={label} className="rounded-md border p-3"><div className="text-xl font-semibold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>)}
        </div>
        {health.data.slowest.length > 0 && <div className="text-xs text-muted-foreground">Slowest: {health.data.slowest.map((x) => `${x.path} (${x.ms} ms)`).join(", ")}</div>}
      </CardContent></Card>}
      <Card><CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Preview links</h2><Button size="sm" variant="outline" onClick={newLink}><Share2 className="h-4 w-4" /> New link</Button></div>
        {(links.data || []).length === 0 ? <p className="text-sm text-muted-foreground">No active links</p> : <div className="divide-y rounded-md border">{links.data.map((l) => (
          <div key={l._id} className="flex flex-wrap items-center gap-3 p-2 text-sm"><span>Created {fmtDate(l.createdAt)}</span><span className="text-muted-foreground">expires {fmtDate(l.expiresAt)}</span><span className="text-muted-foreground">{l.views} views</span>
            <Button size="sm" variant="ghost" className="ml-auto" onClick={async () => { try { await wbApi.revokeShareLink(siteId, l._id); links.reload(); } catch (e) { toast.error(e.message); } }}>Revoke</Button></div>))}</div>}
      </CardContent></Card>
    </Shell>
  );
}

export const siteNav = [
  { title: "Pages", slug: "pages", icon: FileText },
  { title: "Designer", slug: "designer", icon: Palette },
  { title: "Menus", slug: "menus", icon: ListTree },
  { title: "Settings", slug: "settings", icon: Settings2 },
];
