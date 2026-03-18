import { getAllOpenTasks } from "../../../lib/data/queries";
import { getCurrentUser } from "../../../lib/data/current-user";
import { StatusBadge, PriorityBadge } from "../../../components/ui/badge";
import { Avatar } from "../../../components/ui/avatar";
import { EmptyState } from "../../../components/ui/empty-state";
import { Calendar, ListTodo, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function TasksPage() {
  let allTasks: Awaited<ReturnType<typeof getAllOpenTasks>> = [];
  let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;

  try {
    [allTasks, currentUser] = await Promise.all([
      getAllOpenTasks(),
      getCurrentUser(),
    ]);
  } catch {
    // Show empty state
  }

  // Build context from the joined data
  const tasksWithContext = allTasks.map((task) => {
    const milestone = task.milestone;
    const site = milestone?.site;
    const customer = site?.customer;
    return {
      ...task,
      milestoneInfo: milestone ? { name: milestone.name, slug: milestone.slug } : null,
      siteInfo: site ? { name: site.name, slug: site.slug } : null,
      customerInfo: customer ? { name: customer.name, slug: customer.slug } : null,
      assigneeName: task.assignee?.full_name ?? null,
    };
  });

  const todoTasks = tasksWithContext.filter((t) => t.status === "todo");
  const inProgressTasks = tasksWithContext.filter((t) => t.status === "in_progress");
  const inReviewTasks = tasksWithContext.filter((t) => t.status === "in_review");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Tasks</h1>
        <p className="text-gray-500 mt-1">{allTasks.length} open tasks across all projects</p>
      </div>

      {allTasks.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-12 w-12" />}
          title="No open tasks"
          description="You're all caught up! Tasks assigned to you will appear here."
        />
      ) : (
        <div className="space-y-6">
          <TaskSection title="In Progress" tasks={inProgressTasks} />
          <TaskSection title="In Review" tasks={inReviewTasks} />
          <TaskSection title="To Do" tasks={todoTasks} />
        </div>
      )}
    </div>
  );
}

function TaskSection({
  title,
  tasks,
}: {
  title: string;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    assigneeName: string | null;
    milestoneInfo?: { name: string; slug: string } | null;
    siteInfo?: { name: string; slug: string } | null;
    customerInfo?: { name: string; slug: string } | null;
  }>;
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
          <div key={task.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <StatusBadge status={task.status} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                  {task.customerInfo && task.siteInfo && task.milestoneInfo && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      <Link
                        href={`/customers/${task.customerInfo.slug}/sites/${task.siteInfo.slug}/milestones/${task.milestoneInfo.slug}`}
                        className="hover:text-gray-600"
                      >
                        {task.customerInfo.name} &rarr; {task.siteInfo.name} &rarr; {task.milestoneInfo.name}
                      </Link>
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
                {task.assigneeName && <Avatar name={task.assigneeName} size="sm" />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
