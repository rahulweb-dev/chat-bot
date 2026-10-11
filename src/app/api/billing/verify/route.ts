import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { activatePaidOrder } from "@/lib/billing";
import Payment from "@/models/Payment";

const verifySchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

// Browser callback after Razorpay Checkout succeeds. The webhook activates the
// plan too; this route just makes the upgrade show up instantly instead of
// waiting for the webhook to arrive.
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  const parsed = verifySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError("Invalid payment details", 422);
  const { orderId, paymentId, signature } = parsed.data;

  if (!verifyPaymentSignature(orderId, paymentId, signature)) {
    return apiError("Payment could not be verified", 400);
  }

  await connectDB();
  // The order must belong to the caller's company — a valid signature for
  // someone else's order must not upgrade this one.
  const owned = await Payment.exists({ orderId, companyId: ctx.companyId });
  if (!owned) return apiError("Payment not found", 404);

  const payment = await activatePaidOrder(orderId, paymentId);
  return apiSuccess({ status: payment?.status }, "Plan activated");
}
