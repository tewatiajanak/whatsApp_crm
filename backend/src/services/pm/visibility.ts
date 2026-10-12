import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { User, PermAction } from "../../models/User";
import { Team } from "../../models/Team";
import { ApiError } from "../../utils/http";

/**
 * Whose Project Management data may this user see?
 *   "all"      — no limit
 *   string[]   — only these employees (always includes the user)
 *
 * Own  = the user.
 * Team = the user + everyone below them in the reporting hierarchy
 *        + the members of the teams they manage (and of the teams under those).
 */
export async function getVisibleEmployeeIds(req: Request, mode: string = req.visibility || "own"): Promise<"all" | string[]> {
  const me = String(req.auth!.uid);
  if (mode === "all") return "all";
  if (mode !== "team") return [me];

  const [users, teams] = await Promise.all([
    User.find({ tenant: req.tenantId }).select("_id reportingManager").lean(),
    Team.find({ tenant: req.tenantId }).select("_id manager members parent").lean(),
  ]);

  const seen = new Set<string>([me]);

  // everyone who reports to me, directly or through others
  const reports = new Map<string, string[]>();
  for (const u of users) {
    const m = u.reportingManager ? String(u.reportingManager) : "";
    if (!m) continue;
    if (!reports.has(m)) reports.set(m, []);
    reports.get(m)!.push(String(u._id));
  }
  const queue = [me];
  while (queue.length) {
    for (const id of reports.get(queue.shift()!) || []) {
      if (!seen.has(id)) {
        seen.add(id);
        queue.push(id);
      }
    }
  }

  // the teams I manage, and the teams under them
  const children = new Map<string, any[]>();
  for (const t of teams) {
    const p = t.parent ? String(t.parent) : "";
    if (!p) continue;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(t);
  }
  const mine = teams.filter((t) => String(t.manager) === me);
  const done = new Set<string>();
  while (mine.length) {
    const t: any = mine.shift();
    if (done.has(String(t._id))) continue;
    done.add(String(t._id));
    seen.add(String(t.manager));
    for (const m of t.members || []) seen.add(String(m.user));
    mine.push(...(children.get(String(t._id)) || []));
  }

  return [...seen];
}

/** Mongo filter for "a field holding an employee id", limited to what the user may see. */
export async function visibleFilter(req: Request, field: string): Promise<Record<string, any>> {
  const ids = await getVisibleEmployeeIds(req);
  return ids === "all" ? {} : { [field]: { $in: ids.map((x) => new Types.ObjectId(x)) } };
}

export async function canSeeEmployee(req: Request, employeeId: string): Promise<boolean> {
  const ids = await getVisibleEmployeeIds(req);
  return ids === "all" || ids.includes(String(employeeId));
}

const has = (req: Request, module: string, action: PermAction) => !!(req.perms || []).find((p) => p.module === module)?.[action];

/** Right on a Project Management screen: pmRight("tasks", "reassign"). Client users never pass. */
export const pmRight = (screen: string, action: PermAction = "view") => (req: Request, _res: Response, next: NextFunction) => {
  if (req.isClientUser) return next(new ApiError(403, "Forbidden"));
  if (!has(req, `pm_${screen}`, action)) return next(new ApiError(403, `Forbidden: need ${action} on pm_${screen}`));
  next();
};

/** Passes when the user holds any one of the listed rights, e.g. ["pm_setup", "view"], ["setup", "view"]. */
export const anyRight = (...rights: [string, PermAction][]) => (req: Request, _res: Response, next: NextFunction) => {
  if (req.isClientUser) return next(new ApiError(403, "Forbidden"));
  if (!rights.some(([m, a]) => has(req, m, a))) return next(new ApiError(403, "Forbidden"));
  next();
};

/**
 * Would making `managerId` the manager of `userId` create a loop
 * (a person ending up above themselves)?
 */
export async function managerLoop(tenantId: string, userId: string, managerId: string): Promise<boolean> {
  if (String(userId) === String(managerId)) return true;
  const users = await User.find({ tenant: tenantId }).select("_id reportingManager").lean();
  const managerOf = new Map(users.map((u) => [String(u._id), u.reportingManager ? String(u.reportingManager) : ""]));
  let cur = String(managerId);
  for (let i = 0; cur && i <= users.length; i++) {
    if (cur === String(userId)) return true;
    cur = managerOf.get(cur) || "";
  }
  return false;
}

/** Same check for a team's parent team. */
export async function teamLoop(tenantId: string, teamId: string, parentId: string): Promise<boolean> {
  if (String(teamId) === String(parentId)) return true;
  const teams = await Team.find({ tenant: tenantId }).select("_id parent").lean();
  const parentOf = new Map(teams.map((t) => [String(t._id), t.parent ? String(t.parent) : ""]));
  let cur = String(parentId);
  for (let i = 0; cur && i <= teams.length; i++) {
    if (cur === String(teamId)) return true;
    cur = parentOf.get(cur) || "";
  }
  return false;
}
