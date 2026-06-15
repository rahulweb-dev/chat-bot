"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ShieldCheck, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const actionColors: Record<string, string> = {
  CREATE: "text-green-600 bg-green-50 dark:bg-green-950",
  UPDATE: "text-blue-600 bg-blue-50 dark:bg-blue-950",
  DELETE: "text-red-600 bg-red-50 dark:bg-red-950",
  LOGIN: "text-purple-600 bg-purple-50 dark:bg-purple-950",
  SUSPEND: "text-orange-600 bg-orange-50 dark:bg-orange-950",
};

function getActionColor(action: string): string {
  for (const [key, cls] of Object.entries(actionColors)) {
    if (action.includes(key)) return cls;
  }
  return "text-gray-600 bg-gray-50 dark:bg-gray-900";
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => axios.get(`/api/audit-logs?page=${page}&limit=50`).then((r) => r.data),
    staleTime: 30000,
  });

  const logs = data?.data || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const filtered = search
    ? logs.filter((l: { action: string; resource: string; userId?: { name: string; email: string } }) =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.resource.toLowerCase().includes(search.toLowerCase()) ||
        (l.userId as { name?: string; email?: string } | null)?.email?.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Track all actions performed in your workspace</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search actions, resources, users..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-sm text-muted-foreground">{total} total events</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ShieldCheck className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((log: {
                _id: string;
                action: string;
                resource: string;
                status: string;
                userId?: { name: string; email: string };
                details?: Record<string, unknown>;
                ipAddress?: string;
                createdAt: string;
              }) => (
                <div key={log._id} className="flex items-start gap-4 p-4 hover:bg-muted/30">
                  <div className="mt-0.5">
                    {log.status === "SUCCESS" ? (
                      <ShieldCheck className="h-4 w-4 text-green-500" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-xs font-mono px-2 py-0.5 rounded font-semibold", getActionColor(log.action))}>
                        {log.action}
                      </span>
                      <span className="text-sm font-medium">{log.resource}</span>
                      <Badge variant={log.status === "SUCCESS" ? "default" : "destructive"} className="text-xs">
                        {log.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {log.userId && (
                        <span className="text-xs text-muted-foreground">
                          {(log.userId as { name: string; email: string }).name || (log.userId as { name: string; email: string }).email}
                        </span>
                      )}
                      {log.ipAddress && (
                        <span className="text-xs text-muted-foreground font-mono">{log.ipAddress}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            className="text-sm px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button
            className="text-sm px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
