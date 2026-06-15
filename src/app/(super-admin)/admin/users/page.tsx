"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Search, Users } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700",
  COMPANY_ADMIN: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  TEAM_LEADER: "bg-indigo-100 text-indigo-700",
  AGENT: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-700",
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => axios.get(`/api/admin/users?search=${search}&limit=100`).then((r) => r.data),
    staleTime: 30000,
  });

  const users = data?.data || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Users</h1>
        <p className="text-muted-foreground">Platform-wide user management ({data?.total || 0} total)</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search users..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="divide-y">
              {users.map((user: {
                _id: string;
                name: string;
                email: string;
                role: string;
                isActive: boolean;
                isOnline: boolean;
                companyId?: { name: string };
                createdAt: string;
              }) => (
                <div key={user._id} className="flex items-center gap-4 p-4 hover:bg-muted/30">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {user.companyId && (
                      <span className="text-xs text-muted-foreground">{(user.companyId as { name: string }).name}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] || "bg-gray-100 text-gray-700"}`}>
                      {user.role}
                    </span>
                    <Badge variant={user.isActive ? "active" : "inactive"} className="text-xs">
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
