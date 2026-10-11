import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITrainingEntry {
  trigger: string;
  keywords: string[];
  response: string;
  isActive: boolean;
}

export interface ICustomFlowStep {
  question: string;
  type: "choice" | "text";
  options: string[];
  saveAs: string;
  validate?: "none" | "phone" | "email" | "number";
  optionsSource?: "manual" | "vehicles" | "offers";
  // Canvas-only metadata (Flow Builder's node position) — the bot engine in
  // chatbot-flow.ts never reads this, it's purely for the visual editor to
  // remember where a dragged node was left instead of resetting to the
  // auto-layout on every reload.
  position?: { x: number; y: number };
}

export interface ICustomFlowBranch {
  whenSaveAs: string;
  equals: string;
  outcome: "NONE" | "CREATE_LEAD" | "CREATE_TICKET" | "ASSIGN_AGENT";
  closingMessage: string;
  leadType: string;
  leadScore: number;
  ticketSubject: string;
}

export interface ICustomFlowItem {
  key: string;
  label: string;
  steps: ICustomFlowStep[];
  outcome: "NONE" | "CREATE_LEAD" | "CREATE_TICKET" | "ASSIGN_AGENT";
  closingMessage: string;
  leadType: string;
  leadScore: number;
  ticketSubject: string;
  branches?: ICustomFlowBranch[];
  position?: { x: number; y: number };
}

export interface ICustomFlow {
  enabled: boolean;
  menuIntro: string;
  flows: ICustomFlowItem[];
}

// Opt-in AI fallback: when training rules, FAQs, and the custom flow all miss, the
// bot asks Gemini — grounded only in this company's own READY knowledge base
// entries, never a general-purpose open question — before giving up to the
// hardcoded default menu. Off by default since it costs plan-metered AI usage.
export interface IAiFallback {
  enabled: boolean;
}

// A message the widget shows on its own (teaser bubble by the launcher) after a
// visitor has spent `delaySeconds` on a page whose URL contains `urlContains`
// (empty = any page). The first enabled matching rule wins; once per visit.
export interface IProactiveRule {
  enabled: boolean;
  message: string;
  urlContains: string;
  delaySeconds: number;
}

export interface IChatbotConfig extends Document {
  proactive: IProactiveRule[];
  booking: import("@/lib/booking").BookingConfig;
  companyId: mongoose.Types.ObjectId;
  faqs: { question: string; answer: string; isActive: boolean }[];
  offers: { title: string; description: string; validUntil?: string; isActive: boolean }[];
  vehicles: { name: string; category: string; payload: string; priceRange: string; description: string; isActive: boolean }[];
  businessHours: { day: string; open: string; close: string; isClosed: boolean }[];
  training: ITrainingEntry[];
  customFlow: ICustomFlow;
  aiFallback: IAiFallback;
  agentOnlineMessage: string;
  agentOfflineMessage: string;
  welcomeMessage: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChatbotConfigSchema = new Schema<IChatbotConfig>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true, unique: true },
    faqs: [{
      question: { type: String, required: true },
      answer:   { type: String, required: true },
      isActive: { type: Boolean, default: true },
    }],
    offers: [{
      title:       { type: String, required: true },
      description: { type: String, required: true },
      validUntil:  { type: String },
      isActive:    { type: Boolean, default: true },
    }],
    vehicles: [{
      name:        { type: String, required: true },
      category:    { type: String, required: true },
      payload:     { type: String },
      priceRange:  { type: String },
      description: { type: String },
      isActive:    { type: Boolean, default: true },
    }],
    businessHours: [{
      day:      { type: String, required: true },
      open:     { type: String, default: "09:00" },
      close:    { type: String, default: "18:00" },
      isClosed: { type: Boolean, default: false },
    }],
    training: [{
      trigger:  { type: String, default: "" },
      keywords: [{ type: String }],
      response: { type: String, required: true },
      isActive: { type: Boolean, default: true },
    }],
    customFlow: {
      enabled:   { type: Boolean, default: false },
      menuIntro: { type: String, default: "How can we help you today? Please select an option:" },
      flows: [{
        key:   { type: String, required: true },
        label: { type: String, required: true },
        steps: [{
          question:      { type: String, required: true },
          type:          { type: String, enum: ["choice", "text"], default: "choice" },
          options:       [{ type: String }],
          saveAs:        { type: String, default: "" },
          validate:      { type: String, enum: ["none", "phone", "email", "number"], default: "none" },
          optionsSource: { type: String, enum: ["manual", "vehicles", "offers"], default: "manual" },
          position:      { type: { x: Number, y: Number }, required: false, _id: false },
        }],
        outcome:        { type: String, enum: ["NONE", "CREATE_LEAD", "CREATE_TICKET", "ASSIGN_AGENT"], default: "NONE" },
        closingMessage: { type: String, default: "" },
        leadType:       { type: String, default: "" },
        leadScore:      { type: Number, default: 60 },
        ticketSubject:  { type: String, default: "" },
        position:       { type: { x: Number, y: Number }, required: false, _id: false },
        branches: [{
          whenSaveAs:     { type: String, default: "" },
          equals:         { type: String, default: "" },
          outcome:        { type: String, enum: ["NONE", "CREATE_LEAD", "CREATE_TICKET", "ASSIGN_AGENT"], default: "NONE" },
          closingMessage: { type: String, default: "" },
          leadType:       { type: String, default: "" },
          leadScore:      { type: Number, default: 60 },
          ticketSubject:  { type: String, default: "" },
        }],
      }],
    },
    aiFallback: {
      enabled: { type: Boolean, default: false },
    },
    // Appointment / site-visit booking in the chat (src/lib/booking.ts).
    booking: {
      enabled:          { type: Boolean, default: false },
      label:            { type: String, default: "appointment" },
      slotMinutes:      { type: Number, default: 60, min: 15, max: 240 },
      daysAhead:        { type: Number, default: 7, min: 1, max: 30 },
      capacity:         { type: Number, default: 1, min: 1, max: 50 },
      minNoticeHours:   { type: Number, default: 2, min: 0, max: 72 },
      triggerLabels:    { type: String, default: "" },
      reminderTemplate: { type: String, default: "" },
      reminderLanguage: { type: String, default: "en" },
    },
    proactive: [{
      enabled:      { type: Boolean, default: true },
      message:      { type: String, required: true, maxlength: 160 },
      urlContains:  { type: String, default: "" },
      delaySeconds: { type: Number, default: 15, min: 0, max: 600 },
    }],
    agentOnlineMessage:  { type: String, default: "💬 Connecting you to a live agent..." },
    agentOfflineMessage: { type: String, default: "We're offline. Leave your details and we'll call you back!" },
    welcomeMessage:      { type: String, default: "👋 Welcome to Ashok Leyland! How can we help you today?" },
  },
  { timestamps: true }
);

ChatbotConfigSchema.index({ companyId: 1 });

const ChatbotConfig: Model<IChatbotConfig> =
  mongoose.models.ChatbotConfig || mongoose.model<IChatbotConfig>("ChatbotConfig", ChatbotConfigSchema);

export default ChatbotConfig;
