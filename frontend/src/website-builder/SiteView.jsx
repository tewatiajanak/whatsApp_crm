// Draws a website page. Used by the builder canvas, the Designer preview, the in-app
// preview, share links and the public site, so they can never look different from each other.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Monitor, Tablet, Smartphone, Radio, Share2 } from "lucide-react";
import SiteView from "./SiteCore";
import { wbApi } from "./api";
import { Message } from "./PublicSite";

export { PublicSite, SharedPreview } from "./PublicSite";

export default SiteView;

export const DEVICES = [
  { key: "desktop", label: "Desktop", icon: Monitor, width: "100%" },
  { key: "tablet", label: "Tablet", icon: Tablet, width: 820 },
  { key: "mobile", label: "Mobile", icon: Smartphone, width: 390 },
];
export function DeviceSwitch({ value, onChange }) {
  return (
    <div className="inline-flex rounded-md border bg-card p-0.5" role="group" aria-label="Device">
      {DEVICES.map((d) => (
        <button key={d.key} type="button" title={d.label} aria-label={d.label} aria-pressed={value === d.key} onClick={() => onChange(d.key)}
          className={`h-7 w-8 inline-flex items-center justify-center rounded ${value === d.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
          <d.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

/**
 * The page frame for the chosen device. Desktop is always drawn 1280px wide and
 * scaled down to fit, so a narrow editor window still shows the desktop layout.
 */
export function DeviceFrame({ device, children, className = "" }) {
  const outer = useRef(null);
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => setAvail(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const target = device === "desktop" ? Math.max(avail, 1280) : DEVICES.find((d) => d.key === device).width;
  const zoom = avail && target > avail ? avail / target : 1;
  return (
    <div ref={outer} className="w-full">
      <div className={`mx-auto bg-background shadow-sm ${className}`} style={{ width: target, zoom }}>{avail ? children : null}</div>
    </div>
  );
}

/** Channel the builder and Designer use to show unsaved changes in an open preview window. */
export const liveChannel = (siteId) => ("BroadcastChannel" in window ? new BroadcastChannel(`wb-live-${siteId}`) : null);

/** Signed-in preview of the DRAFT website, with a device switch. Follows unsaved edits made in another tab. */
export function SitePreview() {
  const { siteId } = useParams();
  const [params, setParams] = useSearchParams();
  const path = params.get("path") || "/";
  const page = params.get("page") || "", q = params.get("q") || "";
  const [device, setDevice] = useState("desktop");
  const [state, setState] = useState({});
  const [live, setLive] = useState({}); // unsaved { content (for this path), theme } streamed from the editor
  const [share, setShare] = useState(null);

  useEffect(() => {
    let on = true;
    setLive((l) => ({ theme: l.theme }));
    wbApi.preview(siteId, path, { page, q }).then((bundle) => on && setState({ bundle })).catch((error) => on && setState({ error }));
    return () => { on = false; };
  }, [siteId, path, page, q]);
  useEffect(() => {
    const ch = liveChannel(siteId);
    if (!ch) return;
    ch.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "theme") setLive((l) => ({ ...l, theme: m.theme }));
      if (m.type === "page" && m.path === path) setLive((l) => ({ ...l, content: m.content, at: Date.now() }));
    };
    return () => ch.close();
  }, [siteId, path]);

  async function makeLink() {
    try { const l = await wbApi.createShareLink(siteId, { hours: 72 }); const url = `${window.location.origin}/site-preview/${l.token}`; setShare(url); navigator.clipboard?.writeText(url).catch(() => {}); } catch (e) { setShare(`Could not create a link: ${e.message}`); }
  }
  const b = state.bundle;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b bg-card px-3 h-12 shrink-0">
        <Link to={`/modules/website/s/${siteId}/pages`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground no-underline"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <span className="text-sm font-medium truncate">Preview · not public</span>
        {live.content && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Radio className="h-3.5 w-3.5" /> Live</span>}
        <span className="text-xs text-muted-foreground truncate hidden md:inline">{path}</span>
        <div className="ml-auto flex items-center gap-2">
          {share && <input readOnly aria-label="Share link" value={share} onFocus={(e) => e.target.select()} className="hidden sm:block h-8 w-64 rounded-md border border-input bg-background px-2 text-xs" />}
          <button type="button" onClick={makeLink} title="Share link (3 days)" className="inline-flex items-center gap-1 h-8 px-2 rounded-md border bg-card text-xs font-medium hover:bg-accent"><Share2 className="h-4 w-4" /><span className="hidden sm:inline">{share ? "Copied" : "Share"}</span></button>
          <DeviceSwitch value={device} onChange={setDevice} />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <DeviceFrame device={device}>
          {state.error ? <Message title="Page not found" text={state.error.message} /> : b ? (
            <SiteView theme={live.theme || b.theme} content={live.content || b.page.content} site={b.site} menus={b.menus} mode="preview" path={b.page.path} linkTo={(p) => `?path=${encodeURIComponent(p)}`} navigate={(p) => setParams({ path: p })} bundle={b} setQuery={(next) => setParams({ path, ...(next.page > 1 ? { page: String(next.page) } : {}), ...((next.q ?? q) ? { q: next.q ?? q } : {}) })} />
          ) : null}
        </DeviceFrame>
      </div>
    </div>
  );
}
