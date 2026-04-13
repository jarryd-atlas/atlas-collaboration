"use client";

import { useCallback } from "react";
import type {
  BaselineFormState,
  BaselineFormAction,
  OperationsData,
} from "../../../../../../lib/baseline-form/types";
import { upsertBaselineOperations } from "../../../../../../lib/actions/baseline-form";
import { useAutoSave } from "../../../../../../lib/hooks/use-auto-save";
import { Input, Textarea } from "../../../../../../components/ui/input";

interface SectionProps {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
  token: string;
  profileId: string;
}

export function OperationsSection({ state, dispatch, token, profileId }: SectionProps) {
  const { save, status } = useAutoSave(
    async (ops: Partial<OperationsData>) => {
      const result = await upsertBaselineOperations(token, profileId, ops);
      if (result && "error" in result) return { error: result.error as string };
    },
    { debounceMs: 600 }
  );

  const updateOps = useCallback(
    (field: keyof OperationsData, value: unknown) => {
      dispatch({ type: "SET_OPERATIONS", operations: { [field]: value } as Partial<OperationsData> });
    },
    [dispatch]
  );

  const saveField = useCallback(
    (field: keyof OperationsData) => {
      save({ [field]: state.operations[field] } as Partial<OperationsData>);
    },
    [save, state.operations]
  );

  const ops = state.operations;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Operations</h3>
          <p className="text-sm text-gray-500 mt-1">
            Tell us about your operating pressures and constraints.
          </p>
        </div>
        {status === "saving" && <span className="text-xs text-gray-400">Saving...</span>}
        {status === "saved" && <span className="text-xs text-green-600">Saved</span>}
        {status === "error" && <span className="text-xs text-red-600">Save failed</span>}
      </div>

      {/* Pressures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Suction Pressure (psig)"
          type="number"
          step="0.1"
          placeholder="18.0"
          value={ops.suction_pressure_typical ?? ""}
          onChange={(e) =>
            updateOps("suction_pressure_typical", e.target.value ? Number(e.target.value) : null)
          }
          onBlur={() => saveField("suction_pressure_typical")}
        />
        <Input
          label="Discharge Pressure (psig)"
          type="number"
          step="0.1"
          placeholder="165.0"
          value={ops.discharge_pressure_typical ?? ""}
          onChange={(e) =>
            updateOps("discharge_pressure_typical", e.target.value ? Number(e.target.value) : null)
          }
          onBlur={() => saveField("discharge_pressure_typical")}
        />
      </div>

      {/* Can shed load */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <label className="flex items-center gap-3 cursor-pointer group">
          <button
            type="button"
            role="switch"
            aria-checked={ops.can_shed_load}
            onClick={() => {
              const newVal = !ops.can_shed_load;
              updateOps("can_shed_load", newVal);
              save({ can_shed_load: newVal });
            }}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0
              ${ops.can_shed_load ? "bg-brand-green" : "bg-gray-200"}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm
                ${ops.can_shed_load ? "translate-x-6" : "translate-x-1"}
              `}
            />
          </button>
          <div>
            <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
              Can you shed load?
            </span>
            <p className="text-xs text-gray-500">
              Can you reduce compressor load during peak demand periods?
            </p>
          </div>
        </label>

        {ops.can_shed_load && (
          <Textarea
            label="Load shedding constraints"
            placeholder="Describe any constraints on load shedding (e.g., product temperature limits, minimum runtime requirements)..."
            rows={3}
            value={ops.operational_nuances}
            onChange={(e) => updateOps("operational_nuances", e.target.value)}
            onBlur={() => saveField("operational_nuances")}
          />
        )}
      </div>

      {/* Can shutdown compressors */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <label className="flex items-center gap-3 cursor-pointer group">
          <button
            type="button"
            role="switch"
            aria-checked={ops.can_shutdown}
            onClick={() => {
              const newVal = !ops.can_shutdown;
              updateOps("can_shutdown", newVal);
              save({ can_shutdown: newVal });
            }}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0
              ${ops.can_shutdown ? "bg-brand-green" : "bg-gray-200"}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm
                ${ops.can_shutdown ? "translate-x-6" : "translate-x-1"}
              `}
            />
          </button>
          <div>
            <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
              Can you shut down compressors?
            </span>
            <p className="text-xs text-gray-500">
              Can any compressors be fully shut down during low-demand periods?
            </p>
          </div>
        </label>

        {ops.can_shutdown && (
          <Textarea
            label="Shutdown constraints"
            placeholder="Describe constraints (e.g., minimum one compressor must remain online, seasonal shutdown windows)..."
            rows={3}
            value={ops.shutdown_constraints}
            onChange={(e) => updateOps("shutdown_constraints", e.target.value)}
            onBlur={() => saveField("shutdown_constraints")}
          />
        )}
      </div>

      {/* Curtailment */}
      <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4">
        <label className="flex items-center gap-3 cursor-pointer group">
          <button
            type="button"
            role="switch"
            aria-checked={ops.curtailment_enrolled}
            onClick={() => {
              const newVal = !ops.curtailment_enrolled;
              updateOps("curtailment_enrolled", newVal);
              save({ curtailment_enrolled: newVal });
            }}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0
              ${ops.curtailment_enrolled ? "bg-brand-green" : "bg-gray-200"}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm
                ${ops.curtailment_enrolled ? "translate-x-6" : "translate-x-1"}
              `}
            />
          </button>
          <div>
            <span className="text-sm text-gray-700 group-hover:text-gray-900 font-medium">
              Enrolled in curtailment program?
            </span>
            <p className="text-xs text-gray-500">
              Are you enrolled in a utility curtailment or demand response program?
            </p>
          </div>
        </label>

        {ops.curtailment_enrolled && (
          <>
            <Input
              label="Curtailment Frequency"
              placeholder="e.g., 5-10 events/year"
              value={ops.curtailment_frequency}
              onChange={(e) => updateOps("curtailment_frequency", e.target.value)}
              onBlur={() => saveField("curtailment_frequency")}
            />
            <Textarea
              label="Barriers or considerations"
              placeholder="Describe any barriers or constraints with curtailment participation..."
              rows={3}
              value={ops.curtailment_barriers}
              onChange={(e) => updateOps("curtailment_barriers", e.target.value)}
              onBlur={() => saveField("curtailment_barriers")}
            />
          </>
        )}
      </div>

      {/* Products & Customer Mix */}
      <Textarea
        label="Products / Goods Stored"
        placeholder="e.g., Frozen meats, dairy products, ice cream..."
        rows={3}
        value={ops.product_notes}
        onChange={(e) => updateOps("product_notes", e.target.value)}
        onBlur={() => saveField("product_notes")}
      />

      <Textarea
        label="Customer Mix"
        placeholder="What types of customers do you serve?"
        rows={3}
        value={ops.customer_mix}
        onChange={(e) => updateOps("customer_mix", e.target.value)}
        onBlur={() => saveField("customer_mix")}
      />

      {/* Seasonality */}
      <Textarea
        label="Seasonality Notes"
        placeholder="Describe any seasonal patterns in your operation (e.g., harvest season peaks, winter slowdowns)..."
        rows={3}
        value={ops.seasonality_notes}
        onChange={(e) => updateOps("seasonality_notes", e.target.value)}
        onBlur={() => saveField("seasonality_notes")}
      />

      {/* Temperature Challenges */}
      <Textarea
        label="Temperature Challenges"
        placeholder="Describe any temperature management challenges (e.g., hot spots, uneven cooling, defrost issues)..."
        rows={3}
        value={ops.temperature_challenges}
        onChange={(e) => updateOps("temperature_challenges", e.target.value)}
        onBlur={() => saveField("temperature_challenges")}
      />

      {/* Staffing */}
      <Textarea
        label="Staffing Notes"
        placeholder="Staffing levels, shifts, seasonal labor changes..."
        rows={3}
        value={ops.staffing_notes}
        onChange={(e) => updateOps("staffing_notes", e.target.value)}
        onBlur={() => saveField("staffing_notes")}
      />
    </div>
  );
}
