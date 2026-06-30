import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITrainingEntry {
  trigger: string;
  keywords: string[];
  response: string;
  isActive: boolean;
}

export interface IChatbotConfig extends Document {
  companyId: mongoose.Types.ObjectId;
  faqs: { question: string; answer: string; isActive: boolean }[];
  offers: { title: string; description: string; validUntil?: string; isActive: boolean }[];
  vehicles: { name: string; category: string; payload: string; priceRange: string; description: string; isActive: boolean }[];
  businessHours: { day: string; open: string; close: string; isClosed: boolean }[];
  training: ITrainingEntry[];
  customFlow: { enabled: boolean; flow: Record<string, unknown> | null };
  agentOnlineMessage: string;
  agentOfflineMessage: string;
  welcomeMessage: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatbotConfigSchema = new Schema<IChatbotConfig>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, unique: true },
    faqs: [{
      question: { type: String, required: true },
      answer:   { type: String, required: true },
      isActive: { type: Boolean, default: true },
    }],
    offers: [{
      title:       { type: String, required: true },
      description: { type: String, required: true },
      validUntil:  { type: String },
      isActive:    { type: Boolean, default: true },
    }],
    vehicles: [{
      name:        { type: String, required: true },
      category:    { type: String, required: true },
      payload:     { type: String },
      priceRange:  { type: String },
      description: { type: String },
      isActive:    { type: Boolean, default: true },
    }],
    businessHours: [{
      day:      { type: String, required: true },
      open:     { type: String, default: "09:00" },
      close:    { type: String, default: "18:00" },
      isClosed: { type: Boolean, default: false },
    }],
    training: [{
      trigger:  { type: String, default: "" },
      keywords: [{ type: String }],
      response: { type: String, required: true },
      isActive: { type: Boolean, default: true },
    }],
    customFlow: {
      enabled: { type: Boolean, default: false },
      flow:    { type: Schema.Types.Mixed, default: null },
    },
    agentOnlineMessage:  { type: String, default: "💬 Connecting you to a live agent..." },
    agentOfflineMessage: { type: String, default: "We're offline. Leave your details and we'll call you back!" },
    welcomeMessage:      { type: String, default: "👋 Welcome to Ashok Leyland! How can we help you today?" },
  },
  { timestamps: true }
);

ChatbotConfigSchema.index({ companyId: 1 });

const ChatbotConfig: Model<IChatbotConfig> =
  mongoose.models.ChatbotConfig || mongoose.model<IChatbotConfig>("ChatbotConfig", ChatbotConfigSchema);

export default ChatbotConfig;
