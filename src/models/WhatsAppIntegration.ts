import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWhatsAppIntegration extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  businessAccountId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  encryptedAccessToken: string;
  encryptedWebhookVerifyToken: string;
  enabled: boolean;
  lastTestedAt?: Date;
  lastTestStatus?: "SUCCESS" | "FAILURE";
  lastTestError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppIntegrationSchema = new Schema<IWhatsAppIntegration>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, unique: true },
    businessAccountId: { type: String, required: true },
    phoneNumberId: { type: String, required: true, unique: true },
    displayPhoneNumber: { type: String },
    encryptedAccessToken: { type: String, required: true },
    encryptedWebhookVerifyToken: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    lastTestedAt: { type: Date },
    lastTestStatus: { type: String, enum: ["SUCCESS", "FAILURE"] },
    lastTestError: { type: String },
  },
  { timestamps: true }
);

const WhatsAppIntegration: Model<IWhatsAppIntegration> =
  mongoose.models.WhatsAppIntegration || mongoose.model<IWhatsAppIntegration>("WhatsAppIntegration", WhatsAppIntegrationSchema);
export default WhatsAppIntegration;
