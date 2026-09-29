import { Router } from "express";
import { authenticate, require_ } from "../middleware/auth";
import { crud } from "../controllers/crudFactory";
import { ok, asyncHandler, ApiError } from "../utils/http";
import { WORKFLOW_EVENTS, CONDITION_FIELDS, CONDITION_OPERATORS, ACTION_TYPES, ASSIGNMENT_STRATEGIES } from "../config/workflowConfig";

import * as authC from "../controllers/authController";
import * as leadC from "../controllers/leadController";
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
import { LeadStatus, SubStatus, LeadSource, AcademicSession, Grade, Designation } from "../models/Masters";
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
import { EVENT_TYPE_DEFAULTS } from "../data/eventTypeDefaults";
import { convertToLead } from "../services/leadService";

const r = Router();

// Media conversion endpoint (accepts uploaded WebM and returns MP4)
const uploadDir = path.join(os.tmpdir(), "whatsapp_crm_uploads");
if (!fs.existsSync(uploadDir)) {
  try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) {}
}
const upload = multer({ dest: uploadDir });

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

/* ---- public ---- */
r.post("/auth/login", authC.login);

const getEnquiryFormById = async (formId: string) => {
  const config = await WorkflowConfig.findOne({ key: "enquiryForms" }).lean();
  const forms = Array.isArray((config as any)?.data?.forms) ? (config as any).data.forms : [];
  const form = forms.find((item: any) => String(item._id) === String(formId));
  const tenant = (config as any)?.tenant || (await Tenant.findOne({}).lean())?._id;
  return { config, form, tenant };
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
    const { config, form, tenant } = await getEnquiryFormById(req.params.formId);
    if (!form) throw new ApiError(404, "Enquiry form not found");
    if (form.isActive === false) throw new ApiError(403, "This enquiry form is not live");

    const values = req.body || {};
    const pickValue = (...keys: string[]) => {
      for (const key of keys) {
        const val = values[key];
        if (typeof val === "string" && val.trim()) return val.trim();
        if (typeof val === "number") return String(val);
      }
      return "";
    };

    const name = pickValue("studentName", "name", "fullName", "student_name");
    const phone = pickValue("mobileNumber", "phone", "mobile", "contactNumber");
    const email = pickValue("emailId", "email");
    const course = pickValue("courseInterested", "course", "courseName");
    const source = pickValue("enquirySource", "source", "leadSource");

    if (!name || !phone) throw new ApiError(400, "Name and phone are required");

    const result = await convertToLead({
      tenant: tenant,
      name,
      phone,
      email: email || undefined,
      sourceKeyOrId: source || undefined,
      course: course || undefined,
      user: "Public Enquiry Form",
    });

    ok(res, { lead: result.lead, created: result.created });
  })
);

const getLandingPageById = async (pageId: string) => {
  const config = await WorkflowConfig.findOne({ key: "landingPages" }).lean();
  const pages = Array.isArray((config as any)?.data?.pages) ? (config as any).data.pages : [];
  const page = pages.find((item: any) => String(item._id) === String(pageId));
  const tenant = (config as any)?.tenant || (await Tenant.findOne({}).lean())?._id;
  return { config, page, tenant };
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

/* ---- Organization Details - GET is PUBLIC ---- */
r.get("/organization-details", asyncHandler(async (req: any, res: any) => {
  try {
    console.log("GET /organization-details called - public endpoint");
    let orgDetails;

    // If authenticated, get tenant-specific org details
    if ((req as any).tenant) {
      orgDetails = await OrganizationDetails.findOne({ tenant: (req as any).tenant });
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

/* ---- everything below requires auth ---- */
r.use(authenticate);
r.get("/auth/me", authC.me);
r.get("/system/status", msgC.status);
r.get("/flowchat/state", require_("workflows", "view"), flowStudioC.getFlowStudioState);
r.put("/flowchat/state", require_("workflows", "edit"), flowStudioC.saveFlowStudioState);
r.get("/flowchat/media", require_("workflows", "view"), flowMediaC.listFlowMedia);
r.post("/flowchat/media", require_("workflows", "create"), upload.single("file"), flowMediaC.createFlowMedia);
r.patch("/flowchat/media/:id", require_("workflows", "edit"), flowMediaC.updateFlowMedia);
r.delete("/flowchat/media/:id", require_("workflows", "del"), flowMediaC.deleteFlowMedia);

/* ---- Leads ---- */
const leadCrud = crud(Lead, { module: "leads", searchFields: ["name", "phone", "course"], populate: "status source subStatus" });
r.get("/leads", require_("leads", "view"), leadCrud.list);
r.get("/leads/:id", require_("leads", "view"), leadCrud.get);
r.post("/leads", require_("leads", "create"), leadCrud.create);
r.patch("/leads/:id", require_("leads", "edit"), leadCrud.update);
r.delete("/leads/:id", require_("leads", "del"), leadCrud.remove);
r.post("/leads/convert", require_("leads", "create"), leadC.convert);
r.post("/leads/:id/status", require_("leads", "edit"), leadC.setStatus);
r.post("/leads/:id/services", require_("leads", "edit"), trackC.addTrack);
r.post("/leads/:id/services/status", require_("leads", "edit"), trackC.setTrackStatus);
r.delete("/leads/:id/services/:serviceId", require_("leads", "edit"), trackC.removeTrack);
r.post("/leads/:id/notes", require_("leads", "edit"), leadC.addNote);
r.post("/leads/:id/followups", require_("leads", "edit"), fuC.createFollowUpForLead);
r.get("/leads/:id/service/:serviceId/statuses", require_("leads", "view"), leadC.getServiceStatuses);

/* ---- Follow-ups ---- */
const fuCrud = crud(FollowUp, { module: "followups", searchFields: ["leadName", "phone"] });
r.get("/followups", require_("followups", "view"), fuCrud.list);
r.get("/followups/buckets", require_("followups", "view"), fuC.buckets);
r.get("/followups/workload", require_("followups", "view"), fuC.getWorkload);
r.post("/followups", require_("followups", "create"), fuCrud.create);
r.post("/followups/:id/complete", require_("followups", "edit"), fuC.complete);
r.post("/followups/:id/reschedule", require_("followups", "edit"), fuC.reschedule);

/* ---- Contacts ---- */
const contactCrud = crud(Contact, { module: "contacts", searchFields: ["name", "phone", "email"] });
r.get("/contacts", require_("contacts", "view"), contactCrud.list);
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
const gradeCrud = crud(Grade, { module: "setup", searchFields: ["name"] });
r.get("/grades", require_("setup", "view"), gradeCrud.list);
r.post("/grades", require_("setup", "create"), gradeCrud.create);
r.patch("/grades/:id", require_("setup", "edit"), gradeCrud.update);
r.delete("/grades/:id", require_("setup", "del"), gradeCrud.remove);

/* ---- Designations (Setup) ---- */
const desgCrud = crud(Designation, { module: "setup", searchFields: ["name"] });
r.get("/designations", require_("setup", "view"), desgCrud.list);
r.post("/designations", require_("setup", "create"), desgCrud.create);
r.patch("/designations/:id", require_("setup", "edit"), desgCrud.update);
r.delete("/designations/:id", require_("setup", "del"), desgCrud.remove);

/* ---- Teams (Setup) ---- */
const teamCrud = crud(Team, { module: "setup", searchFields: ["name"], populate: "manager members.user sources" });
r.get("/teams", require_("setup", "view"), teamCrud.list);
r.post("/teams", require_("setup", "create"), async (req, res) => {
  try {
    const { name, manager, members, sources } = req.body;

    if (!name || !name.trim()) throw new Error("Team name is required");
    if (!manager) throw new Error("Manager is required");
    if (!members || members.length === 0) throw new Error("At least one team member is required");

    const team = new Team({
      tenant: req.tenantId,
      name,
      manager,
      members: members.map(m => ({ user: m })),
      sources: sources || [],
      active: true
    });
    const saved = await team.save();
    const populated = await saved.populate("manager members.user sources");
    res.json(populated);
  } catch (e) { res.status(400).json({ error: (e instanceof Error ? e.message : String(e)) }); }
});
r.patch("/teams/:id", require_("setup", "edit"), async (req, res) => {
  try {
    const { name, manager, members, sources } = req.body;

    if (!name || !name.trim()) throw new Error("Team name is required");
    if (!manager) throw new Error("Manager is required");
    if (!members || members.length === 0) throw new Error("At least one team member is required");

    const update = {
      name,
      manager,
      members: members.map(m => ({ user: m })),
      sources: sources || []
    };
    const team = await Team.findByIdAndUpdate(req.params.id, update, { new: true }).populate("manager members.user sources");
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
r.post("/registrations", require_("leads", "create"), regCrud.create);
r.patch("/registrations/:id", require_("leads", "edit"), regCrud.update);
r.delete("/registrations/:id", require_("leads", "del"), regCrud.remove);

/* ---- Users & roles (Setup) ---- */
const userTypeCrud = crud(UserType, { module: "setup" });
r.get("/usertypes", require_("setup", "view"), userTypeCrud.list);
r.post("/usertypes", require_("setup", "create"), userTypeCrud.create);
r.patch("/usertypes/:id", require_("setup", "edit"), userTypeCrud.update);
r.delete("/usertypes/:id", require_("setup", "del"), userTypeCrud.remove);

const userCrud = crud(User, { module: "setup", searchFields: ["name", "email"], populate: "userType" });
r.get("/users", require_("setup", "view"), userCrud.list);
r.post("/users", require_("setup", "create"), userCrud.create);
r.patch("/users/:id", require_("setup", "edit"), userCrud.update);
r.delete("/users/:id", require_("setup", "del"), userCrud.remove);

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
const campCrud = crud(Campaign, { module: "blast", searchFields: ["name", "template"] });
r.get("/campaigns", require_("blast", "view"), campCrud.list);
r.get("/campaigns/:id", require_("blast", "view"), campCrud.get);
r.post("/campaigns", require_("blast", "create"), campCrud.create);
r.patch("/campaigns/:id", require_("blast", "edit"), campCrud.update);
r.delete("/campaigns/:id", require_("blast", "del"), campCrud.remove);
r.post("/campaigns/:id/launch", require_("blast", "create"), msgC.launch);
r.post("/campaigns/:id/pause", require_("blast", "edit"), msgC.pauseCampaign);

/* ---- Messages (history) ---- */
const msgCrud = crud(Message, { module: "reports", searchFields: ["contactName", "phone", "template"] });
r.get("/messages", require_("reports", "view"), msgCrud.list);
r.post("/messages/send", require_("blast", "create"), msgC.sharedSend);
r.post("/messages/:id/convert", require_("leads", "create"), msgC.messageToLead);

/* ---- Conversations (chat) ---- */
const convCrud = crud(Conversation, { module: "chat", searchFields: ["name", "phone"] });
r.get("/conversations", require_("chat", "view"), convCrud.list);
r.get("/conversations/:id", require_("chat", "view"), convCrud.get);
r.post("/conversations/:id/reply", require_("chat", "create"), msgC.replyToConversation);
r.post("/conversations/:id/read", require_("chat", "edit"), msgC.markRead);

/* ---- Conversion analytics ---- */
r.get("/conversion/stats", require_("conversion", "view"), msgC.conversionStats);

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

r.get("/workflow-config/:key", authenticate, async (req, res) => {
  try {
    const config = await WorkflowConfig.findOne({
      tenant: (req as any).tenant,
      key: req.params.key
    });
    ok(res, config || { fields: [] });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

r.post("/workflow-config/:key", authenticate, require_("setup", "edit"), async (req, res) => {
  try {
    const config = await WorkflowConfig.findOneAndUpdate(
      { tenant: (req as any).tenant, key: req.params.key },
      { data: req.body, tenant: (req as any).tenant, key: req.params.key },
      { upsert: true, new: true }
    );
    ok(res, config);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

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

  const orgDetails = await OrganizationDetails.findOneAndUpdate(
    { tenant: req.tenant },
    {
      tenant: req.tenant,
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
