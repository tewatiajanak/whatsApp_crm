import { Router } from "express";
import { Types } from "mongoose";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import { randomBytes, createHash } from "crypto";
import rateLimit from "express-rate-limit";
import { require_ } from "../middleware/auth";
import { ok, paginated, asyncHandler, ApiError, audit } from "../utils/http";
import {
  CrmForm, CrmFormSubmission, FORM_KINDS, FORM_STATUSES, FIELD_TYPES, OPTION_SOURCES, LEAD_TARGETS, SHOW_OPS, SUBMISSION_STATUSES,
  IFormField, ICrmForm,
} from "../models/CrmForm";
import { Lead, phoneKeyOf } from "../models/Lead";
import { Registration } from "../models/Registration";
import { LeadDocument, LeadFee, feeBalance } from "../models/CrmExtras";
import { Course, Branch } from "../models/CrmMore";
import { Grade, AcademicSession, LeadStatus } from "../models/Masters";
import { User } from "../models/User";
import { OrganizationDetails } from "../models/OrganizationDetails";
import { convertToLead, logActivity, cleanPhone, isValidPhone, isValidEmail, escapeRegex, assignableOwners } from "../services/leadService";
import { canSeeLead } from "../services/leadAccess";
import { newToken } from "../services/leadFees";
import { sendEmail } from "../services/email";
import { sendText } from "../services/whatsapp";
import { notify, appUrl } from "../services/pm/messages";
import { localDateKey } from "../utils/dates";

/** CRM → Forms: a form builder for enquiry, application and registration forms, with a public link, submissions and analytics. */
const r = Router();
export const publicFormRoutes = Router();

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "");
const oid = (v: unknown) => (Types.ObjectId.isValid(String(v)) ? new Types.ObjectId(String(v)) : null);
const num = (v: unknown) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
const pageOf = (q: any) => Math.max(1, parseInt(String(q.page || "1"), 10) || 1);
const perPageOf = (q: any) => Math.min(200, Math.max(1, parseInt(String(q.perPage || "50"), 10) || 50));
const fid = () => "f" + randomBytes(4).toString("hex");
const newSlug = (name: string) => `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "form"}-${randomBytes(3).toString("hex")}`;
const KIND_PREFIX: Record<string, string> = { enquiry: "ENQ-", application: "APP-", registration: "REG-", event: "EVT-", feedback: "FB-", other: "F-" };
const prefixOf = (f: any) => f.settings?.numberPrefix || KIND_PREFIX[f.kind] || "F-";
const refOf = (f: any, n: number) => `${prefixOf(f)}${String(n).padStart(4, "0")}`;
const FILE_DIR = path.join(process.cwd(), "uploads", "lead-docs");
const ANSWERLESS = new Set(["heading"]);
const CHOICE = new Set(["select", "radio", "checkbox"]);

/* ───────────── ready-made forms ───────────── */
type F = Partial<IFormField> & { type: IFormField["type"]; label: string };
const f = (type: F["type"], label: string, extra: Partial<F> = {}): F => ({ type, label, ...extra });
const TEMPLATES: Record<string, { name: string; kind: string; icon: string; pages: Array<{ title: string; fields: F[] }>; settings?: any }> = {
  blank: { name: "Blank form", kind: "enquiry", icon: "file-earmark", pages: [{ title: "Details", fields: [f("text", "Full name", { required: true, map: "name" }), f("phone", "Mobile number", { required: true, map: "phone", width: "half" }), f("email", "Email", { map: "email", width: "half" })] }] },
  enquiry: {
    name: "Enquiry form", kind: "enquiry", icon: "chat-left-text",
    pages: [{ title: "Enquiry", fields: [
      f("text", "Full name", { required: true, map: "name" }),
      f("phone", "Mobile number", { required: true, map: "phone", width: "half" }),
      f("email", "Email", { map: "email", width: "half" }),
      f("select", "Course", { required: true, map: "course", optionSource: "courses", width: "half" }),
      f("text", "City", { map: "city", width: "half" }),
      f("textarea", "Message", { map: "note" }),
      f("consent", "I agree to be contacted by call, SMS, email and WhatsApp", { required: true }),
    ] }],
  },
  admission: {
    name: "Admission application", kind: "application", icon: "mortarboard",
    settings: { createApplication: true, allowDraft: true, fee: { enabled: true, amount: 500, title: "Application fee" } },
    pages: [
      { title: "Applicant", fields: [
        f("text", "Applicant name", { required: true, map: "name" }),
        f("date", "Date of birth", { required: true, width: "half" }),
        f("radio", "Gender", { required: true, options: ["Male", "Female", "Other"], width: "half" }),
        f("phone", "Mobile number", { required: true, map: "phone", width: "half" }),
        f("email", "Email", { required: true, map: "email", width: "half" }),
        f("select", "Class / course applying for", { required: true, map: "course", optionSource: "courses" }),
      ] },
      { title: "Parents", fields: [
        f("text", "Father's name", { required: true, width: "half" }),
        f("phone", "Father's mobile", { width: "half", map: "altPhone" }),
        f("text", "Mother's name", { required: true, width: "half" }),
        f("phone", "Mother's mobile", { width: "half" }),
        f("textarea", "Address", { required: true }),
        f("text", "City", { required: true, map: "city", width: "half" }),
        f("text", "State", { map: "state", width: "half" }),
      ] },
      { title: "Academics", fields: [
        f("text", "Previous school / college", { required: true }),
        f("number", "Last result (%)", { min: 0, max: 100, width: "half" }),
        f("text", "Board / university", { width: "half" }),
      ] },
      { title: "Documents", fields: [
        f("file", "Photograph", { required: true, accept: "image/*", maxSizeMb: 2, width: "half" }),
        f("file", "Birth certificate / ID proof", { required: true, accept: ".pdf,image/*", width: "half" }),
        f("file", "Last mark sheet", { accept: ".pdf,image/*" }),
        f("signature", "Signature", { required: true }),
        f("consent", "I confirm that the details given are true", { required: true }),
      ] },
    ],
  },
  event: {
    name: "Event registration", kind: "event", icon: "calendar-event",
    pages: [{ title: "Registration", fields: [
      f("text", "Full name", { required: true, map: "name" }),
      f("phone", "Mobile number", { required: true, map: "phone", width: "half" }),
      f("email", "Email", { required: true, map: "email", width: "half" }),
      f("text", "Organisation", { width: "half" }),
      f("number", "Number of guests", { min: 0, max: 10, width: "half", defaultValue: "0" }),
      f("radio", "Will you attend in person?", { required: true, options: ["In person", "Online"] }),
      f("textarea", "Anything we should know?"),
    ] }],
  },
  job: {
    name: "Job application", kind: "application", icon: "briefcase",
    pages: [
      { title: "About you", fields: [
        f("text", "Full name", { required: true, map: "name" }),
        f("phone", "Mobile number", { required: true, map: "phone", width: "half" }),
        f("email", "Email", { required: true, map: "email", width: "half" }),
        f("select", "Position", { required: true, options: ["Teacher", "Counsellor", "Administration", "Sales", "Other"], width: "half" }),
        f("number", "Experience (years)", { min: 0, max: 50, width: "half" }),
        f("url", "LinkedIn profile"),
      ] },
      { title: "Resume", fields: [
        f("file", "Resume", { required: true, accept: ".pdf,.doc,.docx", maxSizeMb: 5 }),
        f("number", "Expected salary (per month)", { min: 0, width: "half" }),
        f("date", "Can join from", { width: "half" }),
      ] },
    ],
  },
  contact: {
    name: "Contact us", kind: "enquiry", icon: "envelope",
    pages: [{ title: "Contact", fields: [
      f("text", "Name", { required: true, map: "name", width: "half" }),
      f("phone", "Phone", { required: true, map: "phone", width: "half" }),
      f("email", "Email", { map: "email" }),
      f("select", "Topic", { options: ["Admissions", "Fees", "Support", "Other"] }),
      f("textarea", "Message", { required: true, map: "note" }),
    ] }],
  },
  feedback: {
    name: "Feedback survey", kind: "feedback", icon: "star",
    settings: { createLead: false },
    pages: [{ title: "Feedback", fields: [
      f("text", "Name", { width: "half" }),
      f("phone", "Phone", { width: "half" }),
      f("rating", "How would you rate us?", { required: true, max: 5 }),
      f("radio", "Would you recommend us?", { required: true, options: ["Yes", "Maybe", "No"] }),
      f("checkbox", "What did you like?", { options: ["Staff", "Facilities", "Teaching", "Communication"] }),
      f("textarea", "Suggestions"),
    ] }],
  },
};

/* ───────────── cleaning what the builder sends ───────────── */
function cleanField(input: any, ids: Set<string>): IFormField {
  const type = (FIELD_TYPES as readonly string[]).includes(input?.type) ? input.type : "text";
  let id = str(input?.id, 20).replace(/[^a-zA-Z0-9_]/g, "") || fid();
  while (ids.has(id)) id = fid();
  ids.add(id);
  const label = str(input?.label, 300);
  const options = CHOICE.has(type) ? [...new Set((Array.isArray(input?.options) ? input.options : String(input?.options || "").split("\n")).map((o: any) => str(o, 120)).filter(Boolean))].slice(0, 200) as string[] : [];
  const optionSource = CHOICE.has(type) && (OPTION_SOURCES as readonly string[]).includes(input?.optionSource) ? input.optionSource : "custom";
  if (CHOICE.has(type) && optionSource === "custom" && !options.length) throw new ApiError(400, `Add options for "${label || "the choice field"}"`);
  let pattern = str(input?.pattern, 200);
  if (pattern) { try { new RegExp(pattern); } catch { throw new ApiError(400, `The pattern on "${label}" is not valid`); } }
  const map = (LEAD_TARGETS as readonly string[]).includes(input?.map) && !ANSWERLESS.has(type) ? input.map : "";
  const showIf = input?.showIf && str(input.showIf.field, 20) && (SHOW_OPS as readonly string[]).includes(input.showIf.op)
    ? { field: str(input.showIf.field, 20), op: input.showIf.op, value: str(input.showIf.value, 200) } : null;
  if (!label && type !== "hidden") throw new ApiError(400, "Every field needs a label");
  return {
    id, type, label: label || id, required: ANSWERLESS.has(type) || type === "hidden" ? false : !!input?.required,
    width: input?.width === "half" ? "half" : "full", options, optionSource, map,
    defaultValue: str(input?.defaultValue, 500), param: str(input?.param, 40).replace(/[^a-zA-Z0-9_\-]/g, ""),
    min: num(input?.min), max: num(input?.max), minLength: num(input?.minLength), maxLength: num(input?.maxLength),
    pattern, patternMessage: str(input?.patternMessage, 120), accept: str(input?.accept, 120),
    maxSizeMb: Math.min(10, Math.max(1, Number(input?.maxSizeMb) || 5)), multiple: !!input?.multiple, showIf,
  };
}

function cleanPages(input: unknown) {
  const ids = new Set<string>();
  const pages = (Array.isArray(input) ? input : []).slice(0, 20).map((p: any, i: number) => ({
    id: str(p?.id, 20) || `p${i + 1}`,
    title: str(p?.title, 120) || `Step ${i + 1}`,
    fields: (Array.isArray(p?.fields) ? p.fields : []).slice(0, 100).map((x: any) => cleanField(x, ids)),
  }));
  if (!pages.length) pages.push({ id: "p1", title: "Details", fields: [] });
  const all = pages.flatMap((p) => p.fields);
  for (const fl of all) if (fl.showIf && !all.some((o) => o.id === fl.showIf!.field && o.id !== fl.id)) fl.showIf = null;
  const mapped = all.filter((x) => x.map).map((x) => x.map);
  const twice = mapped.find((m, i) => mapped.indexOf(m) !== i);
  if (twice) throw new ApiError(400, `Two fields fill the lead's ${twice}. Keep one.`);
  return pages;
}

const emails = (v: unknown) => [...new Set((Array.isArray(v) ? v : String(v || "").split(/[\s,;]+/)).map((e: any) => str(e, 120).toLowerCase()).filter(Boolean))].slice(0, 10);
const dateOrNull = (v: unknown) => { if (!v) return null; const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? null : d; };

function applySettings(form: any, b: any) {
  const s = b || {};
  const cur = form.settings;
  const set = (k: string, v: any) => { if (s[k] !== undefined) cur[k] = v; };
  set("submitLabel", str(s.submitLabel, 40) || "Submit");
  set("nextLabel", str(s.nextLabel, 30) || "Next");
  set("backLabel", str(s.backLabel, 30) || "Back");
  set("buttonAlign", ["left", "center", "right", "full"].includes(s.buttonAlign) ? s.buttonAlign : "right");
  set("successMessage", str(s.successMessage, 2000));
  if (s.redirectUrl !== undefined) {
    const u = str(s.redirectUrl, 500);
    if (u && !/^https?:\/\//i.test(u)) throw new ApiError(400, "Redirect link must start with http:// or https://");
    cur.redirectUrl = u;
  }
  set("closedMessage", str(s.closedMessage, 500) || "This form is closed.");
  set("opensAt", dateOrNull(s.opensAt));
  set("closesAt", dateOrNull(s.closesAt));
  if (cur.opensAt && cur.closesAt && cur.closesAt <= cur.opensAt) throw new ApiError(400, "Closing time must be after opening time");
  set("maxSubmissions", Math.max(0, Math.floor(Number(s.maxSubmissions) || 0)));
  for (const k of ["onePerPhone", "allowDraft", "showProgress", "createLead", "createApplication", "notifyOwner", "replyEmail", "replyWhatsApp"]) set(k, !!s[k]);
  set("numberPrefix", str(s.numberPrefix, 12).toUpperCase().replace(/[^A-Z0-9\-\/]/g, ""));
  set("leadSource", str(s.leadSource, 80));
  set("leadStatus", oid(s.leadStatus) ? String(s.leadStatus) : "");
  set("owner", str(s.owner, 80));
  set("course", str(s.course, 120));
  if (s.tags !== undefined) cur.tags = [...new Set((Array.isArray(s.tags) ? s.tags : String(s.tags || "").split(",")).map((t: any) => str(t, 40)).filter(Boolean))].slice(0, 10);
  if (s.notifyEmails !== undefined) {
    const list = emails(s.notifyEmails);
    const bad = list.find((e) => !isValidEmail(e));
    if (bad) throw new ApiError(400, `${bad} is not a valid email`);
    cur.notifyEmails = list;
  }
  set("replyText", str(s.replyText, 1000));
  if (s.fee !== undefined) {
    const fee = s.fee || {};
    const amounts: Record<string, number> = {};
    for (const [k, v] of Object.entries(fee.amounts || {})) { const n = Number(v); if (str(k, 120) && Number.isFinite(n) && n >= 0) amounts[str(k, 120)] = Math.round(n * 100) / 100; }
    cur.fee = {
      enabled: !!fee.enabled, amount: Math.max(0, Math.round((Number(fee.amount) || 0) * 100) / 100), title: str(fee.title, 80) || "Application fee",
      amountFrom: str(fee.amountFrom, 20), amounts,
    };
    form.markModified("settings.fee");
  }
}

function applyTheme(form: any, t: any) {
  if (!t) return;
  const color = str(t.color, 20);
  if (t.color !== undefined) form.theme.color = /^#[0-9a-f]{3,8}$/i.test(color) ? color : "";
  for (const k of ["logo", "cover", "background"]) if (t[k] !== undefined) {
    const v = str(t[k], 1000);
    if (v && !/^(https?:\/\/|\/uploads\/)/i.test(v)) throw new ApiError(400, "Image links must start with http:// or https://");
    form.theme[k] = v;
  }
  if (t.width !== undefined) form.theme.width = t.width === "wide" ? "wide" : "narrow";
}

/** Problems that would stop the form working, shown before it goes live. */
function problemsOf(form: any) {
  const all = form.pages.flatMap((p: any) => p.fields);
  const out: string[] = [];
  if (!all.some((x: any) => !ANSWERLESS.has(x.type) && x.type !== "hidden")) out.push("Add at least one field");
  const s = form.settings;
  if (s.createLead || s.createApplication || s.fee?.enabled) {
    if (!all.some((x: any) => x.map === "name")) out.push("Link a field to the lead's name");
    if (!all.some((x: any) => x.map === "phone")) out.push("Link a field to the lead's phone");
  }
  if (s.fee?.enabled && !(s.fee.amount > 0) && !s.fee.amountFrom) out.push("Set the fee amount");
  return out;
}

/* ───────────── option lists from the masters ───────────── */
async function optionsFor(tenant: any, source: string): Promise<string[]> {
  if (source === "courses") return (await Course.find({ tenant, active: true }).sort({ name: 1 }).select("name").lean()).map((c: any) => c.name);
  if (source === "branches") return (await Branch.find({ tenant, active: true }).sort({ name: 1 }).select("name").lean()).map((c: any) => c.name);
  if (source === "grades") return (await Grade.find({ tenant }).sort({ order: 1, name: 1 }).select("name").lean()).map((c: any) => c.name);
  if (source === "sessions") return (await AcademicSession.find({ tenant }).sort({ startYear: -1 }).select("name").lean()).map((c: any) => c.name);
  return [];
}
async function resolveOptions(form: any) {
  const cache: Record<string, string[]> = {};
  const pages = JSON.parse(JSON.stringify(form.pages));
  for (const p of pages) for (const fl of p.fields) {
    if (CHOICE.has(fl.type) && fl.optionSource && fl.optionSource !== "custom") {
      cache[fl.optionSource] = cache[fl.optionSource] || (await optionsFor(form.tenant, fl.optionSource));
      fl.options = cache[fl.optionSource].length ? cache[fl.optionSource] : fl.options;
    }
  }
  return pages;
}

/* ───────────── answers ───────────── */
const isEmpty = (v: any) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || v === false;
function visible(fl: any, data: Record<string, any>, byId: Map<string, any>, seen = new Set<string>()): boolean {
  if (!fl.showIf) return true;
  if (seen.has(fl.id)) return false;
  seen.add(fl.id);
  const dep = byId.get(fl.showIf.field);
  if (!dep || !visible(dep, data, byId, seen)) return fl.showIf.op === "empty";
  const v = data[dep.id];
  const has = (x: any) => (Array.isArray(v) ? v.map(String).includes(x) : String(v ?? "") === x);
  switch (fl.showIf.op) {
    case "eq": return has(fl.showIf.value);
    case "neq": return !has(fl.showIf.value);
    case "filled": return !isEmpty(v);
    case "empty": return isEmpty(v);
    default: return true;
  }
}

const extOk = (accept: string, name: string, mime: string) => {
  if (!accept) return true;
  const ext = path.extname(name || "").toLowerCase();
  return accept.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean).some((a) => (a.endsWith("/*") ? mime.startsWith(a.slice(0, -1)) : a.startsWith(".") ? a === ext : a === mime));
};
const SAFE_FILE = /^(application\/pdf|image\/(jpeg|png|webp|heic|gif)|application\/(msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation))|application\/vnd\.ms-excel|text\/(plain|csv))$/;

/**
 * Check every answer against its field. Fields hidden by a condition are dropped.
 * `partial` (a saved draft) skips the required checks.
 */
function readAnswers(form: any, pages: any[], input: any, files: any[], partial: boolean) {
  const all = pages.flatMap((p: any) => p.fields);
  const byId = new Map(all.map((x: any) => [x.id, x]));
  const raw: Record<string, any> = input && typeof input === "object" ? input : {};
  const data: Record<string, any> = {};
  const errors: Record<string, string> = {};
  // first pass: plain values, so conditions can read them
  for (const fl of all) {
    if (ANSWERLESS.has(fl.type) || fl.type === "file") continue;
    let v = raw[fl.id];
    if (fl.type === "hidden" && (v === undefined || v === "")) v = fl.defaultValue;
    if (fl.type === "checkbox" || (fl.type === "select" && fl.multiple)) v = (Array.isArray(v) ? v : v ? [v] : []).map((x: any) => str(x, 200)).filter(Boolean);
    else if (fl.type === "consent") v = v === true || v === "true" || v === "on" || v === "yes";
    else if (fl.type === "signature") v = typeof v === "string" ? v : "";
    else v = str(v, fl.type === "textarea" ? 5000 : 2000);
    data[fl.id] = v;
  }
  const out: Record<string, any> = {};
  const outFiles: Array<{ field: string; file: any }> = [];
  for (const fl of all) {
    if (ANSWERLESS.has(fl.type)) continue;
    if (!visible(fl, data, byId)) continue;
    const label = fl.label;
    if (fl.type === "file") {
      const mine = files.filter((x) => x.fieldname === fl.id);
      if (!mine.length) { if (fl.required && !partial) errors[fl.id] = `${label} is required`; continue; }
      if (!fl.multiple && mine.length > 1) { errors[fl.id] = `Attach one file for ${label}`; continue; }
      for (const x of mine.slice(0, 5)) {
        if (!SAFE_FILE.test(String(x.mimetype || "")) || !extOk(fl.accept, x.originalname, String(x.mimetype || ""))) { errors[fl.id] = `${label}: this file type is not allowed`; break; }
        if (x.size > (fl.maxSizeMb || 5) * 1024 * 1024) { errors[fl.id] = `${label}: file is larger than ${fl.maxSizeMb || 5} MB`; break; }
        outFiles.push({ field: fl.id, file: x });
      }
      continue;
    }
    const v = data[fl.id];
    if (isEmpty(v)) {
      if (fl.required && !partial) errors[fl.id] = fl.type === "consent" ? "Please tick to continue" : `${label} is required`;
      continue;
    }
    const n = Number(v);
    switch (fl.type) {
      case "email": if (!isValidEmail(v)) errors[fl.id] = "Enter a valid email address"; break;
      case "phone": if (!isValidPhone(cleanPhone(v))) errors[fl.id] = "Enter a valid phone number"; break;
      case "url": if (!/^https?:\/\/\S+\.\S+/i.test(v)) errors[fl.id] = "Enter a full link starting with http:// or https://"; break;
      case "number":
        if (!Number.isFinite(n)) errors[fl.id] = `${label} must be a number`;
        else if (fl.min !== null && n < fl.min) errors[fl.id] = `${label} must be at least ${fl.min}`;
        else if (fl.max !== null && n > fl.max) errors[fl.id] = `${label} must be at most ${fl.max}`;
        break;
      case "date": if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(v).getTime())) errors[fl.id] = "Enter a valid date"; break;
      case "time": if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) errors[fl.id] = "Enter a valid time"; break;
      case "rating": if (!Number.isInteger(n) || n < 1 || n > (fl.max || 5)) errors[fl.id] = "Pick a rating"; break;
      case "yesno": if (!["Yes", "No"].includes(v)) errors[fl.id] = "Pick Yes or No"; break;
      case "signature": if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v) || v.length > 400_000) errors[fl.id] = "Sign again"; break;
      case "select": case "radio": case "checkbox": {
        const list = Array.isArray(v) ? v : [v];
        if (fl.options.length && list.some((x: string) => !fl.options.includes(x))) errors[fl.id] = "Pick from the list";
        if (Array.isArray(v) && fl.max && v.length > fl.max) errors[fl.id] = `Pick up to ${fl.max}`;
        break;
      }
    }
    if (typeof v === "string" && ["text", "textarea"].includes(fl.type)) {
      if (fl.minLength && v.length < fl.minLength) errors[fl.id] = `${label} needs at least ${fl.minLength} characters`;
      else if (fl.maxLength && v.length > fl.maxLength) errors[fl.id] = `${label} can have at most ${fl.maxLength} characters`;
    }
    if (fl.pattern && typeof v === "string" && !errors[fl.id]) {
      try { if (!new RegExp(`^(?:${fl.pattern})$`).test(v)) errors[fl.id] = fl.patternMessage || `${label} is not in the right format`; } catch { /* checked when saved */ }
    }
    if (!errors[fl.id]) out[fl.id] = fl.type === "phone" ? cleanPhone(v) : fl.type === "number" || fl.type === "rating" ? n : v;
  }
  return { data: out, files: outFiles, errors };
}

/** answers as label → text, for the lead, the application and emails */
function labelled(pages: any[], data: Record<string, any>, files: any[] = []) {
  const rows: Array<{ id: string; label: string; value: string; type: string }> = [];
  for (const fl of pages.flatMap((p: any) => p.fields)) {
    if (ANSWERLESS.has(fl.type)) continue;
    if (fl.type === "file") { const mine = files.filter((x: any) => x.field === fl.id); if (mine.length) rows.push({ id: fl.id, label: fl.label, value: mine.map((x: any) => x.name).join(", "), type: fl.type }); continue; }
    const v = data[fl.id];
    if (isEmpty(v)) continue;
    rows.push({ id: fl.id, label: fl.label, type: fl.type, value: fl.type === "signature" ? "Signed" : fl.type === "consent" ? "Yes" : Array.isArray(v) ? v.join(", ") : String(v) });
  }
  return rows;
}
const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const answersHtml = (rows: ReturnType<typeof labelled>) => `<table cellpadding="6" style="border-collapse:collapse;font-size:14px">${rows.map((x) => `<tr><td style="color:#667;vertical-align:top">${esc(x.label)}</td><td>${esc(x.value)}</td></tr>`).join("")}</table>`;

async function saveFile(tenant: any, x: any) {
  const ext = (path.extname(x.originalname || "") || "").toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 8);
  const file = `${Date.now()}_${randomBytes(6).toString("hex")}${ext}`;
  const dir = path.join(FILE_DIR, String(tenant));
  await fs.promises.mkdir(dir, { recursive: true });
  if (x.buffer) await fs.promises.writeFile(path.join(dir, file), x.buffer);
  else { await fs.promises.copyFile(x.path, path.join(dir, file)); await fs.promises.unlink(x.path).catch(() => undefined); }
  return { name: str(x.originalname, 200) || "file", file, mime: String(x.mimetype || "application/octet-stream"), size: x.size || 0 };
}
const dropTemp = (files: any[]) => Promise.all(files.map((x) => (x.path ? fs.promises.unlink(x.path).catch(() => undefined) : undefined)));

/** whether the form takes answers right now, and why not */
async function openState(form: any) {
  const s = form.settings;
  const now = new Date();
  if (form.status === "draft") return { open: false, reason: "This form is not published yet." };
  if (form.status === "closed") return { open: false, reason: s.closedMessage || "This form is closed." };
  if (s.opensAt && now < s.opensAt) return { open: false, reason: `This form opens on ${s.opensAt.toLocaleDateString("en-GB")}.`, opensAt: s.opensAt };
  if (s.closesAt && now > s.closesAt) return { open: false, reason: s.closedMessage || "This form is closed." };
  if (s.maxSubmissions > 0) {
    const n = await CrmFormSubmission.countDocuments({ form: form._id, status: { $ne: "draft" } });
    if (n >= s.maxSubmissions) return { open: false, reason: s.closedMessage || "This form is full." };
  }
  return { open: true, reason: "" };
}

function feeAmount(form: any, data: Record<string, any>) {
  const fee = form.settings.fee;
  if (!fee?.enabled) return 0;
  if (fee.amountFrom) {
    const v = data[fee.amountFrom];
    const pick = Array.isArray(v) ? v[0] : v;
    if (pick !== undefined && fee.amounts && Object.prototype.hasOwnProperty.call(fee.amounts, String(pick))) return Number(fee.amounts[String(pick)]) || 0;
  }
  return Number(fee.amount) || 0;
}

/* ═════════════ signed-in: builder ═════════════ */

r.get("/crm/forms/templates", require_("setup", "view"), asyncHandler(async (_req: any, res: any) => {
  ok(res, Object.entries(TEMPLATES).map(([key, t]) => ({ key, name: t.name, kind: t.kind, icon: t.icon, pages: t.pages.length, fields: t.pages.reduce((a, p) => a + p.fields.length, 0) })));
}));

r.get("/crm/forms/meta", require_("setup", "view"), asyncHandler(async (req: any, res: any) => {
  const [statuses, owners] = await Promise.all([
    LeadStatus.find({ tenant: req.tenantId }).sort({ order: 1 }).select("name color").lean(),
    assignableOwners(req.tenantId),
  ]);
  ok(res, { statuses, owners, kinds: FORM_KINDS, fieldTypes: FIELD_TYPES, optionSources: OPTION_SOURCES, leadTargets: LEAD_TARGETS, base: await appUrl(req.tenantId) });
}));

r.get("/crm/forms", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const q = req.query;
  const filter: any = { tenant: req.tenantId };
  if ((FORM_STATUSES as readonly string[]).includes(q.status)) filter.status = q.status;
  if ((FORM_KINDS as readonly string[]).includes(q.kind)) filter.kind = q.kind;
  if (str(q.q)) filter.name = new RegExp(escapeRegex(str(q.q, 80)), "i");
  const forms = await CrmForm.find(filter).sort({ updatedAt: -1 }).select("-pages").lean();
  const ids = forms.map((x: any) => x._id);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const counts = await CrmFormSubmission.aggregate([
    { $match: { tenant: new Types.ObjectId(String(req.tenantId)), form: { $in: ids } } },
    { $group: { _id: "$form", total: { $sum: { $cond: [{ $ne: ["$status", "draft"] }, 1, 0] } }, drafts: { $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] } }, today: { $sum: { $cond: [{ $and: [{ $ne: ["$status", "draft"] }, { $gte: ["$submittedAt", today] }] }, 1, 0] } }, fresh: { $sum: { $cond: [{ $eq: ["$status", "new"] }, 1, 0] } }, last: { $max: "$submittedAt" } } },
  ]);
  const by = new Map(counts.map((c: any) => [String(c._id), c]));
  const all = await CrmForm.aggregate([{ $match: { tenant: new Types.ObjectId(String(req.tenantId)) } }, { $group: { _id: "$status", n: { $sum: 1 } } }]);
  ok(res, {
    items: forms.map((x: any) => {
      const c: any = by.get(String(x._id)) || {};
      return { ...x, submissions: c.total || 0, drafts: c.drafts || 0, today: c.today || 0, unread: c.fresh || 0, lastAt: c.last || null, conversion: x.stats?.views ? Math.round(((c.total || 0) / x.stats.views) * 1000) / 10 : 0 };
    }),
    counts: Object.fromEntries(all.map((a: any) => [a._id, a.n])),
  });
}));

r.post("/crm/forms", require_("setup", "create"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const t = TEMPLATES[str(b.template, 20)] || TEMPLATES.blank;
  const name = str(b.name, 120) || t.name;
  const kind = (FORM_KINDS as readonly string[]).includes(b.kind) ? b.kind : t.kind;
  const ids = new Set<string>();
  const form: any = new CrmForm({
    tenant: req.tenantId, name, kind, title: name, slug: newSlug(name), createdBy: req.auth?.name || "System", updatedBy: req.auth?.name || "System",
    pages: t.pages.map((p, i) => ({ id: `p${i + 1}`, title: p.title, fields: p.fields.map((x) => cleanField(x, ids)) })),
  });
  if (kind === "application" || kind === "registration") form.settings.createApplication = true;
  if (kind === "feedback") form.settings.createLead = false;
  if (t.settings) applySettings(form, t.settings);
  await form.save();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Forms", entity: name });
  ok(res, form, 201);
}));

r.get("/crm/forms/:id", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const form = await CrmForm.findOne({ _id: oid(req.params.id), tenant: req.tenantId }).lean();
  if (!form) throw new ApiError(404, "Form not found");
  const submissions = await CrmFormSubmission.countDocuments({ form: form._id, status: { $ne: "draft" } });
  ok(res, { ...form, submissions, problems: problemsOf(form), resolvedPages: await resolveOptions(form) });
}));

r.patch("/crm/forms/:id", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const form: any = await CrmForm.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!form) throw new ApiError(404, "Form not found");
  const b = req.body || {};
  if (b.name !== undefined) { const n = str(b.name, 120); if (!n) throw new ApiError(400, "Name is required"); form.name = n; }
  if (b.title !== undefined) form.title = str(b.title, 200);
  if (b.kind !== undefined && (FORM_KINDS as readonly string[]).includes(b.kind)) form.kind = b.kind;
  if (b.pages !== undefined) form.pages = cleanPages(b.pages);
  if (b.settings !== undefined) applySettings(form, b.settings);
  if (b.theme !== undefined) applyTheme(form, b.theme);
  if (b.slug !== undefined) {
    const s = str(b.slug, 60).toLowerCase().replace(/[^a-z0-9\-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (s.length < 3) throw new ApiError(400, "The link name needs at least 3 letters or numbers");
    if (s !== form.slug && (await CrmForm.exists({ slug: s }))) throw new ApiError(409, "This link name is taken. Try another.");
    form.slug = s;
  }
  if (b.status !== undefined && (FORM_STATUSES as readonly string[]).includes(b.status)) {
    if (b.status === "live") { const p = problemsOf(form); if (p.length) throw new ApiError(400, p[0]); }
    form.status = b.status;
  }
  form.updatedBy = req.auth?.name || "System";
  await form.save();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Forms", entity: form.name, next: b.status ? `Status: ${form.status}` : undefined });
  const out = form.toObject();
  ok(res, { ...out, problems: problemsOf(out), resolvedPages: await resolveOptions(out) });
}));

r.post("/crm/forms/:id/duplicate", require_("setup", "create"), asyncHandler(async (req: any, res: any) => {
  const src: any = await CrmForm.findOne({ _id: oid(req.params.id), tenant: req.tenantId }).lean();
  if (!src) throw new ApiError(404, "Form not found");
  const { _id, createdAt, updatedAt, slug, stats, counter, ...rest } = src;
  const name = `${src.name} (copy)`.slice(0, 120);
  const copy = await CrmForm.create({ ...rest, name, slug: newSlug(src.name), status: "draft", stats: { views: 0, starts: 0 }, counter: 0, createdBy: req.auth?.name, updatedBy: req.auth?.name });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Forms", entity: name });
  ok(res, copy, 201);
}));

r.delete("/crm/forms/:id", require_("setup", "del"), asyncHandler(async (req: any, res: any) => {
  const form = await CrmForm.findOne({ _id: oid(req.params.id), tenant: req.tenantId });
  if (!form) throw new ApiError(404, "Form not found");
  // leads, applications and lead documents made from the form stay; only the form and its answers go
  const removed = await CrmFormSubmission.deleteMany({ tenant: req.tenantId, form: form._id });
  await form.deleteOne();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Forms", entity: form.name, next: `${removed.deletedCount} submissions` });
  ok(res, { deleted: true, submissions: removed.deletedCount });
}));

/* ═════════════ signed-in: submissions ═════════════ */

async function submissionFilter(req: any, formId: any) {
  const q = req.query;
  const filter: any = { tenant: req.tenantId, form: formId };
  filter.status = (SUBMISSION_STATUSES as readonly string[]).includes(q.status) ? q.status : { $ne: "draft" };
  if (q.paid === "1") filter.paid = true;
  if (q.paid === "0") { filter.amount = { $gt: 0 }; filter.paid = false; }
  const from = dateOrNull(q.from), to = dateOrNull(q.to);
  if (from || to) filter[filter.status === "draft" ? "updatedAt" : "submittedAt"] = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: new Date(to.getTime() + 86_400_000 - 1) } : {}) };
  const term = str(q.q, 80);
  if (term) { const rx = new RegExp(escapeRegex(term), "i"); filter.$or = [{ name: rx }, { phone: rx }, { email: rx }, { refNo: rx }]; }
  return filter;
}

/** keep `paid` in step with the fee it points at */
async function syncPaid(rows: any[]) {
  const pending = rows.filter((x) => x.fee && !x.paid);
  if (!pending.length) return rows;
  const fees = await LeadFee.find({ _id: { $in: pending.map((x) => x.fee) } }).select("status amount discount paidAmount").lean();
  const paidIds = fees.filter((fe: any) => fe.status === "paid" || feeBalance(fe) === 0).map((fe: any) => String(fe._id));
  if (paidIds.length) {
    await CrmFormSubmission.updateMany({ fee: { $in: paidIds.map((x) => new Types.ObjectId(x)) } }, { $set: { paid: true } });
    for (const x of rows) if (x.fee && paidIds.includes(String(x.fee))) x.paid = true;
  }
  return rows;
}

r.get("/crm/forms/:id/submissions", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const form = await CrmForm.findOne({ _id: oid(req.params.id), tenant: req.tenantId }).select("_id").lean();
  if (!form) throw new ApiError(404, "Form not found");
  const page = pageOf(req.query), perPage = perPageOf(req.query);
  const filter = await submissionFilter(req, form._id);
  const sortKey = filter.status === "draft" ? "updatedAt" : "submittedAt";
  const [items, total, statusCounts] = await Promise.all([
    CrmFormSubmission.find(filter).sort({ [sortKey]: -1 }).skip((page - 1) * perPage).limit(perPage).select("-data.__none").lean(),
    CrmFormSubmission.countDocuments(filter),
    CrmFormSubmission.aggregate([{ $match: { tenant: new Types.ObjectId(String(req.tenantId)), form: form._id } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  await syncPaid(items);
  // signatures are large; the list does not need them
  for (const x of items as any[]) for (const k of Object.keys(x.data || {})) if (typeof x.data[k] === "string" && x.data[k].startsWith("data:image/")) x.data[k] = "Signed";
  res.json({ ok: true, data: items, total, page, perPage, pages: Math.max(1, Math.ceil(total / perPage)), counts: Object.fromEntries(statusCounts.map((c: any) => [c._id, c.n])) });
}));

r.get("/crm/form-submissions/:sid", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const s: any = await CrmFormSubmission.findOne({ _id: oid(req.params.sid), tenant: req.tenantId }).lean();
  if (!s) throw new ApiError(404, "Submission not found");
  const form: any = await CrmForm.findById(s.form).lean();
  await syncPaid([s]);
  const [lead, fee, reg] = await Promise.all([
    s.lead && (await canSeeLead(req, s.lead)) ? Lead.findById(s.lead).select("name phone owner").lean() : null,
    s.fee ? LeadFee.findById(s.fee).select("title amount discount paidAmount status token receiptNo invoiceNo").lean() : null,
    s.registration ? Registration.findById(s.registration).select("appNo stage token").lean() : null,
  ]);
  const base = await appUrl(req.tenantId);
  ok(res, {
    ...s, formName: form?.name || "", answers: labelled(form?.pages || [], s.data || {}, s.files || []), pages: form?.pages || [],
    leadInfo: lead, feeInfo: fee ? { ...fee, balance: feeBalance(fee as any), link: `${base}/pay/${(fee as any).token}` } : null,
    application: reg ? { ...reg, link: `${base}/application/${(reg as any).token}` } : null,
    receiptLink: `${base}/f/receipt/${s.token}`, resumeLink: s.status === "draft" && form ? `${base}/f/${form.slug}?resume=${s.token}` : "",
  });
}));

r.patch("/crm/form-submissions/:sid", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const s: any = await CrmFormSubmission.findOne({ _id: oid(req.params.sid), tenant: req.tenantId });
  if (!s) throw new ApiError(404, "Submission not found");
  const b = req.body || {};
  if (b.status !== undefined) {
    if (!(SUBMISSION_STATUSES as readonly string[]).includes(b.status) || b.status === "draft") throw new ApiError(400, "Pick a status");
    if (s.status === "draft") throw new ApiError(400, "A draft has not been submitted yet");
    if (b.status !== s.status) { s.status = b.status; s.history.push({ status: b.status, by: req.auth?.name || "System", at: new Date() }); }
  }
  const note = str(b.note, 2000);
  if (note) s.notes.push({ text: note, by: req.auth?.name || "System", at: new Date() });
  await s.save();
  if (s.lead && (b.status || note)) await logActivity({ tenant: req.tenantId, lead: s.lead, type: "note", by: req.auth?.name, title: `Form ${s.refNo}`, detail: [b.status && `Marked ${b.status}`, note].filter(Boolean).join(" · ") });
  ok(res, s);
}));

r.post("/crm/form-submissions/bulk", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(oid).filter(Boolean).slice(0, 500);
  const action = str(req.body?.action, 20);
  if (!ids.length) throw new ApiError(400, "Select submissions");
  if (action === "delete") {
    const p = (req.perms || []).find((x: any) => x.module === "leads");
    if (!p?.del) throw new ApiError(403, "Forbidden: need del on leads");
    const out = await CrmFormSubmission.deleteMany({ tenant: req.tenantId, _id: { $in: ids } });
    return ok(res, { deleted: out.deletedCount });
  }
  if (!(SUBMISSION_STATUSES as readonly string[]).includes(action) || action === "draft") throw new ApiError(400, "Pick an action");
  const out = await CrmFormSubmission.updateMany(
    { tenant: req.tenantId, _id: { $in: ids }, status: { $nin: ["draft", action] } },
    { $set: { status: action }, $push: { history: { status: action, by: req.auth?.name || "System", at: new Date() } } }
  );
  ok(res, { updated: out.modifiedCount });
}));

r.delete("/crm/form-submissions/:sid", require_("leads", "del"), asyncHandler(async (req: any, res: any) => {
  const s = await CrmFormSubmission.findOneAndDelete({ _id: oid(req.params.sid), tenant: req.tenantId });
  if (!s) throw new ApiError(404, "Submission not found");
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Forms", entity: s.refNo || s.name });
  ok(res, { deleted: true });
}));

r.get("/crm/form-submissions/:sid/files/:fileId", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const s: any = await CrmFormSubmission.findOne({ _id: oid(req.params.sid), tenant: req.tenantId }).select("files").lean();
  const x = s?.files?.find((y: any) => String(y._id) === String(req.params.fileId));
  if (!x) throw new ApiError(404, "File not found");
  const full = path.join(FILE_DIR, String(req.tenantId), path.basename(x.file));
  if (!fs.existsSync(full)) throw new ApiError(404, "The file is no longer on the server");
  res.setHeader("Content-Type", x.mime);
  res.setHeader("Content-Disposition", `${req.query.download ? "attachment" : "inline"}; filename="${encodeURIComponent(x.name)}"`);
  fs.createReadStream(full).pipe(res);
}));

r.get("/crm/forms/:id/analytics", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const form: any = await CrmForm.findOne({ _id: oid(req.params.id), tenant: req.tenantId }).lean();
  if (!form) throw new ApiError(404, "Form not found");
  const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
  const since = new Date(Date.now() - (days - 1) * 86_400_000); since.setHours(0, 0, 0, 0);
  const t = new Types.ObjectId(String(req.tenantId));
  const [totals, daily, sources, drafts, pagesReached] = await Promise.all([
    CrmFormSubmission.aggregate([{ $match: { tenant: t, form: form._id, status: { $ne: "draft" } } }, { $group: { _id: null, n: { $sum: 1 }, paid: { $sum: { $cond: ["$paid", 1, 0] } }, amount: { $sum: { $cond: ["$paid", "$amount", 0] } }, leads: { $sum: { $cond: [{ $ifNull: ["$lead", false] }, 1, 0] } } } }]),
    CrmFormSubmission.aggregate([{ $match: { tenant: t, form: form._id, status: { $ne: "draft" }, submittedAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt" } }, n: { $sum: 1 } } }]),
    CrmFormSubmission.aggregate([{ $match: { tenant: t, form: form._id, status: { $ne: "draft" } } }, { $group: { _id: { $ifNull: ["$meta.utm.source", ""] }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 10 }]),
    CrmFormSubmission.countDocuments({ tenant: t, form: form._id, status: "draft" }),
    CrmFormSubmission.aggregate([{ $match: { tenant: t, form: form._id, status: "draft" } }, { $group: { _id: "$page", n: { $sum: 1 } } }]),
  ]);
  const byDay = new Map(daily.map((d: any) => [d._id, d.n]));
  const series = Array.from({ length: days }, (_, i) => { const d = new Date(since.getTime() + i * 86_400_000); const k = localDateKey(d); return { date: k, n: byDay.get(k) || byDay.get(d.toISOString().slice(0, 10)) || 0 }; });
  const tot: any = totals[0] || { n: 0, paid: 0, amount: 0, leads: 0 };
  const views = form.stats?.views || 0, starts = form.stats?.starts || 0;
  ok(res, {
    views, starts, submissions: tot.n, drafts, paid: tot.paid, collected: tot.amount, leads: tot.leads,
    conversion: views ? Math.round((tot.n / views) * 1000) / 10 : 0, completion: starts ? Math.round((tot.n / Math.max(starts, tot.n)) * 1000) / 10 : 0,
    series, sources: sources.map((s: any) => ({ source: s._id || "Direct", n: s.n })),
    dropOff: (form.pages || []).map((p: any, i: number) => ({ page: p.title, left: (pagesReached.find((x: any) => x._id === i) || {}).n || 0 })),
  });
}));

/* ═════════════ public: fill in a form ═════════════ */

const submitLimiter = rateLimit({ windowMs: 10 * 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
const upload = multer({ dest: path.join(os.tmpdir(), "whatsapp_crm_uploads"), limits: { fileSize: 10 * 1024 * 1024, files: 20, fieldSize: 2 * 1024 * 1024 } });
const ipHash = (req: any) => createHash("sha256").update(String(req.ip || "") + "form").digest("hex").slice(0, 16);

async function publicForm(slug: string) {
  const form: any = await CrmForm.findOne({ slug: str(slug, 80).toLowerCase() });
  if (!form) throw new ApiError(404, "This form link is not valid");
  return form;
}

publicFormRoutes.get("/public/forms/:slug", asyncHandler(async (req: any, res: any) => {
  const form = await publicForm(req.params.slug);
  const state = await openState(form);
  // the builder's preview passes ?preview=1 and is not counted
  if (req.query.view === "1" && form.status === "live") await CrmForm.updateOne({ _id: form._id }, { $inc: { "stats.views": 1 } });
  const org: any = await OrganizationDetails.findOne({ tenant: form.tenant }).select("name logo").lean();
  let draft: { token: string; data: any; page: number } | null = null;
  if (req.query.resume && form.settings.allowDraft) {
    const d: any = await CrmFormSubmission.findOne({ form: form._id, token: str(req.query.resume, 60), status: "draft" }).lean();
    if (d) draft = { token: d.token, data: d.data, page: d.page };
  }
  const s = form.settings;
  ok(res, {
    name: form.name, title: form.title || form.name, kind: form.kind, slug: form.slug, pages: await resolveOptions(form), theme: form.theme,
    settings: { submitLabel: s.submitLabel, nextLabel: s.nextLabel || "Next", backLabel: s.backLabel || "Back", buttonAlign: s.buttonAlign || "right", allowDraft: s.allowDraft, showProgress: s.showProgress, fee: s.fee?.enabled ? { amount: s.fee.amount, title: s.fee.title, amountFrom: s.fee.amountFrom, amounts: s.fee.amounts } : null },
    open: state.open, reason: state.reason, organisation: org?.name || "", logo: form.theme?.logo || org?.logo || "", draft,
  });
}));

publicFormRoutes.post("/public/forms/:slug/start", asyncHandler(async (req: any, res: any) => {
  const form = await publicForm(req.params.slug);
  if (form.status === "live") await CrmForm.updateOne({ _id: form._id }, { $inc: { "stats.starts": 1 } });
  ok(res, { ok: true });
}));

publicFormRoutes.post("/public/forms/:slug/draft", submitLimiter, asyncHandler(async (req: any, res: any) => {
  const form = await publicForm(req.params.slug);
  if (!form.settings.allowDraft) throw new ApiError(400, "This form cannot be saved for later");
  const state = await openState(form);
  if (!state.open) throw new ApiError(403, state.reason);
  const pages = await resolveOptions(form);
  const { data } = readAnswers(form, pages, req.body?.data, [], true);
  const page = Math.max(0, Math.min(pages.length - 1, Number(req.body?.page) || 0));
  const token = str(req.body?.token, 60);
  let d: any = token ? await CrmFormSubmission.findOne({ form: form._id, token, status: "draft" }) : null;
  const nameField = pages.flatMap((p: any) => p.fields).find((x: any) => x.map === "name");
  const phoneField = pages.flatMap((p: any) => p.fields).find((x: any) => x.map === "phone");
  if (!d) d = new CrmFormSubmission({ tenant: form.tenant, form: form._id, status: "draft", token: newToken(), meta: { utm: cleanUtm(req.body?.utm), referrer: str(req.body?.referrer, 300), userAgent: str(req.headers["user-agent"], 300), ipHash: ipHash(req), via: "Online" } });
  d.data = data; d.page = page;
  d.name = nameField ? str(data[nameField.id], 120) : ""; d.phone = phoneField ? str(data[phoneField.id], 20) : ""; d.phoneKey = phoneKeyOf(d.phone);
  d.markModified("data");
  await d.save();
  const link = `${await appUrl(form.tenant)}/f/${form.slug}?resume=${d.token}`;
  // send the resume link to the person, when they gave an email
  const emailField = pages.flatMap((p: any) => p.fields).find((x: any) => x.map === "email");
  const to = emailField ? data[emailField.id] : "";
  if (to && req.body?.sendLink) await sendEmail({ to, subject: `Continue your ${form.name}`, html: `<p>Continue where you left off:</p><p><a href="${link}">${link}</a></p>`, text: link }).catch(() => undefined);
  ok(res, { token: d.token, link });
}));

const cleanUtm = (u: any) => {
  const out: Record<string, string> = {};
  for (const k of ["source", "medium", "campaign", "term", "content"]) { const v = str(u?.[k], 120); if (v) out[k] = v; }
  return out;
};

publicFormRoutes.post("/public/forms/:slug/submit", submitLimiter, upload.any(), asyncHandler(async (req: any, res: any) => {
  const files: any[] = req.files || [];
  try {
    const form = await publicForm(req.params.slug);
    const state = await openState(form);
    if (!state.open) throw new ApiError(403, state.reason);
    let body: any = req.body || {};
    if (typeof body.payload === "string") { try { body = JSON.parse(body.payload); } catch { throw new ApiError(400, "The form could not be read. Try again."); } }
    // bots fill the hidden "website" box; people never see it
    if (str(body._hp)) return ok(res, { refNo: "", message: form.settings.successMessage });
    const pages = await resolveOptions(form);
    const { data, files: picked, errors } = readAnswers(form, pages, body.data, files, false);
    if (Object.keys(errors).length) { const e: any = new ApiError(400, Object.values(errors)[0]); e.details = { fields: errors }; throw e; }
    const all = pages.flatMap((p: any) => p.fields);
    const valueOf = (target: string) => { const fl = all.find((x: any) => x.map === target); const v = fl ? data[fl.id] : ""; return Array.isArray(v) ? v.join(", ") : v === undefined ? "" : String(v); };
    const name = valueOf("name"), phone = valueOf("phone"), email = valueOf("email");
    const s = form.settings;
    if (s.onePerPhone && phone && (await CrmFormSubmission.exists({ form: form._id, phoneKey: phoneKeyOf(phone), status: { $ne: "draft" } })))
      throw new ApiError(409, "This phone number has already been used on this form");

    const counted: any = await CrmForm.findOneAndUpdate({ _id: form._id }, { $inc: { counter: 1 } }, { new: true }).select("counter").lean();
    const number = counted?.counter || 1;
    const refNo = refOf(form, number);
    const draftToken = str(body.token, 60);
    let sub: any = draftToken ? await CrmFormSubmission.findOne({ form: form._id, token: draftToken, status: "draft" }) : null;
    if (!sub) sub = new CrmFormSubmission({ tenant: form.tenant, form: form._id, token: newToken() });
    // signatures become image files
    for (const fl of all.filter((x: any) => x.type === "signature" && data[x.id])) {
      const buf = Buffer.from(String(data[fl.id]).split(",")[1] || "", "base64");
      picked.push({ field: fl.id, file: { originalname: `${fl.label || "signature"}.png`, mimetype: "image/png", size: buf.length, buffer: buf } });
      data[fl.id] = "Signed";
    }
    const saved: any[] = [];
    for (const p of picked) saved.push({ field: p.field, ...(await saveFile(form.tenant, p.file)) });
    Object.assign(sub, {
      number, refNo, status: "new", data, files: saved, name, phone: phone ? cleanPhone(phone) : "", email: email.toLowerCase(), phoneKey: phoneKeyOf(phone),
      submittedAt: new Date(), page: pages.length - 1,
      meta: { utm: cleanUtm(body.utm), referrer: str(body.referrer, 300), userAgent: str(req.headers["user-agent"], 300), ipHash: ipHash(req), via: body.via === "Staff" ? "Staff" : "Online" },
      history: [{ status: "new", by: name || "Applicant", at: new Date() }],
    });
    sub.markModified("data");
    const answers = labelled(pages, data, saved);

    // the lead: new, or the existing one with the same phone gets this enquiry
    let lead: any = null;
    if ((s.createLead || s.createApplication || s.fee?.enabled) && name && phone) {
      const extra: Record<string, string> = {};
      for (const k of ["city", "state", "country", "grade", "altPhone", "branch"]) extra[k] = valueOf(k);
      const result = await convertToLead({
        tenant: form.tenant, name, phone, email: email || undefined, course: valueOf("course") || s.course || undefined,
        sourceKeyOrId: s.leadSource || body.utm?.source || "Website", owner: s.owner || undefined, statusId: s.leadStatus || undefined,
        city: extra.city, state: extra.state, country: extra.country, grade: extra.grade, altPhone: extra.altPhone, branch: extra.branch,
        tags: s.tags, utm: cleanUtm(body.utm), capturedFrom: `Form: ${form.name}`, note: valueOf("note"), user: "Form", partnerCode: str(body.ref, 20) || undefined,
        visitorId: str(body.visitorId, 60) || undefined,
      });
      lead = result.lead;
      sub.lead = lead._id;
      await logActivity({ tenant: form.tenant, lead: lead._id, type: "registration", by: "Form", title: `${form.name} submitted`, detail: `${refNo}${answers.length ? ` · ${answers.slice(0, 4).map((x) => `${x.label}: ${x.value}`).join(" · ")}` : ""}`.slice(0, 900) });
      for (const x of saved) await LeadDocument.create({ tenant: form.tenant, lead: lead._id, name: `${all.find((y: any) => y.id === x.field)?.label || "File"} · ${x.name}`.slice(0, 200), category: form.name.slice(0, 80), file: x.file, mime: x.mime, size: x.size, by: "Form" });
    }

    // an application in CRM → Applications
    if (s.createApplication && lead) {
      const reg = await Registration.create({
        tenant: form.tenant, lead: lead._id, name, phone: lead.phone, email, course: valueOf("course") || s.course || "", appNo: refNo, token: newToken(),
        data: { form: form.name, formId: form._id, submission: sub._id, answers: Object.fromEntries(answers.map((x) => [x.label, x.value])) },
        stage: "Submitted", stageHistory: [{ stage: "Submitted", by: "Form", at: new Date() }],
      });
      sub.registration = reg._id;
    }

    // the fee: a payment link the applicant can pay now or later
    let payUrl = "";
    const amount = lead ? feeAmount(form, data) : 0;
    if (amount > 0) {
      const fee = await LeadFee.create({ tenant: form.tenant, lead: lead._id, title: `${s.fee.title || "Fee"} · ${refNo}`, amount, token: newToken(), by: "Form" });
      sub.fee = fee._id; sub.amount = amount;
      payUrl = `${await appUrl(form.tenant)}/pay/${fee.token}`;
    }
    await sub.save();

    // tell the team
    const base = await appUrl(form.tenant);
    const subject = `${form.name}: ${name || refNo}`;
    if (s.notifyOwner && lead?.owner && lead.owner !== "Unassigned") {
      const u: any = await User.findOne({ tenant: form.tenant, name: lead.owner }).select("_id").lean();
      if (u) await notify({ tenantId: form.tenant, users: [u._id], category: "crm_lead", title: `New ${form.name}`, body: `${name} · ${refNo}`, link: `/crm/forms/${form._id}?tab=submissions&s=${sub._id}` }).catch(() => undefined);
    }
    for (const to of s.notifyEmails || []) await sendEmail({ to, subject, html: `<p><b>${esc(form.name)}</b> · ${esc(refNo)}</p>${answersHtml(answers)}<p><a href="${base}/crm/forms/${form._id}?tab=submissions&s=${sub._id}">Open in CRM</a></p>` }).catch(() => undefined);
    // and the person who filled it
    const receipt = `${base}/f/receipt/${sub.token}`;
    const reply = (s.replyText || s.successMessage || "Thank you.").replace(/\{name\}/g, name || "").replace(/\{ref\}/g, refNo);
    if (s.replyEmail && email) await sendEmail({ to: email, subject: `${form.name} · ${refNo}`, html: `<p>${esc(reply).replace(/\n/g, "<br>")}</p>${answersHtml(answers)}<p><a href="${receipt}">View your submission</a>${payUrl ? ` · <a href="${payUrl}">Pay ${esc(s.fee.title)}</a>` : ""}</p>` }).catch(() => undefined);
    if (s.replyWhatsApp && phone) await sendText(String(form.tenant), cleanPhone(phone), `${reply}\n\n${receipt}${payUrl ? `\nPay: ${payUrl}` : ""}`).catch(() => undefined);

    ok(res, { refNo, token: sub.token, message: (s.successMessage || "").replace(/\{name\}/g, name || "").replace(/\{ref\}/g, refNo), redirectUrl: s.redirectUrl, payUrl, amount, receipt }, 201);
  } finally {
    await dropTemp(files);
  }
}));

/** the person's own copy of what they sent */
publicFormRoutes.get("/public/form-receipt/:token", asyncHandler(async (req: any, res: any) => {
  const s: any = await CrmFormSubmission.findOne({ token: str(req.params.token, 60), status: { $ne: "draft" } }).lean();
  if (!s) throw new ApiError(404, "This link is not valid");
  const form: any = await CrmForm.findById(s.form).lean();
  await syncPaid([s]);
  const [org, fee, reg] = await Promise.all([
    OrganizationDetails.findOne({ tenant: s.tenant }).select("name logo").lean(),
    s.fee ? LeadFee.findById(s.fee).select("title amount discount paidAmount status token").lean() : null,
    s.registration ? Registration.findById(s.registration).select("stage token").lean() : null,
  ]);
  const base = await appUrl(s.tenant);
  const STATUS: Record<string, string> = { new: "Received", review: "Under review", accepted: "Accepted", rejected: "Not accepted" };
  ok(res, {
    form: form?.name || "", refNo: s.refNo, submittedAt: s.submittedAt, status: reg ? (reg as any).stage : STATUS[s.status] || "Received",
    organisation: (org as any)?.name || "", logo: form?.theme?.logo || (org as any)?.logo || "", color: form?.theme?.color || "",
    answers: labelled(form?.pages || [], s.data || {}, s.files || []).filter((x) => x.type !== "hidden"),
    fee: fee ? { title: (fee as any).title, amount: (fee as any).amount - ((fee as any).discount || 0), balance: feeBalance(fee as any), paid: s.paid || (fee as any).status === "paid", link: `${base}/pay/${(fee as any).token}` } : null,
    applicationLink: reg ? `${base}/application/${(reg as any).token}` : "",
  });
}));

export default r;
