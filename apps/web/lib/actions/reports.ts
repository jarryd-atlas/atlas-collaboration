"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

const DEFAULT_SECTIONS = [
  { section_type: "executive_summary", title: "Executive Summary", sort_order: 0 },
  { section_type: "milestone_progress", title: "Milestone Progress", sort_order: 1 },
  { section_type: "task_summary", title: "Task Summary", sort_order: 2 },
  { section_type: "flagged_issues", title: "Flagged Issues", sort_order: 3 },
  { section_type: "next_steps", title: "Next Steps", sort_order: 4 },
];

export async function createReport(formData: FormData) {
  const { claims } = await requireSession();
  if (claims.tenantType !== "internal") throw new Error("Forbidden");

  const title = formData.get("title") as string;
  const customerId = formData.get("customerId") as string;
  const siteId = (formData.get("siteId") as string) || null;
  const dateRangeStart = formData.get("dateRangeStart") as string;
  const dateRangeEnd = formData.get("dateRangeEnd") as string;

  const admin = createSupabaseAdmin();

  // Create the report
  const { data: report, error: reportErr } = await admin
    .from("status_reports")
    .insert({
      tenant_id: claims.tenantId!,
      customer_id: customerId,
      site_id: siteId,
      title,
      status: "draft" as const,
      date_range_start: dateRangeStart,
      date_range_end: dateRangeEnd,
      created_by: claims.profileId!,
    })
    .select()
    .single();

  if (reportErr) throw reportErr;

  // Create default sections
  const sections = DEFAULT_SECTIONS.map((s) => ({
    report_id: report.id,
    tenant_id: claims.tenantId!,
    section_key: s.section_type,
    title: s.title,
    content: "",
    sort_order: s.sort_order,
  }));

  const { error: sectionsErr } = await admin
    .from("report_sections")
    .insert(sections);

  if (sectionsErr) throw sectionsErr;

  revalidatePath("/reports");
  return { id: report.id };
}

export async function updateReportSection(sectionId: string, content: string) {
  const { claims } = await requireSession();
  if (claims.tenantType !== "internal") throw new Error("Forbidden");

  const admin = createSupabaseAdmin();

  const { error } = await admin
    .from("report_sections")
    .update({ content })
    .eq("id", sectionId);

  if (error) throw error;

  revalidatePath("/reports");
}

export async function publishReport(reportId: string) {
  const { claims } = await requireSession();
  if (claims.tenantType !== "internal") throw new Error("Forbidden");

  const admin = createSupabaseAdmin();

  const { error } = await admin
    .from("status_reports")
    .update({
      status: "published" as const,
      published_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) throw error;

  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
}
