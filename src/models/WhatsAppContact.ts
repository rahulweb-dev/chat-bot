import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWhatsAppContact extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name?: string;
  phone: string;
  email?: string;
  city?: string;
  tags: string[];
  optIn: boolean;
  optInAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppContactSchema = new Schema<IWhatsAppContact>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String },
    phone: { type: String, required: true },
    email: { type: String },
    city: { type: String },
    tags: [{ type: String }],
    optIn: { type: Boolean, default: false },
    optInAt: { type: Date },
  },
  { timestamps: true }
);

WhatsAppContactSchema.index({ companyId: 1, phone: 1 }, { unique: true });
WhatsAppContactSchema.index({ companyId: 1, tags: 1 });

const WhatsAppContact: Model<IWhatsAppContact> =
  mongoose.models.WhatsAppContact || mongoose.model<IWhatsAppContact>("WhatsAppContact", WhatsAppContactSchema);
export default WhatsAppContact;
