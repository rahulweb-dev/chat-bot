import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { pushConfigured, sendPushToUsers } from "@/lib/push";
import PushSubscription from "@/models/PushSubscription";

// GET: whether push is available, plus the public key the browser subscribes with.
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  await connectDB();
  const count = await PushSubscription.countDocuments({ userId: ctx.userId });
  return apiSuccess({ available: pushConfigured(), publicKey: process.env.VAPID_PUBLIC_KEY ?? null, devices: count });
}

const subSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  test: z.boolean().optional(),
});

// POST: save this device's subscription (and optionally send a test push).
export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || ctx.userId === "api") return apiError("Unauthorized", 401);
  const parsed = subSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError("Invalid subscription", 422);
  await connectDB();
  await PushSubscription.findOneAndUpdate(
    { endpoint: parsed.data.endpoint },
    { userId: ctx.userId, companyId: ctx.companyId, keys: parsed.data.keys, userAgent: request.headers.get("user-agent")?.slice(0, 200) },
    { upsert: true }
  );
  if (parsed.data.test) {
    await sendPushToUsers([ctx.userId], { title: "Notifications are on ✅", body: "You'll get new chats, leads and bookings here.", url: "/dashboard/chat", tag: "test" });
  }
  return apiSuccess(null, "Notifications enabled on this device");
}

// DELETE: stop notifications on this device.
export async function DELETE(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) return apiError("endpoint required", 422);
  await connectDB();
  await PushSubscription.deleteOne({ endpoint, userId: ctx.userId });
  return apiSuccess(null, "Notifications turned off on this device");
}
