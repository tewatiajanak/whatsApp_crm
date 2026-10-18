import { Types } from "mongoose";
import { Campaign, Message, Template } from "../models/Messaging";
import { Contact as ContactModel } from "../models/Contact";
import { Lead } from "../models/Lead";
import { CrmList } from "../models/CrmPro";
import { RecipientList, CampaignAudience, IRecipient, MAX_RECIPIENTS } from "../models/CampaignPro";
import { sendTemplate } from "./whatsapp";
import { audit } from "../utils/http";
import { config } from "../config";

/**
 * Campaign sender.
 *
 * If USE_QUEUE=true and Redis is available, jobs are pushed to BullMQ and the
 * worker (src/jobs/worker.ts) processes them with rate limiting. Otherwise we
 * send in the background from this process (fine for dev / small batches).
 *
 * The audience is resolved once, when the campaign is launched or scheduled,
 * and frozen in CampaignAudience — the report and resends read it from there.
 */

let queue: any = null;
export async function getQueue() {
  if (!config.useQueue) return null;
  if (queue) return queue;
  try {
    const { Queue } = await import("bullmq");
    const IORedis = (await import("ioredis")).default;
    const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue("campaign-send", { connection: connection as any });
    return queue;
  } catch (e) {
    console.warn("[campaign] queue unavailable, using inline send:", (e as Error).message);
    return null;
  }
}

/** Delivery statuses, in the order a message moves through them. */
export const STATUS_RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 };
/** Statuses a recipient can be in on the report (and picked for a resend). */
export const REPORT_STATUSES = ["pending", "queued", "sent", "delivered", "read", "failed"] as const;

/** Same number however it was typed: digits only, with a leading + kept. */
export function normalizePhone(v: unknown) {
  const raw = String(v ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return raw.startsWith("+") ? `+${digits}` : digits;
}
const phoneKey = (p: string) => p.replace(/\D/g, "").slice(-10);

function dedupe(rows: IRecipient[]) {
  const seen = new Set<string>();
  const out: IRecipient[] = [];
  for (const r of rows) {
    const phone = normalizePhone(r.phone);
    if (!phone) continue;
    const k = phoneKey(phone);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name: String(r.name || "").trim(), phone, ...(r.extra && Object.keys(r.extra).length ? { extra: r.extra } : {}) });
    if (out.length >= MAX_RECIPIENTS) break;
  }
  return out;
}

/** Latest message per phone for a campaign → its current status. */
export async function latestByPhone(campaignId: any) {
  const msgs = await Message.find({ campaign: campaignId, direction: "outbound" })
    .select("phone contactName status sentAt deliveredAt readAt failReason createdAt")
    .sort({ createdAt: 1 })
    .lean();
  const map = new Map<string, any>();
  for (const m of msgs) map.set(phoneKey(m.phone), m);
  return map;
}

/**
 * Work out who a campaign goes to. `leadFilter` turns a lead list into a Mongo
 * filter within what the launching user may see (routes pass it in).
 */
export async function resolveAudience(campaign: any, leadFilter?: (list: any) => Promise<any>): Promise<IRecipient[]> {
  const tenant = campaign.tenant;
  const type = campaign.audienceType || "contacts";

  // one or more lists; a number in several lists is sent once (first list wins)
  const refs: any[] = campaign.audienceRefs?.length ? campaign.audienceRefs : [campaign.audienceRef];

  if (type === "list") {
    const rows: IRecipient[] = [];
    for (const ref of refs) {
      const list = await RecipientList.findOne({ _id: ref, tenant }).lean();
      if (!list) throw new Error("A recipient list in this campaign was deleted");
      rows.push(...(list.rows || []));
    }
    return dedupe(rows);
  }

  if (type === "leadList") {
    const rows: IRecipient[] = [];
    for (const ref of refs) {
      const list = await CrmList.findOne({ _id: ref, tenant }).lean();
      if (!list) throw new Error("A lead list in this campaign was deleted");
      const filter = leadFilter ? await leadFilter(list) : { tenant, _id: { $in: (list as any).leads || [] } };
      const leads = await Lead.find(filter).select("name phone").limit(MAX_RECIPIENTS).lean();
      rows.push(...leads.map((l: any) => ({ name: l.name, phone: l.phone })));
    }
    return dedupe(rows);
  }

  if (type === "resend") {
    const parent = await Campaign.findOne({ _id: campaign.parentCampaign, tenant }).lean();
    if (!parent) throw new Error("The original campaign was deleted");
    const want = new Set<string>(campaign.resendStatuses || []);
    const audience = await CampaignAudience.findOne({ campaign: parent._id }).lean();
    const latest = await latestByPhone(parent._id);
    const rows: IRecipient[] = [];
    const seen = new Set<string>();
    for (const r of audience?.rows || []) {
      const k = phoneKey(r.phone);
      seen.add(k);
      const st = latest.get(k)?.status || "pending";
      if (want.has(st)) rows.push(r);
    }
    // campaigns sent before audiences were saved: use the delivery log
    for (const [k, m] of latest) {
      if (seen.has(k)) continue;
      if (want.has(m.status)) rows.push({ name: m.contactName || "", phone: m.phone });
    }
    return dedupe(rows);
  }

  const filter: any = { tenant, optIn: true };
  if (campaign.category && campaign.category !== "All") filter.category = campaign.category;
  const contacts = await ContactModel.find(filter).select("name phone").limit(MAX_RECIPIENTS).lean();
  return dedupe(contacts.map((c: any) => ({ name: c.name, phone: c.phone })));
}

/** Template {{n}} values for one recipient. */
function paramsFor(campaign: any, r: IRecipient) {
  return (campaign.variables || []).map((v: any) => {
    if (v.source === "name") return r.name || "Customer";
    if (v.source === "phone") return r.phone;
    if (v.source === "column") return String(r.extra?.[v.value] ?? "").trim() || "-";
    return String(v.value ?? "").trim() || "-";
  });
}

/** Freeze the audience and either schedule the campaign or start sending it. */
export async function launchCampaign(opts: {
  tenant: any;
  campaignId: string;
  user?: string;
  leadFilter?: (list: any) => Promise<any>;
}) {
  const campaign = await Campaign.findOne({ _id: opts.campaignId, tenant: opts.tenant });
  if (!campaign) throw new Error("Campaign not found");
  if (!["Draft", "Scheduled"].includes(campaign.status)) throw new Error("This campaign has already been sent");
  if (!campaign.template) throw new Error("Pick a template");

  const recipients = await resolveAudience(campaign, opts.leadFilter);
  if (!recipients.length) throw new Error("No recipients with a valid phone number");

  await CampaignAudience.updateOne(
    { campaign: campaign._id },
    { $set: { tenant: opts.tenant, rows: recipients } },
    { upsert: true }
  );
  campaign.audienceSize = recipients.length;
  campaign.status = campaign.scheduledFor && campaign.scheduledFor > new Date() ? "Scheduled" : "Running";
  await campaign.save();

  if (campaign.status === "Scheduled") {
    await audit({ tenant: opts.tenant, user: opts.user, action: "SCHEDULE", module: "Blast", entity: campaign.name, next: `${recipients.length} recipients` });
    return { queued: 0, recipients: recipients.length, scheduled: true };
  }

  const viaQueue = await startSending(campaign);
  await audit({ tenant: opts.tenant, user: opts.user, action: "SEND", module: "Blast", entity: campaign.name, next: `${recipients.length} recipients` });
  return { queued: recipients.length, recipients: recipients.length, scheduled: false, viaQueue };
}

/** Send to every frozen recipient that has no message yet. Runs in the background. */
async function startSending(campaign: any) {
  await Campaign.updateOne({ _id: campaign._id }, { $set: { status: "Running", launchedAt: campaign.launchedAt || new Date() } });
  const audience = await CampaignAudience.findOne({ campaign: campaign._id }).lean();
  const rows = audience?.rows || [];
  const tpl = await Template.findOne({ tenant: campaign.tenant, name: campaign.template }).select("language").lean();
  const language = (tpl as any)?.language || "en";
  const q = await getQueue();

  const run = async () => {
    const done = await latestByPhone(campaign._id);
    for (const r of rows) {
      if (done.has(phoneKey(r.phone))) continue;
      // stop when someone pauses the campaign
      const now = await Campaign.findById(campaign._id).select("status").lean();
      if (!now || now.status !== "Running") return;
      const job = {
        tenant: String(campaign.tenant),
        campaignId: String(campaign._id),
        phone: r.phone,
        name: r.name,
        template: campaign.template,
        category: campaign.category,
        language,
        params: paramsFor(campaign, r),
      };
      if (q) await q.add("send", job, { attempts: 5, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: true });
      else await sendOneCampaignMessage(job);
    }
    if (!q) await Campaign.updateOne({ _id: campaign._id, status: "Running" }, { $set: { status: "Completed", completedAt: new Date() } });
  };
  setImmediate(() => run().catch((e) => console.error("[campaign] send failed:", e?.message || e)));
  return !!q;
}

/** Pick up sending again after a pause. */
export async function resumeCampaign(tenant: any, id: string) {
  const c = await Campaign.findOne({ _id: id, tenant });
  if (!c) throw new Error("Campaign not found");
  await startSending(c);
  return c;
}

/** Scheduled campaigns whose time has come. Called every minute by the CRM engine. */
export async function runDueCampaigns() {
  const due = await Campaign.find({ status: "Scheduled", scheduledFor: { $lte: new Date() } }).limit(20);
  for (const c of due) {
    await startSending(c).catch((e) => console.error("[campaign] scheduled send failed:", e?.message || e));
  }
}

/** Send a single campaign message and persist the delivery row. Used by worker + inline. */
export async function sendOneCampaignMessage(job: {
  tenant: any;
  campaignId: string;
  contactId?: string;
  phone: string;
  name: string;
  template: string;
  category?: string;
  language?: string;
  params?: string[];
}) {
  try {
    const result = await sendTemplate(job.tenant, job.phone, job.template, job.language || "en", job.params || []);
    await Message.create({
      tenant: job.tenant,
      campaign: job.campaignId,
      contact: job.contactId || null,
      waMessageId: result.waMessageId,
      direction: "outbound",
      type: "template",
      template: job.template,
      contactName: job.name,
      phone: job.phone,
      category: job.category,
      status: "sent",
      sentAt: new Date(),
      simulated: !!result.simulated,
    });
    await Campaign.updateOne({ _id: job.campaignId }, { $inc: { sent: 1 } });

    // In simulation mode, fake an async delivery+read so the funnel populates.
    if (result.simulated) {
      const roll = Math.random();
      setTimeout(async () => {
        const update: any = { status: "delivered", deliveredAt: new Date() };
        await Message.updateOne({ waMessageId: result.waMessageId }, { $set: update });
        await Campaign.updateOne({ _id: job.campaignId }, { $inc: { delivered: 1 } });
        if (roll > 0.4) {
          setTimeout(async () => {
            await Message.updateOne({ waMessageId: result.waMessageId }, { $set: { status: "read", readAt: new Date() } });
            await Campaign.updateOne({ _id: job.campaignId }, { $inc: { read: 1 } });
          }, 400);
        }
      }, 300);
    }
    return { ok: true };
  } catch (e) {
    await Message.create({
      tenant: job.tenant,
      campaign: job.campaignId,
      contact: job.contactId || null,
      direction: "outbound",
      type: "template",
      template: job.template,
      contactName: job.name,
      phone: job.phone,
      category: job.category,
      status: "failed",
      failReason: (e as Error).message,
    });
    await Campaign.updateOne({ _id: job.campaignId }, { $inc: { failed: 1 } });
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Live counts per campaign from the delivery log (latest message per number).
 * "delivered" includes read, "sent" includes delivered — like the WhatsApp ticks.
 */
export async function campaignStats(campaignIds: any[]) {
  const ids = campaignIds.map((id) => new Types.ObjectId(String(id)));
  if (!ids.length) return new Map<string, any>();
  const rows = await Message.aggregate([
    { $match: { campaign: { $in: ids }, direction: "outbound" } },
    { $sort: { createdAt: 1 } },
    { $group: { _id: { c: "$campaign", p: "$phone" }, status: { $last: "$status" } } },
    { $group: { _id: { c: "$_id.c", s: "$status" }, n: { $sum: 1 } } },
  ]);
  const out = new Map<string, any>();
  for (const r of rows) {
    const key = String(r._id.c);
    const s = out.get(key) || { queued: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
    s[r._id.s] = (s[r._id.s] || 0) + r.n;
    out.set(key, s);
  }
  for (const [k, s] of out) out.set(k, rollup(s));
  return out;
}

/** Exact counts → cumulative funnel numbers shown on the list and report. */
export function rollup(s: any, audience = 0) {
  const read = s.read || 0;
  const delivered = (s.delivered || 0) + read;
  const sent = (s.sent || 0) + delivered;
  const failed = s.failed || 0;
  const attempted = sent + failed + (s.queued || 0);
  return { sent, delivered, read, failed, queued: s.queued || 0, attempted, pending: Math.max(0, audience - attempted), exact: s };
}
