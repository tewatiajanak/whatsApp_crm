import { Router } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { ok, asyncHandler, ApiError, audit } from "../../utils/http";
import { PmTemplate, PM_TEMPLATE_CATEGORIES } from "../../models/pm/Template";
import { PmProduct, PmProductModule, PmTaskTemplate } from "../../models/pm/Product";
import { KEY_REGISTRY, htmlToText, renderKeys, sampleValues, unknownKeys } from "../../services/pm/keys";
import { RULE_EVENTS, RULE_RECIPIENTS } from "../../services/pm/rules";
import { ensureTemplates } from "../../services/pm/templateDefaults";
import { anyRight, pmRight } from "../../services/pm/visibility";
import { emailMode, sendEmail } from "../../services/email";
import { sendText, normalizePhone, createMetaTemplate, editMetaTemplateById, getMetaTemplateById, uploadMetaMedia } from "../../services/whatsapp";
import { WA_LIMITS, approvedPart, cleanWa, metaComponents, metaName, waProblem } from "../../services/pm/waTemplate";

/** Communication templates (dynamic keys) and what the auto-message rule screens need. */
const r = Router();
const AUDIT = "Project Management";
const canRead = anyRight(["pm_templates", "view"], ["pm_setup", "view"], ["pm_projects", "view"]);

// keys, rule events and recipient kinds — one call for the editors
r.get(
  "/template-meta",
  canRead,
  asyncHandler(async (_req: any, res: any) => {
    ok(res, { keys: KEY_REGISTRY, waLimits: WA_LIMITS, categories: PM_TEMPLATE_CATEGORIES, events: RULE_EVENTS, recipients: RULE_RECIPIENTS, emailMode: emailMode() });
  })
);

function templateBody(body: any, existing?: any) {
  const out: any = {};
  const has = (k: string) => body[k] !== undefined;
  if (has("name") || !existing) {
    out.name = String(body.name || "").trim();
    if (!out.name) throw new ApiError(400, "Enter the template name");
  }
  if (has("channel") || !existing) {
    if (!["email", "whatsapp"].includes(body.channel)) throw new ApiError(400, "Choose a channel");
    out.channel = body.channel;
  }
  if (has("category")) {
    if (!(PM_TEMPLATE_CATEGORIES as readonly string[]).includes(body.category)) throw new ApiError(400, "Choose a category");
    out.category = body.category;
  }
  if (has("subject")) out.subject = String(body.subject || "").trim();
  if (has("body") || !existing) {
    out.body = String(body.body || "");
    if (!htmlToText(out.body)) throw new ApiError(400, "Enter the message");
    if (out.body.length > 400_000) throw new ApiError(400, "The message is too large. Use smaller images.");
  }
  if (has("waTemplateName")) out.waTemplateName = String(body.waTemplateName || "").trim();
  if (has("waLanguage")) out.waLanguage = String(body.waLanguage || "en").trim() || "en";
  if (has("active")) out.active = !!body.active;
  const channel = out.channel || existing?.channel;
  if (channel === "whatsapp") {
    const current = existing?.toObject ? existing.toObject().wa : existing?.wa;
    if (has("wa") || !existing) out.wa = cleanWa(body.wa, current);
    // once submitted, the provider knows the template by this name and language
    if (current?.metaId) {
      delete out.waTemplateName;
      delete out.waLanguage;
    } else if (out.waTemplateName) out.waTemplateName = metaName(out.waTemplateName);
    const next = { body: out.body ?? existing?.body, wa: out.wa ?? current };
    const bad = unknownKeys(`${next.wa?.headerText ?? ""} ${(next.wa?.buttons || []).map((b: any) => b.url || "").join(" ")}`);
    if (bad.length) throw new ApiError(400, `Unknown key: {{${bad[0]}}}`);
    // what was approved has changed: it must be submitted again (until then it goes as plain text)
    if (current?.metaId && out.wa && approvedPart(next) !== approvedPart({ body: existing.body, wa: current })) {
      out.wa.metaStatus = "";
      out.wa.rejectionReason = "";
    }
  }
  if (channel === "email" && !(out.subject ?? existing?.subject)) throw new ApiError(400, "Enter the subject");
  const bad = unknownKeys(`${out.subject ?? ""} ${out.body ?? ""}`);
  if (bad.length) throw new ApiError(400, `Unknown key: {{${bad[0]}}}`);
  return out;
}

r.get(
  "/templates",
  canRead,
  asyncHandler(async (req: any, res: any) => {
    await ensureTemplates(req.tenantId);
    const filter: any = { tenant: req.tenantId };
    if (req.query.channel === "email" || req.query.channel === "whatsapp") filter.channel = req.query.channel;
    ok(res, await PmTemplate.find(filter).sort({ category: 1, name: 1 }).lean());
  })
);

r.post(
  "/templates",
  pmRight("templates", "create"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmTemplate.create({ ...templateBody(req.body), tenant: req.tenantId });
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: AUDIT, entity: `Template ${doc.name}` });
    ok(res, doc, 201);
  })
);

r.patch(
  "/templates/:id",
  pmRight("templates", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmTemplate.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!doc) throw new ApiError(404, "Template not found");
    Object.assign(doc, templateBody(req.body, doc));
    await doc.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: AUDIT, entity: `Template ${doc.name}` });
    ok(res, doc);
  })
);

r.delete(
  "/templates/:id",
  pmRight("templates", "del"),
  asyncHandler(async (req: any, res: any) => {
    const id = String(req.params.id);
    const usedBy = (list: any[]) => list.filter((x: any) => (x.autoMessages || []).some((m: any) => String(m.template) === id)).length;
    const [tasks, mods, prods] = await Promise.all([
      PmTaskTemplate.find({ tenant: req.tenantId }).select("autoMessages").lean(),
      PmProductModule.find({ tenant: req.tenantId }).select("autoMessages").lean(),
      PmProduct.find({ tenant: req.tenantId }).select("autoMessages").lean(),
    ]);
    const n = usedBy(tasks) + usedBy(mods) + usedBy(prods);
    if (n) throw new ApiError(409, `Used by ${n} auto-message rule${n === 1 ? "" : "s"}. It cannot be deleted; make it inactive instead.`);
    const doc = await PmTemplate.findOneAndDelete({ _id: id, tenant: req.tenantId });
    if (!doc) throw new ApiError(404, "Template not found");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "DELETE", module: AUDIT, entity: `Template ${doc.name}` });
    ok(res, { deleted: true });
  })
);

/* ───────────── WhatsApp: approval at the provider ───────────── */
const upload = multer({ dest: path.join(os.tmpdir(), "whatsapp_crm_uploads"), limits: { fileSize: 100 * 1024 * 1024 } });
const localStatus = (s: any) => {
  const v = String(s || "").trim().toUpperCase();
  return v === "APPROVED" || v === "ACTIVE" ? "Approved" : v.includes("REJECT") ? "Rejected" : "Pending";
};
const reasonOf = (m: any) => [m?.rejected_reason, m?.rejection_reason, m?.reason, m?.status_reason].find((x) => typeof x === "string" && x.trim() && x !== "NONE") || "";
/** the provider's own words, as a message the screen can show */
const provider = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, String(e?.response?.data?.error?.error_user_msg || e?.response?.data?.error?.message || e?.message || "WhatsApp did not accept it").slice(0, 400));
  }
};

// header image / video / document → the provider's media id
r.post(
  "/templates/wa-media",
  anyRight(["pm_templates", "create"], ["pm_templates", "edit"]),
  upload.single("file"),
  asyncHandler(async (req: any, res: any) => {
    if (!req.file) throw new ApiError(400, "Choose a file");
    try {
      const out: any = await provider(() => uploadMetaMedia(String(req.tenantId), req.file.path, req.file.mimetype || "application/octet-stream", req.file.originalname || "upload"));
      if (!out?.id) throw new ApiError(400, "WhatsApp did not return a media id");
      ok(res, { id: String(out.id), fileName: req.file.originalname });
    } finally {
      fs.unlink(req.file.path).catch(() => {});
    }
  })
);

// Submit the template for approval (or submit its changes again).
r.post(
  "/templates/:id/submit",
  pmRight("templates", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmTemplate.findOne({ _id: req.params.id, tenant: req.tenantId, channel: "whatsapp" });
    if (!doc) throw new ApiError(404, "Template not found");
    const tpl: any = doc.toObject();
    tpl.wa = cleanWa(tpl.wa, tpl.wa);
    const problem = waProblem(tpl);
    if (problem) throw new ApiError(400, problem);
    const components = metaComponents(tpl, sampleValues());
    const name = metaName(tpl.waTemplateName || tpl.name);
    if (!name) throw new ApiError(400, "Enter the template name");

    if (tpl.wa.metaId) {
      const live: any = await provider(() => getMetaTemplateById(String(req.tenantId), tpl.wa.metaId));
      const status = String(live?.status || "").toUpperCase();
      if (!["APPROVED", "REJECTED", "PAUSED"].includes(status)) throw new ApiError(400, "WhatsApp is still reviewing this template. It can be changed after the review.");
      const payload: any = { components };
      if (status !== "APPROVED" && String(live?.category || "").toUpperCase() !== tpl.wa.metaCategory) payload.category = tpl.wa.metaCategory;
      await provider(() => editMetaTemplateById(String(req.tenantId), tpl.wa.metaId, payload));
      tpl.wa.metaStatus = "Pending";
      tpl.wa.rejectionReason = "";
    } else {
      const made: any = await provider(() => createMetaTemplate(String(req.tenantId), { name, category: tpl.wa.metaCategory, language: tpl.waLanguage || "en", components }));
      tpl.wa.metaId = String(made?.id || "");
      tpl.wa.metaStatus = localStatus(made?.status);
      tpl.wa.rejectionReason = tpl.wa.metaStatus === "Rejected" ? reasonOf(made) : "";
    }
    doc.waTemplateName = name;
    doc.wa = tpl.wa;
    await doc.save();
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: AUDIT, entity: `Template ${doc.name} submitted to WhatsApp` });
    ok(res, doc);
  })
);

// Ask the provider for the result of the reviews that are still open.
r.post(
  "/templates/wa-status",
  canRead,
  asyncHandler(async (req: any, res: any) => {
    const open = await PmTemplate.find({ tenant: req.tenantId, channel: "whatsapp", "wa.metaStatus": "Pending", "wa.metaId": { $ne: "" } });
    let changed = 0;
    for (const doc of open) {
      try {
        const live: any = await getMetaTemplateById(String(req.tenantId), doc.wa.metaId);
        const status = localStatus(live?.status);
        if (status === "Pending") continue;
        doc.wa.metaStatus = status;
        doc.wa.rejectionReason = status === "Rejected" ? reasonOf(live) : "";
        doc.markModified("wa");
        await doc.save();
        changed++;
      } catch {
        // not reachable now: asked again next time
      }
    }
    ok(res, { checked: open.length, changed });
  })
);

/** The rendered message. `values` come from a real record when one is chosen (see messages.buildContext), else samples. */
export async function previewValues(req: any): Promise<Record<string, string>> {
  const base = sampleValues();
  const { projectId, taskId } = req.body || {};
  if (!projectId && !taskId) return base;
  try {
    // real records exist from Phase 2 on
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildContext } = require("../../services/pm/messages");
    return { ...base, ...(await buildContext(req.tenantId, { projectId, taskId })) };
  } catch {
    return base;
  }
}

r.post(
  "/templates/preview",
  canRead,
  asyncHandler(async (req: any, res: any) => {
    const values = await previewValues(req);
    ok(res, { subject: renderKeys(req.body?.subject || "", values), body: renderKeys(req.body?.body || "", values) });
  })
);

// Send the template to one address / number, filled with sample (or chosen record) values.
r.post(
  "/templates/:id/test",
  pmRight("templates", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const doc = await PmTemplate.findOne({ _id: req.params.id, tenant: req.tenantId }).lean();
    if (!doc) throw new ApiError(404, "Template not found");
    const to = String(req.body?.to || "").trim();
    const values = await previewValues(req);
    if (doc.channel === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new ApiError(400, "Enter a valid email address");
      const html = renderKeys(doc.body, values);
      const out = await sendEmail({ to, subject: renderKeys(doc.subject, values), html, text: htmlToText(html) });
      return ok(res, { sent: !out.simulated, simulated: out.simulated });
    }
    const phone = normalizePhone(to);
    if (phone.replace(/\D/g, "").length < 10) throw new ApiError(400, "Enter a valid WhatsApp number with country code");
    const out: any = await sendText(String(req.tenantId), phone, renderKeys(doc.body, values));
    ok(res, { sent: !out?.simulated, simulated: !!out?.simulated });
  })
);

export default r;
