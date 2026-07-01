import mongoose, { Schema, Document } from "mongoose";

export interface ICannedResponse extends Document {
  companyId: mongoose.Types.ObjectId;
  title: string;
  shortcut: string;
  content: string;
  category: string;
  isActive: boolean;
  usageCount: number;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CannedResponseSchema = new Schema<ICannedResponse>(
  {
    companyId:  { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    title:      { type: String, required: true, trim: true },
    shortcut:   { type: String, required: true, trim: true, lowercase: true },
    content:    { type: String, required: true },
    category:   { type: String, default: "General" },
    isActive:   { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },
    createdBy:  { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CannedResponseSchema.index({ companyId: 1, shortcut: 1 }, { unique: true });

export default mongoose.models.CannedResponse ||
  mongoose.model<ICannedResponse>("CannedResponse", CannedResponseSchema);
