"use client";
import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut, Settings, User, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":                   "Dashboard",
  "/dashboard/chat":              "Live Chat",
  "/dashboard/whatsapp":          "WhatsApp",
  "/dashboard/conversations":     "Conversations",
  "/dashboard/tickets":           "Tickets",
  "/dashboard/leads":             "Leads & CRM",
  "/dashboard/agents":            "Agents",
  "/dashboard/departments":       "Departments",
  "/dashboard/chatbots":          "Chatbots",
  "/dashboard/chatbot-settings":  "Bot Training",
  "/dashboard/knowledge-base":    "Knowledge Base",
  "/dashboard/workflows":         "Workflows",
  "/dashboard/analytics":         "Analytics",
  "/dashboard/widget":            "Widget Builder",
  "/dashboard/billing":           "Billing",
  "/dashboard/api-keys":          "API Keys",
  "/dashboard/audit-logs":        "Audit Logs",
  "/dashboard/notifications":     "Notifications",
  "/dashboard/settings":          "Settings",
  "/dashboard/profile":           "My Profile",
  "/admin":                       "Admin Overview",
  "/admin/companies":             "Companies",
  "/admin/plans":                 "Plans",
  "/admin/revenue":               "Revenue",
  "/admin/users":                 "Users",
  "/admin/audit-logs":            "Audit Logs",
  "/admin/settings":              "System Settings",
};

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();

  const pageTitle = PAGE_TITLES[pathname] ?? "Dashboard";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const { data: notifData } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?unread=true");
      return res.json().then(d => d.data);
    },
    refetchInterval: 30_000,
  });

  const unreadCount = notifData?.unreadCount || 0;

  return (
    <header className="h-16 border-b border-gray-200/80 bg-white flex items-center gap-4 px-6 shrink-0">
      {/* Page title */}
      <div className="shrink-0 min-w-0">
        <h1 className="text-[15px] font-semibold text-gray-900 leading-none">{pageTitle}</h1>
        <p className="text-[11px] text-gray-400 mt-0.5 hidden sm:block">{today}</p>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-6 bg-gray-200 shrink-0" />

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search conversations, tickets, leads…"
            className="w-full h-9 pl-9 pr-16 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          <div className="absolute right-3 flex items-center gap-0.5 pointer-events-none select-none">
            <kbd className="text-[10px] text-gray-400 bg-white border border-gray-200 rounded px-1 py-0.5 font-mono shadow-sm">⌘K</kbd>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Notifications */}
        <Link href="/dashboard/notifications">
          <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-900">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 text-[9px] font-bold flex items-center justify-center bg-red-500 text-white rounded-full border-2 border-white px-0.5">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 pl-2 pr-2.5 rounded-xl hover:bg-gray-100 transition-colors">
              <Avatar className="w-7 h-7 ring-2 ring-indigo-100 shrink-0">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="bg-linear-to-br from-indigo-600 to-violet-600 text-white text-xs font-bold">
                  {getInitials(session?.user?.name || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden md:block">
                <p className="text-xs font-semibold text-gray-900 leading-none">{session?.user?.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 capitalize">
                  {session?.user?.role?.toLowerCase().replace(/_/g, " ")}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border-gray-200/80">
            <DropdownMenuLabel className="font-normal">
              <p className="font-semibold text-gray-900 text-sm leading-none">{session?.user?.name}</p>
              <p className="text-xs text-gray-400 mt-1">{session?.user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="w-4 h-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center gap-2 cursor-pointer">
                <Settings className="w-4 h-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
