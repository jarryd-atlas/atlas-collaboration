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
  getAccountPlan,
  getAccountStakeholders,
  getSuccessPlanGoals,
  getSuccessPlanMilestones,
  getEnterpriseDeal,
} from "../../../../lib/data/queries";
import { getCurrentUser } from "../../../../lib/data/current-user";
import { getSession, createSupabaseAdmin } from "../../../../lib/supabase/server";
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

  // Fetch HubSpot deal links for all sites
  const siteIds = sites.map((s: any) => s.id).filter(Boolean);
  let dealLinks: any[] = [];
  let hubspotEnabled = false;
  if (isCKInternal && siteIds.length > 0) {
    try {
      const supabaseAdmin = createSupabaseAdmin();
      const [linksRes, configRes] = await Promise.all([
        (supabaseAdmin as any).from("hubspot_site_links")
          .select("id, site_id, hubspot_deal_id, deal_name, deal_type")
          .in("site_id", siteIds),
        (supabaseAdmin as any).from("hubspot_config")
          .select("id")
          .limit(1),
      ]);
      dealLinks = linksRes.data ?? [];
      hubspotEnabled = (configRes.data?.length ?? 0) > 0;
    } catch {
      // non-critical
    }
  }

  // Fetch account plan data
  let accountPlan: any = null;
  let stakeholders: any[] = [];
  let successGoals: any[] = [];
  let successMilestones: any[] = [];
  let enterpriseDeal: any = null;

  try {
    accountPlan = await getAccountPlan(customer.id);

    // Auto-create account plan if none exists
    if (!accountPlan) {
      const supabaseForPlan = createSupabaseAdmin();
      const { data: newPlan } = await (supabaseForPlan as any)
        .from("account_plans")
        .insert({
          customer_id: customer.id,
          tenant_id: customer.tenant_id,
          account_stage: "pilot",
        })
        .select("*")
        .single();
      accountPlan = newPlan;
    }

    if (accountPlan) {
      const [sh, gl, ms] = await Promise.all([
        getAccountStakeholders(accountPlan.id),
        getSuccessPlanGoals(accountPlan.id),
        getSuccessPlanMilestones(accountPlan.id),
      ]);
      stakeholders = sh;
      successGoals = gl;
      successMilestones = ms;
    }

    if (isCKInternal) {
      enterpriseDeal = await getEnterpriseDeal(customer.id);
    }
  } catch {
    // non-critical — show empty account plan
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

  // Fetch customer meetings (from Google Calendar sync)
  let customerMeetings: any[] = [];
  if (isCKInternal) {
    try {
      const supabaseForMeetings = createSupabaseAdmin();
      const { data: meetingsData } = await (supabaseForMeetings as any)
        .from("customer_meetings")
        .select("id, google_event_id, title, description, meeting_date, meeting_end, location, html_link, organizer_email, attendees, ck_attendees, meeting_brief_id, synced_at")
        .eq("customer_id", customer.id)
        .order("meeting_date", { ascending: false })
        .limit(100);
      customerMeetings = meetingsData ?? [];
    } catch {
      // non-critical — table may not exist yet
    }
  }

  // Fetch customer emails (from Gmail sync)
  let customerEmails: any[] = [];
  let emailDigest: any = null;
  if (isCKInternal) {
    try {
      const supabaseForEmails = createSupabaseAdmin();
      const { data: emailsData } = await (supabaseForEmails as any)
        .from("customer_emails")
        .select("id, gmail_message_id, gmail_thread_id, subject, snippet, body_plain, from_email, from_name, to_emails, cc_emails, date, direction, ck_user_id, ck_user_email, synced_at")
        .eq("customer_id", customer.id)
        .order("date", { ascending: false })
        .limit(200);
      customerEmails = emailsData ?? [];

      const { data: digestData } = await (supabaseForEmails as any)
        .from("customer_email_digests")
        .select("*")
        .eq("customer_id", customer.id)
        .maybeSingle();
      emailDigest = digestData ?? null;
    } catch {
      // non-critical — tables may not exist yet
    }
  }

  // Fetch customer tickets (from HubSpot sync) and portal ID for HubSpot links
  let customerTickets: any[] = [];
  let hubspotPortalId: string | null = null;
  if (isCKInternal) {
    try {
      const supabaseForTickets = createSupabaseAdmin();
      const [ticketsRes, portalRes] = await Promise.all([
        (supabaseForTickets as any)
          .from("customer_tickets")
          .select("id, hubspot_ticket_id, subject, description, status, priority, pipeline, pipeline_stage, created_date, modified_date, closed_date, associated_contacts, source, owner_name, owner_email")
          .eq("customer_id", customer.id)
          .order("created_date", { ascending: false })
          .limit(200),
        (supabaseForTickets as any)
          .from("hubspot_config")
          .select("portal_id")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle(),
      ]);
      customerTickets = ticketsRes.data ?? [];
      hubspotPortalId = portalRes.data?.portal_id ?? null;
    } catch {
      // non-critical — table may not exist yet
    }
  }

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
    />
  );
}
