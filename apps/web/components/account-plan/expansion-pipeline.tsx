"use client";

import { MapPinned, AlertCircle, ArrowRight } from "lucide-react";
import { PipelineStageBadge } from "../ui/badge";

interface Site {
  id?: string;
  slug: string;
  name: string;
  pipeline_stage: string;
  next_step?: string | null;
  dq_reason?: string | null;
  dq_reeval_date?: string | null;
  [key: string]: unknown;
}

interface DealLink {
  site_id: string;
  deal_name: string;
  deal_type: string;
}

interface ExpansionPipelineProps {
  sites: Site[];
  dealLinks: DealLink[];
  totalAddressable: number | null;
}

const STAGE_ORDER: Record<string, number> = {
  deployment: 0,
  contracted: 1,
  qualified: 2,
  evaluation: 3,
  prospect: 4,
  disqualified: 5,
  paused: 6,
  whitespace: 7,
};

export function ExpansionPipeline({ sites, dealLinks, totalAddressable }: ExpansionPipelineProps) {
  // Filter to non-active sites (the expansion targets)
  const expansionSites = sites
    .filter((s) => s.pipeline_stage !== "active")
    .sort((a, b) => (STAGE_ORDER[a.pipeline_stage] ?? 99) - (STAGE_ORDER[b.pipeline_stage] ?? 99));

  const whitespaceGap = totalAddressable
    ? Math.max(0, totalAddressable - sites.length)
    : 0;

  if (expansionSites.length === 0 && whitespaceGap === 0) {
    return null;
  }

  // Build deal lookup by site_id
  const dealsBySite = new Map<string, DealLink[]>();
  for (const d of dealLinks) {
    if (!dealsBySite.has(d.site_id)) dealsBySite.set(d.site_id, []);
    dealsBySite.get(d.site_id)!.push(d);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <MapPinned className="h-3.5 w-3.5 text-gray-400" />
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
            Expansion Pipeline
          </h4>
          <span className="text-[10px] text-gray-400">
            {expansionSites.length} site{expansionSites.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {expansionSites.length > 0 && (
        <div className="divide-y divide-gray-50">
          {expansionSites.map((site) => {
            const siteDeals = dealsBySite.get(site.id ?? "") || [];
            const isDQ = site.pipeline_stage === "disqualified";

            return (
              <div
                key={site.id ?? site.slug}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50/50 transition-colors"
              >
                {/* Site name */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{site.name}</span>
                    <PipelineStageBadge stage={site.pipeline_stage} />
                  </div>

                  {/* DQ info */}
                  {isDQ && site.dq_reason && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <AlertCircle className="h-3 w-3 text-red-400 shrink-0" />
                      <span className="text-[11px] text-red-500 truncate">{site.dq_reason}</span>
                      {site.dq_reeval_date && (
                        <span className="text-[10px] text-gray-400 ml-1 shrink-0">
                          Re-eval: {new Date(site.dq_reeval_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Next step */}
                  {!isDQ && site.next_step && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <ArrowRight className="h-3 w-3 text-gray-300 shrink-0" />
                      <span className="text-[11px] text-gray-500 truncate">{site.next_step}</span>
                    </div>
                  )}
                </div>

                {/* Linked deals */}
                {siteDeals.length > 0 && (
                  <div className="shrink-0 text-right">
                    {siteDeals.map((d) => (
                      <div key={d.deal_name} className="text-[10px] text-gray-400">
                        <span className={d.deal_type === "new_business" ? "text-blue-500" : "text-green-500"}>
                          {d.deal_type === "new_business" ? "New" : "Renewal"}
                        </span>
                        {" · "}
                        <span className="text-gray-500">{d.deal_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Whitespace gap */}
      {whitespaceGap > 0 && (
        <div className="px-4 py-2.5 bg-gray-50/50 border-t border-gray-50">
          <span className="text-[11px] text-gray-400">
            + {whitespaceGap} additional site{whitespaceGap !== 1 ? "s" : ""} in total addressable market not yet in pipeline
          </span>
        </div>
      )}
    </div>
  );
}
