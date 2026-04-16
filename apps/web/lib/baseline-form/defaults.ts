import type {
  BaselineFormState,
  ContactData,
  ContractorData,
  FacilityData,
  SystemData,
  NetworkData,
  EquipmentData,
  EnergyData,
  OperationsData,
  EfficiencyData,
  CompressorSpecs,
  CondenserSpecs,
  EvaporatorSpecs,
  HeadcountEntry,
  EngineRoomData,
  TemperatureZoneData,
} from "./types";
import type { EquipmentCategory } from "@repo/shared/constants";

// ═══════════════════════════════════════════════════════════════
// Empty Defaults
// ═══════════════════════════════════════════════════════════════

export const emptyContact: ContactData = {
  name: "",
  title: "",
  email: "",
  phone: "",
  is_primary: false,
};

export const emptyFacility: FacilityData = {
  facility_type: "",
  operating_days_per_week: null,
  daily_operational_hours: null,
  runs_24_7: false,
  has_blast_freezing: false,
};

export const emptySystem: SystemData = {
  system_type: "",
  refrigerant: "",
  control_system: "",
  control_hardware: "",
  micro_panel_type: "",
  has_sub_metering: false,
};

export const emptyEnergy: EnergyData = {
  supply_provider: "",
  distribution_provider: "",
  on_peak_energy_rate: null,
  on_peak_demand_rate: null,
  on_peak_start_hour: null,
  on_peak_end_hour: null,
  on_peak_months: "",
  off_peak_energy_rate: null,
  off_peak_demand_rate: null,
  shoulder_energy_rate: null,
  shoulder_demand_rate: null,
  shoulder_start_hour: null,
  shoulder_end_hour: null,
  shoulder_months: "",
  demand_response_status: "",
  annual_energy_spend: null,
};

export const emptyOperations: OperationsData = {
  suction_pressure_typical: null,
  discharge_pressure_typical: null,
  can_shed_load: false,
  can_shutdown: false,
  shutdown_constraints: "",
  curtailment_enrolled: false,
  curtailment_frequency: "",
  curtailment_barriers: "",
  seasonality_notes: "",
  temperature_challenges: "",
  operational_nuances: "",
  product_notes: "",
  customer_mix: "",
  staffing_notes: "",
};

export const emptyHeadcount: HeadcountEntry = {
  role: "",
  count: null,
  hours_per_week: null,
};

export const emptyEfficiency: EfficiencyData = {
  headcount: [],
  total_manual_hours_week: null,
  pain_points: "",
  manual_processes: "",
  time_sinks: "",
  automation_opportunities: "",
};

export const emptyNetwork: NetworkData = {
  isp_name: "",
  connection_type: "",
  has_backup_connection: false,
  backup_connection_type: "",
  known_issues: "",
  network_stability_notes: "",
  test_results: [],
};

export const emptyContractor: ContractorData = {
  company_name: "",
  contractor_type: "",
  contact_name: "",
  email: "",
  phone: "",
  notes: "",
};

export const emptyEngineRoom: EngineRoomData = {
  name: "",
  sort_order: 0,
  system_type: "",
  refrigerant: "",
  control_system: "",
  control_hardware: "",
  micro_panel_type: "",
  suction_pressure_typical: null,
  discharge_pressure_typical: null,
  connected_to_engine_room_id: null,
  shared_controls: false,
  notes: "",
};

export const emptyTemperatureZone: TemperatureZoneData = {
  engine_room_id: null,
  name: "",
  sort_order: 0,
  zone_type: "",
  target_temp_f: null,
  length_ft: null,
  width_ft: null,
  height_ft: null,
  num_doors: null,
  door_type: "",
  insulation_thickness_in: null,
  insulation_condition: "",
  notes: "",
};

export const emptyFormState: BaselineFormState = {
  contacts: [],
  facility: emptyFacility,
  engineRooms: [],
  temperatureZones: [],
  system: emptySystem,
  network: emptyNetwork,
  equipment: [],
  energy: emptyEnergy,
  operations: emptyOperations,
  efficiency: emptyEfficiency,
  contractors: [],
  meta: {
    currentSection: 0,
    sectionCompletion: {},
    lastSavedAt: null,
  },
};

// ═══════════════════════════════════════════════════════════════
// Smart Defaults — derive from earlier answers
// ═══════════════════════════════════════════════════════════════

export function getDefaultCompressorSpecs(state: BaselineFormState): CompressorSpecs {
  const isAmmonia = state.system.refrigerant === "ammonia";
  const isTwoStage = state.system.system_type === "two_stage";

  return {
    type: isAmmonia ? "screw" : "",
    hp: null,
    loop: isTwoStage ? "low" : "",
    loading_summer: 1.0,
    loading_shoulder: 0.75,
    loading_winter: 0.5,
    suction_setpoint_psig: null,
    discharge_setpoint_psig: null,
    vfd_equipped: false,
  };
}

export function getDefaultCondenserSpecs(): CondenserSpecs {
  return {
    type: "evaporative",
    total_fans: null,
    total_hp_fan_and_pump: null,
  };
}

export function getDefaultEvaporatorSpecs(state: BaselineFormState): EvaporatorSpecs {
  const isTwoStage = state.system.system_type === "two_stage";

  return {
    type: "unit_cooler",
    num_units: null,
    avg_fan_hp: null,
    defrost_type: "",
    loop: isTwoStage ? "low" : "",
  };
}

/** Create a new equipment entry with smart defaults based on form state */
export function createDefaultEquipment(
  category: EquipmentCategory,
  state: BaselineFormState,
  existingCount: number
): EquipmentData {
  const tagPrefix = {
    compressor: "C",
    condenser: "Cond",
    evaporator: "Evap",
    vessel: "V",
    vfd: "VFD",
    pump: "P",
    controls: "Ctrl",
    other: "Misc",
  }[category];

  const specs = (() => {
    switch (category) {
      case "compressor":
        return getDefaultCompressorSpecs(state);
      case "condenser":
        return getDefaultCondenserSpecs();
      case "evaporator":
        return getDefaultEvaporatorSpecs(state);
      default:
        return {};
    }
  })();

  return {
    category,
    name: `${tagPrefix}-${existingCount + 1}`,
    manufacturer: "",
    model: "",
    quantity: 1,
    specs,
    notes: "",
  };
}

/** Duplicate an equipment entry, incrementing the tag name */
export function duplicateEquipment(
  source: EquipmentData,
  newIndex: number
): EquipmentData {
  const tagMatch = source.name.match(/^(.+?)-?(\d+)$/);
  const newName = tagMatch
    ? `${tagMatch[1]}-${newIndex + 1}`
    : `${source.name} (copy)`;

  return {
    ...source,
    id: undefined, // new record
    name: newName,
    specs: { ...source.specs },
  };
}

/** Get available loop options based on system config (or engine room config) */
export function getAvailableLoops(
  state: BaselineFormState,
  engineRoom?: EngineRoomData
): Array<{ value: string; label: string }> {
  const loops: Array<{ value: string; label: string }> = [];
  const systemType = engineRoom?.system_type || state.system.system_type;

  if (systemType === "two_stage" || systemType === "cascade") {
    loops.push({ value: "low", label: "Low Stage" });
    loops.push({ value: "high", label: "High Stage" });
  } else {
    loops.push({ value: "low", label: "Low" });
  }

  if (state.facility.has_blast_freezing) {
    loops.push({ value: "blast", label: "Blast" });
  }

  return loops;
}

/** Create a new engine room with smart defaults from existing site-level config */
export function createDefaultEngineRoom(
  state: BaselineFormState,
  existingCount: number
): EngineRoomData {
  // First ER inherits site-level system config
  const isFirst = existingCount === 0;
  return {
    name: `Engine Room ${existingCount + 1}`,
    sort_order: existingCount,
    system_type: isFirst ? state.system.system_type : "",
    refrigerant: isFirst ? state.system.refrigerant : "",
    control_system: isFirst ? state.system.control_system : "",
    control_hardware: isFirst ? state.system.control_hardware : "",
    micro_panel_type: isFirst ? state.system.micro_panel_type : "",
    suction_pressure_typical: isFirst ? state.operations.suction_pressure_typical : null,
    discharge_pressure_typical: isFirst ? state.operations.discharge_pressure_typical : null,
    connected_to_engine_room_id: null,
    shared_controls: false,
    notes: "",
  };
}

/** Create a new temperature zone with defaults */
export function createDefaultZone(
  engineRoomId: string | null,
  existingCount: number
): TemperatureZoneData {
  return {
    engine_room_id: engineRoomId,
    name: `Zone ${existingCount + 1}`,
    sort_order: existingCount,
    zone_type: "",
    target_temp_f: null,
    length_ft: null,
    width_ft: null,
    height_ft: null,
    num_doors: null,
    door_type: "",
    insulation_thickness_in: null,
    insulation_condition: "",
    notes: "",
  };
}
