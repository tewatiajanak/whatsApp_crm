import { Lead } from "../models/Lead";
import { FollowUp } from "../models/FollowUp";
import { LeadStatus } from "../models/Masters";
import { Service } from "../models/Service";
import { ApiError, audit } from "../utils/http";
import { daysFromNow } from "../utils/dates";
import { logActivity, refreshLead } from "./leadService";

const addDays = daysFromNow;

/** Statuses a service uses: the ones offered for it, plus those open to every service. */
const statusesFor = (tenant: any, serviceId: any) => ({
  tenant,
  $or: [{ offerings: serviceId }, { offerings: { $size: 0 } }, { offerings: { $exists: false } }],
});

/**
 * Add a service track to a lead (engage the lead in a service), or return the
 * existing one. Each track has its own status + follow-up.
 */
export async function addServiceTrack(opts: {
  tenant: any;
  leadId: string;
  serviceId: string;
  owner?: string;
  user?: string;
}) {
  const lead = await Lead.findOne({ _id: opts.leadId, tenant: opts.tenant });
  if (!lead) throw new ApiError(404, "Lead not found");
  const service = await Service.findOne({ _id: opts.serviceId, tenant: opts.tenant });
  if (!service) throw new ApiError(404, "Service not found");

  const existing = lead.serviceTracks.find((t) => String(t.service) === String(service._id));
  if (existing) return { lead, track: existing, created: false };

  // first status available to this service (its own, else a shared one)
  const firstStatus =
    (await LeadStatus.findOne({ tenant: opts.tenant, offerings: service._id }).sort({ order: 1 })) ||
    (await LeadStatus.findOne(statusesFor(opts.tenant, service._id)).sort({ order: 1 }));

  lead.serviceTracks.push({
    service: service._id as any,
    status: firstStatus?._id || null,
    owner: opts.owner || lead.owner,
    value: 0,
    nextFollowUp: null,
    isClosed: false,
    updatedAt: new Date(),
  });
  lead.lastActivity = new Date();
  await lead.save();

  await logActivity({ tenant: opts.tenant, lead: lead._id, type: "service", by: opts.user, title: `Added to ${service.name}`, detail: firstStatus?.name });
  await audit({ tenant: opts.tenant, user: opts.user, action: "ADD_SERVICE", module: "Leads", entity: lead.name, next: service.name });
  return { lead, track: lead.serviceTracks[lead.serviceTracks.length - 1], created: true };
}

/**
 * Change a lead's status WITHIN a specific service. Applies that status's
 * follow-up rule and schedules/clears a follow-up tagged to this service —
 * independently of every other service on the same lead.
 */
export async function setServiceStatus(opts: {
  tenant: any;
  leadId: string;
  serviceId: string;
  statusId: string;
  subStatusId?: string | null;
  user?: string;
}) {
  const lead = await Lead.findOne({ _id: opts.leadId, tenant: opts.tenant });
  if (!lead) throw new ApiError(404, "Lead not found");

  const service = await Service.findOne({ _id: opts.serviceId, tenant: opts.tenant });
  if (!service) throw new ApiError(404, "Service not found");

  let track = lead.serviceTracks.find((t) => String(t.service) === String(opts.serviceId));
  if (!track) {
    // auto-create the track if missing
    lead.serviceTracks.push({ service: opts.serviceId as any, status: null, owner: lead.owner, value: 0, nextFollowUp: null, isClosed: false, updatedAt: new Date() });
    track = lead.serviceTracks[lead.serviceTracks.length - 1];
  }

  const nextStatus = await LeadStatus.findOne({ _id: opts.statusId, tenant: opts.tenant });
  if (!nextStatus) throw new ApiError(404, "Status not found");
  const prevStatus = track.status ? await LeadStatus.findById(track.status) : null;

  track.status = nextStatus._id as any;
  track.subStatus = (opts.subStatusId as any) || null;
  track.updatedAt = new Date();
  lead.lastActivity = new Date();

  if (nextStatus.isWon || nextStatus.isLost) {
    track.isClosed = true;
    track.nextFollowUp = null;
    // clear THIS service's open follow-ups only
    await FollowUp.updateMany(
      { tenant: opts.tenant, lead: lead._id, service: opts.serviceId, done: false },
      { $set: { done: true, completedAt: new Date(), outcome: nextStatus.isWon ? "Won" : "Closed" } }
    );
  } else {
    track.isClosed = false;
    const hasOpen = await FollowUp.exists({ tenant: opts.tenant, lead: lead._id, service: opts.serviceId, done: false });
    if (nextStatus.followUpRequired === "Yes" && !hasOpen) {
      const due = addDays(2, 11);
      track.nextFollowUp = due;
      await FollowUp.create({
        tenant: opts.tenant,
        lead: lead._id,
        service: opts.serviceId,
        leadName: lead.name,
        phone: lead.phone,
        due,
        type: "Call",
        note: `${service?.name || "Service"} — follow-up for ${nextStatus.name}`,
        dueDate: due,
        owner: track.owner || lead.owner,
        assignedTo: track.owner || lead.owner,
        status: nextStatus._id,
      });
    }
  }

  await lead.save();
  await logActivity({
    tenant: opts.tenant, lead: lead._id, type: "status", by: opts.user,
    title: `${service.name}: ${prevStatus?.name || "—"} → ${nextStatus.name}`,
  });
  await refreshLead(lead);
  await audit({
    tenant: opts.tenant, user: opts.user, action: "SERVICE_STATUS", module: "Leads",
    entity: `${lead.name} · ${service?.name || ""}`,
    prev: prevStatus?.name, next: nextStatus.name,
  });
  return lead;
}

/** Remove a service track from a lead (and its open follow-ups). */
export async function removeServiceTrack(opts: { tenant: any; leadId: string; serviceId: string; user?: string }) {
  const lead = await Lead.findOne({ _id: opts.leadId, tenant: opts.tenant });
  if (!lead) throw new ApiError(404, "Lead not found");
  lead.serviceTracks = lead.serviceTracks.filter((t) => String(t.service) !== String(opts.serviceId)) as any;
  await lead.save();
  await FollowUp.updateMany({ tenant: opts.tenant, lead: lead._id, service: opts.serviceId, done: false }, { $set: { done: true, completedAt: new Date(), outcome: "Service removed" } });
  await refreshLead(lead);
  return lead;
}
