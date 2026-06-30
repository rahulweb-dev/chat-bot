import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 bg-[#f8fafc]">
          {children}
        </main>
      </div>
    </div>
  );
}
