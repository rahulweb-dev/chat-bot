import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWorkflow extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: {
    type: "NEW_CONVERSATION" | "MESSAGE_RECEIVED" | "TICKET_CREATED" | "LEAD_CREATED" | "CSAT_SUBMITTED" | "SCHEDULED";
    conditions?: {
      field: string;
      operator: "equals" | "contains" | "startsWith" | "endsWith" | "greaterThan" | "lessThan";
      value: string;
    }[];
    schedule?: string;
  };
  actions: {
    order: number;
    type: "ASSIGN_AGENT" | "ASSIGN_DEPARTMENT" | "ADD_TAG" | "SEND_MESSAGE" | "SEND_EMAIL" | "CREATE_TICKET" | "CREATE_LEAD" | "UPDATE_STATUS" | "NOTIFY_AGENT" | "DELAY" | "WEBHOOK";
    config: Record<string, unknown>;
  }[];
  executionCount: number;
  lastExecutedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowSchema = new Schema<IWorkflow>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    trigger: {
      type: {
        type: String,
        enum: ["NEW_CONVERSATION", "MESSAGE_RECEIVED", "TICKET_CREATED", "LEAD_CREATED", "CSAT_SUBMITTED", "SCHEDULED"],
        required: true,
      },
      conditions: [
        {
          field: String,
          operator: { type: String, enum: ["equals", "contains", "startsWith", "endsWith", "greaterThan", "lessThan"] },
          value: String,
        },
      ],
      schedule: String,
    },
    actions: [
      {
        order: { type: Number, required: true },
        type: {
          type: String,
          enum: ["ASSIGN_AGENT", "ASSIGN_DEPARTMENT", "ADD_TAG", "SEND_MESSAGE", "SEND_EMAIL", "CREATE_TICKET", "CREATE_LEAD", "UPDATE_STATUS", "NOTIFY_AGENT", "DELAY", "WEBHOOK"],
        },
        config: { type: Schema.Types.Mixed },
      },
    ],
    executionCount: { type: Number, default: 0 },
    lastExecutedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

WorkflowSchema.index({ companyId: 1 });
WorkflowSchema.index({ companyId: 1, isActive: 1 });

const Workflow: Model<IWorkflow> = mongoose.models.Workflow || mongoose.model<IWorkflow>("Workflow", WorkflowSchema);
export default Workflow;
