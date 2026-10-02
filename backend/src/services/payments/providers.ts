import { createHash, createHmac, timingSafeEqual } from "crypto";

/**
 * Payment gateway adapters. Every gateway implements the same four operations,
 * so switching gateways is only a matter of saving another gateway's
 * credentials and marking it active — callers never talk to a gateway directly.
 *
 *   createPayment → what the browser must do to start paying
 *   verifyReturn  → the customer came back from the gateway: did they pay?
 *   parseWebhook  → server-to-server notification from the gateway
 *   testCredentials → are the saved keys accepted by the gateway?
 */

export type Mode = "test" | "live";
export type PayStatus = "paid" | "failed" | "pending";
export type Creds = Record<string, string>;

export interface FieldDef {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
}

export interface PaymentCtx {
  txnId: string;
  amount: number; // major units, e.g. 499.00
  currency: string;
  purpose: string;
  customer: { name: string; email: string; phone: string };
  returnUrl: string; // our public return endpoint for this transaction
  webhookUrl: string;
}

/** Instruction for the browser. */
export type PaymentAction =
  | { type: "redirect"; url: string }
  | { type: "form"; url: string; fields: Record<string, string> }
  | { type: "razorpay"; options: Record<string, any> }
  | { type: "cashfree"; paymentSessionId: string; mode: "sandbox" | "production" };

export interface CreateResult {
  action: PaymentAction;
  gatewayOrderId?: string;
}
export interface VerifyResult {
  status: PayStatus;
  gatewayPaymentId?: string;
  message?: string;
}
export interface ReturnInput {
  body: Record<string, any>;
  query: Record<string, any>;
  txn: { txnId: string; amount: number; gatewayOrderId?: string };
}
export interface WebhookInput {
  rawBody: Buffer;
  headers: Record<string, any>;
  body: Record<string, any>;
}
export interface WebhookResult {
  valid: boolean;
  /** One of these identifies the transaction. */
  txnId?: string;
  gatewayOrderId?: string;
  status?: PayStatus;
  gatewayPaymentId?: string;
  /** Valid notification that isn't about a payment outcome (ignored). */
  ignored?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  /** Does the gateway use separate test/live endpoints chosen by us? */
  usesMode: boolean;
  fields: FieldDef[];
  /** Shown in the UI: what to configure on the gateway's dashboard. */
  setup: { webhook: string; returnUrl: string; domain: string; webhookEvents?: string };
  createPayment(c: Creds, mode: Mode, ctx: PaymentCtx): Promise<CreateResult>;
  verifyReturn(c: Creds, mode: Mode, input: ReturnInput): Promise<VerifyResult>;
  parseWebhook(c: Creds, mode: Mode, input: WebhookInput): Promise<WebhookResult>;
  testCredentials(c: Creds, mode: Mode): Promise<{ ok: boolean; message: string }>;
}

/* ───────────────────────── helpers ───────────────────────── */

const sha512 = (s: string) => createHash("sha512").update(s).digest("hex");
const hmac256 = (data: string | Buffer, secret: string) => createHmac("sha256", secret).update(data).digest();
const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && timingSafeEqual(x, y);
};
const money = (n: number) => n.toFixed(2);
// Gateways take the smallest currency unit; these currencies have none.
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "XAF", "XOF", "UGX", "RWF", "PYG", "KMF", "GNF", "DJF", "BIF", "MGA", "VUV", "XPF"]);
const minor = (amount: number, currency: string) =>
  ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(amount) : Math.round(amount * 100);
const sameAmount = (a: unknown, b: number) => Math.abs(parseFloat(String(a)) - b) < 0.01;
const digits = (s: string) => String(s || "").replace(/\D/g, "");
const basic = (user: string, pass: string) => "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
const form = (o: Record<string, string>) => new URLSearchParams(o).toString();

async function call(url: string, init: RequestInit): Promise<{ status: number; json: any; text: string }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text };
}
const gatewayError = (name: string, r: { status: number; json: any; text: string }) =>
  new Error(
    `${name}: ${
      r.json?.error?.description || r.json?.error?.message || r.json?.message || r.json?.error_desc || r.json?.data || r.text.slice(0, 200) || `HTTP ${r.status}`
    }`
  );

/* ───────────────────────── Razorpay ───────────────────────── */

const razorpay: Provider = {
  id: "razorpay",
  name: "Razorpay",
  usesMode: false, // test/live is decided by the key itself (rzp_test_… / rzp_live_…)
  fields: [
    { key: "keyId", label: "Key ID", required: true, help: "rzp_test_… or rzp_live_…" },
    { key: "keySecret", label: "Key Secret", secret: true, required: true },
    { key: "webhookSecret", label: "Webhook Secret", secret: true, help: "The secret you type while creating the webhook on Razorpay." },
  ],
  setup: {
    webhook: "Razorpay Dashboard → Account & Settings → Webhooks → Add New Webhook. Paste the Webhook URL and use the same secret as the Webhook Secret field here.",
    webhookEvents: "payment.captured, payment.failed, order.paid",
    returnUrl: "Nothing to whitelist — the return URL is sent with every payment.",
    domain: "Razorpay Dashboard → Account & Settings → Business website: add your website domain.",
  },
  async createPayment(c, _mode, ctx) {
    const r = await call("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: basic(c.keyId, c.keySecret), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: minor(ctx.amount, ctx.currency),
        currency: ctx.currency,
        receipt: ctx.txnId,
        notes: { txnId: ctx.txnId },
      }),
    });
    if (r.status >= 300 || !r.json?.id) throw gatewayError("Razorpay", r);
    return {
      gatewayOrderId: r.json.id,
      action: {
        type: "razorpay",
        options: {
          key: c.keyId,
          order_id: r.json.id,
          amount: r.json.amount,
          currency: r.json.currency,
          name: ctx.purpose,
          description: ctx.purpose,
          prefill: { name: ctx.customer.name, email: ctx.customer.email, contact: ctx.customer.phone },
          // redirect mode: Razorpay posts the result to our return endpoint
          callback_url: ctx.returnUrl,
          redirect: true,
        },
      },
    };
  },
  async verifyReturn(c, _mode, { body, txn }) {
    const { razorpay_payment_id: pid, razorpay_order_id: oid, razorpay_signature: sig } = body;
    if (pid && oid && sig) {
      const expected = hmac256(`${oid}|${pid}`, c.keySecret).toString("hex");
      if (oid === txn.gatewayOrderId && safeEqual(expected, sig)) return { status: "paid", gatewayPaymentId: pid };
      return { status: "failed", message: "Signature mismatch" };
    }
    // No signed fields (failure or closed popup) — ask Razorpay for the order state.
    if (!txn.gatewayOrderId) return { status: "failed" };
    const r = await call(`https://api.razorpay.com/v1/orders/${txn.gatewayOrderId}`, {
      headers: { Authorization: basic(c.keyId, c.keySecret) },
    });
    if (r.json?.status === "paid") return { status: "paid" };
    const desc = body["error[description]"] || body?.error?.description;
    return { status: desc ? "failed" : "pending", message: desc };
  },
  async parseWebhook(c, _mode, { rawBody, headers, body }) {
    if (!c.webhookSecret) return { valid: false };
    const expected = hmac256(rawBody, c.webhookSecret).toString("hex");
    if (!safeEqual(expected, String(headers["x-razorpay-signature"] || ""))) return { valid: false };
    const payment = body?.payload?.payment?.entity;
    const order = body?.payload?.order?.entity;
    const gatewayOrderId = payment?.order_id || order?.id;
    if (body.event === "payment.captured" || body.event === "order.paid") {
      return { valid: true, gatewayOrderId, status: "paid", gatewayPaymentId: payment?.id };
    }
    if (body.event === "payment.failed") return { valid: true, gatewayOrderId, status: "failed", gatewayPaymentId: payment?.id };
    return { valid: true, ignored: true };
  },
  async testCredentials(c) {
    const r = await call("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: basic(c.keyId, c.keySecret) } });
    return r.status === 200
      ? { ok: true, message: `Razorpay accepted the keys (${c.keyId.startsWith("rzp_live") ? "live" : "test"} mode).` }
      : { ok: false, message: gatewayError("Razorpay", r).message };
  },
};

/* ───────────────────────── PayU ───────────────────────── */

const payuBase = (mode: Mode) => (mode === "live" ? "https://secure.payu.in" : "https://test.payu.in");
const payuInfo = (mode: Mode) => (mode === "live" ? "https://info.payu.in" : "https://test.payu.in");
// Response hash: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
const payuResponseOk = (c: Creds, b: Record<string, any>) => {
  const seq = [
    c.salt, b.status, "", "", "", "", "",
    b.udf5 || "", b.udf4 || "", b.udf3 || "", b.udf2 || "", b.udf1 || "",
    b.email || "", b.firstname || "", b.productinfo || "", b.amount || "", b.txnid || "", c.merchantKey,
  ].join("|");
  const expected = sha512(b.additionalCharges ? `${b.additionalCharges}|${seq}` : seq);
  return safeEqual(expected, String(b.hash || "").toLowerCase());
};

const payu: Provider = {
  id: "payu",
  name: "PayU",
  usesMode: true,
  fields: [
    { key: "merchantKey", label: "Merchant Key", required: true },
    { key: "salt", label: "Merchant Salt", secret: true, required: true, help: "Use the Salt (version 1 / SHA-512) from PayU Dashboard → Payment Gateway → Key Salt Details." },
  ],
  setup: {
    webhook: "PayU Dashboard → Settings → Webhooks → Create Webhook. Paste the Webhook URL for successful and failed payment events.",
    webhookEvents: "Successful, Failed",
    returnUrl: "Nothing to whitelist — the success/failure URL is sent with every payment.",
    domain: "Give your website domain to PayU during onboarding (website whitelisting is done by PayU support).",
  },
  async createPayment(c, mode, ctx) {
    const f: Record<string, string> = {
      key: c.merchantKey,
      txnid: ctx.txnId,
      amount: money(ctx.amount),
      productinfo: ctx.purpose,
      firstname: ctx.customer.name,
      email: ctx.customer.email,
      phone: digits(ctx.customer.phone),
      surl: ctx.returnUrl,
      furl: ctx.returnUrl,
    };
    // key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
    f.hash = sha512([f.key, f.txnid, f.amount, f.productinfo, f.firstname, f.email, "", "", "", "", "", "", "", "", "", "", c.salt].join("|"));
    return { action: { type: "form", url: `${payuBase(mode)}/_payment`, fields: f } };
  },
  async verifyReturn(c, _mode, { body, txn }) {
    if (!body.hash || body.txnid !== txn.txnId) return { status: "failed", message: "Unexpected response from PayU" };
    if (!payuResponseOk(c, body)) return { status: "failed", message: "Hash mismatch" };
    if (body.status === "success" && sameAmount(body.amount, txn.amount)) return { status: "paid", gatewayPaymentId: body.mihpayid };
    if (body.status === "pending") return { status: "pending", gatewayPaymentId: body.mihpayid };
    return { status: "failed", gatewayPaymentId: body.mihpayid, message: body.error_Message || body.field9 };
  },
  async parseWebhook(c, _mode, { body }) {
    if (!body.hash || !body.txnid || !payuResponseOk(c, body)) return { valid: false };
    return {
      valid: true,
      txnId: body.txnid,
      status: body.status === "success" ? "paid" : body.status === "pending" ? "pending" : "failed",
      gatewayPaymentId: body.mihpayid,
    };
  },
  async testCredentials(c, mode) {
    // verify_payment for an id that doesn't exist: PayU still validates key + hash.
    const command = "verify_payment";
    const var1 = "CONNECTIONTEST";
    const r = await call(`${payuInfo(mode)}/merchant/postservice?form=2`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ key: c.merchantKey, command, var1, hash: sha512(`${c.merchantKey}|${command}|${var1}|${c.salt}`) }),
    });
    const msg = String(r.json?.msg || r.text || "");
    if (r.status !== 200 || /invalid|incorrect|hash|not found.*key|unauthori[sz]ed/i.test(msg) && !/transaction/i.test(msg)) {
      return { ok: false, message: `PayU rejected the key/salt: ${msg.slice(0, 160) || `HTTP ${r.status}`}` };
    }
    return { ok: true, message: `PayU accepted the key and salt (${mode} environment).` };
  },
};

/* ───────────────────────── Easebuzz ───────────────────────── */

const ebBase = (mode: Mode) => (mode === "live" ? "https://pay.easebuzz.in" : "https://testpay.easebuzz.in");
const UDF10 = Array.from({ length: 10 }, (_, i) => `udf${i + 1}`);
const ebInitiate = async (c: Creds, mode: Mode, ctx: PaymentCtx) => {
  const f: Record<string, string> = {
    key: c.key,
    txnid: ctx.txnId,
    amount: money(ctx.amount),
    productinfo: ctx.purpose,
    firstname: ctx.customer.name,
    phone: digits(ctx.customer.phone).slice(-10),
    email: ctx.customer.email,
    surl: ctx.returnUrl,
    furl: ctx.returnUrl,
  };
  // key|txnid|amount|productinfo|firstname|email|udf1…udf10|salt
  f.hash = sha512([f.key, f.txnid, f.amount, f.productinfo, f.firstname, f.email, ...UDF10.map(() => ""), c.salt].join("|"));
  return call(`${ebBase(mode)}/payment/initiateLink`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form(f),
  });
};
// Response hash: salt|status|udf10…udf1|email|firstname|productinfo|amount|txnid|key
const ebResponseOk = (c: Creds, b: Record<string, any>) => {
  const seq = [
    c.salt, b.status, ...[...UDF10].reverse().map((u) => b[u] || ""),
    b.email || "", b.firstname || "", b.productinfo || "", b.amount || "", b.txnid || "", b.key || c.key,
  ].join("|");
  return safeEqual(sha512(seq), String(b.hash || "").toLowerCase());
};

const easebuzz: Provider = {
  id: "easebuzz",
  name: "Easebuzz",
  usesMode: true,
  fields: [
    { key: "key", label: "Merchant Key", required: true },
    { key: "salt", label: "Salt", secret: true, required: true },
  ],
  setup: {
    webhook: "Easebuzz Dashboard → Settings → Webhooks (Transaction webhook): paste the Webhook URL.",
    webhookEvents: "Transaction (success / failure)",
    returnUrl: "Nothing to whitelist — the success/failure URL is sent with every payment.",
    domain: "Easebuzz Dashboard → Settings → Website / Whitelisted URLs: add your website domain (Easebuzz blocks payments started from an unlisted domain).",
  },
  async createPayment(c, mode, ctx) {
    const r = await ebInitiate(c, mode, ctx);
    if (r.json?.status !== 1 || !r.json?.data) throw gatewayError("Easebuzz", r);
    return { action: { type: "redirect", url: `${ebBase(mode)}/pay/${r.json.data}` } };
  },
  async verifyReturn(c, _mode, { body, txn }) {
    if (!body.hash || body.txnid !== txn.txnId) return { status: "failed", message: "Unexpected response from Easebuzz" };
    if (!ebResponseOk(c, body)) return { status: "failed", message: "Hash mismatch" };
    if (body.status === "success" && sameAmount(body.amount, txn.amount)) return { status: "paid", gatewayPaymentId: body.easepayid };
    if (body.status === "pending") return { status: "pending", gatewayPaymentId: body.easepayid };
    return { status: "failed", gatewayPaymentId: body.easepayid, message: body.error_Message || body.error };
  },
  async parseWebhook(c, _mode, { body }) {
    if (!body.hash || !body.txnid || !ebResponseOk(c, body)) return { valid: false };
    return {
      valid: true,
      txnId: body.txnid,
      status: body.status === "success" ? "paid" : body.status === "pending" ? "pending" : "failed",
      gatewayPaymentId: body.easepayid,
    };
  },
  async testCredentials(c, mode) {
    // Easebuzz has no read-only "ping": start (and never pay) a ₹1 payment link.
    const r = await ebInitiate(c, mode, {
      txnId: `TEST${Date.now().toString(36).toUpperCase()}`,
      amount: 1,
      currency: "INR",
      purpose: "Connection test",
      customer: { name: "Test", email: "test@example.com", phone: "9999999999" },
      returnUrl: "https://example.com/return",
      webhookUrl: "",
    });
    return r.json?.status === 1
      ? { ok: true, message: `Easebuzz accepted the key and salt (${mode} environment). An unpaid ₹1 test link was created.` }
      : { ok: false, message: gatewayError("Easebuzz", r).message };
  },
};

/* ───────────────────────── Cashfree ───────────────────────── */

const cfBase = (mode: Mode) => (mode === "live" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg");
const cfHeaders = (c: Creds) => ({
  "x-client-id": c.appId,
  "x-client-secret": c.secretKey,
  "x-api-version": "2023-08-01",
  "Content-Type": "application/json",
});
const cfStatus = (s: string): PayStatus => (s === "PAID" || s === "SUCCESS" ? "paid" : s === "ACTIVE" || s === "PENDING" ? "pending" : "failed");

const cashfree: Provider = {
  id: "cashfree",
  name: "Cashfree Payments",
  usesMode: true,
  fields: [
    { key: "appId", label: "App ID (Client ID)", required: true },
    { key: "secretKey", label: "Secret Key (Client Secret)", secret: true, required: true },
  ],
  setup: {
    webhook: "Cashfree Dashboard → Developers → Webhooks → Add Webhook Endpoint. Paste the Webhook URL (it is also sent with every order).",
    webhookEvents: "Payment success, Payment failed",
    returnUrl: "Nothing to whitelist — the return URL is sent with every order.",
    domain: "Cashfree Dashboard → Developers → Whitelisting: add your website domain. Cashfree approves it before live payments work.",
  },
  async createPayment(c, mode, ctx) {
    const r = await call(`${cfBase(mode)}/orders`, {
      method: "POST",
      headers: cfHeaders(c),
      body: JSON.stringify({
        order_id: ctx.txnId,
        order_amount: Number(money(ctx.amount)),
        order_currency: ctx.currency,
        order_note: ctx.purpose,
        customer_details: {
          customer_id: `cust_${digits(ctx.customer.phone).slice(-10) || ctx.txnId}`,
          customer_name: ctx.customer.name,
          customer_email: ctx.customer.email,
          customer_phone: digits(ctx.customer.phone).slice(-10),
        },
        order_meta: { return_url: ctx.returnUrl, notify_url: ctx.webhookUrl },
      }),
    });
    if (r.status >= 300 || !r.json?.payment_session_id) throw gatewayError("Cashfree", r);
    return {
      gatewayOrderId: String(r.json.cf_order_id || ""),
      action: { type: "cashfree", paymentSessionId: r.json.payment_session_id, mode: mode === "live" ? "production" : "sandbox" },
    };
  },
  async verifyReturn(c, mode, { txn }) {
    // Cashfree returns no signed data to the browser — read the order instead.
    const r = await call(`${cfBase(mode)}/orders/${encodeURIComponent(txn.txnId)}`, { headers: cfHeaders(c) });
    if (r.status !== 200) return { status: "pending", message: gatewayError("Cashfree", r).message };
    return { status: cfStatus(r.json.order_status), gatewayPaymentId: String(r.json.cf_order_id || "") };
  },
  async parseWebhook(c, _mode, { rawBody, headers, body }) {
    const ts = String(headers["x-webhook-timestamp"] || "");
    const expected = hmac256(ts + rawBody.toString("utf8"), c.secretKey).toString("base64");
    if (!ts || !safeEqual(expected, String(headers["x-webhook-signature"] || ""))) return { valid: false };
    const orderId = body?.data?.order?.order_id;
    const payment = body?.data?.payment;
    if (!orderId || !payment?.payment_status) return { valid: true, ignored: true };
    return { valid: true, txnId: orderId, status: cfStatus(payment.payment_status), gatewayPaymentId: String(payment.cf_payment_id || "") };
  },
  async testCredentials(c, mode) {
    // An unknown order id: 404 means the keys were accepted, 401 means they were not.
    const r = await call(`${cfBase(mode)}/orders/connection-test-${Date.now()}`, { headers: cfHeaders(c) });
    return r.status === 404 || r.status === 200
      ? { ok: true, message: `Cashfree accepted the keys (${mode === "live" ? "production" : "sandbox"} environment).` }
      : { ok: false, message: gatewayError("Cashfree", r).message };
  },
};

/* ───────────────────────── Stripe ───────────────────────── */

const stripeAuth = (c: Creds) => ({ Authorization: `Bearer ${c.secretKey}` });

const stripe: Provider = {
  id: "stripe",
  name: "Stripe",
  usesMode: false, // decided by the key (sk_test_… / sk_live_…)
  fields: [
    { key: "secretKey", label: "Secret Key", secret: true, required: true, help: "sk_test_… or sk_live_…" },
    { key: "webhookSecret", label: "Webhook Signing Secret", secret: true, help: "whsec_… shown after you add the webhook endpoint on Stripe." },
  ],
  setup: {
    webhook: "Stripe Dashboard → Developers → Webhooks → Add endpoint. Paste the Webhook URL, then copy the signing secret (whsec_…) into the field here.",
    webhookEvents: "checkout.session.completed, checkout.session.expired, checkout.session.async_payment_failed",
    returnUrl: "Nothing to whitelist — the success/cancel URL is sent with every payment.",
    domain: "No domain whitelisting is needed for Stripe Checkout.",
  },
  async createPayment(c, _mode, ctx) {
    const r = await call("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { ...stripeAuth(c), "Content-Type": "application/x-www-form-urlencoded" },
      body: form({
        mode: "payment",
        success_url: ctx.returnUrl,
        cancel_url: ctx.returnUrl,
        client_reference_id: ctx.txnId,
        ...(ctx.customer.email ? { customer_email: ctx.customer.email } : {}),
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": ctx.currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": String(minor(ctx.amount, ctx.currency)),
        "line_items[0][price_data][product_data][name]": ctx.purpose,
      }),
    });
    if (r.status >= 300 || !r.json?.url) throw gatewayError("Stripe", r);
    return { gatewayOrderId: r.json.id, action: { type: "redirect", url: r.json.url } };
  },
  async verifyReturn(c, _mode, { txn }) {
    if (!txn.gatewayOrderId) return { status: "failed" };
    const r = await call(`https://api.stripe.com/v1/checkout/sessions/${txn.gatewayOrderId}`, { headers: stripeAuth(c) });
    if (r.status !== 200) return { status: "pending", message: gatewayError("Stripe", r).message };
    if (r.json.payment_status === "paid") return { status: "paid", gatewayPaymentId: String(r.json.payment_intent || "") };
    return { status: r.json.status === "open" ? "pending" : "failed" };
  },
  async parseWebhook(c, _mode, { rawBody, headers, body }) {
    if (!c.webhookSecret) return { valid: false };
    const parts = Object.fromEntries(String(headers["stripe-signature"] || "").split(",").map((p) => p.split("=") as [string, string]));
    const expected = hmac256(`${parts.t}.${rawBody.toString("utf8")}`, c.webhookSecret).toString("hex");
    if (!parts.t || !safeEqual(expected, parts.v1 || "")) return { valid: false };
    const s = body?.data?.object;
    if (body.type === "checkout.session.completed") {
      return {
        valid: true,
        txnId: s?.client_reference_id,
        status: s?.payment_status === "paid" ? "paid" : "pending",
        gatewayPaymentId: String(s?.payment_intent || ""),
      };
    }
    if (body.type === "checkout.session.expired" || body.type === "checkout.session.async_payment_failed") {
      return { valid: true, txnId: s?.client_reference_id, status: "failed" };
    }
    return { valid: true, ignored: true };
  },
  async testCredentials(c) {
    const r = await call("https://api.stripe.com/v1/balance", { headers: stripeAuth(c) });
    return r.status === 200
      ? { ok: true, message: `Stripe accepted the key (${r.json.livemode ? "live" : "test"} mode).` }
      : { ok: false, message: gatewayError("Stripe", r).message };
  },
};

export const PROVIDERS: Record<string, Provider> = { razorpay, payu, easebuzz, cashfree, stripe };
export const getProvider = (id: string): Provider | undefined => PROVIDERS[id];
