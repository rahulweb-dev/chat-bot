import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, paginatedResponse, paginate } from "@/lib/api-helpers";
import Company from "@/models/Company";
import User from "@/models/User";
import Plan from "@/models/Plan";
import Settings from "@/models/Settings";
import Usage from "@/models/Usage";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");

  const query: Record<string, unknown> = {};
  if (search) query.name = { $regex: search, $options: "i" };
  if (status === "active") query.isActive = true;
  if (status === "suspended") query.isSuspended = true;

  const { skip } = paginate(page, limit);
  const [companies, total] = await Promise.all([
    Company.find(query).populate("planId").skip(skip).limit(limit).sort({ createdAt: -1 }),
    Company.countDocuments(query),
  ]);

  return paginatedResponse(companies, total, page, limit);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const { name, email, adminName, adminEmail, adminPassword, planType = "STARTER" } = body;

  if (!name || !email || !adminName || !adminEmail || !adminPassword) {
    return apiError("Missing required fields");
  }

  const plan = await Plan.findOne({ type: planType });
  if (!plan) return apiError("Plan not found");

  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
  const apiKey = `sf_${uuidv4().replace(/-/g, "")}`;

  const company = await Company.create({
    name,
    slug,
    email,
    planId: plan._id,
    apiKey,
    settings: {
      brandColor: "#6366f1",
      widgetPosition: "bottom-right",
      welcomeMessage: "Hi! How can we help you today?",
    },
  });

  const admin = await User.create({
    name: adminName,
    email: adminEmail,
    password: adminPassword,
    role: "COMPANY_ADMIN",
    companyId: company._id,
    isEmailVerified: true,
  });

  await Settings.create({ companyId: company._id });
  await Usage.create({ companyId: company._id, period: new Date().toISOString().slice(0, 7) });

  await Company.findByIdAndUpdate(company._id, { subscriptionId: null });

  return apiSuccess({ company, adminId: admin._id }, "Company created successfully", 201);
}
