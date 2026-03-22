"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, type ReactNode } from "react";
import { SITE_ASSESSMENT_TABS, SITE_ASSESSMENT_TAB_LABELS, type SiteAssessmentTab } from "@repo/shared";

interface SiteTabLayoutProps {
  children: Record<SiteAssessmentTab, ReactNode>;
  defaultTab?: SiteAssessmentTab;
}

export function SiteTabLayout({ children, defaultTab = "overview" }: SiteTabLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as SiteAssessmentTab) || defaultTab;

  const setTab = useCallback(
    (tab: SiteAssessmentTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" aria-label="Site assessment tabs">
          {SITE_ASSESSMENT_TABS.map((tab) => {
            const isActive = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setTab(tab)}
                className={`whitespace-nowrap border-b-2 pb-3 pt-1 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-600"
                }`}
              >
                {SITE_ASSESSMENT_TAB_LABELS[tab]}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active tab content */}
      <div>{children[activeTab]}</div>
    </div>
  );
}
