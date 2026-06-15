import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, paginatedResponse, paginate } from "@/lib/api-helpers";
import User from "@/models/User";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (ctx.userRole !== "SUPER_ADMIN") return apiError("Forbidden", 403);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const search = searchParams.get("search") || "";
  const { skip } = paginate(page, limit);

  const query: Record<string, unknown> = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .select("-password")
      .populate("companyId", "name slug")
      .skip(skip).limit(limit)
      .sort({ createdAt: -1 }),
    User.countDocuments(query),
  ]);

  return paginatedResponse(users, total, page, limit);
}
