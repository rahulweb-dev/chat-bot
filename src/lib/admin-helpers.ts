import { NextRequest } from "next/server";
import { getRequestContext } from "@/lib/api-helpers";

export interface AdminCompanyContext {
  userId: string;
  userRole: string;
  companyId: string; // the company being viewed, from the URL — not the caller's own
}

// Every existing WhatsApp/RCS/Email campaign route scopes to ctx.companyId from the
// session, which a SUPER_ADMIN doesn't have — they're not a member of any company.
// Admin-facing routes instead take the target company from the URL and only check
// that the caller is actually a super admin, mirroring the pattern already used in
// src/app/api/companies/[id]/route.ts and src/app/api/whatsapp/wallet/add-credits/route.ts.
export async function requireSuperAdminForCompany(
  request: NextRequest,
  companyId: string
): Promise<AdminCompanyContext | { error: string; status: number }> {
  const ctx = await getRequestContext(request);
  if (!ctx) return { error: "Unauthorized", status: 401 };
  if (ctx.userRole !== "SUPER_ADMIN") return { error: "Forbidden", status: 403 };
  if (!companyId) return { error: "Company ID required", status: 400 };
  return { userId: ctx.userId, userRole: ctx.userRole, companyId };
}

export function isAdminContextError(x: AdminCompanyContext | { error: string; status: number }): x is { error: string; status: number } {
  return "error" in x;
}
