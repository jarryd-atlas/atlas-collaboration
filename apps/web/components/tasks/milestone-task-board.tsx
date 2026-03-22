"use client";

import { useState } from "react";
import { PriorityBadge } from "../ui/badge";
import { Avatar } from "../ui/avatar";
import { InlineTaskInput } from "./inline-task-input";
import { VoiceTaskCreator } from "./voice-task-creator";
import { AddTaskButton } from "../forms/milestone-actions";
import { Calendar, ListTodo, Sparkles } from "lucide-react";
import { EmptyState } from "../ui/empty-state";
import type { TaskStatus } from "@repo/shared";

const TASK_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "To Do" },
  { status: "in_progress", label: "In Progress" },
  { status: "in_review", label: "In Review" },
  { status: "done", label: "Done" },
];

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee?: { full_name: string; avatar_url?: string | null } | null;
}

interface MilestoneTaskBoardProps {
  tasks: Task[];
  milestoneName: string;
  milestoneId: string;
  siteId: string;
  tenantId: string;
  customerName?: string;
  siteName?: string;
  assignableUsers: Array<{ id: string; full_name: string; avatar_url: string | null; [key: string]: unknown }>;
}

export function MilestoneTaskBoard({
  tasks,
  milestoneName,
  milestoneId,
  siteId,
  tenantId,
  customerName,
  siteName,
  assignableUsers,
}: MilestoneTaskBoardProps) {
  const [showAiCreator, setShowAiCreator] = useState(false);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiCreator(!showAiCreator)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
              showAiCreator
                ? "bg-brand-green/10 text-brand-dark ring-1 ring-brand-green/30"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Create
          </button>
          <AddTaskButton
            milestoneName={milestoneName}
            milestoneId={milestoneId}
            tenantId={tenantId}
            assignableUsers={assignableUsers}
          />
        </div>
      </div>

      {/* AI Task Creator */}
      {showAiCreator && (
        <VoiceTaskCreator
          milestoneId={milestoneId}
          siteId={siteId}
          tenantId={tenantId}
          context={{
            customerName,
            siteName,
            milestoneName,
          }}
          onDone={() => setShowAiCreator(false)}
        />
      )}

      {/* Kanban board or empty state */}
      {tasks.length === 0 && !showAiCreator ? (
        <EmptyState
          icon={<ListTodo className="h-12 w-12" />}
          title="No tasks yet"
          description="Add tasks below or use the AI creator to generate them from voice or text."
          action={
            <AddTaskButton
              milestoneName={milestoneName}
              milestoneId={milestoneId}
              tenantId={tenantId}
              assignableUsers={assignableUsers}
            />
          }
        />
      ) : (
        <div className="grid md:grid-cols-4 gap-4">
          {TASK_COLUMNS.map((col) => {
            const columnTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-medium text-gray-700">{col.label}</h3>
                  <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    {columnTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-gray-100 bg-white p-3 shadow-card hover:shadow-card-hover transition-shadow"
                    >
                      <p className="text-sm font-medium text-gray-900 mb-2">{task.title}</p>
                      <div className="flex items-center justify-between">
                        <PriorityBadge priority={task.priority} />
                        {task.assignee?.full_name ? (
                          <Avatar name={task.assignee.full_name} size="sm" />
                        ) : (
                          <span className="text-xs text-gray-300">Unassigned</span>
                        )}
                      </div>
                      {task.due_date && (
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {task.due_date}
                        </p>
                      )}
                    </div>
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
                      <p className="text-xs text-gray-400">No tasks</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inline task input at the bottom */}
      <InlineTaskInput
        milestoneId={milestoneId}
        siteId={siteId}
        tenantId={tenantId}
        assignableUsers={assignableUsers.map((u) => ({
          id: u.id,
          full_name: u.full_name,
          avatar_url: u.avatar_url,
          group: (u as any).group,
        }))}
        placeholder="Type a task title and press Enter to add..."
      />
    </div>
  );
}
