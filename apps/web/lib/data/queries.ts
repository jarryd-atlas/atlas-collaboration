/**
 * Supabase data access queries.
 * All queries use the service role (admin) client to bypass RLS.
 * Auth checks are handled by server actions and middleware.
 * Pages handle empty results gracefully when the database has no data.
 */

import { createSupabaseServer, createSupabaseAdmin } from "../supabase/server";
import type { SiteRow } from "@repo/supabase";

// NOTE: Assessment tables not yet in generated Supabase types — cast to any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

// ─── Customers ──────────────────────────────────────────────

export async function getCustomers() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("name");

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getCustomerBySlug(slug: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

// ─── Sites ──────────────────────────────────────────────────

export async function getSitesForCustomer(customerId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("customer_id", customerId)
    .order("name");

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getSiteBySlug(customerSlug: string, siteSlug: string) {
  const customer = await getCustomerBySlug(customerSlug);
  if (!customer) return null;

  const customerId = (customer as { id: string }).id;

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .eq("customer_id", customerId)
    .eq("slug", siteSlug)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

// ─── Milestones ─────────────────────────────────────────────

export async function getMilestonesForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getMilestoneBySlug(siteId: string, milestoneSlug: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("site_id", siteId)
    .eq("slug", milestoneSlug)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

/**
 * Get milestone templates. Returns global ATLAS templates + any company-specific ones.
 * @param customerId - If provided, includes company-specific templates alongside global ones
 */
export async function getMilestoneTemplates(customerId?: string) {
  const supabase = createSupabaseAdmin();

  if (customerId) {
    // Get global templates (customer_id is null) + company-specific ones
    const { data, error } = await supabase
      .from("milestone_templates")
      .select("*")
      .or(`customer_id.is.null,customer_id.eq.${customerId}`)
      .order("sort_order");

    if (error) throw error;
    return (data ?? []) as any[];
  }

  // Global templates only
  const { data, error } = await supabase
    .from("milestone_templates")
    .select("*")
    .is("customer_id", null)
    .order("sort_order");

  if (error) throw error;
  return (data ?? []) as any[];
}

// ─── Tasks ──────────────────────────────────────────────────

export async function getTasksForMilestone(milestoneId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)")
    .eq("milestone_id", milestoneId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getMyTasks(profileId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
      milestone:milestones!inner(
        id, name, slug,
        site:sites!inner(
          id, name, slug,
          customer:customers!inner(id, name, slug)
        )
      )
    `)
    .eq("assignee_id", profileId)
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as any[];
}

// ─── Comments ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCommentsForEntity(entityType: any, entityId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("comments")
    .select("*, author:profiles!comments_author_id_fkey(id, full_name, avatar_url)")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

// ─── Flagged Issues ─────────────────────────────────────────

export async function getFlaggedIssuesForSites(siteIds: string[]) {
  if (siteIds.length === 0) return [];
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("flagged_issues")
    .select("*, flagged_by_profile:profiles!flagged_issues_flagged_by_fkey(full_name), site:sites!inner(name)")
    .in("site_id", siteIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getAllFlaggedIssues() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("flagged_issues")
    .select("*, flagged_by_profile:profiles!flagged_issues_flagged_by_fkey(full_name), site:sites!inner(name)")
    .neq("status", "resolved")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as any[];
}

// ─── Notifications ──────────────────────────────────────────

export async function getUnreadNotifications(profileId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profileId)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as any[];
}

// ─── Profiles ───────────────────────────────────────────────

export async function getAllProfiles() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("*, tenant:tenants(id, name, type)")
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getActiveProfiles() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", "active")
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getPendingProfiles() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("status", ["pending", "pending_approval"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getProfileById(profileId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("profiles")
    .select("*, tenant:tenants!inner(id, name, type)")
    .eq("id", profileId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

// ─── Reports (public - uses service role) ───────────────────

export async function getPublicReport(slug: string) {
  const supabase = createSupabaseAdmin();
  const { data: report, error: reportError } = await supabase
    .from("status_reports")
    .select("*, customer:customers!inner(name, logo_url), site:sites(name)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (reportError) return null;
  const reportData = report as any;

  const { data: sections } = await supabase
    .from("report_sections")
    .select("*")
    .eq("report_id", reportData.id)
    .order("sort_order");

  return { report: reportData, sections: sections ?? [] };
}

// ─── Assignable Users (for task assignment) ─────────────────

/**
 * Get all users assignable for tasks within a customer context.
 * Returns customer org members + CK team members assigned to this customer.
 */
export async function getAssignableUsersForCustomer(customerId: string) {
  const supabase = createSupabaseAdmin();

  // Get the customer's tenant_id
  const { data: customer } = await supabase
    .from("customers")
    .select("tenant_id")
    .eq("id", customerId)
    .single();

  if (!customer) return { customerUsers: [], ckTeamMembers: [] };

  // Customer org members
  const { data: customerUsers } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email, role")
    .eq("tenant_id", (customer as any).tenant_id)
    .eq("status", "active")
    .order("full_name");

  // CK team members assigned to this customer
  const { data: ckTeam } = await supabase
    .from("customer_team_members" as any)
    .select("role_label, profile:profiles!inner(id, full_name, avatar_url, email)")
    .eq("customer_id", customerId);

  return {
    customerUsers: (customerUsers ?? []) as any[],
    ckTeamMembers: (ckTeam ?? []).map((row: any) => ({
      ...(row.profile ?? {}),
      role_label: row.role_label,
    })),
  };
}

/**
 * Get CK team members assigned to a customer (for management UI).
 */
export async function getCKTeamForCustomer(customerId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("customer_team_members" as any)
    .select("id, role_label, created_at, profile:profiles!inner(id, full_name, avatar_url, email)")
    .eq("customer_id", customerId)
    .order("created_at");

  if (error) return [];
  return (data ?? []) as any[];
}

/**
 * Get site access restrictions for a profile.
 * Empty array = company-level (unrestricted).
 */
export async function getSiteAccessForProfile(profileId: string) {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase
    .from("site_access" as any)
    .select("site_id")
    .eq("profile_id", profileId);

  return (data ?? []).map((row: any) => row.site_id as string);
}

/**
 * Get all active CK internal profiles (for CK team member picker).
 */
export async function getInternalProfiles() {
  const supabase = createSupabaseAdmin();

  // Get the internal tenant
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("type", "internal")
    .single();

  if (!tenant) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .eq("status", "active")
    .eq("tenant_id", tenant.id)
    .order("full_name");

  if (error) return [];
  return (data ?? []) as any[];
}

/**
 * Get tasks for a customer (company-level tasks not tied to a site).
 */
export async function getCustomerTasks(customerId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)")
    .eq("customer_id", customerId)
    .is("site_id", null)
    .is("milestone_id", null)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as any[];
}

/**
 * Get the latest comment for each task in a set of task IDs.
 * Returns a map: { [taskId]: { body, authorName, createdAt } }
 */
export async function getLatestCommentsForTasks(
  taskIds: string[],
): Promise<Record<string, { body: string; authorName: string; createdAt: string }>> {
  if (taskIds.length === 0) return {};

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("comments")
    .select("entity_id, body, created_at, author:profiles!comments_author_id_fkey(full_name)")
    .eq("entity_type", "task")
    .in("entity_id", taskIds)
    .order("created_at", { ascending: false });

  if (error || !data) return {};

  // Deduplicate: keep only the latest (first) comment per task
  const result: Record<string, { body: string; authorName: string; createdAt: string }> = {};
  for (const row of data as any[]) {
    if (!result[row.entity_id]) {
      result[row.entity_id] = {
        body: row.body,
        authorName: row.author?.full_name ?? "Unknown",
        createdAt: row.created_at,
      };
    }
  }
  return result;
}

// ─── Dashboard stats ────────────────────────────────────────

export async function getDashboardStats() {
  const supabase = createSupabaseAdmin();

  const [customersRes, sitesRes, milestonesRes, tasksRes, issuesRes] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("sites").select("*"),
    supabase.from("milestones").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
    supabase.from("flagged_issues").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);

  const sites = (sitesRes.data ?? []) as SiteRow[];

  return {
    totalCustomers: customersRes.count ?? 0,
    totalSites: sites.length,
    activeSites: sites.filter((s) => s.pipeline_stage === "active").length,
    inEvaluation: sites.filter((s) => s.pipeline_stage === "evaluation").length,
    activeMilestones: milestonesRes.count ?? 0,
    openTasks: tasksRes.count ?? 0,
    openIssues: issuesRes.count ?? 0,
  };
}

// ─── Voice Notes ────────────────────────────────────────

export async function getVoiceNotes() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("voice_notes")
    .select(`
      *,
      recorded_by_profile:profiles!voice_notes_recorded_by_fkey(full_name, avatar_url),
      site:sites(name),
      milestone:milestones(name),
      transcription:transcriptions(raw_text, summary, extracted_tasks, extracted_decisions, extracted_updates)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Flatten transcription data onto the voice note for easier consumption
  return ((data ?? []) as any[]).map((note: any) => {
    const t = Array.isArray(note.transcription) ? note.transcription[0] : note.transcription;
    return {
      ...note,
      duration: note.duration_sec ?? 0,
      audio_url: note.file_path ?? null,
      transcript: t?.raw_text ?? null,
      summary: t?.summary ?? null,
      extracted_tasks: t?.extracted_tasks ?? [],
      extracted_decisions: t?.extracted_decisions ?? [],
      extracted_updates: t?.extracted_updates ?? [],
      error_message: null,
    };
  });
}

export async function getVoiceNoteById(noteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("voice_notes")
    .select(`
      *,
      recorded_by_profile:profiles!voice_notes_recorded_by_fkey(full_name, avatar_url),
      site:sites(name),
      milestone:milestones(name),
      transcription:transcriptions(raw_text, summary, extracted_tasks, extracted_decisions, extracted_updates)
    `)
    .eq("id", noteId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  const d = data as any;

  // Flatten transcription data
  const t = Array.isArray(d.transcription) ? d.transcription[0] : d.transcription;
  return {
    ...d,
    duration: d.duration_sec ?? 0,
    audio_url: d.file_path ?? null,
    transcript: t?.raw_text ?? null,
    summary: t?.summary ?? null,
    extracted_tasks: t?.extracted_tasks ?? [],
    extracted_decisions: t?.extracted_decisions ?? [],
    extracted_updates: t?.extracted_updates ?? [],
    error_message: null,
  };
}

// ─── Status Reports ─────────────────────────────────────

export async function getReports(filter?: "all" | "draft" | "published") {
  const supabase = createSupabaseAdmin();
  let query = supabase
    .from("status_reports")
    .select("*, customer:customers!inner(name), site:sites(name), created_by_profile:profiles!status_reports_created_by_fkey(full_name)")
    .order("created_at", { ascending: false });

  if (filter === "draft") {
    query = query.eq("status", "draft");
  } else if (filter === "published") {
    query = query.eq("status", "published");
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getReportById(reportId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("status_reports")
    .select("*, customer:customers!inner(name), site:sites(name), created_by_profile:profiles!status_reports_created_by_fkey(full_name)")
    .eq("id", reportId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getReportSections(reportId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("report_sections")
    .select("*")
    .eq("report_id", reportId)
    .order("sort_order");

  if (error) throw error;
  return (data ?? []) as any[];
}

// ─── All Tasks (for tasks page) ─────────────────────────

export async function getAllOpenTasks() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
      milestone:milestones(
        id, name, slug,
        site:sites(
          id, name, slug,
          customer:customers(id, name, slug)
        )
      ),
      direct_customer:customers!tasks_customer_id_fkey(id, name, slug)
    `)
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as any[];
}

/**
 * Get tasks relevant to a specific user — assigned to them OR created by them.
 * This powers the "My Tasks" view.
 */
export async function getMyRelevantTasks(profileId: string) {
  const supabase = createSupabaseAdmin();

  // Fetch tasks assigned to or created by this user
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .neq("status", "done")
    .or(`assignee_id.eq.${profileId},created_by.eq.${profileId}`)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[getMyRelevantTasks] Error:", error);
    return [];
  }
  if (!tasks || tasks.length === 0) return [];

  // Resolve context separately to avoid PostgREST join issues
  const assigneeIds = [...new Set(tasks.map((t: any) => t.assignee_id).filter(Boolean))];
  const milestoneIds = [...new Set(tasks.map((t: any) => t.milestone_id).filter(Boolean))];
  const siteIds = [...new Set(tasks.map((t: any) => t.site_id).filter(Boolean))];
  const customerIds = [...new Set(tasks.map((t: any) => t.customer_id).filter(Boolean))];

  // Parallel fetches for context
  const [profilesRes, milestonesRes, sitesRes, customersRes] = await Promise.all([
    assigneeIds.length > 0
      ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", assigneeIds)
      : { data: [] },
    milestoneIds.length > 0
      ? supabase.from("milestones").select("id, name, slug, site_id").in("id", milestoneIds)
      : { data: [] },
    siteIds.length > 0
      ? supabase.from("sites").select("id, name, slug, customer_id").in("id", siteIds)
      : { data: [] },
    customerIds.length > 0
      ? supabase.from("customers").select("id, name, slug").in("id", customerIds)
      : { data: [] },
  ]);

  const profilesMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
  const milestonesMap = new Map((milestonesRes.data ?? []).map((m: any) => [m.id, m]));
  const sitesMap = new Map((sitesRes.data ?? []).map((s: any) => [s.id, s]));
  const customersMap = new Map((customersRes.data ?? []).map((c: any) => [c.id, c]));

  // Also resolve sites from milestones (for milestone → site → customer chain)
  const milestoneSiteIds = [...new Set(
    (milestonesRes.data ?? []).map((m: any) => m.site_id).filter(Boolean)
  )].filter((id) => !sitesMap.has(id));

  if (milestoneSiteIds.length > 0) {
    const { data: extraSites } = await supabase.from("sites").select("id, name, slug, customer_id").in("id", milestoneSiteIds);
    for (const s of (extraSites ?? [])) sitesMap.set(s.id, s);
  }

  // Resolve customers from sites
  const siteCustomerIds = [...new Set(
    [...sitesMap.values()].map((s: any) => s.customer_id).filter(Boolean)
  )].filter((id) => !customersMap.has(id));

  if (siteCustomerIds.length > 0) {
    const { data: extraCustomers } = await supabase.from("customers").select("id, name, slug").in("id", siteCustomerIds);
    for (const c of (extraCustomers ?? [])) customersMap.set(c.id, c);
  }

  // Assemble context onto each task
  return tasks.map((task: any) => {
    const assignee = profilesMap.get(task.assignee_id) ?? null;
    const milestone = milestonesMap.get(task.milestone_id) ?? null;
    const site = sitesMap.get(milestone?.site_id ?? task.site_id) ?? null;
    const customer = customersMap.get(site?.customer_id ?? task.customer_id) ?? null;

    return {
      ...task,
      assignee,
      milestone: milestone ? {
        ...milestone,
        site: site ? { ...site, customer } : null,
      } : null,
      direct_site: task.site_id ? sitesMap.get(task.site_id) ?? null : null,
      direct_customer: task.customer_id ? customersMap.get(task.customer_id) ?? null : null,
    };
  });
}

/**
 * Get ALL tasks for a customer — rolls up company-level, site-level, milestone-level,
 * and multi-site tasks (via task_sites junction table).
 * Includes site and milestone context for display.
 */
export async function getAllTasksForCustomer(customerId: string) {
  const supabase = createSupabaseAdmin();

  // First get all site IDs for this customer
  const { data: sites } = await supabase
    .from("sites")
    .select("id")
    .eq("customer_id", customerId);

  const siteIds = (sites ?? []).map((s: any) => s.id);

  // Get task IDs linked via task_sites junction table to any of this customer's sites
  let linkedTaskIds: string[] = [];
  if (siteIds.length > 0) {
    const { data: taskSiteLinks } = await (supabase as any)
      .from("task_sites")
      .select("task_id")
      .in("site_id", siteIds);
    linkedTaskIds = (taskSiteLinks ?? []).map((ts: any) => ts.task_id);
  }

  // Build OR filter
  const orConditions: string[] = [`customer_id.eq.${customerId}`];
  if (siteIds.length > 0) {
    orConditions.push(`site_id.in.(${siteIds.join(",")})`);
  }
  if (linkedTaskIds.length > 0) {
    orConditions.push(`id.in.(${linkedTaskIds.join(",")})`);
  }

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*")
    .neq("status", "done")
    .or(orConditions.join(","))
    .order("created_at", { ascending: false });

  if (error) return [];
  if (!tasks || tasks.length === 0) return [];

  // Resolve assignees, milestones, sites separately
  const assigneeIds = [...new Set(tasks.map((t: any) => t.assignee_id).filter(Boolean))];
  const milestoneIds = [...new Set(tasks.map((t: any) => t.milestone_id).filter(Boolean))];
  const taskSiteIds = [...new Set(tasks.map((t: any) => t.site_id).filter(Boolean))];

  const [profilesRes, milestonesRes, sitesRes] = await Promise.all([
    assigneeIds.length > 0
      ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", assigneeIds)
      : { data: [] },
    milestoneIds.length > 0
      ? supabase.from("milestones").select("id, name, slug").in("id", milestoneIds)
      : { data: [] },
    taskSiteIds.length > 0
      ? supabase.from("sites").select("id, name, slug").in("id", taskSiteIds)
      : { data: [] },
  ]);

  const profilesMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
  const milestonesMap = new Map((milestonesRes.data ?? []).map((m: any) => [m.id, m]));
  const sitesMap = new Map((sitesRes.data ?? []).map((s: any) => [s.id, s]));

  return tasks.map((task: any) => ({
    ...task,
    assignee: profilesMap.get(task.assignee_id) ?? null,
    milestone: milestonesMap.get(task.milestone_id) ?? null,
    site: sitesMap.get(task.site_id) ?? null,
  }));
}

/**
 * Get ALL tasks for a specific site — includes:
 * 1. Direct site tasks (tasks.site_id)
 * 2. Tasks in the site's milestones
 * 3. Tasks linked via task_sites junction table (multi-site tasks)
 */
export async function getTasksForSite(siteId: string) {
  const supabase = createSupabaseAdmin();

  // Get all milestone IDs for this site
  const { data: milestones } = await supabase
    .from("milestones")
    .select("id")
    .eq("site_id", siteId);

  const milestoneIds = (milestones ?? []).map((m: any) => m.id);

  // Get task IDs linked via task_sites junction table
  const { data: taskSiteLinks } = await (supabase as any)
    .from("task_sites")
    .select("task_id")
    .eq("site_id", siteId);

  const linkedTaskIds = (taskSiteLinks ?? []).map((ts: any) => ts.task_id);

  let query = supabase
    .from("tasks")
    .select(`
      *,
      assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
      milestone:milestones(id, name, slug)
    `)
    .neq("status", "done")
    .order("created_at", { ascending: false });

  // Build OR filter combining all three sources
  const orConditions: string[] = [];
  orConditions.push(`site_id.eq.${siteId}`);
  if (milestoneIds.length > 0) {
    orConditions.push(`milestone_id.in.(${milestoneIds.join(",")})`);
  }
  if (linkedTaskIds.length > 0) {
    orConditions.push(`id.in.(${linkedTaskIds.join(",")})`);
  }
  query = query.or(orConditions.join(","));

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as any[];
}

// ─── Flagged Issues for Customer ────────────────────────

export async function getFlaggedIssuesForCustomer(customerId: string) {
  const supabase = createSupabaseAdmin();
  const { data: sites } = await supabase
    .from("sites")
    .select("id")
    .eq("customer_id", customerId);

  if (!sites || sites.length === 0) return [];

  const siteIds = (sites as any[]).map((s: any) => s.id);
  return getFlaggedIssuesForSites(siteIds);
}

// ─── Search ─────────────────────────────────────────────────

// ─── Site Assessment ────────────────────────────────────

export async function getAssessmentForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "site_assessments")
    .select("*")
    .eq("site_id", siteId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getEquipmentForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "site_equipment")
    .select("*")
    .eq("site_id", siteId)
    .order("category")
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getEnergyDataForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "site_energy_data")
    .select("*")
    .eq("site_id", siteId)
    .order("period_month", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getOperationalParamsForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "site_operational_params")
    .select("*")
    .eq("site_id", siteId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getOperationsForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "site_operations")
    .select("*")
    .eq("site_id", siteId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getRateStructureForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "site_rate_structure")
    .select("*")
    .eq("site_id", siteId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getLoadBreakdownForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "site_load_breakdown")
    .select("*")
    .eq("site_id", siteId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getArcoPerformanceForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "site_arco_performance")
    .select("*")
    .eq("site_id", siteId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getSavingsAnalysisForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "site_savings_analysis")
    .select("*")
    .eq("site_id", siteId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getLaborBaselineForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "site_labor_baseline")
    .select("*")
    .eq("site_id", siteId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getTouScheduleForSite(siteId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "site_tou_schedule")
    .select("*")
    .eq("site_id", siteId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getBaselineDataSources(assessmentId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "baseline_data_sources")
    .select("*, attachments:attachment_id(id, file_name)")
    .eq("assessment_id", assessmentId);

  if (error) throw error;
  return (data ?? []) as any[];
}

// ─── Site Contacts ──────────────────────────────────────────

export async function getSiteContactsForSite(siteId: string) {
  const admin = createSupabaseAdmin();
  const { data, error } = await fromTable(admin, "site_contacts")
    .select("*")
    .eq("site_id", siteId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as any[];
}

// ─── Handoff Reports ────────────────────────────────────────

export async function getHandoffReportForSite(siteId: string) {
  const admin = createSupabaseAdmin();
  const { data, error } = await fromTable(admin, "handoff_reports")
    .select("*")
    .eq("site_id", siteId)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getPublicHandoff(slug: string) {
  const admin = createSupabaseAdmin();

  // Look up handoff by slug
  const { data: handoff, error } = await fromTable(admin, "handoff_reports")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !handoff) return null;

  // Get site info
  const { data: site } = await admin
    .from("sites")
    .select("*, customers!inner(name, slug)")
    .eq("id", handoff.site_id)
    .single();

  if (!site) return null;

  // Get full assessment data (includes siteContacts)
  const assessmentData = await getFullAssessmentData(handoff.site_id);

  return {
    handoff,
    site,
    customer: (site as any).customers,
    ...assessmentData,
  };
}

/**
 * Get all assessment-related data for a site in one call.
 * Used by the site page to hydrate all tabs.
 */
export async function getFullAssessmentData(siteId: string) {
  const [
    assessment,
    equipment,
    energyData,
    operationalParams,
    operations,
    rateStructure,
    loadBreakdown,
    arcoPerformance,
    savingsAnalysis,
    laborBaseline,
    touSchedule,
    siteContacts,
  ] = await Promise.all([
    getAssessmentForSite(siteId),
    getEquipmentForSite(siteId),
    getEnergyDataForSite(siteId),
    getOperationalParamsForSite(siteId),
    getOperationsForSite(siteId),
    getRateStructureForSite(siteId),
    getLoadBreakdownForSite(siteId),
    getArcoPerformanceForSite(siteId),
    getSavingsAnalysisForSite(siteId),
    getLaborBaselineForSite(siteId),
    getTouScheduleForSite(siteId),
    getSiteContactsForSite(siteId),
  ]);

  // Fetch data sources only if assessment exists
  const dataSources = assessment
    ? await getBaselineDataSources(assessment.id)
    : [];

  return {
    assessment,
    equipment,
    energyData,
    operationalParams,
    operations,
    rateStructure,
    loadBreakdown,
    arcoPerformance,
    savingsAnalysis,
    laborBaseline,
    touSchedule,
    dataSources,
    siteContacts,
  };
}

// ─── Search ─────────────────────────────────────────────────

export async function searchAll(query: string) {
  const supabase = createSupabaseAdmin();
  const tsQuery = query.trim().split(/\s+/).join(" & ");

  // Search individual tables with full-text search
  const [sitesRes, milestonesRes, tasksRes] = await Promise.all([
    supabase.from("sites").select("*").textSearch("search_vector", tsQuery).limit(5),
    supabase.from("milestones").select("*").textSearch("search_vector", tsQuery).limit(5),
    supabase.from("tasks").select("*").textSearch("search_vector", tsQuery).limit(5),
  ]);

  type SearchResult = { id: string; title: string; entityType: "site" | "milestone" | "task" };

  const results: SearchResult[] = [];

  for (const s of (sitesRes.data ?? []) as any[]) {
    results.push({ id: s.id, title: s.name, entityType: "site" });
  }
  for (const m of (milestonesRes.data ?? []) as any[]) {
    results.push({ id: m.id, title: m.name, entityType: "milestone" });
  }
  for (const t of (tasksRes.data ?? []) as any[]) {
    results.push({ id: t.id, title: t.title, entityType: "task" });
  }

  return results;
}

// ─── Companies with Account Data (Portfolio View) ──────────

export interface CustomerListItem {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  company_type: string | null;
  account_stage: string | null;
  total_addressable_sites: number | null;
  deal_name: string | null;
  target_value: number | null;
  deal_stage: string | null;
  target_close_date: string | null;
  stakeholder_count: number;
  goals_total: number;
  goals_achieved: number;
  milestones_total: number;
  milestones_completed: number;
  open_tasks: number;
  open_issues: number;
  total_sites: number;
  active_sites: number;
  deploying_sites: number;
  eval_sites: number;
}

export async function getCustomersWithAccountData(): Promise<CustomerListItem[]> {
  const supabase = createSupabaseAdmin();

  const [
    customersRes,
    plansRes,
    dealsRes,
    sitesRes,
    stakeholdersRes,
    goalsRes,
    milestonesRes,
    tasksRes,
    issuesRes,
  ] = await Promise.all([
    supabase.from("customers").select("*").order("name"),
    fromTable(supabase, "account_plans").select("customer_id, id, account_stage, total_addressable_sites"),
    fromTable(supabase, "enterprise_deals").select("customer_id, deal_name, target_value, deal_stage, target_close_date"),
    supabase.from("sites").select("id, customer_id, pipeline_stage"),
    fromTable(supabase, "account_stakeholders").select("account_plan_id"),
    fromTable(supabase, "success_plan_goals").select("account_plan_id, is_achieved"),
    fromTable(supabase, "success_plan_milestones").select("account_plan_id, status"),
    supabase.from("tasks").select("id, status, customer_id, site_id"),
    supabase.from("flagged_issues").select("id, status, site_id"),
  ]);

  const customers = (customersRes.data ?? []) as any[];
  const plans = (plansRes.data ?? []) as any[];
  const deals = (dealsRes.data ?? []) as any[];
  const sites = (sitesRes.data ?? []) as any[];
  const stakeholders = (stakeholdersRes.data ?? []) as any[];
  const goals = (goalsRes.data ?? []) as any[];
  const milestones = (milestonesRes.data ?? []) as any[];
  const tasks = (tasksRes.data ?? []) as any[];
  const issues = (issuesRes.data ?? []) as any[];

  // Build lookup maps
  const planByCustomer = new Map(plans.map((p: any) => [p.customer_id, p]));
  const dealByCustomer = new Map(deals.map((d: any) => [d.customer_id, d]));

  // Sites grouped by customer
  const sitesByCustomer = new Map<string, any[]>();
  const siteToCustomer = new Map<string, string>();
  for (const s of sites) {
    if (!sitesByCustomer.has(s.customer_id)) sitesByCustomer.set(s.customer_id, []);
    sitesByCustomer.get(s.customer_id)!.push(s);
    siteToCustomer.set(s.id, s.customer_id);
  }

  // Stakeholders counted per plan → per customer
  const stakeholderCountByPlan = new Map<string, number>();
  for (const s of stakeholders) {
    stakeholderCountByPlan.set(s.account_plan_id, (stakeholderCountByPlan.get(s.account_plan_id) ?? 0) + 1);
  }

  // Goals per plan
  const goalsByPlan = new Map<string, { total: number; achieved: number }>();
  for (const g of goals) {
    const entry = goalsByPlan.get(g.account_plan_id) ?? { total: 0, achieved: 0 };
    entry.total++;
    if (g.is_achieved) entry.achieved++;
    goalsByPlan.set(g.account_plan_id, entry);
  }

  // Milestones per plan
  const milestonesByPlan = new Map<string, { total: number; completed: number }>();
  for (const m of milestones) {
    const entry = milestonesByPlan.get(m.account_plan_id) ?? { total: 0, completed: 0 };
    entry.total++;
    if (m.status === "completed") entry.completed++;
    milestonesByPlan.set(m.account_plan_id, entry);
  }

  // Open tasks per customer (via customer_id or site_id)
  const openTasksByCustomer = new Map<string, number>();
  for (const t of tasks) {
    if (t.status === "done") continue;
    const custId = t.customer_id || siteToCustomer.get(t.site_id);
    if (custId) openTasksByCustomer.set(custId, (openTasksByCustomer.get(custId) ?? 0) + 1);
  }

  // Open issues per customer (via site_id)
  const openIssuesByCustomer = new Map<string, number>();
  for (const i of issues) {
    if (i.status !== "open") continue;
    const custId = siteToCustomer.get(i.site_id);
    if (custId) openIssuesByCustomer.set(custId, (openIssuesByCustomer.get(custId) ?? 0) + 1);
  }

  return customers.map((c: any) => {
    const plan = planByCustomer.get(c.id);
    const deal = dealByCustomer.get(c.id);
    const custSites = sitesByCustomer.get(c.id) ?? [];
    const goalData = plan ? goalsByPlan.get(plan.id) : null;
    const msData = plan ? milestonesByPlan.get(plan.id) : null;

    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      domain: c.domain ?? null,
      company_type: c.company_type ?? null,
      account_stage: plan?.account_stage ?? null,
      total_addressable_sites: plan?.total_addressable_sites ?? null,
      deal_name: deal?.deal_name ?? null,
      target_value: deal?.target_value ? Number(deal.target_value) : null,
      deal_stage: deal?.deal_stage ?? null,
      target_close_date: deal?.target_close_date ?? null,
      stakeholder_count: plan ? (stakeholderCountByPlan.get(plan.id) ?? 0) : 0,
      goals_total: goalData?.total ?? 0,
      goals_achieved: goalData?.achieved ?? 0,
      milestones_total: msData?.total ?? 0,
      milestones_completed: msData?.completed ?? 0,
      open_tasks: openTasksByCustomer.get(c.id) ?? 0,
      open_issues: openIssuesByCustomer.get(c.id) ?? 0,
      total_sites: custSites.length,
      active_sites: custSites.filter((s: any) => s.pipeline_stage === "active").length,
      deploying_sites: custSites.filter((s: any) => s.pipeline_stage === "deployment").length,
      eval_sites: custSites.filter((s: any) => ["evaluation", "qualified", "prospect"].includes(s.pipeline_stage)).length,
    };
  });
}

// ─── Account Plans ──────────────────────────────────────────

export async function getAccountPlan(customerId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "account_plans")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) throw error;
  return data as any | null;
}

export async function getAccountStakeholders(accountPlanId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "account_stakeholders")
    .select("*")
    .eq("account_plan_id", accountPlanId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getSuccessPlanGoals(accountPlanId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "success_plan_goals")
    .select("*")
    .eq("account_plan_id", accountPlanId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getSuccessPlanMilestones(accountPlanId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "success_plan_milestones")
    .select("*")
    .eq("account_plan_id", accountPlanId)
    .order("target_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getEnterpriseDeal(customerId: string) {
  const supabase = createSupabaseAdmin();
  const { data, error } = await fromTable(supabase, "enterprise_deals")
    .select("*")
    .eq("customer_id", customerId)
    .maybeSingle();

  if (error) throw error;
  return data as any | null;
}
