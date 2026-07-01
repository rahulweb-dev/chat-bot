import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../../.env.local") });

import { connectDB } from "../lib/mongodb";
import User from "../models/User";
import Company from "../models/Company";
import Plan from "../models/Plan";
import Settings from "../models/Settings";
import Subscription from "../models/Subscription";
import Usage from "../models/Usage";
import { v4 as uuidv4 } from "uuid";

async function fix() {
  await connectDB();
  console.log("Connected to MongoDB\n");

  // ── Ensure company exists ─────────────────────────────────────────────────────
  let company = await Company.findOne({ slug: "demo-company" });
  if (!company) {
    console.log("Demo company not found — creating it...");
    const plan = await Plan.findOne({ type: "PRO" });
    if (!plan) {
      console.error("❌  PRO plan not found. Run npm run seed first.");
      process.exit(1);
    }
    const apiKey = `sf_${uuidv4().replace(/-/g, "")}`;
    company = await Company.create({
      name: "Demo Company",
      slug: "demo-company",
      email: "demo@example.com",
      planId: plan._id,
      apiKey,
      settings: {
        brandColor: "#6366f1",
        widgetPosition: "bottom-right",
        welcomeMessage: "Hi! Welcome to Demo Company support. How can we help?",
        autoAssign: true,
        assignmentStrategy: "ROUND_ROBIN",
      },
    });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const sub = await Subscription.create({
      companyId: company._id,
      planId: plan._id,
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      amount: plan.price.monthly,
      currency: plan.currency || "INR",
    });
    await Company.findByIdAndUpdate(company._id, { subscriptionId: sub._id });
    await Settings.create({ companyId: company._id });
    await Usage.create({ companyId: company._id, period: now.toISOString().slice(0, 7), chats: 0 });
    console.log("✅  Demo company created");
  } else {
    console.log("✅  Demo company exists:", company.name);
  }

  // ── Upsert demo admin ─────────────────────────────────────────────────────────
  const adminPw = "Demo@123456";
  const existing = await User.findOne({ email: "demo@example.com" }).select("+password");
  if (existing) {
    existing.password = adminPw; // will be re-hashed by pre-save hook
    existing.isActive = true;
    existing.isEmailVerified = true;
    existing.companyId = company._id;
    await existing.save();
    console.log("✅  demo@example.com password reset to Demo@123456");
  } else {
    await new User({
      name: "Demo Admin",
      email: "demo@example.com",
      password: adminPw,
      role: "COMPANY_ADMIN",
      companyId: company._id,
      isEmailVerified: true,
      isActive: true,
    }).save();
    console.log("✅  demo@example.com created with password Demo@123456");
  }

  // ── Upsert agent alice ────────────────────────────────────────────────────────
  const agentPw = "Agent@123456";
  const alice = await User.findOne({ email: "alice@example.com" }).select("+password");
  if (alice) {
    alice.password = agentPw;
    alice.isActive = true;
    alice.isEmailVerified = true;
    alice.companyId = company._id;
    await alice.save();
    console.log("✅  alice@example.com password reset to Agent@123456");
  } else {
    await new User({
      name: "Agent Alice",
      email: "alice@example.com",
      password: agentPw,
      role: "AGENT",
      companyId: company._id,
      isEmailVerified: true,
      isActive: true,
      isOnline: true,
    }).save();
    console.log("✅  alice@example.com created with password Agent@123456");
  }

  console.log("\n🎉  Done! Login credentials:");
  console.log("  Admin → demo@example.com    / Demo@123456");
  console.log("  Agent → alice@example.com   / Agent@123456\n");
  process.exit(0);
}

fix().catch(e => { console.error("Fix failed:", e); process.exit(1); });
