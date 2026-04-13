"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Pencil, Trash2, Link2, Unlink } from "lucide-react";
import { RockStatusBadge, type RockStatus } from "./rock-status-badge";
import { updateRock, deleteRock } from "../../lib/actions/rocks";
import type { RockRow } from "../../lib/data/rock-queries";
import { cn } from "../../lib/utils";

const LEVEL_COLORS: Record<string, string> = {
  company: "bg-purple-50 text-purple-700",
  department: "bg-blue-50 text-blue-700",
  team: "bg-amber-50 text-amber-700",
  individual: "bg-gray-50 text-gray-600",
};

interface RockCardProps {
  rock: RockRow;
  children_rocks: RockRow[];
  parentRock?: RockRow | null;
  onEdit: (rock: RockRow) => void;
  onLink: (rock: RockRow) => void;
}

export function RockCard({ rock, children_rocks, parentRock, onEdit, onLink }: RockCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const hasChildren = children_rocks.length > 0;
  const hasDetails = !!rock.description || hasChildren || !!parentRock;

  const handleStatusChange = (newStatus: string) => {
    startTransition(async () => {
      await updateRock(rock.id, { status: newStatus });
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete "${rock.title}"?`)) return;
    startTransition(async () => {
      await deleteRock(rock.id);
    });
  };

  const completedChildren = children_rocks.filter((c) => c.status === "complete").length;

  return (
    <div
      className={cn(
        "border border-gray-100 rounded-lg bg-white transition-colors",
        isPending && "opacity-50",
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Expand toggle */}
        <button
          onClick={() => hasDetails && setExpanded(!expanded)}
          className={cn(
            "p-0.5 rounded text-gray-400 transition-colors shrink-0",
            hasDetails ? "hover:bg-gray-100 hover:text-gray-600" : "invisible",
          )}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Status badge with inline dropdown */}
        <div className="relative shrink-0">
          <select
            value={rock.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            title="Change status"
          >
            <option value="on_track">On Track</option>
            <option value="off_track">Off Track</option>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
          </select>
          <RockStatusBadge status={rock.status} className="cursor-pointer" />
        </div>

        {/* Title */}
        <p
          className={cn(
            "flex-1 text-sm font-medium text-gray-900 truncate",
            rock.status === "complete" && "line-through text-gray-400",
          )}
        >
          {rock.title}
        </p>

        {/* Children progress */}
        {hasChildren && (
          <span className="text-[11px] text-gray-400 shrink-0">
            {completedChildren}/{children_rocks.length} sub-rocks
          </span>
        )}

        {/* Collaborator + Owner avatars */}
        <div className="flex items-center shrink-0">
          {/* Stacked collaborator avatars */}
          {rock.collaborators && rock.collaborators.length > 0 && (
            <div className="flex -space-x-1.5 mr-1.5">
              {rock.collaborators.slice(0, 3).map((c) => (
                c.avatar_url ? (
                  <img
                    key={c.id}
                    src={c.avatar_url}
                    alt={c.full_name}
                    title={c.full_name}
                    className="h-5 w-5 rounded-full ring-1 ring-white"
                  />
                ) : (
                  <div
                    key={c.id}
                    title={c.full_name}
                    className="h-5 w-5 rounded-full bg-gray-100 ring-1 ring-white flex items-center justify-center text-[9px] font-medium text-gray-500"
                  >
                    {c.full_name?.[0] ?? "?"}
                  </div>
                )
              ))}
              {rock.collaborators.length > 3 && (
                <div className="h-5 w-5 rounded-full bg-gray-100 ring-1 ring-white flex items-center justify-center text-[8px] font-medium text-gray-500">
                  +{rock.collaborators.length - 3}
                </div>
              )}
            </div>
          )}
          {/* Owner */}
          {rock.owner && (
            <div className="flex items-center gap-1.5">
              {rock.owner.avatar_url ? (
                <img
                  src={rock.owner.avatar_url}
                  alt=""
                  className="h-5 w-5 rounded-full"
                />
              ) : (
                <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center text-[9px] font-medium text-gray-600">
                  {rock.owner.full_name?.[0] ?? "?"}
                </div>
              )}
              <span className="text-xs text-gray-500 hidden sm:inline">
                {rock.owner.full_name?.split(" ")[0]}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onEdit(rock)}
            className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {rock.level !== "company" && (
            <button
              onClick={() => onLink(rock)}
              className="p-1 rounded hover:bg-gray-100 text-gray-300 hover:text-gray-600"
              title={rock.parent_rock_id ? "Change parent" : "Link to parent"}
            >
              {rock.parent_rock_id ? (
                <Unlink className="h-3.5 w-3.5" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 pt-0 ml-9 space-y-2 border-t border-gray-50">
          {/* Description */}
          {rock.description && (
            <p className="text-xs text-gray-500 leading-relaxed mt-2">{rock.description}</p>
          )}

          {/* Parent link */}
          {parentRock && (
            <div className="text-xs text-gray-400 mt-1">
              Rolls up to:{" "}
              <span className="font-medium text-gray-600">{parentRock.title}</span>
              <span className={cn("ml-1.5 inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-medium", LEVEL_COLORS[parentRock.level])}>
                {parentRock.level}
              </span>
            </div>
          )}

          {/* Child rocks */}
          {hasChildren && (
            <div className="space-y-1 mt-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                Sub-Rocks ({children_rocks.length})
              </p>
              {children_rocks.map((child) => (
                <div key={child.id} className="flex items-center gap-2 py-1">
                  <RockStatusBadge status={child.status} />
                  <span
                    className={cn(
                      "text-xs text-gray-700",
                      child.status === "complete" && "line-through text-gray-400",
                    )}
                  >
                    {child.title}
                  </span>
                  {child.owner && (
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {child.owner.full_name?.split(" ")[0]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 text-[10px] text-gray-300 mt-2">
            {rock.team_name && <span>Team: {rock.team_name}</span>}
            {rock.department_name && <span>Dept: {rock.department_name}</span>}
            {rock.completed_at && (
              <span>
                Completed {new Date(rock.completed_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
