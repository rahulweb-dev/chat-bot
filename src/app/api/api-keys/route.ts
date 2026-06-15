import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import ApiKey from "@/models/ApiKey";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const keys = await ApiKey.find({ companyId: ctx.companyId })
    .populate("createdBy", "name email")
    .select("-hashedKey")
    .sort({ createdAt: -1 });

  return apiSuccess(keys);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const { name, permissions = [], expiresAt, rateLimit = 1000 } = body;

  if (!name) return apiError("Name required");

  const rawKey = `sf_${uuidv4().replace(/-/g, "")}`;
  const hashedKey = await bcrypt.hash(rawKey, 10);

  const apiKey = await ApiKey.create({
    companyId: ctx.companyId,
    name,
    key: rawKey,
    hashedKey,
    permissions,
    expiresAt,
    rateLimit,
    createdBy: ctx.userId,
  });

  return apiSuccess(
    { ...apiKey.toObject(), key: rawKey },
    "API key created. Save this key — it won't be shown again.",
    201
  );
}
