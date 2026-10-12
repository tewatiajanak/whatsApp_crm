import { Router } from "express";
import { Types } from "mongoose";
import { createHash, randomBytes } from "crypto";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { require_ } from "../middleware/auth";
import { ok, asyncHandler, ApiError, audit } from "../utils/http";
import { Lead } from "../models/Lead";
import { FollowUp } from "../models/FollowUp";
import { LeadActivity } from "../models/LeadActivity";
import { LeadStatus, LeadSource } from "../models/Masters";
import { Registration } from "../models/Registration";
import { User } from "../models/User";
import { Template } from "../models/Messaging";
import {
  crmSettingsFor, LeadDocument, LeadFee, LeadTarget, LeadApiKey, AutomationRun, AutomationJob, FEE_MODES, DEFAULT_APPLICATION_STAGES, feeBalance,
} from "../models/CrmExtras";
import { encryptSecret, decryptSecret, maskSecret } from "../services/payments/crypto";
import { publicBase } from "../services/payments";
import { sendSms, placeCall, smsReady, telephonyReady, telephonyToken } from "../services/crmChannels";
import { sendSummary } from "../services/crmScheduler";
import { testInbox } from "../services/crmIntegrations";
import { markFeePaid, newToken } from "../services/leadFees";
import { assignableOwners, logActivity, refreshLead, changeLeadStatus } from "../services/leadService";
import { guardLead, canSeeLead, leadOwnerScope, scopeLeadFilter } from "../services/leadAccess";
import { appUrl } from "../services/pm/messages";
import { localDateTime, isDateKey, localDateKey } from "../utils/dates";

/** Lead CRM extras: settings, automation log, documents, fees, calling, targets, capture keys, applications. */
const r = Router();
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown, min: number, max: number, fallback: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ───────────── settings ───────────── */

const SECRETS: Array<[section: "telephony" | "sms", key: string]> = [["telephony", "apiToken"], ["telephony", "customHeaders"], ["sms", "authKey"], ["sms", "customHeaders"]];

async function presentSettings(req: any) {
  const s = await crmSettingsFor(req.tenantId);
  const o: any = s.toObject();
  for (const [section, key] of SECRETS) o[section][key] = maskSecret(decryptSecret(o[section][key]));
  o.portals = { ...(o.portals || {}), indiamartKey: maskSecret(decryptSecret(o.portals?.indiamartKey || "")) };
  o.inbox = { ...(o.inbox || {}), pass: maskSecret(decryptSecret(o.inbox?.pass || "")) };
  o.google = { clientId: o.google?.clientId || "", clientSecret: maskSecret(decryptSecret(o.google?.clientSecret || "")) };
  o.pulls = (o.pulls || []).map((p: any) => ({ name: p.name, url: p.url, listPath: p.listPath, map: p.map || {}, enabled: p.enabled !== false, lastPull: p.lastPull, lastError: p.lastError, headers: maskSecret(decryptSecret(p.headers || "")) }));
  // only the public half of the push keys ever leaves the server
  o.push = { publicKey: o.push?.publicKey || "" };
  return {
    ...o,
    smsReady: smsReady(s),
    telephonyReady: telephonyReady(s),
    telephonyCallbackUrl: `${publicBase(req)}/webhooks/telephony/${req.tenantId}?k=${telephonyToken(req.tenantId)}`,
    captureUrl: `${publicBase(req)}/webhooks/leads/<key>`,
    incomingCallUrl: `${publicBase(req)}/webhooks/telephony/${req.tenantId}/incoming?k=${telephonyToken(req.tenantId)}`,
    apiBase: publicBase(req),
    ivrUrl: `${publicBase(req)}/webhooks/telephony/${req.tenantId}/ivr?k=${telephonyToken(req.tenantId)}`,
    googleRedirectUrl: `${publicBase(req)}/webhooks/google/callback`,
  };
}

r.get("/crm/settings", require_("setup", "view"), asyncHandler(async (req: any, res: any) => ok(res, await presentSettings(req))));

r.put("/crm/settings", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const s = await crmSettingsFor(req.tenantId);
  if (b.reminders) {
    s.reminders.enabled = !!b.reminders.enabled;
    s.reminders.minutesBefore = num(b.reminders.minutesBefore, 0, 1440, 15);
    s.reminders.morningDigest = !!b.reminders.morningDigest;
    s.reminders.digestHour = num(b.reminders.digestHour, 0, 23, 9);
  }
  if (b.sla) {
    s.sla.enabled = !!b.sla.enabled;
    s.sla.firstResponseMins = num(b.sla.firstResponseMins, 1, 10080, 30);
    s.sla.notifyManager = !!b.sla.notifyManager;
    s.sla.alsoNotify = (Array.isArray(b.sla.alsoNotify) ? b.sla.alsoNotify : []).map((x: any) => str(x, 120)).filter(Boolean);
  }
  if (b.reports) {
    const recipients = (Array.isArray(b.reports.recipients) ? b.reports.recipients : String(b.reports.recipients || "").split(/[,;\s]+/)).map((x: any) => str(x, 200).toLowerCase()).filter(Boolean);
    const bad = recipients.find((e: string) => !EMAIL.test(e));
    if (bad) throw new ApiError(400, `${bad} is not an email address`);
    s.reports.enabled = !!b.reports.enabled;
    s.reports.frequency = b.reports.frequency === "weekly" ? "weekly" : "daily";
    s.reports.hour = num(b.reports.hour, 0, 23, 19);
    s.reports.weekday = num(b.reports.weekday, 0, 6, 1);
    s.reports.recipients = [...new Set(recipients)] as string[];
  }
  // a secret left blank, or sent back still masked, keeps the saved value
  const secret = (incoming: unknown, saved: string) => { const v = str(incoming, 4000); return !v || v.startsWith("••") ? saved : encryptSecret(v); };
  if (b.telephony) {
    const t = b.telephony;
    s.telephony.provider = ["exotel", "custom"].includes(t.provider) ? t.provider : "none";
    s.telephony.sid = str(t.sid, 120);
    s.telephony.apiKey = str(t.apiKey, 200);
    s.telephony.apiToken = secret(t.apiToken, s.telephony.apiToken);
    s.telephony.subdomain = str(t.subdomain, 120) || "api.exotel.com";
    s.telephony.callerId = str(t.callerId, 30);
    s.telephony.customUrl = str(t.customUrl, 500);
    s.telephony.customHeaders = jsonSecret(t.customHeaders, s.telephony.customHeaders, secret);
  }
  if (b.sms) {
    const m = b.sms;
    s.sms.provider = ["msg91", "custom"].includes(m.provider) ? m.provider : "none";
    s.sms.authKey = secret(m.authKey, s.sms.authKey);
    s.sms.senderId = str(m.senderId, 20);
    s.sms.entityId = str(m.entityId, 40);
    s.sms.customUrl = str(m.customUrl, 1000);
    s.sms.customMethod = m.customMethod === "POST" ? "POST" : "GET";
    s.sms.customHeaders = jsonSecret(m.customHeaders, s.sms.customHeaders, secret);
    s.sms.customBody = str(m.customBody, 2000);
  }
  if (b.assignment) {
    s.assignment.maxOpenLeads = num(b.assignment.maxOpenLeads, 0, 100000, 0);
    s.assignment.respectHours = !!b.assignment.respectHours;
    s.assignment.startHour = num(b.assignment.startHour, 0, 23, 9);
    s.assignment.endHour = num(b.assignment.endHour, 1, 24, 19);
    s.assignment.reassignOnSla = !!b.assignment.reassignOnSla;
  }
  if (b.duplicates) {
    s.duplicates.matchEmail = !!b.duplicates.matchEmail;
    s.duplicates.matchAltPhone = !!b.duplicates.matchAltPhone;
    s.duplicates.action = ["block", "allow"].includes(b.duplicates.action) ? b.duplicates.action : "enquiry";
  }
  if (b.ivr) {
    s.ivr.enabled = !!b.ivr.enabled;
    s.ivr.greeting = str(b.ivr.greeting, 500);
    s.ivr.options = (Array.isArray(b.ivr.options) ? b.ivr.options : [])
      .map((o: any) => ({ digit: str(o?.digit, 1), label: str(o?.label, 60), target: str(o?.target, 160) }))
      .filter((o: any) => /^[0-9*#]$/.test(o.digit) && o.target)
      .slice(0, 12);
  }
  if (b.inbox) {
    s.inbox.enabled = !!b.inbox.enabled;
    s.inbox.host = str(b.inbox.host, 200);
    s.inbox.port = num(b.inbox.port, 1, 65535, 993);
    s.inbox.secure = b.inbox.secure !== false;
    // a different mailbox starts counting from its own newest message
    if (str(b.inbox.user, 200) !== s.inbox.user) s.inbox.lastUid = 0;
    s.inbox.user = str(b.inbox.user, 200);
    s.inbox.pass = secret(b.inbox.pass, s.inbox.pass);
  }
  if (b.google) {
    s.google.clientId = str(b.google.clientId, 300);
    s.google.clientSecret = secret(b.google.clientSecret, s.google.clientSecret);
  }
  if (Array.isArray(b.pulls)) {
    const old: any[] = (s.pulls || []).map((p: any) => (typeof p.toObject === "function" ? p.toObject() : p));
    s.pulls = b.pulls.slice(0, 10).map((p: any) => {
      const name = str(p?.name, 60);
      const url = str(p?.url, 1000);
      if (!name || !/^https:\/\//i.test(url)) throw new ApiError(400, "Each portal needs a name and an https:// address");
      const before = old.find((x) => x.name === name) || {};
      const map: Record<string, string> = {};
      for (const k of ["id", "name", "phone", "email", "city", "state", "course", "message"]) if (str(p?.map?.[k], 120)) map[k] = str(p.map[k], 120);
      return { name, url, listPath: str(p?.listPath, 120), map, enabled: p?.enabled !== false, headers: jsonSecret(p?.headers, before.headers || "", secret), lastPull: before.lastPull, lastError: before.lastError || "", seen: before.url === url ? before.seen || [] : [] };
    }) as any;
  }
  if (b.billing) {
    s.billing.legalName = str(b.billing.legalName, 200);
    s.billing.address = str(b.billing.address, 500);
    s.billing.gstin = str(b.billing.gstin, 20).toUpperCase();
    s.billing.gstPercent = num(b.billing.gstPercent, 0, 28, 0);
    s.billing.invoicePrefix = str(b.billing.invoicePrefix, 10).replace(/[^A-Za-z0-9/-]/g, "") || "INV";
  }
  if (b.portals) {
    s.portals.indiamartEnabled = !!b.portals.indiamartEnabled;
    s.portals.indiamartKey = secret(b.portals.indiamartKey, s.portals.indiamartKey);
  }
  if (b.booking) {
    s.booking.enabled = !!b.booking.enabled;
    s.booking.slotMinutes = [15, 20, 30, 45, 60].includes(Number(b.booking.slotMinutes)) ? Number(b.booking.slotMinutes) : 30;
    s.booking.startHour = num(b.booking.startHour, 0, 23, 10);
    s.booking.endHour = num(b.booking.endHour, 1, 24, 18);
    s.booking.days = (Array.isArray(b.booking.days) ? b.booking.days : []).map(Number).filter((d: number) => d >= 0 && d <= 6);
  }
  if (b.trashDays !== undefined) s.trashDays = num(b.trashDays, 1, 365, 30);
  if (Array.isArray(b.applicationStages)) {
    const stages = [...new Set(b.applicationStages.map((x: any) => str(x, 60)).filter(Boolean))] as string[];
    if (stages.length < 2) throw new ApiError(400, "Keep at least two application stages");
    s.applicationStages = stages;
  }
  await s.save();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "CRM settings", entity: Object.keys(b).join(", ") });
  ok(res, await presentSettings(req));
}));

/** Extra request headers are typed as JSON; make sure they parse before saving them. */
function jsonSecret(incoming: unknown, saved: string, secret: (i: unknown, s: string) => string) {
  const v = str(incoming, 4000);
  if (v && !v.startsWith("••")) {
    try { const o = JSON.parse(v); if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error(); }
    catch { throw new ApiError(400, 'Extra headers must be JSON, like {"Authorization": "Bearer …"}'); }
  }
  return secret(incoming, saved);
}

r.post("/crm/settings/test-sms", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const to = str(req.body?.to, 20);
  if (!to) throw new ApiError(400, "Enter a phone number to send the test to");
  ok(res, await sendSms(req.tenantId, to, str(req.body?.message, 300) || "Test message from your CRM.", str(req.body?.templateId, 60)));
}));

r.post("/crm/settings/test-inbox", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  ok(res, await testInbox(await crmSettingsFor(req.tenantId)));
}));

r.post("/crm/settings/send-report", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const s = await crmSettingsFor(req.tenantId);
  if (!s.reports.recipients.length) throw new ApiError(400, "Add at least one recipient first");
  ok(res, { sent: await sendSummary(req.tenantId, s) });
}));

/* ───────────── automation: what the rule builder needs, and the run log ───────────── */

r.get("/crm/automation/meta", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  const [users, templates] = await Promise.all([
    User.find({ tenant: req.tenantId, status: "Active", pmClient: { $in: [null, undefined] } }).select("name").sort({ name: 1 }).lean(),
    Template.find({ tenant: req.tenantId, status: "Approved" }).select("name channel").sort({ name: 1 }).lean(),
  ]);
  ok(res, { users, templates });
}));

r.get("/crm/automation/runs", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  const filter: any = { tenant: req.tenantId };
  if (Types.ObjectId.isValid(str(req.query.workflow))) filter.workflow = req.query.workflow;
  if (req.query.ok === "false") filter.ok = false;
  const [runs, waiting] = await Promise.all([
    AutomationRun.find(filter).sort({ at: -1 }).limit(200).lean(),
    AutomationJob.countDocuments({ tenant: req.tenantId, status: "pending" }),
  ]);
  ok(res, { runs, waiting });
}));

/* ───────────── documents on a lead ───────────── */

const DOC_DIR = path.join(process.cwd(), "uploads", "lead-docs");
const DOC_TYPES = /^(application\/pdf|image\/(jpeg|png|webp|heic)|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet))|application\/vnd\.ms-excel|text\/plain)$/;
const docUpload = multer({ dest: path.join(os.tmpdir(), "whatsapp_crm_uploads"), limits: { fileSize: 10 * 1024 * 1024 } });

r.get("/leads/:id/documents", require_("leads", "view"), guardLead, asyncHandler(async (req: any, res: any) => {
  ok(res, await LeadDocument.find({ tenant: req.tenantId, lead: req.params.id }).sort({ createdAt: -1 }).lean());
}));

r.post("/leads/:id/documents", require_("leads", "edit"), guardLead, docUpload.single("file"), asyncHandler(async (req: any, res: any) => {
  if (!req.file) throw new ApiError(400, "Choose a file");
  const drop = () => fs.promises.unlink(req.file.path).catch(() => undefined);
  if (!DOC_TYPES.test(String(req.file.mimetype || ""))) { await drop(); throw new ApiError(400, "Only PDF, image, Word, Excel and text files can be attached"); }
  const ext = (path.extname(req.file.originalname || "") || "").toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 8);
  const file = `${Date.now()}_${randomBytes(6).toString("hex")}${ext}`;
  const dir = path.join(DOC_DIR, String(req.tenantId));
  await fs.promises.mkdir(dir, { recursive: true });
  // copy + unlink rather than rename: tmpdir may be on a different volume
  await fs.promises.copyFile(req.file.path, path.join(dir, file));
  await drop();
  const doc = await LeadDocument.create({
    tenant: req.tenantId, lead: req.params.id, name: str(req.body?.name, 200) || req.file.originalname || "Document",
    category: str(req.body?.category, 80), file, mime: req.file.mimetype, size: req.file.size, by: req.auth?.name || "System",
  });
  await logActivity({ tenant: req.tenantId, lead: req.params.id, type: "document", by: req.auth?.name, title: "Document added", detail: doc.name });
  ok(res, doc, 201);
}));

// Lead documents are private: served only to a signed-in user who can see the lead, never from /uploads.
r.get("/leads/:id/documents/:docId/file", require_("leads", "view"), guardLead, asyncHandler(async (req: any, res: any) => {
  const doc = await LeadDocument.findOne({ _id: req.params.docId, tenant: req.tenantId, lead: req.params.id });
  if (!doc) throw new ApiError(404, "Document not found");
  const full = path.join(DOC_DIR, String(req.tenantId), path.basename(doc.file));
  if (!fs.existsSync(full)) throw new ApiError(404, "The file is no longer on the server");
  res.setHeader("Content-Type", doc.mime);
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${encodeURIComponent(doc.name)}"`);
  fs.createReadStream(full).pipe(res);
}));

r.delete("/leads/:id/documents/:docId", require_("leads", "edit"), guardLead, asyncHandler(async (req: any, res: any) => {
  const doc = await LeadDocument.findOneAndDelete({ _id: req.params.docId, tenant: req.tenantId, lead: req.params.id });
  if (!doc) throw new ApiError(404, "Document not found");
  await fs.promises.unlink(path.join(DOC_DIR, String(req.tenantId), path.basename(doc.file))).catch(() => undefined);
  await logActivity({ tenant: req.tenantId, lead: req.params.id, type: "document", by: req.auth?.name, title: "Document removed", detail: doc.name });
  ok(res, { deleted: true });
}));

/* ───────────── fees and payments on a lead ───────────── */

const feeFor = async (req: any) => {
  const fee = Types.ObjectId.isValid(req.params.feeId) ? await LeadFee.findOne({ _id: req.params.feeId, tenant: req.tenantId }) : null;
  if (!fee || !(await canSeeLead(req, fee.lead))) throw new ApiError(404, "Fee not found");
  return fee;
};
const payLink = async (tenant: any, token: string) => `${await appUrl(tenant)}/pay/${token}`;

r.get("/leads/:id/fees", require_("leads", "view"), guardLead, asyncHandler(async (req: any, res: any) => {
  const fees = await LeadFee.find({ tenant: req.tenantId, lead: req.params.id }).sort({ createdAt: -1 }).lean();
  const base = await appUrl(req.tenantId);
  const live = fees.filter((f) => f.status !== "cancelled");
  ok(res, {
    fees: fees.map((f) => ({ ...f, balance: f.status === "cancelled" ? 0 : feeBalance(f), link: `${base}/pay/${f.token}` })),
    paid: live.reduce((a, f) => a + (f.paidAmount || 0), 0),
    pending: live.reduce((a, f) => a + feeBalance(f), 0),
    modes: FEE_MODES,
  });
}));

r.post("/leads/:id/fees", require_("leads", "edit"), guardLead, asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const amount = Number(b.amount);
  if (!str(b.title, 120)) throw new ApiError(400, "Say what the fee is for");
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "Enter an amount greater than zero");
  const fee = await LeadFee.create({
    tenant: req.tenantId, lead: req.params.id, title: str(b.title, 120), amount: Math.round(amount * 100) / 100,
    dueDate: isDateKey(b.dueDate) ? localDateTime(b.dueDate, "23:59") : null, note: str(b.note, 500), token: newToken(), by: req.auth?.name || "System",
  });
  await logActivity({ tenant: req.tenantId, lead: req.params.id, type: "payment", by: req.auth?.name, title: `Fee added · ₹${fee.amount.toLocaleString("en-IN")}`, detail: fee.title });
  // already collected (cash at the desk): record the receipt in the same step
  if (b.paid) await markFeePaid(fee, { mode: FEE_MODES.includes(b.mode) ? b.mode : "Cash", reference: str(b.reference, 120), by: req.auth?.name });
  ok(res, { ...fee.toObject(), link: await payLink(req.tenantId, fee.token) }, 201);
}));

r.post("/lead-fees/:feeId/pay", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const fee = await feeFor(req);
  if (fee.status !== "pending") throw new ApiError(400, `This fee is already ${fee.status}`);
  const mode = FEE_MODES.includes(req.body?.mode) && req.body.mode !== "Online" ? req.body.mode : "Cash";
  // amount left blank = the whole balance; a smaller amount is a part payment
  const amount = req.body?.amount === undefined || req.body.amount === "" ? undefined : Number(req.body.amount);
  ok(res, await markFeePaid(fee, { amount, mode, reference: str(req.body?.reference, 120), by: req.auth?.name, paidAt: isDateKey(req.body?.paidOn) ? localDateTime(req.body.paidOn, "12:00") : undefined }));
}));

r.post("/lead-fees/:feeId/cancel", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const fee = await feeFor(req);
  if (fee.status === "paid" || (fee.paidAmount || 0) > 0) throw new ApiError(400, "Money has been received on this fee. Refund it first.");
  fee.status = "cancelled";
  await fee.save();
  await logActivity({ tenant: req.tenantId, lead: fee.lead, type: "payment", by: req.auth?.name, title: "Fee cancelled", detail: fee.title });
  ok(res, fee);
}));

/* ───────────── click-to-call ───────────── */

r.post("/leads/:id/call", require_("leads", "edit"), guardLead, asyncHandler(async (req: any, res: any) => {
  const [lead, me] = await Promise.all([
    Lead.findOne({ _id: req.params.id, tenant: req.tenantId }),
    User.findById(req.auth.uid).select("mobile name").lean(),
  ]);
  if (!lead) throw new ApiError(404, "Lead not found");
  const call = await placeCall(req.tenantId, { agentNumber: (me as any)?.mobile || "", leadNumber: lead.phone, leadId: String(lead._id), user: req.auth?.name || "", callbackBase: publicBase(req) });
  await logActivity({ tenant: req.tenantId, lead: lead._id, type: "call", by: req.auth?.name, title: "Outgoing call · dialling", meta: { callId: call.callId, direction: "outgoing", pending: true } });
  ok(res, call);
}));

/* ───────────── targets and leaderboard ───────────── */

const MONTH = /^\d{4}-\d{2}$/;

r.get("/crm/targets", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const tenant = new Types.ObjectId(String(req.tenantId));
  const month = MONTH.test(str(req.query.month)) ? str(req.query.month) : localDateKey().slice(0, 7);
  const from = localDateTime(`${month}-01`);
  const [y, m] = month.split("-").map(Number);
  const to = new Date(localDateTime(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`).getTime() - 1);
  const range = { $gte: from, $lte: to };
  const wonIds = (await LeadStatus.find({ tenant, isWon: true }).select("_id").lean()).map((s: any) => s._id);
  const scope = await leadOwnerScope(req);

  const [targets, owners, won, calls, fus, created] = await Promise.all([
    LeadTarget.find({ tenant, month }).lean(),
    assignableOwners(tenant),
    Lead.aggregate([{ $match: { tenant, status: { $in: wonIds }, statusChangedAt: range } }, { $group: { _id: "$owner", n: { $sum: 1 }, value: { $sum: "$value" } } }]),
    LeadActivity.aggregate([{ $match: { tenant, type: "call", at: range } }, { $group: { _id: "$by", n: { $sum: 1 } } }]),
    FollowUp.aggregate([{ $match: { tenant, done: true, completedAt: range } }, { $group: { _id: "$owner", n: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: { tenant, createdAt: range } }, { $group: { _id: "$owner", n: { $sum: 1 } } }]),
  ]);
  const pick = (list: any[], owner: string, key = "n") => list.find((x) => x._id === owner)?.[key] || 0;
  const rows = owners
    .filter((o) => !scope || scope.includes(o))
    .map((owner) => {
      const t: any = targets.find((x) => x.owner === owner) || {};
      const achieved = { wins: pick(won, owner), value: pick(won, owner, "value"), calls: pick(calls, owner), followUps: pick(fus, owner), leads: pick(created, owner) };
      const target = { wins: t.wins || 0, value: t.value || 0, calls: t.calls || 0, followUps: t.followUps || 0 };
      // overall progress: the average of the measures that have a target
      const parts = (["wins", "value", "calls", "followUps"] as const).filter((k) => target[k] > 0).map((k) => Math.min(1.5, achieved[k] / target[k]));
      return { owner, target, achieved, progress: parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : null };
    })
    .sort((a, b) => b.achieved.wins - a.achieved.wins || b.achieved.value - a.achieved.value || b.achieved.calls - a.achieved.calls);
  ok(res, { month, rows });
}));

r.put("/crm/targets", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const month = str(req.body?.month);
  if (!MONTH.test(month)) throw new ApiError(400, "Choose a month");
  const owners = await assignableOwners(req.tenantId);
  const rows = (Array.isArray(req.body?.rows) ? req.body.rows : []).filter((x: any) => owners.includes(x?.owner));
  for (const x of rows) {
    await LeadTarget.updateOne(
      { tenant: req.tenantId, month, owner: x.owner },
      { $set: { wins: num(x.wins, 0, 1e6, 0), value: num(x.value, 0, 1e12, 0), calls: num(x.calls, 0, 1e6, 0), followUps: num(x.followUps, 0, 1e6, 0) } },
      { upsert: true }
    );
  }
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Targets", entity: month, next: `${rows.length} counsellor(s)` });
  ok(res, { saved: rows.length });
}));

/* ───────────── API keys for pushing leads in from other systems ───────────── */

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

r.get("/crm/api-keys", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  ok(res, await LeadApiKey.find({ tenant: req.tenantId }).select("-keyHash").populate("source", "name").sort({ createdAt: -1 }).lean());
}));

r.post("/crm/api-keys", require_("setup", "create"), asyncHandler(async (req: any, res: any) => {
  const name = str(req.body?.name, 80);
  if (!name) throw new ApiError(400, "Name the key after where the leads come from");
  const source = Types.ObjectId.isValid(str(req.body?.source)) ? await LeadSource.findOne({ _id: req.body.source, tenant: req.tenantId }) : null;
  const key = `lk_${randomBytes(24).toString("base64url")}`;
  const doc = await LeadApiKey.create({ tenant: req.tenantId, name, keyHash: hashKey(key), hint: key.slice(-4), source: source?._id || null, owner: str(req.body?.owner, 120) });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Lead capture keys", entity: name });
  // the key itself is shown once, now; only its hash is kept
  ok(res, { _id: doc._id, name, hint: doc.hint, key, url: `${publicBase(req)}/webhooks/leads/${key}` }, 201);
}));

r.patch("/crm/api-keys/:id", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const set: any = {};
  if (req.body?.active !== undefined) set.active = !!req.body.active;
  if (req.body?.name !== undefined && str(req.body.name, 80)) set.name = str(req.body.name, 80);
  if (req.body?.owner !== undefined) set.owner = str(req.body.owner, 120);
  const doc = await LeadApiKey.findOneAndUpdate({ _id: req.params.id, tenant: req.tenantId }, { $set: set }, { new: true }).select("-keyHash");
  if (!doc) throw new ApiError(404, "Key not found");
  ok(res, doc);
}));

r.delete("/crm/api-keys/:id", require_("setup", "del"), asyncHandler(async (req: any, res: any) => {
  const doc = await LeadApiKey.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
  if (!doc) throw new ApiError(404, "Key not found");
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Lead capture keys", entity: doc.name });
  ok(res, { deleted: true });
}));

/* ───────────── applications (registrations moving through admission) ───────────── */

r.get("/crm/applications", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const tenant = new Types.ObjectId(String(req.tenantId));
  const s = await crmSettingsFor(tenant);
  const filter: any = { tenant };
  // only applications of leads this user may see
  const scope = await leadOwnerScope(req);
  if (scope) filter.lead = { $in: (await Lead.find(await scopeLeadFilter(req, { tenant })).select("_id").lean()).map((l: any) => l._id) };
  const counts = await Registration.aggregate([{ $match: filter }, { $group: { _id: "$stage", n: { $sum: 1 } } }]);
  if (str(req.query.stage)) filter.stage = str(req.query.stage);
  if (str(req.query.q)) {
    const rx = new RegExp(str(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { phone: rx }, { appNo: rx }, { course: rx }];
  }
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const perPage = 50;
  const [items, total] = await Promise.all([
    Registration.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).populate("lead", "name owner priority").lean(),
    Registration.countDocuments(filter),
  ]);
  const base = await appUrl(tenant);
  ok(res, {
    stages: s.applicationStages?.length ? s.applicationStages : DEFAULT_APPLICATION_STAGES,
    counts: Object.fromEntries(counts.map((c: any) => [c._id || "Submitted", c.n])),
    items: items.map((a: any) => ({ ...a, stage: a.stage || "Submitted", link: a.token ? `${base}/application/${a.token}` : "" })),
    total, page, pages: Math.max(1, Math.ceil(total / perPage)),
  });
}));

const applicationFor = async (req: any) => {
  const app = Types.ObjectId.isValid(req.params.id) ? await Registration.findOne({ _id: req.params.id, tenant: req.tenantId }) : null;
  if (!app || (app.lead && !(await canSeeLead(req, app.lead)))) throw new ApiError(404, "Application not found");
  // applications saved before tracking existed get their number and link on first use
  if (!app.token) app.token = newToken();
  if (!app.appNo) app.appNo = `APP-${String(app._id).slice(-6).toUpperCase()}`;
  return app;
};

r.patch("/crm/applications/:id", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const app = await applicationFor(req);
  const s = await crmSettingsFor(req.tenantId);
  const stage = str(req.body?.stage, 60);
  if (!s.applicationStages.includes(stage)) throw new ApiError(400, "Choose one of the application stages");
  const from = app.stage || "Submitted";
  app.stage = stage;
  app.stageHistory.push({ stage, by: req.auth?.name || "System", at: new Date(), note: str(req.body?.note, 300) });
  await app.save();
  if (app.lead) {
    await logActivity({ tenant: req.tenantId, lead: app.lead, type: "registration", by: req.auth?.name, title: `Application: ${from} → ${stage}`, detail: str(req.body?.note, 300) });
    // enrolling an applicant wins the lead
    if (/^enrol/i.test(stage)) {
      const won: any = await LeadStatus.findOne({ tenant: req.tenantId, isWon: true }).sort({ order: -1 }).lean();
      const lead: any = await Lead.findById(app.lead).select("status").populate("status", "isWon").lean();
      // a lead that is already won keeps the won status it has
      if (won && lead && !lead.status?.isWon) await changeLeadStatus({ tenant: req.tenantId, leadId: String(app.lead), statusId: String(won._id), user: req.auth?.name });
    } else {
      await refreshLead(app.lead);
    }
  }
  ok(res, app);
}));

r.post("/crm/applications/:id/offer", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const app = await applicationFor(req);
  const b = req.body || {};
  if (!str(b.text, 4000)) throw new ApiError(400, "Write the offer");
  const amount = Math.max(0, Number(b.amount) || 0);
  app.offer = { text: str(b.text, 4000), amount, validTill: isDateKey(b.validTill) ? localDateTime(b.validTill, "23:59") : null, sentAt: new Date(), respondedAt: null, response: "" };
  app.markModified("offer");
  app.stage = "Offer made";
  app.stageHistory.push({ stage: "Offer made", by: req.auth?.name || "System", at: new Date() });
  await app.save();
  // the amount to confirm the seat becomes a fee the applicant can pay from their link
  if (amount > 0 && app.lead) {
    await LeadFee.create({ tenant: req.tenantId, lead: app.lead, title: `Admission fee · ${app.appNo}`, amount, dueDate: app.offer.validTill, token: newToken(), by: req.auth?.name || "System" });
  }
  if (app.lead) await logActivity({ tenant: req.tenantId, lead: app.lead, type: "registration", by: req.auth?.name, title: "Offer made", detail: amount ? `₹${amount.toLocaleString("en-IN")} to confirm` : "" });
  ok(res, { ...app.toObject(), link: `${await appUrl(req.tenantId)}/application/${app.token}` });
}));

export default r;
