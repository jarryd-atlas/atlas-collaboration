"use client";

import { useState, useMemo } from "react";
import { PortfolioSummaryStats } from "./portfolio-summary-stats";
import { CompaniesTable } from "./companies-table";
import { CompaniesCards } from "./companies-cards";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "../../lib/utils";
import type { CustomerListItem } from "../../lib/data/queries";

interface CompaniesListViewProps {
  customers: CustomerListItem[];
}

type StageFilter = "all" | "pilot" | "expanding" | "enterprise";
type SortOption = "name" | "deal_value" | "close_date" | "issues";
type ViewMode = "table" | "cards";

const STAGE_FILTERS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pilot", label: "Pilot" },
  { value: "expanding", label: "Expanding" },
  { value: "enterprise", label: "Enterprise" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "deal_value", label: "Deal Value" },
  { value: "close_date", label: "Close Date" },
  { value: "issues", label: "Issues" },
];

export function CompaniesListView({ customers }: CompaniesListViewProps) {
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const filteredAndSorted = useMemo(() => {
    let result = [...customers];

    // Filter by stage
    if (stageFilter !== "all") {
      result = result.filter((c) => c.account_stage === stageFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "deal_value":
          return (b.target_value ?? 0) - (a.target_value ?? 0);
        case "close_date": {
          if (!a.target_close_date && !b.target_close_date) return 0;
          if (!a.target_close_date) return 1;
          if (!b.target_close_date) return -1;
          return a.target_close_date.localeCompare(b.target_close_date);
        }
        case "issues":
          return b.open_issues - a.open_issues || b.open_tasks - a.open_tasks;
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [customers, stageFilter, sortBy]);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <PortfolioSummaryStats customers={customers} />

      {/* Filter/Sort toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Stage filter pills */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {STAGE_FILTERS.map((f) => {
            const count = f.value === "all"
              ? customers.length
              : customers.filter((c) => c.account_stage === f.value).length;
            return (
              <button
                key={f.value}
                onClick={() => setStageFilter(f.value)}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  stageFilter === f.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {f.label}
                <span className="ml-1 text-[10px] text-gray-400">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-400 uppercase font-medium">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600 bg-white"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "p-1 rounded",
                viewMode === "table" ? "bg-white shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
              title="Table view"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={cn(
                "p-1 rounded",
                viewMode === "cards" ? "bg-white shadow-sm" : "text-gray-400 hover:text-gray-600"
              )}
              title="Card view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === "table" ? (
        <CompaniesTable customers={filteredAndSorted} />
      ) : (
        <CompaniesCards customers={filteredAndSorted} />
      )}
    </div>
  );
}
