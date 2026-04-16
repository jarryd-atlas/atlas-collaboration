"use client";

import { useCallback } from "react";
import type {
  BaselineFormState,
  BaselineFormAction,
  EngineRoomData,
  TemperatureZoneData,
} from "../../../../../../lib/baseline-form/types";
import {
  upsertBaselineEngineRoom,
  deleteBaselineEngineRoom,
  upsertBaselineTemperatureZone,
  deleteBaselineTemperatureZone,
} from "../../../../../../lib/actions/baseline-form";
import { useAutoSave } from "../../../../../../lib/hooks/use-auto-save";
import { Input, Select, Textarea } from "../../../../../../components/ui/input";
import {
  SYSTEM_TYPES,
  REFRIGERANTS,
  ZONE_TYPES,
  ZONE_TYPE_LABELS,
  DOOR_TYPES,
  DOOR_TYPE_LABELS,
  INSULATION_CONDITIONS,
  INSULATION_CONDITION_LABELS,
} from "@repo/shared/constants";
import type { SystemType, ZoneType, DoorType, InsulationCondition } from "@repo/shared/constants";
import { Plus, Trash2, Building2, Thermometer, ChevronDown, ChevronUp, Link as LinkIcon } from "lucide-react";
import { useState } from "react";

interface SectionProps {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
  token: string;
  profileId: string;
}

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  single_stage: "Single Stage",
  two_stage: "Two Stage",
  cascade: "Cascade",
};

const REFRIGERANT_OPTIONS = [
  { value: "", label: "Select refrigerant..." },
  ...REFRIGERANTS.map((r) => ({
    value: r,
    label: r === "ammonia" ? "Ammonia (R-717)" : r,
  })),
];

export function LayoutSection({ state, dispatch, token, profileId }: SectionProps) {
  const [expandedER, setExpandedER] = useState<number | null>(
    state.engineRooms.length > 0 ? 0 : null
  );
  const [expandedZone, setExpandedZone] = useState<number | null>(null);
  const [savingER, setSavingER] = useState(false);
  const [savingZone, setSavingZone] = useState(false);

  const hasEngineRooms = state.engineRooms.length > 0;

  // ── Engine Room save ──────────────────────────────────────

  const saveEngineRoom = useCallback(
    async (er: EngineRoomData, index: number) => {
      setSavingER(true);
      try {
        const result = await upsertBaselineEngineRoom(token, profileId, er);
        if (result && "id" in result && result.id && !er.id) {
          dispatch({ type: "UPDATE_ENGINE_ROOM", index, engineRoom: { id: result.id } });
        }
      } finally {
        setSavingER(false);
      }
    },
    [token, profileId, dispatch]
  );

  const handleDeleteER = useCallback(
    async (index: number) => {
      const er = state.engineRooms[index];
      if (er?.id) {
        await deleteBaselineEngineRoom(token, profileId, er.id);
      }
      dispatch({ type: "REMOVE_ENGINE_ROOM", index });
      if (expandedER === index) setExpandedER(null);
    },
    [state.engineRooms, token, profileId, dispatch, expandedER]
  );

  const handleAddER = useCallback(() => {
    dispatch({ type: "ADD_ENGINE_ROOM" });
    setExpandedER(state.engineRooms.length);
  }, [dispatch, state.engineRooms.length]);

  const handlePromote = useCallback(() => {
    dispatch({ type: "PROMOTE_TO_ENGINE_ROOM" });
    setExpandedER(0);
  }, [dispatch]);

  // ── Zone save ─────────────────────────────────────────────

  const saveZone = useCallback(
    async (zone: TemperatureZoneData, index: number) => {
      setSavingZone(true);
      try {
        const result = await upsertBaselineTemperatureZone(token, profileId, zone);
        if (result && "id" in result && result.id && !zone.id) {
          dispatch({ type: "UPDATE_TEMPERATURE_ZONE", index, zone: { id: result.id } });
        }
      } finally {
        setSavingZone(false);
      }
    },
    [token, profileId, dispatch]
  );

  const handleDeleteZone = useCallback(
    async (index: number) => {
      const zone = state.temperatureZones[index];
      if (zone?.id) {
        await deleteBaselineTemperatureZone(token, profileId, zone.id);
      }
      dispatch({ type: "REMOVE_TEMPERATURE_ZONE", index });
      if (expandedZone === index) setExpandedZone(null);
    },
    [state.temperatureZones, token, profileId, dispatch, expandedZone]
  );

  const handleAddZone = useCallback(
    (engineRoomId?: string) => {
      dispatch({ type: "ADD_TEMPERATURE_ZONE", engineRoomId });
      setExpandedZone(state.temperatureZones.length);
    },
    [dispatch, state.temperatureZones.length]
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Facility Layout</h3>
        <p className="text-sm text-gray-500 mt-1">
          Define your engine rooms and temperature zones. This is optional for
          simple, single-system facilities.
        </p>
      </div>

      {/* Intro callout when no engine rooms */}
      {!hasEngineRooms && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
          <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-gray-700 mb-1">
            Does your facility have multiple engine rooms?
          </h4>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            If your facility has multiple mechanical rooms with separate compressors,
            add engine rooms here. Otherwise, skip this section — the system configuration
            on the next page applies to your entire facility.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handlePromote}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Engine Room
            </button>
          </div>
        </div>
      )}

      {/* Engine Rooms */}
      {hasEngineRooms && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Engine Rooms ({state.engineRooms.length})
            </h4>
            <button
              type="button"
              onClick={handleAddER}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {state.engineRooms.map((er, index) => {
            const isExpanded = expandedER === index;
            return (
              <div
                key={er.id ?? `new-er-${index}`}
                className="border border-gray-200 rounded-xl bg-white overflow-hidden"
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => setExpandedER(isExpanded ? null : index)}
                  className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-gray-400" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {er.name || `Engine Room ${index + 1}`}
                      </span>
                      {er.system_type && (
                        <span className="ml-2 text-xs text-gray-400">
                          {SYSTEM_TYPE_LABELS[er.system_type] ?? er.system_type}
                          {er.refrigerant ? ` · ${er.refrigerant}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {savingER && <span className="text-xs text-gray-400">Saving...</span>}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 border-t border-gray-100 space-y-4">
                    <Input
                      label="Engine Room Name"
                      placeholder="e.g., Engine Room 1, North Building MR"
                      value={er.name}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_ENGINE_ROOM",
                          index,
                          engineRoom: { name: e.target.value },
                        })
                      }
                      onBlur={() => saveEngineRoom(state.engineRooms[index]!, index)}
                    />

                    {/* System Type */}
                    <Select
                      label="System Type"
                      options={[
                        { value: "", label: "Select system type..." },
                        ...SYSTEM_TYPES.map((t) => ({
                          value: t,
                          label: SYSTEM_TYPE_LABELS[t] ?? t,
                        })),
                      ]}
                      value={er.system_type}
                      onChange={(e) => {
                        dispatch({
                          type: "UPDATE_ENGINE_ROOM",
                          index,
                          engineRoom: { system_type: e.target.value as SystemType | "" },
                        });
                        saveEngineRoom(
                          { ...state.engineRooms[index]!, system_type: e.target.value as SystemType | "" },
                          index
                        );
                      }}
                    />

                    {/* Refrigerant */}
                    <Select
                      label="Primary Refrigerant"
                      options={REFRIGERANT_OPTIONS}
                      value={er.refrigerant}
                      onChange={(e) => {
                        dispatch({
                          type: "UPDATE_ENGINE_ROOM",
                          index,
                          engineRoom: { refrigerant: e.target.value },
                        });
                        saveEngineRoom(
                          { ...state.engineRooms[index]!, refrigerant: e.target.value },
                          index
                        );
                      }}
                    />

                    {/* Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Control System"
                        placeholder="e.g., Frick, Logix, GEA"
                        value={er.control_system}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_ENGINE_ROOM",
                            index,
                            engineRoom: { control_system: e.target.value },
                          })
                        }
                        onBlur={() => saveEngineRoom(state.engineRooms[index]!, index)}
                      />
                      <Input
                        label="Control Hardware"
                        placeholder="e.g., Opto 22, Allen Bradley"
                        value={er.control_hardware}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_ENGINE_ROOM",
                            index,
                            engineRoom: { control_hardware: e.target.value },
                          })
                        }
                        onBlur={() => saveEngineRoom(state.engineRooms[index]!, index)}
                      />
                    </div>

                    {/* Pressures */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Typical Suction Pressure (psig)"
                        type="number"
                        placeholder="e.g., 15"
                        value={er.suction_pressure_typical ?? ""}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_ENGINE_ROOM",
                            index,
                            engineRoom: {
                              suction_pressure_typical: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        onBlur={() => saveEngineRoom(state.engineRooms[index]!, index)}
                      />
                      <Input
                        label="Typical Discharge Pressure (psig)"
                        type="number"
                        placeholder="e.g., 165"
                        value={er.discharge_pressure_typical ?? ""}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_ENGINE_ROOM",
                            index,
                            engineRoom: {
                              discharge_pressure_typical: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        onBlur={() => saveEngineRoom(state.engineRooms[index]!, index)}
                      />
                    </div>

                    {/* Connected to another ER */}
                    {state.engineRooms.length > 1 && (
                      <div className="border border-gray-100 rounded-lg p-4 bg-gray-50 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <LinkIcon className="h-4 w-4" />
                          Connections
                        </div>
                        <Select
                          label="Connected to Engine Room"
                          options={[
                            { value: "", label: "Not connected (independent)" },
                            ...state.engineRooms
                              .filter((_, i) => i !== index)
                              .map((otherER, i) => ({
                                value: otherER.id ?? `idx-${i}`,
                                label: otherER.name || `Engine Room ${i + 1}`,
                              })),
                          ]}
                          value={er.connected_to_engine_room_id ?? ""}
                          onChange={(e) => {
                            dispatch({
                              type: "UPDATE_ENGINE_ROOM",
                              index,
                              engineRoom: {
                                connected_to_engine_room_id: e.target.value || null,
                              },
                            });
                            saveEngineRoom(
                              {
                                ...state.engineRooms[index]!,
                                connected_to_engine_room_id: e.target.value || null,
                              },
                              index
                            );
                          }}
                        />
                        <label className="flex items-center gap-3 cursor-pointer">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={er.shared_controls}
                            onClick={() => {
                              dispatch({
                                type: "UPDATE_ENGINE_ROOM",
                                index,
                                engineRoom: { shared_controls: !er.shared_controls },
                              });
                              saveEngineRoom(
                                { ...state.engineRooms[index]!, shared_controls: !er.shared_controls },
                                index
                              );
                            }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              er.shared_controls ? "bg-brand-green" : "bg-gray-200"
                            }`}
                          >
                            <span
                              className={`inline-block h-3 w-3 rounded-full bg-white transition-transform shadow-sm ${
                                er.shared_controls ? "translate-x-5" : "translate-x-1"
                              }`}
                            />
                          </button>
                          <span className="text-sm text-gray-700">
                            Shared controls (same PLC)
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Notes */}
                    <Textarea
                      label="Notes"
                      placeholder="Any additional details about this engine room..."
                      value={er.notes}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_ENGINE_ROOM",
                          index,
                          engineRoom: { notes: e.target.value },
                        })
                      }
                      onBlur={() => saveEngineRoom(state.engineRooms[index]!, index)}
                    />

                    {/* Delete */}
                    <div className="pt-2 border-t border-gray-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeleteER(index)}
                        className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove Engine Room
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Temperature Zones */}
      {hasEngineRooms && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Temperature Zones ({state.temperatureZones.length})
            </h4>
            <button
              type="button"
              onClick={() => handleAddZone(state.engineRooms[0]?.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Zone
            </button>
          </div>

          {state.temperatureZones.length === 0 && (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center">
              <Thermometer className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                Add temperature zones (coolers, freezers, blast rooms) to map your facility.
              </p>
            </div>
          )}

          {state.temperatureZones.map((zone, index) => {
            const isExpanded = expandedZone === index;
            const servingER = zone.engine_room_id
              ? state.engineRooms.find((er) => er.id === zone.engine_room_id)
              : null;

            return (
              <div
                key={zone.id ?? `new-zone-${index}`}
                className="border border-gray-200 rounded-xl bg-white overflow-hidden"
              >
                {/* Header */}
                <button
                  type="button"
                  onClick={() => setExpandedZone(isExpanded ? null : index)}
                  className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Thermometer className="h-5 w-5 text-blue-400" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {zone.name || `Zone ${index + 1}`}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        {zone.zone_type ? (ZONE_TYPE_LABELS as Record<string, string>)[zone.zone_type] ?? zone.zone_type : ""}
                        {zone.target_temp_f !== null ? ` · ${zone.target_temp_f}°F` : ""}
                        {servingER ? ` · ${servingER.name}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {savingZone && <span className="text-xs text-gray-400">Saving...</span>}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 border-t border-gray-100 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Zone Name"
                        placeholder="e.g., Freezer 1, Cooler A, Dock"
                        value={zone.name}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_TEMPERATURE_ZONE",
                            index,
                            zone: { name: e.target.value },
                          })
                        }
                        onBlur={() => saveZone(state.temperatureZones[index]!, index)}
                      />

                      <Select
                        label="Zone Type"
                        options={[
                          { value: "", label: "Select zone type..." },
                          ...ZONE_TYPES.map((t) => ({
                            value: t,
                            label: ZONE_TYPE_LABELS[t],
                          })),
                        ]}
                        value={zone.zone_type}
                        onChange={(e) => {
                          dispatch({
                            type: "UPDATE_TEMPERATURE_ZONE",
                            index,
                            zone: { zone_type: e.target.value as ZoneType | "" },
                          });
                          saveZone(
                            { ...state.temperatureZones[index]!, zone_type: e.target.value as ZoneType | "" },
                            index
                          );
                        }}
                      />
                    </div>

                    {/* Served by engine room */}
                    <Select
                      label="Served by Engine Room"
                      options={[
                        { value: "", label: "Unassigned" },
                        ...state.engineRooms.map((er) => ({
                          value: er.id ?? "",
                          label: er.name || "Engine Room",
                        })),
                      ]}
                      value={zone.engine_room_id ?? ""}
                      onChange={(e) => {
                        dispatch({
                          type: "UPDATE_TEMPERATURE_ZONE",
                          index,
                          zone: { engine_room_id: e.target.value || null },
                        });
                        saveZone(
                          { ...state.temperatureZones[index]!, engine_room_id: e.target.value || null },
                          index
                        );
                      }}
                    />

                    {/* Target temperature */}
                    <Input
                      label="Target Temperature (°F)"
                      type="number"
                      placeholder="e.g., -10 for freezer, 35 for cooler"
                      value={zone.target_temp_f ?? ""}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_TEMPERATURE_ZONE",
                          index,
                          zone: {
                            target_temp_f: e.target.value ? Number(e.target.value) : null,
                          },
                        })
                      }
                      onBlur={() => saveZone(state.temperatureZones[index]!, index)}
                    />

                    {/* Dimensions */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Room Dimensions (ft)
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <Input
                          placeholder="Length"
                          type="number"
                          value={zone.length_ft ?? ""}
                          onChange={(e) =>
                            dispatch({
                              type: "UPDATE_TEMPERATURE_ZONE",
                              index,
                              zone: {
                                length_ft: e.target.value ? Number(e.target.value) : null,
                              },
                            })
                          }
                          onBlur={() => saveZone(state.temperatureZones[index]!, index)}
                        />
                        <Input
                          placeholder="Width"
                          type="number"
                          value={zone.width_ft ?? ""}
                          onChange={(e) =>
                            dispatch({
                              type: "UPDATE_TEMPERATURE_ZONE",
                              index,
                              zone: {
                                width_ft: e.target.value ? Number(e.target.value) : null,
                              },
                            })
                          }
                          onBlur={() => saveZone(state.temperatureZones[index]!, index)}
                        />
                        <Input
                          placeholder="Height"
                          type="number"
                          value={zone.height_ft ?? ""}
                          onChange={(e) =>
                            dispatch({
                              type: "UPDATE_TEMPERATURE_ZONE",
                              index,
                              zone: {
                                height_ft: e.target.value ? Number(e.target.value) : null,
                              },
                            })
                          }
                          onBlur={() => saveZone(state.temperatureZones[index]!, index)}
                        />
                      </div>
                      {zone.length_ft && zone.width_ft && zone.height_ft && (
                        <p className="text-xs text-gray-400 mt-1">
                          Volume: {(zone.length_ft * zone.width_ft * zone.height_ft).toLocaleString()} ft³
                        </p>
                      )}
                    </div>

                    {/* Doors & Insulation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Number of Doors"
                        type="number"
                        min={0}
                        placeholder="e.g., 2"
                        value={zone.num_doors ?? ""}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_TEMPERATURE_ZONE",
                            index,
                            zone: {
                              num_doors: e.target.value ? Number(e.target.value) : null,
                            },
                          })
                        }
                        onBlur={() => saveZone(state.temperatureZones[index]!, index)}
                      />
                      <Select
                        label="Door Type"
                        options={[
                          { value: "", label: "Select door type..." },
                          ...DOOR_TYPES.map((t) => ({
                            value: t,
                            label: DOOR_TYPE_LABELS[t],
                          })),
                        ]}
                        value={zone.door_type}
                        onChange={(e) => {
                          dispatch({
                            type: "UPDATE_TEMPERATURE_ZONE",
                            index,
                            zone: { door_type: e.target.value as DoorType | "" },
                          });
                          saveZone(
                            { ...state.temperatureZones[index]!, door_type: e.target.value as DoorType | "" },
                            index
                          );
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Insulation Thickness (in)"
                        type="number"
                        min={0}
                        placeholder="e.g., 4"
                        value={zone.insulation_thickness_in ?? ""}
                        onChange={(e) =>
                          dispatch({
                            type: "UPDATE_TEMPERATURE_ZONE",
                            index,
                            zone: {
                              insulation_thickness_in: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          })
                        }
                        onBlur={() => saveZone(state.temperatureZones[index]!, index)}
                      />
                      <Select
                        label="Insulation Condition"
                        options={[
                          { value: "", label: "Select condition..." },
                          ...INSULATION_CONDITIONS.map((c) => ({
                            value: c,
                            label: INSULATION_CONDITION_LABELS[c],
                          })),
                        ]}
                        value={zone.insulation_condition}
                        onChange={(e) => {
                          dispatch({
                            type: "UPDATE_TEMPERATURE_ZONE",
                            index,
                            zone: {
                              insulation_condition: e.target.value as InsulationCondition | "",
                            },
                          });
                          saveZone(
                            {
                              ...state.temperatureZones[index]!,
                              insulation_condition: e.target.value as InsulationCondition | "",
                            },
                            index
                          );
                        }}
                      />
                    </div>

                    {/* Notes */}
                    <Textarea
                      label="Notes"
                      placeholder="Any details about this zone..."
                      value={zone.notes}
                      onChange={(e) =>
                        dispatch({
                          type: "UPDATE_TEMPERATURE_ZONE",
                          index,
                          zone: { notes: e.target.value },
                        })
                      }
                      onBlur={() => saveZone(state.temperatureZones[index]!, index)}
                    />

                    {/* Delete */}
                    <div className="pt-2 border-t border-gray-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeleteZone(index)}
                        className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove Zone
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
