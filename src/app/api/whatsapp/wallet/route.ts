import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { getWalletSummary } from "@/lib/whatsappWallet";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();

  // Super admin has no companyId of their own — they look up a specific company's wallet.
  if (ctx.userRole === "SUPER_ADMIN") {
    const companyId = new URL(request.url).searchParams.get("companyId");
    if (!companyId) return apiError("companyId is required");
    return apiSuccess(await getWalletSummary(companyId));
  }

  if (!ctx.companyId) return apiError("Company required", 400);
  return apiSuccess(await getWalletSummary(ctx.companyId));
}
