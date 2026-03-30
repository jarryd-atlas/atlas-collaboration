"use client";

import { cn } from "../../lib/utils";

interface WhitespaceMapProps {
  totalSites: number;
  engagedSites: number;
  activeSites: number;
  deployingSites: number;
  evaluatingSites: number;
  totalAddressable: number | null;
}

export function WhitespaceMap({ totalSites, activeSites, deployingSites, evaluatingSites, totalAddressable }: WhitespaceMapProps) {
  const addressable = totalAddressable ?? totalSites;
  const engaged = totalSites;
  const pct = addressable > 0 ? Math.round((engaged / addressable) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card">
      <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Whitespace</h3>
      <div className="flex items-end gap-3 mb-3">
        <span className="text-3xl font-bold text-gray-900">{engaged}</span>
        <span className="text-sm text-gray-400 mb-1">of {addressable} sites engaged</span>
        <span className="text-sm font-semibold text-brand-green mb-1 ml-auto">{pct}%</span>
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
      </div>
      <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Active ({activeSites})</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" />Deploying ({deployingSites})</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300" />Evaluating ({evaluatingSites})</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" />Untapped ({Math.max(0, addressable - engaged)})</span>
      </div>
    </div>
  );
}
