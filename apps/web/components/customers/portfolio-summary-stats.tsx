"use client";

import { Building2, DollarSign, Rocket, TrendingUp, Crown } from "lucide-react";
import type { CustomerListItem } from "../../lib/data/queries";
import { formatCurrency } from "../../lib/format";

interface PortfolioSummaryStatsProps {
  customers: CustomerListItem[];
}

export function PortfolioSummaryStats({ customers }: PortfolioSummaryStatsProps) {
  const totalCompanies = customers.length;

  const pipelineValue = customers.reduce((sum, c) => {
    if (c.target_value && c.deal_stage !== "closed_lost") return sum + c.target_value;
    return sum;
  }, 0);

  const pilotCount = customers.filter((c) => c.account_stage === "pilot").length;
  const expandingCount = customers.filter((c) => c.account_stage === "expanding").length;
  const enterpriseCount = customers.filter((c) => c.account_stage === "enterprise").length;

  const stats = [
    {
      label: "Companies",
      value: totalCompanies.toString(),
      icon: Building2,
      color: "text-gray-600",
      bg: "bg-gray-50",
    },
    {
      label: "Deal Pipeline",
      value: formatCurrency(pipelineValue > 0 ? pipelineValue : null),
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Pilot",
      value: pilotCount.toString(),
      icon: Rocket,
      color: "text-gray-500",
      bg: "bg-gray-50",
    },
    {
      label: "Expanding",
      value: expandingCount.toString(),
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Enterprise",
      value: enterpriseCount.toString(),
      icon: Crown,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
          >
            <div className={`${stat.bg} rounded-lg p-2`}>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{stat.value}</p>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
