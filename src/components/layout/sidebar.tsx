"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  MessageSquare, TicketIcon, Users, Building2, BarChart3,
  Settings, Bell, Key, FileText, Bot, Workflow, CreditCard,
  LayoutDashboard, BookOpen, Puzzle, Tag, Globe, Shield,
  ChevronLeft, ChevronRight, Inbox, UserCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Live Chat", href: "/dashboard/chat", icon: MessageSquare, badge: "Live" },
  { label: "Conversations", href: "/dashboard/conversations", icon: Inbox },
  { label: "Tickets", href: "/dashboard/tickets", icon: TicketIcon },
  { label: "Leads & CRM", href: "/dashboard/leads", icon: Tag },
  { label: "Agents", href: "/dashboard/agents", icon: Users, roles: ["COMPANY_ADMIN", "MANAGER"] },
  { label: "Departments", href: "/dashboard/departments", icon: Building2, roles: ["COMPANY_ADMIN", "MANAGER"] },
  { label: "Chatbots", href: "/dashboard/chatbots", icon: Bot, roles: ["COMPANY_ADMIN", "MANAGER"] },
  { label: "Knowledge Base", href: "/dashboard/knowledge-base", icon: BookOpen },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3, roles: ["COMPANY_ADMIN", "MANAGER", "TEAM_LEADER"] },
  { label: "Workflows", href: "/dashboard/workflows", icon: Workflow, roles: ["COMPANY_ADMIN", "MANAGER"] },
  { label: "Widget Builder", href: "/dashboard/widget", icon: Puzzle, roles: ["COMPANY_ADMIN"] },
  { label: "Chatbot Settings", href: "/dashboard/chatbot-settings", icon: Bot, roles: ["COMPANY_ADMIN", "MANAGER"] },
  { label: "Billing", href: "/dashboard/billing", icon: CreditCard, roles: ["COMPANY_ADMIN"] },
  { label: "API Keys", href: "/dashboard/api-keys", icon: Key, roles: ["COMPANY_ADMIN"] },
  { label: "Audit Logs", href: "/dashboard/audit-logs", icon: Shield, roles: ["COMPANY_ADMIN"] },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

const superAdminItems: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Companies", href: "/admin/companies", icon: Globe },
  { label: "Plans", href: "/admin/plans", icon: CreditCard },
  { label: "Revenue", href: "/admin/revenue", icon: BarChart3 },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: Shield },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const items = isSuperAdmin ? superAdminItems : navItems;
  const userRole = session?.user?.role || "";

  const visibleItems = items.filter((item) => !item.roles || item.roles.includes(userRole));

  return (
    <aside className={cn(
      "relative flex flex-col h-full bg-gray-900 text-white transition-all duration-300 border-r border-gray-800",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex items-center px-4 h-16 border-b border-gray-800 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">SupportFlow</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center mx-auto">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group",
                isActive
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge variant="success" className="text-[10px] px-1.5 py-0">{item.badge}</Badge>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-gray-800 shrink-0">
        <Link
          href="/dashboard/profile"
          className={cn(
            "flex items-center gap-3 rounded-lg hover:bg-gray-800 transition-colors p-2",
            collapsed && "justify-center"
          )}
        >
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={session?.user?.image || ""} />
            <AvatarFallback className="bg-indigo-600 text-white text-xs">
              {getInitials(session?.user?.name || "U")}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{session?.user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{session?.user?.role?.replace("_", " ")}</p>
            </div>
          )}
        </Link>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 w-6 h-6 bg-gray-900 border border-gray-800 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 z-10"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </Button>
    </aside>
  );
}
