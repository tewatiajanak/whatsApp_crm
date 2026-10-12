import { ApiError } from "../../utils/http";
import { PmMaster } from "../../models/pm/Setup";
import { PmTask } from "../../models/pm/Project";
import { getPmSettings } from "./masters";
import { emitPm } from "./events";
import { logActivity, rescheduleProject, statusFlags, statusWith, syncProjectCompletion } from "./projects";

export interface Actor {
  id?: any;
  name?: string;
}

/**
 * Move a task to another status, with every rule applied:
 * allowed status flow, mandatory checklist and attachment, client
 * verification, TAT pause / resume, completion, dependents, project
 * completion, and the events that drive messages and alerts.
 *
 * opts.verified — the client approved it (skips the "needs verification" stop)
 * opts.system   — a system move (client answer): the status flow is not checked
 */
export async function changeTaskStatus(tenantId: any, task: any, statusId: any, by: Actor, opts: { verified?: boolean; system?: boolean } = {}) {
  const next: any = await PmMaster.findOne({ _id: statusId, tenant: tenantId, type: "task_status" }).lean();
  if (!next) throw new ApiError(400, "Choose a valid status");
  if (String(task.status || "") === String(next._id)) return { task, moved: 0 };

  const settings = await getPmSettings(tenantId);
  const flow = settings.taskStatusFlow || [];
  if (!opts.system && flow.length && !flow.some((f: any) => String(f.from) === String(task.status) && String(f.to) === String(next._id))) {
    throw new ApiError(400, "This status change is not allowed");
  }
  const flags = statusFlags(next);
  const now = new Date();

  const mandatory = () => {
    const open = task.checklist.filter((c: any) => c.mandatory && !c.done);
    if (open.length) throw new ApiError(400, `Tick the mandatory checklist first: ${open.map((c: any) => c.text).join(", ")}`);
    if (task.mandatoryAttachment && !task.attachments.some((a: any) => !a.pasted)) throw new ApiError(400, "Attach the required file first");
  };
  if (flags.isCompleted && !opts.verified) {
    mandatory();
    // a task that needs the client's verification is completed by the client's approval
    if (task.clientVerification && task.project) {
      const waiting = await statusWith(tenantId, "task_status", "isWaitingForClient");
      if (waiting && String(waiting._id) !== String(next._id)) {
        throw new ApiError(400, task.isWaitingForClient ? "Waiting for the client's verification" : `This task needs client verification. Move it to "${waiting.name}" to send it for verification.`);
      }
    }
  }
  // sending for verification: the work must be ready
  if (flags.isWaitingForClient && task.clientVerification && !opts.system) mandatory();

  const before: any = task.status ? await PmMaster.findById(task.status).select("name").lean() : null;
  const wasCompleted = task.isCompleted;
  const wasPaused = task.isPaused;
  const wasStarted = task.isStarted;
  const wasWaiting = task.isWaitingForClient;

  // TAT pause: the paused time is added back to the due date on resume
  if (flags.isPaused && !wasPaused) task.pausedAt = now;
  if (!flags.isPaused && wasPaused && task.pausedAt) {
    const paused = now.getTime() - task.pausedAt.getTime();
    task.pausedMs = (task.pausedMs || 0) + paused;
    if (task.due && !flags.isCompleted) task.due = new Date(task.due.getTime() + paused);
    task.pausedAt = null;
  }
  if (flags.isStarted && !task.actualStart) task.actualStart = now;
  if (flags.isCompleted) task.actualEnd = now;
  if (!flags.isCompleted && wasCompleted) task.actualEnd = null;

  task.status = next._id;
  Object.assign(task, flags);
  await task.save();
  await logActivity({ tenant: tenantId, project: task.project, task: task._id, kind: "status", text: "Status changed", from: before?.name || "—", to: next.name, by: by.id, byName: by.name });

  const ev = (t: any, data?: any) => ({ tenantId: String(tenantId), actorId: by.id ? String(by.id) : undefined, actorName: by.name, taskId: String(t._id), projectId: t.project ? String(t.project) : undefined, moduleId: t.projectModule ? String(t.projectModule) : undefined, data });
  let moved: any[] = [];
  if (task.project && (flags.isCompleted !== wasCompleted || flags.isPaused !== wasPaused)) {
    moved = await rescheduleProject(tenantId, task.project, by, `after ${task.title}`);
    const state = await syncProjectCompletion(tenantId, task.project);
    if (state === "completed") emitPm("project_completed", ev(task));
    if (flags.isCompleted && task.projectModule && !(await PmTask.exists({ tenant: tenantId, projectModule: task.projectModule, isCompleted: false }))) emitPm("module_completed", ev(task));
  }
  emitPm("task_status_changed", ev(task, { status: String(next._id), from: before?.name || "" }));
  if (flags.isStarted && !wasStarted) emitPm("task_started", ev(task));
  if (flags.isCompleted && !wasCompleted) {
    emitPm("task_completed", ev(task));
    // tasks that waited only for this one can start now
    const dependents = await PmTask.find({ tenant: tenantId, dependsOn: task._id, isCompleted: false }).select("dependsOn assignee project projectModule").lean();
    for (const d of dependents) {
      if (!(await PmTask.exists({ _id: { $in: d.dependsOn }, isCompleted: false }))) emitPm("task_unblocked", ev(d, { after: task.title }));
    }
  }
  if (flags.isWaitingForClient && !wasWaiting && task.clientVerification && task.project) emitPm("verification_requested", ev(task));
  return { task, moved: moved.length };
}
