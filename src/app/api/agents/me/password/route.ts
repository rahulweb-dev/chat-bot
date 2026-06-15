import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) return apiError("Both passwords are required");
  if (newPassword.length < 8) return apiError("New password must be at least 8 characters");

  const user = await User.findById(ctx.userId).select("+password");
  if (!user) return apiError("User not found", 404);

  if (!user.password) return apiError("Password login not enabled for this account (Google sign-in)");

  const valid = await user.comparePassword(currentPassword);
  if (!valid) return apiError("Current password is incorrect");

  user.password = newPassword;
  await user.save();

  return apiSuccess({}, "Password changed successfully");
}
