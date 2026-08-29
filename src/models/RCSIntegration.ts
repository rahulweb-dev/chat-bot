import mongoose, { Schema, Document, Model } from "mongoose";

// Twilio is the aggregator: one account covers RCS Business Messaging with automatic
// SMS fallback when a recipient's device/carrier doesn't support RCS, so there's no
// separate "channel" field the way Meta requires — Twilio picks per-recipient.
export interface IRCSIntegration extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  encryptedAccountSid: string;
  encryptedAuthToken: string;
  // The RCS Agent's Messaging Service SID (or approved sender), configured in Twilio Console.
  messagingServiceSid: string;
  enabled: boolean;
  lastTestedAt?: Date;
  lastTestStatus?: "SUCCESS" | "FAILURE";
  lastTestError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RCSIntegrationSchema = new Schema<IRCSIntegration>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, unique: true },
    encryptedAccountSid: { type: String, required: true },
    encryptedAuthToken: { type: String, required: true },
    messagingServiceSid: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    lastTestedAt: { type: Date },
    lastTestStatus: { type: String, enum: ["SUCCESS", "FAILURE"] },
    lastTestError: { type: String },
  },
  { timestamps: true }
);

const RCSIntegration: Model<IRCSIntegration> =
  mongoose.models.RCSIntegration || mongoose.model<IRCSIntegration>("RCSIntegration", RCSIntegrationSchema);
export default RCSIntegration;
