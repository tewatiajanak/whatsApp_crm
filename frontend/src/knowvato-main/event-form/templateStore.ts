import { appStore } from "../../api/appStore";
import { type FormDesign, type FormTemplate, designToLayout, uid } from "./schema";
import { BUILT_IN_TEMPLATES } from "./templates";

// Templates saved by the organisation (shared by all its users, kept on the server).
const KEY = "em_event_form_designs";

export function loadSavedTemplates(): FormTemplate[] {
  try {
    const rows = JSON.parse(appStore.getItem(KEY) || "[]");
    return Array.isArray(rows) ? rows.filter((r) => r?.id && r?.theme && Array.isArray(r?.layout)) : [];
  } catch {
    return [];
  }
}

export const allTemplates = (): FormTemplate[] => [...BUILT_IN_TEMPLATES, ...loadSavedTemplates()];

export function saveDesignAsTemplate(name: string, design: FormDesign): FormTemplate {
  const tpl: FormTemplate = {
    id: `custom-${uid()}`,
    name: name.trim(),
    description: "Saved from the form designer.",
    theme: { ...design.theme },
    layout: designToLayout(design),
  };
  appStore.setItem(KEY, JSON.stringify([...loadSavedTemplates(), tpl]));
  return tpl;
}

export function deleteSavedTemplate(id: string) {
  appStore.setItem(KEY, JSON.stringify(loadSavedTemplates().filter((t) => t.id !== id)));
}
