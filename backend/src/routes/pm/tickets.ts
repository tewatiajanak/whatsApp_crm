import { Router } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { Types } from "mongoose";
import { ok, asyncHandler, ApiError, paginated } from "../../utils/http";
import { User } from "../../models/User";
import { PmMaster } from "../../models/pm/Setup";
import { PmClient } from "../../models/pm/Client";
import { PmProject, PmProjectModule, PmTask, PmAssignment, nextNumber } from "../../models/pm/Project";
import { PmTicket } from "../../models/pm/Portal";
import { getPmSettings } from "../../services/pm/masters";
import { getVisibleEmployeeIds, pmRight } from "../../services/pm/visibility";
import { createTicket, slaDates, ticketMessage } from "../../services/pm/tickets";
import { notify } from "../../services/pm/messages";
import { statusFlags, statusWith } from "../../services/pm/projects";
import { emitPm } from "../../services/pm/events";
import { PM_FILES } from "./tasks";

/** Tickets — the internal support desk. */
const r = Router();
const rx = (q: any) => new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
export const TICKET_POPULATE = [
  { path: "client", select: "name code" },
  { path: "project", select: "name code" },
  { path: "projectModule", select: "name" },
  { path: "category", select: "name color" },
  { path: "priority", select: "name color values" },
  { path: "status", select: "name color flags" },
  { path: "assignee", select: "name photo" },
  { path: "linkedTask", select: "number title isCompleted" },
  { path: "replies.by", select: "name photo" },
];

/** Tickets the user may see: assigned to their people, of their clients, or not assigned yet. */
async function visibleTickets(req: any) {
  const ids = await getVisibleEmployeeIds(req);
  if (ids === "all") return {};
  const people = ids.map((x) => new Types.ObjectId(x));
  const clients = await PmClient.distinct("_id", { tenant: req.tenantId, accountManager: { $in: people } });
  return { $or: [{ assignee: { $in: people } }, { assignee: null }, { client: { $in: clients } }] };
}
export async function findTicket(req: any, id: any) {
  if (!Types.ObjectId.isValid(String(id))) throw new ApiError(404, "Ticket not found");
  const t = await PmTicket.findOne({ $and: [{ _id: id, tenant: req.tenantId }, await visibleTickets(req)] });
  if (!t) throw new ApiError(404, "Ticket not found");
  return t;
}
const withSla = (t: any, now = new Date()) => ({
  ...t,
  responseLate: !t.firstResponseAt && !!t.responseDue && new Date(t.responseDue) < now && !t.isClosed,
  resolveLate: !t.isClosed && !!t.resolveDue && new Date(t.resolveDue) < now,
});

r.get(
  "/tickets",
  pmRight("tickets", "view"),
  asyncHandler(async (req: any, res: any) => {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const perPage = Math.min(300, Math.max(1, parseInt(String(req.query.perPage || "50"), 10) || 50));
    const q = req.query;
    const and: any[] = [{ tenant: req.tenantId, mergedInto: null }, await visibleTickets(req)];
    for (const k of ["client", "status", "priority", "assignee", "category", "project"]) if (q[k] && Types.ObjectId.isValid(String(q[k]))) and.push({ [k]: q[k] });
    if (q.state === "open") and.push({ isClosed: false });
    if (q.state === "closed") and.push({ isClosed: true });
    if (q.overdue === "1") and.push({ isClosed: false, resolveDue: { $lt: new Date() } });
    if (q.unassigned === "1") and.push({ assignee: null });
    if (q.q) and.push({ $or: [{ subject: rx(q.q) }, { number: rx(q.q) }] });
    const filter = { $and: and };
    const [items, total] = await Promise.all([
      PmTicket.find(filter).sort({ isClosed: 1, createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).select("-replies -description -files").populate(TICKET_POPULATE.slice(0, 7)).lean(),
      PmTicket.countDocuments(filter),
    ]);
    paginated(res, items.map((t) => withSla(t)), total, page, perPage);
  })
);

r.get(
  "/tickets/:id",
  pmRight("tickets", "view"),
  asyncHandler(async (req: any, res: any) => {
    const t = await findTicket(req, req.params.id);
    ok(res, withSla(await PmTicket.findById(t._id).populate(TICKET_POPULATE).lean()));
  })
);

// A ticket raised by the team on behalf of a client (phone call, email).
r.post(
  "/tickets",
  pmRight("tickets", "create"),
  asyncHandler(async (req: any, res: any) => {
    const b = req.body || {};
    const client: any = await PmClient.findOne({ _id: b.client, tenant: req.tenantId }).lean();
    if (!client) throw new ApiError(400, "Choose the client");
    const subject = String(b.subject || "").trim();
    if (!subject) throw new ApiError(400, "Enter the subject");
    const project = b.project && (await PmProject.exists({ _id: b.project, tenant: req.tenantId, client: client._id })) ? b.project : null;
    const master = async (v: any, type: string) => (v && (await PmMaster.exists({ _id: v, tenant: req.tenantId, type })) ? v : null);
    const contact = (client.contacts || []).find((c: any) => c.primary) || client.contacts?.[0];
    const ticket = await createTicket(req.tenantId, {
      client: client._id, project, category: await master(b.category, "ticket_category"), priority: await master(b.priority, "ticket_priority"),
      subject, description: String(b.description || ""), raisedBy: { name: contact?.name || client.name, email: contact?.email || "" }, source: "internal",
      assignee: b.assignee && (await User.exists({ _id: b.assignee, tenant: req.tenantId })) ? b.assignee : null,
    });
    ok(res, ticket, 201);
  })
);

r.patch(
  "/tickets/:id",
  pmRight("tickets", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const t = await findTicket(req, req.params.id);
    const b = req.body || {};
    const master = async (v: any, type: string) => (v && (await PmMaster.exists({ _id: v, tenant: req.tenantId, type })) ? v : null);
    if (b.category !== undefined) t.category = await master(b.category, "ticket_category");
    if (b.priority !== undefined && String(b.priority || "") !== String(t.priority || "")) {
      t.priority = await master(b.priority, "ticket_priority");
      // the deadlines follow the new priority, counted from when the ticket was raised
      Object.assign(t, await slaDates(req.tenantId, t.priority, (t as any).createdAt));
      t.slaAlerted = [];
    }
    let statusChanged: "resolved" | "updated" | null = null;
    if (b.status !== undefined && String(b.status) !== String(t.status || "")) {
      const st: any = await PmMaster.findOne({ _id: b.status, tenant: req.tenantId, type: "ticket_status" }).lean();
      if (!st) throw new ApiError(400, "Choose a valid status");
      t.status = st._id;
      const closing = !!st.flags?.isClosed;
      if (closing && !t.isClosed) t.resolvedAt = new Date();
      if (!closing) t.resolvedAt = null;
      statusChanged = closing && !t.isClosed ? "resolved" : "updated";
      t.isClosed = closing;
    }
    await t.save();
    if (statusChanged) await ticketMessage(t, statusChanged);
    ok(res, withSla(await PmTicket.findById(t._id).populate(TICKET_POPULATE).lean()));
  })
);

r.post(
  "/tickets/:id/assign",
  pmRight("tickets", "assign"),
  asyncHandler(async (req: any, res: any) => {
    const t = await findTicket(req, req.params.id);
    const to = String(req.body?.to?._id || req.body?.to || "");
    if (!to || !(await User.exists({ _id: to, tenant: req.tenantId }))) throw new ApiError(400, "Choose the assignee");
    const reason = String(req.body?.reason || "").trim();
    if (t.assignee && !reason) throw new ApiError(400, "Enter the reason");
    if (String(t.assignee || "") === to) throw new ApiError(400, "This person already has the ticket");
    await PmAssignment.create({ tenant: req.tenantId, entity: "ticket", entityId: t._id, project: t.project || null, from: t.assignee, to, reason: reason || "Assigned", by: req.auth.uid });
    t.assignee = to as any;
    await t.save();
    await notify({ tenantId: req.tenantId, users: [to], except: req.auth.uid, category: "ticket", title: `Ticket assigned: ${t.number}`, body: t.subject, link: `/modules/projects/tickets?open=${t._id}` });
    ok(res, { assignee: to });
  })
);

// A reply to the client, or an internal note.
r.post(
  "/tickets/:id/replies",
  pmRight("tickets", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const t = await findTicket(req, req.params.id);
    const text = String(req.body?.text || "").trim();
    if (!text) throw new ApiError(400, "Write a reply");
    const internal = !!req.body?.internal;
    t.replies.push({ by: req.auth.uid, byClient: "", text, internal, at: new Date() } as any);
    if (!internal && !t.firstResponseAt) t.firstResponseAt = new Date();
    await t.save();
    if (!internal) await ticketMessage(t, "updated");
    ok(res, withSla(await PmTicket.findById(t._id).populate(TICKET_POPULATE).lean()));
  })
);

// The work behind a ticket becomes a task, linked both ways.
r.post(
  "/tickets/:id/task",
  pmRight("tickets", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const t = await findTicket(req, req.params.id);
    if (req.body?.task) {
      const task = await PmTask.findOne({ _id: req.body.task, tenant: req.tenantId }).select("_id").lean();
      if (!task) throw new ApiError(400, "Choose a valid task");
      t.linkedTask = task._id as any;
      await t.save();
      return ok(res, { task: task._id });
    }
    if (t.linkedTask) throw new ApiError(409, "This ticket already has a task");
    const assignee = t.assignee || req.auth.uid;
    const first = (await statusWith(req.tenantId, "task_status", "isInitial")) || (await statusWith(req.tenantId, "task_status", null));
    const due = t.resolveDue || new Date(Date.now() + 2 * 86_400_000);
    const last = t.projectModule ? await PmTask.findOne({ tenant: req.tenantId, projectModule: t.projectModule }).sort({ order: -1 }).select("order").lean() : null;
    const task = await PmTask.create({
      tenant: req.tenantId, number: `T-${String(await nextNumber(req.tenantId, "task")).padStart(6, "0")}`, title: `${t.number}: ${t.subject}`, kind: "adhoc",
      project: t.project || null, projectModule: t.projectModule || null, client: t.client, product: t.product || null, assignee, status: first?._id || null, ...statusFlags(first),
      tatValue: 1, tatUnit: "days", order: (last?.order || 0) + 1, plannedStart: new Date(), plannedDue: due, start: new Date(), due, dueLocked: true, clientVisible: false,
      description: t.description, createdBy: req.auth.uid,
    });
    await PmAssignment.create({ tenant: req.tenantId, entity: "task", entityId: task._id, project: t.project || null, from: null, to: assignee, reason: `Ticket ${t.number}`, by: req.auth.uid });
    t.linkedTask = task._id as any;
    await t.save();
    emitPm("task_assigned", { tenantId: String(req.tenantId), actorId: req.auth.uid, actorName: req.auth.name, taskId: String(task._id), projectId: t.project ? String(t.project) : undefined });
    ok(res, { task: task._id, number: task.number }, 201);
  })
);

// Merge a duplicate into another ticket of the same client.
r.post(
  "/tickets/:id/merge",
  pmRight("tickets", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const dup = await findTicket(req, req.params.id);
    const main = await findTicket(req, req.body?.into);
    if (String(dup._id) === String(main._id)) throw new ApiError(400, "Choose a different ticket");
    if (String(dup.client) !== String(main.client)) throw new ApiError(400, "Only tickets of the same client can be merged");
    main.replies.push({ by: req.auth.uid, byClient: "", text: `Merged ${dup.number}: ${dup.subject}\n${dup.description}`, internal: true, at: new Date() } as any);
    dup.replies.forEach((x: any) => main.replies.push({ by: x.by, byClient: x.byClient, text: x.text, internal: x.internal, at: x.at } as any));
    dup.files.forEach((f: any) => main.files.push(f));
    await main.save();
    const closed = (await PmMaster.find({ tenant: req.tenantId, type: "ticket_status", active: true }).sort({ order: -1 }).lean()).find((s: any) => s.flags?.isClosed);
    dup.mergedInto = main._id as any;
    dup.isClosed = true;
    if (closed) dup.status = closed._id as any;
    dup.resolvedAt = new Date();
    await dup.save();
    ok(res, { into: main._id, number: main.number });
  })
);

r.delete(
  "/tickets/:id",
  pmRight("tickets", "del"),
  asyncHandler(async (req: any, res: any) => {
    const t = await findTicket(req, req.params.id);
    t.files.forEach((f: any) => fs.rm(path.join(PM_FILES, String(req.tenantId), path.basename(f.file)), () => {}));
    await PmAssignment.deleteMany({ tenant: req.tenantId, entity: "ticket", entityId: t._id });
    await t.deleteOne();
    ok(res, { deleted: true });
  })
);

/* ---- files of a ticket (also used by the client portal) ---- */
export const ticketUpload = multer({ dest: path.join(os.tmpdir(), "whatsapp_crm_uploads"), limits: { fileSize: 50 * 1024 * 1024 } });

export async function addTicketFile(req: any, ticket: any, byClient: boolean) {
  const tmp = req.file?.path;
  try {
    if (!req.file) throw new ApiError(400, "Choose a file");
    const s = await getPmSettings(req.tenantId);
    const ext = path.extname(req.file.originalname || "").slice(1).toLowerCase() || (req.file.mimetype || "").split("/")[1] || "";
    if (!s.allowedFileTypes.includes(ext)) throw new ApiError(400, `.${ext || "?"} files are not allowed`);
    if (req.file.size > s.maxFileSizeMb * 1024 * 1024) throw new ApiError(400, `The file is larger than ${s.maxFileSizeMb} MB`);
    if (ticket.files.length >= 10) throw new ApiError(400, "A ticket can have at most 10 files");
    const dir = path.join(PM_FILES, String(req.tenantId));
    fs.mkdirSync(dir, { recursive: true });
    const file = `tkt-${ticket._id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext.replace(/[^a-z0-9]/g, "")}`;
    fs.copyFileSync(tmp, path.join(dir, file));
    ticket.files.push({ name: String(req.file.originalname || `image.${ext}`).slice(0, 180), file, size: req.file.size, mime: req.file.mimetype, byClient, at: new Date() });
    await ticket.save();
    return ticket.files[ticket.files.length - 1];
  } finally {
    if (tmp) fs.rm(tmp, () => {});
  }
}
export function sendTicketFile(req: any, res: any, ticket: any) {
  const f: any = ticket.files.find((x: any) => String(x._id) === String(req.params.fileId));
  if (!f) throw new ApiError(404, "File not found");
  const full = path.join(PM_FILES, String(req.tenantId), path.basename(f.file));
  if (!fs.existsSync(full)) throw new ApiError(404, "File not found");
  res.setHeader("Content-Type", f.mime || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(f.name)}"`);
  fs.createReadStream(full).pipe(res);
}

r.post(
  "/tickets/:id/files",
  pmRight("tickets", "edit"),
  ticketUpload.single("file"),
  asyncHandler(async (req: any, res: any) => {
    ok(res, await addTicketFile(req, await findTicket(req, req.params.id), false), 201);
  })
);
r.get(
  "/tickets/:id/files/:fileId",
  pmRight("tickets", "view"),
  asyncHandler(async (req: any, res: any) => {
    sendTicketFile(req, res, await findTicket(req, req.params.id));
  })
);

export { PmProjectModule };
export default r;
