import mongoose, { Schema, Document, Model } from "mongoose";

export interface IWhatsAppWallet extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  balance: number;
  currency: string;
  perMessageCost: number;
  dailyLimit: number;
  dailyUsed: number;
  lastResetDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WhatsAppWalletSchema = new Schema<IWhatsAppWallet>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, unique: true },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    perMessageCost: { type: Number, default: 0.8 },
    dailyLimit: { type: Number, default: 1000 },
    dailyUsed: { type: Number, default: 0 },
    lastResetDate: { type: Date, default: () => new Date(new Date().setHours(0, 0, 0, 0)) },
  },
  { timestamps: true }
);

const WhatsAppWallet: Model<IWhatsAppWallet> =
  mongoose.models.WhatsAppWallet || mongoose.model<IWhatsAppWallet>("WhatsAppWallet", WhatsAppWalletSchema);
export default WhatsAppWallet;
