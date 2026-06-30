import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, paginatedResponse, paginate } from "@/lib/api-helpers";
import { rateLimit, rateLimitError, ipKey } from "@/lib/rate-limit";
import Company from "@/models/Company";
import User from "@/models/User";
import Plan from "@/models/Plan";
import Settings from "@/models/Settings";
import Usage from "@/models/Usage";
import WhatsAppIntegration from "@/models/WhatsAppIntegration";
import { encrypt } from "@/lib/crypto";
import { v4 as uuidv4 } from "uuid";

const createCompanySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  adminName: z.string().min(2).max(100),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8).max(128),
  planType: z.enum(["STARTER", "PRO", "ENTERPRISE"]).default("STARTER"),
  whatsapp: z.object({
    businessAccountId: z.string().min(1).max(64),
    phoneNumberId: z.string().min(1).max(64),
    displayPhoneNumber: z.string().max(20).optional(),
    accessToken: z.string().min(1).max(1000),
    webhookVerifyToken: z.string().min(8).max(128),
  }).optional(),
});

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
  if (status === "active")   { query.isActive = true;  query.isSuspended = false; }
  if (status === "inactive") { query.isActive = false; query.isSuspended = false; }
  if (status === "suspended") query.isSuspended = true;

  const { skip } = paginate(page, limit);
  const [companies, total] = await Promise.all([
    Company.find(query)
      .select("-apiKey")
      .populate({ path: "planId", model: Plan })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Company.countDocuments(query),
  ]);

  return paginatedResponse(companies, total, page, limit);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  // Rate-limit: max 20 company creations per hour per IP
  if (!rateLimit(ipKey(request, "create-company"), 20, 60 * 60 * 1000)) {
    return rateLimitError();
  }

  await connectDB();
  const raw = await request.json();
  const parsed = createCompanySchema.safeParse(raw);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  const { name, email, adminName, adminEmail, adminPassword, planType, whatsapp } = parsed.data;

  // WhatsApp conflict check before opening a transaction
  if (whatsapp) {
    const conflict = await WhatsAppIntegration.findOne({ phoneNumberId: whatsapp.phoneNumberId });
    if (conflict) return apiError("This WhatsApp Phone Number ID is already connected to another company");
  }

  const plan = await Plan.findOne({ type: planType });
  if (!plan) return apiError("Plan not found");

  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
  const apiKey = `sf_${uuidv4().replace(/-/g, "")}`;
  const period = new Date().toISOString().slice(0, 7);

  const session = await mongoose.startSession();
  let company: InstanceType<typeof Company> | null = null;
  let admin: InstanceType<typeof User> | null = null;
  let whatsappIntegration: InstanceType<typeof WhatsAppIntegration> | null = null;

  try {
    await session.withTransaction(async () => {
      [company] = await Company.create(
        [
          {
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
          },
        ],
        { session }
      );

      [admin] = await User.create(
        [
          {
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            role: "COMPANY_ADMIN",
            companyId: company!._id,
            isEmailVerified: true,
          },
        ],
        { session }
      );

      await Settings.create([{ companyId: company!._id }], { session });
      await Usage.create([{ companyId: company!._id, period }], { session });

      if (whatsapp) {
        [whatsappIntegration] = await WhatsAppIntegration.create(
          [
            {
              companyId: company!._id,
              businessAccountId: whatsapp.businessAccountId,
              phoneNumberId: whatsapp.phoneNumberId,
              displayPhoneNumber: whatsapp.displayPhoneNumber ?? "",
              encryptedAccessToken: encrypt(whatsapp.accessToken),
              encryptedWebhookVerifyToken: encrypt(whatsapp.webhookVerifyToken),
              enabled: true,
            },
          ],
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return apiSuccess(
    { companyId: company!._id, adminId: admin!._id, whatsappConnected: !!whatsappIntegration },
    "Company created successfully",
    201
  );
}
