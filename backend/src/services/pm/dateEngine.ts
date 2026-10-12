import { config } from "../../config";

/**
 * Date engine: TAT and dependency scheduling.
 * All working-time rules are applied in LOCAL time (APP_TZ_OFFSET, India by default).
 */
export type TatUnit = "hours" | "days" | "working_days";

export interface WorkCalendar {
  /** 0 = Sunday … 6 = Saturday */
  workingDays: number[];
  /** HH:MM */
  workStart: string;
  workEnd: string;
  /** YYYY-MM-DD */
  holidays: Set<string>;
}

const offsetMs = (() => {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(config.timezoneOffset || "+05:30");
  return m ? (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10)) * 60_000 : 330 * 60_000;
})();
const DAY = 86_400_000;

/* A "local" date is a Date whose UTC fields read as local wall-clock time. */
const toLocal = (d: Date) => new Date(d.getTime() + offsetMs);
const fromLocal = (d: Date) => new Date(d.getTime() - offsetMs);
const ymd = (local: Date) => local.toISOString().slice(0, 10);
const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
};
const atMinutes = (local: Date, mins: number) => new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, mins));

/** Local YYYY-MM-DD of a moment. */
export const localDay = (d: Date) => ymd(toLocal(d));

export function isWorkingDay(d: Date, cal: WorkCalendar): boolean {
  const local = toLocal(d);
  return cal.workingDays.includes(local.getUTCDay()) && !cal.holidays.has(ymd(local));
}

/** start + TAT. Hours count only working hours; working days skip weekends and holidays; days are calendar days. */
export function addTat(start: Date, value: number, unit: TatUnit, cal: WorkCalendar): Date {
  const v = Math.max(0, Number(value) || 0);
  if (!v) return new Date(start);
  if (unit === "days") return new Date(start.getTime() + v * DAY);

  // a calendar with no working day at all would never end
  if (!cal.workingDays.length) return new Date(start.getTime() + (unit === "hours" ? v * 3_600_000 : v * DAY));

  let local = toLocal(start);
  const working = (l: Date) => cal.workingDays.includes(l.getUTCDay()) && !cal.holidays.has(ymd(l));

  if (unit === "working_days") {
    let left = Math.ceil(v);
    for (let guard = 0; left > 0 && guard < 5000; guard++) {
      local = new Date(local.getTime() + DAY);
      if (working(local)) left--;
    }
    return fromLocal(local);
  }

  // hours
  const open = minutes(cal.workStart);
  const close = Math.max(open + 1, minutes(cal.workEnd));
  let left = Math.round(v * 60);
  for (let guard = 0; guard < 5000; guard++) {
    const now = local.getUTCHours() * 60 + local.getUTCMinutes();
    if (!working(local) || now >= close) {
      local = atMinutes(new Date(local.getTime() + DAY), open);
      continue;
    }
    if (now < open) local = atMinutes(local, open);
    const cur = local.getUTCHours() * 60 + local.getUTCMinutes();
    const room = close - cur;
    if (left <= room) return fromLocal(new Date(local.getTime() + left * 60_000));
    left -= room;
    local = atMinutes(new Date(local.getTime() + DAY), open);
  }
  return fromLocal(local);
}

export interface SchedTask {
  id: string;
  tatValue: number;
  tatUnit: TatUnit;
  dependsOn: string[];
}

/** The tasks that form a dependency loop (in order), or [] when there is none. */
export function findCycle(tasks: { id: string; dependsOn: string[] }[]): string[] {
  const deps = new Map(tasks.map((t) => [t.id, t.dependsOn.filter((d) => d !== undefined)]));
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (id: string): string[] => {
    if (state.get(id) === 2) return [];
    if (state.get(id) === 1) return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 1);
    stack.push(id);
    for (const d of deps.get(id) || []) {
      if (!deps.has(d)) continue;
      const loop = visit(d);
      if (loop.length) return loop;
    }
    stack.pop();
    state.set(id, 2);
    return [];
  };
  for (const t of tasks) {
    const loop = visit(t.id);
    if (loop.length) return loop;
  }
  return [];
}

/**
 * Planned dates for a set of tasks.
 *   no predecessor → starts at `start`
 *   predecessors   → starts when the LATEST one ends
 *   due            = start + TAT
 * `fixed` gives tasks whose end is already known (completed, or manually dated).
 */
export function calculateSchedule(
  tasks: SchedTask[],
  start: Date,
  cal: WorkCalendar,
  fixed: Map<string, { start?: Date; due: Date }> = new Map()
): Map<string, { start: Date; due: Date }> {
  const loop = findCycle(tasks);
  if (loop.length) {
    const err: any = new Error("Circular dependency");
    err.loop = loop;
    throw err;
  }
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out = new Map<string, { start: Date; due: Date }>();
  const resolve = (id: string): { start: Date; due: Date } => {
    if (out.has(id)) return out.get(id)!;
    const t = byId.get(id)!;
    let begin = new Date(start);
    for (const d of t.dependsOn) {
      if (!byId.has(d)) continue;
      const end = resolve(d).due;
      if (end > begin) begin = end;
    }
    const f = fixed.get(id);
    const res = f ? { start: f.start || begin, due: f.due } : { start: begin, due: addTat(begin, t.tatValue, t.tatUnit, cal) };
    out.set(id, res);
    return res;
  };
  tasks.forEach((t) => resolve(t.id));
  return out;
}

/** Whole days between two moments, rounded up (at least 0). */
export const daysBetween = (a: Date, b: Date) => Math.max(0, Math.ceil((b.getTime() - a.getTime()) / DAY));
