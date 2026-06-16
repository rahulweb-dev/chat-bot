"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, Users, Megaphone, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoading } from "@/components/whatsapp/empty-state";
import { InboxTab } from "@/components/whatsapp/tabs/inbox-tab";
import { ContactsTab } from "@/components/whatsapp/tabs/contacts-tab";
import { CampaignsTab } from "@/components/whatsapp/tabs/campaigns-tab";
import { AnalyticsTab } from "@/components/whatsapp/tabs/analytics-tab";
import { SettingsTab } from "@/components/whatsapp/tabs/settings-tab";

const TABS = [
  { id: "inbox", label: "Inbox", icon: MessageSquare },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "campaigns", label: "Campaigns", icon: Megaphone },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
] as const;
type TabId = (typeof TABS)[number]["id"];
const TAB_IDS = TABS.map((t) => t.id) as TabId[];

function WhatsAppPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: TabId = TAB_IDS.includes(tabParam as TabId) ? (tabParam as TabId) : "inbox";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  // Only tabs the user has actually opened get mounted — keeps them alive afterward
  // (no refetch on switch-back) without firing every tab's queries on first load.
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(new Set([initialTab]));

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    setVisitedTabs((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    router.replace(`/dashboard/whatsapp?tab=${id}`, { scroll: false });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center gap-1 border-b bg-white px-6 shrink-0 h-12">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 h-12 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Each tab mounts on first visit, then stays mounted (hidden via CSS) so
          switching back doesn't refetch or lose scroll/input state. */}
      <div className="flex-1 overflow-hidden">
        {visitedTabs.has("inbox") && (
          <div className={cn("h-full", activeTab !== "inbox" && "hidden")}><InboxTab /></div>
        )}
        {visitedTabs.has("contacts") && (
          <div className={cn("h-full overflow-y-auto", activeTab !== "contacts" && "hidden")}><ContactsTab /></div>
        )}
        {visitedTabs.has("campaigns") && (
          <div className={cn("h-full overflow-y-auto", activeTab !== "campaigns" && "hidden")}><CampaignsTab /></div>
        )}
        {visitedTabs.has("analytics") && (
          <div className={cn("h-full overflow-y-auto", activeTab !== "analytics" && "hidden")}><AnalyticsTab /></div>
        )}
        {visitedTabs.has("settings") && (
          <div className={cn("h-full overflow-y-auto", activeTab !== "settings" && "hidden")}><SettingsTab /></div>
        )}
      </div>
    </div>
  );
}

export default function WhatsAppPage() {
  return (
    <Suspense fallback={<PageLoading className="h-[calc(100vh-4rem)] items-center" />}>
      <WhatsAppPageInner />
    </Suspense>
  );
}
