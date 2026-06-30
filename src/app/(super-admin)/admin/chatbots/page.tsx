"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Bot, BrainCircuit, BookOpen, CheckCircle, XCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

type ChatbotRow = {
  companyId: string;
  companyName: string;
  companyEmail: string;
  isActive: boolean;
  hasConfig: boolean;
  customFlowEnabled: boolean;
  customFlowMenuCount: number;
  trainingCount: number;
  faqCount: number;
  updatedAt: string | null;
};

export default function AdminChatbotsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<ChatbotRow[]>({
    queryKey: ["admin-chatbots"],
    queryFn: async () => {
      const r = await fetch("/api/admin/chatbots");
      const d = await r.json();
      return d.data as ChatbotRow[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ companyId, enabled }: { companyId: string; enabled: boolean }) => {
      const r = await fetch("/api/admin/chatbots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, enabled }),
      });
      return r.json();
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-chatbots"] });
      toast({ title: `Custom flow ${vars.enabled ? "enabled" : "disabled"}` });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const rows = (data ?? []).filter(r =>
    !search ||
    r.companyName.toLowerCase().includes(search.toLowerCase()) ||
    r.companyEmail.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: data?.length ?? 0,
    configured: data?.filter(r => r.hasConfig).length ?? 0,
    flowEnabled: data?.filter(r => r.customFlowEnabled).length ?? 0,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Chatbot Management</h1>
        <p className="text-sm text-gray-500 mt-1">View and control chatbot configs for all companies</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Companies", value: stats.total, icon: Bot, color: "text-indigo-600 bg-indigo-50" },
          { label: "Configured Bots", value: stats.configured, icon: BrainCircuit, color: "text-violet-600 bg-violet-50" },
          { label: "Custom Flow Active", value: stats.flowEnabled, icon: CheckCircle, color: "text-emerald-600 bg-emerald-50" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.color)}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company…" className="pl-9 h-9" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Custom Flow</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Menus</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Training</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">FAQs</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Updated</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Enable Flow</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      <Bot className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p>No companies found</p>
                    </td>
                  </tr>
                )}
                {rows.map(row => (
                  <tr key={row.companyId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.companyName}</p>
                      <p className="text-xs text-gray-400">{row.companyEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      {row.isActive
                        ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>
                        : <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[11px]"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.hasConfig && row.customFlowMenuCount > 0
                        ? <Badge className="bg-violet-50 text-violet-700 border-violet-200 text-[11px]">Uploaded</Badge>
                        : <span className="text-xs text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("font-semibold", row.customFlowMenuCount > 0 ? "text-indigo-600" : "text-gray-300")}>
                        {row.customFlowMenuCount || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-xs text-gray-500">
                        <BrainCircuit className="w-3.5 h-3.5" /> {row.trainingCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="flex items-center justify-center gap-1 text-xs text-gray-500">
                        <BookOpen className="w-3.5 h-3.5" /> {row.faqCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {row.updatedAt
                        ? formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })
                        : "Never"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.hasConfig && row.customFlowMenuCount > 0 ? (
                        <Switch
                          checked={row.customFlowEnabled}
                          onCheckedChange={enabled => toggle.mutate({ companyId: row.companyId, enabled })}
                          disabled={toggle.isPending}
                        />
                      ) : (
                        <span className="text-xs text-gray-300">No flow</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
