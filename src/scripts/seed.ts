import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env.local") });
config({ path: resolve(__dirname, "../../.env") });

import { connectDB } from "../lib/mongodb";
import Plan from "../models/Plan";
import User from "../models/User";
import Company from "../models/Company";
import Settings from "../models/Settings";
import Usage from "../models/Usage";
import Subscription from "../models/Subscription";
import { v4 as uuidv4 } from "uuid";

async function seed() {
  await connectDB();
  console.log("Connected to MongoDB");

  const existingPlans = await Plan.countDocuments();
  if (existingPlans === 0) {
    await Plan.insertMany([
      {
        name: "Starter",
        type: "STARTER",
        description: "Perfect for small teams getting started with customer support",
        price: { monthly: 2499, annually: 24990 },
        currency: "INR",
        limits: {
          agents: 2, chats: 1000, aiMessages: 500, storage: 1024,
          knowledgeFiles: 10, workflows: 3, apiRequests: 10000,
          departments: 2, chatbots: 1, leads: 500, tickets: 500,
        },
        features: ["2 Agents", "1,000 Chats/month", "500 AI Messages", "1 Chatbot", "Basic Analytics", "Email Support"],
        isActive: true,
        isPopular: false,
        sortOrder: 1,
      },
      {
        name: "Pro",
        type: "PRO",
        description: "For growing businesses that need more power and features",
        price: { monthly: 8299, annually: 82990 },
        currency: "INR",
        limits: {
          agents: 10, chats: 10000, aiMessages: 5000, storage: 10240,
          knowledgeFiles: 50, workflows: 20, apiRequests: 100000,
          departments: 10, chatbots: 5, leads: 5000, tickets: 5000,
        },
        features: ["10 Agents", "10,000 Chats/month", "5,000 AI Messages", "5 Chatbots", "Advanced Analytics", "CRM & Leads", "API Access", "Priority Support"],
        isActive: true,
        isPopular: true,
        sortOrder: 2,
      },
      {
        name: "Enterprise",
        type: "ENTERPRISE",
        description: "Unlimited everything for large enterprises",
        price: { monthly: 24999, annually: 249990 },
        currency: "INR",
        limits: {
          agents: -1, chats: -1, aiMessages: -1, storage: -1,
          knowledgeFiles: -1, workflows: -1, apiRequests: -1,
          departments: -1, chatbots: -1, leads: -1, tickets: -1,
        },
        features: ["Unlimited Agents", "Unlimited Chats", "Unlimited AI Messages", "White Labeling", "Custom Domain", "Dedicated Support", "SLA Guarantee", "Custom Integrations"],
        isActive: true,
        isPopular: false,
        sortOrder: 3,
      },
    ]);
    console.log("✅ Plans seeded");
  }

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
    console.log("✅ Super Admin created: admin@supportflow.app / Admin@123456");
  }

  const demoCompany = await Company.findOne({ slug: "demo-company" });
  if (!demoCompany) {
    const plan = await Plan.findOne({ type: "PRO" });
    const apiKey = `sf_${uuidv4().replace(/-/g, "")}`;

    const company = await Company.create({
      name: "Demo Company",
      slug: "demo-company",
      email: "demo@example.com",
      planId: plan?._id,
      apiKey,
      settings: {
        brandColor: "#6366f1",
        widgetPosition: "bottom-right",
        welcomeMessage: "Hi! Welcome to Demo Company support. How can we help?",
        autoAssign: true,
        assignmentStrategy: "ROUND_ROBIN",
      },
    });

    await User.create({
      name: "Demo Admin",
      email: "demo@example.com",
      password: "Demo@123456",
      role: "COMPANY_ADMIN",
      companyId: company._id,
      isEmailVerified: true,
    });

    await User.create({
      name: "Agent Alice",
      email: "alice@example.com",
      password: "Agent@123456",
      role: "AGENT",
      companyId: company._id,
      isEmailVerified: true,
      isOnline: true,
    });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const sub = await Subscription.create({
      companyId: company._id,
      planId: plan?._id,
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      amount: 8299,
      currency: "INR",
    });

    await Company.findByIdAndUpdate(company._id, { subscriptionId: sub._id });
    await Settings.create({ companyId: company._id });
    await Usage.create({
      companyId: company._id,
      period: now.toISOString().slice(0, 7),
      agents: 2, chats: 127, aiMessages: 89, leads: 23, tickets: 15,
    });

    console.log("✅ Demo company seeded");
    console.log("   Company Admin: demo@example.com / Demo@123456");
    console.log("   Agent: alice@example.com / Agent@123456");
    console.log(`   Widget API Key: ${apiKey}`);
  }

  console.log("\n🎉 Seed completed successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
