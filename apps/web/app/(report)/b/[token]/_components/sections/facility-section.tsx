"use client";

import { useCallback } from "react";
import type {
  BaselineFormState,
  BaselineFormAction,
  FacilityData,
} from "../../../../../../lib/baseline-form/types";
import { upsertBaselineFacilityAndSystem } from "../../../../../../lib/actions/baseline-form";
import { useAutoSave } from "../../../../../../lib/hooks/use-auto-save";
import { Textarea } from "../../../../../../components/ui/input";
import { Input } from "../../../../../../components/ui/input";

interface SectionProps {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
  token: string;
  profileId: string;
}

const FACILITY_TYPE_OPTIONS: Array<{
  value: FacilityData["facility_type"];
  label: string;
  icon: string;
  description: string;
}> = [
  {
    value: "cold_storage",
    label: "Cold Storage",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
    description: "Warehousing & storage",
  },
  {
    value: "processing",
    label: "Processing",
    icon: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
    description: "Food processing & packaging",
  },
  {
    value: "distribution",
    label: "Distribution",
    icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
    description: "Distribution & logistics",
  },
  {
    value: "mixed",
    label: "Mixed Use",
    icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    description: "Multiple operations",
  },
];

export function FacilitySection({ state, dispatch, token, profileId }: SectionProps) {
  const { save, status } = useAutoSave(
    async (facility: Partial<FacilityData>) => {
      const result = await upsertBaselineFacilityAndSystem(token, profileId, facility, {});
      if (result && "error" in result) return { error: result.error as string };
    },
    { debounceMs: 600 }
  );

  const updateFacility = useCallback(
    (updates: Partial<FacilityData>) => {
      dispatch({ type: "SET_FACILITY", facility: updates });
      save(updates);
    },
    [dispatch, save]
  );

  const facility = state.facility;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Your Facility</h3>
          <p className="text-sm text-gray-500 mt-1">
            Help us understand the type of facility and how it operates.
          </p>
        </div>
        {status === "saving" && <span className="text-xs text-gray-400">Saving...</span>}
        {status === "saved" && <span className="text-xs text-green-600">Saved</span>}
        {status === "error" && <span className="text-xs text-red-600">Save failed</span>}
      </div>

      {/* Facility Type Cards */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          What type of facility is this?
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FACILITY_TYPE_OPTIONS.map((option) => {
            const isSelected = facility.facility_type === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateFacility({ facility_type: option.value as FacilityData["facility_type"] })}
                className={`
                  relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all
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

      {/* Product Notes */}
      <Textarea
        label="What do you store or process at this facility?"
        placeholder="e.g., Frozen poultry, ice cream, produce staging..."
        rows={3}
        value={facility.product_notes}
        onChange={(e) => dispatch({ type: "SET_FACILITY", facility: { product_notes: e.target.value } })}
        onBlur={() => save({ product_notes: facility.product_notes })}
      />

      {/* Operating Schedule */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <h4 className="text-sm font-medium text-gray-700">Operating Schedule</h4>

        {/* 24/7 Toggle */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <button
            type="button"
            role="switch"
            aria-checked={facility.runs_24_7}
            onClick={() => updateFacility({ runs_24_7: !facility.runs_24_7 })}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${facility.runs_24_7 ? "bg-brand-green" : "bg-gray-200"}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm
                ${facility.runs_24_7 ? "translate-x-6" : "translate-x-1"}
              `}
            />
          </button>
          <span className="text-sm text-gray-700 group-hover:text-gray-900">
            This facility runs 24/7
          </span>
        </label>

        {/* Conditional hours/days inputs */}
        {!facility.runs_24_7 && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Input
              label="Hours per day"
              type="number"
              min={1}
              max={24}
              placeholder="16"
              value={facility.daily_operational_hours ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "SET_FACILITY",
                  facility: {
                    daily_operational_hours: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
              onBlur={() =>
                save({ daily_operational_hours: facility.daily_operational_hours })
              }
            />
            <Input
              label="Days per week"
              type="number"
              min={1}
              max={7}
              placeholder="5"
              value={facility.operating_days_per_week ?? ""}
              onChange={(e) =>
                dispatch({
                  type: "SET_FACILITY",
                  facility: {
                    operating_days_per_week: e.target.value ? Number(e.target.value) : null,
                  },
                })
              }
              onBlur={() =>
                save({ operating_days_per_week: facility.operating_days_per_week })
              }
            />
          </div>
        )}
      </div>

      {/* Blast Freezing Toggle */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white">
        <label className="flex items-center gap-3 cursor-pointer group">
          <button
            type="button"
            role="switch"
            aria-checked={facility.has_blast_freezing}
            onClick={() => updateFacility({ has_blast_freezing: !facility.has_blast_freezing })}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${facility.has_blast_freezing ? "bg-brand-green" : "bg-gray-200"}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm
                ${facility.has_blast_freezing ? "translate-x-6" : "translate-x-1"}
              `}
            />
          </button>
          <div>
            <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
              Blast Freezing
            </span>
            <p className="text-xs text-gray-500">Does this facility have blast freezing capability?</p>
          </div>
        </label>
      </div>
    </div>
  );
}
