import mongoose, { Schema, Document, Model } from "mongoose";

export interface INotification extends Document {
  _id: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: "USAGE_ALERT" | "NEW_CHAT" | "TICKET_ASSIGNED" | "LEAD_CREATED" | "SYSTEM" | "BILLING" | "CHAT_TRANSFERRED";
  title: string;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  link?: string;
  priority: "LOW" | "NORMAL" | "HIGH";
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["USAGE_ALERT", "NEW_CHAT", "TICKET_ASSIGNED", "LEAD_CREATED", "SYSTEM", "BILLING", "CHAT_TRANSFERRED"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    link: { type: String },
    priority: { type: String, enum: ["LOW", "NORMAL", "HIGH"], default: "NORMAL" },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ companyId: 1 });

const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
export default Notification;
