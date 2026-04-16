"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type {
  BaselineFormState,
  BaselineFormAction,
  SaveStatus,
  ContactData,
  ContractorData,
  FacilityData,
  SystemData,
  NetworkData,
  NetworkTestResult,
  EnergyData,
  OperationsData,
  EfficiencyData,
  EquipmentData,
  HeadcountEntry,
  BaselineFormSection,
  EngineRoomData,
  TemperatureZoneData,
} from "../../../../../lib/baseline-form/types";
import {
  BASELINE_FORM_SECTIONS,
  SECTION_LABELS,
  SECTION_DESCRIPTIONS,
} from "../../../../../lib/baseline-form/types";
import {
  emptyFormState,
  emptyContact,
  emptyContractor,
  emptyNetwork,
  emptyHeadcount,
  createDefaultEquipment,
  duplicateEquipment,
  createDefaultEngineRoom,
  createDefaultZone,
} from "../../../../../lib/baseline-form/defaults";
import { getAllSectionCompletions } from "../../../../../lib/baseline-form/completion";
import {
  upsertBaselineContact,
  deleteBaselineContact,
  upsertBaselineContractor,
  deleteBaselineContractor,
  upsertBaselineEquipment,
  deleteBaselineEquipment,
  upsertBaselineFacilityAndSystem,
  upsertBaselineEnergy,
  upsertBaselineOperations,
  upsertBaselineEfficiency,
  upsertBaselineNetwork,
  insertNetworkTestResult,
  deleteNetworkTestResult,
  updateBaselineFormProgress,
  submitBaselineForm,
  upsertBaselineEngineRoom,
  deleteBaselineEngineRoom,
  upsertBaselineTemperatureZone,
  deleteBaselineTemperatureZone,
} from "../../../../../lib/actions/baseline-form";
import type { EquipmentCategory } from "@repo/shared/constants";

import { FormProgress } from "./form-progress";
import { SectionShell } from "./section-shell";
import { SaveIndicator } from "./save-indicator";
import { LayoutSection } from "./sections/layout-section";
import { SaveToast } from "./save-toast";
import type { SaveToastData } from "./save-toast";
import { useBaselineDraft } from "./use-baseline-draft";

// Lazy section imports — these are simple inline components for now
// Sections: Contact, Facility, System, Equipment, Documents, Energy, Operations, Efficiency, Review

// ═══════════════════════════════════════════════════════════════
// Save Context
// ═══════════════════════════════════════════════════════════════

interface SaveContextValue {
  status: SaveStatus;
  save: (section: BaselineFormSection) => Promise<boolean>;
  flush: () => Promise<boolean>;
}

const SaveContext = createContext<SaveContextValue>({
  status: "idle",
  save: async () => true,
  flush: async () => true,
});

export function useSaveContext() {
  return useContext(SaveContext);
}

// ═══════════════════════════════════════════════════════════════
// Reducer
// ═══════════════════════════════════════════════════════════════

function formReducer(
  state: BaselineFormState,
  action: BaselineFormAction
): BaselineFormState {
  switch (action.type) {
    case "SET_CONTACTS":
      return { ...state, contacts: action.contacts };

    case "UPDATE_CONTACT":
      return {
        ...state,
        contacts: state.contacts.map((c, i) =>
          i === action.index ? action.contact : c
        ),
      };

    case "ADD_CONTACT":
      return {
        ...state,
        contacts: [
          ...state.contacts,
          { ...emptyContact, is_primary: state.contacts.length === 0 },
        ],
      };

    case "REMOVE_CONTACT":
      return {
        ...state,
        contacts: state.contacts.filter((_, i) => i !== action.index),
      };

    case "SET_FACILITY":
      return {
        ...state,
        facility: { ...state.facility, ...action.facility },
      };

    case "SET_SYSTEM":
      return {
        ...state,
        system: { ...state.system, ...action.system },
      };

    case "SET_EQUIPMENT":
      return { ...state, equipment: action.equipment };

    case "UPDATE_EQUIPMENT":
      return {
        ...state,
        equipment: state.equipment.map((e, i) =>
          i === action.index ? action.equipment : e
        ),
      };

    case "ADD_EQUIPMENT": {
      const count = state.equipment.filter(
        (e) => e.category === action.category
      ).length;
      return {
        ...state,
        equipment: [
          ...state.equipment,
          createDefaultEquipment(action.category, state, count),
        ],
      };
    }

    case "DUPLICATE_EQUIPMENT": {
      const source = state.equipment[action.index];
      if (!source) return state;
      const categoryCount = state.equipment.filter(
        (e) => e.category === source.category
      ).length;
      const newEquip = duplicateEquipment(source, categoryCount);
      return {
        ...state,
        equipment: [...state.equipment, newEquip],
      };
    }

    case "REMOVE_EQUIPMENT":
      return {
        ...state,
        equipment: state.equipment.filter((_, i) => i !== action.index),
      };

    case "SET_ENERGY":
      return {
        ...state,
        energy: { ...state.energy, ...action.energy },
      };

    case "SET_OPERATIONS":
      return {
        ...state,
        operations: { ...state.operations, ...action.operations },
      };

    case "SET_EFFICIENCY":
      return {
        ...state,
        efficiency: { ...state.efficiency, ...action.efficiency },
      };

    case "UPDATE_HEADCOUNT":
      return {
        ...state,
        efficiency: {
          ...state.efficiency,
          headcount: state.efficiency.headcount.map((h, i) =>
            i === action.index ? action.entry : h
          ),
        },
      };

    case "ADD_HEADCOUNT":
      return {
        ...state,
        efficiency: {
          ...state.efficiency,
          headcount: [...state.efficiency.headcount, { ...emptyHeadcount }],
        },
      };

    case "REMOVE_HEADCOUNT":
      return {
        ...state,
        efficiency: {
          ...state.efficiency,
          headcount: state.efficiency.headcount.filter(
            (_, i) => i !== action.index
          ),
        },
      };

    case "SET_NETWORK":
      return {
        ...state,
        network: { ...state.network, ...action.network },
      };

    case "ADD_NETWORK_TEST":
      return {
        ...state,
        network: {
          ...state.network,
          test_results: [action.result, ...state.network.test_results],
        },
      };

    case "REMOVE_NETWORK_TEST":
      return {
        ...state,
        network: {
          ...state.network,
          test_results: state.network.test_results.filter(
            (_, i) => i !== action.index
          ),
        },
      };

    case "SET_CONTRACTORS":
      return { ...state, contractors: action.contractors };

    case "UPDATE_CONTRACTOR":
      return {
        ...state,
        contractors: state.contractors.map((c, i) =>
          i === action.index ? action.contractor : c
        ),
      };

    case "ADD_CONTRACTOR":
      return {
        ...state,
        contractors: [...state.contractors, { ...emptyContractor }],
      };

    case "REMOVE_CONTRACTOR":
      return {
        ...state,
        contractors: state.contractors.filter((_, i) => i !== action.index),
      };

    // ─── Engine Room actions ──────────────────────────────────

    case "SET_ENGINE_ROOMS":
      return { ...state, engineRooms: action.engineRooms };

    case "ADD_ENGINE_ROOM": {
      const newER = createDefaultEngineRoom(state, state.engineRooms.length);
      return {
        ...state,
        engineRooms: [...state.engineRooms, newER],
      };
    }

    case "UPDATE_ENGINE_ROOM":
      return {
        ...state,
        engineRooms: state.engineRooms.map((er, i) =>
          i === action.index ? { ...er, ...action.engineRoom } : er
        ),
      };

    case "REMOVE_ENGINE_ROOM": {
      const removedER = state.engineRooms[action.index];
      const removedERId = removedER?.id;
      return {
        ...state,
        engineRooms: state.engineRooms.filter((_, i) => i !== action.index),
        // Clear engine_room_id on associated equipment
        equipment: removedERId
          ? state.equipment.map((e) =>
              e.engine_room_id === removedERId
                ? { ...e, engine_room_id: null }
                : e
            )
          : state.equipment,
        // Clear engine_room_id on associated zones
        temperatureZones: removedERId
          ? state.temperatureZones.map((z) =>
              z.engine_room_id === removedERId
                ? { ...z, engine_room_id: null }
                : z
            )
          : state.temperatureZones,
      };
    }

    // ─── Temperature Zone actions ──────────────────────────────

    case "SET_TEMPERATURE_ZONES":
      return { ...state, temperatureZones: action.zones };

    case "ADD_TEMPERATURE_ZONE": {
      const newZone = createDefaultZone(
        action.engineRoomId ?? null,
        state.temperatureZones.length
      );
      return {
        ...state,
        temperatureZones: [...state.temperatureZones, newZone],
      };
    }

    case "UPDATE_TEMPERATURE_ZONE":
      return {
        ...state,
        temperatureZones: state.temperatureZones.map((z, i) =>
          i === action.index ? { ...z, ...action.zone } : z
        ),
      };

    case "REMOVE_TEMPERATURE_ZONE": {
      const removedZone = state.temperatureZones[action.index];
      const removedZoneId = removedZone?.id;
      return {
        ...state,
        temperatureZones: state.temperatureZones.filter(
          (_, i) => i !== action.index
        ),
        // Clear zone_id on associated evaporators
        equipment: removedZoneId
          ? state.equipment.map((e) =>
              e.zone_id === removedZoneId ? { ...e, zone_id: null } : e
            )
          : state.equipment,
      };
    }

    // ─── Promote site-level config into first engine room ─────

    case "PROMOTE_TO_ENGINE_ROOM": {
      if (state.engineRooms.length > 0) return state; // Already has ERs
      const firstER: EngineRoomData = {
        name: "Engine Room 1",
        sort_order: 0,
        system_type: state.system.system_type,
        refrigerant: state.system.refrigerant,
        control_system: state.system.control_system,
        control_hardware: state.system.control_hardware,
        micro_panel_type: state.system.micro_panel_type,
        suction_pressure_typical: state.operations.suction_pressure_typical,
        discharge_pressure_typical: state.operations.discharge_pressure_typical,
        connected_to_engine_room_id: null,
        shared_controls: false,
        notes: "",
      };
      return {
        ...state,
        engineRooms: [firstER],
      };
    }

    case "SET_SECTION":
      return {
        ...state,
        meta: { ...state.meta, currentSection: action.section },
      };

    case "SET_META":
      return {
        ...state,
        meta: { ...state.meta, ...action.meta },
      };

    case "HYDRATE":
      return { ...state, ...action.state };

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════
// Hydration helpers
// ═══════════════════════════════════════════════════════════════

type FormDataResult = NonNullable<
  Awaited<ReturnType<typeof import("../../../../../lib/actions/baseline-form").getBaselineFormData>>
>;

function hydrateState(data: FormDataResult): BaselineFormState {
  // Map contacts
  const contacts: ContactData[] = (data.contacts ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    name: (c.name as string) ?? "",
    title: (c.title as string) ?? "",
    email: (c.email as string) ?? "",
    phone: (c.phone as string) ?? "",
    is_primary: (c.is_primary as boolean) ?? false,
  }));

  // Map facility from operational params
  const op = data.operationalParams ?? {};
  const facility: FacilityData = {
    facility_type: (op.facility_type as FacilityData["facility_type"]) ?? "",
    operating_days_per_week: (op.operating_days_per_week as number) ?? null,
    daily_operational_hours: (op.daily_operational_hours as number) ?? null,
    runs_24_7: (op.runs_24_7 as boolean) ?? false,
    has_blast_freezing: (op.has_blast_freezing as boolean) ?? false,
  };

  // Map system from operational params
  const system: SystemData = {
    system_type: (op.system_type as SystemData["system_type"]) ?? "",
    refrigerant: (op.refrigerant as SystemData["refrigerant"]) ?? "",
    control_system: (op.control_system as string) ?? "",
    control_hardware: (op.control_hardware as string) ?? "",
    micro_panel_type: (op.micro_panel_type as string) ?? "",
    has_sub_metering: (op.has_sub_metering as boolean) ?? false,
  };

  // Map equipment (including engine_room_id and zone_id)
  const equipment: EquipmentData[] = (data.equipment ?? []).map(
    (e: Record<string, unknown>) => ({
      id: e.id as string,
      category: (e.category as EquipmentCategory) ?? "other",
      name: (e.name as string) ?? "",
      manufacturer: (e.manufacturer as string) ?? "",
      model: (e.model as string) ?? "",
      quantity: (e.quantity as number) ?? 1,
      specs: (e.specs as Record<string, unknown>) ?? {},
      notes: (e.notes as string) ?? "",
      engine_room_id: (e.engine_room_id as string) ?? null,
      zone_id: (e.zone_id as string) ?? null,
    })
  );

  // Map engine rooms
  const engineRooms: EngineRoomData[] = ((data as any).engineRooms ?? []).map(
    (er: Record<string, unknown>) => ({
      id: er.id as string,
      name: (er.name as string) ?? "",
      sort_order: (er.sort_order as number) ?? 0,
      system_type: (er.system_type as EngineRoomData["system_type"]) ?? "",
      refrigerant: (er.refrigerant as string) ?? "",
      control_system: (er.control_system as string) ?? "",
      control_hardware: (er.control_hardware as string) ?? "",
      micro_panel_type: (er.micro_panel_type as string) ?? "",
      suction_pressure_typical: (er.suction_pressure_typical as number) ?? null,
      discharge_pressure_typical: (er.discharge_pressure_typical as number) ?? null,
      connected_to_engine_room_id: (er.connected_to_engine_room_id as string) ?? null,
      shared_controls: (er.shared_controls as boolean) ?? false,
      notes: (er.notes as string) ?? "",
    })
  );

  // Map temperature zones
  const temperatureZones: TemperatureZoneData[] = ((data as any).temperatureZones ?? []).map(
    (z: Record<string, unknown>) => ({
      id: z.id as string,
      engine_room_id: (z.engine_room_id as string) ?? null,
      name: (z.name as string) ?? "",
      sort_order: (z.sort_order as number) ?? 0,
      zone_type: (z.zone_type as TemperatureZoneData["zone_type"]) ?? "",
      target_temp_f: (z.target_temp_f as number) ?? null,
      length_ft: (z.length_ft as number) ?? null,
      width_ft: (z.width_ft as number) ?? null,
      height_ft: (z.height_ft as number) ?? null,
      num_doors: (z.num_doors as number) ?? null,
      door_type: (z.door_type as TemperatureZoneData["door_type"]) ?? "",
      insulation_thickness_in: (z.insulation_thickness_in as number) ?? null,
      insulation_condition: (z.insulation_condition as TemperatureZoneData["insulation_condition"]) ?? "",
      notes: (z.notes as string) ?? "",
    })
  );

  // Map energy from TOU schedule
  const tou = data.touSchedule ?? {};
  const energy: EnergyData = {
    supply_provider: (tou.supply_provider as string) ?? "",
    distribution_provider: (tou.distribution_provider as string) ?? "",
    on_peak_energy_rate: (tou.on_peak_energy_rate as number) ?? null,
    on_peak_demand_rate: (tou.on_peak_demand_rate as number) ?? null,
    on_peak_start_hour: (tou.on_peak_start_hour as number) ?? null,
    on_peak_end_hour: (tou.on_peak_end_hour as number) ?? null,
    on_peak_months: (tou.on_peak_months as string) ?? "",
    off_peak_energy_rate: (tou.off_peak_energy_rate as number) ?? null,
    off_peak_demand_rate: (tou.off_peak_demand_rate as number) ?? null,
    shoulder_energy_rate: (tou.shoulder_energy_rate as number) ?? null,
    shoulder_demand_rate: (tou.shoulder_demand_rate as number) ?? null,
    shoulder_start_hour: (tou.shoulder_start_hour as number) ?? null,
    shoulder_end_hour: (tou.shoulder_end_hour as number) ?? null,
    shoulder_months: (tou.shoulder_months as string) ?? "",
    demand_response_status: (tou.demand_response_status as EnergyData["demand_response_status"]) ?? "",
    annual_energy_spend: (tou.annual_energy_spend as number) ?? null,
  };

  // Map operations
  const ops = data.operations ?? {};
  const operations: OperationsData = {
    suction_pressure_typical: (ops.suction_pressure_typical as number) ?? null,
    discharge_pressure_typical:
      (ops.discharge_pressure_typical as number) ?? null,
    can_shed_load: (ops.can_shed_load as boolean) ?? false,
    can_shutdown: (ops.can_shutdown as boolean) ?? false,
    shutdown_constraints: (ops.shutdown_constraints as string) ?? "",
    curtailment_enrolled: (ops.curtailment_enrolled as boolean) ?? false,
    curtailment_frequency: (ops.curtailment_frequency as string) ?? "",
    curtailment_barriers: (ops.curtailment_barriers as string) ?? "",
    seasonality_notes: (ops.seasonality_notes as string) ?? "",
    temperature_challenges: (ops.temperature_challenges as string) ?? "",
    operational_nuances: (ops.operational_nuances as string) ?? "",
    product_notes: (ops.product_notes as string) ?? "",
    customer_mix: (ops.customer_mix as string) ?? "",
    staffing_notes: (ops.staffing_notes as string) ?? "",
  };

  // Map efficiency from labor baseline
  const labor = data.laborBaseline ?? {};
  let headcount: HeadcountEntry[] = [];
  if (labor.headcount) {
    try {
      const parsed =
        typeof labor.headcount === "string"
          ? JSON.parse(labor.headcount)
          : labor.headcount;
      if (Array.isArray(parsed)) {
        headcount = parsed.map((h: Record<string, unknown>) => ({
          role: (h.role as HeadcountEntry["role"]) ?? "",
          count: (h.count as number) ?? null,
          hours_per_week: (h.hours_per_week as number) ?? null,
        }));
      }
    } catch {
      headcount = [];
    }
  }

  const efficiency: EfficiencyData = {
    headcount,
    total_manual_hours_week:
      (labor.total_manual_hours_week as number) ?? null,
    pain_points: (labor.pain_points as string) ?? "",
    manual_processes: (labor.manual_processes as string) ?? "",
    time_sinks: (labor.time_sinks as string) ?? "",
    automation_opportunities: (labor.automation_opportunities as string) ?? "",
  };

  // Map network diagnostics
  const nd = (data as any).networkDiagnostics ?? {};
  const networkTestResults: NetworkTestResult[] = ((data as any).networkTestResults ?? []).map(
    (r: Record<string, unknown>) => ({
      id: r.id as string,
      tested_at: (r.tested_at as string) ?? new Date().toISOString(),
      download_mbps: (r.download_mbps as number) ?? null,
      upload_mbps: (r.upload_mbps as number) ?? null,
      latency_ms: (r.latency_ms as number) ?? null,
      jitter_ms: (r.jitter_ms as number) ?? null,
      user_agent: (r.user_agent as string) ?? "",
      connection_info: (r.connection_info as string) ?? "",
      ip_address: (r.ip_address as string) ?? "",
      city: (r.city as string) ?? "",
      region: (r.region as string) ?? "",
      country: (r.country as string) ?? "",
      timezone: (r.timezone as string) ?? "",
      isp: (r.isp as string) ?? "",
      notes: (r.notes as string) ?? "",
    })
  );
  const network: NetworkData = {
    isp_name: (nd.isp_name as string) ?? "",
    connection_type: (nd.connection_type as NetworkData["connection_type"]) ?? "",
    has_backup_connection: (nd.has_backup_connection as boolean) ?? false,
    backup_connection_type: (nd.backup_connection_type as string) ?? "",
    known_issues: (nd.known_issues as string) ?? "",
    network_stability_notes: (nd.network_stability_notes as string) ?? "",
    test_results: networkTestResults,
  };

  // Map contractors
  const contractors: ContractorData[] = ((data as any).contractors ?? []).map(
    (c: Record<string, unknown>) => ({
      id: c.id as string,
      company_name: (c.company_name as string) ?? "",
      contractor_type: (c.contractor_type as string) ?? "",
      contact_name: (c.contact_name as string) ?? "",
      email: (c.email as string) ?? "",
      phone: (c.phone as string) ?? "",
      notes: (c.notes as string) ?? "",
    })
  );

  // Map form progress
  const fp = (data.formProgress ?? {}) as Record<string, unknown>;
  const meta = {
    currentSection: (fp.currentSection as number) ?? 0,
    sectionCompletion:
      (fp.sectionCompletion as Record<string, number>) ?? {},
    lastSavedAt: (fp.lastSavedAt as string) ?? null,
  };

  return {
    contacts,
    facility,
    engineRooms,
    temperatureZones,
    system,
    network,
    equipment,
    energy,
    operations,
    efficiency,
    contractors,
    meta,
  };
}

// ═══════════════════════════════════════════════════════════════
// Section Components (inline for now — will be moved to ./sections/)
// ═══════════════════════════════════════════════════════════════

function ContactSection({
  state,
  dispatch,
}: {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
}) {
  return (
    <div className="space-y-4">
      {state.contacts.length === 0 && (
        <p className="text-sm text-gray-400">
          No contacts yet. Add yourself and any team members who can help with
          this assessment.
        </p>
      )}

      {state.contacts.map((contact, index) => (
        <div
          key={contact.id ?? `new-${index}`}
          className="rounded-lg border border-gray-200 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase">
              {contact.is_primary ? "Primary Contact" : `Contact ${index + 1}`}
            </span>
            {state.contacts.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "REMOVE_CONTACT", index })
                }
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={contact.name}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CONTACT",
                    index,
                    contact: { ...contact, name: e.target.value },
                  })
                }
                placeholder="Jane Smith"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title
              </label>
              <input
                type="text"
                value={contact.title}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CONTACT",
                    index,
                    contact: { ...contact, title: e.target.value },
                  })
                }
                placeholder="Plant Manager"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={contact.email}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CONTACT",
                    index,
                    contact: { ...contact, email: e.target.value },
                  })
                }
                placeholder="jane@company.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={contact.phone}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CONTACT",
                    index,
                    contact: { ...contact, phone: e.target.value },
                  })
                }
                placeholder="(555) 123-4567"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => dispatch({ type: "ADD_CONTACT" })}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        Add another contact
      </button>
    </div>
  );
}

function FacilitySection({
  state,
  dispatch,
}: {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
}) {
  const f = state.facility;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Facility Type
        </label>
        <select
          value={f.facility_type}
          onChange={(e) =>
            dispatch({
              type: "SET_FACILITY",
              facility: { facility_type: e.target.value as FacilityData["facility_type"] },
            })
          }
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none bg-white"
        >
          <option value="">Select facility type...</option>
          <option value="cold_storage">Cold Storage / Warehouse</option>
          <option value="food_processing">Food Processing</option>
          <option value="distribution_center">Distribution Center</option>
          <option value="ice_arena">Ice Arena</option>
          <option value="brewery">Brewery / Beverage</option>
          <option value="pharmaceutical">Pharmaceutical</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Operating Days / Week
          </label>
          <input
            type="number"
            min={1}
            max={7}
            value={f.operating_days_per_week ?? ""}
            onChange={(e) =>
              dispatch({
                type: "SET_FACILITY",
                facility: {
                  operating_days_per_week: e.target.value
                    ? Number(e.target.value)
                    : null,
                },
              })
            }
            placeholder="5"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Daily Operational Hours
          </label>
          <input
            type="number"
            min={1}
            max={24}
            value={f.daily_operational_hours ?? ""}
            onChange={(e) =>
              dispatch({
                type: "SET_FACILITY",
                facility: {
                  daily_operational_hours: e.target.value
                    ? Number(e.target.value)
                    : null,
                },
              })
            }
            placeholder="16"
            disabled={f.runs_24_7}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={f.runs_24_7}
            onChange={(e) =>
              dispatch({
                type: "SET_FACILITY",
                facility: {
                  runs_24_7: e.target.checked,
                  ...(e.target.checked
                    ? { daily_operational_hours: 24, operating_days_per_week: 7 }
                    : {}),
                },
              })
            }
            className="h-4 w-4 rounded border-gray-300 text-[#91E100] focus:ring-[#91E100]/20"
          />
          <span className="text-sm text-gray-700">Facility runs 24/7</span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={f.has_blast_freezing}
            onChange={(e) =>
              dispatch({
                type: "SET_FACILITY",
                facility: { has_blast_freezing: e.target.checked },
              })
            }
            className="h-4 w-4 rounded border-gray-300 text-[#91E100] focus:ring-[#91E100]/20"
          />
          <span className="text-sm text-gray-700">
            Facility has blast freezing capability
          </span>
        </label>
      </div>
    </div>
  );
}

function SystemSection({
  state,
  dispatch,
}: {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
}) {
  const s = state.system;
  const hasERs = state.engineRooms.length > 0;

  if (hasERs) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm text-blue-800 font-medium mb-1">
            System configuration is per engine room
          </p>
          <p className="text-sm text-blue-700">
            Since you have {state.engineRooms.length} engine room{state.engineRooms.length > 1 ? "s" : ""} defined,
            system type, refrigerant, and controls are configured on each engine room
            in the Facility Layout section.
          </p>
          <div className="mt-3 space-y-1">
            {state.engineRooms.map((er, i) => (
              <div key={er.id ?? i} className="text-sm text-blue-700">
                <span className="font-medium">{er.name || `Engine Room ${i + 1}`}</span>
                {er.system_type && <span className="text-blue-500"> — {er.system_type}{er.refrigerant ? `, ${er.refrigerant}` : ""}</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="text-sm text-gray-500 italic">
          The fields below apply as defaults and can still be filled for reference.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            System Type
          </label>
          <select
            value={s.system_type}
            onChange={(e) =>
              dispatch({
                type: "SET_SYSTEM",
                system: { system_type: e.target.value as SystemData["system_type"] },
              })
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none bg-white"
          >
            <option value="">Select system type...</option>
            <option value="single_stage">Single Stage</option>
            <option value="two_stage">Two Stage</option>
            <option value="cascade">Cascade</option>
            <option value="secondary_loop">Secondary Loop</option>
            <option value="dx">Direct Expansion (DX)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primary Refrigerant
          </label>
          <select
            value={s.refrigerant}
            onChange={(e) =>
              dispatch({
                type: "SET_SYSTEM",
                system: { refrigerant: e.target.value },
              })
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none bg-white"
          >
            <option value="">Select refrigerant...</option>
            <option value="ammonia">Ammonia (R-717)</option>
            <option value="r22">R-22</option>
            <option value="r404a">R-404A</option>
            <option value="r507a">R-507A</option>
            <option value="r134a">R-134a</option>
            <option value="co2">CO2 (R-744)</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Control System / BAS
        </label>
        <input
          type="text"
          value={s.control_system}
          onChange={(e) =>
            dispatch({
              type: "SET_SYSTEM",
              system: { control_system: e.target.value },
            })
          }
          placeholder="e.g., Logix, Emerson, Allen-Bradley..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Control Hardware
          </label>
          <input
            type="text"
            value={s.control_hardware}
            onChange={(e) =>
              dispatch({
                type: "SET_SYSTEM",
                system: { control_hardware: e.target.value },
              })
            }
            placeholder="e.g., PLC model, panel type..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Micro Panel Type
          </label>
          <input
            type="text"
            value={s.micro_panel_type}
            onChange={(e) =>
              dispatch({
                type: "SET_SYSTEM",
                system: { micro_panel_type: e.target.value },
              })
            }
            placeholder="e.g., Emerson E2, Danfoss AK..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
          />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={s.has_sub_metering}
          onChange={(e) =>
            dispatch({
              type: "SET_SYSTEM",
              system: { has_sub_metering: e.target.checked },
            })
          }
          className="h-4 w-4 rounded border-gray-300 text-[#91E100] focus:ring-[#91E100]/20"
        />
        <span className="text-sm text-gray-700">
          Facility has electrical sub-metering
        </span>
      </label>
    </div>
  );
}

/** Build a compact one-line summary for an equipment item */
function getEquipmentSummary(eq: EquipmentData): string {
  const parts: string[] = [eq.name || eq.category];

  if (eq.manufacturer) parts.push(eq.manufacturer);
  if (eq.model) parts.push(eq.model);

  const specs = eq.specs as Record<string, unknown>;
  if (eq.category === "compressor") {
    if (specs.hp) parts.push(`${specs.hp} HP`);
    if (specs.type) parts.push(String(specs.type));
    if (specs.vfd_equipped) parts.push("VFD");
  } else if (eq.category === "condenser") {
    if (specs.total_fans) parts.push(`${specs.total_fans} fans`);
    if (specs.total_hp_fan_and_pump) parts.push(`${specs.total_hp_fan_and_pump} HP`);
  } else if (eq.category === "evaporator") {
    if (specs.num_units) parts.push(`${specs.num_units} units`);
    if (specs.avg_fan_hp) parts.push(`${specs.avg_fan_hp} HP avg`);
    if (specs.defrost_type) parts.push(String(specs.defrost_type));
  }

  if (eq.quantity > 1) parts.push(`qty ${eq.quantity}`);

  return parts.join(" \u00b7 ");
}

function EquipmentCard({
  eq,
  index,
  dispatch,
  defaultExpanded,
}: {
  eq: EquipmentData;
  index: number;
  dispatch: React.Dispatch<BaselineFormAction>;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* Collapsed header / summary */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <svg
          className={`h-3.5 w-3.5 text-gray-400 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
        <span className="text-sm text-gray-700 truncate flex-1">
          {getEquipmentSummary(eq)}
        </span>
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => dispatch({ type: "DUPLICATE_EQUIPMENT", index })}
            className="text-[10px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-100"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "REMOVE_EQUIPMENT", index })}
            className="text-[10px] text-red-400 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50"
          >
            Remove
          </button>
        </div>
      </button>

      {/* Expanded form */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Tag / Name
              </label>
              <input
                type="text"
                value={eq.name}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_EQUIPMENT",
                    index,
                    equipment: { ...eq, name: e.target.value },
                  })
                }
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Manufacturer
              </label>
              <input
                type="text"
                value={eq.manufacturer}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_EQUIPMENT",
                    index,
                    equipment: { ...eq, manufacturer: e.target.value },
                  })
                }
                placeholder="e.g., Frick, Vilter..."
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Model
              </label>
              <input
                type="text"
                value={eq.model}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_EQUIPMENT",
                    index,
                    equipment: { ...eq, model: e.target.value },
                  })
                }
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Qty
              </label>
              <input
                type="number"
                min={1}
                value={eq.quantity}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_EQUIPMENT",
                    index,
                    equipment: {
                      ...eq,
                      quantity: Number(e.target.value) || 1,
                    },
                  })
                }
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
              />
            </div>
          </div>

          {/* Category-specific specs */}
          {eq.category === "compressor" && (
            <CompressorSpecsFields
              specs={eq.specs as Record<string, unknown>}
              onChange={(specs) =>
                dispatch({
                  type: "UPDATE_EQUIPMENT",
                  index,
                  equipment: { ...eq, specs },
                })
              }
            />
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={eq.notes}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_EQUIPMENT",
                  index,
                  equipment: { ...eq, notes: e.target.value },
                })
              }
              placeholder="Any additional details..."
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Network Section
// ═══════════════════════════════════════════════════════════════

const CONNECTION_TYPE_OPTIONS = [
  { value: "", label: "Select..." },
  { value: "fiber", label: "Fiber" },
  { value: "cable", label: "Cable" },
  { value: "dsl", label: "DSL" },
  { value: "cellular", label: "Cellular / LTE / 5G" },
  { value: "satellite", label: "Satellite" },
  { value: "fixed_wireless", label: "Fixed Wireless" },
  { value: "unknown", label: "Unknown" },
];

function NetworkSection({
  state,
  dispatch,
  token,
  profileId,
}: {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
  token: string;
  profileId: string;
}) {
  const n = state.network;

  // Lazy import the hook to avoid loading test infra unless needed
  const [testHook, setTestHook] = useState<ReturnType<typeof import("../../../../../lib/hooks/use-network-test").useNetworkTest> | null>(null);
  const [testNote, setTestNote] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAndRunTest = useCallback(async () => {
    const mod = await import("../../../../../lib/hooks/use-network-test");
    // We can't call hooks dynamically — so we'll manage the test inline
    // Instead, use the module's non-hook approach via direct function pattern
    // Actually, let's just eagerly load it
  }, []);

  // We'll use a simple inline test approach instead of the hook (since hooks can't be conditionally loaded)
  const [testPhase, setTestPhase] = useState<string>("idle");
  const [testResults, setTestResults] = useState<{
    download_mbps: number | null;
    upload_mbps: number | null;
    latency_ms: number | null;
    jitter_ms: number | null;
  }>({ download_mbps: null, upload_mbps: null, latency_ms: null, jitter_ms: null });
  const [geoInfo, setGeoInfo] = useState<{
    ip: string; city: string; region: string; country: string; timezone: string; isp: string;
  }>({ ip: "", city: "", region: "", country: "", timezone: "", isp: "" });
  const [testError, setTestError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSpeedTest = useCallback(async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setTestError(null);
    setTestResults({ download_mbps: null, upload_mbps: null, latency_ms: null, jitter_ms: null });
    setTestNote("");

    try {
      // Fetch IP & geo info
      try {
        const infoResp = await fetch(`/api/network-test/info?_=${Date.now()}`, { signal: abort.signal, cache: "no-store" });
        if (infoResp.ok) {
          const info = await infoResp.json();
          setGeoInfo({ ip: info.ip || "", city: info.city || "", region: info.region || "", country: info.country || "", timezone: info.timezone || "", isp: info.isp || "" });
        }
      } catch { /* non-critical */ }

      // Latency
      setTestPhase("running_latency");
      const rtts: number[] = [];
      for (let i = 0; i < 12; i++) {
        if (abort.signal.aborted) return;
        const t0 = performance.now();
        await fetch(`/api/network-test/ping?_=${Date.now()}_${i}`, { signal: abort.signal, cache: "no-store" });
        const rtt = performance.now() - t0;
        if (i >= 2) rtts.push(rtt);
      }
      const sorted = [...rtts].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const latency = Math.round((sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2) * 10) / 10;
      const avg = rtts.reduce((a, b) => a + b, 0) / rtts.length;
      const jitter = Math.round(Math.sqrt(rtts.map(v => (v - avg) ** 2).reduce((a, b) => a + b, 0) / rtts.length) * 10) / 10;
      setTestResults(r => ({ ...r, latency_ms: latency, jitter_ms: jitter }));

      // Download
      setTestPhase("running_download");
      let dlBytes = 0, dlTime = 0, dlSize = 256 * 1024;
      for (let round = 0; round < 5; round++) {
        if (abort.signal.aborted) return;
        const t0 = performance.now();
        const resp = await fetch(`/api/network-test/download?size=${dlSize}&_=${Date.now()}_${round}`, { signal: abort.signal, cache: "no-store" });
        const buf = await resp.arrayBuffer();
        const elapsed = (performance.now() - t0) / 1000;
        dlBytes += buf.byteLength; dlTime += elapsed;
        if (elapsed < 1) dlSize = Math.min(dlSize * 2, 4 * 1024 * 1024);
        if (dlTime > 8) break;
      }
      const downloadMbps = dlTime > 0 ? Math.round(((dlBytes * 8) / (dlTime * 1_000_000)) * 100) / 100 : null;
      setTestResults(r => ({ ...r, download_mbps: downloadMbps }));

      // Upload
      setTestPhase("running_upload");
      let ulBytes = 0, ulTime = 0, ulSize = 128 * 1024;
      for (let round = 0; round < 5; round++) {
        if (abort.signal.aborted) return;
        // Build upload payload: 64KB random seed tiled to target size
        const seed = new Uint8Array(Math.min(ulSize, 65536));
        crypto.getRandomValues(seed);
        const payload = new Uint8Array(ulSize);
        for (let off = 0; off < ulSize; off += seed.length) {
          payload.set(off + seed.length <= ulSize ? seed : seed.subarray(0, ulSize - off), off);
        }
        const t0 = performance.now();
        await fetch(`/api/network-test/upload?_=${Date.now()}_${round}`, { method: "POST", body: payload, signal: abort.signal, cache: "no-store" });
        const elapsed = (performance.now() - t0) / 1000;
        ulBytes += ulSize; ulTime += elapsed;
        if (elapsed < 1) ulSize = Math.min(ulSize * 2, 2 * 1024 * 1024);
        if (ulTime > 8) break;
      }
      const uploadMbps = ulTime > 0 ? Math.round(((ulBytes * 8) / (ulTime * 1_000_000)) * 100) / 100 : null;
      setTestResults(r => ({ ...r, upload_mbps: uploadMbps }));

      setTestPhase("complete");
    } catch (err) {
      if (abort.signal.aborted) return;
      setTestError(err instanceof Error ? err.message : "Test failed");
      setTestPhase("error");
    }
  }, []);

  const saveTestResult = useCallback(async () => {
    if (!testResults.download_mbps && !testResults.latency_ms) return;
    setSaving(true);
    try {
      const connInfo = typeof navigator !== "undefined" && "connection" in navigator
        ? JSON.stringify({
            effectiveType: (navigator as any).connection?.effectiveType,
            downlink: (navigator as any).connection?.downlink,
            rtt: (navigator as any).connection?.rtt,
          })
        : "";

      const result = await insertNetworkTestResult(token, profileId, {
        download_mbps: testResults.download_mbps,
        upload_mbps: testResults.upload_mbps,
        latency_ms: testResults.latency_ms,
        jitter_ms: testResults.jitter_ms,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        connection_info: connInfo,
        ip_address: geoInfo.ip,
        city: geoInfo.city,
        region: geoInfo.region,
        country: geoInfo.country,
        timezone: geoInfo.timezone,
        isp: geoInfo.isp,
        notes: testNote,
      });

      if (result.id) {
        dispatch({
          type: "ADD_NETWORK_TEST",
          result: {
            id: result.id,
            tested_at: result.tested_at ?? new Date().toISOString(),
            download_mbps: testResults.download_mbps,
            upload_mbps: testResults.upload_mbps,
            latency_ms: testResults.latency_ms,
            jitter_ms: testResults.jitter_ms,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
            connection_info: connInfo,
            ip_address: geoInfo.ip,
            city: geoInfo.city,
            region: geoInfo.region,
            country: geoInfo.country,
            timezone: geoInfo.timezone,
            isp: geoInfo.isp,
            notes: testNote,
          },
        });
        setTestPhase("idle");
        setTestResults({ download_mbps: null, upload_mbps: null, latency_ms: null, jitter_ms: null });
        setTestNote("");
      }
    } finally {
      setSaving(false);
    }
  }, [testResults, testNote, token, profileId, dispatch]);

  const handleDeleteTest = useCallback(async (index: number) => {
    const tr = n.test_results[index];
    if (!tr?.id) return;
    await deleteNetworkTestResult(token, profileId, tr.id);
    dispatch({ type: "REMOVE_NETWORK_TEST", index });
  }, [n.test_results, token, profileId, dispatch]);

  function getMetricColor(value: number | null, thresholds: { green: number; yellow: number; higher_is_better: boolean }) {
    if (value === null) return "text-gray-400";
    if (thresholds.higher_is_better) {
      if (value >= thresholds.green) return "text-green-600";
      if (value >= thresholds.yellow) return "text-amber-600";
      return "text-red-600";
    } else {
      if (value <= thresholds.green) return "text-green-600";
      if (value <= thresholds.yellow) return "text-amber-600";
      return "text-red-600";
    }
  }

  return (
    <div className="space-y-6">
      {/* Network Context Fields */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">Network Information</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Internet Service Provider (ISP)
            </label>
            <input
              type="text"
              value={n.isp_name}
              onChange={(e) => dispatch({ type: "SET_NETWORK", network: { isp_name: e.target.value } })}
              placeholder="e.g. Comcast, AT&T, Verizon"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Connection Type
            </label>
            <select
              value={n.connection_type}
              onChange={(e) => dispatch({ type: "SET_NETWORK", network: { connection_type: e.target.value as NetworkData["connection_type"] } })}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            >
              {CONNECTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={n.has_backup_connection}
              onChange={(e) => dispatch({ type: "SET_NETWORK", network: { has_backup_connection: e.target.checked } })}
              className="rounded border-gray-300 text-[#91E100] focus:ring-[#91E100]"
            />
            <span className="text-sm text-gray-700">Facility has backup internet connection</span>
          </label>
        </div>

        {n.has_backup_connection && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Backup Connection Type
            </label>
            <input
              type="text"
              value={n.backup_connection_type}
              onChange={(e) => dispatch({ type: "SET_NETWORK", network: { backup_connection_type: e.target.value } })}
              placeholder="e.g. Cellular failover, secondary ISP"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Known Network Issues
          </label>
          <textarea
            value={n.known_issues}
            onChange={(e) => dispatch({ type: "SET_NETWORK", network: { known_issues: e.target.value } })}
            placeholder="Describe any recurring outages, slow periods, or connectivity problems..."
            rows={3}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Network Stability Notes
          </label>
          <textarea
            value={n.network_stability_notes}
            onChange={(e) => dispatch({ type: "SET_NETWORK", network: { network_stability_notes: e.target.value } })}
            placeholder="Any additional context about network reliability, equipment location, WiFi vs wired, VLANs..."
            rows={3}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
          />
        </div>
      </div>

      {/* Speed Test */}
      <div className="border-t border-gray-100 pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Network Speed Test</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Run a live test to measure your connection speed from this location
            </p>
          </div>
          {testPhase === "idle" || testPhase === "complete" || testPhase === "error" ? (
            <button
              type="button"
              onClick={runSpeedTest}
              className="inline-flex items-center gap-2 rounded-lg bg-[#91E100] px-4 py-2 text-sm font-medium text-gray-900 hover:bg-[#82ca00] transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {testPhase === "complete" ? "Run Again" : "Run Speed Test"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { abortRef.current?.abort(); setTestPhase("idle"); }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Test Progress / Results */}
        {testPhase !== "idle" && (
          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Latency */}
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Latency</p>
                {testPhase === "running_latency" ? (
                  <div className="h-6 flex items-center justify-center"><div className="animate-pulse text-sm text-gray-400">Testing...</div></div>
                ) : (
                  <p className={`text-lg font-semibold ${getMetricColor(testResults.latency_ms, { green: 50, yellow: 100, higher_is_better: false })}`}>
                    {testResults.latency_ms !== null ? `${testResults.latency_ms} ms` : "—"}
                  </p>
                )}
              </div>
              {/* Jitter */}
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Jitter</p>
                {testPhase === "running_latency" ? (
                  <div className="h-6 flex items-center justify-center"><div className="animate-pulse text-sm text-gray-400">Testing...</div></div>
                ) : (
                  <p className={`text-lg font-semibold ${getMetricColor(testResults.jitter_ms, { green: 10, yellow: 30, higher_is_better: false })}`}>
                    {testResults.jitter_ms !== null ? `${testResults.jitter_ms} ms` : "—"}
                  </p>
                )}
              </div>
              {/* Download */}
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Download</p>
                {testPhase === "running_download" ? (
                  <div className="h-6 flex items-center justify-center"><div className="animate-pulse text-sm text-gray-400">Testing...</div></div>
                ) : (
                  <p className={`text-lg font-semibold ${getMetricColor(testResults.download_mbps, { green: 25, yellow: 10, higher_is_better: true })}`}>
                    {testResults.download_mbps !== null ? `${testResults.download_mbps} Mbps` : "—"}
                  </p>
                )}
              </div>
              {/* Upload */}
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-1">Upload</p>
                {testPhase === "running_upload" ? (
                  <div className="h-6 flex items-center justify-center"><div className="animate-pulse text-sm text-gray-400">Testing...</div></div>
                ) : (
                  <p className={`text-lg font-semibold ${getMetricColor(testResults.upload_mbps, { green: 10, yellow: 5, higher_is_better: true })}`}>
                    {testResults.upload_mbps !== null ? `${testResults.upload_mbps} Mbps` : "—"}
                  </p>
                )}
              </div>
            </div>

            {testPhase === "error" && testError && (
              <p className="text-sm text-red-600">{testError}</p>
            )}

            {/* Save result */}
            {testPhase === "complete" && (
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <input
                  type="text"
                  value={testNote}
                  onChange={(e) => setTestNote(e.target.value)}
                  placeholder="Add a note (optional) — e.g. 'Tested from office near loading dock'"
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
                />
                <button
                  type="button"
                  onClick={saveTestResult}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Test Result"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Previous Test Results */}
      {n.test_results.length > 0 && (
        <div className="border-t border-gray-100 pt-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Previous Test Results ({n.test_results.length})
          </h3>
          <div className="space-y-2">
            {n.test_results.map((tr, i) => (
              <div
                key={tr.id ?? i}
                className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-gray-400 text-xs min-w-[120px]">
                    {new Date(tr.tested_at).toLocaleString()}
                  </span>
                  <span className={getMetricColor(tr.download_mbps, { green: 25, yellow: 10, higher_is_better: true })}>
                    ↓ {tr.download_mbps ?? "—"} Mbps
                  </span>
                  <span className={getMetricColor(tr.upload_mbps, { green: 10, yellow: 5, higher_is_better: true })}>
                    ↑ {tr.upload_mbps ?? "—"} Mbps
                  </span>
                  <span className={getMetricColor(tr.latency_ms, { green: 50, yellow: 100, higher_is_better: false })}>
                    {tr.latency_ms ?? "—"} ms
                  </span>
                  {tr.notes && (
                    <span className="text-gray-400 text-xs truncate max-w-[200px]">{tr.notes}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteTest(i)}
                  className="text-gray-300 hover:text-red-500 transition-colors p-1"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CATEGORY_ORDER: EquipmentCategory[] = [
  "compressor",
  "condenser",
  "evaporator",
  "vessel",
  "vfd",
  "pump",
  "controls",
  "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  compressor: "Compressors",
  condenser: "Condensers",
  evaporator: "Evaporators",
  vessel: "Vessels",
  vfd: "VFDs",
  pump: "Pumps",
  controls: "Controls",
  other: "Other",
};

function EquipmentSection({
  state,
  dispatch,
}: {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
}) {
  // Group equipment by category, preserving original indices for dispatch
  const grouped = useMemo(() => {
    const groups: Record<string, Array<{ eq: EquipmentData; originalIndex: number }>> = {};
    state.equipment.forEach((eq, i) => {
      if (!groups[eq.category]) groups[eq.category] = [];
      groups[eq.category]!.push({ eq, originalIndex: i });
    });
    return groups;
  }, [state.equipment]);

  // Categories that have items (in display order)
  const activeCategories = CATEGORY_ORDER.filter((cat) => grouped[cat]?.length);
  // Categories that have no items yet (for the "add" buttons at the bottom)
  const emptyCategories = CATEGORY_ORDER.filter(
    (cat) => !grouped[cat]?.length && ["compressor", "condenser", "evaporator", "vessel", "pump", "other"].includes(cat)
  );

  if (state.equipment.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center">
          <p className="text-sm text-gray-400 mb-3">
            No equipment added yet. Start by adding your compressors.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_ORDER.filter((c) => c !== "controls").map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => dispatch({ type: "ADD_EQUIPMENT", category: cat })}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Grouped equipment */}
      {activeCategories.map((cat) => {
        const items = grouped[cat]!;
        return (
          <div key={cat} className="space-y-2">
            {/* Category header */}
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {CATEGORY_LABELS[cat] ?? cat} ({items.length})
              </h4>
              <button
                type="button"
                onClick={() => dispatch({ type: "ADD_EQUIPMENT", category: cat })}
                className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 font-medium"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add
              </button>
            </div>

            {/* Equipment cards */}
            <div className="space-y-1.5">
              {items.map(({ eq, originalIndex }) => (
                <EquipmentCard
                  key={eq.id ?? `new-${originalIndex}`}
                  eq={eq}
                  index={originalIndex}
                  dispatch={dispatch}
                  defaultExpanded={!eq.id}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Add buttons for categories not yet added */}
      {emptyCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          {emptyCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => dispatch({ type: "ADD_EQUIPMENT", category: cat })}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompressorSpecsFields({
  specs,
  onChange,
}: {
  specs: Record<string, unknown>;
  onChange: (specs: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Type
        </label>
        <select
          value={(specs.type as string) ?? ""}
          onChange={(e) => onChange({ ...specs, type: e.target.value })}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none bg-white"
        >
          <option value="">Select...</option>
          <option value="screw">Screw</option>
          <option value="reciprocating">Reciprocating</option>
          <option value="scroll">Scroll</option>
          <option value="centrifugal">Centrifugal</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          HP
        </label>
        <input
          type="number"
          value={(specs.hp as number) ?? ""}
          onChange={(e) =>
            onChange({
              ...specs,
              hp: e.target.value ? Number(e.target.value) : null,
            })
          }
          placeholder="200"
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Loop
        </label>
        <select
          value={(specs.loop as string) ?? ""}
          onChange={(e) => onChange({ ...specs, loop: e.target.value })}
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none bg-white"
        >
          <option value="">Select...</option>
          <option value="low">Low Stage</option>
          <option value="high">High Stage</option>
          <option value="blast">Blast</option>
        </select>
      </div>
      <div>
        <label className="inline-flex items-center gap-1.5 cursor-pointer mt-5">
          <input
            type="checkbox"
            checked={(specs.vfd_equipped as boolean) ?? false}
            onChange={(e) =>
              onChange({ ...specs, vfd_equipped: e.target.checked })
            }
            className="h-3.5 w-3.5 rounded border-gray-300 text-[#91E100] focus:ring-[#91E100]/20"
          />
          <span className="text-xs text-gray-700">VFD</span>
        </label>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Suction (PSIG)
        </label>
        <input
          type="number"
          value={(specs.suction_setpoint_psig as number) ?? ""}
          onChange={(e) =>
            onChange({
              ...specs,
              suction_setpoint_psig: e.target.value ? Number(e.target.value) : null,
            })
          }
          placeholder="e.g. 25"
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Discharge (PSIG)
        </label>
        <input
          type="number"
          value={(specs.discharge_setpoint_psig as number) ?? ""}
          onChange={(e) =>
            onChange({
              ...specs,
              discharge_setpoint_psig: e.target.value ? Number(e.target.value) : null,
            })
          }
          placeholder="e.g. 165"
          className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
        />
      </div>
    </div>
  );
}

interface DocAttachment {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  type: string;
  created_at: string;
  category: string | null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string | null) {
  if (mimeType?.startsWith("image/")) {
    return (
      <svg className="h-4 w-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a1.5 1.5 0 001.5-1.5V5.25a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v14.25a1.5 1.5 0 001.5 1.5z" />
      </svg>
    );
  }
  if (mimeType === "application/pdf") {
    return (
      <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function DocumentsSection({
  attachments: initialAttachments,
  token,
  profileId,
  siteId,
  tenantId,
}: {
  attachments: DocAttachment[];
  token: string;
  profileId: string;
  siteId: string;
  tenantId: string;
}) {
  const [attachments, setAttachments] = useState<DocAttachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }, []);

  async function uploadFile(file: File) {
    setError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("token", token);
      formData.set("profileId", profileId);

      const res = await fetch("/api/upload/baseline", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      setUploading(false);

      if (!res.ok || result.error) {
        setError(result.error ?? "Upload failed");
      } else {
        // Add to local state
        setAttachments((prev) => [
          {
            id: result.id,
            file_name: result.file_name,
            file_size: result.file_size,
            mime_type: result.mime_type,
            type: result.type,
            created_at: result.created_at,
            category: result.category,
          },
          ...prev,
        ]);
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch {
      setUploading(false);
      setError("Network error — please try again");
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed transition-colors px-6 py-6 ${
          isDragging
            ? "border-[#91E100] bg-[#91E100]/5"
            : "border-gray-200 hover:border-gray-300 bg-gray-50/50"
        } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          {uploading ? (
            <svg className="animate-spin h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          )}
          <p className="text-sm text-gray-600">
            {uploading ? "Uploading..." : "Drop a file here or click to browse"}
          </p>
          <p className="text-xs text-gray-400">
            PDF, Word, Excel, images, and more (max 100MB)
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg,.zip"
        />
      </div>

      {/* Existing documents */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Uploaded Documents ({attachments.length})
          </h4>
          <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                {getFileIcon(att.mime_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{att.file_name}</p>
                  <p className="text-[10px] text-gray-400">
                    {formatFileSize(att.file_size)}
                    {att.category && ` \u00b7 ${att.category.replace(/_/g, " ")}`}
                    {" \u00b7 "}
                    {new Date(att.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <a
                  href={`/api/files/${att.id}?token=${encodeURIComponent(token)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {attachments.length === 0 && (
        <p className="text-xs text-gray-400 text-center">
          Upload utility bills, equipment schedules, P&ID drawings, or any relevant documents.
        </p>
      )}
    </div>
  );
}

function EnergySection({
  state,
  dispatch,
}: {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
}) {
  const e = state.energy;

  return (
    <div className="space-y-6">
      {/* Provider info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Supply Provider
          </label>
          <input
            type="text"
            value={e.supply_provider}
            onChange={(ev) =>
              dispatch({
                type: "SET_ENERGY",
                energy: { supply_provider: ev.target.value },
              })
            }
            placeholder="e.g., PG&E, ConEd..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Distribution Provider
          </label>
          <input
            type="text"
            value={e.distribution_provider}
            onChange={(ev) =>
              dispatch({
                type: "SET_ENERGY",
                energy: { distribution_provider: ev.target.value },
              })
            }
            placeholder="If different from supply..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Annual Energy Spend ($)
        </label>
        <input
          type="number"
          value={e.annual_energy_spend ?? ""}
          onChange={(ev) =>
            dispatch({
              type: "SET_ENERGY",
              energy: {
                annual_energy_spend: ev.target.value
                  ? Number(ev.target.value)
                  : null,
              },
            })
          }
          placeholder="e.g., 500000"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
        />
      </div>

      {/* On-peak rates */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          On-Peak Rates
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Energy ($/kWh)
            </label>
            <input
              type="number"
              step="0.001"
              value={e.on_peak_energy_rate ?? ""}
              onChange={(ev) =>
                dispatch({
                  type: "SET_ENERGY",
                  energy: {
                    on_peak_energy_rate: ev.target.value
                      ? Number(ev.target.value)
                      : null,
                  },
                })
              }
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Demand ($/kW)
            </label>
            <input
              type="number"
              step="0.01"
              value={e.on_peak_demand_rate ?? ""}
              onChange={(ev) =>
                dispatch({
                  type: "SET_ENERGY",
                  energy: {
                    on_peak_demand_rate: ev.target.value
                      ? Number(ev.target.value)
                      : null,
                  },
                })
              }
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Start Hour
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={e.on_peak_start_hour ?? ""}
              onChange={(ev) =>
                dispatch({
                  type: "SET_ENERGY",
                  energy: {
                    on_peak_start_hour: ev.target.value
                      ? Number(ev.target.value)
                      : null,
                  },
                })
              }
              placeholder="e.g., 12"
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              End Hour
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={e.on_peak_end_hour ?? ""}
              onChange={(ev) =>
                dispatch({
                  type: "SET_ENERGY",
                  energy: {
                    on_peak_end_hour: ev.target.value
                      ? Number(ev.target.value)
                      : null,
                  },
                })
              }
              placeholder="e.g., 18"
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            On-Peak Months
          </label>
          <input
            type="text"
            value={e.on_peak_months}
            onChange={(ev) =>
              dispatch({
                type: "SET_ENERGY",
                energy: { on_peak_months: ev.target.value },
              })
            }
            placeholder="e.g., Jun-Sep"
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
          />
        </div>
      </div>

      {/* Off-peak rates */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Off-Peak Rates
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Energy ($/kWh)
            </label>
            <input
              type="number"
              step="0.001"
              value={e.off_peak_energy_rate ?? ""}
              onChange={(ev) =>
                dispatch({
                  type: "SET_ENERGY",
                  energy: {
                    off_peak_energy_rate: ev.target.value
                      ? Number(ev.target.value)
                      : null,
                  },
                })
              }
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Demand ($/kW)
            </label>
            <input
              type="number"
              step="0.01"
              value={e.off_peak_demand_rate ?? ""}
              onChange={(ev) =>
                dispatch({
                  type: "SET_ENERGY",
                  energy: {
                    off_peak_demand_rate: ev.target.value
                      ? Number(ev.target.value)
                      : null,
                  },
                })
              }
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Shoulder rates */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Shoulder Rates
          <span className="ml-2 text-xs font-normal text-gray-400">
            (if applicable)
          </span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Energy ($/kWh)
            </label>
            <input
              type="number"
              step="0.001"
              value={e.shoulder_energy_rate ?? ""}
              onChange={(ev) =>
                dispatch({
                  type: "SET_ENERGY",
                  energy: {
                    shoulder_energy_rate: ev.target.value
                      ? Number(ev.target.value)
                      : null,
                  },
                })
              }
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Demand ($/kW)
            </label>
            <input
              type="number"
              step="0.01"
              value={e.shoulder_demand_rate ?? ""}
              onChange={(ev) =>
                dispatch({
                  type: "SET_ENERGY",
                  energy: {
                    shoulder_demand_rate: ev.target.value
                      ? Number(ev.target.value)
                      : null,
                  },
                })
              }
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Start Hour
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={e.shoulder_start_hour ?? ""}
              onChange={(ev) =>
                dispatch({
                  type: "SET_ENERGY",
                  energy: {
                    shoulder_start_hour: ev.target.value
                      ? Number(ev.target.value)
                      : null,
                  },
                })
              }
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              End Hour
            </label>
            <input
              type="number"
              min={0}
              max={23}
              value={e.shoulder_end_hour ?? ""}
              onChange={(ev) =>
                dispatch({
                  type: "SET_ENERGY",
                  energy: {
                    shoulder_end_hour: ev.target.value
                      ? Number(ev.target.value)
                      : null,
                  },
                })
              }
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Shoulder Months
          </label>
          <input
            type="text"
            value={e.shoulder_months}
            onChange={(ev) =>
              dispatch({
                type: "SET_ENERGY",
                energy: { shoulder_months: ev.target.value },
              })
            }
            placeholder="e.g., Apr-May, Oct-Nov"
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
          />
        </div>
      </div>

      {/* Demand response */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Demand Response Status
        </label>
        <select
          value={e.demand_response_status}
          onChange={(ev) =>
            dispatch({
              type: "SET_ENERGY",
              energy: { demand_response_status: ev.target.value as EnergyData["demand_response_status"] },
            })
          }
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none bg-white"
        >
          <option value="">Select status...</option>
          <option value="enrolled">Enrolled</option>
          <option value="eligible">Eligible, Not Enrolled</option>
          <option value="not_eligible">Not Eligible</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>
    </div>
  );
}

function OperationsSection({
  state,
  dispatch,
}: {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
}) {
  const o = state.operations;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Typical Suction Pressure (PSIG)
          </label>
          <input
            type="number"
            step="0.1"
            value={o.suction_pressure_typical ?? ""}
            onChange={(e) =>
              dispatch({
                type: "SET_OPERATIONS",
                operations: {
                  suction_pressure_typical: e.target.value
                    ? Number(e.target.value)
                    : null,
                },
              })
            }
            placeholder="e.g., 18.0"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Typical Discharge Pressure (PSIG)
          </label>
          <input
            type="number"
            step="0.1"
            value={o.discharge_pressure_typical ?? ""}
            onChange={(e) =>
              dispatch({
                type: "SET_OPERATIONS",
                operations: {
                  discharge_pressure_typical: e.target.value
                    ? Number(e.target.value)
                    : null,
                },
              })
            }
            placeholder="e.g., 150.0"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={o.can_shed_load}
            onChange={(e) =>
              dispatch({
                type: "SET_OPERATIONS",
                operations: { can_shed_load: e.target.checked },
              })
            }
            className="h-4 w-4 rounded border-gray-300 text-[#91E100] focus:ring-[#91E100]/20"
          />
          <span className="text-sm text-gray-700">
            Can shed load during demand response events
          </span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={o.can_shutdown}
            onChange={(e) =>
              dispatch({
                type: "SET_OPERATIONS",
                operations: { can_shutdown: e.target.checked },
              })
            }
            className="h-4 w-4 rounded border-gray-300 text-[#91E100] focus:ring-[#91E100]/20"
          />
          <span className="text-sm text-gray-700">
            Can fully shut down compressors temporarily
          </span>
        </label>

        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={o.curtailment_enrolled}
            onChange={(e) =>
              dispatch({
                type: "SET_OPERATIONS",
                operations: { curtailment_enrolled: e.target.checked },
              })
            }
            className="h-4 w-4 rounded border-gray-300 text-[#91E100] focus:ring-[#91E100]/20"
          />
          <span className="text-sm text-gray-700">
            Currently enrolled in a curtailment program
          </span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Shutdown Constraints
        </label>
        <textarea
          value={o.shutdown_constraints}
          onChange={(e) =>
            dispatch({
              type: "SET_OPERATIONS",
              operations: { shutdown_constraints: e.target.value },
            })
          }
          rows={2}
          placeholder="What prevents you from shutting down equipment?"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Curtailment Frequency
          </label>
          <input
            type="text"
            value={o.curtailment_frequency}
            onChange={(e) =>
              dispatch({
                type: "SET_OPERATIONS",
                operations: { curtailment_frequency: e.target.value },
              })
            }
            placeholder="e.g., 5-10 events/year"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Curtailment Barriers
          </label>
          <input
            type="text"
            value={o.curtailment_barriers}
            onChange={(e) =>
              dispatch({
                type: "SET_OPERATIONS",
                operations: { curtailment_barriers: e.target.value },
              })
            }
            placeholder="What prevents enrollment?"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Products / Goods Stored
        </label>
        <textarea
          value={o.product_notes}
          onChange={(e) =>
            dispatch({
              type: "SET_OPERATIONS",
              operations: { product_notes: e.target.value },
            })
          }
          rows={2}
          placeholder="e.g., Frozen meats, dairy products, ice cream..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Customer Mix
        </label>
        <textarea
          value={o.customer_mix}
          onChange={(e) =>
            dispatch({
              type: "SET_OPERATIONS",
              operations: { customer_mix: e.target.value },
            })
          }
          rows={2}
          placeholder="What types of customers do you serve?"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Seasonality Notes
        </label>
        <textarea
          value={o.seasonality_notes}
          onChange={(e) =>
            dispatch({
              type: "SET_OPERATIONS",
              operations: { seasonality_notes: e.target.value },
            })
          }
          rows={2}
          placeholder="How does your load change seasonally?"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Temperature Challenges
        </label>
        <textarea
          value={o.temperature_challenges}
          onChange={(e) =>
            dispatch({
              type: "SET_OPERATIONS",
              operations: { temperature_challenges: e.target.value },
            })
          }
          rows={2}
          placeholder="Any temperature control issues or hotspots?"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Staffing Notes
        </label>
        <textarea
          value={o.staffing_notes}
          onChange={(e) =>
            dispatch({
              type: "SET_OPERATIONS",
              operations: { staffing_notes: e.target.value },
            })
          }
          rows={2}
          placeholder="Staffing levels, shifts, seasonal labor changes..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Other Operational Notes
        </label>
        <textarea
          value={o.operational_nuances}
          onChange={(e) =>
            dispatch({
              type: "SET_OPERATIONS",
              operations: { operational_nuances: e.target.value },
            })
          }
          rows={2}
          placeholder="Anything else we should know about how you operate?"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
      </div>
    </div>
  );
}

function EfficiencySection({
  state,
  dispatch,
}: {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
}) {
  const eff = state.efficiency;

  return (
    <div className="space-y-6">
      {/* Headcount */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Staffing / Headcount
        </h3>

        {eff.headcount.length === 0 && (
          <p className="text-sm text-gray-400 mb-3">
            Add roles to track your team&apos;s time allocation.
          </p>
        )}

        {eff.headcount.map((entry, index) => (
          <div
            key={index}
            className="grid grid-cols-[1fr_80px_100px_32px] gap-2 mb-2 items-end"
          >
            <div>
              {index === 0 && (
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Role
                </label>
              )}
              <input
                type="text"
                value={entry.role}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_HEADCOUNT",
                    index,
                    entry: { ...entry, role: e.target.value as HeadcountEntry["role"] },
                  })
                }
                placeholder="e.g., Operator"
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
              />
            </div>
            <div>
              {index === 0 && (
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Count
                </label>
              )}
              <input
                type="number"
                min={0}
                value={entry.count ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_HEADCOUNT",
                    index,
                    entry: {
                      ...entry,
                      count: e.target.value
                        ? Number(e.target.value)
                        : null,
                    },
                  })
                }
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
              />
            </div>
            <div>
              {index === 0 && (
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Hrs/Week
                </label>
              )}
              <input
                type="number"
                min={0}
                value={entry.hours_per_week ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_HEADCOUNT",
                    index,
                    entry: {
                      ...entry,
                      hours_per_week: e.target.value
                        ? Number(e.target.value)
                        : null,
                    },
                  })
                }
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-[#91E100] focus:ring-1 focus:ring-[#91E100]/20 outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                dispatch({ type: "REMOVE_HEADCOUNT", index })
              }
              className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-red-500"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => dispatch({ type: "ADD_HEADCOUNT" })}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Add role
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Total Manual Hours / Week
        </label>
        <input
          type="number"
          min={0}
          value={eff.total_manual_hours_week ?? ""}
          onChange={(e) =>
            dispatch({
              type: "SET_EFFICIENCY",
              efficiency: {
                total_manual_hours_week: e.target.value
                  ? Number(e.target.value)
                  : null,
              },
            })
          }
          placeholder="Estimated total across all roles"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Biggest Pain Points
        </label>
        <textarea
          value={eff.pain_points}
          onChange={(e) =>
            dispatch({
              type: "SET_EFFICIENCY",
              efficiency: { pain_points: e.target.value },
            })
          }
          rows={3}
          placeholder="What causes the most frustration in day-to-day operations?"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Manual Processes
        </label>
        <textarea
          value={eff.manual_processes}
          onChange={(e) =>
            dispatch({
              type: "SET_EFFICIENCY",
              efficiency: { manual_processes: e.target.value },
            })
          }
          rows={3}
          placeholder="What tasks are still done manually that could be automated?"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Time Sinks
        </label>
        <textarea
          value={eff.time_sinks}
          onChange={(e) =>
            dispatch({
              type: "SET_EFFICIENCY",
              efficiency: { time_sinks: e.target.value },
            })
          }
          rows={3}
          placeholder="What takes the most time that shouldn't?"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Automation Opportunities
        </label>
        <textarea
          value={eff.automation_opportunities}
          onChange={(e) =>
            dispatch({
              type: "SET_EFFICIENCY",
              efficiency: { automation_opportunities: e.target.value },
            })
          }
          rows={3}
          placeholder="Where do you see the biggest opportunities for automation?"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
      </div>
    </div>
  );
}

function ContractorsSection({
  state,
  dispatch,
}: {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
}) {
  const contractors = state.contractors;

  return (
    <div className="space-y-4">
      {contractors.length === 0 && (
        <p className="text-sm text-gray-400">
          No contractors added yet. Add any preferred service providers you
          work with at this facility.
        </p>
      )}

      {contractors.map((contractor, index) => (
        <div
          key={contractor.id ?? `new-${index}`}
          className="rounded-lg border border-gray-200 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase">
              Contractor {index + 1}
            </span>
            {contractors.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  dispatch({ type: "REMOVE_CONTRACTOR", index })
                }
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={contractor.company_name}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CONTRACTOR",
                    index,
                    contractor: { ...contractor, company_name: e.target.value },
                  })
                }
                placeholder="ABC Refrigeration Services"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type of Contractor
              </label>
              <input
                type="text"
                value={contractor.contractor_type}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CONTRACTOR",
                    index,
                    contractor: { ...contractor, contractor_type: e.target.value },
                  })
                }
                placeholder="e.g. Refrigeration, Electrical, HVAC"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Name
              </label>
              <input
                type="text"
                value={contractor.contact_name}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CONTRACTOR",
                    index,
                    contractor: { ...contractor, contact_name: e.target.value },
                  })
                }
                placeholder="John Doe"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={contractor.email}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CONTRACTOR",
                    index,
                    contractor: { ...contractor, email: e.target.value },
                  })
                }
                placeholder="john@abcservices.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={contractor.phone}
                onChange={(e) =>
                  dispatch({
                    type: "UPDATE_CONTRACTOR",
                    index,
                    contractor: { ...contractor, phone: e.target.value },
                  })
                }
                placeholder="(555) 123-4567"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none"
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => dispatch({ type: "ADD_CONTRACTOR" })}
        className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 4.5v15m7.5-7.5h-15"
          />
        </svg>
        Add contractor
      </button>
    </div>
  );
}

function ReviewSection({
  state,
  token,
  profileId,
}: {
  state: BaselineFormState;
  token: string;
  profileId: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const completions = getAllSectionCompletions(state);
  const dataSections = BASELINE_FORM_SECTIONS.filter(
    (s) => s !== "review" && s !== "documents" && s !== "contractors"
  );
  const overallCompletion = Math.round(
    dataSections.reduce((sum, s) => sum + (completions[s] ?? 0), 0) /
      dataSections.length
  );

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const result = await submitBaselineForm(token, profileId);
    if (result.error) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto h-14 w-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <svg
            className="h-7 w-7 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Thank you for submitting!
        </h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Your baseline data has been submitted. The CrossnoKaye team will
          review it shortly. You can still come back to this link to make
          edits at any time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall completion */}
      <div className="rounded-lg bg-gray-50 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Overall Completion
          </span>
          <span className="text-sm font-bold text-gray-900">
            {overallCompletion}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#91E100] transition-all duration-500"
            style={{ width: `${overallCompletion}%` }}
          />
        </div>
      </div>

      {/* Per-section breakdown */}
      <div className="space-y-2">
        {BASELINE_FORM_SECTIONS.filter((s) => s !== "review").map(
          (section) => {
            const pct = completions[section] ?? 0;
            return (
              <div
                key={section}
                className="flex items-center justify-between py-2 border-b border-gray-50"
              >
                <div className="flex items-center gap-2">
                  {pct === 100 ? (
                    <svg
                      className="h-4 w-4 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-gray-200" />
                  )}
                  <span className="text-sm text-gray-700">
                    {SECTION_LABELS[section]}
                  </span>
                </div>
                <span
                  className={`text-xs font-medium ${
                    pct === 100 ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {pct}%
                </span>
              </div>
            );
          }
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="p-3 rounded-lg bg-gray-50">
          <p className="text-2xl font-bold text-gray-900">
            {state.contacts.length}
          </p>
          <p className="text-xs text-gray-500">Contacts</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50">
          <p className="text-2xl font-bold text-gray-900">
            {state.equipment.length}
          </p>
          <p className="text-xs text-gray-500">Equipment</p>
        </div>
        <div className="p-3 rounded-lg bg-gray-50">
          <p className="text-2xl font-bold text-gray-900">
            {state.efficiency.headcount.length}
          </p>
          <p className="text-xs text-gray-500">Roles</p>
        </div>
      </div>

      {/* Submit */}
      {submitError && (
        <p className="text-sm text-red-600 text-center">{submitError}</p>
      )}

      <div className="text-center">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-lg bg-[#91E100] px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm hover:bg-[#91E100]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Submitting...
            </>
          ) : (
            "Submit Baseline Data"
          )}
        </button>
        <p className="text-xs text-gray-400 mt-3">
          You can always come back and make edits after submitting.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Fingerprint helper — extracts section-specific data for change detection
// ═══════════════════════════════════════════════════════════════

function getSectionFingerprint(
  st: BaselineFormState,
  section: BaselineFormSection,
): string {
  switch (section) {
    case "contact": return JSON.stringify(st.contacts);
    case "facility": return JSON.stringify(st.facility);
    case "layout": return JSON.stringify({ er: st.engineRooms, tz: st.temperatureZones });
    case "system": return JSON.stringify(st.system);
    case "network": return JSON.stringify(st.network);
    case "equipment": return JSON.stringify(st.equipment);
    case "energy": return JSON.stringify(st.energy);
    case "operations": return JSON.stringify(st.operations);
    case "efficiency": return JSON.stringify(st.efficiency);
    case "contractors": return JSON.stringify(st.contractors);
    default: return "";
  }
}

// ═══════════════════════════════════════════════════════════════
// Main Form Component
// ═══════════════════════════════════════════════════════════════

interface BaselineFormProps {
  initialData: FormDataResult;
  userId: string;
  profileId: string;
}

export function BaselineForm({
  initialData,
  userId,
  profileId,
}: BaselineFormProps) {
  const [state, dispatch] = useReducer(
    formReducer,
    initialData,
    hydrateState
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [navigating, setNavigating] = useState(false);
  const [toast, setToast] = useState<SaveToastData | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<Record<string, string>>({});

  // Always-current state ref — prevents stale closure reads in saveSection
  const stateRef = useRef(state);
  stateRef.current = state;

  const token = initialData.context.token;

  // localStorage draft persistence
  const { clearDraft } = useBaselineDraft(
    token,
    state,
    dispatch,
    (initialData.formProgress as any)?.lastSavedAt ?? null,
  );

  // ── Auto-save logic ────────────────────────────────────────

  const saveSection = useCallback(
    async (section: BaselineFormSection): Promise<boolean> => {
      setSaveStatus("saving");

      // Read latest state from ref to avoid stale closures
      const s = stateRef.current;

      try {
        let result: { error?: string; id?: string; success?: boolean } = {};

        switch (section) {
          case "contact":
            // Save each contact and patch back IDs for new records
            for (let i = 0; i < s.contacts.length; i++) {
              const contact = s.contacts[i]!;
              result = await upsertBaselineContact(token, profileId, contact);
              if (result.error) break;
              if (result.id && !contact.id) {
                dispatch({ type: "UPDATE_CONTACT", index: i, contact: { ...contact, id: result.id } });
              }
            }
            break;

          case "facility":
          case "system":
            result = await upsertBaselineFacilityAndSystem(
              token,
              profileId,
              s.facility,
              s.system
            );
            break;

          case "layout":
            // Save engine rooms
            for (let i = 0; i < s.engineRooms.length; i++) {
              const er = s.engineRooms[i]!;
              result = await upsertBaselineEngineRoom(token, profileId, er);
              if (result.error) break;
              if (result.id && !er.id) {
                dispatch({ type: "UPDATE_ENGINE_ROOM", index: i, engineRoom: { id: result.id } });
              }
            }
            if (!result.error) {
              // Save temperature zones
              for (let i = 0; i < s.temperatureZones.length; i++) {
                const zone = s.temperatureZones[i]!;
                result = await upsertBaselineTemperatureZone(token, profileId, zone);
                if (result.error) break;
                if (result.id && !zone.id) {
                  dispatch({ type: "UPDATE_TEMPERATURE_ZONE", index: i, zone: { id: result.id } });
                }
              }
            }
            break;

          case "network":
            // Save context fields only — test results are saved immediately when run
            result = await upsertBaselineNetwork(
              token,
              profileId,
              {
                isp_name: s.network.isp_name,
                connection_type: s.network.connection_type,
                has_backup_connection: s.network.has_backup_connection,
                backup_connection_type: s.network.backup_connection_type,
                known_issues: s.network.known_issues,
                network_stability_notes: s.network.network_stability_notes,
              }
            );
            break;

          case "equipment":
            for (let i = 0; i < s.equipment.length; i++) {
              const eq = s.equipment[i]!;
              result = await upsertBaselineEquipment(token, profileId, eq);
              if (result.error) break;
              if (result.id && !eq.id) {
                dispatch({ type: "UPDATE_EQUIPMENT", index: i, equipment: { ...eq, id: result.id } });
              }
            }
            break;

          case "energy":
            result = await upsertBaselineEnergy(
              token,
              profileId,
              s.energy
            );
            break;

          case "operations":
            result = await upsertBaselineOperations(
              token,
              profileId,
              s.operations
            );
            break;

          case "efficiency":
            result = await upsertBaselineEfficiency(
              token,
              profileId,
              s.efficiency
            );
            break;

          case "contractors":
            for (let i = 0; i < s.contractors.length; i++) {
              const contractor = s.contractors[i]!;
              result = await upsertBaselineContractor(token, profileId, contractor);
              if (result.error) break;
              if (result.id && !contractor.id) {
                dispatch({ type: "UPDATE_CONTRACTOR", index: i, contractor: { ...contractor, id: result.id } });
              }
            }
            break;

          case "documents":
          case "review":
            // No data to save for these sections
            break;
        }

        if (result.error) {
          setSaveStatus("error");
          return false;
        }

        // Update form progress
        const completions = getAllSectionCompletions(s);
        await updateBaselineFormProgress(token, {
          currentSection: s.meta.currentSection,
          sectionCompletion: completions,
          lastSavedAt: new Date().toISOString(),
        });

        setSaveStatus("saved");
        clearDraft();
        return true;
      } catch {
        if (!navigator.onLine) {
          setSaveStatus("offline");
        } else {
          setSaveStatus("error");
        }
        return false;
      }
    },
    [token, profileId, dispatch, clearDraft]
  );

  const flushSave = useCallback(async (): Promise<boolean> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const s = stateRef.current;
    const currentSection =
      BASELINE_FORM_SECTIONS[s.meta.currentSection];
    if (currentSection && currentSection !== "review" && currentSection !== "documents") {
      // Compute fingerprint before save
      const fingerprint = getSectionFingerprint(s, currentSection);
      // Check if anything actually changed
      if (fingerprint === lastSavedRef.current[currentSection]) return true;
      const ok = await saveSection(currentSection);
      if (ok) {
        // Update ref so auto-save effect doesn't re-trigger for this data
        lastSavedRef.current[currentSection] = fingerprint;
      }
      return ok;
    }
    return true;
  }, [saveSection]);

  // Debounced auto-save: serialize relevant state, compare, and save on change
  useEffect(() => {
    const currentSection =
      BASELINE_FORM_SECTIONS[state.meta.currentSection];
    if (!currentSection || currentSection === "review" || currentSection === "documents") return;

    const fingerprint = getSectionFingerprint(state, currentSection);
    if (!fingerprint) return;

    // Same as last saved — nothing to do
    if (fingerprint === lastSavedRef.current[currentSection]) return;

    // First time seeing this section — capture initial fingerprint, don't save
    if (!lastSavedRef.current[currentSection]) {
      lastSavedRef.current[currentSection] = fingerprint;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      lastSavedRef.current[currentSection] = fingerprint;
      saveSection(currentSection);
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [state, saveSection]);

  // ── Online/offline tracking ───────────────────────────────

  useEffect(() => {
    function handleOffline() {
      setSaveStatus("offline");
    }
    function handleOnline() {
      if (saveStatus === "offline") {
        setSaveStatus("idle");
      }
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [saveStatus]);

  // ── Warn before leaving with unsaved changes ────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const section = BASELINE_FORM_SECTIONS[stateRef.current.meta.currentSection];
      if (!section || section === "review" || section === "documents") return;
      const fingerprint = getSectionFingerprint(stateRef.current, section);
      if (fingerprint && fingerprint !== lastSavedRef.current[section]) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ── Section navigation ────────────────────────────────────

  const completions = useMemo(
    () => getAllSectionCompletions(state),
    [state]
  );

  const handleNavigate = useCallback(
    async (targetIndex: number) => {
      setNavigating(true);
      try {
        const s = stateRef.current;
        const currentSection = BASELINE_FORM_SECTIONS[s.meta.currentSection];
        // Check if section has unsaved changes before flushing
        const hadChanges = currentSection
          && currentSection !== "review"
          && currentSection !== "documents"
          && getSectionFingerprint(s, currentSection) !== lastSavedRef.current[currentSection];

        const ok = await flushSave();
        dispatch({ type: "SET_SECTION", section: targetIndex });

        // Show toast only when there were actual changes — and reflect success/failure
        if (hadChanges && ok) {
          setToast({ message: "Progress saved", type: "success" });
        } else if (hadChanges && !ok) {
          setToast({ message: "Error saving — please try again", type: "warning" });
        }
      } finally {
        setNavigating(false);
      }
    },
    [flushSave]
  );

  const handleNext = useCallback(() => {
    const next = Math.min(
      state.meta.currentSection + 1,
      BASELINE_FORM_SECTIONS.length - 1
    );
    handleNavigate(next);
  }, [state.meta.currentSection, handleNavigate]);

  const handleBack = useCallback(() => {
    const prev = Math.max(state.meta.currentSection - 1, 0);
    handleNavigate(prev);
  }, [state.meta.currentSection, handleNavigate]);

  // ── Save context ─────────────────────────────────────────

  const saveContextValue = useMemo<SaveContextValue>(
    () => ({
      status: saveStatus,
      save: saveSection,
      flush: flushSave,
    }),
    [saveStatus, saveSection, flushSave]
  );

  // ── Render current section ────────────────────────────────

  const currentSectionKey =
    BASELINE_FORM_SECTIONS[state.meta.currentSection]!;

  function renderSection() {
    switch (state.meta.currentSection) {
      case 0:
        return <ContactSection state={state} dispatch={dispatch} />;
      case 1:
        return <FacilitySection state={state} dispatch={dispatch} />;
      case 2:
        return <LayoutSection state={state} dispatch={dispatch} token={token} profileId={profileId} />;
      case 3:
        return <SystemSection state={state} dispatch={dispatch} />;
      case 4:
        return <NetworkSection state={state} dispatch={dispatch} token={token} profileId={profileId} />;
      case 5:
        return <EquipmentSection state={state} dispatch={dispatch} />;
      case 6: {
        const docAttachments: DocAttachment[] = (initialData.attachments ?? []).map(
          (a: Record<string, unknown>) => ({
            id: a.id as string,
            file_name: a.file_name as string,
            file_size: (a.file_size as number) ?? null,
            mime_type: (a.mime_type as string) ?? null,
            type: (a.type as string) ?? "document",
            created_at: a.created_at as string,
            category: ((a.metadata as Record<string, string>)?.category as string) ?? null,
          })
        );
        return (
          <DocumentsSection
            attachments={docAttachments}
            token={token}
            profileId={profileId}
            siteId={initialData.context.siteId}
            tenantId={initialData.context.tenantId}
          />
        );
      }
      case 7:
        return <EnergySection state={state} dispatch={dispatch} />;
      case 8:
        return <OperationsSection state={state} dispatch={dispatch} />;
      case 9:
        return <EfficiencySection state={state} dispatch={dispatch} />;
      case 10:
        return <ContractorsSection state={state} dispatch={dispatch} />;
      case 11:
        return (
          <ReviewSection
            state={state}
            token={token}
            profileId={profileId}
          />
        );
      default:
        return null;
    }
  }

  return (
    <SaveContext.Provider value={saveContextValue}>
      <SaveIndicator
        status={saveStatus}
        onRetry={() => saveSection(currentSectionKey)}
      />

      <SaveToast toast={toast} onDismiss={useCallback(() => setToast(null), [])} />

      <FormProgress
        currentSection={state.meta.currentSection}
        completions={completions}
        onNavigate={handleNavigate}
      />

      <SectionShell
        key={state.meta.currentSection}
        title={SECTION_LABELS[currentSectionKey]}
        description={SECTION_DESCRIPTIONS[currentSectionKey]}
        onNext={handleNext}
        onBack={handleBack}
        isFirst={state.meta.currentSection === 0}
        isLast={
          state.meta.currentSection === BASELINE_FORM_SECTIONS.length - 1
        }
        saving={navigating}
      >
        {renderSection()}
      </SectionShell>
    </SaveContext.Provider>
  );
}
