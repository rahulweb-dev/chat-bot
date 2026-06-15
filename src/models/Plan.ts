import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPlan extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: "STARTER" | "PRO" | "ENTERPRISE";
  description: string;
  price: {
    monthly: number;
    annually: number;
  };
  currency: string;
  stripePriceId?: {
    monthly?: string;
    annually?: string;
  };
  limits: {
    agents: number;
    chats: number;
    aiMessages: number;
    storage: number;
    knowledgeFiles: number;
    workflows: number;
    apiRequests: number;
    departments: number;
    chatbots: number;
    leads: number;
    tickets: number;
  };
  features: string[];
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["STARTER", "PRO", "ENTERPRISE"], required: true, unique: true },
    description: { type: String, required: true },
    price: {
      monthly: { type: Number, required: true },
      annually: { type: Number, required: true },
    },
    currency: { type: String, default: "USD" },
    stripePriceId: {
      monthly: String,
      annually: String,
    },
    limits: {
      agents: { type: Number, default: 2 },
      chats: { type: Number, default: 1000 },
      aiMessages: { type: Number, default: 500 },
      storage: { type: Number, default: 1024 },
      knowledgeFiles: { type: Number, default: 10 },
      workflows: { type: Number, default: 3 },
      apiRequests: { type: Number, default: 10000 },
      departments: { type: Number, default: 2 },
      chatbots: { type: Number, default: 1 },
      leads: { type: Number, default: 500 },
      tickets: { type: Number, default: 500 },
    },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Plan: Model<IPlan> = mongoose.models.Plan || mongoose.model<IPlan>("Plan", PlanSchema);
export default Plan;
