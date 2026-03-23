// Public handoff report page — no auth required, standalone layout
// Fetches all assessment data by slug, renders read-only handoff document

import { getPublicHandoff } from "../../../../lib/data/queries";
import {
  EQUIPMENT_CATEGORY_LABELS,
  SAVINGS_OPPORTUNITY_LABELS,
  type EquipmentCategory,
  type SavingsOpportunityType,
} from "@repo/shared";

interface HandoffPageProps {
  params: Promise<{ slug: string }>;
}

function formatNum(n: number | null | undefined, decimals = 0): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatDollars(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatPct(n: number | null | undefined): string {
  if (n == null) return "—";
  return (n * 100).toFixed(1) + "%";
}

export default async function HandoffPage({ params }: HandoffPageProps) {
  const { slug } = await params;

  let data: Awaited<ReturnType<typeof getPublicHandoff>> = null;
  try {
    data = await getPublicHandoff(slug);
  } catch {
    // Show not found
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Handoff Report Not Found</h1>
          <p className="text-gray-500 max-w-sm">
            This report may have been removed or the link may be incorrect.
            Please contact your CrossnoKaye representative for assistance.
          </p>
        </div>
      </div>
    );
  }

  const {
    handoff,
    site,
    customer,
    siteContacts = [],
    assessment,
    equipment = [],
    energyData = [],
    touSchedule,
    rateStructure,
    operationalParams,
    savingsAnalysis,
    arcoPerformance,
    loadBreakdown,
  } = data;

  // Group equipment by category
  const eqGrouped: Record<string, any[]> = {};
  for (const eq of equipment) {
    const cat = eq.category ?? "other";
    if (!eqGrouped[cat]) eqGrouped[cat] = [];
    eqGrouped[cat].push(eq);
  }

  // Energy summary
  const totalAnnualKwh = energyData.length > 0
    ? energyData.reduce((s: number, d: any) => s + (d.total_kwh ?? 0), 0) * (12 / energyData.length)
    : null;
  const avgPeakDemand = energyData.length > 0
    ? energyData.reduce((s: number, d: any) => s + (d.peak_demand_kw ?? 0), 0) / energyData.length
    : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 py-6 sm:py-8 px-4 sm:px-6 print:border-none">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm font-bold text-gray-900">
              ATLAS<span className="text-[#91E100]"> Collaborate</span>
            </span>
            <span className="text-xs text-gray-400">CrossnoKaye</span>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-gray-400">
                {(customer?.name ?? "?").charAt(0)}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{customer?.name ?? ""}</p>
              <p className="text-xs text-gray-500">{site?.name ?? ""}</p>
            </div>
          </div>

          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">{handoff.title}</h1>
          {site?.address && (
            <p className="mt-1 text-sm text-gray-500">
              {site.address}{site.city ? `, ${site.city}` : ""}{site.state ? `, ${site.state}` : ""}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Generated {new Date(handoff.generated_at).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">

        {/* Key Site Contacts */}
        {siteContacts.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
              Key Site Team Members
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                    <th className="text-left py-2 font-medium">Title</th>
                    <th className="text-left py-2 font-medium">Name</th>
                    <th className="text-left py-2 font-medium">Email</th>
                    <th className="text-left py-2 font-medium hidden sm:table-cell">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {siteContacts.map((c: any) => (
                    <tr key={c.id}>
                      <td className="py-2 text-gray-600">{c.title ?? "—"}</td>
                      <td className="py-2 font-medium text-gray-900">{c.name}</td>
                      <td className="py-2 text-gray-600">{c.email ?? "—"}</td>
                      <td className="py-2 text-gray-600 hidden sm:table-cell">{c.phone ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Utility Overview */}
        {touSchedule && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
              Utility Rate Overview
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm mb-4">
              {touSchedule.supply_provider && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Utility Provider</span>
                  <span className="font-medium text-gray-900">{touSchedule.supply_provider}</span>
                </div>
              )}
              {touSchedule.account_number && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Account #</span>
                  <span className="font-medium text-gray-900">{touSchedule.account_number}</span>
                </div>
              )}
              {touSchedule.meter_number && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Meter #</span>
                  <span className="font-medium text-gray-900">{touSchedule.meter_number}</span>
                </div>
              )}
              {touSchedule.rate_name && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Rate Name</span>
                  <span className="font-medium text-gray-900">{touSchedule.rate_name}</span>
                </div>
              )}
              {touSchedule.on_peak_demand_rate && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">On-Peak Demand Rate</span>
                  <span className="font-medium text-gray-900">${touSchedule.on_peak_demand_rate}/kW</span>
                </div>
              )}
              {touSchedule.on_peak_energy_rate && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Energy Usage Charge</span>
                  <span className="font-medium text-gray-900">${touSchedule.on_peak_energy_rate}/kWh</span>
                </div>
              )}
              {touSchedule.demand_response_status && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Demand Response</span>
                  <span className="font-medium text-gray-900 capitalize">{touSchedule.demand_response_status.replace(/_/g, " ")}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Savings Strategies */}
        {savingsAnalysis && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
              Savings Strategies
            </h2>

            {/* Site Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
              {savingsAnalysis.annual_energy_spend != null && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Annual Energy Spend</span>
                  <span className="font-medium text-gray-900">{formatDollars(savingsAnalysis.annual_energy_spend)}</span>
                </div>
              )}
              {savingsAnalysis.pre_atlas_annual_kwh != null && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Pre-ATLAS Annual kWh</span>
                  <span className="font-medium text-gray-900">{formatNum(savingsAnalysis.pre_atlas_annual_kwh)}</span>
                </div>
              )}
              {savingsAnalysis.avg_peak_demand_kw != null && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Avg Peak Demand (kW)</span>
                  <span className="font-medium text-gray-900">{formatNum(savingsAnalysis.avg_peak_demand_kw)}</span>
                </div>
              )}
              {savingsAnalysis.pct_compressor_load != null && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">% Compressor Load</span>
                  <span className="font-medium text-gray-900">{formatPct(savingsAnalysis.pct_compressor_load)}</span>
                </div>
              )}
              {savingsAnalysis.pct_refrigeration_load != null && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">% Refrigeration Load</span>
                  <span className="font-medium text-gray-900">{formatPct(savingsAnalysis.pct_refrigeration_load)}</span>
                </div>
              )}
              {savingsAnalysis.arco_compressor_reduction_pct != null && (
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">ARCO Compressor Reduction</span>
                  <span className="font-medium text-gray-900">{formatPct(savingsAnalysis.arco_compressor_reduction_pct)}</span>
                </div>
              )}
            </div>

            {/* Rate Structure */}
            {rateStructure && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-2 text-sm mb-6">
                {[
                  ["Fixed Usage %", rateStructure.fixed_usage_pct],
                  ["TOU Usage %", rateStructure.variable_tou_usage_pct],
                  ["Max Demand %", rateStructure.max_demand_pct],
                  ["TOU Demand %", rateStructure.variable_tou_demand_pct],
                  ["Coincident Peak %", rateStructure.coincident_peak_pct],
                ].filter(([, v]) => v != null).map(([label, val]) => (
                  <div key={label as string} className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-500">{label as string}</span>
                    <span className="font-medium text-gray-900">{formatPct(val as number)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Power Results */}
            {(savingsAnalysis.pre_atlas_annual_kwh || savingsAnalysis.post_atlas_annual_kwh) && (
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase">
                      <th className="text-left py-2 font-medium">Measure</th>
                      <th className="text-right py-2 font-medium">Pre-ATLAS</th>
                      <th className="text-right py-2 font-medium">Post-ATLAS</th>
                      <th className="text-right py-2 font-medium">Reduction</th>
                      <th className="text-right py-2 font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { label: "Annual kWh", pre: savingsAnalysis.pre_atlas_annual_kwh, post: savingsAnalysis.post_atlas_annual_kwh },
                      { label: "Avg Power (kW)", pre: savingsAnalysis.pre_atlas_avg_power_kw, post: savingsAnalysis.post_atlas_avg_power_kw },
                      { label: "Peak Demand (kW)", pre: savingsAnalysis.avg_peak_demand_kw, post: savingsAnalysis.post_atlas_peak_demand_kw },
                    ].map(({ label, pre, post }) => {
                      const reduction = pre != null && post != null ? pre - post : null;
                      const pct = pre != null && post != null && pre > 0 ? ((pre - post) / pre) * 100 : null;
                      return (
                        <tr key={label}>
                          <td className="py-2 text-gray-700">{label}</td>
                          <td className="py-2 text-right font-mono text-gray-900">{formatNum(pre)}</td>
                          <td className="py-2 text-right font-mono text-gray-900">{formatNum(post)}</td>
                          <td className="py-2 text-right font-mono text-green-700">{formatNum(reduction)}</td>
                          <td className="py-2 text-right font-mono text-green-700">{pct != null ? pct.toFixed(0) + "%" : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Savings Opportunities */}
            {savingsAnalysis.opportunities?.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase">
                      <th className="text-left py-2 font-medium">Module</th>
                      <th className="text-right py-2 font-medium">Est. Savings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {savingsAnalysis.opportunities.map((opp: any, i: number) => (
                      <tr key={i}>
                        <td className="py-2 text-gray-700">
                          {SAVINGS_OPPORTUNITY_LABELS[opp.type as SavingsOpportunityType] ?? opp.type}
                        </td>
                        <td className="py-2 text-right font-mono font-medium text-gray-900">
                          {opp.estimated_savings != null ? formatDollars(opp.estimated_savings) : "—"}
                        </td>
                      </tr>
                    ))}
                    {savingsAnalysis.total_estimated_savings != null && (
                      <tr className="font-bold">
                        <td className="py-2 text-gray-900">Total Savings</td>
                        <td className="py-2 text-right font-mono text-green-700">
                          {formatDollars(savingsAnalysis.total_estimated_savings)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ARCO Performance */}
        {arcoPerformance && (arcoPerformance.pre_atlas_kw_per_tr || arcoPerformance.compressor_savings_pct) && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
              ARCO Performance
            </h2>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 uppercase">Pre-ATLAS kW/TR</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{arcoPerformance.pre_atlas_kw_per_tr?.toFixed(3) ?? "—"}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-400 uppercase">Post-ATLAS kW/TR</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{arcoPerformance.post_atlas_kw_per_tr?.toFixed(3) ?? "—"}</p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-green-600 uppercase">Savings</p>
                <p className="text-lg font-bold text-green-700 mt-1">{formatPct(arcoPerformance.compressor_savings_pct)}</p>
              </div>
            </div>
          </section>
        )}

        {/* Site Survey Notes */}
        {operationalParams && (operationalParams.required_upgrades || operationalParams.survey_notes) && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
              Site Survey Notes
            </h2>
            <div className="space-y-3 text-sm">
              {operationalParams.survey_completed_date && (
                <p className="text-gray-500">
                  Survey completed: <span className="font-medium text-gray-900">{operationalParams.survey_completed_date}</span>
                </p>
              )}
              {operationalParams.required_upgrades && (
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Required Upgrades</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{operationalParams.required_upgrades}</p>
                  {operationalParams.estimated_upgrade_cost != null && (
                    <p className="text-gray-500 mt-1">Estimated cost: <span className="font-medium">{formatDollars(operationalParams.estimated_upgrade_cost)}</span></p>
                  )}
                </div>
              )}
              {operationalParams.survey_notes && (
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium mb-1">Notes</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{operationalParams.survey_notes}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Equipment Summary */}
        {equipment.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">
              Equipment Summary
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs text-gray-400 uppercase">
                    <th className="text-left py-2 font-medium">Category</th>
                    <th className="text-right py-2 font-medium">Count</th>
                    <th className="text-right py-2 font-medium">Total HP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {Object.entries(eqGrouped)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([cat, eqs]) => {
                      const totalHp = eqs.reduce((s: number, eq: any) => {
                        const specs = eq.specs ?? {};
                        if (cat === "compressor") return s + (specs.hp ?? 0);
                        if (cat === "condenser") return s + (specs.total_hp_fan_and_pump ?? 0);
                        if (cat === "evaporator") return s + (specs.avg_fan_hp ?? 0) * (specs.num_units ?? 1);
                        return s + (specs.hp ?? 0);
                      }, 0);
                      return (
                        <tr key={cat}>
                          <td className="py-2 text-gray-700 capitalize">
                            {EQUIPMENT_CATEGORY_LABELS[cat as EquipmentCategory] ?? cat}
                          </td>
                          <td className="py-2 text-right font-mono text-gray-900">{eqs.length}</td>
                          <td className="py-2 text-right font-mono text-gray-900">{totalHp > 0 ? formatNum(totalHp) : "—"}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 px-4 sm:px-6 print:border-none">
        <div className="mx-auto max-w-3xl flex items-center justify-between text-xs text-gray-400">
          <span>Generated by ATLAS Collaborate</span>
          <span>CrossnoKaye</span>
        </div>
      </footer>
    </div>
  );
}
