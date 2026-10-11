import mongoose, { Schema, Document, Model } from "mongoose";

// One row per checkout attempt. The plan and amount are fixed here at checkout
// time, so the payment confirmation (browser callback or webhook) never has to
// trust anything the client sends about what was bought.
export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  billingCycle: "MONTHLY" | "ANNUALLY";
  amount: number; // major units (₹), as stored on the Plan
  currency: string;
  provider: "RAZORPAY";
  orderId: string;
  paymentId?: string;
  status: "CREATED" | "PAID" | "FAILED";
  failureReason?: string;
  subscriptionId?: mongoose.Types.ObjectId;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    billingCycle: { type: String, enum: ["MONTHLY", "ANNUALLY"], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    provider: { type: String, enum: ["RAZORPAY"], default: "RAZORPAY" },
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String },
    status: { type: String, enum: ["CREATED", "PAID", "FAILED"], default: "CREATED" },
    failureReason: { type: String },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription" },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

PaymentSchema.index({ companyId: 1, createdAt: -1 });

const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
export default Payment;
