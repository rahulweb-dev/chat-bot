import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWhatsAppCampaign extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name: string;
  channel: "WHATSAPP";
  templateName?: string;
  templateLanguage: string;
  audienceTags: string[];
  audienceContactIds: mongoose.Types.ObjectId[];
  status: "DRAFT" | "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELED";
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  stats: { total: number; sent: number; delivered: number; read: number; failed: number };
  createdBy: mongoose.Types.ObjectId;
  failureReason?: string;
  // Rich content bound to the approved template's variables/header/buttons
  offerTitle?: string;
  offerDescription?: string;
  offerImageUrl?: string;
  bannerImageUrl?: string;
  ctaType: "VISIT_WEBSITE" | "CALL_PHONE" | "NONE";
  ctaUrl?: string;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppCampaignSchema = new Schema<IWhatsAppCampaign>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    channel: { type: String, enum: ["WHATSAPP"], default: "WHATSAPP" },
    // Not required at the schema level: drafts are saved incrementally as the
    // wizard progresses. Required-ness for launch/schedule is enforced in the route.
    templateName: { type: String },
    templateLanguage: { type: String, default: "en_US" },
    audienceTags: [{ type: String }],
    audienceContactIds: [{ type: Schema.Types.ObjectId, ref: "WhatsAppContact" }],
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
    offerTitle: { type: String },
    offerDescription: { type: String },
    offerImageUrl: { type: String },
    bannerImageUrl: { type: String },
    ctaType: { type: String, enum: ["VISIT_WEBSITE", "CALL_PHONE", "NONE"], default: "NONE" },
    ctaUrl: { type: String },
    variables: [{ type: String }],
    failureReason: { type: String },
  },
  { timestamps: true }
);

WhatsAppCampaignSchema.index({ companyId: 1, status: 1 });
WhatsAppCampaignSchema.index({ status: 1, scheduledAt: 1 });

const WhatsAppCampaign: Model<IWhatsAppCampaign> =
  mongoose.models.WhatsAppCampaign || mongoose.model<IWhatsAppCampaign>("WhatsAppCampaign", WhatsAppCampaignSchema);
export default WhatsAppCampaign;
