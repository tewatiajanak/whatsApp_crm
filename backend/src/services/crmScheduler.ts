import { Tenant } from "../models/Tenant";
import { Lead } from "../models/Lead";
import { FollowUp } from "../models/FollowUp";
import { LeadStatus } from "../models/Masters";
import { LeadActivity } from "../models/LeadActivity";
import { User } from "../models/User";
import { crmSettingsFor, CrmSettings, ICrmSettings } from "../models/CrmExtras";
import { notify, appUrl, mailSettings } from "./pm/messages";
import { sendEmail } from "./email";
import { decryptSecret } from "./payments/crypto";
import { fireAlerts, runDueAutomation } from "./alertsEngine";
import { logActivity, refreshLead } from "./leadService";
import { localDateKey, startOfLocalDay, endOfLocalDay, tzOffsetMin } from "../utils/dates";
import { LeadTrash } from "../models/CrmMore";
import { applyLeadAssignment } from "./workflowEngine";
import { captureEnquiry } from "./leadCapture";
import { pollInbox, pullPortals, syncGoogle } from "./crmIntegrations";
import { FollowUp as FU } from "../models/FollowUp";
import { runDueCampaigns } from "./campaignService";

const MIN = 60_000;
const localHour = () => new Date(Date.now() + tzOffsetMin * MIN).getUTCHours();
const localWeekday = () => new Date(Date.now() + tzOffsetMin * MIN).getUTCDay();
const hhmm = (d: Date) => new Date(d.getTime() + tzOffsetMin * MIN).toISOString().slice(11, 16);

/** Active users by name — leads and follow-ups carry the owner's name. */
async function usersByName(tenant: any, names: string[]) {
  const users = await User.find({ tenant, status: "Active", name: { $in: [...new Set(names.filter(Boolean))] } }).select("name reportingManager").lean();
  return new Map(users.map((u: any) => [u.name, u]));
}

/** Tell the owner a follow-up is about to fall due, and fire the "Follow-up Due" automation. */
async function followUpReminders(tenant: any, s: ICrmSettings) {
  if (!s.reminders.enabled) return;
  const now = Date.now();
  const due = await FollowUp.find({
    tenant, done: false, remindedAt: null,
    due: { $lte: new Date(now + Math.max(0, s.reminders.minutesBefore) * MIN), $gte: new Date(now - 24 * 60 * MIN) },
  }).limit(200);
  if (!due.length) return;
  const users = await usersByName(tenant, due.map((f) => f.owner));
  for (const f of due) {
    const claimed = await FollowUp.updateOne({ _id: f._id, remindedAt: null }, { $set: { remindedAt: new Date() } });
    if (!claimed.modifiedCount) continue;
    const u: any = users.get(f.owner);
    if (u) {
      await notify({
        tenantId: tenant, users: [u._id], category: "crm_followup",
        title: `${f.type} follow-up: ${f.leadName}`, body: `Due ${hhmm(f.due)}${f.note ? ` · ${f.note}` : ""}`, link: `/crm/leads?lead=${f.lead}`,
      });
    }
    const lead = await Lead.findById(f.lead);
    if (lead) await fireAlerts("followup.due", lead, tenant, "Scheduler");
  }
}

/** Once each morning: how many follow-ups each person has today, and how many are overdue. */
async function morningDigest(tenant: any, s: ICrmSettings) {
  const key = localDateKey();
  if (!s.reminders.enabled || !s.reminders.morningDigest || s.lastDigestKey === key || localHour() < s.reminders.digestHour) return;
  const claimed = await CrmSettings.updateOne({ _id: s._id, lastDigestKey: { $ne: key } }, { $set: { lastDigestKey: key } });
  if (!claimed.modifiedCount) return;
  const open = await FollowUp.aggregate([
    { $match: { tenant: s.tenant, done: false, due: { $lte: endOfLocalDay() } } },
    { $group: { _id: "$owner", overdue: { $sum: { $cond: [{ $lt: ["$due", startOfLocalDay()] }, 1, 0] } }, today: { $sum: { $cond: [{ $gte: ["$due", startOfLocalDay()] }, 1, 0] } } } },
  ]);
  const users = await usersByName(tenant, open.map((o) => o._id));
  for (const o of open) {
    const u: any = users.get(o._id);
    if (!u) continue;
    await notify({
      tenantId: tenant, users: [u._id], category: "crm_followup",
      title: `${o.today} follow-up${o.today === 1 ? "" : "s"} today${o.overdue ? `, ${o.overdue} overdue` : ""}`, link: "/crm/followups",
    });
  }
}

/** A new lead nobody has contacted within the time limit: flag it and tell the owner and their manager. */
async function firstResponseSla(tenant: any, s: ICrmSettings) {
  if (!s.sla.enabled || s.sla.firstResponseMins <= 0) return;
  const closed = await LeadStatus.find({ tenant, $or: [{ isWon: true }, { isLost: true }] }).select("_id").lean();
  const late = await Lead.find({
    tenant, firstContactedAt: null, slaBreachedAt: null, status: { $nin: closed.map((c: any) => c._id) },
    // only recent leads: switching this on must not flood people with alerts about old ones
    createdAt: { $lte: new Date(Date.now() - s.sla.firstResponseMins * MIN), $gte: new Date(Date.now() - 3 * 24 * 60 * MIN) },
  }).limit(100);
  if (!late.length) return;
  const users = await usersByName(tenant, [...late.map((l) => l.owner), ...s.sla.alsoNotify]);
  for (const lead of late) {
    const claimed = await Lead.updateOne({ _id: lead._id, slaBreachedAt: null }, { $set: { slaBreachedAt: new Date() } });
    if (!claimed.modifiedCount) continue;
    const owner: any = users.get(lead.owner);
    const targets = [owner?._id, s.sla.notifyManager ? owner?.reportingManager : null, ...s.sla.alsoNotify.map((n) => (users.get(n) as any)?._id)].filter(Boolean);
    await logActivity({ tenant, lead: lead._id, type: "sla", title: "First response overdue", detail: `Not contacted within ${s.sla.firstResponseMins} minutes`, by: "System" });
    if (targets.length) {
      await notify({
        tenantId: tenant, users: targets, category: "crm_lead",
        title: `Not contacted yet: ${lead.name}`, body: `${lead.owner || "Unassigned"} · waiting over ${s.sla.firstResponseMins} min`, link: `/crm/leads?lead=${lead._id}`,
      });
    }
    if (s.assignment?.reassignOnSla) {
      const before = lead.owner;
      await applyLeadAssignment(lead, tenant, { exclude: before });
      if (lead.owner !== before) {
        await FU.updateMany({ tenant, lead: lead._id, done: false }, { $set: { owner: lead.owner, assignedTo: lead.owner } });
        await logActivity({ tenant, lead: lead._id, type: "assigned", by: "System", title: `Reassigned to ${lead.owner}`, detail: `${before || "Unassigned"} did not make contact in time` });
        const next: any = (await usersByName(tenant, [lead.owner])).get(lead.owner);
        if (next) await notify({ tenantId: tenant, users: [next._id], category: "crm_lead", title: `New lead for you: ${lead.name}`, body: "Passed on — call now", link: `/crm/leads?lead=${lead._id}` });
      }
    }
    await fireAlerts("lead.sla_breached", lead, tenant, "Scheduler");
  }
}

/** Once a day: leads that have gone quiet lose the points they earned for being recently active. */
async function scoreDecay(tenant: any, s: ICrmSettings) {
  const key = localDateKey();
  if (s.lastDecayKey === key || localHour() < 2) return;
  const claimed = await CrmSettings.updateOne({ _id: s._id, lastDecayKey: { $ne: key } }, { $set: { lastDecayKey: key } });
  if (!claimed.modifiedCount) return;
  const closed = await LeadStatus.find({ tenant, $or: [{ isWon: true }, { isLost: true }] }).select("_id").lean();
  const idle = await Lead.find({
    tenant, status: { $nin: closed.map((c: any) => c._id) }, score: { $gt: 0 },
    // the recency points step down at 2, 7 and 14 idle days — nothing changes after that
    lastActivity: { $lt: new Date(Date.now() - 2 * 24 * 60 * MIN), $gte: new Date(Date.now() - 16 * 24 * 60 * MIN) },
  }).select("_id").limit(5000).lean();
  for (const l of idle) await refreshLead(l._id).catch(() => undefined);
}

/* ───────────── scheduled summary email ───────────── */

/** Numbers for a period, overall and per counsellor. */
export async function buildSummary(tenant: any, from: Date, to: Date) {
  const statuses = await LeadStatus.find({ tenant }).select("isWon isLost").lean();
  const won = statuses.filter((x: any) => x.isWon).map((x: any) => x._id);
  const lost = statuses.filter((x: any) => x.isLost).map((x: any) => x._id);
  const range = { $gte: from, $lte: to };
  const by = async (Mdl: any, match: any, field: string) =>
    new Map<string, number>((await Mdl.aggregate([{ $match: { tenant, ...match } }, { $group: { _id: field, n: { $sum: 1 } } }])).map((r: any) => [r._id || "Unassigned", r.n]));

  const [created, wonBy, lostBy, done, calls, overdue, untouched] = await Promise.all([
    by(Lead, { createdAt: range }, "$owner"),
    by(Lead, { status: { $in: won }, statusChangedAt: range }, "$owner"),
    by(Lead, { status: { $in: lost }, statusChangedAt: range }, "$owner"),
    by(FollowUp, { done: true, completedAt: range }, "$owner"),
    by(LeadActivity, { type: "call", at: range }, "$by"),
    by(FollowUp, { done: false, due: { $lt: startOfLocalDay() } }, "$owner"),
    by(Lead, { firstContactedAt: null, status: { $nin: [...won, ...lost] } }, "$owner"),
  ]);
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
  const owners = [...new Set([...created.keys(), ...wonBy.keys(), ...done.keys(), ...calls.keys(), ...overdue.keys()])].sort();
  return {
    totals: { created: sum(created), won: sum(wonBy), lost: sum(lostBy), followUpsDone: sum(done), calls: sum(calls), overdue: sum(overdue), untouched: sum(untouched) },
    rows: owners.map((o) => ({ owner: o, created: created.get(o) || 0, won: wonBy.get(o) || 0, followUpsDone: done.get(o) || 0, calls: calls.get(o) || 0, overdue: overdue.get(o) || 0 })),
  };
}

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Email the summary to the configured recipients. Returns how many were sent. */
export async function sendSummary(tenant: any, s: ICrmSettings, frequency = s.reports.frequency): Promise<number> {
  const to = new Date();
  const from = frequency === "weekly" ? new Date(startOfLocalDay().getTime() - 6 * 24 * 60 * MIN) : startOfLocalDay();
  const sum = await buildSummary(s.tenant, from, to);
  const period = frequency === "weekly" ? `${localDateKey(from)} to ${localDateKey()}` : localDateKey();
  const t = sum.totals;
  const cell = 'style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right"';
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
<h2 style="margin:0 0 4px">Lead summary</h2><div style="color:#6b7280;margin-bottom:14px">${esc(period)}</div>
<p><b>${t.created}</b> new leads · <b>${t.won}</b> won · <b>${t.lost}</b> lost · <b>${t.calls}</b> calls · <b>${t.followUpsDone}</b> follow-ups done</p>
<p style="color:#b91c1c"><b>${t.overdue}</b> follow-ups overdue · <b>${t.untouched}</b> open leads not contacted yet</p>
<table style="border-collapse:collapse;font-size:13px"><tr style="background:#f3f4f6"><th style="padding:6px 10px;text-align:left">Counsellor</th><th ${cell}>New</th><th ${cell}>Won</th><th ${cell}>Calls</th><th ${cell}>Follow-ups done</th><th ${cell}>Overdue</th></tr>
${sum.rows.map((r) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e7eb">${esc(r.owner)}</td><td ${cell}>${r.created}</td><td ${cell}>${r.won}</td><td ${cell}>${r.calls}</td><td ${cell}>${r.followUpsDone}</td><td ${cell}>${r.overdue}</td></tr>`).join("")}
</table><p><a href="${esc(await appUrl(tenant))}/crm/conversion">Open the full report</a></p></div>`;
  const mail: any = await mailSettings(tenant).catch(() => null);
  const smtp = mail?.smtpHost ? { host: mail.smtpHost, port: mail.smtpPort, secure: mail.smtpSecure, user: mail.smtpUser, pass: decryptSecret(mail.smtpPass) } : null;
  let sent = 0;
  for (const email of s.reports.recipients) {
    await sendEmail({ to: email, subject: `Lead summary · ${period}`, html, smtp, from: mail?.fromEmail || undefined });
    sent++;
  }
  return sent;
}

async function scheduledReport(tenant: any, s: ICrmSettings) {
  const r = s.reports;
  if (!r.enabled || !r.recipients.length || localHour() < r.hour) return;
  if (r.frequency === "weekly" && localWeekday() !== r.weekday) return;
  const key = localDateKey();
  if (r.lastSentKey === key) return;
  const claimed = await CrmSettings.updateOne({ _id: s._id, "reports.lastSentKey": { $ne: key } }, { $set: { "reports.lastSentKey": key } });
  if (!claimed.modifiedCount) return;
  await sendSummary(tenant, s);
}

/** Empty the recycle bin of leads deleted longer ago than the setting allows. */
async function emptyOldTrash(tenant: any, s: ICrmSettings) {
  const old = await LeadTrash.find({ tenant, deletedAt: { $lt: new Date(Date.now() - (s.trashDays || 30) * 24 * 60 * MIN) } }).limit(50);
  if (!old.length) return;
  const { purgeTrash } = await import("../routes/crm2");
  for (const t of old) await purgeTrash(t);
}

const IM_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** IndiaMART wants "07-Oct-2026 14:30:00" in India time. */
const imTime = (d: Date) => { const t = new Date(d.getTime() + 330 * MIN); const p = (n: number) => String(n).padStart(2, "0"); return `${p(t.getUTCDate())}-${IM_MONTHS[t.getUTCMonth()]}-${t.getUTCFullYear()} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}:${p(t.getUTCSeconds())}`; };

/** Fetch new enquiries from IndiaMART (their Lead Manager "Pull API"), at most every 10 minutes. */
async function indiamartPull(tenant: any, s: ICrmSettings) {
  const p = s.portals;
  if (!p?.indiamartEnabled || !p.indiamartKey) return;
  const last = p.indiamartLastPull ? new Date(p.indiamartLastPull).getTime() : Date.now() - 24 * 60 * MIN;
  if (Date.now() - last < 10 * MIN) return;
  const from = new Date(Math.max(last - 2 * MIN, Date.now() - 7 * 24 * 60 * MIN)); // their window is 7 days at most
  const to = new Date();
  let error = "";
  try {
    const url = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${encodeURIComponent(decryptSecret(p.indiamartKey))}&start_time=${encodeURIComponent(imTime(from))}&end_time=${encodeURIComponent(imTime(to))}`;
    const out: any = await (await fetch(url)).json();
    if (Number(out?.CODE) !== 200) error = String(out?.MESSAGE || out?.STATUS || "IndiaMART refused the request").slice(0, 200);
    for (const row of Array.isArray(out?.RESPONSE) ? out.RESPONSE : []) {
      await captureEnquiry(tenant, {
        name: row.SENDER_NAME, phone: row.SENDER_MOBILE, email: row.SENDER_EMAIL, city: row.SENDER_CITY, state: row.SENDER_STATE,
        course: row.QUERY_PRODUCT_NAME, message: row.QUERY_MESSAGE,
      }, "IndiaMART", { source: "IndiaMART", user: "IndiaMART" }).catch(() => undefined);
    }
  } catch (e: any) {
    error = String(e?.message || e).slice(0, 200);
  }
  // on an error the window is kept, so the same period is asked for again next time
  await CrmSettings.updateOne({ _id: s._id }, { $set: { "portals.indiamartLastError": error, ...(error ? {} : { "portals.indiamartLastPull": to }) } });
}

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    await runDueAutomation();
    for (const t of await Tenant.find().select("_id").lean()) {
      const s = await crmSettingsFor(t._id);
      for (const job of [followUpReminders, morningDigest, firstResponseSla, scoreDecay, scheduledReport, emptyOldTrash, indiamartPull, pollInbox, pullPortals, syncGoogle]) {
        await job(t._id, s).catch((e) => console.error(`[crm] ${job.name} failed:`, e?.message || e));
      }
    }
    await runDueCampaigns().catch((e) => console.error("[crm] scheduled campaigns failed:", e?.message || e));
  } catch (e: any) {
    console.error("[crm] scheduler error:", e?.message || e);
  } finally {
    running = false;
  }
}

let started = false;
/** Reminders, first-response alerts, drip steps, score decay and scheduled reports. Call once at server start. */
export function startCrmEngine() {
  if (started) return;
  started = true;
  setInterval(tick, MIN).unref?.();
  setTimeout(tick, 15_000).unref?.();
  console.log("[crm] lead engine started (every 60s)");
}
