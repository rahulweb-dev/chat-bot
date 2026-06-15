import { auth } from "@/lib/auth";
import { DashboardOverview } from "@/components/dashboard/overview";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  return <DashboardOverview role={session?.user?.role || "AGENT"} />;
}
