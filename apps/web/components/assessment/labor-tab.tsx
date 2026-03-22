"use client";

import { useState, useCallback, useMemo } from "react";
import { LABOR_ROLES, LABOR_ROLE_LABELS, type LaborRole } from "@repo/shared";
import { updateLaborBaseline } from "../../lib/actions/assessment";
import { formatDollars } from "../../lib/calculations/refrigeration";
import { Plus, Trash2, Users, MessageSquare } from "lucide-react";

interface LaborTabProps {
  assessment: any;
  laborBaseline: any;
  siteId: string;
  tenantId: string;
  isLocked: boolean;
}

interface HeadcountEntry {
  role: string;
  count: number;
  hoursPerWeek: number;
  hourlyRate: number;
}

export function LaborTab({
  assessment,
  laborBaseline,
  siteId,
  tenantId,
  isLocked,
}: LaborTabProps) {
  const [saving, setSaving] = useState(false);

  // Headcount state from stored JSONB
  const initialHeadcount: HeadcountEntry[] = laborBaseline?.headcount ?? [];
  const [headcount, setHeadcount] = useState<HeadcountEntry[]>(
    initialHeadcount.length > 0
      ? initialHeadcount
      : [],
  );

  // Qualitative fields
  const [painPoints, setPainPoints] = useState(laborBaseline?.pain_points ?? "");
  const [manualProcesses, setManualProcesses] = useState(laborBaseline?.manual_processes ?? "");
  const [timeSinks, setTimeSinks] = useState(laborBaseline?.time_sinks ?? "");
  const [automationOpps, setAutomationOpps] = useState(laborBaseline?.automation_opportunities ?? "");
  const [contractorCost, setContractorCost] = useState<string>(
    laborBaseline?.annual_contractor_cost?.toString() ?? "",
  );

  // Computed totals
  const totals = useMemo(() => {
    const totalHeadcount = headcount.reduce((sum, h) => sum + (h.count || 0), 0);
    const totalManualHours = headcount.reduce(
      (sum, h) => sum + (h.count || 0) * (h.hoursPerWeek || 0),
      0,
    );
    const estAnnualLaborCost = headcount.reduce(
      (sum, h) => sum + (h.count || 0) * (h.hoursPerWeek || 0) * (h.hourlyRate || 0) * 52,
      0,
    );
    return { totalHeadcount, totalManualHours, estAnnualLaborCost };
  }, [headcount]);

  const saveAll = useCallback(
    async (updates: Record<string, unknown>) => {
      if (!assessment) return;
      setSaving(true);
      try {
        await updateLaborBaseline(assessment.id, siteId, tenantId, updates);
      } finally {
        setSaving(false);
      }
    },
    [assessment, siteId, tenantId],
  );

  const saveHeadcount = useCallback(
    (newHeadcount: HeadcountEntry[]) => {
      setHeadcount(newHeadcount);
      saveAll({ headcount: newHeadcount });
    },
    [saveAll],
  );

  function addRole() {
    const newEntry: HeadcountEntry = {
      role: "operator",
      count: 1,
      hoursPerWeek: 40,
      hourlyRate: 0,
    };
    saveHeadcount([...headcount, newEntry]);
  }

  function removeRole(index: number) {
    const updated = headcount.filter((_, i) => i !== index);
    saveHeadcount(updated);
  }

  function updateRole(index: number, field: keyof HeadcountEntry, value: string | number) {
    const updated = [...headcount];
    const current = updated[index];
    if (!current) return;
    updated[index] = { ...current, [field]: value };
    saveHeadcount(updated);
  }

  const inputClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400";
  const textareaClass =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400 resize-none";

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Total Headcount</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totals.totalHeadcount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Manual Hours/Week</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totals.totalManualHours}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Est. Annual Labor Cost</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {totals.estAnnualLaborCost > 0 ? formatDollars(totals.estAnnualLaborCost) : "—"}
          </p>
        </div>
      </div>

      {/* Headcount & Hours */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">
              Headcount & Hours ({headcount.length} roles)
            </h3>
            {saving && <span className="text-xs text-gray-400">Saving...</span>}
          </div>
          {!isLocked && (
            <button
              type="button"
              onClick={addRole}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Role
            </button>
          )}
        </div>

        {headcount.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">
            No roles added yet. Add roles to track labor impact.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 text-left text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-6 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Headcount</th>
                  <th className="px-3 py-3 font-medium">Hours/Week (Manual)</th>
                  <th className="px-3 py-3 font-medium">Hourly Rate ($)</th>
                  <th className="px-3 py-3 font-medium text-right">Est. Annual Cost</th>
                  {!isLocked && <th className="px-3 py-3 w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {headcount.map((entry, i) => {
                  const annualCost = (entry.count || 0) * (entry.hoursPerWeek || 0) * (entry.hourlyRate || 0) * 52;
                  return (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3">
                        <select
                          className={inputClass}
                          value={entry.role}
                          disabled={isLocked}
                          onChange={(e) => updateRole(i, "role", e.target.value)}
                        >
                          {LABOR_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {LABOR_ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          className={inputClass}
                          value={entry.count}
                          disabled={isLocked}
                          onChange={(e) => updateRole(i, "count", parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          className={inputClass}
                          value={entry.hoursPerWeek}
                          disabled={isLocked}
                          onChange={(e) => updateRole(i, "hoursPerWeek", parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.50"
                          className={inputClass}
                          value={entry.hourlyRate || ""}
                          placeholder="Optional"
                          disabled={isLocked}
                          onChange={(e) => updateRole(i, "hourlyRate", parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-gray-900">
                        {annualCost > 0 ? formatDollars(annualCost) : "—"}
                      </td>
                      {!isLocked && (
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => removeRole(i)}
                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
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

      {/* Annual Contractor Cost */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Annual Contractor Cost ($)
            </label>
            <input
              type="number"
              className={inputClass}
              value={contractorCost}
              placeholder="e.g. 50000"
              disabled={isLocked}
              onChange={(e) => setContractorCost(e.target.value)}
              onBlur={(e) => {
                const v = e.target.value.trim();
                saveAll({ annual_contractor_cost: v === "" ? null : parseFloat(v) });
              }}
            />
          </div>
        </div>
      </div>

      {/* Qualitative Notes */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card space-y-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Qualitative Assessment</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Pain Points & Inefficiencies
            </label>
            <textarea
              rows={3}
              className={textareaClass}
              value={painPoints}
              placeholder="e.g. Manual monitoring of compressor pressures requires hourly rounds..."
              disabled={isLocked}
              onChange={(e) => setPainPoints(e.target.value)}
              onBlur={() => saveAll({ pain_points: painPoints || null })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Manual Processes ATLAS Could Automate
            </label>
            <textarea
              rows={3}
              className={textareaClass}
              value={manualProcesses}
              placeholder="e.g. Manual defrost scheduling, hand-written round sheets..."
              disabled={isLocked}
              onChange={(e) => setManualProcesses(e.target.value)}
              onBlur={() => saveAll({ manual_processes: manualProcesses || null })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Time Sinks & Productivity Drains
            </label>
            <textarea
              rows={3}
              className={textareaClass}
              value={timeSinks}
              placeholder="e.g. 2-3 hours/day walking the floor checking equipment status..."
              disabled={isLocked}
              onChange={(e) => setTimeSinks(e.target.value)}
              onBlur={() => saveAll({ time_sinks: timeSinks || null })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Automation Opportunities
            </label>
            <textarea
              rows={3}
              className={textareaClass}
              value={automationOpps}
              placeholder="e.g. Automated alerts for pressure deviations, remote monitoring..."
              disabled={isLocked}
              onChange={(e) => setAutomationOpps(e.target.value)}
              onBlur={() => saveAll({ automation_opportunities: automationOpps || null })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
