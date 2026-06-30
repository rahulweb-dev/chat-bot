"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  MessageSquare, TicketIcon, Users, Building2, BarChart3,
  Settings, Bell, Key, Bot, Workflow, CreditCard,
  LayoutDashboard, BookOpen, Puzzle, Tag, Globe, Shield,
  ChevronLeft, ChevronRight, Inbox, MessageCircle,
  Brain, Zap, ArrowUpRight,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { useState } from "react";

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
      { label: "Chatbots",       href: "/dashboard/chatbots",          icon: Bot,      roles: ["COMPANY_ADMIN", "MANAGER"] },
      { label: "Bot Training",   href: "/dashboard/chatbot-settings",  icon: Brain,    roles: ["COMPANY_ADMIN", "MANAGER"] },
      { label: "Knowledge Base", href: "/dashboard/knowledge-base",    icon: BookOpen },
      { label: "Workflows",      href: "/dashboard/workflows",         icon: Workflow, roles: ["COMPANY_ADMIN", "MANAGER"] },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3, roles: ["COMPANY_ADMIN", "MANAGER", "TEAM_LEADER"] },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Widget Builder", href: "/dashboard/widget",         icon: Puzzle,    roles: ["COMPANY_ADMIN"] },
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

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const groups = isSuperAdmin ? SUPER_ADMIN_GROUPS : NAV_GROUPS;
  const userRole = session?.user?.role || "";

  return (
    <aside className={cn(
      "relative flex flex-col h-full transition-all duration-300 border-r border-gray-800/60 bg-gray-950 shrink-0",
      collapsed ? "w-[60px]" : "w-64"
    )}>
      {/* Brand */}
      <div className={cn(
        "flex items-center h-16 border-b border-gray-800/60 shrink-0 px-4 gap-3",
        collapsed && "justify-center px-0"
      )}>
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/50 shrink-0">
          <MessageSquare className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-bold text-white text-sm leading-none tracking-tight">SupportFlow</p>
            <p className="text-[10px] text-indigo-400/80 mt-0.5 font-semibold tracking-widest uppercase">AI Platform</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 [&::-webkit-scrollbar]:hidden">
        {groups.map((group, gi) => {
          const visible = group.items.filter(item => !item.roles || item.roles.includes(userRole));
          if (!visible.length) return null;

          return (
            <div key={gi} className={gi > 0 ? "mt-3" : ""}>
              {/* Section label */}
              {group.label && !collapsed && (
                <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-gray-600 px-3 mb-1.5 select-none">
                  {group.label}
                </p>
              )}
              {group.label && collapsed && gi > 0 && (
                <div className="mx-3 mb-3 h-px bg-gray-800/70" />
              )}

              {visible.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href
                  || (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150 group mb-0.5",
                      collapsed ? "justify-center w-10 h-9 mx-auto px-0" : "px-3 py-2",
                      isActive
                        ? "bg-indigo-500/15 text-indigo-300"
                        : "text-gray-500 hover:text-gray-200 hover:bg-white/[0.05]"
                    )}
                  >
                    {/* Active left accent */}
                    {isActive && !collapsed && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-indigo-400 rounded-r-full" />
                    )}
                    <Icon className={cn(
                      "shrink-0 transition-colors",
                      collapsed ? "w-4.5 h-4.5" : "w-4 h-4",
                      isActive ? "text-indigo-400" : "text-gray-600 group-hover:text-gray-300"
                    )} />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0">
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Enterprise upgrade CTA */}
      {!isSuperAdmin && !collapsed && (
        <div className="px-3 pb-3 shrink-0">
          <div className="rounded-xl bg-gradient-to-br from-indigo-600/20 to-violet-600/15 border border-indigo-500/20 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3 text-indigo-400" />
              <span className="text-[11px] font-semibold text-indigo-300">Enterprise Plan</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed mb-2.5">
              Unlimited agents · White-label · Priority SLA
            </p>
            <Link
              href="/dashboard/billing"
              className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition-colors"
            >
              Upgrade <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Profile */}
      <div className="p-3 border-t border-gray-800/60 shrink-0">
        <Link
          href="/dashboard/profile"
          className={cn(
            "flex items-center gap-2.5 rounded-xl hover:bg-white/[0.05] transition-colors p-2 group",
            collapsed && "justify-center"
          )}
        >
          <Avatar className="w-8 h-8 shrink-0 ring-2 ring-indigo-500/20 ring-offset-1 ring-offset-gray-950">
            <AvatarImage src={session?.user?.image || ""} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white text-xs font-bold">
              {getInitials(session?.user?.name || "U")}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-200 truncate">{session?.user?.name}</p>
              <p className="text-[10px] text-gray-600 truncate capitalize mt-0.5">
                {session?.user?.role?.toLowerCase().replace(/_/g, " ")}
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* Collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-[72px] w-6 h-6 bg-gray-950 border border-gray-800 rounded-full text-gray-500 hover:text-white hover:bg-gray-800 z-20 shadow-sm"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>
    </aside>
  );
}
