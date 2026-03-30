"use client";

import { cn } from "../../lib/utils";
import { Plus, Pencil, User } from "lucide-react";

export interface Stakeholder {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  stakeholder_role: string | null;
  relationship_strength: string | null;
  strategy_notes: string | null;
  notes: string | null;
  reports_to: string | null;
  is_ai_suggested: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  champion: "bg-green-100 text-green-700",
  decision_maker: "bg-purple-100 text-purple-700",
  influencer: "bg-blue-100 text-blue-700",
  blocker: "bg-red-100 text-red-700",
  user: "bg-gray-100 text-gray-600",
  economic_buyer: "bg-amber-100 text-amber-700",
};

const ROLE_LABELS: Record<string, string> = {
  champion: "Champion",
  decision_maker: "Decision Maker",
  influencer: "Influencer",
  blocker: "Blocker",
  user: "User",
  economic_buyer: "Econ. Buyer",
};

const STRENGTH_COLORS: Record<string, string> = {
  strong: "bg-green-500",
  good: "bg-green-300",
  developing: "bg-amber-400",
  weak: "bg-red-400",
  unknown: "bg-gray-300",
};

interface OrgChartNodeProps {
  stakeholder: Stakeholder;
  isCKInternal: boolean;
  onEdit: () => void;
  onAddReport: () => void;
}

export function OrgChartNode({ stakeholder, isCKInternal, onEdit, onAddReport }: OrgChartNodeProps) {
  return (
    <div className="group relative w-[180px]">
      <div
        onClick={onEdit}
        className={cn(
          "bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-all cursor-pointer",
          stakeholder.is_ai_suggested && "border-dashed border-blue-300 bg-blue-50/30"
        )}
      >
        {/* Avatar placeholder + name */}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <User className="h-3.5 w-3.5 text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{stakeholder.name}</p>
            {stakeholder.title && (
              <p className="text-[10px] text-gray-400 truncate">{stakeholder.title}</p>
            )}
          </div>
        </div>

        {/* Department */}
        {stakeholder.department && (
          <p className="text-[10px] text-gray-400 mt-1">{stakeholder.department}</p>
        )}

        {/* Internal-only badges */}
        {isCKInternal && (
          <div className="flex items-center gap-1 mt-1.5">
            {stakeholder.stakeholder_role && (
              <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full", ROLE_COLORS[stakeholder.stakeholder_role] ?? "bg-gray-100 text-gray-500")}>
                {ROLE_LABELS[stakeholder.stakeholder_role] ?? stakeholder.stakeholder_role}
              </span>
            )}
            {stakeholder.relationship_strength && (
              <span className={cn("w-2 h-2 rounded-full shrink-0", STRENGTH_COLORS[stakeholder.relationship_strength] ?? "bg-gray-300")} title={`Relationship: ${stakeholder.relationship_strength}`} />
            )}
          </div>
        )}

        {/* AI suggested indicator */}
        {stakeholder.is_ai_suggested && (
          <p className="text-[9px] text-blue-500 mt-1 italic">AI suggested</p>
        )}
      </div>

      {/* Add report button */}
      {isCKInternal && (
        <button
          onClick={(e) => { e.stopPropagation(); onAddReport(); }}
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full bg-brand-green text-white flex items-center justify-center shadow-sm hover:shadow-md"
          title="Add direct report"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
