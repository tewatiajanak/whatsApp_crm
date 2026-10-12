import { Router } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { require_ } from "../middleware/auth";
import { ok, asyncHandler, ApiError } from "../utils/http";
import { Website, WebPage, WebMenu, WebCollection, WebRecord, WebApiKey, WebWebhook, WebDataSource, WebSubmission, WebShareLink, WEB_EVENTS } from "../models/Website";
import { cleanFields, installCollections } from "./website";
import { purgeSite } from "../services/siteCache";
import { captureEnquiry } from "../services/leadCapture";
import { seal, unseal, sha256, assertPublicUrl, cleanRecordData, searchTextOf, recordSlug, queryRecords, shapeRecord, resolveSource, fetchSource, forgetSource, sampleSource, fireWebhooks, testWebhook } from "../services/websiteData";

/**
 * Website Builder data platform.
 *   admin  — collections, records, API keys, webhooks, external sources, form inbox, share links, apps, export
 *   public — Content Delivery API (/content/v1/sites/:siteKey/…, API key) and form posts
 */
const r = Router();
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const own = (req: any) => ({ website: req.params.siteId, tenant: req.tenantId });
async function siteOf(req: any) {
  const site = await Website.findOne({ _id: req.params.siteId, tenant: req.tenantId });
  if (!site) throw new ApiError(404, "Website not found");
  return site;
}
async function colOf(req: any) {
  const col = await WebCollection.findOne({ ...own(req), key: str(req.params.key, 40).toLowerCase() });
  if (!col) throw new ApiError(404, "Collection not found");
  return col;
}
const view = require_("setup", "view"), create = require_("setup", "create"), edit = require_("setup", "edit"), del = require_("setup", "del");

/* ───────────── collections ───────────── */
r.get("/websites/:siteId/collections", view, asyncHandler(async (req: any, res: any) => {
  await siteOf(req);
  const cols = await WebCollection.find(own(req)).sort({ name: 1 }).lean();
  const counts = await WebRecord.aggregate([{ $match: { website: cols[0]?.website || null } }, { $group: { _id: "$collectionKey", n: { $sum: 1 } } }]);
  const n = new Map(counts.map((c: any) => [c._id, c.n]));
  ok(res, cols.map((c: any) => ({ ...c, records: n.get(c.key) || 0 })));
}));

r.post("/websites/:siteId/collections", create, asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  const name = str(req.body?.name, 80);
  if (!name) throw new ApiError(400, "Collection name is required");
  const key = (str(req.body?.key, 40) || name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "c$1").slice(0, 40);
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) throw new ApiError(400, "Use letters and numbers for the collection key");
  if (await WebCollection.exists({ website: site._id, key })) throw new ApiError(409, "A collection with this key already exists");
  const fields = cleanFields(req.body?.fields);
  ok(res, await WebCollection.create({ tenant: req.tenantId, website: site._id, key, name, fields: fields.length ? fields : [{ key: "title", label: "Title", type: "text", required: true, options: [], relation: "", hiddenFromApi: false }], settings: { titleField: fields[0]?.key || "title", apiEnabled: false } }), 201);
}));

r.patch("/websites/:siteId/collections/:key", edit, asyncHandler(async (req: any, res: any) => {
  const col = await colOf(req);
  if (req.body?.name !== undefined) { const n = str(req.body.name, 80); if (!n) throw new ApiError(400, "Collection name is required"); col.name = n; }
  if (req.body?.fields !== undefined) {
    const fields = cleanFields(req.body.fields);
    if (!fields.length) throw new ApiError(400, "A collection needs at least one field");
    col.fields = fields as any; col.markModified("fields");
  }
  if (req.body?.settings && typeof req.body.settings === "object") {
    const s = req.body.settings;
    col.settings = { ...col.settings, titleField: (col.fields as any[]).some((f) => f.key === s.titleField) ? s.titleField : col.fields[0].key, apiEnabled: !!s.apiEnabled, publicWithoutKey: !!s.publicWithoutKey };
    col.markModified("settings");
  }
  await col.save();
  ok(res, col);
}));

r.delete("/websites/:siteId/collections/:key", del, asyncHandler(async (req: any, res: any) => {
  const col = await colOf(req);
  if (await WebPage.exists({ website: col.website, pageType: "collectionItem", collectionKey: col.key })) throw new ApiError(409, "A page shows this collection. Delete or change that page first.");
  await WebRecord.deleteMany({ ...own(req), collectionKey: col.key });
  await col.deleteOne();
  purgeSite(col.website);
  ok(res, { deleted: true });
}));

/* ───────────── records ───────────── */
r.get("/websites/:siteId/collections/:key/records", view, asyncHandler(async (req: any, res: any) => {
  const col = await colOf(req);
  ok(res, await queryRecords(col, { filter: req.query.filter, sort: str(req.query.sort, 60) || "-updatedAt", limit: Number(req.query.limit) || 25, page: req.query.page, search: req.query.search }, "admin"));
}));

async function uniqueSlug(col: any, wanted: string, exceptId?: any) {
  const base = recordSlug(wanted) || "item";
  let slug = base;
  for (let i = 2; await WebRecord.exists({ website: col.website, collectionKey: col.key, slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }); i++) slug = `${base.slice(0, 74)}-${i}`;
  return slug;
}

r.post("/websites/:siteId/collections/:key/records", create, asyncHandler(async (req: any, res: any) => {
  const col = await colOf(req);
  const data = cleanRecordData(col.fields, req.body?.data);
  const publish = req.body?.status === "published";
  const rec = await WebRecord.create({ tenant: req.tenantId, website: col.website, collectionKey: col.key, slug: await uniqueSlug(col, str(req.body?.slug, 80) || String(data[col.settings?.titleField || col.fields[0].key] || "")), status: publish ? "published" : "draft", publishedAt: publish ? new Date() : null, data, searchText: searchTextOf(col.fields, data) });
  purgeSite(col.website);
  fireWebhooks(col.website, "record.created", { collection: col.key, record: shapeRecord(col, rec, "public") });
  if (publish) fireWebhooks(col.website, "record.published", { collection: col.key, record: shapeRecord(col, rec, "public") });
  ok(res, shapeRecord(col, rec, "admin"), 201);
}));

r.patch("/websites/:siteId/collections/:key/records/:recordId", edit, asyncHandler(async (req: any, res: any) => {
  const col = await colOf(req);
  const rec = await WebRecord.findOne({ _id: req.params.recordId, ...own(req), collectionKey: col.key });
  if (!rec) throw new ApiError(404, "Record not found");
  if (req.body?.data !== undefined) { rec.data = cleanRecordData(col.fields, req.body.data); rec.markModified("data"); rec.searchText = searchTextOf(col.fields, rec.data); }
  if (req.body?.slug !== undefined && str(req.body.slug, 80)) rec.slug = await uniqueSlug(col, str(req.body.slug, 80), rec._id);
  const wasLive = rec.status === "published";
  if (req.body?.status === "published" && !wasLive) { rec.status = "published"; rec.publishedAt = rec.publishedAt || new Date(); }
  if (req.body?.status === "draft") rec.status = "draft";
  await rec.save();
  purgeSite(col.website);
  fireWebhooks(col.website, "record.updated", { collection: col.key, record: shapeRecord(col, rec, "public") });
  if (!wasLive && rec.status === "published") fireWebhooks(col.website, "record.published", { collection: col.key, record: shapeRecord(col, rec, "public") });
  ok(res, shapeRecord(col, rec, "admin"));
}));

r.delete("/websites/:siteId/collections/:key/records/:recordId", del, asyncHandler(async (req: any, res: any) => {
  const col = await colOf(req);
  const rec = await WebRecord.findOneAndDelete({ _id: req.params.recordId, ...own(req), collectionKey: col.key });
  if (!rec) throw new ApiError(404, "Record not found");
  purgeSite(col.website);
  fireWebhooks(col.website, "record.deleted", { collection: col.key, id: String(rec._id), slug: rec.slug });
  ok(res, { deleted: true });
}));

/** Import rows (already parsed from CSV/JSON in the browser). `dryRun` only reports problems. */
r.post("/websites/:siteId/collections/:key/import", create, asyncHandler(async (req: any, res: any) => {
  const col = await colOf(req);
  const rows: any[] = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 1000) : [];
  const errors: { row: number; error: string }[] = [];
  const good: any[] = [];
  rows.forEach((row, i) => { try { good.push(cleanRecordData(col.fields, row)); } catch (e: any) { errors.push({ row: i + 1, error: e.message }); } });
  if (req.body?.dryRun) return ok(res, { total: rows.length, valid: good.length, errors: errors.slice(0, 50) });
  let created = 0;
  for (const data of good) {
    await WebRecord.create({ tenant: req.tenantId, website: col.website, collectionKey: col.key, slug: await uniqueSlug(col, String(data[col.settings?.titleField || col.fields[0].key] || "")), status: req.body?.publish ? "published" : "draft", publishedAt: req.body?.publish ? new Date() : null, data, searchText: searchTextOf(col.fields, data) });
    created++;
  }
  purgeSite(col.website);
  ok(res, { total: rows.length, created, errors: errors.slice(0, 50) });
}));

/* ───────────── data for the builder ───────────── */
/** Sources a page can use, each with its field list (for the binding and repeater pickers). */
r.get("/websites/:siteId/data/sources", view, asyncHandler(async (req: any, res: any) => {
  await siteOf(req);
  const [cols, apis] = await Promise.all([WebCollection.find(own(req)).lean(), WebDataSource.find(own(req)).select("key name fields").lean()]);
  ok(res, [
    ...cols.map((c: any) => ({ ref: `collection:${c.key}`, name: c.name, kind: "collection", fields: [{ key: "slug", label: "Slug", type: "text" }, ...c.fields.map((f: any) => ({ key: f.key, label: f.label, type: f.type }))] })),
    ...apis.map((a: any) => ({ ref: `api:${a.key}`, name: a.name, kind: "api", fields: (a.fields || []).map((f: any) => ({ key: f.key, label: f.key, type: "text" })) })),
  ]);
}));

r.post("/websites/:siteId/data/resolve", view, asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  ok(res, await resolveSource(site._id, str(req.body?.sourceRef, 80), req.body?.query || {}, "admin"));
}));

/** Search pages and collections of a website (command palette). */
r.get("/websites/:siteId/search", view, asyncHandler(async (req: any, res: any) => {
  await siteOf(req);
  const q = str(req.query.q, 60);
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [pages, cols] = await Promise.all([WebPage.find({ ...own(req), title: rx }).select("title path").limit(12).lean(), WebCollection.find({ ...own(req), name: rx }).select("key name").limit(8).lean()]);
  ok(res, { pages, collections: cols });
}));

/* ───────────── API keys ───────────── */
const keyRow = (k: any) => ({ _id: k._id, name: k.name, prefix: k.prefix, allowedOrigins: k.allowedOrigins, allowedCollections: k.allowedCollections, status: k.status, expiresAt: k.expiresAt, lastUsedAt: k.lastUsedAt, uses: k.uses, createdAt: k.createdAt });
r.get("/websites/:siteId/api-keys", view, asyncHandler(async (req: any, res: any) => { await siteOf(req); ok(res, (await WebApiKey.find(own(req)).sort({ createdAt: -1 }).lean()).map(keyRow)); }));
r.post("/websites/:siteId/api-keys", create, asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  const name = str(req.body?.name, 80);
  if (!name) throw new ApiError(400, "Key name is required");
  const secret = `wbk_live_${crypto.randomBytes(24).toString("base64url")}`;
  const days = Number(req.body?.expiresInDays);
  const origins = (Array.isArray(req.body?.allowedOrigins) ? req.body.allowedOrigins : []).map((o: any) => str(o, 200).replace(/\/+$/, "")).filter((o: string) => /^https?:\/\/[^/]+$/.test(o)).slice(0, 10);
  const key = await WebApiKey.create({ tenant: req.tenantId, website: site._id, name, prefix: secret.slice(0, 14), hash: sha256(secret), allowedOrigins: origins, allowedCollections: (Array.isArray(req.body?.allowedCollections) ? req.body.allowedCollections : []).map((c: any) => str(c, 40)).filter(Boolean).slice(0, 30), expiresAt: days > 0 ? new Date(Date.now() + Math.min(days, 3650) * 86_400_000) : null });
  // the full key is shown this once and never again
  ok(res, { ...keyRow(key), key: secret }, 201);
}));
r.post("/websites/:siteId/api-keys/:keyId/revoke", edit, asyncHandler(async (req: any, res: any) => {
  const done = await WebApiKey.findOneAndUpdate({ _id: req.params.keyId, ...own(req) }, { status: "revoked" }, { new: true });
  if (!done) throw new ApiError(404, "Key not found");
  ok(res, keyRow(done));
}));
r.delete("/websites/:siteId/api-keys/:keyId", del, asyncHandler(async (req: any, res: any) => {
  const done = await WebApiKey.deleteOne({ _id: req.params.keyId, ...own(req) });
  if (!done.deletedCount) throw new ApiError(404, "Key not found");
  ok(res, { deleted: true });
}));

/* ───────────── webhooks ───────────── */
const hookRow = (h: any) => ({ _id: h._id, name: h.name, url: h.url, events: h.events, active: h.active, failures: h.failures, deliveries: h.deliveries || [], createdAt: h.createdAt });
const cleanEvents = (v: any) => (Array.isArray(v) ? v : []).filter((e: any) => (WEB_EVENTS as readonly string[]).includes(e));
r.get("/websites/:siteId/webhooks", view, asyncHandler(async (req: any, res: any) => { await siteOf(req); ok(res, (await WebWebhook.find(own(req)).sort({ createdAt: -1 }).lean()).map(hookRow)); }));
r.post("/websites/:siteId/webhooks", create, asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  const name = str(req.body?.name, 80), url = str(req.body?.url, 500), events = cleanEvents(req.body?.events);
  if (!name || !events.length) throw new ApiError(400, "Name and at least one event are required");
  await assertPublicUrl(url);
  const secret = `whsec_${crypto.randomBytes(24).toString("base64url")}`;
  const hook = await WebWebhook.create({ tenant: req.tenantId, website: site._id, name, url, events, secret: seal(secret) });
  ok(res, { ...hookRow(hook), secret }, 201);
}));
r.patch("/websites/:siteId/webhooks/:hookId", edit, asyncHandler(async (req: any, res: any) => {
  const hook = await WebWebhook.findOne({ _id: req.params.hookId, ...own(req) });
  if (!hook) throw new ApiError(404, "Webhook not found");
  if (req.body?.name !== undefined) hook.name = str(req.body.name, 80) || hook.name;
  if (req.body?.url !== undefined) { await assertPublicUrl(str(req.body.url, 500)); hook.url = str(req.body.url, 500); }
  if (req.body?.events !== undefined) { const ev = cleanEvents(req.body.events); if (!ev.length) throw new ApiError(400, "Choose at least one event"); hook.events = ev; }
  if (req.body?.active !== undefined) { hook.active = !!req.body.active; if (hook.active) hook.failures = 0; }
  await hook.save();
  ok(res, hookRow(hook));
}));
r.post("/websites/:siteId/webhooks/:hookId/test", edit, asyncHandler(async (req: any, res: any) => {
  const hook = await WebWebhook.findOne({ _id: req.params.hookId, ...own(req) }).lean();
  if (!hook) throw new ApiError(404, "Webhook not found");
  await testWebhook(hook);
  ok(res, hookRow(await WebWebhook.findById(hook._id).lean()));
}));
r.delete("/websites/:siteId/webhooks/:hookId", del, asyncHandler(async (req: any, res: any) => {
  const done = await WebWebhook.deleteOne({ _id: req.params.hookId, ...own(req) });
  if (!done.deletedCount) throw new ApiError(404, "Webhook not found");
  ok(res, { deleted: true });
}));

/* ───────────── external data sources ───────────── */
const srcRow = (s: any) => ({ _id: s._id, key: s.key, name: s.name, url: s.url, rootPath: s.rootPath, fields: s.fields || [], ttlSeconds: s.ttlSeconds, hasHeaders: !!s.headersEnc, lastSuccessAt: s.lastSuccessAt, lastErrorAt: s.lastErrorAt, lastError: s.lastError, failures: s.failures, state: s.failures >= 5 ? "circuit open" : s.lastError ? "failing" : s.lastSuccessAt ? "healthy" : "new" });
function cleanHeaders(input: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input).slice(0, 12)) {
    const name = String(k).trim();
    // header names and values must not be able to break out of the header line
    if (/^[A-Za-z0-9-]{1,60}$/.test(name) && !["host", "content-length"].includes(name.toLowerCase()) && typeof v === "string" && !/[\r\n]/.test(v)) out[name] = v.slice(0, 1000);
  }
  return out;
}
const cleanMap = (v: any) => (Array.isArray(v) ? v : []).slice(0, 30).flatMap((f: any) => { const key = str(f?.key, 40).replace(/[^A-Za-z0-9_]/g, ""); const path = str(f?.path, 200); return key && path && !/__proto__|constructor|prototype/.test(path) ? [{ key, path }] : []; });

r.get("/websites/:siteId/data-sources", view, asyncHandler(async (req: any, res: any) => { await siteOf(req); ok(res, (await WebDataSource.find(own(req)).sort({ name: 1 }).lean()).map(srcRow)); }));
/** Try a URL before saving it: returns the JSON so the fields can be mapped. */
r.post("/websites/:siteId/data-sources/test", edit, asyncHandler(async (req: any, res: any) => {
  await siteOf(req);
  let headers = cleanHeaders(req.body?.headers);
  // re-testing a saved source reuses its stored headers; they are never sent to the browser
  if (req.body?.sourceId && !Object.keys(headers).length) { const s = await WebDataSource.findOne({ _id: req.body.sourceId, ...own(req) }).lean(); try { headers = JSON.parse(unseal(s?.headersEnc || "") || "{}"); } catch { headers = {}; } }
  const out = await sampleSource(str(req.body?.url, 1000), headers);
  const text = JSON.stringify(out.body);
  ok(res, { status: out.status, body: text.length > 60_000 ? JSON.parse(JSON.stringify(Array.isArray(out.body) ? out.body.slice(0, 3) : out.body, (_k, v) => (Array.isArray(v) ? v.slice(0, 3) : typeof v === "string" ? v.slice(0, 200) : v))) : out.body });
}));
r.post("/websites/:siteId/data-sources", create, asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  const name = str(req.body?.name, 80);
  if (!name) throw new ApiError(400, "Source name is required");
  const key = (str(req.body?.key, 40) || name).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "s$1").slice(0, 40);
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) throw new ApiError(400, "Use letters and numbers for the source key");
  if (await WebDataSource.exists({ website: site._id, key })) throw new ApiError(409, "A source with this key already exists");
  const url = str(req.body?.url, 1000);
  await assertPublicUrl(url);
  const headers = cleanHeaders(req.body?.headers);
  ok(res, srcRow(await WebDataSource.create({ tenant: req.tenantId, website: site._id, key, name, url, headersEnc: Object.keys(headers).length ? seal(JSON.stringify(headers)) : "", rootPath: str(req.body?.rootPath, 200), fields: cleanMap(req.body?.fields), ttlSeconds: Math.min(86400, Math.max(30, Number(req.body?.ttlSeconds) || 300)) })), 201);
}));
r.patch("/websites/:siteId/data-sources/:sourceId", edit, asyncHandler(async (req: any, res: any) => {
  const src = await WebDataSource.findOne({ _id: req.params.sourceId, ...own(req) });
  if (!src) throw new ApiError(404, "Source not found");
  if (req.body?.name !== undefined) src.name = str(req.body.name, 80) || src.name;
  if (req.body?.url !== undefined) { await assertPublicUrl(str(req.body.url, 1000)); src.url = str(req.body.url, 1000); }
  if (req.body?.headers !== undefined) { const h = cleanHeaders(req.body.headers); src.headersEnc = Object.keys(h).length ? seal(JSON.stringify(h)) : ""; }
  if (req.body?.rootPath !== undefined) src.rootPath = str(req.body.rootPath, 200);
  if (req.body?.fields !== undefined) { src.fields = cleanMap(req.body.fields) as any; src.markModified("fields"); }
  if (req.body?.ttlSeconds !== undefined) src.ttlSeconds = Math.min(86400, Math.max(30, Number(req.body.ttlSeconds) || 300));
  src.failures = 0; src.lastError = "";
  await src.save();
  forgetSource(String(src._id));
  ok(res, srcRow(src));
}));
r.post("/websites/:siteId/data-sources/:sourceId/refresh", edit, asyncHandler(async (req: any, res: any) => {
  const src = await WebDataSource.findOne({ _id: req.params.sourceId, ...own(req) }).lean();
  if (!src) throw new ApiError(404, "Source not found");
  const out = await fetchSource(src, { force: true });
  purgeSite(src.website);
  ok(res, { items: out.items.slice(0, 10), total: out.items.length, stale: out.stale });
}));
r.delete("/websites/:siteId/data-sources/:sourceId", del, asyncHandler(async (req: any, res: any) => {
  const done = await WebDataSource.findOneAndDelete({ _id: req.params.sourceId, ...own(req) });
  if (!done) throw new ApiError(404, "Source not found");
  forgetSource(String(done._id));
  ok(res, { deleted: true });
}));

/* ───────────── form inbox ───────────── */
r.get("/websites/:siteId/submissions", view, asyncHandler(async (req: any, res: any) => {
  await siteOf(req);
  const page = Math.max(1, Number(req.query.page) || 1), limit = 25;
  const [items, total, unread] = await Promise.all([WebSubmission.find(own(req)).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), WebSubmission.countDocuments(own(req)), WebSubmission.countDocuments({ ...own(req), read: false })]);
  ok(res, { items, total, unread, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
}));
r.patch("/websites/:siteId/submissions/:subId", edit, asyncHandler(async (req: any, res: any) => {
  const done = await WebSubmission.findOneAndUpdate({ _id: req.params.subId, ...own(req) }, { read: !!req.body?.read }, { new: true });
  if (!done) throw new ApiError(404, "Submission not found");
  ok(res, done);
}));
r.delete("/websites/:siteId/submissions/:subId", del, asyncHandler(async (req: any, res: any) => {
  const done = await WebSubmission.deleteOne({ _id: req.params.subId, ...own(req) });
  if (!done.deletedCount) throw new ApiError(404, "Submission not found");
  ok(res, { deleted: true });
}));

/* ───────────── share links (draft preview for people without a login) ───────────── */
const linkRow = (l: any) => ({ _id: l._id, label: l.label, expiresAt: l.expiresAt, views: l.views, revokedAt: l.revokedAt, createdAt: l.createdAt });
r.get("/websites/:siteId/share-links", view, asyncHandler(async (req: any, res: any) => { await siteOf(req); ok(res, (await WebShareLink.find({ ...own(req), revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean()).map(linkRow)); }));
r.post("/websites/:siteId/share-links", edit, asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  const hours = Math.min(720, Math.max(1, Number(req.body?.hours) || 72));
  const token = crypto.randomBytes(32).toString("base64url");
  const link = await WebShareLink.create({ tenant: req.tenantId, website: site._id, tokenHash: sha256(token), label: str(req.body?.label, 80), expiresAt: new Date(Date.now() + hours * 3_600_000) });
  ok(res, { ...linkRow(link), token }, 201);
}));
r.delete("/websites/:siteId/share-links/:linkId", edit, asyncHandler(async (req: any, res: any) => {
  const done = await WebShareLink.findOneAndUpdate({ _id: req.params.linkId, ...own(req) }, { revokedAt: new Date() });
  if (!done) throw new ApiError(404, "Link not found");
  ok(res, { revoked: true });
}));

/* ───────────── apps (feature kits) and template export ───────────── */
/** Install a kit: its collections with sample records, and its pages (as drafts). Existing keys and addresses are left alone. */
r.post("/websites/:siteId/apps/install", create, asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  const pkg = req.body?.app;
  const key = str(pkg?.key, 40);
  if (!key) throw new ApiError(400, "App is not valid");
  const madeCols = await installCollections(req.tenantId, site._id, pkg.collections, req.body?.sample === false ? {} : pkg.records);
  const madePages: string[] = [];
  for (const p of Array.isArray(pkg.pages) ? pkg.pages.slice(0, 10) : []) {
    const path = String(p.path || "").toLowerCase();
    if (!/^\/([a-z0-9-]+(\/[a-z0-9-]+)*(\/:slug)?)$/.test(path) || (await WebPage.exists({ website: site._id, path }))) continue;
    const page = await WebPage.create({ tenant: req.tenantId, website: site._id, title: str(p.title, 160) || "Page", path, pageType: path.endsWith("/:slug") ? "collectionItem" : "static", collectionKey: str(p.collectionKey, 40), draft: p.content, order: await WebPage.countDocuments({ website: site._id }) }).catch(() => null);
    if (page) madePages.push(String(page._id));
  }
  // installing again must not forget what the first install created (uninstall needs the full list)
  const prev = (site.settings as any).apps?.[key];
  const apps = { ...(site.settings as any).apps, [key]: { name: str(pkg.name, 60), installedAt: prev?.installedAt || new Date(), collections: [...new Set([...(prev?.collections || []), ...madeCols])], pages: [...new Set([...(prev?.pages || []), ...madePages])] } };
  site.settings = { ...site.settings, apps } as any;
  site.markModified("settings");
  await site.save();
  ok(res, { collections: madeCols, pages: madePages.length });
}));

/** Remove an installed kit. `removeContent` also deletes the collections, records and pages it created. */
r.post("/websites/:siteId/apps/:appKey/uninstall", del, asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  const apps = { ...((site.settings as any).apps || {}) };
  const app = apps[req.params.appKey];
  if (!app) throw new ApiError(404, "App is not installed");
  if (req.body?.removeContent) {
    await WebPage.deleteMany({ ...own(req), _id: { $in: app.pages || [] }, isHome: false });
    await WebRecord.deleteMany({ ...own(req), collectionKey: { $in: app.collections || [] } });
    await WebCollection.deleteMany({ ...own(req), key: { $in: app.collections || [] } });
  }
  delete apps[req.params.appKey];
  site.settings = { ...site.settings, apps } as any;
  site.markModified("settings");
  await site.save();
  ok(res, { removed: true });
}));

/** The website as a template package. Never includes submissions, API keys, webhooks, source headers or users. */
r.get("/websites/:siteId/export", view, asyncHandler(async (req: any, res: any) => {
  const site = await siteOf(req);
  const [pages, menus, cols] = await Promise.all([WebPage.find(own(req)).sort({ isHome: -1, order: 1 }).lean(), WebMenu.find(own(req)).lean(), WebCollection.find(own(req)).lean()]);
  const refById = new Map(pages.map((p: any, i: number) => [String(p._id), `p${i}`]));
  const toRefs = (items: any[]): any[] => (items || []).map((it: any) => ({ label: it.label, type: it.type, url: it.url, newTab: it.newTab, highlight: it.highlight, pageRef: refById.get(String(it.pageId)), children: toRefs(it.children) }));
  const records: Record<string, any[]> = {};
  if (req.query.records !== "0") for (const c of cols as any[]) records[c.key] = (await WebRecord.find({ ...own(req), collectionKey: c.key }).limit(60).lean()).map((rec: any) => ({ slug: rec.slug, ...rec.data }));
  ok(res, {
    templateSchemaVersion: 1, key: `export-${site.siteKey}`, name: site.name, exportedAt: new Date().toISOString(), theme: site.themeDraft,
    pages: pages.map((p: any) => ({ ref: refById.get(String(p._id)), title: p.title, path: p.path, isHome: p.isHome, pageType: p.pageType, collectionKey: p.collectionKey, seo: p.seo, content: p.draft })),
    menus: menus.map((m: any) => ({ location: m.location, items: toRefs(m.items) })),
    collections: cols.map((c: any) => ({ key: c.key, name: c.name, fields: c.fields, settings: { titleField: c.settings?.titleField, apiEnabled: !!c.settings?.apiEnabled } })),
    records,
  });
}));

/* ════════════════ public ════════════════ */
export const websiteDataPublicRoutes = Router();

/** Form posts from a published website. Text only; stored for the website's inbox. */
const formLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
websiteDataPublicRoutes.post("/public/site/:siteKey/forms", formLimiter, asyncHandler(async (req: any, res: any) => {
  const site = await Website.findOne({ siteKey: str(req.params.siteKey, 60).toLowerCase(), status: "published" }).lean();
  if (!site) throw new ApiError(404, "Website not found");
  // a filled honeypot means a bot: answer politely, store nothing
  if (str(req.body?.website_url, 10)) return ok(res, { received: true });
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.body?.data && typeof req.body.data === "object" ? req.body.data : {}).slice(0, 30)) {
    const name = String(k).replace(/[.$]/g, " ").trim().slice(0, 60);
    if (name && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) data[name] = String(v).slice(0, 4000);
  }
  if (!Object.values(data).some(Boolean)) throw new ApiError(400, "The form is empty");
  const sub = await WebSubmission.create({ tenant: site.tenant, website: site._id, form: str(req.body?.form, 80) || "Form", pagePath: str(req.body?.page, 200) || "/", data });
  fireWebhooks(site._id, "form.submitted", { form: sub.form, page: sub.pagePath, data });
  // when the website owner turned it on, a submission with a name and a phone also becomes a CRM lead
  if ((site.settings as any)?.leadCapture) {
    captureEnquiry(site.tenant, data, `Website: ${site.name}`, { source: "Website" })
      .then(() => WebSubmission.updateOne({ _id: sub._id }, { leadCreated: true }))
      .catch(() => { /* no name/phone, or a duplicate: the submission is still in the inbox */ });
  }
  ok(res, { received: true }, 201);
}));

/* ---- Content Delivery API: read-only, API key in X-API-Key ---- */
const contentLimiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false, keyGenerator: (req: any) => String(req.headers["x-api-key"] || req.ip) });
const api = Router({ mergeParams: true });

api.use(contentLimiter, asyncHandler(async (req: any, res: any, next: any) => {
  const site = await Website.findOne({ siteKey: str(req.params.siteKey, 60).toLowerCase() }).lean();
  if (!site) throw new ApiError(404, "Website not found");
  req.site = site;
  const raw = str(req.headers["x-api-key"], 200);
  if (raw) {
    const key = await WebApiKey.findOne({ hash: sha256(raw), website: site._id });
    if (!key || key.status !== "active" || (key.expiresAt && key.expiresAt < new Date())) throw new ApiError(401, "This API key is not valid");
    req.apiKey = key;
    WebApiKey.updateOne({ _id: key._id }, { lastUsedAt: new Date(), $inc: { uses: 1 } }).catch(() => {});
    // browsers may only call from the origins the key lists
    const origin = str(req.headers.origin, 200);
    if (origin && key.allowedOrigins.includes(origin)) { res.set("Access-Control-Allow-Origin", origin); res.set("Vary", "Origin"); }
  }
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  next();
}));

/** A collection is readable when it is API-enabled and the caller has a key for it (or the owner made it public). */
async function readable(req: any, key: string) {
  const col = await WebCollection.findOne({ website: req.site._id, key: str(key, 40).toLowerCase() });
  if (!col || !col.settings?.apiEnabled) throw new ApiError(404, "Collection not found");
  if (!req.apiKey && !col.settings?.publicWithoutKey) throw new ApiError(401, "An API key is required (X-API-Key header)");
  if (req.apiKey?.allowedCollections?.length && !req.apiKey.allowedCollections.includes(col.key)) throw new ApiError(403, "This key cannot read that collection");
  return col;
}
api.get("/collections", asyncHandler(async (req: any, res: any) => {
  const cols = await WebCollection.find({ website: req.site._id, "settings.apiEnabled": true }).lean();
  const mine = cols.filter((c: any) => (req.apiKey ? !req.apiKey.allowedCollections.length || req.apiKey.allowedCollections.includes(c.key) : c.settings?.publicWithoutKey));
  if (!req.apiKey && !mine.length) throw new ApiError(401, "An API key is required (X-API-Key header)");
  ok(res, mine.map((c: any) => ({ key: c.key, name: c.name, fields: c.fields.filter((f: any) => !f.hiddenFromApi).map((f: any) => ({ key: f.key, label: f.label, type: f.type })) })));
}));
api.get("/collections/:key/items", asyncHandler(async (req: any, res: any) => {
  const col = await readable(req, req.params.key);
  ok(res, await queryRecords(col, { filter: req.query.filter, sort: str(req.query.sort, 60), limit: req.query.limit, page: req.query.page, search: req.query.search }, "public"));
}));
api.get("/collections/:key/items/:idOrSlug", asyncHandler(async (req: any, res: any) => {
  const col = await readable(req, req.params.key);
  const v = str(req.params.idOrSlug, 80);
  const rec = await WebRecord.findOne({ website: req.site._id, collectionKey: col.key, status: "published", publishedAt: { $lte: new Date() }, ...(/^[a-f0-9]{24}$/.test(v) ? { _id: v } : { slug: v.toLowerCase() }) }).lean();
  if (!rec) throw new ApiError(404, "Item not found");
  ok(res, { item: shapeRecord(col, rec, "public") });
}));
api.get("/pages", asyncHandler(async (req: any, res: any) => {
  if (!req.apiKey) throw new ApiError(401, "An API key is required (X-API-Key header)");
  const pages = await WebPage.find({ website: req.site._id, status: "published" }).select("title path seo publishedAt").lean();
  ok(res, pages.map((p: any) => ({ title: p.title, path: p.path, seo: p.seo || {}, publishedAt: p.publishedAt })));
}));
websiteDataPublicRoutes.use("/content/v1/sites/:siteKey", api);

export default r;
