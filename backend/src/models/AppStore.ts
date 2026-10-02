import { Schema, model, Document, Types } from "mongoose";

/**
 * Server-side replacement for the browser's localStorage. Each record holds one
 * named value (a JSON string, exactly what the frontend used to keep locally).
 * `user: null` means the value is shared by the whole tenant; otherwise it is a
 * personal preference of that user (theme, bookmarks).
 */
export interface IAppStore extends Document {
  tenant: Types.ObjectId;
  user: Types.ObjectId | null;
  key: string;
  value: string;
}

const appStoreSchema = new Schema<IAppStore>(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    key: { type: String, required: true, trim: true, maxlength: 200 },
    value: { type: String, default: "" },
  },
  { timestamps: true }
);

appStoreSchema.index({ tenant: 1, user: 1, key: 1 }, { unique: true });

export const AppStore = model<IAppStore>("AppStore", appStoreSchema);
