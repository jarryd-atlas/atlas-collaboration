"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { ChevronDown, User } from "lucide-react";
import {
  SECTION_STATUSES,
  SECTION_STATUS_LABELS,
  SECTION_STATUS_COLORS,
} from "@repo/shared";
import type { SectionStatus, DiscoverySection } from "@repo/shared";
import { updateSectionStatus, assignSection } from "../../lib/actions/discovery";

interface Assignee {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface AssignableUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  group?: string;
}

interface SectionStatusBadgeProps {
  sectionKey: DiscoverySection;
  status: SectionStatus;
  assignee?: Assignee | null;
  assessmentId: string;
  assignableUsers: AssignableUser[];
  isInternal: boolean;
}

export function SectionStatusBadge({
  sectionKey,
  status,
  assignee,
  assessmentId,
  assignableUsers,
  isInternal,
}: SectionStatusBadgeProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false);
  const [isPending, startTransition] = useTransition();
  const statusRef = useRef<HTMLDivElement>(null);
  const assigneeRef = useRef<HTMLDivElement>(null);

  const colors = SECTION_STATUS_COLORS[status];

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
      if (assigneeRef.current && !assigneeRef.current.contains(e.target as Node)) {
        setShowAssigneeMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleStatusChange(newStatus: SectionStatus) {
    setShowStatusMenu(false);
    if (newStatus === status) return;
    startTransition(async () => {
      await updateSectionStatus(assessmentId, sectionKey, newStatus);
    });
  }

  function handleAssigneeChange(userId: string | null) {
    setShowAssigneeMenu(false);
    startTransition(async () => {
      await assignSection(assessmentId, sectionKey, userId);
    });
  }

  // Read-only badge for customer users
  if (!isInternal) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
        {SECTION_STATUS_LABELS[status]}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {/* Status dropdown */}
      <div className="relative" ref={statusRef}>
        <button
          type="button"
          onClick={() => {
            setShowStatusMenu(!showStatusMenu);
            setShowAssigneeMenu(false);
          }}
          disabled={isPending}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors hover:ring-1 hover:ring-gray-300 ${colors.bg} ${colors.text} ${isPending ? "opacity-50" : ""}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
          {SECTION_STATUS_LABELS[status]}
          <ChevronDown className="h-3 w-3" />
        </button>

        {showStatusMenu && (
          <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            {SECTION_STATUSES.map((s) => {
              const c = SECTION_STATUS_COLORS[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 text-left ${
                    s === status ? "font-medium" : ""
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                  <span className="text-gray-700">{SECTION_STATUS_LABELS[s]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Assignee button */}
      <div className="relative" ref={assigneeRef}>
        <button
          type="button"
          onClick={() => {
            setShowAssigneeMenu(!showAssigneeMenu);
            setShowStatusMenu(false);
          }}
          disabled={isPending}
          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 transition-colors ${isPending ? "opacity-50" : ""}`}
          title={assignee?.full_name ?? "Assign someone"}
        >
          {assignee?.avatar_url ? (
            <img
              src={assignee.avatar_url}
              alt={assignee.full_name ?? ""}
              className="h-4 w-4 rounded-full"
            />
          ) : assignee?.full_name ? (
            <span className="h-4 w-4 rounded-full bg-brand-green/20 text-[10px] font-medium text-brand-green flex items-center justify-center">
              {assignee.full_name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <User className="h-3.5 w-3.5 text-gray-400" />
          )}
          {assignee?.full_name && (
            <span className="text-gray-600 max-w-[80px] truncate">{assignee.full_name.split(" ")[0]}</span>
          )}
        </button>

        {showAssigneeMenu && (
          <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => handleAssigneeChange(null)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 text-left text-gray-400"
            >
              Unassign
            </button>
            {assignableUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleAssigneeChange(u.id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 text-left ${
                  u.id === assignee?.id ? "font-medium bg-gray-50" : ""
                }`}
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-4 w-4 rounded-full" />
                ) : (
                  <span className="h-4 w-4 rounded-full bg-gray-200 text-[10px] font-medium text-gray-600 flex items-center justify-center">
                    {u.full_name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="text-gray-700 truncate">{u.full_name}</span>
                {u.group && (
                  <span className="text-gray-400 text-[10px] ml-auto">{u.group}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
