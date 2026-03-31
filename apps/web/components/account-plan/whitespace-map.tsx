"use client";

import { cn } from "../../lib/utils";

interface WhitespaceMapProps {
  totalSites: number;
  activeSites: number;
  deployingSites: number;
  evaluatingSites: number;
  prospectSites: number;
  totalAddressable: number | null;
}

export function WhitespaceMap({ totalSites, activeSites, deployingSites, evaluatingSites, prospectSites, totalAddressable }: WhitespaceMapProps) {
  const addressable = totalAddressable ?? totalSites;
  // "Engaged" = actively working with the customer (excludes prospect)
  const engaged = activeSites + deployingSites + evaluatingSites;
  const engagedPct = addressable > 0 ? Math.round((engaged / addressable) * 100) : 0;
  const untapped = Math.max(0, addressable - engaged - prospectSites);

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card">
      <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Whitespace</h3>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-2xl font-bold text-gray-900">{engaged}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Engaged</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-gray-400">{prospectSites}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Prospect</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-brand-green">{engagedPct}%</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">of {addressable} sites</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
        {activeSites > 0 && (
          <div className="bg-green-500 h-full" style={{ width: `${(activeSites / addressable) * 100}%` }} title={`${activeSites} active`} />
        )}
        {deployingSites > 0 && (
          <div className="bg-blue-400 h-full" style={{ width: `${(deployingSites / addressable) * 100}%` }} title={`${deployingSites} deploying`} />
        )}
        {evaluatingSites > 0 && (
          <div className="bg-amber-300 h-full" style={{ width: `${(evaluatingSites / addressable) * 100}%` }} title={`${evaluatingSites} evaluating`} />
        )}
        {prospectSites > 0 && (
          <div className="bg-gray-300 h-full" style={{ width: `${(prospectSites / addressable) * 100}%` }} title={`${prospectSites} prospect`} />
        )}
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Active ({activeSites})</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />Deploying ({deployingSites})</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300" />Evaluating ({evaluatingSites})</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" />Prospect ({prospectSites})</span>
        {untapped > 0 && (
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-100 border border-gray-200" />Untapped ({untapped})</span>
        )}
      </div>
    </div>
  );
}
