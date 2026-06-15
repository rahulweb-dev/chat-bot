import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  senderId?: mongoose.Types.ObjectId;
  senderType: "AGENT" | "VISITOR" | "BOT" | "SYSTEM";
  type: "TEXT" | "IMAGE" | "FILE" | "VOICE" | "VIDEO" | "SYSTEM" | "NOTE";
  content: string;
  attachments?: {
    name: string;
    url: string;
    type: string;
    size: number;
  }[];
  isRead: boolean;
  readAt?: Date;
  isDelivered: boolean;
  deliveredAt?: Date;
  isNote: boolean;
  replyTo?: mongoose.Types.ObjectId;
  sentiment?: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  intent?: string;
  suggestedReplies?: string[];
  aiGenerated: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User" },
    senderType: { type: String, enum: ["AGENT", "VISITOR", "BOT", "SYSTEM"], required: true },
    type: { type: String, enum: ["TEXT", "IMAGE", "FILE", "VOICE", "VIDEO", "SYSTEM", "NOTE"], default: "TEXT" },
    content: { type: String, required: true },
    attachments: [
      {
        name: String,
        url: String,
        type: String,
        size: Number,
      },
    ],
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date },
    isNote: { type: Boolean, default: false },
    replyTo: { type: Schema.Types.ObjectId, ref: "Message" },
    sentiment: { type: String, enum: ["POSITIVE", "NEGATIVE", "NEUTRAL"] },
    intent: { type: String },
    suggestedReplies: [{ type: String }],
    aiGenerated: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: 1 });
MessageSchema.index({ companyId: 1 });
MessageSchema.index({ senderId: 1 });

const Message: Model<IMessage> = mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
export default Message;
