import { Router } from "express";
import { authenticate, require_ } from "../middleware/auth";
import { crud } from "../controllers/crudFactory";
import { ok, asyncHandler, ApiError, audit } from "../utils/http";
import { WORKFLOW_EVENTS, CONDITION_FIELDS, CONDITION_OPERATORS, ACTION_TYPES, ASSIGNMENT_STRATEGIES } from "../config/workflowConfig";

import * as authC from "../controllers/authController";
import * as leadC from "../controllers/leadController";
import * as leadToolsC from "../controllers/leadToolsController";
import { analytics as leadAnalytics } from "../controllers/leadAnalyticsController";
import * as trackC from "../controllers/serviceTrackController";
import * as fuC from "../controllers/followUpController";
import * as msgC from "../controllers/messagingController";
import * as fbC from "../controllers/facebookController";
import * as flowStudioC from "../controllers/flowStudioController";
import * as flowMediaC from "../controllers/flowMediaController";
import * as aiC from "../controllers/aiController";
import multer from "multer";
import path from "path";
import os from "os";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
const ffmpegBinary = (ffmpegStatic as any)?.default || (ffmpegStatic as any);


if (ffmpegBinary) {
  try {
    ffmpeg.setFfmpegPath(ffmpegBinary);
  } catch (e) {
    console.warn("Could not set ffmpeg path:", e);
  }
}

import { Lead } from "../models/Lead";
import { FollowUp } from "../models/FollowUp";
import { Contact } from "../models/Contact";
import { LeadStatus, SubStatus, LeadSource, AcademicSession, Grade, Designation, FeeHead, DocumentType } from "../models/Masters";
import { Service } from "../models/Service";
import { User, UserType } from "../models/User";
import { Campaign, Template, Conversation, Message } from "../models/Messaging";
import { Integration, AuditLog } from "../models/System";
import { Team } from "../models/Team";
import { Workflow } from "../models/Workflow";
import { Registration } from "../models/Registration";
import { WorkflowConfig } from "../models/WorkflowConfig";
import { Tenant } from "../models/Tenant";
import { OrganizationDetails } from "../models/OrganizationDetails";
import { EventType } from "../models/EventType";
import { ModuleTemplate, CustomField, SETUP_MODULES } from "../models/ModuleSetup";
import { AppStore } from "../models/AppStore";
import eventManagerRoutes from "./eventManager";
import paymentRoutes from "./payments";
import publicEventRoutes from "./publicEvents";
import userAdminRoutes from "./userAdmin";
import pmRoutes from "./pm";
import pmPublicRoutes from "./pm/public";
import { publicRouter as prereqPublicRoutes, adminRouter as prereqRoutes } from "./prerequisites";
import { teamLoop } from "../services/pm/visibility";
import { EVENT_TYPE_DEFAULTS } from "../data/eventTypeDefaults";
import { convertToLead, changeLeadStatus, logActivity, refreshLead } from "../services/leadService";
import { guardLead, guardFollowUp, canSeeLead, scopeFollowUpFilter } from "../services/leadAccess";
import { captureEnquiry } from "../services/leadCapture";
import crmRoutes from "./crm";
import { newToken } from "../services/leadFees";
import crmPublicRoutes from "./crmPublic";
import crm2Routes from "./crm2";
import crm3Routes from "./crm3";
import crmFormRoutes, { publicFormRoutes } from "./crmForms";
import crmApplicationRoutes from "./crmApplications";
import crmReportRoutes from "./crmReports";
import crmApprovalRoutes from "./crmApprovals";
import crmSalesRoutes, { publicSalesRoutes } from "./crmSales";
import campaignRoutes from "./campaigns";
import websiteRoutes, { websitePublicRoutes } from "./website";
import websiteDataRoutes, { websiteDataPublicRoutes } from "./websiteData";
import { leadOwnerScope } from "../services/leadAccess";

const r = Router();

// Media conversion endpoint (accepts uploaded WebM and returns MP4)
const uploadDir = path.join(os.tmpdir(), "whatsapp_crm_uploads");
if (!fs.existsSync(uploadDir)) {
  try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) {}
}
const upload = multer({ dest: uploadDir });

/* ---- public ---- */
r.post("/auth/login", authC.login);
r.post("/auth/verify-otp", authC.verifyOtp);

// A public link carries only the form / page id, so look it up in every tenant's saved config.
const findInConfigs = async (key: string, listKey: string, id: string) => {
  const configs = await WorkflowConfig.find({ key }).lean();
  for (const config of configs) {
    const list = Array.isArray((config as any)?.data?.[listKey]) ? (config as any).data[listKey] : [];
    const item = list.find((x: any) => String(x._id) === String(id));
    if (item) return { config, item, tenant: (config as any).tenant || (await Tenant.findOne({}).lean())?._id };
  }
  return { config: null, item: null, tenant: null };
};

const getEnquiryFormById = async (formId: string) => {
  const { config, item, tenant } = await findInConfigs("enquiryForms", "forms", formId);
  return { config, form: item, tenant };
};

r.get(
  "/public/enquiry-form/:formId",
  asyncHandler(async (req, res) => {
    const { form } = await getEnquiryFormById(req.params.formId);
    if (!form) throw new ApiError(404, "Enquiry form not found");
    if (form.isActive === false) throw new ApiError(403, "This enquiry form is not live");
    ok(res, { form });
  })
);

r.post(
  "/public/enquiry-form/:formId",
  asyncHandler(async (req, res) => {
    const { form, tenant } = await getEnquiryFormById(req.params.formId);
    if (!form) throw new ApiError(404, "Enquiry form not found");
    if (form.isActive === false) throw new ApiError(403, "This enquiry form is not live");
    ok(res, await captureEnquiry(tenant, req.body, `Enquiry form: ${form.name || form.title || "Website"}`));
  })
);

const getLandingPageById = async (pageId: string) => {
  const { config, item, tenant } = await findInConfigs("landingPages", "pages", pageId);
  return { config, page: item, tenant };
};

r.get(
  "/public/landing-page/:pageId",
  asyncHandler(async (req, res) => {
    const { page } = await getLandingPageById(req.params.pageId);
    if (!page) throw new ApiError(404, "Landing page not found");
    if (page.isActive === false) throw new ApiError(403, "This landing page is not live");
    ok(res, { page });
  })
);

// the quick enquiry box on a landing page
r.post(
  "/public/landing-page/:pageId/enquiry",
  asyncHandler(async (req, res) => {
    const { page, tenant } = await getLandingPageById(req.params.pageId);
    if (!page) throw new ApiError(404, "Landing page not found");
    if (page.isActive === false) throw new ApiError(403, "This landing page is not live");
    ok(res, await captureEnquiry(tenant, req.body, `Landing page: ${page.name || page.title || "Website"}`));
  })
);

/* ---- Organization Details - GET is PUBLIC ---- */
r.get("/organization-details", asyncHandler(async (req: any, res: any) => {
  try {
    console.log("GET /organization-details called - public endpoint");
    let orgDetails;

    // If authenticated, get tenant-specific org details
    if ((req as any).tenantId) {
      orgDetails = await OrganizationDetails.findOne({ tenant: (req as any).tenantId });
    } else {
      // If not authenticated, get the first organization details (for login page)
      orgDetails = await OrganizationDetails.findOne();
    }

    ok(res, orgDetails || {});
  } catch (error) {
    console.error("Error fetching organization details:", error);
    ok(res, {});
  }
}));

/* ---- Public event registration forms (no sign-in) ---- */
r.use(publicEventRoutes);
// Project Management links opened without a login (meeting replies, client verification, sign-off)
r.use(pmPublicRoutes);
// Lead CRM links opened without a login (fee payment, application status)
r.use(crmPublicRoutes);
r.use(websitePublicRoutes);
r.use(websiteDataPublicRoutes);
// Admission pre-requisite form a client fills from a link (Setup › Implementation › Pre-requisites)
r.use(prereqPublicRoutes);
// CRM → Forms filled from a link, and quotations a customer opens from a link
r.use(publicFormRoutes);
r.use(publicSalesRoutes);

/* ---- everything below requires auth ---- */
r.use(authenticate);
r.get("/auth/me", authC.me);

/* ---- Media conversion (video editor): signed-in users only ---- */
r.post(
  "/media/process",
  upload.single("file"),
  asyncHandler(async (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const inputPath = req.file.path;
    const format = req.body.format || "mp4";
    const outExt = (format === "mp3" || format === "m4a") ? format : (format === "mov" ? "mov" : (format === "webm" ? "webm" : "mp4"));
    const outPath = `${inputPath}.${outExt}`;

    try {
      const trimStart = req.body.trimStart ? Number(req.body.trimStart) : 0;
      const duration = req.body.duration ? Number(req.body.duration) : null;
      const isMuted = req.body.isMuted === "true" || req.body.isMuted === true || req.body.stripAudio === "true";
      const targetW = req.body.targetWidth ? Number(req.body.targetWidth) : null;
      const targetH = req.body.targetHeight ? Number(req.body.targetHeight) : null;
      const fps = req.body.fps ? Number(req.body.fps) : null;
      const quality = req.body.quality || "high";

      const crf = quality === "high" ? 18 : (quality === "low" ? 28 : 23);
      const preset = quality === "high" ? "fast" : (quality === "low" ? "faster" : "fast");
      const bitrate = quality === "high" ? "8000k" : (quality === "low" ? "1500k" : "4000k");

      await new Promise((resolve, reject) => {
        let cmd = ffmpeg(inputPath).outputOptions(["-y"]);

        // Accurate Seek & Duration
        if (trimStart > 0 && isFinite(trimStart)) {
          cmd = cmd.outputOptions([`-ss ${trimStart.toFixed(3)}`]);
        }
        if (duration && isFinite(duration) && duration > 0) {
          cmd = cmd.outputOptions([`-t ${duration.toFixed(3)}`]);
        }

        // FPS
        if (fps && isFinite(fps) && fps > 0) {
          cmd = cmd.outputOptions([`-r ${fps}`]);
        }

        // Scaling with aspect ratio preservation & letterbox / pillarbox if needed
        const filters: string[] = [];
        if (targetW && targetH && targetW > 0 && targetH > 0) {
          const w = Math.round(targetW / 2) * 2;
          const h = Math.round(targetH / 2) * 2;
          filters.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`);
        }

        if (req.body.blurMasks) {
          try {
            const masks = JSON.parse(req.body.blurMasks);
            if (Array.isArray(masks)) {
              for (const m of masks) {
                const effW = targetW || 1280;
                const effH = targetH || 720;
                const bx = Math.max(0, Math.floor((m.x / 100) * effW));
                const by = Math.max(0, Math.floor((m.y / 100) * effH));
                const bw = Math.min(effW - bx, Math.max(2, Math.ceil((m.width / 100) * effW)));
                const bh = Math.min(effH - by, Math.max(2, Math.ceil((m.height / 100) * effH)));
                if (bw > 0 && bh > 0) {
                  filters.push(`delogo=x=${bx}:y=${by}:w=${bw}:h=${bh}`);
                }
              }
            }
          } catch (e) {}
        }

        if (filters.length > 0) {
          cmd = cmd.videoFilters(filters);
        }

        if (format === "mp3" || format === "m4a") {
          cmd = cmd.noVideo().audioCodec(format === "mp3" ? "libmp3lame" : "aac").outputOptions(["-b:a 192k"]);
        } else {
          // MP4 / MOV standard H.264
          cmd = cmd.videoCodec("libx264").outputOptions([
            `-preset ${preset}`,
            `-crf ${crf}`,
            `-b:v ${bitrate}`,
            "-movflags +faststart",
            "-pix_fmt yuv420p",
          ]);

          if (isMuted) {
            cmd = cmd.noAudio();
          } else {
            cmd = cmd.outputOptions(["-c:a aac", "-b:a 192k", "-map 0:v:0", "-map 0:a:0?"]);
          }
        }

        cmd.on("end", () => resolve(null))
           .on("error", (err: any) => reject(err))
           .save(outPath);
      });

      const safeFilename = (req.file.originalname || "export").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const mime = format === "mp3" ? "audio/mpeg" : (format === "m4a" ? "audio/mp4" : (format === "webm" ? "video/webm" : "video/mp4"));
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}.${outExt}"`);
      const stream = fs.createReadStream(outPath);
      stream.pipe(res);
      stream.on("close", () => {
        try { fs.unlinkSync(inputPath); } catch (e) {}
        try { fs.unlinkSync(outPath); } catch (e) {}
      });
      stream.on("error", () => {
        try { fs.unlinkSync(inputPath); } catch (e) {}
        try { fs.unlinkSync(outPath); } catch (e) {}
      });
    } catch (err: any) {
      try { fs.unlinkSync(inputPath); } catch (e) {}
      try { fs.unlinkSync(outPath); } catch (e) {}
      console.error("FFmpeg process error:", err);
      res.status(500).json({ error: (err && err.message) || "Processing failed" });
    }
  })
);

r.post(
  "/media/convert",
  upload.single("file"),
  asyncHandler(async (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const inputPath = req.file.path;
    const outPath = `${inputPath}.mp4`;
    try {
      const targetW = req.body.targetWidth ? Number(req.body.targetWidth) : null;
      const targetH = req.body.targetHeight ? Number(req.body.targetHeight) : null;
      const fps = req.body.fps ? Number(req.body.fps) : null;
      const duration = req.body.duration ? Number(req.body.duration) : null;
      const quality = req.body.quality || "high";
      const crf = quality === "high" ? 18 : (quality === "low" ? 28 : 23);
      const preset = quality === "high" ? "medium" : (quality === "low" ? "slow" : "fast");
      const bitrate = quality === "high" ? "8000k" : (quality === "low" ? "1500k" : "4000k");

      await new Promise((resolve, reject) => {
        let cmd = ffmpeg(inputPath).outputOptions(["-y"]);
        if (duration && isFinite(duration) && duration > 0) {
          cmd = cmd.outputOptions([`-t ${duration.toFixed(3)}`]);
        }
        if (fps) cmd = cmd.outputOptions([`-r ${fps}`]);
        if (targetW && targetH) cmd = cmd.videoFilters(`scale=${targetW}:${targetH}`);
        cmd = cmd.videoCodec("libx264").outputOptions([
          `-preset ${preset}`,
          `-crf ${crf}`,
          `-b:v ${bitrate}`,
          "-movflags +faststart",
          "-pix_fmt yuv420p",
          "-c:a aac",
          "-b:a 192k",
          "-map 0:v:0",
          "-map 0:a:0?",
        ]);
        cmd.on("end", () => resolve(null)).on("error", (err: any) => reject(err)).save(outPath);
      });

      const safeFilename = (req.file.originalname || "export").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}.mp4"`);
      const stream = fs.createReadStream(outPath);
      stream.pipe(res);
      stream.on("close", () => {
        try { fs.unlinkSync(inputPath); } catch (e) {}
        try { fs.unlinkSync(outPath); } catch (e) {}
      });
      stream.on("error", () => {
        try { fs.unlinkSync(inputPath); } catch (e) {}
        try { fs.unlinkSync(outPath); } catch (e) {}
      });
    } catch (err: any) {
      try { fs.unlinkSync(inputPath); } catch (e) {}
      try { fs.unlinkSync(outPath); } catch (e) {}
      console.error("FFmpeg conversion error:", err);
      res.status(500).json({ error: (err && err.message) || "Conversion failed" });
    }
  })
);


r.post("/auth/change-password", authC.changePassword);
r.get("/system/status", msgC.status);

/* ---- Event Manager: events, attendees, activity logs ---- */
r.use(eventManagerRoutes);

/* ---- Payment gateways + payments ---- */
r.use(paymentRoutes);

/* ---- App store: server-side replacement for browser localStorage ---- */
const appStoreScope = (req: any, scope: unknown) => ({
  tenant: req.tenantId,
  user: scope === "user" ? req.auth.uid : null,
});
r.get(
  "/app-store",
  asyncHandler(async (req: any, res: any) => {
    const rows = await AppStore.find({ tenant: req.tenantId, user: { $in: [null, req.auth.uid] } }).lean();
    const out: Record<string, string> = {};
    // tenant-wide values first, then the user's own on top
    rows.filter((x) => !x.user).forEach((x) => { out[x.key] = x.value; });
    rows.filter((x) => x.user).forEach((x) => { out[x.key] = x.value; });
    ok(res, out);
  })
);
r.put(
  "/app-store/:key",
  asyncHandler(async (req: any, res: any) => {
    if (typeof req.body?.value !== "string") throw new ApiError(400, "value must be a string");
    const filter = { ...appStoreScope(req, req.body.scope), key: req.params.key };
    await AppStore.updateOne(filter, { $set: { value: req.body.value } }, { upsert: true });
    ok(res, { key: req.params.key });
  })
);
r.delete(
  "/app-store/:key",
  asyncHandler(async (req: any, res: any) => {
    await AppStore.deleteOne({ ...appStoreScope(req, req.query.scope), key: req.params.key });
    ok(res, { key: req.params.key });
  })
);
r.get("/flowchat/state", require_("workflows", "view"), flowStudioC.getFlowStudioState);
r.put("/flowchat/state", require_("workflows", "edit"), flowStudioC.saveFlowStudioState);
r.get("/flowchat/media", require_("workflows", "view"), flowMediaC.listFlowMedia);
r.post("/flowchat/media", require_("workflows", "create"), upload.single("file"), flowMediaC.createFlowMedia);
r.patch("/flowchat/media/:id", require_("workflows", "edit"), flowMediaC.updateFlowMedia);
r.delete("/flowchat/media/:id", require_("workflows", "del"), flowMediaC.deleteFlowMedia);

/* ---- Lead CRM extras: settings, automation, documents, fees, calling, targets, capture, applications, reports … ----
   Mounted before the lead routes so fixed paths like /leads/report are never read as a lead id. */
r.use(crmApplicationRoutes);
r.use(crmReportRoutes);
r.use(crmApprovalRoutes);
r.use(crmRoutes);
r.use(crm2Routes);
r.use(crm3Routes);
r.use(crmFormRoutes);
r.use(crmSalesRoutes);
r.use(websiteRoutes);
r.use(websiteDataRoutes);

/* ---- Leads ---- */
// fixed paths first, so they are never read as a lead id
r.get("/leads/meta", require_("leads", "view"), leadC.meta);
r.get("/leads/view-counts", require_("leads", "view"), leadC.viewCounts);
r.get("/leads/board", require_("leads", "view"), leadC.board);
r.get("/leads/analytics", require_("leads", "view"), leadAnalytics);
r.get("/leads/check-duplicate", require_("leads", "view"), leadC.checkDuplicate);
r.get("/leads/export", require_("leads", "view"), leadToolsC.exportLeads);
r.get("/leads/duplicates", require_("leads", "view"), leadToolsC.duplicates);
r.post("/leads/convert", require_("leads", "create"), leadC.convert);
r.post("/leads/import", require_("leads", "create"), leadToolsC.importLeads);
r.post("/leads/bulk", require_("leads", "edit"), leadToolsC.bulk);
r.post("/leads/merge", require_("leads", "del"), leadToolsC.merge);

r.get("/leads", require_("leads", "view"), leadC.list);
r.get("/leads/:id", require_("leads", "view"), guardLead, leadC.get);
r.post("/leads", require_("leads", "create"), leadC.convert);
r.patch("/leads/:id", require_("leads", "edit"), guardLead, leadC.update);
r.delete("/leads/:id", require_("leads", "del"), guardLead, leadC.remove);
r.post("/leads/:id/status", require_("leads", "edit"), guardLead, leadC.setStatus);
r.post("/leads/:id/services", require_("leads", "edit"), guardLead, trackC.addTrack);
r.post("/leads/:id/services/status", require_("leads", "edit"), guardLead, trackC.setTrackStatus);
r.delete("/leads/:id/services/:serviceId", require_("leads", "edit"), guardLead, trackC.removeTrack);
r.post("/leads/:id/notes", require_("leads", "edit"), guardLead, leadC.addNote);
r.post("/leads/:id/calls", require_("leads", "edit"), guardLead, leadC.logCall);
r.get("/leads/:id/timeline", require_("leads", "view"), guardLead, leadC.timeline);
r.get("/leads/:id/followups", require_("leads", "view"), guardLead, fuC.listForLead);
r.post("/leads/:id/followups", require_("followups", "create"), guardLead, fuC.createFollowUpForLead);
r.get("/leads/:id/service/:serviceId/statuses", require_("leads", "view"), guardLead, leadC.getServiceStatuses);

/* ---- Follow-ups ---- */
r.get("/followups", require_("followups", "view"), asyncHandler(async (req: any, res: any) => {
  const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
  const perPage = Math.min(200, Math.max(1, parseInt(String(req.query.perPage || "50"), 10) || 50));
  const filter: any = { tenant: req.tenantId };
  for (const k of ["lead", "owner", "type"]) if (typeof req.query[k] === "string" && req.query[k]) filter[k] = req.query[k];
  if (req.query.done === "true" || req.query.done === "false") filter.done = req.query.done === "true";
  await scopeFollowUpFilter(req, filter);
  const [items, total] = await Promise.all([
    FollowUp.find(filter).sort({ due: 1 }).skip((page - 1) * perPage).limit(perPage),
    FollowUp.countDocuments(filter),
  ]);
  res.json({ ok: true, data: items, page, perPage, total, pages: Math.ceil(total / perPage) });
}));
r.get("/followups/buckets", require_("followups", "view"), fuC.buckets);
r.get("/followups/workload", require_("followups", "view"), fuC.getWorkload);
r.post("/followups", require_("followups", "create"), fuC.create);
r.post("/followups/:id/complete", require_("followups", "edit"), guardFollowUp, fuC.complete);
r.post("/followups/:id/reschedule", require_("followups", "edit"), guardFollowUp, fuC.reschedule);
r.delete("/followups/:id", require_("followups", "del"), guardFollowUp, fuC.remove);

/* ---- Contacts ---- */
const contactCrud = crud(Contact, { module: "contacts", searchFields: ["name", "phone", "email"] });
// A role limited to its own / its team's leads sees only the contacts and chats assigned to those people.
const scopeAssigned = (field: string) => async (req: any, _res: any, next: any) => {
  try {
    const names = await leadOwnerScope(req);
    if (names && req.method === "GET" && !req.params.id) {
      // the generic list takes plain query values: one name passes as-is, several need the dedicated filter below
      req.assignedScope = { [field]: { $in: names } };
    }
    next();
  } catch (e) { next(e); }
};
r.get("/contacts", require_("contacts", "view"), scopeAssigned("assigned"), contactCrud.list);
r.get("/contacts/:id", require_("contacts", "view"), contactCrud.get);
r.post("/contacts", require_("contacts", "create"), contactCrud.create);
r.patch("/contacts/:id", require_("contacts", "edit"), contactCrud.update);
r.delete("/contacts/:id", require_("contacts", "del"), contactCrud.remove);

/* ---- Masters (Setup) ---- */
const statusCrud = crud(LeadStatus, { module: "setup" });
r.get("/masters/statuses", require_("setup", "view"), statusCrud.list);
r.post("/masters/statuses", require_("setup", "create"), statusCrud.create);
r.patch("/masters/statuses/:id", require_("setup", "edit"), statusCrud.update);
r.delete("/masters/statuses/:id", require_("setup", "del"), statusCrud.remove);

/* ---- Services (custom pipelines a lead can be in) ---- */
const serviceCrud = crud(Service, { module: "setup", searchFields: ["name", "key"] });
r.get("/services", require_("leads", "view"), serviceCrud.list);
r.post("/services", require_("setup", "create"), serviceCrud.create);
r.patch("/services/:id", require_("setup", "edit"), serviceCrud.update);
r.delete("/services/:id", require_("setup", "del"), serviceCrud.remove);

const subCrud = crud(SubStatus, { module: "setup", populate: "status" });
r.get("/masters/substatuses", require_("setup", "view"), subCrud.list);
r.post("/masters/substatuses", require_("setup", "create"), subCrud.create);
r.delete("/masters/substatuses/:id", require_("setup", "del"), subCrud.remove);

const srcCrud = crud(LeadSource, { module: "setup" });
r.get("/masters/sources", require_("setup", "view"), srcCrud.list);
r.post("/masters/sources", require_("setup", "create"), srcCrud.create);
r.delete("/masters/sources/:id", require_("setup", "del"), srcCrud.remove);

/* ---- Academic Sessions (Setup) ---- */
const sessionCrud = crud(AcademicSession, { module: "setup", searchFields: ["name"] });
r.get("/masters/sessions", require_("setup", "view"), sessionCrud.list);
r.post("/masters/sessions", require_("setup", "create"), sessionCrud.create);
r.patch("/masters/sessions/:id", require_("setup", "edit"), sessionCrud.update);
r.delete("/masters/sessions/:id", require_("setup", "del"), sessionCrud.remove);

/* ---- Grades (Setup) ---- */
// Grades always come back in their set sequence, so every screen lists them the same way.
const gradeCrud = crud(Grade, { module: "setup", searchFields: ["name"], defaultSort: { order: 1, createdAt: 1 } });
r.get("/grades", require_("setup", "view"), gradeCrud.list);
r.post("/grades", require_("setup", "create"), asyncHandler(async (req: any, res: any, next: any) => {
  // a new grade goes to the end of the sequence unless one is given
  if (!Number.isFinite(Number(req.body?.order)) || req.body?.order === "" || req.body?.order === null || req.body?.order === undefined) {
    const last: any = await Grade.findOne({ tenant: req.tenantId }).sort({ order: -1 }).select("order").lean();
    req.body = { ...req.body, order: (last?.order || 0) + 1 };
  }
  return gradeCrud.create(req, res, next);
}));
/** Save a new sequence: ids in the order they should appear. */
r.put("/grades/reorder", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
  if (!ids.length) throw new ApiError(400, "ids are required");
  await Grade.bulkWrite(ids.map((id, i) => ({ updateOne: { filter: { _id: id, tenant: req.tenantId }, update: { $set: { order: i + 1 } } } })));
  ok(res, await Grade.find({ tenant: req.tenantId }).sort({ order: 1, createdAt: 1 }).lean());
}));
r.patch("/grades/:id", require_("setup", "edit"), gradeCrud.update);
r.delete("/grades/:id", require_("setup", "del"), gradeCrud.remove);

/* ---- Fee Heads (Setup) — class-wise amounts ---- */
const feeHeadCrud = crud(FeeHead, { module: "setup", searchFields: ["name"] });
r.get("/fee-heads", require_("setup", "view"), feeHeadCrud.list);
r.post("/fee-heads", require_("setup", "create"), feeHeadCrud.create);
r.patch("/fee-heads/:id", require_("setup", "edit"), feeHeadCrud.update);
r.delete("/fee-heads/:id", require_("setup", "del"), feeHeadCrud.remove);

/* ---- Document Types (Setup) — class mapping ---- */
const docTypeCrud = crud(DocumentType, { module: "setup", searchFields: ["name"] });
r.get("/document-types", require_("setup", "view"), docTypeCrud.list);
r.post("/document-types", require_("setup", "create"), docTypeCrud.create);
r.patch("/document-types/:id", require_("setup", "edit"), docTypeCrud.update);
r.delete("/document-types/:id", require_("setup", "del"), docTypeCrud.remove);

/* ---- Designations (Setup) ---- */
const desgCrud = crud(Designation, { module: "setup", searchFields: ["name"] });
r.get("/designations", require_("setup", "view"), desgCrud.list);
r.post("/designations", require_("setup", "create"), desgCrud.create);
r.patch("/designations/:id", require_("setup", "edit"), desgCrud.update);
r.delete("/designations/:id", require_("setup", "del"), desgCrud.remove);

/* ---- Module Setup: communication templates + custom fields ----
 * Scoped per module (events / crm / website / front-office). List requires
 * ?module=… so one module's Setup never sees another's records, and the
 * owning module / tenant can't be changed after creation. */
const requireSetupModule = (req: any, _res: any, next: any) => {
  const m = req.method === "GET" ? req.query.module : req.body?.module;
  if (!SETUP_MODULES.includes(m)) return next(new ApiError(400, "Valid module is required"));
  next();
};
const lockOwnership = (req: any, _res: any, next: any) => {
  if (req.body) {
    delete req.body.tenant;
    delete req.body.module;
    delete req.body._id;
  }
  next();
};

const moduleTplCrud = crud(ModuleTemplate, { module: "setup", searchFields: ["name", "body"] });
r.get("/module-templates", require_("setup", "view"), requireSetupModule, moduleTplCrud.list);
r.post("/module-templates", require_("setup", "create"), requireSetupModule, moduleTplCrud.create);
r.patch("/module-templates/:id", require_("setup", "edit"), lockOwnership, moduleTplCrud.update);
r.delete("/module-templates/:id", require_("setup", "del"), moduleTplCrud.remove);

const customFieldCrud = crud(CustomField, { module: "setup", searchFields: ["key", "label"] });
r.get("/custom-fields", require_("setup", "view"), requireSetupModule, customFieldCrud.list);
r.post("/custom-fields", require_("setup", "create"), requireSetupModule, customFieldCrud.create);
r.patch("/custom-fields/:id", require_("setup", "edit"), lockOwnership, customFieldCrud.update);
r.delete("/custom-fields/:id", require_("setup", "del"), customFieldCrud.remove);

/* ---- Teams (Setup) ---- */
const teamCrud = crud(Team, { module: "setup", searchFields: ["name"], populate: "manager members.user sources" });
r.get("/teams", require_("setup", "view"), teamCrud.list);
r.post("/teams", require_("setup", "create"), async (req, res) => {
  try {
    const { name, manager, members, sources, parent } = req.body;

    if (!name || !name.trim()) throw new Error("Team name is required");
    if (!manager) throw new Error("Manager is required");
    if (!members || members.length === 0) throw new Error("At least one team member is required");
    if (parent && !(await Team.exists({ _id: parent, tenant: req.tenantId }))) throw new Error("Choose a parent team");

    const team = new Team({
      tenant: req.tenantId,
      name,
      manager,
      members: members.map(m => ({ user: m })),
      sources: sources || [],
      parent: parent || null,
      active: true
    });
    const saved = await team.save();
    const populated = await saved.populate("manager members.user sources");
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "Teams", entity: `Team ${saved.name}` });
    res.json(populated);
  } catch (e) { res.status(400).json({ error: (e instanceof Error ? e.message : String(e)) }); }
});
r.patch("/teams/:id", require_("setup", "edit"), async (req, res) => {
  try {
    const { name, manager, members, sources, parent } = req.body;

    if (!name || !name.trim()) throw new Error("Team name is required");
    if (!manager) throw new Error("Manager is required");
    if (!members || members.length === 0) throw new Error("At least one team member is required");

    const update: any = {
      name,
      manager,
      members: members.map(m => ({ user: m })),
      sources: sources || []
    };
    // parent team is optional; left untouched when the caller does not send it
    if (parent !== undefined) {
      if (parent) {
        if (!(await Team.exists({ _id: parent, tenant: req.tenantId }))) throw new Error("Choose a parent team");
        if (await teamLoop(String(req.tenantId), String(req.params.id), String(parent))) throw new Error("A team cannot sit under itself or under one of its own sub-teams");
      }
      update.parent = parent || null;
    }
    const before: any = await Team.findOne({ _id: req.params.id, tenant: req.tenantId }).populate("manager", "name").lean();
    if (!before) throw new Error("Team not found");
    const team: any = await Team.findOneAndUpdate({ _id: req.params.id, tenant: req.tenantId }, update, { new: true }).populate("manager members.user sources");
    if (team) {
      await audit({
        tenant: req.tenantId, user: req.auth?.name, action: "UPDATE", module: "Teams", entity: `Team ${team.name}`,
        prev: `Manager ${before?.manager?.name || "—"}, ${before?.members?.length || 0} members`,
        next: `Manager ${team.manager?.name || "—"}, ${team.members?.length || 0} members`,
      });
    }
    res.json(team);
  } catch (e) { res.status(400).json({ error: (e instanceof Error ? e.message : String(e)) }); }
});
r.delete("/teams/:id", require_("setup", "del"), teamCrud.remove);

/* ---- Workflows (Setup) ---- */
const wfCrud = crud(Workflow, { module: "setup", searchFields: ["name"] });
r.get("/workflows", require_("setup", "view"), wfCrud.list);
r.post("/workflows", require_("setup", "create"), wfCrud.create);
r.patch("/workflows/:id", require_("setup", "edit"), wfCrud.update);
r.delete("/workflows/:id", require_("setup", "del"), wfCrud.remove);

/* ---- Registrations ---- */
const regCrud = crud(Registration, { module: "registrations", searchFields: ["name", "phone", "email"], populate: "lead" });
r.get("/registrations", require_("leads", "view"), regCrud.list);
r.get("/registrations/:id", require_("leads", "view"), regCrud.get);
r.post(
  "/registrations",
  require_("leads", "create"),
  asyncHandler(async (req: any, res: any) => {
    const { tenant: _t, _id: _i, ...body } = req.body || {};
    const lead = body.lead && (await canSeeLead(req, body.lead)) ? await Lead.findOne({ _id: body.lead, tenant: req.tenantId }) : null;
    if (body.lead && !lead) throw new ApiError(404, "Lead not found");
    const reg = await Registration.create({
      ...body, name: body.name || lead?.name, phone: body.phone || lead?.phone, tenant: req.tenantId,
      stage: "Submitted", token: newToken(), stageHistory: [{ stage: "Submitted", by: req.auth?.name || "System", at: new Date() }],
    });
    reg.appNo = `APP-${String(reg._id).slice(-6).toUpperCase()}`;
    await reg.save();
    if (lead) {
      await logActivity({ tenant: req.tenantId, lead: lead._id, type: "registration", by: req.auth?.name, title: "Registration submitted", detail: reg.course || "" });
      if (body.status && String(body.status) !== String(lead.status)) {
        await changeLeadStatus({ tenant: req.tenantId, leadId: String(lead._id), statusId: String(body.status), user: req.auth?.name });
      } else {
        await refreshLead(lead._id);
      }
    }
    await audit({ tenant: req.tenantId, user: req.auth?.name, action: "CREATE", module: "registrations", entity: reg.name });
    ok(res, reg, 201);
  })
);
r.patch("/registrations/:id", require_("leads", "edit"), regCrud.update);
r.delete("/registrations/:id", require_("leads", "del"), regCrud.remove);

/* ---- Users & roles (Setup) ---- */
const userTypeCrud = crud(UserType, { module: "setup" });
r.get("/usertypes", require_("setup", "view"), userTypeCrud.list);
r.post("/usertypes", require_("setup", "create"), userTypeCrud.create);
r.patch("/usertypes/:id", require_("setup", "edit"), userTypeCrud.update);
r.delete("/usertypes/:id", require_("setup", "del"), userTypeCrud.remove);

// Users, user types and the password policy (passwords are hashed there — the
// generic CRUD must never write a user).
r.use(userAdminRoutes);

/* ---- Project Management ---- */
r.use("/pm", pmRoutes);

/* ---- Event Types (Setup) — PHASE-4 real impl ---- */
const eventTypeCrud = crud(EventType, { module: "setup", searchFields: ["name", "key", "description"] });
// Ensure the tenant has the seeded defaults; safe to call on every list request.
async function ensureEventTypeDefaults(tenantId: any) {
  const count = await EventType.countDocuments({ tenant: tenantId });
  if (count > 0) return;
  await EventType.insertMany(
    EVENT_TYPE_DEFAULTS.map((d) => ({ ...d, tenant: tenantId, isSystem: true, isActive: true }))
  );
}
r.get(
  "/event-types",
  require_("setup", "view"),
  asyncHandler(async (req: any, res: any, next: any) => {
    await ensureEventTypeDefaults(req.tenantId);
    return eventTypeCrud.list(req, res, next);
  })
);
r.post(
  "/event-types/reset-defaults",
  require_("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    await EventType.deleteMany({ tenant: req.tenantId, isSystem: true });
    await ensureEventTypeDefaults(req.tenantId);
    const items = await EventType.find({ tenant: req.tenantId }).sort({ sortOrder: 1 });
    ok(res, { reset: true, items });
  })
);
r.get("/event-types/:id", require_("setup", "view"), eventTypeCrud.get);
r.post("/event-types", require_("setup", "create"), eventTypeCrud.create);
r.patch("/event-types/:id", require_("setup", "edit"), eventTypeCrud.update);
r.delete("/event-types/:id", require_("setup", "del"), eventTypeCrud.remove);
r.post(
  "/event-types/reorder",
  require_("setup", "edit"),
  asyncHandler(async (req: any, res: any) => {
    const items: Array<{ id: string; sortOrder: number }> = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) throw new ApiError(400, "items array required");
    await Promise.all(
      items.map((it) =>
        EventType.findOneAndUpdate(
          { _id: it.id, tenant: req.tenantId },
          { $set: { sortOrder: it.sortOrder } }
        )
      )
    );
    ok(res, { reordered: items.length });
  })
);

/* ---- Integrations (Setup) ---- */
const intCrud = crud(Integration, { module: "setup" });
r.get("/integrations", require_("setup", "view"), intCrud.list);
r.patch("/integrations/:id", require_("setup", "edit"), intCrud.update);

/* ---- WhatsApp accounts & Meta Graph API Profile ---- */
r.get("/whatsapp-accounts", require_("setup", "view"), msgC.listAccounts);
r.post("/whatsapp-accounts", require_("setup", "create"), msgC.createAccount);
r.patch("/whatsapp-accounts/:id", require_("setup", "edit"), msgC.updateAccount);
r.delete("/whatsapp-accounts/:id", require_("setup", "del"), msgC.deleteAccount);
r.post("/whatsapp-accounts/:id/activate", require_("setup", "edit"), msgC.activate);
r.get("/whatsapp-accounts/meta-profile", require_("setup", "view"), msgC.getMetaProfile);
r.post("/whatsapp-accounts/meta-profile", require_("setup", "edit"), msgC.updateMetaProfile);

/* ---- Facebook Lead Integration accounts ---- */
r.get("/facebook-accounts", require_("setup", "view"), fbC.listAccounts);
r.post("/facebook-accounts", require_("setup", "create"), fbC.createAccount);
r.patch("/facebook-accounts/:id", require_("setup", "edit"), fbC.updateAccount);
r.delete("/facebook-accounts/:id", require_("setup", "del"), fbC.deleteAccount);
r.post("/facebook-accounts/:id/activate", require_("setup", "edit"), fbC.activate);
r.post("/facebook-accounts/:id/test", require_("setup", "edit"), fbC.testConnection);
r.post("/facebook-accounts/:id/fetch-forms", require_("setup", "view"), fbC.fetchLeadForms);

/* ---- Meta Message Templates ---- */
const tplCrud = crud(Template, { module: "blast", searchFields: ["name"] });
r.get("/templates", require_("blast", "view"), tplCrud.list);
r.post("/templates", require_("blast", "create"), tplCrud.create);
r.post("/templates/create-meta", require_("blast", "create"), msgC.createMetaTemplate);
r.post("/templates/test-media/upload", require_("blast", "edit"), upload.single("file"), msgC.uploadMetaTestMedia);
r.patch("/templates/:id/meta", require_("blast", "edit"), msgC.editMetaTemplate);
r.get("/templates/meta-sync-candidates", require_("blast", "view"), msgC.listMetaSyncCandidates);
r.post("/templates/sync-meta", require_("blast", "edit"), msgC.syncMetaTemplates);
r.delete("/templates/:name/meta", require_("blast", "del"), msgC.deleteMetaTemplate);
r.patch("/templates/:id", require_("blast", "edit"), tplCrud.update);
r.delete("/templates/:id", require_("blast", "del"), tplCrud.remove);

/* ---- Chatbot & Automation Engine Rules ---- */
r.get("/chatbot-rules", require_("workflows", "view"), msgC.listChatbotRules);
r.post("/chatbot-rules", require_("workflows", "create"), msgC.createChatbotRule);
r.patch("/chatbot-rules/:id", require_("workflows", "edit"), msgC.updateChatbotRule);
r.delete("/chatbot-rules/:id", require_("workflows", "del"), msgC.deleteChatbotRule);
r.post("/chatbot-rules/test", require_("workflows", "create"), msgC.testChatbotRule);

/* ---- Campaigns ---- */
// list (live delivery counts), create, edit, launch, pause/resume, report, resend, recipient lists
r.use(campaignRoutes);
r.use(prereqRoutes);
const campCrud = crud(Campaign, { module: "blast", searchFields: ["name", "template"] });
r.get("/campaigns/:id", require_("blast", "view"), campCrud.get);

/* ---- Messages (history) ---- */
const msgCrud = crud(Message, { module: "reports", searchFields: ["contactName", "phone", "template"] });
r.get("/messages", require_("reports", "view"), scopeAssigned("agent"), msgCrud.list);
r.post("/messages/send", require_("blast", "create"), msgC.sharedSend);
r.post("/messages/:id/convert", require_("leads", "create"), msgC.messageToLead);

/* ---- Conversations (chat) ---- */
const convCrud = crud(Conversation, { module: "chat", searchFields: ["name", "phone"] });
r.get("/conversations", require_("chat", "view"), scopeAssigned("assigned"), convCrud.list);
r.get("/conversations/:id", require_("chat", "view"), convCrud.get);
r.post("/conversations/:id/reply", require_("chat", "create"), msgC.replyToConversation);
r.post("/conversations/:id/read", require_("chat", "edit"), msgC.markRead);

/* ---- Conversion analytics ---- */
r.get("/conversion/stats", require_("conversion", "view"), leadAnalytics);

/* ---- Audit log ---- */
const auditCrud = crud(AuditLog, { module: "reports", searchFields: ["entity", "user", "action"] });
r.get("/audit", require_("reports", "view"), auditCrud.list);

/* ---- AI Copilot & Integrations ---- */
r.get("/ai/config", aiC.getAiConfig);
r.post("/ai/config", require_("setup", "edit"), aiC.saveAiConfig);
r.post("/ai/test-connection", require_("setup", "edit"), aiC.testAiConnection);
r.post("/ai/execute", aiC.executeAiCommand);

/* ---- Workflow config (metadata for UI) ---- */
r.get("/workflow-config/default", (_req, res) => {
  ok(res, { WORKFLOW_EVENTS, CONDITION_FIELDS, CONDITION_OPERATORS, ACTION_TYPES, ASSIGNMENT_STRATEGIES });
});

// Configs saved before tenants were recorded carry no tenant; the first save claims them.
const findConfig = async (tenantId: any, key: string) =>
  (await WorkflowConfig.findOne({ tenant: tenantId, key })) || (await WorkflowConfig.findOne({ tenant: null, key }));

r.get("/workflow-config/:key", asyncHandler(async (req: any, res: any) => {
  const config = await findConfig(req.tenantId, req.params.key);
  ok(res, config || { fields: [] });
}));

r.post("/workflow-config/:key", require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const existing = await findConfig(req.tenantId, req.params.key);
  const config = existing
    ? await WorkflowConfig.findByIdAndUpdate(existing._id, { $set: { data: req.body, tenant: req.tenantId } }, { new: true })
    : await WorkflowConfig.create({ tenant: req.tenantId, key: req.params.key, data: req.body });
  ok(res, config);
}));

/* ---- Organization Details ---- */
// Login video is stored on disk (too large for a JSON body / Mongo document); only its URL is saved.
const MAX_ORG_VIDEO_BYTES = 50 * 1024 * 1024;
const orgVideoUpload = multer({ dest: uploadDir, limits: { fileSize: MAX_ORG_VIDEO_BYTES } });
r.post(
  "/organization-details/video",
  authenticate,
  require_("setup", "edit"),
  orgVideoUpload.single("file"),
  asyncHandler(async (req: any, res: any) => {
    if (!req.file) throw new ApiError(400, "No file uploaded");
    if (!/^video\//.test(String(req.file.mimetype || ""))) {
      await fs.promises.unlink(req.file.path).catch(() => undefined);
      throw new ApiError(400, "Only video files are allowed");
    }
    const ext = (path.extname(req.file.originalname || "") || ".mp4").toLowerCase().replace(/[^a-z0-9.]/g, "");
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const dir = path.join(process.cwd(), "uploads", "org-media");
    await fs.promises.mkdir(dir, { recursive: true });
    // copy + unlink rather than rename: tmpdir may be on a different volume
    await fs.promises.copyFile(req.file.path, path.join(dir, fileName));
    await fs.promises.unlink(req.file.path).catch(() => undefined);
    res.json({ ok: true, data: { url: `/uploads/org-media/${fileName}` } });
  })
);

// GET is PUBLIC (no auth needed - for login page display) - UPDATED 2026-09-28
r.post("/organization-details",authenticate, require_("setup", "edit"), asyncHandler(async (req: any, res: any) => {
  const {
    name,
    tagline,
    logo,
    logoWidth,
    logoHeight,
    logoBorderRadius,
    loginLayout,
    logoSize,
    nameFontSize,
    taglineFontSize,
    nameColor,
    taglineColor,
    natureOfBusiness,
    address,
    contactInfo,
    socialMedia,
    loginImages,
    loginVideo
  } = req.body;

  // Validate required fields
  if (!name || !tagline || !natureOfBusiness) {
    return res.status(400).json({
      error: "Missing required fields",
      message: "Organization name, tagline, and nature of business are required"
    });
  }

  if (!address?.street || !address?.city || !address?.state || !address?.country) {
    return res.status(400).json({
      error: "Incomplete address",
      message: "Street, city, state, and country are required"
    });
  }

  if (!contactInfo?.mobile || !contactInfo?.email) {
    return res.status(400).json({
      error: "Incomplete contact info",
      message: "Mobile number and email are required"
    });
  }

  // older records were saved without a tenant; keep updating that one rather than adding a second
  const current =
    (await OrganizationDetails.findOne({ tenant: req.tenantId })) || (await OrganizationDetails.findOne({ tenant: null }));
  const orgDetails = await OrganizationDetails.findOneAndUpdate(
    current ? { _id: current._id } : { tenant: req.tenantId },
    {
      tenant: req.tenantId,
      name,
      tagline,
      logo,
      logoWidth: logoWidth || 200,
      logoHeight: logoHeight || 100,
      logoBorderRadius: logoBorderRadius || 0,
      loginLayout: loginLayout || "center-stack",
      logoSize: logoSize || 60,
      nameFontSize: nameFontSize || 24,
      taglineFontSize: taglineFontSize || 14,
      nameColor: nameColor || "#222",
      taglineColor: taglineColor || "#666",
      natureOfBusiness,
      address,
      contactInfo,
      socialMedia,
      loginImages: loginImages || [],
      loginVideo: loginVideo || null
    },
    { upsert: true, new: true }
  );

  ok(res, orgDetails);
}));

export default r;
