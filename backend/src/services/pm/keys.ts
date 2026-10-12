/**
 * Dynamic keys of the communication templates — the ONE place they are listed.
 * To add a key: add it here, and fill it in `buildContext` (services/pm/messages).
 */
export interface KeyDef {
  key: string;
  label: string;
  group: string;
  /** shown in previews when no real record is chosen */
  sample: string;
}

export const KEY_REGISTRY: KeyDef[] = [
  { key: "client.name", label: "Client name", group: "Client", sample: "Greenfield Public School" },
  { key: "client.city", label: "Client city", group: "Client", sample: "Jaipur" },
  { key: "spoc.name", label: "Contact name", group: "Client", sample: "Mr. Rajesh Sharma" },
  { key: "project.name", label: "Project name", group: "Project", sample: "Greenfield – School ERP" },
  { key: "project.code", label: "Project code", group: "Project", sample: "PRJ-0012" },
  { key: "project.incharge", label: "Project incharge", group: "Project", sample: "Priya Kothari" },
  { key: "project.startDate", label: "Start date", group: "Project", sample: "01-10-2026" },
  { key: "project.endDate", label: "End date", group: "Project", sample: "30-11-2026" },
  { key: "project.progress", label: "Progress %", group: "Project", sample: "62%" },
  { key: "project.status", label: "Project status", group: "Project", sample: "In Progress" },
  { key: "module.name", label: "Module name", group: "Module", sample: "Fee Management" },
  { key: "module.incharge", label: "Module incharge", group: "Module", sample: "Rahul Bhatt" },
  { key: "task.title", label: "Task title", group: "Task", sample: "Fee Structure Configuration" },
  { key: "task.assignee", label: "Task assignee", group: "Task", sample: "Ananya Saxena" },
  { key: "task.dueDate", label: "Due date", group: "Task", sample: "14-10-2026" },
  { key: "task.status", label: "Task status", group: "Task", sample: "In Progress" },
  { key: "task.tat", label: "TAT", group: "Task", sample: "3 Working Days" },
  { key: "task.checklistDone", label: "Checklist done", group: "Task", sample: "3/5" },
  { key: "task.link", label: "Task link", group: "Task", sample: "https://app.example.com/task/123" },
  { key: "verification.approveLink", label: "Approve link", group: "Verification", sample: "https://app.example.com/v/approve" },
  { key: "verification.rejectLink", label: "Reject link", group: "Verification", sample: "https://app.example.com/v/reject" },
  { key: "signoff.link", label: "Sign-off link", group: "Verification", sample: "https://app.example.com/s/accept" },
  { key: "meeting.title", label: "Meeting title", group: "Meeting", sample: "Fee module training" },
  { key: "meeting.date", label: "Meeting date", group: "Meeting", sample: "16-10-2026" },
  { key: "meeting.time", label: "Meeting time", group: "Meeting", sample: "11:00 – 12:30" },
  { key: "meeting.location", label: "Location", group: "Meeting", sample: "School conference room" },
  { key: "meeting.link", label: "Meeting link", group: "Meeting", sample: "https://meet.example.com/abc" },
  { key: "meeting.join", label: "Online joining link", group: "Meeting", sample: "https://meet.example.com/abc" },
  { key: "ticket.number", label: "Ticket number", group: "Ticket", sample: "TKT-0042" },
  { key: "ticket.subject", label: "Ticket subject", group: "Ticket", sample: "Receipt print alignment" },
  { key: "ticket.status", label: "Ticket status", group: "Ticket", sample: "Open" },
  { key: "ticket.link", label: "Ticket link", group: "Ticket", sample: "https://app.example.com/portal/tickets" },
  { key: "employee.name", label: "Employee name", group: "General", sample: "Karthik Iyer" },
  { key: "company.name", label: "Company name", group: "General", sample: "KnowVato Solutions" },
  { key: "today", label: "Today", group: "General", sample: "03-10-2026" },
];

const KNOWN = new Set(KEY_REGISTRY.map((k) => k.key));
const KEY_RX = /\{\{\s*([a-zA-Z]+\.?[a-zA-Z]*)\s*\}\}/g;

/** Fill {{keys}}. Unknown keys are left as they are; a known key with no value becomes "". */
export function renderKeys(text: string, values: Record<string, string>): string {
  return String(text || "").replace(KEY_RX, (whole, key) => (KNOWN.has(key) ? values[key] ?? "" : whole));
}

/** Keys used in a text that the registry does not know. */
export function unknownKeys(text: string): string[] {
  const out = new Set<string>();
  String(text || "").replace(KEY_RX, (whole, key) => {
    if (!KNOWN.has(key)) out.add(key);
    return whole;
  });
  return [...out];
}

export const sampleValues = (): Record<string, string> => Object.fromEntries(KEY_REGISTRY.map((k) => [k.key, k.sample]));

/** Text version of an email body (for previews and plain-text mail). */
export const htmlToText = (html: string) =>
  String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
