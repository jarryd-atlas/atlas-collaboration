"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "../../../../../../components/ui/button";
import { Input } from "../../../../../../components/ui/input";
import { Link2, Unlink, Search, Building2 } from "lucide-react";
import { linkDealToSite, unlinkDealFromSite } from "../../../../../../lib/actions/hubspot";
import type { HubSpotSiteLink } from "../../../../../../lib/hubspot/types";

interface DealSearchResult {
  id: string;
  name: string;
  stage: string;
  amount: string | null;
}

export function DealLinker({ siteLinks }: { siteLinks: HubSpotSiteLink[] }) {
  const [linkingFor, setLinkingFor] = useState<{ siteId: string; siteName: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DealSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults([]); return; }
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

  async function handleLink(deal: DealSearchResult) {
    if (!linkingFor) return;
    setLinking(true);
    await linkDealToSite(linkingFor.siteId, deal.id, deal.name ?? "");
    setLinking(false);
    setLinkingFor(null);
    setSearchQuery("");
    setSearchResults([]);
  }

  async function handleUnlink(linkId: string) {
    setUnlinking(linkId);
    await unlinkDealFromSite(linkId);
    setUnlinking(null);
  }

  // Build a map of linked site IDs
  const linkedSiteIds = new Set(siteLinks.map((l) => l.site_id));

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Link2 className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Linked Deals</h2>
          <p className="text-sm text-gray-500">Associate HubSpot deals with sites.</p>
        </div>
      </div>

      {/* Linked deals table */}
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Site</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">HubSpot Deal</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {siteLinks.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  No deals linked yet. Click &quot;Link Deal&quot; below to get started.
                </td>
              </tr>
            ) : (
              siteLinks.map((link) => (
                <tr key={link.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{link.site?.name ?? link.site_id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {link.deal_name ?? `Deal ${link.hubspot_deal_id}`}
                    <span className="text-xs text-gray-400 ml-2">#{link.hubspot_deal_id}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlink(link.id)}
                      disabled={unlinking === link.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Unlink className="h-4 w-4 mr-1" />
                      {unlinking === link.id ? "Unlinking..." : "Unlink"}
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Link deal search */}
      {linkingFor ? (
        <div className="mt-4 p-4 border border-blue-200 bg-blue-50/50 rounded-lg space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Search HubSpot for a deal to link to <strong>{linkingFor.siteName}</strong>
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search deals by name..."
              className="pl-9"
            />
          </div>
          {searching && <p className="text-xs text-gray-500">Searching...</p>}
          {searchResults.length > 0 && (
            <div className="border border-gray-200 rounded-md bg-white max-h-48 overflow-y-auto divide-y">
              {searchResults.map((deal) => (
                <button
                  key={deal.id}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between items-center disabled:opacity-50"
                  onClick={() => handleLink(deal)}
                  disabled={linking}
                >
                  <div>
                    <span className="font-medium text-sm">{deal.name}</span>
                    {deal.amount && (
                      <span className="text-xs text-gray-500 ml-2">
                        ${Number(deal.amount).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">#{deal.id}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { setLinkingFor(null); setSearchQuery(""); setSearchResults([]); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <LinkSiteButton onSelect={(siteId, siteName) => setLinkingFor({ siteId, siteName })} linkedSiteIds={linkedSiteIds} />
        </div>
      )}
    </div>
  );
}

/** Simple button that lets admin pick a site to link. For now uses a basic approach. */
function LinkSiteButton({
  onSelect,
  linkedSiteIds,
}: {
  onSelect: (siteId: string, siteName: string) => void;
  linkedSiteIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadSites() {
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch("/api/search?q=&type=sites&limit=100");
      const data = await res.json();
      setSites(
        (data.results ?? [])
          .filter((s: { id: string }) => !linkedSiteIds.has(s.id))
          .map((s: { id: string; title: string }) => ({ id: s.id, name: s.title }))
      );
    } catch {
      setSites([]);
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={loadSites}>
        <Link2 className="h-4 w-4 mr-1" /> Link a Deal
      </Button>
    );
  }

  return (
    <div className="p-3 border border-gray-200 rounded-lg space-y-2">
      <p className="text-sm font-medium text-gray-700">Select a site to link:</p>
      {loading ? (
        <p className="text-xs text-gray-500">Loading sites...</p>
      ) : sites.length === 0 ? (
        <p className="text-xs text-gray-500">All sites are already linked.</p>
      ) : (
        <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
          {sites.map((site) => (
            <button
              key={site.id}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
              onClick={() => { onSelect(site.id, site.name); setOpen(false); }}
            >
              {site.name}
            </button>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  );
}
