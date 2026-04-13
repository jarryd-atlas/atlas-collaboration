"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "../../../../../../components/ui/button";
import { Input } from "../../../../../../components/ui/input";
import {
  Link2,
  Unlink,
  Search,
  RefreshCw,
  ArrowUpDown,
  Building2,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { linkDealToSite, unlinkDealFromSite } from "../../../../../../lib/actions/hubspot";
import type { HubSpotSiteLink } from "../../../../../../lib/hubspot/types";

interface DealRow {
  id: string;
  name: string;
  stage: string;
  stageLabel: string;
  pipeline: string;
  dealType: "new_business" | "renewal";
  amount: string | null;
  closeDate: string | null;
  ownerName: string | null;
  linkedSite: { linkId: string; siteId: string; siteName: string } | null;
}

interface SiteOption {
  id: string;
  name: string;
  customerName: string;
}

type LinkFilter = "all" | "linked" | "unlinked";
type PipelineFilter = "all" | "new_business" | "renewal";
type SortField = "name" | "stageLabel" | "amount" | "closeDate" | "ownerName" | "dealType";
type SortDir = "asc" | "desc";

export function DealsTable({ siteLinks }: { siteLinks: HubSpotSiteLink[] }) {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("all");
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("all");

  // Sort
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Inline linking state
  const [linkingDealId, setLinkingDealId] = useState<string | null>(null);
  const [siteSearch, setSiteSearch] = useState("");
  const [actionPending, setActionPending] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [dealsRes, sitesRes] = await Promise.all([
        fetch("/api/hubspot/deals/list"),
        fetch("/api/sites/list"),
      ]);

      if (!dealsRes.ok) {
        const err = await dealsRes.json();
        throw new Error(err.error ?? "Failed to load deals");
      }

      const dealsData = await dealsRes.json();
      const sitesData = await sitesRes.json();
      setDeals(dealsData.deals ?? []);
      setSites(
        (sitesData.results ?? []).map((s: any) => ({
          id: s.id,
          name: s.name,
          customerName: s.customerName ?? "",
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered & sorted deals
  const filteredDeals = useMemo(() => {
    let result = deals;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.ownerName?.toLowerCase().includes(q) ||
          d.linkedSite?.siteName.toLowerCase().includes(q)
      );
    }

    // Link filter
    if (linkFilter === "linked") result = result.filter((d) => d.linkedSite);
    if (linkFilter === "unlinked") result = result.filter((d) => !d.linkedSite);

    // Pipeline filter
    if (pipelineFilter !== "all") result = result.filter((d) => d.dealType === pipelineFilter);

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "stageLabel":
          aVal = a.stageLabel.toLowerCase();
          bVal = b.stageLabel.toLowerCase();
          break;
        case "amount":
          aVal = Number(a.amount) || 0;
          bVal = Number(b.amount) || 0;
          break;
        case "closeDate":
          aVal = a.closeDate ?? "";
          bVal = b.closeDate ?? "";
          break;
        case "ownerName":
          aVal = (a.ownerName ?? "").toLowerCase();
          bVal = (b.ownerName ?? "").toLowerCase();
          break;
        case "dealType":
          aVal = a.dealType;
          bVal = b.dealType;
          break;
      }

      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [deals, search, linkFilter, pipelineFilter, sortField, sortDir]);

  // Stats
  const linkedCount = deals.filter((d) => d.linkedSite).length;
  const unlinkedCount = deals.length - linkedCount;

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // Filtered sites for inline picker
  const filteredSites = useMemo(() => {
    if (!siteSearch.trim()) return sites;
    const q = siteSearch.toLowerCase();
    return sites.filter(
      (s) => s.name.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q)
    );
  }, [sites, siteSearch]);

  async function handleLink(dealId: string, siteId: string) {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

    setActionPending(dealId);
    try {
      await linkDealToSite(siteId, dealId, deal.name, deal.dealType);
      // Update local state
      const site = sites.find((s) => s.id === siteId);
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId
            ? { ...d, linkedSite: { linkId: "pending", siteId, siteName: site?.name ?? "Unknown" } }
            : d
        )
      );
    } catch {
      // ignore
    }
    setActionPending(null);
    setLinkingDealId(null);
    setSiteSearch("");
  }

  async function handleUnlink(dealId: string, linkId: string) {
    setActionPending(dealId);
    try {
      await unlinkDealFromSite(linkId);
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, linkedSite: null } : d))
      );
    } catch {
      // ignore
    }
    setActionPending(null);
  }

  function formatAmount(amount: string | null): string {
    if (!amount) return "--";
    const n = Number(amount);
    if (isNaN(n)) return amount;
    return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "--";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Link2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">HubSpot Deals</h2>
            <p className="text-sm text-gray-500">
              {loading
                ? "Loading deals..."
                : `${deals.length} deals \u00b7 ${linkedCount} linked \u00b7 ${unlinkedCount} unlinked`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals, owners, or sites..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {(["all", "linked", "unlinked"] as LinkFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setLinkFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                linkFilter === f
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f}
              {f === "unlinked" && unlinkedCount > 0 && (
                <span className="ml-1 text-red-500">({unlinkedCount})</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {(["all", "new_business", "renewal"] as PipelineFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setPipelineFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                pipelineFilter === f
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f === "all" ? "All" : f === "new_business" ? "New Biz" : "Renewal"}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={fetchData} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-gray-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader label="Deal Name" field="name" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Type" field="dealType" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Stage" field="stageLabel" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Amount" field="amount" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Close Date" field="closeDate" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortHeader label="Owner" field="ownerName" current={sortField} dir={sortDir} onSort={toggleSort} />
              <th className="text-left px-4 py-2 font-medium text-gray-600">Linked Site</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600 w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              // Skeleton rows
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredDeals.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  {deals.length === 0 ? "No deals found in HubSpot." : "No deals match your filters."}
                </td>
              </tr>
            ) : (
              filteredDeals.map((deal) => (
                <tr key={deal.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 truncate max-w-[200px]" title={deal.name}>
                      {deal.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        deal.dealType === "renewal"
                          ? "bg-purple-50 text-purple-700"
                          : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {deal.dealType === "renewal" ? "Renewal" : "New Biz"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-700 text-xs">{deal.stageLabel}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 tabular-nums">{formatAmount(deal.amount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(deal.closeDate)}</td>
                  <td className="px-4 py-3 text-gray-700 truncate max-w-[120px]" title={deal.ownerName ?? ""}>
                    {deal.ownerName ?? "--"}
                  </td>
                  <td className="px-4 py-3">
                    {linkingDealId === deal.id ? (
                      <div className="relative">
                        <Input
                          autoFocus
                          value={siteSearch}
                          onChange={(e) => setSiteSearch(e.target.value)}
                          placeholder="Search sites..."
                          className="h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setLinkingDealId(null);
                              setSiteSearch("");
                            }
                          }}
                        />
                        {filteredSites.length > 0 && (
                          <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                            {filteredSites.map((site) => (
                              <button
                                key={site.id}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                                onClick={() => handleLink(deal.id, site.id)}
                                disabled={actionPending === deal.id}
                              >
                                <Building2 className="h-3 w-3 text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-medium text-gray-900 block truncate">{site.name}</span>
                                  {site.customerName && (
                                    <span className="text-gray-400 block truncate">{site.customerName}</span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : deal.linkedSite ? (
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3 w-3 text-green-600 shrink-0" />
                        <span className="text-xs font-medium text-green-700 truncate max-w-[140px]" title={deal.linkedSite.siteName}>
                          {deal.linkedSite.siteName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Unlinked</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {actionPending === deal.id ? (
                      <span className="text-xs text-gray-400">Working...</span>
                    ) : deal.linkedSite ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnlink(deal.id, deal.linkedSite!.linkId)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                      >
                        <Unlink className="h-3 w-3 mr-1" />
                        <span className="text-xs">Unlink</span>
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setLinkingDealId(deal.id);
                          setSiteSearch("");
                        }}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 px-2"
                      >
                        <Link2 className="h-3 w-3 mr-1" />
                        <span className="text-xs">Link</span>
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {!loading && filteredDeals.length !== deals.length && (
        <p className="text-xs text-gray-400 mt-2">
          Showing {filteredDeals.length} of {deals.length} deals
        </p>
      )}
    </div>
  );
}

function SortHeader({
  label,
  field,
  current,
  dir,
  onSort,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (field: SortField) => void;
}) {
  return (
    <th className="text-left px-4 py-2 font-medium text-gray-600">
      <button
        className="flex items-center gap-1 hover:text-gray-900 transition-colors"
        onClick={() => onSort(field)}
      >
        {label}
        <ArrowUpDown
          className={`h-3 w-3 ${current === field ? "text-gray-900" : "text-gray-300"}`}
        />
        {current === field && (
          <span className="text-[10px] text-gray-400">{dir === "asc" ? "\u2191" : "\u2193"}</span>
        )}
      </button>
    </th>
  );
}
