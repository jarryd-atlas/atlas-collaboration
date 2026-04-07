"use client";

import { useState, useCallback } from "react";
import type {
  BaselineFormState,
  BaselineFormAction,
  BaselineFormSection,
  CompressorSpecs,
} from "../../../../../../lib/baseline-form/types";
import {
  BASELINE_FORM_SECTIONS,
  SECTION_LABELS,
} from "../../../../../../lib/baseline-form/types";
import {
  getSectionCompletion,
  getOverallCompletion,
} from "../../../../../../lib/baseline-form/completion";
import { submitBaselineForm } from "../../../../../../lib/actions/baseline-form";
import { Button } from "../../../../../../components/ui/button";

interface SectionProps {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
  token: string;
  profileId: string;
}

function getCompletionColor(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 40) return "bg-yellow-400";
  return "bg-gray-300";
}

function getCompletionTextColor(pct: number): string {
  if (pct >= 80) return "text-green-600";
  if (pct >= 40) return "text-yellow-600";
  return "text-gray-400";
}

function getSectionSummary(section: BaselineFormSection, state: BaselineFormState): string {
  switch (section) {
    case "contact": {
      if (state.contacts.length === 0) return "No contacts added";
      const names = state.contacts.map((c) => c.name).filter(Boolean);
      return names.length > 0 ? names.join(", ") : "Names not filled in";
    }
    case "facility": {
      const parts: string[] = [];
      if (state.facility.facility_type) {
        parts.push(
          state.facility.facility_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        );
      }
      if (state.facility.runs_24_7) {
        parts.push("24/7");
      } else if (state.facility.daily_operational_hours) {
        parts.push(`${state.facility.daily_operational_hours}h/day`);
        if (state.facility.operating_days_per_week) {
          parts.push(`${state.facility.operating_days_per_week}d/wk`);
        }
      }
      return parts.length > 0 ? parts.join(" / ") : "Not configured";
    }
    case "system": {
      const parts: string[] = [];
      if (state.system.system_type) {
        parts.push(
          state.system.system_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        );
      }
      if (state.system.refrigerant) {
        parts.push(state.system.refrigerant === "ammonia" ? "Ammonia" : state.system.refrigerant);
      }
      return parts.length > 0 ? parts.join(" / ") : "Not configured";
    }
    case "equipment": {
      const compressors = state.equipment.filter((e) => e.category === "compressor").length;
      const condensers = state.equipment.filter((e) => e.category === "condenser").length;
      const evaporators = state.equipment.filter((e) => e.category === "evaporator").length;
      const parts: string[] = [];
      if (compressors > 0) parts.push(`${compressors} compressor${compressors !== 1 ? "s" : ""}`);
      if (condensers > 0) parts.push(`${condensers} condenser${condensers !== 1 ? "s" : ""}`);
      if (evaporators > 0) parts.push(`${evaporators} evaporator${evaporators !== 1 ? "s" : ""}`);
      return parts.length > 0 ? parts.join(", ") : "No equipment added";
    }
    case "documents":
      return "Optional";
    case "energy": {
      const parts: string[] = [];
      if (state.energy.supply_provider) parts.push(state.energy.supply_provider);
      if (state.energy.annual_energy_spend != null) {
        parts.push(`$${state.energy.annual_energy_spend.toLocaleString()}/yr`);
      }
      return parts.length > 0 ? parts.join(" / ") : "Not configured";
    }
    case "operations": {
      const parts: string[] = [];
      if (state.operations.suction_pressure_typical != null) {
        parts.push(`Suction: ${state.operations.suction_pressure_typical} psig`);
      }
      if (state.operations.discharge_pressure_typical != null) {
        parts.push(`Discharge: ${state.operations.discharge_pressure_typical} psig`);
      }
      return parts.length > 0 ? parts.join(" / ") : "Not configured";
    }
    case "efficiency": {
      const roles = state.efficiency.headcount.length;
      const totalPeople = state.efficiency.headcount.reduce(
        (sum, h) => sum + (h.count ?? 0),
        0
      );
      if (roles > 0) {
        return `${totalPeople} team member${totalPeople !== 1 ? "s" : ""} across ${roles} role${roles !== 1 ? "s" : ""}`;
      }
      return "Not configured";
    }
    case "review":
      return "";
    default:
      return "";
  }
}

export function ReviewSection({ state, dispatch, token, profileId }: SectionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const overallCompletion = getOverallCompletion(state);
  const reviewableSections = BASELINE_FORM_SECTIONS.filter((s) => s !== "review");

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitBaselineForm(token, profileId);
      if (result && "error" in result && result.error) {
        setSubmitError(result.error);
      } else {
        setIsSubmitted(true);
      }
    } catch (err) {
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [token, profileId]);

  if (isSubmitted) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-900">Thank you!</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Your CrossnoKaye representative will review this data. We&apos;ll reach out if we have any
          follow-up questions.
        </p>
        <p className="text-xs text-gray-400 mt-4">
          You can always come back and update your responses using this same link.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Review Your Responses</h3>
        <p className="text-sm text-gray-500 mt-1">
          Double-check your entries before confirming. You can always come back and update later.
        </p>
      </div>

      {/* Overall Completion */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Overall Completion</span>
          <span className={`text-sm font-semibold ${getCompletionTextColor(overallCompletion)}`}>
            {overallCompletion}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getCompletionColor(overallCompletion)}`}
            style={{ width: `${overallCompletion}%` }}
          />
        </div>
      </div>

      {/* Per-Section Summary */}
      <div className="space-y-2">
        {reviewableSections.map((section) => {
          const completion = getSectionCompletion(section, state);
          const summary = getSectionSummary(section, state);

          return (
            <button
              key={section}
              type="button"
              onClick={() => {
                const idx = BASELINE_FORM_SECTIONS.indexOf(section);
                dispatch({ type: "SET_SECTION", section: idx });
              }}
              className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors text-left"
            >
              {/* Completion indicator */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  completion >= 80
                    ? "bg-green-100"
                    : completion >= 40
                    ? "bg-yellow-100"
                    : "bg-gray-100"
                }`}
              >
                {completion >= 80 ? (
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className={`text-xs font-medium ${getCompletionTextColor(completion)}`}>
                    {completion}%
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">
                  {SECTION_LABELS[section]}
                </div>
                {summary && (
                  <div className="text-xs text-gray-500 truncate mt-0.5">{summary}</div>
                )}
              </div>

              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* Submit */}
      {submitError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        type="button"
        disabled={isSubmitting}
        onClick={handleSubmit}
        className="w-full"
      >
        {isSubmitting ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Submitting...
          </>
        ) : (
          "Looks Good"
        )}
      </Button>

      <p className="text-xs text-gray-400 text-center">
        You can always come back and update your responses using this same link.
      </p>
    </div>
  );
}
