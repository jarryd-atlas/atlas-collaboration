import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMilestoneBySlug,
  getSiteBySlug,
  getCustomerBySlug,
  getTasksForMilestone,
  getCommentsForEntity,
  getAssignableUsersForCustomer,
} from "../../../../../../../../lib/data/queries";
import { getCurrentUser } from "../../../../../../../../lib/data/current-user";
import { StatusBadge, PriorityBadge } from "../../../../../../../../components/ui/badge";
import { ProgressBar } from "../../../../../../../../components/ui/progress-bar";
import { Avatar } from "../../../../../../../../components/ui/avatar";
import { MilestoneTaskBoard } from "../../../../../../../../components/tasks";
import { CommentInput } from "../../../../../../../../components/forms/comment-input";
import { SetPageContext } from "../../../../../../../../components/layout/page-context";
import {
  Calendar,
  MessageSquare,
} from "lucide-react";

interface MilestonePageProps {
  params: Promise<{
    customerSlug: string;
    siteSlug: string;
    milestoneSlug: string;
  }>;
}

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
  let assignableUsers: Array<{ id: string; full_name: string; avatar_url: string | null; group?: string; [key: string]: unknown }> = [];
  let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;

  try {
    const [tasksResult, commentsResult, assignableResult, currentUserResult] = await Promise.all([
      getTasksForMilestone(milestone.id),
      getCommentsForEntity("milestone", milestone.id),
      getAssignableUsersForCustomer(customer.id),
      getCurrentUser(),
    ]);
    tasks = tasksResult;
    comments = commentsResult;
    currentUser = currentUserResult;
    assignableUsers = [
      ...assignableResult.customerUsers.map((u: any) => ({ ...u, group: "Customer Team" })),
      ...assignableResult.ckTeamMembers.map((u: any) => ({ ...u, group: "CK Team" })),
    ];
  } catch {
    // Show empty state
  }

  const currentUserName = currentUser?.full_name ?? "User";

  return (
    <div className="space-y-8">
      <SetPageContext siteId={site.id} siteName={site.name} customerId={customer.id} customerName={customer.name} milestoneId={milestone.id} tenantId={site.tenant_id} />
      {/* Breadcrumbs + header */}
      <div>
        <p className="text-sm text-gray-400 mb-1">
          <Link href="/customers" className="hover:text-gray-600">Companies</Link>
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

      {/* Task board (kanban) + inline creation + AI creator */}
      <MilestoneTaskBoard
        tasks={tasks}
        milestoneName={milestone.name}
        milestoneId={milestone.id}
        siteId={site.id}
        tenantId={milestone.tenant_id}
        customerName={customer.name}
        siteName={site.name}
        assignableUsers={assignableUsers}
      />

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
