import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRCSCampaignRecipient extends Document {
  _id: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  contactId: mongoose.Types.ObjectId;
  phone: string;
  status: "PENDING" | "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "UNDELIVERED";
  twilioMessageSid?: string;
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
}

const RCSCampaignRecipientSchema = new Schema<IRCSCampaignRecipient>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "RCSCampaign", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    contactId: { type: Schema.Types.ObjectId, ref: "RCSContact", required: true },
    phone: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "QUEUED", "SENT", "DELIVERED", "READ", "FAILED", "UNDELIVERED"], default: "PENDING" },
    twilioMessageSid: { type: String },
    error: { type: String },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

RCSCampaignRecipientSchema.index({ campaignId: 1, status: 1 });
RCSCampaignRecipientSchema.index({ twilioMessageSid: 1 }, { sparse: true });
// See WhatsAppCampaignRecipient's identical indexes for why.
RCSCampaignRecipientSchema.index({ companyId: 1, createdAt: -1 });
RCSCampaignRecipientSchema.index({ campaignId: 1, createdAt: -1 });

const RCSCampaignRecipient: Model<IRCSCampaignRecipient> =
  mongoose.models.RCSCampaignRecipient ||
  mongoose.model<IRCSCampaignRecipient>("RCSCampaignRecipient", RCSCampaignRecipientSchema);
export default RCSCampaignRecipient;
