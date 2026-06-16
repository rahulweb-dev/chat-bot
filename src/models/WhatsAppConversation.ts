import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWhatsAppConversation extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  contactId?: mongoose.Types.ObjectId;
  customerPhone: string;
  customerName?: string;
  assignedAgentId?: mongoose.Types.ObjectId;
  status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
  lastMessage?: string;
  lastMessageAt?: Date;
  tags: string[];
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppConversationSchema = new Schema<IWhatsAppConversation>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    contactId: { type: Schema.Types.ObjectId, ref: "WhatsAppContact" },
    customerPhone: { type: String, required: true },
    customerName: { type: String },
    assignedAgentId: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: ["OPEN", "PENDING", "RESOLVED", "CLOSED"], default: "OPEN" },
    lastMessage: { type: String },
    lastMessageAt: { type: Date },
    tags: [{ type: String }],
    unreadCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

WhatsAppConversationSchema.index({ companyId: 1, status: 1 });
WhatsAppConversationSchema.index({ companyId: 1, lastMessageAt: -1 });
WhatsAppConversationSchema.index({ companyId: 1, customerPhone: 1 });

const WhatsAppConversation: Model<IWhatsAppConversation> =
  mongoose.models.WhatsAppConversation || mongoose.model<IWhatsAppConversation>("WhatsAppConversation", WhatsAppConversationSchema);
export default WhatsAppConversation;
