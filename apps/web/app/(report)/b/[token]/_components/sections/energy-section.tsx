"use client";

import { useState, useCallback } from "react";
import type {
  BaselineFormState,
  BaselineFormAction,
  EnergyData,
} from "../../../../../../lib/baseline-form/types";
import { upsertBaselineEnergy } from "../../../../../../lib/actions/baseline-form";
import { useAutoSave } from "../../../../../../lib/hooks/use-auto-save";
import { Input, Select } from "../../../../../../components/ui/input";
import { DEMAND_RESPONSE_STATUSES, DEMAND_RESPONSE_LABELS } from "@repo/shared/constants";

interface SectionProps {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
  token: string;
  profileId: string;
}

const HOUR_OPTIONS = [
  { value: "", label: "Select..." },
  ...Array.from({ length: 24 }, (_, i) => ({
    value: String(i),
    label: `${i === 0 ? "12" : i > 12 ? String(i - 12) : String(i)}:00 ${i < 12 ? "AM" : "PM"}`,
  })),
];

const DEMAND_RESPONSE_OPTIONS = [
  { value: "", label: "Select..." },
  ...DEMAND_RESPONSE_STATUSES.map((s) => ({
    value: s,
    label: DEMAND_RESPONSE_LABELS[s],
  })),
];

export function EnergySection({ state, dispatch, token, profileId }: SectionProps) {
  const [showShoulder, setShowShoulder] = useState(
    state.energy.shoulder_energy_rate != null || state.energy.shoulder_demand_rate != null
  );

  const { save, status } = useAutoSave(
    async (energy: Partial<EnergyData>) => {
      const result = await upsertBaselineEnergy(token, profileId, energy);
      if (result && "error" in result) return { error: result.error as string };
    },
    { debounceMs: 600 }
  );

  const updateEnergy = useCallback(
    (field: keyof EnergyData, value: string | number | null) => {
      dispatch({ type: "SET_ENERGY", energy: { [field]: value } });
    },
    [dispatch]
  );

  const saveField = useCallback(
    (field: keyof EnergyData) => {
      save({ [field]: state.energy[field] });
    },
    [save, state.energy]
  );

  const energy = state.energy;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Energy & Utility</h3>
          <p className="text-sm text-gray-500 mt-1">
            Share your utility provider and rate structure details.
          </p>
        </div>
        {status === "saving" && <span className="text-xs text-gray-400">Saving...</span>}
        {status === "saved" && <span className="text-xs text-green-600">Saved</span>}
        {status === "error" && <span className="text-xs text-red-600">Save failed</span>}
      </div>

      {/* Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Supply Provider"
          placeholder="e.g., AES Ohio, Duke Energy"
          value={energy.supply_provider}
          onChange={(e) => updateEnergy("supply_provider", e.target.value)}
          onBlur={() => saveField("supply_provider")}
        />
        <Input
          label="Distribution Provider"
          placeholder="e.g., AES Ohio, local co-op"
          value={energy.distribution_provider}
          onChange={(e) => updateEnergy("distribution_provider", e.target.value)}
          onBlur={() => saveField("distribution_provider")}
        />
      </div>

      {/* On-Peak */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <h4 className="text-sm font-semibold text-gray-900">On-Peak Rates</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Select
            label="Start Hour"
            options={HOUR_OPTIONS}
            value={energy.on_peak_start_hour != null ? String(energy.on_peak_start_hour) : ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              updateEnergy("on_peak_start_hour", val);
              save({ on_peak_start_hour: val });
            }}
          />
          <Select
            label="End Hour"
            options={HOUR_OPTIONS}
            value={energy.on_peak_end_hour != null ? String(energy.on_peak_end_hour) : ""}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              updateEnergy("on_peak_end_hour", val);
              save({ on_peak_end_hour: val });
            }}
          />
          <Input
            label="Months"
            placeholder="Jun-Sep"
            value={energy.on_peak_months}
            onChange={(e) => updateEnergy("on_peak_months", e.target.value)}
            onBlur={() => saveField("on_peak_months")}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Energy Rate ($/kWh)"
            type="number"
            step="0.001"
            placeholder="0.085"
            value={energy.on_peak_energy_rate ?? ""}
            onChange={(e) =>
              updateEnergy("on_peak_energy_rate", e.target.value ? Number(e.target.value) : null)
            }
            onBlur={() => saveField("on_peak_energy_rate")}
          />
          <Input
            label="Demand Rate ($/kW)"
            type="number"
            step="0.01"
            placeholder="12.50"
            value={energy.on_peak_demand_rate ?? ""}
            onChange={(e) =>
              updateEnergy("on_peak_demand_rate", e.target.value ? Number(e.target.value) : null)
            }
            onBlur={() => saveField("on_peak_demand_rate")}
          />
        </div>
      </div>

      {/* Off-Peak */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <h4 className="text-sm font-semibold text-gray-900">Off-Peak Rates</h4>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Energy Rate ($/kWh)"
            type="number"
            step="0.001"
            placeholder="0.045"
            value={energy.off_peak_energy_rate ?? ""}
            onChange={(e) =>
              updateEnergy("off_peak_energy_rate", e.target.value ? Number(e.target.value) : null)
            }
            onBlur={() => saveField("off_peak_energy_rate")}
          />
          <Input
            label="Demand Rate ($/kW)"
            type="number"
            step="0.01"
            placeholder="8.00"
            value={energy.off_peak_demand_rate ?? ""}
            onChange={(e) =>
              updateEnergy("off_peak_demand_rate", e.target.value ? Number(e.target.value) : null)
            }
            onBlur={() => saveField("off_peak_demand_rate")}
          />
        </div>
      </div>

      {/* Shoulder Rates (collapsible) */}
      {!showShoulder ? (
        <button
          type="button"
          onClick={() => setShowShoulder(true)}
          className="text-sm text-brand-green hover:text-brand-green/80 font-medium transition-colors"
        >
          + Add shoulder rates
        </button>
      ) : (
        <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">Shoulder Rates</h4>
            <button
              type="button"
              onClick={() => {
                setShowShoulder(false);
                dispatch({
                  type: "SET_ENERGY",
                  energy: {
                    shoulder_energy_rate: null,
                    shoulder_demand_rate: null,
                    shoulder_start_hour: null,
                    shoulder_end_hour: null,
                    shoulder_months: "",
                  },
                });
                save({
                  shoulder_energy_rate: null,
                  shoulder_demand_rate: null,
                  shoulder_start_hour: null,
                  shoulder_end_hour: null,
                  shoulder_months: "",
                });
              }}
              className="text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              Remove
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Select
              label="Start Hour"
              options={HOUR_OPTIONS}
              value={energy.shoulder_start_hour != null ? String(energy.shoulder_start_hour) : ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                updateEnergy("shoulder_start_hour", val);
                save({ shoulder_start_hour: val });
              }}
            />
            <Select
              label="End Hour"
              options={HOUR_OPTIONS}
              value={energy.shoulder_end_hour != null ? String(energy.shoulder_end_hour) : ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                updateEnergy("shoulder_end_hour", val);
                save({ shoulder_end_hour: val });
              }}
            />
            <Input
              label="Months"
              placeholder="Apr-May, Oct-Nov"
              value={energy.shoulder_months}
              onChange={(e) => updateEnergy("shoulder_months", e.target.value)}
              onBlur={() => saveField("shoulder_months")}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Energy Rate ($/kWh)"
              type="number"
              step="0.001"
              placeholder="0.065"
              value={energy.shoulder_energy_rate ?? ""}
              onChange={(e) =>
                updateEnergy("shoulder_energy_rate", e.target.value ? Number(e.target.value) : null)
              }
              onBlur={() => saveField("shoulder_energy_rate")}
            />
            <Input
              label="Demand Rate ($/kW)"
              type="number"
              step="0.01"
              placeholder="10.00"
              value={energy.shoulder_demand_rate ?? ""}
              onChange={(e) =>
                updateEnergy("shoulder_demand_rate", e.target.value ? Number(e.target.value) : null)
              }
              onBlur={() => saveField("shoulder_demand_rate")}
            />
          </div>
        </div>
      )}

      {/* Demand Response */}
      <Select
        label="Demand Response Program"
        options={DEMAND_RESPONSE_OPTIONS}
        value={energy.demand_response_status}
        onChange={(e) => {
          updateEnergy("demand_response_status", e.target.value);
          save({ demand_response_status: e.target.value as EnergyData["demand_response_status"] || "" });
        }}
      />

      {/* Annual Energy Spend */}
      <Input
        label="Annual Energy Spend ($)"
        type="number"
        step="100"
        placeholder="500000"
        value={energy.annual_energy_spend ?? ""}
        onChange={(e) =>
          updateEnergy("annual_energy_spend", e.target.value ? Number(e.target.value) : null)
        }
        onBlur={() => saveField("annual_energy_spend")}
      />
    </div>
  );
}
