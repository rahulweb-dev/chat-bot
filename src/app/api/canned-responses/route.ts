import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import CannedResponse from "@/models/CannedResponse";

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const category = searchParams.get("category");

  const query: Record<string, unknown> = { companyId: ctx.companyId, isActive: true };
  if (category) query.category = category;
  if (search) {
    query.$or = [
      { title:    { $regex: search, $options: "i" } },
      { shortcut: { $regex: search, $options: "i" } },
      { content:  { $regex: search, $options: "i" } },
    ];
  }

  const responses = await CannedResponse.find(query).sort({ usageCount: -1, title: 1 });
  return apiSuccess(responses);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const { title, shortcut, content, category } = body;

  if (!title || !shortcut || !content) return apiError("title, shortcut and content are required");

  const clean = shortcut.toLowerCase().replace(/[^a-z0-9_-]/g, "");

  const existing = await CannedResponse.findOne({ companyId: ctx.companyId, shortcut: clean });
  if (existing) return apiError(`Shortcut /${clean} already exists`);

  const doc = await CannedResponse.create({
    companyId: ctx.companyId,
    title,
    shortcut: clean,
    content,
    category: category || "General",
    createdBy: ctx.userId !== "api" ? ctx.userId : undefined,
  });

  return apiSuccess(doc, "Canned response created", 201);
}

export async function PATCH(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return apiError("id required");

  if (updates.shortcut) updates.shortcut = updates.shortcut.toLowerCase().replace(/[^a-z0-9_-]/g, "");

  const doc = await CannedResponse.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId },
    updates,
    { new: true }
  );
  if (!doc) return apiError("Not found", 404);
  return apiSuccess(doc);
}

export async function DELETE(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) return apiError("Forbidden", 403);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return apiError("id required");

  await CannedResponse.findOneAndDelete({ _id: id, companyId: ctx.companyId });
  return apiSuccess(null, "Deleted");
}
