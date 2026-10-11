import crypto from "crypto";

// Thin wrapper over Razorpay's REST API (no SDK dependency).
// Env: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET.

export function razorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export interface RazorpayOrder {
  id: string;
  amount: number; // smallest unit (paise)
  currency: string;
  receipt: string;
  status: string;
}

export async function createOrder(params: {
  amountMinor: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      amount: params.amountMinor,
      currency: params.currency,
      receipt: params.receipt,
      notes: params.notes,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.description || `Razorpay order failed (${res.status})`);
  }
  return data as RazorpayOrder;
}

async function rzp<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay ${path} failed (${res.status})`);
  return data as T;
}

// ── Subscriptions (automatic renewal: UPI AutoPay, card and netbanking mandates) ──
// A Razorpay plan is the price + period; created once per our Plan × cycle and
// its id cached on our Plan document by the caller.
export async function createRazorpayPlan(params: { name: string; amountMinor: number; currency: string; cycle: "MONTHLY" | "ANNUALLY" }) {
  return rzp<{ id: string }>("POST", "/plans", {
    period: params.cycle === "ANNUALLY" ? "yearly" : "monthly",
    interval: 1,
    item: { name: params.name, amount: params.amountMinor, currency: params.currency },
  });
}

export interface RazorpaySubscription {
  id: string;
  status: string;
  current_start?: number; // unix seconds
  current_end?: number;
  short_url?: string;
}

export async function createRazorpaySubscription(params: { planId: string; cycle: "MONTHLY" | "ANNUALLY"; notes: Record<string, string> }) {
  return rzp<RazorpaySubscription>("POST", "/subscriptions", {
    plan_id: params.planId,
    // Razorpay needs a finite count: 10 years either way. Customers cancel any time.
    total_count: params.cycle === "ANNUALLY" ? 10 : 120,
    customer_notify: 1,
    notes: params.notes,
  });
}

// Stops future charges; the period already paid for runs to its end.
export async function cancelRazorpaySubscription(subscriptionId: string) {
  return rzp<RazorpaySubscription>("POST", `/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: 1 });
}

// Checkout signature for a subscription's first payment: HMAC(payment_id|subscription_id).
export function verifySubscriptionSignature(subscriptionId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${paymentId}|${subscriptionId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// Signature Razorpay Checkout returns to the browser after a successful payment.
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

// Signature on webhook calls — computed over the raw request body, so the
// caller must pass the body text exactly as received, before JSON.parse.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

// Currencies Razorpay bills in minor units of 100 (INR, USD, EUR, …). Zero-decimal
// currencies such as JPY would need 1; none are used by our plans.
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
