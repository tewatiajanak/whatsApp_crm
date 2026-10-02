// Server-backed replacement for window.localStorage.
//
// Same synchronous API (getItem / setItem / removeItem) so existing code keeps
// working, but nothing is kept in the browser: values live in MongoDB via
// /api/app-store. The cache is loaded once after sign-in (see AuthContext) and
// every write is sent to the server.
import { getToken } from "./client";

const BASE = import.meta.env.VITE_API_BASE || "";
const WRITE_DELAY_MS = 400;

// Personal preferences — saved per user. Everything else is shared by the tenant.
const USER_KEYS = new Set(["knowvato_theme_id", "knowvato_custom_themes", "app_theme", "orbitops.bookmarks"]);
// "cols.<table>" = which columns this user shows in a table
const scopeOf = (key) => (USER_KEYS.has(key) || key.startsWith("cols.") ? "user" : "tenant");

// Data left behind in the browser by older versions — moved to the server once.
const isLegacyDataKey = (key) =>
  key !== "em_auth_user" &&
  (key.startsWith("em_") ||
    key.startsWith("custom_fields_") ||
    key.startsWith("knowvato_") ||
    key === "wa_integrations_v1" ||
    key === "orbitops.bookmarks" ||
    key === "app_theme");
const isLegacyJunkKey = (key) =>
  key === "em_auth_user" || key === "orbitops.auth" || key.startsWith("flowchat_studio_");

let cache = new Map();
let hydrated = false;
const timers = new Map();
const inFlight = new Set();
const listeners = new Set();
const errorListeners = new Set();

const notify = () => listeners.forEach((l) => l());

function push(key, attempt = 0) {
  const p = pushNow(key, attempt).finally(() => inFlight.delete(p));
  inFlight.add(p);
  return p;
}

async function pushNow(key, attempt) {
  timers.delete(key);
  const token = getToken();
  if (!token) return;
  const has = cache.has(key);
  const scope = scopeOf(key);
  try {
    const res = await fetch(
      `${BASE}/api/app-store/${encodeURIComponent(key)}${has ? "" : `?scope=${scope}`}`,
      {
        method: has ? "PUT" : "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: has ? JSON.stringify({ value: cache.get(key), scope }) : undefined,
      }
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  } catch (err) {
    if (attempt < 2) {
      timers.set(key, setTimeout(() => push(key, attempt + 1), 2000));
      return;
    }
    console.error(`[appStore] could not save "${key}" to the server`, err);
    errorListeners.forEach((l) => l(key, err));
  }
}

function schedule(key) {
  // Before sign-in / hydration the cache is only in memory — never sent, so a
  // default value can't overwrite what the server already has.
  if (!hydrated) return;
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(() => push(key), WRITE_DELAY_MS));
}

function flush() {
  [...timers.keys()].forEach((key) => {
    clearTimeout(timers.get(key));
    push(key);
  });
}

function migrateLegacyBrowserData() {
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) keys.push(window.localStorage.key(i));
    keys.forEach((key) => {
      if (!key) return;
      if (isLegacyDataKey(key)) {
        const value = window.localStorage.getItem(key);
        if (value != null && !cache.has(key)) appStore.setItem(key, value);
        window.localStorage.removeItem(key);
      } else if (isLegacyJunkKey(key)) {
        window.localStorage.removeItem(key);
      }
    });
  } catch {
    /* storage unavailable — nothing to migrate */
  }
}

export const appStore = {
  getItem(key) {
    return cache.has(key) ? cache.get(key) : null;
  },
  setItem(key, value) {
    const v = String(value);
    if (cache.get(key) === v) return;
    cache.set(key, v);
    schedule(key);
  },
  removeItem(key) {
    if (!cache.has(key)) return;
    cache.delete(key);
    schedule(key);
  },
  isHydrated: () => hydrated,

  // Load everything for the signed-in user. Throws if the server can't be reached.
  async hydrate() {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${BASE}/api/app-store`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Could not load saved data (${res.status})`);
    const json = await res.json();
    cache = new Map(Object.entries(json?.data || {}));
    hydrated = true;
    migrateLegacyBrowserData();
    notify();
  },

  // Sign-out: drop everything held in memory.
  reset() {
    flush();
    cache = new Map();
    hydrated = false;
    notify();
  },

  // Called after hydrate() / reset() so already-mounted providers can re-read.
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  // Resolves once every pending write has reached the server.
  async whenIdle() {
    flush();
    while (inFlight.size) await Promise.allSettled([...inFlight]);
  },
  onError(listener) {
    errorListeners.add(listener);
    return () => errorListeners.delete(listener);
  },
  flush,
};

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
}
