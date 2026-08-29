import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRCSCampaign extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name: string;
  // Plain-text body sent to every recipient (with {{name}} substitution) when
  // no richer Content Template is used — RCS/SMS fallback both support this.
  body: string;
  audienceTags: string[];
  audienceContactIds: mongoose.Types.ObjectId[];
  status: "DRAFT" | "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  stats: { total: number; sent: number; delivered: number; read: number; failed: number };
  createdBy: mongoose.Types.ObjectId;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RCSCampaignSchema = new Schema<IRCSCampaign>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    body: { type: String },
    audienceTags: [{ type: String }],
    audienceContactIds: [{ type: Schema.Types.ObjectId, ref: "RCSContact" }],
    status: { type: String, enum: ["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "CANCELED"], default: "DRAFT" },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      read: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    failureReason: { type: String },
  },
  { timestamps: true }
);

RCSCampaignSchema.index({ companyId: 1, status: 1 });
RCSCampaignSchema.index({ status: 1, scheduledAt: 1 });

const RCSCampaign: Model<IRCSCampaign> =
  mongoose.models.RCSCampaign || mongoose.model<IRCSCampaign>("RCSCampaign", RCSCampaignSchema);
export default RCSCampaign;
