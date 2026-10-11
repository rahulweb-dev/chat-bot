import { NextRequest } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import { releaseSlot } from "@/lib/booking";
import Booking from "@/models/Booking";

const patchSchema = z.object({
  status: z.enum(["BOOKED", "CANCELLED", "COMPLETED", "NO_SHOW"]).optional(),
  notes: z.string().max(2000).optional(),
});

// Mark a booking done / no-show / cancelled, or add notes. Cancelling frees
// the place in that slot for other visitors.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);
  if (ctx.userRole === "VIEWER") return apiError("Forbidden", 403);

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 422);

  await connectDB();
  const before = await Booking.findOne({ _id: id, companyId: ctx.companyId });
  if (!before) return apiError("Booking not found", 404);

  const booking = await Booking.findByIdAndUpdate(id, { $set: parsed.data }, { new: true });
  if (before.status === "BOOKED" && parsed.data.status === "CANCELLED") {
    await releaseSlot(ctx.companyId, before.startAt).catch(() => {});
  }
  return apiSuccess(booking, "Booking updated");
}
