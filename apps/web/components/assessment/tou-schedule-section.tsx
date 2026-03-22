"use client";

import { useState, useCallback } from "react";
import { updateTouSchedule, updateRateStructure } from "../../lib/actions/assessment";
import { Clock, DollarSign } from "lucide-react";

interface TouScheduleSectionProps {
  assessment: any;
  touSchedule: any;
  rateStructure: any;
  siteId: string;
  tenantId: string;
  isLocked: boolean;
}

export function TouScheduleSection({
  assessment,
  touSchedule,
  rateStructure,
  siteId,
  tenantId,
  isLocked,
}: TouScheduleSectionProps) {
  const [saving, setSaving] = useState(false);

  const saveTou = useCallback(
    async (field: string, value: string | number | null) => {
      if (!assessment) return;
      setSaving(true);
      try {
        await updateTouSchedule(assessment.id, siteId, tenantId, { [field]: value });
      } finally {
        setSaving(false);
      }
    },
    [assessment, siteId, tenantId],
  );

  const saveRate = useCallback(
    async (field: string, value: string | number | null) => {
      if (!assessment) return;
      setSaving(true);
      try {
        await updateRateStructure(assessment.id, siteId, tenantId, { [field]: value });
      } finally {
        setSaving(false);
      }
    },
    [assessment, siteId, tenantId],
  );

  function handleBlurNumeric(field: string, save: typeof saveTou) {
    return (e: React.FocusEvent<HTMLInputElement>) => {
      const v = e.target.value.trim();
      save(field, v === "" ? null : parseFloat(v));
    };
  }

  function handleBlurText(field: string, save: typeof saveTou) {
    return (e: React.FocusEvent<HTMLInputElement>) => {
      const v = e.target.value.trim();
      save(field, v || null);
    };
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1";

  return (
    <div className="space-y-6">
      {/* Providers */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-900">Rate Schedule & Providers</h4>
          {saving && <span className="text-xs text-gray-400">Saving...</span>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Supply Provider</label>
            <input
              type="text"
              className={inputClass}
              defaultValue={touSchedule?.supply_provider ?? rateStructure?.utility_provider_supply ?? ""}
              placeholder="e.g. Constellation"
              disabled={isLocked}
              onBlur={handleBlurText("supply_provider", saveTou)}
            />
          </div>
          <div>
            <label className={labelClass}>Distribution Provider</label>
            <input
              type="text"
              className={inputClass}
              defaultValue={touSchedule?.distribution_provider ?? rateStructure?.utility_provider_distribution ?? ""}
              placeholder="e.g. Delmarva Power"
              disabled={isLocked}
              onBlur={handleBlurText("distribution_provider", saveTou)}
            />
          </div>
        </div>
      </div>

      {/* TOU Periods */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card space-y-5">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-900">Time-of-Use Periods</h4>
        </div>

        {/* On-Peak */}
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-red-600 uppercase tracking-wide">On-Peak</h5>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className={labelClass}>Energy Rate ($/kWh)</label>
              <input
                type="number"
                step="0.001"
                className={inputClass}
                defaultValue={touSchedule?.on_peak_energy_rate ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("on_peak_energy_rate", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>Demand Rate ($/kW)</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                defaultValue={touSchedule?.on_peak_demand_rate ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("on_peak_demand_rate", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>Start Hour</label>
              <input
                type="number"
                min="0"
                max="23"
                className={inputClass}
                defaultValue={touSchedule?.on_peak_start_hour ?? ""}
                placeholder="e.g. 8"
                disabled={isLocked}
                onBlur={handleBlurNumeric("on_peak_start_hour", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>End Hour</label>
              <input
                type="number"
                min="0"
                max="23"
                className={inputClass}
                defaultValue={touSchedule?.on_peak_end_hour ?? ""}
                placeholder="e.g. 21"
                disabled={isLocked}
                onBlur={handleBlurNumeric("on_peak_end_hour", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>Months</label>
              <input
                type="text"
                className={inputClass}
                defaultValue={touSchedule?.on_peak_months ?? ""}
                placeholder="e.g. Jun-Sep"
                disabled={isLocked}
                onBlur={handleBlurText("on_peak_months", saveTou)}
              />
            </div>
          </div>
        </div>

        {/* Off-Peak */}
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-green-600 uppercase tracking-wide">Off-Peak</h5>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className={labelClass}>Energy Rate ($/kWh)</label>
              <input
                type="number"
                step="0.001"
                className={inputClass}
                defaultValue={touSchedule?.off_peak_energy_rate ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("off_peak_energy_rate", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>Demand Rate ($/kW)</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                defaultValue={touSchedule?.off_peak_demand_rate ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("off_peak_demand_rate", saveTou)}
              />
            </div>
            <div className="col-span-3 flex items-end text-xs text-gray-400 pb-2">
              All hours not covered by on-peak or shoulder
            </div>
          </div>
        </div>

        {/* Shoulder */}
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Shoulder (optional)</h5>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className={labelClass}>Energy Rate ($/kWh)</label>
              <input
                type="number"
                step="0.001"
                className={inputClass}
                defaultValue={touSchedule?.shoulder_energy_rate ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("shoulder_energy_rate", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>Demand Rate ($/kW)</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                defaultValue={touSchedule?.shoulder_demand_rate ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("shoulder_demand_rate", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>Start Hour</label>
              <input
                type="number"
                min="0"
                max="23"
                className={inputClass}
                defaultValue={touSchedule?.shoulder_start_hour ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("shoulder_start_hour", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>End Hour</label>
              <input
                type="number"
                min="0"
                max="23"
                className={inputClass}
                defaultValue={touSchedule?.shoulder_end_hour ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("shoulder_end_hour", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>Months</label>
              <input
                type="text"
                className={inputClass}
                defaultValue={touSchedule?.shoulder_months ?? ""}
                placeholder="e.g. Apr-May, Oct-Nov"
                disabled={isLocked}
                onBlur={handleBlurText("shoulder_months", saveTou)}
              />
            </div>
          </div>
        </div>

        {/* Super-Peak */}
        <div className="space-y-3">
          <h5 className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Super-Peak (optional)</h5>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className={labelClass}>Energy Rate ($/kWh)</label>
              <input
                type="number"
                step="0.001"
                className={inputClass}
                defaultValue={touSchedule?.super_peak_energy_rate ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("super_peak_energy_rate", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>Demand Rate ($/kW)</label>
              <input
                type="number"
                step="0.01"
                className={inputClass}
                defaultValue={touSchedule?.super_peak_demand_rate ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("super_peak_demand_rate", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>Start Hour</label>
              <input
                type="number"
                min="0"
                max="23"
                className={inputClass}
                defaultValue={touSchedule?.super_peak_start_hour ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("super_peak_start_hour", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>End Hour</label>
              <input
                type="number"
                min="0"
                max="23"
                className={inputClass}
                defaultValue={touSchedule?.super_peak_end_hour ?? ""}
                disabled={isLocked}
                onBlur={handleBlurNumeric("super_peak_end_hour", saveTou)}
              />
            </div>
            <div>
              <label className={labelClass}>Months</label>
              <input
                type="text"
                className={inputClass}
                defaultValue={touSchedule?.super_peak_months ?? ""}
                placeholder="e.g. Jul-Aug"
                disabled={isLocked}
                onBlur={handleBlurText("super_peak_months", saveTou)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rate Structure Breakdown (CP/PLC) */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card space-y-4">
        <h4 className="text-sm font-semibold text-gray-900">Coincident Peak & Capacity</h4>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>CP Zone</label>
            <input
              type="text"
              className={inputClass}
              defaultValue={rateStructure?.cp_zone ?? ""}
              placeholder="e.g. PJM_DPL"
              disabled={isLocked}
              onBlur={handleBlurText("cp_zone", saveRate)}
            />
          </div>
          <div>
            <label className={labelClass}>Avg CP Tag (kW)</label>
            <input
              type="number"
              className={inputClass}
              defaultValue={rateStructure?.avg_cp_tag_kw ?? ""}
              disabled={isLocked}
              onBlur={handleBlurNumeric("avg_cp_tag_kw", saveRate)}
            />
          </div>
          <div>
            <label className={labelClass}>Capacity Rate ($/kW-yr)</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              defaultValue={rateStructure?.capacity_rate_per_kw_yr ?? ""}
              disabled={isLocked}
              onBlur={handleBlurNumeric("capacity_rate_per_kw_yr", saveRate)}
            />
          </div>
          <div>
            <label className={labelClass}>Transmission Rate ($/kW-yr)</label>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              defaultValue={rateStructure?.transmission_rate_per_kw_yr ?? ""}
              disabled={isLocked}
              onBlur={handleBlurNumeric("transmission_rate_per_kw_yr", saveRate)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
