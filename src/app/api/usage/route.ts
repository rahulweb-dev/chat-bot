import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Usage from "@/models/Usage";
import Company from "@/models/Company";
import Plan from "@/models/Plan";
import User from "@/models/User";
import KnowledgeBase from "@/models/KnowledgeBase";
import Chatbot from "@/models/Chatbot";
import Department from "@/models/Department";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || new Date().toISOString().slice(0, 7);

  const [company, usage, liveAgents, liveDepts, liveKBFiles, liveChatbots] = await Promise.all([
    Company.findById(ctx.companyId).populate("planId"),
    Usage.findOne({ companyId: ctx.companyId, period }),
    // Live counts — source of truth, not the Usage counter
    User.countDocuments({ companyId: ctx.companyId, role: { $in: ["AGENT", "MANAGER", "TEAM_LEADER", "VIEWER"] } }),
    Department.countDocuments({ companyId: ctx.companyId }),
    KnowledgeBase.countDocuments({ companyId: ctx.companyId }),
    Chatbot.countDocuments({ companyId: ctx.companyId }),
  ]);

  if (!company) return apiError("Company not found", 404);
  const plan = company.planId as unknown as InstanceType<typeof Plan>;

  const current = usage || {
    chats: 0, aiMessages: 0, leads: 0, tickets: 0, apiRequests: 0, storage: 0, workflows: 0,
  };

  const metrics = [
    // Live DB counts — always accurate even if agents are deleted
    { resource: "agents",        label: "Agents",           used: liveAgents,     limit: plan.limits.agents },
    { resource: "departments",   label: "Departments",      used: liveDepts,      limit: plan.limits.departments },
    { resource: "knowledgeFiles",label: "Knowledge Files",  used: liveKBFiles,    limit: plan.limits.knowledgeFiles },
    { resource: "chatbots",      label: "Chatbots",         used: liveChatbots,   limit: plan.limits.chatbots },
    // Period counters — these are still fine as cumulative per-period metrics
    { resource: "chats",         label: "Chats",            used: current.chats,        limit: plan.limits.chats },
    { resource: "aiMessages",    label: "AI Messages",      used: current.aiMessages,   limit: plan.limits.aiMessages },
    { resource: "leads",         label: "Leads",            used: current.leads,        limit: plan.limits.leads },
    { resource: "tickets",       label: "Tickets",          used: current.tickets,      limit: plan.limits.tickets },
    { resource: "storage",       label: "Storage (MB)",     used: current.storage,      limit: plan.limits.storage },
    { resource: "workflows",     label: "Workflows",        used: current.workflows,    limit: plan.limits.workflows },
    { resource: "apiRequests",   label: "API Requests",     used: current.apiRequests,  limit: plan.limits.apiRequests },
  ].map(({ resource, label, used, limit }) => ({
    resource,
    label,
    used,
    limit,
    remaining: limit === -1 ? -1 : Math.max(0, limit - used),
    percentage: limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100)),
    isUnlimited: limit === -1,
    isWarning: limit !== -1 && used / limit >= 0.75,
    isDanger: limit !== -1 && used / limit >= 0.9,
    isExceeded: limit !== -1 && used >= limit,
  }));

  return apiSuccess({
    period,
    plan: { name: plan.name, type: plan.type },
    metrics,
  });
}
