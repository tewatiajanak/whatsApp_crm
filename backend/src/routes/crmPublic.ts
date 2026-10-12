import { Router } from "express";
import { ok, asyncHandler, ApiError } from "../utils/http";
import { Lead } from "../models/Lead";
import { Registration } from "../models/Registration";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { randomBytes, randomInt, createHash } from "crypto";
import rateLimit from "express-rate-limit";
import { config } from "../config";
import { ApplicantOtp } from "../models/CrmMore";
import { phoneKeyOf } from "../models/Lead";
import { sendSms, smsReady } from "../services/crmChannels";
import { sendText } from "../services/whatsapp";
import { sendEmail } from "../services/email";
import { LeadFee, LeadDocument, crmSettingsFor, DEFAULT_APPLICATION_STAGES, feeBalance } from "../models/CrmExtras";
import { Partner } from "../models/CrmMore";
import { User } from "../models/User";
import { FollowUp } from "../models/FollowUp";
import { LeadStatus } from "../models/Masters";
import { convertToLead, findLeadByPhone, refreshLead } from "../services/leadService";
import { notify } from "../services/pm/messages";
import { localDateTime, localDateKey, isDateKey, tzOffsetMin } from "../utils/dates";
import { OrganizationDetails } from "../models/OrganizationDetails";
import { PaymentGateway } from "../models/Payment";
import { initiatePayment, publicBase } from "../services/payments";
import { appUrl } from "../services/pm/messages";
import { logActivity } from "../services/leadService";

/**
 * Lead CRM pages opened from a link, without a login. The token in the link is
 * the only key, so each reply carries just what that one person needs to see.
 */
const r = Router();

const orgName = async (tenant: any) => ((await OrganizationDetails.findOne({ tenant }).select("name").lean()) as any)?.name || "";

const feeView = (f: any) => ({
  token: f.token, title: f.title, amount: f.amount, discount: f.discount || 0, paid: f.paidAmount || 0, balance: f.status === "cancelled" ? 0 : feeBalance(f),
  status: f.status, dueDate: f.dueDate, receiptNo: f.receiptNo, invoiceNo: f.invoiceNo, paidAt: f.paidAt, mode: f.mode,
  payments: (f.payments || []).map((p: any) => ({ amount: p.amount, mode: p.mode, receiptNo: p.receiptNo, at: p.at })),
});

r.get("/public/pay/:token", asyncHandler(async (req, res) => {
  const fee = await LeadFee.findOne({ token: req.params.token }).lean();
  if (!fee) throw new ApiError(404, "This payment link is not valid");
  const [lead, org, gateway] = await Promise.all([
    Lead.findById(fee.lead).select("name").lean(),
    orgName(fee.tenant),
    PaymentGateway.exists({ tenant: fee.tenant, isActive: true }),
  ]);
  const s = await crmSettingsFor(fee.tenant);
  // tax shown on the invoice: the fee amount is taken as GST-inclusive
  const net = fee.amount - (fee.discount || 0);
  const gst = s.billing.gstPercent > 0 ? Math.round((net - net / (1 + s.billing.gstPercent / 100)) * 100) / 100 : 0;
  ok(res, {
    ...feeView(fee), name: (lead as any)?.name || "", organisation: s.billing.legalName || org, canPayOnline: !!gateway,
    billing: { address: s.billing.address, gstin: s.billing.gstin, gstPercent: s.billing.gstPercent, taxable: Math.round((net - gst) * 100) / 100, gst },
  });
}));

r.post("/public/pay/:token/start", asyncHandler(async (req, res) => {
  const fee = await LeadFee.findOne({ token: req.params.token });
  if (!fee) throw new ApiError(404, "This payment link is not valid");
  if (fee.status !== "pending") throw new ApiError(400, fee.status === "paid" ? "This fee is already paid" : "This fee was cancelled");
  const lead: any = await Lead.findById(fee.lead).select("name email phone").lean();
  const started = await initiatePayment(String(fee.tenant), publicBase(req), {
    amount: feeBalance(fee),
    purpose: fee.title,
    customer: { name: lead?.name, email: lead?.email, phone: lead?.phone },
    reference: { module: "crm_fee", id: String(fee._id) },
    returnUrl: `${await appUrl(fee.tenant)}/pay/${fee.token}`,
  });
  ok(res, { action: started.action });
}));

const findApplication = async (token: string) => {
  const app = token ? await Registration.findOne({ token }) : null;
  if (!app) throw new ApiError(404, "This application link is not valid");
  return app;
};

r.get("/public/application/:token", asyncHandler(async (req, res) => {
  const app = await findApplication(req.params.token);
  const [s, org, fees] = await Promise.all([
    crmSettingsFor(app.tenant),
    orgName(app.tenant),
    app.lead ? LeadFee.find({ tenant: app.tenant, lead: app.lead, status: { $ne: "cancelled" } }).sort({ createdAt: 1 }).lean() : Promise.resolve([]),
  ]);
  const offer: any = app.offer || {};
  ok(res, {
    appNo: app.appNo, name: app.name, course: app.course, stage: app.stage || "Submitted",
    stages: s.applicationStages?.length ? s.applicationStages : DEFAULT_APPLICATION_STAGES,
    history: (app.stageHistory || []).map((h) => ({ stage: h.stage, at: h.at })),
    offer: offer.text ? { text: offer.text, amount: offer.amount, validTill: offer.validTill, sentAt: offer.sentAt, response: offer.response || "", signedBy: offer.signedBy || "", respondedAt: offer.respondedAt } : null,
    documents: app.lead ? (await LeadDocument.find({ tenant: app.tenant, lead: app.lead, by: "Applicant" }).sort({ createdAt: -1 }).select("name category createdAt").lean()) : [],
    canUpload: !!app.lead,
    fees: fees.map(feeView),
    organisation: org,
    submittedAt: (app as any).createdAt,
  });
}));

r.post("/public/application/:token/offer", asyncHandler(async (req, res) => {
  const app = await findApplication(req.params.token);
  const offer: any = app.offer || {};
  if (!offer.text) throw new ApiError(400, "There is no offer to reply to");
  if (offer.response) throw new ApiError(400, "You have already replied to this offer");
  if (offer.validTill && new Date(offer.validTill).getTime() < Date.now()) throw new ApiError(400, "This offer has expired. Please contact the admissions office.");
  const accept = req.body?.response === "accept";
  const signedBy = typeof req.body?.signedBy === "string" ? req.body.signedBy.trim().slice(0, 120) : "";
  if (accept && signedBy.length < 3) throw new ApiError(400, "Type your full name to accept the offer");
  app.offer = { ...offer, response: accept ? "accepted" : "declined", respondedAt: new Date(), signedBy, signedIp: req.ip };
  app.markModified("offer");
  app.stage = accept ? "Offer accepted" : "Rejected";
  app.stageHistory.push({ stage: app.stage, by: "Applicant", at: new Date(), note: accept ? "" : "Offer declined" });
  await app.save();
  if (app.lead) await logActivity({ tenant: app.tenant, lead: app.lead, type: "registration", by: "Applicant", title: accept ? "Offer accepted" : "Offer declined" });
  ok(res, { stage: app.stage });
}));

/* ───────────── the applicant sends their own documents ───────────── */

const applicantUpload = multer({ dest: path.join(os.tmpdir(), "whatsapp_crm_uploads"), limits: { fileSize: 8 * 1024 * 1024 } });
const APPLICANT_TYPES = /^(application\/pdf|image\/(jpeg|png|webp))$/;

r.post("/public/application/:token/documents", applicantUpload.single("file"), asyncHandler(async (req: any, res: any) => {
  const drop = () => (req.file ? fs.promises.unlink(req.file.path).catch(() => undefined) : Promise.resolve());
  try {
    const app = await findApplication(req.params.token);
    if (!app.lead) throw new ApiError(400, "Documents cannot be added to this application");
    if (!req.file) throw new ApiError(400, "Choose a file");
    if (!APPLICANT_TYPES.test(String(req.file.mimetype || ""))) throw new ApiError(400, "Only PDF, JPG and PNG files are accepted");
    if ((await LeadDocument.countDocuments({ tenant: app.tenant, lead: app.lead, by: "Applicant" })) >= 15) throw new ApiError(400, "You have reached the limit of 15 documents");
    const ext = (path.extname(req.file.originalname || "") || "").toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 8);
    const file = `${Date.now()}_${randomBytes(6).toString("hex")}${ext}`;
    const dir = path.join(process.cwd(), "uploads", "lead-docs", String(app.tenant));
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.copyFile(req.file.path, path.join(dir, file));
    const category = typeof req.body?.category === "string" ? req.body.category.trim().slice(0, 80) : "";
    const doc = await LeadDocument.create({ tenant: app.tenant, lead: app.lead, name: String(req.file.originalname || "Document").slice(0, 200), category, file, mime: req.file.mimetype, size: req.file.size, by: "Applicant" });
    await logActivity({ tenant: app.tenant, lead: app.lead, type: "document", by: "Applicant", title: "Document sent by the applicant", detail: `${category ? `${category} · ` : ""}${doc.name}` });
    ok(res, { name: doc.name, category: doc.category, createdAt: (doc as any).createdAt }, 201);
  } finally {
    await drop();
  }
}));

/* ───────────── referral partner: their leads and what they have earned ───────────── */

r.get("/public/partner/:token", asyncHandler(async (req, res) => {
  const p = await Partner.findOne({ token: req.params.token, active: true }).lean();
  if (!p) throw new ApiError(404, "This link is not valid");
  const [leads, statuses, org] = await Promise.all([
    Lead.find({ tenant: p.tenant, partner: p._id }).sort({ createdAt: -1 }).limit(500).select("name status createdAt").lean(),
    LeadStatus.find({ tenant: p.tenant }).select("name isWon isLost").lean(),
    orgName(p.tenant),
  ]);
  const st = new Map(statuses.map((s: any) => [String(s._id), s]));
  const paid = await LeadFee.aggregate([{ $match: { tenant: p.tenant, lead: { $in: leads.map((l: any) => l._id) } } }, { $group: { _id: null, paid: { $sum: "$paidAmount" } } }]);
  const won = leads.filter((l: any) => (st.get(String(l.status)) as any)?.isWon).length;
  const earned = p.commissionType === "percent_paid" ? Math.round((paid[0]?.paid || 0) * (p.rate || 0)) / 100 : won * (p.rate || 0);
  ok(res, {
    name: p.name, code: p.code, organisation: org, leads: leads.length, won, earned, paidOut: p.paidOut || 0, due: Math.max(0, earned - (p.paidOut || 0)),
    // the partner sees how each referral is doing, never the person's contact details
    list: leads.map((l: any) => { const s: any = st.get(String(l.status)); return { name: l.name, status: s?.name || "", won: !!s?.isWon, lost: !!s?.isLost, at: l.createdAt }; }),
  });
}));

/* ───────────── book a call or visit with a counsellor ───────────── */

const bookingFor = async (token: string) => {
  const user: any = token ? await User.findOne({ crmToken: token, status: "Active" }).select("name tenant crmAway").lean() : null;
  if (!user) throw new ApiError(404, "This booking link is not valid");
  const s = await crmSettingsFor(user.tenant);
  if (!s.booking?.enabled) throw new ApiError(403, "Online booking is switched off");
  return { user, s };
};

/** Free slots for the next 10 days: inside working hours, in the future, with nothing else due at that time. */
async function freeSlots(user: any, s: any) {
  const b = s.booking;
  const now = Date.now();
  const horizon = now + 10 * 86_400_000;
  const taken = new Set((await FollowUp.find({ tenant: user.tenant, owner: user.name, done: false, due: { $gte: new Date(now), $lte: new Date(horizon) } }).select("due").lean()).map((f: any) => Math.floor(new Date(f.due).getTime() / (b.slotMinutes * 60_000))));
  const days: Array<{ date: string; times: string[] }> = [];
  for (let d = 0; d < 10; d++) {
    const date = localDateKey(now + d * 86_400_000);
    const weekday = new Date(localDateTime(date, "12:00").getTime() + tzOffsetMin * 60_000).getUTCDay();
    if (!b.days.includes(weekday)) continue;
    const times: string[] = [];
    for (let m = b.startHour * 60; m + b.slotMinutes <= b.endHour * 60; m += b.slotMinutes) {
      const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const at = localDateTime(date, time).getTime();
      if (at < now + 60 * 60_000) continue; // at least an hour's notice
      if (!taken.has(Math.floor(at / (b.slotMinutes * 60_000)))) times.push(time);
    }
    if (times.length) days.push({ date, times });
  }
  return days;
}

r.get("/public/book/:token", asyncHandler(async (req, res) => {
  const { user, s } = await bookingFor(req.params.token);
  ok(res, { counsellor: user.name, organisation: await orgName(user.tenant), slotMinutes: s.booking.slotMinutes, away: !!user.crmAway, days: user.crmAway ? [] : await freeSlots(user, s) });
}));

r.post("/public/book/:token", asyncHandler(async (req, res) => {
  const { user, s } = await bookingFor(req.params.token);
  const b: any = req.body || {};
  if (!isDateKey(b.date) || !/^\d{2}:\d{2}$/.test(String(b.time || ""))) throw new ApiError(400, "Choose a time");
  const days = await freeSlots(user, s);
  if (!days.find((d) => d.date === String(b.date).slice(0, 10))?.times.includes(b.time)) throw new ApiError(409, "That time was just taken. Please choose another.");
  const due = localDateTime(b.date, b.time);
  const existing = await findLeadByPhone(user.tenant, b.phone);
  const lead = existing || (await convertToLead({ tenant: user.tenant, name: b.name, phone: b.phone, email: b.email, owner: user.name, capturedFrom: "Booking link", sourceKeyOrId: "Website", skipFollowUp: true, user: "Booking link" })).lead;
  const kind = b.kind === "Visit" ? "Visit" : b.kind === "Meeting" ? "Meeting" : "Call";
  await FollowUp.create({
    tenant: user.tenant, lead: lead._id, leadName: lead.name, phone: lead.phone, due, dueDate: due, dueTime: b.time, type: kind,
    note: `Booked online${typeof b.note === "string" && b.note.trim() ? `: ${b.note.trim().slice(0, 300)}` : ""}`, owner: user.name, assignedTo: user.name, status: lead.status,
  });
  await logActivity({ tenant: user.tenant, lead: lead._id, type: "followup_scheduled", by: "Booking link", title: `${kind} booked online`, detail: `${String(b.date).slice(0, 10).split("-").reverse().join("-")} ${b.time} with ${user.name}` });
  await refreshLead(lead._id);
  await notify({ tenantId: user.tenant, users: [user._id], category: "crm_followup", title: `${lead.name} booked a ${kind.toLowerCase()}`, body: `${String(b.date).slice(0, 10).split("-").reverse().join("-")} at ${b.time}`, link: `/crm/leads?lead=${lead._id}` });
  ok(res, { booked: true, date: String(b.date).slice(0, 10), time: b.time, counsellor: user.name });
}));

/* ───────────── applicant sign-in: phone + one-time code ───────────── */

const otpHash = (code: string, phoneKey: string) => createHash("sha256").update(`${code}:${phoneKey}:${config.jwtSecret}`).digest("hex");
const otpLimiter = rateLimit({ windowMs: 10 * 60_000, max: 8, standardHeaders: true, legacyHeaders: false });

r.post("/public/applicant/code", otpLimiter, asyncHandler(async (req, res) => {
  const key = phoneKeyOf(req.body?.phone);
  // the same reply whether or not the number is known, so the form cannot be used to look people up
  const reply = () => ok(res, { sent: true });
  if (key.length < 10) throw new ApiError(400, "Enter your 10-digit mobile number");
  const app: any = await Registration.findOne({ phone: new RegExp(`${key}$`) }).sort({ createdAt: -1 }).select("tenant phone lead").lean();
  if (!app) return reply();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await ApplicantOtp.deleteMany({ tenant: app.tenant, phoneKey: key });
  await ApplicantOtp.create({ tenant: app.tenant, phoneKey: key, hash: otpHash(code, key), expires: new Date(Date.now() + 10 * 60_000) });
  const text = `${code} is your code to view your application. It is valid for 10 minutes.`;
  const s = await crmSettingsFor(app.tenant);
  // SMS when a gateway is set up, else WhatsApp, else the email on the lead
  try {
    if (smsReady(s)) await sendSms(app.tenant, app.phone, text);
    else await sendText(String(app.tenant), app.phone, text);
  } catch {
    const lead: any = app.lead ? await Lead.findById(app.lead).select("email").lean() : null;
    if (lead?.email) await sendEmail({ to: lead.email, subject: "Your application code", text }).catch(() => undefined);
  }
  reply();
}));

r.post("/public/applicant/verify", otpLimiter, asyncHandler(async (req, res) => {
  const key = phoneKeyOf(req.body?.phone);
  const otp = await ApplicantOtp.findOne({ phoneKey: key, expires: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!otp) throw new ApiError(401, "The code has expired. Ask for a new one.");
  if (otp.attempts >= 5) throw new ApiError(429, "Too many wrong codes. Ask for a new one.");
  if (otpHash(String(req.body?.code || "").trim(), key) !== otp.hash) {
    otp.attempts += 1;
    await otp.save();
    throw new ApiError(401, "That code is not correct");
  }
  await otp.deleteOne();
  const apps = await Registration.find({ tenant: otp.tenant, phone: new RegExp(`${key}$`) }).sort({ createdAt: -1 }).limit(20);
  for (const a of apps) {
    // applications saved before tracking existed get their number and link now
    if (!a.token || !a.appNo) { a.token = a.token || randomBytes(18).toString("base64url"); a.appNo = a.appNo || `APP-${String(a._id).slice(-6).toUpperCase()}`; await a.save(); }
  }
  ok(res, { applications: apps.map((a) => ({ appNo: a.appNo, course: a.course, stage: a.stage || "Submitted", token: a.token, at: (a as any).createdAt })) });
}));

export default r;
