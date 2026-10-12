import crypto from "crypto";

/**
 * Rendered-page cache for published websites, kept in this process.
 * A page is cached per website + address + list query, for a short time, and every
 * change a visitor could see (publish, record edit, menu, theme) drops that website's entries.
 */
export interface CachedPage { status: number; head: string; body: string; data: string; etag: string; at: number }

const TTL_MS = 5 * 60_000;
const MAX_PER_SITE = 400;
const pages = new Map<string, Map<string, CachedPage>>(); // siteKey → address → page
const keyBySite = new Map<string, string>();               // site id → siteKey
const stats = new Map<string, { hits: number; misses: number; renders: number; totalMs: number; slow: { path: string; ms: number }[]; purgedAt: Date | null }>();

const statOf = (siteKey: string) => { let s = stats.get(siteKey); if (!s) stats.set(siteKey, (s = { hits: 0, misses: 0, renders: 0, totalMs: 0, slow: [], purgedAt: null })); return s; };
export const cacheKey = (path: string, query: { page?: any; q?: any }) => `${path}|${Number(query.page) > 1 ? Number(query.page) : 1}|${String(query.q || "").trim().toLowerCase().slice(0, 80)}`;

export function getCached(siteKey: string, key: string): CachedPage | null {
  const hit = pages.get(siteKey)?.get(key);
  if (!hit || Date.now() - hit.at > TTL_MS) { statOf(siteKey).misses++; return null; }
  statOf(siteKey).hits++;
  return hit;
}

export function putCached(siteKey: string, siteId: string, key: string, page: Omit<CachedPage, "etag" | "at">, renderMs: number) {
  let bucket = pages.get(siteKey);
  if (!bucket) pages.set(siteKey, (bucket = new Map()));
  // oldest entry out when a website has too many (search pages can be endless)
  if (bucket.size >= MAX_PER_SITE) bucket.delete(bucket.keys().next().value as string);
  const entry: CachedPage = { ...page, at: Date.now(), etag: `"${crypto.createHash("sha1").update(page.head + page.body + page.data).digest("base64url")}"` };
  bucket.set(key, entry);
  keyBySite.set(siteId, siteKey);
  const s = statOf(siteKey);
  s.renders++; s.totalMs += renderMs;
  s.slow = [...s.slow.filter((x) => x.path !== key.split("|")[0]), { path: key.split("|")[0], ms: Math.round(renderMs) }].sort((a, b) => b.ms - a.ms).slice(0, 5);
  return entry;
}

/** Forget every cached page of a website (by database id). Safe to call for websites that were never cached. */
export function purgeSite(siteId: unknown) {
  const siteKey = keyBySite.get(String(siteId));
  if (!siteKey) return;
  pages.delete(siteKey);
  statOf(siteKey).purgedAt = new Date();
}

export function siteStats(siteId: string) {
  const siteKey = keyBySite.get(siteId);
  const s = siteKey ? statOf(siteKey) : null;
  const total = s ? s.hits + s.misses : 0;
  return { cachedPages: siteKey ? pages.get(siteKey)?.size || 0 : 0, hits: s?.hits || 0, misses: s?.misses || 0, hitRatio: total ? Math.round(((s as any).hits / total) * 100) : 0, renders: s?.renders || 0, averageMs: s?.renders ? Math.round(s.totalMs / s.renders) : 0, slowest: s?.slow || [], lastPurgedAt: s?.purgedAt || null };
}
