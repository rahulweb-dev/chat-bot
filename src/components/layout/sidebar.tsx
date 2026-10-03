"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  MessageSquare, TicketIcon, Users, Building2, BarChart3,
  Settings, Bell, Key, Bot, Workflow, CreditCard,
  LayoutDashboard, BookOpen, Tag, Globe, Shield,
  Inbox, MessageCircle, Trophy, Mail, X, LogOut,
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  roles?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Live Chat",      href: "/dashboard/chat",          icon: MessageSquare, badge: "Live" },
      { label: "WhatsApp",       href: "/dashboard/whatsapp",      icon: MessageCircle },
      { label: "Email Campaigns", href: "/dashboard/email-campaigns", icon: Mail },
      { label: "Conversations",  href: "/dashboard/conversations", icon: Inbox },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "Tickets",   href: "/dashboard/tickets", icon: TicketIcon },
      { label: "Leads & CRM", href: "/dashboard/leads", icon: Tag },
    ],
  },
  {
    label: "Team",
    items: [
      { label: "Agents",      href: "/dashboard/agents",      icon: Users,      roles: ["COMPANY_ADMIN", "MANAGER"] },
      { label: "Departments", href: "/dashboard/departments", icon: Building2,  roles: ["COMPANY_ADMIN", "MANAGER"] },
    ],
  },
  {
    label: "AI & Automation",
    items: [
      { label: "Chatbot",        href: "/dashboard/chatbot",           icon: Bot,      roles: ["COMPANY_ADMIN", "MANAGER"] },
      { label: "Knowledge Base", href: "/dashboard/knowledge-base",    icon: BookOpen },
      { label: "Workflows",      href: "/dashboard/workflows",         icon: Workflow, roles: ["COMPANY_ADMIN", "MANAGER"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Analytics",    href: "/dashboard/analytics",   icon: BarChart3, roles: ["COMPANY_ADMIN", "MANAGER", "TEAM_LEADER"] },
      { label: "Leaderboard",  href: "/dashboard/leaderboard", icon: Trophy,    roles: ["COMPANY_ADMIN", "MANAGER", "TEAM_LEADER"] },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Billing",        href: "/dashboard/billing",        icon: CreditCard, roles: ["COMPANY_ADMIN"] },
      { label: "API Keys",       href: "/dashboard/api-keys",       icon: Key,       roles: ["COMPANY_ADMIN"] },
      { label: "Audit Logs",     href: "/dashboard/audit-logs",     icon: Shield,    roles: ["COMPANY_ADMIN"] },
      { label: "Notifications",  href: "/dashboard/notifications",  icon: Bell },
    ],
  },
];

const SUPER_ADMIN_GROUPS: NavGroup[] = [
  {
    label: "",
    items: [{ label: "Overview", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "Management",
    items: [
      { label: "Companies", href: "/admin/companies", icon: Globe },
      { label: "Plans",     href: "/admin/plans",     icon: CreditCard },
      { label: "Revenue",   href: "/admin/revenue",   icon: BarChart3 },
      { label: "Users",     href: "/admin/users",     icon: Users },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Audit Logs", href: "/admin/audit-logs", icon: Shield },
    ],
  },
];

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen);
  const closeMobileNav = useUIStore((s) => s.closeMobileNav);
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const groups = isSuperAdmin ? SUPER_ADMIN_GROUPS : NAV_GROUPS;
  const userRole = session?.user?.role || "";
  const settingsHref = isSuperAdmin ? "/admin/settings" : "/dashboard/settings";

  return (
    <>
      {/* Mobile backdrop — dismisses the drawer, never rendered/needed at lg+ */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}
      <aside className={cn(
        "h-full shrink-0 transition-transform duration-300 flex flex-col",
        "w-[236px] bg-white border-r border-[#ECEBE6] py-6 px-4.5",
        // Mobile: fixed off-canvas drawer, slides in over content
        "fixed inset-y-0 left-0 z-50",
        mobileNavOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: back in normal flow, never translated
        "lg:relative lg:z-auto lg:translate-x-0"
      )}>
        <div className="flex items-center justify-between px-1.5 pb-6">
          <Link
            href={isSuperAdmin ? "/admin" : "/dashboard"}
            className="font-display font-bold text-[21px] tracking-tight text-[#15140F]"
          >
            SupportFlow
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            className="lg:hidden text-[#9A988D] hover:text-[#15140F]"
            onClick={closeMobileNav}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 [&::-webkit-scrollbar]:hidden">
          {groups.map((group, gi) => {
            const visible = group.items.filter(item => !item.roles || item.roles.includes(userRole));
            if (!visible.length) return null;

            return (
              <div key={gi} className="flex flex-col gap-0.5">
                {group.label && (
                  <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#B3B1A6]">
                    {group.label}
                  </p>
                )}
                {visible.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href
                    || (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMobileNav}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors shrink-0",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15140F]/30",
                        isActive ? "bg-[#15140F] text-white font-semibold" : "text-[#716F66] hover:bg-[#F3F2EE] hover:text-[#15140F]"
                      )}
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge && (
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          isActive ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="mt-4 pt-3.5 border-t border-[#ECEBE6] flex flex-col gap-0.5">
          <Link
            href={settingsHref}
            onClick={closeMobileNav}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13.5px] font-medium text-[#716F66] hover:bg-[#F3F2EE] hover:text-[#15140F] transition-colors"
          >
            <Settings className="w-[17px] h-[17px]" />
            Settings
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13.5px] font-medium text-[#716F66] hover:bg-[#F3F2EE] hover:text-[#15140F] transition-colors text-left"
          >
            <LogOut className="w-[17px] h-[17px]" />
            Log out
          </button>
          <Link
            href="/dashboard/profile"
            onClick={closeMobileNav}
            className="flex items-center gap-2.5 mt-2.5 px-3 py-2 rounded-xl hover:bg-[#F3F2EE] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#15140F] text-white flex items-center justify-center text-[11px] font-bold shrink-0 overflow-hidden">
              {session?.user?.image
                ? <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                : getInitials(session?.user?.name || "U")}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#15140F] truncate">{session?.user?.name || "Account"}</p>
              <p className="text-[11px] text-[#9A988D] truncate">{session?.user?.email}</p>
            </div>
          </Link>
        </div>
      </aside>
    </>
  );
}
