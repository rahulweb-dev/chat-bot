import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Plan from "@/models/Plan";
import User from "@/models/User";
import Company from "@/models/Company";
import Settings from "@/models/Settings";
import Usage from "@/models/Usage";
import Subscription from "@/models/Subscription";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  const secret = new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();

  const results: string[] = [];

  // Seed plans
  const existingPlans = await Plan.countDocuments();
  if (existingPlans === 0) {
    await Plan.insertMany([
      {
        name: "Starter", type: "STARTER",
        description: "Perfect for small teams",
        price: { monthly: 2499, annually: 24990 }, currency: "INR",
        limits: { agents: 2, chats: 1000, aiMessages: 500, storage: 1024, knowledgeFiles: 10, workflows: 3, apiRequests: 10000, departments: 2, chatbots: 1, leads: 500, tickets: 500 },
        features: ["2 Agents", "1,000 Chats/month", "500 AI Messages", "1 Chatbot", "Basic Analytics"],
        isActive: true, isPopular: false, sortOrder: 1,
      },
      {
        name: "Pro", type: "PRO",
        description: "For growing businesses",
        price: { monthly: 8299, annually: 82990 }, currency: "INR",
        limits: { agents: 10, chats: 10000, aiMessages: 5000, storage: 10240, knowledgeFiles: 50, workflows: 20, apiRequests: 100000, departments: 10, chatbots: 5, leads: 5000, tickets: 5000 },
        features: ["10 Agents", "10,000 Chats/month", "5,000 AI Messages", "5 Chatbots", "Advanced Analytics", "API Access"],
        isActive: true, isPopular: true, sortOrder: 2,
      },
      {
        name: "Enterprise", type: "ENTERPRISE",
        description: "Unlimited everything",
        price: { monthly: 24999, annually: 249990 }, currency: "INR",
        limits: { agents: -1, chats: -1, aiMessages: -1, storage: -1, knowledgeFiles: -1, workflows: -1, apiRequests: -1, departments: -1, chatbots: -1, leads: -1, tickets: -1 },
        features: ["Unlimited Agents", "Unlimited Chats", "Unlimited AI", "White Labeling", "Dedicated Support"],
        isActive: true, isPopular: false, sortOrder: 3,
      },
    ]);
    results.push("Plans created");
  } else {
    results.push("Plans already exist");
  }

  // Seed super admin
  const superAdmin = await User.findOne({ role: "SUPER_ADMIN" });
  if (!superAdmin) {
    await User.create({
      name: "Super Admin",
      email: "admin@supportflow.app",
      password: "Admin@123456",
      role: "SUPER_ADMIN",
      isEmailVerified: true,
      isActive: true,
    });
    results.push("Super Admin created: admin@supportflow.app / Admin@123456");
  } else {
    results.push("Super Admin already exists");
  }

  // Seed demo company
  const demoCompany = await Company.findOne({ slug: "demo-company" });
  if (!demoCompany) {
    const plan = await Plan.findOne({ type: "PRO" });
    const apiKey = `sf_${uuidv4().replace(/-/g, "")}`;
    const company = await Company.create({
      name: "Demo Company", slug: "demo-company", email: "demo@example.com",
      planId: plan?._id, apiKey,
      settings: { brandColor: "#6366f1", widgetPosition: "bottom-right", welcomeMessage: "Hi! How can we help?" },
    });
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const sub = await Subscription.create({
      companyId: company._id, planId: plan?._id, status: "ACTIVE",
      billingCycle: "MONTHLY", currentPeriodStart: now, currentPeriodEnd: periodEnd, amount: 8299, currency: "INR",
    });
    await Company.findByIdAndUpdate(company._id, { subscriptionId: sub._id });
    await User.create({ name: "Demo Admin", email: "demo@example.com", password: "Demo@123456", role: "COMPANY_ADMIN", companyId: company._id, isEmailVerified: true });
    await Settings.create({ companyId: company._id });
    await Usage.create({ companyId: company._id, period: now.toISOString().slice(0, 7) });
    results.push(`Demo company created (API key: ${apiKey})`);
  } else {
    results.push("Demo company already exists");
  }

  return NextResponse.json({ success: true, results });
}
