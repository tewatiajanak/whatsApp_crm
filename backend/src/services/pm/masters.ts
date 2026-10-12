import { PmMaster, PmSettings } from "../../models/pm/Setup";
import { PmTaskTemplate } from "../../models/pm/Product";

/** The simple masters, the flags each one has, and the numbers it carries. */
export const MASTER_TYPES: Record<string, { label: string; flags: string[]; values: string[] }> = {
  project_status: { label: "Project Status", flags: ["isCompleted", "isOnHold", "isCancelled"], values: [] },
  task_status: { label: "Task Status", flags: ["isInitial", "isInProgress", "isCompleted", "isOnHold", "isWaitingForClient", "pausesTat"], values: [] },
  priority: { label: "Priority", flags: [], values: [] },
  task_type: { label: "Task Type", flags: [], values: [] },
  work_location: { label: "Work Location", flags: ["isOnsite"], values: [] },
  meeting_type: { label: "Meeting / Training Type", flags: ["isTraining"], values: [] },
  ticket_category: { label: "Ticket Category", flags: [], values: [] },
  ticket_status: { label: "Ticket Status", flags: ["isOpen", "isClosed"], values: [] },
  ticket_priority: { label: "Ticket Priority", flags: [], values: ["responseHours", "resolveHours"] },
};

type Def = { name: string; color: string; flags?: Record<string, boolean>; values?: Record<string, number> };

/** What a new tenant starts with. Everything can be renamed, re-coloured or removed afterwards. */
export const MASTER_DEFAULTS: Record<string, Def[]> = {
  project_status: [
    { name: "Not Started", color: "#64748b" },
    { name: "In Progress", color: "#2563eb" },
    { name: "On Hold", color: "#d97706", flags: { isOnHold: true } },
    { name: "Completed", color: "#16a34a", flags: { isCompleted: true } },
    { name: "Cancelled", color: "#dc2626", flags: { isCancelled: true } },
  ],
  task_status: [
    { name: "To Do", color: "#64748b", flags: { isInitial: true } },
    { name: "In Progress", color: "#2563eb", flags: { isInProgress: true } },
    { name: "Waiting for Client", color: "#a855f7", flags: { isWaitingForClient: true, pausesTat: true } },
    { name: "On Hold", color: "#d97706", flags: { isOnHold: true, pausesTat: true } },
    { name: "Completed", color: "#16a34a", flags: { isCompleted: true } },
  ],
  priority: [
    { name: "Low", color: "#64748b" },
    { name: "Medium", color: "#2563eb" },
    { name: "High", color: "#f97316" },
    { name: "Critical", color: "#dc2626" },
  ],
  task_type: ["Configuration", "Master Setup", "Data Import", "Training", "Testing", "Go-Live", "Other"].map((name) => ({ name, color: "#0891b2" })),
  work_location: [
    { name: "Onsite", color: "#16a34a", flags: { isOnsite: true } },
    { name: "Offsite", color: "#2563eb" },
    { name: "WFH", color: "#a855f7" },
  ],
  meeting_type: [
    { name: "Meeting", color: "#2563eb" },
    { name: "Training", color: "#16a34a", flags: { isTraining: true } },
    { name: "Review", color: "#d97706" },
    { name: "Demo", color: "#a855f7" },
    { name: "Client Meeting", color: "#2563eb" },
    { name: "Internal Meeting", color: "#0891b2" },
    { name: "Client Training", color: "#16a34a", flags: { isTraining: true } },
    { name: "Internal Training", color: "#65a30d", flags: { isTraining: true } },
    { name: "Internal Review Meeting", color: "#d97706" },
  ],
  ticket_category: ["Bug", "Change Request", "Query", "Data Issue"].map((name) => ({ name, color: "#0891b2" })),
  ticket_status: [
    { name: "Open", color: "#dc2626", flags: { isOpen: true } },
    { name: "In Progress", color: "#2563eb", flags: { isOpen: true } },
    { name: "Resolved", color: "#16a34a", flags: { isClosed: true } },
    { name: "Closed", color: "#64748b", flags: { isClosed: true } },
  ],
  ticket_priority: [
    { name: "Low", color: "#64748b", values: { responseHours: 24, resolveHours: 120 } },
    { name: "Medium", color: "#2563eb", values: { responseHours: 8, resolveHours: 72 } },
    { name: "High", color: "#f97316", values: { responseHours: 4, resolveHours: 24 } },
    { name: "Critical", color: "#dc2626", values: { responseHours: 1, resolveHours: 8 } },
  ],
};

/** The tenant's settings record; created with defaults, and the default masters with it, the first time. */
export async function getPmSettings(tenantId: any) {
  let settings = await PmSettings.findOne({ tenant: tenantId });
  if (!settings) {
    try {
      settings = await PmSettings.create({ tenant: tenantId });
    } catch {
      settings = await PmSettings.findOne({ tenant: tenantId }); // created by a parallel request
    }
  }
  if (settings && !settings.mastersSeeded) {
    for (const [type, defs] of Object.entries(MASTER_DEFAULTS)) {
      if (await PmMaster.exists({ tenant: tenantId, type })) continue;
      await PmMaster.insertMany(
        defs.map((d, i) => ({ tenant: tenantId, type, name: d.name, color: d.color, order: i + 1, active: true, flags: d.flags || {}, values: d.values || {} })),
        { ordered: false }
      ).catch(() => {});
    }
    settings.mastersSeeded = true;
    await settings.save();
  }
  return settings!;
}

/**
 * Where is a master item used? Returns a short reason when it cannot be
 * deleted, else "". Each phase adds its own check here.
 */
export async function masterInUse(tenantId: any, type: string, id: string): Promise<string> {
  const n = (count: number, what: string) => (count ? `Used by ${count} ${what}${count === 1 ? "" : "s"}` : "");
  if (type === "task_type") return n(await PmTaskTemplate.countDocuments({ tenant: tenantId, taskType: id }), "task template");
  if (type === "priority") return n(await PmTaskTemplate.countDocuments({ tenant: tenantId, priority: id }), "task template");
  if (type === "task_status") {
    const s = await PmSettings.findOne({ tenant: tenantId }).lean();
    const used = (s?.taskStatusFlow || []).some((f: any) => String(f.from) === String(id) || String(f.to) === String(id));
    return used ? "Used in the status flow" : "";
  }
  return "";
}
