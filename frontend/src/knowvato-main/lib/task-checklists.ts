import { appStore } from "../../api/appStore";

/**
 * Task Checklist (Setup → Events): for each event category, the tasks an event
 * of that category needs (Venue, Speaker…) and the checklist points of each
 * task. New events get a copy of these on the Tasks board, where the points
 * are ticked.
 */
export type ChecklistPoint = { id: string; text: string };
export type TaskTemplate = {
  id: string;
  /** Event categories (EventType ids) this task belongs to; empty = every category. */
  categoryIds: string[];
  task: string;
  order: number;
  points: ChecklistPoint[];
};

export const TASK_CHECKLIST_KEY = "em_task_checklists";

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** The starter list: the tasks and points of the former Checklist page, for every category. */
const SAMPLE_TASKS: [string, string[]][] = [
  ["Venue", ["Confirm venue booking and payment", "Walk-through and layout planning", "Confirm AV, mic, projector, WiFi"]],
  ["Speakers", ["Finalize speaker list and confirmations", "Collect bios, photos, session topics", "Send speaker travel & hotel details"]],
  ["Sponsors", ["Sign sponsor contracts and collect logos", "Deliver sponsor branding placements"]],
  ["Registration", ["Publish registration form", "Test end-to-end registration flow"]],
  ["Passes & Badges", ["Design event pass and print samples", "Bulk-generate passes for confirmed attendees"]],
  ["Volunteers", ["Recruit and brief volunteers", "Assign gates and desk roles"]],
  ["Communication", ["Send 'Save the date' broadcast", "Send confirmation email + WhatsApp on approval", "Send day-before reminder"]],
  ["Completion & Feedback", ["Send feedback form after event ends", "Generate and deliver certificates", "Post-event debrief with team"]],
];
// set once the starter list has been added, so deleting a sample task keeps it deleted
const SAMPLED_KEY = "em_task_checklists_sampled";

const read = (): TaskTemplate[] => {
  try {
    const rows = JSON.parse(appStore.getItem(TASK_CHECKLIST_KEY) || "[]");
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r) => r?.id && r?.task)
      // rows saved before a task could have several categories carry a single categoryId
      .map(({ categoryId, ...r }) => ({ ...r, categoryIds: Array.isArray(r.categoryIds) ? r.categoryIds : categoryId ? [categoryId] : [] }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch {
    return [];
  }
};

export function loadTaskTemplates(): TaskTemplate[] {
  const rows = read();
  // nothing is written before the server store has loaded (it would look empty)
  if (!appStore.isHydrated() || appStore.getItem(SAMPLED_KEY)) return rows;
  const have = new Set(rows.map((r) => r.task.trim().toLowerCase()));
  const samples: TaskTemplate[] = SAMPLE_TASKS.filter(([task]) => !have.has(task.toLowerCase())).map(([task, points], i) => ({
    id: newId(),
    categoryIds: [],
    task,
    order: rows.length + i + 1,
    points: points.map((text) => ({ id: newId(), text })),
  }));
  const next = [...rows, ...samples];
  appStore.setItem(SAMPLED_KEY, "1");
  if (samples.length) saveTaskTemplates(next);
  return next;
}

export function saveTaskTemplates(rows: TaskTemplate[]) {
  appStore.setItem(TASK_CHECKLIST_KEY, JSON.stringify(rows));
}

/** Tasks that apply to an event of the given category: its own plus the "all categories" ones. */
export const templatesForCategory = (rows: TaskTemplate[], categoryId?: string | null) =>
  rows
    .filter((r) => !r.categoryIds.length || r.categoryIds.includes(categoryId || "__none__"))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
