"use client";

import { useState, useMemo } from "react";
import { PriorityBadge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { InlineTaskInput, type AssignableUser, type AssignableSite } from "./inline-task-input";
import { TaskStatusDropdown } from "./task-status-dropdown";
import { InlineEditableTitle } from "./inline-editable-title";
import { TaskDetailPanel } from "./task-detail-panel";
import { Calendar, ListTodo, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee?: { id: string; full_name: string; avatar_url?: string | null } | null;
  latestComment?: { body: string; authorName: string; createdAt: string } | null;
  site?: { id: string; name: string; slug: string } | null;
  milestone?: { id: string; name: string; slug: string } | null;
}

interface CustomerTasksSectionProps {
  tasks: Task[];
  customerId: string;
  tenantId: string;
  assignableUsers: AssignableUser[];
  assignableSites?: AssignableSite[];
  currentUserName: string;
  currentUserAvatar?: string | null;
}

type FilterType = "all" | "site" | "status";

export function CustomerTasksSection({
  tasks,
  customerId,
  tenantId,
  assignableUsers,
  assignableSites = [],
  currentUserName,
  currentUserAvatar,
}: CustomerTasksSectionProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeSiteFilter, setActiveSiteFilter] = useState<string | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);

  const openTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  // Build unique site list from tasks for filter chips
  const taskSites = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      if (t.site) {
        map.set(t.site.id, t.site.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  // Count tasks without a site (company-level)
  const companyLevelCount = openTasks.filter((t) => !t.site).length;

  // Status counts for chips
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of openTasks) {
      counts[t.status] = (counts[t.status] || 0) + 1;
    }
    return counts;
  }, [openTasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = openTasks;
    if (activeSiteFilter === "__company__") {
      result = result.filter((t) => !t.site);
    } else if (activeSiteFilter) {
      result = result.filter((t) => t.site?.id === activeSiteFilter);
    }
    if (activeStatusFilter) {
      result = result.filter((t) => t.status === activeStatusFilter);
    }
    return result;
  }, [openTasks, activeSiteFilter, activeStatusFilter]);

  const hasFilters = activeSiteFilter || activeStatusFilter;

  const statusLabels: Record<string, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    in_review: "In Review",
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ListTodo className="h-4 w-4 text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
        {tasks.length > 0 && (
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
            {openTasks.length} open
          </span>
        )}
      </div>

      {/* Inline task creation */}
      <InlineTaskInput
        customerId={customerId}
        tenantId={tenantId}
        assignableUsers={assignableUsers}
        assignableSites={assignableSites}
        placeholder="Add a task and press Enter... Use @ to assign"
      />

      {/* Filter chips */}
      {openTasks.length > 0 && (taskSites.length > 0 || Object.keys(statusCounts).length > 1) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* "All" chip */}
          <FilterChip
            label="All"
            count={openTasks.length}
            active={!hasFilters}
            onClick={() => {
              setActiveSiteFilter(null);
              setActiveStatusFilter(null);
            }}
          />

          {/* Divider */}
          {taskSites.length > 0 && (
            <div className="w-px h-4 bg-gray-200 mx-0.5" />
          )}

          {/* Company-level chip */}
          {companyLevelCount > 0 && (
            <FilterChip
              label="Company"
              count={companyLevelCount}
              active={activeSiteFilter === "__company__"}
              onClick={() => setActiveSiteFilter(activeSiteFilter === "__company__" ? null : "__company__")}
              color="gray"
            />
          )}

          {/* Site chips */}
          {taskSites.map((site) => {
            const count = openTasks.filter((t) => t.site?.id === site.id).length;
            return (
              <FilterChip
                key={site.id}
                label={site.name}
                count={count}
                active={activeSiteFilter === site.id}
                onClick={() => setActiveSiteFilter(activeSiteFilter === site.id ? null : site.id)}
                color="emerald"
              />
            );
          })}

          {/* Status divider */}
          {Object.keys(statusCounts).length > 1 && (
            <div className="w-px h-4 bg-gray-200 mx-0.5" />
          )}

          {/* Status chips */}
          {Object.entries(statusCounts).map(([status, count]) => (
            <FilterChip
              key={status}
              label={statusLabels[status] ?? status}
              count={count}
              active={activeStatusFilter === status}
              onClick={() => setActiveStatusFilter(activeStatusFilter === status ? null : status)}
              color="blue"
            />
          ))}

          {/* Clear filters */}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setActiveSiteFilter(null);
                setActiveStatusFilter(null);
              }}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5 ml-1"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Task list */}
      {filteredTasks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card divide-y divide-gray-50">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              className="px-4 sm:px-6 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setSelectedTask(task)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <TaskStatusDropdown taskId={task.id} currentStatus={task.status} />
                  <div className="min-w-0 flex-1">
                    <InlineEditableTitle taskId={task.id} initialTitle={task.title} />
                    {/* Site / Milestone context */}
                    {(task.site || task.milestone) && (
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                        {task.site?.name}
                        {task.site && task.milestone && " \u2192 "}
                        {task.milestone?.name}
                      </p>
                    )}
                    {!task.site && !task.milestone && (
                      <p className="text-[11px] text-gray-300 mt-0.5">Company task</p>
                    )}
                    {task.latestComment && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        <span className="font-medium">{task.latestComment.authorName}:</span>{" "}
                        {task.latestComment.body}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <PriorityBadge priority={task.priority} />
                  {task.due_date && (
                    <span className="text-xs text-gray-400 items-center gap-1 hidden sm:flex">
                      <Calendar className="h-3 w-3" /> {task.due_date}
                    </span>
                  )}
                  {task.assignee?.full_name && (
                    <Avatar name={task.assignee.full_name} src={task.assignee.avatar_url} size="sm" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty filtered state */}
      {filteredTasks.length === 0 && openTasks.length > 0 && hasFilters && (
        <p className="text-xs text-gray-400 pl-1">
          No tasks match the current filter.{" "}
          <button
            type="button"
            onClick={() => {
              setActiveSiteFilter(null);
              setActiveStatusFilter(null);
            }}
            className="text-gray-500 underline"
          >
            Clear filters
          </button>
        </p>
      )}

      {/* Done tasks (collapsed count) */}
      {doneTasks.length > 0 && (
        <p className="text-xs text-gray-400 pl-1">
          {doneTasks.length} completed task{doneTasks.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Empty state */}
      {tasks.length === 0 && (
        <p className="text-xs text-gray-400 pl-1">
          No tasks yet. Type above to create one.
        </p>
      )}

      {/* Task detail side panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        tenantId={tenantId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
      />
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  color = "gray",
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color?: "gray" | "emerald" | "blue";
}) {
  const colorClasses = {
    gray: active
      ? "bg-gray-900 text-white"
      : "bg-gray-100 text-gray-600 hover:bg-gray-200",
    emerald: active
      ? "bg-emerald-600 text-white"
      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    blue: active
      ? "bg-blue-600 text-white"
      : "bg-blue-50 text-blue-700 hover:bg-blue-100",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        colorClasses[color],
      )}
    >
      <span className="max-w-[120px] truncate">{label}</span>
      <span className={cn(
        "text-[10px] rounded-full px-1.5 min-w-[18px] text-center",
        active ? "bg-white/20" : "bg-black/5",
      )}>
        {count}
      </span>
    </button>
  );
}
