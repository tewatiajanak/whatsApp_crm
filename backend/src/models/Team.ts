import { Schema, model, Document, Types } from "mongoose";

export interface ITeamMember {
  user: Types.ObjectId;
}

export interface ITeam extends Document {
  tenant: Types.ObjectId;
  name: string;
  manager: Types.ObjectId;
  members: ITeamMember[];
  sources: Types.ObjectId[];
  /** the team this one sits under, if any */
  parent?: Types.ObjectId | null;
  active: boolean;
}

const teamMemberSchema = new Schema<ITeamMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { _id: false }
);

const teamSchema = new Schema<ITeam>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name: { type: String, required: true },
    manager: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [teamMemberSchema], required: true, validate: { validator: (v: any[]) => v && v.length > 0, message: "At least one team member is required" } },
    sources: { type: [Schema.Types.ObjectId], ref: "LeadSource", default: [] },
    parent: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

teamSchema.index({ tenant: 1, name: 1 }, { unique: true });

export const Team = model<ITeam>("Team", teamSchema);
