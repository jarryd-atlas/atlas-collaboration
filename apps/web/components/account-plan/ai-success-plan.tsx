"use client";

import { useState } from "react";
import { createGoal, createSuccessMilestone } from "../../lib/actions/account-plan";
import { Sparkles, Loader2 } from "lucide-react";

interface AISuccessPlanProps {
  customerName: string;
  accountStage: string;
  accountPlanId: string;
  tenantId: string;
  profileId?: string;
  siteCount: number;
  industryVertical?: string | null;
  companyPriorities?: string | null;
  keyInitiatives?: string | null;
  existingGoalCount: number;
  existingMilestoneCount: number;
  isCKInternal: boolean;
}

export function AISuccessPlan({
  customerName,
  accountStage,
  accountPlanId,
  tenantId,
  profileId,
  siteCount,
  industryVertical,
  companyPriorities,
  keyInitiatives,
  existingGoalCount,
  existingMilestoneCount,
  isCKInternal,
}: AISuccessPlanProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!isCKInternal || !accountPlanId) return null;
  if (generated) return null;

  const hasExisting = existingGoalCount > 0 || existingMilestoneCount > 0;

  async function handleGenerate() {
    if (hasExisting && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setLoading(true);
    setError(null);
    setShowConfirm(false);

    try {
      const res = await fetch("/api/ai/generate-success-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          accountStage,
          industryVertical,
          companyPriorities,
          keyInitiatives,
          siteCount,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error: ${res.status}`);
      }

      const { goals, milestones } = await res.json();

      // Create goals
      for (const goal of goals) {
        await createGoal(accountPlanId, tenantId, {
          title: goal.title,
          description: goal.description,
        }, profileId);
      }

      // Create milestones
      for (const milestone of milestones) {
        await createSuccessMilestone(accountPlanId, tenantId, {
          title: milestone.title,
          description: milestone.description,
          target_date: milestone.target_date,
          status: milestone.status,
        }, profileId);
      }

      setGenerated(true);
    } catch (err: any) {
      setError(err.message || "Failed to generate success plan");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 rounded-lg border border-purple-100">
        <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
        <span className="text-sm text-purple-700">
          Generating success plan for {customerName}...
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors border border-purple-100"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {hasExisting ? "Add AI-Suggested Goals" : "Generate Success Plan"}
      </button>

      {showConfirm && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">
            This will add AI goals & milestones alongside existing ones. Continue?
          </span>
          <button
            onClick={handleGenerate}
            className="px-2 py-0.5 text-purple-700 bg-purple-100 rounded hover:bg-purple-200"
          >
            Yes
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="px-2 py-0.5 text-gray-500 bg-gray-100 rounded hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      )}

      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
