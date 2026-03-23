"use client";

import { useState, useCallback } from "react";
import {
  REFRIGERANTS,
  FACILITY_TYPES,
  SYSTEM_TYPES,
} from "@repo/shared";
import {
  updateOperationalParams,
  updateOperations,
} from "../../lib/actions/assessment";
import { EmptyState } from "../ui/empty-state";
import { Settings } from "lucide-react";

interface OperationsTabProps {
  assessment: any;
  operationalParams: any;
  operations: any;
  siteId: string;
  tenantId: string;
  isLocked: boolean;
}

export function OperationsTab({
  assessment,
  operationalParams,
  operations,
  siteId,
  tenantId,
  isLocked,
}: OperationsTabProps) {
  // Local state for operational params
  const [params, setParams] = useState(() => ({
    operating_days_per_week: operationalParams?.operating_days_per_week ?? "",
    daily_operational_hours: operationalParams?.daily_operational_hours ?? "",
    load_factor: operationalParams?.load_factor ?? "1.0",
    off_ops_energy_use: operationalParams?.off_ops_energy_use ?? "0.5",
    system_type: operationalParams?.system_type ?? "",
    refrigerant: operationalParams?.refrigerant ?? "",
    control_system: operationalParams?.control_system ?? "",
    control_hardware: operationalParams?.control_hardware ?? "",
    micro_panel_type: operationalParams?.micro_panel_type ?? "",
    has_sub_metering: operationalParams?.has_sub_metering ?? false,
    facility_type: operationalParams?.facility_type ?? "",
    runs_24_7: operationalParams?.runs_24_7 ?? false,
    has_blast_freezing: operationalParams?.has_blast_freezing ?? false,
    required_upgrades: operationalParams?.required_upgrades ?? "",
    estimated_upgrade_cost: operationalParams?.estimated_upgrade_cost ?? "",
    survey_completed_date: operationalParams?.survey_completed_date ?? "",
    survey_notes: operationalParams?.survey_notes ?? "",
  }));

  // Local state for operations
  const [ops, setOps] = useState(() => ({
    discharge_pressure_typical: operations?.discharge_pressure_typical ?? "",
    suction_pressure_typical: operations?.suction_pressure_typical ?? "",
    can_shed_load: operations?.can_shed_load ?? false,
    can_shutdown: operations?.can_shutdown ?? false,
    shutdown_constraints: operations?.shutdown_constraints ?? "",
    curtailment_enrolled: operations?.curtailment_enrolled ?? false,
    curtailment_frequency: operations?.curtailment_frequency ?? "",
    curtailment_barriers: operations?.curtailment_barriers ?? "",
    seasonality_notes: operations?.seasonality_notes ?? "",
    temperature_challenges: operations?.temperature_challenges ?? "",
    operational_nuances: operations?.operational_nuances ?? "",
    product_notes: operations?.product_notes ?? "",
    customer_mix: operations?.customer_mix ?? "",
    staffing_notes: operations?.staffing_notes ?? "",
  }));

  const [saving, setSaving] = useState(false);

  const assessmentId = assessment?.id;

  // Auto-save operational params on blur
  const saveParams = useCallback(async () => {
    if (!assessmentId || isLocked) return;
    setSaving(true);
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string" && v === "") {
        data[k] = null;
      } else if (typeof v === "string" && !isNaN(Number(v)) && k !== "system_type" && k !== "refrigerant" && k !== "control_system" && k !== "control_hardware" && k !== "micro_panel_type" && k !== "facility_type" && k !== "required_upgrades" && k !== "survey_notes" && k !== "survey_completed_date") {
        data[k] = parseFloat(v);
      } else {
        data[k] = v;
      }
    }
    await updateOperationalParams(assessmentId, siteId, tenantId, data);
    setSaving(false);
  }, [assessmentId, siteId, tenantId, params, isLocked]);

  // Auto-save operations on blur
  const saveOps = useCallback(async () => {
    if (!assessmentId || isLocked) return;
    setSaving(true);
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(ops)) {
      if (typeof v === "string" && v === "") {
        data[k] = null;
      } else if (typeof v === "string" && !isNaN(Number(v)) && (k === "discharge_pressure_typical" || k === "suction_pressure_typical")) {
        data[k] = parseFloat(v);
      } else {
        data[k] = v;
      }
    }
    await updateOperations(assessmentId, siteId, tenantId, data);
    setSaving(false);
  }, [assessmentId, siteId, tenantId, ops, isLocked]);

  if (!assessment) {
    return (
      <EmptyState
        icon={<Settings className="h-12 w-12" />}
        title="No assessment started"
        description="Start an assessment from the Overview tab to begin entering operational data."
      />
    );
  }

  const labelCls = "block text-xs font-medium text-gray-500 mb-1";
  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400";
  const selectCls = inputCls;

  return (
    <div className="space-y-6">
      {saving && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg">
          Saving...
        </div>
      )}

      {/* System Parameters */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card space-y-5">
        <h3 className="text-sm font-semibold text-gray-900">System Parameters</h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className={labelCls}>Days/Week</label>
            <input
              type="number" step="1" min="1" max="7"
              value={params.operating_days_per_week}
              onChange={(e) => setParams({ ...params, operating_days_per_week: e.target.value })}
              onBlur={saveParams}
              disabled={isLocked}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Hours/Day</label>
            <input
              type="number" step="0.5" min="1" max="24"
              value={params.daily_operational_hours}
              onChange={(e) => setParams({ ...params, daily_operational_hours: e.target.value })}
              onBlur={saveParams}
              disabled={isLocked}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Load Factor</label>
            <input
              type="number" step="0.01" min="0" max="2"
              value={params.load_factor}
              onChange={(e) => setParams({ ...params, load_factor: e.target.value })}
              onBlur={saveParams}
              disabled={isLocked}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Off-Ops Energy Use</label>
            <input
              type="number" step="0.01" min="0" max="1"
              value={params.off_ops_energy_use}
              onChange={(e) => setParams({ ...params, off_ops_energy_use: e.target.value })}
              onBlur={saveParams}
              disabled={isLocked}
              className={inputCls}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>System Type</label>
            <select
              value={params.system_type}
              onChange={(e) => { setParams({ ...params, system_type: e.target.value }); }}
              onBlur={saveParams}
              disabled={isLocked}
              className={selectCls}
            >
              <option value="">Select...</option>
              {SYSTEM_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Refrigerant</label>
            <select
              value={params.refrigerant}
              onChange={(e) => { setParams({ ...params, refrigerant: e.target.value }); }}
              onBlur={saveParams}
              disabled={isLocked}
              className={selectCls}
            >
              <option value="">Select...</option>
              {REFRIGERANTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Facility Type</label>
            <select
              value={params.facility_type}
              onChange={(e) => { setParams({ ...params, facility_type: e.target.value }); }}
              onBlur={saveParams}
              disabled={isLocked}
              className={selectCls}
            >
              <option value="">Select...</option>
              {FACILITY_TYPES.map((f) => <option key={f} value={f}>{f.replace("_", " ")}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Control System</label>
            <input
              type="text"
              value={params.control_system}
              onChange={(e) => setParams({ ...params, control_system: e.target.value })}
              onBlur={saveParams}
              disabled={isLocked}
              placeholder="e.g. Frick"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Control Hardware</label>
            <input
              type="text"
              value={params.control_hardware}
              onChange={(e) => setParams({ ...params, control_hardware: e.target.value })}
              onBlur={saveParams}
              disabled={isLocked}
              placeholder="e.g. Opto 22"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Micro Panel Type</label>
            <input
              type="text"
              value={params.micro_panel_type}
              onChange={(e) => setParams({ ...params, micro_panel_type: e.target.value })}
              onBlur={saveParams}
              disabled={isLocked}
              placeholder="e.g. Quantum HD"
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={params.runs_24_7}
              onChange={(e) => { setParams({ ...params, runs_24_7: e.target.checked }); setTimeout(saveParams, 0); }}
              disabled={isLocked}
              className="rounded border-gray-300"
            />
            Runs 24/7
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={params.has_sub_metering}
              onChange={(e) => { setParams({ ...params, has_sub_metering: e.target.checked }); setTimeout(saveParams, 0); }}
              disabled={isLocked}
              className="rounded border-gray-300"
            />
            Sub-metered
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={params.has_blast_freezing}
              onChange={(e) => { setParams({ ...params, has_blast_freezing: e.target.checked }); setTimeout(saveParams, 0); }}
              disabled={isLocked}
              className="rounded border-gray-300"
            />
            Blast Freezing
          </label>
        </div>
      </div>

      {/* Operational Details */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card space-y-5">
        <h3 className="text-sm font-semibold text-gray-900">Operational Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Discharge Pressure (psig)</label>
            <input
              type="number" step="0.1"
              value={ops.discharge_pressure_typical}
              onChange={(e) => setOps({ ...ops, discharge_pressure_typical: e.target.value })}
              onBlur={saveOps}
              disabled={isLocked}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Suction Pressure (psig)</label>
            <input
              type="number" step="0.1"
              value={ops.suction_pressure_typical}
              onChange={(e) => setOps({ ...ops, suction_pressure_typical: e.target.value })}
              onBlur={saveOps}
              disabled={isLocked}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={ops.can_shed_load}
              onChange={(e) => { setOps({ ...ops, can_shed_load: e.target.checked }); setTimeout(saveOps, 0); }}
              disabled={isLocked}
              className="rounded border-gray-300"
            />
            Can Shed Load
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={ops.can_shutdown}
              onChange={(e) => { setOps({ ...ops, can_shutdown: e.target.checked }); setTimeout(saveOps, 0); }}
              disabled={isLocked}
              className="rounded border-gray-300"
            />
            Can Shutdown
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={ops.curtailment_enrolled}
              onChange={(e) => { setOps({ ...ops, curtailment_enrolled: e.target.checked }); setTimeout(saveOps, 0); }}
              disabled={isLocked}
              className="rounded border-gray-300"
            />
            Curtailment Enrolled
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Shutdown Constraints</label>
            <textarea
              value={ops.shutdown_constraints}
              onChange={(e) => setOps({ ...ops, shutdown_constraints: e.target.value })}
              onBlur={saveOps}
              disabled={isLocked}
              rows={2}
              className={inputCls}
              placeholder="e.g. System finicky on restart, 2hr becomes 6-7hr"
            />
          </div>
          <div>
            <label className={labelCls}>Curtailment Barriers</label>
            <textarea
              value={ops.curtailment_barriers}
              onChange={(e) => setOps({ ...ops, curtailment_barriers: e.target.value })}
              onBlur={saveOps}
              disabled={isLocked}
              rows={2}
              className={inputCls}
              placeholder="e.g. No staff evenings, restart issues"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Curtailment Frequency</label>
            <input
              type="text"
              value={ops.curtailment_frequency}
              onChange={(e) => setOps({ ...ops, curtailment_frequency: e.target.value })}
              onBlur={saveOps}
              disabled={isLocked}
              className={inputCls}
              placeholder="e.g. once/year mandatory"
            />
          </div>
          <div>
            <label className={labelCls}>Seasonality Notes</label>
            <input
              type="text"
              value={ops.seasonality_notes}
              onChange={(e) => setOps({ ...ops, seasonality_notes: e.target.value })}
              onBlur={saveOps}
              disabled={isLocked}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Operational Nuances</label>
          <textarea
            value={ops.operational_nuances}
            onChange={(e) => setOps({ ...ops, operational_nuances: e.target.value })}
            onBlur={saveOps}
            disabled={isLocked}
            rows={3}
            className={inputCls}
            placeholder="Any important details about how the facility operates..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Product Notes</label>
            <textarea
              value={ops.product_notes}
              onChange={(e) => setOps({ ...ops, product_notes: e.target.value })}
              onBlur={saveOps}
              disabled={isLocked}
              rows={2}
              className={inputCls}
              placeholder="e.g. bakeries send more seasonally"
            />
          </div>
          <div>
            <label className={labelCls}>Staffing Notes</label>
            <textarea
              value={ops.staffing_notes}
              onChange={(e) => setOps({ ...ops, staffing_notes: e.target.value })}
              onBlur={saveOps}
              disabled={isLocked}
              rows={2}
              className={inputCls}
              placeholder="e.g. no refrigeration engineer on staff"
            />
          </div>
        </div>
      </div>

      {/* Site Survey & Upgrades */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card space-y-5">
        <h3 className="text-sm font-semibold text-gray-900">Site Survey & Upgrades</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Survey Completed Date</label>
            <input type="date" value={params.survey_completed_date} onChange={(e) => setParams({ ...params, survey_completed_date: e.target.value })} onBlur={saveParams} disabled={isLocked} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Estimated Upgrade Cost ($)</label>
            <input type="number" step="100" value={params.estimated_upgrade_cost} onChange={(e) => setParams({ ...params, estimated_upgrade_cost: e.target.value })} onBlur={saveParams} disabled={isLocked} placeholder="e.g. 15000" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Required Upgrades</label>
          <textarea value={params.required_upgrades} onChange={(e) => setParams({ ...params, required_upgrades: e.target.value })} onBlur={saveParams} disabled={isLocked} rows={3} className={inputCls} placeholder="e.g. Opto-22 serial boards on 21 racks must upgrade to Ethernet comms" />
        </div>

        <div>
          <label className={labelCls}>Survey Notes</label>
          <textarea value={params.survey_notes} onChange={(e) => setParams({ ...params, survey_notes: e.target.value })} onBlur={saveParams} disabled={isLocked} rows={3} className={inputCls} placeholder="Additional survey observations, room counts, equipment notes..." />
        </div>
      </div>
    </div>
  );
}
