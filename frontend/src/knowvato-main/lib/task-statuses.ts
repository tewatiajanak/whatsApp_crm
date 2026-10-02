import { appStore } from "../../api/appStore";

/**
 * Task statuses = the columns of the Event Manager → Tasks board.
 * Managed in Setup → Task Statuses; a task stores the `id` of its status.
 */
export type TaskStatus = { id: string; label: string; color: string; order: number };

export const TASK_STATUS_KEY = "em_task_statuses";
// ids of the four defaults match the values tasks already carry
export const TASK_STATUS_SEED: TaskStatus[] = [
  { id: "todo", label: "To do", color: "#64748b", order: 1 },
  { id: "in_progress", label: "In progress", color: "#0891b2", order: 2 },
  { id: "blocked", label: "Blocked", color: "#eab308", order: 3 },
  { id: "done", label: "Done", color: "#059669", order: 4 },
];

/** Statuses in board order (Sr No). Falls back to the defaults if none are set up. */
export function loadTaskStatuses(): TaskStatus[] {
  let rows: TaskStatus[] = TASK_STATUS_SEED;
  try {
    const parsed = JSON.parse(appStore.getItem(TASK_STATUS_KEY) || "null");
    if (Array.isArray(parsed) && parsed.some((r) => r?.id && r?.label)) rows = parsed.filter((r) => r?.id && r?.label);
  } catch {
    /* use the defaults */
  }
  return [...rows].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
}
