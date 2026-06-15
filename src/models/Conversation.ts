import mongoose, { Schema, Document, Model } from "mongoose";

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  chatbotId?: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  status: "OPEN" | "ASSIGNED" | "PENDING" | "RESOLVED" | "CLOSED";
  channel: "WEB" | "API" | "EMAIL" | "WHATSAPP" | "TELEGRAM";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  visitor: {
    name?: string;
    email?: string;
    phone?: string;
    ip?: string;
    userAgent?: string;
    location?: string;
    country?: string;
    city?: string;
    referrer?: string;
    currentPage?: string;
    isLoggedIn: boolean;
    visitorId: string;
    customAttributes?: Record<string, unknown>;
  };
  tags: string[];
  notes: {
    content: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
  }[];
  firstResponseAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  transferHistory: {
    from?: mongoose.Types.ObjectId;
    to: mongoose.Types.ObjectId;
    reason?: string;
    transferredAt: Date;
    transferredBy: mongoose.Types.ObjectId;
  }[];
  csat?: {
    rating: number;
    feedback?: string;
    submittedAt: Date;
  };
  isBot: boolean;
  botHandedOver: boolean;
  lastMessageAt?: Date;
  messageCount: number;
  waitTime?: number;
  handleTime?: number;
  metadata?: Record<string, unknown>;
  leadId?: mongoose.Types.ObjectId;
  ticketId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    chatbotId: { type: Schema.Types.ObjectId, ref: "Chatbot" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    status: {
      type: String,
      enum: ["OPEN", "ASSIGNED", "PENDING", "RESOLVED", "CLOSED"],
      default: "OPEN",
    },
    channel: { type: String, enum: ["WEB", "API", "EMAIL", "WHATSAPP", "TELEGRAM"], default: "WEB" },
    priority: { type: String, enum: ["LOW", "NORMAL", "HIGH", "URGENT"], default: "NORMAL" },
    visitor: {
      name: String,
      email: String,
      phone: String,
      ip: String,
      userAgent: String,
      location: String,
      country: String,
      city: String,
      referrer: String,
      currentPage: String,
      isLoggedIn: { type: Boolean, default: false },
      visitorId: { type: String, required: true },
      customAttributes: { type: Schema.Types.Mixed },
    },
    tags: [{ type: String }],
    notes: [
      {
        content: String,
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    firstResponseAt: { type: Date },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    transferHistory: [
      {
        from: { type: Schema.Types.ObjectId, ref: "User" },
        to: { type: Schema.Types.ObjectId, ref: "User" },
        reason: String,
        transferredAt: { type: Date, default: Date.now },
        transferredBy: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],
    csat: {
      rating: Number,
      feedback: String,
      submittedAt: Date,
    },
    isBot: { type: Boolean, default: false },
    botHandedOver: { type: Boolean, default: false },
    lastMessageAt: { type: Date },
    messageCount: { type: Number, default: 0 },
    waitTime: { type: Number },
    handleTime: { type: Number },
    metadata: { type: Schema.Types.Mixed },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket" },
  },
  { timestamps: true }
);

ConversationSchema.index({ companyId: 1, status: 1 });
ConversationSchema.index({ companyId: 1, assignedTo: 1 });
ConversationSchema.index({ companyId: 1, createdAt: -1 });
ConversationSchema.index({ "visitor.visitorId": 1 });

const Conversation: Model<IConversation> =
  mongoose.models.Conversation || mongoose.model<IConversation>("Conversation", ConversationSchema);
export default Conversation;
