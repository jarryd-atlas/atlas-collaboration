"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, ExternalLink, Lock } from "lucide-react";

interface PipelineStage {
  id: string;
  label: string;
}

interface HubSpotPipelineTrackerProps {
  dealId: string;
  siteId: string;
  portalId: string;
}

export function HubSpotPipelineTracker({ dealId, siteId, portalId }: HubSpotPipelineTrackerProps) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [currentStageId, setCurrentStageId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const fetchPipeline = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/hubspot/deals/${dealId}/pipeline`);
      if (!res.ok) throw new Error("Failed to fetch pipeline");
      const data = await res.json();
      setStages(data.stages ?? []);
      setCurrentStageId(data.currentStageId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  async function handleStageChange(stageId: string) {
    if (stageId === currentStageId || updating) return;

    setUpdating(true);
    setError("");
    const previousStageId = currentStageId;
    setCurrentStageId(stageId); // Optimistic update

    try {
      const res = await fetch(`/api/hubspot/deals/${dealId}/pipeline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId, siteId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update stage");
      }
    } catch (err) {
      setCurrentStageId(previousStageId); // Rollback
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading pipeline from HubSpot...
        </div>
      </div>
    );
  }

  if (error && stages.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  const currentIdx = stages.findIndex((s) => s.id === currentStageId);

  // Separate terminal stages (Lost, Stalled, Won) from progression stages
  const terminalLabels = ["won", "lost", "stalled"];
  const progressionStages = stages.filter(
    (s) => !terminalLabels.some((t) => s.label.toLowerCase().includes(t))
  );
  const terminalStages = stages.filter((s) =>
    terminalLabels.some((t) => s.label.toLowerCase().includes(t))
  );

  const progressionIdx = progressionStages.findIndex((s) => s.id === currentStageId);
  const isTerminal = terminalStages.some((s) => s.id === currentStageId);
  const currentLabel = stages.find((s) => s.id === currentStageId)?.label ?? "";
  const isWon = currentLabel.toLowerCase().includes("won");
  const isLocked = isWon;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Deal Stage</h2>
          <a
            href={`https://app.hubspot.com/contacts/${portalId}/deal/${dealId}`}
            target="_blank"
            rel="noopener"
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
            title="View in HubSpot"
          >
            <ExternalLink className="h-3 w-3" />
            HubSpot
          </a>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
              <Lock className="h-3 w-3" /> Won — Locked
            </span>
          )}
          {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
          <button
            onClick={fetchPipeline}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh from HubSpot"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progression stages bar */}
      <div className="flex items-center gap-1">
        {progressionStages.map((stage, i) => {
          const isCompleted = !isTerminal && i < progressionIdx;
          const isCurrent = stage.id === currentStageId;

          return (
            <button
              key={stage.id}
              onClick={() => !isLocked && handleStageChange(stage.id)}
              disabled={updating || isLocked}
              className={`flex-1 group ${isLocked ? "cursor-not-allowed" : "cursor-pointer"} disabled:cursor-not-allowed`}
              title={isLocked ? "Deal is won — stage is locked" : `Set to: ${stage.label}`}
            >
              <div
                className={`h-2 rounded-full transition-colors ${
                  isCompleted
                    ? "bg-brand-green group-hover:bg-brand-green/80"
                    : isCurrent
                      ? "bg-brand-green/50 group-hover:bg-brand-green/40"
                      : "bg-gray-100 group-hover:bg-gray-200"
                }`}
              />
              <p
                className={`text-[10px] mt-1.5 truncate ${
                  isCurrent ? "text-gray-900 font-medium" : "text-gray-400 group-hover:text-gray-600"
                }`}
              >
                {stage.label.replace(/^\d+\s*-\s*/, "")}
              </p>
            </button>
          );
        })}
      </div>

      {/* Terminal stages (Won, Lost, Stalled) as pills below */}
      {terminalStages.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
          {terminalStages.map((stage) => {
            const isCurrent = stage.id === currentStageId;
            const isWon = stage.label.toLowerCase().includes("won");
            const isLost = stage.label.toLowerCase().includes("lost");

            let colors = "border-gray-200 text-gray-500 hover:border-gray-300";
            if (isCurrent && isWon) colors = "border-green-300 bg-green-50 text-green-700";
            else if (isCurrent && isLost) colors = "border-red-300 bg-red-50 text-red-700";
            else if (isCurrent) colors = "border-amber-300 bg-amber-50 text-amber-700";

            return (
              <button
                key={stage.id}
                onClick={() => !isLocked && handleStageChange(stage.id)}
                disabled={updating || isLocked}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${isLocked ? "disabled:cursor-not-allowed disabled:opacity-60" : "disabled:cursor-wait"} ${colors}`}
              >
                {stage.label.replace(/^\d+\s*-\s*/, "")}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 mt-2">{error}</p>
      )}
    </div>
  );
}
