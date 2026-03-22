import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSiteBySlug,
  getCustomerBySlug,
  getMilestonesForSite,
  getAssignableUsersForCustomer,
  getTasksForSite,
  getLatestCommentsForTasks,
  getFullAssessmentData,
} from "../../../../../../lib/data/queries";
import { getCurrentUser } from "../../../../../../lib/data/current-user";
import { createOrGetAssessment } from "../../../../../../lib/actions/assessment";
import { PipelineStageBadge } from "../../../../../../components/ui/badge";
import { SetPageContext } from "../../../../../../components/layout/page-context";
import { CustomerPortalLink } from "../../../../../../components/layout/customer-portal-link";
import { SiteTabLayout } from "../../../../../../components/assessment/site-tab-layout";
import { OverviewTab } from "../../../../../../components/assessment/overview-tab";
import { BaselineTab } from "../../../../../../components/assessment/baseline-tab";
import { LaborTab } from "../../../../../../components/assessment/labor-tab";
import { MapPin } from "lucide-react";

interface SitePageProps {
  params: Promise<{ customerSlug: string; siteSlug: string }>;
}

export default async function SitePage({ params }: SitePageProps) {
  const { customerSlug, siteSlug } = await params;

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

  // Fetch all data in parallel
  let milestones: any[] = [];
  let assignableUsers: any[] = [];
  let siteTasks: any[] = [];
  let currentUser: any = null;
  let assessmentData: Awaited<ReturnType<typeof getFullAssessmentData>> | null = null;

  try {
    const [ms, assignable, tasks, user, aData] = await Promise.all([
      getMilestonesForSite(site.id),
      getAssignableUsersForCustomer(customer.id),
      getTasksForSite(site.id),
      getCurrentUser(),
      getFullAssessmentData(site.id),
    ]);
    milestones = ms;
    siteTasks = tasks;
    currentUser = user;
    assessmentData = aData;
    const { customerUsers = [], ckTeamMembers = [] } = assignable ?? {};
    assignableUsers = [
      ...customerUsers.map((u: any) => ({ ...u, group: "Your Team" })),
      ...ckTeamMembers.map((u: any) => ({ ...u, group: "CK Team" })),
    ];
  } catch {
    // Show empty state gracefully
  }

  // Auto-create assessment if none exists (idempotent)
  let assessment = assessmentData?.assessment ?? null;
  if (!assessment) {
    try {
      const result = await createOrGetAssessment(site.id, site.tenant_id);
      if (result.assessment) {
        assessment = result.assessment;
      }
    } catch {
      // Non-critical — tabs will show empty states
    }
  }

  // Fetch latest comments for site tasks
  const taskIds = siteTasks.map((t: any) => t.id);
  let latestComments: Record<string, { body: string; authorName: string; createdAt: string }> = {};
  try {
    latestComments = await getLatestCommentsForTasks(taskIds);
  } catch {
    // non-critical
  }
  const tasksWithComments = siteTasks.map((t: any) => ({
    ...t,
    latestComment: latestComments[t.id] ?? null,
  }));

  const currentUserName = currentUser?.full_name ?? currentUser?.email ?? "You";
  const currentUserAvatar = currentUser?.avatarUrl ?? null;
  const isLocked = assessment?.status === "locked";
  const isInternal = currentUser?.sessionClaims?.tenantType === "internal";

  return (
    <div className="space-y-6">
      <SetPageContext siteId={site.id} siteName={site.name} customerId={customer.id} customerName={customer.name} tenantId={site.tenant_id} />

      {/* Breadcrumb + header */}
      <div>
        <p className="text-sm text-gray-400 mb-1">
          <Link href="/customers" className="hover:text-gray-600">Companies</Link>
          {" / "}
          <Link href={`/customers/${customerSlug}`} className="hover:text-gray-600">{customer.name}</Link>
        </p>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
            {site.city && (
              <p className="text-gray-500 mt-1 flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {site.address && `${site.address}, `}{site.city}, {site.state}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CustomerPortalLink
              currentPath={`/customers/${customerSlug}/sites/${siteSlug}`}
              customerSlug={customerSlug}
            />
            <PipelineStageBadge stage={site.pipeline_stage} />
            {isLocked && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                Locked
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabbed layout — Overview | Baseline | Labor */}
      <SiteTabLayout>
        {{
          overview: (
            <OverviewTab
              site={site}
              customer={customer}
              customerSlug={customerSlug}
              siteSlug={siteSlug}
              milestones={milestones}
              tasksWithComments={tasksWithComments}
              assignableUsers={assignableUsers}
              currentUserName={currentUserName as string}
              currentUserAvatar={currentUserAvatar as string | undefined}
              canAnalyze={isInternal}
              assessmentId={assessment?.id}
            />
          ),
          baseline: (
            <BaselineTab
              assessment={assessment}
              equipment={assessmentData?.equipment ?? []}
              energyData={assessmentData?.energyData ?? []}
              rateStructure={assessmentData?.rateStructure ?? null}
              touSchedule={assessmentData?.touSchedule ?? null}
              operationalParams={assessmentData?.operationalParams ?? null}
              operations={assessmentData?.operations ?? null}
              loadBreakdown={assessmentData?.loadBreakdown ?? null}
              arcoPerformance={assessmentData?.arcoPerformance ?? null}
              savingsAnalysis={assessmentData?.savingsAnalysis ?? null}
              siteId={site.id}
              tenantId={site.tenant_id}
              isLocked={isLocked}
              dataSources={assessmentData?.dataSources ?? []}
            />
          ),
          labor: (
            <LaborTab
              assessment={assessment}
              laborBaseline={assessmentData?.laborBaseline ?? null}
              siteId={site.id}
              tenantId={site.tenant_id}
              isLocked={isLocked}
            />
          ),
        }}
      </SiteTabLayout>
    </div>
  );
}
