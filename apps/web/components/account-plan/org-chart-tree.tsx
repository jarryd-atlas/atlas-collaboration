"use client";

import { useMemo, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { OrgChartNode, type Stakeholder } from "./org-chart-node";
import { updateStakeholderParent } from "../../lib/actions";
import { Users, Maximize2, Minimize2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface OrgChartTreeProps {
  stakeholders: Stakeholder[];
  isCKInternal: boolean;
  onEdit: (stakeholder: Stakeholder) => void;
  onAddReport: (parentId: string) => void;
}

interface TreeNode extends Stakeholder {
  children: TreeNode[];
}

function buildTree(stakeholders: Stakeholder[]): { charted: TreeNode[]; uncharted: TreeNode[] } {
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

  const charted: TreeNode[] = [];
  const uncharted: TreeNode[] = [];
  for (const root of roots) {
    if (root.children.length > 0 || root.reports_to) {
      charted.push(root);
    } else {
      uncharted.push(root);
    }
  }

  return { charted, uncharted };
}

// ── Draggable + Droppable wrapper ──

function DraggableDroppableNode({
  node,
  isCKInternal,
  onEdit,
  onAddReport,
  activeId,
}: {
  node: TreeNode;
  isCKInternal: boolean;
  onEdit: (s: Stakeholder) => void;
  onAddReport: (id: string) => void;
  activeId: string | null;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id,
    data: { stakeholder: node },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${node.id}`,
    data: { targetId: node.id },
  });

  const isDropTarget = isOver && activeId !== null && activeId !== node.id;

  return (
    <div ref={(el) => { setDragRef(el); setDropRef(el); }}>
      <OrgChartNode
        stakeholder={node}
        isCKInternal={isCKInternal}
        onEdit={() => onEdit(node)}
        onAddReport={() => onAddReport(node.id)}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        isDropTarget={isDropTarget}
      />
    </div>
  );
}

function TreeBranch({
  node,
  isCKInternal,
  onEdit,
  onAddReport,
  activeId,
}: {
  node: TreeNode;
  isCKInternal: boolean;
  onEdit: (s: Stakeholder) => void;
  onAddReport: (id: string) => void;
  activeId: string | null;
}) {
  return (
    <div className="flex flex-col items-center">
      <DraggableDroppableNode
        node={node}
        isCKInternal={isCKInternal}
        onEdit={onEdit}
        onAddReport={onAddReport}
        activeId={activeId}
      />
      {node.children.length > 0 && (
        <>
          <div className="w-px h-5 bg-gray-200" />
          <div className="relative flex items-start gap-6">
            {node.children.length > 1 && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-gray-200" style={{ width: `calc(100% - 140px)` }} />
            )}
            {node.children.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {node.children.length > 1 && <div className="w-px h-5 bg-gray-200" />}
                <TreeBranch
                  node={child}
                  isCKInternal={isCKInternal}
                  onEdit={onEdit}
                  onAddReport={onAddReport}
                  activeId={activeId}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgChartTree({ stakeholders, isCKInternal, onEdit, onAddReport }: OrgChartTreeProps) {
  const router = useRouter();
  const { charted, uncharted } = useMemo(() => buildTree(stakeholders), [stakeholders]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const activeStakeholder = activeId
    ? stakeholders.find((s) => s.id === activeId) ?? null
    : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedId = active.id as string;
    const overId = (over.data.current as any)?.targetId as string | undefined;

    // Dropped on "uncharted" zone → set reports_to = null
    if (over.id === "uncharted-drop-zone") {
      const dragged = stakeholders.find((s) => s.id === draggedId);
      if (dragged && dragged.reports_to) {
        await updateStakeholderParent(draggedId, null);
        router.refresh();
      }
      return;
    }

    if (!overId || overId === draggedId) return;

    // Prevent dropping onto own descendant (would create cycle)
    const isDescendant = (parentId: string, checkId: string): boolean => {
      const children = stakeholders.filter((s) => s.reports_to === parentId);
      return children.some((c) => c.id === checkId || isDescendant(c.id, checkId));
    };
    if (isDescendant(draggedId, overId)) return;

    // Update parent
    const dragged = stakeholders.find((s) => s.id === draggedId);
    if (dragged && dragged.reports_to !== overId) {
      await updateStakeholderParent(draggedId, overId);
      router.refresh();
    }
  }, [stakeholders, router]);

  if (stakeholders.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No stakeholders yet. Add your first contact to build the org chart.
      </div>
    );
  }

  const treeContent = (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-auto p-6" style={fullscreen ? { height: "calc(100vh - 3rem)" } : undefined}>
        {/* Expand/collapse button */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            title={fullscreen ? "Exit fullscreen" : "Expand org chart"}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {fullscreen ? "Collapse" : "Expand"}
          </button>
        </div>

        {/* Charted hierarchy */}
        {charted.length > 0 && (
          <div className="inline-flex flex-col items-center min-w-full">
            {charted.map((root) => (
              <TreeBranch
                key={root.id}
                node={root}
                isCKInternal={isCKInternal}
                onEdit={onEdit}
                onAddReport={onAddReport}
                activeId={activeId}
              />
            ))}
          </div>
        )}

        {/* Uncharted contacts grid */}
        <UnchartedDropZone
          uncharted={uncharted}
          isCKInternal={isCKInternal}
          onEdit={onEdit}
          onAddReport={onAddReport}
          activeId={activeId}
          show={uncharted.length > 0 || activeId !== null}
        />
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeStakeholder && (
          <div className="opacity-90 shadow-lg rounded-lg">
            <OrgChartNode
              stakeholder={activeStakeholder}
              isCKInternal={isCKInternal}
              onEdit={() => {}}
              onAddReport={() => {}}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-auto">
        {treeContent}
      </div>
    );
  }

  return treeContent;
}

// Extracted to avoid defining component inside render
function UnchartedDropZone({
  uncharted,
  isCKInternal,
  onEdit,
  onAddReport,
  activeId,
  show,
}: {
  uncharted: TreeNode[];
  isCKInternal: boolean;
  onEdit: (s: Stakeholder) => void;
  onAddReport: (id: string) => void;
  activeId: string | null;
  show: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "uncharted-drop-zone",
    data: { targetId: null },
  });

  if (!show) return null;

  return (
    <div
      ref={setNodeRef}
      className={`mt-8 border-t border-dashed border-gray-200 pt-4 transition-colors ${isOver ? "bg-green-50 border-green-300" : ""}`}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <Users className="h-4 w-4 text-gray-400" />
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Uncharted Contacts
        </h3>
        <span className="text-[10px] text-gray-400">({uncharted.length})</span>
      </div>
      <div className="flex flex-wrap gap-4">
        {uncharted.map((node) => (
          <DraggableDroppableNode
            key={node.id}
            node={node}
            isCKInternal={isCKInternal}
            onEdit={onEdit}
            onAddReport={onAddReport}
            activeId={activeId}
          />
        ))}
        {uncharted.length === 0 && !isOver && (
          <p className="text-xs text-gray-400 italic px-1">
            Drag contacts here to remove from the hierarchy.
          </p>
        )}
      </div>
    </div>
  );
}
