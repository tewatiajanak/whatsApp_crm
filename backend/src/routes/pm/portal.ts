import { Router } from "express";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { ok, asyncHandler, ApiError, audit } from "../../utils/http";
import { User, UserCategory, UserType } from "../../models/User";
import { PmMaster } from "../../models/pm/Setup";
import { PmClient } from "../../models/pm/Client";
import { PmProject, PmProjectModule, PmTask, PmComment } from "../../models/pm/Project";
import { PmMeeting } from "../../models/pm/Meeting";
import { PmSignoff, PmTicket, PmVerification } from "../../models/pm/Portal";
import { getPmSettings } from "../../services/pm/masters";
import { projectStats } from "../../services/pm/projects";
import { answerSignoff, answerVerification, requestSignoff, requestVerification } from "../../services/pm/verification";
import { createTicket } from "../../services/pm/tickets";
import { notify } from "../../services/pm/messages";
import { pmRight } from "../../services/pm/visibility";
import { defaultPassword } from "../../services/userAccess";
import { PM_FILES, findTask } from "./tasks";
import { findProject } from "./projects";
import { TICKET_POPULATE, addTicketFile, sendTicketFile, ticketUpload } from "./tickets";

const r = Router();
const AUDIT = "Project Management";

/* ══════════════ internal: portal users, verification and sign-off requests ══════════════ */

r.get(
  "/portal-users",
  pmRight("portal_users", "view"),
  asyncHandler(async (req: any, res: any) => {
    const users = await User.find({ tenant: req.tenantId, pmClient: { $ne: null } }).select("name email mobile status lastLogin pmClient").populate("pmClient", "name code").sort({ name: 1 }).lean();
    ok(res, users);
  })
);

// Give a client contact a login to the portal. The first password follows the Password Policy for client users.
r.post(
  "/clients/:id/contacts/:contactId/portal-user",
  pmRight("portal_users", "create"),
  asyncHandler(async (req: any, res: any) => {
    const client = await PmClient.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!client) throw new ApiError(404, "Client not found");
    const contact: any = client.contacts.find((c: any) => String(c._id) === String(req.params.contactId));
    if (!contact) throw new ApiError(404, "Contact not found");
    if (!contact.email) throw new ApiError(400, "The contact needs an email to sign in");
    if (await User.exists({ tenant: req.tenantId, email: contact.email })) throw new ApiError(409, "A user with this email already exists");

    // the role and the user type of client users: taken if they exist, made if they do not
    const category = (await UserCategory.findOne({ tenant: req.tenantId, kind: "client" })) || (await UserCategory.create({ tenant: req.tenantId, name: "Client", kind: "client", perms: [] }));
    const role = (await UserType.findOne({ tenant: req.tenantId, name: /^client user$/i })) || (await UserType.create({ tenant: req.tenantId, name: "Client User", desc: "Client portal only", perms: [], dataVisibility: "own" }));
    const mobile = String(contact.mobile || "").replace(/\D/g, "");
    const first = await defaultPassword(req.tenantId, "client", { email: contact.email, mobile });
    const user = await User.create({
      tenant: req.tenantId, name: contact.name, email: contact.email, mobile: (await User.exists({ mobile })) ? "" : mobile, userType: role._id, category: category._id,
      pmClient: client._id, passwordHash: await bcrypt.hash(first.password, 10), mustChangePassword: first.forceChange, status: "Active",
    });
    contact.portalAccess = true;
    await client.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Portal user ${user.email} (${client.name})` });
    ok(res, { user: { _id: user._id, name: user.name, email: user.email }, passwordRule: first.rule, mustChangePassword: first.forceChange }, 201);
  })
);

r.patch(
  "/portal-users/:id",
  pmRight("portal_users", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const user = await User.findOne({ _id: req.params.id, tenant: req.tenantId, pmClient: { $ne: null } });
    if (!user) throw new ApiError(404, "Portal user not found");
    if (req.body?.status !== undefined) user.status = req.body.status === "Inactive" ? "Inactive" : "Active";
    await user.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: AUDIT, entity: `Portal user ${user.email}`, next: user.status });
    ok(res, { status: user.status });
  })
);

// verification requests of a task, and "send again"
r.get(
  "/tasks/:id/verifications",
  asyncHandler(async (req: any, res: any) => {
    if (req.isClientUser) throw new ApiError(403, "Forbidden");
    const task = await findTask(req, req.params.id);
    ok(res, await PmVerification.find({ tenant: req.tenantId, task: task._id }).sort({ createdAt: -1 }).select("-contacts.token").lean());
  })
);
r.post(
  "/tasks/:id/verifications",
  asyncHandler(async (req: any, res: any) => {
    if (req.isClientUser) throw new ApiError(403, "Forbidden");
    const task = await findTask(req, req.params.id);
    if (!task.clientVerification || !task.isWaitingForClient) throw new ApiError(400, "The task is not waiting for client verification");
    await requestVerification(req.tenantId, task._id, req.auth.uid);
    ok(res, { sent: true });
  })
);

// sign-off: ask, and see what was asked
r.get(
  "/projects/:id/signoffs",
  pmRight("projects", "view"),
  asyncHandler(async (req: any, res: any) => {
    const project = await findProject(req, req.params.id);
    ok(res, await PmSignoff.find({ tenant: req.tenantId, project: project._id }).sort({ createdAt: -1 }).select("-token").populate("projectModule", "name").populate("ticket", "number").lean());
  })
);
r.post(
  "/projects/:id/signoffs",
  pmRight("projects", "approve"),
  asyncHandler(async (req: any, res: any) => {
    const project = await findProject(req, req.params.id);
    const so = await requestSignoff(req.tenantId, project._id, req.body?.module || null, req.auth.uid);
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Sign-off request ${so.title}` });
    ok(res, { requested: true }, 201);
  })
);

/* ══════════════ client portal: a client user sees ONLY their own client's data ══════════════ */

const p = Router();
p.use((req: any, _res, next) => {
  if (!req.clientId) return next(new ApiError(403, "This area is for client portal users"));
  next();
});
/** Every portal query starts from this: the signed-in user's own client. */
const own = (req: any) => ({ tenant: req.tenantId, client: new Types.ObjectId(String(req.clientId)) });
const me = async (req: any) => (await User.findById(req.auth.uid).select("name email").lean()) as any;

async function ownProject(req: any, id: any) {
  if (!Types.ObjectId.isValid(String(id))) throw new ApiError(404, "Project not found");
  const project = await PmProject.findOne({ ...own(req), _id: id }).populate("status", "name color").populate("incharge", "name").populate("product", "name").lean();
  if (!project) throw new ApiError(404, "Project not found");
  return project as any;
}
/** What a client may know about a task. No internal notes, no people's workload. */
const clientTask = (t: any) => ({ _id: t._id, title: t.title, status: t.status, due: t.due, isCompleted: t.isCompleted, completedOn: t.actualEnd, milestone: t.milestone, module: t.projectModule, isWaitingForClient: t.isWaitingForClient });

p.get(
  "/home",
  asyncHandler(async (req: any, res: any) => {
    const [client, projects, verifications, tickets] = await Promise.all([
      PmClient.findOne({ _id: req.clientId, tenant: req.tenantId }).select("name").lean(),
      PmProject.find(own(req)).sort({ createdAt: -1 }).populate("status", "name color").populate("product", "name").lean(),
      PmVerification.countDocuments({ ...own(req), status: "Pending" }),
      PmTicket.countDocuments({ ...own(req), isClosed: false, mergedInto: null }),
    ]);
    const stats = await projectStats(req.tenantId, projects);
    ok(res, {
      client: client?.name || "",
      pendingVerifications: verifications,
      openTickets: tickets,
      projects: projects.map((x: any) => {
        const s = stats.projects.get(String(x._id))!;
        return { _id: x._id, name: x.name, code: x.code, product: x.product?.name || "", status: x.status, startDate: x.startDate, plannedEnd: x.plannedEnd, signedOffAt: x.signedOffAt, progress: s.progress, schedule: s.schedule, expectedEnd: s.expectedEnd };
      }),
    });
  })
);

p.get(
  "/projects/:id",
  asyncHandler(async (req: any, res: any) => {
    const project = await ownProject(req, req.params.id);
    const [modules, tasks, signoffs] = await Promise.all([
      PmProjectModule.find({ tenant: req.tenantId, project: project._id }).sort({ order: 1 }).lean(),
      PmTask.find({ tenant: req.tenantId, project: project._id, clientVisible: true }).sort({ order: 1 }).select("title status due isCompleted actualEnd milestone projectModule isWaitingForClient").populate("status", "name color").lean(),
      PmSignoff.find({ ...own(req), project: project._id }).sort({ createdAt: -1 }).select("title status answeredAt projectModule sentAt").lean(),
    ]);
    const stats = await projectStats(req.tenantId, [project]);
    const s = stats.projects.get(String(project._id))!;
    ok(res, {
      project: { _id: project._id, name: project.name, code: project.code, product: project.product?.name || "", status: project.status, incharge: project.incharge?.name || "", startDate: project.startDate, plannedEnd: project.plannedEnd, signedOffAt: project.signedOffAt, progress: s.progress, schedule: s.schedule, expectedEnd: s.expectedEnd, total: s.total, done: s.done },
      modules: modules.map((m: any) => ({ _id: m._id, name: m.name, signedOffAt: m.signedOffAt, progress: stats.modules.get(String(m._id))?.progress ?? 0, schedule: stats.modules.get(String(m._id))?.schedule })),
      tasks: tasks.map(clientTask),
      milestones: tasks.filter((t: any) => t.milestone).map(clientTask),
      signoffs,
    });
  })
);

/* ---- verifications ---- */
p.get(
  "/verifications",
  asyncHandler(async (req: any, res: any) => {
    const rows = await PmVerification.find(own(req)).sort({ status: 1, sentAt: -1 }).limit(200).select("-contacts").populate({ path: "task", select: "title checklist attachments projectModule", populate: { path: "projectModule", select: "name" } }).populate("project", "name").lean();
    ok(res, rows.map((v: any) => ({
      _id: v._id, status: v.status, sentAt: v.sentAt, expiresAt: v.expiresAt, answeredBy: v.answeredBy, answeredAt: v.answeredAt, comment: v.comment, summary: v.summary,
      project: v.project?.name || "", module: v.task?.projectModule?.name || "", task: v.task?.title || "", taskId: v.task?._id,
      checklist: (v.task?.checklist || []).map((c: any) => ({ text: c.text, done: c.done })),
      files: (v.task?.attachments || []).filter((a: any) => a.clientVisible && !a.pasted).map((a: any) => ({ _id: a._id, name: a.name, size: a.size })),
    })));
  })
);
p.post(
  "/verifications/:id",
  asyncHandler(async (req: any, res: any) => {
    const v = await PmVerification.findOne({ ...own(req), _id: req.params.id });
    if (!v) throw new ApiError(404, "Request not found");
    const who = await me(req);
    await answerVerification(v, { approved: !!req.body?.approve, comment: req.body?.comment, via: "portal", by: who?.name || "Client", from: req.ip });
    ok(res, { answered: true });
  })
);

/* ---- documents: files marked client-visible, and the sign-off records ---- */
p.get(
  "/documents",
  asyncHandler(async (req: any, res: any) => {
    const [tasks, signoffs] = await Promise.all([
      PmTask.find({ ...own(req), clientVisible: true, "attachments.clientVisible": true }).select("title attachments project").populate("project", "name").lean(),
      PmSignoff.find({ ...own(req), status: { $in: ["Accepted", "Concern", "Pending"] } }).sort({ createdAt: -1 }).select("-token").populate("project", "name code").lean(),
    ]);
    ok(res, {
      files: tasks.flatMap((t: any) => t.attachments.filter((a: any) => a.clientVisible && !a.pasted).map((a: any) => ({ _id: a._id, taskId: t._id, name: a.name, size: a.size, at: a.at, task: t.title, project: t.project?.name || "" }))),
      signoffs,
    });
  })
);
p.get(
  "/files/:taskId/:attId",
  asyncHandler(async (req: any, res: any) => {
    const task: any = await PmTask.findOne({ ...own(req), _id: req.params.taskId, clientVisible: true }).select("attachments").lean();
    const a = task?.attachments?.find((x: any) => String(x._id) === String(req.params.attId) && x.clientVisible);
    if (!a) throw new ApiError(404, "File not found");
    const full = path.join(PM_FILES, String(req.tenantId), path.basename(a.file));
    if (!fs.existsSync(full)) throw new ApiError(404, "File not found");
    res.setHeader("Content-Type", a.mime || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(a.name)}"`);
    fs.createReadStream(full).pipe(res);
  })
);
p.post(
  "/signoffs/:id",
  asyncHandler(async (req: any, res: any) => {
    const so = await PmSignoff.findOne({ ...own(req), _id: req.params.id });
    if (!so) throw new ApiError(404, "Request not found");
    const who = await me(req);
    await answerSignoff(so, { accept: !!req.body?.accept, comment: req.body?.comment, by: who?.name || "Client", from: req.ip });
    ok(res, { answered: true });
  })
);

/* ---- meetings I am invited to ---- */
p.get(
  "/meetings",
  asyncHandler(async (req: any, res: any) => {
    const who = await me(req);
    const rows = await PmMeeting.find({ ...own(req), status: "scheduled", attendees: { $elemMatch: { isClient: true, email: who?.email } } }).sort({ date: -1 }).limit(100).populate("type", "name color").populate("organizer", "name").lean();
    ok(res, rows.map((m: any) => {
      const mine = m.attendees.find((a: any) => a.isClient && a.email === who?.email);
      return { _id: m._id, title: m.title, type: m.type, date: m.date, from: m.from, to: m.to, mode: m.mode, location: m.location, link: m.mode !== "onsite" ? m.link : "", agenda: m.agenda, organizer: m.organizer?.name || "", response: mine?.response || "", token: mine?.token || "" };
    }));
  })
);

/* ---- tickets ---- */
const clientTicket = (t: any, full = false) => ({
  _id: t._id, number: t.number, subject: t.subject, status: t.status, priority: t.priority, category: t.category, project: t.project, isClosed: t.isClosed,
  createdAt: t.createdAt, resolvedAt: t.resolvedAt, rating: t.rating,
  ...(full
    ? {
        description: t.description, ratingComment: t.ratingComment,
        // internal notes never reach the client
        replies: (t.replies || []).filter((x: any) => !x.internal).map((x: any) => ({ _id: x._id, text: x.text, at: x.at, by: x.byClient || x.by?.name || "Support", mine: !!x.byClient })),
        files: (t.files || []).map((f: any) => ({ _id: f._id, name: f.name, size: f.size })),
      }
    : {}),
});

p.get(
  "/ticket-options",
  asyncHandler(async (req: any, res: any) => {
    const [projects, masters] = await Promise.all([
      PmProject.find(own(req)).select("name").lean(),
      PmMaster.find({ tenant: req.tenantId, type: { $in: ["ticket_category", "ticket_priority"] }, active: true }).sort({ order: 1 }).select("type name color").lean(),
    ]);
    const modules = await PmProjectModule.find({ tenant: req.tenantId, project: { $in: projects.map((x) => x._id) } }).select("name project").sort({ order: 1 }).lean();
    ok(res, { projects, modules, categories: masters.filter((m) => m.type === "ticket_category"), priorities: masters.filter((m) => m.type === "ticket_priority"), reopenDays: (await getPmSettings(req.tenantId)).ticketReopenDays });
  })
);
p.get(
  "/tickets",
  asyncHandler(async (req: any, res: any) => {
    const rows = await PmTicket.find({ ...own(req), mergedInto: null }).sort({ isClosed: 1, createdAt: -1 }).limit(300).select("-replies -files -description").populate(TICKET_POPULATE.slice(0, 6)).lean();
    ok(res, rows.map((t) => clientTicket(t)));
  })
);
const ownTicket = async (req: any, id: any) => {
  if (!Types.ObjectId.isValid(String(id))) throw new ApiError(404, "Ticket not found");
  const t = await PmTicket.findOne({ ...own(req), _id: id });
  if (!t) throw new ApiError(404, "Ticket not found");
  return t;
};
p.get(
  "/tickets/:id",
  asyncHandler(async (req: any, res: any) => {
    const t = await ownTicket(req, req.params.id);
    ok(res, clientTicket(await PmTicket.findById(t._id).populate(TICKET_POPULATE).lean(), true));
  })
);
p.post(
  "/tickets",
  asyncHandler(async (req: any, res: any) => {
    const b = req.body || {};
    const subject = String(b.subject || "").trim();
    if (!subject) throw new ApiError(400, "Enter the subject");
    // only the client's own projects and modules can be chosen
    const project: any = b.project ? await PmProject.findOne({ ...own(req), _id: b.project }).select("_id").lean() : null;
    const mod: any = project && b.projectModule ? await PmProjectModule.findOne({ _id: b.projectModule, tenant: req.tenantId, project: project._id }).select("_id").lean() : null;
    const master = async (v: any, type: string) => (v && (await PmMaster.exists({ _id: v, tenant: req.tenantId, type, active: true })) ? v : null);
    const who = await me(req);
    const ticket = await createTicket(req.tenantId, {
      client: req.clientId, project: project?._id, projectModule: mod?._id, category: await master(b.category, "ticket_category"), priority: await master(b.priority, "ticket_priority"),
      subject, description: String(b.description || ""), raisedBy: { name: who?.name || "Client", email: who?.email || "", user: req.auth.uid }, source: "portal",
    });
    ok(res, clientTicket(ticket.toObject()), 201);
  })
);
p.post(
  "/tickets/:id/replies",
  asyncHandler(async (req: any, res: any) => {
    const t = await ownTicket(req, req.params.id);
    const text = String(req.body?.text || "").trim();
    if (!text) throw new ApiError(400, "Write a reply");
    const who = await me(req);
    t.replies.push({ by: null, byClient: who?.name || "Client", text, internal: false, at: new Date() } as any);
    await t.save();
    await notify({ tenantId: req.tenantId, users: [t.assignee], category: "ticket", title: `Client replied on ${t.number}`, body: t.subject, link: `/modules/projects/tickets?open=${t._id}` });
    ok(res, clientTicket(await PmTicket.findById(t._id).populate(TICKET_POPULATE).lean(), true));
  })
);
p.post(
  "/tickets/:id/reopen",
  asyncHandler(async (req: any, res: any) => {
    const t = await ownTicket(req, req.params.id);
    if (!t.isClosed) throw new ApiError(400, "This ticket is open");
    const days = (await getPmSettings(req.tenantId)).ticketReopenDays;
    if (t.resolvedAt && Date.now() > t.resolvedAt.getTime() + days * 86_400_000) throw new ApiError(400, `A ticket can be reopened within ${days} days. Please raise a new ticket.`);
    const open = (await PmMaster.find({ tenant: req.tenantId, type: "ticket_status", active: true }).sort({ order: 1 }).lean()).find((s: any) => s.flags?.isOpen);
    if (open) t.status = open._id as any;
    t.isClosed = false;
    t.resolvedAt = null;
    t.rating = 0;
    const who = await me(req);
    t.replies.push({ by: null, byClient: who?.name || "Client", text: `Reopened${req.body?.reason ? `: ${String(req.body.reason).trim()}` : ""}`, internal: false, at: new Date() } as any);
    await t.save();
    await notify({ tenantId: req.tenantId, users: [t.assignee], category: "ticket", title: `Ticket reopened: ${t.number}`, body: t.subject, link: `/modules/projects/tickets?open=${t._id}` });
    ok(res, { reopened: true });
  })
);
p.post(
  "/tickets/:id/rating",
  asyncHandler(async (req: any, res: any) => {
    const t = await ownTicket(req, req.params.id);
    if (!t.isClosed) throw new ApiError(400, "The ticket can be rated once it is closed");
    const rating = Math.round(Number(req.body?.rating));
    if (!(rating >= 1 && rating <= 5)) throw new ApiError(400, "Choose 1 to 5 stars");
    t.rating = rating;
    t.ratingComment = String(req.body?.comment || "").trim();
    await t.save();
    ok(res, { rating });
  })
);
p.post(
  "/tickets/:id/files",
  ticketUpload.single("file"),
  asyncHandler(async (req: any, res: any) => {
    const f: any = await addTicketFile(req, await ownTicket(req, req.params.id), true);
    ok(res, { _id: f._id, name: f.name, size: f.size }, 201);
  })
);
p.get(
  "/tickets/:id/files/:fileId",
  asyncHandler(async (req: any, res: any) => {
    sendTicketFile(req, res, await ownTicket(req, req.params.id));
  })
);

// client-visible comments of one of the client's tasks (shown with a verification)
p.get(
  "/tasks/:id/comments",
  asyncHandler(async (req: any, res: any) => {
    const task = await PmTask.findOne({ ...own(req), _id: req.params.id, clientVisible: true }).select("_id").lean();
    if (!task) throw new ApiError(404, "Task not found");
    const rows = await PmComment.find({ tenant: req.tenantId, task: task._id, clientVisible: true }).sort({ createdAt: 1 }).populate("by", "name").lean();
    ok(res, rows.map((c: any) => ({ _id: c._id, text: c.text.replace(/!\[\]\([0-9a-f]{24}\)/g, "").replace(/@\[([^\]]+)\]\([0-9a-f]{24}\)/g, "@$1"), by: c.byClient || c.by?.name || "Team", at: c.createdAt })));
  })
);

r.use("/portal", p);
export default r;
