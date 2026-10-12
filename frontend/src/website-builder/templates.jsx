// Website Templates: a gallery of complete, multi-page websites. Each card shows the real
// home page (drawn by the site renderer, scaled down), with a full preview before choosing.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Eye, ArrowLeft, Check, FileText, LayoutTemplate } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { wbApi } from "./api";
import { Shell, Label, selectCls, base } from "./pages";
import { SITE_TEMPLATES, TEMPLATE_CATEGORIES, buildTemplatePackage } from "./blocks";
import SiteView, { DeviceSwitch, DeviceFrame } from "./SiteView";

const built = new Map();
/** A template's pages and menus, built once and reused by the card and the preview. */
function packageOf(key) {
  if (!built.has(key)) {
    const pkg = buildTemplatePackage(key);
    const pathByRef = new Map(pkg.pages.map((p) => [p.ref, p.path]));
    const toMenu = (items) => (items || []).map((it, i) => ({ id: `${it.pageRef}-${i}`, label: it.label, href: pathByRef.get(it.pageRef) || "/", children: toMenu(it.children) }));
    built.set(key, { ...pkg, menusForView: Object.fromEntries((pkg.menus || []).map((m) => [m.location, toMenu(m.items)])) });
  }
  return built.get(key);
}
const siteInfo = (tpl) => ({ name: tpl.name, logoText: tpl.name, siteKey: tpl.key });

/** The top of the template's home page, drawn only when the card scrolls into view. */
function Thumbnail({ tpl }) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    // cards already on screen are drawn straight away; the rest wait until they are scrolled near
    const box = el.getBoundingClientRect();
    if (!("IntersectionObserver" in window) || (box.top < window.innerHeight + 300 && box.bottom > -300)) { setShow(true); return; }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [show]);
  const pkg = show ? packageOf(tpl.key) : null;
  return (
    <div ref={ref} className="h-48 overflow-hidden rounded-t-xl border-b bg-background pointer-events-none select-none" aria-hidden="true">
      {pkg && <DeviceFrame device="desktop"><SiteView theme={pkg.theme} content={pkg.pages[0].content} site={siteInfo(tpl)} menus={pkg.menusForView} mode="editor" path="/" /></DeviceFrame>}
    </div>
  );
}

function Preview({ tpl, onClose, onUse }) {
  const pkg = packageOf(tpl.key);
  const [path, setPath] = useState("/");
  const [device, setDevice] = useState("desktop");
  const scroller = useRef(null);
  const page = pkg.pages.find((p) => p.path === path) || pkg.pages[0];
  useEffect(() => { scroller.current?.scrollTo(0, 0); }, [path]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`${tpl.name} preview`}>
      <div className="flex items-center gap-2 border-b bg-card px-3 h-12 shrink-0">
        <Button size="sm" variant="ghost" onClick={onClose}><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Templates</span></Button>
        <span className="text-sm font-semibold truncate">{tpl.name}</span>
        <select aria-label="Page" className={`${selectCls} max-w-[170px] ml-auto`} value={page.path} onChange={(e) => setPath(e.target.value)}>{pkg.pages.map((p) => <option key={p.path} value={p.path}>{p.title}</option>)}</select>
        <span className="hidden sm:block"><DeviceSwitch value={device} onChange={setDevice} /></span>
        <Button size="sm" onClick={onUse}><Check className="h-4 w-4" /> Use template</Button>
      </div>
      <div ref={scroller} className="flex-1 overflow-auto">
        <DeviceFrame device={device}>
          <SiteView theme={pkg.theme} content={page.content} site={siteInfo(tpl)} menus={pkg.menusForView} mode="preview" path={page.path} linkTo={(p) => `#${p}`} navigate={(p) => pkg.pages.some((x) => x.path === p) && setPath(p)} />
        </DeviceFrame>
      </div>
    </div>
  );
}

export function TemplateGalleryPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [preview, setPreview] = useState(null);
  const [use, setUse] = useState(null); // { tpl, name }
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const text = q.trim().toLowerCase();
    return SITE_TEMPLATES.filter((t) => (category === "All" || t.category === category) && (!text || `${t.name} ${t.category} ${t.description}`.toLowerCase().includes(text)));
  }, [q, category]);
  const pageCount = (t) => packageOf(t.key).pages.length;

  async function create() {
    if (!use.name.trim()) return toast.error("Enter a website name");
    setBusy(true);
    try {
      const { menusForView, ...pkg } = packageOf(use.tpl.key);
      const site = await wbApi.createSite({ name: use.name.trim(), template: pkg });
      toast.success("Website created");
      navigate(`${base(site._id)}/pages`);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }
  const start = (tpl) => setUse({ tpl, name: "" });

  return (
    <Shell title="Website Templates" actions={<Badge variant="outline">{SITE_TEMPLATES.length} templates</Badge>}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative md:w-72"><Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search templates" placeholder="Search" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex gap-2 overflow-x-auto pb-1">{["All", ...TEMPLATE_CATEGORIES].map((c) => <Button key={c} size="sm" variant={category === c ? "default" : "outline"} className="whitespace-nowrap" onClick={() => setCategory(c)}>{c}</Button>)}</div>
      </div>

      {list.length === 0 ? (
        <Card><CardContent className="py-14 text-center space-y-3"><LayoutTemplate className="h-8 w-8 mx-auto text-muted-foreground" /><p className="text-sm text-muted-foreground">No templates match</p><Button variant="outline" size="sm" onClick={() => { setQ(""); setCategory("All"); }}>Clear filters</Button></CardContent></Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <Card key={t.key} className="overflow-hidden">
              <button type="button" className="block w-full text-left" onClick={() => setPreview(t)} aria-label={`Preview ${t.name}`}><Thumbnail tpl={t} /></button>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="font-semibold truncate">{t.name}</div><div className="text-xs text-muted-foreground">{t.category}</div></div>
                  <Badge variant="outline" className="shrink-0 font-normal"><FileText className="h-3 w-3" /> {pageCount(t)} pages</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">{t.description}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setPreview(t)}><Eye className="h-4 w-4" /> Preview</Button>
                  <Button size="sm" className="flex-1" onClick={() => start(t)}><Check className="h-4 w-4" /> Use template</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {preview && <Preview tpl={preview} onClose={() => setPreview(null)} onUse={() => { const t = preview; setPreview(null); start(t); }} />}

      <Dialog open={!!use} onOpenChange={(o) => !o && !busy && setUse(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{use?.tpl.name}</DialogTitle></DialogHeader>
          {use && <div><Label htmlFor="wb-tpl-name">Website name *</Label><Input id="wb-tpl-name" autoFocus value={use.name} onChange={(e) => setUse({ ...use, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && create()} /></div>}
          <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setUse(null)}>Cancel</Button><Button onClick={create} disabled={busy}>{busy ? "Creating…" : "Create website"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
