import { Router } from "express";
import * as msgC from "../controllers/messagingController";
import * as fbC from "../controllers/facebookController";
import paymentWebhookRoutes from "./paymentWebhooks";
import crmWebhookRoutes from "./crmWebhooks";

const r = Router();

/**
 * Vendor webhooks (public — verified per-tenant by the active provider).
 * Each configured WhatsApp account points its callback at its own tenant URL:
 *   GET/POST  /webhooks/whatsapp/:tenantId
 * Works for Meta, Pinnacle, or any vendor — parsing is delegated to the
 * tenant's active provider.
 */
r.get("/whatsapp/:tenantId", msgC.webhookVerify);
r.post("/whatsapp/:tenantId", msgC.webhookReceive);

/**
 * Facebook Lead Gen Webhooks
 *   GET/POST  /webhooks/facebook/:tenantId
 */
r.get("/facebook/:tenantId", fbC.fbWebhookVerify);
r.post("/facebook/:tenantId", fbC.fbWebhookReceive);

/**
 * Payment gateways: customer return + server notifications
 *   ALL  /webhooks/payments/return/:txnId
 *   POST /webhooks/payments/:provider/:gatewayId
 */
r.use("/payments", paymentWebhookRoutes);

/**
 * Lead CRM: leads pushed in by other systems, and call results from telephony
 *   POST /webhooks/leads/:key
 *   POST /webhooks/telephony/:tenantId
 */
r.use(crmWebhookRoutes);

export default r;
