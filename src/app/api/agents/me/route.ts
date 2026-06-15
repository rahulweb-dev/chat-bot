import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import User from "@/models/User";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const user = await User.findById(ctx.userId).select("-password -passwordResetToken -passwordResetExpires -emailVerificationToken");
  if (!user) return apiError("User not found", 404);

  return apiSuccess(user);
}

export async function PATCH(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const body = await request.json();
  const { name, timezone, notificationPreferences } = body;

  const update: Record<string, unknown> = {};
  if (name) update.name = name;
  if (timezone) update.timezone = timezone;
  if (notificationPreferences) update.notificationPreferences = notificationPreferences;

  const user = await User.findByIdAndUpdate(
    ctx.userId,
    { $set: update },
    { new: true, select: "-password -passwordResetToken -passwordResetExpires -emailVerificationToken" }
  );

  return apiSuccess(user, "Profile updated");
}
