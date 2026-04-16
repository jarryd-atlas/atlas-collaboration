"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "../../lib/utils";
import { LayoutDashboard, Users, Target, Building2, CalendarDays, Mail, Tag, Rocket, MapPin, Activity } from "lucide-react";

type TabKey = "overview" | "people" | "initiatives" | "meetings" | "emails" | "tickets" | "success-plan" | "sites-tasks" | "map" | "activity";

interface AccountPlanTabsProps {
  isCKInternal: boolean;
  children: {
    overview: React.ReactNode;
    people: React.ReactNode;
    initiatives: React.ReactNode;
    meetings: React.ReactNode;
    emails: React.ReactNode;
    tickets: React.ReactNode;
    successPlan: React.ReactNode;
    sitesTasks: React.ReactNode;
    map: React.ReactNode;
    activity: React.ReactNode;
  };
  onTabChange?: (tab: string) => void;
}

const TABS: { key: TabKey; label: string; icon: any; internalOnly: boolean }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, internalOnly: true },
  { key: "people", label: "People", icon: Users, internalOnly: false },
  { key: "initiatives", label: "Initiatives", icon: Rocket, internalOnly: false },
  { key: "meetings", label: "Meetings", icon: CalendarDays, internalOnly: true },
  { key: "emails", label: "Emails", icon: Mail, internalOnly: true },
  { key: "tickets", label: "Tickets", icon: Tag, internalOnly: true },
  { key: "success-plan", label: "Success Plan", icon: Target, internalOnly: false },
  { key: "sites-tasks", label: "Sites", icon: Building2, internalOnly: false },
  { key: "map", label: "Map", icon: MapPin, internalOnly: false },
  { key: "activity", label: "Activity", icon: Activity, internalOnly: false },
];

const VALID_TABS = new Set<string>(TABS.map((t) => t.key));

export function AccountPlanTabs({ isCKInternal, children, onTabChange }: AccountPlanTabsProps) {
  const searchParams = useSearchParams();
  const defaultTab: TabKey = isCKInternal ? "overview" : "success-plan";

  // Derive initial tab from URL
  const tabParam = searchParams.get("tab") ?? "";
  const urlTab: TabKey = VALID_TABS.has(tabParam) ? (tabParam as TabKey) : defaultTab;

  // Use local state for instant tab switching — no waiting for router
  const [activeTab, setActiveTab] = useState<TabKey>(urlTab);

  // Sync if URL changes externally (e.g. back/forward navigation)
  useEffect(() => {
    setActiveTab(urlTab);
  }, [urlTab]);

  const handleTabChange = useCallback((tab: TabKey) => {
    // Update local state immediately for instant visual feedback
    setActiveTab(tab);

    // Update URL in background without triggering React re-render via router
    const params = new URLSearchParams(searchParams.toString());
    if (tab === defaultTab) {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    onTabChange?.(tab);
  }, [searchParams, defaultTab, onTabChange]);

  const visibleTabs = TABS.filter((tab) => !tab.internalOnly || isCKInternal);

  const contentMap: Record<TabKey, React.ReactNode> = {
    overview: children.overview,
    people: children.people,
    initiatives: children.initiatives,
    meetings: children.meetings,
    emails: children.emails,
    tickets: children.tickets,
    "success-plan": children.successPlan,
    "sites-tasks": children.sitesTasks,
    map: children.map,
    activity: children.activity,
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 border-b border-gray-200 shrink-0 bg-white">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                isActive
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {contentMap[activeTab]}
      </div>
    </div>
  );
}
