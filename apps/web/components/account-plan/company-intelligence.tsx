"use client";

import { useState } from "react";
import { updateCompanyIntelligence } from "../../lib/actions/account-plan";
import { Sparkles, RefreshCw, Building2, Target, Lightbulb, Heart, Compass, Rocket } from "lucide-react";

interface CompanyIntelligenceProps {
  customerId: string;
  tenantId: string;
  customerName: string;
  customerDomain: string | null;
  accountPlan: any | null;
  isCKInternal: boolean;
}

export function CompanyIntelligence({
  customerId,
  tenantId,
  customerName,
  customerDomain,
  accountPlan,
  isCKInternal,
}: CompanyIntelligenceProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasIntelligence = accountPlan?.intelligence_fetched_at;
  const fields = [
    { key: "company_mission", label: "Mission", icon: Target, value: accountPlan?.company_mission },
    { key: "company_vision", label: "Vision", icon: Compass, value: accountPlan?.company_vision },
    { key: "company_values", label: "Values", icon: Heart, value: accountPlan?.company_values },
    { key: "company_priorities", label: "Strategic Priorities", icon: Rocket, value: accountPlan?.company_priorities },
    { key: "industry_vertical", label: "Industry", icon: Building2, value: accountPlan?.industry_vertical },
    { key: "key_initiatives", label: "Key Initiatives", icon: Lightbulb, value: accountPlan?.key_initiatives },
  ];

  const populatedFields = fields.filter((f) => f.value);

  async function handleResearch() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/research-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, domain: customerDomain }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error: ${res.status}`);
      }

      const { intelligence } = await res.json();

      // Save to database
      await updateCompanyIntelligence(customerId, tenantId, {
        company_mission: intelligence.mission,
        company_vision: intelligence.vision,
        company_values: intelligence.values,
        company_priorities: intelligence.priorities,
        industry_vertical: intelligence.industry_vertical,
        key_initiatives: intelligence.key_initiatives,
      });
    } catch (err: any) {
      setError(err.message || "Failed to research company");
    } finally {
      setLoading(false);
    }
  }

  // Empty state — show research button
  if (!hasIntelligence && !loading) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center">
        <Building2 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500 mb-3">
          No company intelligence yet. Let AI research {customerName}&apos;s mission, values, and priorities.
        </p>
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        {isCKInternal && (
          <button
            onClick={handleResearch}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Research Company
          </button>
        )}
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="animate-spin">
            <Sparkles className="h-4 w-4 text-purple-500" />
          </div>
          <span className="text-sm font-medium text-gray-600">
            Researching {customerName}...
          </span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 w-20 bg-gray-200 rounded mb-1.5" />
              <div className="h-4 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Populated state
  return (
    <div className="border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-gray-400" />
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
            Company Intelligence
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {accountPlan?.intelligence_fetched_at && (
            <span className="text-[10px] text-gray-400">
              Updated {new Date(accountPlan.intelligence_fetched_at).toLocaleDateString()}
            </span>
          )}
          {isCKInternal && (
            <button
              onClick={handleResearch}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-purple-600 hover:bg-purple-50 rounded transition-colors"
              title="Refresh company intelligence"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {populatedFields.map((field, idx) => {
          const Icon = field.icon;
          return (
            <div
              key={field.key}
              className={`px-4 py-3 ${idx < populatedFields.length - (populatedFields.length % 2 === 0 ? 2 : 1) ? "border-b border-gray-50" : ""} ${idx % 2 === 0 ? "md:border-r md:border-gray-50" : ""}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3 w-3 text-gray-400" />
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                  {field.label}
                </span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{field.value}</p>
            </div>
          );
        })}
        {populatedFields.length === 0 && (
          <div className="col-span-2 px-4 py-6 text-center">
            <p className="text-xs text-gray-400">No information found. Try refreshing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
