import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import User from "@/models/User";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  await connectDB();
  const { email } = await request.json();
  if (!email) return apiError("Email is required");

  const user = await User.findOne({ email: email.toLowerCase() });

  // Always return success to prevent email enumeration
  if (!user) return apiSuccess({}, "If an account exists, a reset link has been sent");

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await User.findByIdAndUpdate(user._id, {
    passwordResetToken: hashedToken,
    passwordResetExpires: expires,
  });

  const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${rawToken}`;

  // Send email if configured
  try {
    const { sendEmail } = await import("@/lib/email");
    await sendEmail({
      to: user.email,
      subject: "SupportFlow: Reset your password",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4f46e5;">Reset your password</h2>
          <p>Hi ${user.name},</p>
          <p>You requested a password reset. Click the button below to set a new password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
            Reset Password
          </a>
          <p style="color:#6b7280;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
          <p style="color:#6b7280;font-size:12px;">Link: ${resetUrl}</p>
        </div>
      `,
    });
  } catch {
    // Email failure is non-fatal in dev — token is still saved
    console.error("Password reset email failed to send");
  }

  return apiSuccess({}, "If an account exists, a reset link has been sent");
}
