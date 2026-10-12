import crypto from "crypto";
import dns from "dns";
import net from "net";
import { config } from "../config";
import { ApiError } from "../utils/http";
import { WebCollection, WebRecord, WebDataSource, WebWebhook, IWebField, IWebCollection } from "../models/Website";

/**
 * Website Builder data layer: one place that reads data for pages, the Content
 * Delivery API and previews.
 *   collection:<key>  records of a content collection
 *   api:<key>         an external REST source (fetched server-side, cached)
 */

/* ───────────── secrets at rest ───────────── */
const secretKey = () => crypto.createHash("sha256").update(process.env.DATA_SOURCE_SECRET_KEY || config.jwtSecret).digest();
export function seal(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}
export function unseal(sealed: string): string {
  if (!sealed) return "";
  try {
    const [iv, tag, body] = sealed.split(".").map((p) => Buffer.from(p, "base64"));
    const d = crypto.createDecipheriv("aes-256-gcm", secretKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(body), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}
export const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

/* ───────────── SSRF guard (webhooks + external sources) ───────────── */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff");
}
/** Only https URLs whose host resolves to public addresses may be called. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ApiError(400, "That is not a valid URL"); }
  if (url.protocol !== "https:") throw new ApiError(400, "Only https:// addresses are allowed");
  if (url.username || url.password) throw new ApiError(400, "The address must not contain a user name or password");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.promises.lookup(host, { all: true }).catch(() => { throw new ApiError(400, "That host could not be found"); });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new ApiError(400, "That address points to a private network and cannot be used");
  return url;
}
/** GET/POST with a time limit, a size limit and no automatic redirects to unchecked hosts. */
async function safeFetch(raw: string, init: { method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; maxBytes?: number } = {}) {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), init.timeoutMs || 8000);
    try {
      const res = await fetch(url, { method: init.method || "GET", headers: init.headers, body: init.body, redirect: "manual", signal: ctl.signal });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = await assertPublicUrl(new URL(res.headers.get("location") as string, url).toString());
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > (init.maxBytes || 2_000_000)) throw new ApiError(502, "The response is too large");
      return { status: res.status, ok: res.ok, text: buf.toString("utf8") };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ApiError(502, "Too many redirects");
}

/* ───────────── collections: values and queries ───────────── */
const slugify = (v: string) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
export const recordSlug = slugify;
const isSafeUrl = (v: string) => /^https:\/\//i.test(v) || v.startsWith("/uploads/") || v === "";

/** Keep only declared fields, each coerced to its type. Throws on a missing required field. */
export function cleanRecordData(fields: IWebField[], input: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    let v = input?.[f.key];
    switch (f.type) {
      case "number": v = v === "" || v == null ? null : Number(v); if (v !== null && !Number.isFinite(v)) throw new ApiError(400, `${f.label} must be a number`); break;
      case "boolean": v = v === true || v === "true"; break;
      case "date": v = v ? new Date(v) : null; if (v && isNaN(v.getTime())) throw new ApiError(400, `${f.label} must be a date`); v = v ? v.toISOString() : null; break;
      case "tags": v = (Array.isArray(v) ? v : String(v || "").split(",")).map((t: any) => String(t).trim().slice(0, 60)).filter(Boolean).slice(0, 30); break;
      case "select": v = String(v ?? ""); if (v && f.options?.length && !f.options.includes(v)) throw new ApiError(400, `${f.label} has an unknown option`); break;
      case "image": case "url": v = String(v ?? "").trim().slice(0, 1000); if (!isSafeUrl(v) && !(f.type === "url" && /^(\/|mailto:|tel:)/.test(v))) throw new ApiError(400, `${f.label} must be an https:// address`); break;
      case "richtext": v = String(v ?? "").slice(0, 100_000); break;
      default: v = String(v ?? "").slice(0, f.type === "textarea" ? 10_000 : 500);
    }
    if (f.required && (v === "" || v == null || (Array.isArray(v) && !v.length))) throw new ApiError(400, `${f.label} is required`);
    out[f.key] = v;
  }
  return out;
}
export const searchTextOf = (fields: IWebField[], data: Record<string, any>) => fields.filter((f) => ["text", "textarea", "tags", "select"].includes(f.type)).map((f) => (Array.isArray(data[f.key]) ? data[f.key].join(" ") : data[f.key] || "")).join(" ").toLowerCase().slice(0, 4000);

const OPS: Record<string, string> = { eq: "$eq", ne: "$ne", gt: "$gt", gte: "$gte", lt: "$lt", lte: "$lte", in: "$in" };
export interface ListQuery { filter?: any; sort?: string; limit?: number; page?: number; search?: string }
const rx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Build a Mongo filter from user input. Field names and operators are checked against the collection, so nothing unvetted reaches the driver. */
export function buildRecordFilter(col: IWebCollection, q: ListQuery, audience: "admin" | "public") {
  const fields: IWebField[] = col.fields || [];
  const byKey = new Map<string, IWebField>(fields.map((f) => [f.key, f]));
  const mongo: any = { website: col.website, collectionKey: col.key };
  if (audience === "public") { mongo.status = "published"; mongo.publishedAt = { $lte: new Date() }; }
  const cast = (f: IWebField, v: any) => (f.type === "number" ? Number(v) : f.type === "boolean" ? v === true || v === "true" : f.type === "date" ? new Date(String(v)).toISOString() : String(v).slice(0, 200));
  const filter = q.filter && typeof q.filter === "object" && !Array.isArray(q.filter) ? q.filter : {};
  for (const [key, raw] of Object.entries(filter).slice(0, 12)) {
    const f = byKey.get(key);
    if (!f || (audience === "public" && f.hiddenFromApi)) continue;
    const cond = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, any>) : { eq: raw };
    const part: any = {};
    for (const [op, val] of Object.entries(cond)) {
      if (op === "contains") part.$regex = new RegExp(rx(String(val).slice(0, 100)), "i");
      else if (op === "in") part.$in = (Array.isArray(val) ? val : String(val).split(",")).slice(0, 30).map((x) => cast(f, x));
      else if (OPS[op]) part[OPS[op]] = cast(f, val);
    }
    if (Object.keys(part).length) mongo[`data.${key}`] = part;
  }
  const search = typeof q.search === "string" ? q.search.trim().toLowerCase().slice(0, 80) : "";
  if (search) mongo.searchText = { $regex: new RegExp(rx(search)) };
  const sortKey = String(q.sort || "-publishedAt");
  const dir = sortKey.startsWith("-") ? -1 : 1;
  const name = sortKey.replace(/^-/, "");
  const sort: any = byKey.has(name) ? { [`data.${name}`]: dir } : { [["createdAt", "updatedAt", "publishedAt"].includes(name) ? name : "publishedAt"]: dir };
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 12));
  const page = Math.max(1, Number(q.page) || 1);
  return { mongo, sort: { ...sort, _id: 1 }, limit, page };
}

/** A record as pages and the API see it: flat fields plus id, slug and dates. */
export function shapeRecord(col: IWebCollection, r: any, audience: "admin" | "public") {
  const out: Record<string, any> = { id: String(r._id), slug: r.slug, publishedAt: r.publishedAt, updatedAt: r.updatedAt };
  if (audience === "admin") out.status = r.status;
  for (const f of col.fields || []) if (audience === "admin" || !f.hiddenFromApi) out[f.key] = r.data?.[f.key] ?? null;
  return out;
}

export async function queryRecords(col: IWebCollection, q: ListQuery, audience: "admin" | "public") {
  const { mongo, sort, limit, page } = buildRecordFilter(col, q, audience);
  const [rows, total] = await Promise.all([WebRecord.find(mongo).sort(sort).skip((page - 1) * limit).limit(limit).lean(), WebRecord.countDocuments(mongo)]);
  return { items: rows.map((r) => shapeRecord(col, r, audience)), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/* ───────────── external REST sources ───────────── */
const cache = new Map<string, { at: number; data: any[] }>();
const walkPath = (obj: any, path: string) => String(path || "").replace(/^\$\.?/, "").split(".").filter(Boolean).reduce((cur, key) => (cur == null || ["__proto__", "constructor", "prototype"].includes(key) ? undefined : cur[key]), obj);

/** Fetch + map an external source. Serves the last good data when the remote API fails. */
export async function fetchSource(src: any, opts: { force?: boolean } = {}): Promise<{ items: any[]; stale: boolean }> {
  const id = String(src._id);
  const hit = cache.get(id);
  if (hit && !opts.force && Date.now() - hit.at < (src.ttlSeconds || 300) * 1000) return { items: hit.data, stale: false };
  // circuit breaker: after 5 failures in a row, rest for 2 minutes
  if (!opts.force && src.failures >= 5 && src.lastErrorAt && Date.now() - new Date(src.lastErrorAt).getTime() < 120_000) {
    if (hit) return { items: hit.data, stale: true };
    throw new ApiError(502, "This data source is failing; it will be tried again shortly");
  }
  try {
    let headers: Record<string, string> = {};
    try { headers = JSON.parse(unseal(src.headersEnc) || "{}"); } catch { headers = {}; }
    const res = await safeFetch(src.url, { headers: { Accept: "application/json", ...headers } });
    if (!res.ok) throw new Error(`The API answered ${res.status}`);
    let body: any;
    try { body = JSON.parse(res.text); } catch { throw new Error("The API did not return JSON"); }
    const root = src.rootPath ? walkPath(body, src.rootPath) : body;
    const list: any[] = Array.isArray(root) ? root : root && typeof root === "object" ? [root] : [];
    const fields: { key: string; path: string }[] = src.fields || [];
    // only mapped fields ever leave the server
    const items = list.slice(0, 500).map((row, i) => {
      const out: Record<string, any> = { id: String(row?.id ?? i) };
      for (const f of fields) { const v = walkPath(row, f.path); out[f.key] = v == null || typeof v === "object" ? (Array.isArray(v) ? v.slice(0, 20).map(String) : v == null ? null : JSON.stringify(v).slice(0, 500)) : v; }
      return out;
    });
    cache.set(id, { at: Date.now(), data: items });
    await WebDataSource.updateOne({ _id: src._id }, { lastSuccessAt: new Date(), lastError: "", failures: 0 });
    return { items, stale: false };
  } catch (e: any) {
    // never store the remote body or our own headers in the error
    await WebDataSource.updateOne({ _id: src._id }, { lastErrorAt: new Date(), lastError: String(e?.message || "Request failed").slice(0, 200), $inc: { failures: 1 } });
    if (hit) return { items: hit.data, stale: true };
    throw e instanceof ApiError ? e : new ApiError(502, String(e?.message || "The data source could not be reached").slice(0, 200));
  }
}
export const forgetSource = (id: string) => cache.delete(String(id));
/** The raw JSON of a source, for the field-mapping screen (admin only, truncated). */
export async function sampleSource(url: string, headers: Record<string, string>) {
  const res = await safeFetch(url, { headers: { Accept: "application/json", ...headers } });
  let body: any;
  try { body = JSON.parse(res.text); } catch { throw new ApiError(502, "The API did not return JSON"); }
  return { status: res.status, body };
}

/* ───────────── one resolver for every data need ───────────── */
export async function resolveSource(website: any, sourceRef: string, q: ListQuery, audience: "admin" | "public") {
  const [kind, key] = String(sourceRef || "").split(":");
  if (kind === "collection") {
    const col = await WebCollection.findOne({ website, key });
    if (!col) return { items: [], total: 0, page: 1, limit: 0, totalPages: 1 };
    return queryRecords(col, q, audience);
  }
  if (kind === "api") {
    const src = await WebDataSource.findOne({ website, key }).lean();
    if (!src) return { items: [], total: 0, page: 1, limit: 0, totalPages: 1 };
    let { items } = await fetchSource(src).catch(() => ({ items: [] as any[] }));
    const search = String(q.search || "").toLowerCase();
    if (search) items = items.filter((it) => Object.values(it).some((v) => String(v).toLowerCase().includes(search)));
    const sortKey = String(q.sort || "");
    if (sortKey) { const name = sortKey.replace(/^-/, ""); const dir = sortKey.startsWith("-") ? -1 : 1; items = items.slice().sort((a, b) => (a[name] > b[name] ? dir : a[name] < b[name] ? -dir : 0)); }
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 12));
    const page = Math.max(1, Number(q.page) || 1);
    return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) };
  }
  return { items: [], total: 0, page: 1, limit: 0, totalPages: 1 };
}

/**
 * Data a page needs before it is drawn: one result per node that repeats over a source.
 * `urlQuery` (page, q) only reaches repeaters that asked for pagination.
 */
export async function pageData(website: any, content: any, audience: "admin" | "public", urlQuery: { page?: any; q?: any } = {}) {
  const out: Record<string, any> = {};
  const jobs: Promise<void>[] = [];
  (function walk(node: any, depth: number) {
    if (!node || depth > 24) return;
    const rep = node.repeat;
    if (rep && typeof rep === "object" && typeof rep.source === "string" && jobs.length < 20) {
      const q: ListQuery = { filter: rep.filter, sort: rep.sort, limit: rep.limit, page: rep.paginate ? urlQuery.page : 1, search: rep.paginate ? urlQuery.q : "" };
      jobs.push(resolveSource(website, rep.source, q, audience).then((res) => { out[node.id] = res; }).catch(() => { out[node.id] = { items: [], total: 0, page: 1, limit: 0, totalPages: 1 }; }));
    }
    (node.children || []).forEach((c: any) => walk(c, depth + 1));
  })(content?.root, 0);
  await Promise.all(jobs);
  return out;
}

/* ───────────── outgoing webhooks ───────────── */
async function deliver(hook: any, event: string, payload: string, attempt = 1): Promise<void> {
  const started = Date.now();
  let status = 0, error = "";
  try {
    const sig = crypto.createHmac("sha256", unseal(hook.secret)).update(payload).digest("hex");
    const res = await safeFetch(hook.url, { method: "POST", body: payload, timeoutMs: 10_000, maxBytes: 200_000, headers: { "Content-Type": "application/json", "X-WB-Event": event, "X-WB-Signature": `sha256=${sig}` } });
    status = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e: any) {
    error = String(e?.name === "AbortError" ? "Timed out" : e?.message || "Failed").slice(0, 160);
  }
  const entry = { at: new Date(), event, status, ms: Date.now() - started, ...(error ? { error } : {}) };
  await WebWebhook.updateOne({ _id: hook._id }, [{ $set: { deliveries: { $slice: [{ $concatArrays: [[entry], { $ifNull: ["$deliveries", []] }] }, 20] }, failures: error ? { $add: [{ $ifNull: ["$failures", 0] }, 1] } : 0, active: error ? { $lt: [{ $ifNull: ["$failures", 0] }, 49] } : "$active" } }]).catch(() => {});
  // back off and retry: 2s, 8s
  if (error && attempt < 3) setTimeout(() => deliver(hook, event, payload, attempt + 1).catch(() => {}), 2000 * 4 ** (attempt - 1)).unref?.();
}
/** Tell every active webhook of the website about an event. Never blocks or fails the request that caused it. */
export function fireWebhooks(website: any, event: string, data: any) {
  WebWebhook.find({ website, active: true, events: event }).lean().then((hooks) => {
    if (!hooks.length) return;
    const payload = JSON.stringify({ id: crypto.randomUUID(), event, websiteId: String(website), occurredAt: new Date().toISOString(), data });
    hooks.forEach((h) => deliver(h, event, payload).catch(() => {}));
  }).catch(() => {});
}
export const testWebhook = (hook: any) => deliver(hook, "test", JSON.stringify({ id: crypto.randomUUID(), event: "test", websiteId: String(hook.website), occurredAt: new Date().toISOString(), data: { message: "Test event" } }), 3);
