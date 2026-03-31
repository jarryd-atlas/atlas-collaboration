"use client";

import { Activity, Target, CheckCircle, AlertTriangle, Users, MapPin } from "lucide-react";
import { cn } from "../../lib/utils";

interface AccountHealthScorecardProps {
  sites: { pipeline_stage: string }[];
  goals: { is_achieved: boolean }[];
  milestones: { status: string }[];
  stakeholders: { stakeholder_role: string | null }[];
  issues: { status: string }[];
  totalAddressable: number | null;
}

export function AccountHealthScorecard({
  sites,
  goals,
  milestones,
  stakeholders,
  issues,
  totalAddressable,
}: AccountHealthScorecardProps) {
  const activeSites = sites.filter((s) => s.pipeline_stage === "active").length;
  const pipelineSites = sites.filter(
    (s) => ["prospect", "evaluation", "qualified", "deployment"].includes(s.pipeline_stage)
  ).length;
  const goalsAchieved = goals.filter((g) => g.is_achieved).length;
  const milestonesCompleted = milestones.filter((m) => m.status === "completed").length;
  const openIssues = issues.filter((i) => i.status === "open").length;
  const hasChampion = stakeholders.some((s) => s.stakeholder_role === "champion");
  const hasDecisionMaker = stakeholders.some((s) => s.stakeholder_role === "decision_maker");

  const addressable = totalAddressable ?? sites.length;
  const penetration = addressable > 0 ? Math.round((activeSites / addressable) * 100) : 0;

  const metrics = [
    {
      label: "Sites Won",
      value: `${activeSites}/${addressable}`,
      sub: `${penetration}% penetration`,
      icon: MapPin,
      color: activeSites > 0 ? "text-green-600" : "text-gray-400",
    },
    {
      label: "Pipeline",
      value: String(pipelineSites),
      sub: pipelineSites > 0 ? "sites in progress" : "no sites in pipeline",
      icon: Activity,
      color: pipelineSites > 0 ? "text-blue-600" : "text-gray-400",
    },
    {
      label: "Goals",
      value: `${goalsAchieved}/${goals.length}`,
      sub: goals.length > 0 ? "achieved" : "none defined",
      icon: Target,
      color: goalsAchieved === goals.length && goals.length > 0 ? "text-green-600" : "text-gray-600",
    },
    {
      label: "Milestones",
      value: `${milestonesCompleted}/${milestones.length}`,
      sub: milestones.length > 0 ? "completed" : "none defined",
      icon: CheckCircle,
      color: milestonesCompleted === milestones.length && milestones.length > 0 ? "text-green-600" : "text-gray-600",
    },
    {
      label: "Issues",
      value: String(openIssues),
      sub: openIssues > 0 ? "open" : "none",
      icon: AlertTriangle,
      color: openIssues > 0 ? "text-red-600" : "text-green-600",
    },
    {
      label: "Stakeholders",
      value: String(stakeholders.length),
      sub: hasChampion && hasDecisionMaker
        ? "Champion + DM identified"
        : hasChampion
          ? "Champion identified"
          : hasDecisionMaker
            ? "DM identified"
            : stakeholders.length > 0
              ? "No champion/DM yet"
              : "none mapped",
      icon: Users,
      color: hasChampion && hasDecisionMaker ? "text-green-600" : stakeholders.length > 0 ? "text-amber-600" : "text-gray-400",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card">
      <div className="px-4 py-2.5 border-b border-gray-50">
        <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
          Account Health
        </h4>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m, idx) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={cn(
                "px-4 py-3 text-center",
                idx < metrics.length - 1 && "border-r border-gray-50",
              )}
            >
              <Icon className={cn("h-4 w-4 mx-auto mb-1", m.color)} />
              <div className={cn("text-lg font-bold", m.color)}>{m.value}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">{m.label}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{m.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
