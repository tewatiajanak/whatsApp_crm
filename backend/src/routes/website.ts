import { Router } from "express";
import rateLimit from "express-rate-limit";
import { require_ } from "../middleware/auth";
import { ok, asyncHandler, ApiError, audit } from "../utils/http";
import { Website, WebPage, WebMenu, WebBlock, WebCollection, WebRecord, WebApiKey, WebWebhook, WebDataSource, WebSubmission, WebShareLink } from "../models/Website";
import { pageData, shapeRecord, fireWebhooks, cleanRecordData, searchTextOf, recordSlug, sha256 } from "../services/websiteData";
import { purgeSite, siteStats } from "../services/siteCache";

/**
 * Website Builder API.
 *   admin  — /websites/...            signed-in users; rights come from the "setup" module
 *   public — /public/site/:siteKey/…  no sign-in; published content only
 * Every admin query is scoped by tenant AND website.
 */

const MAX_PAGE_BYTES = 1_500_000;
const MAX_NODES = 3000;
const MAX_DEPTH = 24;
const MENU_LOCATIONS = ["primary", "footer", "mobile", "legal"];

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
const isObj = (v: any) => !!v && typeof v === "object" && !Array.isArray(v);

/** Page JSON must be a bounded tree of plain nodes; anything else is refused. */
function checkPageJson(content: any) {
  if (!isObj(content) || !isObj(content.root)) throw new ApiError(400, "Page content is not valid");
  if (JSON.stringify(content).length > MAX_PAGE_BYTES) throw new ApiError(413, "Page is too large");
  let count = 0;
  const ids = new Set<string>();
  const walk = (node: any, depth: number) => {
    if (!isObj(node) || typeof node.type !== "string" || !/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(node.type)) throw new ApiError(400, "Page has an invalid element");
    if (typeof node.id !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(node.id)) throw new ApiError(400, "Page has an element without a valid id");
    if (ids.has(node.id)) throw new ApiError(400, "Page has duplicate element ids");
    ids.add(node.id);
    if (++count > MAX_NODES) throw new ApiError(413, "Page has too many elements");
    if (depth > MAX_DEPTH) throw new ApiError(400, "Page is nested too deeply");
    if (node.props !== undefined && !isObj(node.props)) throw new ApiError(400, "Element props must be an object");
    if (node.style !== undefined && !isObj(node.style)) throw new ApiError(400, "Element style must be an object");
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) throw new ApiError(400, "Element children must be a list");
      node.children.forEach((c: any) => walk(c, depth + 1));
    }
  };
  walk(content.root, 0);
  return { schemaVersion: 2, settings: isObj(content.settings) ? content.settings : {}, root: content.root };
}

function checkTheme(theme: any) {
  if (!isObj(theme)) throw new ApiError(400, "Theme is not valid");
  if (JSON.stringify(theme).length > 60_000) throw new ApiError(413, "Theme is too large");
  return theme;
}

function cleanMenuItems(items: any, depth = 0): any[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 40).map((it: any) => ({
    id: str(it?.id, 40) || Math.random().toString(36).slice(2, 10),
    label: str(it?.label, 80) || "Link",
    type: ["page", "url", "anchor", "heading", "auto"].includes(it?.type) ? it.type : "url",
    // "auto" items list the records of a collection (each linking to its own page)
    collectionKey: it?.type === "auto" ? str(it?.collectionKey, 40) : "",
    limit: it?.type === "auto" ? Math.min(20, Math.max(1, Number(it?.limit) || 6)) : 0,
    pageId: str(it?.pageId, 40),
    url: str(it?.url, 500),
    newTab: !!it?.newTab,
    highlight: !!it?.highlight,
    children: depth < 2 ? cleanMenuItems(it?.children, depth + 1) : [],
  }));
}

const emptyPage = () => ({ schemaVersion: 2, settings: {}, root: { id: "root", type: "Page", props: {}, children: [] } });

function normalPath(v: unknown, title = "") {
  let p = str(v, 120).toLowerCase();
  if (!p) p = "/" + slugify(title);
  if (!p.startsWith("/")) p = "/" + p;
  const dynamic = /\/:slug\/?$/.test(p);
  p = p.replace(/\/:slug\/?$/, "").split("/").map(slugify).filter(Boolean).join("/");
  return "/" + p + (dynamic && p ? "/:slug" : "");
}

async function siteOf(req: any) {
  const site = await Website.findOne({ _id: req.params.siteId, tenant: req.tenantId });
  if (!site) throw new ApiError(404, "Website not found");
  return site;
}
async function pageOf(req: any) {
  const page = await WebPage.findOne({ _id: req.params.pageId, website: req.params.siteId, tenant: req.tenantId });
  if (!page) throw new ApiError(404, "Page not found");
  return page;
}
async function freeSiteKey(wanted: string) {
  const base = slugify(wanted) || "site";
  let key = base.length < 3 ? `${base}-site` : base;
  for (let i = 2; await Website.exists({ siteKey: key }); i++) key = `${base}-${i}`;
  return key;
}
const pageRow = (p: any) => ({ _id: p._id, title: p.title, path: p.path, pageType: p.pageType || "static", collectionKey: p.collectionKey || "", isHome: p.isHome, status: p.status, version: p.version, seo: p.seo, publishedAt: p.publishedAt, updatedAt: p.updatedAt, order: p.order, hasUnpublished: !p.published || JSON.stringify(p.draft) !== JSON.stringify(p.published) });

const FIELD_TYPES = ["text", "textarea", "richtext", "number", "boolean", "date", "image", "url", "email", "select", "tags", "relation"];
/** Field definitions typed in the admin (or shipped in a template), checked and trimmed. */
export function cleanFields(input: any) {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input.slice(0, 40).flatMap((f: any) => {
    const key = str(f?.key, 40).replace(/[^A-Za-z0-9_]/g, "");
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key) || ["id", "slug", "status", "publishedAt", "updatedAt", "__proto__", "constructor", "prototype"].includes(key) || seen.has(key)) return [];
    seen.add(key);
    return [{ key, label: str(f.label, 60) || key, type: FIELD_TYPES.includes(f.type) ? f.type : "text", required: !!f.required, hiddenFromApi: !!f.hiddenFromApi, options: Array.isArray(f.options) ? f.options.slice(0, 40).map((o: any) => str(o, 60)).filter(Boolean) : [], relation: str(f.relation, 40) }];
  });
}
/** Create collections (skipping keys that already exist) and their sample records. Returns the keys created. */
export async function installCollections(tenant: any, website: any, collections: any, records: any) {
  const made: string[] = [];
  for (const c of Array.isArray(collections) ? collections.slice(0, 12) : []) {
    const key = str(c?.key, 40).toLowerCase();
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(key) || (await WebCollection.exists({ website, key }))) continue;
    const col = await WebCollection.create({ tenant, website, key, name: str(c.name, 80) || key, fields: cleanFields(c.fields), settings: { titleField: str(c.settings?.titleField, 40), apiEnabled: !!c.settings?.apiEnabled, appKey: str(c.settings?.appKey, 40) } });
    made.push(key);
    const rows = (Array.isArray(records?.[key]) ? records[key] : []).slice(0, 60);
    const docs = rows.map((row: any, i: number) => {
      const data = cleanRecordData(col.fields.map((f: any) => ({ ...f, required: false })), row);
      const title = String(data[col.settings.titleField || col.fields[0]?.key] || `item-${i + 1}`);
      return { tenant, website, collectionKey: key, slug: recordSlug(row.slug || title) || `item-${i + 1}`, status: "published", publishedAt: new Date(Date.now() - i * 86_400_000), data, searchText: searchTextOf(col.fields, data) };
    });
    if (docs.length) await WebRecord.insertMany(docs, { ordered: false }).catch(() => {});
  }
  return made;
}

/* ════════════════ admin ════════════════ */
const r = Router();

r.get("/websites", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  const sites = await Website.find({ tenant: req.tenantId }).select("-themeDraft -themePublished").sort({ updatedAt: -1 }).lean();
  const counts = await WebPage.aggregate([{ $match: { tenant: sites[0]?.tenant || null } }, { $group: { _id: "$website", pages: { $sum: 1 }, live: { $sum: { $cond: [{ $eq: ["$status", "published"] }, 1, 0] } } } }]);
  const byId = new Map(counts.map((c: any) => [String(c._id), c]));
  ok(res, sites.map((s: any) => ({ ...s, pages: byId.get(String(s._id))?.pages || 0, livePages: byId.get(String(s._id))?.live || 0 })));
}));

/** Create a website, empty or from a template package { theme, pages[], menus[] }. */
r.post("/websites", require_("setup", "create"), asyncHandler(async (req: any, res: any) => {
  const name = str(req.body?.name, 120);
  if (!name) throw new ApiError(400, "Website name is required");
  const pkg = isObj(req.body?.template) ? req.body.template : {};
  const pagesIn: any[] = Array.isArray(pkg.pages) && pkg.pages.length ? pkg.pages.slice(0, 30) : [{ ref: "home", title: "Home", path: "/", isHome: true, content: emptyPage() }];
  // validate everything before anything is written
  const pages = pagesIn.map((p: any, i: number) => ({
    ref: str(p.ref, 40) || `p${i}`,
    title: str(p.title, 160) || "Page",
    path: p.isHome ? "/" : normalPath(p.path, p.title),
    isHome: !!p.isHome,
    content: checkPageJson(p.content || emptyPage()),
    seo: { title: str(p.seo?.title, 160), description: str(p.seo?.description, 320) },
  }));
  if (!pages.some((p) => p.isHome)) { pages[0].isHome = true; pages[0].path = "/"; }
  if (new Set(pages.map((p) => p.path)).size !== pages.length) throw new ApiError(400, "Template has two pages with the same address");
  const theme = pkg.theme ? checkTheme(pkg.theme) : {};
  pages.forEach((p, i) => { const src = pagesIn[i]; (p as any).pageType = src.pageType === "collectionItem" && p.path.endsWith("/:slug") ? "collectionItem" : "static"; (p as any).collectionKey = str(src.collectionKey, 40); });

  const site = await Website.create({
    tenant: req.tenantId, name, siteKey: await freeSiteKey(str(req.body?.siteKey, 50) || name),
    themeDraft: theme, settings: { description: str(req.body?.description, 300), logoText: name, templateKey: str(pkg.key, 60) },
  });
  try {
    const created = await WebPage.insertMany(pages.map((p: any, i) => ({ tenant: req.tenantId, website: site._id, title: p.title, path: p.path, pageType: p.pageType, collectionKey: p.collectionKey, isHome: p.isHome, draft: p.content, seo: p.seo, order: i })));
    await installCollections(req.tenantId, site._id, pkg.collections, pkg.records);
    const idByRef = new Map(pages.map((p, i) => [p.ref, String(created[i]._id)]));
    // template menus point at pages by ref; turn those into the new page ids
    const linkRefs = (items: any[]): any[] => (items || []).map((it: any) => ({ ...it, pageId: it.pageRef ? idByRef.get(it.pageRef) || "" : it.pageId, children: linkRefs(it.children) }));
    const menus = (Array.isArray(pkg.menus) ? pkg.menus : []).filter((m: any) => MENU_LOCATIONS.includes(m?.location));
    if (!menus.some((m: any) => m.location === "primary")) menus.push({ location: "primary", items: pages.map((p) => ({ label: p.title, type: "page", pageRef: p.ref })) });
    await WebMenu.insertMany(menus.map((m: any) => ({ tenant: req.tenantId, website: site._id, location: m.location, items: cleanMenuItems(linkRefs(m.items)) })));
  } catch (e) {
    // leave nothing half-made behind
    await Promise.all([WebPage.deleteMany({ website: site._id }), WebMenu.deleteMany({ website: site._id }), WebCollection.deleteMany({ website: site._id }), WebRecord.deleteMany({ website: site._id }), site.deleteOne()]);
    throw e;
  }
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "website", entity: name });
  ok(res, site, 201);
}));

r.get("/websites/:siteId", require_("setup", "view"), asyncHandler(async (req: any, res: any) => ok(res, await siteOf(req))));

r.patch("/websites/:siteId", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  if (req.body?.name !== undefined) { const n = str(req.body.name, 120); if (!n) throw new ApiError(400, "Website name is required"); site.name = n; }
  if (req.body?.siteKey !== undefined) {
    const key = slugify(str(req.body.siteKey, 50));
    if (key.length < 3) throw new ApiError(400, "Address needs at least 3 letters or numbers");
    if (key !== site.siteKey && (await Website.exists({ siteKey: key }))) throw new ApiError(409, "That address is taken");
    site.siteKey = key;
  }
  if (isObj(req.body?.settings)) {
    site.settings = { ...site.settings, description: str(req.body.settings.description, 300), logoText: str(req.body.settings.logoText, 80), logoUrl: str(req.body.settings.logoUrl, 500), ...(req.body.settings.leadCapture !== undefined ? { leadCapture: !!req.body.settings.leadCapture } : {}) };
    site.markModified("settings");
  }
  await site.save();
  purgeSite(site._id);
  ok(res, site);
}));

r.delete("/websites/:siteId", require_("setup", "del"), asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  const own = { website: site._id, tenant: req.tenantId };
  await Promise.all([WebPage, WebMenu, WebBlock, WebCollection, WebRecord, WebApiKey, WebWebhook, WebDataSource, WebSubmission, WebShareLink].map((M: any) => M.deleteMany(own)));
  await site.deleteOne();
  purgeSite(site._id);
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "website", entity: site.name });
  ok(res, { deleted: true });
}));

/** How the public site is doing: cached pages, cache hits, render times. */
r.get("/websites/:siteId/health", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  ok(res, siteStats(String(site._id)));
}));

/* ---- theme (Designer) ---- */
r.put("/websites/:siteId/theme", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  site.themeDraft = checkTheme(req.body?.theme);
  site.markModified("themeDraft");
  await site.save();
  ok(res, { themeDraft: site.themeDraft });
}));

r.post("/websites/:siteId/theme/publish", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  site.themePublished = site.themeDraft;
  site.themePublishedAt = new Date();
  site.markModified("themePublished");
  await site.save();
  purgeSite(site._id);
  fireWebhooks(site._id, "theme.published", {});
  ok(res, { themePublishedAt: site.themePublishedAt });
}));

/* ---- pages ---- */
r.get("/websites/:siteId/pages", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  await siteOf(req);
  const pages = await WebPage.find({ website: req.params.siteId, tenant: req.tenantId }).sort({ isHome: -1, order: 1, createdAt: 1 }).lean();
  ok(res, pages.map(pageRow));
}));

r.post("/websites/:siteId/pages", require_("setup", "create"), asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  const title = str(req.body?.title, 160);
  if (!title) throw new ApiError(400, "Page title is required");
  const path = normalPath(req.body?.path, title);
  if (path === "/" || (await WebPage.exists({ website: site._id, path }))) throw new ApiError(409, "A page with this address already exists");
  const content = req.body?.content ? checkPageJson(req.body.content) : emptyPage();
  const dynamic = path.endsWith("/:slug");
  const collectionKey = str(req.body?.collectionKey, 40);
  if (dynamic && !(await WebCollection.exists({ website: site._id, key: collectionKey }))) throw new ApiError(400, "Choose the collection this page shows");
  const page = await WebPage.create({ tenant: req.tenantId, website: site._id, title, path, pageType: dynamic ? "collectionItem" : "static", collectionKey: dynamic ? collectionKey : "", draft: content, order: await WebPage.countDocuments({ website: site._id }) });
  ok(res, page, 201);
}));

r.get("/websites/:siteId/pages/:pageId", require_("setup", "view"), asyncHandler(async (req: any, res: any) => ok(res, await pageOf(req))));

r.patch("/websites/:siteId/pages/:pageId", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const page = await pageOf(req);
  if (req.body?.title !== undefined) { const t = str(req.body.title, 160); if (!t) throw new ApiError(400, "Page title is required"); page.title = t; }
  if (req.body?.path !== undefined && !page.isHome) {
    const path = normalPath(req.body.path, page.title);
    if (path === "/" || (path !== page.path && (await WebPage.exists({ website: page.website, path })))) throw new ApiError(409, "A page with this address already exists");
    page.path = path;
    page.pageType = path.endsWith("/:slug") ? "collectionItem" : "static";
  }
  if (req.body?.collectionKey !== undefined) page.collectionKey = str(req.body.collectionKey, 40);
  if (page.pageType === "collectionItem" && !(await WebCollection.exists({ website: page.website, key: page.collectionKey }))) throw new ApiError(400, "Choose the collection this page shows");
  if (isObj(req.body?.seo)) { page.seo = { title: str(req.body.seo.title, 160), description: str(req.body.seo.description, 320) }; page.markModified("seo"); }
  if (req.body?.isHome === true && !page.isHome) {
    // the old home page takes a normal address; this one moves to "/"
    const old = await WebPage.findOne({ website: page.website, isHome: true });
    if (old) { old.isHome = false; old.path = normalPath("", `${old.title}-${String(old._id).slice(-4)}`); await old.save(); }
    page.isHome = true; page.path = "/";
  }
  await page.save();
  ok(res, pageRow(page));
}));

/** Save the draft. `version` must match what the editor loaded, so two tabs cannot overwrite each other. */
r.put("/websites/:siteId/pages/:pageId/draft", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const content = checkPageJson(req.body?.content);
  const version = Number(req.body?.version);
  const page = await WebPage.findOneAndUpdate(
    { _id: req.params.pageId, website: req.params.siteId, tenant: req.tenantId, version },
    { $set: { draft: content }, $inc: { version: 1 } },
    { new: true }
  );
  if (!page) {
    if (await WebPage.exists({ _id: req.params.pageId, website: req.params.siteId, tenant: req.tenantId })) throw new ApiError(409, "This page was changed somewhere else. Reload to continue.");
    throw new ApiError(404, "Page not found");
  }
  ok(res, { version: page.version, updatedAt: (page as any).updatedAt });
}));

r.post("/websites/:siteId/pages/:pageId/publish", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const page = await pageOf(req);
  const site = await siteOf(req);
  page.published = page.draft; page.status = "published"; page.publishedAt = new Date();
  page.markModified("published");
  await page.save();
  // a first publish also puts the theme live, otherwise the page would have no styling
  if (!site.themePublished) { site.themePublished = site.themeDraft; site.themePublishedAt = new Date(); site.markModified("themePublished"); }
  site.status = "published";
  await site.save();
  purgeSite(site._id);
  fireWebhooks(site._id, "page.published", { pageId: String(page._id), title: page.title, path: page.path });
  ok(res, pageRow(page));
}));

r.post("/websites/:siteId/pages/:pageId/unpublish", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const page = await pageOf(req);
  page.published = null; page.status = "draft"; page.markModified("published");
  await page.save();
  if (!(await WebPage.exists({ website: page.website, status: "published" }))) await Website.updateOne({ _id: page.website, tenant: req.tenantId }, { status: "draft" });
  purgeSite(page.website);
  fireWebhooks(page.website, "page.unpublished", { pageId: String(page._id), path: page.path });
  ok(res, pageRow(page));
}));

r.post("/websites/:siteId/pages/:pageId/duplicate", require_("setup", "create"), asyncHandler(async (req: any, res: any) => {
  const page = await pageOf(req);
  let path = normalPath("", `${page.title} copy`);
  for (let i = 2; await WebPage.exists({ website: page.website, path }); i++) path = normalPath("", `${page.title} copy ${i}`);
  const copy = await WebPage.create({ tenant: req.tenantId, website: page.website, title: `${page.title} copy`, path, pageType: "static", draft: page.draft, seo: page.seo, order: await WebPage.countDocuments({ website: page.website }) });
  ok(res, pageRow(copy), 201);
}));

r.delete("/websites/:siteId/pages/:pageId", require_("setup", "del"), asyncHandler(async (req: any, res: any) => {
  const page = await pageOf(req);
  if (page.isHome) throw new ApiError(400, "The home page cannot be deleted. Make another page the home page first.");
  await page.deleteOne();
  ok(res, { deleted: true });
}));

/* ---- menus ---- */
r.get("/websites/:siteId/menus", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  await siteOf(req);
  const menus = await WebMenu.find({ website: req.params.siteId, tenant: req.tenantId }).lean();
  ok(res, MENU_LOCATIONS.map((location) => ({ location, items: menus.find((m: any) => m.location === location)?.items || [] })));
}));

r.put("/websites/:siteId/menus/:location", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  await siteOf(req);
  if (!MENU_LOCATIONS.includes(req.params.location)) throw new ApiError(400, "Unknown menu location");
  const menu = await WebMenu.findOneAndUpdate(
    { website: req.params.siteId, tenant: req.tenantId, location: req.params.location },
    { $set: { items: cleanMenuItems(req.body?.items) } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  purgeSite(req.params.siteId);
  ok(res, { location: menu.location, items: menu.items });
}));

/* ---- saved blocks ---- */
r.get("/websites/:siteId/blocks", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  await siteOf(req);
  ok(res, await WebBlock.find({ website: req.params.siteId, tenant: req.tenantId }).sort({ createdAt: -1 }).lean());
}));

r.post("/websites/:siteId/blocks", require_("setup", "create"), asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  const name = str(req.body?.name, 80);
  if (!name) throw new ApiError(400, "Block name is required");
  // a block is one element subtree; check it the same way as a page
  checkPageJson({ root: { id: "root", type: "Page", children: [req.body?.content] } });
  ok(res, await WebBlock.create({ tenant: req.tenantId, website: site._id, name, category: str(req.body?.category, 40) || "Saved", content: req.body.content }), 201);
}));

r.delete("/websites/:siteId/blocks/:blockId", require_("setup", "del"), asyncHandler(async (req: any, res: any) => {
  const done = await WebBlock.deleteOne({ _id: req.params.blockId, website: req.params.siteId, tenant: req.tenantId });
  if (!done.deletedCount) throw new ApiError(404, "Block not found");
  ok(res, { deleted: true });
}));

/** Everything the renderer needs to show a DRAFT page (used by the in-app preview). */
r.get("/websites/:siteId/preview", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  ok(res, await draftBundle(site, req.query));
}));

export async function draftBundle(site: any, query: any) {
  const [pages, menus] = await Promise.all([
    WebPage.find({ website: site._id }).select("title path isHome pageType collectionKey draft seo").lean(),
    WebMenu.find({ website: site._id }).lean(),
  ]);
  const hit = await matchPage(site._id, pages, normalPath(query.path || "/"), "admin");
  if (!hit) throw new ApiError(404, "Page not found");
  return renderBundle(site, site.themeDraft, { ...hit.page, content: hit.page.draft }, pages, menus, hit.item, "admin", query);
}

/**
 * Find the page for an address: an exact page first, then a "/x/:slug" page whose record exists.
 * Asking for the pattern itself ("/blog/:slug") shows it with the newest record as a sample (admin only).
 */
async function matchPage(website: any, pages: any[], path: string, audience: "admin" | "public") {
  const exact = pages.find((p: any) => p.path === path);
  const loadItem = async (page: any, slug: string | null) => {
    const col = await WebCollection.findOne({ website, key: page.collectionKey });
    if (!col) return null;
    const filter: any = { website, collectionKey: col.key, ...(slug ? { slug } : {}), ...(audience === "public" ? { status: "published", publishedAt: { $lte: new Date() } } : {}) };
    const rec = await WebRecord.findOne(filter).sort({ publishedAt: -1, createdAt: -1 }).lean();
    return rec ? shapeRecord(col, rec, audience) : null;
  };
  if (exact) {
    if (exact.pageType !== "collectionItem") return { page: exact, item: null };
    return audience === "admin" ? { page: exact, item: await loadItem(exact, null) } : null;
  }
  const cut = path.lastIndexOf("/");
  const prefix = path.slice(0, cut), slug = path.slice(cut + 1);
  const tpl = pages.find((p: any) => p.pageType === "collectionItem" && p.path === `${prefix}/:slug`);
  if (!tpl || !slug) return null;
  const item = await loadItem(tpl, slug);
  return item ? { page: tpl, item } : null;
}

/** Menu items carry page ids; the renderer needs addresses. Links to pages that are not available are dropped. */
function resolveMenu(items: any[], pathById: Map<string, string>, auto: Map<string, any[]> = new Map()): any[] {
  return (items || []).flatMap((it: any) => {
    if (it.type === "auto") {
      const kids = auto.get(it.collectionKey) || [];
      return kids.length ? [{ id: it.id, label: it.label, type: "heading", href: "", newTab: false, highlight: false, children: kids.slice(0, it.limit || 6) }] : [];
    }
    const children = resolveMenu(it.children, pathById, auto);
    if (it.type === "page") {
      const href = pathById.get(String(it.pageId));
      return href === undefined || href.includes(":") ? [] : [{ id: it.id, label: it.label, type: "page", href, newTab: !!it.newTab, highlight: !!it.highlight, children }];
    }
    return [{ id: it.id, label: it.label, type: it.type, href: it.type === "heading" ? "" : it.url || "", newTab: !!it.newTab, highlight: !!it.highlight, children }];
  });
}
async function renderBundle(site: any, theme: any, page: any, pages: any[], menus: any[], item: any, audience: "admin" | "public", query: any = {}) {
  const pathById = new Map<string, string>(pages.map((p: any) => [String(p._id), p.path]));
  const itemPaths: Record<string, string> = Object.fromEntries(pages.filter((p: any) => p.pageType === "collectionItem").map((p: any) => [p.collectionKey, p.path]));
  // auto menu items: the newest records of a collection that has an item page
  const auto = new Map<string, any[]>();
  const wanted = new Set<string>();
  (function scan(items: any[]) { (items || []).forEach((it: any) => { if (it.type === "auto" && itemPaths[it.collectionKey]) wanted.add(it.collectionKey); scan(it.children); }); })(menus.flatMap((m: any) => m.items || []));
  for (const key of [...wanted].slice(0, 6)) {
    const col = await WebCollection.findOne({ website: site._id, key }).lean();
    if (!col) continue;
    const recs = await WebRecord.find({ website: site._id, collectionKey: key, ...(audience === "public" ? { status: "published", publishedAt: { $lte: new Date() } } : {}) }).sort({ publishedAt: -1, createdAt: -1 }).limit(20).lean();
    const titleKey = (col as any).settings?.titleField || (col as any).fields?.[0]?.key;
    auto.set(key, recs.map((rec: any) => ({ id: String(rec._id), label: String(rec.data?.[titleKey] || rec.slug).slice(0, 80), type: "page", href: itemPaths[key].replace(":slug", rec.slug), newTab: false, highlight: false, children: [] })));
  }
  return {
    site: { name: site.name, siteKey: site.siteKey, logoText: site.settings?.logoText || site.name, logoUrl: site.settings?.logoUrl || "" },
    theme: theme || {},
    page: { title: page.title, path: page.path, pageType: page.pageType || "static", collectionKey: page.collectionKey || "", seo: page.seo || {}, content: page.content },
    menus: Object.fromEntries(MENU_LOCATIONS.map((loc) => [loc, resolveMenu(menus.find((m: any) => m.location === loc)?.items || [], pathById, auto)])),
    // which "/x/:slug" page shows the records of each collection (for links to items)
    itemPaths,
    item,
    data: await pageData(site._id, page.content, audience, { page: query.page, q: query.q }),
    query: { page: Math.max(1, Number(query.page) || 1), q: str(query.q, 80) },
  };
}

/* ════════════════ public ════════════════ */
export const websitePublicRoutes = Router();
const renderLimiter = rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: true, legacyHeaders: false });
const liveSite = async (siteKey: unknown) => {
  const site = await Website.findOne({ siteKey: str(siteKey, 60).toLowerCase(), status: "published" }).lean();
  if (!site) throw new ApiError(404, "Website not found");
  return site;
};

/** The published render bundle for an address, or a 404. Used by the JSON API and by server rendering. */
export async function publicBundle(siteKey: unknown, path: unknown, query: any) {
  const site = await liveSite(siteKey);
  const [pages, menus] = await Promise.all([
    WebPage.find({ website: site._id, status: "published" }).select("title path isHome pageType collectionKey published seo").lean(),
    WebMenu.find({ website: site._id }).lean(),
  ]);
  const hit = await matchPage(site._id, pages, normalPath(path || "/"), "public");
  if (!hit) throw new ApiError(404, "Page not found");
  const bundle = await renderBundle(site, site.themePublished, { ...hit.page, content: hit.page.published }, pages, menus, hit.item, "public", query);
  return { siteId: String(site._id), bundle };
}

websitePublicRoutes.get("/public/site/:siteKey/render", renderLimiter, asyncHandler(async (req: any, res: any) => {
  const { bundle } = await publicBundle(req.params.siteKey, req.query.path, req.query);
  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
  ok(res, bundle);
}));

/** Every public address of a website: pages, plus one per published record of a dynamic page. */
export async function sitePaths(siteKey: unknown) {
  const site = await liveSite(siteKey);
  const pages = await WebPage.find({ website: site._id, status: "published" }).select("path pageType collectionKey").lean();
  const urls: string[] = [];
  for (const p of pages as any[]) {
    if (p.pageType !== "collectionItem") { urls.push(p.path === "/" ? "" : p.path); continue; }
    const recs = await WebRecord.find({ website: site._id, collectionKey: p.collectionKey, status: "published" }).select("slug").limit(5000).lean();
    recs.forEach((rec: any) => urls.push(p.path.replace(":slug", rec.slug)));
  }
  return { siteKey: site.siteKey, urls };
}

/** Sitemap: every published page, and one address per published record of a dynamic page. */
websitePublicRoutes.get("/public/site/:siteKey/sitemap.xml", renderLimiter, asyncHandler(async (req: any, res: any) => {
  const site = await liveSite(req.params.siteKey);
  const origin = `${req.protocol}://${req.get("host")}`.replace(/:4001$/, ":5173");
  const pages = await WebPage.find({ website: site._id, status: "published" }).select("path pageType collectionKey updatedAt").lean();
  const urls: string[] = [];
  for (const p of pages as any[]) {
    if (p.pageType !== "collectionItem") { urls.push(p.path === "/" ? "" : p.path); continue; }
    const recs = await WebRecord.find({ website: site._id, collectionKey: p.collectionKey, status: "published" }).select("slug").limit(5000).lean();
    recs.forEach((rec: any) => urls.push(p.path.replace(":slug", rec.slug)));
  }
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${origin}/site/${site.siteKey}${u}</loc></url>`).join("\n")}\n</urlset>`);
}));

/** A share link shows the DRAFT website to anyone holding the link, until it expires or is revoked. */
websitePublicRoutes.get("/public/preview/:token/render", renderLimiter, asyncHandler(async (req: any, res: any) => {
  const link = await WebShareLink.findOne({ tokenHash: sha256(str(req.params.token, 100)), revokedAt: null, expiresAt: { $gt: new Date() } });
  if (!link) throw new ApiError(404, "This preview link has expired");
  const site = await Website.findById(link.website);
  if (!site) throw new ApiError(404, "Website not found");
  WebShareLink.updateOne({ _id: link._id }, { $inc: { views: 1 } }).catch(() => {});
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
  ok(res, await draftBundle(site, req.query));
}));

export default r;
