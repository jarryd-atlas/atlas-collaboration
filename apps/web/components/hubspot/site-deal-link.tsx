"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Link2, Unlink, Search, ExternalLink, ChevronDown, Pencil, Check, X, Loader2 } from "lucide-react";
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

interface FieldMapping {
  hubspot_property: string;
  direction: "hubspot_to_app" | "app_to_hubspot" | "bidirectional";
}

interface SiteDealLinkProps {
  siteId: string;
  existingLinks: { id: string; hubspot_deal_id: string; deal_name: string | null; is_primary: boolean }[];
  portalId?: string;
  fieldMappings?: FieldMapping[];
}

const DEAL_FIELDS: { key: string; label: string; format?: "currency" | "percent" | "date" }[] = [
  { key: "dealstage", label: "Stage" },
  { key: "amount", label: "Deal Amount", format: "currency" },
  { key: "annual_energy_spend__c", label: "Annual Energy Spend", format: "currency" },
  { key: "refrigeration_load", label: "Refrigeration Load", format: "percent" },
  { key: "forecasted_savings__", label: "Forecasted Savings", format: "currency" },
  { key: "forecasted_refrigeration_savings_percent", label: "Refrig. Savings", format: "percent" },
  { key: "forecasted_total_savings_percent", label: "Total Savings", format: "percent" },
  { key: "nrc", label: "NRC (Install Cost)", format: "currency" },
  { key: "roi", label: "ROI", format: "percent" },
  { key: "facility_type", label: "Facility Type" },
  { key: "site_equivalent", label: "Site Equivalent" },
  { key: "energy_savings_status", label: "EVA Status" },
  { key: "closedate", label: "Close Date", format: "date" },
  { key: "service_start_date", label: "Service Start", format: "date" },
];

function formatDisplay(value: string | null, format?: "currency" | "percent" | "date"): string {
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
    try { return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return value; }
  }
  return value;
}

function rawValue(value: string | null): string {
  return value ?? "";
}

export function SiteDealLink({ siteId, existingLinks, portalId, fieldMappings = [] }: SiteDealLinkProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DealSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [expandedDeal, setExpandedDeal] = useState<string | null>(existingLinks.length > 0 ? existingLinks[0]?.hubspot_deal_id ?? null : null);
  const [dealProps, setDealProps] = useState<Record<string, DealProperties>>({});
  const [loadingDeal, setLoadingDeal] = useState<string | null>(null);

  // Build a set of editable HubSpot property names
  const editableFields = new Set(
    fieldMappings
      .filter((m) => m.direction === "app_to_hubspot" || m.direction === "bidirectional")
      .map((m) => m.hubspot_property)
  );

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

  // Auto-load deal details for expanded deal
  useEffect(() => {
    if (expandedDeal && !dealProps[expandedDeal]) {
      loadDealProps(expandedDeal);
    }
  }, [expandedDeal]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadDealProps(dealId: string) {
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

  function toggleDeal(dealId: string) {
    setExpandedDeal((prev) => (prev === dealId ? null : dealId));
  }

  async function handleFieldSave(dealId: string, fieldKey: string, newValue: string) {
    // Update local state optimistically
    setDealProps((prev) => ({
      ...prev,
      [dealId]: { ...prev[dealId], [fieldKey]: newValue || null },
    }));
    // Push to HubSpot
    try {
      await fetch("/api/hubspot/deals/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId, properties: { [fieldKey]: newValue } }),
      });
    } catch { /* revert could be added here */ }
  }

  return (
    <div className="space-y-2">
      {/* Existing linked deals */}
      {existingLinks.map((link) => (
        <div key={link.id}>
          {/* Deal pill */}
          <div className="inline-flex items-center gap-1.5 bg-orange-50 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full border border-orange-200">
            <Link2 className="h-3 w-3" />
            <button
              onClick={() => toggleDeal(link.hubspot_deal_id)}
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

          {/* Expandable deal details with inline editing */}
          {expandedDeal === link.hubspot_deal_id && (
            <div className="mt-2 ml-1 border border-gray-200 rounded-lg bg-white max-w-lg">
              {loadingDeal === link.hubspot_deal_id ? (
                <div className="p-4 flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading deal data...
                </div>
              ) : dealProps[link.hubspot_deal_id] ? (
                <div className="divide-y divide-gray-100">
                  {DEAL_FIELDS.map(({ key, label, format }) => {
                    const val = dealProps[link.hubspot_deal_id]?.[key];
                    if (!val && val !== "0" && !editableFields.has(key)) return null;
                    const isEditable = editableFields.has(key);
                    return (
                      <DealFieldRow
                        key={key}
                        fieldKey={key}
                        label={label}
                        value={val}
                        format={format}
                        editable={isEditable}
                        onSave={(newVal) => handleFieldSave(link.hubspot_deal_id, key, newVal)}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="p-4 text-xs text-gray-400">Failed to load deal data</p>
              )}
            </div>
          )}
        </div>
      ))}

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

// ─── Inline Editable Field Row ─────────────────────────

function DealFieldRow({
  fieldKey,
  label,
  value,
  format,
  editable,
  onSave,
}: {
  fieldKey: string;
  label: string;
  value: string | null;
  format?: "currency" | "percent" | "date";
  editable: boolean;
  onSave: (newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(rawValue(value));
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (!editable) return;
    setEditVal(rawValue(value));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function save() {
    setEditing(false);
    if (editVal !== rawValue(value)) {
      onSave(editVal);
    }
  }

  function cancel() {
    setEditing(false);
    setEditVal(rawValue(value));
  }

  return (
    <div className="flex items-center justify-between px-3 py-2 group hover:bg-gray-50/50">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0">{label}</span>
      {editing ? (
        <div className="flex items-center gap-1 flex-1 justify-end">
          <input
            ref={inputRef}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            onBlur={save}
            className="text-xs text-right border border-brand-green/40 rounded px-2 py-0.5 w-32 outline-none ring-1 ring-brand-green/20"
          />
        </div>
      ) : (
        <div
          className={`flex items-center gap-1 text-xs text-right ${editable ? "cursor-pointer" : ""}`}
          onClick={startEdit}
        >
          <span className={`font-medium ${value ? "text-gray-900" : "text-gray-300"}`}>
            {formatDisplay(value, format)}
          </span>
          {editable && (
            <Pencil className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      )}
    </div>
  );
}
