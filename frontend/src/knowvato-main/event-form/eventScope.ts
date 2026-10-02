import { useEffect, useState } from "react";
import { http } from "../../api";
import { appStore } from "../../api/appStore";

export type Choice = { value: string; label: string };

/** Events as options for "which events does this apply to?" pickers. */
export function useEventChoices(enabled = true): Choice[] {
  const [choices, setChoices] = useState<Choice[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    http
      .get("/events")
      .then((res: any) => {
        if (alive) setChoices((res?.data ?? []).map((e: any) => ({ value: e.id, label: e.eventName || "Untitled event" })));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return choices;
}

/** Empty list = applies to every event. */
export const appliesToEvent = (events: unknown, eventId?: string | null) =>
  !Array.isArray(events) || events.length === 0 || (!!eventId && events.includes(eventId));

export const scopeLabel = (events: unknown, choices: Choice[]) => {
  if (!Array.isArray(events) || events.length === 0) return "All events";
  const names = events.map((id) => choices.find((c) => c.value === id)?.label).filter(Boolean);
  return names.length ? names.join(", ") : `${events.length} event${events.length === 1 ? "" : "s"}`;
};

export type AttendeeCategory = { id: string; name: string; ribbonColor?: string; badgeColor?: string; description?: string; events?: string[] };

export const ATTENDEE_CATEGORY_KEY = "em_attendee_categories";
export const ATTENDEE_CATEGORY_SEED: AttendeeCategory[] = [
  { id: "1", name: "VIP", ribbonColor: "#eab308", badgeColor: "#a855f7", description: "Chief guests and special invitees", events: [] },
  { id: "2", name: "Delegate", ribbonColor: "#2249b7", badgeColor: "#0891b2", description: "Registered participants", events: [] },
  { id: "3", name: "Speaker", ribbonColor: "#dc2626", badgeColor: "#f97316", description: "Speakers and panelists", events: [] },
  { id: "4", name: "Staff", ribbonColor: "#64748b", badgeColor: "#059669", description: "Organizers and volunteers", events: [] },
];

/** Attendee categories from Setup that apply to the given event (or to all). */
export function loadAttendeeCategories(eventId?: string | null): AttendeeCategory[] {
  let rows: AttendeeCategory[] = ATTENDEE_CATEGORY_SEED;
  try {
    const raw = appStore.getItem(ATTENDEE_CATEGORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) rows = parsed;
    }
  } catch {
    /* fall back to the defaults */
  }
  return rows.filter((c) => c?.name && appliesToEvent(c.events, eventId));
}
