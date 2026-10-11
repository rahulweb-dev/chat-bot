import { connectDB } from "@/lib/mongodb";
import { getEffectivePlan } from "@/lib/plan-limits";
import Company from "@/models/Company";
import Plan from "@/models/Plan";

// White labeling (agencies reselling under their own brand) is a plan feature:
// Enterprise, or any plan whose feature list mentions white labeling. Checked
// against the *effective* plan, so it switches off if the plan lapses.
export async function canWhiteLabel(companyId: string): Promise<boolean> {
  await connectDB();
  const eff = await getEffectivePlan(companyId);
  if (!eff || eff.expired) return false;
  if (eff.type === "ENTERPRISE") return true;
  const company = await Company.findById(companyId).select("planId").lean<{ planId?: unknown }>();
  const plan = company?.planId ? await Plan.findById(company.planId).select("features").lean<{ features?: string[] }>() : null;
  return (plan?.features ?? []).some((f) => /white[\s-]?label/i.test(f));
}

export interface Branding {
  allowed: boolean;
  brandName?: string;
  brandLogo?: string;
  hidePoweredBy: boolean;
  poweredByText?: string;
  poweredByUrl?: string;
}

// What to show for this company. Without the feature, Convo360 branding applies
// regardless of what's saved (so saved settings come back if they upgrade again).
export async function getBranding(companyId: string): Promise<Branding> {
  await connectDB();
  const [allowed, company] = await Promise.all([
    canWhiteLabel(companyId),
    Company.findById(companyId).select("whiteLabelSettings").lean<{ whiteLabelSettings?: { hideBranding?: boolean; brandName?: string; brandLogo?: string; poweredByText?: string; poweredByUrl?: string } }>(),
  ]);
  const w = company?.whiteLabelSettings ?? {};
  if (!allowed) return { allowed: false, hidePoweredBy: false };
  return {
    allowed: true,
    brandName: w.brandName?.trim() || undefined,
    brandLogo: w.brandLogo?.trim() || undefined,
    hidePoweredBy: !!w.hideBranding,
    poweredByText: w.poweredByText?.trim() || undefined,
    poweredByUrl: /^https?:\/\//i.test(w.poweredByUrl ?? "") ? w.poweredByUrl : undefined,
  };
}
