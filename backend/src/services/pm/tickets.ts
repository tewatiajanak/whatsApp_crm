import { User } from "../../models/User";
import { PmMaster } from "../../models/pm/Setup";
import { PmClient } from "../../models/pm/Client";
import { PmTemplate } from "../../models/pm/Template";
import { PmProject, nextNumber } from "../../models/pm/Project";
import { PmTicket } from "../../models/pm/Portal";
import { addTat } from "./dateEngine";
import { appUrl, everyMinute, kick, notify, queueMessages, Recipient } from "./messages";
import { loadCalendar, statusWith } from "./projects";

/** Response and resolution deadlines from the ticket priority (working hours). */
export async function slaDates(tenantId: any, priorityId: any, from = new Date()) {
  const p: any = priorityId ? await PmMaster.findOne({ _id: priorityId, tenant: tenantId, type: "ticket_priority" }).lean() : null;
  const cal = await loadCalendar(tenantId);
  return {
    responseDue: p?.values?.responseHours ? addTat(from, p.values.responseHours, "hours", cal) : null,
    resolveDue: p?.values?.resolveHours ? addTat(from, p.values.resolveHours, "hours", cal) : null,
  };
}

/** Tell the client about their ticket (created / updated / resolved) with the Ticket templates. */
export async function ticketMessage(ticket: any, kind: "created" | "updated" | "resolved") {
  const client: any = await PmClient.findOne({ _id: ticket.client, tenant: ticket.tenant }).lean();
  const contact = (client?.contacts || []).find((c: any) => c.email && c.email === ticket.raisedBy?.email) || (client?.contacts || []).find((c: any) => c.primary) || client?.contacts?.[0];
  if (!contact) return;
  const status: any = ticket.status ? await PmMaster.findById(ticket.status).select("name").lean() : null;
  const recipients: Recipient[] = [{ name: contact.name, email: contact.email, mobile: contact.mobile, spoc: true }];
  const refs = { projectId: ticket.project || undefined, extra: { "ticket.number": ticket.number, "ticket.subject": ticket.subject, "ticket.status": status?.name || "", "ticket.link": `${await appUrl(ticket.tenant)}/portal/tickets`, "client.name": client?.name || "" } };
  const word = { created: "creat", updated: "updat", resolved: "resolv" }[kind];
  for (const channel of ["email", "whatsapp"] as const) {
    const tpl: any = await PmTemplate.findOne({ tenant: ticket.tenant, channel, category: "Ticket", active: true, name: new RegExp(word, "i") }).lean();
    if (tpl) await queueMessages({ tenantId: ticket.tenant, channel, templateId: tpl._id, recipients, refs, event: `ticket_${kind}`, refKind: "ticket", refId: ticket._id });
  }
  kick();
}

export async function createTicket(tenantId: any, t: { client: any; project?: any; projectModule?: any; category?: any; priority?: any; subject: string; description: string; raisedBy: { name: string; email: string; user?: any }; source?: string; assignee?: any }) {
  const project: any = t.project ? await PmProject.findOne({ _id: t.project, tenant: tenantId }).select("product incharge").lean() : null;
  const open = (await PmMaster.find({ tenant: tenantId, type: "ticket_status", active: true }).sort({ order: 1 }).lean()).find((s: any) => s.flags?.isOpen) || (await statusWith(tenantId, "task_status", null));
  // no priority chosen → the middle one, so the ticket still gets a deadline
  const priorities = await PmMaster.find({ tenant: tenantId, type: "ticket_priority", active: true }).sort({ order: 1 }).lean();
  const priority = t.priority || priorities[Math.min(1, priorities.length - 1)]?._id || null;
  const ticket = await PmTicket.create({
    tenant: tenantId, number: `TKT-${String(await nextNumber(tenantId, "ticket")).padStart(4, "0")}`,
    client: t.client, project: t.project || null, product: project?.product || null, projectModule: t.projectModule || null,
    category: t.category || null, priority, status: open?._id || null, isClosed: false,
    subject: t.subject, description: t.description, raisedBy: t.raisedBy, assignee: t.assignee || null, source: t.source || "portal",
    ...(await slaDates(tenantId, priority)),
  });
  // the project incharge (or the account manager) hears about a new ticket
  const client: any = await PmClient.findById(t.client).select("accountManager name").lean();
  await notify({ tenantId, users: [ticket.assignee, project?.incharge, client?.accountManager], category: "ticket", title: `New ticket ${ticket.number}: ${ticket.subject}`, body: client?.name || "", link: `/modules/projects/tickets?open=${ticket._id}` });
  await ticketMessage(ticket, "created");
  return ticket;
}

/** A missed response or resolution time alerts the assignee's manager (or the account manager), once each. */
everyMinute(async () => {
  const now = new Date();
  const late: any[] = await PmTicket.find({
    isClosed: false, isDemo: { $ne: true },
    $or: [{ responseDue: { $lt: now }, firstResponseAt: null, slaAlerted: { $ne: "response" } }, { resolveDue: { $lt: now }, slaAlerted: { $ne: "resolve" } }],
  }).select("tenant number subject assignee client responseDue resolveDue firstResponseAt slaAlerted").lean();
  for (const t of late) {
    const kind = t.responseDue && t.responseDue < now && !t.firstResponseAt && !t.slaAlerted.includes("response") ? "response" : "resolve";
    const got = await PmTicket.updateOne({ _id: t._id, slaAlerted: { $ne: kind } }, { $addToSet: { slaAlerted: kind } });
    if (!got.modifiedCount) continue;
    const who: any = t.assignee ? await User.findById(t.assignee).select("reportingManager").lean() : null;
    const client: any = await PmClient.findById(t.client).select("accountManager").lean();
    await notify({ tenantId: t.tenant, users: [who?.reportingManager, client?.accountManager, t.assignee], category: "ticket", title: `SLA missed (${kind === "response" ? "response" : "resolution"}): ${t.number}`, body: t.subject, link: `/modules/projects/tickets?open=${t._id}` });
  }
});
