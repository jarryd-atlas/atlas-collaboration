/**
 * Meeting data access queries.
 * Uses service role (admin) client to bypass RLS.
 */

import { createSupabaseAdmin } from "../supabase/server";
import { getDeals } from "../hubspot/client";
import { DEAL_STAGE_LABELS, CLOSED_STAGE_IDS, getDealType } from "../hubspot/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

// ─── Meeting Series ─────────────────────────────────────────

/**
 * Get all meeting series where the given profile is a participant.
 * Returns series info + participant profiles + latest meeting date + open action item count.
 */
export async function getMeetingSeries(profileId: string) {
  const supabase = createSupabaseAdmin();

  // Get series IDs where user is a participant (covers standup / 1:1)
  const { data: participantRows } = await fromTable(supabase, "meeting_participants")
    .select("series_id")
    .eq("profile_id", profileId);

  const participantSeriesIds = new Set<string>(
    (participantRows ?? []).map((r: any) => r.series_id),
  );

  // Account 360 series are visible to all internal users — fetch those too.
  const { data: a360Rows } = await fromTable(supabase, "meeting_series")
    .select("id")
    .eq("type", "account_360");

  for (const r of (a360Rows ?? []) as any[]) participantSeriesIds.add(r.id);

  if (participantSeriesIds.size === 0) return [];

  const seriesIds = [...participantSeriesIds];

  // Get series with participants
  const { data: seriesList, error } = await fromTable(supabase, "meeting_series")
    .select("*, customer:customers(id, name, slug)")
    .in("id", seriesIds)
    .order("updated_at", { ascending: false });

  if (error || !seriesList) return [];

  // Get participants for all series
  const { data: allParticipants } = await fromTable(supabase, "meeting_participants")
    .select("series_id, profile_id, profiles:profiles(id, full_name, avatar_url, email)")
    .in("series_id", seriesIds);

  // Get latest meeting per series
  const { data: latestMeetings } = await fromTable(supabase, "meetings")
    .select("series_id, meeting_date, status")
    .in("series_id", seriesIds)
    .order("meeting_date", { ascending: false });

  // Get open action item counts per series
  const { data: actionItems } = await fromTable(supabase, "meeting_items")
    .select("meeting_id, meetings!inner(series_id)")
    .eq("type", "action_item")
    .eq("completed", false)
    .in("meetings.series_id", seriesIds);

  // Build result
  return seriesList.map((series: any) => {
    const participants = (allParticipants ?? [])
      .filter((p: any) => p.series_id === series.id)
      .map((p: any) => p.profiles);

    const latestMeeting = (latestMeetings ?? []).find((m: any) => m.series_id === series.id);

    const openActionItems = (actionItems ?? []).filter(
      (ai: any) => ai.meetings?.series_id === series.id
    ).length;

    return {
      ...series,
      participants,
      latest_meeting_date: latestMeeting?.meeting_date ?? null,
      latest_meeting_status: latestMeeting?.status ?? null,
      open_action_items: openActionItems,
    };
  });
}

/**
 * Get a single meeting series with full participant info.
 */
export async function getMeetingSeriesDetail(seriesId: string) {
  const supabase = createSupabaseAdmin();

  const { data: series, error } = await fromTable(supabase, "meeting_series")
    .select("*")
    .eq("id", seriesId)
    .single();

  if (error || !series) return null;

  const { data: participants } = await fromTable(supabase, "meeting_participants")
    .select("profile_id, profiles:profiles(id, full_name, avatar_url, email)")
    .eq("series_id", seriesId);

  return {
    ...series,
    participants: (participants ?? []).map((p: any) => ({
      id: p.profiles.id,
      full_name: p.profiles.full_name,
      avatar_url: p.profiles.avatar_url,
      email: p.profiles.email,
    })),
  };
}

// ─── Meetings ───────────────────────────────────────────────

/**
 * Get all meetings for a series with their items.
 */
export async function getMeetingsWithItems(seriesId: string, limit = 10) {
  const supabase = createSupabaseAdmin();

  const { data: meetings, error } = await fromTable(supabase, "meetings")
    .select("*")
    .eq("series_id", seriesId)
    .order("meeting_date", { ascending: false })
    .limit(limit);

  if (error || !meetings || meetings.length === 0) return [];

  const meetingIds = meetings.map((m: any) => m.id);

  const { data: items } = await fromTable(supabase, "meeting_items")
    .select(`
      id, meeting_id, type, body, section, customer_id, site_id,
      author_id, assignee_id, due_date, completed, task_id, sort_order, created_at,
      author:profiles!meeting_items_author_id_fkey(id, full_name, avatar_url),
      assignee:profiles!meeting_items_assignee_id_fkey(id, full_name, avatar_url),
      customer:customers(id, name, slug)
    `)
    .in("meeting_id", meetingIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return meetings.map((meeting: any) => ({
    ...meeting,
    items: (items ?? []).filter((item: any) => item.meeting_id === meeting.id),
  }));
}

/**
 * Get a single meeting with items.
 */
export async function getMeetingWithItems(meetingId: string) {
  const supabase = createSupabaseAdmin();

  const { data: meeting, error } = await fromTable(supabase, "meetings")
    .select("*")
    .eq("id", meetingId)
    .single();

  if (error || !meeting) return null;

  const { data: items } = await fromTable(supabase, "meeting_items")
    .select(`
      *,
      author:profiles!meeting_items_author_id_fkey(id, full_name, avatar_url),
      assignee:profiles!meeting_items_assignee_id_fkey(id, full_name, avatar_url),
      customer:customers(id, name, slug)
    `)
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return {
    ...meeting,
    items: items ?? [],
  };
}

// ─── Standup Customer Data ──────────────────────────────────

/**
 * Get operational summary data for customers to display in standup dashboard.
 * Fetches pipeline stages, task counts, milestone progress, doc status, issues.
 */
export async function getStandupCustomerData() {
  const supabase = createSupabaseAdmin();

  // Get all active customers
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, slug")
    .order("name");

  if (!customers || customers.length === 0) return [];

  const customerIds = customers.map((c) => c.id);

  // Parallel fetch all data
  const [sitesRes, tasksRes, milestonesRes, issuesRes, attachmentsRes] = await Promise.all([
    // Sites with pipeline stages and next steps
    supabase
      .from("sites")
      .select("id, customer_id, name, pipeline_stage, next_step")
      .in("customer_id", customerIds),

    // Open tasks with due dates and assignee info
    supabase
      .from("tasks")
      .select("id, customer_id, site_id, status, due_date, assignee_id, title, created_at, profiles:assignee_id(id, full_name, avatar_url)")
      .in("customer_id", customerIds)
      .neq("status", "done"),

    // Active milestones
    (supabase as any)
      .from("milestones")
      .select("id, site_id, name, status, progress")
      .eq("status", "in_progress"),

    // Open issues
    (supabase as any)
      .from("flagged_issues")
      .select("id, site_id, status, severity")
      .eq("status", "open"),

    // Attachment counts per site
    supabase
      .from("attachments")
      .select("id, site_id")
      .in("site_id", (await supabase.from("sites").select("id").in("customer_id", customerIds)).data?.map((s: any) => s.id) ?? []),
  ]);

  const sites = (sitesRes.data ?? []) as any[];
  const tasks = (tasksRes.data ?? []) as any[];
  const milestones = (milestonesRes.data ?? []) as any[];
  const issues = (issuesRes.data ?? []) as any[];
  const attachments = (attachmentsRes.data ?? []) as any[];

  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekFromNowStr = weekFromNow.toISOString().split("T")[0]!;
  const nowStr = now.toISOString().split("T")[0]!;

  return customers.map((customer) => {
    const customerSites = sites.filter((s: any) => s.customer_id === customer.id);
    const customerSiteIds = customerSites.map((s: any) => s.id);
    const customerTasks = tasks.filter((t: any) => t.customer_id === customer.id);
    const customerMilestones = milestones.filter((m: any) => customerSiteIds.includes(m.site_id));
    const customerIssues = issues.filter((i: any) => customerSiteIds.includes(i.site_id));
    const customerAttachments = attachments.filter((a: any) => customerSiteIds.includes(a.site_id));

    // Tasks due this week
    const tasksDueThisWeek = customerTasks.filter(
      (t: any) => t.due_date && t.due_date >= nowStr && t.due_date <= weekFromNowStr
    );

    // Pipeline stage summary
    const stageCounts: Record<string, number> = {};
    for (const site of customerSites) {
      stageCounts[site.pipeline_stage] = (stageCounts[site.pipeline_stage] ?? 0) + 1;
    }

    // Next steps from sites
    const nextSteps = customerSites
      .filter((s: any) => s.next_step)
      .map((s: any) => ({ siteName: s.name, nextStep: s.next_step }));

    return {
      id: customer.id,
      name: customer.name,
      slug: customer.slug,
      sites: {
        total: customerSites.length,
        stages: stageCounts,
        disqualified: customerSites.filter((s: any) => s.pipeline_stage === "disqualified").length,
      },
      tasks: {
        open: customerTasks.length,
        dueThisWeek: tasksDueThisWeek.length,
        overdue: customerTasks.filter(
          (t: any) => t.due_date && t.due_date < nowStr
        ).length,
      },
      milestones: {
        active: customerMilestones.length,
        items: customerMilestones.map((m: any) => ({
          name: m.name,
          progress: m.progress ?? 0,
        })),
      },
      issues: {
        open: customerIssues.length,
      },
      documents: {
        count: customerAttachments.length,
      },
      nextSteps,
      sitesList: customerSites.map((s: any) => ({ id: s.id, name: s.name })),
      tasksList: customerTasks
        .sort((a: any, b: any) => {
          // Overdue first, then due soon, then rest
          if (a.due_date && !b.due_date) return -1;
          if (!a.due_date && b.due_date) return 1;
          if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
          return 0;
        })
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          due_date: t.due_date,
          site_id: t.site_id,
          assignee: t.profiles ? { id: t.profiles.id, full_name: t.profiles.full_name, avatar_url: t.profiles.avatar_url } : null,
          siteName: customerSites.find((s: any) => s.id === t.site_id)?.name ?? null,
        })),
    };
  }).filter((c) => c.sites.total > 0); // Only show customers with sites
}

// ─── HubSpot Deal Data for Standup ──────────────────────

const STANDUP_DEAL_PROPERTIES = [
  "dealname", "dealstage", "amount", "arc", "nrc",
  "upgrade_revenue", "hs_manual_forecast_category", "closedate", "pipeline",
];

export interface StandupDeal {
  dealId: string;
  siteId: string;
  siteName: string;
  dealName: string;
  dealType: "new_business" | "renewal";
  stage: string;
  amount: string | null;
  arr: string | null;
  install: string | null;
  upgrade: string | null;
  forecastCategory: string | null;
  closeDate: string | null;
}

/**
 * Fetch HubSpot deal data for all linked sites, grouped by customer.
 * Returns a map of customerId → StandupDeal[].
 */
export async function getStandupDealData(): Promise<Record<string, StandupDeal[]>> {
  const supabase = createSupabaseAdmin();

  // Get HubSpot config (access token)
  const { data: config } = await (supabase as any)
    .from("hubspot_config")
    .select("access_token, is_active")
    .limit(1)
    .single();

  if (!config?.is_active || !config?.access_token) return {};

  // Get all site links with site info
  const { data: links } = await (supabase as any)
    .from("hubspot_site_links")
    .select("hubspot_deal_id, site_id, deal_name, deal_type");

  if (!links || links.length === 0) return {};

  // Get site → customer mapping
  const siteIds = [...new Set(links.map((l: any) => l.site_id))] as string[];
  const { data: sites } = await supabase
    .from("sites")
    .select("id, name, customer_id")
    .in("id", siteIds);

  const siteMap = new Map((sites ?? []).map((s: any) => [s.id, s]));

  // Fetch all deals (new biz + renewals)
  const dealIds = [...new Set(links.map((l: any) => l.hubspot_deal_id))] as string[];

  if (dealIds.length === 0) return {};

  // Batch-fetch deal properties from HubSpot
  let deals: any[] = [];
  try {
    deals = await getDeals(config.access_token, dealIds, STANDUP_DEAL_PROPERTIES);
  } catch {
    return {}; // HubSpot API error — non-critical
  }

  const dealMap = new Map(deals.map((d: any) => [d.id, d.properties]));

  // Build result grouped by customer
  const result: Record<string, StandupDeal[]> = {};

  for (const link of links) {
    const site = siteMap.get(link.site_id);
    if (!site) continue;

    const props = dealMap.get(link.hubspot_deal_id);
    if (!props) continue;

    // Exclude closed deals (won/lost)
    const stageId = props.dealstage ?? "";
    if (CLOSED_STAGE_IDS.has(stageId)) continue;

    const customerId = site.customer_id;
    if (!result[customerId]) result[customerId] = [];

    result[customerId].push({
      dealId: link.hubspot_deal_id,
      siteId: link.site_id,
      siteName: site.name,
      dealName: props.dealname ?? link.deal_name ?? "",
      dealType: getDealType(stageId, props.pipeline),
      stage: DEAL_STAGE_LABELS[stageId] ?? stageId,
      amount: props.amount ?? null,
      arr: props.arc ?? null,
      install: props.nrc ?? null,
      upgrade: props.upgrade_revenue ?? null,
      forecastCategory: props.hs_manual_forecast_category?.toLowerCase() ?? null,
      closeDate: props.closedate ?? null,
    });
  }

  return result;
}

// ─── Cross-Customer Meeting Query ──────────────────────

export interface DashboardMeeting {
  id: string;
  title: string;
  meeting_date: string;
  meeting_end: string | null;
  html_link: string | null;
  attendees: { email: string; name: string; responseStatus?: string }[];
  ck_attendees: { email: string; name: string }[];
  customer_id: string;
  customer_name: string;
  customer_slug: string;
}

/**
 * Fetches upcoming meetings across all customers for the next 2 weeks.
 */
export async function getUpcomingMeetingsAllCustomers(limit = 20): Promise<DashboardMeeting[]> {
  const supabase = createSupabaseAdmin();

  const now = new Date();
  // End of next week (Saturday 23:59)
  const endOfNextWeek = new Date(now);
  const dayOfWeek = endOfNextWeek.getDay();
  endOfNextWeek.setDate(endOfNextWeek.getDate() + (13 - dayOfWeek));
  endOfNextWeek.setHours(23, 59, 59, 999);

  const { data } = await fromTable(supabase, "customer_meetings")
    .select("id, title, meeting_date, meeting_end, html_link, attendees, ck_attendees, customer_id")
    .gte("meeting_date", now.toISOString())
    .lte("meeting_date", endOfNextWeek.toISOString())
    .order("meeting_date", { ascending: true })
    .limit(limit);

  if (!data || data.length === 0) return [];

  // Get customer names
  const customerIds = [...new Set((data as any[]).map((m) => m.customer_id))];
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, slug")
    .in("id", customerIds);

  const customerMap = new Map((customers ?? []).map((c: any) => [c.id, c]));

  return (data as any[]).map((m) => ({
    id: m.id,
    title: m.title,
    meeting_date: m.meeting_date,
    meeting_end: m.meeting_end,
    html_link: m.html_link,
    attendees: m.attendees ?? [],
    ck_attendees: m.ck_attendees ?? [],
    customer_id: m.customer_id,
    customer_name: customerMap.get(m.customer_id)?.name ?? "Unknown",
    customer_slug: customerMap.get(m.customer_id)?.slug ?? "",
  }));
}

// ─── Stakeholder Enrichment for Standup ───────────────────────

/**
 * Fetch enriched stakeholder data grouped by customer_id.
 * Used in the standup view to display enriched meeting attendee info.
 */
export async function getStandupStakeholderData(): Promise<
  Record<string, Array<{
    id: string;
    name: string;
    email: string | null;
    title: string | null;
    department: string | null;
    stakeholder_role: string | null;
    notes: string | null;
  }>>
> {
  const supabase = createSupabaseAdmin();

  // Get all account plans with their customer_id
  const { data: plans } = await fromTable(supabase, "account_plans")
    .select("id, customer_id");

  if (!plans || plans.length === 0) return {};

  const planIds = plans.map((p: any) => p.id);
  const planToCustomer = new Map<string, string>();
  for (const p of plans as any[]) {
    planToCustomer.set(p.id, p.customer_id);
  }

  // Fetch all stakeholders with enrichment fields
  const { data: stakeholders } = await fromTable(supabase, "account_stakeholders")
    .select("id, account_plan_id, name, email, title, department, stakeholder_role, notes")
    .in("account_plan_id", planIds);

  if (!stakeholders || stakeholders.length === 0) return {};

  // Group by customer_id
  const result: Record<string, any[]> = {};
  for (const s of stakeholders as any[]) {
    const customerId = planToCustomer.get(s.account_plan_id);
    if (!customerId) continue;
    if (!result[customerId]) result[customerId] = [];
    result[customerId].push({
      id: s.id,
      name: s.name,
      email: s.email,
      title: s.title,
      department: s.department,
      stakeholder_role: s.stakeholder_role,
      notes: s.notes,
    });
  }

  return result;
}
