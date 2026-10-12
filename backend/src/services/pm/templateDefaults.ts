import { PmTemplate } from "../../models/pm/Template";
import { getPmSettings } from "./masters";

type Def = { name: string; channel: "email" | "whatsapp"; category: string; subject?: string; body: string };
const p = (...lines: string[]) => lines.map((l) => `<p>${l}</p>`).join("");
const SIGN = "Regards,<br>{{company.name}}";

/** The templates a new tenant starts with. All of them can be edited or removed. */
const DEFAULTS: Def[] = [
  { name: "Task Assigned", channel: "email", category: "Task", subject: "New task: {{task.title}}", body: p("Hi {{task.assignee}},", "A task has been assigned to you in <b>{{project.name}}</b>.", "<b>{{task.title}}</b><br>Module: {{module.name}}<br>Due: {{task.dueDate}} ({{task.tat}})", '<a href="{{task.link}}">Open task</a>', SIGN) },
  { name: "Task Due Reminder", channel: "email", category: "Reminder", subject: "Due {{task.dueDate}}: {{task.title}}", body: p("Hi {{task.assignee}},", "<b>{{task.title}}</b> in {{project.name}} is due on <b>{{task.dueDate}}</b>.", "Checklist: {{task.checklistDone}}", '<a href="{{task.link}}">Open task</a>', SIGN) },
  { name: "Task Overdue", channel: "email", category: "Reminder", subject: "Overdue: {{task.title}}", body: p("Hi {{task.assignee}},", "<b>{{task.title}}</b> in {{project.name}} was due on {{task.dueDate}} and is still {{task.status}}.", '<a href="{{task.link}}">Open task</a>', SIGN) },
  { name: "Task Completed", channel: "email", category: "Task", subject: "{{project.name}}: {{task.title}} completed", body: p("Dear {{spoc.name}},", "<b>{{task.title}}</b> ({{module.name}}) has been completed.", "Project progress: {{project.progress}}", SIGN) },
  { name: "Internal Update", channel: "email", category: "Task", subject: "{{project.name}}: {{task.title}} is {{task.status}}", body: p("Team,", "<b>{{task.title}}</b> ({{module.name}}) is now <b>{{task.status}}</b>.", "Assignee: {{task.assignee}}<br>Project progress: {{project.progress}}", '<a href="{{task.link}}">Open task</a>') },
  { name: "Client Verification Request", channel: "email", category: "Verification", subject: "Please verify: {{task.title}}", body: p("Dear {{spoc.name}},", "<b>{{task.title}}</b> ({{module.name}}) of {{project.name}} is ready for your verification.", '<a href="{{verification.approveLink}}">Approve</a> &nbsp;|&nbsp; <a href="{{verification.rejectLink}}">Reject</a>', SIGN) },
  { name: "Verification Approved", channel: "email", category: "Verification", subject: "Approved by client: {{task.title}}", body: p("Hi {{task.assignee}},", "{{client.name}} has approved <b>{{task.title}}</b>.", '<a href="{{task.link}}">Open task</a>') },
  { name: "Verification Rejected", channel: "email", category: "Verification", subject: "Rejected by client: {{task.title}}", body: p("Hi {{task.assignee}},", "{{client.name}} has rejected <b>{{task.title}}</b>. The task is back with you.", '<a href="{{task.link}}">Open task</a>') },
  { name: "Module Sign-off", channel: "email", category: "Sign-off", subject: "Sign-off: {{module.name}} – {{project.name}}", body: p("Dear {{spoc.name}},", "All tasks of <b>{{module.name}}</b> are completed. Please review and sign off.", '<a href="{{signoff.link}}">Review and sign off</a>', SIGN) },
  { name: "Project Sign-off", channel: "email", category: "Sign-off", subject: "Project sign-off: {{project.name}}", body: p("Dear {{spoc.name}},", "<b>{{project.name}}</b> is completed. Please review and sign off.", '<a href="{{signoff.link}}">Review and sign off</a>', SIGN) },
  { name: "Project Kick-off", channel: "email", category: "Project", subject: "Kick-off: {{project.name}}", body: p("Dear {{spoc.name}},", "We are starting <b>{{project.name}}</b> on {{project.startDate}}. The planned completion is {{project.endDate}}.", "Your project incharge is {{project.incharge}}.", SIGN) },
  { name: "Meeting Invite", channel: "email", category: "Meeting", subject: "Meeting: {{meeting.title}} on {{meeting.date}}", body: p("Hello,", "<b>{{meeting.title}}</b><br>{{meeting.date}}, {{meeting.time}}<br>{{meeting.location}}", '<a href="{{meeting.link}}">Join / respond</a>', SIGN) },
  { name: "Training Invite", channel: "email", category: "Training", subject: "Training: {{meeting.title}} on {{meeting.date}}", body: p("Hello,", "You are invited to the training <b>{{meeting.title}}</b>.<br>{{meeting.date}}, {{meeting.time}}<br>{{meeting.location}}", '<a href="{{meeting.link}}">Join / respond</a>', SIGN) },
  { name: "Ticket Created", channel: "email", category: "Ticket", subject: "[{{ticket.number}}] {{ticket.subject}}", body: p("Dear {{spoc.name}},", "Your ticket <b>{{ticket.number}}</b> has been registered: {{ticket.subject}}.", SIGN) },
  { name: "Ticket Updated", channel: "email", category: "Ticket", subject: "[{{ticket.number}}] Update: {{ticket.subject}}", body: p("Dear {{spoc.name}},", "There is an update on ticket <b>{{ticket.number}}</b>. Status: {{ticket.status}}.", SIGN) },
  { name: "Ticket Resolved", channel: "email", category: "Ticket", subject: "[{{ticket.number}}] Resolved: {{ticket.subject}}", body: p("Dear {{spoc.name}},", "Ticket <b>{{ticket.number}}</b> has been resolved.", SIGN) },

  { name: "Task Assigned", channel: "whatsapp", category: "Task", body: "Hi {{task.assignee}}, new task in {{project.name}}: *{{task.title}}*. Due {{task.dueDate}}. {{task.link}}" },
  { name: "Task Due Reminder", channel: "whatsapp", category: "Reminder", body: "Reminder: *{{task.title}}* ({{project.name}}) is due on {{task.dueDate}}. {{task.link}}" },
  { name: "Task Overdue", channel: "whatsapp", category: "Reminder", body: "Overdue: *{{task.title}}* ({{project.name}}) was due on {{task.dueDate}}. {{task.link}}" },
  { name: "Task Completed", channel: "whatsapp", category: "Task", body: "{{project.name}}: *{{task.title}}* is completed. Progress {{project.progress}}." },
  { name: "Client Verification Request", channel: "whatsapp", category: "Verification", body: "Dear {{spoc.name}}, *{{task.title}}* of {{project.name}} is ready for your verification. Approve: {{verification.approveLink}} Reject: {{verification.rejectLink}}" },
  { name: "Meeting Invite", channel: "whatsapp", category: "Meeting", body: "*{{meeting.title}}* on {{meeting.date}}, {{meeting.time}}. {{meeting.location}} {{meeting.link}}" },
  { name: "Ticket Created", channel: "whatsapp", category: "Ticket", body: "Ticket *{{ticket.number}}* registered: {{ticket.subject}}." },
];

/** Create the default templates once per tenant. */
export async function ensureTemplates(tenantId: any) {
  const s = await getPmSettings(tenantId);
  if (s.templatesSeeded) return;
  if (!(await PmTemplate.exists({ tenant: tenantId }))) {
    await PmTemplate.insertMany(DEFAULTS.map((d) => ({ ...d, tenant: tenantId })), { ordered: false }).catch(() => {});
  }
  s.templatesSeeded = true;
  await s.save();
}
