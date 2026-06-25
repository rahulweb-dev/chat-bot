import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { getOrCreateWallet, getWalletSummary } from "@/lib/whatsappWallet";
import WhatsAppWallet from "@/models/WhatsAppWallet";
import AuditLog from "@/models/AuditLog";

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

const TRIAL_CREDIT_AMOUNT = 50; // ₹50 = ~62 messages at ₹0.80 each

// Company admins can claim free trial credits once, when balance has never exceeded the trial amount.
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const wallet = await getOrCreateWallet(String(ctx.companyId));

  if (wallet.balance >= 1) {
    return apiError("Your wallet already has a balance. Trial credits are only for wallets with ₹0.", 400);
  }

  await WhatsAppWallet.findByIdAndUpdate(wallet._id, { $set: { balance: TRIAL_CREDIT_AMOUNT } });

  await AuditLog.create({
    companyId: ctx.companyId,
    userId: ctx.userId,
    action: "CLAIM_WHATSAPP_TRIAL_CREDITS",
    resource: "whatsapp_wallet",
    resourceId: String(wallet._id),
    details: { amount: TRIAL_CREDIT_AMOUNT },
    status: "SUCCESS",
  });

  return apiSuccess(await getWalletSummary(String(ctx.companyId)), `₹${TRIAL_CREDIT_AMOUNT} trial credits added to your wallet`);
}
