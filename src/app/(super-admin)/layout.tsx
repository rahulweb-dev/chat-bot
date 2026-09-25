import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") redirect("/login");

  return (
    <div
      className="h-screen overflow-hidden p-0 sm:p-4 lg:p-8"
      style={{
        background: `
          radial-gradient(circle at 8% 8%, #2FBF9F, transparent 45%),
          radial-gradient(circle at 95% 12%, #F2A93B, transparent 42%),
          radial-gradient(circle at 92% 92%, #7C5CE0, transparent 48%),
          radial-gradient(circle at 5% 90%, #E0577C, transparent 40%),
          linear-gradient(135deg, #1FA8A0, #5B4FE0 55%, #8E4FC7)
        `,
      }}
    >
      <div className="flex h-full overflow-hidden bg-white sm:rounded-4xl sm:shadow-[0_40px_90px_rgba(30,20,70,0.35)]">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
