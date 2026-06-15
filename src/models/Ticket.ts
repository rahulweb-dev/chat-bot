import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITicket extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  ticketNumber: string;
  subject: string;
  description: string;
  status: "OPEN" | "ASSIGNED" | "PENDING" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  category?: string;
  tags: string[];
  assignedTo?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  requester: {
    name: string;
    email: string;
    phone?: string;
  };
  conversationId?: mongoose.Types.ObjectId;
  leadId?: mongoose.Types.ObjectId;
  attachments?: {
    name: string;
    url: string;
    type: string;
    size: number;
  }[];
  comments: {
    content: string;
    isInternal: boolean;
    createdBy?: mongoose.Types.ObjectId;
    requesterComment: boolean;
    createdAt: Date;
    attachments?: { name: string; url: string }[];
  }[];
  slaPolicy?: {
    firstResponseDue?: Date;
    resolutionDue?: Date;
    firstResponseBreached: boolean;
    resolutionBreached: boolean;
  };
  resolvedAt?: Date;
  closedAt?: Date;
  firstResponseAt?: Date;
  reopenedAt?: Date;
  customFields?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    ticketNumber: { type: String, required: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: ["OPEN", "ASSIGNED", "PENDING", "RESOLVED", "CLOSED"],
      default: "OPEN",
    },
    priority: { type: String, enum: ["LOW", "NORMAL", "HIGH", "URGENT"], default: "NORMAL" },
    category: { type: String },
    tags: [{ type: String }],
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    requester: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: String,
    },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation" },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    attachments: [{ name: String, url: String, type: String, size: Number }],
    comments: [
      {
        content: String,
        isInternal: { type: Boolean, default: false },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        requesterComment: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        attachments: [{ name: String, url: String }],
      },
    ],
    slaPolicy: {
      firstResponseDue: Date,
      resolutionDue: Date,
      firstResponseBreached: { type: Boolean, default: false },
      resolutionBreached: { type: Boolean, default: false },
    },
    resolvedAt: Date,
    closedAt: Date,
    firstResponseAt: Date,
    reopenedAt: Date,
    customFields: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

TicketSchema.index({ companyId: 1, status: 1 });
TicketSchema.index({ companyId: 1, assignedTo: 1 });
TicketSchema.index({ companyId: 1, ticketNumber: 1 }, { unique: true });

const Ticket: Model<ITicket> = mongoose.models.Ticket || mongoose.model<ITicket>("Ticket", TicketSchema);
export default Ticket;
