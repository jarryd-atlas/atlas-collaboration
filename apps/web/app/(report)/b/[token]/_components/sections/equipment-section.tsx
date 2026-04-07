"use client";

import { useState, useCallback } from "react";
import type {
  BaselineFormState,
  BaselineFormAction,
  EquipmentData,
  CompressorSpecs,
  CondenserSpecs,
  EvaporatorSpecs,
} from "../../../../../../lib/baseline-form/types";
import {
  createDefaultEquipment,
  duplicateEquipment,
  getAvailableLoops,
} from "../../../../../../lib/baseline-form/defaults";
import {
  upsertBaselineEquipment,
  deleteBaselineEquipment,
} from "../../../../../../lib/actions/baseline-form";
import { useAutoSave } from "../../../../../../lib/hooks/use-auto-save";
import { Button } from "../../../../../../components/ui/button";
import type { EquipmentCategory } from "@repo/shared/constants";

interface SectionProps {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
  token: string;
  profileId: string;
}

type EquipmentTab = "compressor" | "condenser" | "evaporator";

const TABS: Array<{ key: EquipmentTab; label: string }> = [
  { key: "compressor", label: "Compressors" },
  { key: "condenser", label: "Condensers" },
  { key: "evaporator", label: "Evaporators" },
];

export function EquipmentSection({ state, dispatch, token, profileId }: SectionProps) {
  const [activeTab, setActiveTab] = useState<EquipmentTab>("compressor");

  const { save, status } = useAutoSave(
    async (payload: { index: number; equipment: EquipmentData }) => {
      const result = await upsertBaselineEquipment(token, profileId, payload.equipment);
      if (result && "id" in result && result.id && !payload.equipment.id) {
        dispatch({
          type: "UPDATE_EQUIPMENT",
          index: payload.index,
          equipment: { ...payload.equipment, id: result.id as string },
        });
      }
      if (result && "error" in result) return { error: result.error as string };
    },
    { debounceMs: 600 }
  );

  const getCategoryItems = useCallback(
    (category: EquipmentTab) => {
      return state.equipment
        .map((eq, originalIndex) => ({ ...eq, _index: originalIndex }))
        .filter((eq) => eq.category === category);
    },
    [state.equipment]
  );

  const handleAdd = useCallback(
    (category: EquipmentCategory) => {
      dispatch({ type: "ADD_EQUIPMENT", category });
    },
    [dispatch]
  );

  const handleDuplicate = useCallback(
    (index: number) => {
      dispatch({ type: "DUPLICATE_EQUIPMENT", index });
    },
    [dispatch]
  );

  const handleDelete = useCallback(
    async (index: number) => {
      const eq = state.equipment[index];
      if (eq?.id) {
        await deleteBaselineEquipment(token, profileId, eq.id);
      }
      dispatch({ type: "REMOVE_EQUIPMENT", index });
    },
    [state.equipment, token, profileId, dispatch]
  );

  const handleFieldChange = useCallback(
    (index: number, field: string, value: unknown) => {
      const eq = state.equipment[index];
      if (!eq) return;

      let updated: EquipmentData;

      // Check if this is a specs field
      const specsFields = [
        "type", "hp", "loop", "loading_summer", "loading_shoulder", "loading_winter",
        "vfd_equipped", "suction_setpoint_psig", "discharge_setpoint_psig",
        "total_fans", "total_hp_fan_and_pump",
        "num_units", "avg_fan_hp", "defrost_type",
      ];

      if (specsFields.includes(field)) {
        updated = {
          ...eq,
          specs: { ...eq.specs, [field]: value },
        };
      } else {
        updated = { ...eq, [field]: value };
      }

      dispatch({ type: "UPDATE_EQUIPMENT", index, equipment: updated });
      save({ index, equipment: updated });
    },
    [state.equipment, dispatch, save]
  );

  const loops = getAvailableLoops(state);
  const compressors = getCategoryItems("compressor");
  const condensers = getCategoryItems("condenser");
  const evaporators = getCategoryItems("evaporator");

  const counts: Record<EquipmentTab, number> = {
    compressor: compressors.length,
    condenser: condensers.length,
    evaporator: evaporators.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Equipment</h3>
          <p className="text-sm text-gray-500 mt-1">
            List your compressors, condensers, and evaporators.
          </p>
        </div>
        {status === "saving" && <span className="text-xs text-gray-400">Saving...</span>}
        {status === "saved" && <span className="text-xs text-green-600">Saved</span>}
        {status === "error" && <span className="text-xs text-red-600">Save failed</span>}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`
              relative px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2
              ${activeTab === tab.key
                ? "text-gray-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand-green"
                : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            {tab.label}
            <span
              className={`
                inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs
                ${activeTab === tab.key
                  ? "bg-brand-green/10 text-brand-green"
                  : "bg-gray-100 text-gray-500"
                }
              `}
            >
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Compressors Table */}
      {activeTab === "compressor" && (
        <div className="space-y-4">
          {compressors.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Tag</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Manufacturer</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">HP</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Loop</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600 whitespace-nowrap">VFD</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Summer %</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Shoulder %</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">Winter %</th>
                    <th className="px-3 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {compressors.map((eq) => {
                    const specs = eq.specs as CompressorSpecs;
                    return (
                      <tr key={eq.id || `idx-${eq._index}`} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-2 py-1.5">
                          <input
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            value={eq.name}
                            onChange={(e) => handleFieldChange(eq._index, "name", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            placeholder="Frick"
                            value={eq.manufacturer}
                            onChange={(e) => handleFieldChange(eq._index, "manufacturer", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            placeholder="200"
                            value={specs.hp ?? ""}
                            onChange={(e) =>
                              handleFieldChange(eq._index, "hp", e.target.value ? Number(e.target.value) : null)
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            value={specs.type}
                            onChange={(e) => handleFieldChange(eq._index, "type", e.target.value)}
                          >
                            <option value="">--</option>
                            <option value="screw">Screw</option>
                            <option value="reciprocating">Recip</option>
                            <option value="rotary">Rotary</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            value={specs.loop}
                            onChange={(e) => handleFieldChange(eq._index, "loop", e.target.value)}
                          >
                            <option value="">--</option>
                            {loops.map((l) => (
                              <option key={l.value} value={l.value}>
                                {l.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={specs.vfd_equipped}
                            onChange={(e) => handleFieldChange(eq._index, "vfd_equipped", e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-green focus:ring-brand-green"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            className="w-14 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            min={0}
                            max={100}
                            placeholder="100"
                            value={specs.loading_summer != null ? Math.round(specs.loading_summer * 100) : ""}
                            onChange={(e) =>
                              handleFieldChange(
                                eq._index,
                                "loading_summer",
                                e.target.value ? Number(e.target.value) / 100 : null
                              )
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            className="w-14 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            min={0}
                            max={100}
                            placeholder="75"
                            value={specs.loading_shoulder != null ? Math.round(specs.loading_shoulder * 100) : ""}
                            onChange={(e) =>
                              handleFieldChange(
                                eq._index,
                                "loading_shoulder",
                                e.target.value ? Number(e.target.value) / 100 : null
                              )
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            className="w-14 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            min={0}
                            max={100}
                            placeholder="50"
                            value={specs.loading_winter != null ? Math.round(specs.loading_winter * 100) : ""}
                            onChange={(e) =>
                              handleFieldChange(
                                eq._index,
                                "loading_winter",
                                e.target.value ? Number(e.target.value) / 100 : null
                              )
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicate(eq._index)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Duplicate"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(eq._index)}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
              <p className="text-sm text-gray-500">No compressors added yet</p>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => handleAdd("compressor")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Compressor
          </Button>
        </div>
      )}

      {/* Condensers Table */}
      {activeTab === "condenser" && (
        <div className="space-y-4">
          {condensers.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Tag</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Total Fans</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Total HP</th>
                    <th className="px-3 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {condensers.map((eq) => {
                    const specs = eq.specs as CondenserSpecs;
                    return (
                      <tr key={eq.id || `idx-${eq._index}`} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-2 py-1.5">
                          <input
                            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            value={eq.name}
                            onChange={(e) => handleFieldChange(eq._index, "name", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="w-28 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            value={specs.type}
                            onChange={(e) => handleFieldChange(eq._index, "type", e.target.value)}
                          >
                            <option value="">--</option>
                            <option value="evaporative">Evaporative</option>
                            <option value="air_cooled">Air Cooled</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            placeholder="4"
                            value={specs.total_fans ?? ""}
                            onChange={(e) =>
                              handleFieldChange(eq._index, "total_fans", e.target.value ? Number(e.target.value) : null)
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            placeholder="40"
                            value={specs.total_hp_fan_and_pump ?? ""}
                            onChange={(e) =>
                              handleFieldChange(
                                eq._index,
                                "total_hp_fan_and_pump",
                                e.target.value ? Number(e.target.value) : null
                              )
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicate(eq._index)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Duplicate"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(eq._index)}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
              <p className="text-sm text-gray-500">No condensers added yet</p>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => handleAdd("condenser")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Condenser
          </Button>
        </div>
      )}

      {/* Evaporators Table */}
      {activeTab === "evaporator" && (
        <div className="space-y-4">
          {evaporators.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Tag</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Type</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Units</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Avg Fan HP</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Defrost</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Loop</th>
                    <th className="px-3 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {evaporators.map((eq) => {
                    const specs = eq.specs as EvaporatorSpecs;
                    return (
                      <tr key={eq.id || `idx-${eq._index}`} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-2 py-1.5">
                          <input
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            value={eq.name}
                            onChange={(e) => handleFieldChange(eq._index, "name", e.target.value)}
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            value={specs.type}
                            onChange={(e) => handleFieldChange(eq._index, "type", e.target.value)}
                          >
                            <option value="">--</option>
                            <option value="unit_cooler">Unit Cooler</option>
                            <option value="pencoil">Pencoil</option>
                            <option value="plate">Plate</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            className="w-14 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            placeholder="4"
                            value={specs.num_units ?? ""}
                            onChange={(e) =>
                              handleFieldChange(eq._index, "num_units", e.target.value ? Number(e.target.value) : null)
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.1"
                            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            placeholder="1.5"
                            value={specs.avg_fan_hp ?? ""}
                            onChange={(e) =>
                              handleFieldChange(eq._index, "avg_fan_hp", e.target.value ? Number(e.target.value) : null)
                            }
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            value={specs.defrost_type}
                            onChange={(e) => handleFieldChange(eq._index, "defrost_type", e.target.value)}
                          >
                            <option value="">--</option>
                            <option value="electric">Electric</option>
                            <option value="hot_gas">Hot Gas</option>
                            <option value="air">Air</option>
                            <option value="none">None</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none"
                            value={specs.loop}
                            onChange={(e) => handleFieldChange(eq._index, "loop", e.target.value)}
                          >
                            <option value="">--</option>
                            {loops.map((l) => (
                              <option key={l.value} value={l.value}>
                                {l.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDuplicate(eq._index)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Duplicate"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(eq._index)}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Delete"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
              <p className="text-sm text-gray-500">No evaporators added yet</p>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => handleAdd("evaporator")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Evaporator
          </Button>
        </div>
      )}
    </div>
  );
}
