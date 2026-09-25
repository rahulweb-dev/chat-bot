"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  MessageSquare, TicketIcon, Users, Building2, BarChart3,
  Settings, Bell, Key, Bot, Workflow, CreditCard,
  LayoutDashboard, BookOpen, Tag, Globe, Shield,
  Inbox, MessageCircle, Trophy, Mail, X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
      { label: "Settings",       href: "/dashboard/settings",       icon: Settings },
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
      { label: "Settings",   href: "/admin/settings",   icon: Settings },
    ],
  },
];

// Icon-only "pill" rail — the design this replaced showed full text labels with
// an expand/collapse toggle; this one never shows labels at all (matching the
// floating-card reference), so every item leans on title/aria-label instead of
// visible text. That's a real accessibility trade-off for touch users (no
// hover to reveal a tooltip) — acceptable here because it mirrors the chosen
// reference design, but worth knowing if mobile nav usability ever comes up.
export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen);
  const closeMobileNav = useUIStore((s) => s.closeMobileNav);
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const groups = isSuperAdmin ? SUPER_ADMIN_GROUPS : NAV_GROUPS;
  const userRole = session?.user?.role || "";

  return (
    <>
      {/* Mobile backdrop — dismisses the drawer, never rendered/needed at lg+ */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobileNav}
          aria-hidden="true"
        />
      )}
      <aside className={cn(
        "h-full shrink-0 transition-transform duration-300 flex items-center py-3",
        // Mobile: fixed off-canvas drawer, slides in over content
        "fixed inset-y-0 left-0 z-50 w-24 px-3",
        mobileNavOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: back in normal flow, never translated
        "lg:relative lg:z-auto lg:translate-x-0 lg:w-24 lg:px-3 lg:py-4"
      )}>
        <div className="relative w-16 h-full max-h-full rounded-[28px] bg-gradient-to-b from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-900/20 flex flex-col items-center py-4 mx-auto">
          {/* Mobile close */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close menu"
            className="lg:hidden absolute -right-9 top-0 h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
            onClick={closeMobileNav}
          >
            <X className="w-4 h-4" />
          </Button>

          {/* Brand mark */}
          <Link
            href={isSuperAdmin ? "/admin" : "/dashboard"}
            aria-label="SupportFlow home"
            className="w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 transition-colors flex items-center justify-center shrink-0 mb-4"
          >
            <MessageSquare className="w-4.5 h-4.5 text-white" />
          </Link>

          <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-1.5 w-full [&::-webkit-scrollbar]:hidden">
            {groups.map((group, gi) => {
              const visible = group.items.filter(item => !item.roles || item.roles.includes(userRole));
              if (!visible.length) return null;

              return (
                <div key={gi} className="flex flex-col items-center gap-1.5 w-full">
                  {gi > 0 && <div className="w-6 h-px bg-white/15 my-1" />}
                  {visible.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href
                      || (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        aria-label={item.label}
                        onClick={closeMobileNav}
                        className={cn(
                          "relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                          isActive ? "bg-white text-indigo-600 shadow-sm" : "text-white/70 hover:text-white hover:bg-white/15"
                        )}
                      >
                        <Icon className="w-4.5 h-4.5" />
                        {item.badge && (
                          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-indigo-600" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Profile */}
          <Link
            href="/dashboard/profile"
            aria-label="My profile"
            title={session?.user?.name || "Profile"}
            className="shrink-0 mt-3"
          >
            <Avatar className="w-10 h-10 ring-2 ring-white/30 hover:ring-white/60 transition-all">
              <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || "User avatar"} />
              <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                {getInitials(session?.user?.name || "U")}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </aside>
    </>
  );
}
