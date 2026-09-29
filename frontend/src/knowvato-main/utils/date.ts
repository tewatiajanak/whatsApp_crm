/**
 * Shared date formatters. Every page across the app should use these so
 * the format stays consistent (dd-mm-yyyy for dates, dd-mm-yyyy HH:MM
 * for datetimes).
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Format an ISO date string (or Date) as `dd-mm-yyyy`. Returns "—" for bad input. */
export const fmtDate = (input?: string | Date | null): string => {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
};

/** Format as `dd-mm-yyyy HH:MM` (24-hour). */
export const fmtDateTime = (input?: string | Date | null): string => {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "—";
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Relative time — "just now" / "5m ago" / "2h ago" / "3d ago" / falls back to fmtDate. */
export const fmtRelative = (input?: string | Date | null): string => {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return fmtDate(d);
};
