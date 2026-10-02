import { Request, Response } from "express";
import { Campaign, Message, Conversation, Template } from "../models/Messaging";
import { Lead } from "../models/Lead";
import { LeadStatus, LeadSource } from "../models/Masters";
import { ChatbotRule } from "../models/ChatbotRule";
import { asyncHandler, ok, ApiError, audit } from "../utils/http";
import { launchCampaign } from "../services/campaignService";
import {
  sendText,
  sendTemplate,
  sendMedia,
  sendLocation,
  sendInteractiveButtons,
  sendInteractiveList,
  createMetaTemplate as createMetaTemplateService,
  editMetaTemplateById as editMetaTemplateByIdService,
  fetchMetaTemplates as fetchMetaTemplatesService,
  getMetaTemplateById as getMetaTemplateByIdService,
  uploadMetaMedia as uploadMetaMediaService,
  deleteMetaTemplate as deleteMetaTemplateService,
  getPhoneProfile as getPhoneProfileService,
  updateBusinessProfile as updateBusinessProfileService,
  verifyWebhook,
  parseInbound,
  activeVendor,
} from "../services/whatsapp";
import { processChatbotInbound } from "../services/chatbotEngine";
import { activateAccount, invalidateProvider } from "../services/providers/registry";
import { config } from "../config";
import { WhatsAppAccount } from "../models/WhatsAppAccount";
import { sendEmail, renderTemplate } from "../services/email";
import { convertToLead } from "../services/leadService";
import fs from "fs/promises";
function toLocalTemplateStatus(metaStatus: any): "Approved" | "Pending" | "Rejected" {
  const normalized = String(metaStatus || "").trim().toUpperCase();
  if (normalized === "APPROVED" || normalized === "ACTIVE") return "Approved";
  if (normalized === "REJECTED" || normalized.includes("REJECT")) return "Rejected";
  return "Pending";
}

function extractMetaRejectionReason(metaObj: any): string | undefined {
  const candidates = [
    metaObj?.rejected_reason,
    metaObj?.rejection_reason,
    metaObj?.rejectionReason,
    metaObj?.reason,
    metaObj?.status_reason,
    metaObj?.rejection_details?.reason,
    metaObj?.rejection_details?.description,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

/* ───────── Shared send (called by OTHER modules via the platform SDK) ───────── */
export const sharedSend = asyncHandler(async (req: Request, res: Response) => {
  const {
    channel = "whatsapp",
    to,
    template,
    params = [],
    templateComponents,
    languageCode,
    text,
    subject,
    type,
    mediaUrl,
    caption,
    filename,
    latitude,
    longitude,
    buttons,
    buttonTitle,
    sections,
    header,
    footer,
    meta,
  } = req.body || {};
  if (!to) throw new ApiError(400, "`to` is required");
  // who/what the message was for — kept with the message so the sender's history can show it
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
  const info = {
    channel: channel === "email" ? "email" : "whatsapp",
    source: str(meta?.source, 40),
    eventId: str(meta?.eventId, 80),
    eventName: str(meta?.eventName, 200),
    contactName: str(meta?.contactName, 200),
    template: str(meta?.templateName, 200) || template,
  };
  // a failed send is recorded too when the sender keeps a history
  const recordFailure = async (e: any, body?: string) => {
    if (info.source)
      await Message.create({
        tenant: req.tenantId,
        direction: "outbound",
        type: template ? "template" : "text",
        body,
        subject: channel === "email" ? subject : undefined,
        phone: to,
        status: "failed",
        failReason: String(e?.message || "Send failed").slice(0, 500),
        agent: req.auth?.name || "system",
        ...info,
      }).catch(() => undefined);
    throw e;
  };

  if (channel === "email") {
    let html = text;
    let subj = subject || "Message from Greenwood";
    if (template) {
      const tpl = await Template.findOne({ tenant: req.tenantId, name: template });
      if (!tpl) throw new ApiError(404, `Template '${template}' not found`);
      html = renderTemplate(tpl.body, params);
      subj = subject || tpl.name.replace(/_/g, " ");
    }
    if (!html) throw new ApiError(400, "Provide `template` or `text` for the email body");
    const result = await sendEmail({ to, subject: subj, html }).catch((e) => recordFailure(e, html));
    await Message.create({
      tenant: req.tenantId,
      direction: "outbound",
      type: template ? "template" : "text",
      ...info,
      subject: subj,
      simulated: !!result.simulated,
      body: html,
      phone: to,
      status: "sent",
      sentAt: new Date(),
      agent: req.auth?.name || "system",
      waMessageId: result.messageId,
      category: "email",
    });
    await audit({
      tenant: req.tenantId,
      user: req.auth?.name,
      action: "SEND",
      module: "Communication",
      entity: to,
      next: `email: ${template || "text"}`,
    });
    return ok(res, { messageId: result.messageId, simulated: result.simulated, channel: "email" });
  }

  if (channel !== "whatsapp") throw new ApiError(400, `Channel '${channel}' not supported yet`);

  let result: any;
  let msgType = "text";

  try {
  if (type === "media" && mediaUrl) {
    msgType = "image";
    result = await sendMedia(req.tenantId!, to, "image", mediaUrl, caption, filename);
  } else if (type === "location" && latitude && longitude) {
    msgType = "document";
    result = await sendLocation(req.tenantId!, to, +latitude, +longitude, caption);
  } else if (type === "buttons" && buttons && buttons.length > 0) {
    msgType = "text";
    result = await sendInteractiveButtons(req.tenantId!, to, text || "Select an option:", buttons, header, footer);
  } else if (type === "list" && sections && sections.length > 0) {
    msgType = "text";
    result = await sendInteractiveList(req.tenantId!, to, text || "Select from menu:", buttonTitle || "Options", sections, header, footer);
  } else if (template) {
    msgType = "template";
    const preparedComponents = Array.isArray(templateComponents) && templateComponents.length ? templateComponents : params;
    result = await sendTemplate(req.tenantId!, to, template, languageCode || "en", preparedComponents);
  } else if (text) {
    msgType = "text";
    result = await sendText(req.tenantId!, to, text);
  } else {
    throw new ApiError(400, "Provide template, text, mediaUrl, or interactive payload");
  }
  } catch (e) {
    await recordFailure(e, text || (template ? str(meta?.preview, 4000) : undefined));
  }

  await Message.create({
    tenant: req.tenantId,
    direction: "outbound",
    type: msgType as any,
    ...info,
    simulated: !!result.simulated,
    body: (template && str(meta?.preview, 4000)) || text || caption || (buttons ? "Interactive buttons" : "Interactive list"),
    phone: to,
    status: "sent",
    sentAt: new Date(),
    agent: req.auth?.name || "system",
    waMessageId: result.waMessageId,
  });
  await audit({
    tenant: req.tenantId,
    user: req.auth?.name,
    action: "SEND",
    module: "Communication",
    entity: to,
    next: template || text || type,
  });
  ok(res, { waMessageId: result.waMessageId, simulated: result.simulated, channel });
});

/* ───────── Meta Template Creation & Management ───────── */

export const createMetaTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { name, category = "UTILITY", language = "en", headerType = "NONE", headerText, headerMediaUrl, body, footer, buttons = [] } = req.body || {};
  if (!name || !body) throw new ApiError(400, "Template name and body are required");

  // Construct Meta Graph API components payload
  const components: any[] = [];

  // 1. Header
  if (headerType === "TEXT" && headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: headerText });
  } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)) {
    components.push({ type: "HEADER", format: headerType, example: { header_handle: [headerMediaUrl || "https://example.com/media"] } });
  }

  // 2. Body
  components.push({ type: "BODY", text: body });

  // 3. Footer
  if (footer) {
    components.push({ type: "FOOTER", text: footer });
  }

  // 4. Buttons
  if (buttons && buttons.length > 0) {
    const formattedButtons = buttons.map((b: any) => {
      if (b.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: b.text };
      if (b.type === "URL") return { type: "URL", text: b.text, url: b.url };
      if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phoneNumber };
      if (b.type === "COPY_CODE") return { type: "COPY_CODE", example: b.code || "OFFER50" };
      return { type: "QUICK_REPLY", text: b.text };
    });
    components.push({ type: "BUTTONS", buttons: formattedButtons });
  }

  const metaPayload = {
    name: name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    category: category.toUpperCase(),
    language,
    components,
  };

  const metaRes = await createMetaTemplateService(req.tenantId!, metaPayload);
  const localStatus = toLocalTemplateStatus(metaRes.status);
  const rejectionReason = localStatus === "Rejected" ? extractMetaRejectionReason(metaRes) : undefined;

  // Save/update locally
  const tpl = await Template.findOneAndUpdate(
    { tenant: req.tenantId, name: metaPayload.name },
    {
      $set: {
        tenant: req.tenantId,
        name: metaPayload.name,
        channel: "whatsapp",
        category: category as any,
        language,
        status: localStatus,
        body,
        metaId: metaRes.id,
        rejectionReason,
        components,
      },
    },
    { upsert: true, new: true }
  );

  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Templates", entity: `Meta Template: ${tpl.name}` });
  ok(res, { template: tpl, metaResponse: metaRes }, 201);
});

export const uploadMetaTestMedia = asyncHandler(async (req: any, res: Response) => {
  if (!req.file) throw new ApiError(400, "Media file is required");
  const filePath = req.file.path;
  const mimeType = req.file.mimetype || "application/octet-stream";
  const originalName = req.file.originalname || "upload";

  try {
    const metaRes = await uploadMetaMediaService(req.tenantId!, filePath, mimeType, originalName);
    if (!metaRes?.id) {
      throw new ApiError(500, "Meta did not return media id");
    }
    ok(res, { id: metaRes.id, mimeType, fileName: originalName });
  } finally {
    try {
      await fs.unlink(filePath);
    } catch {
      // ignore cleanup errors
    }
  }
});

export const editMetaTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { category, components, time_to_live_seconds } = req.body || {};

  const tpl = await Template.findOne({ _id: id, tenant: req.tenantId, channel: "whatsapp" });
  if (!tpl) throw new ApiError(404, "Template not found");
  if (!tpl.metaId) throw new ApiError(400, "Meta template ID not found for this template");

  const metaTemplate = await getMetaTemplateByIdService(req.tenantId!, String(tpl.metaId));
  const metaStatus = String(metaTemplate?.status || "").trim().toUpperCase();
  const editableStatuses = new Set(["APPROVED", "REJECTED", "PAUSED"]);

  if (!editableStatuses.has(metaStatus)) {
    throw new ApiError(400, `Template with status '${metaTemplate?.status || "UNKNOWN"}' cannot be edited on Meta`);
  }

  const payload: any = {};
  const incomingCategory = category ? String(category).toUpperCase() : undefined;

  if (incomingCategory && incomingCategory !== String(metaTemplate?.category || "").toUpperCase()) {
    if (metaStatus === "APPROVED") {
      throw new ApiError(400, "Meta does not allow category changes for approved templates");
    }
    payload.category = incomingCategory;
  }

  if (Array.isArray(components)) {
    if (!components.length) throw new ApiError(400, "Components cannot be empty");
    payload.components = components;
  }

  if (typeof time_to_live_seconds === "number" && Number.isFinite(time_to_live_seconds) && time_to_live_seconds > 0) {
    payload.time_to_live_seconds = time_to_live_seconds;
  }

  if (!Object.keys(payload).length) {
    throw new ApiError(400, "Nothing to update. Send category, components, or time_to_live_seconds");
  }

  const metaRes = await editMetaTemplateByIdService(req.tenantId!, String(tpl.metaId), payload);

  const bodyComp = Array.isArray(payload.components)
    ? payload.components.find((c: any) => c.type === "BODY")
    : tpl.components?.find?.((c: any) => c.type === "BODY");

  if (payload.category === "MARKETING") tpl.category = "Marketing" as any;
  if (payload.category === "AUTHENTICATION") tpl.category = "Authentication" as any;
  if (payload.category === "UTILITY") tpl.category = "Utility" as any;
  if (Array.isArray(payload.components)) {
    tpl.components = payload.components;
  }
  if (bodyComp?.text) {
    tpl.body = bodyComp.text;
  }

  // Any non-media structural edit is re-reviewed by Meta.
  tpl.status = "Pending";
  tpl.rejectionReason = undefined;
  await tpl.save();

  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Templates", entity: `Meta Template: ${tpl.name}` });
  ok(res, { template: tpl, metaResponse: metaRes, editableStatus: metaTemplate?.status });
});

export const syncMetaTemplates = asyncHandler(async (req: Request, res: Response) => {
  const requestedNames = Array.isArray(req.body?.names)
    ? req.body.names.map((name: any) => String(name).trim()).filter(Boolean)
    : [];
  const metaTemplates = await fetchMetaTemplatesService(req.tenantId!);
  const localMetaNames = new Set(
    (await Template.find({ tenant: req.tenantId, channel: "whatsapp", metaId: { $exists: true, $ne: null } }).distinct("name"))
      .map((name) => String(name))
  );
  const approvedMetaTemplates = metaTemplates.filter((mt) => toLocalTemplateStatus(mt.status) === "Approved");
  const selectedMetaTemplates = requestedNames.length
    ? approvedMetaTemplates.filter((mt) => requestedNames.includes(mt.name))
    : approvedMetaTemplates.filter((mt) => !localMetaNames.has(mt.name));
  const synced: any[] = [];

  for (const mt of selectedMetaTemplates) {
    const bodyComp = mt.components?.find((c: any) => c.type === "BODY");
    const localStatus = toLocalTemplateStatus(mt.status);
    const rejectionReason = localStatus === "Rejected" ? extractMetaRejectionReason(mt) : undefined;
    const tpl = await Template.findOneAndUpdate(
      { tenant: req.tenantId, name: mt.name },
      {
        $set: {
          tenant: req.tenantId,
          name: mt.name,
          channel: "whatsapp",
          category: mt.category === "MARKETING" ? "Marketing" : "Utility",
          language: mt.language || "en",
          status: localStatus,
          body: bodyComp?.text || "",
          metaId: mt.id,
          rejectionReason,
          components: mt.components,
        },
      },
      { upsert: true, new: true }
    );
    synced.push(tpl);
  }

  ok(res, { count: synced.length, templates: synced });
});

export const listMetaSyncCandidates = asyncHandler(async (req: Request, res: Response) => {
  const metaTemplates = await fetchMetaTemplatesService(req.tenantId!);
  const localMetaNames = new Set(
    (await Template.find({ tenant: req.tenantId, channel: "whatsapp", metaId: { $exists: true, $ne: null } }).distinct("name"))
      .map((name) => String(name))
  );

  const candidates = metaTemplates
    .filter((mt) => toLocalTemplateStatus(mt.status) === "Approved")
    .filter((mt) => !localMetaNames.has(mt.name))
    .map((mt) => ({
      name: mt.name,
      category: mt.category,
      language: mt.language || "en",
      status: mt.status,
      components: mt.components,
      body: mt.components?.find((c: any) => c.type === "BODY")?.text || "",
    }));

  ok(res, { count: candidates.length, templates: candidates });
});

export const deleteMetaTemplate = asyncHandler(async (req: Request, res: Response) => {
  const { name } = req.params;
  await deleteMetaTemplateService(req.tenantId!, name);
  await Template.deleteOne({ tenant: req.tenantId, name });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Templates", entity: `Meta Template: ${name}` });
  ok(res, { deleted: true });
});

/* ───────── Meta WABA Profile Graph API ───────── */

export const getMetaProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await getPhoneProfileService(req.tenantId!);
  ok(res, profile);
});

export const updateMetaProfile = asyncHandler(async (req: Request, res: Response) => {
  const updated = await updateBusinessProfileService(req.tenantId!, req.body);
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Setup", entity: "Meta Business Profile" });
  ok(res, updated);
});

/* ───────── Chatbot Rules Management ───────── */

export const listChatbotRules = asyncHandler(async (req: Request, res: Response) => {
  const rules = await ChatbotRule.find({ tenant: req.tenantId }).sort({ order: 1, createdAt: -1 });
  ok(res, rules);
});

export const createChatbotRule = asyncHandler(async (req: Request, res: Response) => {
  const rule = await ChatbotRule.create({ ...req.body, tenant: req.tenantId });
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Workflows", entity: `Chatbot Rule: ${rule.name}` });
  ok(res, rule, 201);
});

export const updateChatbotRule = asyncHandler(async (req: Request, res: Response) => {
  const rule = await ChatbotRule.findOneAndUpdate(
    { _id: req.params.id, tenant: req.tenantId },
    { $set: req.body },
    { new: true }
  );
  if (!rule) throw new ApiError(404, "Chatbot rule not found");
  ok(res, rule);
});

export const deleteChatbotRule = asyncHandler(async (req: Request, res: Response) => {
  const rule = await ChatbotRule.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
  if (!rule) throw new ApiError(404, "Chatbot rule not found");
  ok(res, { deleted: true });
});

export const testChatbotRule = asyncHandler(async (req: Request, res: Response) => {
  const { messageText, phone = "+919999900000", interactiveReply } = req.body;
  await processChatbotInbound(req.tenantId!, {
    kind: "message",
    from: phone,
    text: messageText,
    interactiveReply,
    messageType: interactiveReply ? "interactive" : "text",
    timestamp: new Date(),
  });
  ok(res, { tested: true, phone, messageText, interactiveReply });
});

/* ───────── Campaigns ───────── */
export const launch = asyncHandler(async (req: Request, res: Response) => {
  const result = await launchCampaign({ tenant: req.tenantId, campaignId: req.params.id, user: req.auth?.name });
  ok(res, result);
});

export const pauseCampaign = asyncHandler(async (req: Request, res: Response) => {
  const c = await Campaign.findOneAndUpdate(
    { _id: req.params.id, tenant: req.tenantId },
    { $set: { status: req.body.status === "Running" ? "Running" : "Paused" } },
    { new: true }
  );
  if (!c) throw new ApiError(404, "Campaign not found");
  ok(res, c);
});

/* ───────── Conversations (1:1, WABA) ───────── */
export const replyToConversation = asyncHandler(async (req: Request, res: Response) => {
  const { text, template, type, buttons, listButtonText, sections, mediaUrl, caption } = req.body;
  const conv = await Conversation.findOne({ _id: req.params.id, tenant: req.tenantId });
  if (!conv) throw new ApiError(404, "Conversation not found");

  const windowOpen = conv.windowExpiresAt.getTime() > Date.now();
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  if (template) {
    await sendTemplate(req.tenantId!, conv.phone, template);
    conv.messages.push({ from: "me", time: hhmm, type: "template", template, agent: req.auth?.name, at: now });
    conv.last = "Template: " + template;
    conv.windowExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
  } else if (type === "buttons" && buttons) {
    if (!windowOpen) throw new ApiError(409, "24-hour window closed — send an approved template instead");
    await sendInteractiveButtons(req.tenantId!, conv.phone, text || "Select an option:", buttons);
    conv.messages.push({ from: "me", time: hhmm, type: "text", text: `[BUTTONS] ${text}`, agent: req.auth?.name, at: now });
    conv.last = `[Buttons] ${text}`;
  } else if (type === "list" && sections) {
    if (!windowOpen) throw new ApiError(409, "24-hour window closed — send an approved template instead");
    await sendInteractiveList(req.tenantId!, conv.phone, text || "Select from menu:", listButtonText || "Menu", sections);
    conv.messages.push({ from: "me", time: hhmm, type: "text", text: `[LIST] ${text}`, agent: req.auth?.name, at: now });
    conv.last = `[List] ${text}`;
  } else if (type === "media" && mediaUrl) {
    if (!windowOpen) throw new ApiError(409, "24-hour window closed — send an approved template instead");
    await sendMedia(req.tenantId!, conv.phone, "image", mediaUrl, caption);
    conv.messages.push({ from: "me", time: hhmm, type: "image", text: caption || "[Media Attachment]", agent: req.auth?.name, at: now });
    conv.last = caption || "[Image]";
  } else {
    if (!windowOpen) throw new ApiError(409, "24-hour window closed — send an approved template instead");
    if (!text) throw new ApiError(400, "text required");
    await sendText(req.tenantId!, conv.phone, text);
    conv.messages.push({ from: "me", time: hhmm, type: "text", text, agent: req.auth?.name, at: now });
    conv.last = text;
  }
  conv.lastTime = hhmm;
  await conv.save();

  await Message.create({
    tenant: req.tenantId,
    conversation: conv._id,
    direction: "outbound",
    type: template ? "template" : type === "media" ? "image" : "text",
    template,
    body: text || caption,
    contactName: conv.name,
    phone: conv.phone,
    status: "sent",
    sentAt: now,
    agent: req.auth?.name,
  });
  ok(res, conv);
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const conv = await Conversation.findOneAndUpdate(
    { _id: req.params.id, tenant: req.tenantId },
    { $set: { unread: 0 } },
    { new: true }
  );
  if (!conv) throw new ApiError(404, "Conversation not found");
  ok(res, conv);
});

/* ───────── Conversion analytics ───────── */
export const conversionStats = asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenantId;
  const [statuses, sources, leads] = await Promise.all([
    LeadStatus.find({ tenant }).sort({ order: 1 }),
    LeadSource.find({ tenant }),
    Lead.find({ tenant }),
  ]);
  const statusMap: any = Object.fromEntries(statuses.map((s) => [String(s._id), s]));

  const won = leads.filter((l) => statusMap[String(l.status)]?.isWon).length;
  const lost = leads.filter((l) => statusMap[String(l.status)]?.isLost).length;
  const open = leads.length - won - lost;

  const funnel = statuses
    .filter((s) => !s.isLost)
    .map((st) => ({
      status: st.name,
      color: st.color,
      count: leads.filter((l) => (statusMap[String(l.status)]?.order || 0) >= st.order && !statusMap[String(l.status)]?.isLost).length,
    }));

  const bySource = sources
    .map((src) => {
      const set = leads.filter((l) => String(l.source) === String(src._id));
      const w = set.filter((l) => statusMap[String(l.status)]?.isWon).length;
      return { source: src.name, color: src.color, total: set.length, won: w, rate: set.length ? Math.round((w / set.length) * 100) : 0 };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const owners = [...new Set(leads.map((l) => l.owner))];
  const byOwner = owners
    .map((o) => {
      const set = leads.filter((l) => l.owner === o);
      const w = set.filter((l) => statusMap[String(l.status)]?.isWon).length;
      return { owner: o, total: set.length, won: w, rate: set.length ? Math.round((w / set.length) * 100) : 0 };
    })
    .sort((a, b) => b.won - a.won);

  ok(res, {
    totals: { leads: leads.length, won, lost, open, convRate: leads.length ? +((won / leads.length) * 100).toFixed(1) : 0 },
    funnel,
    bySource,
    byOwner,
  });
});

/* ───────── WhatsApp webhook (vendor → us) ───────── */

export const webhookVerify = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.params.tenantId;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const acc = await WhatsAppAccount.findOne({ tenant: tenantId, active: true });
  const expected = acc?.verifyToken || config.whatsapp.verifyToken;
  if (mode === "subscribe" && token === expected) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

export const webhookReceive = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.params.tenantId;
  const raw = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));

  const trusted = await verifyWebhook(tenantId, raw, req.headers as any);
  if (!trusted) throw new ApiError(401, "Invalid webhook signature");

  res.sendStatus(200); // ACK fast

  try {
    const events = await parseInbound(tenantId, req.body);
    for (const ev of events) {
      if (ev.kind === "status" && ev.waMessageId) {
        const patch: any = { status: ev.status };
        if (ev.status === "delivered") patch.deliveredAt = ev.timestamp || new Date();
        if (ev.status === "read") patch.readAt = ev.timestamp || new Date();
        if (ev.status === "failed") patch.failReason = ev.errorReason || "failed";
        await Message.updateOne({ tenant: tenantId, waMessageId: ev.waMessageId }, { $set: patch });
      } else if (ev.kind === "template_status_update" && ev.templateName) {
        await Template.updateOne(
          { tenant: tenantId, name: ev.templateName },
          { $set: { status: toLocalTemplateStatus(ev.templateStatus) } }
        );
      } else if (ev.kind === "message" && ev.from) {
        const now = ev.timestamp || new Date();
        const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        let conv = await Conversation.findOne({ tenant: tenantId, phone: ev.from });
        if (!conv) {
          conv = await Conversation.create({
            tenant: tenantId,
            name: ev.from,
            phone: ev.from,
            windowOpenedAt: now,
            windowExpiresAt: new Date(now.getTime() + 24 * 3600 * 1000),
            unread: 0,
            messages: [],
          });
        }
        conv.messages.push({ from: "them", time: hhmm, type: "text", text: ev.text, at: now });
        conv.unread = (conv.unread || 0) + 1;
        conv.last = ev.text;
        conv.lastTime = hhmm;
        conv.windowOpenedAt = now;
        conv.windowExpiresAt = new Date(now.getTime() + 24 * 3600 * 1000);
        await conv.save();
        await Message.create({
          tenant: tenantId,
          conversation: conv._id,
          direction: "inbound",
          type: "text",
          body: ev.text,
          contactName: conv.name,
          phone: ev.from,
          status: "received",
        });

        // Trigger Chatbot Engine for automated bot flows
        await processChatbotInbound(tenantId, ev);
      }
    }
  } catch (e) {
    console.error("[webhook] processing error:", (e as Error).message);
  }
});

export const messageToLead = asyncHandler(async (req: Request, res: Response) => {
  const msg = await Message.findOne({ _id: req.params.id, tenant: req.tenantId });
  if (!msg) throw new ApiError(404, "Message not found");
  const result = await convertToLead({
    tenant: req.tenantId,
    name: msg.contactName || msg.phone,
    phone: msg.phone,
    sourceKeyOrId: msg.campaign ? "Campaign" : "Inbound",
    user: req.auth?.name,
  });
  ok(res, result, result.created ? 201 : 200);
});

export const status = asyncHandler(async (req: Request, res: Response) => {
  ok(res, { activeVendor: await activeVendor(req.tenantId!) });
});

const sanitizeSecrets = (input: Record<string, any>) => {
  const patch = { ...input };
  const secretKeys = ["apiKey", "accessToken", "appSecret"];
  for (const key of secretKeys) {
    if (!(key in patch)) continue;
    const raw = patch[key];
    if (raw == null) {
      delete patch[key];
      continue;
    }
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    const isMasked =
      !trimmed ||
      trimmed.includes("•") ||
      /^\*{4,}/.test(trimmed) ||
      trimmed.toLowerCase().includes("unchanged");
    if (isMasked) {
      delete patch[key];
    } else {
      patch[key] = trimmed;
    }
  }
  return patch;
};

/* ───────── WhatsApp account management ───────── */
export const listAccounts = asyncHandler(async (req: Request, res: Response) => {
  const accounts = await WhatsAppAccount.find({ tenant: req.tenantId }).sort({ createdAt: 1 });
  ok(res, accounts);
});

export const createAccount = asyncHandler(async (req: Request, res: Response) => {
  const body = sanitizeSecrets(req.body || {});
  const isFirst = (await WhatsAppAccount.countDocuments({ tenant: req.tenantId })) === 0;
  const shouldBeActive = isFirst || Boolean(body.active);
  if (shouldBeActive) {
    await WhatsAppAccount.updateMany({ tenant: req.tenantId }, { $set: { active: false } });
  }
  const acc = await WhatsAppAccount.create({
    ...body,
    tenant: req.tenantId,
    active: shouldBeActive,
  });
  if (shouldBeActive) invalidateProvider(String(req.tenantId));
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Setup", entity: `WhatsApp account: ${acc.label} (${acc.vendor})` });
  ok(res, acc, 201);
});

export const updateAccount = asyncHandler(async (req: Request, res: Response) => {
  const { active, tenant, ...rawPatch } = req.body || {};
  const patch = sanitizeSecrets(rawPatch);
  const acc = await WhatsAppAccount.findOneAndUpdate(
    { _id: req.params.id, tenant: req.tenantId },
    { $set: patch },
    { new: true }
  );
  if (!acc) throw new ApiError(404, "Account not found");
  invalidateProvider(String(req.tenantId));
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Setup", entity: `WhatsApp account: ${acc.label}` });
  ok(res, acc);
});

export const deleteAccount = asyncHandler(async (req: Request, res: Response) => {
  const acc = await WhatsAppAccount.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
  if (!acc) throw new ApiError(404, "Account not found");
  invalidateProvider(String(req.tenantId));
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: "Setup", entity: `WhatsApp account: ${acc.label}` });
  ok(res, { deleted: true });
});

export const activate = asyncHandler(async (req: Request, res: Response) => {
  const acc = await activateAccount(String(req.tenantId), req.params.id);
  await audit({ tenant: req.tenantId, user: req.auth?.name, action: "ACTIVATE", module: "Setup", entity: `WhatsApp account: ${acc.label} (${acc.vendor})`, next: "Active" });
  ok(res, acc);
});
