import { Router } from "express";
import fs from "fs";
import path from "path";
import rateLimit from "express-rate-limit";
import { config } from "../config";
import { publicBundle, sitePaths } from "./website";
import { cacheKey, getCached, putCached } from "../services/siteCache";
import { Website, WebPage, WebCollection, WebRecord } from "../models/Website";

/**
 * Server-rendered public websites: GET /site/<address>/<path>.
 * The page's content, title and search tags are in the HTML before any script runs.
 * The web app then loads and takes the page over (links, forms, lists) from the data sent along.
 */
const r = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as any)[c]);
/** JSON that is safe inside a <script> block. */
const inlineJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

/* ---- the renderer built from the frontend (npm run build:ssr) ---- */
const ssrFile = process.env.SITE_SSR_BUNDLE || path.resolve(process.cwd(), "../frontend/dist-ssr/site-ssr.cjs");
let renderer: { mtime: number; render: (bundle: any, path: string) => { html: string; fontHref: string } } | null = null;
let warned = false;
function loadRenderer() {
  try {
    const mtime = fs.statSync(ssrFile).mtimeMs;
    if (!renderer || renderer.mtime !== mtime) {
      delete require.cache[require.resolve(ssrFile)];
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      renderer = { mtime, render: require(ssrFile).render };
    }
    return renderer;
  } catch (e: any) {
    if (!warned) { warned = true; console.warn(`[site] server rendering is off: ${ssrFile} could not be loaded (${e?.code || e?.message}). Run "npm run build:ssr" in frontend.`); }
    return null;
  }
}

/* ---- the public site's HTML shell (site.html): a small script that makes the server-drawn page interactive ---- */
let shell: { at: number; html: string } | null = null;
async function loadShell(): Promise<string> {
  if (shell && Date.now() - shell.at < (config.env === "development" ? 2000 : 60_000)) return shell.html;
  let html = "";
  try {
    if (config.env === "development") {
      // in development the dev server owns index.html (it adds its own scripts)
      const origin = config.clientOrigin.split(",").find((o) => o.startsWith("http")) || "http://localhost:5173";
      const res = await fetch(`${origin}/site.html`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) html = await res.text();
    } else {
      html = fs.readFileSync(path.join(process.env.WEB_DIST_DIR || path.resolve(process.cwd(), "../frontend/dist"), "site.html"), "utf8");
    }
  } catch { /* fall through to the plain shell */ }
  // without the app shell the page is still a complete, readable document
  if (!html.includes('id="root"')) html = '<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title></title></head><body><div id="root"></div></body></html>';
  shell = { at: Date.now(), html };
  return html;
}

const FRAME_HOSTS = "https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com https://www.google.com https://calendly.com https://open.spotify.com https://w.soundcloud.com https://form.typeform.com";
function securityHeaders(res: any) {
  const dev = config.env === "development";
  const csp = [
    "default-src 'self'", "base-uri 'self'", "object-src 'none'", "frame-ancestors 'self'", "form-action 'self'",
    `script-src 'self'${dev ? " 'unsafe-inline'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: https:", "media-src https:", `frame-src ${FRAME_HOSTS}`, `connect-src 'self'${dev ? " ws: http://localhost:*" : ""}`,
  ].join("; ");
  // helmet's default policy is for the JSON API; a website page needs its own
  res.removeHeader("Content-Security-Policy");
  // enforced in production (checked against the built public bundle); report-only in development,
  // where the dev server adds inline scripts. SITE_CSP=report | enforce overrides either way.
  const enforce = process.env.SITE_CSP ? process.env.SITE_CSP === "enforce" : !dev;
  res.set(enforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", csp);
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

const origin = (req: any) => `${req.headers["x-forwarded-proto"] || req.protocol}://${req.headers["x-forwarded-host"] || req.get("host")}`;

function headTags(bundle: any, url: string) {
  const item = bundle.item;
  const pageTitle = bundle.page.seo?.title || `${item?.title || item?.name || bundle.page.title} | ${bundle.site.name}`;
  const description = bundle.page.seo?.description || String(item?.excerpt || item?.summary || "").slice(0, 300);
  const image = [item?.cover, item?.image, item?.photo, bundle.site.logoUrl].find((v) => typeof v === "string" && /^https:\/\//.test(v)) || "";
  const ld: any[] = [{ "@context": "https://schema.org", "@type": bundle.page.path === "/" ? "WebSite" : "WebPage", name: pageTitle, url, ...(description ? { description } : {}) }];
  if (item) ld.push({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: url.replace(/\/site\/([^/]+).*/, "/site/$1") }, { "@type": "ListItem", position: 2, name: String(item.title || item.name || bundle.page.title), item: url }] });
  return {
    title: pageTitle,
    tags: [
      `<meta name="description" content="${esc(description)}" />`, `<link rel="canonical" href="${esc(url)}" />`,
      `<meta property="og:type" content="${item ? "article" : "website"}" />`, `<meta property="og:title" content="${esc(pageTitle)}" />`, `<meta property="og:description" content="${esc(description)}" />`, `<meta property="og:url" content="${esc(url)}" />`, `<meta property="og:site_name" content="${esc(bundle.site.name)}" />`,
      ...(image ? [`<meta property="og:image" content="${esc(image)}" />`] : []),
      `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
      ...ld.map((x) => `<script type="application/ld+json">${inlineJson(x)}</script>`),
    ].join("\n    "),
  };
}

r.get("/:siteKey/robots.txt", limiter, async (req: any, res: any) => {
  res.type("text/plain").send(`User-agent: *\nAllow: /site/${String(req.params.siteKey).replace(/[^a-z0-9-]/gi, "")}/\nSitemap: ${origin(req)}/site/${String(req.params.siteKey).replace(/[^a-z0-9-]/gi, "")}/sitemap.xml\n`);
});

r.get("/:siteKey/sitemap.xml", limiter, async (req: any, res: any) => {
  try {
    const { siteKey, urls } = await sitePaths(req.params.siteKey);
    res.set("Cache-Control", "public, max-age=300").type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(`${origin(req)}/site/${siteKey}${u}`)}</loc></url>`).join("\n")}\n</urlset>`);
  } catch { res.status(404).type("text/plain").send("Not found"); }
});

/* ---- feeds: RSS for any collection that has an item page, and a calendar file for a dated record ---- */
async function feedParts(siteKey: string, key: string) {
  const site = await Website.findOne({ siteKey: siteKey.toLowerCase(), status: "published" }).lean();
  if (!site) return null;
  const col: any = await WebCollection.findOne({ website: site._id, key: key.toLowerCase() }).lean();
  const page: any = col && (await WebPage.findOne({ website: site._id, status: "published", pageType: "collectionItem", collectionKey: col.key }).select("path").lean());
  return page ? { site, col, itemPath: page.path as string } : null;
}
const plain = (v: unknown) => String(v ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

r.get("/:siteKey/feed/:collection.xml", limiter, async (req: any, res: any) => {
  try {
    const parts = await feedParts(req.params.siteKey, req.params.collection);
    if (!parts) return res.status(404).type("text/plain").send("Not found");
    const { site, col, itemPath } = parts;
    const recs = await WebRecord.find({ website: site._id, collectionKey: col.key, status: "published", publishedAt: { $lte: new Date() } }).sort({ publishedAt: -1 }).limit(30).lean();
    const titleKey = col.settings?.titleField || col.fields[0]?.key;
    const textKey = col.fields.find((f: any) => f.type === "textarea" && !f.hiddenFromApi)?.key || col.fields.find((f: any) => f.type === "richtext" && !f.hiddenFromApi)?.key;
    const base = `${origin(req)}/site/${site.siteKey}`;
    const items = recs.map((rec: any) => `    <item><title>${esc(rec.data?.[titleKey] || rec.slug)}</title><link>${esc(base + itemPath.replace(":slug", rec.slug))}</link><guid>${esc(base + itemPath.replace(":slug", rec.slug))}</guid><pubDate>${new Date(rec.publishedAt || rec.createdAt).toUTCString()}</pubDate><description>${esc(plain(textKey ? rec.data?.[textKey] : "").slice(0, 400))}</description></item>`).join("\n");
    res.set("Cache-Control", "public, max-age=300").type("application/rss+xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n    <title>${esc(`${col.name} | ${site.name}`)}</title><link>${esc(base)}</link><description>${esc(site.settings?.description || col.name)}</description>\n${items}\n</channel></rss>`);
  } catch { res.status(500).type("text/plain").send("Feed unavailable"); }
});

r.get("/:siteKey/calendar/:collection/:slug.ics", limiter, async (req: any, res: any) => {
  try {
    const parts = await feedParts(req.params.siteKey, req.params.collection);
    const dateKey = parts?.col.fields.find((f: any) => f.type === "date")?.key;
    const rec: any = parts && dateKey && (await WebRecord.findOne({ website: parts.site._id, collectionKey: parts.col.key, slug: String(req.params.slug).toLowerCase(), status: "published" }).lean());
    const start = rec?.data?.[dateKey as string] ? new Date(rec.data[dateKey as string]) : null;
    if (!parts || !rec || !start || isNaN(start.getTime())) return res.status(404).type("text/plain").send("Not found");
    const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
    // calendar text: commas, semicolons and line breaks are escaped
    const ics = (v: unknown) => plain(v).replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").slice(0, 600);
    const titleKey = parts.col.settings?.titleField || parts.col.fields[0]?.key;
    const url = `${origin(req)}/site/${parts.site.siteKey}${parts.itemPath.replace(":slug", rec.slug)}`;
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Website Builder//EN", "BEGIN:VEVENT", `UID:${rec._id}@${parts.site.siteKey}`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 3_600_000))}`, `SUMMARY:${ics(rec.data?.[titleKey])}`, ...(rec.data?.venue ? [`LOCATION:${ics(rec.data.venue)}`] : []), ...(rec.data?.summary ? [`DESCRIPTION:${ics(rec.data.summary)}`] : []), `URL:${url}`, "END:VEVENT", "END:VCALENDAR"];
    res.set("Content-Disposition", `attachment; filename="${rec.slug}.ics"`).type("text/calendar").send(lines.join("\r\n"));
  } catch { res.status(500).type("text/plain").send("Calendar unavailable"); }
});

r.get(["/:siteKey", "/:siteKey/*"], limiter, async (req: any, res: any) => {
  const sitePath = "/" + String(req.params[0] || "").replace(/\/+$/, "");
  const siteKey = String(req.params.siteKey).toLowerCase();
  const key = cacheKey(sitePath, req.query);
  securityHeaders(res);
  try {
    let page = getCached(siteKey, key);
    if (!page) {
      const started = process.hrtime.bigint();
      let status = 200, head = "", body = "", data = "", siteId = "";
      try {
        const out = await publicBundle(siteKey, sitePath, { page: req.query.page, q: req.query.q });
        siteId = out.siteId;
        const url = `${origin(req)}/site/${siteKey}${sitePath === "/" ? "" : sitePath}`;
        const tags = headTags(out.bundle, url);
        const ssr = loadRenderer()?.render(out.bundle, sitePath);
        head = `<title>${esc(tags.title)}</title>\n    ${tags.tags}${ssr ? `\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />\n    <link rel="stylesheet" href="${esc(ssr.fontHref)}" />` : ""}`;
        body = ssr ? ssr.html : "";
        data = inlineJson({ siteKey, path: sitePath, page: String(req.query.page || ""), q: String(req.query.q || ""), bundle: out.bundle });
      } catch (e: any) {
        if (e?.status !== 404) throw e;
        status = 404;
        head = `<title>Page not found</title>\n    <meta name="robots" content="noindex" />`;
        body = '<div style="min-height:60vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;text-align:center;padding:24px"><div><h1 style="font-size:22px;margin:0 0 6px">Page not found</h1><p style="color:#666;margin:0">The page does not exist or is not published.</p></div></div>';
      }
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      // missing pages are not cached under a real website's id, and never for long-lived purge tracking
      page = status === 200 ? putCached(siteKey, siteId, key, { status, head, body, data }, ms) : { status, head, body, data, etag: "", at: Date.now() };
      if (config.env !== "test") console.log(`[site] ${status} ${siteKey}${sitePath} rendered in ${ms.toFixed(0)}ms`);
    }
    if (page.status === 200) {
      res.set({ ETag: page.etag, "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" });
      if (req.headers["if-none-match"] === page.etag) return res.status(304).end();
    } else res.set("Cache-Control", "no-store");
    const html = (await loadShell())
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace("</head>", `    ${page.head}\n  </head>`)
      .replace(/<div id="root"><\/div>/, () => `<div id="root">${page.body}</div>${page.data ? `<script type="application/json" id="wb-bundle">${page.data}</script>` : ""}`);
    res.status(page.status).type("html").send(html);
  } catch (e: any) {
    console.error(`[site] render failed for ${siteKey}${sitePath}:`, e?.message);
    // the page script can still draw the page in the browser
    res.set("Cache-Control", "no-store").status(200).type("html").send(await loadShell());
  }
});

export default r;
