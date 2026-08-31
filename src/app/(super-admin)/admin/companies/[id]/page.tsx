"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { ArrowLeft, LayoutGrid, Megaphone, Users, BarChart3, MessageCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorState, CompanyCampaignStats } from "@/components/admin/company-detail/shared";
import { OverviewTab } from "@/components/admin/company-detail/overview-tab";
import { CampaignsTab } from "@/components/admin/company-detail/campaigns-tab";
import { RecipientsTab } from "@/components/admin/company-detail/recipients-tab";
import { AnalyticsTab } from "@/components/admin/company-detail/analytics-tab";
import { RepliesTab } from "@/components/admin/company-detail/replies-tab";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "recipients", label: "Recipients", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "replies", label: "Replies", icon: MessageCircle },
] as const;
type TabId = (typeof TABS)[number]["id"];
const TAB_IDS = TABS.map((t) => t.id) as TabId[];

function CompanyDetailInner() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.id as string;
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: TabId = TAB_IDS.includes(tabParam as TabId) ? (tabParam as TabId) : "overview";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(new Set([initialTab]));

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    setVisitedTabs((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    router.replace(`/admin/companies/${companyId}?tab=${id}`, { scroll: false });
  };

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["admin-company", companyId],
    queryFn: () => axios.get(`/api/companies/${companyId}`).then((r) => r.data.data),
  });

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery({
    queryKey: ["admin-company-campaign-stats", companyId],
    queryFn: () => axios.get(`/api/admin/companies/${companyId}/campaigns/stats`).then((r) => r.data.data as CompanyCampaignStats),
    // Only keep polling while something's actually in flight — a company whose
    // campaigns are all DRAFT/COMPLETED/CANCELED/FAILED doesn't need live refresh.
    refetchInterval: (query) => ((query.state.data as CompanyCampaignStats | undefined)?.activeCampaigns ? 15000 : false),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/companies" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          {companyLoading ? (
            <div className="h-7 w-48 bg-gray-200 rounded animate-pulse" />
          ) : (
            <h1 className="text-2xl font-bold truncate">{company?.name || "Company"}</h1>
          )}
          <p className="text-muted-foreground text-sm">Campaign Management &amp; Analytics</p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 h-11 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0",
                isActive ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {statsLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : statsError ? (
        <ErrorState message="Couldn't load this company's campaign stats." onRetry={() => refetchStats()} />
      ) : (
        <>
          {visitedTabs.has("overview") && <div className={cn(activeTab !== "overview" && "hidden")}><OverviewTab companyId={companyId} stats={stats} onNavigate={handleTabChange} /></div>}
          {visitedTabs.has("campaigns") && <div className={cn(activeTab !== "campaigns" && "hidden")}><CampaignsTab companyId={companyId} /></div>}
          {visitedTabs.has("recipients") && <div className={cn(activeTab !== "recipients" && "hidden")}><RecipientsTab companyId={companyId} /></div>}
          {visitedTabs.has("analytics") && <div className={cn(activeTab !== "analytics" && "hidden")}><AnalyticsTab companyId={companyId} stats={stats} /></div>}
          {visitedTabs.has("replies") && <div className={cn(activeTab !== "replies" && "hidden")}><RepliesTab companyId={companyId} /></div>}
        </>
      )}
    </div>
  );
}

export default function CompanyDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <CompanyDetailInner />
    </Suspense>
  );
}
