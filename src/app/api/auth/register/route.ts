import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import User from "@/models/User";
import Company from "@/models/Company";
import Plan from "@/models/Plan";
import Settings from "@/models/Settings";
import Usage from "@/models/Usage";
import Subscription from "@/models/Subscription";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  await connectDB();
  const body = await request.json();
  const { companyName, name, email, password } = body;

  if (!companyName || !name || !email || !password) {
    return apiError("All fields are required");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) return apiError("Email already registered");

  const starterPlan = await Plan.findOne({ type: "STARTER" });
  if (!starterPlan) return apiError("Plans not configured. Contact support.");

  const slug = companyName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
  const apiKey = `sf_${uuidv4().replace(/-/g, "")}`;

  const company = await Company.create({
    name: companyName,
    slug,
    email,
    planId: starterPlan._id,
    apiKey,
    settings: {
      brandColor: "#6366f1",
      widgetPosition: "bottom-right",
      welcomeMessage: "Hi! How can we help you today?",
    },
  });

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  const subscription = await Subscription.create({
    companyId: company._id,
    planId: starterPlan._id,
    status: "TRIALING",
    billingCycle: "MONTHLY",
    currentPeriodStart: now,
    currentPeriodEnd: trialEnd,
    trialStart: now,
    trialEnd,
    amount: 0,
    currency: "INR",
  });

  await Company.findByIdAndUpdate(company._id, {
    subscriptionId: subscription._id,
    trialEndsAt: trialEnd,
  });

  await User.create({
    name,
    email,
    password,
    role: "COMPANY_ADMIN",
    companyId: company._id,
    isEmailVerified: true,
  });

  await Settings.create({ companyId: company._id });
  await Usage.create({ companyId: company._id, period: now.toISOString().slice(0, 7) });

  return apiSuccess({ companyId: company._id }, "Account created successfully", 201);
}
