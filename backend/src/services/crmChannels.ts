import { createHmac } from "crypto";
import { config } from "../config";
import { ApiError } from "../utils/http";
import { crmSettingsFor, ICrmSettings } from "../models/CrmExtras";
import { decryptSecret } from "./payments/crypto";

const digits = (p: unknown) => String(p || "").replace(/\D/g, "");
/** 10-digit numbers are taken as Indian. */
const withCountry = (p: unknown) => { const d = digits(p); return d.length === 10 ? `91${d}` : d; };

const parseHeaders = (encrypted: string): Record<string, string> => {
  try {
    const obj = JSON.parse(decryptSecret(encrypted) || "{}");
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
};

/** Replace {to} {message} {sender} … in a gateway URL or body. */
const fillGateway = (tpl: string, vars: Record<string, string>, encode: boolean) =>
  tpl.replace(/\{(\w+)\}/g, (_m, k) => (k in vars ? (encode ? encodeURIComponent(vars[k]) : vars[k]) : `{${k}}`));

export const smsReady = (s: ICrmSettings) => (s.sms.provider === "msg91" && !!s.sms.authKey) || (s.sms.provider === "custom" && !!s.sms.customUrl);
export const telephonyReady = (s: ICrmSettings) =>
  (s.telephony.provider === "exotel" && !!s.telephony.sid && !!s.telephony.apiKey && !!s.telephony.apiToken && !!s.telephony.callerId) ||
  (s.telephony.provider === "custom" && !!s.telephony.customUrl);

/** Send one SMS through the tenant's SMS gateway. `templateId` is the DLT template id, when the gateway needs one. */
export async function sendSms(tenant: any, to: string, message: string, templateId = ""): Promise<{ id: string }> {
  const s = await crmSettingsFor(tenant);
  if (!smsReady(s)) throw new ApiError(400, "SMS is not set up. Add a gateway in CRM Settings → SMS.");
  const number = withCountry(to);
  if (number.length < 10) throw new ApiError(400, "The phone number is not valid");

  if (s.sms.provider === "msg91") {
    const r = await fetch("https://api.msg91.com/api/v2/sendsms", {
      method: "POST",
      headers: { authkey: decryptSecret(s.sms.authKey), "Content-Type": "application/json" },
      body: JSON.stringify({ sender: s.sms.senderId, route: "4", country: "0", DLT_TE_ID: templateId || undefined, PE_ID: s.sms.entityId || undefined, sms: [{ message, to: [number] }] }),
    });
    const out: any = await r.json().catch(() => ({}));
    if (!r.ok || out.type === "error") throw new ApiError(502, `SMS gateway: ${out.message || r.statusText}`);
    return { id: String(out.message || "") };
  }

  const vars = { to: number, message, sender: s.sms.senderId, entityId: s.sms.entityId, templateId };
  const url = fillGateway(s.sms.customUrl, vars, true);
  if (!/^https:\/\//i.test(url)) throw new ApiError(400, "The SMS gateway URL must start with https://");
  const isPost = s.sms.customMethod === "POST";
  const r = await fetch(url, {
    method: isPost ? "POST" : "GET",
    headers: { ...(isPost ? { "Content-Type": "application/json" } : {}), ...parseHeaders(s.sms.customHeaders) },
    body: isPost ? fillGateway(s.sms.customBody || '{"to":"{to}","message":"{message}"}', Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, JSON.stringify(v).slice(1, -1)])), false) : undefined,
  });
  const text = await r.text().catch(() => "");
  if (!r.ok) throw new ApiError(502, `SMS gateway replied ${r.status}: ${text.slice(0, 160)}`);
  return { id: text.slice(0, 80) };
}

/** Secret in the telephony callback URL, so only the provider we called can report on a call. */
export const telephonyToken = (tenantId: any) => createHmac("sha256", config.jwtSecret).update(`telephony:${tenantId}`).digest("hex").slice(0, 32);

/**
 * Ring the counsellor's phone, then connect them to the lead (click-to-call).
 * `callbackBase` is this API's public URL; the provider reports the result there.
 */
export async function placeCall(tenant: any, opts: { agentNumber: string; leadNumber: string; leadId: string; user: string; callbackBase: string }) {
  const s = await crmSettingsFor(tenant);
  if (!telephonyReady(s)) throw new ApiError(400, "Calling is not set up. Add a provider in CRM Settings → Telephony.");
  const from = digits(opts.agentNumber);
  const to = digits(opts.leadNumber);
  if (from.length < 10) throw new ApiError(400, "Your mobile number is missing from your user profile. Add it, then call again.");
  if (to.length < 10) throw new ApiError(400, "The lead's phone number is not valid");
  const callback = `${opts.callbackBase}/webhooks/telephony/${tenant}?k=${telephonyToken(tenant)}`;
  const custom = `${opts.leadId}|${opts.user}`;

  if (s.telephony.provider === "exotel") {
    const auth = Buffer.from(`${s.telephony.apiKey}:${decryptSecret(s.telephony.apiToken)}`).toString("base64");
    const body = new URLSearchParams({
      From: from.slice(-10).padStart(11, "0"), To: to.slice(-10).padStart(11, "0"), CallerId: s.telephony.callerId,
      StatusCallback: callback, "StatusCallbackEvents[0]": "terminal", StatusCallbackContentType: "application/json", CustomField: custom, Record: "true",
    });
    const host = (s.telephony.subdomain || "api.exotel.com").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const r = await fetch(`https://${host}/v1/Accounts/${encodeURIComponent(s.telephony.sid)}/Calls/connect.json`, {
      method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body,
    });
    const out: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(502, `Telephony: ${out?.RestException?.Message || r.statusText}`);
    return { callId: String(out?.Call?.Sid || "") };
  }

  if (!/^https:\/\//i.test(s.telephony.customUrl)) throw new ApiError(400, "The telephony URL must start with https://");
  const r = await fetch(s.telephony.customUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...parseHeaders(s.telephony.customHeaders) },
    body: JSON.stringify({ from, to, callerId: s.telephony.callerId, callbackUrl: callback, reference: custom }),
  });
  const text = await r.text().catch(() => "");
  if (!r.ok) throw new ApiError(502, `Telephony replied ${r.status}: ${text.slice(0, 160)}`);
  let id = "";
  try { const j = JSON.parse(text); id = String(j.callId || j.id || j.sid || ""); } catch { /* not JSON */ }
  return { callId: id };
}
