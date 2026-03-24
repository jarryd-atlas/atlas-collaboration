"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Link2, Unlink, Search, ExternalLink } from "lucide-react";
import { linkDealToSite, unlinkDealFromSite } from "../../lib/actions/hubspot";

interface DealSearchResult {
  id: string;
  name: string;
  stage: string;
  amount: string | null;
}

interface SiteDealLinkProps {
  siteId: string;
  existingLinks: { id: string; hubspot_deal_id: string; deal_name: string | null; is_primary: boolean }[];
  portalId?: string;
}

export function SiteDealLink({ siteId, existingLinks, portalId }: SiteDealLinkProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DealSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);

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

  return (
    <div className="space-y-2">
      {/* Existing linked deals */}
      {existingLinks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {existingLinks.map((link) => (
            <div
              key={link.id}
              className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full border border-orange-200"
            >
              <Link2 className="h-3 w-3" />
              {portalId ? (
                <a
                  href={`https://app.hubspot.com/contacts/${portalId}/deal/${link.hubspot_deal_id}`}
                  target="_blank"
                  rel="noopener"
                  className="hover:underline"
                >
                  {link.deal_name ?? `Deal #${link.hubspot_deal_id}`}
                </a>
              ) : (
                <span>{link.deal_name ?? `Deal #${link.hubspot_deal_id}`}</span>
              )}
              {portalId && <ExternalLink className="h-2.5 w-2.5 opacity-50" />}
              <button
                onClick={() => handleUnlink(link.id)}
                disabled={unlinking === link.id}
                className="ml-1 text-orange-400 hover:text-red-500"
                title="Unlink deal"
              >
                <Unlink className="h-3 w-3" />
              </button>
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
