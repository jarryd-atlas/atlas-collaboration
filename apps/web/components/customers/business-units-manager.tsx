"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, Building2, Check } from "lucide-react";
import { createBusinessUnit, updateBusinessUnit, deleteBusinessUnit } from "../../lib/actions/business-units";
import { cn } from "../../lib/utils";

interface BusinessUnit {
  id: string;
  name: string;
  slug: string;
}

interface BusinessUnitsManagerProps {
  customerId: string;
  tenantId: string;
  businessUnits: BusinessUnit[];
}

export function BusinessUnitsManager({ customerId, tenantId, businessUnits }: BusinessUnitsManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const router = useRouter();

  function handleCreate() {
    if (!newName.trim()) return;
    const name = newName.trim();
    setNewName("");
    setShowAdd(false);
    startTransition(async () => {
      await createBusinessUnit(customerId, tenantId, name);
      router.refresh();
    });
  }

  function handleRename(id: string) {
    if (!editName.trim()) return;
    const name = editName.trim();
    setEditingId(null);
    setEditName("");
    startTransition(async () => {
      await updateBusinessUnit(id, name);
      router.refresh();
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Sites in this unit will become unassigned.`)) return;
    startTransition(async () => {
      await deleteBusinessUnit(id);
      router.refresh();
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 text-gray-400" />
          <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
            Business Units
          </h4>
          <span className="text-[10px] text-gray-400">{businessUnits.length}</span>
        </div>
        <button
          onClick={() => { setShowAdd(!showAdd); setEditingId(null); }}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      <div className={cn("px-4 py-2 space-y-1", isPending && "opacity-50 pointer-events-none")}>
        {businessUnits.length === 0 && !showAdd && (
          <p className="text-xs text-gray-400 py-1">No business units defined yet.</p>
        )}

        {businessUnits.map((bu) => (
          <div key={bu.id} className="flex items-center gap-2 group">
            {editingId === bu.id ? (
              <div className="flex items-center gap-1.5 flex-1">
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(bu.id);
                    if (e.key === "Escape") { setEditingId(null); setEditName(""); }
                  }}
                  className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-green"
                />
                <button
                  onClick={() => handleRename(bu.id)}
                  className="p-0.5 text-green-600 hover:text-green-700"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { setEditingId(null); setEditName(""); }}
                  className="p-0.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-700">{bu.name}</span>
                <button
                  onClick={() => { setEditingId(bu.id); setEditName(bu.name); setShowAdd(false); }}
                  className="p-0.5 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Rename"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleDelete(bu.id, bu.name)}
                  className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete"
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        ))}

        {showAdd && (
          <div className="flex items-center gap-1.5 pt-1">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setShowAdd(false); setNewName(""); }
              }}
              placeholder="e.g. Fresh Meats"
              className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-green"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-2 py-1 text-xs font-medium text-white bg-brand-green rounded-md hover:bg-brand-green/90 disabled:opacity-50"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewName(""); }}
              className="p-0.5 text-gray-400 hover:text-gray-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
