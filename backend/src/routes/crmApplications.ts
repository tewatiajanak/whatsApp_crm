import { Router } from "express";
import { Types } from "mongoose";
import { require_ } from "../middleware/auth";
import { ok, asyncHandler, ApiError, audit } from "../utils/http";
import { Lead } from "../models/Lead";
import { LeadStatus } from "../models/Masters";
import { Registration } from "../models/Registration";
import { Template } from "../models/Messaging";
import { ModuleTemplate } from "../models/ModuleSetup";
import { OrganizationDetails } from "../models/OrganizationDetails";
import { LeadFee, LeadDocument, crmSettingsFor, DEFAULT_APPLICATION_STAGES, feeBalance } from "../models/CrmExtras";
import { CrmFormSubmission } from "../models/CrmForm";
import { newToken } from "../services/leadFees";
import { logActivity, refreshLead, changeLeadStatus, escapeRegex, cleanPhone, isValidEmail, isValidPhone, blockedOn, noteLeadMessaged } from "../services/leadService";
import { canSeeLead, leadOwnerScope, scopeLeadFilter } from "../services/leadAccess";
import { sendEmail } from "../services/email";
import { sendText, sendTemplate } from "../services/whatsapp";
import { trackedHtml } from "../services/emailTracking";
import { appUrl } from "../services/pm/messages";
import { localDateTime, isDateKey } from "../utils/dates";

/** Applications: registered leads moving from "Submitted" to "Enrolled", with offers sent by email and WhatsApp. */
const r = Router();
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const money = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString("en-GB").replace(/\//g, "-") : "");
const stagesOf = async (tenant: any) => { const s = await crmSettingsFor(tenant); return s.applicationStages?.length ? s.applicationStages : DEFAULT_APPLICATION_STAGES; };

/** pending fee made for this application's offer */
const offerFeeOf = (tenant: any, app: any) => LeadFee.findOne({ tenant, lead: app.lead, title: `Admission fee · ${app.appNo}`, status: { $ne: "cancelled" } }).sort({ createdAt: -1 });

r.get("/crm/applications", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const tenant = new Types.ObjectId(String(req.tenantId));
  const q = req.query;
  const filter: any = { tenant };
  // only applications of leads this user may see; an owner filter narrows it further
  const scope = await leadOwnerScope(req);
  if (scope || str(q.owner)) {
    const lf: any = await scopeLeadFilter(req, { tenant });
    if (str(q.owner)) lf.owner = q.owner === "me" ? req.auth?.name : str(q.owner, 80);
    filter.lead = { $in: (await Lead.find(lf).select("_id").lean()).map((l: any) => l._id) };
  }
  if (str(q.course)) filter.course = str(q.course, 120);
  const from = isDateKey(q.from) ? localDateTime(q.from) : null, to = isDateKey(q.to) ? new Date(localDateTime(q.to).getTime() + 86_399_999) : null;
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
  if (str(q.q)) {
    const rx = new RegExp(escapeRegex(str(q.q, 80)), "i");
    filter.$or = [{ name: rx }, { phone: rx }, { email: rx }, { appNo: rx }, { course: rx }];
  }
  const counts = await Registration.aggregate([{ $match: filter }, { $group: { _id: "$stage", n: { $sum: 1 } } }]);
  if (str(q.stage)) filter.stage = str(q.stage, 60);
  const page = Math.max(1, parseInt(String(q.page || "1"), 10) || 1);
  const perPage = Math.min(200, Math.max(1, parseInt(String(q.perPage || "50"), 10) || 50));
  const [items, total, courses] = await Promise.all([
    Registration.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).populate("lead", "name owner priority").lean(),
    Registration.countDocuments(filter),
    Registration.distinct("course", { tenant }),
  ]);
  // fee to confirm the seat, per application
  const fees = await LeadFee.find({ tenant, title: { $in: items.map((a: any) => `Admission fee · ${a.appNo}`) }, status: { $ne: "cancelled" } }).select("title amount discount paidAmount status").lean();
  const feeBy = new Map(fees.map((f: any) => [f.title, f]));
  const base = await appUrl(tenant);
  ok(res, {
    stages: await stagesOf(tenant),
    counts: Object.fromEntries(counts.map((c: any) => [c._id || "Submitted", c.n])),
    courses: courses.filter(Boolean).sort(),
    items: items.map((a: any) => {
      const f: any = feeBy.get(`Admission fee · ${a.appNo}`);
      return { ...a, stage: a.stage || "Submitted", link: a.token ? `${base}/application/${a.token}` : "", fee: f ? { amount: f.amount - (f.discount || 0), balance: feeBalance(f), paid: f.status === "paid" } : null };
    }),
    total, page, pages: Math.max(1, Math.ceil(total / perPage)),
  });
}));

/** CRM WhatsApp and email templates (Setup → Communication Templates) for the offer screen */
r.get("/crm/applications/templates", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const [mine, meta] = await Promise.all([
    ModuleTemplate.find({ tenant: req.tenantId, module: "crm", channel: { $in: ["email", "whatsapp"] }, active: { $ne: false } }).sort({ name: 1 }).lean(),
    Template.find({ tenant: req.tenantId, channel: "whatsapp" }).select("name status language").lean(),
  ]);
  const approved = new Map(meta.filter((m: any) => /^approved$/i.test(m.status)).map((m: any) => [m.name, m.language]));
  ok(res, mine.map((t: any) => ({
    _id: t._id, channel: t.channel, name: t.name, subject: t.subject || "", body: t.body, footer: t.footer || "", sample: t.sample || "",
    vars: Math.max(0, ...[...String(`${t.subject || ""} ${t.body}`).matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]))),
    // a WhatsApp template goes out as a real template only once Meta approved one with this name
    approved: t.channel === "whatsapp" ? approved.has(t.name) : true,
  })));
}));

const applicationFor = async (req: any) => {
  const app: any = Types.ObjectId.isValid(req.params.id) ? await Registration.findOne({ _id: req.params.id, tenant: req.tenantId }) : null;
  if (!app || (app.lead && !(await canSeeLead(req, app.lead)))) throw new ApiError(404, "Application not found");
  // applications saved before tracking existed get their number and link on first use
  if (!app.token) app.token = newToken();
  if (!app.appNo) app.appNo = `APP-${String(app._id).slice(-6).toUpperCase()}`;
  return app;
};

r.get("/crm/applications/:id", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const app = await applicationFor(req);
  if (app.isModified()) await app.save();
  const a: any = app.toObject();
  const [lead, fees, docs, stages] = await Promise.all([
    a.lead ? Lead.findById(a.lead).select("name phone email owner course city status doNotContact").populate("status", "name color").lean() : null,
    a.lead ? LeadFee.find({ tenant: req.tenantId, lead: a.lead }).sort({ createdAt: -1 }).lean() : [],
    a.lead ? LeadDocument.find({ tenant: req.tenantId, lead: a.lead }).sort({ createdAt: -1 }).select("name category mime size createdAt by").lean() : [],
    stagesOf(req.tenantId),
  ]);
  const base = await appUrl(req.tenantId);
  // what the applicant filled in: from a CRM form, or the staff registration form
  const answers: Array<{ label: string; value: string }> = [];
  const raw = a.data?.answers || (a.data && !a.data.form ? a.data : {});
  for (const [k, v] of Object.entries(raw || {})) {
    if (v === null || v === undefined || v === "" || typeof v === "object" && !Array.isArray(v)) continue;
    answers.push({ label: k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()), value: Array.isArray(v) ? v.join(", ") : String(v) });
  }
  const submission = a.data?.submission ? await CrmFormSubmission.findById(a.data.submission).select("form").lean() : null;
  ok(res, {
    ...a, stage: a.stage || "Submitted", stages, link: `${base}/application/${a.token}`, leadInfo: lead, answers,
    formLink: submission ? `/crm/forms/${(submission as any).form}?tab=submissions&s=${a.data.submission}` : "",
    fees: (fees as any[]).map((f) => ({ _id: f._id, title: f.title, amount: f.amount, discount: f.discount || 0, paid: f.paidAmount || 0, balance: feeBalance(f), status: f.status, dueDate: f.dueDate, link: `${base}/pay/${f.token}`, receiptNo: f.receiptNo })),
    documents: docs,
  });
}));

r.patch("/crm/applications/:id", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const app = await applicationFor(req);
  const stage = str(req.body?.stage, 60);
  if (!(await stagesOf(req.tenantId)).includes(stage)) throw new ApiError(400, "Choose one of the application stages");
  const from = app.stage || "Submitted";
  const note = str(req.body?.note, 300);
  if (stage === from && !note) return ok(res, app);
  app.stage = stage;
  app.stageHistory.push({ stage, by: req.auth?.name || "System", at: new Date(), note });
  await app.save();
  if (app.lead) {
    await logActivity({ tenant: req.tenantId, lead: app.lead, type: "registration", by: req.auth?.name, title: `Application ${app.appNo}: ${from} → ${stage}`, detail: note });
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

/* ───────────── the offer ───────────── */

/** {name}, {appNo} … filled for this applicant */
function tokensFor(app: any, org: string, link: string, payLink: string) {
  const o = app.offer || {};
  return {
    "{name}": app.name || "", "{firstName}": String(app.name || "").split(" ")[0], "{appNo}": app.appNo || "", "{course}": app.course || "",
    "{amount}": o.amount ? money(o.amount) : "", "{validTill}": fmtDate(o.validTill), "{link}": link, "{payLink}": payLink || link,
    "{organisation}": org, "{offer}": o.text || "",
  } as Record<string, string>;
}
const fillTokens = (text: string, t: Record<string, string>) => String(text || "").replace(/\{(name|firstName|appNo|course|amount|validTill|link|payLink|organisation|offer)\}/g, (m) => t[m] ?? m);
const fillVars = (text: string, vars: string[]) => String(text || "").replace(/\{\{(\d+)\}\}/g, (m, n) => vars[Number(n) - 1] ?? m);
const htmlOf = (s: string) => (/<[a-z][\s\S]*>/i.test(s) ? s : s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string)).replace(/\n/g, "<br>"));

r.post("/crm/applications/:id/offer", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const app = await applicationFor(req);
  const b = req.body || {};
  const text = str(b.text, 4000);
  if (!text) throw new ApiError(400, "Write the offer");
  const amount = Math.max(0, Number(b.amount) || 0);
  const validTill = isDateKey(b.validTill) ? localDateTime(b.validTill, "23:59") : null;
  const email = b.email?.enabled ? b.email : null;
  const wa = b.whatsapp?.enabled ? b.whatsapp : null;
  if (email && !isValidEmail(str(email.to, 120))) throw new ApiError(400, "Enter a valid email address");
  if (wa && !isValidPhone(cleanPhone(wa.to))) throw new ApiError(400, "Enter a valid WhatsApp number");

  const first = !app.offer?.sentAt;
  app.offer = { text, amount, validTill, sentAt: new Date(), respondedAt: null, response: "" };
  app.markModified("offer");
  if (app.stage !== "Offer made") {
    app.stage = "Offer made";
    app.stageHistory.push({ stage: "Offer made", by: req.auth?.name || "System", at: new Date(), note: first ? "" : "Offer changed and sent again" });
  }
  await app.save();

  // the amount to confirm the seat is a fee the applicant can pay from their link; sending again updates it
  let payLink = "";
  const base = await appUrl(req.tenantId);
  if (app.lead) {
    const fee: any = await offerFeeOf(req.tenantId, app);
    if (amount > 0) {
      if (fee && fee.status === "pending") { fee.amount = amount; fee.dueDate = validTill; await fee.save(); payLink = `${base}/pay/${fee.token}`; }
      else if (!fee) { const f = await LeadFee.create({ tenant: req.tenantId, lead: app.lead, title: `Admission fee · ${app.appNo}`, amount, dueDate: validTill, token: newToken(), by: req.auth?.name || "System" }); payLink = `${base}/pay/${f.token}`; }
      else payLink = `${base}/pay/${fee.token}`;
    } else if (fee && fee.status === "pending" && !(fee.paidAmount > 0)) { fee.status = "cancelled"; await fee.save(); }
  }
  const link = `${base}/application/${app.token}`;
  const org = ((await OrganizationDetails.findOne({ tenant: req.tenantId }).select("name").lean()) as any)?.name || "";
  const tk = tokensFor(app, org, link, payLink);
  const lead: any = app.lead ? await Lead.findById(app.lead).select("doNotContact").lean() : null;
  const sent: Record<string, { ok: boolean; error?: string; simulated?: boolean; as?: string }> = {};

  if (email) {
    try {
      if (lead && blockedOn(lead, "email")) throw new Error("This applicant asked not to be emailed");
      const tpl: any = Types.ObjectId.isValid(String(email.templateId)) ? await ModuleTemplate.findOne({ _id: email.templateId, tenant: req.tenantId, channel: "email" }).lean() : null;
      const vars = (Array.isArray(email.vars) ? email.vars : []).map((v: any) => fillTokens(str(v, 1000), tk));
      const subject = fillTokens(fillVars(str(email.subject, 200) || tpl?.subject || `Offer of admission · ${app.appNo}`, vars), tk);
      const body = tpl ? fillTokens(fillVars(tpl.body, vars), tk) : `${text}\n\n${amount ? `To confirm your seat, pay ${money(amount)}${validTill ? ` by ${fmtDate(validTill)}` : ""}: ${payLink}\n\n` : ""}Accept or decline your offer here: ${link}`;
      const htmlBody = htmlOf(body) + (tpl && !body.includes(link) ? `<p><a href="${link}">View and respond to your offer</a></p>` : "");
      const out: any = await sendEmail({ to: str(email.to, 120), subject, html: app.lead ? await trackedHtml(req.tenantId, app.lead, subject, htmlBody) : htmlBody, text: body });
      sent.email = { ok: true, simulated: !!out?.simulated, as: tpl?.name || "Offer letter" };
      if (app.lead) await logActivity({ tenant: req.tenantId, lead: app.lead, type: "email", by: req.auth?.name, title: `Offer emailed · ${app.appNo}`, detail: subject });
    } catch (e: any) { sent.email = { ok: false, error: String(e?.message || e).slice(0, 200) }; }
  }
  if (wa) {
    try {
      if (lead && blockedOn(lead, "whatsapp")) throw new Error("This applicant asked not to get WhatsApp messages");
      const to = cleanPhone(wa.to);
      const tpl: any = Types.ObjectId.isValid(String(wa.templateId)) ? await ModuleTemplate.findOne({ _id: wa.templateId, tenant: req.tenantId, channel: "whatsapp" }).lean() : null;
      const vars = (Array.isArray(wa.vars) ? wa.vars : []).map((v: any) => fillTokens(str(v, 1000), tk));
      const meta: any = tpl ? await Template.findOne({ tenant: req.tenantId, channel: "whatsapp", name: tpl.name, status: /^approved$/i }).lean() : null;
      let as = "Message";
      if (meta) { await sendTemplate(String(req.tenantId), to, meta.name, meta.language || tpl.language || "en", vars); as = `Template ${meta.name}`; }
      else {
        // not approved on WhatsApp yet: the filled text goes as a normal message (reaches people who wrote in the last 24 hours)
        const body = tpl ? fillTokens(fillVars(tpl.body, vars), tk) + (tpl.footer ? `\n\n${tpl.footer}` : "") : `${text}\n\n${amount ? `Pay ${money(amount)} to confirm: ${payLink}\n` : ""}Respond to your offer: ${link}`;
        await sendText(String(req.tenantId), to, body.includes(link) || !tpl ? body : `${body}\n\n${link}`);
        as = tpl ? `${tpl.name} (as text)` : "Offer letter";
      }
      sent.whatsapp = { ok: true, as };
      if (app.lead) await noteLeadMessaged(req.tenantId, to, "whatsapp", req.auth?.name, `Offer · ${app.appNo}`).catch(() => undefined);
    } catch (e: any) { sent.whatsapp = { ok: false, error: String(e?.message || e).slice(0, 200) }; }
  }

  if (app.lead) await logActivity({ tenant: req.tenantId, lead: app.lead, type: "registration", by: req.auth?.name, title: first ? "Offer made" : "Offer sent again", detail: [amount ? `${money(amount)} to confirm` : "", ...Object.entries(sent).map(([k, v]) => `${k === "email" ? "Email" : "WhatsApp"}: ${v.ok ? "sent" : v.error}`)].filter(Boolean).join(" · ") });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Applications", entity: app.appNo, next: "Offer made" });
  ok(res, { ...app.toObject(), link, payLink, sent });
}));

export default r;
