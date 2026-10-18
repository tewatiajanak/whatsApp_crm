import { Router } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { require_ } from "../middleware/auth";
import { ok, asyncHandler, ApiError, audit } from "../utils/http";
import { Prerequisite, PREREQ_SECTIONS, PREREQ_REQUIRED } from "../models/Prerequisite";
import { Tenant } from "../models/Tenant";
import { OrganizationDetails } from "../models/OrganizationDetails";
import { sendEmail } from "../services/email";

/**
 * Admission pre-requisite questionnaire.
 *  - publicRouter: the client's form, opened from a link with a long random token (no login)
 *  - adminRouter:  Setup › Implementation › Pre-requisites (link, status per section, email, reopen)
 */
export const publicRouter = Router();
export const adminRouter = Router();

const TOKEN = /^[0-9a-f]{40}$/;
const newToken = () => crypto.randomBytes(20).toString("hex");
const MAX_DATA = 2_000_000; // characters of JSON
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const cleanUrl = (v: unknown) => {
  const s = typeof v === "string" ? v.trim().replace(/\/+$/, "") : "";
  if (!s) return "";
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try { const u = new URL(withScheme); return `${u.protocol}//${u.host}`; } catch { throw new ApiError(400, "Client URL is not valid"); }
};
const linkFor = (rec: any, fallbackOrigin?: string) => `${rec.clientUrl || cleanUrl(fallbackOrigin || "") || process.env.PUBLIC_APP_URL || "http://localhost:5173"}/prerequisites/${rec.token}`;

async function instituteName(tenant: any) {
  const org: any = await OrganizationDetails.findOne({ tenant }).select("name").lean();
  if (org?.name) return org.name;
  const t: any = await Tenant.findById(tenant).select("name").lean();
  return t?.name || "";
}

/* ---- what has been received, per section (for the admin status board) ---- */
const n = (a: any) => (Array.isArray(a) ? a.length : 0);
function summaryOf(key: string, d: any): string {
  if (!d) return "";
  try {
    switch (key) {
      case "institute": {
        const emps = (d.institute?.employees || []).filter((e: any) => e?.name?.trim()).length;
        return [d.institute?.name, `${emps} employee${emps === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
      }
      case "branches": return `${n(d.branches)} branch${n(d.branches) === 1 ? "" : "es"}`;
      case "enquiryStages": return `${n(d.enquiryStages)} stages`;
      case "appProcess": {
        const st = d.appProcess?.stages || [];
        return `${st.length} stages · ${st.reduce((x: number, s: any) => x + n(s.fields), 0)} fields`;
      }
      case "integrations": return `${(d.integrations || []).filter((x: any) => x.required === "Yes").length} required`;
      case "whatsapp": return `${(d.whatsappChecklist || []).filter((x: any) => x.provided).length}/${n(d.whatsappChecklist)} provided`;
      case "academic": return `${n(d.academic)} classes`;
      case "faq": return `${(d.faqs || []).filter((f: any) => String(f.a || "").trim()).length}/${n(d.faqs)} answered · ${n(d.queryCategories)} categories`;
      case "sources": return `${n(d.enquirySources)} sources · ${(d.autoNumbers || []).filter((x: any) => String(x.proposed || "").trim()).length} formats`;
      case "fee": return `${(d.feeClasses || []).filter((x: any) => x.feeRequired === "Yes").length} classes with fee · ${n(d.feeDocuments)} documents`;
      case "assign": {
        const on = (d.assignRules || []).filter((x: any) => x.enabled === "Yes").map((x: any) => x.rule);
        return on.length ? on.join(", ") : "No rule chosen";
      }
      case "forms": return `${["enquiryForm", "appForm", "outputFormNote"].filter((k) => String(d.formsDetail?.[k] || "").trim()).length}/3 filled`;
      case "templates": return `${(d.templates || []).filter((t: any) => t.sms || t.whatsapp || t.email).length}/${n(d.templates)} filled`;
      default: return "";
    }
  } catch { return ""; }
}

function present(rec: any, origin?: string) {
  const sections = PREREQ_SECTIONS.map((s) => ({
    key: s.key,
    label: s.label,
    savedAt: rec.sections?.[s.key]?.savedAt || null,
    summary: rec.sections?.[s.key]?.savedAt ? summaryOf(s.key, rec.data) : "",
    required: PREREQ_REQUIRED.includes(s.key),
  }));
  const done = sections.filter((s) => s.required && s.savedAt).length;
  const { data: _d, ...meta } = rec;
  return {
    ...meta,
    link: linkFor(rec, origin),
    hasData: !!rec.data,
    sections,
    progress: { done, total: PREREQ_REQUIRED.length },
    state: rec.status === "submitted" ? "Submitted" : rec.lastSavedAt ? "In progress" : rec.firstOpenedAt ? "Opened" : "Not started",
  };
}

async function recordFor(tenant: any) {
  let rec: any = await Prerequisite.findOne({ tenant }).lean();
  if (!rec) {
    try { await Prerequisite.create({ tenant, token: newToken() }); } catch { /* created by a parallel request */ }
    rec = await Prerequisite.findOne({ tenant }).lean();
  }
  return rec;
}

/* =========================== admin =========================== */
adminRouter.get("/prerequisites", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  const rec = await recordFor(req.tenantId);
  ok(res, { ...present(rec, String(req.query.origin || "")), institute: await instituteName(req.tenantId) });
}));

/** The client's answers (read-only view for the team). */
adminRouter.get("/prerequisites/data", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  const rec: any = await recordFor(req.tenantId);
  ok(res, { data: rec.data, status: rec.status, submittedAt: rec.submittedAt });
}));

adminRouter.patch("/prerequisites", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  await recordFor(req.tenantId);
  const set: any = {};
  if ("clientUrl" in (req.body || {})) set.clientUrl = cleanUrl(req.body.clientUrl);
  const rec = await Prerequisite.findOneAndUpdate({ tenant: req.tenantId }, { $set: set }, { new: true }).lean();
  ok(res, present(rec, String(req.body?.origin || "")));
}));

/** New link; the old one stops working. Answers are kept. */
adminRouter.post("/prerequisites/regenerate", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  await recordFor(req.tenantId);
  const rec = await Prerequisite.findOneAndUpdate({ tenant: req.tenantId }, { $set: { token: newToken() } }, { new: true }).lean();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Pre-requisites", entity: "New link" });
  ok(res, present(rec, String(req.body?.origin || "")));
}));

/** Unlock a submitted form so the client can change it again. */
adminRouter.post("/prerequisites/reopen", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const rec = await Prerequisite.findOneAndUpdate({ tenant: req.tenantId, status: "submitted" }, { $set: { status: "draft", reopenedAt: new Date() } }, { new: true }).lean();
  if (!rec) throw new ApiError(409, "The form is not submitted");
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Pre-requisites", entity: "Reopened" });
  ok(res, present(rec, String(req.body?.origin || "")));
}));

/** Email the link. {{link}}, {{institute}} and {{name}} are filled in. */
adminRouter.post("/prerequisites/send", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const rec: any = await recordFor(req.tenantId);
  const to = String(req.body?.to || "").split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
  if (!to.length) throw new ApiError(400, "Enter an email address");
  const bad = to.find((x) => !EMAIL_RX.test(x));
  if (bad) throw new ApiError(400, `${bad} is not a valid email`);
  if (to.length > 10) throw new ApiError(400, "Up to 10 addresses at a time");
  const subjectIn = String(req.body?.subject || "").trim();
  const bodyIn = String(req.body?.body || "").trim();
  if (!subjectIn) throw new ApiError(400, "Subject is required");
  if (!bodyIn) throw new ApiError(400, "Message is required");
  const link = linkFor(rec, String(req.body?.origin || ""));
  const vars: Record<string, string> = { link, institute: await instituteName(req.tenantId), name: String(req.body?.name || "").trim() || "Sir/Madam" };
  const fill = (s: string) => s.replace(/\{\{\s*(link|institute|name)\s*\}\}/gi, (_m, k) => vars[k.toLowerCase()] || "");
  const subject = fill(subjectIn);
  let text = fill(bodyIn);
  if (!text.includes(link)) text += `\n\n${link}`;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
  const html = esc(text).replace(new RegExp(esc(link).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), `<a href="${esc(link)}">${esc(link)}</a>`).replace(/\n/g, "<br>");
  const sent: any[] = [];
  for (const addr of to) {
    const out = await sendEmail({ to: addr, subject, html, text });
    sent.push({ to: addr, subject, at: new Date(), by: req.auth?.name || "", simulated: out.simulated });
  }
  await Prerequisite.updateOne({ _id: rec._id }, { $push: { sends: { $each: sent } } });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "SEND", module: "Pre-requisites", entity: to.join(", ") });
  ok(res, { sent: sent.length, simulated: sent.every((s) => s.simulated) });
}));

/* =========================== public (client) =========================== */
publicRouter.use("/public/prereq", rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false }));

async function byToken(token: string) {
  if (!TOKEN.test(token)) throw new ApiError(404, "This link is not valid");
  const rec: any = await Prerequisite.findOne({ token }).lean();
  if (!rec) throw new ApiError(404, "This link is not valid");
  return rec;
}
const publicView = async (rec: any) => ({
  status: rec.status,
  submittedAt: rec.submittedAt,
  submittedBy: rec.submittedBy ? { name: rec.submittedBy.name } : null,
  lastSavedAt: rec.lastSavedAt,
  institute: await instituteName(rec.tenant),
  sections: Object.fromEntries(Object.entries(rec.sections || {}).map(([k, v]: any) => [k, v?.savedAt || null])),
  data: rec.data,
});
function cleanData(v: unknown) {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ApiError(400, "Nothing to save");
  const json = JSON.stringify(v);
  if (json.length > MAX_DATA) throw new ApiError(413, "The form is too large to save");
  if (!(v as any).institute) throw new ApiError(400, "Nothing to save");
  return JSON.parse(json);
}

publicRouter.get("/public/prereq/:token", asyncHandler(async (req: any, res: any) => {
  let rec = await byToken(String(req.params.token));
  if (!rec.firstOpenedAt) {
    await Prerequisite.updateOne({ _id: rec._id, firstOpenedAt: null }, { $set: { firstOpenedAt: new Date() } });
    rec = { ...rec, firstOpenedAt: new Date() };
  }
  ok(res, await publicView(rec));
}));

/** Save the answers; `section` marks that section as received. Locked after Final Submit. */
publicRouter.put("/public/prereq/:token", asyncHandler(async (req: any, res: any) => {
  const rec = await byToken(String(req.params.token));
  if (rec.status === "submitted") throw new ApiError(409, "This form has been submitted and can no longer be changed");
  const set: any = { data: cleanData(req.body?.data), lastSavedAt: new Date() };
  const section = String(req.body?.section || "");
  if (section && PREREQ_SECTIONS.some((s) => s.key === section)) set[`sections.${section}`] = { savedAt: new Date() };
  const next = await Prerequisite.findOneAndUpdate({ _id: rec._id, status: "draft" }, { $set: set }, { new: true }).lean();
  if (!next) throw new ApiError(409, "This form has been submitted and can no longer be changed");
  ok(res, { lastSavedAt: next.lastSavedAt, sections: Object.fromEntries(Object.entries(next.sections || {}).map(([k, v]: any) => [k, v?.savedAt || null])) });
}));

/** Final submit: saves the last answers and locks the form. */
publicRouter.post("/public/prereq/:token/submit", asyncHandler(async (req: any, res: any) => {
  const rec = await byToken(String(req.params.token));
  if (rec.status === "submitted") throw new ApiError(409, "This form has already been submitted");
  const data = req.body?.data ? cleanData(req.body.data) : rec.data;
  if (!data) throw new ApiError(400, "Fill the form before submitting");
  const name = String(req.body?.name || "").trim().slice(0, 120);
  const email = String(req.body?.email || "").trim().slice(0, 160);
  if (!name) throw new ApiError(400, "Enter your name");
  if (email && !EMAIL_RX.test(email)) throw new ApiError(400, "Email is not valid");
  const now = new Date();
  const next = await Prerequisite.findOneAndUpdate(
    { _id: rec._id, status: "draft" },
    { $set: { data, status: "submitted", submittedAt: now, submittedBy: { name, email }, lastSavedAt: now, "sections.preview": { savedAt: now } } },
    { new: true }
  ).lean();
  if (!next) throw new ApiError(409, "This form has already been submitted");
  await audit({ tenant: rec.tenant, user: name, action: "SUBMIT", module: "Pre-requisites", entity: "Final submit" });
  ok(res, await publicView(next));
}));
