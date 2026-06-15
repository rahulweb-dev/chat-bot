"use client";
import { useSession, signOut } from "next-auth/react";
import { Bell, LogOut, Settings, User, Search, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { getInitials } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

export function Header() {
  const { data: session } = useSession();

  const { data: notifData } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?unread=true");
      const data = await res.json();
      return data.data;
    },
    refetchInterval: 30000,
  });

  const unreadCount = notifData?.unreadCount || 0;

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4 flex-1 max-w-lg">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search conversations, tickets, leads..." className="pl-9 bg-gray-50 border-gray-200" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link href="/dashboard/notifications">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 w-5 h-5 text-[10px] p-0 flex items-center justify-center bg-red-500">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-10">
              <Avatar className="w-7 h-7">
                <AvatarImage src={session?.user?.image || ""} />
                <AvatarFallback className="bg-indigo-600 text-white text-xs">
                  {getInitials(session?.user?.name || "U")}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{session?.user?.role?.replace("_", " ")}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium">{session?.user?.name}</p>
                <p className="text-xs text-gray-500 font-normal mt-0.5">{session?.user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile" className="flex items-center gap-2">
                <User className="w-4 h-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/dashboard/settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-red-600 focus:text-red-600"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
