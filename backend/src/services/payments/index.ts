import { randomBytes } from "crypto";
import { config } from "../../config";
import { ApiError } from "../../utils/http";
import { IPaymentGateway, IPaymentTransaction, PaymentGateway, PaymentTransaction } from "../../models/Payment";
import { EmAttendee } from "../../models/EventManager";
import { decryptSecret, encryptSecret, maskSecret } from "./crypto";
import { Creds, PayStatus, Provider, getProvider } from "./providers";

/** Public base URL gateways can reach: PUBLIC_API_URL, else the request's own host. */
export function publicBase(req: any): string {
  if (config.publicUrl) return config.publicUrl;
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.get("host") || "").split(",")[0].trim();
  return `${proto}://${host}`;
}
export const webhookUrl = (base: string, g: { provider: string; _id: any }) => `${base}/webhooks/payments/${g.provider}/${g._id}`;
export const returnUrlFor = (base: string, txnId: string) => `${base}/webhooks/payments/return/${txnId}`;

const providerOf = (g: { provider: string }): Provider => {
  const p = getProvider(g.provider);
  if (!p) throw new ApiError(400, `Unsupported payment gateway: ${g.provider}`);
  return p;
};

/** Decrypted credentials, ready to hand to a provider adapter. */
export function plainCredentials(g: IPaymentGateway): Creds {
  const p = providerOf(g);
  const out: Creds = {};
  p.fields.forEach((f) => {
    const v = g.credentials?.[f.key] || "";
    out[f.key] = f.secret ? decryptSecret(v) : v;
  });
  return out;
}

/**
 * Merge credentials sent by the UI into what is stored. A secret left blank
 * keeps its stored value, so editing a gateway never requires re-typing secrets.
 */
export function mergeCredentials(provider: Provider, incoming: Record<string, any>, stored: Record<string, string> = {}) {
  const next: Record<string, string> = {};
  provider.fields.forEach((f) => {
    const raw = incoming?.[f.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (f.secret) next[f.key] = value ? encryptSecret(value) : stored[f.key] || "";
    else next[f.key] = raw === undefined ? stored[f.key] || "" : value;
  });
  const missing = provider.fields.filter((f) => f.required && !next[f.key]).map((f) => f.label);
  if (missing.length) throw new ApiError(400, `Missing: ${missing.join(", ")}`);
  return next;
}

/** Gateway as the UI may see it: secrets masked, URLs to whitelist included. */
export function presentGateway(g: IPaymentGateway, base: string) {
  const p = providerOf(g);
  const creds = plainCredentials(g);
  const credentials: Record<string, string> = {};
  p.fields.forEach((f) => {
    credentials[f.key] = f.secret ? maskSecret(creds[f.key]) : creds[f.key];
  });
  return {
    id: String(g._id),
    provider: g.provider,
    providerName: p.name,
    label: g.label,
    mode: g.mode,
    isActive: g.isActive,
    credentials,
    lastTest: g.lastTest || null,
    webhookUrl: webhookUrl(base, g),
    returnUrl: `${base}/webhooks/payments/return/…`,
    createdAt: (g as any).createdAt,
  };
}

const newTxnId = () => `T${Date.now().toString(36)}${randomBytes(5).toString("hex")}`.toUpperCase().slice(0, 22);

export interface InitiateInput {
  amount: number;
  currency?: string;
  purpose?: string;
  customer?: { name?: string; email?: string; phone?: string };
  reference?: { module?: string; id?: string };
  returnUrl?: string;
  /** Pay through this gateway instead of the active one (used by "Test payment"). */
  gatewayId?: string;
  isTest?: boolean;
}

/** Start a payment through the tenant's active gateway. */
export async function initiatePayment(tenantId: string, base: string, input: InitiateInput) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "Amount must be greater than zero");
  if (input.returnUrl && !/^https?:\/\//i.test(input.returnUrl)) throw new ApiError(400, "returnUrl must be an http(s) URL");

  const gateway = input.gatewayId
    ? await PaymentGateway.findOne({ _id: input.gatewayId, tenant: tenantId })
    : await PaymentGateway.findOne({ tenant: tenantId, isActive: true });
  if (!gateway) throw new ApiError(400, input.gatewayId ? "Payment gateway not found" : "No active payment gateway. Activate one in Configuration → Integrations → Payment Gateway.");

  const provider = providerOf(gateway);
  const txn = await PaymentTransaction.create({
    tenant: tenantId,
    gateway: gateway._id,
    provider: gateway.provider,
    mode: gateway.mode,
    txnId: newTxnId(),
    amount: Math.round(amount * 100) / 100,
    currency: (input.currency || "INR").toUpperCase(),
    purpose: (input.purpose || "Payment").slice(0, 100),
    customer: {
      name: input.customer?.name || "Customer",
      email: input.customer?.email || "",
      phone: input.customer?.phone || "",
    },
    reference: input.reference,
    returnUrl: input.returnUrl,
    isTest: !!input.isTest,
  });

  try {
    const result = await provider.createPayment(plainCredentials(gateway), gateway.mode, {
      txnId: txn.txnId,
      amount: txn.amount,
      currency: txn.currency,
      purpose: txn.purpose,
      customer: txn.customer,
      returnUrl: returnUrlFor(base, txn.txnId),
      webhookUrl: webhookUrl(base, gateway),
    });
    txn.gatewayOrderId = result.gatewayOrderId;
    txn.status = "pending";
    await txn.save();
    return { txnId: txn.txnId, provider: gateway.provider, action: result.action };
  } catch (e: any) {
    txn.status = "failed";
    txn.message = String(e?.message || e).slice(0, 300);
    await txn.save();
    throw new ApiError(502, txn.message || "The payment gateway rejected the request");
  }
}

/**
 * Record an outcome reported by the gateway. A paid transaction is final: a
 * late "failed"/"pending" notification can never undo it.
 */
export async function applyOutcome(txn: IPaymentTransaction, status: PayStatus, gatewayPaymentId?: string, message?: string) {
  if (txn.status === "paid") return txn;
  txn.status = status;
  if (gatewayPaymentId) txn.gatewayPaymentId = gatewayPaymentId;
  txn.message = message ? String(message).slice(0, 300) : undefined;
  if (status === "paid") txn.paidAt = new Date();
  await txn.save();
  await syncReference(txn);
  return txn;
}

/** Reflect a payment outcome on the record it was for (event registration). */
async function syncReference(txn: IPaymentTransaction) {
  if (txn.reference?.module !== "events" || !txn.reference.id) return;
  await EmAttendee.updateOne(
    { _id: txn.reference.id, tenant: txn.tenant },
    {
      $set: {
        paymentStatus: txn.status === "paid" ? "paid" : txn.status === "failed" ? "failed" : "pending",
        paymentTxnId: txn.txnId,
        paymentMode: "online",
        paymentProvider: txn.provider,
        amountPaid: txn.status === "paid" ? txn.amount : 0,
        paidAt: txn.status === "paid" ? txn.paidAt : null,
      },
    }
  );
}

/** The customer's browser came back from the gateway. */
export async function handleReturn(txnId: string, body: Record<string, any>, query: Record<string, any>) {
  const txn = await PaymentTransaction.findOne({ txnId });
  if (!txn) throw new ApiError(404, "Unknown transaction");
  if (txn.status === "paid") return txn;
  const gateway = await PaymentGateway.findById(txn.gateway);
  if (!gateway) throw new ApiError(404, "Payment gateway no longer exists");
  const result = await providerOf(gateway).verifyReturn(plainCredentials(gateway), txn.mode, {
    body,
    query,
    txn: { txnId: txn.txnId, amount: txn.amount, gatewayOrderId: txn.gatewayOrderId },
  });
  return applyOutcome(txn, result.status, result.gatewayPaymentId, result.message);
}

/** Server-to-server notification. Returns false when the signature is wrong. */
export async function handleWebhook(providerId: string, gatewayId: string, input: { rawBody: Buffer; headers: any; body: any }) {
  const gateway = await PaymentGateway.findById(gatewayId).catch(() => null);
  if (!gateway || gateway.provider !== providerId) throw new ApiError(404, "Unknown payment gateway");
  const result = await providerOf(gateway).parseWebhook(plainCredentials(gateway), gateway.mode, input);
  if (!result.valid) return false;
  if (result.ignored || !result.status) return true;
  const filter: any = { tenant: gateway.tenant, gateway: gateway._id };
  if (result.txnId) filter.txnId = result.txnId;
  else if (result.gatewayOrderId) filter.gatewayOrderId = result.gatewayOrderId;
  else return true;
  const txn = await PaymentTransaction.findOne(filter);
  if (txn) await applyOutcome(txn, result.status, result.gatewayPaymentId);
  return true;
}
