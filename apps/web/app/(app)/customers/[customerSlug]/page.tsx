import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCustomerBySlug,
  getSitesForCustomer,
  getFlaggedIssuesForCustomer,
  getCKTeamForCustomer,
  getInternalProfiles,
  getAssignableUsersForCustomer,
  getAllTasksForCustomer,
  getLatestCommentsForTasks,
} from "../../../../lib/data/queries";
import { getCurrentUser } from "../../../../lib/data/current-user";
import { getSession } from "../../../../lib/supabase/server";
import { SeverityBadge, StatusBadge, CompanyTypeBadge } from "../../../../components/ui/badge";
import { CustomerActions, AddSiteButton } from "../../../../components/forms/customer-actions";
import { SetPageContext } from "../../../../components/layout/page-context";
import { CustomerPortalLink } from "../../../../components/layout/customer-portal-link";
import { SitesList } from "../../../../components/sites/sites-list";
import { CustomerTeamManager } from "../../../../components/forms/customer-team-manager";
import { CustomerTasksSection } from "../../../../components/tasks/customer-tasks-section";

interface CustomerPageProps {
  params: Promise<{ customerSlug: string }>;
}

export default async function CustomerPage({ params }: CustomerPageProps) {
  const { customerSlug } = await params;

  let customer: Awaited<ReturnType<typeof getCustomerBySlug>> = null;
  try {
    customer = await getCustomerBySlug(customerSlug);
  } catch {
    return notFound();
  }

  if (!customer) return notFound();

  let sites: Awaited<ReturnType<typeof getSitesForCustomer>> = [];
  let issues: Awaited<ReturnType<typeof getFlaggedIssuesForCustomer>> = [];
  let customerTasks: any[] = [];
  let ckTeam: any[] = [];
  let allInternalProfiles: any[] = [];
  let assignableUsers: { id: string; full_name: string; avatar_url: string | null; group?: string }[] = [];

  const [session, currentUser] = await Promise.all([
    getSession(),
    getCurrentUser(),
  ]);
  const isCKInternal = session?.claims?.tenantType === "internal";

  try {
    const promises: Promise<any>[] = [
      getSitesForCustomer(customer.id),
      getFlaggedIssuesForCustomer(customer.id),
      getAssignableUsersForCustomer(customer.id),
      getAllTasksForCustomer(customer.id),
    ];
    if (isCKInternal) {
      promises.push(getCKTeamForCustomer(customer.id));
      promises.push(getInternalProfiles());
    }

    const results = await Promise.all(promises);
    sites = results[0] ?? [];
    issues = results[1] ?? [];
    const { customerUsers = [], ckTeamMembers = [] } = results[2] ?? {};
    assignableUsers = [
      ...customerUsers.map((u: any) => ({ ...u, group: "Your Team" })),
      ...ckTeamMembers.map((u: any) => ({ ...u, group: "CK Team" })),
    ];
    customerTasks = results[3] ?? [];
    if (isCKInternal) {
      ckTeam = results[4] ?? [];
      allInternalProfiles = results[5] ?? [];
    }
  } catch {
    // Show empty state if queries fail
  }

  // Fetch latest comments for tasks
  const taskIds = customerTasks.map((t: any) => t.id);
  let latestComments: Record<string, { body: string; authorName: string; createdAt: string }> = {};
  try {
    latestComments = await getLatestCommentsForTasks(taskIds);
  } catch {
    // non-critical
  }
  const tasksWithComments = customerTasks.map((t: any) => ({
    ...t,
    latestComment: latestComments[t.id] ?? null,
  }));

  // Current user info for comment input
  const currentUserName = currentUser?.full_name ?? currentUser?.email ?? "You";
  const currentUserAvatar = currentUser?.avatarUrl ?? null;

  const activeSites = sites.filter((s) => s.pipeline_stage === "active");
  const deployingSites = sites.filter((s) => s.pipeline_stage === "deployment");
  const evaluatingSites = sites.filter(
    (s) => s.pipeline_stage === "evaluation" || s.pipeline_stage === "qualified" || s.pipeline_stage === "prospect",
  );

  return (
    <div className="space-y-8">
      <SetPageContext customerId={customer.id} customerName={customer.name} tenantId={customer.tenant_id} />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">
            <Link href="/customers" className="hover:text-gray-600">Companies</Link>
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
            <CompanyTypeBadge type={customer.company_type ?? "customer"} />
          </div>
          {customer.domain && (
            <p className="text-gray-500 mt-1">{customer.domain}</p>
          )}
        </div>
        <CustomerPortalLink
          currentPath={`/customers/${customerSlug}`}
          customerSlug={customerSlug}
        />
      </div>

      {/* CK Team — directly below header */}
      {isCKInternal && (
        <CustomerTeamManager
          customerId={customer.id}
          teamMembers={ckTeam}
          internalProfiles={allInternalProfiles}
        />
      )}

      {/* Quick actions */}
      <CustomerActions customerName={customer.name} customerId={customer.id} customerTenantId={customer.tenant_id} sites={sites} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <MiniStat label="Active Sites" value={activeSites.length} />
        <MiniStat label="In Evaluation" value={evaluatingSites.length} />
        <MiniStat label="Deploying" value={deployingSites.length} />
        <MiniStat label="Open Tasks" value={customerTasks.filter((t: any) => t.status !== "done").length} />
        <MiniStat label="Open Issues" value={issues.filter((i) => i.status === "open").length} accent />
      </div>

      {/* Tasks — below stats, above sites */}
      <CustomerTasksSection
        tasks={tasksWithComments}
        customerId={customer.id}
        tenantId={customer.tenant_id}
        assignableUsers={assignableUsers}
        assignableSites={sites.map((s: any) => ({ id: s.id, name: s.name, slug: s.slug }))}
        currentUserName={currentUserName as string}
        currentUserAvatar={currentUserAvatar as string | undefined}
      />

      {/* Sites */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Sites</h2>
          <AddSiteButton customerName={customer.name} customerId={customer.id} customerTenantId={customer.tenant_id} />
        </div>

        <SitesList sites={sites} customerSlug={customerSlug} />
      </div>

      {/* Flagged issues */}
      {issues.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-card">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">
              Flagged Issues ({issues.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-50">
            {issues.map((issue) => (
              <div key={issue.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{issue.summary}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {issue.site?.name ?? ""} &middot; {issue.flagged_by_profile?.full_name ?? ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <SeverityBadge severity={issue.severity} />
                    <StatusBadge status={issue.status} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-4 py-3">
      <p className={`text-xl font-bold ${accent && value > 0 ? "text-error" : "text-gray-900"}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
