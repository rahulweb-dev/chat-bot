import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Company from "@/models/Company";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const company = await Company.findById(ctx.companyId).select("name apiKey");
  if (!company) return apiError("Company not found", 404);

  return apiSuccess({ companyName: company.name, widgetApiKey: company.apiKey });
}
