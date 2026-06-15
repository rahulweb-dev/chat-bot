import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Notification from "@/models/Notification";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const unread = searchParams.get("unread") === "true";

  const query: Record<string, unknown> = { userId: ctx.userId };
  if (unread) query.isRead = false;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ userId: ctx.userId, isRead: false }),
  ]);

  return apiSuccess({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const body = await request.json();

  if (body.markAllRead) {
    await Notification.updateMany({ userId: ctx.userId, isRead: false }, { isRead: true, readAt: new Date() });
    return apiSuccess(null, "All notifications marked as read");
  }

  if (body.notificationId) {
    await Notification.findOneAndUpdate(
      { _id: body.notificationId, userId: ctx.userId },
      { isRead: true, readAt: new Date() }
    );
    return apiSuccess(null, "Notification marked as read");
  }

  return apiError("Invalid request");
}
