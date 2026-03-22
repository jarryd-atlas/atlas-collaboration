"use client";

import { useState } from "react";
import { PriorityBadge } from "../../../components/ui/badge";
import { Avatar } from "../../../components/ui/avatar";
import { EmptyState } from "../../../components/ui/empty-state";
import { VoiceTaskCreator } from "../../../components/tasks/voice-task-creator";
import { InlineTaskInput, type AssignableUser, type AssignableSite } from "../../../components/tasks/inline-task-input";
import { TaskStatusDropdown } from "../../../components/tasks/task-status-dropdown";
import { InlineEditableTitle } from "../../../components/tasks/inline-editable-title";
import { TaskDetailPanel } from "../../../components/tasks/task-detail-panel";
import { Calendar, ListTodo, Sparkles } from "lucide-react";
import Link from "next/link";

interface TaskWithContext {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
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
  todoTasks: TaskWithContext[];
  inProgressTasks: TaskWithContext[];
  inReviewTasks: TaskWithContext[];
  tenantId: string;
  currentUserName: string;
  currentUserAvatar?: string | null;
  assignableUsers?: AssignableUser[];
  assignableSites?: AssignableSite[];
}

export function TasksClient({
  allTasks,
  todoTasks,
  inProgressTasks,
  inReviewTasks,
  tenantId,
  currentUserName,
  currentUserAvatar,
  assignableUsers = [],
  assignableSites = [],
}: TasksClientProps) {
  const [showAiCreator, setShowAiCreator] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithContext | null>(null);

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

      {/* Inline task creation */}
      <InlineTaskInput
        tenantId={tenantId}
        assignableUsers={assignableUsers}
        assignableSites={assignableSites}
        placeholder="Add a task and press Enter... Use @ to assign"
      />

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
      ) : (
        <div className="space-y-6">
          <TaskSection title="In Progress" tasks={inProgressTasks} onSelectTask={setSelectedTask} />
          <TaskSection title="In Review" tasks={inReviewTasks} onSelectTask={setSelectedTask} />
          <TaskSection title="To Do" tasks={todoTasks} onSelectTask={setSelectedTask} />
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
      />
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  onSelectTask,
}: {
  title: string;
  tasks: TaskWithContext[];
  onSelectTask: (task: TaskWithContext) => void;
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
            className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={() => onSelectTask(task)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <TaskStatusDropdown taskId={task.id} currentStatus={task.status} />
                <div className="min-w-0 flex-1">
                  <InlineEditableTitle taskId={task.id} initialTitle={task.title} />
                  {/* Latest update preview */}
                  {task.latestComment && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      <span className="font-medium">{task.latestComment.authorName}:</span>{" "}
                      {task.latestComment.body}
                    </p>
                  )}
                  {/* Breadcrumb context */}
                  {task.customerInfo && task.siteInfo && task.milestoneInfo && (
                    <p className="text-xs text-gray-400 mt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/customers/${task.customerInfo.slug}/sites/${task.siteInfo.slug}/milestones/${task.milestoneInfo.slug}`}
                        className="hover:text-gray-600"
                      >
                        {task.customerInfo.name} &rarr; {task.siteInfo.name} &rarr; {task.milestoneInfo.name}
                      </Link>
                    </p>
                  )}
                  {task.customerInfo && !task.siteInfo && (
                    <p className="text-xs text-gray-400 mt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/customers/${task.customerInfo.slug}`}
                        className="hover:text-gray-600"
                      >
                        {task.customerInfo.name}
                      </Link>
                      <span className="ml-1 text-gray-300">&middot; Company task</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <PriorityBadge priority={task.priority} />
                {task.due_date && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {task.due_date}
                  </span>
                )}
                {task.assigneeName && (
                  <Avatar name={task.assigneeName} src={task.assigneeAvatar} size="sm" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
