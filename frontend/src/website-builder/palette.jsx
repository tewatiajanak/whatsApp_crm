// Command palette (Ctrl/Cmd+K) and website switcher for the Website Builder screens.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, FileText, Globe2, Database, CornerDownLeft } from "lucide-react";
import { wbApi } from "./api";

export const SITE_SECTIONS = [["pages", "Pages"], ["designer", "Designer"], ["menus", "Menus"], ["content", "Content"], ["data", "Data & APIs"], ["inbox", "Form inbox"], ["apps", "Apps"], ["settings", "Settings"]];
let sitesCache = null;
const loadSites = () => (sitesCache ? Promise.resolve(sitesCache) : wbApi.sites().then((s) => { sitesCache = s; setTimeout(() => { sitesCache = null; }, 30_000); return s; }));

/** Switch website and stay on the same screen (Pages → Pages) where it exists. */
export function SiteSwitcher({ siteId, name }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [sites, setSites] = useState(null);
  const section = pathname.match(/\/s\/[^/]+\/([a-z]+)/)?.[1];
  const keep = SITE_SECTIONS.some(([k]) => k === section) ? section : "pages";
  return (
    <select aria-label="Website" className="h-7 max-w-[220px] rounded border border-input bg-background px-1 text-xs" value={siteId}
      onFocus={() => !sites && loadSites().then(setSites).catch(() => {})}
      onChange={(e) => navigate(e.target.value === "all" ? "/modules/website" : `/modules/website/s/${e.target.value}/${keep}`)}>
      {!sites && <option value={siteId}>{name}</option>}
      {(sites || []).map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
      <option value="all">All websites…</option>
    </select>
  );
}

export function CommandPalette({ siteId }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState({ pages: [], collections: [] });
  const [sites, setSites] = useState([]);
  const [index, setIndex] = useState(0);
  const input = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (open) { setQ(""); setIndex(0); loadSites().then(setSites).catch(() => {}); setTimeout(() => input.current?.focus(), 0); } }, [open]);
  // server search for pages and collections, 200 ms after typing stops
  useEffect(() => {
    if (!open || !siteId) return;
    let live = true;
    const t = setTimeout(() => wbApi.search(siteId, q).then((r) => live && setFound(r)).catch(() => {}), 200);
    return () => { live = false; clearTimeout(t); };
  }, [q, open, siteId]);

  const results = useMemo(() => {
    const has = (s) => !q || String(s).toLowerCase().includes(q.toLowerCase());
    const b = `/modules/website/s/${siteId}`;
    return [
      ...(siteId ? SITE_SECTIONS.filter(([, l]) => has(l)).map(([k, l]) => ({ group: "Go to", label: l, to: `${b}/${k}`, icon: CornerDownLeft })) : []),
      ...(siteId ? found.pages.map((p) => ({ group: "Edit page", label: p.title, hint: p.path, to: `${b}/builder/${p._id}`, icon: FileText })) : []),
      ...(siteId ? found.collections.map((c) => ({ group: "Content", label: c.name, to: `${b}/content/${c.key}`, icon: Database })) : []),
      ...sites.filter((s) => has(s.name)).map((s) => ({ group: "Websites", label: s.name, hint: `/site/${s.siteKey}`, to: `/modules/website/s/${s._id}/pages`, icon: Globe2 })),
    ].slice(0, 24);
  }, [q, found, sites, siteId]);
  useEffect(() => { setIndex(0); }, [q]);

  if (!open) return null;
  const go = (r) => { if (!r) return; setOpen(false); navigate(r.to); };
  const onKey = (e) => {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") go(results[index]);
  };
  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-start justify-center p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-label="Search" aria-modal="true" className="w-full max-w-lg rounded-xl border bg-card shadow-xl overflow-hidden">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input ref={input} aria-label="Search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} className="h-11 flex-1 bg-transparent text-sm outline-none" />
          <kbd className="text-[10px] text-muted-foreground border rounded px-1">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-1" role="listbox">
          {results.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">No results</div>}
          {results.map((r, i) => {
            const head = r.group !== lastGroup ? r.group : null;
            lastGroup = r.group;
            return (
              <div key={`${r.to}-${i}`}>
                {head && <div className="px-2 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{head}</div>}
                <button type="button" role="option" aria-selected={i === index} onMouseEnter={() => setIndex(i)} onClick={() => go(r)} className={`w-full flex items-center gap-2 rounded-md px-2 py-2 text-sm text-left ${i === index ? "bg-accent" : ""}`}>
                  <r.icon className="h-4 w-4 text-muted-foreground shrink-0" /><span className="truncate flex-1">{r.label}</span>{r.hint && <span className="text-xs text-muted-foreground truncate max-w-[40%]">{r.hint}</span>}
                </button>
              </div>);
          })}
        </div>
      </div>
    </div>
  );
}
