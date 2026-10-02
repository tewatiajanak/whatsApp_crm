import { Router } from "express";
import { Types } from "mongoose";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { ok, asyncHandler, ApiError } from "../utils/http";
import { EmEvent, EmAttendee, EmEventLog } from "../models/EventManager";
import { AppStore } from "../models/AppStore";
import { Message } from "../models/Messaging";

/**
 * Event Manager REST API: events, attendees and per-event activity logs.
 * Mounted behind `authenticate`, so `req.tenantId` is always set.
 */
const r = Router();

// Fields a client must never set or move.
const clean = (body: any) => {
  const { _id, id, tenant, createdAt, updatedAt, __v, ...rest } = body || {};
  return rest;
};
const out = (doc: any) => {
  if (!doc) return doc;
  const o = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const { _id, __v, tenant, ...rest } = o;
  return { ...rest, id: _id };
};

/**
 * One-time move of the data that used to live as JSON blobs in the app store
 * (`em_mock_events`, `em_mock_attendees`, `em_mock_event-logs`) into real
 * collections. Runs whenever such blobs exist (a browser may upload its old
 * local data after sign-in); they are removed afterwards, and rows that were
 * already moved are skipped by their id.
 */
async function migrateFromAppStore(tenantId: string) {
  const keys = ["em_mock_events", "em_mock_attendees", "em_mock_event-logs"];
  const rows = await AppStore.find({ tenant: tenantId, user: null, key: { $in: keys } }).lean();
  if (!rows.length) return;
  const parse = (key: string): any[] => {
    try {
      const v = JSON.parse(rows.find((x) => x.key === key)?.value || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };
  const toDocs = (list: any[]) =>
    list
      .filter((x) => x && typeof x === "object")
      .map(({ id, _id, tenant, ...rest }) => ({ ...rest, ...(id || _id ? { _id: String(id || _id) } : {}), tenant: tenantId }));

  const events = toDocs(parse("em_mock_events")).filter((e: any) => e.eventName);
  const attendees = toDocs(parse("em_mock_attendees")).filter((a: any) => a.eventId);
  const logs = toDocs(parse("em_mock_event-logs"));
  // ordered:false → one bad/duplicate row doesn't stop the rest
  const insert = async (M: any, docs: any[]) => {
    if (!docs.length) return;
    try {
      await M.insertMany(docs, { ordered: false });
    } catch (e: any) {
      if (e?.code !== 11000 && !e?.writeErrors) throw e;
    }
  };
  await insert(EmEvent, events);
  await insert(EmAttendee, attendees);
  await insert(EmEventLog, logs);
  await AppStore.deleteMany({ tenant: tenantId, user: null, key: { $in: keys } });
}

// Every list read first picks up any not-yet-moved legacy data.
const withMigration = asyncHandler(async (req: any, _res: any, next: any) => {
  await migrateFromAppStore(req.tenantId);
  next();
});

/* ---- Events ---- */
r.get(
  "/events",
  withMigration,
  asyncHandler(async (req: any, res: any) => {
    const [events, counts] = await Promise.all([
      EmEvent.find({ tenant: req.tenantId }).sort({ createdAt: -1 }).lean(),
      EmAttendee.aggregate([
        { $match: { tenant: new Types.ObjectId(String(req.tenantId)) } },
        { $group: { _id: "$eventId", n: { $sum: 1 } } },
      ]),
    ]);
    const countMap = new Map(counts.map((c: any) => [c._id, c.n]));
    ok(res, events.map((e: any) => ({ ...out(e), attendeeCount: countMap.get(e._id) || 0 })));
  })
);
r.get(
  "/events/:id",
  asyncHandler(async (req: any, res: any) => {
    const doc = await EmEvent.findOne({ _id: req.params.id, tenant: req.tenantId }).lean();
    if (!doc) throw new ApiError(404, "Event not found");
    ok(res, out(doc));
  })
);
r.post(
  "/events",
  asyncHandler(async (req: any, res: any) => {
    const body = clean(req.body);
    if (!String(body.eventName || "").trim()) throw new ApiError(400, "Event name is required");
    const doc = await EmEvent.create({ ...body, tenant: req.tenantId });
    ok(res, out(doc), 201);
  })
);
r.patch(
  "/events/:id",
  asyncHandler(async (req: any, res: any) => {
    const doc = await EmEvent.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      { $set: clean(req.body) },
      { new: true, strict: false }
    ).lean();
    if (!doc) throw new ApiError(404, "Event not found");
    const attendeeCount = await EmAttendee.countDocuments({ tenant: req.tenantId, eventId: req.params.id });
    ok(res, { ...out(doc), attendeeCount });
  })
);
r.delete(
  "/events/:id",
  asyncHandler(async (req: any, res: any) => {
    const done = await EmEvent.deleteOne({ _id: req.params.id, tenant: req.tenantId });
    if (!done.deletedCount) throw new ApiError(404, "Event not found");
    // attendees belong to the event; the activity log is kept as the audit trail
    await EmAttendee.deleteMany({ tenant: req.tenantId, eventId: req.params.id });
    ok(res, { id: req.params.id });
  })
);

/* ---- Media used on registration forms and passes (images, background video) ---- */
// Stored on disk and served from /uploads, so the public form can show them.
const FORM_IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif",
  "video/mp4": ".mp4", "video/webm": ".webm",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const formImageUpload = multer({ dest: path.join(os.tmpdir(), "whatsapp_crm_uploads"), limits: { fileSize: MAX_VIDEO_BYTES } });
r.post(
  "/events/form-image",
  formImageUpload.single("file"),
  asyncHandler(async (req: any, res: any) => {
    if (!req.file) throw new ApiError(400, "No file uploaded");
    // extension comes from the checked type, never from the uploaded file name
    const ext = FORM_IMAGE_TYPES[String(req.file.mimetype || "")];
    if (!ext) {
      await fs.promises.unlink(req.file.path).catch(() => undefined);
      throw new ApiError(400, "Only PNG, JPG, WEBP or GIF images, or MP4 / WEBM videos are allowed");
    }
    if (ext !== ".mp4" && ext !== ".webm" && req.file.size > MAX_IMAGE_BYTES) {
      await fs.promises.unlink(req.file.path).catch(() => undefined);
      throw new ApiError(400, "The image must be smaller than 5 MB");
    }
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`;
    const dir = path.join(process.cwd(), "uploads", "event-forms");
    await fs.promises.mkdir(dir, { recursive: true });
    // copy + unlink rather than rename: tmpdir may be on a different volume
    await fs.promises.copyFile(req.file.path, path.join(dir, fileName));
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    ok(res, { url: `/uploads/event-forms/${fileName}` }, 201);
  })
);

/* ---- Attendees ---- */
const requireEvent = async (req: any, eventId: unknown) => {
  if (!eventId || !(await EmEvent.exists({ _id: String(eventId), tenant: req.tenantId }))) {
    throw new ApiError(404, "Event not found");
  }
  return String(eventId);
};
r.get(
  "/attendees",
  withMigration,
  asyncHandler(async (req: any, res: any) => {
    const filter: any = { tenant: req.tenantId };
    if (req.query.eventId) filter.eventId = String(req.query.eventId);
    const rows = await EmAttendee.find(filter).sort({ createdAt: -1 }).lean();
    ok(res, rows.map(out));
  })
);
r.post(
  "/attendees",
  asyncHandler(async (req: any, res: any) => {
    const eventId = await requireEvent(req, req.body?.eventId);
    const doc = await EmAttendee.create({ ...clean(req.body), eventId, tenant: req.tenantId });
    ok(res, out(doc), 201);
  })
);
r.post(
  "/attendees/bulk",
  asyncHandler(async (req: any, res: any) => {
    const eventId = await requireEvent(req, req.body?.eventId);
    const list = Array.isArray(req.body?.attendees) ? req.body.attendees : [];
    if (!list.length) throw new ApiError(400, "No attendees to import");
    if (list.length > 20000) throw new ApiError(400, "Too many rows in one import (max 20,000)");
    const docs = await EmAttendee.insertMany(list.map((a: any) => ({ ...clean(a), eventId, tenant: req.tenantId })));
    ok(res, docs.map(out), 201);
  })
);
// Mark every attendee of an event as having a generated pass, in one query.
r.post(
  "/attendees/mark-pass-generated",
  asyncHandler(async (req: any, res: any) => {
    const eventId = await requireEvent(req, req.body?.eventId);
    await EmAttendee.updateMany({ tenant: req.tenantId, eventId }, { $set: { passGenerated: true } });
    const rows = await EmAttendee.find({ tenant: req.tenantId, eventId }).lean();
    ok(res, rows.map(out));
  })
);
/* ---- Offline payments recorded by staff ---- */
const MANUAL_MODES = ["Cash", "UPI", "Bank transfer", "Cheque", "Card (POS)", "Other"];
r.post(
  "/attendees/:id/manual-payment",
  asyncHandler(async (req: any, res: any) => {
    const a: any = await EmAttendee.findOne({ _id: req.params.id, tenant: req.tenantId }).lean();
    if (!a) throw new ApiError(404, "Attendee not found");
    // money already received through the gateway must not be recorded twice
    if (a.paymentStatus === "paid" && a.paymentMode === "online") throw new ApiError(409, "This attendee has already paid online");
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "Enter the amount received");
    const mode = MANUAL_MODES.includes(req.body?.mode) ? req.body.mode : "Cash";
    const paidAt = req.body?.date && !isNaN(new Date(req.body.date).getTime()) ? new Date(req.body.date) : new Date();
    const doc = await EmAttendee.findOneAndUpdate(
      { _id: a._id, tenant: req.tenantId },
      {
        $set: {
          paymentStatus: "paid",
          paymentMode: "manual",
          amountPaid: Math.round(amount * 100) / 100,
          paidAt,
          manualPayment: {
            mode,
            reference: String(req.body?.reference || "").trim().slice(0, 100),
            note: String(req.body?.note || "").trim().slice(0, 300),
            recordedBy: String(req.body?.recordedBy || "").trim().slice(0, 80),
            recordedAt: new Date(),
          },
        },
      },
      { new: true, strict: false }
    ).lean();
    await EmEventLog.create({
      tenant: req.tenantId,
      eventId: a.eventId,
      action: "Payment Recorded",
      entity: "attendee",
      entityId: String(a._id),
      entityName: a.name || String(a._id),
      changedBy: String(req.body?.recordedBy || "Admin").slice(0, 80),
      changedAt: new Date().toISOString(),
      oldData: null,
      newData: { amount, mode, reference: String(req.body?.reference || "") },
    });
    ok(res, out(doc));
  })
);
// Undo a manual entry (a payment received online can't be removed here).
r.delete(
  "/attendees/:id/manual-payment",
  asyncHandler(async (req: any, res: any) => {
    const a: any = await EmAttendee.findOne({ _id: req.params.id, tenant: req.tenantId }).lean();
    if (!a) throw new ApiError(404, "Attendee not found");
    if (a.paymentMode !== "manual") throw new ApiError(409, "Only a manually recorded payment can be removed");
    const doc = await EmAttendee.findOneAndUpdate(
      { _id: a._id, tenant: req.tenantId },
      { $set: { paymentStatus: "unpaid", amountPaid: 0, paidAt: null, paymentMode: "" }, $unset: { manualPayment: 1 } },
      { new: true, strict: false }
    ).lean();
    await EmEventLog.create({
      tenant: req.tenantId,
      eventId: a.eventId,
      action: "Payment Removed",
      entity: "attendee",
      entityId: String(a._id),
      entityName: a.name || String(a._id),
      changedBy: String(req.query?.by || "Admin").slice(0, 80),
      changedAt: new Date().toISOString(),
      oldData: { amount: a.amountPaid, mode: a.manualPayment?.mode },
      newData: null,
    });
    ok(res, out(doc));
  })
);

/* ---- Attendance: check a person in or out (scan desk, web and mobile app) ----
 * The server sets the times, so every device agrees. `status`, `checkInTime` and
 * `checkOutTime` hold the latest state; `attendanceLog` keeps every in/out. */
r.post(
  "/attendees/:id/attendance",
  asyncHandler(async (req: any, res: any) => {
    const action = req.body?.action;
    if (action !== "in" && action !== "out") throw new ApiError(400, "action must be 'in' or 'out'");
    const current: any = await EmAttendee.findOne({ _id: req.params.id, tenant: req.tenantId }).lean();
    if (!current) throw new ApiError(404, "Attendee not found");
    if (action === "in" && current.status === "checked-in") throw new ApiError(409, "Already checked in", { attendee: out(current) });
    if (action === "out" && current.status !== "checked-in")
      throw new ApiError(409, current.status === "checked-out" ? "Already checked out" : "Not checked in yet", { attendee: out(current) });
    const now = new Date().toISOString();
    const set: any = action === "in" ? { status: "checked-in", checkInTime: now, checkOutTime: null } : { status: "checked-out", checkOutTime: now };
    const doc = await EmAttendee.findOneAndUpdate(
      // the status is part of the match, so two devices scanning the same pass cannot both succeed
      { _id: req.params.id, tenant: req.tenantId, status: current.status ?? null },
      { $set: set, $push: { attendanceLog: { type: action, at: now, by: req.auth?.name || "" } } },
      { new: true, strict: false }
    ).lean();
    if (!doc) throw new ApiError(409, "This pass was just scanned on another device");
    ok(res, out(doc));
  })
);

r.patch(
  "/attendees/:id",
  asyncHandler(async (req: any, res: any) => {
    const { eventId: _ignored, paymentStatus, paymentMode, amountPaid, paidAt, manualPayment, paymentTxnId, paymentProvider, ...body } = clean(req.body);
    const doc = await EmAttendee.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      { $set: body },
      { new: true, strict: false }
    ).lean();
    if (!doc) throw new ApiError(404, "Attendee not found");
    ok(res, out(doc));
  })
);
r.delete(
  "/attendees/:id",
  asyncHandler(async (req: any, res: any) => {
    const done = await EmAttendee.deleteOne({ _id: req.params.id, tenant: req.tenantId });
    if (!done.deletedCount) throw new ApiError(404, "Attendee not found");
    ok(res, { id: req.params.id });
  })
);

/* ---- Communication history: every WhatsApp / email sent from Event Manager ---- */
r.get(
  "/event-communications",
  asyncHandler(async (req: any, res: any) => {
    const filter: any = { tenant: req.tenantId, source: "events" };
    if (["whatsapp", "email"].includes(String(req.query.channel))) filter.channel = String(req.query.channel);
    if (req.query.eventId) filter.eventId = String(req.query.eventId);
    const rows = await Message.find(filter).sort({ createdAt: -1 }).limit(5000).lean();
    ok(
      res,
      rows.map((m: any) => ({
        id: String(m._id),
        channel: m.channel,
        to: m.phone,
        name: m.contactName || "",
        eventId: m.eventId || "",
        eventName: m.eventName || "",
        template: m.template || "",
        subject: m.subject || "",
        body: m.body || "",
        status: m.status,
        failReason: m.failReason || "",
        simulated: !!m.simulated,
        sentBy: m.agent || "",
        at: m.createdAt,
      }))
    );
  })
);

/* ---- Activity log ---- */
r.get(
  "/event-logs",
  withMigration,
  asyncHandler(async (req: any, res: any) => {
    const filter: any = { tenant: req.tenantId };
    if (req.query.eventId) filter.eventId = String(req.query.eventId);
    const rows = await EmEventLog.find(filter).sort({ createdAt: -1 }).limit(2000).lean();
    ok(res, rows.map(out));
  })
);
r.post(
  "/event-logs",
  asyncHandler(async (req: any, res: any) => {
    const doc = await EmEventLog.create({ ...clean(req.body), tenant: req.tenantId });
    ok(res, out(doc), 201);
  })
);
r.delete(
  "/event-logs",
  asyncHandler(async (req: any, res: any) => {
    if (!req.query.eventId) throw new ApiError(400, "eventId is required");
    await EmEventLog.deleteMany({ tenant: req.tenantId, eventId: String(req.query.eventId) });
    ok(res, { ok: true });
  })
);

export default r;
