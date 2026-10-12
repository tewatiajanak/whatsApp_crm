// The website frame: theme CSS + the page tree. No router and no API calls live here,
// so the same file draws pages in the browser and on the server (see ssr-entry.jsx).
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RenderNode, compileNodeCss, BASE_CSS } from "./registry";
import "./elements2";
import { compileTheme, fontHref } from "./theme";

/** Load the theme's Google Fonts: one stylesheet per font pair, shared by every site drawn with it. */
function useThemeFonts(theme) {
  const href = useMemo(() => fontHref(theme), [theme]);
  useEffect(() => {
    if ([...document.querySelectorAll("link[data-wb-fonts]")].some((l) => l.getAttribute("href") === href)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.setAttribute("data-wb-fonts", "");
    link.href = href;
    document.head.appendChild(link);
  }, [href]);
}

/** Reveal elements with an entrance animation when they scroll into view. */
function useEntranceAnimations(ref, enabled, dep) {
  useEffect(() => {
    const root = ref.current;
    if (!enabled || !root) return;
    const targets = root.querySelectorAll("[data-wb-anim]:not(.wb-in)");
    if (!targets.length) return;
    if (!("IntersectionObserver" in window)) { targets.forEach((el) => el.classList.add("wb-in")); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("wb-in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ref, enabled, dep]);
}

/**
 * @param content  page JSON ({ root })
 * @param mode     "editor" | "preview" | "public"
 * @param linkTo   site path → browser URL
 * @param bundle   optional render bundle parts: { data, item, itemPaths, query, page }
 */
export default function SiteView({ theme, content, site, menus, mode = "public", path = "/", linkTo = (p) => p, navigate, onInlineEdit, extraCss = "", bundle = {}, setQuery, submitForm }) {
  useThemeFonts(theme);
  const ref = useRef(null);
  // each drawn site gets its own theme scope, so several sites can share a screen
  const scopeId = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const css = useMemo(() => compileTheme(theme, `.wb-site[data-wb-site="${scopeId}"]`) + BASE_CSS, [theme, scopeId]);
  const nodeCss = useMemo(() => compileNodeCss(content?.root, theme?.stylePresets), [content, theme]);
  const [animate, setAnimate] = useState(false);
  useLayoutEffect(() => { setAnimate(mode !== "editor"); }, [mode]);
  useEntranceAnimations(ref, animate, content);
  const ctx = { mode, site, menus, path, linkTo, navigate, onInlineEdit, data: bundle.data, item: bundle.item, itemPaths: bundle.itemPaths, query: bundle.query, pageInfo: bundle.page ? { title: bundle.page.title, path: bundle.page.path } : undefined, setQuery, submitForm };
  return (
    <div className={`wb-site ${animate ? "wb-anim" : ""}`} data-wb-site={scopeId} ref={ref}>
      <style>{css + nodeCss + extraCss}</style>
      {content?.root ? <RenderNode node={content.root} ctx={ctx} /> : null}
    </div>
  );
}

