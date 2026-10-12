import { config } from "../config";

/** The app's UTC offset in minutes (from APP_TZ_OFFSET, "+05:30" → 330). */
export const tzOffsetMin = (() => {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(config.timezoneOffset || "");
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 330;
})();

const pad = (n: number) => String(n).padStart(2, "0");

/** yyyy-mm-dd of a moment, as the app's local calendar date. */
export function localDateKey(d: Date | string | number = new Date()): string {
  const t = new Date(new Date(d).getTime() + tzOffsetMin * 60_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** The instant a local calendar date ("yyyy-mm-dd") and time ("HH:MM") refers to. */
export function localDateTime(date: string, time = "00:00"): Date {
  const [y, mo, d] = String(date).slice(0, 10).split("-").map(Number);
  const [h, mi] = String(time || "00:00").split(":").map((x) => Number(x) || 0);
  return new Date(Date.UTC(y, (mo || 1) - 1, d || 1, h, mi) - tzOffsetMin * 60_000);
}

export const startOfLocalDay = (d: Date | string | number = new Date()) => localDateTime(localDateKey(d));
export const endOfLocalDay = (d: Date | string | number = new Date()) => new Date(startOfLocalDay(d).getTime() + 86_400_000 - 1);

export const isDateKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);

/** Local day + n days, at a given local hour. */
export function daysFromNow(days: number, hour = 10): Date {
  return new Date(startOfLocalDay().getTime() + days * 86_400_000 + hour * 3_600_000);
}
