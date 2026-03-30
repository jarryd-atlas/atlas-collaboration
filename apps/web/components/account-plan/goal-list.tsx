"use client";

import { useState, useCallback } from "react";
import { createGoal, toggleGoalAchieved, updateGoal, deleteGoal } from "../../lib/actions/account-plan";
import { cn } from "../../lib/utils";
import { Check, Plus, Pencil, Trash2, X } from "lucide-react";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  is_achieved: boolean;
}

interface GoalListProps {
  goals: Goal[];
  accountPlanId: string;
  tenantId: string;
  isCKInternal: boolean;
  profileId?: string;
}

export function GoalList({ goals, accountPlanId, tenantId, isCKInternal, profileId }: GoalListProps) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleAdd = useCallback(async () => {
    if (!newTitle.trim()) return;
    await createGoal(accountPlanId, tenantId, { title: newTitle.trim() }, profileId);
    setNewTitle("");
    setAdding(false);
  }, [newTitle, accountPlanId, tenantId, profileId]);

  const handleToggle = useCallback(async (goalId: string, current: boolean) => {
    await toggleGoalAchieved(goalId, !current);
  }, []);

  const handleSaveEdit = useCallback(async (goalId: string) => {
    if (!editTitle.trim()) return;
    await updateGoal(goalId, { title: editTitle.trim() });
    setEditingId(null);
  }, [editTitle]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Shared Goals</h3>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {goals.length === 0 && !adding && (
        <p className="text-xs text-gray-400 py-3">No goals defined yet. What does success look like?</p>
      )}

      <div className="space-y-1">
        {goals.map((goal) => (
          <div key={goal.id} className="group flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50">
            <button
              onClick={() => handleToggle(goal.id, goal.is_achieved)}
              className={cn(
                "mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                goal.is_achieved ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-gray-400"
              )}
            >
              {goal.is_achieved && <Check className="h-2.5 w-2.5" />}
            </button>

            {editingId === goal.id ? (
              <div className="flex-1 flex items-center gap-1">
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(goal.id); if (e.key === "Escape") setEditingId(null); }}
                  className="flex-1 px-2 py-0.5 text-sm border border-gray-200 rounded"
                />
                <button onClick={() => handleSaveEdit(goal.id)} className="p-0.5 text-green-600"><Check className="h-3 w-3" /></button>
                <button onClick={() => setEditingId(null)} className="p-0.5 text-gray-400"><X className="h-3 w-3" /></button>
              </div>
            ) : (
              <>
                <span className={cn("flex-1 text-sm", goal.is_achieved && "line-through text-gray-400")}>{goal.title}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button onClick={() => { setEditingId(goal.id); setEditTitle(goal.title); }} className="p-0.5 text-gray-400 hover:text-gray-600"><Pencil className="h-3 w-3" /></button>
                  {isCKInternal && (
                    <button onClick={() => deleteGoal(goal.id)} className="p-0.5 text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}

        {adding && (
          <div className="flex items-center gap-2 py-1 px-2">
            <div className="w-4 h-4 rounded border border-gray-200 shrink-0" />
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAdding(false); }}
              placeholder="What does success look like?"
              className="flex-1 px-2 py-0.5 text-sm border border-gray-200 rounded"
            />
            <button onClick={handleAdd} disabled={!newTitle.trim()} className="p-0.5 text-green-600 disabled:text-gray-300"><Check className="h-3 w-3" /></button>
            <button onClick={() => { setAdding(false); setNewTitle(""); }} className="p-0.5 text-gray-400"><X className="h-3 w-3" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
