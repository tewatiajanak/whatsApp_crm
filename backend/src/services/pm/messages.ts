import { Types } from "mongoose";
import { User } from "../../models/User";
import { Tenant } from "../../models/Tenant";
import { PmClient } from "../../models/pm/Client";
import { PmTemplate } from "../../models/pm/Template";
import { PmProject, PmProjectModule, PmTask } from "../../models/pm/Project";
import { PmMessage, PmMailSettings, PmNotification, PmNotifyPref } from "../../models/pm/Message";
import { htmlToText, renderKeys } from "./keys";
import { IAutoRule } from "./rules";
import { PmEvent, PmEventPayload, onPm } from "./events";
import { logActivity, projectStats } from "./projects";
import { sendEmail } from "../email";
import { sendComponents, sendsAsTemplate } from "./waTemplate";
import { sendInteractiveButtons, sendTemplate, sendText, normalizePhone } from "../whatsapp";
import { decryptSecret } from "../payments/crypto";

/**
 * Sending engine of Project Management.
 *   event / scheduler → rules → recipients → rendered message → pm_messages (queue) → provider
 * Also writes the in-app notifications.
 */

const TAT_LABEL: Record<string, string> = { hours: "Hours", days: "Days", working_days: "Working Days" };
const fmt = (d?: Date | null) => (d ? new Date(new Date(d).getTime() + 330 * 60_000).toISOString().slice(0, 10).split("-").reverse().join("-") : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function mailSettings(tenantId: any) {
  return (await PmMailSettings.findOne({ tenant: tenantId })) || (await PmMailSettings.create({ tenant: tenantId }).catch(() => PmMailSettings.findOne({ tenant: tenantId })))!;
}

/** Address of the web app, for links inside messages. */
export async function appUrl(tenantId: any) {
  const s = await mailSettings(tenantId);
  return (s?.appUrl || process.env.PUBLIC_APP_URL || (process.env.CLIENT_ORIGIN || "").split(",")[0] || "http://localhost:5173").replace(/\/+$/, "");
}

/* ───────────── context: the values of the dynamic keys ───────────── */

export interface Refs {
  projectId?: any;
  taskId?: any;
  moduleId?: any;
  /** extra values set by the caller: meeting.*, ticket.*, verification.*, signoff.link, spoc.name, employee.name */
  extra?: Record<string, string>;
}

export async function loadRefs(tenantId: any, refs: Refs) {
  const task: any = refs.taskId ? await PmTask.findOne({ _id: refs.taskId, tenant: tenantId }).populate("assignee", "name email mobile reportingManager").populate("status", "name").lean() : null;
  const projectId = refs.projectId || task?.project;
  const project: any = projectId ? await PmProject.findOne({ _id: projectId, tenant: tenantId }).populate("incharge", "name email mobile").populate("status", "name").lean() : null;
  const moduleId = refs.moduleId || task?.projectModule;
  const mod: any = moduleId ? await PmProjectModule.findOne({ _id: moduleId, tenant: tenantId }).populate("incharge", "name email mobile").lean() : null;
  const client: any = project?.client ? await PmClient.findOne({ _id: project.client, tenant: tenantId }).lean() : null;
  return { task, project, mod, client };
}

export async function buildContext(tenantId: any, refs: Refs): Promise<Record<string, string>> {
  const { task, project, mod, client } = await loadRefs(tenantId, refs);
  const [tenant, base] = await Promise.all([Tenant.findById(tenantId).select("name").lean(), appUrl(tenantId)]);
  const v: Record<string, string> = { "company.name": tenant?.name || "", today: fmt(new Date()) };
  if (client) {
    const primary = (client.contacts || []).find((c: any) => c.primary) || client.contacts?.[0];
    Object.assign(v, { "client.name": client.name, "client.city": client.city || "", "spoc.name": primary?.name || client.name });
  }
  if (project) {
    const stats = (await projectStats(tenantId, [project])).projects.get(String(project._id));
    Object.assign(v, {
      "project.name": project.name, "project.code": project.code, "project.incharge": project.incharge?.name || "",
      "project.startDate": fmt(project.startDate), "project.endDate": fmt(project.plannedEnd), "project.progress": `${stats?.progress ?? 0}%`, "project.status": project.status?.name || "",
    });
  }
  if (mod) Object.assign(v, { "module.name": mod.name, "module.incharge": mod.incharge?.name || "" });
  if (task) {
    const done = (task.checklist || []).filter((c: any) => c.done).length;
    Object.assign(v, {
      "task.title": task.title, "task.assignee": task.assignee?.name || "", "task.dueDate": fmt(task.due), "task.status": task.status?.name || "",
      "task.tat": `${task.tatValue} ${TAT_LABEL[task.tatUnit] || ""}`.trim(), "task.checklistDone": `${done}/${(task.checklist || []).length}`,
      "task.link": project ? `${base}/modules/projects/p/${project._id}?tab=Tasks&task=${task._id}` : `${base}/modules/projects/my-work?task=${task._id}`,
      "employee.name": task.assignee?.name || "",
    });
  }
  return { ...v, ...(refs.extra || {}) };
}

/* ───────────── recipients ───────────── */

export interface Recipient {
  name: string;
  email: string;
  mobile: string;
  /** a client contact: the greeting {{spoc.name}} is theirs */
  spoc?: boolean;
  userId?: string;
}
const person = (u: any): Recipient => ({ name: u.name, email: u.email || "", mobile: u.mobile || "", userId: String(u._id) });

export async function resolveRecipients(tenantId: any, rule: Pick<IAutoRule, "recipients" | "roles" | "employees" | "extra" | "channel">, refs: Refs): Promise<Recipient[]> {
  const { task, project, mod, client } = await loadRefs(tenantId, refs);
  const out: Recipient[] = [];
  const contacts: any[] = client?.contacts || [];
  for (const kind of rule.recipients) {
    if (kind === "client_primary") {
      const c = contacts.find((x) => x.primary) || contacts[0];
      if (c) out.push({ name: c.name, email: c.email, mobile: c.mobile, spoc: true });
    } else if (kind === "client_all") contacts.forEach((c) => out.push({ name: c.name, email: c.email, mobile: c.mobile, spoc: true }));
    else if (kind === "client_roles") {
      const roles = (rule.roles || []).map((r) => r.toLowerCase());
      contacts.filter((c) => roles.includes(String(c.designation || "").toLowerCase())).forEach((c) => out.push({ name: c.name, email: c.email, mobile: c.mobile, spoc: true }));
    } else if (kind === "assignee" && task?.assignee) out.push(person(task.assignee));
    else if (kind === "module_incharge" && mod?.incharge) out.push(person(mod.incharge));
    else if (kind === "project_incharge" && project?.incharge) out.push(person(project.incharge));
    else if (kind === "manager" && task?.assignee?.reportingManager) {
      const m = await User.findById(task.assignee.reportingManager).select("name email mobile").lean();
      if (m) out.push(person(m));
    } else if (kind === "team" && project) {
      const [assignees, incharges] = await Promise.all([
        PmTask.distinct("assignee", { tenant: tenantId, project: project._id, assignee: { $ne: null } }),
        PmProjectModule.distinct("incharge", { tenant: tenantId, project: project._id, incharge: { $ne: null } }),
      ]);
      (await User.find({ _id: { $in: [...assignees, ...incharges, project.incharge?._id].filter(Boolean) }, status: "Active" }).select("name email mobile").lean()).forEach((u) => out.push(person(u)));
    } else if (kind === "employees") {
      (await User.find({ _id: { $in: rule.employees || [] }, tenant: tenantId }).select("name email mobile").lean()).forEach((u) => out.push(person(u)));
    } else if (kind === "extra") {
      (rule.extra || []).forEach((x) => out.push({ name: "", email: EMAIL.test(x) ? x : "", mobile: EMAIL.test(x) ? "" : x }));
    }
  }
  // one message per address
  const seen = new Set<string>();
  return out.filter((r) => {
    const key = rule.channel === "email" ? r.email.toLowerCase() : normalizePhone(r.mobile || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ───────────── queue ───────────── */

export interface QueueInput {
  tenantId: any;
  channel: "email" | "whatsapp";
  templateId?: any;
  /** used when no template is given */
  subject?: string;
  body?: string;
  templateName?: string;
  recipients: Recipient[];
  refs: Refs;
  event: string;
  scheduledAt?: Date;
  refKind?: string;
  refId?: any;
  attachments?: { filename: string; content: string; contentType: string }[];
  /** per recipient extra values, e.g. a personal verification link */
  perRecipient?: (r: Recipient) => Record<string, string> | Promise<Record<string, string>>;
  /** WhatsApp quick-reply buttons, per recipient */
  buttons?: (r: Recipient) => { id: string; title: string }[];
}

/** Render a message for every recipient and put it in the queue. */
export async function queueMessages(input: QueueInput): Promise<number> {
  const { tenantId } = input;
  const tpl: any = input.templateId ? await PmTemplate.findOne({ _id: input.templateId, tenant: tenantId }).lean() : null;
  if (input.templateId && (!tpl || !tpl.active)) return 0;
  const settings = await mailSettings(tenantId);
  const base = await buildContext(tenantId, input.refs);
  const { task, project, client } = await loadRefs(tenantId, input.refs);
  const demo = !!(task?.isDemo || project?.isDemo);
  const subject = tpl?.subject ?? input.subject ?? "";
  const body = tpl?.body ?? input.body ?? "";
  const channel = tpl?.channel || input.channel;
  // a template still waiting for approval goes as plain text
  const asTemplate = channel === "whatsapp" && sendsAsTemplate(tpl);

  const docs: any[] = [];
  for (const r of input.recipients) {
    const real = channel === "email" ? r.email : normalizePhone(r.mobile || "");
    if (!real) continue;
    const values = { ...base, ...(r.spoc ? { "spoc.name": r.name } : {}), ...(r.userId ? { "employee.name": r.name } : {}), ...((await input.perRecipient?.(r)) || {}) };
    const off = channel === "email" ? !settings.emailEnabled : !settings.whatsappEnabled;
    const test = settings.testMode ? (channel === "email" ? settings.testEmail : normalizePhone(settings.testNumber || "")) : "";
    // why a message is not sent at all
    const skip = demo ? "Demo data: not sent" : off ? "Sending is switched off" : settings.testMode && !test ? "Test mode is on, but no test recipient is set" : "";
    const text = renderKeys(body, values);
    docs.push({
      tenant: tenantId,
      channel,
      to: skip ? real : test || real,
      intendedTo: real,
      toName: r.name,
      templateName: tpl?.name || input.templateName || "",
      subject: renderKeys(subject, values),
      body: text,
      waTemplateName: asTemplate ? tpl.waTemplateName : "",
      waLanguage: tpl?.waLanguage || "en",
      // an approved WhatsApp template receives the key values in the order they appear in the text
      waParams: asTemplate ? [...String(body).matchAll(/\{\{\s*([a-zA-Z]+\.?[a-zA-Z]*)\s*\}\}/g)].map((m) => values[m[1]] ?? "") : [],
      waComponents: asTemplate ? sendComponents(tpl, values) : [],
      waButtons: channel === "whatsapp" && !asTemplate ? input.buttons?.(r) || [] : [],
      attachments: input.attachments || [],
      event: input.event,
      project: project?._id || null,
      task: task?._id || null,
      client: client?._id || null,
      refKind: input.refKind || "",
      refId: input.refId || null,
      scheduledAt: input.scheduledAt || new Date(),
      status: skip ? "Skipped" : "Pending",
      error: skip,
    });
  }
  if (docs.length) await PmMessage.insertMany(docs);
  return docs.length;
}

/** Queue one auto-message rule. */
export async function fireRule(tenantId: any, rule: IAutoRule, refs: Refs, event: string, extra?: Partial<QueueInput>) {
  if (!rule?.active) return 0;
  const recipients = await resolveRecipients(tenantId, rule, refs);
  if (!recipients.length) return 0;
  return queueMessages({ tenantId, channel: rule.channel, templateId: rule.template, recipients, refs, event, ...extra });
}

/* ───────────── sending ───────────── */

async function deliver(m: any) {
  const settings = await mailSettings(m.tenant);
  if (m.channel === "email") {
    const smtp = settings.smtpHost ? { host: settings.smtpHost, port: settings.smtpPort, secure: settings.smtpSecure, user: settings.smtpUser, pass: decryptSecret(settings.smtpPass) } : null;
    const from = settings.fromEmail ? (settings.fromName ? `"${settings.fromName.replace(/"/g, "")}" <${settings.fromEmail}>` : settings.fromEmail) : undefined;
    const note = m.to !== m.intendedTo ? `<p style="color:#888;font-size:12px">[Test mode] Meant for ${m.toName || ""} &lt;${m.intendedTo}&gt;</p>` : "";
    const out = await sendEmail({ to: m.to, subject: m.subject, html: note + m.body, text: htmlToText(m.body), from, smtp, attachments: m.attachments?.length ? m.attachments : undefined });
    return { id: out.messageId, simulated: out.simulated };
  }
  const note = m.to !== m.intendedTo ? `[Test mode — for ${m.toName || m.intendedTo}]\n` : "";
  const out: any = m.waTemplateName
    ? await sendTemplate(String(m.tenant), m.to, m.waTemplateName, m.waLanguage || "en", m.waComponents?.length ? m.waComponents : m.waParams || [])
    : m.waButtons?.length
    ? await sendInteractiveButtons(String(m.tenant), m.to, (note + htmlToText(m.body)).slice(0, 1000), m.waButtons)
    : await sendText(String(m.tenant), m.to, note + htmlToText(m.body));
  return { id: out?.waMessageId || "", simulated: !!out?.simulated };
}

const MAX_ATTEMPTS = 3;

/** Send what is due. Each message is claimed atomically, so two servers never send it twice. */
export async function sendPending(limit = 25) {
  for (let i = 0; i < limit; i++) {
    const m: any = await PmMessage.findOneAndUpdate(
      { status: "Pending", scheduledAt: { $lte: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
      { $set: { status: "Sending" }, $inc: { attempts: 1 } },
      { sort: { scheduledAt: 1 }, new: true }
    );
    if (!m) break;
    try {
      const out = await deliver(m);
      m.status = "Sent";
      m.providerId = out.id;
      m.simulated = out.simulated;
      m.sentAt = new Date();
      m.error = out.simulated ? "Simulation: no real message was sent" : "";
      if (m.channel === "whatsapp") m.delivery = "sent";
    } catch (e: any) {
      m.error = String(e?.message || e).slice(0, 500);
      // retried on the next runs, a little later each time
      m.status = m.attempts >= MAX_ATTEMPTS ? "Failed" : "Pending";
      m.scheduledAt = new Date(Date.now() + m.attempts * 2 * 60_000);
    }
    await m.save();
  }
}

/* ───────────── in-app notifications ───────────── */

export async function notify(n: { tenantId: any; users: any[]; category: string; title: string; body?: string; taskId?: any; projectId?: any; link?: string; except?: any }) {
  const users = [...new Set(n.users.filter(Boolean).map(String))].filter((u) => u !== String(n.except || ""));
  if (!users.length) return;
  const prefs = await PmNotifyPref.find({ tenant: n.tenantId, user: { $in: users } }).lean();
  const prefOf = (u: string) => (prefs.find((p) => String(p.user) === u)?.prefs || {})[n.category] || { inApp: true, email: false, whatsapp: false };

  const inApp = users.filter((u) => prefOf(u).inApp !== false);
  if (inApp.length) {
    await PmNotification.insertMany(inApp.map((user) => ({ tenant: n.tenantId, user, category: n.category, title: n.title, body: n.body || "", task: n.taskId || null, project: n.projectId || null, link: n.link || "" })));
    // the same alert on the phone, for people who switched push on
    const { sendPush } = await import("../push");
    void sendPush(n.tenantId, inApp, { title: n.title, body: n.body, url: n.link || (n.taskId ? `/modules/projects/my-work?task=${n.taskId}` : "/") });
  }
  // the same alert by Email / WhatsApp for the people who asked for it
  for (const channel of ["email", "whatsapp"] as const) {
    const wanted = users.filter((u) => prefOf(u)[channel]);
    if (!wanted.length) continue;
    const people = await User.find({ _id: { $in: wanted }, status: "Active" }).select("name email mobile").lean();
    const base = await appUrl(n.tenantId);
    const link = n.taskId ? `${base}/modules/projects/my-work?task=${n.taskId}` : n.link ? `${base}${n.link}` : base;
    await queueMessages({
      tenantId: n.tenantId, channel, recipients: people.map(person), refs: { taskId: n.taskId, projectId: n.projectId }, event: `notify:${n.category}`, templateName: "Alert",
      subject: n.title,
      body: channel === "email" ? `<p><b>${n.title}</b></p>${n.body ? `<p>${n.body}</p>` : ""}<p><a href="${link}">Open</a></p>` : `*${n.title}*${n.body ? `\n${n.body}` : ""}\n${link}`,
    });
  }
}

/* ───────────── events → rules + notifications ───────────── */

async function onEvent(event: PmEvent, p: PmEventPayload) {
  const tenantId = p.tenantId;
  const refs: Refs = { taskId: p.taskId, projectId: p.projectId, moduleId: p.moduleId };
  const { task, project, mod } = await loadRefs(tenantId, refs);
  let sent = 0;
  const run = async (rules: any[], when: string, match?: (r: any) => boolean, extra?: Partial<QueueInput>) => {
    for (const rule of (rules || []).filter((r: any) => r.when === when && (!match || match(r)))) sent += await fireRule(tenantId, rule, refs, when, extra);
  };

  if (task) {
    if (event === "task_started") await run(task.autoMessages, "on_start");
    if (event === "task_completed") await run(task.autoMessages, "on_completion");
    if (event === "task_status_changed") await run(task.autoMessages, "on_status_change", (r) => String(r.status) === String(p.data?.status));
    // verification requests carry a personal link per contact: handled by the verification service
  }
  if (event === "project_created" && project) await run(project.autoMessages, "project_created");
  if (event === "project_completed" && project) await run(project.autoMessages, "project_completed");
  if (event === "module_completed" && mod) await run(mod.autoMessages, "module_completed");
  if (sent && (task || project)) {
    await logActivity({ tenant: tenantId, project: project?._id, task: task?._id, kind: "message", text: `${sent} auto message${sent === 1 ? "" : "s"} queued` });
  }

  /* notifications */
  if (event === "task_assigned" && task?.assignee && !p.data?.quiet) {
    await notify({ tenantId, users: [task.assignee._id], except: p.actorId, category: "assigned", title: `New task: ${task.title}`, body: [project?.name, task.due ? `Due ${fmt(task.due)}` : ""].filter(Boolean).join(" · "), taskId: task._id, projectId: project?._id });
  }
  if (event === "task_mentioned" && task) {
    await notify({ tenantId, users: p.data?.users || [], except: p.actorId, category: "mention", title: `${p.actorName} mentioned you`, body: task.title, taskId: task._id, projectId: project?._id });
  }
  if (event === "task_status_changed" && task) {
    await notify({ tenantId, users: [task.assignee?._id, project?.incharge?._id, ...(task.watchers || [])], except: p.actorId, category: "status", title: `${task.title}: ${task.status?.name || ""}`, body: project?.name || "", taskId: task._id, projectId: project?._id });
  }
  if (event === "task_unblocked" && task?.assignee) {
    await notify({ tenantId, users: [task.assignee._id], category: "unblocked", title: `You can start: ${task.title}`, body: p.data?.after ? `${p.data.after} is completed` : "", taskId: task._id, projectId: project?._id });
  }
  if (event === "verification_answered" && task) {
    await notify({ tenantId, users: [task.assignee?._id, project?.incharge?._id, mod?.incharge?._id], category: "verification", title: `Client ${p.data?.approved ? "approved" : "rejected"}: ${task.title}`, body: p.data?.comment || "", taskId: task._id, projectId: project?._id });
  }
}

/* ───────────── scheduler: time-based rules, reminders, digest ───────────── */

const HOUR = 3_600_000;
const offsetMs = (r: any) => (Number(r.offsetValue) || 0) * (r.offsetUnit === "hours" ? HOUR : 24 * HOUR);

/** Fire a time-based rule once: the rule id is claimed on the record atomically. */
async function claim(Model: any, id: any, key: string) {
  const done = await Model.updateOne({ _id: id, firedRules: { $ne: key } }, { $addToSet: { firedRules: key } });
  return !!done.modifiedCount;
}

async function timeRules() {
  const now = Date.now();
  const tasks: any[] = await PmTask.find({ isCompleted: false, "autoMessages.0": { $exists: true } }).select("tenant autoMessages firedRules start due isStarted isPaused project").lean();
  for (const t of tasks) {
    for (const r of t.autoMessages) {
      if (!r.active || (t.firedRules || []).includes(String(r._id))) continue;
      const start = t.start ? new Date(t.start).getTime() : 0;
      const due = t.due ? new Date(t.due).getTime() : 0;
      const hit =
        (r.when === "before_start" && start && !t.isStarted && now >= start - offsetMs(r) && now <= start) ||
        (r.when === "before_due" && due && now >= due - offsetMs(r) && now <= due) ||
        (r.when === "after_overdue" && due && !t.isPaused && now >= due + offsetMs(r));
      if (hit && (await claim(PmTask, t._id, String(r._id)))) await fireRule(t.tenant, r, { taskId: t._id }, r.when);
    }
  }

  const projects: any[] = await PmProject.find({ actualEnd: null, "autoMessages.0": { $exists: true } }).select("tenant autoMessages firedRules plannedEnd").lean();
  for (const p of projects) {
    let delayed: boolean | null = null;
    for (const r of p.autoMessages) {
      if (!r.active || (p.firedRules || []).includes(String(r._id))) continue;
      const end = p.plannedEnd ? new Date(p.plannedEnd).getTime() : 0;
      let hit = r.when === "before_project_end" && !!end && now >= end - offsetMs(r) && now <= end;
      if (r.when === "project_delayed") {
        if (delayed === null) delayed = (await projectStats(p.tenant, [p])).projects.get(String(p._id))?.schedule === "delayed";
        hit = delayed;
      }
      if (hit && (await claim(PmProject, p._id, String(r._id)))) await fireRule(p.tenant, r, { projectId: p._id }, r.when);
    }
  }
}

/** "Due tomorrow" and "overdue" alerts, once per task. */
async function dueAlerts() {
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * HOUR);
  const tasks: any[] = await PmTask.find({ isCompleted: false, isPaused: false, assignee: { $ne: null }, due: { $lte: soon }, isDemo: { $ne: true } }).select("tenant title assignee due project firedRules").lean();
  for (const t of tasks) {
    const overdue = new Date(t.due) < now;
    const key = overdue ? "n:overdue" : "n:due";
    if ((t.firedRules || []).includes(key) || !(await claim(PmTask, t._id, key))) continue;
    await notify({ tenantId: t.tenant, users: [t.assignee], category: overdue ? "overdue" : "due", title: `${overdue ? "Overdue" : "Due tomorrow"}: ${t.title}`, body: `Due ${fmt(t.due)}`, taskId: t._id, projectId: t.project });
  }
}

/** Daily digest and the "plan not filled" reminder, at the hour set in the settings. */
async function dailyJobs() {
  const local = new Date(Date.now() + 330 * 60_000);
  const today = local.toISOString().slice(0, 10);
  const hour = local.getUTCHours();
  const all = await PmMailSettings.find({ $or: [{ digestHour: { $gte: 0 } }, { planReminderHour: { $gte: 0 } }] });
  for (const s of all) {
    if (s.digestHour >= 0 && hour >= s.digestHour && s.lastDigest !== today) {
      // claim the day first, so a second server does not send it again
      const got = await PmMailSettings.updateOne({ _id: s._id, lastDigest: { $ne: today } }, { $set: { lastDigest: today } });
      if (got.modifiedCount) await sendDigest(s.tenant).catch((e) => console.error("[pm] digest failed:", e?.message));
    }
    if (s.planReminderHour >= 0 && hour >= s.planReminderHour && s.lastPlanReminder !== today) {
      const got = await PmMailSettings.updateOne({ _id: s._id, lastPlanReminder: { $ne: today } }, { $set: { lastPlanReminder: today } });
      if (got.modifiedCount) await planReminder(s.tenant, today).catch((e) => console.error("[pm] plan reminder failed:", e?.message));
    }
  }
}

async function sendDigest(tenantId: any) {
  const now = new Date();
  const end = new Date(now.getTime() + 24 * HOUR);
  const tasks: any[] = await PmTask.find({ tenant: tenantId, isCompleted: false, isPaused: false, assignee: { $ne: null }, due: { $lte: end }, isDemo: { $ne: true } }).select("title due assignee").lean();
  const byPerson = new Map<string, any[]>();
  tasks.forEach((t) => byPerson.set(String(t.assignee), [...(byPerson.get(String(t.assignee)) || []), t]));
  const off = new Set((await PmNotifyPref.find({ tenant: tenantId, digest: false }).select("user").lean()).map((p) => String(p.user)));
  const people = await User.find({ _id: { $in: [...byPerson.keys()].filter((u) => !off.has(u)) }, status: "Active" }).select("name email mobile").lean();
  const base = await appUrl(tenantId);
  for (const u of people) {
    const mine = byPerson.get(String(u._id)) || [];
    const overdue = mine.filter((t) => new Date(t.due) < now);
    const today = mine.filter((t) => new Date(t.due) >= now);
    const list = (title: string, rows: any[]) => (rows.length ? `<p><b>${title} (${rows.length})</b></p><ul>${rows.map((t) => `<li>${t.title} — ${fmt(t.due)}</li>`).join("")}</ul>` : "");
    await queueMessages({
      tenantId, channel: "email", recipients: [person(u)], refs: {}, event: "digest", templateName: "Daily digest",
      subject: `Your tasks today: ${overdue.length} overdue, ${today.length} due`,
      body: `<p>Hi ${u.name},</p>${list("Overdue", overdue)}${list("Due today", today)}<p><a href="${base}/modules/projects/my-work">Open My Work</a></p>`,
    });
  }
}

async function planReminder(tenantId: any, today: string) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PmDailyPlan } = require("../../models/pm/DailyPlan");
  const planned = new Set((await PmDailyPlan.distinct("employee", { tenant: tenantId, date: today })).map(String));
  const users = await User.find({ tenant: tenantId, status: "Active" }).populate("userType", "perms").populate("category", "kind").select("_id userType category").lean();
  const expected = users.filter((u: any) => u.category?.kind !== "client" && (u.userType?.perms || []).some((p: any) => p.module === "pm_daily_plan" && p.create) && !planned.has(String(u._id)));
  await notify({ tenantId, users: expected.map((u) => u._id), category: "plan", title: "Plan your day", body: "Today's work plan is not filled yet", link: "/modules/projects/daily-plan" });
}

/* ───────────── start ───────────── */

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    await timeRules();
    await dueAlerts();
    await dailyJobs();
    // meetings, verification reminders and ticket SLA add their own checks here
    for (const job of extraJobs) await job().catch((e) => console.error("[pm] scheduler job failed:", e?.message || e));
    await sendPending();
  } catch (e: any) {
    console.error("[pm] scheduler tick failed:", e?.message || e);
  } finally {
    running = false;
  }
}
const extraJobs: (() => Promise<void>)[] = [];
/** Other services add a check that runs every minute. */
export const everyMinute = (job: () => Promise<void>) => {
  extraJobs.push(job);
};
/** Send queued messages now (used right after an event, so nobody waits a minute). */
export const kick = () => {
  setTimeout(() => sendPending().catch(() => {}), 1500);
};

let started = false;
/** Listen to Project Management events and run the scheduler every minute. Call once at server start. */
export function startPmEngine() {
  if (started) return;
  started = true;
  onPm(async (event, payload) => {
    await onEvent(event, payload);
    kick();
  });
  // messages left in "Sending" by a server that stopped are released again
  PmMessage.updateMany({ status: "Sending", updatedAt: { $lt: new Date(Date.now() - 10 * 60_000) } }, { $set: { status: "Pending" } }).catch(() => {});
  setInterval(tick, 60_000).unref?.();
  setTimeout(tick, 8_000).unref?.();
  console.log("[pm] message engine started (every 60s)");
}

/** Delivery receipts and replies from the WhatsApp webhook. */
export async function pmInbound(tenantId: string, ev: any) {
  if (ev.kind === "status" && ev.waMessageId) {
    await PmMessage.updateOne({ tenant: tenantId, providerId: ev.waMessageId }, { $set: { delivery: ev.status, ...(ev.status === "failed" ? { status: "Failed", error: ev.errorReason || "failed" } : {}) } });
  }
  for (const fn of inboundHandlers) await fn(tenantId, ev).catch((e) => console.error("[pm] inbound handler failed:", e?.message || e));
}
const inboundHandlers: ((tenantId: string, ev: any) => Promise<void>)[] = [];
export const onInbound = (fn: (tenantId: string, ev: any) => Promise<void>) => {
  inboundHandlers.push(fn);
};

export { Types };
