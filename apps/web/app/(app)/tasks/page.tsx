import { MOCK_TASKS, MOCK_PROFILES, MOCK_MILESTONES, MOCK_SITES, MOCK_CUSTOMERS } from "../../../lib/mock-data";
import { StatusBadge, PriorityBadge } from "../../../components/ui/badge";
import { Avatar } from "../../../components/ui/avatar";
import { EmptyState } from "../../../components/ui/empty-state";
import { Calendar, ListTodo, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function TasksPage() {
  // TODO: Replace with real query: getMyTasks(profileId)
  const allTasks = MOCK_TASKS.filter((t) => t.status !== "done");

  // Group by milestone → site → customer for context
  const tasksWithContext = allTasks.map((task) => {
    const milestone = MOCK_MILESTONES.find((m) => m.id === task.milestoneId);
    const site = milestone ? MOCK_SITES.find((s) => s.id === milestone.siteId) : null;
    const customer = site ? MOCK_CUSTOMERS.find((c) => c.id === site.customerId) : null;
    const assignee = task.assigneeId ? MOCK_PROFILES.find((p) => p.id === task.assigneeId) : null;
    return { ...task, milestone, site, customer, assignee };
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
    dueDate: string | null;
    assigneeName: string | null;
    milestone?: { name: string; slug: string } | null;
    site?: { name: string; slug: string } | null;
    customer?: { name: string; slug: string } | null;
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
                  {task.customer && task.site && task.milestone && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      <Link
                        href={`/customers/${task.customer.slug}/sites/${task.site.slug}/milestones/${task.milestone.slug}`}
                        className="hover:text-gray-600"
                      >
                        {task.customer.name} → {task.site.name} → {task.milestone.name}
                      </Link>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <PriorityBadge priority={task.priority} />
                {task.dueDate && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {task.dueDate}
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
