import mongoose, { Schema, Document, Model } from "mongoose";

export interface IKnowledgeBase extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: "PDF" | "DOCX" | "TXT" | "CSV" | "URL" | "MANUAL";
  status: "PROCESSING" | "READY" | "FAILED" | "PENDING";
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  sourceUrl?: string;
  content?: string;
  chunks?: {
    content: string;
    embedding?: number[];
    metadata?: Record<string, unknown>;
  }[];
  category?: string;
  tags: string[];
  isPublic: boolean;
  accessibleBy: "ALL" | "AGENTS" | "BOT_ONLY";
  language: string;
  version: number;
  processedAt?: Date;
  errorMessage?: string;
  usageCount: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    description: { type: String },
    type: { type: String, enum: ["PDF", "DOCX", "TXT", "CSV", "URL", "MANUAL"], required: true },
    status: { type: String, enum: ["PROCESSING", "READY", "FAILED", "PENDING"], default: "PENDING" },
    fileUrl: { type: String },
    fileName: { type: String },
    fileSize: { type: Number },
    sourceUrl: { type: String },
    content: { type: String },
    chunks: [
      {
        content: String,
        embedding: [Number],
        metadata: Schema.Types.Mixed,
      },
    ],
    category: { type: String },
    tags: [{ type: String }],
    isPublic: { type: Boolean, default: false },
    accessibleBy: { type: String, enum: ["ALL", "AGENTS", "BOT_ONLY"], default: "ALL" },
    language: { type: String, default: "en" },
    version: { type: Number, default: 1 },
    processedAt: { type: Date },
    errorMessage: { type: String },
    usageCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

KnowledgeBaseSchema.index({ companyId: 1 });
KnowledgeBaseSchema.index({ companyId: 1, status: 1 });

const KnowledgeBase: Model<IKnowledgeBase> =
  mongoose.models.KnowledgeBase || mongoose.model<IKnowledgeBase>("KnowledgeBase", KnowledgeBaseSchema);
export default KnowledgeBase;
