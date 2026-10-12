import { randomBytes } from "crypto";
import { Lead } from "../models/Lead";
import { LeadFee, ILeadFee, feeBalance, crmSettingsFor } from "../models/CrmExtras";
import { ApiError } from "../utils/http";
import { logActivity, refreshLead } from "./leadService";
import { fireAlerts } from "./alertsEngine";
import { localDateKey } from "../utils/dates";

export const newToken = () => randomBytes(18).toString("base64url");
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Next number in a monthly series, e.g. R202610-0007. */
async function nextNumber(tenant: any, prefix: string, field: "receiptNo" | "invoiceNo") {
  const month = localDateKey().slice(0, 7).replace("-", "");
  const head = `${prefix}${month}-`;
  const rx = new RegExp(`^${head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
  const used = field === "invoiceNo"
    ? await LeadFee.countDocuments({ tenant, invoiceNo: rx })
    : (await LeadFee.aggregate([{ $match: { tenant } }, { $unwind: "$payments" }, { $match: { "payments.receiptNo": rx } }, { $count: "n" }]))[0]?.n || 0;
  return `${head}${String(used + 1).padStart(4, "0")}`;
}

/**
 * Record money received against a fee — the whole balance or a part of it.
 * Each payment gets its own receipt; the fee is "paid" once nothing is left.
 */
export async function recordPayment(fee: ILeadFee, info: { amount?: number; mode: string; reference?: string; txnId?: string; by?: string; paidAt?: Date }) {
  if (fee.status === "cancelled") throw new ApiError(400, "This fee was cancelled");
  const balance = feeBalance(fee);
  if (balance <= 0) return fee;
  const amount = info.amount === undefined ? balance : Math.round(Number(info.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "Enter the amount received");
  if (amount > balance) throw new ApiError(400, `Only ${rupees(balance)} is left to pay on this fee`);

  const receiptNo = await nextNumber(fee.tenant, "R", "receiptNo");
  const at = info.paidAt || new Date();
  fee.payments.push({ amount, mode: info.mode, reference: info.reference || "", receiptNo, at, by: info.by || "Online payment", txnId: info.txnId || "" });
  fee.paidAmount = Math.round(((fee.paidAmount || 0) + amount) * 100) / 100;
  fee.mode = info.mode;
  fee.reference = info.reference || fee.reference || "";
  fee.txnId = info.txnId || fee.txnId || "";
  fee.receiptNo = receiptNo;
  if (feeBalance(fee) <= 0) {
    fee.status = "paid";
    fee.paidAt = at;
    if (!fee.invoiceNo) {
      const s = await crmSettingsFor(fee.tenant);
      fee.invoiceNo = await nextNumber(fee.tenant, s.billing.invoicePrefix || "INV", "invoiceNo");
    }
  }
  await fee.save();

  const lead = await Lead.findById(fee.lead);
  if (lead) {
    lead.lastActivity = new Date();
    await lead.save();
    await logActivity({
      tenant: fee.tenant, lead: lead._id, type: "payment", by: info.by || "Online payment",
      title: `Payment received · ${rupees(amount)}`,
      detail: `${fee.title} · ${info.mode} · receipt ${receiptNo}${fee.status === "paid" ? "" : ` · ${rupees(feeBalance(fee))} left`}`,
    });
    await refreshLead(lead);
    await fireAlerts("payment.received", lead, fee.tenant, info.by);
  }
  return fee;
}

/** Old name, kept for callers that pay a fee in full. */
export const markFeePaid = recordPayment;

/** Give money back on a fee. The fee reopens for whatever is now unpaid. */
export async function refundFee(fee: ILeadFee, info: { amount: number; reason: string; by?: string }) {
  const amount = Math.round(Number(info.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "Enter the amount to refund");
  if (amount > (fee.paidAmount || 0)) throw new ApiError(400, `Only ${rupees(fee.paidAmount || 0)} has been paid on this fee`);
  if (!info.reason.trim()) throw new ApiError(400, "Say why the money is being refunded");
  fee.refunds.push({ amount, reason: info.reason.trim(), at: new Date(), by: info.by || "System" });
  fee.paidAmount = Math.round((fee.paidAmount - amount) * 100) / 100;
  if (fee.status === "paid" && feeBalance(fee) > 0) { fee.status = "pending"; fee.paidAt = null; }
  await fee.save();
  await logActivity({ tenant: fee.tenant, lead: fee.lead, type: "payment", by: info.by, title: `Refund · ${rupees(amount)}`, detail: `${fee.title} · ${info.reason.trim()}` });
  return fee;
}

/** A gateway reported the outcome of an online fee payment. */
export async function feePaymentOutcome(feeId: string, tenant: any, txn: { status: string; txnId: string; provider: string; amount?: number }) {
  const fee = await LeadFee.findOne({ _id: feeId, tenant });
  if (!fee || txn.status !== "paid") return;
  // the gateway may notify twice (browser return + webhook): one transaction is one payment
  if (fee.payments.some((p) => p.txnId && p.txnId === txn.txnId)) return;
  await recordPayment(fee, { amount: txn.amount ? Math.min(txn.amount, feeBalance(fee)) : undefined, mode: "Online", reference: txn.provider, txnId: txn.txnId });
}
