import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Ticket from "@/models/Ticket";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  await connectDB();

  const ticket = await Ticket.findOne({ _id: id, companyId: ctx.companyId })
    .populate("assignedTo", "name email avatar")
    .populate("departmentId", "name color")
    .populate("createdBy", "name email");

  if (!ticket) return apiError("Ticket not found", 404);
  return apiSuccess(ticket);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);

  const { id } = await params;
  await connectDB();

  const body = await request.json();
  const { addComment, ...rest } = body;

  if (addComment) {
    const ticket = await Ticket.findOneAndUpdate(
      { _id: id, companyId: ctx.companyId },
      {
        $push: {
          comments: {
            content: addComment.content,
            isInternal: addComment.isInternal ?? false,
            requesterComment: false,
            createdBy: ctx.userId,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).populate("assignedTo", "name email").populate("comments.createdBy", "name");
    if (!ticket) return apiError("Ticket not found", 404);
    return apiSuccess(ticket, "Comment added");
  }

  const updateData: Record<string, unknown> = { ...rest };
  if (rest.status === "RESOLVED" && !rest.resolvedAt) updateData.resolvedAt = new Date();
  if (rest.status === "CLOSED" && !rest.closedAt) updateData.closedAt = new Date();

  const ticket = await Ticket.findOneAndUpdate(
    { _id: id, companyId: ctx.companyId },
    updateData,
    { new: true }
  ).populate("assignedTo", "name email avatar");

  if (!ticket) return apiError("Ticket not found", 404);
  return apiSuccess(ticket, "Ticket updated");
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"].includes(ctx.userRole)) {
    return apiError("Forbidden", 403);
  }

  const { id } = await params;
  await connectDB();

  await Ticket.findOneAndDelete({ _id: id, companyId: ctx.companyId });
  return apiSuccess(null, "Ticket deleted");
}
