import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRCSContact extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name?: string;
  phone: string; // E.164
  tags: string[];
  optIn: boolean;
  optInAt?: Date;
  optOutAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RCSContactSchema = new Schema<IRCSContact>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String },
    phone: { type: String, required: true },
    tags: [{ type: String }],
    optIn: { type: Boolean, default: false },
    optInAt: { type: Date },
    optOutAt: { type: Date },
  },
  { timestamps: true }
);

RCSContactSchema.index({ companyId: 1, phone: 1 }, { unique: true });
RCSContactSchema.index({ companyId: 1, tags: 1 });

const RCSContact: Model<IRCSContact> =
  mongoose.models.RCSContact || mongoose.model<IRCSContact>("RCSContact", RCSContactSchema);
export default RCSContact;
