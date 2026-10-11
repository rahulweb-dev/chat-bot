import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import { connectDB } from "./mongodb";
import Usage from "@/models/Usage";
import { getEffectivePlan } from "./plan-limits";

export type UserRole = "SUPER_ADMIN" | "COMPANY_ADMIN" | "MANAGER" | "TEAM_LEADER" | "AGENT" | "VIEWER";

export interface RequestContext {
  userId: string;
  userRole: UserRole;
  companyId?: string;
}

export async function getRequestContext(request: NextRequest): Promise<RequestContext | null> {
  const session = await auth();
  if (session?.user) {
    return {
      userId: session.user.id!,
      userRole: session.user.role as UserRole,
      companyId: session.user.companyId,
    };
  }

  const apiKey = request.headers.get("x-api-key") || request.headers.get("authorization")?.replace("Bearer ", "");
  if (apiKey) {
    await connectDB();
    const { default: ApiKey } = await import("@/models/ApiKey");
    const key = await ApiKey.findOne({ key: apiKey, isActive: true });
    if (key) {
      await ApiKey.findByIdAndUpdate(key._id, { $inc: { requestCount: 1 }, lastUsedAt: new Date() });
      return { userId: "api", userRole: "AGENT", companyId: key.companyId.toString() };
    }
  }

  return null;
}

export function requireRole(context: RequestContext, roles: UserRole[]): boolean {
  return roles.includes(context.userRole);
}

export function requireCompany(context: RequestContext): boolean {
  return !!context.companyId;
}

export async function checkUsageLimit(
  companyId: string,
  resource: string,
  increment: number = 1
): Promise<{ allowed: boolean; current: number; limit: number; percentage: number; message?: string }> {
  await connectDB();

  // Effective plan, not just company.planId: a lapsed trial/subscription drops
  // to FREE_LIMITS here.
  const plan = await getEffectivePlan(companyId);
  if (!plan) return { allowed: false, current: 0, limit: 0, percentage: 0, message: "Company not found" };

  const period = new Date().toISOString().slice(0, 7);

  let usage = await Usage.findOne({ companyId, period });
  if (!usage) {
    usage = await Usage.create({ companyId, period });
  }

  const current = ((usage as unknown as Record<string, unknown>)[resource] as number) || 0;
  const limit = plan.limits[resource] || 0;

  if (limit === -1) return { allowed: true, current, limit: -1, percentage: 0 };

  const percentage = limit > 0 ? Math.round((current / limit) * 100) : 100;
  const allowed = current + increment <= limit;

  return {
    allowed,
    current,
    limit,
    percentage,
    message: allowed
      ? undefined
      : plan.expired
        ? `Your plan has ended, so ${resource} is limited to ${limit}/month on the free tier. Renew on the Billing page.`
        : `${resource} limit reached (${current}/${limit}). Upgrade your plan.`,
  };
}

export async function incrementUsage(companyId: string, resource: string, amount: number = 1): Promise<void> {
  await connectDB();
  const period = new Date().toISOString().slice(0, 7);
  await Usage.findOneAndUpdate(
    { companyId, period },
    { $inc: { [resource]: amount } },
    { upsert: true, new: true }
  );
}

const SENSITIVE_LOG_KEYS = new Set([
  "password", "token", "secret", "apiKey", "accessToken",
  "webhookVerifyToken", "encryptedAccessToken", "encryptedWebhookVerifyToken",
]);

export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !SENSITIVE_LOG_KEYS.has(k))
      .map(([k, v]) => [
        k,
        v !== null && typeof v === "object" && !Array.isArray(v)
          ? sanitizeForLog(v as Record<string, unknown>)
          : v,
      ])
  );
}

export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function apiSuccess<T>(data: T, message?: string, status: number = 200) {
  return NextResponse.json({ success: true, data, message }, { status });
}

export function paginate(page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit;
  return { skip, limit };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}
