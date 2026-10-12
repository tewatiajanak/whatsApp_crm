import { Schema, model, Document, Types } from "mongoose";
import { TAT_UNITS, TatUnit } from "./Product";

/* Runtime: Project → Project Module → Task. A project is a COPY of a product
   template, so later template changes never touch a running project. */

/* ---- running numbers (PRJ-0001, T-000001, …) ---- */
const counterSchema = new Schema({ tenant: { type: Schema.Types.ObjectId, required: true }, key: { type: String, required: true }, seq: { type: Number, default: 0 } });
counterSchema.index({ tenant: 1, key: 1 }, { unique: true });
export const PmCounter = model("PmCounter", counterSchema, "pm_counters");

export async function nextNumber(tenantId: any, key: string, by = 1): Promise<number> {
  const doc: any = await PmCounter.findOneAndUpdate({ tenant: tenantId, key }, { $inc: { seq: by } }, { new: true, upsert: true });
  return doc.seq;
}

/* ---- Project ---- */
export interface IPmProject extends Document {
  tenant: Types.ObjectId;
  code: string;
  name: string;
  client: Types.ObjectId;
  product: Types.ObjectId;
  incharge: Types.ObjectId;
  priority?: Types.ObjectId | null;
  status?: Types.ObjectId | null;
  startDate: Date;
  /** the end date planned when the project was created (baseline) */
  plannedEnd?: Date | null;
  /** set when every task is completed, or the project is closed */
  actualEnd?: Date | null;
  autoMessages: any[];
  /** rule ids already fired (time-based rules fire once) */
  firedRules: string[];
  signedOffAt?: Date | null;
  signedOffBy?: string;
  createdBy?: Types.ObjectId | null;
  isDemo?: boolean;
}
const projectSchema = new Schema<IPmProject>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    client: { type: Schema.Types.ObjectId, ref: "PmClient", required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: "PmProduct", required: true },
    incharge: { type: Schema.Types.ObjectId, ref: "User", required: true },
    priority: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    status: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    startDate: { type: Date, required: true },
    plannedEnd: { type: Date, default: null },
    actualEnd: { type: Date, default: null },
    autoMessages: { type: Schema.Types.Mixed, default: [] },
    firedRules: { type: [String], default: [] },
    signedOffAt: { type: Date, default: null },
    signedOffBy: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
projectSchema.index({ tenant: 1, code: 1 }, { unique: true });
projectSchema.index({ tenant: 1, incharge: 1 });
export const PmProject = model<IPmProject>("PmProject", projectSchema, "pm_projects");

/* ---- Project module ---- */
export interface IPmProjectModule extends Document {
  tenant: Types.ObjectId;
  project: Types.ObjectId;
  name: string;
  order: number;
  incharge?: Types.ObjectId | null;
  sourceModule?: Types.ObjectId | null;
  autoMessages: any[];
  signedOffAt?: Date | null;
  signedOffBy?: string;
}
const projectModuleSchema = new Schema<IPmProjectModule>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", required: true, index: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    incharge: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sourceModule: { type: Schema.Types.ObjectId, ref: "PmProductModule", default: null },
    autoMessages: { type: Schema.Types.Mixed, default: [] },
    signedOffAt: { type: Date, default: null },
    signedOffBy: { type: String, default: "" },
  },
  { timestamps: true }
);
projectModuleSchema.index({ tenant: 1, incharge: 1 });
export const PmProjectModule = model<IPmProjectModule>("PmProjectModule", projectModuleSchema, "pm_project_modules");

/* ---- Task ---- */
export interface IChecklistItem {
  _id?: Types.ObjectId;
  text: string;
  order: number;
  mandatory: boolean;
  done: boolean;
  doneBy?: Types.ObjectId | null;
  doneAt?: Date | null;
}
export interface IAttachment {
  _id?: Types.ObjectId;
  name: string;
  /** file name inside the private attachment store */
  file: string;
  size: number;
  mime: string;
  by: Types.ObjectId;
  at: Date;
  clientVisible: boolean;
  /** an image pasted into a comment */
  pasted: boolean;
}

export interface IPmTask extends Document {
  tenant: Types.ObjectId;
  number: string;
  title: string;
  /** template = came from the product template · adhoc = added by hand */
  kind: "template" | "adhoc";
  project?: Types.ObjectId | null;
  projectModule?: Types.ObjectId | null;
  client?: Types.ObjectId | null;
  product?: Types.ObjectId | null;
  taskType?: Types.ObjectId | null;
  priority?: Types.ObjectId | null;
  assignee?: Types.ObjectId | null;
  status?: Types.ObjectId | null;
  /** copies of the status flags, so lists and reports never read names */
  isCompleted: boolean;
  isStarted: boolean;
  isPaused: boolean;
  isWaitingForClient: boolean;
  tatValue: number;
  tatUnit: TatUnit;
  order: number;
  dependsOn: Types.ObjectId[];
  /** baseline, fixed when the project was created */
  plannedStart?: Date | null;
  plannedDue?: Date | null;
  /** current dates (move when predecessors finish late or early) */
  start?: Date | null;
  due?: Date | null;
  actualStart?: Date | null;
  actualEnd?: Date | null;
  pausedAt?: Date | null;
  pausedMs: number;
  /** the due date was set by hand: the scheduler leaves it alone */
  dueLocked: boolean;
  clientVerification: boolean;
  clientVisible: boolean;
  attachmentRequired: boolean;
  mandatoryAttachment: boolean;
  description: string;
  checklist: IChecklistItem[];
  attachments: IAttachment[];
  autoMessages: any[];
  /** rule ids already fired for this task (time-based rules fire once) */
  firedRules: string[];
  watchers: Types.ObjectId[];
  labels: string[];
  milestone: boolean;
  createdBy?: Types.ObjectId | null;
  isDemo?: boolean;
}
const taskSchema = new Schema<IPmTask>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    number: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["template", "adhoc"], default: "adhoc" },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", default: null },
    projectModule: { type: Schema.Types.ObjectId, ref: "PmProjectModule", default: null },
    client: { type: Schema.Types.ObjectId, ref: "PmClient", default: null },
    product: { type: Schema.Types.ObjectId, ref: "PmProduct", default: null },
    taskType: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    priority: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: Schema.Types.ObjectId, ref: "PmMaster", default: null },
    isCompleted: { type: Boolean, default: false },
    isStarted: { type: Boolean, default: false },
    isPaused: { type: Boolean, default: false },
    isWaitingForClient: { type: Boolean, default: false },
    tatValue: { type: Number, default: 1 },
    tatUnit: { type: String, enum: TAT_UNITS, default: "working_days" },
    order: { type: Number, default: 0 },
    dependsOn: { type: [Schema.Types.ObjectId], ref: "PmTask", default: [] },
    plannedStart: { type: Date, default: null },
    plannedDue: { type: Date, default: null },
    start: { type: Date, default: null },
    due: { type: Date, default: null },
    actualStart: { type: Date, default: null },
    actualEnd: { type: Date, default: null },
    pausedAt: { type: Date, default: null },
    pausedMs: { type: Number, default: 0 },
    dueLocked: { type: Boolean, default: false },
    clientVerification: { type: Boolean, default: false },
    clientVisible: { type: Boolean, default: true },
    attachmentRequired: { type: Boolean, default: false },
    mandatoryAttachment: { type: Boolean, default: false },
    description: { type: String, default: "" },
    checklist: {
      type: [new Schema<IChecklistItem>({
        text: { type: String, required: true, trim: true },
        order: { type: Number, default: 0 },
        mandatory: { type: Boolean, default: false },
        done: { type: Boolean, default: false },
        doneBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
        doneAt: { type: Date, default: null },
      })],
      default: [],
    },
    attachments: {
      type: [new Schema<IAttachment>({
        name: String,
        file: String,
        size: Number,
        mime: String,
        by: { type: Schema.Types.ObjectId, ref: "User" },
        at: { type: Date, default: Date.now },
        clientVisible: { type: Boolean, default: false },
        pasted: { type: Boolean, default: false },
      })],
      default: [],
    },
    autoMessages: { type: Schema.Types.Mixed, default: [] },
    firedRules: { type: [String], default: [] },
    watchers: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    labels: { type: [String], default: [] },
    milestone: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);
taskSchema.index({ tenant: 1, number: 1 }, { unique: true });
taskSchema.index({ tenant: 1, assignee: 1, isCompleted: 1, due: 1 });
taskSchema.index({ tenant: 1, project: 1, projectModule: 1, order: 1 });
taskSchema.index({ tenant: 1, client: 1 });
export const PmTask = model<IPmTask>("PmTask", taskSchema, "pm_tasks");

/* ---- Comments ---- */
export interface IPmComment extends Document {
  tenant: Types.ObjectId;
  task: Types.ObjectId;
  project?: Types.ObjectId | null;
  by?: Types.ObjectId | null;
  /** set when a client contact wrote it (portal) */
  byClient?: string;
  /** plain text with @[Name](id) mentions and ![](attachmentId) pasted images */
  text: string;
  mentions: Types.ObjectId[];
  clientVisible: boolean;
}
const commentSchema = new Schema<IPmComment>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    task: { type: Schema.Types.ObjectId, ref: "PmTask", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", default: null },
    by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    byClient: { type: String, default: "" },
    text: { type: String, required: true },
    mentions: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    clientVisible: { type: Boolean, default: false },
  },
  { timestamps: true }
);
export const PmComment = model<IPmComment>("PmComment", commentSchema, "pm_comments");

/* ---- Activity: everything that happened to a task / project ---- */
export interface IPmActivity extends Document {
  tenant: Types.ObjectId;
  project?: Types.ObjectId | null;
  task?: Types.ObjectId | null;
  /** created · status · dates · reassign · checklist · comment · attachment · message · verification · signoff · edit */
  kind: string;
  text: string;
  from?: string;
  to?: string;
  by?: Types.ObjectId | null;
  byName: string;
}
const activitySchema = new Schema<IPmActivity>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", default: null },
    task: { type: Schema.Types.ObjectId, ref: "PmTask", default: null },
    kind: { type: String, required: true },
    text: { type: String, default: "" },
    from: { type: String, default: "" },
    to: { type: String, default: "" },
    by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    byName: { type: String, default: "System" },
  },
  { timestamps: true }
);
activitySchema.index({ tenant: 1, project: 1, createdAt: -1 });
activitySchema.index({ tenant: 1, task: 1, createdAt: -1 });
export const PmActivity = model<IPmActivity>("PmActivity", activitySchema, "pm_activity");

/* ---- Assignment history: who had what, and why it moved ---- */
export interface IPmAssignment extends Document {
  tenant: Types.ObjectId;
  entity: "project" | "module" | "task" | "ticket";
  entityId: Types.ObjectId;
  project?: Types.ObjectId | null;
  from?: Types.ObjectId | null;
  to?: Types.ObjectId | null;
  reason: string;
  by?: Types.ObjectId | null;
}
const assignmentSchema = new Schema<IPmAssignment>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    entity: { type: String, enum: ["project", "module", "task", "ticket"], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    project: { type: Schema.Types.ObjectId, ref: "PmProject", default: null },
    from: { type: Schema.Types.ObjectId, ref: "User", default: null },
    to: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reason: { type: String, default: "" },
    by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
assignmentSchema.index({ tenant: 1, from: 1 });
assignmentSchema.index({ tenant: 1, to: 1 });
assignmentSchema.index({ tenant: 1, entityId: 1 });
export const PmAssignment = model<IPmAssignment>("PmAssignment", assignmentSchema, "pm_assignments");
