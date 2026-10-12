// Published websites in the browser: /site/<address>/… and share-link previews.
// Kept free of admin UI code so the public bundle (site-entry.jsx) stays small.
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import SiteView from "./SiteCore";
import { wbApi } from "./api";

export function Message({ title, text }) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
      <div><h1 style={{ fontSize: 22, margin: "0 0 6px" }}>{title}</h1><p style={{ color: "#666", margin: 0 }}>{text}</p></div>
    </div>
  );
}

/** Title, description and robots tag for the page being shown. */
function useHead(bundle, noindex) {
  useEffect(() => {
    if (!bundle) return;
    const item = bundle.item;
    document.title = bundle.page.seo?.title || `${item?.title || item?.name || bundle.page.title} | ${bundle.site.name}`;
    const meta = (name, content) => { let m = document.querySelector(`meta[name="${name}"]`); if (!m) { m = document.createElement("meta"); m.name = name; document.head.appendChild(m); } m.content = content; };
    meta("description", bundle.page.seo?.description || "");
    meta("robots", noindex ? "noindex, nofollow" : "index, follow");
  }, [bundle, noindex]);
}

/** The bundle the server rendered this page with, if the page came server-rendered. Read once. */
function takeServerBundle(siteKey, path, page, q) {
  if (typeof document === "undefined") return null;
  const el = document.getElementById("wb-bundle");
  if (!el) return null;
  try {
    const sent = JSON.parse(el.textContent || "null");
    el.remove();
    return sent && sent.siteKey === siteKey && sent.path === path && (sent.page || "") === page && (sent.q || "") === q ? sent.bundle : null;
  } catch { return null; }
}

/** A website served from a render bundle: the public site and share-link previews. */
function BundleSite({ load, baseUrl, mode, noindex, canSubmit, siteKeyForForms, serverKey }) {
  const { "*": rest = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const path = "/" + rest.replace(/\/+$/, "");
  const page = params.get("page") || "", q = params.get("q") || "";
  const [state, setState] = useState(() => { const bundle = serverKey ? takeServerBundle(serverKey, path, page, q) : null; return bundle ? { bundle, sent: `${path}|${page}|${q}` } : {}; });

  useEffect(() => {
    // the first page arrived with its data; only later addresses are fetched
    if (state.sent === `${path}|${page}|${q}`) return;
    let live = true;
    load(path, { page, q }).then((bundle) => live && setState({ bundle })).catch((error) => live && setState({ error }));
    return () => { live = false; };
  }, [path, page, q]); // eslint-disable-line react-hooks/exhaustive-deps
  useHead(state.bundle, noindex);
  // a new page starts at the top; paging a list keeps the place
  useEffect(() => { window.scrollTo(0, 0); }, [path]);

  if (state.error) return <Message title={state.error.status === 404 ? "Page not found" : "This page could not be loaded"} text={state.error.status === 404 ? "The page does not exist or is not published." : "Please try again in a moment."} />;
  if (!state.bundle) return <div style={{ minHeight: "100vh" }} aria-busy="true" />;
  const { bundle } = state;
  const linkTo = (p) => `${baseUrl}${p === "/" ? "" : p}`;
  const setQuery = (next) => { const merged = { page: String(next.page ?? 1), q: next.q ?? q }; setParams(Object.fromEntries(Object.entries(merged).filter(([k, v]) => v && !(k === "page" && v === "1")))); };
  return (
    <SiteView theme={bundle.theme} content={bundle.page.content} site={bundle.site} menus={bundle.menus} mode={mode} path={path} linkTo={linkTo} navigate={(p) => navigate(linkTo(p))} bundle={bundle} setQuery={setQuery}
      submitForm={canSubmit ? (body) => wbApi.submitForm(siteKeyForForms, { ...body, page: path }) : undefined} />
  );
}

/** Public website: /site/:siteKey/* — published pages only, no sign-in. */
export function PublicSite() {
  const { siteKey } = useParams();
  return <BundleSite key={siteKey} load={(path, query) => wbApi.publicRender(siteKey, path, query)} baseUrl={`/site/${siteKey}`} mode="public" canSubmit siteKeyForForms={siteKey} serverKey={siteKey} />;
}

/** Share link: /site-preview/:token/* — the draft website, read-only, until the link expires. */
export function SharedPreview() {
  const { token } = useParams();
  return (
    <>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#111", color: "#fff", font: "12px system-ui, sans-serif", textAlign: "center", padding: "6px 12px" }}>Preview · not public</div>
      <BundleSite key={token} load={(path, query) => wbApi.sharedRender(token, path, query)} baseUrl={`/site-preview/${token}`} mode="preview" noindex />
    </>
  );
}

