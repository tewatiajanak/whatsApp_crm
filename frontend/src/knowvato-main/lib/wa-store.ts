import { useEffect, useState } from "react";
import { appStore } from "../../api/appStore";

export type Integration = {
  id: string;
  provider: "meta" | "vendor";
  vendor?: string;
  apiKey: string;
  phoneId: string;
  wabaId: string;
  phoneNumber: string;
  active: boolean;
  status: "connected" | "disconnected" | "untested";
  callbackUrl: string;
  createdAt: string;
};

const KEY = "wa_integrations_v1";

function load(): Integration[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = appStore.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

let data: Integration[] = load();
const listeners = new Set<() => void>();
function persist() {
  if (typeof window !== "undefined") appStore.setItem(KEY, JSON.stringify(data));
  listeners.forEach((l) => l());
}

// Re-read once the server store has loaded (or been cleared on sign-out).
appStore.subscribe(() => {
  data = load();
  listeners.forEach((l) => l());
});

export const waStore = {
  getAll: () => data,
  upsert(item: Integration) {
    if (item.active) data = data.map((x) => ({ ...x, active: false }));
    const i = data.findIndex((x) => x.id === item.id);
    if (i >= 0) data[i] = item;
    else data.push(item);
    persist();
  },
  remove(id: string) {
    data = data.filter((x) => x.id !== id);
    persist();
  },
  setActive(id: string) {
    data = data.map((x) => ({ ...x, active: x.id === id ? !x.active : false }));
    persist();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useWaIntegrations() {
  const [, tick] = useState(0);
  useEffect(() => {
    const unsub = waStore.subscribe(() => tick((n) => n + 1));
    return () => {
      unsub();
    };
  }, []);
  return waStore.getAll();
}
