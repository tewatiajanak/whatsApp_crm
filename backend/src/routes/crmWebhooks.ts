import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import { Types } from "mongoose";
import { asyncHandler } from "../utils/http";
import { Lead } from "../models/Lead";
import { LeadActivity } from "../models/LeadActivity";
import { LeadApiKey } from "../models/CrmExtras";
import { captureEnquiry } from "../services/leadCapture";
import { logActivity, refreshLead } from "../services/leadService";
import { telephonyToken } from "../services/crmChannels";
import { hashKey } from "./crm";
import cors from "cors";
import { User } from "../models/User";
import { FollowUp } from "../models/FollowUp";
import { EmailTrack, WebVisit } from "../models/CrmMore";
import { convertToLead, findLeadByPhone } from "../services/leadService";
import { notify, appUrl } from "../services/pm/messages";
import { crmSettingsFor } from "../models/CrmExtras";
import { googleCallback } from "../services/crmIntegrations";

/**
 * Public endpoints other systems call, mounted under /webhooks:
 *
 *   POST /leads/:key              push a lead in (ad platforms, portals, your website)
 *   POST /telephony/:tenantId     the calling provider reports how a call ended
 */
const r = Router();
r.use(express.urlencoded({ extended: true, limit: "200kb" }));

const limiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });

/** Google Ads lead forms send [{ column_id: "PHONE_NUMBER", string_value: "…" }]; flatten that to plain fields. */
function flatten(body: any): Record<string, any> {
  if (!body || typeof body !== "object") return {};
  const out: Record<string, any> = { ...body };
  const GOOGLE: Record<string, string> = { FULL_NAME: "name", FIRST_NAME: "first_name", LAST_NAME: "last_name", PHONE_NUMBER: "phone", EMAIL: "email", CITY: "city", REGION: "state", POSTAL_CODE: "pincode" };
  for (const c of Array.isArray(body.user_column_data) ? body.user_column_data : []) {
    const key = GOOGLE[c?.column_id] || String(c?.column_name || c?.column_id || "").toLowerCase();
    if (key && c?.string_value) out[key] = c.string_value;
  }
  if (!out.name && (out.first_name || out.last_name)) out.name = [out.first_name, out.last_name].filter(Boolean).join(" ");
  // portal pushes (IndiaMART, Justdial, …) use their own field names
  out.name = out.name || out.SENDER_NAME || out.leadname || out.customer_name;
  out.phone = out.phone || out.SENDER_MOBILE || out.mobile || out.customer_mobile;
  out.email = out.email || out.SENDER_EMAIL || out.customer_email;
  out.city = out.city || out.SENDER_CITY;
  out.message = out.message || out.QUERY_MESSAGE || out.enquiry || out.requirement;
  // Justdial: prefix + name, category, area · Shiksha / CollegeDekho / Careers360: student_*, course_name, preferred_city
  out.name = out.name || [out.prefix, out.student_name || out.studentName || out.lead_name || out.fullname].filter(Boolean).join(" ").trim() || undefined;
  out.phone = out.phone || out.student_mobile || out.studentMobile || out.contact_no || out.contactNumber || out.mobile_no;
  out.email = out.email || out.student_email || out.studentEmail || out.email_id;
  out.city = out.city || out.area || out.preferred_city || out.student_city;
  out.course = out.course || out.course_name || out.courseName || out.category || out.stream || out.program;
  out.message = out.message || out.query || out.remarks;
  if (body.campaign_id && !out.utm_campaign) out.utm_campaign = String(body.campaign_id);
  delete out.google_key; delete out.key; delete out.user_column_data;
  return out;
}

r.post("/leads/:key?", cors({ origin: true }), limiter, asyncHandler(async (req: any, res: any) => {
  const key = String(req.params.key || req.headers["x-api-key"] || req.body?.google_key || req.query.key || "");
  const apiKey = key ? await LeadApiKey.findOne({ keyHash: hashKey(key), active: true }) : null;
  if (!apiKey) return res.status(401).json({ ok: false, error: "Unknown or inactive key" });
  try {
    const rows = Array.isArray(req.body) ? req.body.slice(0, 100) : [req.body];
    let created = 0;
    for (const row of rows) {
      const result = await captureEnquiry(apiKey.tenant, flatten(row), `API: ${apiKey.name}`, { source: apiKey.source ? String(apiKey.source) : undefined, owner: apiKey.owner || undefined, user: apiKey.name });
      if (result.created) created++;
    }
    await LeadApiKey.updateOne({ _id: apiKey._id }, { $inc: { hits: rows.length }, $set: { lastUsedAt: new Date(), lastError: "" } });
    res.json({ ok: true, received: rows.length, created });
  } catch (e: any) {
    await LeadApiKey.updateOne({ _id: apiKey._id }, { $set: { lastUsedAt: new Date(), lastError: String(e?.message || e).slice(0, 200) } });
    res.status(e?.status || 500).json({ ok: false, error: e?.status ? e.message : "Could not save the lead" });
  }
}));

const OUTCOME: Record<string, string> = { completed: "Connected", answered: "Connected", "no-answer": "No answer", "no answer": "No answer", busy: "Busy", failed: "No answer", canceled: "No answer", cancelled: "No answer" };

r.post("/telephony/:tenantId", limiter, asyncHandler(async (req: any, res: any) => {
  const { tenantId } = req.params;
  if (!Types.ObjectId.isValid(tenantId) || req.query.k !== telephonyToken(tenantId)) return res.status(401).json({ ok: false });
  res.json({ ok: true });

  const b = req.body || {};
  const [leadId, user] = String(b.CustomField || b.reference || "").split("|");
  const callId = String(b.CallSid || b.callId || b.id || "");
  const lead = Types.ObjectId.isValid(leadId) ? await Lead.findOne({ _id: leadId, tenant: tenantId }) : null;
  if (!lead) return;
  const outcome = OUTCOME[String(b.Status || b.status || "").toLowerCase()] || "Connected";
  const seconds = Number(b.ConversationDuration ?? b.duration ?? b.Duration) || 0;
  const recording = String(b.RecordingUrl || b.recordingUrl || "");
  const detail = [seconds ? `${Math.ceil(seconds / 60)} min` : "", recording ? "Recorded" : ""].filter(Boolean).join(" · ");
  const meta = { callId, outcome, direction: "outgoing", durationMin: Math.ceil(seconds / 60), recordingUrl: recording };

  // finish the "dialling" entry written when the call was placed, or add one
  const pending = callId ? await LeadActivity.findOne({ tenant: tenantId, lead: lead._id, type: "call", "meta.callId": callId }) : null;
  if (pending) await LeadActivity.updateOne({ _id: pending._id }, { $set: { title: `Outgoing call · ${outcome}`, detail, meta } });
  else await logActivity({ tenant: tenantId, lead: lead._id, type: "call", by: user || "Telephony", title: `Outgoing call · ${outcome}`, detail, meta });

  const now = new Date();
  if (!lead.firstContactedAt) lead.firstContactedAt = now;
  lead.lastContactedAt = now;
  lead.lastActivity = now;
  await lead.save();
  await refreshLead(lead);
}));

/* ───────────── incoming and missed calls ─────────────
   POST|GET /telephony/:tenantId/incoming?k=…  with the caller's number (From / CallFrom / from).
   The reply is the number to ring: the lead's owner. A caller we do not know becomes a lead. */
r.all("/telephony/:tenantId/incoming", limiter, asyncHandler(async (req: any, res: any) => {
  const { tenantId } = req.params;
  if (!Types.ObjectId.isValid(tenantId) || req.query.k !== telephonyToken(tenantId)) return res.status(401).send("");
  const b = { ...req.query, ...(req.body || {}) };
  const from = String(b.CallFrom || b.From || b.from || b.caller || "");
  if (from.replace(/\D/g, "").length < 7) return res.status(400).send("");
  const missed = /missed|no-?answer|busy|failed/i.test(String(b.Status || b.status || b.CallType || ""));

  let lead = await findLeadByPhone(tenantId, from);
  if (!lead) lead = (await convertToLead({ tenant: tenantId, name: `Caller ${from.slice(-4)}`, phone: from, sourceKeyOrId: "Inbound call", capturedFrom: missed ? "Missed call" : "Incoming call", user: "Telephony" })).lead;
  await logActivity({ tenant: tenantId, lead: lead._id, type: "call", by: "Telephony", title: `Incoming call · ${missed ? "Missed" : "Received"}`, meta: { direction: "incoming", outcome: missed ? "No answer" : "Connected", callId: String(b.CallSid || b.callId || "") } });
  const owner: any = lead.owner && lead.owner !== "Unassigned" ? await User.findOne({ tenant: tenantId, name: lead.owner, status: "Active" }).select("mobile").lean() : null;
  if (missed) {
    // a missed call is a promise to call back
    const due = new Date(Date.now() + 15 * 60_000);
    await FollowUp.create({ tenant: tenantId, lead: lead._id, leadName: lead.name, phone: lead.phone, due, dueDate: due, type: "Call", note: "Call back — missed call", owner: lead.owner, assignedTo: lead.owner, status: lead.status });
    if (owner) await notify({ tenantId, users: [owner._id], category: "crm_lead", title: `Missed call: ${lead.name}`, body: lead.phone, link: `/crm/leads?lead=${lead._id}` });
  } else if (!lead.firstContactedAt) {
    lead.firstContactedAt = new Date();
    lead.lastContactedAt = new Date();
    await lead.save();
  }
  await refreshLead(lead);
  // plain text: the number to connect the caller to (empty = let the provider's default flow run)
  res.type("text/plain").send(owner?.mobile ? String(owner.mobile).replace(/[^\d+]/g, "") : "");
}));

/* ───────────── IVR menu ─────────────
   ALL /telephony/:tenantId/ivr?k=…           → the menu to play (no digit yet)
   ALL /telephony/:tenantId/ivr?k=…&digits=2  → who to ring for that key
   Reply is TwiML-style XML with ?format=xml (Twilio, Plivo and compatible providers), else JSON
   { say, options } / plain text number — for providers where the flow is drawn in their dashboard (Exotel). */
const xml = (v: unknown) => String(v ?? "").replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

r.all("/telephony/:tenantId/ivr", limiter, asyncHandler(async (req: any, res: any) => {
  const { tenantId } = req.params;
  if (!Types.ObjectId.isValid(tenantId) || req.query.k !== telephonyToken(tenantId)) return res.status(401).send("");
  const b = { ...req.query, ...(req.body || {}) };
  const s = await crmSettingsFor(tenantId);
  const asXml = b.format === "xml";
  const digit = String(b.digits || b.Digits || b.digit || "").replace(/"/g, "").slice(0, 1);
  const from = String(b.CallFrom || b.From || b.from || "");
  const self = `${req.protocol}://${req.get("host")}${req.baseUrl}/telephony/${tenantId}/ivr?k=${req.query.k}${asXml ? "&format=xml" : ""}`;

  if (!s.ivr?.enabled || !s.ivr.options.length) return asXml ? res.type("text/xml").send("<Response><Hangup/></Response>") : res.json({ enabled: false });

  if (!digit) {
    if (asXml) return res.type("text/xml").send(`<Response><Gather numDigits="1" action="${xml(self)}" method="POST"><Say>${xml(s.ivr.greeting)}</Say></Gather><Redirect>${xml(self)}</Redirect></Response>`);
    return res.json({ say: s.ivr.greeting, options: s.ivr.options.map((o) => ({ digit: o.digit, label: o.label })) });
  }

  const opt = s.ivr.options.find((o) => o.digit === digit);
  let number = "";
  if (opt) {
    // "owner" = the caller's own counsellor · "user:<name>" = that person · anything else is a phone number
    if (opt.target === "owner") {
      const lead = from ? await findLeadByPhone(tenantId, from) : null;
      const owner: any = lead?.owner && lead.owner !== "Unassigned" ? await User.findOne({ tenant: tenantId, name: lead.owner, status: "Active" }).select("mobile").lean() : null;
      number = owner?.mobile || "";
    } else if (opt.target.startsWith("user:")) {
      const u: any = await User.findOne({ tenant: tenantId, name: opt.target.slice(5), status: "Active", crmAway: { $ne: true } }).select("mobile").lean();
      number = u?.mobile || "";
    } else {
      number = opt.target;
    }
    number = String(number).replace(/[^\d+]/g, "");
    const lead = from.replace(/\D/g, "").length >= 7 ? await findLeadByPhone(tenantId, from) : null;
    if (lead) await logActivity({ tenant: tenantId, lead: lead._id, type: "call", by: "Telephony", title: `Incoming call · chose "${opt.label || opt.digit}"`, meta: { direction: "incoming", ivr: opt.digit } });
  }
  if (asXml) return res.type("text/xml").send(number ? `<Response><Dial>${xml(number)}</Dial></Response>` : `<Response><Say>Sorry, nobody is available right now. We will call you back.</Say><Hangup/></Response>`);
  res.type("text/plain").send(number);
}));

/* ───────────── Google sends a person back here after they allow calendar access ───────────── */
r.get("/google/callback", asyncHandler(async (req: any, res: any) => {
  const base = `${req.protocol}://${req.get("host")}`;
  const apiBase = (process.env.PUBLIC_API_URL || base).replace(/\/+$/, "");
  try {
    const tenant = await googleCallback(String(req.query.code || ""), String(req.query.state || ""), apiBase);
    res.redirect(302, `${await appUrl(tenant)}/crm?google=connected`);
  } catch (e: any) {
    res.status(400).type("text/plain").send(e?.message || "Could not connect Google Calendar");
  }
}));

/* ───────────── email: opens, clicks, replies ───────────── */

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

r.get("/e/o/:token.gif", asyncHandler(async (req: any, res: any) => {
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store" }).send(PIXEL);
  const t = await EmailTrack.findOneAndUpdate({ token: req.params.token }, { $inc: { opens: 1 } });
  if (t && !t.firstOpenAt) {
    await EmailTrack.updateOne({ _id: t._id, firstOpenAt: null }, { $set: { firstOpenAt: new Date() } });
    await logActivity({ tenant: t.tenant, lead: t.lead, type: "email", by: "Lead", title: "Opened an email", detail: t.subject });
  }
}));

r.get("/e/c/:token", asyncHandler(async (req: any, res: any) => {
  const url = String(req.query.u || "");
  // only ever forward to a web address — never to something a browser would run
  if (!/^https?:\/\//i.test(url)) return res.status(400).send("Bad link");
  const t = await EmailTrack.findOneAndUpdate({ token: req.params.token }, { $inc: { clicks: 1 } });
  if (!t) return res.status(404).send("Unknown link");
  res.redirect(302, url);
  if (t.clicks === 0) await logActivity({ tenant: t.tenant, lead: t.lead, type: "email", by: "Lead", title: "Clicked a link in an email", detail: `${t.subject} · ${url.slice(0, 120)}` });
}));

/** POST /email/:key — a mail service forwards replies here (SendGrid / Mailgun "inbound parse" style). */
r.post("/email/:key", limiter, asyncHandler(async (req: any, res: any) => {
  const apiKey = await LeadApiKey.findOne({ keyHash: hashKey(String(req.params.key || "")), active: true });
  if (!apiKey) return res.status(401).json({ ok: false, error: "Unknown or inactive key" });
  const b = req.body || {};
  const from = String(b.from || b.sender || b.From || "");
  const address = (/<([^>]+)>/.exec(from)?.[1] || from).trim().toLowerCase();
  const subject = String(b.subject || b.Subject || "").slice(0, 200);
  const text = String(b.text || b["stripped-text"] || b["body-plain"] || b.body || "").slice(0, 2000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return res.status(400).json({ ok: false, error: "No sender address" });
  const lead = await Lead.findOne({ tenant: apiKey.tenant, email: address });
  if (!lead) return res.json({ ok: true, matched: false });
  lead.lastActivity = new Date();
  await lead.save();
  await logActivity({ tenant: apiKey.tenant, lead: lead._id, type: "email", by: lead.name, title: `Email reply: ${subject || "(no subject)"}`, detail: text });
  const owner: any = lead.owner && lead.owner !== "Unassigned" ? await User.findOne({ tenant: apiKey.tenant, name: lead.owner, status: "Active" }).select("_id").lean() : null;
  if (owner) await notify({ tenantId: apiKey.tenant, users: [owner._id], category: "crm_lead", title: `${lead.name} replied by email`, body: subject, link: `/crm/leads?lead=${lead._id}` });
  await refreshLead(lead);
  res.json({ ok: true, matched: true });
}));

/* ───────────── website tracking + enquiry widget ─────────────
   <script src="…/webhooks/track.js?k=CAPTURE_KEY" async></script> on the website. */
const anyOrigin = cors({ origin: true, methods: ["GET", "POST", "OPTIONS"] });

r.get("/track.js", anyOrigin, (req: any, res: any) => {
  const key = String(req.query.k || "").replace(/[^A-Za-z0-9_-]/g, "");
  const base = `${req.protocol}://${req.get("host")}`;
  const api = (process.env.PUBLIC_API_URL || base).replace(/\/+$/, "");
  res.type("application/javascript").set("Cache-Control", "public, max-age=600").send(`(function(){
var K=${JSON.stringify(key)},A=${JSON.stringify(api)},d=document,w=window;
var v=localStorage.getItem("_crm_vid");if(!v){v=Date.now().toString(36)+Math.random().toString(36).slice(2,10);localStorage.setItem("_crm_vid",v);}
function post(p,b){try{return fetch(A+p,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b),keepalive:true});}catch(e){}}
function q(n){return new URLSearchParams(location.search).get(n)||"";}
["utm_source","utm_medium","utm_campaign","ref"].forEach(function(k){if(q(k))sessionStorage.setItem("_crm_"+k,q(k));});
post("/webhooks/track",{k:K,v:v,url:location.href,title:d.title,ref:d.referrer});
function extra(){var o={visitor_id:v};["utm_source","utm_medium","utm_campaign","ref"].forEach(function(k){var x=sessionStorage.getItem("_crm_"+k);if(x)o[k]=x;});return o;}
w.crmTrack={visitor:v,capture:function(f){return post("/webhooks/leads/"+K,Object.assign(extra(),f||{}));}};
if(d.currentScript&&d.currentScript.getAttribute("data-widget")==="off")return;
function el(t,s,h){var e=d.createElement(t);e.style.cssText=s;if(h)e.innerHTML=h;return e;}
var c=(d.currentScript&&d.currentScript.getAttribute("data-color"))||"#2249b7";
var btn=el("button","position:fixed;right:18px;bottom:18px;z-index:2147483000;background:"+c+";color:#fff;border:0;border-radius:24px;padding:12px 18px;font:600 14px system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.2)","Enquire now");
var box=el("div","position:fixed;right:18px;bottom:72px;z-index:2147483000;width:290px;max-width:calc(100vw - 36px);background:#fff;color:#111;border-radius:14px;padding:16px;font:14px system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25);display:none");
var I="width:100%;box-sizing:border-box;margin:0 0 8px;padding:9px 10px;border:1px solid #d1d5db;border-radius:8px;font:14px system-ui,sans-serif";
box.innerHTML='<div style="font-weight:600;margin-bottom:10px">Send us your enquiry</div><input placeholder="Your name" style="'+I+'"><input placeholder="Phone number" type="tel" style="'+I+'"><textarea placeholder="Message (optional)" rows="2" style="'+I+'"></textarea><div style="color:#b91c1c;font-size:12px;margin-bottom:6px"></div><button style="width:100%;background:'+c+';color:#fff;border:0;border-radius:8px;padding:10px;font:600 14px system-ui,sans-serif;cursor:pointer">Send</button>';
var f=box.querySelectorAll("input,textarea"),err=box.querySelectorAll("div")[1],go=box.querySelector("button");
btn.onclick=function(){box.style.display=box.style.display==="none"?"block":"none";};
go.onclick=function(){if(!f[0].value.trim()||f[1].value.replace(/\\D/g,"").length<7){err.textContent="Please enter your name and phone number.";return;}
go.disabled=true;go.textContent="Sending…";w.crmTrack.capture({name:f[0].value,phone:f[1].value,message:f[2].value}).then(function(r){if(r&&r.ok){box.innerHTML='<div style="font-weight:600">Thank you!</div><div style="margin-top:6px;color:#4b5563">We will call you shortly.</div>';}else{err.textContent="Could not send. Please try again.";go.disabled=false;go.textContent="Send";}});};
d.body.appendChild(btn);d.body.appendChild(box);
})();`);
});

r.options("/track", anyOrigin);
r.post("/track", anyOrigin, limiter, asyncHandler(async (req: any, res: any) => {
  res.json({ ok: true });
  const b = req.body || {};
  const visitor = String(b.v || "").replace(/[^a-z0-9]/gi, "").slice(0, 40);
  const apiKey = b.k ? await LeadApiKey.findOne({ keyHash: hashKey(String(b.k)), active: true }).select("tenant").lean() : null;
  if (!apiKey || visitor.length < 8) return;
  // a visitor who is already a lead: the page goes straight onto that lead
  const lead: any = await Lead.findOne({ tenant: apiKey.tenant, visitorId: visitor }).select("_id").lean();
  await WebVisit.create({ tenant: apiKey.tenant, visitor, lead: lead?._id || null, url: String(b.url || "").slice(0, 500), title: String(b.title || "").slice(0, 200), referrer: String(b.ref || "").slice(0, 300) });
}));
r.options("/leads/:key?", anyOrigin);

/* ───────────── calendar feed: a person's follow-ups, for Google Calendar / Outlook / Apple ───────────── */

const ics = (v: unknown) => String(v ?? "").replace(/\\/g, "\\\\").replace(/[;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

r.get("/calendar/:token.ics", asyncHandler(async (req: any, res: any) => {
  const user: any = await User.findOne({ crmToken: req.params.token, status: "Active" }).select("name tenant").lean();
  if (!user) return res.status(404).send("Not found");
  const fus = await FollowUp.find({ tenant: user.tenant, owner: user.name, due: { $gte: new Date(Date.now() - 7 * 86_400_000), $lte: new Date(Date.now() + 90 * 86_400_000) } }).sort({ due: 1 }).limit(1000).lean();
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lead CRM//Follow-ups//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:Follow-ups · ${ics(user.name)}`];
  for (const f of fus) {
    lines.push("BEGIN:VEVENT", `UID:${f._id}@lead-crm`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(new Date(f.due))}`, `DTEND:${stamp(new Date(new Date(f.due).getTime() + 30 * 60_000))}`,
      `SUMMARY:${ics(`${f.done ? "✓ " : ""}${f.type}: ${f.leadName || "Lead"}`)}`, `DESCRIPTION:${ics([f.note, f.phone].filter(Boolean).join("\n"))}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  res.type("text/calendar; charset=utf-8").set("Cache-Control", "no-store").send(lines.join("\r\n"));
}));

export default r;
