import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISubscription extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  status: "ACTIVE" | "INACTIVE" | "CANCELLED" | "PAST_DUE" | "TRIALING";
  billingCycle: "MONTHLY" | "ANNUALLY";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  amount: number;
  currency: string;
  nextBillingDate?: Date;
  trialStart?: Date;
  trialEnd?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "CANCELLED", "PAST_DUE", "TRIALING"],
      default: "ACTIVE",
    },
    billingCycle: { type: String, enum: ["MONTHLY", "ANNUALLY"], default: "MONTHLY" },
    currentPeriodStart: { type: Date, required: true },
    currentPeriodEnd: { type: Date, required: true },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    cancelledAt: { type: Date },
    stripeSubscriptionId: { type: String },
    stripeCustomerId: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    nextBillingDate: { type: Date },
    trialStart: { type: Date },
    trialEnd: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ companyId: 1 });
SubscriptionSchema.index({ status: 1 });

const Subscription: Model<ISubscription> =
  mongoose.models.Subscription || mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
export default Subscription;
