"use client";

import { Trophy, CheckCircle, TrendingUp } from "lucide-react";

interface Site {
  name: string;
  pipeline_stage: string;
  [key: string]: unknown;
}

interface Milestone {
  title: string;
  completed_date: string | null;
  status: string;
}

interface DealLink {
  deal_type: string;
  deal_name: string;
}

interface WinEvidenceProps {
  sites: Site[];
  milestones: Milestone[];
  dealLinks: DealLink[];
}

export function WinEvidence({ sites, milestones, dealLinks }: WinEvidenceProps) {
  const activeSites = sites.filter((s) => s.pipeline_stage === "active");
  const completedMilestones = milestones.filter((m) => m.status === "completed");
  const newBizDeals = dealLinks.filter((d) => d.deal_type === "new_business");
  const renewalDeals = dealLinks.filter((d) => d.deal_type === "renewal");

  // Nothing to show if no wins
  if (activeSites.length === 0 && completedMilestones.length === 0 && dealLinks.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50">
        <Trophy className="h-3.5 w-3.5 text-gray-400" />
        <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
          Win Evidence
        </h4>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-50">
        {/* Active sites */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle className="h-3 w-3 text-green-500" />
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Active Sites ({activeSites.length})
            </span>
          </div>
          {activeSites.length > 0 ? (
            <ul className="space-y-1">
              {activeSites.slice(0, 8).map((s) => (
                <li key={s.name} className="text-sm text-gray-700 truncate">
                  {s.name}
                </li>
              ))}
              {activeSites.length > 8 && (
                <li className="text-[11px] text-gray-400">
                  +{activeSites.length - 8} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-gray-300 italic">No active sites yet</p>
          )}
        </div>

        {/* Completed milestones */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <CheckCircle className="h-3 w-3 text-blue-500" />
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Proof Points ({completedMilestones.length})
            </span>
          </div>
          {completedMilestones.length > 0 ? (
            <ul className="space-y-1">
              {completedMilestones.slice(0, 6).map((m) => (
                <li key={m.title} className="text-sm text-gray-700 flex items-start gap-1.5">
                  <CheckCircle className="h-3 w-3 text-green-400 shrink-0 mt-0.5" />
                  <span className="truncate">{m.title}</span>
                </li>
              ))}
              {completedMilestones.length > 6 && (
                <li className="text-[11px] text-gray-400 ml-4">
                  +{completedMilestones.length - 6} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-gray-300 italic">No milestones completed yet</p>
          )}
        </div>

        {/* Deal summary */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3 w-3 text-purple-500" />
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Deals ({dealLinks.length})
            </span>
          </div>
          {dealLinks.length > 0 ? (
            <div className="space-y-2">
              {newBizDeals.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-blue-500 uppercase">
                    New Business ({newBizDeals.length})
                  </span>
                  <ul className="mt-0.5 space-y-0.5">
                    {newBizDeals.slice(0, 4).map((d) => (
                      <li key={d.deal_name} className="text-sm text-gray-600 truncate">{d.deal_name}</li>
                    ))}
                    {newBizDeals.length > 4 && (
                      <li className="text-[11px] text-gray-400">+{newBizDeals.length - 4} more</li>
                    )}
                  </ul>
                </div>
              )}
              {renewalDeals.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-green-500 uppercase">
                    Renewals ({renewalDeals.length})
                  </span>
                  <ul className="mt-0.5 space-y-0.5">
                    {renewalDeals.slice(0, 4).map((d) => (
                      <li key={d.deal_name} className="text-sm text-gray-600 truncate">{d.deal_name}</li>
                    ))}
                    {renewalDeals.length > 4 && (
                      <li className="text-[11px] text-gray-400">+{renewalDeals.length - 4} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-300 italic">No linked deals</p>
          )}
        </div>
      </div>
    </div>
  );
}
