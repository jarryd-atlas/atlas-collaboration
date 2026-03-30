"use client";

import { useState } from "react";
import { updateAccountStage } from "../../lib/actions/account-plan";
import { cn } from "../../lib/utils";
import { Rocket, TrendingUp, Building2, Check } from "lucide-react";

const STAGES = [
  { key: "pilot", label: "Pilot", icon: Rocket, description: "Landing initial sites" },
  { key: "expanding", label: "Expanding", icon: TrendingUp, description: "Growing beyond pilot" },
  { key: "enterprise", label: "Enterprise", icon: Building2, description: "Portfolio-wide deal" },
];

interface AccountStageTrackerProps {
  customerId: string;
  currentStage: string;
}

export function AccountStageTracker({ customerId, currentStage }: AccountStageTrackerProps) {
  const [stage, setStage] = useState(currentStage);
  const [updating, setUpdating] = useState(false);

  const currentIdx = STAGES.findIndex((s) => s.key === stage);

  async function handleStageClick(stageKey: string) {
    if (updating || stageKey === stage) return;
    setUpdating(true);
    setStage(stageKey);
    const result = await updateAccountStage(customerId, stageKey);
    if (result.error) setStage(currentStage); // revert
    setUpdating(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-card">
      <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-4">Account Stage</h3>
      <div className="flex items-center gap-3">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture = i > currentIdx;

          return (
            <button
              key={s.key}
              onClick={() => handleStageClick(s.key)}
              disabled={updating}
              className={cn(
                "flex-1 relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer",
                isCurrent && "border-brand-green bg-green-50/50 shadow-sm",
                isCompleted && "border-green-200 bg-green-50/30",
                isFuture && "border-gray-100 bg-gray-50/50 hover:border-gray-200",
                updating && "opacity-60 pointer-events-none"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                isCurrent && "bg-brand-green text-white",
                isCompleted && "bg-green-100 text-green-600",
                isFuture && "bg-gray-100 text-gray-400"
              )}>
                {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="text-center">
                <p className={cn(
                  "text-sm font-semibold",
                  isCurrent && "text-gray-900",
                  isCompleted && "text-green-700",
                  isFuture && "text-gray-400"
                )}>
                  {s.label}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
