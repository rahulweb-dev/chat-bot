import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEmailCampaign extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name: string;
  subject: string;
  fromName?: string;
  // The HTML body. {{name}} / {{email}} placeholders are substituted per-recipient;
  // an unsubscribe link is appended automatically at send time, not stored here.
  html: string;
  audienceTags: string[];
  audienceContactIds: mongoose.Types.ObjectId[];
  status: "DRAFT" | "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  stats: { total: number; sent: number; delivered: number; opened: number; clicked: number; bounced: number; failed: number };
  createdBy: mongoose.Types.ObjectId;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmailCampaignSchema = new Schema<IEmailCampaign>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    subject: { type: String },
    fromName: { type: String },
    html: { type: String },
    audienceTags: [{ type: String }],
    audienceContactIds: [{ type: Schema.Types.ObjectId, ref: "EmailContact" }],
    status: { type: String, enum: ["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "CANCELED"], default: "DRAFT" },
    scheduledAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    stats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
      bounced: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    failureReason: { type: String },
  },
  { timestamps: true }
);

EmailCampaignSchema.index({ companyId: 1, status: 1 });
EmailCampaignSchema.index({ status: 1, scheduledAt: 1 });

const EmailCampaign: Model<IEmailCampaign> =
  mongoose.models.EmailCampaign || mongoose.model<IEmailCampaign>("EmailCampaign", EmailCampaignSchema);
export default EmailCampaign;
