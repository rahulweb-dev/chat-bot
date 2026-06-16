import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import WhatsAppContact from "@/models/WhatsAppContact";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const body = await request.json();
  const { name, email, tags, optIn } = body;

  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (email !== undefined) update.email = email;
  if (tags !== undefined) update.tags = tags;
  if (optIn !== undefined) {
    update.optIn = optIn;
    if (optIn) update.optInAt = new Date();
  }

  const contact = await WhatsAppContact.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId },
    { $set: update },
    { new: true }
  );
  if (!contact) return apiError("Not found", 404);

  return apiSuccess(contact, "Contact updated");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getRequestContext(request);
  if (!ctx || !ctx.companyId) return apiError("Unauthorized", 401);

  await connectDB();
  const contact = await WhatsAppContact.findOneAndDelete({ _id: id, companyId: ctx.companyId });
  if (!contact) return apiError("Not found", 404);

  return apiSuccess(null, "Contact deleted");
}
