"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Link2, Unlink, Search, ExternalLink, ChevronDown, DollarSign, Zap, Percent, Calendar } from "lucide-react";
import { linkDealToSite, unlinkDealFromSite } from "../../lib/actions/hubspot";

interface DealSearchResult {
  id: string;
  name: string;
  stage: string;
  amount: string | null;
}

interface DealProperties {
  [key: string]: string | null;
}

interface SiteDealLinkProps {
  siteId: string;
  existingLinks: { id: string; hubspot_deal_id: string; deal_name: string | null; is_primary: boolean }[];
  portalId?: string;
}

const DEAL_FIELD_LABELS: { key: string; label: string; format?: "currency" | "percent" | "date" }[] = [
  { key: "dealstage", label: "Stage" },
  { key: "amount", label: "Deal Amount", format: "currency" },
  { key: "annual_energy_spend__c", label: "Annual Energy Spend", format: "currency" },
  { key: "refrigeration_load", label: "Refrigeration Load", format: "percent" },
  { key: "forecasted_savings__", label: "Forecasted Savings", format: "currency" },
  { key: "forecasted_refrigeration_savings_percent", label: "Refrig. Savings", format: "percent" },
  { key: "nrc", label: "NRC (Install Cost)", format: "currency" },
  { key: "roi", label: "ROI", format: "percent" },
  { key: "facility_type", label: "Facility Type" },
  { key: "site_equivalent", label: "Site Equivalent" },
  { key: "energy_savings_status", label: "EVA Status" },
  { key: "closedate", label: "Close Date", format: "date" },
  { key: "service_start_date", label: "Service Start", format: "date" },
];

function formatValue(value: string | null, format?: "currency" | "percent" | "date"): string {
  if (!value) return "—";
  if (format === "currency") {
    const n = Number(value);
    return isNaN(n) ? value : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (format === "percent") {
    const n = Number(value);
    return isNaN(n) ? value : `${n.toFixed(1)}%`;
  }
  if (format === "date") {
    try {
      return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return value; }
  }
  return value;
}

export function SiteDealLink({ siteId, existingLinks, portalId }: SiteDealLinkProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DealSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [expandedDeal, setExpandedDeal] = useState<string | null>(null);
  const [dealProps, setDealProps] = useState<Record<string, DealProperties>>({});
  const [loadingDeal, setLoadingDeal] = useState<string | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/hubspot/deals/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  async function handleLink(deal: DealSearchResult) {
    setLinking(true);
    await linkDealToSite(siteId, deal.id, deal.name ?? "");
    setLinking(false);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  }

  async function handleUnlink(linkId: string) {
    setUnlinking(linkId);
    await unlinkDealFromSite(linkId);
    setUnlinking(null);
  }

  async function toggleDealDetails(dealId: string) {
    if (expandedDeal === dealId) {
      setExpandedDeal(null);
      return;
    }
    setExpandedDeal(dealId);
    if (!dealProps[dealId]) {
      setLoadingDeal(dealId);
      try {
        const res = await fetch(`/api/hubspot/deals/${dealId}`);
        const data = await res.json();
        if (data.deal?.properties) {
          setDealProps((prev) => ({ ...prev, [dealId]: data.deal.properties }));
        }
      } catch { /* ignore */ }
      setLoadingDeal(null);
    }
  }

  return (
    <div className="space-y-2">
      {/* Existing linked deals */}
      {existingLinks.length > 0 && (
        <div className="space-y-2">
          {existingLinks.map((link) => (
            <div key={link.id}>
              {/* Deal pill */}
              <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full border border-orange-200">
                <Link2 className="h-3 w-3" />
                <button
                  onClick={() => toggleDealDetails(link.hubspot_deal_id)}
                  className="hover:underline flex items-center gap-1"
                >
                  {link.deal_name ?? `Deal #${link.hubspot_deal_id}`}
                  <ChevronDown className={`h-3 w-3 transition-transform ${expandedDeal === link.hubspot_deal_id ? "rotate-180" : ""}`} />
                </button>
                {portalId && (
                  <a
                    href={`https://app.hubspot.com/contacts/${portalId}/deal/${link.hubspot_deal_id}`}
                    target="_blank"
                    rel="noopener"
                    className="text-orange-400 hover:text-orange-600"
                    title="View in HubSpot"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                <button
                  onClick={() => handleUnlink(link.id)}
                  disabled={unlinking === link.id}
                  className="ml-1 text-orange-400 hover:text-red-500"
                  title="Unlink deal"
                >
                  <Unlink className="h-3 w-3" />
                </button>
              </div>

              {/* Expandable deal details */}
              {expandedDeal === link.hubspot_deal_id && (
                <div className="mt-2 ml-1 border border-gray-200 rounded-lg p-3 bg-gray-50/50 max-w-lg">
                  {loadingDeal === link.hubspot_deal_id ? (
                    <p className="text-xs text-gray-400">Loading deal data...</p>
                  ) : dealProps[link.hubspot_deal_id] ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                      {DEAL_FIELD_LABELS.map(({ key, label, format }) => {
                        const val = dealProps[link.hubspot_deal_id]?.[key];
                        if (!val && val !== "0") return null;
                        return (
                          <div key={key} className="flex justify-between text-xs">
                            <span className="text-gray-500">{label}</span>
                            <span className="font-medium text-gray-900 text-right">
                              {formatValue(val, format)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Failed to load deal data</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Link new deal */}
      {showSearch ? (
        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg max-w-sm space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search HubSpot deals..."
              className="pl-8 text-sm h-8"
            />
          </div>
          {searching && <p className="text-xs text-gray-400">Searching...</p>}
          {searchResults.length > 0 && (
            <div className="border rounded max-h-40 overflow-y-auto divide-y text-sm">
              {searchResults.map((deal) => (
                <button
                  key={deal.id}
                  className="w-full text-left px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => handleLink(deal)}
                  disabled={linking}
                >
                  <span className="font-medium">{deal.name}</span>
                  {deal.amount && (
                    <span className="text-xs text-gray-400 ml-1.5">
                      ${Number(deal.amount).toLocaleString()}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowSearch(true)} className="text-xs">
          <Link2 className="h-3.5 w-3.5 mr-1" />
          Link Deal
        </Button>
      )}
    </div>
  );
}
