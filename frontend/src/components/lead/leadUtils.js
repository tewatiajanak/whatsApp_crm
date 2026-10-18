// Shared bits for the lead screens: labels, colours, date helpers.

export const PRIORITY = {
  hot: { label: "Hot", color: "var(--destructive)", icon: "fire" },
  warm: { label: "Warm", color: "var(--warning)", icon: "thermometer-half" },
  cold: { label: "Cold", color: "var(--info)", icon: "snow" },
};

export const FU_TYPES = [
  { value: "Call", icon: "telephone" },
  { value: "WhatsApp", icon: "whatsapp" },
  { value: "Email", icon: "envelope" },
  { value: "SMS", icon: "chat-left-text" },
  { value: "Visit", icon: "geo-alt" },
  { value: "Meeting", icon: "people" },
];
export const fuIcon = (type) => FU_TYPES.find((t) => t.value.toLowerCase() === String(type || "").toLowerCase())?.icon || "bell";

export const CALL_OUTCOMES = ["Connected", "No answer", "Busy", "Switched off", "Wrong number", "Call back later"];
export const FU_OUTCOMES = ["Interested", "Call back later", "No response", "Not interested", "Visit planned", "Completed"];
export const LOST_REASONS = ["Chose another institute", "Fees too high", "Location too far", "Not reachable", "Not eligible", "Plans postponed", "Duplicate / junk"];

export const ACTIVITY = {
  created: { icon: "plus-circle", color: "var(--info)" },
  imported: { icon: "upload", color: "var(--info)" },
  enquiry: { icon: "arrow-repeat", color: "var(--info)" },
  status: { icon: "flag", color: "var(--warning)" },
  assigned: { icon: "person-check", color: "var(--primary)" },
  note: { icon: "sticky", color: "var(--muted-foreground)" },
  call: { icon: "telephone", color: "var(--success)" },
  message: { icon: "chat-dots", color: "var(--success)" },
  followup_scheduled: { icon: "calendar-plus", color: "var(--primary)" },
  followup_done: { icon: "check2-circle", color: "var(--success)" },
  followup_rescheduled: { icon: "calendar2-week", color: "var(--warning)" },
  edited: { icon: "pencil", color: "var(--muted-foreground)" },
  service: { icon: "briefcase", color: "var(--primary)" },
  merged: { icon: "union", color: "var(--primary)" },
  tag: { icon: "tag", color: "var(--muted-foreground)" },
  registration: { icon: "clipboard-check", color: "var(--success)" },
  document: { icon: "paperclip", color: "var(--muted-foreground)" },
  payment: { icon: "cash-coin", color: "var(--success)" },
  automation: { icon: "lightning-charge", color: "var(--primary)" },
  sla: { icon: "alarm", color: "var(--destructive)" },
  visit: { icon: "globe2", color: "var(--info)" },
  email: { icon: "envelope-open", color: "var(--info)" },
  approval: { icon: "patch-check", color: "var(--warning)" },
  restored: { icon: "arrow-counterclockwise", color: "var(--primary)" },
  activity: { icon: "lightning", color: "var(--primary)" },
  query: { icon: "question-circle", color: "var(--warning)" },
  list: { icon: "collection", color: "var(--muted-foreground)" },
};

const pad = (n) => String(n).padStart(2, "0");
/** yyyy-mm-dd for today + n days (browser's local date). */
export const isoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function timeAgo(date) {
  if (!date) return "—";
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/** How a follow-up date reads, and how urgent it is. */
export function dueInfo(date) {
  if (!date) return { text: "None", tone: "muted-foreground", overdue: false };
  const d = new Date(date);
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const days = Math.floor((new Date(d).setHours(0, 0, 0, 0) - startToday.getTime()) / 86400000);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days < 0) return { text: `${-days}d overdue`, tone: "destructive", overdue: true };
  if (days === 0) return { text: `Today ${time}`, tone: "warning", overdue: false };
  if (days === 1) return { text: `Tomorrow ${time}`, tone: "info", overdue: false };
  return { text: `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`, tone: "foreground", overdue: false };
}

export const money = (n) => "₹" + new Intl.NumberFormat("en-IN").format(Math.round(Number(n) || 0));
export const compactMoney = (n) => {
  const v = Number(n) || 0;
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v}`;
};

const digits = (phone) => String(phone || "").replace(/\D/g, "");
/** wa.me needs the country code; a bare 10-digit number is taken as Indian. */
export const waLink = (phone) => {
  const d = digits(phone);
  return `https://wa.me/${d.length === 10 ? "91" + d : d}`;
};
export const telLink = (phone) => `tel:${String(phone || "").replace(/[^\d+]/g, "")}`;

export const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1";
export const idOf = (v) => (v && typeof v === "object" ? v._id : v);
