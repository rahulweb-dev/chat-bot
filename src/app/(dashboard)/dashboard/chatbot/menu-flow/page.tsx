"use client";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { FlowBuilderTab, FlowBuilderSkeleton, type Config } from "../page";

// Menu Flow gets its own full-screen page rather than sharing the chatbot
// settings page's rail + live-preview columns — the node canvas needs the
// room, and editing a menu isn't something you do side-by-side with the
// other settings tabs anyway.
export default function MenuFlowPage() {
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["chatbot-config"],
    queryFn: async () => {
      const r = await fetch("/api/chatbot-config");
      const d = await r.json();
      return d.data as Config;
    },
    staleTime: 30_000,
  });

  function refetch() {
    qc.invalidateQueries({ queryKey: ["chatbot-config"] });
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard/chatbot"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A988D] hover:text-[#15140F] transition-colors mb-2.5"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Chatbot settings
        </Link>
        <h1 className="font-display italic font-semibold text-[34px] leading-tight text-[#15140F]">Menu Flow</h1>
        <p className="text-sm text-[#9A988D] mt-1">What visitors can ask for, and where each path leads</p>
      </div>

      {isLoading || !config
        ? <FlowBuilderSkeleton />
        : <FlowBuilderTab config={config} refetch={refetch} showStepBanner={false} fullHeight />}
    </div>
  );
}
