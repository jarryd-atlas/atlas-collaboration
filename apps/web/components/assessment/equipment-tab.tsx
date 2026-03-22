"use client";

import { useState, useMemo } from "react";
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  type EquipmentCategory,
} from "@repo/shared";
import { calcAvgKw, calcAvgKwh, calcAnnualOpsHours, formatKw, formatKwh } from "../../lib/calculations/refrigeration";
import { deleteEquipment } from "../../lib/actions/assessment";
import { AddEquipmentDialog } from "../forms/add-equipment-dialog";
import { EmptyState } from "../ui/empty-state";
import { Plus, Trash2, Wrench } from "lucide-react";

interface EquipmentTabProps {
  assessment: any;
  equipment: any[];
  operationalParams: any;
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

function getLoadings(specs: any) {
  return {
    summer: specs?.loading_summer ?? 0,
    shoulder: specs?.loading_shoulder ?? 0,
    winter: specs?.loading_winter ?? 0,
  };
}

export function EquipmentTab({
  assessment,
  equipment,
  operationalParams,
  siteId,
  tenantId,
  isLocked,
}: EquipmentTabProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addCategory, setAddCategory] = useState<EquipmentCategory>("compressor");
  const [deleting, setDeleting] = useState<string | null>(null);

  const annualOpsHours = useMemo(() => {
    if (!operationalParams) return 8760;
    return calcAnnualOpsHours(
      operationalParams.operating_days_per_week ?? 7,
      operationalParams.daily_operational_hours ?? 24,
    );
  }, [operationalParams]);

  const loadFactor = operationalParams?.load_factor ?? 1.0;
  const offOpsEnergyUse = operationalParams?.off_ops_energy_use ?? 0.5;

  // Group equipment by category
  const grouped: Record<EquipmentCategory, any[]> = useMemo(() => {
    const map = {} as Record<EquipmentCategory, any[]>;
    for (const cat of EQUIPMENT_CATEGORIES) {
      map[cat] = [];
    }
    for (const eq of equipment) {
      if (map[eq.category as EquipmentCategory]) {
        map[eq.category as EquipmentCategory].push(eq);
      }
    }
    return map;
  }, [equipment]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalKw = 0;
    let totalKwh = 0;
    for (const eq of equipment) {
      const hp = getHpForEquipment(eq);
      const qty = getQuantity(eq);
      const { summer, shoulder, winter } = getLoadings(eq.specs);
      const avgKw = calcAvgKw(hp, summer, shoulder, winter, qty);
      const avgKwh = calcAvgKwh(avgKw, annualOpsHours, loadFactor, offOpsEnergyUse);
      totalKw += avgKw;
      totalKwh += avgKwh;
    }
    return { totalKw, totalKwh };
  }, [equipment, annualOpsHours, loadFactor, offOpsEnergyUse]);

  async function handleDelete(id: string) {
    setDeleting(id);
    await deleteEquipment(id);
    setDeleting(null);
  }

  function openAddDialog(category: EquipmentCategory) {
    setAddCategory(category);
    setAddDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Equipment</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{equipment.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Avg kW</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatKw(totals.totalKw)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Avg kWh/yr</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatKwh(totals.totalKwh)}</p>
        </div>
      </div>

      {/* Equipment sections by category */}
      {EQUIPMENT_CATEGORIES.map((cat) => {
        const items = grouped[cat];
        if (items.length === 0 && cat !== "compressor" && cat !== "condenser" && cat !== "evaporator") {
          return null;
        }

        return (
          <div key={cat} className="bg-white rounded-xl border border-gray-100 shadow-card">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">
                {EQUIPMENT_CATEGORY_LABELS[cat]} ({items.length})
              </h3>
              {!isLocked && (
                <button
                  type="button"
                  onClick={() => openAddDialog(cat)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gray-400">
                No {EQUIPMENT_CATEGORY_LABELS[cat].toLowerCase()} added yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-50 text-left text-xs text-gray-400 uppercase tracking-wide">
                      <th className="px-6 py-3 font-medium">Name</th>
                      {cat === "compressor" && (
                        <>
                          <th className="px-3 py-3 font-medium">Type</th>
                          <th className="px-3 py-3 font-medium">HP</th>
                          <th className="px-3 py-3 font-medium">Loop</th>
                          <th className="px-3 py-3 font-medium">Sum / Shld / Win</th>
                          <th className="px-3 py-3 font-medium text-right">Avg kW</th>
                          <th className="px-3 py-3 font-medium text-right">Avg kWh</th>
                        </>
                      )}
                      {cat === "condenser" && (
                        <>
                          <th className="px-3 py-3 font-medium">Type</th>
                          <th className="px-3 py-3 font-medium">Fans</th>
                          <th className="px-3 py-3 font-medium">HP</th>
                          <th className="px-3 py-3 font-medium">Sum / Shld / Win</th>
                          <th className="px-3 py-3 font-medium text-right">Avg kW</th>
                          <th className="px-3 py-3 font-medium text-right">Avg kWh</th>
                        </>
                      )}
                      {cat === "evaporator" && (
                        <>
                          <th className="px-3 py-3 font-medium">Loop</th>
                          <th className="px-3 py-3 font-medium">Units</th>
                          <th className="px-3 py-3 font-medium">HP/unit</th>
                          <th className="px-3 py-3 font-medium">Sum / Shld / Win</th>
                          <th className="px-3 py-3 font-medium text-right">Avg kW</th>
                          <th className="px-3 py-3 font-medium text-right">Avg kWh</th>
                        </>
                      )}
                      {cat !== "compressor" && cat !== "condenser" && cat !== "evaporator" && (
                        <>
                          <th className="px-3 py-3 font-medium">HP</th>
                          <th className="px-3 py-3 font-medium">Sum / Shld / Win</th>
                          <th className="px-3 py-3 font-medium text-right">Avg kW</th>
                          <th className="px-3 py-3 font-medium text-right">Avg kWh</th>
                        </>
                      )}
                      {!isLocked && <th className="px-3 py-3 w-10" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.map((eq: any) => {
                      const hp = getHpForEquipment(eq);
                      const qty = getQuantity(eq);
                      const { summer, shoulder, winter } = getLoadings(eq.specs);
                      const avgKw = calcAvgKw(hp, summer, shoulder, winter, qty);
                      const avgKwh = calcAvgKwh(avgKw, annualOpsHours, loadFactor, offOpsEnergyUse);

                      return (
                        <tr key={eq.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-3 font-medium text-gray-900">
                            {eq.name || "—"}
                          </td>
                          {cat === "compressor" && (
                            <>
                              <td className="px-3 py-3 text-gray-600 capitalize">{eq.specs?.type ?? "—"}</td>
                              <td className="px-3 py-3 text-gray-600">{hp}</td>
                              <td className="px-3 py-3 text-gray-600 capitalize">{eq.specs?.loop ?? "—"}</td>
                              <td className="px-3 py-3 text-gray-600">
                                {(summer * 100).toFixed(0)}% / {(shoulder * 100).toFixed(0)}% / {(winter * 100).toFixed(0)}%
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-gray-900">{formatKw(avgKw)}</td>
                              <td className="px-3 py-3 text-right font-mono text-gray-900">{formatKwh(avgKwh)}</td>
                            </>
                          )}
                          {cat === "condenser" && (
                            <>
                              <td className="px-3 py-3 text-gray-600 capitalize">{eq.specs?.type?.replace("_", " ") ?? "—"}</td>
                              <td className="px-3 py-3 text-gray-600">{eq.specs?.total_fans ?? "—"}</td>
                              <td className="px-3 py-3 text-gray-600">{hp}</td>
                              <td className="px-3 py-3 text-gray-600">
                                {(summer * 100).toFixed(0)}% / {(shoulder * 100).toFixed(0)}% / {(winter * 100).toFixed(0)}%
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-gray-900">{formatKw(avgKw)}</td>
                              <td className="px-3 py-3 text-right font-mono text-gray-900">{formatKwh(avgKwh)}</td>
                            </>
                          )}
                          {cat === "evaporator" && (
                            <>
                              <td className="px-3 py-3 text-gray-600 capitalize">{eq.specs?.loop ?? "—"}</td>
                              <td className="px-3 py-3 text-gray-600">{eq.specs?.num_units ?? eq.quantity}</td>
                              <td className="px-3 py-3 text-gray-600">{hp}</td>
                              <td className="px-3 py-3 text-gray-600">
                                {(summer * 100).toFixed(0)}% / {(shoulder * 100).toFixed(0)}% / {(winter * 100).toFixed(0)}%
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-gray-900">{formatKw(avgKw)}</td>
                              <td className="px-3 py-3 text-right font-mono text-gray-900">{formatKwh(avgKwh)}</td>
                            </>
                          )}
                          {cat !== "compressor" && cat !== "condenser" && cat !== "evaporator" && (
                            <>
                              <td className="px-3 py-3 text-gray-600">{hp || "—"}</td>
                              <td className="px-3 py-3 text-gray-600">
                                {(summer * 100).toFixed(0)}% / {(shoulder * 100).toFixed(0)}% / {(winter * 100).toFixed(0)}%
                              </td>
                              <td className="px-3 py-3 text-right font-mono text-gray-900">{formatKw(avgKw)}</td>
                              <td className="px-3 py-3 text-right font-mono text-gray-900">{formatKwh(avgKwh)}</td>
                            </>
                          )}
                          {!isLocked && (
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                onClick={() => handleDelete(eq.id)}
                                disabled={deleting === eq.id}
                                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {equipment.length === 0 && (
        <EmptyState
          icon={<Wrench className="h-12 w-12" />}
          title="No equipment added"
          description="Start by adding compressors, condensers, and evaporators to build the refrigeration load profile."
          action={
            !isLocked ? (
              <button
                type="button"
                onClick={() => openAddDialog("compressor")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Equipment
              </button>
            ) : undefined
          }
        />
      )}

      {/* Add Equipment Dialog */}
      {assessment && (
        <AddEquipmentDialog
          open={addDialogOpen}
          onClose={() => setAddDialogOpen(false)}
          assessmentId={assessment.id}
          siteId={siteId}
          tenantId={tenantId}
          defaultCategory={addCategory}
        />
      )}
    </div>
  );
}
