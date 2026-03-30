"use client";

import { useState, useMemo } from "react";
import { cn } from "../../lib/utils";
import { ChevronRight, ChevronDown, User, Plus, Pencil } from "lucide-react";
import type { Stakeholder } from "./org-chart-node";

interface TreeNode extends Stakeholder {
  children: TreeNode[];
}

function buildTree(stakeholders: Stakeholder[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  stakeholders.forEach((s) => map.set(s.id, { ...s, children: [] }));
  stakeholders.forEach((s) => {
    const node = map.get(s.id)!;
    if (s.reports_to && map.has(s.reports_to)) {
      map.get(s.reports_to)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
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

const STRENGTH_DOTS: Record<string, string> = {
  strong: "bg-green-500",
  good: "bg-green-300",
  developing: "bg-amber-400",
  weak: "bg-red-400",
  unknown: "bg-gray-300",
};

interface ListNodeProps {
  node: TreeNode;
  depth: number;
  isCKInternal: boolean;
  onEdit: (s: Stakeholder) => void;
  onAddReport: (parentId: string) => void;
}

function ListNode({ node, depth, isCKInternal, onEdit, onAddReport }: ListNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 py-1.5 px-2 hover:bg-gray-50 rounded-md cursor-pointer"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onEdit(node)}
      >
        {/* Expand/collapse toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className={cn("w-4 h-4 flex items-center justify-center shrink-0", !hasChildren && "invisible")}
        >
          {expanded ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
        </button>

        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
          <User className="h-3 w-3 text-gray-400" />
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">{node.name}</span>
          {node.title && <span className="text-xs text-gray-400 truncate hidden sm:inline">{node.title}</span>}
        </div>

        {isCKInternal && (
          <div className="flex items-center gap-1.5 shrink-0">
            {node.stakeholder_role && (
              <span className={cn("text-[9px] font-medium px-1.5 py-0.5 rounded-full", ROLE_COLORS[node.stakeholder_role] ?? "bg-gray-100 text-gray-500")}>
                {ROLE_LABELS[node.stakeholder_role] ?? node.stakeholder_role}
              </span>
            )}
            {node.relationship_strength && (
              <span className={cn("w-2 h-2 rounded-full", STRENGTH_DOTS[node.relationship_strength] ?? "bg-gray-300")} />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onAddReport(node.id); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 text-gray-400"
              title="Add report"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <ListNode key={child.id} node={child} depth={depth + 1} isCKInternal={isCKInternal} onEdit={onEdit} onAddReport={onAddReport} />
          ))}
        </div>
      )}
    </div>
  );
}

interface OrgChartListProps {
  stakeholders: Stakeholder[];
  isCKInternal: boolean;
  onEdit: (stakeholder: Stakeholder) => void;
  onAddReport: (parentId: string) => void;
}

export function OrgChartList({ stakeholders, isCKInternal, onEdit, onAddReport }: OrgChartListProps) {
  const tree = useMemo(() => buildTree(stakeholders), [stakeholders]);

  if (stakeholders.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-gray-400">
        No stakeholders yet.
      </div>
    );
  }

  return (
    <div className="py-2">
      {tree.map((root) => (
        <ListNode key={root.id} node={root} depth={0} isCKInternal={isCKInternal} onEdit={onEdit} onAddReport={onAddReport} />
      ))}
    </div>
  );
}
