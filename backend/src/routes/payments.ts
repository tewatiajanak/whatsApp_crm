import { Router } from "express";
import { ok, asyncHandler, ApiError, paginated } from "../utils/http";
import { require_ } from "../middleware/auth";
import { PaymentGateway, PaymentTransaction } from "../models/Payment";
import { PROVIDERS, getProvider } from "../services/payments/providers";
import {
  initiatePayment,
  mergeCredentials,
  plainCredentials,
  presentGateway,
  publicBase,
} from "../services/payments";

/**
 * Payment gateway configuration + payments (authenticated).
 * The public side (gateway webhooks, customer return) lives in routes/webhooks.
 */
const r = Router();

const presentTxn = (t: any) => ({
  id: String(t._id),
  txnId: t.txnId,
  provider: t.provider,
  providerName: getProvider(t.provider)?.name || t.provider,
  mode: t.mode,
  amount: t.amount,
  currency: t.currency,
  purpose: t.purpose,
  status: t.status,
  customer: t.customer,
  reference: t.reference,
  gatewayOrderId: t.gatewayOrderId,
  gatewayPaymentId: t.gatewayPaymentId,
  message: t.message,
  isTest: t.isTest,
  paidAt: t.paidAt,
  createdAt: t.createdAt,
});

/* ---- Catalogue: which gateways exist and which fields each one needs ---- */
r.get(
  "/payment-gateways/providers",
  require_("setup", "view"),
  asyncHandler(async (_req: any, res: any) => {
    ok(
      res,
      Object.values(PROVIDERS).map((p) => ({ id: p.id, name: p.name, usesMode: p.usesMode, fields: p.fields, setup: p.setup }))
    );
  })
);

/* ---- Configured gateways ---- */
r.get(
  "/payment-gateways",
  require_("setup", "view"),
  asyncHandler(async (req: any, res: any) => {
    const rows = await PaymentGateway.find({ tenant: req.tenantId }).sort({ createdAt: 1 });
    const base = publicBase(req);
    ok(res, rows.map((g) => presentGateway(g, base)));
  })
);

r.post(
  "/payment-gateways",
  require_("setup", "create"),
  asyncHandler(async (req: any, res: any) => {
    const provider = getProvider(String(req.body?.provider || ""));
    if (!provider) throw new ApiError(400, "Choose a payment gateway");
    const g = await PaymentGateway.create({
      tenant: req.tenantId,
      provider: provider.id,
      label: String(req.body.label || "").trim(),
      mode: req.body.mode === "live" ? "live" : "test",
      credentials: mergeCredentials(provider, req.body.credentials || {}),
      isActive: false,
    });
    ok(res, presentGateway(g, publicBase(req)), 201);
  })
);

r.patch(
  "/payment-gateways/:id",
  require_("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const g = await PaymentGateway.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!g) throw new ApiError(404, "Payment gateway not found");
    const provider = getProvider(g.provider)!;
    if (req.body.label !== undefined) g.label = String(req.body.label).trim();
    if (req.body.mode !== undefined) g.mode = req.body.mode === "live" ? "live" : "test";
    if (req.body.credentials) {
      g.credentials = mergeCredentials(provider, req.body.credentials, g.credentials);
      g.markModified("credentials");
      g.lastTest = undefined; // keys changed — the old test result no longer applies
    }
    await g.save();
    ok(res, presentGateway(g, publicBase(req)));
  })
);

r.delete(
  "/payment-gateways/:id",
  require_("setup", "del"),
  asyncHandler(async (req: any, res: any) => {
    const done = await PaymentGateway.deleteOne({ _id: req.params.id, tenant: req.tenantId });
    if (!done.deletedCount) throw new ApiError(404, "Payment gateway not found");
    ok(res, { id: req.params.id });
  })
);

// Exactly one gateway takes payments at a time: activating one deactivates the rest.
r.post(
  "/payment-gateways/:id/activate",
  require_("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const g = await PaymentGateway.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!g) throw new ApiError(404, "Payment gateway not found");
    const active = req.body?.active !== false;
    if (active) await PaymentGateway.updateMany({ tenant: req.tenantId, _id: { $ne: g._id } }, { $set: { isActive: false } });
    g.isActive = active;
    await g.save();
    const rows = await PaymentGateway.find({ tenant: req.tenantId }).sort({ createdAt: 1 });
    const base = publicBase(req);
    ok(res, rows.map((x) => presentGateway(x, base)));
  })
);

// Ask the gateway whether it accepts the saved keys.
r.post(
  "/payment-gateways/:id/test",
  require_("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const g = await PaymentGateway.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!g) throw new ApiError(404, "Payment gateway not found");
    let result: { ok: boolean; message: string };
    try {
      result = await getProvider(g.provider)!.testCredentials(plainCredentials(g), g.mode);
    } catch (e: any) {
      result = { ok: false, message: `Could not reach the gateway: ${String(e?.message || e).slice(0, 160)}` };
    }
    g.lastTest = { ...result, at: new Date() };
    await g.save();
    ok(res, presentGateway(g, publicBase(req)));
  })
);

/* ---- Payments ---- */
r.post(
  "/payments/initiate",
  asyncHandler(async (req: any, res: any) => {
    const body = req.body || {};
    // Paying through a gateway other than the active one is only for testing a setup.
    if (body.gatewayId) {
      const p = (req.perms || []).find((x: any) => x.module === "setup");
      if (!p?.edit) throw new ApiError(403, "Forbidden: need edit on setup");
    }
    ok(res, await initiatePayment(req.tenantId, publicBase(req), body), 201);
  })
);

r.get(
  "/payments",
  require_("setup", "view"),
  asyncHandler(async (req: any, res: any) => {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(String(req.query.perPage || "25"), 10) || 25));
    const filter: any = { tenant: req.tenantId };
    if (req.query.status) filter.status = String(req.query.status);
    const [rows, total] = await Promise.all([
      PaymentTransaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
      PaymentTransaction.countDocuments(filter),
    ]);
    paginated(res, rows.map(presentTxn), total, page, perPage);
  })
);

r.get(
  "/payments/:txnId",
  asyncHandler(async (req: any, res: any) => {
    const t = await PaymentTransaction.findOne({ txnId: req.params.txnId, tenant: req.tenantId }).lean();
    if (!t) throw new ApiError(404, "Transaction not found");
    ok(res, presentTxn(t));
  })
);

export default r;
