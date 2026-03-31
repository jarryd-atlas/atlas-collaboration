"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PipelineStageBadge } from "../ui/badge";
import { ProgressBar } from "../ui/progress-bar";
import { EmptyState } from "../ui/empty-state";
import { updateSiteNextStep } from "../../lib/actions";
import { MapPin, ArrowRight, Search, X, ExternalLink, Plus } from "lucide-react";
import { InlineDealLinker } from "../hubspot/inline-deal-linker";
import { cn } from "../../lib/utils";

interface Site {
  id?: string;
  slug: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pipeline_stage: string;
  milestone_count?: number | null;
  task_count?: number | null;
  completed_task_count?: number | null;
  dq_reason?: string | null;
  dq_reeval_date?: string | null;
  next_step?: string | null;
}

interface SitesListProps {
  sites: Site[];
  customerSlug: string;
  /** Show search and filter controls */
  showSearch?: boolean;
  /** Allow editing next step (internal users only) */
  editable?: boolean;
  /** HubSpot deal links for all sites */
  dealLinks?: { site_id: string; id: string; hubspot_deal_id: string; deal_name: string; deal_type: string | null }[];
  /** Whether HubSpot integration is enabled */
  hubspotEnabled?: boolean;
  /** Compact mode — hides stats columns for narrow panels */
  compact?: boolean;
  /** Currently selected site ID (for filtering tasks) */
  selectedSiteId?: string | null;
  /** Callback when a site is selected (selection mode) */
  onSiteSelect?: (siteId: string | null) => void;
  /** Callback when user selects a Google Places result to add a new site */
  onAddFromGoogle?: (place: { name: string; address: string; city: string; state: string }) => void;
  /** Company name — used to scope Google Places search */
  customerName?: string;
}

/** All possible pipeline stages with display labels, in pipeline order */
const STAGE_LABELS: Record<string, string> = {
  whitespace: "Whitespace",
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
const STAGE_ORDER = ["whitespace", "prospect", "evaluation", "qualified", "contracted", "deployment", "active", "paused", "disqualified"];

function NextStepInput({ siteId, initialValue }: { siteId: string; initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef(initialValue);

  const save = useCallback(async () => {
    const trimmed = value.trim();
    if (trimmed === lastSavedRef.current) return;
    setSaving(true);
    const result = await updateSiteNextStep(siteId, trimmed);
    if (!("error" in result)) {
      lastSavedRef.current = trimmed;
    }
    setSaving(false);
  }, [siteId, value]);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      onClick={(e) => e.preventDefault()}
      placeholder="Add next step..."
      className={`w-full bg-transparent text-xs text-gray-600 placeholder:text-gray-300 border-0 border-b border-transparent hover:border-gray-200 focus:border-brand-green focus:ring-0 focus:outline-none px-0 py-0.5 transition-colors ${
        saving ? "opacity-50" : ""
      }`}
    />
  );
}

export function SitesList({
  sites,
  customerSlug,
  showSearch = true,
  editable = false,
  dealLinks,
  hubspotEnabled,
  compact = false,
  selectedSiteId,
  onSiteSelect,
  onAddFromGoogle,
  customerName,
}: SitesListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [showDropdown, setShowDropdown] = useState(false);
  const [googleResults, setGoogleResults] = useState<{ place_id: string; description: string }[]>([]);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isSelectionMode = !!onSiteSelect;

  // Fetch Google Places when search >= 3 chars
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (search.trim().length < 3 || !onAddFromGoogle) {
      setGoogleResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoadingGoogle(true);
      try {
        const query = customerName ? `${customerName} ${search.trim()}` : search.trim();
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setGoogleResults(data.predictions || []);
        }
      } catch {
        // ignore
      } finally {
        setLoadingGoogle(false);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, onAddFromGoogle, customerName]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  async function handleGoogleSelect(placeId: string) {
    if (!onAddFromGoogle) return;
    setShowDropdown(false);
    try {
      const res = await fetch(`/api/places/details?place_id=${placeId}`);
      if (res.ok) {
        const data = await res.json();
        const d = data.details;
        if (!d) return;
        onAddFromGoogle({
          name: d.name || "",
          address: d.address || "",
          city: d.city || "",
          state: d.state || "",
        });
        setSearch("");
      }
    } catch {
      // ignore
    }
  }

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

  function handleRowClick(site: Site, e: React.MouseEvent) {
    // Don't navigate/select if clicking on an input
    if ((e.target as HTMLElement).tagName === "INPUT") return;

    if (isSelectionMode) {
      // Toggle selection
      onSiteSelect(selectedSiteId === site.id ? null : site.id ?? null);
    } else {
      router.push(`/customers/${customerSlug}/sites/${site.slug}`);
    }
  }

  function handleNavigateClick(site: Site, e: React.MouseEvent) {
    e.stopPropagation();
    router.push(`/customers/${customerSlug}/sites/${site.slug}`);
  }

  return (
    <div className="space-y-3">
      {/* Search + Filter */}
      {showSearch && sites.length > 0 && (
        <div className={cn(
          "flex items-start gap-3",
          compact ? "flex-col" : "flex-col sm:flex-row sm:items-center"
        )}>
          {/* Unified search input with dropdown */}
          <div ref={searchContainerRef} className={cn("relative w-full", compact ? "" : "flex-1 sm:max-w-xs")}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => { if (search.trim().length >= 3) setShowDropdown(true); }}
              placeholder={onAddFromGoogle ? "Search sites or add new..." : "Search sites..."}
              className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-8 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setShowDropdown(false); setGoogleResults([]); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 text-gray-400 z-10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Dropdown with Google Places results */}
            {showDropdown && search.trim().length >= 3 && onAddFromGoogle && (googleResults.length > 0 || loadingGoogle) && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                {/* Existing sites section */}
                {filteredSites.length > 0 && (
                  <>
                    <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Existing Sites ({filteredSites.length})
                      </span>
                    </div>
                    {filteredSites.slice(0, 5).map((site) => (
                      <button
                        key={site.slug}
                        type="button"
                        onClick={() => {
                          setShowDropdown(false);
                          if (isSelectionMode) {
                            onSiteSelect?.(site.id ?? null);
                          } else {
                            router.push(`/customers/${customerSlug}/sites/${site.slug}`);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                      >
                        <MapPin className="h-3 w-3 text-green-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-gray-900 truncate block">{site.name}</span>
                          <span className="text-[11px] text-gray-400 truncate block">
                            {site.address || [site.city, site.state].filter(Boolean).join(", ")}
                          </span>
                        </div>
                        <PipelineStageBadge stage={site.pipeline_stage} />
                      </button>
                    ))}
                    {filteredSites.length > 5 && (
                      <div className="px-3 py-1 text-[10px] text-gray-400 border-b border-gray-100">
                        +{filteredSites.length - 5} more matching sites
                      </div>
                    )}
                  </>
                )}

                {/* Google Places section */}
                <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    {loadingGoogle ? "Searching Google..." : "Add New Site"}
                  </span>
                </div>
                {googleResults.map((p) => (
                  <button
                    key={p.place_id}
                    type="button"
                    onClick={() => handleGoogleSelect(p.place_id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="h-3 w-3 text-blue-500 shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{p.description}</span>
                  </button>
                ))}
                {loadingGoogle && googleResults.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>
                )}
              </div>
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
            const isWhitespace = site.pipeline_stage === "whitespace";
            const isSelected = isSelectionMode && selectedSiteId === site.id;

            return (
              <div
                key={site.slug}
                onClick={(e) => handleRowClick(site, e)}
                className={cn(
                  "group flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer",
                  compact ? "px-3 py-2.5" : "px-6 py-4",
                  (isDq || isWhitespace) && "opacity-60",
                  isSelected && "bg-green-50 ring-1 ring-inset ring-brand-green/40",
                )}
              >
                {/* Site info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={cn(
                      "text-sm font-semibold text-gray-900 group-hover:text-brand-dark truncate",
                      isSelected && "text-brand-dark",
                    )}>
                      {site.name}
                    </h3>
                    <PipelineStageBadge stage={site.pipeline_stage} />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {site.address || [site.city, site.state].filter(Boolean).join(", ")}
                    </span>
                    {isDq && site.dq_reason && (
                      <span className="ml-2 text-gray-400">&middot; {site.dq_reason}</span>
                    )}
                  </p>
                  {hubspotEnabled && editable && site.id && !compact && (
                    <InlineDealLinker
                      siteId={site.id}
                      dealLinks={(dealLinks ?? []).filter(dl => dl.site_id === site.id)}
                    />
                  )}
                </div>

                {/* Next Step — editable inline (hidden in compact mode) */}
                {editable && !isDq && site.id && !compact && (
                  <div className="hidden sm:block shrink-0 w-48">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Next Step</p>
                    <NextStepInput siteId={site.id} initialValue={site.next_step ?? ""} />
                  </div>
                )}

                {/* Show next step as read-only for non-editable (hidden in compact mode) */}
                {!editable && !isDq && site.next_step && !compact && (
                  <div className="hidden sm:block shrink-0 w-48">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Next Step</p>
                    <p className="text-xs text-gray-600 truncate">{site.next_step}</p>
                  </div>
                )}

                {/* Stats — hidden in compact mode */}
                {!isDq && !compact && (
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

                {/* Compact mode: show task count inline */}
                {!isDq && compact && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">
                      {site.completed_task_count ?? 0}/{site.task_count ?? 0}
                    </p>
                  </div>
                )}

                {/* DQ re-eval */}
                {isDq && site.dq_reeval_date && (
                  <div className="hidden sm:block text-right shrink-0">
                    <p className="text-xs text-gray-400">Re-eval</p>
                    <p className="text-xs text-gray-500">{site.dq_reeval_date}</p>
                  </div>
                )}

                {/* Navigate icon — in selection mode, separate from row click */}
                {isSelectionMode ? (
                  <button
                    onClick={(e) => handleNavigateClick(site, e)}
                    className="p-1 rounded hover:bg-gray-200 text-gray-300 hover:text-gray-600 transition-colors shrink-0"
                    title="Open site detail"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <ArrowRight className="h-4 w-4 text-gray-300 shrink-0 group-hover:text-gray-500 transition-colors" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
