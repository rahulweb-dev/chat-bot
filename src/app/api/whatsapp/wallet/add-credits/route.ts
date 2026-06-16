import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { getOrCreateWallet, getWalletSummary } from "@/lib/whatsappWallet";
import WhatsAppWallet from "@/models/WhatsAppWallet";
import AuditLog from "@/models/AuditLog";

// Platform-level action only — company admins cannot self-serve top-ups.
// There's no live Stripe key configured for this app yet, so this credits the
// wallet directly rather than routing through a real payment flow.
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden — only the platform super admin can add credits", 403);

  const body = await request.json();
  const companyId = String(body.companyId || "");
  const amount = Number(body.amount);
  if (!companyId) return apiError("companyId is required");
  if (!amount || amount <= 0) return apiError("A positive amount is required");

  await connectDB();
  const wallet = await getOrCreateWallet(companyId);
  await WhatsAppWallet.findByIdAndUpdate(wallet._id, { $inc: { balance: amount } });

  await AuditLog.create({
    companyId,
    userId: ctx.userId,
    action: "ADD_WHATSAPP_CREDITS",
    resource: "whatsapp_wallet",
    resourceId: String(wallet._id),
    details: { amount, addedBySuperAdmin: true },
    status: "SUCCESS",
  });

  return apiSuccess(await getWalletSummary(companyId), "Credits added");
}
