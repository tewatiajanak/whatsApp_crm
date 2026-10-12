import { Types } from "mongoose";
import { Lead, ILead } from "../models/Lead";
import { LeadStatus } from "../models/Masters";
import { crmSettingsFor } from "../models/CrmExtras";
import { tzOffsetMin } from "../utils/dates";
import { Workflow, IAssignmentRule } from "../models/Workflow";
import { Team } from "../models/Team";

const same = (a: unknown, b: unknown) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/**
 * Pick an owner for a new lead from the active assignment workflow and write
 * the owner's name on the lead. Leaves the lead untouched when no rule matches.
 */
export async function applyLeadAssignment(lead: ILead, tenantId: string, opts: { exclude?: string } = {}): Promise<void> {
  try {
    const workflow = await Workflow.findOne({ tenant: tenantId, type: "LeadAssignment", active: true });
    const rule = workflow?.assignmentRule;
    if (!workflow || !rule) return;

    const teamId = teamFor(lead, rule);
    if (!teamId) return;

    const owner = await nextInTeam(String(teamId), workflow._id, tenantId, opts.exclude);
    if (owner) {
      lead.owner = owner;
      await lead.save();
    }
  } catch (err) {
    console.error("[workflowEngine] applyLeadAssignment error:", err);
  }
}

function teamFor(lead: ILead, rule: IAssignmentRule) {
  switch (rule.strategy) {
    case "round_robin":
      return rule.teamId;
    case "source_wise_round_robin":
      return lead.source ? rule.sourceMap?.find((e) => String(e.source) === String(lead.source))?.team : null;
    case "state_wise":
      return lead.state ? rule.stateMap?.find((e) => same(e.state, lead.state))?.team : null;
    case "city_wise":
      return lead.city ? rule.cityMap?.find((e) => same(e.city, lead.city))?.team : null;
    case "grade_wise":
      return lead.grade ? rule.gradeMap?.find((e) => same(e.grade, lead.grade))?.team : null;
    default:
      return null;
  }
}

/** Round-robin through a team's active members; each team keeps its own turn counter. */
async function nextInTeam(teamId: string, workflowId: any, tenantId: string, exclude?: string): Promise<string | null> {
  const team: any = await Team.findOne({ _id: teamId, tenant: tenantId, active: { $ne: false } }).populate("members.user", "name status crmAway");
  let names: string[] = (team?.members || [])
    .map((m: any) => m.user)
    .filter((u: any) => u && u.status === "Active" && u.name && !u.crmAway && u.name !== exclude)
    .map((u: any) => u.name);
  if (!names.length) return null;

  const s = await crmSettingsFor(tenantId);
  // outside working hours nobody is picked: the lead waits, unassigned, for the morning
  if (s.assignment?.respectHours) {
    const hour = new Date(Date.now() + tzOffsetMin * 60_000).getUTCHours();
    if (hour < s.assignment.startHour || hour >= s.assignment.endHour) return null;
  }
  // people already holding their limit of open leads are passed over
  if (s.assignment?.maxOpenLeads > 0) {
    const closed = (await LeadStatus.find({ tenant: tenantId, $or: [{ isWon: true }, { isLost: true }] }).select("_id").lean()).map((x: any) => x._id);
    const load = await Lead.aggregate([
      { $match: { tenant: new Types.ObjectId(String(tenantId)), owner: { $in: names }, status: { $nin: closed } } },
      { $group: { _id: "$owner", n: { $sum: 1 } } },
    ]);
    names = names.filter((n) => (load.find((l: any) => l._id === n)?.n || 0) < s.assignment.maxOpenLeads);
    if (!names.length) return null;
  }

  // $inc is atomic, so two leads arriving together still get different owners
  const before: any = await Workflow.findByIdAndUpdate(workflowId, { $inc: { [`assignmentRule.rrByTeam.${teamId}`]: 1 } }).lean();
  const turn = Number(before?.assignmentRule?.rrByTeam?.[teamId] || 0);
  return names[turn % names.length];
}
