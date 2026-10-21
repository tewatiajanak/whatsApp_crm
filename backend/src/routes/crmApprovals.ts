import { Router } from "express";
import { Types } from "mongoose";
import { require_ } from "../middleware/auth";
import { ok, asyncHandler, ApiError, audit } from "../utils/http";
import { Lead } from "../models/Lead";
import { User } from "../models/User";
import { Approval, APPROVAL_KINDS } from "../models/CrmMore";
import { LeadFee, crmSettingsFor, feeBalance } from "../models/CrmExtras";
import { CrmQuote } from "../models/CrmSales";
import { logActivity, assignableOwners } from "../services/leadService";
import { refundFee } from "../services/leadFees";
import { canSeeLead } from "../services/leadAccess";
import { notify } from "../services/pm/messages";

/**
 * CRM approvals: fee concessions, refunds and quotation discounts. Rules (CRM → Approvals → Rules)
 * say what is approved on its own, who approves, and when a second person must approve too.
 * Nothing changes until the last approver says yes.
 */
const r = Router();
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const money = (n: number) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const names = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map((x: any) => str(x, 80)).filter(Boolean))].slice(0, 20);

export const APPROVAL_DEFAULTS = {
  approvers: [] as string[],
  fee_discount: { enabled: true, autoUpTo: 0, level2Above: 0, level2Users: [] as string[] },
  refund: { enabled: false, autoUpTo: 0, level2Above: 0, level2Users: [] as string[] },
  quote_discount: { enabled: false, maxPct: 10, level2Above: 0, level2Users: [] as string[] },
};
export async function approvalRules(tenant: any) {
  const s: any = await crmSettingsFor(tenant);
  const a = s.approvals || {};
  return {
    approvers: names(a.approvers),
    fee_discount: { ...APPROVAL_DEFAULTS.fee_discount, ...(a.fee_discount || {}), enabled: true },
    refund: { ...APPROVAL_DEFAULTS.refund, ...(a.refund || {}) },
    quote_discount: { ...APPROVAL_DEFAULTS.quote_discount, ...(a.quote_discount || {}) },
  };
}
const KIND_LABEL: Record<string, string> = { fee_discount: "Fee concession", refund: "Refund", quote_discount: "Quotation discount" };
const isSetupEditor = (u: any) => (u.userType?.perms || []).some((p: any) => p.module === "setup" && p.edit);

/** the people who may decide this request at its current level */
async function approversFor(tenant: any, a: any) {
  const rules: any = await approvalRules(tenant);
  const users: any[] = await User.find({ tenant, status: "Active" }).populate("userType", "perms").select("name userType reportingManager").lean();
  const editors = users.filter(isSetupEditor);
  let list: any[];
  if (a.level >= 2) {
    const want = names(rules[a.kind]?.level2Users);
    list = want.length ? users.filter((u) => want.includes(u.name)) : editors;
  } else {
    const requester = users.find((u) => u.name === a.requestedBy);
    const mgr = requester?.reportingManager ? users.find((u) => String(u._id) === String(requester.reportingManager)) : null;
    const extra = users.filter((u) => rules.approvers.includes(u.name));
    list = [...(mgr ? [mgr] : []), ...extra, ...editors];
  }
  // nobody approves their own request, and someone on level 1 is not asked again on level 2
  const earlier = (a.trail || []).map((t: any) => t.by);
  const seen = new Set<string>();
  return list.filter((u) => u.name !== a.requestedBy && !(a.level >= 2 && earlier.includes(u.name)) && !seen.has(String(u._id)) && seen.add(String(u._id)));
}
async function mayDecide(req: any, a: any) {
  if (a.status !== "pending") return false;
  return (await approversFor(req.tenantId, a)).some((u) => String(u._id) === String(req.auth?.uid));
}

/** do what the request asked for, once it is fully approved */
async function applyApproved(a: any, by: string) {
  if (a.kind === "fee_discount") {
    const fee = await LeadFee.findOne({ _id: a.fee, tenant: a.tenant });
    if (!fee) throw new ApiError(404, "The fee no longer exists");
    if (a.amount > feeBalance(fee)) throw new ApiError(400, "The fee has been paid down since; the concession is now more than what is left");
    fee.discount = Math.round(((fee.discount || 0) + a.amount) * 100) / 100;
    if (feeBalance(fee) <= 0 && fee.status === "pending") { fee.status = "paid"; fee.paidAt = new Date(); }
    await fee.save();
  } else if (a.kind === "refund") {
    const fee = await LeadFee.findOne({ _id: a.fee, tenant: a.tenant });
    if (!fee) throw new ApiError(404, "The fee no longer exists");
    await refundFee(fee, { amount: a.amount, reason: a.reason, by: `${a.requestedBy} (approved by ${by})` });
  } else if (a.kind === "quote_discount") {
    await CrmQuote.updateOne({ _id: a.entity, tenant: a.tenant }, { $set: { "approval.status": "approved", "approval.id": a._id, "approval.pct": a.percent } });
  }
}

/**
 * Ask for approval. Small amounts under the auto limit go through at once.
 * Returns { approval } or { auto: true }.
 */
export async function requestApproval(req: any, input: { kind: (typeof APPROVAL_KINDS)[number]; lead?: any; leadName?: string; fee?: any; feeTitle?: string; entity?: any; entityTitle?: string; link?: string; amount: number; percent?: number; reason: string; payload?: any }) {
  const rules: any = await approvalRules(req.tenantId);
  const rule = rules[input.kind];
  const measure = input.kind === "quote_discount" ? input.percent || 0 : input.amount;
  const base = { tenant: req.tenantId, kind: input.kind, lead: input.lead || null, leadName: input.leadName || "", fee: input.fee || null, feeTitle: input.feeTitle || "", entity: input.entity || null, entityTitle: input.entityTitle || "", link: input.link || "", amount: input.amount, percent: input.percent || 0, reason: input.reason, requestedBy: req.auth?.name || "", payload: input.payload || {} };
  if (input.kind !== "quote_discount" && rule.autoUpTo > 0 && measure <= rule.autoUpTo) {
    const a: any = await Approval.create({ ...base, status: "approved", decidedBy: "Auto (within limit)", decidedAt: new Date(), trail: [{ level: 1, status: "approved", by: "Auto (within limit)", at: new Date(), note: `Up to ${money(rule.autoUpTo)} is approved on its own` }] });
    await applyApproved(a, "Auto");
    return { approval: a, auto: true };
  }
  const levels = rule.level2Above > 0 && measure > rule.level2Above ? 2 : 1;
  const a: any = await Approval.create({ ...base, level: 1, levels });
  const who = await approversFor(req.tenantId, a);
  if (!who.length) { await a.deleteOne(); throw new ApiError(400, "Nobody can approve this yet. Set approvers in CRM → Approvals → Rules."); }
  await notify({ tenantId: req.tenantId, users: who.map((u) => u._id), category: "crm_lead", title: `Approve: ${KIND_LABEL[a.kind]} for ${a.leadName || a.entityTitle}`, body: `${a.kind === "quote_discount" ? `${a.percent}% discount` : money(a.amount)} · asked by ${a.requestedBy}`, link: "/crm/approvals" }).catch(() => undefined);
  if (a.lead) await logActivity({ tenant: req.tenantId, lead: a.lead, type: "approval", by: req.auth?.name, title: `${KIND_LABEL[a.kind]} of ${a.kind === "quote_discount" ? `${a.percent}%` : money(a.amount)} requested`, detail: a.reason });
  return { approval: a, auto: false };
}

const view = async (req: any, a: any) => ({
  ...a, kindLabel: KIND_LABEL[a.kind] || a.kind,
  canDecide: await mayDecide(req, a),
  canCancel: a.status === "pending" && a.requestedBy === req.auth?.name,
  waitingOn: a.status === "pending" ? (await approversFor(req.tenantId, a)).map((u) => u.name).slice(0, 5) : [],
});

/* ═════════════ API ═════════════ */

r.get("/crm/approvals", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const q = req.query;
  const filter: any = { tenant: req.tenantId };
  if (["pending", "approved", "rejected", "cancelled"].includes(str(q.status))) filter.status = str(q.status);
  if ((APPROVAL_KINDS as readonly string[]).includes(str(q.kind))) filter.kind = str(q.kind);
  const all = await Approval.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  const mayAll = (req.perms || []).some((p: any) => p.module === "setup" && p.edit);
  const reports = (await User.find({ tenant: req.tenantId, reportingManager: req.auth.uid }).select("name").lean()).map((u: any) => u.name);
  const items: any[] = [];
  for (const a of all) {
    const v = await view(req, a);
    // you see what you asked for, what is yours to decide, your team's, or everything as an admin
    if (mayAll || a.requestedBy === req.auth?.name || reports.includes(a.requestedBy) || v.canDecide || (a.trail || []).some((t: any) => t.by === req.auth?.name)) items.push(v);
  }
  const box = str(q.box, 20);
  const shown = box === "mine" ? items.filter((a) => a.canDecide) : box === "requested" ? items.filter((a) => a.requestedBy === req.auth?.name) : items;
  ok(res, {
    items: shown.slice(0, 300),
    counts: { mine: items.filter((a) => a.canDecide).length, requested: items.filter((a) => a.requestedBy === req.auth?.name && a.status === "pending").length, pending: items.filter((a) => a.status === "pending").length },
    pending: items.filter((a) => a.canDecide).length,
  });
}));

async function decide(req: any, a: any, approve: boolean, note: string) {
  if (a.status !== "pending") throw new ApiError(400, `This request was already ${a.status}`);
  if (a.requestedBy === req.auth?.name) throw new ApiError(403, "You cannot approve your own request");
  if (!(await mayDecide(req, a))) throw new ApiError(403, "This request is not yours to decide");
  a.trail.push({ level: a.level, status: approve ? "approved" : "rejected", by: req.auth?.name || "", at: new Date(), note });
  const label = `${KIND_LABEL[a.kind]} of ${a.kind === "quote_discount" ? `${a.percent}%` : money(a.amount)}`;
  if (approve && a.level < a.levels) {
    // first yes: on to the second approver
    a.level += 1;
    await a.save();
    const who = await approversFor(req.tenantId, a);
    await notify({ tenantId: req.tenantId, users: who.map((u) => u._id), category: "crm_lead", title: `Second approval: ${label}`, body: `${a.leadName || a.entityTitle} · approved by ${req.auth?.name}`, link: "/crm/approvals" }).catch(() => undefined);
    return a;
  }
  if (approve) await applyApproved(a, req.auth?.name || "");
  if (!approve && a.kind === "quote_discount") await CrmQuote.updateOne({ _id: a.entity, tenant: req.tenantId }, { $set: { "approval.status": "rejected", "approval.id": a._id } });
  a.status = approve ? "approved" : "rejected";
  a.decidedBy = req.auth?.name || "";
  a.decidedAt = new Date();
  a.note = note;
  await a.save();
  if (a.lead) await logActivity({ tenant: req.tenantId, lead: a.lead, type: "approval", by: req.auth?.name, title: `${label} ${a.status}`, detail: note });
  const requester: any = await User.findOne({ tenant: req.tenantId, name: a.requestedBy }).select("_id").lean();
  if (requester) await notify({ tenantId: req.tenantId, users: [requester._id], category: "crm_lead", title: `${KIND_LABEL[a.kind]} ${a.status}: ${a.leadName || a.entityTitle}`, body: `${label}${note ? ` · ${note}` : ""}`, link: a.link || (a.lead ? `/crm/leads?lead=${a.lead}` : "/crm/approvals") }).catch(() => undefined);
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Approvals", entity: `${label} · ${a.leadName || a.entityTitle}`, next: a.status });
  return a;
}

r.post("/crm/approvals/:id/decide", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const a = Types.ObjectId.isValid(req.params.id) ? await Approval.findOne({ _id: req.params.id, tenant: req.tenantId }) : null;
  if (!a) throw new ApiError(404, "Request not found");
  const approve = !!req.body?.approve;
  const note = str(req.body?.note);
  if (!approve && !note) throw new ApiError(400, "Say why it is rejected");
  ok(res, await decide(req, a, approve, note));
}));

r.post("/crm/approvals/bulk", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter((x: any) => Types.ObjectId.isValid(String(x))).slice(0, 100);
  const approve = !!req.body?.approve;
  const note = str(req.body?.note);
  if (!approve && !note) throw new ApiError(400, "Say why they are rejected");
  const done: string[] = [], failed: Array<{ id: string; error: string }> = [];
  for (const id of ids) {
    const a = await Approval.findOne({ _id: id, tenant: req.tenantId });
    try { if (!a) throw new ApiError(404, "Not found"); await decide(req, a, approve, note); done.push(id); }
    catch (e: any) { failed.push({ id, error: e.message }); }
  }
  ok(res, { done: done.length, failed });
}));

r.post("/crm/approvals/:id/cancel", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  const a: any = Types.ObjectId.isValid(req.params.id) ? await Approval.findOne({ _id: req.params.id, tenant: req.tenantId }) : null;
  if (!a) throw new ApiError(404, "Request not found");
  if (a.requestedBy !== req.auth?.name) throw new ApiError(403, "Only the person who asked can withdraw it");
  if (a.status !== "pending") throw new ApiError(400, `This request was already ${a.status}`);
  a.status = "cancelled"; a.decidedBy = req.auth?.name; a.decidedAt = new Date();
  await a.save();
  if (a.kind === "quote_discount") await CrmQuote.updateOne({ _id: a.entity, tenant: req.tenantId }, { $set: { "approval.status": "" } });
  ok(res, a);
}));

/* rules */
r.get("/crm/approvals/rules", require_("leads", "view"), asyncHandler(async (req: any, res: any) => {
  ok(res, { rules: await approvalRules(req.tenantId), users: await assignableOwners(req.tenantId) });
}));
r.put("/crm/approvals/rules", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const b = req.body || {};
  const num = (v: unknown, max = 1e9) => Math.max(0, Math.min(max, Number(v) || 0));
  const rule = (x: any, pct = false) => ({ enabled: !!x?.enabled, autoUpTo: num(x?.autoUpTo), level2Above: num(x?.level2Above, pct ? 100 : 1e9), level2Users: names(x?.level2Users), ...(pct ? { maxPct: num(x?.maxPct, 100) } : {}) });
  const s: any = await crmSettingsFor(req.tenantId);
  s.approvals = { approvers: names(b.approvers), fee_discount: { ...rule(b.fee_discount), enabled: true }, refund: rule(b.refund), quote_discount: rule(b.quote_discount, true) };
  s.markModified("approvals");
  await s.save();
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Approvals", entity: "Rules" });
  ok(res, await approvalRules(req.tenantId));
}));

/* asking from a quotation */
export const maxDiscountPct = (q: any) => Math.max(0, ...(q.items || []).map((i: any) => Number(i.discountPct) || 0), q.subtotal > 0 && q.adjustment < 0 ? Math.round((-q.adjustment / q.subtotal) * 1000) / 10 : 0);
r.post("/crm/quotes/:id/request-approval", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const q: any = Types.ObjectId.isValid(req.params.id) ? await CrmQuote.findOne({ _id: req.params.id, tenant: req.tenantId }) : null;
  if (!q) throw new ApiError(404, "Quotation not found");
  if (q.approval?.status === "pending") throw new ApiError(400, "Approval was already asked for");
  const reason = str(req.body?.reason);
  if (!reason) throw new ApiError(400, "Say why the discount is needed");
  const pct = maxDiscountPct(q);
  const { approval } = await requestApproval(req, { kind: "quote_discount", entity: q._id, entityTitle: `${q.quoteNo} · ${q.customer?.name || ""}`, link: `/crm/quotes?quote=${q._id}`, lead: q.lead, leadName: q.customer?.name || "", amount: q.discountTotal || 0, percent: pct, reason });
  q.approval = { status: "pending", id: approval._id, pct };
  q.markModified("approval");
  await q.save();
  ok(res, { approval, quote: q }, 201);
}));

/* asking for a refund (when refunds need approval) */
r.post("/lead-fees/:feeId/refund-request", require_("leads", "edit"), asyncHandler(async (req: any, res: any) => {
  const fee: any = Types.ObjectId.isValid(req.params.feeId) ? await LeadFee.findOne({ _id: req.params.feeId, tenant: req.tenantId }) : null;
  if (!fee || !(await canSeeLead(req, fee.lead))) throw new ApiError(404, "Fee not found");
  const amount = Math.round(Number(req.body?.amount) * 100) / 100;
  const paid = fee.paidAmount || 0;
  if (!Number.isFinite(amount) || amount <= 0 || amount > paid) throw new ApiError(400, `The refund must be between ₹1 and ${money(paid)}`);
  const reason = str(req.body?.reason);
  if (!reason) throw new ApiError(400, "Say why the money is being refunded");
  if (await Approval.exists({ tenant: req.tenantId, fee: fee._id, kind: "refund", status: "pending" })) throw new ApiError(400, "A refund on this fee is already waiting for approval");
  const lead: any = await Lead.findById(fee.lead).select("name").lean();
  ok(res, await requestApproval(req, { kind: "refund", lead: fee.lead, leadName: lead?.name || "", fee: fee._id, feeTitle: fee.title, amount, reason, link: `/crm/leads?lead=${fee.lead}` }), 201);
}));

export default r;
