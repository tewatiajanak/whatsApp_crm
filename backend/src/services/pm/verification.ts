import { ApiError } from "../../utils/http";
import { PmClient } from "../../models/pm/Client";
import { PmTemplate } from "../../models/pm/Template";
import { PmComment, PmProject, PmProjectModule, PmTask } from "../../models/pm/Project";
import { PmSignoff, PmVerification } from "../../models/pm/Portal";
import { onPm, emitPm } from "./events";
import { appUrl, everyMinute, kick, mailSettings, notify, onInbound, queueMessages, Recipient, resolveRecipients } from "./messages";
import { newToken } from "./meetings";
import { logActivity, statusWith } from "./projects";
import { changeTaskStatus } from "./taskStatus";
import { normalizePhone } from "../whatsapp";

const DAY = 86_400_000;
const fmt = (d?: Date | null) => (d ? new Date(new Date(d).getTime() + 330 * 60_000).toISOString().slice(0, 10).split("-").reverse().join("-") : "");
const firstTemplate = (tenantId: any, channel: string, category: string) => PmTemplate.findOne({ tenant: tenantId, channel, category, active: true }).sort({ createdAt: 1 }).lean();

/* ───────────── client verification of a task ───────────── */

/** Send (or send again) the request of a verification to its contacts: Email with Approve / Reject links, WhatsApp with buttons. */
async function sendVerification(v: any, task: any, reminder = false) {
  const base = await appUrl(v.tenant);
  const recipients: Recipient[] = v.contacts.map((c: any) => ({ name: c.name, email: c.email, mobile: c.mobile, spoc: true }));
  const tokenOf = (r: Recipient) => v.contacts.find((c: any) => (c.email && c.email === r.email) || (c.mobile && c.mobile === r.mobile))?.token || "";
  const perRecipient = (r: Recipient) => ({
    "verification.approveLink": `${base}/pm/verify/${tokenOf(r)}?a=approve`,
    "verification.rejectLink": `${base}/pm/verify/${tokenOf(r)}?a=reject`,
  });
  // the rules of the task decide the templates; without a rule the first Verification template of each channel is used
  const rules = (task.autoMessages || []).filter((r: any) => r.when === "on_verification_request" && r.active);
  const templates = rules.length
    ? rules.map((r: any) => ({ channel: r.channel, template: r.template }))
    : (await Promise.all(["email", "whatsapp"].map(async (channel) => ({ channel, template: (await firstTemplate(v.tenant, channel, "Verification"))?._id })))).filter((x) => x.template);
  for (const t of templates) {
    await queueMessages({
      tenantId: v.tenant, channel: t.channel, templateId: t.template, recipients, refs: { taskId: task._id }, event: reminder ? "verification_reminder" : "on_verification_request",
      refKind: "verification", refId: v._id, perRecipient,
      buttons: (r) => [{ id: `pmv:approve:${tokenOf(r)}`, title: "Approve" }, { id: `pmv:reject:${tokenOf(r)}`, title: "Reject" }],
    });
  }
  kick();
}

/** A task was sent for verification: create the request and tell the client. */
export async function requestVerification(tenantId: any, taskId: any, by?: any) {
  const task: any = await PmTask.findOne({ _id: taskId, tenant: tenantId }).lean();
  if (!task?.project || !task.client) return null;
  // one open request per task
  await PmVerification.updateMany({ tenant: tenantId, task: task._id, status: "Pending" }, { $set: { status: "Expired" } });

  const client: any = await PmClient.findOne({ _id: task.client, tenant: tenantId }).lean();
  const rules = (task.autoMessages || []).filter((r: any) => r.when === "on_verification_request" && r.active);
  let people: Recipient[] = [];
  for (const r of rules) people.push(...(await resolveRecipients(tenantId, { ...r, recipients: r.recipients.filter((x: string) => x.startsWith("client_")) }, { taskId: task._id })));
  if (!people.length) {
    const c = (client?.contacts || []).find((x: any) => x.primary) || client?.contacts?.[0];
    if (c) people = [{ name: c.name, email: c.email, mobile: c.mobile, spoc: true }];
  }
  const seen = new Set<string>();
  const contacts = people
    .filter((p) => (p.email || p.mobile) && !seen.has(`${p.email}|${p.mobile}`) && seen.add(`${p.email}|${p.mobile}`))
    .map((p) => ({ name: p.name, email: p.email || "", mobile: p.mobile || "", token: newToken(), awaitingReason: false }));

  const s = await mailSettings(tenantId);
  const done = (task.checklist || []).filter((c: any) => c.done).map((c: any) => `✓ ${c.text}`);
  const v = await PmVerification.create({
    tenant: tenantId, task: task._id, project: task.project, client: task.client, contacts, requestedBy: by || null,
    summary: [task.description, ...done].filter(Boolean).join("\n"),
    expiresAt: new Date(Date.now() + (s.verificationLinkDays || 7) * DAY),
  });
  await logActivity({ tenant: tenantId, project: task.project, task: task._id, kind: "verification", text: contacts.length ? `Sent to the client for verification (${contacts.map((c) => c.name).join(", ")})` : "Waiting for client verification — the client has no contact to send it to" });
  if (contacts.length) await sendVerification(v, task);
  return v;
}

/**
 * The client's answer. The first valid answer wins; the request cannot be answered twice.
 *   approved → the task is completed
 *   rejected → the task goes back to In Progress with the client's comment
 */
export async function answerVerification(v: any, a: { approved: boolean; comment?: string; via: "portal" | "email" | "whatsapp"; by: string; from?: string }) {
  if (v.status !== "Pending") throw new ApiError(409, v.status === "Expired" ? "This request has expired" : "This request was already answered");
  if (new Date(v.expiresAt) < new Date()) {
    await PmVerification.updateOne({ _id: v._id, status: "Pending" }, { $set: { status: "Expired" } });
    throw new ApiError(410, "This link has expired. Ask the team to send it again.");
  }
  const comment = String(a.comment || "").trim();
  if (!a.approved && !comment) throw new ApiError(400, "Tell us what needs to change");
  const claimed = await PmVerification.updateOne(
    { _id: v._id, status: "Pending" },
    { $set: { status: a.approved ? "Approved" : "Rejected", answeredBy: a.by, answeredVia: a.via, answeredAt: new Date(), answeredFrom: a.from || "", comment, "contacts.$[].awaitingReason": false } }
  );
  if (!claimed.modifiedCount) throw new ApiError(409, "This request was already answered");

  const task = await PmTask.findOne({ _id: v.task, tenant: v.tenant });
  if (!task) return;
  const next = await statusWith(v.tenant, "task_status", a.approved ? "isCompleted" : "isInProgress");
  const who = { name: `${a.by} (client)` };
  if (comment) await PmComment.create({ tenant: v.tenant, task: task._id, project: task.project, by: null, byClient: a.by, text: comment, clientVisible: true });
  await logActivity({ tenant: v.tenant, project: task.project, task: task._id, kind: "verification", text: `Client ${a.approved ? "approved" : "rejected"} by ${a.via}${comment ? `: ${comment}` : ""}`, byName: who.name });
  if (next) await changeTaskStatus(v.tenant, task, next._id, who, { verified: a.approved, system: true });
  emitPm("verification_answered", { tenantId: String(v.tenant), actorName: who.name, taskId: String(task._id), projectId: String(task.project), data: { approved: a.approved, comment } });

  // tell the team by Email as well, with the Verification Approved / Rejected template when there is one
  const tpl: any = await PmTemplate.findOne({ tenant: v.tenant, channel: "email", category: "Verification", active: true, name: new RegExp(a.approved ? "approv" : "reject", "i") }).lean();
  if (tpl) {
    const recipients = await resolveRecipients(v.tenant, { recipients: ["assignee", "project_incharge"], roles: [], employees: [], extra: [], channel: "email" }, { taskId: task._id });
    await queueMessages({ tenantId: v.tenant, channel: "email", templateId: tpl._id, recipients, refs: { taskId: task._id }, event: "verification_answered", refKind: "verification", refId: v._id });
    kick();
  }
}

/* ───────────── sign-off ───────────── */

export async function requestSignoff(tenantId: any, projectId: any, moduleId: any, by: any) {
  const project: any = await PmProject.findOne({ _id: projectId, tenant: tenantId }).lean();
  if (!project) throw new ApiError(404, "Project not found");
  const mod: any = moduleId ? await PmProjectModule.findOne({ _id: moduleId, tenant: tenantId, project: project._id }).lean() : null;
  if (moduleId && !mod) throw new ApiError(404, "Module not found");
  const scope: any = { tenant: tenantId, project: project._id, ...(mod ? { projectModule: mod._id } : {}) };
  if (!(await PmTask.exists(scope))) throw new ApiError(400, "There are no tasks to sign off");
  if (await PmTask.exists({ ...scope, isCompleted: false })) throw new ApiError(400, "Complete all tasks before asking for the sign-off");
  if (await PmSignoff.exists({ tenant: tenantId, project: project._id, projectModule: mod?._id || null, status: "Pending" })) throw new ApiError(409, "A sign-off request is already waiting for the client");

  const client: any = await PmClient.findOne({ _id: project.client, tenant: tenantId }).lean();
  const c = (client?.contacts || []).find((x: any) => x.primary) || client?.contacts?.[0];
  if (!c?.email && !c?.mobile) throw new ApiError(400, "The client has no contact with an email or mobile number");

  const modules = mod ? [mod] : await PmProjectModule.find({ tenant: tenantId, project: project._id }).sort({ order: 1 }).lean();
  const summary: { module: string; tasks: number; completedOn: string }[] = [];
  for (const m of modules) {
    const tasks = await PmTask.find({ tenant: tenantId, projectModule: m._id }).select("actualEnd").lean();
    const last = tasks.reduce((d: Date | null, t: any) => (t.actualEnd && (!d || t.actualEnd > d) ? t.actualEnd : d), null);
    summary.push({ module: m.name, tasks: tasks.length, completedOn: fmt(last) });
  }
  const s = await mailSettings(tenantId);
  const so = await PmSignoff.create({
    tenant: tenantId, project: project._id, projectModule: mod?._id || null, client: project.client, title: mod ? `${project.name} — ${mod.name}` : project.name,
    summary, contact: { name: c.name, email: c.email || "", mobile: c.mobile || "" }, token: newToken(), requestedBy: by,
    expiresAt: new Date(Date.now() + Math.max(14, s.verificationLinkDays || 7) * DAY),
  });

  const link = `${await appUrl(tenantId)}/pm/signoff/${so.token}`;
  const recipients: Recipient[] = [{ name: c.name, email: c.email, mobile: c.mobile, spoc: true }];
  const refs = { projectId: project._id, moduleId: mod?._id, extra: { "signoff.link": link } };
  // the product's own rules first (module sign-off), then the default Sign-off templates
  let sent = 0;
  for (const r of (mod?.autoMessages || []).filter((x: any) => x.when === "module_signoff" && x.active)) {
    sent += await queueMessages({ tenantId, channel: r.channel, templateId: r.template, recipients: await resolveRecipients(tenantId, r, refs), refs, event: "module_signoff", refKind: "signoff", refId: so._id });
  }
  if (!sent) {
    for (const channel of ["email", "whatsapp"] as const) {
      const tpl: any = await PmTemplate.findOne({ tenant: tenantId, channel, category: "Sign-off", active: true, ...(channel === "email" ? { name: new RegExp(mod ? "module" : "project", "i") } : {}) }).lean()
        || await firstTemplate(tenantId, channel, "Sign-off");
      if (tpl) await queueMessages({ tenantId, channel, templateId: tpl._id, recipients, refs, event: mod ? "module_signoff" : "project_signoff", refKind: "signoff", refId: so._id });
    }
  }
  await logActivity({ tenant: tenantId, project: project._id, kind: "signoff", text: `Sign-off requested from ${c.name}: ${so.title}` });
  kick();
  return so;
}

export async function answerSignoff(so: any, a: { accept: boolean; comment?: string; by: string; from?: string }) {
  if (so.status !== "Pending") throw new ApiError(409, so.status === "Expired" ? "This request has expired" : "This request was already answered");
  if (new Date(so.expiresAt) < new Date()) {
    await PmSignoff.updateOne({ _id: so._id, status: "Pending" }, { $set: { status: "Expired" } });
    throw new ApiError(410, "This link has expired. Ask the team to send it again.");
  }
  const comment = String(a.comment || "").trim();
  if (!a.accept && !comment) throw new ApiError(400, "Tell us your concern");
  const claimed = await PmSignoff.updateOne({ _id: so._id, status: "Pending" }, { $set: { status: a.accept ? "Accepted" : "Concern", answeredAt: new Date(), answeredBy: a.by, answeredFrom: a.from || "", comment } });
  if (!claimed.modifiedCount) throw new ApiError(409, "This request was already answered");

  const project: any = await PmProject.findById(so.project).select("incharge name").lean();
  if (a.accept) {
    const stamp = { signedOffAt: new Date(), signedOffBy: a.by };
    if (so.projectModule) await PmProjectModule.updateOne({ _id: so.projectModule }, { $set: stamp });
    else {
      await PmProject.updateOne({ _id: so.project }, { $set: stamp });
      await PmProjectModule.updateMany({ project: so.project, signedOffAt: null }, { $set: stamp });
    }
  } else {
    // a concern becomes a ticket for the team
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createTicket } = require("./tickets");
    const ticket = await createTicket(so.tenant, { client: so.client, project: so.project, projectModule: so.projectModule, subject: `Sign-off concern: ${so.title}`, description: comment, raisedBy: { name: a.by, email: so.contact?.email || "" }, source: "signoff" });
    await PmSignoff.updateOne({ _id: so._id }, { $set: { ticket: ticket._id } });
  }
  await logActivity({ tenant: so.tenant, project: so.project, kind: "signoff", text: `${so.title}: ${a.accept ? "signed off" : "concern raised"} by ${a.by}${comment ? ` — ${comment}` : ""}`, byName: `${a.by} (client)` });
  await notify({ tenantId: so.tenant, users: [project?.incharge, so.requestedBy], category: "verification", title: `${a.accept ? "Signed off" : "Sign-off concern"}: ${so.title}`, body: comment, projectId: so.project });
}

/* ───────────── wiring ───────────── */

let wired = false;
export function startVerification() {
  if (wired) return;
  wired = true;

  onPm(async (event, p) => {
    if (event === "verification_requested" && p.taskId) await requestVerification(p.tenantId, p.taskId, p.actorId);
  });

  // WhatsApp: a button tap answers; after "Reject" the next text from that number is the reason
  onInbound(async (tenantId, ev) => {
    if (ev.kind !== "message" || !ev.from) return;
    const from = normalizePhone(ev.from);
    const id = ev.interactiveReply?.id || "";
    const m = /^pmv:(approve|reject):([0-9a-f]{24,64})$/.exec(id);
    if (m) {
      const v: any = await PmVerification.findOne({ tenant: tenantId, "contacts.token": m[2] });
      if (!v) return;
      const contact = v.contacts.find((c: any) => c.token === m[2]);
      if (m[1] === "approve") await answerVerification(v, { approved: true, via: "whatsapp", by: contact.name, from }).catch(() => {});
      else await PmVerification.updateOne({ _id: v._id, "contacts.token": m[2] }, { $set: { "contacts.$.awaitingReason": true } });
      if (m[1] === "reject") {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        await require("../whatsapp").sendText(tenantId, from, "Please reply with the reason, so the team can fix it.").catch(() => {});
      }
      return;
    }
    if (ev.text) {
      const waiting: any[] = await PmVerification.find({ tenant: tenantId, status: "Pending", "contacts.awaitingReason": true }).sort({ sentAt: -1 });
      const v = waiting.find((x) => x.contacts.some((c: any) => c.awaitingReason && normalizePhone(c.mobile || "") === from));
      if (v) {
        const contact = v.contacts.find((c: any) => c.awaitingReason && normalizePhone(c.mobile || "") === from);
        await answerVerification(v, { approved: false, comment: ev.text, via: "whatsapp", by: contact.name, from }).catch(() => {});
      }
    }
  });

  // reminders for pending verifications, and expiry
  everyMinute(async () => {
    const now = Date.now();
    await PmVerification.updateMany({ status: "Pending", expiresAt: { $lt: new Date(now) } }, { $set: { status: "Expired" } });
    await PmSignoff.updateMany({ status: "Pending", expiresAt: { $lt: new Date(now) } }, { $set: { status: "Expired" } });
    const pending: any[] = await PmVerification.find({ status: "Pending", reminders: { $lt: 3 } }).lean();
    for (const v of pending) {
      const days = (await mailSettings(v.tenant)).verificationReminderDays || 0;
      if (!days || now < new Date(v.lastReminderAt || v.sentAt).getTime() + days * DAY) continue;
      const got = await PmVerification.updateOne({ _id: v._id, reminders: v.reminders }, { $inc: { reminders: 1 }, $set: { lastReminderAt: new Date() } });
      if (!got.modifiedCount) continue;
      const task: any = await PmTask.findById(v.task).lean();
      if (task && task.isWaitingForClient) await sendVerification(v, task, true);
    }
  });
}
