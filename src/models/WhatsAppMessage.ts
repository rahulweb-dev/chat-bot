import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWhatsAppMessage extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  conversationId: mongoose.Types.ObjectId;
  direction: "INBOUND" | "OUTBOUND";
  messageType: "TEXT" | "IMAGE" | "DOCUMENT" | "AUDIO" | "VIDEO" | "TEMPLATE";
  content?: string;
  mediaUrl?: string;
  templateName?: string;
  whatsappMessageId?: string;
  status: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  failReason?: string;
  senderId?: mongoose.Types.ObjectId;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdAt: Date;
}

const WhatsAppMessageSchema = new Schema<IWhatsAppMessage>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "WhatsAppConversation", required: true },
    direction: { type: String, enum: ["INBOUND", "OUTBOUND"], required: true },
    messageType: { type: String, enum: ["TEXT", "IMAGE", "DOCUMENT", "AUDIO", "VIDEO", "TEMPLATE"], default: "TEXT" },
    content: { type: String },
    mediaUrl: { type: String },
    templateName: { type: String },
    whatsappMessageId: { type: String },
    status: { type: String, enum: ["QUEUED", "SENT", "DELIVERED", "READ", "FAILED"], default: "QUEUED" },
    failReason: { type: String },
    senderId: { type: Schema.Types.ObjectId, ref: "User" },
    sentAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

WhatsAppMessageSchema.index({ conversationId: 1, createdAt: 1 });
WhatsAppMessageSchema.index({ companyId: 1 });
WhatsAppMessageSchema.index({ whatsappMessageId: 1 }, { unique: true, sparse: true });

const WhatsAppMessage: Model<IWhatsAppMessage> =
  mongoose.models.WhatsAppMessage || mongoose.model<IWhatsAppMessage>("WhatsAppMessage", WhatsAppMessageSchema);
export default WhatsAppMessage;
