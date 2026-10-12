import { Types } from "mongoose";
import { ILead, Lead, LEAD_PRIORITIES } from "../models/Lead";
import { Workflow, ICondition, IAction, IWorkflow } from "../models/Workflow";
import { FollowUp } from "../models/FollowUp";
import { LeadStatus } from "../models/Masters";
import { User } from "../models/User";
import { AutomationJob, AutomationRun } from "../models/CrmExtras";
import { sendText, sendTemplate } from "./whatsapp";
import { sendEmail } from "./email";
import { sendSms } from "./crmChannels";
import { notify } from "./pm/messages";
import { assignLead, logActivity, refreshLead } from "./leadService";
import { trackedHtml } from "./emailTracking";

/**
 * Lead automation. A workflow (type "Alert") listens for one event; when its
 * conditions match the lead, its actions run — at once, or after each action's
 * own delay (a drip sequence). Every action is written to the run log.
 */
export async function fireAlerts(event: string, lead: ILead, tenantId: any, user?: string): Promise<void> {
  try {
    const workflows = await Workflow.find({ tenant: tenantId, type: "Alert", active: true, event });
    for (const workflow of workflows) {
      if (!evaluateConditions(lead, workflow.conditions || [])) continue;
      for (const action of workflow.actions || []) {
        const delay = Math.max(0, Number(action.delayMinutes) || 0);
        if (delay > 0) {
          await AutomationJob.create({
            tenant: tenantId, workflow: workflow._id, lead: lead._id,
            action: { kind: action.kind, params: action.params || {} }, runAt: new Date(Date.now() + delay * 60_000),
          });
        } else {
          await runAction(workflow, action, lead, tenantId, event);
        }
      }
    }
  } catch (err) {
    console.error("[automation] fireAlerts error:", err);
  }
}

/** Run the delayed steps whose time has come. Called by the scheduler. */
export async function runDueAutomation(limit = 50) {
  const due = await AutomationJob.find({ status: "pending", runAt: { $lte: new Date() } }).sort({ runAt: 1 }).limit(limit);
  for (const job of due) {
    // claim it first, so a second server never runs the same step
    const claimed = await AutomationJob.findOneAndUpdate({ _id: job._id, status: "pending" }, { $set: { status: "done" } });
    if (!claimed) continue;
    const [workflow, lead] = await Promise.all([Workflow.findById(job.workflow), Lead.findById(job.lead)]);
    // the rule was switched off or the lead is gone / closed since: drop the step
    const status: any = lead ? await LeadStatus.findById(lead.status).select("isWon isLost").lean() : null;
    if (!workflow || !workflow.active || !lead || status?.isLost) {
      await AutomationJob.updateOne({ _id: job._id }, { $set: { status: "skipped" } });
      continue;
    }
    const ok = await runAction(workflow, job.action as IAction, lead, job.tenant, "scheduled step");
    if (!ok) await AutomationJob.updateOne({ _id: job._id }, { $set: { status: "failed" } });
  }
}

async function runAction(workflow: IWorkflow, action: IAction, lead: ILead, tenantId: any, event: string): Promise<boolean> {
  let ok = true;
  let detail = "";
  try {
    detail = await executeAction(action, lead, tenantId);
  } catch (err: any) {
    ok = false;
    detail = String(err?.message || err).slice(0, 300);
    console.error(`[automation] ${workflow.name} → ${action.kind} failed:`, detail);
  }
  await AutomationRun.create({ tenant: tenantId, workflow: workflow._id, workflowName: workflow.name, lead: lead._id, leadName: lead.name, event, action: action.kind, ok, detail }).catch(() => undefined);
  if (ok) await logActivity({ tenant: tenantId, lead: lead._id, type: "automation", by: "Automation", title: `${workflow.name}: ${LABELS[action.kind] || action.kind}`, detail });
  return ok;
}

const LABELS: Record<string, string> = {
  whatsapp: "WhatsApp sent", email: "Email sent", sms: "SMS sent", notify: "Owner notified", followup: "Follow-up created",
  status: "Status changed", assign_lead: "Lead assigned", tag: "Tag added", priority: "Priority set",
};

/* ───────────── conditions ───────────── */

function evaluateConditions(lead: ILead, conditions: ICondition[]): boolean {
  if (!conditions || conditions.length === 0) return true;
  // "and" binds tighter than "or": split into OR-groups, each of which must fully match.
  // A condition's `logic` joins it to the one after it.
  let group = true;
  for (let i = 0; i < conditions.length; i++) {
    group = group && evaluateCondition(lead, conditions[i]);
    const last = i === conditions.length - 1;
    if (last || conditions[i].logic === "or") {
      if (group) return true;
      group = true;
    }
  }
  return false;
}

/** Compare text without caring about case or stray spaces; ids and numbers pass through as strings. */
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const list = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map(norm).filter(Boolean);

function evaluateCondition(lead: ILead, cond: ICondition): boolean {
  const fieldValue = getFieldValue(lead, cond.field);
  const mine = Array.isArray(fieldValue) ? fieldValue.map(norm) : [norm(fieldValue)];
  switch (cond.operator) {
    case "equals": return mine.includes(norm(cond.value));
    case "not_equals": return !mine.includes(norm(cond.value));
    case "contains": return mine.some((v) => v.includes(norm(cond.value)));
    case "in": return list(cond.value).some((v) => mine.includes(v));
    case "not_in": return !list(cond.value).some((v) => mine.includes(v));
    case "is_empty": return mine.every((v) => !v);
    case "is_not_empty": return mine.some((v) => !!v);
    case "gt": return Number(fieldValue) > Number(cond.value);
    case "lt": return Number(fieldValue) < Number(cond.value);
    default: return false;
  }
}

function getFieldValue(lead: ILead, field: string): any {
  switch (field) {
    case "source": return lead.source?.toString();
    case "status": return lead.status?.toString();
    case "subStatus": return lead.subStatus?.toString();
    case "service": return (lead.serviceTracks || []).map((t) => String(t.service));
    case "name": case "phone": case "email": case "state": case "city": case "score": case "tags":
    case "owner": case "course": case "grade": case "priority": case "value":
      return (lead as any)[field];
    default: return null;
  }
}

/* ───────────── actions ───────────── */

/** {{name}}, {{course}}, {{owner}} … in a message become the lead's own details. */
export function fillLeadText(text: unknown, lead: ILead): string {
  const first = String(lead.name || "").trim().split(/\s+/)[0] || "";
  const vars: Record<string, string> = {
    name: lead.name || "", first_name: first, phone: lead.phone || "", email: lead.email || "", course: lead.course || "",
    city: lead.city || "", grade: lead.grade || "", owner: lead.owner && lead.owner !== "Unassigned" ? lead.owner : "our team",
  };
  return String(text ?? "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** The lead's owner as a user (leads carry the owner's name), plus their manager when asked. */
async function ownerUsers(tenantId: any, lead: ILead, alsoManager = false): Promise<any[]> {
  const owner: any = lead.owner && lead.owner !== "Unassigned" ? await User.findOne({ tenant: tenantId, name: lead.owner, status: "Active" }).select("_id reportingManager").lean() : null;
  return owner ? [owner._id, alsoManager ? owner.reportingManager : null].filter(Boolean) : [];
}

async function executeAction(action: IAction, lead: ILead, tenantId: any): Promise<string> {
  const params = action.params || {};
  switch (action.kind) {
    case "whatsapp":
      if (lead.doNotContact?.whatsapp) throw new Error("The lead asked not to be contacted on WhatsApp");
      if (params.template) { await sendTemplate(tenantId, lead.phone, params.template, params.language || "en", (params.bodyParams || []).map((p: any) => fillLeadText(p, lead))); return `Template ${params.template}`; }
      if (params.message) { const msg = fillLeadText(params.message, lead); await sendText(tenantId, lead.phone, msg); return msg.slice(0, 200); }
      throw new Error("No WhatsApp template or message set");

    case "email": {
      if (!lead.email) throw new Error("The lead has no email address");
      if (lead.doNotContact?.email) throw new Error("The lead asked not to be contacted by email");
      const body = fillLeadText(params.template || params.message, lead);
      if (!body) throw new Error("No email text set");
      const subject = fillLeadText(params.subject || "A message for you", lead);
      await sendEmail({ to: lead.email, subject, html: await trackedHtml(tenantId, lead._id, subject, body.replace(/\n/g, "<br>")), text: body });
      return subject;
    }

    case "sms": {
      const msg = fillLeadText(params.message, lead);
      if (!msg) throw new Error("No SMS text set");
      if (lead.doNotContact?.sms) throw new Error("The lead asked not to be contacted by SMS");
      await sendSms(tenantId, lead.phone, msg, params.templateId);
      return msg.slice(0, 200);
    }

    case "notify": {
      const users = await ownerUsers(tenantId, lead, !!params.alsoManager);
      if (!users.length) throw new Error("The lead has no owner to notify");
      const title = fillLeadText(params.message || "Check on {{name}}", lead);
      await notify({ tenantId, users, category: "crm_lead", title, body: lead.phone, link: `/crm/leads?lead=${lead._id}` });
      return title;
    }

    case "followup": {
      const due = new Date(Date.now() + (Number(params.daysFromNow) || 1) * 86_400_000);
      await FollowUp.create({
        tenant: tenantId, lead: lead._id, leadName: lead.name, phone: lead.phone, due, dueDate: due,
        type: params.type || "Call", note: fillLeadText(params.note || "Follow up", lead), owner: lead.owner, assignedTo: lead.owner, status: lead.status,
      });
      await refreshLead(lead);
      return `${params.type || "Call"} in ${Number(params.daysFromNow) || 1} day(s)`;
    }

    case "status": {
      // written directly (not via changeLeadStatus) so a status rule cannot trigger itself in a loop
      const st: any = params.statusId ? await LeadStatus.findOne({ _id: params.statusId, tenant: tenantId }).lean() : null;
      if (!st) throw new Error("The status in this rule no longer exists");
      lead.status = st._id;
      lead.subStatus = params.subStatusId || null;
      lead.statusChangedAt = new Date();
      lead.lastActivity = new Date();
      await lead.save();
      await refreshLead(lead);
      return st.name;
    }

    case "assign_lead": {
      // the rule stores a user id (or, in older rules, a name); leads carry the owner's name
      const isId = Types.ObjectId.isValid(String(params.userId));
      const u: any = isId ? await User.findOne({ _id: params.userId, tenant: tenantId }).select("name").lean() : null;
      const owner = u?.name || (isId ? "" : String(params.userId || ""));
      if (!owner) throw new Error("The user in this rule no longer exists");
      await assignLead({ tenant: tenantId, lead, owner, user: "Automation", silent: true });
      return owner;
    }

    case "tag": {
      const tag = String(params.tag || "").trim();
      if (!tag) throw new Error("No tag set");
      await Lead.updateOne({ _id: lead._id }, { $addToSet: { tags: tag } });
      return tag;
    }

    case "priority": {
      if (!(LEAD_PRIORITIES as readonly string[]).includes(params.priority)) throw new Error("No priority set");
      await Lead.updateOne({ _id: lead._id }, { $set: { priority: params.priority, priorityManual: true } });
      return params.priority;
    }

    default:
      throw new Error(`Unknown action: ${action.kind}`);
  }
}
