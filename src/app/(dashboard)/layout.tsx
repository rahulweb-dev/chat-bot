import { Fraunces, Work_Sans } from "next/font/google";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export const dynamic = "force-dynamic";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-fraunces" });
const workSans = Work_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-work-sans" });

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fraunces.variable} ${workSans.variable} h-screen overflow-hidden flex bg-[#F3F2EE]`} style={{ fontFamily: "var(--font-work-sans), sans-serif" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
