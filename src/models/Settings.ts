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
    // New leads / agent requests sent to the owner's WhatsApp from the company's own
    // connected WhatsApp number. templateName = an approved template with 4 body
    // variables (name, phone, interest, source); without it a plain text is tried,
    // which WhatsApp only delivers within 24h of the owner messaging that number.
    whatsappAlerts?: { enabled: boolean; phones: string[]; templateName?: string; templateLanguage?: string };
    // Morning summary of yesterday (src/lib/daily-digest.ts). On by default.
    dailyDigest?: { enabled?: boolean; hour?: number; email?: boolean; whatsappTemplate?: string; whatsappLanguage?: string; lastSentOn?: string };
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
    launcherText?: string;
    welcomeMessage: string;
    offlineMessage: string;
    logo?: string;
    showAgentAvatar: boolean;
    showAgentName: boolean;
    languages: string[];
    // Widget + built-in bot sentences: "en", "hi", or "auto" (visitor's browser language).
    language?: "en" | "hi" | "auto";
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
      whatsappAlerts: {
        enabled: { type: Boolean, default: false },
        phones: [{ type: String }],
        templateName: { type: String, default: "" },
        templateLanguage: { type: String, default: "en" },
      },
      dailyDigest: {
        enabled: { type: Boolean, default: true },
        hour: { type: Number, default: 9, min: 0, max: 23 },
        email: { type: Boolean, default: true },
        whatsappTemplate: { type: String, default: "" },
        whatsappLanguage: { type: String, default: "en" },
        lastSentOn: { type: String },
      },
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
      launcherText: { type: String, default: "Chat with us" },
      welcomeMessage: { type: String, default: "Hi! How can we help you today?" },
      offlineMessage: { type: String, default: "We're offline. Leave a message!" },
      logo: String,
      showAgentAvatar: { type: Boolean, default: true },
      showAgentName: { type: Boolean, default: true },
      languages: [{ type: String, default: ["en"] }],
      language: { type: String, enum: ["en", "hi", "auto"], default: "en" },
      customCss: String,
    },
  },
  { timestamps: true }
);


const Settings: Model<ISettings> = mongoose.models.Settings || mongoose.model<ISettings>("Settings", SettingsSchema);
export default Settings;
