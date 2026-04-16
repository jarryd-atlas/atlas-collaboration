import type { BaselineFormState, BaselineFormSection } from "./types";
import { BASELINE_FORM_SECTIONS } from "./types";

/** Calculate completion percentage (0-100) for a given section */
export function getSectionCompletion(
  section: BaselineFormSection,
  state: BaselineFormState
): number {
  switch (section) {
    case "contact":
      return getContactCompletion(state);
    case "facility":
      return getFacilityCompletion(state);
    case "layout":
      return getLayoutCompletion(state);
    case "system":
      return getSystemCompletion(state);
    case "network":
      return getNetworkCompletion(state);
    case "equipment":
      return getEquipmentCompletion(state);
    case "documents":
      // Documents are optional — always "complete"
      return 100;
    case "energy":
      return getEnergyCompletion(state);
    case "operations":
      return getOperationsCompletion(state);
    case "efficiency":
      return getEfficiencyCompletion(state);
    case "contractors":
      return getContractorCompletion(state);
    case "review":
      return 0; // Review is not data — no completion
    default:
      return 0;
  }
}

/** Calculate overall form completion */
export function getOverallCompletion(state: BaselineFormState): number {
  const dataSections = BASELINE_FORM_SECTIONS.filter(
    (s) => s !== "review" && s !== "documents" && s !== "contractors" && s !== "layout"
  );
  const total = dataSections.reduce(
    (sum, section) => sum + getSectionCompletion(section, state),
    0
  );
  return Math.round(total / dataSections.length);
}

/** Get completion map for all sections */
export function getAllSectionCompletions(
  state: BaselineFormState
): Record<BaselineFormSection, number> {
  const result = {} as Record<BaselineFormSection, number>;
  for (const section of BASELINE_FORM_SECTIONS) {
    result[section] = getSectionCompletion(section, state);
  }
  return result;
}

// ── Section-specific completion logic ─────────────────────────

function getContactCompletion(state: BaselineFormState): number {
  if (state.contacts.length === 0) return 0;
  const primary = state.contacts[0];
  if (!primary) return 0;

  const fields = [primary.name, primary.email];
  const filled = fields.filter((f) => f && f.trim().length > 0).length;
  return Math.round((filled / fields.length) * 100);
}

function getFacilityCompletion(state: BaselineFormState): number {
  const f = state.facility;
  const fields = [
    f.facility_type !== "",
    f.operating_days_per_week !== null || f.runs_24_7,
    f.daily_operational_hours !== null || f.runs_24_7,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function getLayoutCompletion(state: BaselineFormState): number {
  // Layout is optional — 100% if no engine rooms (simple site)
  if (state.engineRooms.length === 0) return 100;

  // Check each ER has name + system_type + refrigerant
  const erFields = state.engineRooms.map((er) => {
    const checks = [
      er.name.trim().length > 0,
      er.system_type !== "",
      er.refrigerant !== "",
    ];
    return checks.filter(Boolean).length / checks.length;
  });

  // Check each zone has name + zone_type + target_temp
  const zoneFields = state.temperatureZones.map((z) => {
    const checks = [
      z.name.trim().length > 0,
      z.zone_type !== "",
      z.target_temp_f !== null,
    ];
    return checks.filter(Boolean).length / checks.length;
  });

  const allItems = [...erFields, ...zoneFields];
  if (allItems.length === 0) return 100;
  return Math.round((allItems.reduce((a, b) => a + b, 0) / allItems.length) * 100);
}

function getSystemCompletion(state: BaselineFormState): number {
  // If engine rooms exist, system config is per-ER — site-level is auto-complete
  if (state.engineRooms.length > 0) return 100;

  const s = state.system;
  const fields = [
    s.system_type !== "",
    s.refrigerant !== "",
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function getEquipmentCompletion(state: BaselineFormState): number {
  // At minimum, need 1 compressor
  const compressors = state.equipment.filter((e) => e.category === "compressor");
  if (compressors.length === 0) return 0;

  // Check that compressors have HP filled
  const filledCompressors = compressors.filter(
    (c) => (c.specs as any)?.hp != null && (c.specs as any).hp > 0
  );

  return Math.round((filledCompressors.length / Math.max(compressors.length, 1)) * 100);
}

function getEnergyCompletion(state: BaselineFormState): number {
  const e = state.energy;
  const fields = [
    e.supply_provider.trim().length > 0,
    e.on_peak_energy_rate !== null,
    e.off_peak_energy_rate !== null,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function getOperationsCompletion(state: BaselineFormState): number {
  // If engine rooms exist, pressures are per-ER — check ER-level pressures
  if (state.engineRooms.length > 0) {
    const erPressures = state.engineRooms.map((er) => {
      const checks = [
        er.suction_pressure_typical !== null,
        er.discharge_pressure_typical !== null,
      ];
      return checks.filter(Boolean).length / checks.length;
    });
    const avg = erPressures.reduce((a, b) => a + b, 0) / erPressures.length;
    return Math.round(avg * 100);
  }

  const o = state.operations;
  const fields = [
    o.suction_pressure_typical !== null,
    o.discharge_pressure_typical !== null,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function getEfficiencyCompletion(state: BaselineFormState): number {
  const e = state.efficiency;
  // At minimum answer one qualitative question
  const fields = [
    e.headcount.length > 0,
    e.pain_points.trim().length > 0 || e.manual_processes.trim().length > 0,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function getNetworkCompletion(state: BaselineFormState): number {
  const n = state.network;
  const fields = [
    n.isp_name.trim().length > 0,
    n.connection_type !== "",
    n.test_results.length > 0,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

function getContractorCompletion(state: BaselineFormState): number {
  // Contractors are optional — completion based on having at least one with a company name
  if (state.contractors.length === 0) return 0;
  const withName = state.contractors.filter(
    (c) => c.company_name.trim().length > 0
  );
  return withName.length > 0 ? 100 : 0;
}
