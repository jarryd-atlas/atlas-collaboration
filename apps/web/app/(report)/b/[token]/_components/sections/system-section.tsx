"use client";

import { useCallback } from "react";
import type {
  BaselineFormState,
  BaselineFormAction,
  SystemData,
} from "../../../../../../lib/baseline-form/types";
import { upsertBaselineFacilityAndSystem } from "../../../../../../lib/actions/baseline-form";
import { useAutoSave } from "../../../../../../lib/hooks/use-auto-save";
import { Input, Select } from "../../../../../../components/ui/input";
import { REFRIGERANTS } from "@repo/shared/constants";

interface SectionProps {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
  token: string;
  profileId: string;
}

const SYSTEM_TYPE_OPTIONS: Array<{
  value: SystemData["system_type"];
  label: string;
  icon: string;
  description: string;
}> = [
  {
    value: "single_stage",
    label: "Single Stage",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    description: "One compression stage",
  },
  {
    value: "two_stage",
    label: "Two Stage",
    icon: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z",
    description: "Low + high stage compression",
  },
  {
    value: "cascade",
    label: "Cascade",
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    description: "Two separate refrigerant loops",
  },
];

const REFRIGERANT_OPTIONS = [
  { value: "", label: "Select refrigerant..." },
  ...REFRIGERANTS.map((r) => ({ value: r, label: r === "ammonia" ? "Ammonia (R-717)" : r })),
];

export function SystemSection({ state, dispatch, token, profileId }: SectionProps) {
  const { save, status } = useAutoSave(
    async (system: Partial<SystemData>) => {
      const result = await upsertBaselineFacilityAndSystem(token, profileId, {}, system);
      if (result && "error" in result) return { error: result.error as string };
    },
    { debounceMs: 600 }
  );

  const updateSystem = useCallback(
    (updates: Partial<SystemData>) => {
      dispatch({ type: "SET_SYSTEM", system: updates });
      save(updates);
    },
    [dispatch, save]
  );

  const system = state.system;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Refrigeration System</h3>
          <p className="text-sm text-gray-500 mt-1">
            Describe your refrigeration system configuration.
          </p>
        </div>
        {status === "saving" && <span className="text-xs text-gray-400">Saving...</span>}
        {status === "saved" && <span className="text-xs text-green-600">Saved</span>}
        {status === "error" && <span className="text-xs text-red-600">Save failed</span>}
      </div>

      {/* System Type Cards */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          System Type
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SYSTEM_TYPE_OPTIONS.map((option) => {
            const isSelected = system.system_type === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateSystem({ system_type: option.value as SystemData["system_type"] })}
                className={`
                  relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-all
                  ${isSelected
                    ? "border-brand-green bg-brand-green/5 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                  }
                `}
              >
                <div
                  className={`
                    w-10 h-10 rounded-lg flex items-center justify-center
                    ${isSelected ? "bg-brand-green/10" : "bg-gray-100"}
                  `}
                >
                  <svg
                    className={`w-5 h-5 ${isSelected ? "text-brand-green" : "text-gray-500"}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={option.icon} />
                  </svg>
                </div>
                <span className={`text-sm font-medium ${isSelected ? "text-gray-900" : "text-gray-700"}`}>
                  {option.label}
                </span>
                <span className="text-xs text-gray-500">{option.description}</span>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-4 h-4 text-brand-green" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Refrigerant */}
      <Select
        label="Primary Refrigerant"
        options={REFRIGERANT_OPTIONS}
        value={system.refrigerant}
        onChange={(e) => updateSystem({ refrigerant: e.target.value })}
      />

      {/* Control System & Hardware */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Control System"
          placeholder="e.g., Frick, Logix, GEA"
          value={system.control_system}
          onChange={(e) =>
            dispatch({ type: "SET_SYSTEM", system: { control_system: e.target.value } })
          }
          onBlur={() => save({ control_system: system.control_system })}
        />
        <Input
          label="Control Hardware"
          placeholder="e.g., Opto 22, Allen Bradley"
          value={system.control_hardware}
          onChange={(e) =>
            dispatch({ type: "SET_SYSTEM", system: { control_hardware: e.target.value } })
          }
          onBlur={() => save({ control_hardware: system.control_hardware })}
        />
      </div>
    </div>
  );
}
