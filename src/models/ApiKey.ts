import mongoose, { Schema, Document, Model } from "mongoose";

export interface IApiKey extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name: string;
  key: string;
  hashedKey: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  requestCount: number;
  rateLimit: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    hashedKey: { type: String, required: true },
    permissions: [{ type: String }],
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date },
    expiresAt: { type: Date },
    requestCount: { type: Number, default: 0 },
    rateLimit: { type: Number, default: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ApiKeySchema.index({ companyId: 1 });
ApiKeySchema.index({ hashedKey: 1 });
ApiKeySchema.index({ key: 1 });

const ApiKey: Model<IApiKey> = mongoose.models.ApiKey || mongoose.model<IApiKey>("ApiKey", ApiKeySchema);
export default ApiKey;
