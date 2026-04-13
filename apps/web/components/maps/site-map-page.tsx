"use client";

import dynamic from "next/dynamic";
import type { SiteMarkerData } from "./site-map";
import { MapPin } from "lucide-react";

const SiteMap = dynamic(() => import("./site-map").then((m) => m.SiteMap), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">
      Loading map...
    </div>
  ),
});

interface SiteMapPageClientProps {
  sites: SiteMarkerData[];
}

export function SiteMapPageClient({ sites }: SiteMapPageClientProps) {
  return (
    <div
      className="-mx-6 -mt-6 -mb-6 flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 4rem)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-gray-600" />
          <h1 className="text-lg font-semibold text-gray-900">Site Map</h1>
          <span className="text-sm text-gray-500">
            — All sites across customers
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0">
        <SiteMap sites={sites} showCustomer height="100%" />
      </div>
    </div>
  );
}
