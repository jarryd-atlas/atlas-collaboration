import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMilestoneBySlug,
  getSiteBySlug,
  getCustomerBySlug,
  getTasksForMilestone,
  getCommentsForEntity,
  getActiveProfiles,
} from "../../../../../../../../lib/data/queries";
import { getCurrentUser } from "../../../../../../../../lib/data/current-user";
import { StatusBadge, PriorityBadge } from "../../../../../../../../components/ui/badge";
import { ProgressBar } from "../../../../../../../../components/ui/progress-bar";
import { Avatar } from "../../../../../../../../components/ui/avatar";
import { EmptyState } from "../../../../../../../../components/ui/empty-state";
import { AddTaskButton } from "../../../../../../../../components/forms/milestone-actions";
import { CommentInput } from "../../../../../../../../components/forms/comment-input";
import {
  Calendar,
  ListTodo,
  MessageSquare,
} from "lucide-react";
import type { TaskStatus } from "@repo/shared";

interface MilestonePageProps {
  params: Promise<{
    customerSlug: string;
    siteSlug: string;
    milestoneSlug: string;
  }>;
}

const TASK_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "To Do" },
  { status: "in_progress", label: "In Progress" },
  { status: "in_review", label: "In Review" },
  { status: "done", label: "Done" },
];

export default async function MilestonePage({ params }: MilestonePageProps) {
  const { customerSlug, siteSlug, milestoneSlug } = await params;

  let site: Awaited<ReturnType<typeof getSiteBySlug>> = null;
  let customer: Awaited<ReturnType<typeof getCustomerBySlug>> = null;

  try {
    [site, customer] = await Promise.all([
      getSiteBySlug(customerSlug, siteSlug),
      getCustomerBySlug(customerSlug),
    ]);
  } catch {
    return notFound();
  }

  if (!site || !customer) return notFound();

  let milestone: Awaited<ReturnType<typeof getMilestoneBySlug>> = null;
  try {
    milestone = await getMilestoneBySlug(site.id, milestoneSlug);
  } catch {
    return notFound();
  }

  if (!milestone) return notFound();

  let tasks: Awaited<ReturnType<typeof getTasksForMilestone>> = [];
  let comments: Awaited<ReturnType<typeof getCommentsForEntity>> = [];
  let assignableUsers: Awaited<ReturnType<typeof getActiveProfiles>> = [];
  let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;

  try {
    [tasks, comments, assignableUsers, currentUser] = await Promise.all([
      getTasksForMilestone(milestone.id),
      getCommentsForEntity("milestone", milestone.id),
      getActiveProfiles(),
      getCurrentUser(),
    ]);
  } catch {
    // Show empty state
  }

  const currentUserName = currentUser?.full_name ?? "User";

  return (
    <div className="space-y-8">
      {/* Breadcrumbs + header */}
      <div>
        <p className="text-sm text-gray-400 mb-1">
          <Link href="/customers" className="hover:text-gray-600">Customers</Link>
          {" / "}
          <Link href={`/customers/${customerSlug}`} className="hover:text-gray-600">{customer.name}</Link>
          {" / "}
          <Link href={`/customers/${customerSlug}/sites/${siteSlug}`} className="hover:text-gray-600">{site.name}</Link>
        </p>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{milestone.name}</h1>
            {milestone.description && (
              <p className="text-gray-500 mt-1">{milestone.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={milestone.status} />
            <PriorityBadge priority={milestone.priority} />
          </div>
        </div>
      </div>

      {/* Property bar */}
      <div className="flex flex-wrap gap-6 text-sm">
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Progress</p>
          <div className="flex items-center gap-2">
            <ProgressBar value={milestone.progress ?? 0} className="w-24" size="sm" />
            <span className="text-gray-700 font-medium">{milestone.progress ?? 0}%</span>
          </div>
        </div>
        {milestone.start_date && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Start</p>
            <p className="text-gray-700 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {milestone.start_date}
            </p>
          </div>
        )}
        {milestone.due_date && (
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Due</p>
            <p className="text-gray-700 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {milestone.due_date}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-400 mb-0.5">Tasks</p>
          <p className="text-gray-700">
            {milestone.completed_task_count ?? 0}/{milestone.task_count ?? 0} completed
          </p>
        </div>
      </div>

      {/* Task board (kanban) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Tasks</h2>
          <AddTaskButton milestoneName={milestone.name} assignableUsers={assignableUsers} />
        </div>

        {tasks.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="h-12 w-12" />}
            title="No tasks yet"
            description="Add tasks to track work within this milestone."
            action={<AddTaskButton milestoneName={milestone.name} assignableUsers={assignableUsers} />}
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
      </div>

      {/* Comments */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comments ({comments.length})
          </h2>
        </div>

        {comments.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-gray-400">No comments yet. Start the conversation.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {comments.map((comment) => (
              <div key={comment.id} className="px-6 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar name={comment.author?.full_name ?? "User"} src={comment.author?.avatar_url} size="sm" />
                  <span className="text-sm font-medium text-gray-900">{comment.author?.full_name ?? "User"}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(comment.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 ml-8">{comment.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Comment input (client component) */}
        <CommentInput
          currentUserName={currentUserName}
          entityType="milestone"
          entityId={milestone.id}
        />
      </div>
    </div>
  );
}
