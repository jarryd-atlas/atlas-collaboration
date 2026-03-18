/**
 * Supabase data access queries.
 * All queries use the user's session (RLS-scoped) unless noted.
 * Pages handle empty results gracefully when the database has no data.
 */

import { createSupabaseServer, createSupabaseAdmin } from "../supabase/server";
import type { SiteRow } from "@repo/supabase";

// ─── Customers ──────────────────────────────────────────────

export async function getCustomers() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("name");

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getCustomerBySlug(slug: string) {
  const supabase = await createSupabaseServer();
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
  const supabase = await createSupabaseServer();
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

  const supabase = await createSupabaseServer();
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
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("site_id", siteId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getMilestoneBySlug(siteId: string, milestoneSlug: string) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("site_id", siteId)
    .eq("slug", milestoneSlug)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getMilestoneTemplates() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("milestone_templates")
    .select("*")
    .order("sort_order");

  if (error) throw error;
  return (data ?? []) as any[];
}

// ─── Tasks ──────────────────────────────────────────────────

export async function getTasksForMilestone(milestoneId: string) {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("tasks")
    .select("*, assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url)")
    .eq("milestone_id", milestoneId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getMyTasks(profileId: string) {
  const supabase = await createSupabaseServer();
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

export async function getCommentsForEntity(entityType: string, entityId: string) {
  const supabase = await createSupabaseServer();
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
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("flagged_issues")
    .select("*, flagged_by_profile:profiles!flagged_issues_flagged_by_fkey(full_name), site:sites!inner(name)")
    .in("site_id", siteIds)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getAllFlaggedIssues() {
  const supabase = await createSupabaseServer();
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
  const supabase = await createSupabaseServer();
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
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("*, tenant:tenants(id, name, type)")
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getActiveProfiles() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", "active")
    .order("full_name");

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getPendingProfiles() {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("status", ["pending", "pending_approval"])
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getProfileById(profileId: string) {
  const supabase = await createSupabaseServer();
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

// ─── Dashboard stats ────────────────────────────────────────

export async function getDashboardStats() {
  const supabase = await createSupabaseServer();

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
  const supabase = await createSupabaseServer();
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
  const supabase = await createSupabaseServer();
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
  const supabase = await createSupabaseServer();
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
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("status_reports")
    .select("*, customer:customers!inner(name), site:sites(name), created_by_profile:profiles!status_reports_created_by_fkey(full_name)")
    .eq("id", reportId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as any;
}

export async function getReportSections(reportId: string) {
  const supabase = await createSupabaseServer();
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
  const supabase = await createSupabaseServer();
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
    .neq("status", "done")
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) throw error;
  return (data ?? []) as any[];
}

// ─── Flagged Issues for Customer ────────────────────────

export async function getFlaggedIssuesForCustomer(customerId: string) {
  const supabase = await createSupabaseServer();
  const { data: sites } = await supabase
    .from("sites")
    .select("id")
    .eq("customer_id", customerId);

  if (!sites || sites.length === 0) return [];

  const siteIds = (sites as any[]).map((s: any) => s.id);
  return getFlaggedIssuesForSites(siteIds);
}

// ─── Search ─────────────────────────────────────────────────

export async function searchAll(query: string) {
  const supabase = await createSupabaseServer();
  const tsQuery = query.trim().split(/\s+/).join(" & ");

  // Search individual tables with full-text search
  const [sitesRes, milestonesRes, tasksRes] = await Promise.all([
    supabase.from("sites").select("*").textSearch("search_vector", tsQuery).limit(5),
    supabase.from("milestones").select("*").textSearch("search_vector", tsQuery).limit(5),
    supabase.from("tasks").select("*").textSearch("search_vector", tsQuery).limit(5),
  ]);

  type SearchResult = { id: string; title: string; entityType: "site" | "milestone" | "task"; tenantId: string };

  const results: SearchResult[] = [];

  for (const s of (sitesRes.data ?? []) as SiteRow[]) {
    results.push({ id: s.id, title: s.name, entityType: "site", tenantId: s.tenant_id });
  }
  for (const m of (milestonesRes.data ?? []) as Array<{ id: string; name: string; tenant_id: string }>) {
    results.push({ id: m.id, title: m.name, entityType: "milestone", tenantId: m.tenant_id });
  }
  for (const t of (tasksRes.data ?? []) as Array<{ id: string; title: string; tenant_id: string }>) {
    results.push({ id: t.id, title: t.title, entityType: "task", tenantId: t.tenant_id });
  }

  return results;
}
