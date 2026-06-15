import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, paginatedResponse, paginate, checkUsageLimit, incrementUsage } from "@/lib/api-helpers";
import User from "@/models/User";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company context required", 400);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role");

  const query: Record<string, unknown> = {
    companyId: ctx.companyId,
    role: { $in: ["AGENT", "MANAGER", "TEAM_LEADER", "VIEWER"] },
  };
  if (search) query.name = { $regex: search, $options: "i" };
  if (role) query.role = role;

  const { skip } = paginate(page, limit);
  const [agents, total] = await Promise.all([
    User.find(query).select("-password").skip(skip).limit(limit).sort({ name: 1 }),
    User.countDocuments(query),
  ]);

  return paginatedResponse(agents, total, page, limit);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company context required", 400);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const body = await request.json();
  const { name, email, password, role = "AGENT", departmentId, skills, languages, maxConcurrentChats } = body;

  if (!name || !email || !password) return apiError("Missing required fields");

  const usageCheck = await checkUsageLimit(ctx.companyId, "agents" as keyof import("@/models/Usage").IUsage);
  if (!usageCheck.allowed) {
    return apiError(`Agent limit reached. Your plan allows ${usageCheck.limit} agents. Upgrade to add more.`, 403);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) return apiError("Email already exists");

  const agent = await User.create({
    name,
    email,
    password,
    role,
    companyId: ctx.companyId,
    departmentId,
    skills,
    languages: languages || ["en"],
    maxConcurrentChats: maxConcurrentChats || 5,
    isEmailVerified: true,
  });

  await incrementUsage(ctx.companyId, "agents");

  return apiSuccess(
    { id: agent._id, name: agent.name, email: agent.email, role: agent.role },
    "Agent created",
    201
  );
}
