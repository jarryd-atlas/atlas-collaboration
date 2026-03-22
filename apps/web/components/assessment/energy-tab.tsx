"use client";

import { useState, useMemo } from "react";
import { formatDollars, formatKwh, formatKw } from "../../lib/calculations/refrigeration";
import { deleteEnergyData } from "../../lib/actions/assessment";
import { AddEnergyDataDialog } from "../forms/add-energy-data-dialog";
import { EmptyState } from "../ui/empty-state";
import { Plus, Trash2, Zap } from "lucide-react";

interface EnergyTabProps {
  assessment: any;
  energyData: any[];
  rateStructure: any;
  siteId: string;
  tenantId: string;
  isLocked: boolean;
}

export function EnergyTab({
  assessment,
  energyData,
  rateStructure,
  siteId,
  tenantId,
  isLocked,
}: EnergyTabProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Summary calculations from energy data
  const summary = useMemo(() => {
    if (energyData.length === 0) return null;

    const totalCharges = energyData.reduce((sum: number, d: any) => sum + (d.total_charges ?? 0), 0);
    const totalKwh = energyData.reduce((sum: number, d: any) => sum + (d.total_kwh ?? 0), 0);
    const avgPeakDemand = energyData.reduce((sum: number, d: any) => sum + (d.peak_demand_kw ?? 0), 0) / energyData.length;
    const months = energyData.length;
    const annualizedCharges = months >= 12 ? totalCharges : (totalCharges / months) * 12;
    const annualizedKwh = months >= 12 ? totalKwh : (totalKwh / months) * 12;
    const avgRate = totalKwh > 0 ? totalCharges / totalKwh : 0;

    return {
      totalCharges,
      totalKwh,
      avgPeakDemand,
      months,
      annualizedCharges,
      annualizedKwh,
      avgRate,
    };
  }, [energyData]);

  async function handleDelete(id: string) {
    setDeleting(id);
    await deleteEnergyData(id);
    setDeleting(null);
  }

  function formatMonth(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  }

  // Check if any rows have TOU data
  const hasTouData = energyData.some(
    (d: any) => d.on_peak_kwh != null || d.off_peak_kwh != null || d.shoulder_kwh != null || d.super_peak_kwh != null,
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Annual Cost</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatDollars(summary.annualizedCharges)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{summary.months} months of data</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Annual kWh</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatKwh(summary.annualizedKwh)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Avg Peak Demand</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatKw(summary.avgPeakDemand)} kW</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Avg Rate</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">${summary.avgRate.toFixed(4)}/kWh</p>
          </div>
        </div>
      )}

      {/* Monthly utility data table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-900">
            Monthly Consumption ({energyData.length} months)
          </h3>
          {!isLocked && assessment && (
            <button
              type="button"
              onClick={() => setAddDialogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Month
            </button>
          )}
        </div>

        {energyData.length === 0 ? (
          <EmptyState
            icon={<Zap className="h-12 w-12" />}
            title="No energy data"
            description="Add monthly utility billing data to analyze energy costs and usage patterns."
            action={
              !isLocked && assessment ? (
                <button
                  type="button"
                  onClick={() => setAddDialogOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Month
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">Month</th>
                  <th className="px-3 py-3 font-medium text-right">Total Cost</th>
                  <th className="px-3 py-3 font-medium text-right">Total kWh</th>
                  <th className="px-3 py-3 font-medium text-right">Peak kW</th>
                  {hasTouData && (
                    <>
                      <th className="px-3 py-3 font-medium text-right">On-Peak kWh</th>
                      <th className="px-3 py-3 font-medium text-right">Off-Peak kWh</th>
                      <th className="px-3 py-3 font-medium text-right">Shoulder kWh</th>
                    </>
                  )}
                  <th className="px-3 py-3 font-medium text-right">Supply $</th>
                  <th className="px-3 py-3 font-medium text-right">Dist. $</th>
                  <th className="px-3 py-3 font-medium text-right">Tax</th>
                  <th className="px-3 py-3 font-medium">Source</th>
                  {!isLocked && <th className="px-3 py-3 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {energyData.map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 font-medium text-gray-900">{formatMonth(row.period_month)}</td>
                    <td className="px-3 py-3 text-right font-mono text-gray-900">
                      {row.total_charges != null ? formatDollars(row.total_charges) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-900">
                      {row.total_kwh != null ? formatKwh(row.total_kwh) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-900">
                      {row.peak_demand_kw != null ? formatKw(row.peak_demand_kw) : "—"}
                    </td>
                    {hasTouData && (
                      <>
                        <td className="px-3 py-3 text-right font-mono text-gray-600">
                          {row.on_peak_kwh != null ? formatKwh(row.on_peak_kwh) : "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-gray-600">
                          {row.off_peak_kwh != null ? formatKwh(row.off_peak_kwh) : "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-gray-600">
                          {row.shoulder_kwh != null ? formatKwh(row.shoulder_kwh) : "—"}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-3 text-right font-mono text-gray-600">
                      {row.supply_charges != null ? formatDollars(row.supply_charges) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-600">
                      {row.distribution_charges != null ? formatDollars(row.distribution_charges) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-600">
                      {row.sales_tax != null ? formatDollars(row.sales_tax) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 capitalize">
                        {row.source ?? "manual"}
                      </span>
                    </td>
                    {!isLocked && (
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          disabled={deleting === row.id}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Energy Data Dialog */}
      {assessment && (
        <AddEnergyDataDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          assessmentId={assessment.id}
          siteId={siteId}
          tenantId={tenantId}
        />
      )}
    </div>
  );
}
