"use client";

import { useState, useCallback } from "react";
import { createSuccessMilestone, updateSuccessMilestone, deleteSuccessMilestone } from "../../lib/actions/account-plan";
import { cn } from "../../lib/utils";
import { Plus, Calendar, Check, AlertTriangle, Clock, X, Pencil, Trash2 } from "lucide-react";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  completed_date: string | null;
  status: string;
  evidence_notes: string | null;
}

interface MilestoneTimelineProps {
  milestones: Milestone[];
  accountPlanId: string;
  tenantId: string;
  isCKInternal: boolean;
  profileId?: string;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  planned: { icon: Clock, color: "text-gray-500", bg: "bg-gray-100", label: "Planned" },
  in_progress: { icon: Clock, color: "text-blue-600", bg: "bg-blue-50", label: "In Progress" },
  completed: { icon: Check, color: "text-green-600", bg: "bg-green-50", label: "Completed" },
  at_risk: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", label: "At Risk" },
};

export function MilestoneTimeline({ milestones, accountPlanId, tenantId, isCKInternal, profileId }: MilestoneTimelineProps) {
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ title: "", target_date: "" });

  const handleAdd = useCallback(async () => {
    if (!newForm.title.trim()) return;
    await createSuccessMilestone(accountPlanId, tenantId, {
      title: newForm.title.trim(),
      target_date: newForm.target_date || undefined,
    }, profileId);
    setNewForm({ title: "", target_date: "" });
    setAdding(false);
  }, [newForm, accountPlanId, tenantId, profileId]);

  const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    if (newStatus === "completed") updates.completed_date = new Date().toISOString().split("T")[0];
    else updates.completed_date = null;
    await updateSuccessMilestone(id, updates);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Milestones & Proof Points</h3>
        {isCKInternal && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <Plus className="h-3 w-3" /> Add
          </button>
        )}
      </div>

      {milestones.length === 0 && !adding && (
        <p className="text-xs text-gray-400 py-3">No milestones yet. Define key proof points for the enterprise close.</p>
      )}

      <div className="space-y-2">
        {milestones.map((m) => {
          const config = (STATUS_CONFIG[m.status] ?? STATUS_CONFIG.planned)!;
          const StatusIcon = config.icon;
          return (
            <div key={m.id} className="group bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5", config.bg)}>
                  <StatusIcon className={cn("h-3.5 w-3.5", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm font-medium", m.status === "completed" ? "text-gray-400 line-through" : "text-gray-900")}>{m.title}</p>
                    <select
                      value={m.status}
                      onChange={(e) => handleStatusChange(m.id, e.target.value)}
                      className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full border-0 cursor-pointer", config.bg, config.color)}
                    >
                      <option value="planned">Planned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="at_risk">At Risk</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                    {m.target_date && (
                      <span className="flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />Target: {m.target_date}</span>
                    )}
                    {m.completed_date && (
                      <span className="flex items-center gap-0.5"><Check className="h-2.5 w-2.5 text-green-500" />Completed: {m.completed_date}</span>
                    )}
                  </div>
                  {m.description && <p className="text-xs text-gray-500 mt-1">{m.description}</p>}
                  {m.evidence_notes && <p className="text-xs text-gray-400 mt-1 italic">{m.evidence_notes}</p>}
                </div>
                {isCKInternal && (
                  <button
                    onClick={() => deleteSuccessMilestone(m.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {adding && (
          <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
            <input
              autoFocus
              value={newForm.title}
              onChange={(e) => setNewForm({ ...newForm, title: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
              placeholder="Milestone title..."
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md"
            />
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={newForm.target_date}
                onChange={(e) => setNewForm({ ...newForm, target_date: e.target.value })}
                className="px-2.5 py-1 text-xs border border-gray-200 rounded-md"
              />
              <div className="flex-1" />
              <button onClick={() => setAdding(false)} className="px-2 py-1 text-xs text-gray-500">Cancel</button>
              <button onClick={handleAdd} disabled={!newForm.title.trim()} className="px-2 py-1 text-xs font-medium text-white bg-gray-900 rounded-md disabled:opacity-50">Add</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
