import mongoose, { Schema, Document, Model } from "mongoose";

export interface ILead extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  website?: string;
  source: string;
  stage: "NEW" | "CONTACTED" | "QUALIFIED" | "MEETING" | "PROPOSAL" | "WON" | "LOST";
  score: number;
  value?: number;
  currency?: string;
  tags: string[];
  notes: {
    content: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
  }[];
  activities: {
    type: string;
    description: string;
    createdBy?: mongoose.Types.ObjectId;
    createdAt: Date;
  }[];
  customFields?: Record<string, unknown>;
  conversationId?: mongoose.Types.ObjectId;
  lostReason?: string;
  expectedCloseDate?: Date;
  closedAt?: Date;
  lastContactedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LeadSchema = new Schema<ILead>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    company: { type: String },
    title: { type: String },
    website: { type: String },
    source: { type: String, default: "CHAT" },
    stage: {
      type: String,
      enum: ["NEW", "CONTACTED", "QUALIFIED", "MEETING", "PROPOSAL", "WON", "LOST"],
      default: "NEW",
    },
    score: { type: Number, default: 0 },
    value: { type: Number },
    currency: { type: String, default: "USD" },
    tags: [{ type: String }],
    notes: [
      {
        content: String,
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    activities: [
      {
        type: String,
        description: String,
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    customFields: { type: Schema.Types.Mixed },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation" },
    lostReason: { type: String },
    expectedCloseDate: { type: Date },
    closedAt: { type: Date },
    lastContactedAt: { type: Date },
  },
  { timestamps: true }
);

LeadSchema.index({ companyId: 1, stage: 1 });
LeadSchema.index({ companyId: 1, assignedTo: 1 });
LeadSchema.index({ companyId: 1, email: 1 });
LeadSchema.index({ companyId: 1, createdAt: -1 });

const Lead: Model<ILead> = mongoose.models.Lead || mongoose.model<ILead>("Lead", LeadSchema);
export default Lead;
