import { Types } from "mongoose";
import { Lead, ILead, phoneKeyOf } from "../models/Lead";
import { LeadActivity, ActivityType } from "../models/LeadActivity";
import { FollowUp } from "../models/FollowUp";
import { LeadStatus, SubStatus, LeadSource } from "../models/Masters";
import { Conversation } from "../models/Messaging";
import { User } from "../models/User";
import { ApiError, audit } from "../utils/http";
import { applyLeadAssignment } from "./workflowEngine";
import { fireAlerts } from "./alertsEngine";
import { daysFromNow } from "../utils/dates";
import { crmSettingsFor } from "../models/CrmExtras";
import { Partner, WebVisit } from "../models/CrmMore";

const addDays = daysFromNow;

export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Strip spaces, dashes and brackets; keep a leading "+". */
export const cleanPhone = (phone: unknown) => {
  const raw = String(phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  return raw.startsWith("+") ? `+${digits}` : digits;
};

export const isValidPhone = (phone: unknown) => {
  const n = String(phone ?? "").replace(/\D/g, "").length;
  return n >= 7 && n <= 15;
};

export const isValidEmail = (email: unknown) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));

/** Add an entry to a lead's timeline. Never lets logging break the request. */
export async function logActivity(a: {
  tenant: any;
  lead: any;
  type: ActivityType;
  title: string;
  detail?: string;
  by?: string;
  meta?: Record<string, any>;
  at?: Date;
}) {
  try {
    await LeadActivity.create({ ...a, by: a.by || "System", at: a.at || new Date() });
  } catch (e) {
    console.error("[leadService] logActivity failed:", e);
  }
}

/** The same person already in the system (matched on the last 10 digits of the phone). */
export async function findLeadByPhone(tenant: any, phone: unknown, excludeId?: any) {
  const key = phoneKeyOf(phone);
  if (key.length < 7) return null;
  const filter: any = { tenant, $or: [{ phoneKey: key }, { phone: cleanPhone(phone) }] };
  if (excludeId) filter._id = { $ne: excludeId };
  return Lead.findOne(filter);
}

/** The same person by phone — or by email too, when CRM Settings says an email match is a duplicate. */
export async function findDuplicateLead(tenant: any, phone: unknown, email?: string, excludeId?: any) {
  const byPhone = await findLeadByPhone(tenant, phone, excludeId);
  if (byPhone) return byPhone;
  const s = await crmSettingsFor(tenant);
  const not = excludeId ? { _id: { $ne: excludeId } } : {};
  // the number may be saved as someone's alternate number
  if (s.duplicates?.matchAltPhone) {
    const key = phoneKeyOf(phone);
    if (key.length >= 7) {
      const byAlt = await Lead.findOne({ tenant, ...not, altPhone: new RegExp(`${key}$`) });
      if (byAlt) return byAlt;
    }
  }
  if (!email || !s.duplicates?.matchEmail) return null;
  return Lead.findOne({ tenant, ...not, email: String(email).trim().toLowerCase() });
}

export type Channel = "whatsapp" | "sms" | "email" | "call";
/** Has this person asked not to be contacted on this channel? */
export const blockedOn = (lead: Pick<ILead, "doNotContact">, channel: Channel) => !!lead.doNotContact?.[channel];

/** "98XXXXXX10" / "a•••@example.com" — what a role with hidden contacts sees. */
export const maskPhone = (p: unknown) => { const d = String(p || "").replace(/\D/g, ""); return d.length < 6 ? "••••" : `${d.slice(0, 2)}${"X".repeat(d.length - 4)}${d.slice(-2)}`; };
export const maskEmail = (e: unknown) => { const [n, dom] = String(e || "").split("@"); return dom ? `${n.slice(0, 1)}•••@${dom}` : ""; };
/** Hide contact details on lead-like records for a user whose role masks them. */
export function maskContacts<T>(req: { maskContacts?: boolean; leadFieldRules?: { hidden: string[]; readOnly: string[] } }, rows: T): T {
  const hidden = req.leadFieldRules?.hidden || [];
  if (!req.maskContacts && !hidden.length) return rows;
  const one = (r: any): any => {
    if (!r || typeof r !== "object") return r;
    const o = typeof r.toObject === "function" ? r.toObject() : { ...r };
    if (req.maskContacts) {
      if (o.phone) o.phone = maskPhone(o.phone);
      if (o.altPhone) o.altPhone = maskPhone(o.altPhone);
      if (o.email) o.email = maskEmail(o.email);
      o.contactsHidden = true;
    }
    // fields the role may not see are removed, not blanked — the screen then leaves them out
    for (const f of hidden) delete o[f];
    if (hidden.length) o.hiddenFields = hidden;
    if (o.lead && typeof o.lead === "object" && o.lead.phone) o.lead = one(o.lead);
    return o;
  };
  return (Array.isArray(rows) ? rows.map(one) : one(rows)) as T;
}

/** Leads saved before phoneKey existed get one, so duplicate checks see them. */
export async function backfillLeadKeys() {
  const missing = await Lead.find({ $or: [{ phoneKey: { $exists: false } }, { phoneKey: "" }] }).select("phone").lean();
  if (!missing.length) return;
  await Lead.bulkWrite(
    missing.map((l: any) => ({ updateOne: { filter: { _id: l._id }, update: { $set: { phoneKey: phoneKeyOf(l.phone) } } } }))
  );
  console.log(`[leads] phone keys added to ${missing.length} lead(s)`);
}

/** Leads saved before scoring existed get their score, priority and next follow-up worked out once. */
export async function backfillLeadScores() {
  const old = await Lead.find({ priority: { $exists: false } }).select("_id").lean();
  for (const l of old) await refreshLead(l._id).catch(() => undefined);
  if (old.length) console.log(`[leads] scored ${old.length} existing lead(s)`);
}

/** Names a lead may be assigned to: the tenant's active users. */
export async function assignableOwners(tenant: any): Promise<string[]> {
  const users = await User.find({ tenant, status: "Active", pmClient: { $in: [null, undefined] } }).select("name").lean();
  return users.map((u: any) => u.name).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b));
}

const ENGAGEMENT: ActivityType[] = ["call", "message", "note", "followup_done", "enquiry"];

/**
 * Bring a lead's derived fields up to date: next follow-up (from its open
 * follow-ups), score (0–100) and priority. Call after anything that changes
 * the lead's status, follow-ups or activity.
 */
export async function refreshLead(leadOrId: any): Promise<ILead | null> {
  const lead: ILead | null = leadOrId?.save ? leadOrId : await Lead.findById(leadOrId);
  if (!lead) return null;
  const tenant = lead.tenant;

  const [statuses, engagement, nextOpen, lastDone] = await Promise.all([
    LeadStatus.find({ tenant }).select("order isWon isLost").lean(),
    LeadActivity.countDocuments({ tenant, lead: lead._id, type: { $in: ENGAGEMENT } }),
    FollowUp.findOne({ tenant, lead: lead._id, done: false }).sort({ due: 1 }).lean(),
    FollowUp.findOne({ tenant, lead: lead._id, done: true }).sort({ completedAt: -1, updatedAt: -1 }).lean(),
  ]);

  // follow-up fields mirror the earliest open follow-up
  lead.nextFollowUp = nextOpen?.due || null;
  lead.nextFollowUpDate = nextOpen?.due || null;
  lead.nextFollowUpType = nextOpen?.type || "";
  lead.nextRemark = nextOpen?.note || nextOpen?.remark || "";
  if (lastDone) {
    lead.currentRemark = lastDone.completionNote || lastDone.outcome || lastDone.note || "";
    lead.lastFollowUpType = lastDone.type;
  }

  const current: any = statuses.find((s: any) => String(s._id) === String(lead.status));
  let score = 0;
  if (current?.isWon) {
    score = 100;
  } else {
    if (lead.email) score += 5;
    if (lead.course) score += 5;
    if (lead.city) score += 3;
    if (lead.source) score += 2;
    if (!current?.isLost) {
      const ranks = [...new Set(statuses.filter((s: any) => !s.isLost).map((s: any) => s.order))].sort((a, b) => a - b);
      const idx = ranks.indexOf(current?.order ?? ranks[0]);
      if (ranks.length > 1 && idx > 0) score += Math.round((idx / (ranks.length - 1)) * 30);
      score += Math.min(25, engagement * 5);
      const idleDays = (Date.now() - new Date(lead.lastActivity || Date.now()).getTime()) / 86_400_000;
      score += idleDays <= 2 ? 20 : idleDays <= 7 ? 12 : idleDays <= 14 ? 6 : 0;
      if (nextOpen) score += new Date(nextOpen.due).getTime() >= Date.now() ? 10 : -10;
    }
  }
  lead.score = Math.max(0, Math.min(100, score));
  if (!lead.priorityManual) lead.priority = lead.score >= 70 ? "hot" : lead.score >= 40 ? "warm" : "cold";

  await lead.save();
  return lead;
}

export interface NewLeadInput {
  tenant: any;
  name: string;
  phone: string;
  email?: string;
  sourceKeyOrId?: string;
  owner?: string;
  course?: string;
  contactId?: any;
  user?: string;
  city?: string;
  state?: string;
  country?: string;
  grade?: string;
  altPhone?: string;
  value?: number;
  tags?: string[];
  statusId?: string;
  utm?: Record<string, string>;
  capturedFrom?: string;
  note?: string;
  /** how the lead arrived, for the timeline ("imported", …) */
  via?: ActivityType;
  /** skip the automatic first follow-up (bulk import) */
  skipFollowUp?: boolean;
  branch?: string;
  /** referral partner's code (?ref=CODE on a link) */
  partnerCode?: string;
  /** id from the website tracking script */
  visitorId?: string;
  /** typed in by a user (not captured from a form, portal or call) */
  manual?: boolean;
}

async function resolveSource(tenant: any, keyOrId?: string) {
  if (!keyOrId) return null;
  const key = String(keyOrId).trim();
  if (Types.ObjectId.isValid(key)) {
    const byId = await LeadSource.findOne({ _id: key, tenant });
    if (byId) return byId;
  }
  return LeadSource.findOne({ tenant, name: new RegExp(escapeRegex(key), "i") });
}

/**
 * Create a lead — or, when the same phone is already a lead, record the new
 * enquiry on the existing one instead of making a duplicate.
 */
export async function convertToLead(opts: NewLeadInput) {
  const { tenant } = opts;
  const name = String(opts.name || "").trim();
  const phone = cleanPhone(opts.phone);
  if (!name) throw new ApiError(400, "Name is required");
  if (!isValidPhone(phone)) throw new ApiError(400, "Enter a valid phone number");
  const email = String(opts.email || "").trim().toLowerCase();
  if (email && !isValidEmail(email)) throw new ApiError(400, "Enter a valid email address");

  const dupRule = (await crmSettingsFor(tenant)).duplicates?.action || "enquiry";
  const existing = dupRule === "allow" && opts.manual ? null : await findDuplicateLead(tenant, phone, email);
  if (existing && dupRule === "block" && opts.manual) throw new ApiError(409, `${existing.name} is already a lead with this ${phoneKeyOf(existing.phone) === phoneKeyOf(phone) ? "phone number" : "contact"}`);
  if (existing) {
    existing.enquiryCount = (existing.enquiryCount || 1) + 1;
    existing.lastActivity = new Date();
    if (!existing.email && email) existing.email = email;
    if (!existing.course && opts.course) existing.course = opts.course;
    await existing.save();
    await logActivity({
      tenant, lead: existing._id, type: "enquiry", title: "Enquired again", by: opts.user,
      detail: [opts.capturedFrom, opts.course].filter(Boolean).join(" · "),
    });
    await refreshLead(existing);
    return { lead: existing, created: false };
  }

  const firstStatus = opts.statusId
    ? await LeadStatus.findOne({ _id: opts.statusId, tenant })
    : await LeadStatus.findOne({ tenant }).sort({ order: 1, createdAt: 1 });
  if (!firstStatus) throw new ApiError(400, "No lead statuses are set up yet. Add one in Setup.");
  const firstSub = await SubStatus.findOne({ tenant, status: firstStatus._id });
  const source = await resolveSource(tenant, opts.sourceKeyOrId);

  const partner = opts.partnerCode ? await Partner.findOne({ tenant, code: String(opts.partnerCode).trim().toUpperCase(), active: true }) : null;
  const closed = firstStatus.isWon || firstStatus.isLost;
  const due = opts.skipFollowUp || closed ? null : addDays(1);
  const lead = await Lead.create({
    tenant,
    name,
    phone,
    email: email || undefined,
    altPhone: opts.altPhone ? cleanPhone(opts.altPhone) : "",
    contact: opts.contactId || undefined,
    status: firstStatus._id,
    subStatus: firstSub?._id || null,
    source: source?._id,
    owner: opts.owner || "Unassigned",
    course: opts.course,
    city: opts.city || "",
    state: opts.state || "",
    country: opts.country || "",
    grade: opts.grade || "",
    value: Number(opts.value) || 0,
    tags: (opts.tags || []).map((t) => String(t).trim()).filter(Boolean),
    utm: opts.utm || {},
    capturedFrom: opts.capturedFrom || "",
    branch: opts.branch || "",
    partner: partner?._id || null,
    visitorId: opts.visitorId || "",
    nextFollowUp: due,
    lastActivity: new Date(),
    statusChangedAt: new Date(),
    notes: opts.note ? [{ text: opts.note, by: opts.user || "System", at: new Date() }] : [],
  });

  await logActivity({
    tenant, lead: lead._id, type: opts.via || "created", by: opts.user,
    title: opts.via === "imported" ? "Imported" : "Lead created",
    detail: [source?.name, opts.capturedFrom, partner && `Referred by ${partner.name}`].filter(Boolean).join(" · "),
  });
  // pages this person looked at on the website before enquiring
  if (opts.visitorId) {
    const seen = await WebVisit.updateMany({ tenant, visitor: opts.visitorId, lead: null }, { $set: { lead: lead._id } });
    if (seen.modifiedCount) await logActivity({ tenant, lead: lead._id, type: "visit", title: `Viewed ${seen.modifiedCount} page${seen.modifiedCount === 1 ? "" : "s"} on the website`, by: "Website" });
  }

  // no owner chosen → let the assignment workflow pick one
  if (!opts.owner || opts.owner === "Unassigned") await applyLeadAssignment(lead, tenant);

  if (due) {
    await FollowUp.create({
      tenant,
      lead: lead._id,
      leadName: lead.name,
      phone: lead.phone,
      due,
      dueDate: due,
      type: "Call",
      note: "First contact",
      owner: lead.owner,
      assignedTo: lead.owner,
      status: firstStatus._id,
    });
  }

  await Conversation.updateOne({ tenant, phone: opts.phone }, { $set: { lead: lead._id } });
  await refreshLead(lead);
  await fireAlerts("lead.created", lead, tenant, opts.user);
  await audit({ tenant, user: opts.user, action: "CONVERT", module: "Leads", entity: lead.name, next: "New lead" });
  return { lead, created: true };
}

/** Change a lead's status, applying the follow-up-required master rule. */
export async function changeLeadStatus(opts: {
  tenant: any;
  leadId: string;
  statusId: string;
  subStatusId?: string | null;
  lostReason?: string;
  user?: string;
}) {
  const { tenant, leadId, statusId } = opts;
  const lead = await Lead.findOne({ _id: leadId, tenant });
  if (!lead) throw new ApiError(404, "Lead not found");

  const nextStatus = await LeadStatus.findOne({ _id: statusId, tenant });
  if (!nextStatus) throw new ApiError(404, "Status not found");
  const prevStatus = await LeadStatus.findById(lead.status);
  let sub: any = null;
  if (opts.subStatusId) {
    sub = await SubStatus.findOne({ _id: opts.subStatusId, tenant, status: nextStatus._id });
    if (!sub) throw new ApiError(400, "That sub-status does not belong to this status");
  }

  const changed = String(lead.status) !== String(nextStatus._id);
  lead.status = nextStatus._id as any;
  lead.subStatus = sub?._id || null;
  lead.lastActivity = new Date();
  if (changed) lead.statusChangedAt = new Date();
  lead.lostReason = nextStatus.isLost ? String(opts.lostReason || lead.lostReason || "").trim() : "";

  if (nextStatus.isWon || nextStatus.isLost) {
    await FollowUp.updateMany(
      { tenant, lead: lead._id, done: false },
      { $set: { done: true, completedAt: new Date(), outcome: nextStatus.isWon ? "Won" : "Closed" } }
    );
  } else if (nextStatus.followUpRequired === "Yes" && !(await FollowUp.exists({ tenant, lead: lead._id, done: false }))) {
    const due = addDays(2, 11);
    await FollowUp.create({
      tenant,
      lead: lead._id,
      leadName: lead.name,
      phone: lead.phone,
      due,
      dueDate: due,
      type: "Call",
      note: "Follow-up for " + nextStatus.name,
      owner: lead.owner,
      assignedTo: lead.owner,
      status: nextStatus._id,
    });
  }

  await lead.save();
  if (changed || sub) {
    await logActivity({
      tenant, lead: lead._id, type: "status", by: opts.user,
      title: `Status: ${prevStatus?.name || "—"} → ${nextStatus.name}`,
      detail: [sub?.name, lead.lostReason && `Reason: ${lead.lostReason}`].filter(Boolean).join(" · "),
      meta: { from: prevStatus?._id, to: nextStatus._id },
    });
  }
  await refreshLead(lead);
  if (changed) await fireAlerts("lead.status_changed", lead, tenant, opts.user);
  if (changed && nextStatus.isWon) await fireAlerts("lead.won", lead, tenant, opts.user);
  if (changed && nextStatus.isLost) await fireAlerts("lead.lost", lead, tenant, opts.user);

  await audit({
    tenant,
    user: opts.user,
    action: "STATUS",
    module: "Leads",
    entity: lead.name,
    prev: prevStatus?.name,
    next: nextStatus.name,
  });
  return lead;
}

/** Hand a lead to another owner; its open follow-ups move with it. */
export async function assignLead(opts: { tenant: any; lead: ILead; owner: string; user?: string; silent?: boolean }) {
  const { tenant, lead } = opts;
  const owner = String(opts.owner || "").trim() || "Unassigned";
  const prev = lead.owner || "Unassigned";
  if (owner === prev) return lead;
  if (owner !== "Unassigned" && !(await assignableOwners(tenant)).includes(owner)) {
    throw new ApiError(400, `${owner} is not an active user`);
  }
  lead.owner = owner;
  lead.lastActivity = new Date();
  lead.serviceTracks.forEach((t) => { if (!t.owner || t.owner === prev) t.owner = owner; });
  await lead.save();
  await FollowUp.updateMany({ tenant, lead: lead._id, done: false }, { $set: { owner, assignedTo: owner } });
  await logActivity({ tenant, lead: lead._id, type: "assigned", by: opts.user, title: `Assigned to ${owner}`, detail: `Was ${prev}` });
  if (!opts.silent) {
    await fireAlerts("lead.assigned", lead, tenant, opts.user);
    await audit({ tenant, user: opts.user, action: "ASSIGN", module: "Leads", entity: lead.name, prev, next: owner });
  }
  return lead;
}

/** A message went out to this phone / email: put it on the matching lead's timeline. */
export async function noteLeadMessaged(tenant: any, to: string, channel: string, by?: string, detail?: string) {
  try {
    const lead = to.includes("@")
      ? await Lead.findOne({ tenant, email: String(to).trim().toLowerCase() })
      : await findLeadByPhone(tenant, to);
    if (!lead) return;
    const now = new Date();
    if (!lead.firstContactedAt) lead.firstContactedAt = now;
    lead.lastContactedAt = now;
    lead.lastActivity = now;
    await lead.save();
    await logActivity({
      tenant, lead: lead._id, type: "message", by,
      title: `${channel === "email" ? "Email" : channel === "sms" ? "SMS" : "WhatsApp"} sent`, detail: String(detail || "").slice(0, 300), meta: { channel },
    });
    await refreshLead(lead);
  } catch (e) {
    console.error("[leadService] noteLeadMessaged failed:", e);
  }
}
