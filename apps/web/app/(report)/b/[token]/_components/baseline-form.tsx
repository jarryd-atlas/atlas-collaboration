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
  EnergyData,
  OperationsData,
  EfficiencyData,
  EquipmentData,
  HeadcountEntry,
  BaselineFormSection,
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
  emptyHeadcount,
  createDefaultEquipment,
  duplicateEquipment,
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
  updateBaselineFormProgress,
  submitBaselineForm,
} from "../../../../../lib/actions/baseline-form";
import type { EquipmentCategory } from "@repo/shared/constants";

import { FormProgress } from "./form-progress";
import { SectionShell } from "./section-shell";
import { SaveIndicator } from "./save-indicator";

// Lazy section imports — these are simple inline components for now
// Sections: Contact, Facility, System, Equipment, Documents, Energy, Operations, Efficiency, Review

// ═══════════════════════════════════════════════════════════════
// Save Context
// ═══════════════════════════════════════════════════════════════

interface SaveContextValue {
  status: SaveStatus;
  save: (section: BaselineFormSection) => Promise<void>;
  flush: () => Promise<void>;
}

const SaveContext = createContext<SaveContextValue>({
  status: "idle",
  save: async () => {},
  flush: async () => {},
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
    product_notes: (op.product_notes as string) ?? "",
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

  // Map equipment
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
    curtailment_barriers: (ops.curtailment_barriers as string) ?? "",
    seasonality_notes: (ops.seasonality_notes as string) ?? "",
    temperature_challenges: (ops.temperature_challenges as string) ?? "",
    operational_nuances: (ops.operational_nuances as string) ?? "",
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
    system,
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Products / Goods Stored
        </label>
        <textarea
          value={f.product_notes}
          onChange={(e) =>
            dispatch({
              type: "SET_FACILITY",
              facility: { product_notes: e.target.value },
            })
          }
          rows={3}
          placeholder="e.g., Frozen meats, dairy products, ice cream..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#91E100] focus:ring-2 focus:ring-[#91E100]/20 outline-none resize-none"
        />
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

function DocumentsSection() {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
      <svg
        className="mx-auto h-10 w-10 text-gray-300 mb-3"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m1.5 0H9.75m6-6H9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p className="text-sm font-medium text-gray-600 mb-1">
        Document Upload Coming Soon
      </p>
      <p className="text-xs text-gray-400 max-w-sm mx-auto">
        You&apos;ll be able to upload utility bills, equipment schedules, P&ID
        drawings, and other relevant documents here. For now, please continue
        to the next section.
      </p>
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

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Curtailment Barriers
        </label>
        <textarea
          value={o.curtailment_barriers}
          onChange={(e) =>
            dispatch({
              type: "SET_OPERATIONS",
              operations: { curtailment_barriers: e.target.value },
            })
          }
          rows={2}
          placeholder="What prevents enrollment in curtailment programs?"
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
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  const token = initialData.context.token;

  // ── Auto-save logic ────────────────────────────────────────

  const saveSection = useCallback(
    async (section: BaselineFormSection) => {
      setSaveStatus("saving");

      try {
        let result: { error?: string; id?: string; success?: boolean } = {};

        switch (section) {
          case "contact":
            // Save each contact and patch back IDs for new records
            for (let i = 0; i < state.contacts.length; i++) {
              const contact = state.contacts[i]!;
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
              state.facility,
              state.system
            );
            break;

          case "equipment":
            for (let i = 0; i < state.equipment.length; i++) {
              const eq = state.equipment[i]!;
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
              state.energy
            );
            break;

          case "operations":
            result = await upsertBaselineOperations(
              token,
              profileId,
              state.operations
            );
            break;

          case "efficiency":
            result = await upsertBaselineEfficiency(
              token,
              profileId,
              state.efficiency
            );
            break;

          case "contractors":
            for (let i = 0; i < state.contractors.length; i++) {
              const contractor = state.contractors[i]!;
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
          return;
        }

        // Update form progress
        const completions = getAllSectionCompletions(state);
        await updateBaselineFormProgress(token, {
          currentSection: state.meta.currentSection,
          sectionCompletion: completions,
          lastSavedAt: new Date().toISOString(),
        });

        setSaveStatus("saved");
      } catch {
        if (!navigator.onLine) {
          setSaveStatus("offline");
        } else {
          setSaveStatus("error");
        }
      }
    },
    [state, token, profileId, dispatch]
  );

  const flushSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    const currentSection =
      BASELINE_FORM_SECTIONS[state.meta.currentSection];
    if (currentSection) {
      await saveSection(currentSection);
    }
  }, [saveSection, state.meta.currentSection]);

  // Debounced auto-save: serialize relevant state, compare, and save on change
  useEffect(() => {
    const currentSection =
      BASELINE_FORM_SECTIONS[state.meta.currentSection];
    if (!currentSection || currentSection === "review") return;

    // Build a fingerprint of the current section's data
    let fingerprint = "";
    switch (currentSection) {
      case "contact":
        fingerprint = JSON.stringify(state.contacts);
        break;
      case "facility":
        fingerprint = JSON.stringify(state.facility);
        break;
      case "system":
        fingerprint = JSON.stringify(state.system);
        break;
      case "equipment":
        fingerprint = JSON.stringify(state.equipment);
        break;
      case "energy":
        fingerprint = JSON.stringify(state.energy);
        break;
      case "operations":
        fingerprint = JSON.stringify(state.operations);
        break;
      case "efficiency":
        fingerprint = JSON.stringify(state.efficiency);
        break;
      case "contractors":
        fingerprint = JSON.stringify(state.contractors);
        break;
      default:
        return;
    }

    if (fingerprint === lastSavedRef.current) return;

    // Don't auto-save on initial load
    if (lastSavedRef.current === "") {
      lastSavedRef.current = fingerprint;
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      lastSavedRef.current = fingerprint;
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

  // ── Section navigation ────────────────────────────────────

  const completions = useMemo(
    () => getAllSectionCompletions(state),
    [state]
  );

  const handleNavigate = useCallback(
    async (targetIndex: number) => {
      // Flush current section's save before navigating
      await flushSave();
      dispatch({ type: "SET_SECTION", section: targetIndex });
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
        return <SystemSection state={state} dispatch={dispatch} />;
      case 3:
        return <EquipmentSection state={state} dispatch={dispatch} />;
      case 4:
        return <DocumentsSection />;
      case 5:
        return <EnergySection state={state} dispatch={dispatch} />;
      case 6:
        return <OperationsSection state={state} dispatch={dispatch} />;
      case 7:
        return <EfficiencySection state={state} dispatch={dispatch} />;
      case 8:
        return <ContractorsSection state={state} dispatch={dispatch} />;
      case 9:
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
      >
        {renderSection()}
      </SectionShell>
    </SaveContext.Provider>
  );
}
