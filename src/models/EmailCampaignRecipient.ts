import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEmailCampaignRecipient extends Document {
  _id: mongoose.Types.ObjectId;
  campaignId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  contactId: mongoose.Types.ObjectId;
  email: string;
  status: "PENDING" | "QUEUED" | "SENT" | "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED" | "COMPLAINED" | "FAILED";
  resendMessageId?: string;
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  createdAt: Date;
}

const EmailCampaignRecipientSchema = new Schema<IEmailCampaignRecipient>(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "EmailCampaign", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    contactId: { type: Schema.Types.ObjectId, ref: "EmailContact", required: true },
    email: { type: String, required: true },
    status: {
      type: String,
      enum: ["PENDING", "QUEUED", "SENT", "DELIVERED", "OPENED", "CLICKED", "BOUNCED", "COMPLAINED", "FAILED"],
      default: "PENDING",
    },
    resendMessageId: { type: String },
    error: { type: String },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    openedAt: { type: Date },
    clickedAt: { type: Date },
    bouncedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

EmailCampaignRecipientSchema.index({ campaignId: 1, status: 1 });
EmailCampaignRecipientSchema.index({ resendMessageId: 1 }, { sparse: true });

const EmailCampaignRecipient: Model<IEmailCampaignRecipient> =
  mongoose.models.EmailCampaignRecipient ||
  mongoose.model<IEmailCampaignRecipient>("EmailCampaignRecipient", EmailCampaignRecipientSchema);
export default EmailCampaignRecipient;
