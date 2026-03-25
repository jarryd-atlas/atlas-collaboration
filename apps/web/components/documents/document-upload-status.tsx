"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Receipt, Camera, Thermometer, ClipboardList,
  FileDigit, Gauge, Zap, ImagePlus, CheckCircle, Circle, ArrowRight,
} from "lucide-react";
import { fetchAttachments } from "../../lib/actions";
import type { EntityType } from "@repo/supabase";

const SITE_CATEGORIES = [
  { key: "interval-data", label: "Interval Data", icon: BarChart3, color: "text-blue-600" },
  { key: "utility-bills", label: "Utility Bills", icon: Receipt, color: "text-emerald-600" },
  { key: "compressor-photos", label: "Compressor Photos", icon: Camera, color: "text-amber-600" },
  { key: "refrigeration-photos", label: "Control Panel Photos", icon: Thermometer, color: "text-red-600" },
  { key: "round-sheets", label: "Round Sheets / Logs", icon: ClipboardList, color: "text-purple-600" },
  { key: "p-and-id", label: "P&ID", icon: FileDigit, color: "text-cyan-600" },
  { key: "mass-balance", label: "Mass Balance", icon: Gauge, color: "text-orange-600" },
  { key: "electrical-drawings", label: "Electrical Drawings", icon: Zap, color: "text-yellow-600" },
  { key: "additional-photos", label: "Additional Photos", icon: ImagePlus, color: "text-teal-600" },
] as const;

interface DocumentUploadStatusProps {
  entityId: string;
  tenantId: string;
  documentsTabUrl: string;
}

export function DocumentUploadStatus({ entityId, tenantId, documentsTabUrl }: DocumentUploadStatusProps) {
  const router = useRouter();
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [totalDocs, setTotalDocs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchAttachments("site" as EntityType, entityId);
        const docs = result.attachments ?? [];
        const counts: Record<string, number> = {};
        for (const doc of docs) {
          const cat = (doc as any).category ?? "uncategorized";
          counts[cat] = (counts[cat] ?? 0) + 1;
        }
        setCategoryCounts(counts);
        setTotalDocs(docs.length);
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [entityId]);

  const filledCategories = SITE_CATEGORIES.filter((c) => (categoryCounts[c.key] ?? 0) > 0).length;
  const progressPct = Math.round((filledCategories / SITE_CATEGORIES.length) * 100);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalDocs} file{totalDocs !== 1 ? "s" : ""} uploaded &middot; {filledCategories} of {SITE_CATEGORIES.length} categories
          </p>
        </div>
        <button
          onClick={() => router.push(documentsTabUrl)}
          className="text-xs font-medium text-brand-green hover:text-green-700 flex items-center gap-1 transition-colors"
        >
          View All <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {loading ? (
        <div className="px-6 py-6 text-center text-xs text-gray-400">Loading...</div>
      ) : (
        <div className="px-6 py-4">
          {/* Progress bar */}
          <div className="mb-4">
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-green rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Category grid */}
          <div className="grid grid-cols-3 gap-2">
            {SITE_CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.key] ?? 0;
              const Icon = cat.icon;
              const hasDocs = count > 0;

              return (
                <div
                  key={cat.key}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${
                    hasDocs ? "bg-green-50/50" : "bg-gray-50/50"
                  }`}
                >
                  {hasDocs ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className={`text-[11px] font-medium truncate block ${hasDocs ? "text-gray-700" : "text-gray-400"}`}>
                      {cat.label}
                    </span>
                    {hasDocs && (
                      <span className="text-[10px] text-gray-400">{count} file{count !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
