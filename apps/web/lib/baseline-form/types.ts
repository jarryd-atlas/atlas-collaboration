import type {
  EquipmentCategory,
  CompressorType,
  CondenserType,
  EvaporatorType,
  VesselType,
  DefrostType,
  RefrigerationLoop,
  LaborRole,
  FacilityType,
  SystemType,
  DemandResponseStatus,
} from "@repo/shared/constants";

// ═══════════════════════════════════════════════════════════════
// Form Section Definitions
// ═══════════════════════════════════════════════════════════════

export const BASELINE_FORM_SECTIONS = [
  "contact",
  "facility",
  "system",
  "network",
  "equipment",
  "documents",
  "energy",
  "operations",
  "efficiency",
  "contractors",
  "review",
] as const;

export type BaselineFormSection = (typeof BASELINE_FORM_SECTIONS)[number];

export const SECTION_LABELS: Record<BaselineFormSection, string> = {
  contact: "Your Info",
  facility: "Your Facility",
  system: "Refrigeration System",
  network: "Network & Connectivity",
  equipment: "Equipment",
  documents: "Documents",
  energy: "Energy & Utility",
  operations: "Operations",
  efficiency: "Efficiency & Automation",
  contractors: "Preferred Contractors",
  review: "Review",
};

export const SECTION_DESCRIPTIONS: Record<BaselineFormSection, string> = {
  contact: "Tell us about yourself and your team at this facility",
  facility: "Help us understand your facility and operating schedule",
  system: "Describe your refrigeration system configuration",
  network: "Test your internet connection and describe your network setup",
  equipment: "List your compressors, condensers, and evaporators",
  documents: "Review existing documents or upload new ones",
  energy: "Share your utility provider and rate structure details",
  operations: "Tell us about your operating pressures and constraints",
  efficiency: "Help us identify opportunities to streamline your workflow",
  contractors: "Share your preferred service providers and contractors",
  review: "Review your responses and confirm",
};

// ═══════════════════════════════════════════════════════════════
// Section Data Types
// ═══════════════════════════════════════════════════════════════

export interface ContactData {
  id?: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  is_primary: boolean;
}

export interface FacilityData {
  facility_type: FacilityType | "";
  operating_days_per_week: number | null;
  daily_operational_hours: number | null;
  runs_24_7: boolean;
  has_blast_freezing: boolean;
}

export interface SystemData {
  system_type: SystemType | "";
  refrigerant: string;
  control_system: string;
  control_hardware: string;
  micro_panel_type: string;
  has_sub_metering: boolean;
}

export interface CompressorSpecs {
  type: CompressorType | "";
  hp: number | null;
  loop: RefrigerationLoop | "";
  loading_summer: number | null;
  loading_shoulder: number | null;
  loading_winter: number | null;
  suction_setpoint_psig: number | null;
  discharge_setpoint_psig: number | null;
  vfd_equipped: boolean;
}

export interface CondenserSpecs {
  type: CondenserType | "";
  total_fans: number | null;
  total_hp_fan_and_pump: number | null;
}

export interface EvaporatorSpecs {
  type: EvaporatorType | "";
  num_units: number | null;
  avg_fan_hp: number | null;
  defrost_type: DefrostType | "";
  loop: RefrigerationLoop | "";
}

export interface VesselSpecs {
  type: VesselType | "";
  capacity_gallons: number | null;
  pressure_rating: number | null;
}

export interface EquipmentData {
  id?: string;
  category: EquipmentCategory;
  name: string;
  manufacturer: string;
  model: string;
  quantity: number;
  specs: CompressorSpecs | CondenserSpecs | EvaporatorSpecs | VesselSpecs | Record<string, unknown>;
  notes: string;
}

export interface EnergyData {
  supply_provider: string;
  distribution_provider: string;
  on_peak_energy_rate: number | null;
  on_peak_demand_rate: number | null;
  on_peak_start_hour: number | null;
  on_peak_end_hour: number | null;
  on_peak_months: string;
  off_peak_energy_rate: number | null;
  off_peak_demand_rate: number | null;
  shoulder_energy_rate: number | null;
  shoulder_demand_rate: number | null;
  shoulder_start_hour: number | null;
  shoulder_end_hour: number | null;
  shoulder_months: string;
  demand_response_status: DemandResponseStatus | "";
  annual_energy_spend: number | null;
}

export interface OperationsData {
  suction_pressure_typical: number | null;
  discharge_pressure_typical: number | null;
  can_shed_load: boolean;
  can_shutdown: boolean;
  shutdown_constraints: string;
  curtailment_enrolled: boolean;
  curtailment_frequency: string;
  curtailment_barriers: string;
  seasonality_notes: string;
  temperature_challenges: string;
  operational_nuances: string;
  product_notes: string;
  customer_mix: string;
  staffing_notes: string;
}

export interface HeadcountEntry {
  role: LaborRole | "";
  count: number | null;
  hours_per_week: number | null;
}

export interface EfficiencyData {
  headcount: HeadcountEntry[];
  total_manual_hours_week: number | null;
  pain_points: string;
  manual_processes: string;
  time_sinks: string;
  automation_opportunities: string;
}

export type ConnectionType =
  | "fiber"
  | "cable"
  | "dsl"
  | "cellular"
  | "satellite"
  | "fixed_wireless"
  | "unknown"
  | "";

export interface NetworkTestResult {
  id?: string;
  tested_at: string;
  download_mbps: number | null;
  upload_mbps: number | null;
  latency_ms: number | null;
  jitter_ms: number | null;
  user_agent: string;
  connection_info: string;
  ip_address: string;
  city: string;
  region: string;
  country: string;
  timezone: string;
  isp: string;
  notes: string;
}

export interface NetworkData {
  isp_name: string;
  connection_type: ConnectionType;
  has_backup_connection: boolean;
  backup_connection_type: string;
  known_issues: string;
  network_stability_notes: string;
  test_results: NetworkTestResult[];
}

export interface ContractorData {
  id?: string;
  company_name: string;
  contractor_type: string;
  contact_name: string;
  email: string;
  phone: string;
  notes: string;
}

export interface FormMeta {
  currentSection: number;
  sectionCompletion: Partial<Record<BaselineFormSection, number>>;
  lastSavedAt: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Full Form State
// ═══════════════════════════════════════════════════════════════

export interface BaselineFormState {
  contacts: ContactData[];
  facility: FacilityData;
  system: SystemData;
  network: NetworkData;
  equipment: EquipmentData[];
  energy: EnergyData;
  operations: OperationsData;
  efficiency: EfficiencyData;
  contractors: ContractorData[];
  meta: FormMeta;
}

// ═══════════════════════════════════════════════════════════════
// Form Context (passed to server component from page)
// ═══════════════════════════════════════════════════════════════

export interface BaselineFormContext {
  token: string;
  assessmentId: string;
  siteId: string;
  tenantId: string;
  siteName: string;
  customerName: string;
  customerLogoUrl: string | null;
}

// ═══════════════════════════════════════════════════════════════
// Reducer Actions
// ═══════════════════════════════════════════════════════════════

export type BaselineFormAction =
  | { type: "SET_CONTACTS"; contacts: ContactData[] }
  | { type: "UPDATE_CONTACT"; index: number; contact: ContactData }
  | { type: "ADD_CONTACT" }
  | { type: "REMOVE_CONTACT"; index: number }
  | { type: "SET_FACILITY"; facility: Partial<FacilityData> }
  | { type: "SET_SYSTEM"; system: Partial<SystemData> }
  | { type: "SET_EQUIPMENT"; equipment: EquipmentData[] }
  | { type: "UPDATE_EQUIPMENT"; index: number; equipment: EquipmentData }
  | { type: "ADD_EQUIPMENT"; category: EquipmentCategory }
  | { type: "DUPLICATE_EQUIPMENT"; index: number }
  | { type: "REMOVE_EQUIPMENT"; index: number }
  | { type: "SET_ENERGY"; energy: Partial<EnergyData> }
  | { type: "SET_OPERATIONS"; operations: Partial<OperationsData> }
  | { type: "SET_EFFICIENCY"; efficiency: Partial<EfficiencyData> }
  | { type: "UPDATE_HEADCOUNT"; index: number; entry: HeadcountEntry }
  | { type: "ADD_HEADCOUNT" }
  | { type: "REMOVE_HEADCOUNT"; index: number }
  | { type: "SET_NETWORK"; network: Partial<NetworkData> }
  | { type: "ADD_NETWORK_TEST"; result: NetworkTestResult }
  | { type: "REMOVE_NETWORK_TEST"; index: number }
  | { type: "SET_CONTRACTORS"; contractors: ContractorData[] }
  | { type: "UPDATE_CONTRACTOR"; index: number; contractor: ContractorData }
  | { type: "ADD_CONTRACTOR" }
  | { type: "REMOVE_CONTRACTOR"; index: number }
  | { type: "SET_SECTION"; section: number }
  | { type: "SET_META"; meta: Partial<FormMeta> }
  | { type: "HYDRATE"; state: Partial<BaselineFormState> };

// ═══════════════════════════════════════════════════════════════
// Save Status
// ═══════════════════════════════════════════════════════════════

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline";
