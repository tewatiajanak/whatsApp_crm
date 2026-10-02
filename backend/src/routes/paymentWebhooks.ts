import express, { Router } from "express";
import { asyncHandler } from "../utils/http";
import { handleReturn, handleWebhook } from "../services/payments";

/**
 * Public payment endpoints, mounted under /webhooks/payments:
 *
 *   ALL  /return/:txnId            the customer's browser comes back here
 *   POST /:provider/:gatewayId     server-to-server notification from the gateway
 *
 * Nothing here trusts the caller: every outcome is verified against the
 * gateway (signature / hash / server-side lookup) before it is recorded.
 */
const r = Router();

// PayU and Easebuzz post form-encoded bodies; keep the raw bytes for signatures.
r.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

r.all(
  "/return/:txnId",
  asyncHandler(async (req: any, res: any) => {
    let status = "failed";
    let returnUrl = "";
    let amount = "";
    try {
      const txn = await handleReturn(req.params.txnId, req.body || {}, req.query || {});
      status = txn.status;
      returnUrl = txn.returnUrl || "";
      amount = `${txn.currency} ${txn.amount.toFixed(2)}`;
    } catch (e: any) {
      console.error("[payments] return failed:", e?.message || e);
    }

    if (returnUrl) {
      const u = new URL(returnUrl);
      u.searchParams.set("payment", status);
      u.searchParams.set("txn", req.params.txnId);
      // 303: the gateway POSTed to us, the app page must be loaded with GET
      return res.redirect(303, u.toString());
    }

    const title = status === "paid" ? "Payment successful" : status === "pending" ? "Payment is being processed" : "Payment failed";
    const color = status === "paid" ? "#1D724D" : status === "pending" ? "#5A4A2A" : "#C84630";
    res
      .status(200)
      .type("html")
      .send(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>` +
          `<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FAF8F5;font-family:'DM Sans','Segoe UI',sans-serif;color:#253338">` +
          `<div style="background:#fff;border:1px solid #E1DFD7;border-radius:12px;padding:28px 32px;max-width:380px;text-align:center">` +
          `<div style="font-size:18px;font-weight:600;color:${color}">${esc(title)}</div>` +
          `<div style="font-size:13px;color:#66797D;margin-top:8px">${esc(amount)}</div>` +
          `<div style="font-size:12px;color:#66797D;margin-top:4px">Reference: ${esc(req.params.txnId)}</div>` +
          `<div style="font-size:12px;color:#66797D;margin-top:14px">You can close this window.</div></div></body></html>`
      );
  })
);

r.post(
  "/:provider/:gatewayId",
  asyncHandler(async (req: any, res: any) => {
    const valid = await handleWebhook(req.params.provider, req.params.gatewayId, {
      rawBody: req.rawBody || Buffer.from(""),
      headers: req.headers,
      body: req.body || {},
    });
    if (!valid) return res.status(401).json({ ok: false, error: "Invalid signature" });
    res.json({ ok: true });
  })
);

export default r;
