import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { requireSuperAdminForCompany, isAdminContextError } from "@/lib/admin-helpers";
import { cachedJson } from "@/lib/admin-cache";
import WhatsAppCampaign from "@/models/WhatsAppCampaign";
import RCSCampaign from "@/models/RCSCampaign";
import EmailCampaign from "@/models/EmailCampaign";
import WhatsAppContact from "@/models/WhatsAppContact";
import RCSContact from "@/models/RCSContact";
import EmailContact from "@/models/EmailContact";
import WhatsAppConversation from "@/models/WhatsAppConversation";

interface CampaignStats {
  total: number; sent: number; delivered: number; failed: number;
  read?: number; opened?: number; clicked?: number; bounced?: number;
}

function sumStats(campaigns: { stats?: CampaignStats }[]) {
  const acc = { total: 0, sent: 0, delivered: 0, failed: 0, readOrOpened: 0, clicked: 0, bounced: 0 };
  for (const c of campaigns) {
    const s = c.stats;
    if (!s) continue;
    acc.total += s.total || 0;
    acc.sent += s.sent || 0;
    acc.delivered += s.delivered || 0;
    acc.failed += s.failed || 0;
    acc.readOrOpened += (s.read || s.opened || 0);
    acc.clicked += s.clicked || 0;
    acc.bounced += s.bounced || 0;
  }
  // "sent" is stored cumulatively (includes delivered/read/opened/clicked), so
  // whatever hasn't reached sent or failed yet is still pending in the queue.
  const pending = Math.max(0, acc.total - acc.sent - acc.failed);
  return { ...acc, pending };
}

// Company-wide rollup across all three campaign channels — every number here comes
// straight from the campaigns' own `stats` field (kept live by each channel's
// recompute*Stats() helper off real webhook events), plus two cheap extra queries
// for unsubscribes and WhatsApp reply activity. No channel is asked for a metric
// it doesn't actually track (e.g. RCS/Email have no reply capture — see the
// company-level GET /campaigns/replies route for why).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireSuperAdminForCompany(request, id);
  if (isAdminContextError(ctx)) return apiError(ctx.error, ctx.status);

  await connectDB();

  // Fans out into 7 queries every call — cached for a short window behind Redis
  // (when reachable; falls straight through to a live compute otherwise) so
  // rapid tab-switching/polling on the company detail page doesn't hammer Mongo.
  // Data can lag up to `ttlSecs` behind a webhook update, which is an acceptable
  // trade for an admin rollup view.
  const data = await cachedJson(`campaign-stats:${id}`, 20, async () => {
    const [waCampaigns, rcsCampaigns, emailCampaigns] = await Promise.all([
      WhatsAppCampaign.find({ companyId: id }).select("stats").lean(),
      RCSCampaign.find({ companyId: id }).select("stats").lean(),
      EmailCampaign.find({ companyId: id }).select("stats").lean(),
    ]);

    const wa = sumStats(waCampaigns);
    const rcs = sumStats(rcsCampaigns);
    const email = sumStats(emailCampaigns);

    const [waUnsub, rcsUnsub, emailUnsub, waConversationsWithReplies, activeCampaigns] = await Promise.all([
      WhatsAppContact.countDocuments({ companyId: id, optIn: false }),
      RCSContact.countDocuments({ companyId: id, optIn: false }),
      EmailContact.countDocuments({ companyId: id, optIn: false }),
      // "Replied" for WhatsApp: conversations that have at least one inbound message
      // ever (lastMessage/unreadCount alone don't tell us direction, so this counts
      // conversations that exist at all as a proxy for "the contact engaged back" —
      // see the /replies route for the real per-conversation reply list).
      WhatsAppConversation.countDocuments({ companyId: id }),
      // Lets the frontend decide whether to keep polling — no point live-refreshing
      // a company whose campaigns are all DRAFT/COMPLETED/CANCELED/FAILED.
      Promise.all([
        WhatsAppCampaign.countDocuments({ companyId: id, status: { $in: ["RUNNING", "SCHEDULED"] } }),
        RCSCampaign.countDocuments({ companyId: id, status: { $in: ["RUNNING", "SCHEDULED"] } }),
        EmailCampaign.countDocuments({ companyId: id, status: { $in: ["RUNNING", "SCHEDULED"] } }),
      ]).then(([a, b, c]) => a + b + c),
    ]);

    return {
      totalCampaigns: waCampaigns.length + rcsCampaigns.length + emailCampaigns.length,
      whatsappCampaigns: waCampaigns.length,
      rcsCampaigns: rcsCampaigns.length,
      emailCampaigns: emailCampaigns.length,
      totalRecipients: wa.total + rcs.total + email.total,
      totalSent: wa.sent + rcs.sent + email.sent,
      delivered: wa.delivered + rcs.delivered + email.delivered,
      failed: wa.failed + rcs.failed + email.failed,
      pending: wa.pending + rcs.pending + email.pending,
      readOrOpened: wa.readOrOpened + rcs.readOrOpened + email.readOrOpened,
      clicked: rcs.clicked + email.clicked,
      unsubscribed: waUnsub + rcsUnsub + emailUnsub,
      activeCampaigns,
      byChannel: {
        whatsapp: { campaigns: waCampaigns.length, ...wa, conversationsWithReplies: waConversationsWithReplies, unsubscribed: waUnsub },
        rcs: { campaigns: rcsCampaigns.length, ...rcs, unsubscribed: rcsUnsub },
        email: { campaigns: emailCampaigns.length, ...email, unsubscribed: emailUnsub },
      },
    };
  });

  return apiSuccess(data);
}
