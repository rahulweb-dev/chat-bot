import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SuperAdminDashboard } from "@/components/admin/super-admin-dashboard";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Super Admin" };

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/dashboard");
  return <SuperAdminDashboard />;
}
