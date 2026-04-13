"use client";

import { useState, useMemo } from "react";
import { EmptyState } from "../../../components/ui/empty-state";
import { VoiceTaskCreator } from "../../../components/tasks/voice-task-creator";
import { InlineTaskInput, type AssignableUser, type AssignableSite, type AssignableCustomer } from "../../../components/tasks/inline-task-input";
import { TaskStatusDropdown } from "../../../components/tasks/task-status-dropdown";
import { TaskPriorityDropdown } from "../../../components/tasks/task-priority-dropdown";
import { TaskAssigneeDropdown } from "../../../components/tasks/task-assignee-dropdown";
import { TaskDueDatePicker } from "../../../components/tasks/task-due-date-picker";
import { TaskDetailPanel } from "../../../components/tasks/task-detail-panel";
import { ListTodo, Sparkles, PanelRightOpen } from "lucide-react";
import Link from "next/link";

type ViewMode = "status" | "customer";

interface TaskWithContext {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  description?: string | null;
  created_by?: string | null;
  assigneeName: string | null;
  assigneeAvatar?: string | null;
  milestoneInfo?: { name: string; slug: string } | null;
  siteInfo?: { name: string; slug: string } | null;
  customerInfo?: { name: string; slug: string } | null;
  latestComment?: { body: string; authorName: string; createdAt: string } | null;
  assignee?: { id: string; full_name: string; avatar_url?: string | null } | null;
}

interface TasksClientProps {
  allTasks: unknown[];
  tasksWithContext: TaskWithContext[];
  todoTasks: TaskWithContext[];
  inProgressTasks: TaskWithContext[];
  inReviewTasks: TaskWithContext[];
  tenantId: string;
  currentProfileId: string;
  currentUserName: string;
  currentUserAvatar?: string | null;
  assignableUsers?: AssignableUser[];
  assignableSites?: AssignableSite[];
  assignableCustomers?: AssignableCustomer[];
}

export function TasksClient({
  allTasks,
  tasksWithContext,
  todoTasks,
  inProgressTasks,
  inReviewTasks,
  tenantId,
  currentProfileId,
  currentUserName,
  currentUserAvatar,
  assignableUsers = [],
  assignableSites = [],
  assignableCustomers = [],
}: TasksClientProps) {
  const [showAiCreator, setShowAiCreator] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithContext | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("status");

  // Group tasks by customer for customer view
  const customerGroups = useMemo(() => {
    if (viewMode !== "customer") return [];
    const map = new Map<string, TaskWithContext[]>();
    for (const task of tasksWithContext) {
      const key = task.customerInfo?.name ?? "CK";
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    // Sort alphabetically, with "CK" at the end
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "CK") return 1;
      if (b[0] === "CK") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [tasksWithContext, viewMode]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-500 mt-1">
            {allTasks.length} open task{allTasks.length !== 1 ? "s" : ""} across all projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiCreator(!showAiCreator)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              showAiCreator
                ? "bg-brand-green/10 text-brand-dark ring-1 ring-brand-green/30"
                : "bg-gray-900 text-white hover:bg-gray-700"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            AI Task Creator
          </button>
        </div>
      </div>

      {/* View toggle + Inline task creation */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <InlineTaskInput
            tenantId={tenantId}
            assignableUsers={assignableUsers}
            assignableSites={assignableSites}
            placeholder="Add a task and press Enter... Use @ to assign"
          />
        </div>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => setViewMode("status")}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              viewMode === "status"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Status
          </button>
          <button
            onClick={() => setViewMode("customer")}
            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
              viewMode === "customer"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Customer
          </button>
        </div>
      </div>

      {/* AI Task Creator Panel */}
      {showAiCreator && (
        <VoiceTaskCreator
          tenantId={tenantId}
          onDone={() => setShowAiCreator(false)}
        />
      )}

      {/* Task list */}
      {allTasks.length === 0 && !showAiCreator ? (
        <EmptyState
          icon={<ListTodo className="h-12 w-12" />}
          title="No open tasks"
          description="Create tasks from the AI Task Creator above, or add them from a milestone page."
          action={
            <button
              onClick={() => setShowAiCreator(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Create Tasks with AI
            </button>
          }
        />
      ) : viewMode === "status" ? (
        <div className="space-y-6">
          <TaskSection title="In Progress" tasks={inProgressTasks} onSelectTask={setSelectedTask} assignableUsers={assignableUsers} />
          <TaskSection title="In Review" tasks={inReviewTasks} onSelectTask={setSelectedTask} assignableUsers={assignableUsers} />
          <TaskSection title="To Do" tasks={todoTasks} onSelectTask={setSelectedTask} assignableUsers={assignableUsers} />
        </div>
      ) : (
        <div className="space-y-6">
          {customerGroups.map(([customerName, tasks]) => (
            <TaskSection
              key={customerName}
              title={customerName}
              tasks={tasks}
              onSelectTask={setSelectedTask}
              assignableUsers={assignableUsers}
            />
          ))}
        </div>
      )}

      {/* Task detail side panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        tenantId={tenantId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        assignableUsers={assignableUsers}
        assignableCustomers={assignableCustomers}
        assignableSites={assignableSites}
        onTaskUpdated={(updated) => setSelectedTask((prev) => prev ? { ...prev, ...updated } : null)}
      />
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  onSelectTask,
  assignableUsers,
}: {
  title: string;
  tasks: TaskWithContext[];
  onSelectTask: (task: TaskWithContext) => void;
  assignableUsers: AssignableUser[];
}) {
  if (tasks.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-card divide-y divide-gray-50">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <TaskStatusDropdown taskId={task.id} currentStatus={task.status} />
              <div className="min-w-0 flex-1 overflow-hidden">
                <span
                  className="text-sm font-medium text-gray-900 truncate block cursor-pointer hover:text-gray-600"
                  onClick={() => onSelectTask(task)}
                >
                  {task.title}
                </span>
                {/* Latest update preview */}
                {task.latestComment && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    <span className="font-medium">{task.latestComment.authorName}:</span>{" "}
                    {task.latestComment.body}
                  </p>
                )}
                {/* Breadcrumb context */}
                {task.customerInfo && task.siteInfo && task.milestoneInfo && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    <Link
                      href={`/customers/${task.customerInfo.slug}/sites/${task.siteInfo.slug}/milestones/${task.milestoneInfo.slug}`}
                      className="hover:text-gray-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {task.customerInfo.name} &rarr; {task.siteInfo.name} &rarr; {task.milestoneInfo.name}
                    </Link>
                  </p>
                )}
                {task.customerInfo && !task.siteInfo && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    <Link
                      href={`/customers/${task.customerInfo.slug}`}
                      className="hover:text-gray-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {task.customerInfo.name}
                    </Link>
                    <span className="ml-1 text-gray-300">&middot; Company task</span>
                  </p>
                )}
              </div>
              <TaskPriorityDropdown taskId={task.id} currentPriority={task.priority} />
              <TaskDueDatePicker taskId={task.id} currentDueDate={task.due_date} />
              <TaskAssigneeDropdown
                taskId={task.id}
                currentAssignee={task.assignee ?? null}
                assignableUsers={assignableUsers}
              />
              <button
                type="button"
                onClick={() => onSelectTask(task)}
                className="text-gray-300 hover:text-gray-500 transition-colors p-0.5"
                title="Open task details"
              >
                <PanelRightOpen className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
