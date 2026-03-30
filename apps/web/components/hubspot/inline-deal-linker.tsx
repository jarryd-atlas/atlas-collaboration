"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Search, RefreshCw } from "lucide-react";
import { linkDealToSite, unlinkDealFromSite } from "../../lib/actions/hubspot";
import { getDealType } from "../../lib/hubspot/constants";

interface DealLink {
  id: string;
  hubspot_deal_id: string;
  deal_name: string;
  deal_type: string | null;
}

interface DealSearchResult {
  id: string;
  name: string;
  stage: string;
  amount: string | null;
  pipeline: string | null;
}

interface InlineDealLinkerProps {
  siteId: string;
  dealLinks: DealLink[];
}

/** Color scheme per deal type */
function dealTypeColors(dealType: string | null) {
  if (dealType === "renewal") {
    return {
      pill: "bg-blue-50 text-blue-700",
      close: "text-blue-400 hover:text-red-500",
      label: "Renewal",
    };
  }
  // new_business or unknown — orange (original)
  return {
    pill: "bg-orange-50 text-orange-700",
    close: "text-orange-400 hover:text-red-500",
    label: "New Business",
  };
}

export function InlineDealLinker({ siteId, dealLinks }: InlineDealLinkerProps) {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DealSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/hubspot/deals/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!showSearch) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowSearch(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSearch(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSearch]);

  // Focus input when search opens
  useEffect(() => {
    if (showSearch) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [showSearch]);

  async function handleLink(deal: DealSearchResult) {
    setLinking(true);
    const dealType = getDealType(deal.stage);
    await linkDealToSite(siteId, deal.id, deal.name ?? "", dealType);
    setLinking(false);
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    router.refresh();
  }

  async function handleUnlink(e: React.MouseEvent, linkId: string) {
    e.stopPropagation();
    e.preventDefault();
    setUnlinkingId(linkId);
    await unlinkDealFromSite(linkId);
    setUnlinkingId(null);
    router.refresh();
  }

  function handleAddClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setShowSearch(true);
  }

  return (
    <div
      className="flex items-center gap-1 flex-wrap mt-1"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {/* Existing deal pills — color-coded by deal type */}
      {dealLinks.map((dl) => {
        const colors = dealTypeColors(dl.deal_type);
        return (
          <span
            key={dl.id}
            className={`inline-flex items-center gap-0.5 text-[10px] rounded-full px-2 py-0.5 ${colors.pill}`}
            title={colors.label}
          >
            {dl.deal_type === "renewal" && <RefreshCw className="h-2.5 w-2.5 shrink-0" />}
            <span>{dl.deal_name || `Deal #${dl.hubspot_deal_id}`}</span>
            <button
              onClick={(e) => handleUnlink(e, dl.id)}
              disabled={unlinkingId === dl.id}
              className={`ml-0.5 shrink-0 ${colors.close}`}
              title="Unlink deal"
            >
              {unlinkingId === dl.id ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <X className="h-2.5 w-2.5" />
              )}
            </button>
          </span>
        );
      })}

      {/* Add button / search dropdown */}
      <div className="relative" ref={dropdownRef}>
        {!showSearch ? (
          <button
            onClick={handleAddClick}
            className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
            title="Link a HubSpot deal"
          >
            <Plus className="h-3 w-3" />
          </button>
        ) : (
          <div className="absolute left-0 top-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-72 p-2 space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                placeholder="Search deals..."
                className="w-full rounded border border-gray-200 bg-white pl-7 pr-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
              />
            </div>
            {searching && (
              <p className="text-[10px] text-gray-400 flex items-center gap-1 px-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Searching...
              </p>
            )}
            {searchResults.length > 0 && (
              <div className="border border-gray-100 rounded max-h-44 overflow-y-auto divide-y divide-gray-50">
                {searchResults.map((deal) => {
                  const type = getDealType(deal.stage);
                  const isRenewal = type === "renewal";
                  return (
                    <button
                      key={deal.id}
                      className="w-full text-left px-2 py-1.5 hover:bg-gray-50 disabled:opacity-50 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleLink(deal);
                      }}
                      disabled={linking}
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="font-medium text-gray-900 break-words flex-1">{deal.name}</span>
                        <span className={`text-[9px] font-medium rounded-full px-1.5 py-0.5 shrink-0 mt-0.5 ${
                          isRenewal ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-600"
                        }`}>
                          {isRenewal ? "Renewal" : "New Biz"}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {deal.stage}
                        {deal.amount && ` · $${Number(deal.amount).toLocaleString()}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-[10px] text-gray-400 px-1">No deals found</p>
            )}
            {linking && (
              <p className="text-[10px] text-gray-400 flex items-center gap-1 px-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Linking...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
