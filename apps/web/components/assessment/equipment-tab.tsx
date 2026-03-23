"use client";

import { useState, useMemo, useCallback } from "react";
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CATEGORY_LABELS,
  COMPRESSOR_TYPES,
  CONDENSER_TYPES,
  REFRIGERATION_LOOPS,
  DEFROST_TYPES,
  type EquipmentCategory,
} from "@repo/shared";
import { calcAvgKw, calcAvgKwh, calcAnnualOpsHours, formatKw, formatKwh } from "../../lib/calculations/refrigeration";
import { addEquipment, updateEquipment, deleteEquipment } from "../../lib/actions/assessment";
import { Plus, Trash2 } from "lucide-react";

interface EquipmentTabProps {
  assessment: any;
  equipment: any[];
  operationalParams: any;
  siteId: string;
  tenantId: string;
  isLocked: boolean;
}

function getHpForEquipment(eq: any): number {
  const specs = eq.specs ?? {};
  if (eq.category === "compressor") return specs.hp ?? 0;
  if (eq.category === "condenser") return specs.total_hp_fan_and_pump ?? 0;
  if (eq.category === "evaporator") return specs.avg_fan_hp ?? 0;
  return specs.hp ?? 0;
}

function getQuantity(eq: any): number {
  if (eq.category === "evaporator") return eq.specs?.num_units ?? eq.quantity ?? 1;
  return 1;
}

function getLoadings(specs: any) {
  return {
    summer: specs?.loading_summer ?? 0,
    shoulder: specs?.loading_shoulder ?? 0,
    winter: specs?.loading_winter ?? 0,
  };
}

const numOrNull = (v: string) => {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};

const VISIBLE_CATEGORIES: EquipmentCategory[] = ["compressor", "condenser", "evaporator", "pump", "vfd", "controls", "other"];

type NewRowState = { name: string; manufacturer: string; specs: Record<string, unknown> };
const emptyNewRow = (): NewRowState => ({ name: "", manufacturer: "", specs: {} });

// Input classes — mobile-first with responsive sizing
const cellInput = "w-full min-w-0 border-none bg-transparent text-sm text-gray-900 p-0 focus:ring-0 placeholder:text-gray-300 disabled:text-gray-400";
const cellSelect = "w-full min-w-0 border-none bg-transparent text-sm text-gray-600 p-0 focus:ring-0 disabled:text-gray-400 appearance-none cursor-pointer";
const numInput = "w-16 border-none bg-transparent text-sm text-gray-900 p-0 focus:ring-0 placeholder:text-gray-300 disabled:text-gray-400 text-right";

export function EquipmentTab({
  assessment,
  equipment: initialEquipment,
  operationalParams,
  siteId,
  tenantId,
  isLocked,
}: EquipmentTabProps) {
  const [items, setItems] = useState(initialEquipment);
  const [newRows, setNewRows] = useState<Record<string, NewRowState>>(() => {
    const init: Record<string, NewRowState> = {};
    for (const cat of VISIBLE_CATEGORIES) init[cat] = emptyNewRow();
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const annualOpsHours = useMemo(() => {
    if (!operationalParams) return 8760;
    return calcAnnualOpsHours(
      operationalParams.operating_days_per_week ?? 7,
      operationalParams.daily_operational_hours ?? 24,
    );
  }, [operationalParams]);

  const loadFactor = operationalParams?.load_factor ?? 1.0;
  const offOpsEnergyUse = operationalParams?.off_ops_energy_use ?? 0.5;

  // Group equipment by category
  const grouped: Record<EquipmentCategory, any[]> = useMemo(() => {
    const map = {} as Record<EquipmentCategory, any[]>;
    for (const cat of EQUIPMENT_CATEGORIES) map[cat] = [];
    for (const eq of items) {
      if (map[eq.category as EquipmentCategory]) {
        map[eq.category as EquipmentCategory].push(eq);
      }
    }
    return map;
  }, [items]);

  const totals = useMemo(() => {
    let totalKw = 0;
    let totalKwh = 0;
    for (const eq of items) {
      const hp = getHpForEquipment(eq);
      const qty = getQuantity(eq);
      const { summer, shoulder, winter } = getLoadings(eq.specs);
      const avgKw = calcAvgKw(hp, summer, shoulder, winter, qty);
      totalKw += avgKw;
      totalKwh += calcAvgKwh(avgKw, annualOpsHours, loadFactor, offOpsEnergyUse);
    }
    return { totalKw, totalKwh };
  }, [items, annualOpsHours, loadFactor, offOpsEnergyUse]);

  // ── Update existing equipment ──
  const handleUpdateField = useCallback(async (eqId: string, field: string, value: string) => {
    const trimmed = value.trim();
    await updateEquipment(eqId, { [field]: trimmed || null });
    setItems((prev) => prev.map((eq) => eq.id === eqId ? { ...eq, [field]: trimmed || null } : eq));
  }, []);

  const handleUpdateSpec = useCallback(async (eqId: string, currentSpecs: any, field: string, value: string | number | null) => {
    const newSpecs = { ...currentSpecs, [field]: value };
    await updateEquipment(eqId, { specs: newSpecs });
    setItems((prev) => prev.map((eq) => eq.id === eqId ? { ...eq, specs: newSpecs } : eq));
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);
    await deleteEquipment(id);
    setItems((prev) => prev.filter((eq) => eq.id !== id));
    setDeleting(null);
  }, []);

  // ── Add new equipment from inline row ──
  const handleAddRow = useCallback(async (cat: EquipmentCategory) => {
    const row = newRows[cat];
    if (!row || !row.name.trim() || !assessment) return;
    setSaving(true);
    const result = await addEquipment({
      assessmentId: assessment.id,
      siteId,
      tenantId,
      category: cat,
      name: row.name.trim(),
      manufacturer: row.manufacturer.trim() || undefined,
      specs: row.specs,
    });
    if (result.equipment) {
      setItems((prev) => [...prev, result.equipment]);
      setNewRows((prev) => ({ ...prev, [cat]: emptyNewRow() }));
    }
    setSaving(false);
  }, [newRows, assessment, siteId, tenantId]);

  const updateNewRow = useCallback((cat: string, field: string, value: unknown) => {
    setNewRows((prev) => ({
      ...prev,
      [cat]: { ...prev[cat]!, [field]: value },
    }));
  }, []);

  const updateNewRowSpec = useCallback((cat: string, field: string, value: unknown) => {
    setNewRows((prev) => ({
      ...prev,
      [cat]: { ...prev[cat]!, specs: { ...prev[cat]!.specs, [field]: value } },
    }));
  }, []);

  // ── Render helpers ──
  function renderCategoryHeaders(cat: EquipmentCategory) {
    if (cat === "compressor") return (
      <>
        <th className="px-2 py-2 font-medium whitespace-nowrap">Name</th>
        <th className="px-2 py-2 font-medium hidden sm:table-cell">Mfr</th>
        <th className="px-2 py-2 font-medium">Type</th>
        <th className="px-2 py-2 font-medium">HP</th>
        <th className="px-2 py-2 font-medium">Loop</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Sum%</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Shld%</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Win%</th>
        <th className="px-2 py-2 font-medium hidden lg:table-cell">Suct</th>
        <th className="px-2 py-2 font-medium hidden lg:table-cell">Disc</th>
        <th className="px-2 py-2 font-medium text-right">kW</th>
        <th className="px-2 py-2 font-medium text-right hidden sm:table-cell">kWh</th>
        {!isLocked && <th className="w-8" />}
      </>
    );
    if (cat === "condenser") return (
      <>
        <th className="px-2 py-2 font-medium whitespace-nowrap">Name</th>
        <th className="px-2 py-2 font-medium hidden sm:table-cell">Mfr</th>
        <th className="px-2 py-2 font-medium">Type</th>
        <th className="px-2 py-2 font-medium">Fans</th>
        <th className="px-2 py-2 font-medium">HP</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Sum%</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Shld%</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Win%</th>
        <th className="px-2 py-2 font-medium text-right">kW</th>
        <th className="px-2 py-2 font-medium text-right hidden sm:table-cell">kWh</th>
        {!isLocked && <th className="w-8" />}
      </>
    );
    if (cat === "evaporator") return (
      <>
        <th className="px-2 py-2 font-medium whitespace-nowrap">Name</th>
        <th className="px-2 py-2 font-medium hidden sm:table-cell">Mfr</th>
        <th className="px-2 py-2 font-medium">Loop</th>
        <th className="px-2 py-2 font-medium">Units</th>
        <th className="px-2 py-2 font-medium">HP/u</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Sum%</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Shld%</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Win%</th>
        <th className="px-2 py-2 font-medium hidden lg:table-cell">Defrost</th>
        <th className="px-2 py-2 font-medium text-right">kW</th>
        <th className="px-2 py-2 font-medium text-right hidden sm:table-cell">kWh</th>
        {!isLocked && <th className="w-8" />}
      </>
    );
    // other/vfd/pump/controls
    return (
      <>
        <th className="px-2 py-2 font-medium whitespace-nowrap">Name</th>
        <th className="px-2 py-2 font-medium hidden sm:table-cell">Mfr</th>
        <th className="px-2 py-2 font-medium">HP</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Sum%</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Shld%</th>
        <th className="px-2 py-2 font-medium hidden md:table-cell">Win%</th>
        <th className="px-2 py-2 font-medium text-right">kW</th>
        <th className="px-2 py-2 font-medium text-right hidden sm:table-cell">kWh</th>
        {!isLocked && <th className="w-8" />}
      </>
    );
  }

  function renderExistingRow(eq: any, cat: EquipmentCategory) {
    const specs = eq.specs ?? {};
    const hp = getHpForEquipment(eq);
    const qty = getQuantity(eq);
    const { summer, shoulder, winter } = getLoadings(specs);
    const avgKw = calcAvgKw(hp, summer, shoulder, winter, qty);
    const avgKwh = calcAvgKwh(avgKw, annualOpsHours, loadFactor, offOpsEnergyUse);

    const textCell = (field: string, val: string) => (
      <td className="px-2 py-1.5">
        <input type="text" defaultValue={val} className={cellInput} disabled={isLocked}
          onBlur={(e) => { if (e.target.value.trim() !== val) handleUpdateField(eq.id, field, e.target.value); }} />
      </td>
    );
    const mfrCell = (
      <td className="px-2 py-1.5 hidden sm:table-cell">
        <input type="text" defaultValue={eq.manufacturer ?? ""} className={cellInput} disabled={isLocked} placeholder="Mfr"
          onBlur={(e) => { if (e.target.value.trim() !== (eq.manufacturer ?? "")) handleUpdateField(eq.id, "manufacturer", e.target.value); }} />
      </td>
    );
    const specNum = (field: string, val: number | null, placeholder?: string) => (
      <td className="px-2 py-1.5">
        <input type="number" step="any" defaultValue={val ?? ""} className={numInput} disabled={isLocked} placeholder={placeholder}
          onBlur={(e) => handleUpdateSpec(eq.id, specs, field, numOrNull(e.target.value))} />
      </td>
    );
    const loadCell = (field: string, val: number) => (
      <td className="px-2 py-1.5 hidden md:table-cell">
        <input type="number" step="0.01" min="0" max="1" defaultValue={val || ""} className={numInput} disabled={isLocked} placeholder="0"
          onBlur={(e) => handleUpdateSpec(eq.id, specs, field, numOrNull(e.target.value))} />
      </td>
    );
    const kwCell = <td className="px-2 py-1.5 text-right font-mono text-gray-600 text-xs">{formatKw(avgKw)}</td>;
    const kwhCell = <td className="px-2 py-1.5 text-right font-mono text-gray-600 text-xs hidden sm:table-cell">{formatKwh(avgKwh)}</td>;
    const deleteCell = !isLocked ? (
      <td className="px-1 py-1.5">
        <button type="button" onClick={() => handleDelete(eq.id)} disabled={deleting === eq.id}
          className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    ) : null;

    if (cat === "compressor") return (
      <tr key={eq.id} className="group hover:bg-gray-50/50">
        {textCell("name", eq.name ?? "")}
        {mfrCell}
        <td className="px-2 py-1.5">
          <select defaultValue={specs.type ?? ""} className={cellSelect} disabled={isLocked}
            onChange={(e) => handleUpdateSpec(eq.id, specs, "type", e.target.value || null)}>
            <option value="">—</option>
            {COMPRESSOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </td>
        {specNum("hp", specs.hp)}
        <td className="px-2 py-1.5">
          <select defaultValue={specs.loop ?? ""} className={cellSelect} disabled={isLocked}
            onChange={(e) => handleUpdateSpec(eq.id, specs, "loop", e.target.value || null)}>
            <option value="">—</option>
            {REFRIGERATION_LOOPS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </td>
        {loadCell("loading_summer", summer)}
        {loadCell("loading_shoulder", shoulder)}
        {loadCell("loading_winter", winter)}
        <td className="px-2 py-1.5 hidden lg:table-cell">
          <input type="number" step="0.1" defaultValue={specs.suction_setpoint_psig ?? ""} className={numInput} disabled={isLocked}
            onBlur={(e) => handleUpdateSpec(eq.id, specs, "suction_setpoint_psig", numOrNull(e.target.value))} />
        </td>
        <td className="px-2 py-1.5 hidden lg:table-cell">
          <input type="number" step="0.1" defaultValue={specs.discharge_setpoint_psig ?? ""} className={numInput} disabled={isLocked}
            onBlur={(e) => handleUpdateSpec(eq.id, specs, "discharge_setpoint_psig", numOrNull(e.target.value))} />
        </td>
        {kwCell}{kwhCell}{deleteCell}
      </tr>
    );

    if (cat === "condenser") return (
      <tr key={eq.id} className="group hover:bg-gray-50/50">
        {textCell("name", eq.name ?? "")}
        {mfrCell}
        <td className="px-2 py-1.5">
          <select defaultValue={specs.type ?? ""} className={cellSelect} disabled={isLocked}
            onChange={(e) => handleUpdateSpec(eq.id, specs, "type", e.target.value || null)}>
            <option value="">—</option>
            {CONDENSER_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
        </td>
        {specNum("total_fans", specs.total_fans)}
        {specNum("total_hp_fan_and_pump", specs.total_hp_fan_and_pump)}
        {loadCell("loading_summer", summer)}
        {loadCell("loading_shoulder", shoulder)}
        {loadCell("loading_winter", winter)}
        {kwCell}{kwhCell}{deleteCell}
      </tr>
    );

    if (cat === "evaporator") return (
      <tr key={eq.id} className="group hover:bg-gray-50/50">
        {textCell("name", eq.name ?? "")}
        {mfrCell}
        <td className="px-2 py-1.5">
          <select defaultValue={specs.loop ?? ""} className={cellSelect} disabled={isLocked}
            onChange={(e) => handleUpdateSpec(eq.id, specs, "loop", e.target.value || null)}>
            <option value="">—</option>
            {REFRIGERATION_LOOPS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </td>
        {specNum("num_units", specs.num_units)}
        {specNum("avg_fan_hp", specs.avg_fan_hp)}
        {loadCell("loading_summer", summer)}
        {loadCell("loading_shoulder", shoulder)}
        {loadCell("loading_winter", winter)}
        <td className="px-2 py-1.5 hidden lg:table-cell">
          <select defaultValue={specs.defrost_type ?? ""} className={cellSelect} disabled={isLocked}
            onChange={(e) => handleUpdateSpec(eq.id, specs, "defrost_type", e.target.value || null)}>
            <option value="">—</option>
            {DEFROST_TYPES.map((d) => <option key={d} value={d}>{d.replace("_", " ")}</option>)}
          </select>
        </td>
        {kwCell}{kwhCell}{deleteCell}
      </tr>
    );

    // other/pump/vfd/controls
    return (
      <tr key={eq.id} className="group hover:bg-gray-50/50">
        {textCell("name", eq.name ?? "")}
        {mfrCell}
        {specNum("hp", specs.hp)}
        {loadCell("loading_summer", summer)}
        {loadCell("loading_shoulder", shoulder)}
        {loadCell("loading_winter", winter)}
        {kwCell}{kwhCell}{deleteCell}
      </tr>
    );
  }

  function renderAddRow(cat: EquipmentCategory) {
    if (isLocked || !assessment) return null;
    const row = newRows[cat] ?? emptyNewRow();
    const specs = row.specs;

    const nameCell = (
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Plus className="h-3 w-3 text-gray-300 shrink-0" />
          <input type="text" value={row.name} placeholder="New entry..." className={cellInput + " font-medium"}
            onChange={(e) => updateNewRow(cat, "name", e.target.value)}
            onBlur={() => { if (row.name.trim()) handleAddRow(cat); }}
            onKeyDown={(e) => { if (e.key === "Enter" && row.name.trim()) handleAddRow(cat); }} />
        </div>
      </td>
    );
    const mfrCell = (
      <td className="px-2 py-1.5 hidden sm:table-cell">
        <input type="text" value={row.manufacturer} placeholder="Mfr" className={cellInput}
          onChange={(e) => updateNewRow(cat, "manufacturer", e.target.value)} />
      </td>
    );
    const addSpecNum = (field: string, ph?: string) => (
      <td className="px-2 py-1.5">
        <input type="number" step="any" value={(specs as any)[field] ?? ""} placeholder={ph ?? "0"} className={numInput}
          onChange={(e) => updateNewRowSpec(cat, field, numOrNull(e.target.value))} />
      </td>
    );
    const addLoadCell = (field: string) => (
      <td className="px-2 py-1.5 hidden md:table-cell">
        <input type="number" step="0.01" min="0" max="1" value={(specs as any)[field] ?? ""} placeholder="0" className={numInput}
          onChange={(e) => updateNewRowSpec(cat, field, numOrNull(e.target.value))} />
      </td>
    );
    const emptyKw = <td className="px-2 py-1.5 text-right text-gray-300 text-xs">—</td>;
    const emptyKwh = <td className="px-2 py-1.5 text-right text-gray-300 text-xs hidden sm:table-cell">—</td>;
    const emptySpacer = <td className="w-8" />;

    if (cat === "compressor") return (
      <tr className="bg-gray-50/30">
        {nameCell}{mfrCell}
        <td className="px-2 py-1.5">
          <select value={(specs as any).type ?? ""} className={cellSelect}
            onChange={(e) => updateNewRowSpec(cat, "type", e.target.value || null)}>
            <option value="">—</option>
            {COMPRESSOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </td>
        {addSpecNum("hp")}
        <td className="px-2 py-1.5">
          <select value={(specs as any).loop ?? ""} className={cellSelect}
            onChange={(e) => updateNewRowSpec(cat, "loop", e.target.value || null)}>
            <option value="">—</option>
            {REFRIGERATION_LOOPS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </td>
        {addLoadCell("loading_summer")}{addLoadCell("loading_shoulder")}{addLoadCell("loading_winter")}
        <td className="px-2 py-1.5 hidden lg:table-cell"><input type="number" step="0.1" value={(specs as any).suction_setpoint_psig ?? ""} className={numInput} placeholder="psig" onChange={(e) => updateNewRowSpec(cat, "suction_setpoint_psig", numOrNull(e.target.value))} /></td>
        <td className="px-2 py-1.5 hidden lg:table-cell"><input type="number" step="0.1" value={(specs as any).discharge_setpoint_psig ?? ""} className={numInput} placeholder="psig" onChange={(e) => updateNewRowSpec(cat, "discharge_setpoint_psig", numOrNull(e.target.value))} /></td>
        {emptyKw}{emptyKwh}{emptySpacer}
      </tr>
    );

    if (cat === "condenser") return (
      <tr className="bg-gray-50/30">
        {nameCell}{mfrCell}
        <td className="px-2 py-1.5">
          <select value={(specs as any).type ?? ""} className={cellSelect}
            onChange={(e) => updateNewRowSpec(cat, "type", e.target.value || null)}>
            <option value="">—</option>
            {CONDENSER_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
        </td>
        {addSpecNum("total_fans")}{addSpecNum("total_hp_fan_and_pump")}
        {addLoadCell("loading_summer")}{addLoadCell("loading_shoulder")}{addLoadCell("loading_winter")}
        {emptyKw}{emptyKwh}{emptySpacer}
      </tr>
    );

    if (cat === "evaporator") return (
      <tr className="bg-gray-50/30">
        {nameCell}{mfrCell}
        <td className="px-2 py-1.5">
          <select value={(specs as any).loop ?? ""} className={cellSelect}
            onChange={(e) => updateNewRowSpec(cat, "loop", e.target.value || null)}>
            <option value="">—</option>
            {REFRIGERATION_LOOPS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </td>
        {addSpecNum("num_units")}{addSpecNum("avg_fan_hp")}
        {addLoadCell("loading_summer")}{addLoadCell("loading_shoulder")}{addLoadCell("loading_winter")}
        <td className="px-2 py-1.5 hidden lg:table-cell">
          <select value={(specs as any).defrost_type ?? ""} className={cellSelect}
            onChange={(e) => updateNewRowSpec(cat, "defrost_type", e.target.value || null)}>
            <option value="">—</option>
            {DEFROST_TYPES.map((d) => <option key={d} value={d}>{d.replace("_", " ")}</option>)}
          </select>
        </td>
        {emptyKw}{emptyKwh}{emptySpacer}
      </tr>
    );

    return (
      <tr className="bg-gray-50/30">
        {nameCell}{mfrCell}
        {addSpecNum("hp")}
        {addLoadCell("loading_summer")}{addLoadCell("loading_shoulder")}{addLoadCell("loading_winter")}
        {emptyKw}{emptyKwh}{emptySpacer}
      </tr>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary cards — stack on mobile */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 shadow-card">
          <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Total Equipment</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{items.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 shadow-card">
          <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Total Avg kW</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{formatKw(totals.totalKw)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 shadow-card">
          <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Total Avg kWh/yr</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">{formatKwh(totals.totalKwh)}</p>
        </div>
      </div>

      {saving && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg">
          Saving...
        </div>
      )}

      {/* Equipment sections by category */}
      {VISIBLE_CATEGORIES.map((cat) => {
        const catItems = grouped[cat] ?? [];
        // Always show core 3 + any category with items
        if (catItems.length === 0 && cat !== "compressor" && cat !== "condenser" && cat !== "evaporator") {
          return null;
        }

        return (
          <div key={cat} className="bg-white rounded-xl border border-gray-100 shadow-card">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">
                {EQUIPMENT_CATEGORY_LABELS[cat]} ({catItems.length})
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-50 text-left text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">
                    {renderCategoryHeaders(cat)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {catItems.map((eq: any) => renderExistingRow(eq, cat))}
                  {renderAddRow(cat)}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
