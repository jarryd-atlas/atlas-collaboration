"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, ListTodo } from "lucide-react";
import { TaskStatusDropdown } from "./task-status-dropdown";
import { TaskPriorityDropdown } from "./task-priority-dropdown";
import { TaskDueDatePicker } from "./task-due-date-picker";
import { TaskAssigneeDropdown } from "./task-assignee-dropdown";
import { cn } from "../../lib/utils";
import type { AssignableUser } from "./inline-task-input";

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

interface CustomerTasksTableProps {
  tasks: Task[];
  assignableUsers: AssignableUser[];
  onSelectTask?: (task: Task) => void;
  siteFilter?: string;
}

type SortField = "title" | "status" | "priority" | "due_date" | "assignee" | "site";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { todo: 0, in_progress: 1, in_review: 2, done: 3 };

export function CustomerTasksTable({ tasks, assignableUsers, onSelectTask, siteFilter: initialSiteFilter }: CustomerTasksTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [siteFilter, setSiteFilter] = useState<string>(initialSiteFilter ?? "all");
  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sites = useMemo(() => {
    const set = new Map<string, string>();
    for (const t of tasks) {
      if (t.site) set.set(t.site.id, t.site.name);
    }
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  const filtered = useMemo(() => {
    let result = tasks;

    // Status filter
    if (statusFilter === "open") {
      result = result.filter((t) => t.status !== "done");
    } else if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Site filter
    if (siteFilter !== "all") {
      result = result.filter((t) => t.site?.id === siteFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.site?.name.toLowerCase().includes(q) ||
          t.milestone?.name.toLowerCase().includes(q) ||
          t.assignee?.full_name.toLowerCase().includes(q),
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title);
          break;
        case "status":
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          break;
        case "priority":
          cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          break;
        case "due_date": {
          const da = a.due_date ?? "9999";
          const db = b.due_date ?? "9999";
          cmp = da.localeCompare(db);
          break;
        }
        case "assignee":
          cmp = (a.assignee?.full_name ?? "zzz").localeCompare(b.assignee?.full_name ?? "zzz");
          break;
        case "site":
          cmp = (a.site?.name ?? "zzz").localeCompare(b.site?.name ?? "zzz");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tasks, search, statusFilter, siteFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Tasks</h3>
          <span className="text-xs text-gray-400">
            {openCount} open
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-green"
          >
            <option value="open">Open</option>
            <option value="all">All</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="done">Done</option>
          </select>
          {/* Site filter */}
          {sites.length > 1 && (
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-green"
            >
              <option value="all">All Sites</option>
              {sites.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md w-40 focus:outline-none focus:ring-1 focus:ring-brand-green"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs w-[72px]">Status</th>
              <SortTh label="Task" field="title" current={sortField} dir={sortDir} onSort={toggleSort} />
              <SortTh label="Site" field="site" current={sortField} dir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
              <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs w-[90px]">Priority</th>
              <SortTh label="Due" field="due_date" current={sortField} dir={sortDir} onSort={toggleSort} className="w-[100px]" />
              <th className="text-left px-3 py-2 font-medium text-gray-500 text-xs w-[120px]">Assignee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-xs">
                  {tasks.length === 0 ? "No tasks yet." : "No tasks match your filters."}
                </td>
              </tr>
            ) : (
              filtered.map((task) => (
                <tr
                  key={task.id}
                  className="hover:bg-gray-50 transition-colors group"
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <TaskStatusDropdown taskId={task.id} currentStatus={task.status} />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onSelectTask?.(task)}
                      className="text-left hover:text-gray-900 transition-colors"
                    >
                      <span className={cn(
                        "text-sm font-medium",
                        task.status === "done" ? "text-gray-400 line-through" : "text-gray-800",
                      )}>
                        {task.title}
                      </span>
                      {task.milestone && (
                        <span className="block text-[11px] text-gray-400 mt-0.5">
                          {task.milestone.name}
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    {task.site ? (
                      <span className="text-xs text-gray-500">{task.site.name}</span>
                    ) : (
                      <span className="text-xs text-gray-300">--</span>
                    )}
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <TaskPriorityDropdown taskId={task.id} currentPriority={task.priority} />
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <TaskDueDatePicker taskId={task.id} currentDueDate={task.due_date} />
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <TaskAssigneeDropdown
                      taskId={task.id}
                      currentAssignee={task.assignee ?? null}
                      assignableUsers={assignableUsers}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      {filtered.length > 0 && filtered.length !== tasks.length && (
        <div className="px-4 py-2 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">
            Showing {filtered.length} of {tasks.length} tasks
          </p>
        </div>
      )}
    </div>
  );
}

function SortTh({
  label,
  field,
  current,
  dir,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = current === field;
  return (
    <th className={cn("text-left px-3 py-2 font-medium text-gray-500 text-xs", className)}>
      <button
        className="flex items-center gap-0.5 hover:text-gray-700 transition-colors"
        onClick={() => onSort(field)}
      >
        {label}
        {isActive && (
          dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        )}
      </button>
    </th>
  );
}
