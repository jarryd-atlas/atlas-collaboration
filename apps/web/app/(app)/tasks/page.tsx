import { getMyRelevantTasks, getLatestCommentsForTasks, getInternalProfiles } from "../../../lib/data/queries";
import { getCurrentUser } from "../../../lib/data/current-user";
import { TasksClient } from "./tasks-client";
import type { AssignableUser, AssignableSite, AssignableCustomer } from "../../../components/tasks/inline-task-input";

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
    // Site info: from milestone chain OR direct site join
    const site = milestone?.site ?? task.direct_site;
    // Customer info: from milestone chain, direct site, or direct customer join
    const customer = milestone?.site?.customer ?? task.direct_site?.customer ?? task.direct_customer;
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

  // Extract unique sites and customers from tasks for pickers
  const siteMap = new Map<string, AssignableSite>();
  const customerMap = new Map<string, AssignableCustomer>();
  for (const task of allTasks) {
    const site = task.milestone?.site ?? task.direct_site;
    if (site && !siteMap.has(site.id)) {
      siteMap.set(site.id, { id: site.id, name: site.name, slug: site.slug });
    }
    const customer = task.milestone?.site?.customer ?? task.direct_site?.customer ?? task.direct_customer;
    if (customer && !customerMap.has(customer.id)) {
      customerMap.set(customer.id, { id: customer.id, name: customer.name, tenant_id: customer.tenant_id ?? "" });
    }
  }
  const assignableSites = Array.from(siteMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  const assignableCustomers = Array.from(customerMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const todoTasks = tasksWithContext.filter((t) => t.status === "todo");
  const inProgressTasks = tasksWithContext.filter((t) => t.status === "in_progress");
  const inReviewTasks = tasksWithContext.filter((t) => t.status === "in_review");

  const tenantId = currentUser?.tenant_id ?? "";
  const currentUserName = currentUser?.full_name ?? currentUser?.email ?? "You";
  const currentUserAvatar = currentUser?.avatarUrl ?? null;

  return (
    <TasksClient
      allTasks={allTasks}
      tasksWithContext={tasksWithContext}
      todoTasks={todoTasks}
      inProgressTasks={inProgressTasks}
      inReviewTasks={inReviewTasks}
      tenantId={tenantId}
      currentProfileId={currentUser?.id ?? ""}
      currentUserName={currentUserName}
      currentUserAvatar={currentUserAvatar}
      assignableUsers={assignableUsers}
      assignableSites={assignableSites}
      assignableCustomers={assignableCustomers}
    />
  );
}
