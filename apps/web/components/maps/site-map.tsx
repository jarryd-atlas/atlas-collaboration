"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  APIProvider,
  Map as GoogleMap,
  InfoWindow,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import type { Marker } from "@googlemaps/markerclusterer";
import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  STAGE_COLORS,
  STAGE_LABELS,
  getCustomerColor,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  CLUSTER_SIZES,
} from "./map-constants";

// ─── Types ─────────────────────────────────────────────────

export interface SiteMarkerData {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pipeline_stage: string;
  latitude: number;
  longitude: number;
  isHQ?: boolean;
  customer_slug?: string;
  customer?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface SiteMapProps {
  sites: SiteMarkerData[];
  /** Show customer name in markers (for portfolio view) */
  showCustomer?: boolean;
  /** Height of the map container */
  height?: string;
  /** Optional customer slug for single-customer view (used for site links) */
  customerSlug?: string;
}

// ─── Cluster renderer ────────────────────────────────────

function getDominantStageColor(markers: Marker[], siteMap: globalThis.Map<Marker, SiteMarkerData>): string {
  const stageCounts: Record<string, number> = {};
  markers.forEach((m) => {
    const site = siteMap.get(m);
    if (site) {
      stageCounts[site.pipeline_stage] = (stageCounts[site.pipeline_stage] || 0) + 1;
    }
  });
  let dominant = "active";
  let max = 0;
  for (const [stage, count] of Object.entries(stageCounts)) {
    if (count > max) {
      max = count;
      dominant = stage;
    }
  }
  return STAGE_COLORS[dominant] ?? "#6B7280";
}

// ─── Map content (needs to be inside APIProvider) ──────────

function MapContent({
  sites,
  showCustomer,
  customerSlug,
  selectedStages,
  selectedCustomers,
  searchQuery,
  onSelectSite,
  selectedSite,
  onClearSelectedSite,
}: {
  sites: SiteMarkerData[];
  showCustomer: boolean;
  customerSlug?: string;
  selectedStages: Set<string>;
  selectedCustomers: Set<string>;
  searchQuery: string;
  onSelectSite: (site: SiteMarkerData) => void;
  selectedSite: SiteMarkerData | null;
  onClearSelectedSite: () => void;
}) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const siteByMarkerRef = useRef<globalThis.Map<Marker, SiteMarkerData>>(new globalThis.Map());
  const prevFilterKeyRef = useRef<string>("");

  const filteredSites = useMemo(() => {
    let result = sites;
    if (selectedStages.size > 0) {
      result = result.filter((s) => selectedStages.has(s.pipeline_stage));
    }
    if (selectedCustomers.size > 0) {
      result = result.filter(
        (s) => s.customer && selectedCustomers.has(s.customer.id)
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.address && s.address.toLowerCase().includes(q)) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.state && s.state.toLowerCase().includes(q)) ||
          (s.customer && s.customer.name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [sites, selectedStages, selectedCustomers, searchQuery]);

  // Initialize clusterer
  useEffect(() => {
    if (!map || !markerLib) return;

    const siteMarkerMap = siteByMarkerRef.current;
    clustererRef.current = new MarkerClusterer({
      map,
      renderer: {
        render({ count, position, markers }) {
          const color = markers
            ? getDominantStageColor(markers as Marker[], siteMarkerMap)
            : "#6B7280";
          const size =
            count < CLUSTER_SIZES.small.threshold
              ? CLUSTER_SIZES.small.size
              : count < CLUSTER_SIZES.medium.threshold
                ? CLUSTER_SIZES.medium.size
                : CLUSTER_SIZES.large.size;

          const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
              <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" fill-opacity="0.85" stroke="white" stroke-width="2.5"/>
              <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="${size < 40 ? 12 : 14}" font-weight="600" font-family="system-ui, sans-serif">${count}</text>
            </svg>
          `;

          const el = document.createElement("div");
          el.innerHTML = svg;
          el.style.cursor = "pointer";
          el.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.25))";

          return new markerLib.AdvancedMarkerElement({
            position,
            content: el,
            zIndex: 1000 + count,
          });
        },
      },
    });

    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
    };
  }, [map, markerLib]);

  // Sync markers with clusterer when filteredSites changes
  useEffect(() => {
    if (!clustererRef.current || !map || !markerLib) return;

    const clusterer = clustererRef.current;
    const currentMarkers = markersRef.current;
    const siteMarkerMap = siteByMarkerRef.current;

    // Clear old mappings
    clusterer.clearMarkers();
    siteMarkerMap.clear();

    const newMarkerMap = new globalThis.Map<string, Marker>();
    const markersToAdd: Marker[] = [];

    filteredSites.forEach((site) => {
      // Reuse existing marker element if available
      let marker = currentMarkers.get(site.id);
      if (!marker) {
        const stageColor = STAGE_COLORS[site.pipeline_stage] ?? "#6B7280";
        const customerColor =
          showCustomer && site.customer
            ? getCustomerColor(site.customer.id)
            : undefined;

        const el = document.createElement("div");
        el.className = "atlas-marker";

        if (site.isHQ) {
          // HQ marker: square with building icon
          el.style.cssText = `
            width: 30px; height: 30px; border-radius: 6px; cursor: pointer;
            background-color: #222222;
            border: 2.5px solid ${customerColor ?? "white"};
            box-shadow: 0 0 0 1.5px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.4);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            display: flex; align-items: center; justify-content: center;
          `;
          el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`;
        } else {
          // Regular site marker: circle
          el.style.cssText = `
            width: 24px; height: 24px; border-radius: 50%; cursor: pointer;
            background-color: ${stageColor};
            border: ${customerColor ? `3.5px solid ${customerColor}` : "2.5px solid white"};
            box-shadow: 0 0 0 1.5px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.35);
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          `;
        }

        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.4)";
          el.style.boxShadow = "0 0 0 2px rgba(0,0,0,0.35), 0 3px 10px rgba(0,0,0,0.4)";
        });
        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1)";
          el.style.boxShadow = site.isHQ
            ? "0 0 0 1.5px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.4)"
            : "0 0 0 1.5px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.35)";
        });

        marker = new markerLib.AdvancedMarkerElement({
          position: { lat: site.latitude, lng: site.longitude },
          content: el,
          zIndex: site.isHQ ? 2000 : undefined,
          gmpClickable: true,
        }) as unknown as Marker;

        marker.addListener("click", () => {
          onSelectSite(site);
        });
      }

      newMarkerMap.set(site.id, marker);
      siteMarkerMap.set(marker, site);
      markersToAdd.push(marker);
    });

    markersRef.current = newMarkerMap;
    clusterer.addMarkers(markersToAdd);
  }, [filteredSites, map, markerLib, showCustomer, onSelectSite]);

  // Fit bounds when filters/search change
  useEffect(() => {
    if (!map || filteredSites.length === 0) return;

    // Build a key from filter state to detect actual filter changes
    const filterKey = `${Array.from(selectedStages).sort().join(",")}|${Array.from(selectedCustomers).sort().join(",")}|${searchQuery}`;
    const isInitialLoad = prevFilterKeyRef.current === "";
    const filterChanged = filterKey !== prevFilterKeyRef.current;
    prevFilterKeyRef.current = filterKey;

    if (!isInitialLoad && !filterChanged) return;

    if (filteredSites.length === 1) {
      const first = filteredSites[0]!;
      map.setCenter({ lat: first.latitude, lng: first.longitude });
      map.setZoom(12);
      return;
    }

    const gMaps = (window as any).google?.maps;
    if (!gMaps) return;
    const bounds = new gMaps.LatLngBounds();
    filteredSites.forEach((s) =>
      bounds.extend({ lat: s.latitude, lng: s.longitude })
    );
    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [map, filteredSites, selectedStages, selectedCustomers, searchQuery]);

  return (
    <>
      {selectedSite && (
        <InfoWindow
          position={{
            lat: selectedSite.latitude,
            lng: selectedSite.longitude,
          }}
          onCloseClick={onClearSelectedSite}
          pixelOffset={[0, -16]}
          headerDisabled
        >
          <div className="min-w-[240px] max-w-[300px] font-sans overflow-hidden">
            {/* Colored header bar with close button */}
            <div
              className="flex items-center justify-between px-3 py-2"
              style={{
                backgroundColor: STAGE_COLORS[selectedSite.pipeline_stage] ?? "#6B7280",
              }}
            >
              <span className="text-[11px] font-semibold text-white uppercase tracking-wide">
                {selectedSite.isHQ ? "Headquarters" : (STAGE_LABELS[selectedSite.pipeline_stage] ?? selectedSite.pipeline_stage)}
              </span>
              <button
                onClick={onClearSelectedSite}
                className="p-0.5 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="px-3 py-2.5 space-y-2">
              <div>
                {selectedSite.isHQ ? (
                  <Link
                    href={`/customers/${selectedSite.customer?.slug ?? ""}`}
                    className="text-sm font-semibold text-gray-900 hover:text-[#222222] hover:underline leading-tight"
                  >
                    {selectedSite.name}
                  </Link>
                ) : (
                  <Link
                    href={`/customers/${customerSlug ?? selectedSite.customer?.slug ?? ""}/sites/${selectedSite.slug}`}
                    className="text-sm font-semibold text-gray-900 hover:text-[#222222] hover:underline leading-tight"
                  >
                    {selectedSite.name}
                  </Link>
                )}

                {showCustomer && selectedSite.customer && !selectedSite.isHQ && (
                  <Link
                    href={`/customers/${selectedSite.customer.slug}`}
                    className="flex items-center gap-1.5 mt-1"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border-[1.5px]"
                      style={{
                        borderColor: getCustomerColor(selectedSite.customer.id),
                        backgroundColor: "white",
                      }}
                    />
                    <span className="text-xs text-gray-500 hover:text-gray-700">
                      {selectedSite.customer.name}
                    </span>
                  </Link>
                )}
              </div>

              {(selectedSite.address || selectedSite.city) && (
                <div className="flex items-start gap-1.5 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>
                    {[selectedSite.address, selectedSite.city, selectedSite.state]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              )}

              {/* Action button */}
              <Link
                href={selectedSite.isHQ
                  ? `/customers/${selectedSite.customer?.slug ?? ""}`
                  : `/customers/${customerSlug ?? selectedSite.customer?.slug ?? ""}/sites/${selectedSite.slug}`
                }
                className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {selectedSite.isHQ ? "View company" : "View site details"}
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

// ─── Search Bar ──────────────────────────────────────────

function MapSearchBar({
  sites,
  searchQuery,
  onSearchChange,
  onSelectSite,
}: {
  sites: SiteMarkerData[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectSite: (site: SiteMarkerData) => void;
}) {
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return sites
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.address && s.address.toLowerCase().includes(q)) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.state && s.state.toLowerCase().includes(q)) ||
          (s.customer && s.customer.name.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [sites, searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-72"
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search sites, addresses..."
          className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-[#91E100]/50 focus:border-[#91E100]"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {focused && suggestions.length > 0 && (
        <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {suggestions.map((site) => (
            <button
              key={site.id}
              onClick={() => {
                onSelectSite(site);
                setFocused(false);
              }}
              className="flex items-start gap-2 w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
            >
              <span
                className={`mt-1 w-2.5 h-2.5 shrink-0 ${site.isHQ ? "rounded-sm" : "rounded-full"}`}
                style={{
                  backgroundColor:
                    STAGE_COLORS[site.pipeline_stage] ?? "#6B7280",
                }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {site.name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {[
                    site.isHQ ? "HQ" : site.customer?.name,
                    site.address,
                    site.city,
                    site.state,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Legend ────────────────────────────────────────────────

function MapLegend({
  sites,
  filteredCount,
  showCustomer,
  selectedStages,
  onToggleStage,
  selectedCustomers,
  onToggleCustomer,
  onClearFilters,
}: {
  sites: SiteMarkerData[];
  filteredCount: number;
  showCustomer: boolean;
  selectedStages: Set<string>;
  onToggleStage: (stage: string) => void;
  selectedCustomers: Set<string>;
  onToggleCustomer: (customerId: string) => void;
  onClearFilters: () => void;
}) {
  const hasActiveFilters = selectedStages.size > 0 || selectedCustomers.size > 0;

  // Stage data with counts
  const stageData = useMemo(() => {
    const counts: Record<string, number> = {};
    sites.forEach((s) => {
      counts[s.pipeline_stage] = (counts[s.pipeline_stage] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count);
  }, [sites]);

  // Customer data with counts
  const customerData = useMemo(() => {
    if (!showCustomer) return [];
    const map: Record<string, { id: string; name: string; count: number }> = {};
    sites.forEach((s) => {
      if (s.customer) {
        if (!map[s.customer.id]) {
          map[s.customer.id] = { id: s.customer.id, name: s.customer.name, count: 0 };
        }
        map[s.customer.id]!.count++;
      }
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [sites, showCustomer]);

  const [expanded, setExpanded] = useState(true);

  return (
    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 max-h-[70vh] overflow-y-auto z-10 min-w-[180px]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between gap-2 w-full px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      >
        <span>{expanded ? "Hide" : "Show"} Legend</span>
        <span className="text-[10px] font-normal text-gray-400">
          {filteredCount !== sites.length
            ? `${filteredCount} / ${sites.length}`
            : `${sites.length} sites`}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Clear filters button */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="w-full text-xs text-gray-500 hover:text-gray-700 py-1 px-2 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              Clear all filters
            </button>
          )}

          {/* Stage legend */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Pipeline Stage
            </p>
            <div className="space-y-0.5">
              {stageData.map(({ stage, count }) => {
                const isActive =
                  selectedStages.size === 0 || selectedStages.has(stage);
                return (
                  <button
                    key={stage}
                    onClick={() => onToggleStage(stage)}
                    className={`flex items-center justify-between gap-2 w-full text-left px-1 py-0.5 rounded transition-opacity ${
                      isActive ? "opacity-100" : "opacity-30"
                    } hover:bg-gray-50`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor: STAGE_COLORS[stage] ?? "#6B7280",
                        }}
                      />
                      <span className="text-xs text-gray-700">
                        {STAGE_LABELS[stage] ?? stage}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer legend */}
          {customerData.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Customer
              </p>
              <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                {customerData.map((cust) => {
                  const isActive =
                    selectedCustomers.size === 0 ||
                    selectedCustomers.has(cust.id);
                  return (
                    <button
                      key={cust.id}
                      onClick={() => onToggleCustomer(cust.id)}
                      className={`flex items-center justify-between gap-2 w-full text-left px-1 py-0.5 rounded transition-opacity ${
                        isActive ? "opacity-100" : "opacity-30"
                      } hover:bg-gray-50`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0 border-2"
                          style={{
                            borderColor: getCustomerColor(cust.id),
                            backgroundColor: "white",
                          }}
                        />
                        <span className="text-xs text-gray-700 truncate">
                          {cust.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
                        {cust.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────

export function SiteMap({
  sites,
  showCustomer = false,
  height = "100%",
  customerSlug,
}: SiteMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";
  const [selectedStages, setSelectedStages] = useState<Set<string>>(new Set());
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(
    new Set()
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSite, setSelectedSite] = useState<SiteMarkerData | null>(null);

  const handleToggleStage = useCallback((stage: string) => {
    setSelectedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }, []);

  const handleToggleCustomer = useCallback((customerId: string) => {
    setSelectedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedStages(new Set());
    setSelectedCustomers(new Set());
    setSearchQuery("");
  }, []);

  const handleSelectSite = useCallback((site: SiteMarkerData) => {
    setSelectedSite(site);
  }, []);

  const handleClearSelectedSite = useCallback(() => {
    setSelectedSite(null);
  }, []);

  // Compute filtered count for the badge
  const filteredCount = useMemo(() => {
    let result = sites;
    if (selectedStages.size > 0) {
      result = result.filter((s) => selectedStages.has(s.pipeline_stage));
    }
    if (selectedCustomers.size > 0) {
      result = result.filter(
        (s) => s.customer && selectedCustomers.has(s.customer.id)
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.address && s.address.toLowerCase().includes(q)) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.state && s.state.toLowerCase().includes(q)) ||
          (s.customer && s.customer.name.toLowerCase().includes(q))
      );
    }
    return result.length;
  }, [sites, selectedStages, selectedCustomers, searchQuery]);

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        Google Maps API key not configured
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-500">
        No sites with location data to display
      </div>
    );
  }

  return (
    <div className="relative" style={{ height }}>
      <APIProvider apiKey={apiKey}>
        <GoogleMap
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId="atlas-site-map"
          style={{ width: "100%", height: "100%" }}
        >
          <MapContent
            sites={sites}
            showCustomer={showCustomer}
            customerSlug={customerSlug}
            selectedStages={selectedStages}
            selectedCustomers={selectedCustomers}
            searchQuery={searchQuery}
            onSelectSite={handleSelectSite}
            selectedSite={selectedSite}
            onClearSelectedSite={handleClearSelectedSite}
          />
        </GoogleMap>
      </APIProvider>

      {/* Search bar */}
      <MapSearchBar
        sites={sites}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSelectSite={handleSelectSite}
      />

      {/* Legend */}
      <MapLegend
        sites={sites}
        filteredCount={filteredCount}
        showCustomer={showCustomer}
        selectedStages={selectedStages}
        onToggleStage={handleToggleStage}
        selectedCustomers={selectedCustomers}
        onToggleCustomer={handleToggleCustomer}
        onClearFilters={handleClearFilters}
      />
    </div>
  );
}
