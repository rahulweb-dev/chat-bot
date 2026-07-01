"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Star, Clock, MessageSquare, TrendingUp } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface LeaderboardRow {
  agentId: string;
  name: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  total: number;
  resolved: number;
  avgCsat: number | null;
  avgFirstResponseMin: number;
}

const MEDAL = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const [days, setDays] = useState("30");

  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", days],
    queryFn: () =>
      fetch(`/api/chat/leaderboard?days=${days}`)
        .then((r) => r.json())
        .then((d) => d.data as LeaderboardRow[]),
  });

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" /> Agent Leaderboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">Top performing agents ranked by resolved conversations</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <Card className="border border-gray-100 shadow-none">
          <CardContent className="p-12 text-center text-gray-400">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No data yet</p>
            <p className="text-sm mt-1">Assign conversations to agents to see their stats here</p>
          </CardContent>
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((row, idx) => (
            <Card
              key={row.agentId}
              className={cn(
                "border shadow-none transition-shadow hover:shadow-sm",
                idx === 0 ? "border-yellow-200 bg-yellow-50/40" :
                idx === 1 ? "border-gray-300 bg-gray-50/40" :
                idx === 2 ? "border-orange-200 bg-orange-50/30" :
                "border-gray-100"
              )}
            >
              <CardContent className="p-4 flex items-center gap-4">
                {/* Rank */}
                <div className="w-10 shrink-0 text-center">
                  {MEDAL[idx] ? (
                    <span className="text-2xl">{MEDAL[idx]}</span>
                  ) : (
                    <span className="text-lg font-bold text-gray-400">#{idx + 1}</span>
                  )}
                </div>

                {/* Agent */}
                <div className="relative shrink-0">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold text-sm">
                      {getInitials(row.name || row.email || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn(
                    "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white",
                    row.isOnline ? "bg-green-500" : "bg-gray-300"
                  )} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{row.name || "Unknown"}</p>
                  <p className="text-xs text-gray-400 truncate">{row.email}</p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-green-600">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="text-base font-bold">{row.resolved}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">Resolved</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-gray-500">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="text-base font-bold">{row.total}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">Total</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-yellow-500">
                      <Star className="w-3.5 h-3.5" />
                      <span className="text-base font-bold">{row.avgCsat ? row.avgCsat.toFixed(1) : "—"}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">CSAT</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center gap-1 text-purple-600">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-base font-bold">{row.avgFirstResponseMin}m</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">First Reply</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
