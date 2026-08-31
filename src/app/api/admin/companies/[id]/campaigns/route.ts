import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { requireSuperAdminForCompany, isAdminContextError } from "@/lib/admin-helpers";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import RCSCampaign from "@/models/RCSCampaign";
import EmailCampaign from "@/models/EmailCampaign";

type Channel = "WHATSAPP" | "RCS" | "EMAIL";

interface NormalizedCampaign {
  _id: string;
  channel: Channel;
  name: string;
  status: string;
  recipients: number;
  sent: number;
  delivered: number;
  failed: number;
  readOrOpened: number;
  clicked: number;
  createdAt: string;
  scheduledAt?: string;
  sentAt?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(doc: any, channel: Channel): NormalizedCampaign {
  const s = (doc.stats as { total?: number; sent?: number; delivered?: number; failed?: number; read?: number; opened?: number; clicked?: number }) || {};
  return {
    _id: String(doc._id),
    channel,
    name: String(doc.name || "Untitled"),
    status: String(doc.status || "DRAFT"),
    recipients: s.total || 0,
    sent: s.sent || 0,
    delivered: s.delivered || 0,
    failed: s.failed || 0,
    readOrOpened: s.read || s.opened || 0,
    clicked: s.clicked || 0,
    createdAt: (doc.createdAt as Date)?.toISOString?.() || String(doc.createdAt || ""),
    scheduledAt: (doc.scheduledAt as Date)?.toISOString?.(),
    sentAt: (doc.startedAt as Date)?.toISOString?.(),
  };
}

// One combined, filterable list across all three campaign channels — each model
// is queried separately (they're unrelated collections) and normalized into one
// shape for the table, then merged/sorted/paginated in memory. Fine at this scale
// (a company's total campaign count, not recipient count); would need a real
// aggregation pipeline if that stops being true.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  await connectDB();
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get("channel"); // "WHATSAPP" | "RCS" | "EMAIL" | null (all)
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const baseQuery: Record<string, unknown> = { companyId: id };
  if (status) baseQuery.status = status;
  if (search) baseQuery.name = { $regex: search, $options: "i" };
  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {};
    if (dateFrom) range.$gte = new Date(dateFrom);
    if (dateTo) range.$lte = new Date(dateTo);
    baseQuery.createdAt = range;
  }

  const wantWhatsApp = !channel || channel === "WHATSAPP";
  const wantRcs = !channel || channel === "RCS";
  const wantEmail = !channel || channel === "EMAIL";

  const [waDocs, rcsDocs, emailDocs] = await Promise.all([
    wantWhatsApp ? WhatsAppCampaign.find(baseQuery).sort({ createdAt: -1 }).lean() : Promise.resolve([]),
    wantRcs ? RCSCampaign.find(baseQuery).sort({ createdAt: -1 }).lean() : Promise.resolve([]),
    wantEmail ? EmailCampaign.find(baseQuery).sort({ createdAt: -1 }).lean() : Promise.resolve([]),
  ]);

  const all = [
    ...waDocs.map((d) => normalize(d, "WHATSAPP")),
    ...rcsDocs.map((d) => normalize(d, "RCS")),
    ...emailDocs.map((d) => normalize(d, "EMAIL")),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = all.length;
  const start = (page - 1) * limit;
  const items = all.slice(start, start + limit);

  return apiSuccess({ items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
}
