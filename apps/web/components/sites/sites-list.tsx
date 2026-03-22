"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PipelineStageBadge } from "../ui/badge";
import { ProgressBar } from "../ui/progress-bar";
import { EmptyState } from "../ui/empty-state";
import { MapPin, ArrowRight, Search, X } from "lucide-react";

interface Site {
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  pipeline_stage: string;
  milestone_count?: number | null;
  task_count?: number | null;
  completed_task_count?: number | null;
  dq_reason?: string | null;
  dq_reeval_date?: string | null;
}

interface SitesListProps {
  sites: Site[];
  customerSlug: string;
  /** Show search and filter controls */
  showSearch?: boolean;
}

/** All possible pipeline stages with display labels, in pipeline order */
const STAGE_LABELS: Record<string, string> = {
  prospect: "Prospect",
  evaluation: "Evaluation",
  qualified: "Qualified",
  contracted: "Contracted",
  deployment: "Deploying",
  active: "Active",
  paused: "Paused",
  disqualified: "DQ'd",
};

/** Pipeline order for sorting filter chips */
const STAGE_ORDER = ["prospect", "evaluation", "qualified", "contracted", "deployment", "active", "paused", "disqualified"];

export function SitesList({ sites, customerSlug, showSearch = true }: SitesListProps) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  // Dynamically compute which stages exist in the data, in pipeline order
  const stageFilters = useMemo(() => {
    const stageCounts = new Map<string, number>();
    for (const s of sites) {
      stageCounts.set(s.pipeline_stage, (stageCounts.get(s.pipeline_stage) ?? 0) + 1);
    }
    // Build ordered list of filters for stages that actually have sites
    const filters = STAGE_ORDER
      .filter((stage) => stageCounts.has(stage))
      .map((stage) => ({
        value: stage,
        label: STAGE_LABELS[stage] ?? stage.charAt(0).toUpperCase() + stage.slice(1),
        count: stageCounts.get(stage) ?? 0,
      }));
    return filters;
  }, [sites]);

  const filteredSites = useMemo(() => {
    let result = sites;

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.city?.toLowerCase().includes(q) ?? false) ||
          (s.state?.toLowerCase().includes(q) ?? false),
      );
    }

    // Stage filter — exact match on pipeline_stage
    if (stageFilter !== "all") {
      result = result.filter((s) => s.pipeline_stage === stageFilter);
    }

    return result;
  }, [sites, search, stageFilter]);

  return (
    <div className="space-y-3">
      {/* Search + Filter */}
      {showSearch && sites.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search input */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sites..."
              className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-8 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Stage filter chips — dynamically generated from actual site stages */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* "All" chip always visible */}
            <button
              onClick={() => setStageFilter("all")}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                stageFilter === "all"
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              All
              <span className={stageFilter === "all" ? "text-gray-400" : "text-gray-300"}>
                {sites.length}
              </span>
            </button>
            {stageFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setStageFilter(f.value)}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  stageFilter === f.value
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                }`}
              >
                {f.label}
                <span className={stageFilter === f.value ? "text-gray-400" : "text-gray-300"}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {filteredSites.length === 0 ? (
        sites.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-12 w-12" />}
            title="No sites yet"
            description="Add a site to start tracking milestones and tasks."
          />
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">No sites match your search.</p>
            <button
              onClick={() => {
                setSearch("");
                setStageFilter("all");
              }}
              className="mt-2 text-sm text-brand-dark hover:underline"
            >
              Clear filters
            </button>
          </div>
        )
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card divide-y divide-gray-50">
          {filteredSites.map((site) => {
            const taskProgress =
              (site.task_count ?? 0) > 0
                ? Math.round(((site.completed_task_count ?? 0) / (site.task_count ?? 1)) * 100)
                : 0;
            const isDq = site.pipeline_stage === "disqualified";

            return (
              <Link
                key={site.slug}
                href={`/customers/${customerSlug}/sites/${site.slug}`}
                className={`group flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors ${
                  isDq ? "opacity-50" : ""
                }`}
              >
                {/* Site info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-brand-dark truncate">
                      {site.name}
                    </h3>
                    <PipelineStageBadge stage={site.pipeline_stage} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {site.city}, {site.state}
                    {isDq && site.dq_reason && (
                      <span className="ml-2 text-gray-400">&middot; {site.dq_reason}</span>
                    )}
                  </p>
                </div>

                {/* Stats */}
                {!isDq && (
                  <>
                    <div className="hidden sm:block text-center shrink-0 w-20">
                      <p className="text-sm font-medium text-gray-900">{site.milestone_count ?? 0}</p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Milestones</p>
                    </div>
                    <div className="hidden sm:block text-center shrink-0 w-20">
                      <p className="text-sm font-medium text-gray-900">
                        {site.completed_task_count ?? 0}/{site.task_count ?? 0}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tasks</p>
                    </div>
                    <div className="hidden md:flex items-center gap-2 shrink-0 w-28">
                      <ProgressBar value={taskProgress} size="sm" className="flex-1" />
                      <span className="text-xs text-gray-500 w-8 text-right">{taskProgress}%</span>
                    </div>
                  </>
                )}

                {/* DQ re-eval */}
                {isDq && site.dq_reeval_date && (
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-xs text-gray-400">Re-eval</p>
                    <p className="text-xs text-gray-500">{site.dq_reeval_date}</p>
                  </div>
                )}

                <ArrowRight className="h-4 w-4 text-gray-300 shrink-0 group-hover:text-gray-500 transition-colors" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
