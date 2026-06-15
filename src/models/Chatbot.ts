import mongoose, { Schema, Document, Model } from "mongoose";

export interface IChatbot extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  avatar?: string;
  isActive: boolean;
  type: "FAQ" | "LEAD_GEN" | "APPOINTMENT" | "CUSTOM";
  welcomeMessage: string;
  fallbackMessage: string;
  handoverMessage: string;
  enableHumanHandover: boolean;
  handoverThreshold: number;
  flows: {
    id: string;
    trigger: string;
    conditions?: { field: string; operator: string; value: string }[];
    actions: { type: string; payload: Record<string, unknown> }[];
  }[];
  knowledgeBaseIds: mongoose.Types.ObjectId[];
  departmentId?: mongoose.Types.ObjectId;
  languages: string[];
  settings: {
    collectEmail: boolean;
    collectPhone: boolean;
    collectName: boolean;
    qualifyLeads: boolean;
    bookAppointments: boolean;
    sentimentAnalysis: boolean;
    intentDetection: boolean;
  };
  stats: {
    totalConversations: number;
    resolvedByBot: number;
    handedToAgent: number;
    avgSatisfaction: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ChatbotSchema = new Schema<IChatbot>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    description: { type: String },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    type: { type: String, enum: ["FAQ", "LEAD_GEN", "APPOINTMENT", "CUSTOM"], default: "FAQ" },
    welcomeMessage: { type: String, default: "Hi! How can I help you today?" },
    fallbackMessage: { type: String, default: "I'm not sure about that. Let me connect you with a human agent." },
    handoverMessage: { type: String, default: "Connecting you with a live agent..." },
    enableHumanHandover: { type: Boolean, default: true },
    handoverThreshold: { type: Number, default: 3 },
    flows: [
      {
        id: String,
        trigger: String,
        conditions: [{ field: String, operator: String, value: String }],
        actions: [{ type: String, payload: Schema.Types.Mixed }],
      },
    ],
    knowledgeBaseIds: [{ type: Schema.Types.ObjectId, ref: "KnowledgeBase" }],
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    languages: [{ type: String, default: ["en"] }],
    settings: {
      collectEmail: { type: Boolean, default: true },
      collectPhone: { type: Boolean, default: false },
      collectName: { type: Boolean, default: true },
      qualifyLeads: { type: Boolean, default: false },
      bookAppointments: { type: Boolean, default: false },
      sentimentAnalysis: { type: Boolean, default: true },
      intentDetection: { type: Boolean, default: true },
    },
    stats: {
      totalConversations: { type: Number, default: 0 },
      resolvedByBot: { type: Number, default: 0 },
      handedToAgent: { type: Number, default: 0 },
      avgSatisfaction: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

ChatbotSchema.index({ companyId: 1 });

const Chatbot: Model<IChatbot> = mongoose.models.Chatbot || mongoose.model<IChatbot>("Chatbot", ChatbotSchema);
export default Chatbot;
