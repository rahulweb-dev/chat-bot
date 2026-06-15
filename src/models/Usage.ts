import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUsage extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  period: string; // "YYYY-MM"
  agents: number;
  departments: number;
  chats: number;
  aiMessages: number;
  leads: number;
  tickets: number;
  apiRequests: number;
  storage: number; // MB used
  knowledgeFiles: number;
  workflows: number;
  chatbots: number;
  alerts: {
    type: "75" | "90" | "100";
    resource: string;
    sentAt: Date;
    acknowledged: boolean;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const UsageSchema = new Schema<IUsage>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    period: { type: String, required: true },
    agents: { type: Number, default: 0 },
    departments: { type: Number, default: 0 },
    chats: { type: Number, default: 0 },
    aiMessages: { type: Number, default: 0 },
    leads: { type: Number, default: 0 },
    tickets: { type: Number, default: 0 },
    apiRequests: { type: Number, default: 0 },
    storage: { type: Number, default: 0 },
    knowledgeFiles: { type: Number, default: 0 },
    workflows: { type: Number, default: 0 },
    chatbots: { type: Number, default: 0 },
    alerts: [
      {
        type: { type: String, enum: ["75", "90", "100"] },
        resource: String,
        sentAt: { type: Date, default: Date.now },
        acknowledged: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true }
);

UsageSchema.index({ companyId: 1, period: 1 }, { unique: true });

const Usage: Model<IUsage> = mongoose.models.Usage || mongoose.model<IUsage>("Usage", UsageSchema);
export default Usage;
