import { Router } from "express";
import { Types } from "mongoose";
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import { require_ } from "../middleware/auth";
import { ok, asyncHandler, ApiError, audit } from "../utils/http";
import { Lead } from "../models/Lead";
import { FollowUp } from "../models/FollowUp";
import { LeadActivity } from "../models/LeadActivity";
import { LeadStatus, LeadSource } from "../models/Masters";
import { Registration } from "../models/Registration";
import { Conversation, Template } from "../models/Messaging";
import { User } from "../models/User";
import { AISettings } from "../models/AISettings";
import { LeadFee, LeadDocument, crmSettingsFor, feeBalance, FEE_MODES } from "../models/CrmExtras";
import { LeadTrash, Course, Branch, Partner, SourceSpend, Approval, WebVisit, EmailTrack, PushSub } from "../models/CrmMore";
import { recordPayment, refundFee, newToken } from "../services/leadFees";
import { requestApproval, approvalRules } from "./crmApprovals";
import { logActivity, refreshLead, findLeadByPhone, assignableOwners, noteLeadMessaged, maskContacts, cleanPhone } from "../services/leadService";
import { guardLead, canSeeLead, leadOwnerScope, scopeLeadFilter, scopeFollowUpFilter } from "../services/leadAccess";
import { buildLeadFilter } from "../controllers/leadController";
import { fillLeadText } from "../services/alertsEngine";
import { sendText, sendTemplate } from "../services/whatsapp";
import { sendEmail } from "../services/email";
import { sendSms } from "../services/crmChannels";
import { trackedHtml } from "../services/emailTracking";
import { notify, appUrl } from "../services/pm/messages";
import { pushKeys } from "../services/push";
import { googleAuthUrl, googleReady } from "../services/crmIntegrations";
import { publicBase } from "../services/payments";
import { localDateTime, isDateKey, localDateKey, startOfLocalDay } from "../utils/dates";

/** Lead CRM, part two: recycle bin, masters, partners, spend, approvals, fee plans, bulk messages, chat, reports, calendar, push. */
const r = Router();
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const MONTH = /^\d{4}-\d{2}$/;
const tid = (req: any) => new Types.ObjectId(String(req.tenantId));

/* ───────────── recycle bin ───────────── */

r.get("/crm/trash", require_("leads", "del"), asyncHandler(async (req: any, res: any) => {
  const s = await crmSettingsFor(req.tenantId);
  const items = await LeadTrash.find({ tenant: req.tenantId }).select("-snapshot").sort({ deletedAt: -1 }).limit(500).lean();
  ok(res, { items: maskContacts(req, items), keepDays: s.trashDays });
}));

r.post("/crm/trash/:id/restore", require_("leads", "del"), asyncHandler(async (req: any, res: any) => {
  const t = await LeadTrash.findOne({ _id: req.params.id, tenant: req.tenantId });
  if (!t) throw new ApiError(404, "Not in the recycle bin");
  const snap = t.snapshot;
  const dup = await findLeadByPhone(req.tenantId, snap.lead.phone);
  if (dup) throw new ApiError(409, `${dup.name} now has this phone number. Merge or delete that lead first.`);
  // put everything back exactly as it was, under the same ids
  await Lead.collection.insertOne(snap.lead);
  if (snap.followUps?.length) await FollowUp.collection.insertMany(snap.followUps);
  if (snap.activities?.length) await LeadActivity.collection.insertMany(snap.activities);
  if (snap.fees?.length) await LeadFee.collection.insertMany(snap.fees);
  if (snap.documents?.length) await LeadDocument.collection.insertMany(snap.documents);
  await t.deleteOne();
  await logActivity({ tenant: req.tenantId, lead: snap.lead._id, type: "restored", by: req.auth?.name, title: "Restored from the recycle bin" });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "RESTORE", module: "Leads", entity: t.name });
  ok(res, { restored: true, leadId: snap.lead._id });
}));

/** Remove a binned lead for good, with its files. */
export async function purgeTrash(t: any) {
  for (const d of t.snapshot?.documents || []) {
    await fs.promises.unlink(path.join(process.cwd(), "uploads", "lead-docs", String(t.tenant), path.basename(d.file))).catch(() => undefined);
  }
  await LeadTrash.deleteOne({ _id: t._id });
}

r.delete("/crm/trash/:id", require_("leads", "del"), asyncHandler(async (req: any, res: any) => {
  const t = await LeadTrash.findOne({ _id: req.params.id, tenant: req.tenantId });
  if (!t) throw new ApiError(404, "Not in the recycle bin");
  await purgeTrash(t);
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "PURGE", module: "Leads", entity: t.name });
  ok(res, { deleted: true });
}));

/* ───────────── masters: courses and branches ───────────── */

function master(Mdl: any, pathName: string, label: string, fields: (b: any) => Record<string, any>) {
  r.get(`/crm/${pathName}`, require_("leads", "view"), asyncHandler(async (req: any, res: any) => ok(res, await Mdl.find({ tenant: req.tenantId }).sort({ name: 1 }).lean())));
  r.post(`/crm/${pathName}`, require_("setup", "create"), asyncHandler(async (req: any, res: any) => {
    if (!str(req.body?.name, 120)) throw new ApiError(400, `Name the ${label}`);
    ok(res, await Mdl.create({ ...fields(req.body), tenant: req.tenantId }), 201);
  }));
  r.patch(`/crm/${pathName}/:id`, require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
    const doc = await Mdl.findOneAndUpdate({ _id: req.params.id, tenant: req.tenantId }, { $set: fields(req.body) }, { new: true, runValidators: true });
    if (!doc) throw new ApiError(404, `${label} not found`);
    ok(res, doc);
  }));
  r.delete(`/crm/${pathName}/:id`, require_("setup", "del"), asyncHandler(async (req: any, res: any) => {
    if (!(await Mdl.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId }))) throw new ApiError(404, `${label} not found`);
    ok(res, { deleted: true });
  }));
}
const defined = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
master(Branch, "branches", "branch", (b) => defined({ name: b?.name === undefined ? undefined : str(b.name, 120), city: b?.city === undefined ? undefined : str(b.city, 80), active: b?.active === undefined ? undefined : !!b.active }));
master(Course, "courses", "course", (b) => defined({
  name: b?.name === undefined ? undefined : str(b.name, 160), intake: b?.intake === undefined ? undefined : str(b.intake, 60),
  fee: b?.fee === undefined ? undefined : Math.max(0, Number(b.fee) || 0), seats: b?.seats === undefined ? undefined : Math.max(0, Math.floor(Number(b.seats) || 0)),
  active: b?.active === undefined ? undefined : !!b.active,
}));

/** How full each course is: open leads, and won leads against the seats. */
r.get("/crm/course-seats", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const tenant = tid(req);
  const wonIds = (await LeadStatus.find({ tenant, isWon: true }).select("_id").lean()).map((s: any) => s._id);
  const lostIds = (await LeadStatus.find({ tenant, isLost: true }).select("_id").lean()).map((s: any) => s._id);
  const [courses, counts] = await Promise.all([
    Course.find({ tenant }).sort({ name: 1 }).lean(),
    Lead.aggregate([{ $match: { tenant, course: { $nin: ["", null] } } }, { $group: {
      _id: "$course", total: { $sum: 1 },
      won: { $sum: { $cond: [{ $in: ["$status", wonIds] }, 1, 0] } },
      open: { $sum: { $cond: [{ $in: ["$status", [...wonIds, ...lostIds]] }, 0, 1] } },
    } }]),
  ]);
  ok(res, courses.map((c: any) => { const n: any = counts.find((x: any) => x._id === c.name) || {}; return { ...c, leads: n.total || 0, open: n.open || 0, filled: n.won || 0, left: c.seats ? Math.max(0, c.seats - (n.won || 0)) : null }; }));
}));

/* ───────────── referral partners ───────────── */

async function partnerStats(tenant: any, partners: any[]) {
  const ids = partners.map((p) => p._id);
  const wonIds = (await LeadStatus.find({ tenant, isWon: true }).select("_id").lean()).map((s: any) => s._id);
  const leads = await Lead.find({ tenant, partner: { $in: ids } }).select("partner status").lean();
  const paid = await LeadFee.aggregate([{ $match: { tenant, lead: { $in: leads.map((l: any) => l._id) } } }, { $group: { _id: "$lead", paid: { $sum: "$paidAmount" } } }]);
  const paidBy = new Map(paid.map((x: any) => [String(x._id), x.paid]));
  return partners.map((p) => {
    const mine = leads.filter((l: any) => String(l.partner) === String(p._id));
    const won = mine.filter((l: any) => wonIds.some((w) => String(w) === String(l.status)));
    const collected = mine.reduce((a, l: any) => a + (paidBy.get(String(l._id)) || 0), 0);
    const earned = p.commissionType === "percent_paid" ? Math.round(collected * (p.rate || 0)) / 100 : won.length * (p.rate || 0);
    return { ...p, leads: mine.length, won: won.length, collected, earned, due: Math.max(0, earned - (p.paidOut || 0)) };
  });
}

r.get("/crm/partners", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const partners = await Partner.find({ tenant: req.tenantId }).sort({ name: 1 }).lean();
  const base = await appUrl(req.tenantId);
  ok(res, (await partnerStats(tid(req), partners)).map((p: any) => ({ ...p, link: `${base}/partner/${p.token}` })));
}));

const partnerFields = (b: any) => defined({
  name: b?.name === undefined ? undefined : str(b.name, 120), phone: b?.phone === undefined ? undefined : cleanPhone(b.phone), email: b?.email === undefined ? undefined : str(b.email, 200).toLowerCase(),
  commissionType: b?.commissionType === undefined ? undefined : b.commissionType === "percent_paid" ? "percent_paid" : "per_win",
  rate: b?.rate === undefined ? undefined : Math.max(0, Number(b.rate) || 0), active: b?.active === undefined ? undefined : !!b.active,
});

r.post("/crm/partners", require_("setup", "create"), asyncHandler(async (req: any, res: any) => {
  const name = str(req.body?.name, 120);
  if (!name) throw new ApiError(400, "Name the partner");
  const code = (str(req.body?.code, 20) || name.replace(/[^a-z0-9]/gi, "").slice(0, 6) + randomBytes(2).toString("hex")).toUpperCase();
  ok(res, await Partner.create({ ...partnerFields(req.body), name, code, token: newToken(), tenant: req.tenantId }), 201);
}));
r.patch("/crm/partners/:id", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const set: any = partnerFields(req.body);
  // a payout adds to what was already paid; it is never typed in as a total
  const payout = Number(req.body?.payout);
  const update: any = { $set: set };
  if (Number.isFinite(payout) && payout > 0) update.$inc = { paidOut: payout };
  const doc = await Partner.findOneAndUpdate({ _id: req.params.id, tenant: req.tenantId }, update, { new: true });
  if (!doc) throw new ApiError(404, "Partner not found");
  if (update.$inc) await audit({ tenant: req.tenantId, user: req.auth?.name, action: "PAYOUT", module: "Partners", entity: doc.name, next: money(payout) });
  ok(res, doc);
}));
r.delete("/crm/partners/:id", require_("setup", "del"), asyncHandler(async (req: any, res: any) => {
  const doc = await Partner.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
  if (!doc) throw new ApiError(404, "Partner not found");
  await Lead.updateMany({ tenant: req.tenantId, partner: doc._id }, { $set: { partner: null } });
  ok(res, { deleted: true });
}));

/* ───────────── what was spent on each source ───────────── */

r.get("/crm/spend", require_("conversion", "view"), asyncHandler(async (req: any, res: any) => {
  const month = MONTH.test(str(req.query.month)) ? str(req.query.month) : localDateKey().slice(0, 7);
  ok(res, { month, rows: await SourceSpend.find({ tenant: req.tenantId, month }).lean() });
}));
r.put("/crm/spend", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const month = str(req.body?.month);
  if (!MONTH.test(month)) throw new ApiError(400, "Choose a month");
  const sources = new Set((await LeadSource.find({ tenant: req.tenantId }).select("_id").lean()).map((s: any) => String(s._id)));
  let saved = 0;
  for (const row of Array.isArray(req.body?.rows) ? req.body.rows : []) {
    if (!sources.has(String(row?.source))) continue;
    await SourceSpend.updateOne({ tenant: req.tenantId, month, source: row.source }, { $set: { amount: Math.max(0, Number(row.amount) || 0) } }, { upsert: true });
    saved++;
  }
  ok(res, { saved });
}));

/* ───────────── fees: part payment, refund, instalment plan, discount approval ───────────── */

const feeFor = async (req: any) => {
  const fee = Types.ObjectId.isValid(req.params.feeId) ? await LeadFee.findOne({ _id: req.params.feeId, tenant: req.tenantId }) : null;
  if (!fee || !(await canSeeLead(req, fee.lead))) throw new ApiError(404, "Fee not found");
  return fee;
};

r.post("/lead-fees/:feeId/refund", require_("leads", "del"), asyncHandler(async (req: any, res: any) => {
  const isAdmin = (req.perms || []).some((p: any) => p.module === "setup" && p.edit);
  if ((await approvalRules(req.tenantId)).refund.enabled && !isAdmin) { const e: any = new ApiError(409, "Refunds need approval. Ask for approval instead."); e.details = { needsApproval: true }; throw e; }
  ok(res, await refundFee(await feeFor(req), { amount: Number(req.body?.amount), reason: str(req.body?.reason, 300), by: req.auth?.name }));
}));

r.post("/leads/:id/fee-plan", require_("leads", "edit"), guardLead, asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const total = Number(b.total);
  const count = Math.floor(Number(b.instalments));
  const every = Math.max(1, Math.floor(Number(b.everyDays) || 30));
  if (!str(b.title, 100)) throw new ApiError(400, "Say what the plan is for");
  if (!Number.isFinite(total) || total <= 0) throw new ApiError(400, "Enter the total amount");
  if (!(count >= 2 && count <= 24)) throw new ApiError(400, "Choose between 2 and 24 instalments");
  if (!isDateKey(b.firstDue)) throw new ApiError(400, "Choose when the first instalment is due");
  const plan = newToken();
  const each = Math.floor((total / count) * 100) / 100;
  const first = localDateTime(b.firstDue, "23:59").getTime();
  const fees: any[] = [];
  for (let i = 0; i < count; i++) {
    // the last instalment absorbs the rounding, so the parts always add up to the total
    const amount = i === count - 1 ? Math.round((total - each * (count - 1)) * 100) / 100 : each;
    fees.push(await LeadFee.create({
      tenant: req.tenantId, lead: req.params.id, title: `${str(b.title, 100)} · ${i + 1} of ${count}`, amount,
      dueDate: new Date(first + i * every * 86_400_000), token: newToken(), plan, by: req.auth?.name || "System",
    }));
  }
  await logActivity({ tenant: req.tenantId, lead: req.params.id, type: "payment", by: req.auth?.name, title: `Fee plan · ${money(total)} in ${count} instalments`, detail: str(b.title, 100) });
  ok(res, fees, 201);
}));

r.post("/lead-fees/:feeId/discount-request", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const fee = await feeFor(req);
  const amount = Math.round(Number(req.body?.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0 || amount > feeBalance(fee)) throw new ApiError(400, `The concession must be between ₹1 and ${money(feeBalance(fee))}`);
  if (!str(req.body?.reason, 300)) throw new ApiError(400, "Say why the concession is needed");
  if (await Approval.exists({ tenant: req.tenantId, fee: fee._id, kind: "fee_discount", status: "pending" })) throw new ApiError(400, "A concession on this fee is already waiting for approval");
  const lead: any = await Lead.findById(fee.lead).select("name").lean();
  // the approval rules decide: approved at once under the limit, or one / two approvers
  const out = await requestApproval(req, { kind: "fee_discount", lead: fee.lead, leadName: lead?.name || "", fee: fee._id, feeTitle: fee.title, amount, reason: str(req.body.reason, 300), link: `/crm/leads?lead=${fee.lead}` });
  ok(res, { ...out.approval.toObject(), auto: out.auto }, 201);
}));

/* approvals list and decisions: routes/crmApprovals.ts */

/* ───────────── message many leads at once ───────────── */

r.post("/leads/bulk-message", require_("blast", "create"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const channel = ["whatsapp", "sms", "email"].includes(b.channel) ? b.channel : "";
  if (!channel) throw new ApiError(400, "Choose WhatsApp, SMS or email");
  const text = str(b.text, 2000);
  const template = str(b.template, 200);
  if (!text && !template) throw new ApiError(400, "Write a message or choose a template");
  let filter: any;
  if (b.allMatching) filter = await buildLeadFilter(req, b.filters || {});
  else filter = await scopeLeadFilter(req, { tenant: req.tenantId, _id: { $in: (Array.isArray(b.ids) ? b.ids : []).filter((x: any) => Types.ObjectId.isValid(String(x))) } });
  const leads = await Lead.find(filter).limit(501);
  if (!leads.length) throw new ApiError(400, "Select at least one lead");
  if (leads.length > 500) throw new ApiError(400, "Message at most 500 leads at a time. For more, use a campaign.");
  const tpl = template && channel !== "whatsapp" ? await Template.findOne({ tenant: req.tenantId, name: template }) : null;

  const out = { sent: 0, skipped: 0, failed: 0, reasons: [] as string[] };
  const skip = (why: string) => { out.skipped++; if (!out.reasons.includes(why)) out.reasons.push(why); };
  for (const lead of leads) {
    if (lead.doNotContact?.[channel as "whatsapp" | "sms" | "email"]) { skip("Asked not to be contacted"); continue; }
    if (channel === "email" && !lead.email) { skip("No email address"); continue; }
    try {
      const body = fillLeadText(tpl?.body || text, lead);
      if (channel === "whatsapp") {
        if (template) await sendTemplate(req.tenantId, lead.phone, template, str(b.language, 10) || "en", []);
        else await sendText(req.tenantId, lead.phone, body);
      } else if (channel === "sms") {
        await sendSms(req.tenantId, lead.phone, body, str(b.dltTemplateId, 60));
      } else {
        const subject = fillLeadText(str(b.subject, 200) || "A message for you", lead);
        await sendEmail({ to: lead.email!, subject, html: await trackedHtml(req.tenantId, lead._id, subject, body.replace(/\n/g, "<br>")), text: body });
      }
      await noteLeadMessaged(req.tenantId, channel === "email" ? lead.email! : lead.phone, channel, req.auth?.name, template ? `Template: ${template}` : body);
      out.sent++;
    } catch (e: any) {
      out.failed++;
      const why = String(e?.message || e).slice(0, 120);
      if (out.reasons.length < 5 && !out.reasons.includes(why)) out.reasons.push(why);
      // a gateway that is not set up fails every time: stop instead of failing 500 times
      if (/not set up/i.test(why)) break;
    }
  }
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "BULK_MESSAGE", module: "Leads", entity: `${out.sent} sent`, next: channel });
  ok(res, out);
}));

/* ───────────── a lead's WhatsApp chat, website visits and emails ───────────── */

r.get("/leads/:id/conversation", require_("leads", "view"), guardLead, asyncHandler(async (req: any, res: any) => {
  const lead: any = await Lead.findOne({ _id: req.params.id, tenant: req.tenantId }).select("phone phoneKey").lean();
  const conv: any = await Conversation.findOne({ tenant: req.tenantId, $or: [{ lead: lead._id }, { phone: new RegExp(`${lead.phoneKey}$`) }] }).sort({ updatedAt: -1 }).lean();
  if (!conv) return ok(res, { conversation: null, messages: [], windowOpen: false });
  ok(res, { conversation: { _id: conv._id, unread: conv.unread, windowExpiresAt: conv.windowExpiresAt }, messages: (conv.messages || []).slice(-200), windowOpen: new Date(conv.windowExpiresAt).getTime() > Date.now() });
}));

r.get("/leads/:id/web-activity", require_("leads", "view"), guardLead, asyncHandler(async (req: any, res: any) => {
  const [visits, emails] = await Promise.all([
    WebVisit.find({ tenant: req.tenantId, lead: req.params.id }).sort({ at: -1 }).limit(100).lean(),
    EmailTrack.find({ tenant: req.tenantId, lead: req.params.id }).sort({ sentAt: -1 }).limit(50).select("-token").lean(),
  ]);
  ok(res, { visits, emails });
}));

/* ───────────── what to do next, and a summary ───────────── */

/** Ask the tenant's configured AI for a short answer. Returns "" when AI is off or fails. */
async function aiText(tenant: any, prompt: string): Promise<string> {
  try {
    const cfg: any = await AISettings.findOne({ tenant }).lean();
    if (!cfg?.enabled || !cfg.apiKey) return "";
    const key = cfg.apiKey.trim();
    if (cfg.provider === "gemini") {
      const r1 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model || "gemini-1.5-flash"}:generateContent?key=${key}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
      });
      const d: any = await r1.json();
      return r1.ok ? String(d?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim() : "";
    }
    if (cfg.provider === "claude") {
      const r1 = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: cfg.model || "claude-sonnet-5-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
      });
      const d: any = await r1.json();
      return r1.ok ? String(d?.content?.[0]?.text || "").trim() : "";
    }
    const r1 = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: cfg.model || "gpt-4o-mini", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
    });
    const d: any = await r1.json();
    return r1.ok ? String(d?.choices?.[0]?.message?.content || "").trim() : "";
  } catch {
    return "";
  }
}

r.get("/leads/:id/brief", require_("leads", "view"), guardLead, asyncHandler(async (req: any, res: any) => {
  const tenant = req.tenantId;
  const lead: any = await Lead.findOne({ _id: req.params.id, tenant }).populate("status", "name isWon isLost").populate("source", "name").lean();
  const [acts, nextFu, pendingFees, calls] = await Promise.all([
    LeadActivity.find({ tenant, lead: lead._id }).sort({ at: -1 }).limit(25).select("type title detail by at").lean(),
    FollowUp.findOne({ tenant, lead: lead._id, done: false }).sort({ due: 1 }).lean(),
    LeadFee.find({ tenant, lead: lead._id, status: "pending" }).lean(),
    LeadActivity.find({ tenant, lead: lead._id, type: "call" }).sort({ at: -1 }).limit(5).select("meta").lean(),
  ]);
  const idleDays = Math.floor((Date.now() - new Date(lead.lastActivity || lead.createdAt).getTime()) / 86_400_000);
  const missed = calls.filter((c: any) => c.meta?.outcome && c.meta.outcome !== "Connected").length;
  const due = pendingFees.reduce((a, f) => a + feeBalance(f), 0);

  // one clear next step, most urgent first
  let action: { text: string; kind: string };
  if (lead.status?.isWon) action = due ? { text: `Collect the pending ${money(due)}`, kind: "fee" } : { text: "Won — ask for a referral", kind: "none" };
  else if (lead.status?.isLost) action = { text: "Lost — nothing to do unless they come back", kind: "none" };
  else if (lead.doNotContact?.call && lead.doNotContact?.whatsapp) action = { text: "Asked not to be contacted — email only", kind: "none" };
  else if (!lead.firstContactedAt) action = { text: "Make the first call now — not contacted yet", kind: "call" };
  else if (nextFu && new Date(nextFu.due).getTime() < startOfLocalDay().getTime()) action = { text: `Do the overdue ${String(nextFu.type).toLowerCase()} follow-up`, kind: "followup" };
  else if (missed >= 3) action = { text: "Three calls unanswered — send a WhatsApp instead", kind: "message" };
  else if (!nextFu) action = { text: "No follow-up planned — schedule the next one", kind: "followup" };
  else if (due) action = { text: `Remind about the pending ${money(due)}`, kind: "fee" };
  else if (idleDays >= 7) action = { text: `Quiet for ${idleDays} days — check in`, kind: "message" };
  else action = { text: `Next ${String(nextFu.type).toLowerCase()} is planned for ${localDateKey(nextFu.due).split("-").reverse().join("-")}`, kind: "none" };

  const facts = [
    `${lead.status?.name || "No status"} · score ${lead.score} · ${lead.priority}`,
    lead.source?.name ? `Came from ${lead.source.name}` : "",
    lead.course ? `Interested in ${lead.course}` : "",
    lead.currentRemark ? `Last remark: ${lead.currentRemark}` : "",
    due ? `${money(due)} pending` : "",
  ].filter(Boolean);
  let summary = "";
  if (req.query.ai === "1") {
    const history = acts.map((a: any) => `${localDateKey(a.at)} ${a.title}${a.detail ? `: ${a.detail}` : ""}`).join("\n");
    summary = await aiText(tenant, `You are helping an admissions counsellor. In at most 3 short sentences, summarise where this lead stands and what matters to them. Plain text only.\n\nLead: ${lead.name}\n${facts.join("\n")}\n\nRecent history (newest first):\n${history}`);
  }
  ok(res, { action, facts, summary, aiUsed: !!summary });
}));

/* ───────────── report builder ───────────── */

const GROUPS: Record<string, { label: string; expr: any }> = {
  status: { label: "Status", expr: "$status" },
  source: { label: "Source", expr: "$source" },
  owner: { label: "Owner", expr: "$owner" },
  priority: { label: "Priority", expr: "$priority" },
  course: { label: "Course", expr: "$course" },
  city: { label: "City", expr: "$city" },
  state: { label: "State", expr: "$state" },
  branch: { label: "Branch", expr: "$branch" },
  grade: { label: "Grade", expr: "$grade" },
  capturedFrom: { label: "Captured from", expr: "$capturedFrom" },
  campaign: { label: "Campaign", expr: "$utm.campaign" },
  lostReason: { label: "Lost reason", expr: "$lostReason" },
  month: { label: "Month created", expr: { $dateToString: { format: "%Y-%m", date: "$createdAt", timezone: "+05:30" } } },
  day: { label: "Day created", expr: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "+05:30" } } },
};

r.get("/leads/report", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const tenant = tid(req);
  const g1 = GROUPS[str(req.query.groupBy)] ? str(req.query.groupBy) : "status";
  const g2 = GROUPS[str(req.query.groupBy2)] && str(req.query.groupBy2) !== g1 ? str(req.query.groupBy2) : "";
  const filter = await buildLeadFilter(req);
  filter.tenant = tenant;
  const [statuses, sources] = await Promise.all([LeadStatus.find({ tenant }).select("name isWon isLost").lean(), LeadSource.find({ tenant }).select("name").lean()]);
  const wonIds = statuses.filter((s: any) => s.isWon).map((s: any) => s._id);
  const lostIds = statuses.filter((s: any) => s.isLost).map((s: any) => s._id);
  const rows = await Lead.aggregate([
    { $match: filter },
    { $group: {
      _id: { a: GROUPS[g1].expr, ...(g2 ? { b: GROUPS[g2].expr } : {}) },
      leads: { $sum: 1 }, value: { $sum: "$value" }, score: { $avg: "$score" },
      won: { $sum: { $cond: [{ $in: ["$status", wonIds] }, 1, 0] } },
      lost: { $sum: { $cond: [{ $in: ["$status", lostIds] }, 1, 0] } },
      wonValue: { $sum: { $cond: [{ $in: ["$status", wonIds] }, "$value", 0] } },
    } },
    { $sort: { leads: -1 } },
    { $limit: 2000 },
  ]);
  const names = new Map<string, string>([...statuses, ...sources].map((x: any) => [String(x._id), x.name]));
  const label = (v: any) => (v === null || v === undefined || v === "" ? "—" : names.get(String(v)) || String(v));
  const out = rows.map((x: any) => ({
    a: label(x._id.a), b: g2 ? label(x._id.b) : undefined, leads: x.leads, won: x.won, lost: x.lost, open: x.leads - x.won - x.lost,
    conversion: x.leads ? +((x.won / x.leads) * 100).toFixed(1) : 0, value: x.value, wonValue: x.wonValue, avgScore: Math.round(x.score || 0),
  }));
  if (g1 === "month" || g1 === "day") out.sort((p, q) => String(p.a).localeCompare(String(q.a)));

  if (req.query.format === "csv") {
    const cell = (v: unknown) => { let s = v === undefined || v === null ? "" : String(v); if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
    const head = [GROUPS[g1].label, ...(g2 ? [GROUPS[g2].label] : []), "Leads", "Open", "Won", "Lost", "Conversion %", "Pipeline value", "Won value", "Average score"];
    const lines = [head.map(cell).join(","), ...out.map((x) => [x.a, ...(g2 ? [x.b] : []), x.leads, x.open, x.won, x.lost, x.conversion, x.value, x.wonValue, x.avgScore].map(cell).join(","))];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="lead-report-${localDateKey()}.csv"`);
    return res.send("﻿" + lines.join("\r\n"));
  }
  ok(res, { groupBy: g1, groupBy2: g2, groups: Object.entries(GROUPS).map(([key, v]) => ({ key, label: v.label })), rows: out });
}));

/* ───────────── calendar, booking link, who is away ───────────── */

r.get("/followups/calendar", require_("followups", "view"), asyncHandler(async (req: any, res: any) => {
  if (!isDateKey(req.query.from) || !isDateKey(req.query.to)) throw new ApiError(400, "from and to are needed");
  const filter: any = { tenant: req.tenantId, due: { $gte: localDateTime(req.query.from), $lte: new Date(localDateTime(req.query.to).getTime() + 86_400_000 - 1) } };
  const owner = str(req.query.owner);
  if (owner === "me") filter.owner = req.auth?.name;
  else if (owner) filter.owner = owner;
  await scopeFollowUpFilter(req, filter);
  ok(res, await FollowUp.find(filter).sort({ due: 1 }).limit(2000).select("lead leadName type due done owner note outcome").lean());
}));

/** This user's private links: calendar feed and booking page. */
r.get("/crm/my-links", asyncHandler(async (req: any, res: any) => {
  const me = await User.findById(req.auth.uid).select("crmToken crmAway google");
  if (!me) throw new ApiError(404, "User not found");
  if (!me.crmToken) { me.crmToken = newToken(); await me.save(); }
  const s = await crmSettingsFor(req.tenantId);
  ok(res, {
    calendarUrl: `${publicBase(req)}/webhooks/calendar/${me.crmToken}.ics`, bookingUrl: `${await appUrl(req.tenantId)}/book/${me.crmToken}`, bookingOn: !!s.booking?.enabled, away: !!me.crmAway,
    googleAvailable: googleReady(s), googleEmail: me.google?.refreshToken ? me.google.email || "Connected" : "",
  });
}));

r.get("/crm/google/connect", asyncHandler(async (req: any, res: any) => ok(res, { url: await googleAuthUrl(req.tenantId, req.auth.uid, publicBase(req)) })));
r.post("/crm/google/disconnect", asyncHandler(async (req: any, res: any) => {
  await User.updateOne({ _id: req.auth.uid }, { $set: { google: null } });
  ok(res, { connected: false });
}));

r.post("/crm/me/away", asyncHandler(async (req: any, res: any) => {
  await User.updateOne({ _id: req.auth.uid }, { $set: { crmAway: !!req.body?.away } });
  ok(res, { away: !!req.body?.away });
}));

r.get("/crm/availability", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const tenant = tid(req);
  const s = await crmSettingsFor(tenant);
  const closed = (await LeadStatus.find({ tenant, $or: [{ isWon: true }, { isLost: true }] }).select("_id").lean()).map((x: any) => x._id);
  const [users, load] = await Promise.all([
    User.find({ tenant, status: "Active", pmClient: { $in: [null, undefined] } }).select("name crmAway crmBranches").sort({ name: 1 }).lean(),
    Lead.aggregate([{ $match: { tenant, status: { $nin: closed } } }, { $group: { _id: "$owner", n: { $sum: 1 } } }]),
  ]);
  const scope = await leadOwnerScope(req);
  ok(res, { limit: s.assignment?.maxOpenLeads || 0, users: users.filter((u: any) => !scope || scope.includes(u.name)).map((u: any) => ({ _id: u._id, name: u.name, away: !!u.crmAway, branches: u.crmBranches || [], openLeads: load.find((l: any) => l._id === u.name)?.n || 0 })) });
}));

r.put("/crm/availability/:userId", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const set: any = {};
  if (req.body?.away !== undefined) set.crmAway = !!req.body.away;
  if (Array.isArray(req.body?.branches)) set.crmBranches = [...new Set(req.body.branches.map((b: any) => str(b, 120)).filter(Boolean))];
  const u = await User.findOneAndUpdate({ _id: req.params.userId, tenant: req.tenantId }, { $set: set }, { new: true }).select("name crmAway crmBranches");
  if (!u) throw new ApiError(404, "User not found");
  ok(res, u);
}));

/* ───────────── push notifications ───────────── */

r.get("/crm/push/key", asyncHandler(async (req: any, res: any) => ok(res, { publicKey: (await pushKeys(req.tenantId)).publicKey })));

r.post("/crm/push/subscribe", asyncHandler(async (req: any, res: any) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth || !/^https:\/\//.test(sub.endpoint)) throw new ApiError(400, "Not a push subscription");
  await PushSub.updateOne({ endpoint: sub.endpoint }, { $set: { tenant: req.tenantId, user: req.auth.uid, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } } }, { upsert: true });
  ok(res, { subscribed: true });
}));

r.post("/crm/push/unsubscribe", asyncHandler(async (req: any, res: any) => {
  await PushSub.deleteOne({ endpoint: str(req.body?.endpoint, 1000), user: req.auth.uid });
  ok(res, { subscribed: false });
}));

/* ───────────── applications a lead has, for the lead drawer ───────────── */
r.get("/leads/:id/applications", require_("leads", "view"), guardLead, asyncHandler(async (req: any, res: any) => {
  ok(res, await Registration.find({ tenant: req.tenantId, lead: req.params.id }).sort({ createdAt: -1 }).select("appNo stage course createdAt token").lean());
}));

export default r;
