/**
 * Project Management events. Screens and routes only say WHAT happened
 * (emitPm); the message queue and the notifications listen (onPm) and decide
 * what to send. A failing listener never breaks the request.
 */
export type PmEvent =
  | "task_assigned"
  | "task_started"
  | "task_completed"
  | "task_status_changed"
  | "task_mentioned"
  | "task_unblocked"
  | "verification_requested"
  | "verification_answered"
  | "project_created"
  | "project_completed"
  | "module_completed"
  | "module_signoff"
  | "project_signoff";

export interface PmEventPayload {
  tenantId: string;
  actorId?: string;
  actorName?: string;
  taskId?: string;
  projectId?: string;
  moduleId?: string;
  /** event-specific extras (previous assignee, status id, mentioned users, …) */
  data?: Record<string, any>;
}

type Listener = (event: PmEvent, payload: PmEventPayload) => Promise<void> | void;
const listeners: Listener[] = [];

export const onPm = (fn: Listener) => {
  listeners.push(fn);
};

export function emitPm(event: PmEvent, payload: PmEventPayload) {
  for (const fn of listeners) {
    Promise.resolve()
      .then(() => fn(event, payload))
      .catch((e) => console.error(`[pm] listener failed on ${event}:`, e?.message || e));
  }
}
