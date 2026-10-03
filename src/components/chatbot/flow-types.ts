// Shared with src/lib/chatbot-flow.ts and src/models/ChatbotConfig.ts — keep
// these three in sync. `position` is canvas-only metadata (Flow Builder node
// position); the bot engine never reads it.
export interface CanvasPosition { x: number; y: number }

export type FlowOutcome = "NONE" | "CREATE_LEAD" | "CREATE_TICKET" | "ASSIGN_AGENT";

export interface CustomFlowStep {
  question: string;
  type: "choice" | "text";
  options: string[];
  saveAs: string;
  validate?: "none" | "phone" | "email" | "number";
  optionsSource?: "manual" | "vehicles" | "offers";
  position?: CanvasPosition;
}

export interface CustomFlowBranch {
  whenSaveAs: string;
  equals: string;
  outcome: FlowOutcome;
  closingMessage: string;
  leadType?: string;
  leadScore?: number;
  ticketSubject?: string;
}

export interface CustomFlowItem {
  key: string;
  label: string;
  steps: CustomFlowStep[];
  outcome: FlowOutcome;
  closingMessage: string;
  leadType?: string;
  leadScore?: number;
  ticketSubject?: string;
  branches?: CustomFlowBranch[];
  position?: CanvasPosition;
}

export interface CustomFlow {
  enabled: boolean;
  menuIntro: string;
  flows: CustomFlowItem[];
}

export const OUTCOME_LABELS: Record<FlowOutcome, string> = {
  NONE: "Show message",
  CREATE_LEAD: "Create Lead",
  CREATE_TICKET: "Create Ticket",
  ASSIGN_AGENT: "Hand off to agent",
};
