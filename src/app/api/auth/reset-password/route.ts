import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  await connectDB();
  const { token, password } = await request.json();

  if (!token || !password) return apiError("Token and password are required");
  if (password.length < 8) return apiError("Password must be at least 8 characters");

  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() },
  });

  if (!user) return apiError("Reset link is invalid or has expired. Please request a new one.");

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  return apiSuccess({}, "Password reset successfully");
}
