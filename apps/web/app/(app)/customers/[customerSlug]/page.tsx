import { notFound } from "next/navigation";
import { after } from "next/server";
import {
  getCustomerBySlug,
  getSitesForCustomer,
  getFlaggedIssuesForCustomer,
  getCKTeamForCustomer,
  getInternalProfiles,
  getAssignableUsersForCustomer,
  getAllTasksForCustomer,
  getLatestCommentsForTasks,
  getAccountPlan,
  getAccountStakeholders,
  getSuccessPlanGoals,
  getSuccessPlanMilestones,
  getEnterpriseDeal,
  getInitiativesForCustomer,
  getBusinessUnits,
} from "../../../../lib/data/queries";
import { getCurrentUser } from "../../../../lib/data/current-user";
import { getSession, createSupabaseAdmin } from "../../../../lib/supabase/server";
import { triggerCalendarSyncForCurrentUser } from "../../../../lib/calendar/trigger-sync";
import { CustomerDetailLayout } from "../../../../components/customers/customer-detail-layout";

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

  after(triggerCalendarSyncForCurrentUser);

  // ─── Fetch ALL data in one large parallel batch ───────────
  // This avoids the waterfall of sequential fetches.

  let accountPlan: any = null;
  let stakeholders: any[] = [];
  let successGoals: any[] = [];
  let successMilestones: any[] = [];
  let enterpriseDeal: any = null;
  let initiatives: any[] = [];
  let dealLinks: any[] = [];
  let hubspotEnabled = false;
  let latestComments: Record<string, { body: string; authorName: string; createdAt: string }> = {};
  let customerMeetings: any[] = [];
  let customerEmails: any[] = [];
  let emailDigest: any = null;
  let customerTickets: any[] = [];
  let hubspotPortalId: string | null = null;
  let businessUnits: any[] = [];
  let buyingTriggers: any[] = [];
  let accountObjections: any[] = [];

  const supabaseAdmin = createSupabaseAdmin();

  try {
    // Batch 1: Everything that only depends on customer.id (no cascading deps)
    const batch1Promises: Promise<any>[] = [
      /* 0 */ getSitesForCustomer(customer.id),
      /* 1 */ getFlaggedIssuesForCustomer(customer.id),
      /* 2 */ getAssignableUsersForCustomer(customer.id),
      /* 3 */ getAllTasksForCustomer(customer.id),
      /* 4 */ getAccountPlan(customer.id),
      /* 5 */ getInitiativesForCustomer(customer.id).catch(() => []),
      /* 6-base */ getBusinessUnits(customer.id).catch(() => []),
    ];
    if (isCKInternal) {
      /* 7 */ batch1Promises.push(getCKTeamForCustomer(customer.id));
      /* 8 */ batch1Promises.push(getInternalProfiles());
      /* 9 */ batch1Promises.push(getEnterpriseDeal(customer.id).catch(() => null));
      /* 9 */ batch1Promises.push(
        (supabaseAdmin as any).from("customer_meetings")
          .select("id, google_event_id, title, description, meeting_date, meeting_end, location, html_link, organizer_email, attendees, ck_attendees, meeting_brief_id, synced_at")
          .eq("customer_id", customer.id)
          .order("meeting_date", { ascending: false })
          .limit(100)
          .then((r: any) => r.data ?? [])
          .catch(() => [])
      );
      /* 10 */ batch1Promises.push(
        (supabaseAdmin as any).from("customer_emails")
          .select("id, gmail_message_id, gmail_thread_id, subject, snippet, body_plain, from_email, from_name, to_emails, cc_emails, date, direction, ck_user_id, ck_user_email, synced_at")
          .eq("customer_id", customer.id)
          .order("date", { ascending: false })
          .limit(200)
          .then((r: any) => r.data ?? [])
          .catch(() => [])
      );
      /* 11 */ batch1Promises.push(
        (supabaseAdmin as any).from("customer_email_digests")
          .select("*")
          .eq("customer_id", customer.id)
          .maybeSingle()
          .then((r: any) => r.data ?? null)
          .catch(() => null)
      );
      /* 12 */ batch1Promises.push(
        (supabaseAdmin as any).from("customer_tickets")
          .select("id, hubspot_ticket_id, subject, description, status, priority, pipeline, pipeline_stage, created_date, modified_date, closed_date, associated_contacts, source, owner_name, owner_email")
          .eq("customer_id", customer.id)
          .order("created_date", { ascending: false })
          .limit(200)
          .then((r: any) => r.data ?? [])
          .catch(() => [])
      );
      /* 13 */ batch1Promises.push(
        (supabaseAdmin as any).from("hubspot_config")
          .select("id, portal_id, is_active")
          .limit(1)
          .maybeSingle()
          .then((r: any) => ({ enabled: !!r.data, portalId: r.data?.portal_id ?? null }))
          .catch(() => ({ enabled: false, portalId: null }))
      );
      /* 14 */ batch1Promises.push(
        (supabaseAdmin as any).from("account_buying_triggers")
          .select("*")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .then((r: any) => r.data ?? [])
          .catch(() => [])
      );
      /* 15 */ batch1Promises.push(
        (supabaseAdmin as any).from("account_objections")
          .select("*, raised_by:account_stakeholders!raised_by_stakeholder_id(id, name)")
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .then((r: any) => r.data ?? [])
          .catch(() => [])
      );
    }

    const r1 = await Promise.all(batch1Promises);

    sites = r1[0] ?? [];
    issues = r1[1] ?? [];
    const { customerUsers = [], ckTeamMembers = [] } = r1[2] ?? {};
    assignableUsers = [
      ...customerUsers.map((u: any) => ({ ...u, group: "Your Team" })),
      ...ckTeamMembers.map((u: any) => ({ ...u, group: "CK Team" })),
    ];
    customerTasks = r1[3] ?? [];
    accountPlan = r1[4] ?? null;
    initiatives = r1[5] ?? [];
    businessUnits = r1[6] ?? [];
    if (isCKInternal) {
      ckTeam = r1[7] ?? [];
      allInternalProfiles = r1[8] ?? [];
      enterpriseDeal = r1[9] ?? null;
      customerMeetings = r1[10] ?? [];
      customerEmails = r1[11] ?? [];
      emailDigest = r1[12] ?? null;
      customerTickets = r1[13] ?? [];
      const hsConfig = r1[14] ?? { enabled: false, portalId: null };
      hubspotEnabled = hsConfig.enabled;
      hubspotPortalId = hsConfig.portalId;
      buyingTriggers = r1[15] ?? [];
      accountObjections = r1[16] ?? [];
    }
  } catch {
    // Show empty state if queries fail
  }

  // Batch 2: Things that depend on batch 1 results (account plan, site IDs, task IDs)
  // Auto-create account plan if none exists
  if (!accountPlan) {
    try {
      const { data: newPlan } = await (supabaseAdmin as any)
        .from("account_plans")
        .insert({
          customer_id: customer.id,
          tenant_id: customer.tenant_id,
          account_stage: "pilot",
        })
        .select("*")
        .single();
      accountPlan = newPlan;
    } catch {
      // non-critical
    }
  }

  // Batch 2 parallel: stakeholders/goals/milestones + deal links + task comments
  const siteIds = sites.map((s: any) => s.id).filter(Boolean);
  const taskIds = customerTasks.map((t: any) => t.id);

  try {
    const batch2Promises: Promise<any>[] = [
      /* 0 */ getLatestCommentsForTasks(taskIds).catch(() => ({})),
    ];
    if (accountPlan) {
      /* 1 */ batch2Promises.push(getAccountStakeholders(accountPlan.id));
      /* 2 */ batch2Promises.push(getSuccessPlanGoals(accountPlan.id));
      /* 3 */ batch2Promises.push(getSuccessPlanMilestones(accountPlan.id));
    }
    if (isCKInternal && siteIds.length > 0) {
      /* 4 (or 1) */ batch2Promises.push(
        (supabaseAdmin as any).from("hubspot_site_links")
          .select("id, site_id, hubspot_deal_id, deal_name, deal_type")
          .in("site_id", siteIds)
          .then((r: any) => r.data ?? [])
          .catch(() => [])
      );
    }

    const r2 = await Promise.all(batch2Promises);
    latestComments = r2[0] ?? {};

    if (accountPlan) {
      stakeholders = r2[1] ?? [];
      successGoals = r2[2] ?? [];
      successMilestones = r2[3] ?? [];
      if (isCKInternal && siteIds.length > 0) {
        dealLinks = r2[4] ?? [];
      }
    } else if (isCKInternal && siteIds.length > 0) {
      dealLinks = r2[1] ?? [];
    }
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

  return (
    <CustomerDetailLayout
      customer={{
        id: customer.id,
        name: customer.name,
        domain: customer.domain,
        company_type: customer.company_type,
        tenant_id: customer.tenant_id,
        hq_address: (customer as any).hq_address ?? null,
        hq_city: (customer as any).hq_city ?? null,
        hq_state: (customer as any).hq_state ?? null,
        hq_zip: (customer as any).hq_zip ?? null,
        hq_latitude: (customer as any).hq_latitude ?? null,
        hq_longitude: (customer as any).hq_longitude ?? null,
      }}
      customerSlug={customerSlug}
      sites={sites as any}
      tasks={tasksWithComments}
      issues={issues as any}
      isCKInternal={isCKInternal}
      ckTeam={ckTeam}
      internalProfiles={allInternalProfiles}
      assignableUsers={assignableUsers}
      dealLinks={dealLinks}
      hubspotEnabled={hubspotEnabled}
      currentUserName={currentUserName as string}
      currentUserAvatar={currentUserAvatar as string | undefined}
      accountPlan={accountPlan}
      stakeholders={stakeholders}
      goals={successGoals}
      milestones={successMilestones}
      enterpriseDeal={enterpriseDeal}
      profileId={session?.claims?.profileId}
      customerMeetings={customerMeetings}
      customerEmails={customerEmails}
      emailDigest={emailDigest}
      customerTickets={customerTickets}
      hubspotPortalId={hubspotPortalId}
      currentUserId={session?.user?.id}
      initiatives={initiatives}
      businessUnits={businessUnits}
      buyingTriggers={buyingTriggers}
      accountObjections={accountObjections}
    />
  );
}
