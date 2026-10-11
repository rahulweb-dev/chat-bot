import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { activatePaidOrder, markOrderFailed, applySubscriptionCharge, endAutoRenew } from "@/lib/billing";

// Razorpay webhook. Configure in Razorpay Dashboard → Settings → Webhooks:
//   URL:    https://<your-domain>/api/webhooks/razorpay
//   Secret: same value as RAZORPAY_WEBHOOK_SECRET
//   Events: payment.captured, order.paid, payment.failed, subscription.charged,
//           subscription.cancelled, subscription.halted, subscription.completed
// This is the reliable path: it still activates the plan if the customer
// closes the tab before the browser callback runs.
export async function POST(request: NextRequest) {
  const raw = await request.text(); // signature is over the exact raw body
  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; error_description?: string } };
      order?: { entity?: { id?: string } };
      subscription?: { entity?: { id?: string; current_end?: number } };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const pay = event.payload?.payment?.entity;
  const orderId = pay?.order_id || event.payload?.order?.entity?.id;

  const sub = event.payload?.subscription?.entity;

  try {
    if (event.event === "subscription.charged" && sub?.id && pay?.id) {
      // First charge activates the plan; every later one extends it.
      await applySubscriptionCharge(sub.id, pay.id, sub.current_end);
    } else if (["subscription.cancelled", "subscription.halted", "subscription.completed"].includes(event.event ?? "") && sub?.id) {
      // Customer cancelled, or Razorpay stopped retrying failed charges: the
      // paid period runs out normally, then the free tier applies.
      await endAutoRenew(sub.id);
    } else if ((event.event === "payment.captured" || event.event === "order.paid") && orderId && pay?.id) {
      await activatePaidOrder(orderId, pay.id);
    } else if (event.event === "payment.failed" && orderId) {
      await markOrderFailed(orderId, pay?.error_description);
    }
  } catch (err) {
    // 500 makes Razorpay retry the delivery later.
    console.error("[razorpay-webhook]", event.event, err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false }, { status: 500 });
  }

  // Unknown orders (e.g. payments from other integrations on the same account)
  // are acknowledged so Razorpay doesn't keep retrying them.
  return NextResponse.json({ success: true });
}
