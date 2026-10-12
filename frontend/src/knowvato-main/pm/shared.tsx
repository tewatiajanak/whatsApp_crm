const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

/** Files under /uploads are served by the API. */
export const fileUrl = (path?: string) => (path ? (path.startsWith("http") ? path : `${API_BASE}${path}`) : "");

const initials = (name = "") =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "?";

export function PersonAvatar({ name, photo, size = 36 }: { name: string; photo?: string; size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full overflow-hidden shrink-0 font-semibold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: "color-mix(in srgb, var(--primary) 14%, transparent)", color: "var(--primary)" }}
    >
      {photo ? <img src={fileUrl(photo)} alt="" className="h-full w-full object-cover" /> : initials(name)}
    </span>
  );
}

export function PageTitle({ icon, title, actions }: { icon: React.ReactNode; title: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md shrink-0" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
          {icon}
        </span>
        <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
      </div>
      {actions}
    </div>
  );
}

/* ---- number tiles ---- */
export type Tone = "primary" | "success" | "danger" | "info" | "warning" | "neutral";
/**
 * One number with its label: the tile of every dashboard-like strip.
 * `compact` is the small centred form used inside a card or a drawer.
 * A zero is shown muted; "danger" and "warning" colour the number itself.
 */
export function StatTile({
  label, value, tone = "neutral", icon: Icon, onClick, active, compact,
}: {
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  active?: boolean;
  compact?: boolean;
}) {
  const zero = value === 0 || value === "0" || value === "0%" || value == null;
  const cls = `pm-tile is-${tone}${zero ? " is-zero" : ""}${active ? " is-active" : ""}${compact ? " is-compact" : ""}${onClick ? " is-link" : ""}`;
  const inner = (
    <>
      {Icon && !compact && <span className="pm-tile-icon"><Icon className="h-4 w-4" /></span>}
      <span className="min-w-0">
        <span className="pm-tile-value">{value ?? 0}</span>
        <span className="pm-tile-label" title={label}>{label}</span>
      </span>
    </>
  );
  return onClick ? <button type="button" onClick={onClick} className={cls}>{inner}</button> : <div className={cls}>{inner}</div>;
}

/* ---- masters ---- */
export type Master = { _id: string; type: string; name: string; color: string; order: number; active: boolean; flags: Record<string, boolean>; values: Record<string, number> };
export type Employee = { _id: string; name: string; email?: string; photo?: string; designation?: string; department?: string; status?: string };

/** Coloured badge for a master item (status, priority, …). The colour comes from the master. */
export function MasterBadge({ item, fallback = "—" }: { item?: { name: string; color?: string } | null; fallback?: string }) {
  if (!item) return <span className="text-muted-foreground">{fallback}</span>;
  const c = item.color || "var(--muted-foreground)";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap" style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {item.name}
    </span>
  );
}

export const TAT_UNITS: { value: string; label: string; short: string }[] = [
  { value: "hours", label: "Hours", short: "h" },
  { value: "days", label: "Days", short: "d" },
  { value: "working_days", label: "Working Days", short: "wd" },
];
export const tatText = (value?: number, unit?: string) => `${value ?? 0} ${TAT_UNITS.find((u) => u.value === unit)?.short || "wd"}`;

/** Move an item of a list (drag and drop). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

/* ---- projects & tasks ---- */
export type Stats = {
  total: number; done: number; inProgress: number; overdue: number; waiting: number; progress: number; planned: number;
  schedule: "ahead" | "on_track" | "delayed" | "completed_on_time" | "completed_late" | "not_started"; expectedEnd: string | null; delayDays: number;
};

const SCHEDULE: Record<string, [string, string]> = {
  ahead: ["Ahead", "var(--info)"],
  on_track: ["On Track", "var(--success)"],
  delayed: ["Delayed", "var(--destructive)"],
  completed_on_time: ["Completed", "var(--success)"],
  completed_late: ["Completed Late", "var(--warning)"],
  not_started: ["No tasks", "var(--muted-foreground)"],
};
/** Health of a project at a glance. */
export function ScheduleBadge({ schedule }: { schedule?: string }) {
  const [name, color] = SCHEDULE[schedule || "not_started"] || SCHEDULE.not_started;
  return <MasterBadge item={{ name, color }} />;
}
export const scheduleLabel = (s?: string) => (SCHEDULE[s || ""] || SCHEDULE.not_started)[0];

export function ProgressBar({ value, color = "var(--primary)", height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: "var(--muted-background)" }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

/** "Delayed by 4 days" / "Ahead by 2 days" / "On time". */
export const delayText = (days = 0) => (days > 0 ? `Delayed by ${days} day${days === 1 ? "" : "s"}` : days < 0 ? `Ahead by ${-days} day${days === -1 ? "" : "s"}` : "On time");

const DAY_MS = 86_400_000;
/** TAT badge of a task: "2d left" / "Due today" / "Overdue 3d" / "Paused" / "Done". */
export function TatBadge({ task }: { task: { due?: string | null; isCompleted?: boolean; isPaused?: boolean } }) {
  let text = "—";
  let color = "var(--muted-foreground)";
  if (task.isCompleted) [text, color] = ["Done", "var(--success)"];
  else if (task.isPaused) [text, color] = ["Paused", "var(--muted-foreground)"];
  else if (task.due) {
    const due = new Date(task.due).getTime();
    const now = Date.now();
    const sameDay = new Date(task.due).toDateString() === new Date().toDateString();
    if (due < now && !sameDay) [text, color] = [`Overdue ${Math.max(1, Math.ceil((now - due) / DAY_MS))}d`, "var(--destructive)"];
    else if (due < now) [text, color] = ["Overdue", "var(--destructive)"];
    else if (sameDay) [text, color] = ["Due today", "var(--warning)"];
    else [text, color] = [`${Math.ceil((due - now) / DAY_MS)}d left`, "var(--success)"];
  }
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
      {text}
    </span>
  );
}

/** YYYY-MM-DD of a date, in local time. */
/** Meeting mode: where it is held, as short text. */
export const MEETING_MODES: [string, string][] = [["onsite", "Onsite"], ["online", "Online"], ["hybrid", "Online + Offline"]];
export const meetingMode = (mode?: string) => (MEETING_MODES.find(([v]) => v === mode) || MEETING_MODES[0])[1];
export const meetingWhere = (m: { mode?: string; location?: string }) => (m.mode === "online" ? "Online" : m.mode === "hybrid" ? [m.location, "Online"].filter(Boolean).join(" + ") : m.location || "");

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const todayYmd = () => ymd(new Date());

/** Download rows as an Excel file. */
export async function exportRows(fileName: string, sheet: string, rows: Record<string, any>[]) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const heads = Object.keys(rows[0] || {});
  ws["!cols"] = heads.map((h) => ({ wch: Math.min(48, Math.max(h.length + 2, ...rows.slice(0, 200).map((r) => String(r[h] ?? "").length + 2))) }));
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as any;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 30));
  XLSX.writeFile(wb, fileName);
}

/** The sign-off record of a module or project as a PDF, for the client's and our files. */
export async function downloadSignoffPdf(so: { title: string; summary: { module: string; tasks: number; completedOn: string }[]; status: string; answeredBy?: string; answeredAt?: string; comment?: string; sentAt?: string }, clientName = "") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const date = (d?: string) => (d ? new Date(d).toLocaleDateString("en-GB").replace(/\//g, "-") : "");
  let y = 64;
  doc.setFont("helvetica", "bold").setFontSize(18).text("Sign-off", 48, y);
  y += 26;
  doc.setFontSize(12).text(doc.splitTextToSize(so.title, 500), 48, y);
  y += 20;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(110);
  if (clientName) { doc.text(`Client: ${clientName}`, 48, y); y += 14; }
  if (so.sentAt) { doc.text(`Requested on ${date(so.sentAt)}`, 48, y); y += 14; }
  y += 12;
  doc.setTextColor(0).setFont("helvetica", "bold").setFontSize(10);
  doc.text("Module", 48, y);
  doc.text("Tasks", 360, y);
  doc.text("Completed on", 430, y);
  y += 6;
  doc.setDrawColor(200).line(48, y, 547, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  for (const m of so.summary || []) {
    if (y > 740) { doc.addPage(); y = 64; }
    doc.text(doc.splitTextToSize(m.module, 300)[0], 48, y);
    doc.text(String(m.tasks), 360, y);
    doc.text(m.completedOn || "—", 430, y);
    y += 18;
  }
  y += 14;
  doc.line(48, y, 547, y);
  y += 24;
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text(so.status === "Accepted" ? "Signed off" : so.status === "Concern" ? "Concern raised" : "Waiting for the client", 48, y);
  y += 18;
  doc.setFont("helvetica", "normal").setFontSize(10);
  if (so.answeredBy) { doc.text(`${so.answeredBy} · ${date(so.answeredAt)}`, 48, y); y += 16; }
  if (so.comment) doc.text(doc.splitTextToSize(so.comment, 500), 48, y);
  doc.save(`sign-off-${so.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60)}.pdf`);
}
