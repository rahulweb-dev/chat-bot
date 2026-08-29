import mongoose, { Schema, Document, Model } from "mongoose";
import crypto from "crypto";

export interface IEmailContact extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name?: string;
  email: string;
  tags: string[];
  optIn: boolean;
  optInAt?: Date;
  optOutAt?: Date;
  // Included, unguessable, in every campaign email's unsubscribe link — CAN-SPAM/GDPR
  // require one-click unsubscribe with no login, so this can't be the Mongo _id.
  unsubscribeToken: string;
  bounced: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmailContactSchema = new Schema<IEmailContact>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String },
    email: { type: String, required: true, lowercase: true, trim: true },
    tags: [{ type: String }],
    optIn: { type: Boolean, default: true },
    optInAt: { type: Date, default: Date.now },
    optOutAt: { type: Date },
    unsubscribeToken: { type: String, default: () => crypto.randomBytes(24).toString("hex"), unique: true },
    bounced: { type: Boolean, default: false },
  },
  { timestamps: true }
);

EmailContactSchema.index({ companyId: 1, email: 1 }, { unique: true });
EmailContactSchema.index({ companyId: 1, tags: 1 });

const EmailContact: Model<IEmailContact> =
  mongoose.models.EmailContact || mongoose.model<IEmailContact>("EmailContact", EmailContactSchema);
export default EmailContact;
