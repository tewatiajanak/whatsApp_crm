import { Request, Response } from "express";
import { Integration } from "../models/System";
import { convertToLead } from "../services/leadService";
import { LeadSource } from "../models/Masters";
import { asyncHandler, ok, ApiError, audit } from "../utils/http";

/**
 * List Facebook Lead Ads Integration accounts for current tenant
 */
export const listAccounts = asyncHandler(async (req: any, res: Response) => {
  const tenant = req.tenantId;
  const list = await Integration.find({ tenant, key: { $regex: /^facebook/i } }).sort({ createdAt: -1 });
  ok(res, list);
});

/**
 * Create a new Facebook Integration account
 */
export const createAccount = asyncHandler(async (req: any, res: Response) => {
  const tenant = req.tenantId;
  const { pageName, pageId, pageAccessToken, verifyToken, appSecret, active, formMapping } = req.body;

  if (!pageName || !pageId) {
    throw new ApiError(400, "Page Name and Page ID are required");
  }

  // Set other facebook integrations inactive if this one is set active
  if (active) {
    await Integration.updateMany({ tenant, key: { $regex: /^facebook/i } }, { connected: false });
  }

  const doc = await Integration.create({
    tenant,
    key: `facebook_${pageId}`,
    name: pageName,
    category: "Facebook Lead Ads",
    icon: "facebook",
    desc: `Facebook Page: ${pageName} (${pageId})`,
    connected: Boolean(active),
    account: pageId,
    config: {
      pageName,
      pageId,
      pageAccessToken: pageAccessToken || "",
      verifyToken: verifyToken || "knowvato_fb_token",
      appSecret: appSecret || "",
      formMapping: formMapping || { name: "full_name", phone: "phone_number", email: "email" },
      active: Boolean(active),
      status: pageAccessToken ? "connected" : "untested"
    }
  });

  await audit({
    tenant,
    user: req.user?.name,
    action: "create",
    module: "setup",
    entity: `Facebook Integration: ${pageName}`,
    next: doc._id.toString()
  });
  ok(res, doc, 201);
});

/**
 * Update an existing Facebook Integration account
 */
export const updateAccount = asyncHandler(async (req: any, res: Response) => {
  const tenant = req.tenantId;
  const { id } = req.params;
  const doc = await Integration.findOne({ _id: id, tenant });
  if (!doc) throw new ApiError(404, "Facebook integration not found");

  const prev = JSON.stringify(doc);
  const { pageName, pageId, pageAccessToken, verifyToken, appSecret, active, formMapping } = req.body;

  if (active) {
    await Integration.updateMany({ tenant, key: { $regex: /^facebook/i }, _id: { $ne: id } }, { connected: false });
  }

  doc.name = pageName || doc.name;
  doc.account = pageId || doc.account;
  doc.connected = active !== undefined ? Boolean(active) : doc.connected;
  doc.config = {
    ...doc.config,
    pageName: pageName || doc.config?.pageName,
    pageId: pageId || doc.config?.pageId,
    pageAccessToken: pageAccessToken !== undefined ? pageAccessToken : doc.config?.pageAccessToken,
    verifyToken: verifyToken !== undefined ? verifyToken : doc.config?.verifyToken,
    appSecret: appSecret !== undefined ? appSecret : doc.config?.appSecret,
    formMapping: formMapping || doc.config?.formMapping,
    active: active !== undefined ? Boolean(active) : doc.config?.active
  };

  await doc.save();
  await audit({
    tenant,
    user: req.user?.name,
    action: "update",
    module: "setup",
    entity: `Facebook Integration: ${doc.name}`,
    prev,
    next: JSON.stringify(doc)
  });
  ok(res, doc);
});

/**
 * Delete a Facebook Integration account
 */
export const deleteAccount = asyncHandler(async (req: any, res: Response) => {
  const tenant = req.tenantId;
  const { id } = req.params;
  const doc = await Integration.findOneAndDelete({ _id: id, tenant });
  if (!doc) throw new ApiError(404, "Facebook integration not found");
  await audit({
    tenant,
    user: req.user?.name,
    action: "delete",
    module: "setup",
    entity: `Facebook Integration: ${doc.name}`,
    prev: JSON.stringify(doc)
  });
  ok(res, { deleted: true });
});

/**
 * Activate a Facebook Integration
 */
export const activate = asyncHandler(async (req: any, res: Response) => {
  const tenant = req.tenantId;
  const { id } = req.params;
  await Integration.updateMany({ tenant, key: { $regex: /^facebook/i } }, { connected: false });
  const doc = await Integration.findOneAndUpdate({ _id: id, tenant }, { connected: true }, { new: true });
  if (!doc) throw new ApiError(404, "Facebook integration not found");
  ok(res, doc);
});

/**
 * Test Facebook Meta Graph API Connection
 */
export const testConnection = asyncHandler(async (req: any, res: Response) => {
  const { pageAccessToken, pageId } = req.body;
  const token = pageAccessToken || "";
  
  if (!token) {
    throw new ApiError(400, "Page Access Token is required to test connection");
  }

  try {
    const apiRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(token)}`);
    const data: any = await apiRes.json();

    if (data.error) {
      return ok(res, { ok: false, error: data.error.message || "Meta API error" });
    }

    return ok(res, { ok: true, me: data, pageId: data.id || pageId });
  } catch (err: any) {
    return ok(res, { ok: false, error: err.message || "Network error contacting Meta Graph API" });
  }
});

/**
 * Fetch Facebook Page Lead Generation Forms
 */
export const fetchLeadForms = asyncHandler(async (req: any, res: Response) => {
  const tenant = req.tenantId;
  const { id } = req.params;
  const doc = await Integration.findOne({ _id: id, tenant });
  const token = doc?.config?.pageAccessToken || req.body?.pageAccessToken;
  const pageId = doc?.config?.pageId || req.body?.pageId;

  if (!token || !pageId) {
    throw new ApiError(400, "Page Access Token and Page ID are required");
  }

  try {
    const apiRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}/leadgen_forms?access_token=${encodeURIComponent(token)}`);
    const data: any = await apiRes.json();

    if (data.error) {
      return ok(res, { ok: false, error: data.error.message });
    }

    return ok(res, { ok: true, forms: data.data || [] });
  } catch (err: any) {
    return ok(res, { ok: false, error: err.message });
  }
});

/**
 * Facebook Webhook Verification Challenge (GET /webhooks/facebook/:tenantId)
 */
export const fbWebhookVerify = (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && challenge) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
};

/**
 * Facebook Incoming Lead Webhook Event Handler (POST /webhooks/facebook/:tenantId)
 */
export const fbWebhookReceive = asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const body = req.body;

  res.status(200).send("EVENT_RECEIVED");

  if (body.object === "page") {
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field === "leadgen") {
          const leadgenId = change.value?.leadgen_id;
          const pageId = change.value?.page_id;

          if (leadgenId && tenantId) {
            // Find Facebook integration config for tenant
            const doc = await Integration.findOne({ tenant: tenantId, account: pageId });
            const token = doc?.config?.pageAccessToken;

            if (token) {
              try {
                const leadRes = await fetch(`https://graph.facebook.com/v21.0/${leadgenId}?access_token=${encodeURIComponent(token)}`);
                const leadData: any = await leadRes.json();

                if (leadData && leadData.field_data) {
                  let name = "Facebook Lead";
                  let phone = "";
                  let email = "";

                  for (const f of (leadData.field_data as any[])) {
                    if (["full_name", "name", "first_name"].includes(f.name)) name = f.values?.[0] || name;
                    if (["phone_number", "phone", "mobile"].includes(f.name)) phone = f.values?.[0] || phone;
                    if (["email", "email_address"].includes(f.name)) email = f.values?.[0] || email;
                  }

                  let city = "";
                  let state = "";
                  let course = "";
                  for (const f of (leadData.field_data as any[])) {
                    if (f.name === "city") city = f.values?.[0] || "";
                    if (["state", "province"].includes(f.name)) state = f.values?.[0] || "";
                    if (["course", "program", "class", "grade"].includes(f.name)) course = f.values?.[0] || "";
                  }

                  // a lead needs a phone number; email-only submissions cannot be followed up by call or WhatsApp
                  if (phone) {
                    let source = await LeadSource.findOne({ tenant: tenantId, name: /facebook/i });
                    if (!source) source = await LeadSource.create({ tenant: tenantId, name: "Facebook Ads" });

                    await convertToLead({
                      tenant: tenantId,
                      name,
                      phone,
                      email,
                      city,
                      state,
                      course,
                      sourceKeyOrId: String(source._id),
                      capturedFrom: "Facebook Lead Ad",
                      utm: { source: "facebook", medium: "paid", campaign: String(leadData.campaign_name || leadData.ad_name || "") },
                      note: `Captured from Facebook Lead Ad #${leadgenId}`,
                      user: "Facebook",
                    });
                  } else {
                    console.warn(`[facebook] lead ${leadgenId} has no phone number — not saved`);
                  }
                }
              } catch (e) {
                console.error("Error processing Facebook lead:", e);
              }
            }
          }
        }
      }
    }
  }
});
