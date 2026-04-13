"use client";

import { useState, useMemo, useCallback } from "react";
import { TrendingUp, DollarSign, BarChart3, ChevronDown, ChevronUp, ArrowUpDown, Pencil, Check, X, Activity, Clock, Zap, Target } from "lucide-react";
import { formatCurrency } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import type { ForecastDeal, ClosedDeal, TimePeriod } from "../../../lib/data/forecast-queries";

// ─── Types ────────────────────────────────────────────────

interface SerializedPeriod {
  key: TimePeriod;
  label: string;
  sublabel: string;
  periodKey: string | null;
  start: string;
  end: string;
}

interface Props {
  deals: ForecastDeal[];
  closedDeals: ClosedDeal[];
  targets: Record<string, number>;
  periods: SerializedPeriod[];
}

type DealTypeFilter = "all" | "new_business" | "renewal";
type BucketKey = "commit" | "bestCase" | "pipeline";
type SortField = "customerName" | "dealName" | "amount" | "arr" | "stage" | "closeDate" | "forecastCategory";
type SortDir = "asc" | "desc";

// ─── Constants ────────────────────────────────────────────

const FORECAST_WEIGHTS: Record<string, number> = {
  commit: 0.9,
  most_likely: 0.7,
  best_case: 0.4,
  pipeline: 0.15,
};

const FORECAST_CATEGORY_LABELS: Record<string, string> = {
  commit: "Commit",
  most_likely: "Most Likely",
  best_case: "Best Case",
  pipeline: "Pipeline",
};

// ─── Bucket Computation ───────────────────────────────────

function computeBuckets(deals: ForecastDeal[]) {
  const commitDeals = deals.filter((d) => d.forecastCategory === "commit");
  const mostLikelyDeals = deals.filter((d) => d.forecastCategory === "most_likely");
  const bestCaseDeals = deals.filter((d) => d.forecastCategory === "best_case");
  const pipelineDeals = deals.filter((d) => d.forecastCategory === "pipeline");

  const commitTotal = sumAmount(commitDeals);
  const bestCaseTotal = commitTotal + sumAmount(mostLikelyDeals);
  const pipelineTotal = bestCaseTotal + sumAmount(bestCaseDeals) + sumAmount(pipelineDeals);

  return {
    commit: { deals: commitDeals, total: commitTotal, count: commitDeals.length },
    bestCase: {
      deals: [...commitDeals, ...mostLikelyDeals],
      total: bestCaseTotal,
      count: commitDeals.length + mostLikelyDeals.length,
    },
    pipeline: {
      deals: [...commitDeals, ...mostLikelyDeals, ...bestCaseDeals, ...pipelineDeals],
      total: pipelineTotal,
      count: commitDeals.length + mostLikelyDeals.length + bestCaseDeals.length + pipelineDeals.length,
    },
  };
}

function sumAmount(deals: ForecastDeal[]): number {
  return deals.reduce((s, d) => s + d.amount, 0);
}

function filterByPeriod(deals: ForecastDeal[], period: SerializedPeriod): ForecastDeal[] {
  const start = new Date(period.start);
  const end = new Date(period.end);
  return deals.filter((d) => {
    if (!d.closeDate) return false;
    const close = new Date(d.closeDate);
    return close >= start && close <= end;
  });
}

function filterByType(deals: ForecastDeal[], type: DealTypeFilter): ForecastDeal[] {
  if (type === "all") return deals;
  return deals.filter((d) => d.dealType === type);
}

function filterClosedByType(deals: ClosedDeal[], type: DealTypeFilter): ClosedDeal[] {
  if (type === "all") return deals;
  return deals.filter((d) => d.dealType === type);
}

// ─── CRO Metric Calculations ─────────────────────────────

function computeWinRate(closedDeals: ClosedDeal[], trailingDays: number): number | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - trailingDays);

  const recent = closedDeals.filter((d) => {
    if (!d.closeDate) return false;
    return new Date(d.closeDate) >= cutoff;
  });

  if (recent.length === 0) return null;
  const wonCount = recent.filter((d) => d.isWon).length;
  return Math.round((wonCount / recent.length) * 100);
}

function computeWeightedPipeline(deals: ForecastDeal[]): number {
  return deals.reduce((sum, d) => {
    const weight = FORECAST_WEIGHTS[d.forecastCategory ?? ""] ?? 0;
    return sum + d.amount * weight;
  }, 0);
}

function computeAvgDealSize(deals: ForecastDeal[]): number | null {
  if (deals.length === 0) return null;
  return sumAmount(deals) / deals.length;
}

function computeDealVelocity(closedDeals: ClosedDeal[], trailingDays: number): number | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - trailingDays);

  const wonRecent = closedDeals.filter((d) => {
    if (!d.isWon || !d.closeDate || !d.createdAt) return false;
    return new Date(d.closeDate) >= cutoff;
  });

  if (wonRecent.length === 0) return null;

  const totalDays = wonRecent.reduce((sum, d) => {
    const created = new Date(d.createdAt!);
    const closed = new Date(d.closeDate!);
    const days = Math.max(0, Math.round((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));
    return sum + days;
  }, 0);

  return Math.round(totalDays / wonRecent.length);
}

// ─── Formatting ───────────────────────────────────────────

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPercent(value: number | null): string {
  if (value == null) return "—";
  return `${value}%`;
}

function formatDays(value: number | null): string {
  if (value == null) return "—";
  return `${value}d`;
}

// ─── Component ────────────────────────────────────────────

export function ForecastClient({ deals, closedDeals, targets: initialTargets, periods }: Props) {
  const [dealTypeFilter, setDealTypeFilter] = useState<DealTypeFilter>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("this_quarter");
  const [selectedBucket, setSelectedBucket] = useState<BucketKey | null>(null);
  const [sortField, setSortField] = useState<SortField>("amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [targets, setTargets] = useState(initialTargets);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Filter deals by type
  const typedDeals = useMemo(() => filterByType(deals, dealTypeFilter), [deals, dealTypeFilter]);
  const typedClosedDeals = useMemo(() => filterClosedByType(closedDeals, dealTypeFilter), [closedDeals, dealTypeFilter]);

  // Compute buckets for each period
  const periodBuckets = useMemo(() => {
    const map: Record<TimePeriod, ReturnType<typeof computeBuckets>> = {} as any;
    for (const p of periods) {
      const periodDeals = filterByPeriod(typedDeals, p);
      map[p.key] = computeBuckets(periodDeals);
    }
    return map;
  }, [typedDeals, periods]);

  // CRO Metrics
  const croMetrics = useMemo(() => {
    const activePeriod = periods.find((p) => p.key === selectedPeriod);
    const periodDeals = activePeriod ? filterByPeriod(typedDeals, activePeriod) : [];

    return {
      winRate90d: computeWinRate(typedClosedDeals, 90),
      winRate12m: computeWinRate(typedClosedDeals, 365),
      weightedPipeline: computeWeightedPipeline(periodDeals),
      rawPipeline: sumAmount(periodDeals),
      avgDealSize: computeAvgDealSize(periodDeals),
      salesCycle90d: computeDealVelocity(typedClosedDeals, 90),
      salesCycle12m: computeDealVelocity(typedClosedDeals, 365),
    };
  }, [typedDeals, typedClosedDeals, periods, selectedPeriod]);

  // Get deals for the table based on selection
  const tableDeals = useMemo(() => {
    const period = periods.find((p) => p.key === selectedPeriod);
    if (!period) return [];
    const periodDeals = filterByPeriod(typedDeals, period);
    if (!selectedBucket) return periodDeals;
    const buckets = computeBuckets(periodDeals);
    return buckets[selectedBucket].deals;
  }, [typedDeals, periods, selectedPeriod, selectedBucket]);

  // Sort table deals
  const sortedDeals = useMemo(() => {
    const sorted = [...tableDeals].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "customerName": cmp = a.customerName.localeCompare(b.customerName); break;
        case "dealName": cmp = a.dealName.localeCompare(b.dealName); break;
        case "amount": cmp = a.amount - b.amount; break;
        case "arr": cmp = a.arr - b.arr; break;
        case "stage": cmp = a.stage.localeCompare(b.stage); break;
        case "closeDate": cmp = (a.closeDate ?? "").localeCompare(b.closeDate ?? ""); break;
        case "forecastCategory": cmp = (a.forecastCategory ?? "").localeCompare(b.forecastCategory ?? ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [tableDeals, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handleCardClick = (periodKey: TimePeriod, bucket: BucketKey) => {
    setSelectedPeriod(periodKey);
    setSelectedBucket(selectedBucket === bucket && selectedPeriod === periodKey ? null : bucket);
  };

  // Target editing
  const handleSaveTarget = useCallback(async (periodKey: string) => {
    const amount = parseFloat(editValue);
    if (isNaN(amount) || amount < 0) {
      setEditingTarget(null);
      return;
    }

    // Optimistic update
    setTargets((prev) => ({ ...prev, [periodKey]: amount }));
    setEditingTarget(null);

    // Determine period type from key format
    const periodType = periodKey.includes("-Q") ? "quarter" : "year";

    try {
      await fetch("/api/forecast/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodType, periodKey, targetAmount: amount }),
      });
    } catch {
      // Revert on error
      setTargets(initialTargets);
    }
  }, [editValue, initialTargets]);

  // Summary stats
  const activePeriod = periods.find((p) => p.key === selectedPeriod);
  const activeBuckets = periodBuckets[selectedPeriod];
  const totalOpenDeals = deals.length;
  const uncategorized = deals.filter((d) => !d.forecastCategory).length;

  // Pipeline coverage ratio for the selected period
  const commitValue = activeBuckets?.commit.total ?? 0;
  const pipelineValue = activeBuckets?.pipeline.total ?? 0;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-brand-green" />
              Revenue Forecast
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {totalOpenDeals} open deal{totalOpenDeals !== 1 ? "s" : ""}
              {uncategorized > 0 && (
                <span className="text-amber-500"> · {uncategorized} uncategorized</span>
              )}
            </p>
          </div>

          {/* Deal type toggle */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
            {(["all", "new_business", "renewal"] as DealTypeFilter[]).map((type) => (
              <button
                key={type}
                onClick={() => setDealTypeFilter(type)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  dealTypeFilter === type
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                {type === "all" ? "All" : type === "new_business" ? "New Business" : "Renewals"}
              </button>
            ))}
          </div>
        </div>

        {/* CRO Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <MetricCard
            icon={<Target className="h-4 w-4" />}
            label="Win Rate"
            value={formatPercent(croMetrics.winRate90d)}
            sublabel={croMetrics.winRate12m != null ? `12m: ${formatPercent(croMetrics.winRate12m)}` : undefined}
            color="emerald"
            period="90d"
          />
          <MetricCard
            icon={<Zap className="h-4 w-4" />}
            label="Weighted Pipeline"
            value={formatCurrency(croMetrics.weightedPipeline)}
            sublabel={`Raw: ${formatCurrency(croMetrics.rawPipeline)}`}
            color="blue"
          />
          <MetricCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Avg Deal Size"
            value={formatCurrency(croMetrics.avgDealSize)}
            sublabel={activePeriod?.label}
            color="purple"
          />
          <MetricCard
            icon={<Clock className="h-4 w-4" />}
            label="Sales Cycle"
            value={formatDays(croMetrics.salesCycle90d)}
            sublabel={croMetrics.salesCycle12m != null ? `12m: ${formatDays(croMetrics.salesCycle12m)}` : undefined}
            color="amber"
            period="90d"
          />
        </div>

        {/* Period Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {periods.map((period) => {
            const buckets = periodBuckets[period.key];
            const isSelected = selectedPeriod === period.key;
            const targetKey = period.periodKey;
            const targetValue = targetKey ? targets[targetKey] : undefined;
            const attainment = targetValue && targetValue > 0 ? (buckets.commit.total / targetValue) * 100 : null;

            return (
              <div
                key={period.key}
                className={cn(
                  "bg-white rounded-xl border-2 transition-all",
                  isSelected ? "border-gray-900 shadow-sm" : "border-gray-100 hover:border-gray-200",
                )}
              >
                {/* Period header */}
                <div
                  className="px-5 pt-4 pb-3 cursor-pointer"
                  onClick={() => { setSelectedPeriod(period.key); setSelectedBucket(null); }}
                >
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {period.label}
                  </p>
                  <p className="text-sm text-gray-500">{period.sublabel}</p>
                </div>

                {/* Bucket rows */}
                <div className="px-3 pb-2 space-y-1">
                  <BucketRow
                    label="Commit"
                    value={buckets.commit.total}
                    count={buckets.commit.count}
                    color="green"
                    active={isSelected && selectedBucket === "commit"}
                    onClick={() => handleCardClick(period.key, "commit")}
                    ratio={buckets.pipeline.total > 0 ? buckets.commit.total / buckets.pipeline.total : 0}
                  />
                  <BucketRow
                    label="Best Case"
                    value={buckets.bestCase.total}
                    count={buckets.bestCase.count}
                    color="blue"
                    active={isSelected && selectedBucket === "bestCase"}
                    onClick={() => handleCardClick(period.key, "bestCase")}
                    ratio={buckets.pipeline.total > 0 ? buckets.bestCase.total / buckets.pipeline.total : 0}
                  />
                  <BucketRow
                    label="Pipeline"
                    value={buckets.pipeline.total}
                    count={buckets.pipeline.count}
                    color="gray"
                    active={isSelected && selectedBucket === "pipeline"}
                    onClick={() => handleCardClick(period.key, "pipeline")}
                    ratio={1}
                  />
                </div>

                {/* Target / Quota Section */}
                {targetKey && (
                  <div className="px-4 pb-3 pt-1 border-t border-gray-50">
                    {editingTarget === targetKey ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-400">$</span>
                        <input
                          type="number"
                          className="flex-1 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-green"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveTarget(targetKey);
                            if (e.key === "Escape") setEditingTarget(null);
                          }}
                          autoFocus
                          placeholder="Target amount"
                        />
                        <button
                          onClick={() => handleSaveTarget(targetKey)}
                          className="p-0.5 text-emerald-500 hover:text-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingTarget(null)}
                          className="p-0.5 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider">Target</span>
                          <button
                            onClick={() => {
                              setEditingTarget(targetKey);
                              setEditValue(targetValue?.toString() ?? "");
                            }}
                            className="p-0.5 text-gray-300 hover:text-gray-500 transition-colors"
                            title="Edit target"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                        {targetValue != null && targetValue > 0 ? (
                          <>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs font-medium text-gray-600">{formatCurrency(targetValue)}</span>
                              <span className={cn(
                                "text-xs font-bold",
                                attainment != null && attainment >= 100 ? "text-emerald-600" : "text-amber-500",
                              )}>
                                {attainment != null ? `${Math.round(attainment)}%` : "—"}
                              </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  attainment != null && attainment >= 100 ? "bg-emerald-500" : "bg-amber-400",
                                )}
                                style={{ width: `${Math.min(attainment ?? 0, 100)}%` }}
                              />
                            </div>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingTarget(targetKey);
                              setEditValue("");
                            }}
                            className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors mt-0.5"
                          >
                            + Set target
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pipeline Coverage Indicator */}
        {commitValue > 0 && pipelineValue > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-3 mb-6 flex items-center gap-4">
            <BarChart3 className="h-4 w-4 text-gray-400" />
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Pipeline Coverage · {activePeriod?.label}</span>
                <span className="font-medium text-gray-700">
                  {(pipelineValue / commitValue).toFixed(1)}x
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((commitValue / pipelineValue) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                <span>Commit: {formatCurrency(commitValue)}</span>
                <span>Pipeline: {formatCurrency(pipelineValue)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Deal Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                {selectedBucket
                  ? `${selectedBucket === "bestCase" ? "Best Case" : selectedBucket === "commit" ? "Commit" : "Pipeline"} Deals`
                  : "All Deals"}
                {activePeriod && (
                  <span className="text-gray-400 font-normal"> · {activePeriod.label}</span>
                )}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {sortedDeals.length} deal{sortedDeals.length !== 1 ? "s" : ""}
                {sortedDeals.length > 0 && (
                  <> · {formatCurrency(sumAmount(sortedDeals))} total</>
                )}
              </p>
            </div>
            {selectedBucket && (
              <button
                onClick={() => setSelectedBucket(null)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>

          {sortedDeals.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <DollarSign className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                {deals.length === 0
                  ? "No deals found. Connect HubSpot to see your forecast."
                  : "No deals match the current filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <SortHeader field="customerName" label="Customer" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortHeader field="dealName" label="Deal" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortHeader field="stage" label="Stage" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortHeader field="amount" label="Amount" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                    <SortHeader field="arr" label="ARR" sortField={sortField} sortDir={sortDir} onSort={handleSort} className="text-right" />
                    <SortHeader field="forecastCategory" label="Forecast" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortHeader field="closeDate" label="Close Date" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 text-left">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedDeals.map((deal) => (
                    <tr key={deal.dealId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {deal.customerName}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={deal.dealName}>
                        {deal.dealName}
                        {deal.siteName && (
                          <span className="block text-xs text-gray-400 truncate">{deal.siteName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {deal.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap tabular-nums">
                        {formatCurrency(deal.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap tabular-nums">
                        {deal.arr > 0 ? formatCurrency(deal.arr) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ForecastBadge category={deal.forecastCategory} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatShortDate(deal.closeDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                          deal.dealType === "new_business"
                            ? "bg-blue-50 text-blue-600"
                            : "bg-purple-50 text-purple-600",
                        )}>
                          {deal.dealType === "new_business" ? "New" : "Renewal"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────

function MetricCard({
  icon,
  label,
  value,
  sublabel,
  color,
  period,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  color: "emerald" | "blue" | "purple" | "amber";
  period?: string;
}) {
  const colorMap = {
    emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", value: "text-emerald-700" },
    blue: { bg: "bg-blue-50", icon: "text-blue-500", value: "text-blue-700" },
    purple: { bg: "bg-purple-50", icon: "text-purple-500", value: "text-purple-700" },
    amber: { bg: "bg-amber-50", icon: "text-amber-500", value: "text-amber-700" },
  };
  const c = colorMap[color];

  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("p-1 rounded-md", c.bg)}>
          <span className={c.icon}>{icon}</span>
        </div>
        <span className="text-xs text-gray-400 font-medium">
          {label}
          {period && <span className="text-gray-300 ml-1">({period})</span>}
        </span>
      </div>
      <p className={cn("text-lg font-bold", value === "—" ? "text-gray-300" : c.value)}>
        {value}
      </p>
      {sublabel && (
        <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>
      )}
    </div>
  );
}

function BucketRow({
  label,
  value,
  count,
  color,
  active,
  onClick,
  ratio,
}: {
  label: string;
  value: number;
  count: number;
  color: "green" | "blue" | "gray";
  active: boolean;
  onClick: () => void;
  ratio: number;
}) {
  const colorClasses = {
    green: {
      bar: "bg-emerald-500",
      active: "bg-emerald-50 border-emerald-200",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
    },
    blue: {
      bar: "bg-blue-500",
      active: "bg-blue-50 border-blue-200",
      text: "text-blue-700",
      dot: "bg-blue-500",
    },
    gray: {
      bar: "bg-gray-400",
      active: "bg-gray-100 border-gray-300",
      text: "text-gray-700",
      dot: "bg-gray-400",
    },
  };

  const c = colorClasses[color];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all",
        active ? `${c.active} border` : "hover:bg-gray-50 border border-transparent",
      )}
    >
      <span className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{label}</span>
          <span className="text-xs text-gray-400">{count} deal{count !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className={cn("text-sm font-bold", value > 0 ? c.text : "text-gray-300")}>
            {formatCurrency(value)}
          </span>
        </div>
        {/* Mini progress bar */}
        <div className="h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", c.bar)}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      </div>
    </button>
  );
}

function ForecastBadge({ category }: { category: string | null }) {
  if (!category) {
    return (
      <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">
        Uncategorized
      </span>
    );
  }

  const styles: Record<string, string> = {
    commit: "bg-emerald-50 text-emerald-700",
    most_likely: "bg-blue-50 text-blue-700",
    best_case: "bg-sky-50 text-sky-700",
    pipeline: "bg-gray-100 text-gray-600",
  };

  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", styles[category] ?? "bg-gray-50 text-gray-500")}>
      {FORECAST_CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

function SortHeader({
  field,
  label,
  sortField,
  sortDir,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const isActive = sortField === field;
  return (
    <th className={cn("px-4 py-2.5 text-xs font-medium text-gray-400 text-left", className)}>
      <button
        onClick={() => onSort(field)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-gray-600 transition-colors",
          isActive && "text-gray-600",
        )}
      >
        {label}
        {isActive ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100" />
        )}
      </button>
    </th>
  );
}
