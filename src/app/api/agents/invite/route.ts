import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import User from "@/models/User";
import { sendEmail } from "@/lib/email";
import Company from "@/models/Company";
import { inviteStore } from "@/lib/invite-store";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER", "SUPER_ADMIN"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const { email, name, role = "AGENT" } = body;

  if (!email || !name) return apiError("email and name are required");

  const existing = await User.findOne({ email });
  if (existing) return apiError("This email already has an account");

  const company = await Company.findById(ctx.companyId).select("name");
  if (!company) return apiError("Company not found", 404);

  const token = crypto.randomBytes(32).toString("hex");
  inviteStore.set(token, {
    companyId: ctx.companyId!,
    email,
    name,
    role,
    expiresAt: Date.now() + 48 * 60 * 60 * 1000,
  });

  const inviteUrl = `${process.env.AUTH_URL}/invite/accept?token=${token}`;

  await sendEmail({
    to: email,
    subject: `You've been invited to join ${company.name} on SupportFlow`,
    html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
      <div style="background:#6366f1;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <h1 style="color:white;margin:0;font-size:24px">You're Invited! 🎉</h1>
      </div>
      <p style="font-size:16px;color:#374151">Hi <strong>${name}</strong>,</p>
      <p style="color:#6b7280">
        <strong>${company.name}</strong> has invited you to join their support team on SupportFlow as a <strong>${role}</strong>.
      </p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:24px 0;border:1px solid #e5e7eb">
        <p style="margin:0;font-size:13px;color:#6b7280">This invite link expires in <strong>48 hours</strong>.</p>
      </div>
      <a href="${inviteUrl}"
         style="display:block;background:#6366f1;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;text-align:center;font-size:16px;font-weight:600;margin:24px 0">
        Accept Invitation →
      </a>
      <p style="font-size:12px;color:#9ca3af;text-align:center">If you didn't expect this invite, you can safely ignore this email.</p>
    </div>`,
  });

  return apiSuccess({ invited: true }, `Invite sent to ${email}`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return apiError("Token required");

  const invite = inviteStore.get(token);
  if (!invite || invite.expiresAt < Date.now()) {
    inviteStore.delete(token);
    return apiError("Invalid or expired invite link", 400);
  }

  return apiSuccess({ email: invite.email, name: invite.name, role: invite.role });
}
