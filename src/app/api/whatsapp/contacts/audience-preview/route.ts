import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import WhatsAppContact from "@/models/WhatsAppContact";

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const body = await request.json();
  const { tags = [], contactIds = [] } = body;

  if (!tags.length && !contactIds.length) return apiSuccess({ count: 0 });

  const count = await WhatsAppContact.countDocuments({
    companyId: ctx.companyId,
    optIn: true,
    $or: [
      ...(contactIds.length ? [{ _id: { $in: contactIds } }] : []),
      ...(tags.length ? [{ tags: { $in: tags } }] : []),
    ],
  });

  return apiSuccess({ count });
}
