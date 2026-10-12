import { Router } from "express";
import { ok, asyncHandler, ApiError, audit } from "../../utils/http";
import { PM_MODULES } from "../../models/User";
import { PmMaster, PmHoliday } from "../../models/pm/Setup";
import { MASTER_TYPES, getPmSettings, masterInUse } from "../../services/pm/masters";
import { anyRight, pmRight } from "../../services/pm/visibility";

/** Project Management → Setup: masters, status flow, holidays, settings. */
const r = Router();

// every Project Management screen reads the masters (statuses, priorities, …)
const anyPm = anyRight(...PM_MODULES.map((m) => [m, "view"] as [string, "view"]));
const AUDIT = "Project Management";

const masterType = (req: any) => {
  const type = String(req.params.type);
  if (!MASTER_TYPES[type]) throw new ApiError(404, "Unknown master");
  return type;
};
const COLOR = /^#[0-9a-fA-F]{6}$/;

const masterBody = (type: string, body: any, creating: boolean) => {
  const def = MASTER_TYPES[type];
  const out: any = {};
  if (body.name !== undefined || creating) {
    out.name = String(body.name || "").trim();
    if (!out.name) throw new ApiError(400, "Enter a name");
  }
  if (body.color !== undefined) {
    if (!COLOR.test(String(body.color))) throw new ApiError(400, "Choose a colour");
    out.color = body.color;
  }
  if (body.active !== undefined) out.active = !!body.active;
  if (body.flags !== undefined || creating) {
    out.flags = {};
    for (const f of def.flags) out.flags[f] = !!body.flags?.[f];
  }
  if (body.values !== undefined || creating) {
    out.values = {};
    for (const v of def.values) out.values[v] = Math.max(0, Number(body.values?.[v]) || 0);
  }
  return out;
};

/* ---- Masters ---- */
r.get(
  "/master-types",
  anyPm,
  asyncHandler(async (_req: any, res: any) => {
    ok(res, Object.entries(MASTER_TYPES).map(([type, d]) => ({ type, ...d })));
  })
);

// all masters in one call: { task_status: [...], priority: [...], … }
r.get(
  "/masters",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    await getPmSettings(req.tenantId);
    const rows = await PmMaster.find({ tenant: req.tenantId }).sort({ order: 1, name: 1 }).lean();
    const out: Record<string, any[]> = {};
    Object.keys(MASTER_TYPES).forEach((t) => (out[t] = []));
    rows.forEach((x) => out[x.type]?.push(x));
    ok(res, out);
  })
);

r.get(
  "/masters/:type",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    const type = masterType(req);
    await getPmSettings(req.tenantId);
    ok(res, await PmMaster.find({ tenant: req.tenantId, type }).sort({ order: 1, name: 1 }).lean());
  })
);

r.post(
  "/masters/:type",
  pmRight("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const type = masterType(req);
    const last = await PmMaster.findOne({ tenant: req.tenantId, type }).sort({ order: -1 }).select("order").lean();
    const doc = await PmMaster.create({ ...masterBody(type, req.body, true), tenant: req.tenantId, type, order: (last?.order || 0) + 1 });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `${MASTER_TYPES[type].label}: ${doc.name}` });
    ok(res, doc, 201);
  })
);

// drag to reorder: the ids in their new order
r.put(
  "/masters/:type/order",
  pmRight("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const type = masterType(req);
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    await Promise.all(ids.map((id, i) => PmMaster.updateOne({ _id: id, tenant: req.tenantId, type }, { $set: { order: i + 1 } })));
    ok(res, { ordered: ids.length });
  })
);

r.patch(
  "/masters/:type/:id",
  pmRight("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const type = masterType(req);
    const doc = await PmMaster.findOneAndUpdate({ _id: req.params.id, tenant: req.tenantId, type }, { $set: masterBody(type, req.body, false) }, { new: true });
    if (!doc) throw new ApiError(404, "Not found");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: AUDIT, entity: `${MASTER_TYPES[type].label}: ${doc.name}` });
    ok(res, doc);
  })
);

r.delete(
  "/masters/:type/:id",
  pmRight("setup", "del"),
  asyncHandler(async (req: any, res: any) => {
    const type = masterType(req);
    const why = await masterInUse(req.tenantId, type, req.params.id);
    if (why) throw new ApiError(409, `${why}. It cannot be deleted; make it inactive instead.`);
    const doc = await PmMaster.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId, type });
    if (!doc) throw new ApiError(404, "Not found");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: AUDIT, entity: `${MASTER_TYPES[type].label}: ${doc.name}` });
    ok(res, { deleted: true });
  })
);

/* ---- Holidays ---- */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const holidayBody = (body: any) => {
  const date = String(body?.date || "");
  const name = String(body?.name || "").trim();
  if (!DATE.test(date)) throw new ApiError(400, "Choose a date");
  if (!name) throw new ApiError(400, "Enter the holiday name");
  return { date, name };
};
r.get(
  "/holidays",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    const filter: any = { tenant: req.tenantId };
    if (/^\d{4}$/.test(String(req.query.year || ""))) filter.date = { $gte: `${req.query.year}-01-01`, $lte: `${req.query.year}-12-31` };
    ok(res, await PmHoliday.find(filter).sort({ date: 1 }).lean());
  })
);
r.post(
  "/holidays",
  pmRight("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmHoliday.create({ ...holidayBody(req.body), tenant: req.tenantId });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Holiday ${doc.date} ${doc.name}` });
    ok(res, doc, 201);
  })
);
// Import a list (from Excel): a date that already has a holiday gets the new name.
r.post(
  "/holidays/import",
  pmRight("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const list = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!list.length) throw new ApiError(400, "The file has no holidays");
    if (list.length > 400) throw new ApiError(400, "Import at most 400 holidays at a time");
    const byDate = new Map<string, string>();
    list.forEach((row: any, i: number) => {
      try {
        const { date, name } = holidayBody(row);
        if (isNaN(new Date(`${date}T00:00:00Z`).getTime())) throw new ApiError(400, "Choose a date");
        byDate.set(date, name.slice(0, 80));
      } catch (e: any) {
        throw new ApiError(400, `Row ${i + 1}: ${e.message}`);
      }
    });
    const have = new Set((await PmHoliday.find({ tenant: req.tenantId, date: { $in: [...byDate.keys()] } }).select("date").lean()).map((h: any) => h.date));
    await PmHoliday.bulkWrite([...byDate].map(([date, name]) => ({ updateOne: { filter: { tenant: req.tenantId, date }, update: { $set: { name } }, upsert: true } })));
    const updated = [...byDate.keys()].filter((d) => have.has(d)).length;
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Holidays imported (${byDate.size})` });
    ok(res, { added: byDate.size - updated, updated }, 201);
  })
);
r.patch(
  "/holidays/:id",
  pmRight("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmHoliday.findOneAndUpdate({ _id: req.params.id, tenant: req.tenantId }, { $set: holidayBody(req.body) }, { new: true });
    if (!doc) throw new ApiError(404, "Holiday not found");
    ok(res, doc);
  })
);
r.delete(
  "/holidays/:id",
  pmRight("setup", "del"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmHoliday.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
    if (!doc) throw new ApiError(404, "Holiday not found");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: AUDIT, entity: `Holiday ${doc.date} ${doc.name}` });
    ok(res, { deleted: true });
  })
);

/* ---- Settings (working days and hours, attachments, schedule thresholds) + status flow ---- */
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const present = (s: any) => ({
  workingDays: s.workingDays,
  workStart: s.workStart,
  workEnd: s.workEnd,
  maxAttachments: s.maxAttachments,
  maxFileSizeMb: s.maxFileSizeMb,
  allowedFileTypes: s.allowedFileTypes,
  aheadThreshold: s.aheadThreshold,
  delayedThreshold: s.delayedThreshold,
  pastedImagesCount: s.pastedImagesCount,
  ticketReopenDays: s.ticketReopenDays,
  workloadThreshold: s.workloadThreshold,
  timeLogging: s.timeLogging,
  meetingEmail: s.meetingEmail !== false,
  taskStatusFlow: (s.taskStatusFlow || []).map((f: any) => ({ from: String(f.from), to: String(f.to) })),
});

r.get(
  "/settings",
  anyPm,
  asyncHandler(async (req: any, res: any) => {
    ok(res, present(await getPmSettings(req.tenantId)));
  })
);

r.put(
  "/settings",
  pmRight("setup", "configure"),
  asyncHandler(async (req: any, res: any) => {
    const b = req.body || {};
    const s = await getPmSettings(req.tenantId);
    const num = (v: any, min: number, max: number, name: string) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < min || n > max) throw new ApiError(400, `${name} must be between ${min} and ${max}`);
      return n;
    };
    if (b.workingDays !== undefined) {
      const days = [...new Set((Array.isArray(b.workingDays) ? b.workingDays : []).map(Number).filter((d: number) => d >= 0 && d <= 6))].sort();
      if (!days.length) throw new ApiError(400, "Choose at least one working day");
      s.workingDays = days as number[];
    }
    if (b.workStart !== undefined || b.workEnd !== undefined) {
      const start = String(b.workStart ?? s.workStart);
      const end = String(b.workEnd ?? s.workEnd);
      if (!TIME.test(start) || !TIME.test(end) || start >= end) throw new ApiError(400, "Working hours must end after they start");
      s.workStart = start;
      s.workEnd = end;
    }
    if (b.maxAttachments !== undefined) s.maxAttachments = num(b.maxAttachments, 0, 20, "Attachments per task");
    if (b.maxFileSizeMb !== undefined) s.maxFileSizeMb = num(b.maxFileSizeMb, 1, 50, "File size");
    if (b.allowedFileTypes !== undefined) {
      s.allowedFileTypes = [...new Set((Array.isArray(b.allowedFileTypes) ? b.allowedFileTypes : String(b.allowedFileTypes).split(",")).map((x: any) => String(x).trim().toLowerCase().replace(/^\./, "")).filter((x: string) => /^[a-z0-9]{1,8}$/.test(x)))] as string[];
    }
    if (b.aheadThreshold !== undefined) s.aheadThreshold = num(b.aheadThreshold, 0, 50, "Ahead threshold");
    if (b.delayedThreshold !== undefined) s.delayedThreshold = num(b.delayedThreshold, 0, 50, "Delayed threshold");
    if (b.pastedImagesCount !== undefined) s.pastedImagesCount = !!b.pastedImagesCount;
    if (b.ticketReopenDays !== undefined) s.ticketReopenDays = num(b.ticketReopenDays, 0, 90, "Ticket reopen days");
    if (b.workloadThreshold !== undefined) s.workloadThreshold = num(b.workloadThreshold, 1, 200, "Workload limit");
    if (b.timeLogging !== undefined) s.timeLogging = !!b.timeLogging;
    if (b.meetingEmail !== undefined) s.meetingEmail = !!b.meetingEmail;
    if (b.taskStatusFlow !== undefined) {
      const ids = new Set((await PmMaster.find({ tenant: req.tenantId, type: "task_status" }).select("_id").lean()).map((x) => String(x._id)));
      const seen = new Set<string>();
      s.taskStatusFlow = (Array.isArray(b.taskStatusFlow) ? b.taskStatusFlow : [])
        .map((f: any) => ({ from: String(f?.from || ""), to: String(f?.to || "") }))
        .filter((f: any) => ids.has(f.from) && ids.has(f.to) && f.from !== f.to && !seen.has(`${f.from}>${f.to}`) && seen.add(`${f.from}>${f.to}`)) as any;
    }
    await s.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: AUDIT, entity: "Settings" });
    ok(res, present(s));
  })
);

export default r;
