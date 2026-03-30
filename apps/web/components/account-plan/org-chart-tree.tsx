"use client";

import { useMemo } from "react";
import { OrgChartNode, type Stakeholder } from "./org-chart-node";

interface OrgChartTreeProps {
  stakeholders: Stakeholder[];
  isCKInternal: boolean;
  onEdit: (stakeholder: Stakeholder) => void;
  onAddReport: (parentId: string) => void;
}

interface TreeNode extends Stakeholder {
  children: TreeNode[];
}

function buildTree(stakeholders: Stakeholder[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // Create tree nodes
  stakeholders.forEach((s) => map.set(s.id, { ...s, children: [] }));

  // Build hierarchy
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

function TreeBranch({ node, isCKInternal, onEdit, onAddReport }: { node: TreeNode; isCKInternal: boolean; onEdit: (s: Stakeholder) => void; onAddReport: (id: string) => void }) {
  return (
    <div className="flex flex-col items-center">
      <OrgChartNode
        stakeholder={node}
        isCKInternal={isCKInternal}
        onEdit={() => onEdit(node)}
        onAddReport={() => onAddReport(node.id)}
      />
      {node.children.length > 0 && (
        <>
          {/* Vertical connector line */}
          <div className="w-px h-5 bg-gray-200" />
          {/* Horizontal connector + children */}
          <div className="relative flex items-start gap-6">
            {node.children.length > 1 && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-gray-200" style={{ width: `calc(100% - 140px)` }} />
            )}
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {node.children.length > 1 && <div className="w-px h-5 bg-gray-200" />}
                <TreeBranch node={child} isCKInternal={isCKInternal} onEdit={onEdit} onAddReport={onAddReport} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgChartTree({ stakeholders, isCKInternal, onEdit, onAddReport }: OrgChartTreeProps) {
  const tree = useMemo(() => buildTree(stakeholders), [stakeholders]);

  if (stakeholders.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No stakeholders yet. Add your first contact to build the org chart.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto p-6">
      <div className="inline-flex flex-col items-center min-w-full">
        {tree.map((root) => (
          <TreeBranch key={root.id} node={root} isCKInternal={isCKInternal} onEdit={onEdit} onAddReport={onAddReport} />
        ))}
      </div>
    </div>
  );
}
