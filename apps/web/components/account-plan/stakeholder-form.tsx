"use client";

import { useState } from "react";
import { createStakeholder, updateStakeholder, deleteStakeholder } from "../../lib/actions/account-plan";
import { X, Trash2 } from "lucide-react";
import type { Stakeholder } from "./org-chart-node";

interface StakeholderFormProps {
  stakeholder?: Stakeholder | null;
  accountPlanId: string;
  tenantId: string;
  allStakeholders: Stakeholder[];
  isCKInternal: boolean;
  defaultReportsTo?: string | null;
  onClose: () => void;
}

export function StakeholderForm({
  stakeholder,
  accountPlanId,
  tenantId,
  allStakeholders,
  isCKInternal,
  defaultReportsTo,
  onClose,
}: StakeholderFormProps) {
  const isEdit = !!stakeholder;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: stakeholder?.name ?? "",
    title: stakeholder?.title ?? "",
    email: stakeholder?.email ?? "",
    phone: stakeholder?.phone ?? "",
    department: stakeholder?.department ?? "",
    stakeholder_role: stakeholder?.stakeholder_role ?? "",
    relationship_strength: stakeholder?.relationship_strength ?? "unknown",
    strategy_notes: stakeholder?.strategy_notes ?? "",
    notes: stakeholder?.notes ?? "",
    reports_to: stakeholder?.reports_to ?? defaultReportsTo ?? "",
  });

  // Filter out self and descendants from reports_to options to prevent circular refs
  const reportsToOptions = allStakeholders.filter((s) => s.id !== stakeholder?.id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    const data = {
      name: form.name.trim(),
      title: form.title || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      department: form.department || undefined,
      stakeholder_role: form.stakeholder_role || undefined,
      relationship_strength: form.relationship_strength || undefined,
      strategy_notes: form.strategy_notes || undefined,
      notes: form.notes || undefined,
      reports_to: form.reports_to || null,
    };

    if (isEdit) {
      await updateStakeholder(stakeholder.id, data);
    } else {
      await createStakeholder(accountPlanId, tenantId, data);
    }
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!stakeholder || !confirm("Delete this stakeholder? Their direct reports will become top-level.")) return;
    setSaving(true);
    await deleteStakeholder(stakeholder.id);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{isEdit ? "Edit Stakeholder" : "Add Stakeholder"}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100 text-gray-400"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-gray-500 uppercase">Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" placeholder="Full name" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" placeholder="VP of Operations" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Department</label>
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" placeholder="Operations" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-medium text-gray-500 uppercase">Reports To</label>
              <select value={form.reports_to} onChange={(e) => setForm({ ...form, reports_to: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md">
                <option value="">None (top-level)</option>
                {reportsToOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.title ? ` — ${s.title}` : ""}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Internal-only fields */}
          {isCKInternal && (
            <div className="border-t border-gray-100 pt-3 mt-3 space-y-3">
              <p className="text-[10px] font-medium text-gray-400 uppercase">Internal Only</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase">Role</label>
                  <select value={form.stakeholder_role} onChange={(e) => setForm({ ...form, stakeholder_role: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md">
                    <option value="">Not set</option>
                    <option value="champion">Champion</option>
                    <option value="decision_maker">Decision Maker</option>
                    <option value="influencer">Influencer</option>
                    <option value="blocker">Blocker</option>
                    <option value="user">User</option>
                    <option value="economic_buyer">Economic Buyer</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 uppercase">Relationship</label>
                  <select value={form.relationship_strength} onChange={(e) => setForm({ ...form, relationship_strength: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md">
                    <option value="unknown">Unknown</option>
                    <option value="strong">Strong</option>
                    <option value="good">Good</option>
                    <option value="developing">Developing</option>
                    <option value="weak">Weak</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-500 uppercase">Strategy Notes</label>
                <textarea value={form.strategy_notes} onChange={(e) => setForm({ ...form, strategy_notes: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" rows={2} placeholder="How to engage this person..." />
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-medium text-gray-500 uppercase">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full mt-0.5 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md" rows={2} />
          </div>

          <div className="flex items-center justify-between pt-2">
            {isEdit && isCKInternal ? (
              <button type="button" onClick={handleDelete} disabled={saving} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
              <button type="submit" disabled={saving || !form.name.trim()} className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50">
                {saving ? "Saving..." : isEdit ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
