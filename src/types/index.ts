export type UserRole = "SUPER_ADMIN" | "COMPANY_ADMIN" | "MANAGER" | "TEAM_LEADER" | "AGENT" | "VIEWER";

export type PlanType = "STARTER" | "PRO" | "ENTERPRISE";

export type ConversationStatus = "OPEN" | "ASSIGNED" | "PENDING" | "RESOLVED" | "CLOSED";

export type TicketStatus = "OPEN" | "ASSIGNED" | "PENDING" | "RESOLVED" | "CLOSED";

export type LeadStage = "NEW" | "CONTACTED" | "QUALIFIED" | "MEETING" | "PROPOSAL" | "WON" | "LOST";

export type AssignmentStrategy = "ROUND_ROBIN" | "LEAST_BUSY" | "DEPARTMENT" | "SKILL" | "LANGUAGE" | "VIP";

export type NotificationType = "USAGE_ALERT" | "NEW_CHAT" | "TICKET_ASSIGNED" | "LEAD_CREATED" | "SYSTEM" | "BILLING";

export interface PlanLimits {
  agents: number;
  chats: number;
  aiMessages: number;
  storage: number; // MB
  knowledgeFiles: number;
  workflows: number;
  apiRequests: number;
  departments: number;
  chatbots: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  STARTER: {
    agents: 2,
    chats: 1000,
    aiMessages: 500,
    storage: 1024,
    knowledgeFiles: 10,
    workflows: 3,
    apiRequests: 10000,
    departments: 2,
    chatbots: 1,
  },
  PRO: {
    agents: 10,
    chats: 10000,
    aiMessages: 5000,
    storage: 10240,
    knowledgeFiles: 50,
    workflows: 20,
    apiRequests: 100000,
    departments: 10,
    chatbots: 5,
  },
  ENTERPRISE: {
    agents: -1, // unlimited
    chats: -1,
    aiMessages: -1,
    storage: -1,
    knowledgeFiles: -1,
    workflows: -1,
    apiRequests: -1,
    departments: -1,
    chatbots: -1,
  },
};

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId?: string;
  avatar?: string;
}
