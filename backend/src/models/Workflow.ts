import { Schema, model, Document, Types } from "mongoose";

export type WorkflowType = "LeadAssignment" | "Alert";
export type AssignStrategy = "round_robin" | "source_wise_round_robin" | "state_wise" | "city_wise" | "grade_wise";

export interface ICondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "in" | "not_in" | "is_empty" | "is_not_empty" | "gt" | "lt";
  value: any;
  logic?: "and" | "or";
}

export interface IAction {
  kind: "email" | "sms" | "whatsapp" | "followup" | "status" | "assign_lead" | "tag" | "notify" | "priority";
  params: Record<string, any>;
  /** wait this long after the trigger before running (0 = at once) — makes a drip sequence */
  delayMinutes?: number;
}

export interface IAssignmentRule {
  strategy: AssignStrategy;
  teamId?: Types.ObjectId;
  rrIndex?: number;
  /** round-robin turn counter per team id */
  rrByTeam?: Record<string, number>;
  sourceMap?: Array<{ source: Types.ObjectId; team: Types.ObjectId }>;
  stateMap?: Array<{ state: string; team: Types.ObjectId }>;
  cityMap?: Array<{ city: string; team: Types.ObjectId }>;
  gradeMap?: Array<{ grade: string; team: Types.ObjectId }>;
}

export interface IWorkflow extends Document {
  tenant: Types.ObjectId;
  name: string;
  type: WorkflowType;
  active: boolean;
  assignmentRule?: IAssignmentRule;
  event?: string;
  conditions?: ICondition[];
  actions?: IAction[];
}

const conditionSchema = new Schema<ICondition>(
  {
    field: { type: String, required: true },
    operator: {
      type: String,
      enum: ["equals", "not_equals", "contains", "in", "not_in", "is_empty", "is_not_empty", "gt", "lt"],
      required: true,
    },
    value: { type: Schema.Types.Mixed, default: null },
    logic: { type: String, enum: ["and", "or"], default: "and" },
  },
  { _id: false }
);

const actionSchema = new Schema<IAction>(
  {
    kind: {
      type: String,
      enum: ["email", "sms", "whatsapp", "followup", "status", "assign_lead", "tag", "notify", "priority"],
      required: true,
    },
    params: { type: Schema.Types.Mixed, default: {} },
    delayMinutes: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const sourceMapSchema = new Schema(
  {
    source: { type: Schema.Types.ObjectId, ref: "LeadSource", required: true },
    team: { type: Schema.Types.ObjectId, ref: "Team", required: true },
  },
  { _id: false }
);

const mappingSchema = new Schema(
  {
    state: { type: String },
    city: { type: String },
    grade: { type: String },
    team: { type: Schema.Types.ObjectId, ref: "Team", required: true },
  },
  { _id: false }
);

const assignmentRuleSchema = new Schema<IAssignmentRule>(
  {
    strategy: {
      type: String,
      enum: ["round_robin", "source_wise_round_robin", "state_wise", "city_wise", "grade_wise"],
      required: true,
    },
    teamId: { type: Schema.Types.ObjectId, ref: "Team" },
    rrIndex: { type: Number, default: 0 },
    rrByTeam: { type: Schema.Types.Mixed, default: {} },
    sourceMap: { type: [sourceMapSchema], default: [] },
    stateMap: { type: [mappingSchema], default: [] },
    cityMap: { type: [mappingSchema], default: [] },
    gradeMap: { type: [mappingSchema], default: [] },
  },
  { _id: false }
);

const workflowSchema = new Schema<IWorkflow>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["LeadAssignment", "Alert"], required: true },
    active: { type: Boolean, default: true },
    assignmentRule: assignmentRuleSchema,
    event: String,
    conditions: { type: [conditionSchema], default: [] },
    actions: { type: [actionSchema], default: [] },
  },
  { timestamps: true }
);

workflowSchema.index({ tenant: 1, type: 1 });

export const Workflow = model<IWorkflow>("Workflow", workflowSchema);
