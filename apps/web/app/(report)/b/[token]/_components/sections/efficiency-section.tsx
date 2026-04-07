"use client";

import { useCallback } from "react";
import type {
  BaselineFormState,
  BaselineFormAction,
  EfficiencyData,
  HeadcountEntry,
} from "../../../../../../lib/baseline-form/types";
import { emptyHeadcount } from "../../../../../../lib/baseline-form/defaults";
import { upsertBaselineEfficiency } from "../../../../../../lib/actions/baseline-form";
import { useAutoSave } from "../../../../../../lib/hooks/use-auto-save";
import { Input, Textarea, Select } from "../../../../../../components/ui/input";
import { Button } from "../../../../../../components/ui/button";
import { LABOR_ROLES, LABOR_ROLE_LABELS } from "@repo/shared/constants";

interface SectionProps {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
  token: string;
  profileId: string;
}

const ROLE_OPTIONS = [
  { value: "", label: "Select role..." },
  ...LABOR_ROLES.map((r) => ({ value: r, label: LABOR_ROLE_LABELS[r] })),
];

export function EfficiencySection({ state, dispatch, token, profileId }: SectionProps) {
  const { save, status } = useAutoSave(
    async (efficiency: Partial<EfficiencyData>) => {
      const result = await upsertBaselineEfficiency(token, profileId, efficiency);
      if (result && "error" in result) return { error: result.error as string };
    },
    { debounceMs: 600 }
  );

  const handleHeadcountChange = useCallback(
    (index: number, field: keyof HeadcountEntry, value: unknown) => {
      const updated = { ...state.efficiency.headcount[index]!, [field]: value };
      dispatch({ type: "UPDATE_HEADCOUNT", index, entry: updated });
      const newHeadcount = [...state.efficiency.headcount];
      newHeadcount[index] = updated;
      save({ headcount: newHeadcount });
    },
    [state.efficiency.headcount, dispatch, save]
  );

  const handleAddRole = useCallback(() => {
    dispatch({ type: "ADD_HEADCOUNT" });
  }, [dispatch]);

  const handleRemoveRole = useCallback(
    (index: number) => {
      dispatch({ type: "REMOVE_HEADCOUNT", index });
      const newHeadcount = state.efficiency.headcount.filter((_, i) => i !== index);
      save({ headcount: newHeadcount });
    },
    [state.efficiency.headcount, dispatch, save]
  );

  const updateTextField = useCallback(
    (field: keyof EfficiencyData, value: string) => {
      dispatch({ type: "SET_EFFICIENCY", efficiency: { [field]: value } });
    },
    [dispatch]
  );

  const saveTextField = useCallback(
    (field: keyof EfficiencyData) => {
      save({ [field]: state.efficiency[field] } as Partial<EfficiencyData>);
    },
    [save, state.efficiency]
  );

  const efficiency = state.efficiency;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Efficiency & Automation</h3>
          <p className="text-sm text-gray-500 mt-1">
            Understanding your team&apos;s workflow helps us configure ATLAS to maximize efficiency
            and reduce repetitive tasks.
          </p>
        </div>
        {status === "saving" && <span className="text-xs text-gray-400">Saving...</span>}
        {status === "saved" && <span className="text-xs text-green-600">Saved</span>}
        {status === "error" && <span className="text-xs text-red-600">Save failed</span>}
      </div>

      {/* Team Headcount */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-900">Your Team</h4>

        {efficiency.headcount.map((entry, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-xl p-4 bg-white"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
                <Select
                  label="Role"
                  options={ROLE_OPTIONS}
                  value={entry.role}
                  onChange={(e) => handleHeadcountChange(index, "role", e.target.value)}
                />
                <Input
                  label="Team Members"
                  type="number"
                  min={1}
                  placeholder="3"
                  value={entry.count ?? ""}
                  onChange={(e) =>
                    handleHeadcountChange(
                      index,
                      "count",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
                <Input
                  label="Weekly Hours"
                  type="number"
                  min={1}
                  max={168}
                  placeholder="40"
                  value={entry.hours_per_week ?? ""}
                  onChange={(e) =>
                    handleHeadcountChange(
                      index,
                      "hours_per_week",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveRole(index)}
                className="mt-6 p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                title="Remove role"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={handleAddRole}
          className="border-dashed"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Role
        </Button>
      </div>

      {/* Qualitative Questions */}
      <div className="space-y-6 pt-4 border-t border-gray-200">
        <div>
          <Textarea
            label="Biggest Day-to-Day Challenges"
            placeholder="What takes the most time or causes the most frustration in managing your refrigeration system?"
            rows={4}
            value={efficiency.pain_points}
            onChange={(e) => updateTextField("pain_points", e.target.value)}
            onBlur={() => saveTextField("pain_points")}
          />
        </div>

        <div>
          <Textarea
            label="Manual Processes"
            placeholder="Which tasks still require manual intervention that you wish were automated?"
            rows={4}
            value={efficiency.manual_processes}
            onChange={(e) => updateTextField("manual_processes", e.target.value)}
            onBlur={() => saveTextField("manual_processes")}
          />
        </div>

        <div>
          <Textarea
            label="Most Time-Intensive Tasks"
            placeholder="What routine tasks consume the most operator hours each week?"
            rows={4}
            value={efficiency.time_sinks}
            onChange={(e) => updateTextField("time_sinks", e.target.value)}
            onBlur={() => saveTextField("time_sinks")}
          />
        </div>

        <div>
          <Textarea
            label="Automation Wishlist"
            placeholder="If you could wave a magic wand, what would you automate first?"
            rows={4}
            value={efficiency.automation_opportunities}
            onChange={(e) => updateTextField("automation_opportunities", e.target.value)}
            onBlur={() => saveTextField("automation_opportunities")}
          />
        </div>
      </div>
    </div>
  );
}
