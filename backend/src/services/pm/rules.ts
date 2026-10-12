import { Types } from "mongoose";
import { ApiError } from "../../utils/http";
import { User } from "../../models/User";
import { PmMaster } from "../../models/pm/Setup";
import { PmTemplate } from "../../models/pm/Template";

/**
 * Auto Email / WhatsApp rules. They live on a task template, a product module
 * or a product; a project copies them when it is created and may edit its copy.
 */
export const RULE_EVENTS: Record<"task" | "module" | "project", { value: string; label: string; offset?: boolean; status?: boolean }[]> = {
  task: [
    { value: "before_start", label: "Before task start", offset: true },
    { value: "on_start", label: "On task start" },
    { value: "before_due", label: "Before due date", offset: true },
    { value: "on_completion", label: "On task completion" },
    { value: "after_overdue", label: "After overdue", offset: true },
    { value: "on_status_change", label: "On status change to", status: true },
    { value: "on_verification_request", label: "On client verification request" },
  ],
  module: [
    { value: "module_completed", label: "Module completed" },
    { value: "module_signoff", label: "Module sign-off" },
  ],
  project: [
    { value: "project_created", label: "Project created / kick-off" },
    { value: "before_project_end", label: "Before project end", offset: true },
    { value: "project_completed", label: "Project completed" },
    { value: "project_delayed", label: "Project delayed" },
  ],
};

export const RULE_RECIPIENTS = [
  { value: "client_primary", label: "Client primary contact" },
  { value: "client_all", label: "All client contacts" },
  { value: "client_roles", label: "Client contacts by designation" },
  { value: "assignee", label: "Task assignee" },
  { value: "module_incharge", label: "Module incharge" },
  { value: "project_incharge", label: "Project incharge" },
  { value: "manager", label: "Assignee's reporting manager" },
  { value: "team", label: "Whole project team" },
  { value: "employees", label: "Specific employees" },
  { value: "extra", label: "Extra emails / numbers" },
];
const RECIPIENT_KEYS = new Set(RULE_RECIPIENTS.map((r) => r.value));

export interface IAutoRule {
  _id: Types.ObjectId;
  when: string;
  offsetValue: number;
  offsetUnit: "hours" | "days";
  /** on_status_change: the status that fires it */
  status: Types.ObjectId | null;
  channel: "email" | "whatsapp";
  template: Types.ObjectId;
  recipients: string[];
  /** client_roles: designations */
  roles: string[];
  employees: Types.ObjectId[];
  /** extra: emails or numbers */
  extra: string[];
  active: boolean;
}

const strings = (v: any) => (Array.isArray(v) ? v : String(v || "").split(/[,;\n]/)).map((x: any) => String(x).trim()).filter(Boolean);

/** Validate and normalise a list of rules sent by the screen. */
export async function cleanRules(tenantId: any, level: "task" | "module" | "project", list: any): Promise<IAutoRule[]> {
  const rules = Array.isArray(list) ? list : [];
  if (rules.length > 30) throw new ApiError(400, "At most 30 rules");
  const events = RULE_EVENTS[level];
  const [templates, statuses, users] = await Promise.all([
    PmTemplate.find({ tenant: tenantId }).select("_id channel").lean(),
    PmMaster.find({ tenant: tenantId, type: "task_status" }).select("_id").lean(),
    User.find({ tenant: tenantId }).select("_id").lean(),
  ]);
  const tpl = new Map(templates.map((t) => [String(t._id), t.channel]));
  const statusIds = new Set(statuses.map((s) => String(s._id)));
  const userIds = new Set(users.map((u) => String(u._id)));

  return rules.map((raw: any, i: number) => {
    const n = `Rule ${i + 1}`;
    const ev = events.find((e) => e.value === raw?.when);
    if (!ev) throw new ApiError(400, `${n}: choose when to send`);
    const channel = raw.channel === "whatsapp" ? "whatsapp" : "email";
    const template = String(raw.template?._id || raw.template || "");
    if (!tpl.has(template)) throw new ApiError(400, `${n}: choose a template`);
    if (tpl.get(template) !== channel) throw new ApiError(400, `${n}: the template is not a ${channel === "email" ? "Email" : "WhatsApp"} template`);
    const recipients = [...new Set(strings(raw.recipients))].filter((r) => RECIPIENT_KEYS.has(r));
    if (!recipients.length) throw new ApiError(400, `${n}: choose who receives it`);
    const status = ev.status ? String(raw.status?._id || raw.status || "") : "";
    if (ev.status && !statusIds.has(status)) throw new ApiError(400, `${n}: choose the status`);
    const offsetValue = ev.offset ? Math.max(0, Number(raw.offsetValue) || 0) : 0;
    const employees = recipients.includes("employees") ? [...new Set(strings(raw.employees?.map?.((e: any) => e?._id || e) ?? raw.employees))].filter((e) => userIds.has(e)) : [];
    if (recipients.includes("employees") && !employees.length) throw new ApiError(400, `${n}: choose the employees`);
    const extra = recipients.includes("extra") ? strings(raw.extra) : [];
    if (recipients.includes("extra") && !extra.length) throw new ApiError(400, `${n}: enter the extra emails or numbers`);
    const roles = recipients.includes("client_roles") ? strings(raw.roles) : [];
    if (recipients.includes("client_roles") && !roles.length) throw new ApiError(400, `${n}: enter the designations`);
    return {
      _id: Types.ObjectId.isValid(raw._id) ? new Types.ObjectId(String(raw._id)) : new Types.ObjectId(),
      when: ev.value,
      offsetValue,
      offsetUnit: raw.offsetUnit === "hours" ? "hours" : "days",
      status: status ? new Types.ObjectId(status) : null,
      channel,
      template: new Types.ObjectId(template),
      recipients,
      roles,
      employees: employees.map((e) => new Types.ObjectId(e)),
      extra,
      active: raw.active !== false,
    } as IAutoRule;
  });
}
