"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Users, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoading } from "@/components/whatsapp/empty-state";
import { EmailContactsTab } from "@/components/email-campaigns/contacts-tab";
import { EmailCampaignsTab } from "@/components/email-campaigns/campaigns-tab";

// Campaigns is a manager+ action (POST /api/email-campaigns already rejects
// anyone else) — the tab is hidden for other roles instead of showing a button
// that just 403s.
const CAMPAIGN_ROLES = ["SUPER_ADMIN", "COMPANY_ADMIN", "MANAGER"];

const TABS = [
  { id: "campaigns", label: "Campaigns", icon: Megaphone, roles: CAMPAIGN_ROLES },
  { id: "contacts", label: "Contacts", icon: Users },
] as const;
type TabId = (typeof TABS)[number]["id"];
const TAB_IDS = TABS.map((t) => t.id) as TabId[];

function EmailCampaignsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const tabs = TABS.filter((t) => !("roles" in t) || !role || (t.roles as readonly string[]).includes(role));
  const tabParam = searchParams.get("tab");
  const requestedTab = TAB_IDS.includes(tabParam as TabId) ? (tabParam as TabId) : "campaigns";
  const initialTab: TabId = tabs.some((t) => t.id === requestedTab) ? requestedTab : "contacts";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(new Set([initialTab]));

  const handleTabChange = (id: TabId) => {
    setActiveTab(id);
    setVisitedTabs((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    router.replace(`/dashboard/email-campaigns?tab=${id}`, { scroll: false });
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center gap-1 border-b bg-white px-6 shrink-0 h-12">
        {tabs.map((t) => {
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

      <div className="flex-1 overflow-hidden">
        {visitedTabs.has("campaigns") && (
          <div className={cn("h-full overflow-y-auto", activeTab !== "campaigns" && "hidden")}><EmailCampaignsTab /></div>
        )}
        {visitedTabs.has("contacts") && (
          <div className={cn("h-full overflow-y-auto", activeTab !== "contacts" && "hidden")}><EmailContactsTab /></div>
        )}
      </div>
    </div>
  );
}

export default function EmailCampaignsPage() {
  return (
    <Suspense fallback={<PageLoading className="h-[calc(100vh-4rem)] items-center" />}>
      <EmailCampaignsPageInner />
    </Suspense>
  );
}
