import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import KnowledgeBase from "@/models/KnowledgeBase";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  await connectDB();
  const doc = await KnowledgeBase.findOne({ _id: id, companyId: ctx.companyId });
  if (!doc) return apiError("Not found", 404);

  return apiSuccess(doc);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const body = await request.json();
  // Strip companyId/_id so a request can't re-parent a document into a
  // different tenant (or spoof its id) just by including those fields in
  // the body — the filter above only controls which document is found, not
  // what an update is allowed to write.
  const { companyId: _companyId, _id: _ignoredId, ...update } = body;
  const doc = await KnowledgeBase.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId },
    { $set: update },
    { new: true }
  );
  if (!doc) return apiError("Not found", 404);

  return apiSuccess(doc, "Document updated");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  await connectDB();
  const doc = await KnowledgeBase.findOneAndDelete({ _id: id, companyId: ctx.companyId });
  if (!doc) return apiError("Not found", 404);

  return apiSuccess(null, "Document deleted");
}
