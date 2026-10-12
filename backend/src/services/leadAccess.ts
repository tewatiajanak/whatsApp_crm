import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { User } from "../models/User";
import { Lead } from "../models/Lead";
import { FollowUp } from "../models/FollowUp";
import { ApiError } from "../utils/http";
import { getVisibleEmployeeIds } from "./pm/visibility";

/**
 * Whose leads may this user see? Set per role (Roles → Lead visibility).
 *   null      — every lead
 *   string[]  — only leads owned by these names
 *
 * Own  = the user's own leads.
 * Team = the user, everyone below them, the teams they manage — and
 *        unassigned leads, so a manager can hand them out.
 */
export async function leadOwnerScope(req: Request): Promise<string[] | null> {
  const mode = req.leadVisibility || "all";
  if (mode === "all") return null;
  const cached = (req as any)._leadScope as string[] | undefined;
  if (cached) return cached;

  const ids = await getVisibleEmployeeIds(req, mode);
  if (ids === "all") return null;
  const users = await User.find({ tenant: req.tenantId, _id: { $in: ids } }).select("name").lean();
  const names = [...new Set([req.auth?.name, ...users.map((u: any) => u.name)].filter(Boolean))] as string[];
  if (mode === "team") names.push("Unassigned", "");
  (req as any)._leadScope = names;
  return names;
}

/** Narrow a lead filter to what the user may see. */
export async function scopeLeadFilter(req: Request, filter: Record<string, any>) {
  const names = await leadOwnerScope(req);
  if (names) filter.$and = [...(filter.$and || []), { owner: { $in: names } }];
  // a person tied to certain branches sees those branches' leads only
  if (req.leadBranches?.length) filter.$and = [...(filter.$and || []), { branch: { $in: req.leadBranches } }];
  return filter;
}

/** Same, for follow-ups: the ones on the user's plate, by owner or assignee. */
export async function scopeFollowUpFilter(req: Request, filter: Record<string, any>) {
  const names = await leadOwnerScope(req);
  if (names) filter.$and = [...(filter.$and || []), { $or: [{ owner: { $in: names } }, { assignedTo: { $in: names } }] }];
  return filter;
}

/** May this user open this lead? A lead outside their view simply does not exist for them. */
export async function canSeeLead(req: Request, leadId: unknown): Promise<boolean> {
  if (!Types.ObjectId.isValid(String(leadId))) return false;
  return !!(await Lead.exists(await scopeLeadFilter(req, { _id: leadId, tenant: req.tenantId })));
}

/** Route guard for /leads/:id… */
export const guardLead = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (!(await canSeeLead(req, req.params.id))) throw new ApiError(404, "Lead not found");
    next();
  } catch (e) {
    next(e);
  }
};

/** Route guard for /followups/:id… — allowed when the follow-up is theirs or its lead is in view. */
export const guardFollowUp = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const names = await leadOwnerScope(req);
    if (!names && !req.leadBranches?.length) return next();
    const fu = Types.ObjectId.isValid(req.params.id) ? await FollowUp.findOne({ _id: req.params.id, tenant: req.tenantId }).select("owner assignedTo lead").lean() : null;
    // with a branch limit the lead itself decides; otherwise being the owner / assignee is enough
    const mine = fu && ((!req.leadBranches?.length && names && (names.includes(fu.owner || "") || names.includes(fu.assignedTo || ""))) || (await canSeeLead(req, fu.lead)));
    if (!mine) throw new ApiError(404, "Follow-up not found");
    next();
  } catch (e) {
    next(e);
  }
};
