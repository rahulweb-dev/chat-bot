import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess, paginatedResponse, paginate, incrementUsage } from "@/lib/api-helpers";
import Ticket from "@/models/Ticket";
import Notification from "@/models/Notification";

async function generateTicketNumber(companyId: string): Promise<string> {
  const count = await Ticket.countDocuments({ companyId });
  return `TKT-${String(count + 1).padStart(5, "0")}`;
}

export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const search = searchParams.get("search");

  const query: Record<string, unknown> = { companyId: ctx.companyId };
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (ctx.userRole === "AGENT") query.assignedTo = ctx.userId;
  if (search) {
    query.$or = [
      { subject: { $regex: search, $options: "i" } },
      { ticketNumber: { $regex: search, $options: "i" } },
      { "requester.email": { $regex: search, $options: "i" } },
    ];
  }

  const { skip } = paginate(page, limit);
  const [tickets, total] = await Promise.all([
    Ticket.find(query)
      .populate("assignedTo", "name email avatar")
      .populate("departmentId", "name color")
      .skip(skip).limit(limit).sort({ createdAt: -1 }),
    Ticket.countDocuments(query),
  ]);

  return paginatedResponse(tickets, total, page, limit);
}

export async function POST(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const body = await request.json();

  const ticketNumber = await generateTicketNumber(ctx.companyId);
  const ticket = await Ticket.create({
    ...body,
    companyId: ctx.companyId,
    ticketNumber,
    createdBy: ctx.userId !== "api" ? ctx.userId : undefined,
    status: "OPEN",
  });

  if (ticket.assignedTo) {
    await Notification.create({
      companyId: ctx.companyId,
      userId: ticket.assignedTo,
      type: "TICKET_ASSIGNED",
      title: "New Ticket Assigned",
      message: `Ticket ${ticketNumber}: ${body.subject}`,
      data: { ticketId: ticket._id },
      link: `/dashboard/tickets/${ticket._id}`,
    });
  }

  await incrementUsage(ctx.companyId, "tickets");

  return apiSuccess(ticket, "Ticket created", 201);
}
