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
import { getHandoffReportForSite } from "../../../../../../lib/data/queries";
import { PipelineStageBadge } from "../../../../../../components/ui/badge";
import { SiteDealLink } from "../../../../../../components/hubspot/site-deal-link";
import { getHubSpotConfig, getHubSpotSiteLinks, getHubSpotFieldMappings } from "../../../../../../lib/data/hubspot-queries";
import { SetPageContext } from "../../../../../../components/layout/page-context";
import { CustomerPortalLink } from "../../../../../../components/layout/customer-portal-link";
import { SiteTabLayout } from "../../../../../../components/assessment/site-tab-layout";
import { OverviewTab } from "../../../../../../components/assessment/overview-tab";
import { BaselineTab } from "../../../../../../components/assessment/baseline-tab";
import { DocumentsTab } from "../../../../../../components/assessment/documents-tab";
import { LaborTab } from "../../../../../../components/assessment/labor-tab";
import { ShareBaselineFormButton } from "../../../../../../components/assessment/share-baseline-form-button";
import { BaselineTabWrapper } from "../../../../../../components/assessment/baseline-tab-wrapper";

import { EditableSiteAddress } from "../../../../../../components/sites/editable-site-address";

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

  // Load HubSpot deal links for this site (non-critical)
  let hubspotLinks: { id: string; hubspot_deal_id: string; deal_name: string | null; is_primary: boolean; deal_type?: string | null }[] = [];
  let hubspotPortalId: string | undefined;
  let hubspotFieldMappings: { hubspot_property: string; direction: "hubspot_to_app" | "app_to_hubspot" | "bidirectional" }[] = [];
  if (isInternal) {
    try {
      const internalTenantId = currentUser?.sessionClaims?.tenantId ?? site.tenant_id;
      const [config, links, mappings] = await Promise.all([
        getHubSpotConfig(internalTenantId),
        getHubSpotSiteLinks(internalTenantId),
        getHubSpotFieldMappings(internalTenantId),
      ]);
      if (config?.is_active) {
        hubspotPortalId = config.portal_id;
        hubspotLinks = (links ?? [])
          .filter((l) => l.site_id === site.id)
          .map((l) => ({ id: l.id, hubspot_deal_id: l.hubspot_deal_id, deal_name: l.deal_name, is_primary: false, deal_type: l.deal_type ?? null }));
        hubspotFieldMappings = (mappings ?? [])
          .filter((m) => m.is_active)
          .map((m) => ({ hubspot_property: m.hubspot_property, direction: m.direction }));
      }
    } catch {
      // Non-critical — don't block page load
    }
  }

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
            {isInternal ? (
              <EditableSiteAddress
                siteId={site.id}
                address={site.address}
                city={site.city}
                state={site.state}
              />
            ) : site.city ? (
              <p className="text-gray-500 mt-1 flex items-center gap-1">
                {site.address && `${site.address}, `}{site.city}, {site.state}
              </p>
            ) : null}
            {isInternal && hubspotPortalId && (
              <div className="mt-2">
                <SiteDealLink siteId={site.id} existingLinks={hubspotLinks} portalId={hubspotPortalId} fieldMappings={hubspotFieldMappings} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isInternal && assessment?.id && (
              <ShareBaselineFormButton
                siteId={site.id}
                siteName={site.name}
                tenantId={site.tenant_id}
                assessmentId={assessment.id}
              />
            )}

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

      {/* Tabbed layout */}
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
              isInternal={isInternal}
              hubspotDealId={hubspotLinks[0]?.hubspot_deal_id}
              hubspotPortalId={hubspotPortalId}
            />
          ),
          documents: (
            <DocumentsTab
              site={site}
              canAnalyze={isInternal}
              assessmentId={assessment?.id}
            />
          ),
          baseline: isInternal ? (
            <BaselineTabWrapper
              siteId={site.id}
              tenantId={site.tenant_id}
              assessmentId={assessment?.id}
              internalView={
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
                  siteContacts={assessmentData?.siteContacts ?? []}
                  siteContractors={assessmentData?.siteContractors ?? []}
                  networkDiagnostics={assessmentData?.networkDiagnostics ?? null}
                  networkTestResults={assessmentData?.networkTestResults ?? []}
                />
              }
            />
          ) : (
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
              siteContacts={assessmentData?.siteContacts ?? []}
              siteContractors={assessmentData?.siteContractors ?? []}
              networkDiagnostics={assessmentData?.networkDiagnostics ?? null}
              networkTestResults={assessmentData?.networkTestResults ?? []}
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
