import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAnalytics extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  date: Date;
  period: "DAILY" | "WEEKLY" | "MONTHLY";
  visitors: number;
  newVisitors: number;
  chats: {
    total: number;
    resolved: number;
    avgResponseTime: number;
    avgResolutionTime: number;
    byChannel: Record<string, number>;
    byStatus: Record<string, number>;
  };
  leads: {
    total: number;
    qualified: number;
    won: number;
    lost: number;
    conversionRate: number;
  };
  tickets: {
    total: number;
    resolved: number;
    avgResolutionTime: number;
    byPriority: Record<string, number>;
  };
  agents: {
    agentId: mongoose.Types.ObjectId;
    name: string;
    chatsHandled: number;
    avgResponseTime: number;
    avgResolutionTime: number;
    csat: number;
    onlineTime: number;
  }[];
  csat: {
    avg: number;
    total: number;
    distribution: Record<string, number>;
  };
  aiUsage: {
    totalMessages: number;
    botResolved: number;
    handedToAgent: number;
    avgConfidence: number;
  };
  peakHours: { hour: number; count: number }[];
  topPages: { page: string; count: number }[];
  topCountries: { country: string; count: number }[];
  createdAt: Date;
  updatedAt: Date;
}

const AnalyticsSchema = new Schema<IAnalytics>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    date: { type: Date, required: true },
    period: { type: String, enum: ["DAILY", "WEEKLY", "MONTHLY"], default: "DAILY" },
    visitors: { type: Number, default: 0 },
    newVisitors: { type: Number, default: 0 },
    chats: {
      total: { type: Number, default: 0 },
      resolved: { type: Number, default: 0 },
      avgResponseTime: { type: Number, default: 0 },
      avgResolutionTime: { type: Number, default: 0 },
      byChannel: { type: Schema.Types.Mixed, default: {} },
      byStatus: { type: Schema.Types.Mixed, default: {} },
    },
    leads: {
      total: { type: Number, default: 0 },
      qualified: { type: Number, default: 0 },
      won: { type: Number, default: 0 },
      lost: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
    },
    tickets: {
      total: { type: Number, default: 0 },
      resolved: { type: Number, default: 0 },
      avgResolutionTime: { type: Number, default: 0 },
      byPriority: { type: Schema.Types.Mixed, default: {} },
    },
    agents: [
      {
        agentId: { type: Schema.Types.ObjectId, ref: "User" },
        name: String,
        chatsHandled: { type: Number, default: 0 },
        avgResponseTime: { type: Number, default: 0 },
        avgResolutionTime: { type: Number, default: 0 },
        csat: { type: Number, default: 0 },
        onlineTime: { type: Number, default: 0 },
      },
    ],
    csat: {
      avg: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      distribution: { type: Schema.Types.Mixed, default: {} },
    },
    aiUsage: {
      totalMessages: { type: Number, default: 0 },
      botResolved: { type: Number, default: 0 },
      handedToAgent: { type: Number, default: 0 },
      avgConfidence: { type: Number, default: 0 },
    },
    peakHours: [{ hour: Number, count: Number }],
    topPages: [{ page: String, count: Number }],
    topCountries: [{ country: String, count: Number }],
  },
  { timestamps: true }
);

AnalyticsSchema.index({ companyId: 1, date: -1 });
AnalyticsSchema.index({ companyId: 1, period: 1, date: -1 });

const Analytics: Model<IAnalytics> =
  mongoose.models.Analytics || mongoose.model<IAnalytics>("Analytics", AnalyticsSchema);
export default Analytics;
