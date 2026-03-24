import { getMyRelevantTasks, getLatestCommentsForTasks, getInternalProfiles } from "../../../lib/data/queries";
import { getCurrentUser } from "../../../lib/data/current-user";
import { TasksClient } from "./tasks-client";
import type { AssignableUser, AssignableSite } from "../../../components/tasks/inline-task-input";

export default async function TasksPage() {
  let allTasks: Awaited<ReturnType<typeof getMyRelevantTasks>> = [];
  let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;

  try {
    currentUser = await getCurrentUser();
    if (currentUser?.id) {
      allTasks = await getMyRelevantTasks(currentUser.id);
    }
  } catch {
    // Show empty state
  }

  // Fetch latest comments and assignable users in parallel
  const taskIds = allTasks.map((t: any) => t.id);
  let latestComments: Record<string, { body: string; authorName: string; createdAt: string }> = {};
  let assignableUsers: AssignableUser[] = [];
  try {
    const [comments, internalProfiles] = await Promise.all([
      getLatestCommentsForTasks(taskIds),
      getInternalProfiles(),
    ]);
    latestComments = comments;
    assignableUsers = (internalProfiles ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      group: "CK Team",
    }));
  } catch {
    // non-critical
  }

  // Build context from the joined data
  const tasksWithContext = allTasks.map((task) => {
    const milestone = task.milestone;
    const site = milestone?.site;
    // Customer info: from milestone chain, or direct customer join for company-level tasks
    const customer = site?.customer ?? task.direct_customer;
    return {
      ...task,
      milestoneInfo: milestone ? { name: milestone.name, slug: milestone.slug } : null,
      siteInfo: site ? { name: site.name, slug: site.slug } : null,
      customerInfo: customer ? { name: customer.name, slug: customer.slug } : null,
      assigneeName: task.assignee?.full_name ?? null,
      assigneeAvatar: task.assignee?.avatar_url ?? null,
      latestComment: latestComments[task.id] ?? null,
    };
  });

  // Extract unique sites from tasks for the @ mention picker
  const siteMap = new Map<string, AssignableSite>();
  for (const task of allTasks) {
    const site = task.milestone?.site;
    if (site && !siteMap.has(site.id)) {
      siteMap.set(site.id, { id: site.id, name: site.name, slug: site.slug });
    }
  }
  const assignableSites = Array.from(siteMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const todoTasks = tasksWithContext.filter((t) => t.status === "todo");
  const inProgressTasks = tasksWithContext.filter((t) => t.status === "in_progress");
  const inReviewTasks = tasksWithContext.filter((t) => t.status === "in_review");

  const tenantId = currentUser?.tenant_id ?? "";
  const currentUserName = currentUser?.full_name ?? currentUser?.email ?? "You";
  const currentUserAvatar = currentUser?.avatarUrl ?? null;

  return (
    <TasksClient
      allTasks={allTasks}
      todoTasks={todoTasks}
      inProgressTasks={inProgressTasks}
      inReviewTasks={inReviewTasks}
      tenantId={tenantId}
      currentProfileId={currentUser?.id ?? ""}
      currentUserName={currentUserName}
      currentUserAvatar={currentUserAvatar}
      assignableUsers={assignableUsers}
      assignableSites={assignableSites}
    />
  );
}
