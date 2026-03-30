"use client";

import { DollarSign, BarChart3 } from "lucide-react";

interface DealLink {
  id: string;
  site_id: string;
  deal_name: string;
  deal_type: string;
}

interface SiteDealsSummaryProps {
  dealLinks: DealLink[];
}

export function SiteDealsSummary({ dealLinks }: SiteDealsSummaryProps) {
  const newBiz = dealLinks.filter((d) => d.deal_type === "new_business");
  const renewals = dealLinks.filter((d) => d.deal_type === "renewal");

  if (dealLinks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card">
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">Site Deals</h3>
        <p className="text-xs text-gray-400">No HubSpot deals linked to sites yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card">
      <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3">Site Deals</h3>
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{dealLinks.length}</p>
          <p className="text-[10px] text-gray-400 uppercase">Total</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{newBiz.length}</p>
          <p className="text-[10px] text-gray-400 uppercase">New Biz</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">{renewals.length}</p>
          <p className="text-[10px] text-gray-400 uppercase">Renewals</p>
        </div>
      </div>
    </div>
  );
}
