import { connectDB } from "../config/db";
import { Tenant } from "../models/Tenant";
import { User } from "../models/User";
import { PmMaster } from "../models/pm/Setup";
import { PmProduct, PmProductModule, PmTaskTemplate } from "../models/pm/Product";
import { PmClient } from "../models/pm/Client";
import { getPmSettings } from "../services/pm/masters";
import { PmProject, PmProjectModule, PmTask, PmActivity, PmAssignment, PmComment, nextNumber } from "../models/pm/Project";
import { PmDailyPlan } from "../models/pm/DailyPlan";
import { buildPlan, writePlan } from "../routes/pm/projects";
import { rescheduleProject, statusFlags, statusWith, syncProjectCompletion } from "../services/pm/projects";

/**
 * Project Management DEMO data. Every product and client it creates is tagged
 * `isDemo: true`, so it can be removed again without touching real data.
 *
 *   npm run pm:demo               add the demo data (skips what already exists)
 *   npm run pm:demo -- --remove   delete the demo data
 *   npm run pm:demo -- --dry      only print what would happen
 */
const dry = process.argv.includes("--dry");
const remove = process.argv.includes("--remove");

type T = { title: string; type: string; priority?: string; tat: number; unit?: "hours" | "days" | "working_days"; after?: string[]; verify?: boolean; attach?: boolean; checklist: string[] };
type M = { name: string; tasks: T[] };
type P = { name: string; code: string; description: string; modules: M[] };

const PRODUCTS: P[] = [
  {
    name: "School ERP",
    code: "DEMO-ERP",
    description: "Admissions, fees and attendance for schools",
    modules: [
      {
        name: "Admission Management",
        tasks: [
          { title: "Class & Section Master Setup", type: "Master Setup", tat: 2, checklist: ["Classes created", "Sections mapped", "Academic session set"] },
          { title: "Admission Form Configuration", type: "Configuration", tat: 3, after: ["Class & Section Master Setup"], checklist: ["Form fields finalised", "Mandatory fields marked", "Document list added", "Form tested"] },
          { title: "Student Data Import", type: "Data Import", priority: "High", tat: 4, after: ["Admission Form Configuration"], attach: true, checklist: ["Data sheet received", "Sheet validated", "Import done", "Count matched with client"] },
          { title: "Admission Workflow Testing", type: "Testing", tat: 2, after: ["Student Data Import"], verify: true, checklist: ["New admission tested", "Transfer case tested", "Reports checked"] },
          { title: "Admission Module Training", type: "Training", tat: 1, after: ["Admission Workflow Testing"], checklist: ["Training scheduled", "Users trained", "Attendance sheet collected"] },
        ],
      },
      {
        name: "Fee Management",
        tasks: [
          { title: "Fee Head Master Setup", type: "Master Setup", tat: 2, after: ["Class & Section Master Setup"], checklist: ["Fee heads created", "Fee groups created", "Bank accounts mapped"] },
          { title: "Fee Structure Configuration", type: "Configuration", priority: "High", tat: 3, after: ["Fee Head Master Setup"], verify: true, checklist: ["Class-wise structure entered", "Instalments set", "Due dates set", "Fine rules set"] },
          { title: "Concession Rules", type: "Configuration", tat: 2, after: ["Fee Structure Configuration"], checklist: ["Concession types created", "Approval flow set", "Sibling rule checked"] },
          { title: "Data Import of Old Dues", type: "Data Import", priority: "High", tat: 3, after: ["Fee Structure Configuration", "Student Data Import"], attach: true, checklist: ["Dues sheet received", "Sheet validated", "Import done", "Totals matched"] },
          { title: "Fee Receipt Testing", type: "Testing", tat: 2, after: ["Concession Rules", "Data Import of Old Dues"], verify: true, checklist: ["Cash receipt tested", "Online payment tested", "Receipt print checked", "Day book checked"] },
          { title: "Fee Module Training", type: "Training", tat: 1, after: ["Fee Receipt Testing"], checklist: ["Accounts team trained", "Manual shared", "Queries closed"] },
        ],
      },
      {
        name: "Attendance",
        tasks: [
          { title: "Attendance Rules Setup", type: "Configuration", tat: 8, unit: "hours", after: ["Class & Section Master Setup"], checklist: ["Attendance type chosen", "Late rule set", "Holiday list entered"] },
          { title: "Biometric Device Integration", type: "Configuration", priority: "High", tat: 3, after: ["Attendance Rules Setup"], checklist: ["Device details received", "Device connected", "Punch data received", "Mapping verified"] },
          { title: "Attendance SMS & WhatsApp Alerts", type: "Configuration", tat: 2, after: ["Attendance Rules Setup"], checklist: ["Templates approved", "Absent alert tested", "Timing confirmed"] },
          { title: "Attendance Go-Live", type: "Go-Live", priority: "Critical", tat: 1, after: ["Biometric Device Integration", "Attendance SMS & WhatsApp Alerts"], verify: true, checklist: ["Pilot class run", "Teachers trained", "Sign-off taken"] },
        ],
      },
    ],
  },
  {
    name: "CRM",
    code: "DEMO-CRM",
    description: "Lead management and WhatsApp communication",
    modules: [
      {
        name: "Lead Management",
        tasks: [
          { title: "Lead Stages & Sources Setup", type: "Master Setup", tat: 1, checklist: ["Stages created", "Sources created", "Lost reasons added"] },
          { title: "Lead Assignment Rules", type: "Configuration", tat: 2, after: ["Lead Stages & Sources Setup"], checklist: ["Teams created", "Round robin set", "Rule tested"] },
          { title: "Old Leads Import", type: "Data Import", tat: 2, after: ["Lead Stages & Sources Setup"], attach: true, checklist: ["Sheet received", "Duplicates removed", "Import done"] },
          { title: "CRM User Training", type: "Training", tat: 1, after: ["Lead Assignment Rules", "Old Leads Import"], checklist: ["Counsellors trained", "Managers trained", "Logins shared"] },
        ],
      },
      {
        name: "WhatsApp Setup",
        tasks: [
          { title: "WhatsApp Business Account Verification", type: "Configuration", priority: "High", tat: 5, unit: "days", verify: true, checklist: ["Business documents received", "Meta verification submitted", "Number registered"] },
          { title: "Message Templates Approval", type: "Configuration", tat: 3, after: ["WhatsApp Business Account Verification"], checklist: ["Templates drafted", "Client approved text", "Meta approved"] },
          { title: "WhatsApp Go-Live", type: "Go-Live", priority: "Critical", tat: 1, after: ["Message Templates Approval", "CRM User Training"], verify: true, checklist: ["Test message sent", "Chatbot checked", "Sign-off taken"] },
        ],
      },
    ],
  },
];

const DAY = 86_400_000;
const CLIENTS = [
  { name: "Greenfield Public School", code: "DEMO-GPS", city: "Jaipur", state: "Rajasthan", contacts: [["Rajesh Sharma", "Principal"], ["Neha Jain", "Accounts Head"]] },
  { name: "Sunrise Academy", code: "DEMO-SRA", city: "Pune", state: "Maharashtra", contacts: [["Anita Deshmukh", "Director"], ["Vikram Patil", "IT Coordinator"]] },
  { name: "Delhi Scholars School", code: "DEMO-DSS", city: "New Delhi", state: "Delhi", contacts: [["Sanjay Malhotra", "Administrator"], ["Pooja Arora", "Admission Incharge"]] },
];
/** client, product, started N days ago, share of tasks finished, days late (+) or early (−) per finished task */
const PROJECTS: [string, string, number, number, number][] = [
  ["DEMO-GPS", "DEMO-ERP", 34, 0.3, 3],
  ["DEMO-SRA", "DEMO-ERP", 10, 0.7, -2],
  ["DEMO-DSS", "DEMO-ERP", 70, 1, 0],
  ["DEMO-GPS", "DEMO-CRM", 4, 0.45, 0],
  ["DEMO-SRA", "DEMO-CRM", 16, 0.3, 2],
  ["DEMO-DSS", "DEMO-CRM", 0, 0, 0],
];
const ADHOC = ["Share weekly status report", "Collect signed data sheet", "Follow up for server access", "Prepare training attendance sheet", "Review go-live checklist", "Fix receipt print alignment", "Call principal for sign-off date", "Update project plan"];
const day = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);

/** Clients, projects with realistic progress, ad-hoc tasks and two weeks of daily plans. */
async function addRuntimeDemo(t: any, people: any[]) {
  if (await PmProject.exists({ tenant: t._id, isDemo: true })) return console.log("  demo projects: exist, left as they are");
  if (people.length < 2) return console.log("  demo projects: skipped (needs at least 2 active users)");
  console.log(`  ${CLIENTS.length} clients, ${PROJECTS.length} projects, ${ADHOC.length} ad-hoc tasks, daily plans for ${Math.min(6, people.length)} people`);
  if (dry) return;

  const products = await PmProduct.find({ tenant: t._id, isDemo: true }).lean();
  const req: any = { tenantId: t._id, auth: { uid: String(people[0]._id), name: people[0].name } };
  const clients: any[] = [];
  for (const [i, c] of CLIENTS.entries()) {
    clients.push(
      (await PmClient.findOne({ tenant: t._id, code: c.code })) ||
        (await PmClient.create({
          tenant: t._id, name: c.name, code: c.code, city: c.city, state: c.state, accountManager: people[i % people.length]._id, status: "Active", isDemo: true,
          products: products.map((p) => p._id),
          contacts: c.contacts.map(([name, designation], j) => ({ name, designation, email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`, mobile: `9199990${i}${j}000`, primary: j === 0, portalAccess: j === 0 })),
        }))
    );
  }

  const done = await statusWith(t._id, "task_status", "isCompleted");
  const doing = await statusWith(t._id, "task_status", "isInProgress");
  const projectStatus = async (flag: string | null) => (await statusWith(t._id, "project_status", flag))?._id || null;
  const inProgress = (await PmMaster.find({ tenant: t._id, type: "project_status", active: true }).sort({ order: 1 }).lean())[1]?._id || (await projectStatus(null));
  const now = Date.now();

  for (const [pi, [clientCode, productCode, ago, share, slip]] of PROJECTS.entries()) {
    const client = clients.find((c) => c.code === clientCode);
    const product: any = products.find((p) => p.code === productCode);
    if (!client || !product) continue;
    const settings = await getPmSettings(t._id);
    const start = new Date(`${day(new Date(now - ago * DAY))}T${settings.workStart}:00+05:30`);
    const { plan, end } = await buildPlan(req, {}, product._id, start);
    // spread the work over the team
    let n = pi;
    plan.forEach((m: any) => { m.incharge = String(people[n++ % people.length]._id); m.tasks.forEach((x: any) => (x.assignee = String(people[n++ % people.length]._id))); });
    const project = await PmProject.create({
      tenant: t._id, code: `PRJ-${String(await nextNumber(t._id, "project")).padStart(4, "0")}`, name: `${client.name} – ${product.name}`,
      client: client._id, product: product._id, incharge: people[pi % people.length]._id, status: share ? inProgress : await projectStatus(null),
      startDate: start, plannedEnd: end, autoMessages: product.autoMessages || [], createdBy: people[0]._id, isDemo: true,
    });
    const tasks = (await writePlan(req, project, plan, 0, true)).sort((a: any, b: any) => a.due - b.due);
    await PmActivity.create({ tenant: t._id, project: project._id, kind: "created", text: `Project created with ${plan.length} modules and ${tasks.length} tasks`, by: people[0]._id, byName: people[0].name, createdAt: start });

    const finish = Math.round(tasks.length * share);
    for (const [i, task] of tasks.entries()) {
      if (i < finish) {
        const end2 = new Date(Math.min(now - 3_600_000, task.due.getTime() + slip * DAY));
        await PmTask.updateOne({ _id: task._id }, { $set: { status: done?._id, ...statusFlags(done), actualStart: task.start, actualEnd: end2, "checklist.$[].done": true, "checklist.$[].doneAt": end2 } });
      } else if (i < finish + 2 && share > 0 && share < 1 && task.start.getTime() < now) {
        const half = Math.ceil(task.checklist.length / 2);
        await PmTask.updateOne({ _id: task._id }, { $set: { status: doing?._id, ...statusFlags(doing), actualStart: task.start, checklist: task.checklist.map((c: any, j: number) => ({ ...c, done: j < half })) } });
      }
    }
    // one hand-over per project in progress, so the reassignment report has something to show
    if (share > 0 && share < 1) {
      const moved = tasks[finish + 2] || tasks[tasks.length - 1];
      const to = people[(pi + 3) % people.length]._id;
      if (String(moved.assignee) !== String(to)) {
        await PmTask.updateOne({ _id: moved._id }, { $set: { assignee: to } });
        await PmAssignment.create({ tenant: t._id, entity: "task", entityId: moved._id, project: project._id, from: moved.assignee, to, reason: pi % 2 ? "On leave" : "Workload balancing", by: people[0]._id });
      }
    }
    await rescheduleProject(t._id, project._id, { id: people[0]._id, name: people[0].name }, "Dependency");
    await syncProjectCompletion(t._id, project._id);
  }

  // ad-hoc tasks, some linked to nothing
  const first = (await statusWith(t._id, "task_status", "isInitial")) || (await statusWith(t._id, "task_status", null));
  const last = await nextNumber(t._id, "task", ADHOC.length);
  await PmTask.insertMany(
    ADHOC.map((title, i) => {
      const due = new Date(now + (i - 3) * DAY);
      return {
        tenant: t._id, number: `T-${String(last - ADHOC.length + i + 1).padStart(6, "0")}`, title, kind: "adhoc", assignee: people[i % people.length]._id,
        status: first?._id, ...statusFlags(first), tatValue: 1, tatUnit: "days", plannedStart: new Date(now - 4 * DAY), plannedDue: due, start: new Date(now - 4 * DAY), due,
        clientVisible: false, createdBy: people[0]._id, isDemo: true,
      };
    })
  );

  // two weeks of daily plans
  const locations = await PmMaster.find({ tenant: t._id, type: "work_location", active: true }).sort({ order: 1 }).lean();
  const workingDays = (await getPmSettings(t._id)).workingDays;
  const plans: any[] = [];
  for (const [pi, person] of people.slice(0, 6).entries()) {
    const mine = await PmTask.find({ tenant: t._id, assignee: person._id, isDemo: true, project: { $ne: null } }).select("project").limit(6).lean();
    for (let d = -9; d <= 4; d++) {
      const date = new Date(now + d * DAY);
      if (!workingDays.includes(new Date(date.getTime() + 330 * 60_000).getUTCDay()) || !locations.length) continue;
      const loc = locations[(pi + d + 20) % locations.length];
      const task = mine.length ? mine[(d + 20) % mine.length] : null;
      plans.push({
        tenant: t._id, employee: person._id, date: day(date), isDemo: true,
        entries: [{
          project: task?.project || null, task: task?._id || null, description: task ? "" : "Internal review and documentation", location: loc._id,
          site: (pi + d) % 3 === 0 ? CLIENTS[(pi + d + 30) % CLIENTS.length].name : "", hours: 8, from: "09:30", to: "18:30",
          result: d < 0 ? ["done", "done", "partial", "done", "not_done"][(pi + d + 50) % 5] : "", remarks: "",
        }],
      });
    }
  }
  if (plans.length) await PmDailyPlan.insertMany(plans, { ordered: false }).catch(() => {});
}

async function main() {
  await connectDB();
  const tenants = await Tenant.find().select("name").lean();
  console.log(`[pm:demo] ${dry ? "DRY RUN. " : ""}${remove ? "REMOVE" : "ADD"} — ${tenants.length} tenant(s)`);

  for (const t of tenants) {
    console.log(`\n— ${t.name}`);

    if (remove) {
      const products = await PmProduct.find({ tenant: t._id, isDemo: true }).select("_id name").lean();
      const ids = products.map((p) => p._id);
      const clients = await PmClient.countDocuments({ tenant: t._id, isDemo: true });
      const projects = await PmProject.distinct("_id", { tenant: t._id, isDemo: true });
      const demoTasks = await PmTask.distinct("_id", { tenant: t._id, isDemo: true });
      console.log(`  delete ${products.length} demo product(s) with their modules and tasks, ${clients} demo client(s), ${projects.length} demo project(s), ${demoTasks.length} demo task(s), demo daily plans`);
      if (!dry) {
        await PmComment.deleteMany({ tenant: t._id, task: { $in: demoTasks } });
        await PmActivity.deleteMany({ tenant: t._id, $or: [{ project: { $in: projects } }, { task: { $in: demoTasks } }] });
        await PmAssignment.deleteMany({ tenant: t._id, $or: [{ project: { $in: projects } }, { entityId: { $in: demoTasks } }] });
        await PmTask.deleteMany({ tenant: t._id, isDemo: true });
        await PmProjectModule.deleteMany({ tenant: t._id, project: { $in: projects } });
        await PmProject.deleteMany({ tenant: t._id, isDemo: true });
        await PmDailyPlan.deleteMany({ tenant: t._id, isDemo: true });
        await PmTaskTemplate.deleteMany({ tenant: t._id, product: { $in: ids } });
        await PmProductModule.deleteMany({ tenant: t._id, product: { $in: ids } });
        await PmProduct.deleteMany({ _id: { $in: ids } });
        await PmClient.deleteMany({ tenant: t._id, isDemo: true });
      }
      continue;
    }

    await getPmSettings(t._id); // default masters
    const masters = await PmMaster.find({ tenant: t._id, type: { $in: ["task_type", "priority"] } }).lean();
    const find = (type: string, name?: string) => masters.find((m) => m.type === type && m.name.toLowerCase() === String(name || "").toLowerCase())?._id || null;
    const people = await User.find({ tenant: t._id, status: "Active" }).select("_id name").sort({ createdAt: 1 }).lean();
    const person = (i: number) => (people.length ? people[i % people.length]._id : null);

    for (const def of PRODUCTS) {
      if (await PmProduct.exists({ tenant: t._id, code: def.code })) {
        console.log(`  product "${def.name}" (${def.code}): exists, left as it is`);
        continue;
      }
      const taskCount = def.modules.reduce((n, m) => n + m.tasks.length, 0);
      console.log(`  product "${def.name}" (${def.code}): create ${def.modules.length} modules, ${taskCount} tasks`);
      if (dry) continue;

      const product = await PmProduct.create({ tenant: t._id, name: def.name, code: def.code, description: def.description, active: true, isDemo: true });
      const idOf = new Map<string, any>();
      let p = 0;
      for (const [mi, m] of def.modules.entries()) {
        const mod = await PmProductModule.create({ tenant: t._id, product: product._id, name: m.name, order: mi + 1, defaultIncharge: person(mi) });
        for (const [ti, task] of m.tasks.entries()) {
          const doc = await PmTaskTemplate.create({
            tenant: t._id,
            product: product._id,
            module: mod._id,
            title: task.title,
            taskType: find("task_type", task.type),
            priority: find("priority", task.priority || "Medium"),
            defaultAssignee: person(p++),
            tatValue: task.tat,
            tatUnit: task.unit || "working_days",
            order: ti + 1,
            dependsOn: (task.after || []).map((name) => idOf.get(name)).filter(Boolean),
            clientVerification: !!task.verify,
            clientVisible: true,
            mandatoryAttachment: !!task.attach,
            checklist: task.checklist.map((text, i) => ({ text, order: i + 1, mandatory: i === task.checklist.length - 1 })),
          });
          idOf.set(task.title, doc._id);
        }
      }
    }
    await addRuntimeDemo(t, people);
  }

  console.log(`\n[pm:demo] done${dry ? " (dry run)" : ""}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[pm:demo] failed:", e);
  process.exit(1);
});
