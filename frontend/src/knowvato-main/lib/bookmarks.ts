import { useEffect, useState } from "react";
import { appStore } from "../../api/appStore";

export type Bookmark = { title: string; url: string };

const KEY = "orbitops.bookmarks";

function read(): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = appStore.getItem(KEY);
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

appStore.subscribe(emit);

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    setBookmarks(read());
    const cb = () => setBookmarks(read());
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  const save = (next: Bookmark[]) => {
    appStore.setItem(KEY, JSON.stringify(next));
    emit();
  };

  return {
    bookmarks,
    add: (b: Bookmark) => {
      const next = [...read().filter((x) => x.url !== b.url), b];
      save(next);
    },
    remove: (url: string) => save(read().filter((x) => x.url !== url)),
    has: (url: string) => bookmarks.some((b) => b.url === url),
  };
}
