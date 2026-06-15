import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  status: "SUCCESS" | "FAILURE";
  errorMessage?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    resourceId: { type: String },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    status: { type: String, enum: ["SUCCESS", "FAILURE"], default: "SUCCESS" },
    errorMessage: { type: String },
  },
  { timestamps: true, versionKey: false }
);

AuditLogSchema.index({ companyId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ action: 1 });

const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
export default AuditLog;
