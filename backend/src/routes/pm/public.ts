import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ok, asyncHandler, ApiError } from "../../utils/http";
import { PmMeeting } from "../../models/pm/Meeting";
import { PmSignoff, PmVerification } from "../../models/pm/Portal";
import { PmTask } from "../../models/pm/Project";
import { answerSignoff, answerVerification } from "../../services/pm/verification";

/**
 * Project Management pages that work WITHOUT a login, opened from a link in an
 * email or WhatsApp message. Every link carries a long random token; nothing
 * here accepts or returns an internal id.
 */
const r = Router();
// links that work without a login: 30 requests a minute per address
r.use("/pm-public", rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false }));
const TOKEN = /^[0-9a-f]{24,64}$/;

/* ---- meeting invitation: see the details, answer Yes / No / Maybe ---- */
async function meetingByToken(token: string) {
  if (!TOKEN.test(token)) throw new ApiError(404, "This link is not valid");
  const m: any = await PmMeeting.findOne({ "attendees.token": token }).populate("type", "name color").populate("organizer", "name").lean();
  if (!m) throw new ApiError(404, "This link is not valid");
  const me = m.attendees.find((a: any) => a.token === token);
  return { m, me };
}
const presentMeeting = (m: any, me: any) => ({
  title: m.title, type: m.type?.name || "", date: m.date, from: m.from, to: m.to, mode: m.mode, location: m.location,
  link: m.mode !== "onsite" ? m.link : "", agenda: m.agenda, organizer: m.organizer?.name || "", status: m.status, name: me.name, response: me.response,
});

r.get(
  "/pm-public/meeting/:token",
  asyncHandler(async (req: any, res: any) => {
    const { m, me } = await meetingByToken(String(req.params.token));
    ok(res, presentMeeting(m, me));
  })
);

r.post(
  "/pm-public/meeting/:token",
  asyncHandler(async (req: any, res: any) => {
    const { m, me } = await meetingByToken(String(req.params.token));
    if (m.status === "cancelled") throw new ApiError(400, "This meeting was cancelled");
    const response = ["yes", "no", "maybe"].includes(req.body?.response) ? req.body.response : "";
    if (!response) throw new ApiError(400, "Choose Yes, No or Maybe");
    await PmMeeting.updateOne({ _id: m._id, "attendees.token": me.token }, { $set: { "attendees.$.response": response } });
    ok(res, { ...presentMeeting(m, me), response });
  })
);

/* ---- client verification of a task: Approve / Reject from the email ---- */
async function verificationByToken(token: string) {
  if (!TOKEN.test(token)) throw new ApiError(404, "This link is not valid");
  const v: any = await PmVerification.findOne({ "contacts.token": token }).populate("project", "name").populate("client", "name");
  if (!v) throw new ApiError(404, "This link is not valid");
  return { v, contact: v.contacts.find((c: any) => c.token === token) };
}
const presentVerification = async (v: any, contact: any) => {
  const task: any = await PmTask.findById(v.task).select("title checklist attachments").lean();
  return {
    status: v.status === "Pending" && new Date(v.expiresAt) < new Date() ? "Expired" : v.status,
    task: task?.title || "", project: v.project?.name || "", client: v.client?.name || "", name: contact?.name || "", summary: v.summary,
    checklist: (task?.checklist || []).map((c: any) => ({ text: c.text, done: c.done })),
    files: (task?.attachments || []).filter((a: any) => a.clientVisible && !a.pasted).map((a: any) => a.name),
    answeredBy: v.answeredBy, answeredAt: v.answeredAt, comment: v.comment,
  };
};
r.get(
  "/pm-public/verify/:token",
  asyncHandler(async (req: any, res: any) => {
    const { v, contact } = await verificationByToken(String(req.params.token));
    ok(res, await presentVerification(v, contact));
  })
);
r.post(
  "/pm-public/verify/:token",
  asyncHandler(async (req: any, res: any) => {
    const { v, contact } = await verificationByToken(String(req.params.token));
    await answerVerification(v, { approved: !!req.body?.approve, comment: req.body?.comment, via: "email", by: contact.name, from: req.ip });
    ok(res, await presentVerification(await PmVerification.findById(v._id).populate("project", "name").populate("client", "name"), contact));
  })
);

/* ---- sign-off: Accept / Raise a concern ---- */
async function signoffByToken(token: string) {
  if (!TOKEN.test(token)) throw new ApiError(404, "This link is not valid");
  const so: any = await PmSignoff.findOne({ token }).populate("client", "name");
  if (!so) throw new ApiError(404, "This link is not valid");
  return so;
}
const presentSignoff = (so: any) => ({
  status: so.status === "Pending" && new Date(so.expiresAt) < new Date() ? "Expired" : so.status,
  title: so.title, client: so.client?.name || "", name: so.contact?.name || "", summary: so.summary, sentAt: so.sentAt, answeredBy: so.answeredBy, answeredAt: so.answeredAt, comment: so.comment,
});
r.get(
  "/pm-public/signoff/:token",
  asyncHandler(async (req: any, res: any) => {
    ok(res, presentSignoff(await signoffByToken(String(req.params.token))));
  })
);
r.post(
  "/pm-public/signoff/:token",
  asyncHandler(async (req: any, res: any) => {
    const so = await signoffByToken(String(req.params.token));
    await answerSignoff(so, { accept: !!req.body?.accept, comment: req.body?.comment, by: so.contact?.name || "Client", from: req.ip });
    ok(res, presentSignoff(await PmSignoff.findById(so._id).populate("client", "name")));
  })
);

export default r;
