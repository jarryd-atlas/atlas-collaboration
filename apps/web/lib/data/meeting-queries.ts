/**
 * Meeting data access queries.
 * Uses service role (admin) client to bypass RLS.
 */

import { createSupabaseAdmin } from "../supabase/server";
import { getDeals } from "../hubspot/client";
import { DEAL_STAGE_LABELS, RENEWAL_STAGE_IDS } from "../hubspot/constants";

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

  // Get series IDs where user is a participant
  const { data: participantRows } = await fromTable(supabase, "meeting_participants")
    .select("series_id")
    .eq("profile_id", profileId);

  if (!participantRows || participantRows.length === 0) return [];

  const seriesIds = participantRows.map((r: any) => r.series_id);

  // Get series with participants
  const { data: seriesList, error } = await fromTable(supabase, "meeting_series")
    .select("*")
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
      *,
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

  // Filter to new business deals only
  const newBizLinks = links.filter((l: any) => l.deal_type !== "renewal");
  const dealIds = [...new Set(newBizLinks.map((l: any) => l.hubspot_deal_id))] as string[];

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

  for (const link of newBizLinks) {
    const site = siteMap.get(link.site_id);
    if (!site) continue;

    const props = dealMap.get(link.hubspot_deal_id);
    if (!props) continue;

    const customerId = site.customer_id;
    if (!result[customerId]) result[customerId] = [];

    const stageId = props.dealstage ?? "";

    result[customerId].push({
      dealId: link.hubspot_deal_id,
      siteId: link.site_id,
      siteName: site.name,
      dealName: props.dealname ?? link.deal_name ?? "",
      dealType: RENEWAL_STAGE_IDS.has(stageId) ? "renewal" : "new_business",
      stage: DEAL_STAGE_LABELS[stageId] ?? stageId,
      amount: props.amount ?? null,
      arr: props.arc ?? null,
      install: props.nrc ?? null,
      upgrade: props.upgrade_revenue ?? null,
      forecastCategory: props.hs_manual_forecast_category ?? null,
      closeDate: props.closedate ?? null,
    });
  }

  return result;
}
