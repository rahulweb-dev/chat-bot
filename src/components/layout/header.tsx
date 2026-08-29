"use client";
import { useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut, Settings, User, Search, ChevronDown, Menu, Ticket, Tag, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials, cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":                   "Dashboard",
  "/dashboard/chat":              "Live Chat",
  "/dashboard/whatsapp":          "WhatsApp",
  "/dashboard/conversations":     "Conversations",
  "/dashboard/tickets":           "Tickets",
  "/dashboard/leads":             "Leads & CRM",
  "/dashboard/agents":            "Agents",
  "/dashboard/departments":       "Departments",
  "/dashboard/chatbot":           "Chatbot",
  "/dashboard/knowledge-base":    "Knowledge Base",
  "/dashboard/workflows":         "Workflows",
  "/dashboard/analytics":         "Analytics",
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

interface SearchResults {
  tickets: { _id: string; ticketNumber: string; subject: string }[];
  leads: { _id: string; name: string; company?: string }[];
  conversations: { _id: string; visitor?: { name?: string; email?: string } }[];
}

function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebouncedValue(term, 300);

  const { data, isFetching } = useQuery<SearchResults>({
    queryKey: ["global-search", debounced],
    queryFn: async () => {
      const [tickets, leads, conversations] = await Promise.all([
        fetch(`/api/tickets?search=${encodeURIComponent(debounced)}&limit=5`).then((r) => r.json()),
        fetch(`/api/leads?search=${encodeURIComponent(debounced)}&limit=5`).then((r) => r.json()),
        fetch(`/api/chat/conversations?search=${encodeURIComponent(debounced)}&limit=5`).then((r) => r.json()),
      ]);
      return {
        tickets: tickets?.data || [],
        leads: leads?.data || [],
        conversations: conversations?.data || [],
      };
    },
    enabled: debounced.trim().length >= 2,
  });

  const hasResults = !!data && (data.tickets.length + data.leads.length + data.conversations.length > 0);
  const showDropdown = open && term.trim().length >= 2;

  function go(href: string) {
    setOpen(false);
    setTerm("");
    inputRef.current?.blur();
    router.push(href);
  }

  return (
    <div className="flex-1 max-w-md relative">
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); } }}
          placeholder="Search conversations, tickets, leads…"
          className="w-full h-9 pl-9 pr-16 bg-muted border border-input rounded-xl text-sm text-foreground placeholder-muted-foreground outline-none focus:bg-background focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
        />
        <div className="absolute right-3 flex items-center gap-0.5 pointer-events-none select-none">
          {isFetching ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : (
            <kbd className="text-[10px] text-muted-foreground bg-background border border-input rounded px-1 py-0.5 font-mono shadow-sm">⌘K</kbd>
          )}
        </div>
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto">
          {term.trim().length < 2 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">Keep typing to search…</p>
          ) : isFetching && !data ? (
            <p className="text-xs text-muted-foreground px-4 py-3">Searching…</p>
          ) : !hasResults ? (
            <p className="text-xs text-muted-foreground px-4 py-3">No results for &quot;{term}&quot;</p>
          ) : (
            <div className="py-1.5">
              {data!.conversations.length > 0 && (
                <div className="px-1.5 mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-2.5 py-1">Conversations</p>
                  {data!.conversations.map((c) => (
                    <button
                      key={c._id}
                      onMouseDown={(e) => { e.preventDefault(); go("/dashboard/conversations"); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg hover:bg-accent text-left"
                    >
                      <Inbox className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{c.visitor?.name || c.visitor?.email || "Visitor"}</span>
                    </button>
                  ))}
                </div>
              )}
              {data!.tickets.length > 0 && (
                <div className="px-1.5 mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-2.5 py-1">Tickets</p>
                  {data!.tickets.map((t) => (
                    <button
                      key={t._id}
                      onMouseDown={(e) => { e.preventDefault(); go("/dashboard/tickets"); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg hover:bg-accent text-left"
                    >
                      <Ticket className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground shrink-0">{t.ticketNumber}</span>
                      <span className="truncate">{t.subject}</span>
                    </button>
                  ))}
                </div>
              )}
              {data!.leads.length > 0 && (
                <div className="px-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-2.5 py-1">Leads</p>
                  {data!.leads.map((l) => (
                    <button
                      key={l._id}
                      onMouseDown={(e) => { e.preventDefault(); go("/dashboard/leads"); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm rounded-lg hover:bg-accent text-left"
                    >
                      <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{l.name}</span>
                      {l.company && <span className="text-xs text-muted-foreground truncate">· {l.company}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const openMobileNav = useUIStore((s) => s.openMobileNav);

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
    <header className="h-16 border-b border-border bg-background flex items-center gap-4 px-4 sm:px-6 shrink-0">
      {/* Mobile nav toggle */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Open menu"
        className={cn("lg:hidden h-9 w-9 shrink-0 -ml-1 text-muted-foreground hover:text-foreground")}
        onClick={openMobileNav}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Page title */}
      <div className="shrink-0 min-w-0">
        <h1 className="text-[15px] font-semibold text-foreground leading-none">{pageTitle}</h1>
        <p className="text-[11px] text-muted-foreground mt-0.5 hidden sm:block">{today}</p>
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-6 bg-border shrink-0" />

      {/* Search */}
      <GlobalSearch />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Notifications */}
        <Link href="/dashboard/notifications">
          <Button
            variant="ghost"
            size="icon"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
            className="relative h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 text-[9px] font-bold flex items-center justify-center bg-red-500 text-white rounded-full border-2 border-background px-0.5">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </Link>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-9 pl-2 pr-2.5 rounded-xl">
              <Avatar className="w-7 h-7 ring-2 ring-indigo-100 shrink-0">
                <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || "User avatar"} />
                <AvatarFallback className="bg-linear-to-br from-indigo-600 to-violet-600 text-white text-xs font-bold">
                  {getInitials(session?.user?.name || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden md:block">
                <p className="text-xs font-semibold text-foreground leading-none">{session?.user?.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
                  {session?.user?.role?.toLowerCase().replace(/_/g, " ")}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg">
            <DropdownMenuLabel className="font-normal">
              <p className="font-semibold text-foreground text-sm leading-none">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{session?.user?.email}</p>
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
