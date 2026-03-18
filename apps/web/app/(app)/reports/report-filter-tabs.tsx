"use client";

import Link from "next/link";
import { cn } from "../../../lib/utils";

const TABS = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Published", value: "published" },
] as const;

interface ReportFilterTabsProps {
  activeFilter: string;
}

export function ReportFilterTabs({ activeFilter }: ReportFilterTabsProps) {
  return (
    <div className="flex gap-1 border-b border-gray-100">
      {TABS.map((tab) => (
        <Link
          key={tab.value}
          href={tab.value === "all" ? "/reports" : `/reports?filter=${tab.value}`}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeFilter === tab.value
              ? "border-brand-green text-gray-900"
              : "border-transparent text-gray-500 hover:text-gray-700",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
