import { useEffect, useState } from "react";
import { http } from "../../api";

export type Channel = "whatsapp" | "sms" | "email";

// Module whose Setup owns a template. Templates are only listed inside the
// module that created them.
export type SetupModule = "events" | "crm" | "website" | "front-office";

export type TemplateButton =
  | { type: "quick_reply"; text: string }
  | { type: "url"; text: string; url: string }
  | { type: "phone"; text: string; phone: string };

export type Template = {
  id: string;
  channel: Channel;
  module?: SetupModule;
  name: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  header?: { type: "none" | "text" | "image" | "video" | "document" | "location"; text?: string };
  body: string;
  subject?: string; // email only
  footer?: string;
  buttons: TemplateButton[];
  sample?: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  active: boolean;
  createdAt: string;
};

// Templates live in MongoDB (/api/module-templates), loaded per module on
// first use and cached here so every page for that module shares one list.
let data: Template[] = [];
const loaded = new Set<SetupModule>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const fromApi = (d: any): Template => ({
  ...d,
  id: d._id,
  header: d.header ?? { type: "none" },
  buttons: d.buttons ?? [],
});

const toApi = (t: Template) => {
  const { id: _id, createdAt: _createdAt, ...rest } = t;
  return rest;
};

async function refresh(m: SetupModule) {
  const res: any = await http.get(`/module-templates?module=${m}&perPage=200`);
  data = [...data.filter((t) => t.module !== m), ...(res?.data ?? []).map(fromApi)];
  loaded.add(m);
  notify();
}

export const templateStore = {
  getByChannel: (c: Channel, m: SetupModule = "events") =>
    data.filter((t) => t.channel === c && t.module === m),
  async upsert(t: Template) {
    const m = t.module ?? "events";
    if (data.some((x) => x.id === t.id)) await http.patch(`/module-templates/${t.id}`, toApi(t));
    else await http.post("/module-templates", { ...toApi(t), module: m });
    await refresh(m);
  },
  async remove(id: string) {
    const m = data.find((x) => x.id === id)?.module ?? "events";
    await http.del(`/module-templates/${id}`);
    await refresh(m);
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useTemplates(channel: Channel, module: SetupModule = "events") {
  const [, tick] = useState(0);
  useEffect(() => {
    const unsub = templateStore.subscribe(() => tick((n) => n + 1));
    if (!loaded.has(module)) refresh(module).catch((e) => console.error("Failed to load templates", e));
    return () => {
      unsub();
    };
  }, [module]);
  return templateStore.getByChannel(channel, module);
}
