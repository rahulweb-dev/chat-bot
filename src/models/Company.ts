import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICompany extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  website?: string;
  logo?: string;
  industry?: string;
  size?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
  timezone: string;
  currency: string;
  language: string;
  planId: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  isActive: boolean;
  isSuspended: boolean;
  suspendReason?: string;
  trialEndsAt?: Date;
  settings: {
    brandColor: string;
    accentColor: string;
    widgetPosition: "bottom-right" | "bottom-left";
    welcomeMessage: string;
    offlineMessage: string;
    operatingHours?: {
      enabled: boolean;
      timezone: string;
      hours: { day: number; open: string; close: string; isOpen: boolean }[];
    };
    assignmentStrategy: string;
    autoAssign: boolean;
    requireLogin: boolean;
    collectEmail: boolean;
    collectPhone: boolean;
  };
  whiteLabelSettings?: {
    customDomain?: string;
    hideBranding: boolean;
    customCss?: string;
    favicon?: string;
  };
  apiKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    email: { type: String, required: true },
    phone: { type: String },
    website: { type: String },
    logo: { type: String },
    industry: { type: String },
    size: { type: String },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zip: String,
    },
    timezone: { type: String, default: "UTC" },
    currency: { type: String, default: "USD" },
    language: { type: String, default: "en" },
    planId: { type: Schema.Types.ObjectId, ref: "Plan", required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: "Subscription" },
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    suspendReason: { type: String },
    trialEndsAt: { type: Date },
    settings: {
      brandColor: { type: String, default: "#6366f1" },
      accentColor: { type: String, default: "#8b5cf6" },
      widgetPosition: { type: String, enum: ["bottom-right", "bottom-left"], default: "bottom-right" },
      welcomeMessage: { type: String, default: "Hi! How can we help you today?" },
      offlineMessage: { type: String, default: "We are currently offline. Leave a message and we'll get back to you." },
      operatingHours: {
        enabled: { type: Boolean, default: false },
        timezone: { type: String, default: "UTC" },
        hours: [
          {
            day: Number,
            open: String,
            close: String,
            isOpen: Boolean,
          },
        ],
      },
      assignmentStrategy: { type: String, default: "ROUND_ROBIN" },
      autoAssign: { type: Boolean, default: true },
      requireLogin: { type: Boolean, default: false },
      collectEmail: { type: Boolean, default: true },
      collectPhone: { type: Boolean, default: false },
    },
    whiteLabelSettings: {
      customDomain: String,
      hideBranding: { type: Boolean, default: false },
      customCss: String,
      favicon: String,
    },
    apiKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

CompanySchema.index({ isActive: 1 });

const Company: Model<ICompany> = mongoose.models.Company || mongoose.model<ICompany>("Company", CompanySchema);
export default Company;
