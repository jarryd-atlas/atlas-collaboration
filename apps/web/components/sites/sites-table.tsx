"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, MapPin, Plus, ExternalLink } from "lucide-react";
import Link from "next/link";
import { SitePipelineStageDropdown } from "./site-pipeline-stage-dropdown";
import { SiteBusinessUnitDropdown } from "./site-business-unit-dropdown";
import { PipelineStageBadge } from "../ui/badge";
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
  tenant_id: string;
  [key: string]: unknown;
}

interface DealLink {
  site_id: string;
  id: string;
  hubspot_deal_id: string;
  deal_name?: string | null;
  deal_type?: string | null;
}

interface BusinessUnit {
  id: string;
  name: string;
}

interface SitesTableProps {
  sites: Site[];
  customerSlug: string;
  dealLinks: DealLink[];
  isCKInternal: boolean;
  businessUnits?: BusinessUnit[];
  onAddSite?: () => void;
}

type SortField = "name" | "location" | "business_unit" | "pipeline_stage" | "next_step" | "tasks";
type SortDir = "asc" | "desc";

const STAGE_FILTERS = [
  { value: "all", label: "All" },
  { value: "prospect", label: "Prospect" },
  { value: "evaluation", label: "Evaluation" },
  { value: "qualified", label: "Qualified" },
  { value: "contracted", label: "Contracted" },
  { value: "deployment", label: "Deployment" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "disqualified", label: "Disqualified" },
];

export function SitesTable({ sites, customerSlug, dealLinks, isCKInternal, businessUnits = [], onAddSite }: SitesTableProps) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [buFilter, setBuFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const hasBUs = businessUnits.length > 0;

  // Build deal map
  const dealMap = useMemo(() => {
    const map = new Map<string, DealLink[]>();
    for (const dl of dealLinks) {
      const existing = map.get(dl.site_id) ?? [];
      existing.push(dl);
      map.set(dl.site_id, existing);
    }
    return map;
  }, [dealLinks]);

  // Build BU name map
  const buNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const bu of businessUnits) {
      map.set(bu.id, bu.name);
    }
    return map;
  }, [businessUnits]);

  const filtered = useMemo(() => {
    let result = sites;

    // Stage filter
    if (stageFilter !== "all") {
      result = result.filter((s) => s.pipeline_stage === stageFilter);
    }

    // BU filter
    if (buFilter !== "all") {
      if (buFilter === "none") {
        result = result.filter((s) => !(s as any).business_unit_id);
      } else {
        result = result.filter((s) => (s as any).business_unit_id === buFilter);
      }
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.city?.toLowerCase().includes(q) ||
          s.state?.toLowerCase().includes(q) ||
          s.address?.toLowerCase().includes(q) ||
          s.next_step?.toLowerCase().includes(q) ||
          (buNameMap.get((s as any).business_unit_id ?? "") ?? "").toLowerCase().includes(q),
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "location": {
          const la = [a.city, a.state].filter(Boolean).join(", ");
          const lb = [b.city, b.state].filter(Boolean).join(", ");
          cmp = la.localeCompare(lb);
          break;
        }
        case "business_unit": {
          const ba = buNameMap.get((a as any).business_unit_id ?? "") ?? "zzz";
          const bb = buNameMap.get((b as any).business_unit_id ?? "") ?? "zzz";
          cmp = ba.localeCompare(bb);
          break;
        }
        case "pipeline_stage":
          cmp = a.pipeline_stage.localeCompare(b.pipeline_stage);
          break;
        case "next_step":
          cmp = (a.next_step ?? "").localeCompare(b.next_step ?? "");
          break;
        case "tasks": {
          const ta = (a.task_count ?? 0) - (a.completed_task_count ?? 0);
          const tb = (b.task_count ?? 0) - (b.completed_task_count ?? 0);
          cmp = tb - ta;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sites, search, stageFilter, buFilter, sortField, sortDir, buNameMap]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // Stage counts for chips
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sites) {
      counts[s.pipeline_stage] = (counts[s.pipeline_stage] ?? 0) + 1;
    }
    return counts;
  }, [sites]);

  const colSpan = hasBUs ? 7 : 6;

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Sites</h3>
            <span className="text-xs text-gray-400">{sites.length} total</span>
          </div>
          <div className="flex items-center gap-2">
            {/* BU filter */}
            {hasBUs && (
              <select
                value={buFilter}
                onChange={(e) => setBuFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-green"
              >
                <option value="all">All Units</option>
                <option value="none">Unassigned</option>
                {businessUnits.map((bu) => (
                  <option key={bu.id} value={bu.id}>{bu.name}</option>
                ))}
              </select>
            )}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sites..."
                className="pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-md w-48 focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
            </div>
            {isCKInternal && onAddSite && (
              <button
                onClick={onAddSite}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-brand-green rounded-md hover:bg-brand-green/90 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Site
              </button>
            )}
          </div>
        </div>

        {/* Stage filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STAGE_FILTERS.filter((sf) => sf.value === "all" || (stageCounts[sf.value] ?? 0) > 0).map((sf) => (
            <button
              key={sf.value}
              onClick={() => setStageFilter(sf.value)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-full border transition-colors",
                stageFilter === sf.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50",
              )}
            >
              {sf.label}
              {sf.value !== "all" && stageCounts[sf.value] ? (
                <span className="ml-1 opacity-70">{stageCounts[sf.value]}</span>
              ) : sf.value === "all" ? (
                <span className="ml-1 opacity-70">{sites.length}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <SortTh label="Site" field="name" current={sortField} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Location" field="location" current={sortField} dir={sortDir} onSort={toggleSort} className="hidden sm:table-cell" />
                {hasBUs && (
                  <SortTh label="Business Unit" field="business_unit" current={sortField} dir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                )}
                <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs w-[130px]">Pipeline Stage</th>
                <SortTh label="Next Step" field="next_step" current={sortField} dir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
                <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs hidden xl:table-cell w-[150px]">HubSpot Deal</th>
                <SortTh label="Open Tasks" field="tasks" current={sortField} dir={sortDir} onSort={toggleSort} className="w-[90px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-400 text-xs">
                    {sites.length === 0 ? "No sites yet." : "No sites match your filters."}
                  </td>
                </tr>
              ) : (
                filtered.map((site) => {
                  const siteId = site.id ?? "";
                  const deals = dealMap.get(siteId) ?? [];
                  const openTasks = (site.task_count ?? 0) - (site.completed_task_count ?? 0);
                  const location = [site.city, site.state].filter(Boolean).join(", ");
                  const siteBuId = (site as any).business_unit_id ?? null;
                  const siteBuName = siteBuId ? (buNameMap.get(siteBuId) ?? null) : null;

                  return (
                    <tr key={site.slug} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/customers/${customerSlug}/sites/${site.slug}`}
                          className="text-sm font-medium text-gray-800 hover:text-brand-green transition-colors flex items-center gap-1 group/link"
                        >
                          {site.name}
                          <ExternalLink className="h-3 w-3 text-gray-300 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <span className="text-xs text-gray-500">{location || "--"}</span>
                      </td>
                      {hasBUs && (
                        <td className="px-3 py-2.5 hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                          {isCKInternal ? (
                            <SiteBusinessUnitDropdown
                              siteId={siteId}
                              currentBusinessUnitId={siteBuId}
                              currentBusinessUnitName={siteBuName}
                              businessUnits={businessUnits}
                            />
                          ) : (
                            <span className="text-xs text-gray-500">{siteBuName || "--"}</span>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {isCKInternal ? (
                          <SitePipelineStageDropdown
                            siteId={siteId}
                            currentStage={site.pipeline_stage}
                          />
                        ) : (
                          <PipelineStageBadge stage={site.pipeline_stage} />
                        )}
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        <span className="text-xs text-gray-500 truncate block max-w-[200px]">
                          {site.next_step || "--"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 hidden xl:table-cell">
                        {deals.length > 0 ? (
                          <div className="space-y-0.5">
                            {deals.map((d) => (
                              <span key={d.id} className="block text-xs text-gray-600 truncate max-w-[140px]">
                                {d.deal_name || d.hubspot_deal_id}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">--</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {openTasks > 0 ? (
                          <span className="text-xs font-medium text-gray-700">{openTasks}</span>
                        ) : (
                          <span className="text-xs text-gray-300">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      {filtered.length > 0 && filtered.length !== sites.length && (
        <p className="text-[11px] text-gray-400">
          Showing {filtered.length} of {sites.length} sites
        </p>
      )}
    </div>
  );
}

function SortTh({
  label,
  field,
  current,
  dir,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = current === field;
  return (
    <th className={cn("text-left px-3 py-2 font-medium text-gray-500 text-xs", className)}>
      <button
        className="flex items-center gap-0.5 hover:text-gray-700 transition-colors"
        onClick={() => onSort(field)}
      >
        {label}
        {isActive && (
          dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </button>
    </th>
  );
}
