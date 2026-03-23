"use client";

import { useState, useMemo } from "react";
import {
  SAVINGS_OPPORTUNITY_LABELS,
  type SavingsOpportunityType,
} from "@repo/shared";
import {
  calcAvgKw,
  calcAvgKwh,
  calcAnnualOpsHours,
  calcLoadBreakdown,
  formatKw,
  formatKwh,
  formatDollars,
  formatPct,
  type EquipmentWithCalcs,
} from "../../lib/calculations/refrigeration";
import { EmptyState } from "../ui/empty-state";
import { TrendingUp, BarChart3 } from "lucide-react";

interface SavingsTabProps {
  assessment: any;
  equipment: any[];
  energyData: any[];
  operationalParams: any;
  loadBreakdown: any;
  arcoPerformance: any;
  savingsAnalysis: any;
  siteId: string;
  tenantId: string;
  isLocked: boolean;
}

function getHpForEquipment(eq: any): number {
  const specs = eq.specs ?? {};
  if (eq.category === "compressor") return specs.hp ?? 0;
  if (eq.category === "condenser") return specs.total_hp_fan_and_pump ?? 0;
  if (eq.category === "evaporator") return specs.avg_fan_hp ?? 0;
  return specs.hp ?? 0;
}

function getQuantity(eq: any): number {
  if (eq.category === "evaporator") return eq.specs?.num_units ?? eq.quantity ?? 1;
  return 1;
}

export function SavingsTab({
  assessment,
  equipment,
  energyData,
  operationalParams,
  loadBreakdown: savedLoadBreakdown,
  arcoPerformance,
  savingsAnalysis,
  siteId,
  tenantId,
  isLocked,
}: SavingsTabProps) {
  const annualOpsHours = useMemo(() => {
    if (!operationalParams) return 8760;
    return calcAnnualOpsHours(
      operationalParams.operating_days_per_week ?? 7,
      operationalParams.daily_operational_hours ?? 24,
    );
  }, [operationalParams]);

  const loadFactor = operationalParams?.load_factor ?? 1.0;
  const offOpsEnergyUse = operationalParams?.off_ops_energy_use ?? 0.5;

  // Compute load breakdown from equipment
  const computedLoadBreakdown = useMemo(() => {
    if (equipment.length === 0) return null;

    const eqWithCalcs: EquipmentWithCalcs[] = equipment.map((eq: any) => {
      const hp = getHpForEquipment(eq);
      const qty = getQuantity(eq);
      const specs = eq.specs ?? {};
      const avgKw = calcAvgKw(
        hp,
        specs.loading_summer ?? 0,
        specs.loading_shoulder ?? 0,
        specs.loading_winter ?? 0,
        qty,
      );
      const avgKwh = calcAvgKwh(avgKw, annualOpsHours, loadFactor, offOpsEnergyUse);
      return { category: eq.category, specs, quantity: qty, avgKw, avgKwh };
    });

    // Get energy summary
    const avgPeakDemand = energyData.length > 0
      ? energyData.reduce((s: number, d: any) => s + (d.peak_demand_kw ?? 0), 0) / energyData.length
      : 0;
    const totalAnnualKwh = energyData.length > 0
      ? energyData.reduce((s: number, d: any) => s + (d.total_kwh ?? 0), 0) * (12 / energyData.length)
      : 0;

    return calcLoadBreakdown(eqWithCalcs, avgPeakDemand, totalAnnualKwh);
  }, [equipment, energyData, annualOpsHours, loadFactor, offOpsEnergyUse]);

  const lb = savedLoadBreakdown ?? computedLoadBreakdown;
  const opportunities = savingsAnalysis?.opportunities ?? [];

  if (!assessment) {
    return (
      <EmptyState
        icon={<TrendingUp className="h-12 w-12" />}
        title="No assessment started"
        description="Start an assessment from the Overview tab to begin savings analysis."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Load Breakdown */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Refrigeration Load Breakdown</h3>
        {lb ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 uppercase">Total Refrig kW</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatKw(lb.totalRefrigKw ?? lb.total_refrig_kw ?? 0)}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 uppercase">Total Refrig kWh</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatKwh(lb.totalRefrigKwh ?? lb.total_refrig_kwh ?? 0)}</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 uppercase">% of Building</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{formatPct(lb.pctOfBuilding ?? lb.pct_of_building ?? 0)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                    <th className="text-left py-2 font-medium">Component</th>
                    <th className="text-right py-2 font-medium">Avg kW</th>
                    <th className="text-right py-2 font-medium">Avg kWh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {[
                    { label: "Low Compressors", kw: lb.lowCompressorKw ?? lb.low_compressor_kw, kwh: lb.lowCompressorKwh ?? lb.low_compressor_kwh },
                    { label: "High Compressors", kw: lb.highCompressorKw ?? lb.high_compressor_kw, kwh: lb.highCompressorKwh ?? lb.high_compressor_kwh },
                    { label: "Blast", kw: lb.blastKw ?? lb.blast_kw, kwh: lb.blastKwh ?? lb.blast_kwh },
                    { label: "Condensers", kw: lb.condenserKw ?? lb.condenser_kw, kwh: lb.condenserKwh ?? lb.condenser_kwh },
                    { label: "Sheddable Evaporators", kw: lb.sheddableEvaporatorKw ?? lb.sheddable_evaporator_kw, kwh: lb.sheddableEvaporatorKwh ?? lb.sheddable_evaporator_kwh },
                  ].map(({ label, kw, kwh }) => (
                    <tr key={label}>
                      <td className="py-2 text-gray-700">{label}</td>
                      <td className="py-2 text-right font-mono text-gray-900">{formatKw(kw ?? 0)}</td>
                      <td className="py-2 text-right font-mono text-gray-900">{formatKwh(kwh ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 py-4">
            Add equipment on the Equipment tab to see the load breakdown.
          </p>
        )}
      </div>

      {/* ARCO Performance */}
      {arcoPerformance && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">ARCO Performance</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-400 uppercase">Pre-ATLAS kW/TR</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {arcoPerformance.pre_atlas_kw_per_tr?.toFixed(3) ?? "—"}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-400 uppercase">Post-ATLAS kW/TR</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {arcoPerformance.post_atlas_kw_per_tr?.toFixed(3) ?? "—"}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-xs text-green-600 uppercase">Compressor Savings</p>
              <p className="text-xl font-bold text-green-700 mt-1">
                {arcoPerformance.compressor_savings_pct != null
                  ? formatPct(arcoPerformance.compressor_savings_pct)
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Power Results */}
      {savingsAnalysis && (savingsAnalysis.pre_atlas_annual_kwh || savingsAnalysis.post_atlas_annual_kwh) && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-6 shadow-card space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Power Results</h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                  <th className="text-left py-2 font-medium">Measure</th>
                  <th className="text-right py-2 font-medium">Pre-ATLAS</th>
                  <th className="text-right py-2 font-medium">Post-ATLAS</th>
                  <th className="text-right py-2 font-medium">Reduction</th>
                  <th className="text-right py-2 font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[
                  { label: "Annual kWh", pre: savingsAnalysis.pre_atlas_annual_kwh, post: savingsAnalysis.post_atlas_annual_kwh, fmt: formatKwh },
                  { label: "Avg Power (kW)", pre: savingsAnalysis.pre_atlas_avg_power_kw, post: savingsAnalysis.post_atlas_avg_power_kw, fmt: formatKw },
                  { label: "Peak Demand (kW)", pre: savingsAnalysis.avg_peak_demand_kw, post: savingsAnalysis.post_atlas_peak_demand_kw, fmt: formatKw },
                ].map(({ label, pre, post, fmt }) => {
                  const reduction = pre != null && post != null ? pre - post : null;
                  const pct = pre != null && post != null && pre > 0 ? ((pre - post) / pre) * 100 : null;
                  return (
                    <tr key={label}>
                      <td className="py-2 text-gray-700">{label}</td>
                      <td className="py-2 text-right font-mono text-gray-900">{pre != null ? fmt(pre) : "—"}</td>
                      <td className="py-2 text-right font-mono text-gray-900">{post != null ? fmt(post) : "—"}</td>
                      <td className="py-2 text-right font-mono text-green-700">{reduction != null ? fmt(reduction) : "—"}</td>
                      <td className="py-2 text-right font-mono text-green-700">{pct != null ? pct.toFixed(0) + "%" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Savings Opportunities */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Energy AI Savings Opportunities</h3>
          {savingsAnalysis?.total_estimated_savings != null && (
            <span className="text-sm font-bold text-green-700">
              Total: {formatDollars(savingsAnalysis.total_estimated_savings)}/yr
            </span>
          )}
        </div>

        {opportunities.length > 0 ? (
          <div className="space-y-3">
            {opportunities.map((opp: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {SAVINGS_OPPORTUNITY_LABELS[opp.type as SavingsOpportunityType] ?? opp.type}
                  </p>
                  {opp.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{opp.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">
                    {opp.estimated_savings != null ? formatDollars(opp.estimated_savings) : "—"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {opp.total_cost_pct != null ? formatPct(opp.total_cost_pct) + " of total" : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center">
            <BarChart3 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              No savings analysis yet. Add equipment and energy data to enable analysis.
            </p>
            <p className="text-xs text-gray-300 mt-1">
              AI-generated analysis will be available in a future update.
            </p>
          </div>
        )}
      </div>

      {/* Summary */}
      {savingsAnalysis && savingsAnalysis.total_estimated_savings != null && (
        <div className="bg-green-50 rounded-xl border border-green-100 p-6 shadow-card">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-green-600 uppercase">Annual Spend</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatDollars(savingsAnalysis.annual_energy_spend ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-green-600 uppercase">Estimated Savings</p>
              <p className="text-lg font-bold text-green-700 mt-1">
                {formatDollars(savingsAnalysis.total_estimated_savings)}
              </p>
            </div>
            <div>
              <p className="text-xs text-green-600 uppercase">Savings %</p>
              <p className="text-lg font-bold text-green-700 mt-1">
                {savingsAnalysis.total_savings_pct != null
                  ? formatPct(savingsAnalysis.total_savings_pct)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-green-600 uppercase">Post-ATLAS Cost</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {savingsAnalysis.post_atlas_annual_cost != null
                  ? formatDollars(savingsAnalysis.post_atlas_annual_cost)
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
