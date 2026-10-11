"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Clock } from "lucide-react";

type UsagePlan = { name: string; type: string; expired?: boolean; periodEnd?: string; daysLeft?: number | null };

// Thin bar above every dashboard page when the plan is about to end or has
// ended. Shown to company admins only — they're the ones who can pay.
export function PlanBanner() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const isAdmin = session?.user?.role === "COMPANY_ADMIN";

  const { data: plan } = useQuery({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await fetch("/api/usage");
      const d = await res.json();
      return d.data;
    },
    enabled: isAdmin,
    select: (d: { plan?: UsagePlan }) => d?.plan,
    staleTime: 5 * 60 * 1000,
  });

  if (!isAdmin || !plan) return null;

  const daysLeft = plan.daysLeft ?? null;
  const ending = !plan.expired && daysLeft !== null && daysLeft <= 3 && daysLeft >= 0;
  if (!plan.expired && !ending) return null;

  const onBilling = pathname?.startsWith("/dashboard/billing");

  return (
    <div
      role="status"
      className={`flex items-center gap-3 px-4 sm:px-6 py-2.5 text-sm border-b ${
        plan.expired ? "bg-red-50 text-red-800 border-red-200" : "bg-amber-50 text-amber-900 border-amber-200"
      }`}
    >
      {plan.expired ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <Clock className="w-4 h-4 shrink-0" />}
      <span className="flex-1 min-w-0">
        {plan.expired
          ? "Your plan has ended. You're on the free tier (50 chats a month, no AI answers). Your data is safe."
          : `Your ${plan.name} plan ends in ${daysLeft === 0 ? "less than a day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"}`}.`}
      </span>
      {!onBilling && (
        <Link
          href="/dashboard/billing"
          className={`shrink-0 font-semibold rounded-md px-3 py-1 text-white ${plan.expired ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
        >
          {plan.expired ? "Choose a plan" : "Renew"}
        </Link>
      )}
    </div>
  );
}
