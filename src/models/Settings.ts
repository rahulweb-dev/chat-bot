import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISettings extends Document {
  _id: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  general: {
    companyName: string;
    supportEmail: string;
    timezone: string;
    language: string;
    dateFormat: string;
    currency: string;
  };
  chat: {
    assignmentStrategy: string;
    autoAssign: boolean;
    maxConcurrentChats: number;
    inactivityTimeout: number;
    autoCloseTimeout: number;
    showTypingIndicator: boolean;
    enableEmoji: boolean;
    enableFileUpload: boolean;
    maxFileSize: number;
    allowedFileTypes: string[];
    enableVoiceMessage: boolean;
    enableCsat: boolean;
    csatMessage: string;
    requireEmail: boolean;
    requireName: boolean;
    requirePhone: boolean;
    preChatForm: boolean;
  };
  notifications: {
    emailNotifications: boolean;
    newChatAlert: boolean;
    ticketAlert: boolean;
    usageAlerts: boolean;
    browserNotifications: boolean;
    slackWebhook?: string;
    webhookUrl?: string;
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    ipWhitelist: string[];
    allowedDomains: string[];
    forcePasswordChange: boolean;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
  };
  billing: {
    stripeCustomerId?: string;
    billingEmail?: string;
    billingAddress?: Record<string, string>;
    invoicePrefix?: string;
  };
  widget: {
    theme: "LIGHT" | "DARK" | "AUTO";
    primaryColor: string;
    position: "BOTTOM_RIGHT" | "BOTTOM_LEFT";
    showLauncher: boolean;
    launcherIcon?: string;
    welcomeMessage: string;
    offlineMessage: string;
    logo?: string;
    showAgentAvatar: boolean;
    showAgentName: boolean;
    languages: string[];
    customCss?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, unique: true },
    general: {
      companyName: { type: String, default: "" },
      supportEmail: { type: String, default: "" },
      timezone: { type: String, default: "UTC" },
      language: { type: String, default: "en" },
      dateFormat: { type: String, default: "MM/DD/YYYY" },
      currency: { type: String, default: "USD" },
    },
    chat: {
      assignmentStrategy: { type: String, default: "ROUND_ROBIN" },
      autoAssign: { type: Boolean, default: true },
      maxConcurrentChats: { type: Number, default: 5 },
      inactivityTimeout: { type: Number, default: 30 },
      autoCloseTimeout: { type: Number, default: 1440 },
      showTypingIndicator: { type: Boolean, default: true },
      enableEmoji: { type: Boolean, default: true },
      enableFileUpload: { type: Boolean, default: true },
      maxFileSize: { type: Number, default: 10 },
      allowedFileTypes: [{ type: String }],
      enableVoiceMessage: { type: Boolean, default: false },
      enableCsat: { type: Boolean, default: true },
      csatMessage: { type: String, default: "How was your experience?" },
      requireEmail: { type: Boolean, default: false },
      requireName: { type: Boolean, default: false },
      requirePhone: { type: Boolean, default: false },
      preChatForm: { type: Boolean, default: false },
    },
    notifications: {
      emailNotifications: { type: Boolean, default: true },
      newChatAlert: { type: Boolean, default: true },
      ticketAlert: { type: Boolean, default: true },
      usageAlerts: { type: Boolean, default: true },
      browserNotifications: { type: Boolean, default: true },
      slackWebhook: String,
      webhookUrl: String,
    },
    security: {
      twoFactorEnabled: { type: Boolean, default: false },
      sessionTimeout: { type: Number, default: 60 },
      ipWhitelist: [{ type: String }],
      allowedDomains: [{ type: String }],
      forcePasswordChange: { type: Boolean, default: false },
      passwordPolicy: {
        minLength: { type: Number, default: 8 },
        requireUppercase: { type: Boolean, default: true },
        requireNumbers: { type: Boolean, default: true },
        requireSpecialChars: { type: Boolean, default: false },
      },
    },
    billing: {
      stripeCustomerId: String,
      billingEmail: String,
      billingAddress: { type: Schema.Types.Mixed },
      invoicePrefix: String,
    },
    widget: {
      theme: { type: String, enum: ["LIGHT", "DARK", "AUTO"], default: "LIGHT" },
      primaryColor: { type: String, default: "#6366f1" },
      position: { type: String, enum: ["BOTTOM_RIGHT", "BOTTOM_LEFT"], default: "BOTTOM_RIGHT" },
      showLauncher: { type: Boolean, default: true },
      launcherIcon: String,
      welcomeMessage: { type: String, default: "Hi! How can we help you today?" },
      offlineMessage: { type: String, default: "We're offline. Leave a message!" },
      logo: String,
      showAgentAvatar: { type: Boolean, default: true },
      showAgentName: { type: Boolean, default: true },
      languages: [{ type: String, default: ["en"] }],
      customCss: String,
    },
  },
  { timestamps: true }
);

SettingsSchema.index({ companyId: 1 });

const Settings: Model<ISettings> = mongoose.models.Settings || mongoose.model<ISettings>("Settings", SettingsSchema);
export default Settings;
