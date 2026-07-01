import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess, incrementUsage } from "@/lib/api-helpers";
import User from "@/models/User";
import { sendEmail, welcomeEmail } from "@/lib/email";
import Company from "@/models/Company";
import { inviteStore } from "@/lib/invite-store";

export async function POST(request: NextRequest) {
  await connectDB();
  const body = await request.json();
  const { token, password } = body;

  if (!token || !password) return apiError("token and password required");
  if (password.length < 8) return apiError("Password must be at least 8 characters");

  const invite = inviteStore.get(token);
  if (!invite || invite.expiresAt < Date.now()) {
    inviteStore.delete(token);
    return apiError("Invalid or expired invite link", 400);
  }

  const existing = await User.findOne({ email: invite.email });
  if (existing) return apiError("Account already exists for this email");

  const company = await Company.findById(invite.companyId).select("name").lean() as { name?: string } | null;

  const userDoc = new User({
    name:            invite.name,
    email:           invite.email,
    password,
    role:            invite.role,
    companyId:       invite.companyId,
    isEmailVerified: true,
    isActive:        true,
  });
  await userDoc.save();
  const user = userDoc as unknown as { _id: unknown; email: string };

  await incrementUsage(invite.companyId, "agents");
  inviteStore.delete(token);

  await sendEmail({
    to: invite.email,
    subject: `Welcome to ${company?.name ?? "SupportFlow"}!`,
    html: welcomeEmail(invite.name, company?.name ?? "SupportFlow"),
  }).catch(() => {});

  return apiSuccess({ userId: user._id, email: user.email }, "Account created successfully", 201);
}
