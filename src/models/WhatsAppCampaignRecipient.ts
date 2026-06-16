import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWhatsAppCampaignRecipient extends Document {
  _id: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  contactId: mongoose.Types.ObjectId;
  phone: string;
  status: "PENDING" | "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  whatsappMessageId?: string;
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
}

const WhatsAppCampaignRecipientSchema = new Schema<IWhatsAppCampaignRecipient>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "WhatsAppCampaign", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    contactId: { type: Schema.Types.ObjectId, ref: "WhatsAppContact", required: true },
    phone: { type: String, required: true },
    status: { type: String, enum: ["PENDING", "QUEUED", "SENT", "DELIVERED", "READ", "FAILED"], default: "PENDING" },
    whatsappMessageId: { type: String },
    error: { type: String },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

WhatsAppCampaignRecipientSchema.index({ campaignId: 1, status: 1 });
WhatsAppCampaignRecipientSchema.index({ whatsappMessageId: 1 }, { sparse: true });

const WhatsAppCampaignRecipient: Model<IWhatsAppCampaignRecipient> =
  mongoose.models.WhatsAppCampaignRecipient ||
  mongoose.model<IWhatsAppCampaignRecipient>("WhatsAppCampaignRecipient", WhatsAppCampaignRecipientSchema);
export default WhatsAppCampaignRecipient;
