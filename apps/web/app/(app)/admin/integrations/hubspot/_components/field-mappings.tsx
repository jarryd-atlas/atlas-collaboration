"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "../../../../../../components/ui/button";
import { ArrowRight, ArrowLeft, ArrowLeftRight, Settings2, Plus, Trash2 } from "lucide-react";
import { addFieldMapping, updateFieldMapping, deleteFieldMapping, toggleFieldMapping } from "../../../../../../lib/actions/hubspot";
import { MAPPABLE_APP_FIELDS } from "../../../../../../lib/hubspot/constants";
import type { HubSpotFieldMapping, SyncDirection } from "../../../../../../lib/hubspot/types";

interface HubSpotPropertyOption {
  name: string;
  label: string;
  type: string;
  group: string;
}

const DIRECTION_OPTIONS: { value: SyncDirection; label: string; icon: React.ReactNode }[] = [
  { value: "hubspot_to_app", label: "HubSpot → App", icon: <ArrowRight className="h-4 w-4" /> },
  { value: "app_to_hubspot", label: "App → HubSpot", icon: <ArrowLeft className="h-4 w-4" /> },
  { value: "bidirectional", label: "Both Ways", icon: <ArrowLeftRight className="h-4 w-4" /> },
];

function DirectionIcon({ direction }: { direction: SyncDirection }) {
  switch (direction) {
    case "hubspot_to_app": return <ArrowRight className="h-4 w-4 text-blue-500" />;
    case "app_to_hubspot": return <ArrowLeft className="h-4 w-4 text-green-500" />;
    case "bidirectional": return <ArrowLeftRight className="h-4 w-4 text-purple-500" />;
  }
}

export function FieldMappings({ mappings }: { mappings: HubSpotFieldMapping[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [hubspotProperties, setHubspotProperties] = useState<HubSpotPropertyOption[]>([]);
  const [loadingProps, setLoadingProps] = useState(false);

  // New mapping form state
  const [newHsProp, setNewHsProp] = useState("");
  const [newAppTable, setNewAppTable] = useState("");
  const [newAppColumn, setNewAppColumn] = useState("");
  const [newDirection, setNewDirection] = useState<SyncDirection>("hubspot_to_app");
  const [adding, setAdding] = useState(false);

  const loadProperties = useCallback(async () => {
    if (hubspotProperties.length > 0) return;
    setLoadingProps(true);
    try {
      const res = await fetch("/api/hubspot/properties");
      const data = await res.json();
      setHubspotProperties(data.properties ?? []);
    } catch { /* ignore */ }
    setLoadingProps(false);
  }, [hubspotProperties.length]);

  useEffect(() => {
    if (showAdd) loadProperties();
  }, [showAdd, loadProperties]);

  async function handleAdd() {
    if (!newHsProp || !newAppTable || !newAppColumn) return;
    setAdding(true);
    const appField = MAPPABLE_APP_FIELDS.find((f) => f.table === newAppTable && f.column === newAppColumn);
    await addFieldMapping({
      hubspot_property: newHsProp,
      app_table: newAppTable,
      app_column: newAppColumn,
      direction: newDirection,
      transform: appField?.type === "percentage" ? "percentage" : appField?.type === "number" ? "number" : "text",
    });
    setAdding(false);
    setShowAdd(false);
    setNewHsProp("");
    setNewAppTable("");
    setNewAppColumn("");
  }

  async function handleDirectionChange(mappingId: string, direction: SyncDirection) {
    await updateFieldMapping(mappingId, { direction });
  }

  async function handleToggle(mappingId: string, isActive: boolean) {
    await toggleFieldMapping(mappingId, isActive);
  }

  async function handleDelete(mappingId: string) {
    await deleteFieldMapping(mappingId);
  }

  // Get a human label for a HubSpot property
  function hsLabel(propName: string): string {
    const found = hubspotProperties.find((p) => p.name === propName);
    return found?.label ?? propName;
  }

  function appLabel(table: string, column: string): string {
    const found = MAPPABLE_APP_FIELDS.find((f) => f.table === table && f.column === column);
    return found?.label ?? `${table}.${column}`;
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Settings2 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Field Mappings</h2>
            <p className="text-sm text-gray-500">Configure which deal fields sync with app fields.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-4 w-4 mr-1" /> Add Mapping
        </Button>
      </div>

      {/* Mappings table */}
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">HubSpot Property</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600">Direction</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">App Field</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600">Active</th>
              <th className="text-right px-4 py-2 font-medium text-gray-600 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {mappings.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No field mappings configured.
                </td>
              </tr>
            ) : (
              mappings.map((m) => (
                <tr key={m.id} className={`hover:bg-gray-50 ${!m.is_active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">
                      {m.hubspot_property}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={m.direction}
                      onChange={(e) => handleDirectionChange(m.id, e.target.value as SyncDirection)}
                      className="text-xs bg-transparent border border-gray-200 rounded px-2 py-1 cursor-pointer"
                    >
                      {DIRECTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-700">{appLabel(m.app_table, m.app_column)}</span>
                    <span className="text-xs text-gray-400 ml-1">({m.app_table})</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggle(m.id, !m.is_active)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        m.is_active ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          m.is_active ? "translate-x-4.5" : "translate-x-1"
                        }`}
                        style={{ transform: m.is_active ? "translateX(16px)" : "translateX(2px)" }}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                      title="Delete mapping"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add mapping form */}
      {showAdd && (
        <div className="mt-4 p-4 border border-purple-200 bg-purple-50/50 rounded-lg space-y-3">
          <div className="grid grid-cols-4 gap-3">
            {/* HubSpot property picker */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">HubSpot Property</label>
              {loadingProps ? (
                <p className="text-xs text-gray-500">Loading...</p>
              ) : (
                <select
                  value={newHsProp}
                  onChange={(e) => setNewHsProp(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
                >
                  <option value="">Select property...</option>
                  {hubspotProperties.map((p) => (
                    <option key={p.name} value={p.name}>{p.label}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Direction */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Direction</label>
              <select
                value={newDirection}
                onChange={(e) => setNewDirection(e.target.value as SyncDirection)}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
              >
                {DIRECTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* App field picker */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">App Field</label>
              <select
                value={newAppTable && newAppColumn ? `${newAppTable}::${newAppColumn}` : ""}
                onChange={(e) => {
                  const [t, c] = e.target.value.split("::");
                  setNewAppTable(t ?? "");
                  setNewAppColumn(c ?? "");
                }}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white"
              >
                <option value="">Select field...</option>
                {MAPPABLE_APP_FIELDS.map((f) => (
                  <option key={`${f.table}::${f.column}`} value={`${f.table}::${f.column}`}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Add button */}
            <div className="flex items-end">
              <Button size="sm" onClick={handleAdd} disabled={adding || !newHsProp || !newAppColumn}>
                {adding ? "Adding..." : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
