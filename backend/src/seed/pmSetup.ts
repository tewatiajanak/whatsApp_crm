import { connectDB } from "../config/db";
import { Tenant } from "../models/Tenant";
import { PM_MODULES, PERM_ACTIONS, UserCategory, UserType, IPermission, Visibility } from "../models/User";
import { PmMaster } from "../models/pm/Setup";
import { MASTER_DEFAULTS } from "../services/pm/masters";

/**
 * Project Management setup — ADDS what is missing, never deletes or overwrites.
 * Safe to run again and again.
 *
 *   npm run pm:setup            apply
 *   npm run pm:setup -- --dry   only print what would change
 *
 * For every tenant:
 *   1. roles that can already edit Setup (the administrators) get every
 *      Project Management right they do not have yet, and see all data;
 *   2. the standard Project Management roles are created if no role of that
 *      name exists;
 *   3. our-own-team user types that limit rights get the Project Management
 *      modules added, so the limit does not silently hide the new module.
 */
const dry = process.argv.includes("--dry");

const row = (module: string, actions: readonly string[]): IPermission => {
  const out: any = { module };
  for (const a of PERM_ACTIONS) out[a] = actions.includes(a);
  return out;
};
const ALL = PERM_ACTIONS;
const full = () => PM_MODULES.map((m) => row(m, ALL));

type RoleDef = { name: string; desc: string; dataVisibility: Visibility; perms: IPermission[] };

const ROLES: RoleDef[] = [
  {
    name: "Implementation Manager",
    desc: "Runs all projects, people and setup",
    dataVisibility: "all",
    perms: full(),
  },
  {
    name: "Project Manager",
    desc: "Plans and tracks projects for the team",
    dataVisibility: "team",
    perms: PM_MODULES.map((m) =>
      ["pm_setup", "pm_templates", "pm_notification_rules", "pm_portal_users"].includes(m)
        ? row(m, ["view"])
        : row(m, ["view", "create", "edit", "assign", "reassign", "approve", "export"])
    ),
  },
  {
    name: "Team Lead",
    desc: "Assigns and follows up the team's tasks",
    dataVisibility: "team",
    perms: [
      row("pm_dashboard", ["view"]),
      row("pm_projects", ["view", "export"]),
      row("pm_tasks", ["view", "create", "edit", "assign", "reassign", "export"]),
      row("pm_my_tasks", ["view", "create", "edit"]),
      row("pm_daily_plan", ["view", "create", "edit"]),
      row("pm_team_calendar", ["view", "export"]),
      row("pm_team", ["view"]),
      row("pm_meetings", ["view", "create", "edit"]),
      row("pm_tickets", ["view", "edit", "assign"]),
      row("pm_clients", ["view"]),
      row("pm_reports", ["view", "export"]),
    ],
  },
  {
    name: "Employee",
    desc: "Works on own tasks and daily plan",
    dataVisibility: "own",
    perms: [
      row("pm_projects", ["view"]),
      row("pm_tasks", ["view", "edit"]),
      row("pm_my_tasks", ["view", "create", "edit"]),
      row("pm_daily_plan", ["view", "create", "edit"]),
      row("pm_team", ["view"]),
      row("pm_meetings", ["view"]),
      row("pm_tickets", ["view", "edit"]),
    ],
  },
  {
    name: "Client User",
    desc: "Client portal only",
    dataVisibility: "own",
    perms: [],
  },
];

async function main() {
  await connectDB();
  const tenants = await Tenant.find().select("name").lean();
  console.log(`[pm:setup] ${dry ? "DRY RUN — nothing is written. " : ""}${tenants.length} tenant(s)`);

  for (const t of tenants) {
    console.log(`\n— ${t.name} (${t._id})`);

    // 1. administrators get the Project Management rights they do not have yet
    const roles = await UserType.find({ tenant: t._id });
    for (const role of roles) {
      const isAdmin = !!role.perms.find((p) => p.module === "setup")?.edit;
      if (!isAdmin) continue;
      const missing = PM_MODULES.filter((m) => !role.perms.some((p) => p.module === m));
      const raw: any = await UserType.collection.findOne({ _id: role._id as any });
      const setVisibility = raw?.dataVisibility === undefined;
      if (!missing.length && !setVisibility) {
        console.log(`  role "${role.name}": already has Project Management rights`);
        continue;
      }
      console.log(`  role "${role.name}": + ${missing.length} Project Management module(s)${setVisibility ? ", sees all data" : ""}`);
      if (dry) continue;
      const update: any = {};
      if (missing.length) update.$push = { perms: { $each: missing.map((m) => row(m, ALL)) } };
      if (setVisibility) update.$set = { dataVisibility: "all" };
      await UserType.updateOne({ _id: role._id }, update);
    }

    // 2. the standard roles
    for (const def of ROLES) {
      if (roles.some((x) => x.name.trim().toLowerCase() === def.name.toLowerCase())) {
        console.log(`  role "${def.name}": exists, left as it is`);
        continue;
      }
      console.log(`  role "${def.name}": create (${def.dataVisibility})`);
      if (!dry) await UserType.create({ ...def, tenant: t._id });
    }

    // 3. own-team user types with a rights limit
    const cats = await UserCategory.find({ tenant: t._id, kind: "internal" });
    for (const cat of cats) {
      if (!cat.perms.length) continue; // no limit
      const missing = PM_MODULES.filter((m) => !cat.perms.some((p) => p.module === m));
      if (!missing.length) continue;
      console.log(`  user type "${cat.name}": + ${missing.length} Project Management module(s) to its limit`);
      if (!dry) await UserCategory.updateOne({ _id: cat._id }, { $push: { perms: { $each: missing.map((m) => row(m, ALL)) } } });
    }

    // 4. a flag added to a master later: give it to the default item that carries it,
    //    but only when no item of that master has the flag yet
    for (const [type, defs] of Object.entries(MASTER_DEFAULTS)) {
      for (const def of defs) {
        for (const flag of Object.keys(def.flags || {})) {
          if (await PmMaster.exists({ tenant: t._id, type, [`flags.${flag}`]: true })) continue;
          const item = await PmMaster.findOne({ tenant: t._id, type, name: def.name });
          if (!item) continue;
          console.log(`  master ${type} "${def.name}": + flag ${flag}`);
          if (!dry) await PmMaster.updateOne({ _id: item._id }, { $set: { [`flags.${flag}`]: true } });
        }
      }
    }
  }

  console.log(`\n[pm:setup] done${dry ? " (dry run)" : ""}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[pm:setup] failed:", e);
  process.exit(1);
});
