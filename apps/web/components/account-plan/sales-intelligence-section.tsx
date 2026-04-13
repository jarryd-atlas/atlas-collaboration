"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Zap, ShieldAlert, Plus, ChevronDown, ChevronRight, X, Check } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  BUYING_TRIGGERS,
  OBJECTIONS,
  PERSONA_COLORS,
  PERSONA_LABELS,
} from "../../lib/constants/sales-intelligence";
import {
  createBuyingTrigger,
  updateBuyingTrigger,
  deleteBuyingTrigger,
  createObjection,
  updateObjection,
  deleteObjection,
} from "../../lib/actions/sales-intelligence";

interface BuyingTrigger {
  id: string;
  trigger_key: string | null;
  custom_label: string | null;
  persona_type: string | null;
  is_active: boolean;
  fired_date: string | null;
  notes: string | null;
}

interface Objection {
  id: string;
  objection_key: string | null;
  custom_label: string | null;
  status: string;
  raised_by_stakeholder_id: string | null;
  raised_by?: { id: string; name: string } | null;
  notes: string | null;
  resolution_notes: string | null;
}

interface Stakeholder {
  id: string;
  name: string;
}

interface SalesIntelligenceSectionProps {
  customerId: string;
  tenantId: string;
  buyingTriggers: BuyingTrigger[];
  objections: Objection[];
  stakeholders: Stakeholder[];
}

export function SalesIntelligenceSection({
  customerId,
  tenantId,
  buyingTriggers,
  objections,
  stakeholders,
}: SalesIntelligenceSectionProps) {
  const [triggersOpen, setTriggersOpen] = useState(true);
  const [objectionsOpen, setObjectionsOpen] = useState(true);

  const activeTriggers = buyingTriggers.filter((t) => t.is_active);
  const activeObjections = objections.filter((o) => o.status === "active" || o.status === "addressing");

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-50">
        <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
          Sales Intelligence
        </h4>
      </div>

      <div className="divide-y divide-gray-50">
        {/* Buying Triggers */}
        <BuyingTriggersCard
          customerId={customerId}
          tenantId={tenantId}
          triggers={buyingTriggers}
          activeCount={activeTriggers.length}
          isOpen={triggersOpen}
          onToggle={() => setTriggersOpen(!triggersOpen)}
        />

        {/* Objections */}
        <ObjectionsCard
          customerId={customerId}
          tenantId={tenantId}
          objections={objections}
          activeCount={activeObjections.length}
          stakeholders={stakeholders}
          isOpen={objectionsOpen}
          onToggle={() => setObjectionsOpen(!objectionsOpen)}
        />
      </div>
    </div>
  );
}

// ─── Buying Triggers Card ────────────────────────────────────

function BuyingTriggersCard({
  customerId,
  tenantId,
  triggers,
  activeCount,
  isOpen,
  onToggle,
}: {
  customerId: string;
  tenantId: string;
  triggers: BuyingTrigger[];
  activeCount: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const existingKeys = new Set(triggers.map((t) => t.trigger_key).filter(Boolean));
  const availableTriggers = BUYING_TRIGGERS.filter((t) => !existingKeys.has(t.key));

  const handleAdd = useCallback(async () => {
    if (!selectedKey && !customLabel.trim()) return;
    setSaving(true);
    const selected = BUYING_TRIGGERS.find((t) => t.key === selectedKey);
    await createBuyingTrigger(customerId, tenantId, {
      trigger_key: selectedKey || undefined,
      custom_label: selectedKey ? undefined : customLabel.trim(),
      persona_type: selected?.persona ?? undefined,
      notes: notes.trim() || undefined,
    });
    setSelectedKey("");
    setCustomLabel("");
    setNotes("");
    setShowAdd(false);
    setSaving(false);
    router.refresh();
  }, [selectedKey, customLabel, notes, customerId, tenantId, router]);

  const handleToggle = useCallback(async (id: string, currentlyActive: boolean) => {
    await updateBuyingTrigger(id, { is_active: !currentlyActive });
    router.refresh();
  }, [router]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteBuyingTrigger(id);
    router.refresh();
  }, [router]);

  const getTriggerLabel = (t: BuyingTrigger) => {
    if (t.trigger_key) {
      const catalog = BUYING_TRIGGERS.find((bt) => bt.key === t.trigger_key);
      return catalog?.label ?? t.trigger_key;
    }
    return t.custom_label ?? "Custom trigger";
  };

  // Group available triggers by persona for the dropdown
  const groupedAvailable = {
    engineering_leader: availableTriggers.filter((t) => t.persona === "engineering_leader"),
    sustainability_leader: availableTriggers.filter((t) => t.persona === "sustainability_leader"),
    fmm: availableTriggers.filter((t) => t.persona === "fmm"),
  };

  return (
    <div className="px-4 py-3">
      <button onClick={onToggle} className="flex items-center gap-2 w-full text-left">
        {isOpen ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
        <Zap className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-gray-700">Buying Triggers</span>
        {activeCount > 0 && (
          <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{activeCount} active</span>
        )}
        <div className="flex-1" />
        {isOpen && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd); }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="Add trigger"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1">
          {/* Add form */}
          {showAdd && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 mb-2">
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">Select a trigger or add custom...</option>
                {groupedAvailable.engineering_leader.length > 0 && (
                  <optgroup label="Engineering Leader">
                    {groupedAvailable.engineering_leader.map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </optgroup>
                )}
                {groupedAvailable.sustainability_leader.length > 0 && (
                  <optgroup label="Sustainability Leader">
                    {groupedAvailable.sustainability_leader.map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </optgroup>
                )}
                {groupedAvailable.fmm.length > 0 && (
                  <optgroup label="Facility Maintenance Manager">
                    {groupedAvailable.fmm.map((t) => (
                      <option key={t.key} value={t.key}>{t.label}</option>
                    ))}
                  </optgroup>
                )}
                <option value="_custom">Custom...</option>
              </select>
              {(selectedKey === "_custom" || selectedKey === "") && !selectedKey && (
                <input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Custom trigger description..."
                  className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5"
                />
              )}
              {selectedKey === "_custom" && (
                <input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Custom trigger description..."
                  className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5"
                />
              )}
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)..."
                className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAdd(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                <button
                  onClick={handleAdd}
                  disabled={saving || (!selectedKey && !customLabel.trim()) || selectedKey === "_custom" && !customLabel.trim()}
                  className="text-xs font-medium text-white bg-gray-900 rounded-md px-2.5 py-1 hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          )}

          {/* Trigger list */}
          {triggers.length === 0 && !showAdd && (
            <p className="text-[11px] text-gray-400 py-2">No buying triggers tracked yet.</p>
          )}
          {triggers.map((t) => (
            <div key={t.id} className={cn("flex items-start gap-2 py-1.5 px-2 rounded-md group hover:bg-gray-50", !t.is_active && "opacity-50")}>
              <button
                onClick={() => handleToggle(t.id, t.is_active)}
                className={cn(
                  "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                  t.is_active ? "border-amber-400 bg-amber-50" : "border-gray-300 bg-white"
                )}
                title={t.is_active ? "Mark resolved" : "Mark active"}
              >
                {!t.is_active && <Check className="h-2.5 w-2.5 text-gray-400" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-xs text-gray-700", !t.is_active && "line-through")}>{getTriggerLabel(t)}</span>
                  {t.persona_type && (
                    <span className={cn("text-[8px] font-medium px-1 py-0.5 rounded-full", PERSONA_COLORS[t.persona_type] ?? "bg-gray-100 text-gray-500")}>
                      {PERSONA_LABELS[t.persona_type] ?? t.persona_type}
                    </span>
                  )}
                </div>
                {t.notes && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{t.notes}</p>}
                {t.fired_date && <p className="text-[10px] text-gray-400 mt-0.5">Fired: {new Date(t.fired_date).toLocaleDateString()}</p>}
              </div>
              <button
                onClick={() => handleDelete(t.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-all"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Objections Card ─────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: "bg-red-100 text-red-700",
  addressing: "bg-amber-100 text-amber-700",
  resolved: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  addressing: "Addressing",
  resolved: "Resolved",
};

function ObjectionsCard({
  customerId,
  tenantId,
  objections,
  activeCount,
  stakeholders,
  isOpen,
  onToggle,
}: {
  customerId: string;
  tenantId: string;
  objections: Objection[];
  activeCount: number;
  stakeholders: Stakeholder[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [raisedBy, setRaisedBy] = useState("");
  const [saving, setSaving] = useState(false);

  const existingKeys = new Set(objections.filter((o) => o.status !== "resolved").map((o) => o.objection_key).filter(Boolean));
  const availableObjections = OBJECTIONS.filter((o) => !existingKeys.has(o.key));

  const handleAdd = useCallback(async () => {
    if (!selectedKey && !customLabel.trim()) return;
    setSaving(true);
    await createObjection(customerId, tenantId, {
      objection_key: (selectedKey && selectedKey !== "_custom") ? selectedKey : undefined,
      custom_label: (!selectedKey || selectedKey === "_custom") ? customLabel.trim() : undefined,
      raised_by_stakeholder_id: raisedBy || undefined,
      notes: notes.trim() || undefined,
    });
    setSelectedKey("");
    setCustomLabel("");
    setNotes("");
    setRaisedBy("");
    setShowAdd(false);
    setSaving(false);
    router.refresh();
  }, [selectedKey, customLabel, notes, raisedBy, customerId, tenantId, router]);

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    await updateObjection(id, { status });
    router.refresh();
  }, [router]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteObjection(id);
    router.refresh();
  }, [router]);

  const getObjectionLabel = (o: Objection) => {
    if (o.objection_key) {
      const catalog = OBJECTIONS.find((obj) => obj.key === o.objection_key);
      return catalog?.label ?? o.objection_key;
    }
    return o.custom_label ?? "Custom objection";
  };

  return (
    <div className="px-4 py-3">
      <button onClick={onToggle} className="flex items-center gap-2 w-full text-left">
        {isOpen ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
        <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
        <span className="text-xs font-semibold text-gray-700">Objections</span>
        {activeCount > 0 && (
          <span className="text-[10px] font-medium bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{activeCount} active</span>
        )}
        <div className="flex-1" />
        {isOpen && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd); }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="Add objection"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-1">
          {/* Add form */}
          {showAdd && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2 mb-2">
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
              >
                <option value="">Select an objection or add custom...</option>
                {availableObjections.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
                <option value="_custom">Custom...</option>
              </select>
              {selectedKey === "_custom" && (
                <input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Custom objection description..."
                  className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5"
                />
              )}
              {stakeholders.length > 0 && (
                <select
                  value={raisedBy}
                  onChange={(e) => setRaisedBy(e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                >
                  <option value="">Raised by (optional)</option>
                  {stakeholders.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)..."
                className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAdd(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
                <button
                  onClick={handleAdd}
                  disabled={saving || (!selectedKey && !customLabel.trim()) || (selectedKey === "_custom" && !customLabel.trim())}
                  className="text-xs font-medium text-white bg-gray-900 rounded-md px-2.5 py-1 hover:bg-gray-800 disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add"}
                </button>
              </div>
            </div>
          )}

          {/* Objection list */}
          {objections.length === 0 && !showAdd && (
            <p className="text-[11px] text-gray-400 py-2">No objections tracked yet.</p>
          )}
          {objections.map((o) => (
            <div key={o.id} className={cn("flex items-start gap-2 py-1.5 px-2 rounded-md group hover:bg-gray-50", o.status === "resolved" && "opacity-50")}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn("text-xs text-gray-700", o.status === "resolved" && "line-through")}>{getObjectionLabel(o)}</span>
                  <select
                    value={o.status}
                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                    className={cn("text-[9px] font-medium rounded-full px-1.5 py-0.5 border-0 cursor-pointer", STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-500")}
                  >
                    <option value="active">Active</option>
                    <option value="addressing">Addressing</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
                {o.raised_by?.name && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Raised by {o.raised_by.name}</p>
                )}
                {o.notes && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{o.notes}</p>}
              </div>
              <button
                onClick={() => handleDelete(o.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-all mt-0.5"
                title="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
