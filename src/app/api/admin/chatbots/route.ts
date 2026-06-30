import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import ChatbotConfig from "@/models/ChatbotConfig";
import Company from "@/models/Company";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  await connectDB();

  const companies = await Company.find({}).select("_id name email isActive planId").lean();
  const configs = await ChatbotConfig.find({}).lean() as unknown as Array<{
    companyId: string;
    customFlow?: { enabled: boolean; flow: Record<string, unknown> | null };
    training?: unknown[];
    faqs?: unknown[];
    updatedAt?: Date;
  }>;

  const configMap = new Map(configs.map(c => [c.companyId?.toString(), c]));

  const result = companies.map(co => {
    const cfg = configMap.get(co._id.toString());
    const flow = cfg?.customFlow;
    return {
      companyId: co._id,
      companyName: co.name,
      companyEmail: co.email,
      isActive: co.isActive,
      hasConfig: !!cfg,
      customFlowEnabled: flow?.enabled ?? false,
      customFlowMenuCount: flow?.flow
        ? ((flow.flow as Record<string, unknown>)?.chatbot as Record<string, unknown[]> | undefined)?.mainMenu?.length ?? 0
        : 0,
      trainingCount: cfg?.training?.length ?? 0,
      faqCount: cfg?.faqs?.length ?? 0,
      updatedAt: cfg?.updatedAt ?? null,
    };
  });

  return apiSuccess(result, "Chatbot configs loaded");
}

export async function PATCH(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  const { companyId, enabled } = await request.json();
  if (!companyId || typeof enabled !== "boolean") return apiError("companyId and enabled required", 400);

  await connectDB();

  await ChatbotConfig.findOneAndUpdate(
    { companyId },
    { $set: { "customFlow.enabled": enabled } },
    { upsert: false },
  );

  return apiSuccess(null, `Custom flow ${enabled ? "enabled" : "disabled"}`);
}
