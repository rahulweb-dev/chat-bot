"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ShieldCheck, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const getActionColor = (action: string) => {
  if (action.includes("CREATE")) return "text-green-600 bg-green-50 dark:bg-green-950";
  if (action.includes("UPDATE") || action.includes("PATCH")) return "text-blue-600 bg-blue-50 dark:bg-blue-950";
  if (action.includes("DELETE") || action.includes("SUSPEND")) return "text-red-600 bg-red-50 dark:bg-red-950";
  if (action.includes("LOGIN")) return "text-purple-600 bg-purple-50 dark:bg-purple-950";
  return "text-gray-600 bg-gray-50 dark:bg-gray-900";
};

export default function AdminAuditLogsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit-logs", page],
    queryFn: () => axios.get(`/api/audit-logs?page=${page}&limit=50`).then((r) => r.data),
    staleTime: 30000,
  });

  const logs = data?.data || [];
  const totalPages = data?.totalPages || 1;
  const total = data?.total || 0;

  const filtered = search
    ? logs.filter((l: { action: string; resource: string }) =>
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        l.resource.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Audit Logs</h1>
        <p className="text-muted-foreground">All actions across all companies ({total} events)</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter by action or resource..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit Trail</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((log: {
                _id: string;
                action: string;
                resource: string;
                status: string;
                userId?: { name: string; email: string };
                companyId?: { name: string };
                ipAddress?: string;
                createdAt: string;
              }) => (
                <div key={log._id} className="flex items-start gap-4 p-4 hover:bg-muted/30">
                  <div className="mt-0.5">
                    {log.status === "SUCCESS"
                      ? <ShieldCheck className="h-4 w-4 text-green-500" />
                      : <ShieldAlert className="h-4 w-4 text-red-500" />
                    }
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
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {log.userId && (
                        <span className="text-xs text-muted-foreground">
                          {(log.userId as { name: string; email: string }).name}
                        </span>
                      )}
                      {log.companyId && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {(log.companyId as { name: string }).name}
                        </span>
                      )}
                      {log.ipAddress && (
                        <span className="text-xs font-mono text-muted-foreground">{log.ipAddress}</span>
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
          <button className="text-sm px-3 py-1 border rounded disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <button className="text-sm px-3 py-1 border rounded disabled:opacity-50" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</button>
        </div>
      )}
    </div>
  );
}
