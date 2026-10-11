import { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { getRequestContext, apiError, apiSuccess } from "@/lib/api-helpers";
import Company from "@/models/Company";
import Settings from "@/models/Settings";
import KnowledgeBase from "@/models/KnowledgeBase";

// Facts for the dashboard's setup checklist that the overview can't derive
// from data it already loads.
export async function GET(request: NextRequest) {
  const ctx = await getRequestContext(request);
  if (!ctx) return apiError("Unauthorized", 401);
  if (!ctx.companyId) return apiError("Company required", 400);

  await connectDB();
  const [company, settings, kbCount] = await Promise.all([
    Company.findById(ctx.companyId).select("logo widgetInstall").lean<{ logo?: string; widgetInstall?: { origin?: string; firstSeenAt?: Date; lastSeenAt?: Date } }>(),
    Settings.findOne({ companyId: ctx.companyId }).select("widget.primaryColor widget.logo").lean<{ widget?: { primaryColor?: string; logo?: string } }>(),
    KnowledgeBase.countDocuments({ companyId: ctx.companyId }),
  ]);
  if (!company) return apiError("Company not found", 404);

  const color = settings?.widget?.primaryColor?.toLowerCase();
  return apiSuccess({
    // Default color and no logo means the widget still looks like the template.
    brandDone: !!(company.logo || settings?.widget?.logo || (color && color !== "#6366f1")),
    knowledgeDone: kbCount > 0,
    install: company.widgetInstall?.origin
      ? { origin: company.widgetInstall.origin, lastSeenAt: company.widgetInstall.lastSeenAt }
      : null,
  });
}
