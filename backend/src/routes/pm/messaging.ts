import { Router } from "express";
import { Types } from "mongoose";
import { ok, asyncHandler, ApiError, audit, paginated } from "../../utils/http";
import { PmMessage, PmNotification, PmNotifyPref, NOTIFY_CATEGORIES } from "../../models/pm/Message";
import { kick, mailSettings, sendPending } from "../../services/pm/messages";
import { anyRight, pmRight } from "../../services/pm/visibility";
import { visibleProjectFilter } from "../../services/pm/projects";
import { PmProject } from "../../models/pm/Project";
import { decryptSecret, encryptSecret, maskSecret } from "../../services/payments/crypto";
import { sendEmail } from "../../services/email";
import { activeVendor, normalizePhone, sendText } from "../../services/whatsapp";

/** Email & WhatsApp settings, the message log, and in-app notifications. */
const r = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const rx = (q: any) => new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

/* ───────────── settings ───────────── */
const present = async (s: any, tenantId: any) => ({
  smtpHost: s.smtpHost, smtpPort: s.smtpPort, smtpSecure: s.smtpSecure, smtpUser: s.smtpUser,
  // the password never leaves the server
  smtpPassSet: !!s.smtpPass, smtpPassMasked: s.smtpPass ? maskSecret(decryptSecret(s.smtpPass)) : "",
  fromName: s.fromName, fromEmail: s.fromEmail, appUrl: s.appUrl,
  testMode: s.testMode, testEmail: s.testEmail, testNumber: s.testNumber,
  emailEnabled: s.emailEnabled, whatsappEnabled: s.whatsappEnabled,
  digestHour: s.digestHour, planReminderHour: s.planReminderHour, verificationReminderDays: s.verificationReminderDays, verificationLinkDays: s.verificationLinkDays,
  whatsappVendor: await activeVendor(String(tenantId)).catch(() => "simulation"),
});

r.get(
  "/mail-settings",
  pmRight("setup", "view"),
  asyncHandler(async (req: any, res: any) => {
    ok(res, await present(await mailSettings(req.tenantId), req.tenantId));
  })
);

r.put(
  "/mail-settings",
  pmRight("setup", "configure"),
  asyncHandler(async (req: any, res: any) => {
    const b = req.body || {};
    const s: any = await mailSettings(req.tenantId);
    const str = (k: string) => { if (b[k] !== undefined) s[k] = String(b[k] || "").trim(); };
    ["smtpHost", "smtpUser", "fromName", "fromEmail", "testNumber"].forEach(str);
    if (b.appUrl !== undefined) {
      const url = String(b.appUrl || "").trim().replace(/\/+$/, "");
      if (url && !/^https?:\/\//.test(url)) throw new ApiError(400, "The app address must start with http:// or https://");
      s.appUrl = url;
    }
    if (b.testEmail !== undefined) {
      const e = String(b.testEmail || "").trim();
      if (e && !EMAIL.test(e)) throw new ApiError(400, "Enter a valid test email");
      s.testEmail = e;
    }
    if (b.fromEmail && !EMAIL.test(s.fromEmail)) throw new ApiError(400, "Enter a valid from email");
    if (b.smtpPort !== undefined) s.smtpPort = Math.min(65535, Math.max(1, Number(b.smtpPort) || 587));
    if (b.smtpPass) s.smtpPass = encryptSecret(String(b.smtpPass));
    for (const k of ["smtpSecure", "testMode", "emailEnabled", "whatsappEnabled"]) if (b[k] !== undefined) s[k] = !!b[k];
    for (const k of ["digestHour", "planReminderHour"]) if (b[k] !== undefined) s[k] = Math.min(23, Math.max(-1, Number.isFinite(Number(b[k])) ? Number(b[k]) : -1));
    if (b.verificationReminderDays !== undefined) s.verificationReminderDays = Math.min(30, Math.max(0, Number(b.verificationReminderDays) || 0));
    if (b.verificationLinkDays !== undefined) s.verificationLinkDays = Math.min(60, Math.max(1, Number(b.verificationLinkDays) || 7));
    await s.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Project Management", entity: "Email & WhatsApp settings" });
    ok(res, await present(s, req.tenantId));
  })
);

r.post(
  "/mail-settings/test-email",
  pmRight("setup", "configure"),
  asyncHandler(async (req: any, res: any) => {
    const to = String(req.body?.to || "").trim();
    if (!EMAIL.test(to)) throw new ApiError(400, "Enter a valid email address");
    const s = await mailSettings(req.tenantId);
    if (!s.smtpHost) throw new ApiError(400, "Save the SMTP settings first");
    const from = s.fromEmail ? (s.fromName ? `"${s.fromName.replace(/"/g, "")}" <${s.fromEmail}>` : s.fromEmail) : undefined;
    try {
      await sendEmail({ to, subject: "Test email", html: "<p>This is a test email from Project Management. Your email settings work.</p>", text: "This is a test email from Project Management. Your email settings work.", from, smtp: { host: s.smtpHost, port: s.smtpPort, secure: s.smtpSecure, user: s.smtpUser, pass: decryptSecret(s.smtpPass) } });
    } catch (e: any) {
      throw new ApiError(400, `The mail server refused: ${String(e?.message || e).slice(0, 200)}`);
    }
    ok(res, { sent: true });
  })
);

r.post(
  "/mail-settings/test-whatsapp",
  pmRight("setup", "configure"),
  asyncHandler(async (req: any, res: any) => {
    const to = normalizePhone(String(req.body?.to || ""));
    if (to.replace(/\D/g, "").length < 10) throw new ApiError(400, "Enter the WhatsApp number with country code");
    try {
      const out: any = await sendText(String(req.tenantId), to, "This is a test message from Project Management.");
      ok(res, { sent: !out?.simulated, simulated: !!out?.simulated });
    } catch (e: any) {
      throw new ApiError(400, `WhatsApp refused: ${String(e?.message || e).slice(0, 200)}`);
    }
  })
);

/* ───────────── message log ───────────── */
const canLog = anyRight(["pm_notification_rules", "view"], ["pm_reports", "view"], ["pm_setup", "view"]);

r.get(
  "/messages",
  anyRight(["pm_notification_rules", "view"], ["pm_reports", "view"], ["pm_setup", "view"], ["pm_projects", "view"], ["pm_tasks", "view"], ["pm_my_tasks", "view"]),
  asyncHandler(async (req: any, res: any) => {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(String(req.query.perPage || "50"), 10) || 50));
    const q = req.query;
    const filter: any = { tenant: req.tenantId };
    const full = ["pm_notification_rules", "pm_reports", "pm_setup"].some((m) => (req.perms || []).find((p: any) => p.module === m)?.view);
    // without the log right, only the messages of one task / project the user may see
    if (!full) {
      if (!q.task && !q.project) throw new ApiError(403, "Forbidden");
      if (q.project && !(await PmProject.exists({ _id: q.project, tenant: req.tenantId, ...(await visibleProjectFilter(req)) }))) throw new ApiError(404, "Project not found");
    }
    for (const k of ["project", "task", "client"]) if (q[k] && Types.ObjectId.isValid(String(q[k]))) filter[k] = q[k];
    if (q.channel === "email" || q.channel === "whatsapp") filter.channel = q.channel;
    if (["Pending", "Sent", "Failed", "Skipped"].includes(String(q.status))) filter.status = q.status;
    const range: any = {};
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(q.from))) range.$gte = new Date(`${q.from}T00:00:00+05:30`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(q.to))) range.$lt = new Date(new Date(`${q.to}T00:00:00+05:30`).getTime() + 86_400_000);
    if (Object.keys(range).length) filter.createdAt = range;
    if (q.q) filter.$or = [{ to: rx(q.q) }, { toName: rx(q.q) }, { subject: rx(q.q) }, { templateName: rx(q.q) }];
    const [items, total] = await Promise.all([
      PmMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).select("-attachments -waParams").populate("project", "name code").populate("client", "name").populate("task", "title number").lean(),
      PmMessage.countDocuments(filter),
    ]);
    paginated(res, items, total, page, perPage);
  })
);

r.post(
  "/messages/:id/resend",
  canLog,
  asyncHandler(async (req: any, res: any) => {
    const m = await PmMessage.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!m) throw new ApiError(404, "Message not found");
    if (m.status === "Pending" || m.status === "Sending") throw new ApiError(400, "This message is already waiting to be sent");
    m.status = "Pending";
    m.attempts = 0;
    m.error = "";
    m.scheduledAt = new Date();
    await m.save();
    kick();
    ok(res, { queued: true });
  })
);

r.post(
  "/messages/send-now",
  canLog,
  asyncHandler(async (_req: any, res: any) => {
    await sendPending();
    ok(res, { done: true });
  })
);

/* ───────────── notifications (always the signed-in user's own) ───────────── */
r.get(
  "/notifications",
  asyncHandler(async (req: any, res: any) => {
    const limit = Math.min(100, parseInt(String(req.query.limit || "20"), 10) || 20);
    const filter: any = { tenant: req.tenantId, user: req.auth.uid };
    if (req.query.unread === "1") filter.read = false;
    const [items, unread] = await Promise.all([
      PmNotification.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
      PmNotification.countDocuments({ tenant: req.tenantId, user: req.auth.uid, read: false }),
    ]);
    ok(res, { items, unread });
  })
);

r.post(
  "/notifications/read-all",
  asyncHandler(async (req: any, res: any) => {
    await PmNotification.updateMany({ tenant: req.tenantId, user: req.auth.uid, read: false }, { $set: { read: true } });
    ok(res, { unread: 0 });
  })
);

r.post(
  "/notifications/:id/read",
  asyncHandler(async (req: any, res: any) => {
    await PmNotification.updateOne({ _id: req.params.id, tenant: req.tenantId, user: req.auth.uid }, { $set: { read: true } });
    ok(res, { read: true });
  })
);

r.get(
  "/notify-prefs",
  asyncHandler(async (req: any, res: any) => {
    const p = await PmNotifyPref.findOne({ tenant: req.tenantId, user: req.auth.uid }).lean();
    ok(res, { categories: NOTIFY_CATEGORIES, prefs: p?.prefs || {}, digest: p?.digest !== false });
  })
);

r.put(
  "/notify-prefs",
  asyncHandler(async (req: any, res: any) => {
    const prefs: any = {};
    for (const c of NOTIFY_CATEGORIES) {
      const x = req.body?.prefs?.[c.key];
      if (x) prefs[c.key] = { inApp: x.inApp !== false, email: !!x.email, whatsapp: !!x.whatsapp };
    }
    await PmNotifyPref.findOneAndUpdate({ tenant: req.tenantId, user: req.auth.uid }, { $set: { prefs, digest: req.body?.digest !== false } }, { upsert: true, setDefaultsOnInsert: true });
    ok(res, { saved: true });
  })
);

export default r;
