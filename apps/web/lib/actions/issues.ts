"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import type { SeverityLevel, IssueStatus } from "@repo/supabase";

export async function createFlaggedIssue(formData: FormData) {
  const { claims } = await requireSession();
  if (claims.tenantType && claims.tenantType !== "internal") throw new Error("Forbidden");
  if (!claims.profileId) throw new Error("Profile not found");

  const siteId = formData.get("siteId") as string;
  const tenantId = formData.get("tenantId") as string;
  const severity = formData.get("severity") as SeverityLevel;
  const summary = formData.get("summary") as string;
  const details = (formData.get("details") as string) || null;

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("flagged_issues").insert({
    tenant_id: tenantId,
    site_id: siteId,
    severity,
    summary,
    details,
    flagged_by: claims.profileId,
    status: "open" as IssueStatus,
  });

  if (error) throw error;

  revalidatePath("/customers");
  revalidatePath("/");
}

export async function updateIssueStatus(issueId: string, status: IssueStatus) {
  const { claims } = await requireSession();
  if (claims.tenantType && claims.tenantType !== "internal") throw new Error("Forbidden");

  const admin = createSupabaseAdmin();
  const update: Record<string, unknown> = { status };

  if (status === "resolved") {
    update.resolved_by = claims.profileId;
    update.resolved_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("flagged_issues")
    .update(update)
    .eq("id", issueId);

  if (error) throw error;

  revalidatePath("/customers");
  revalidatePath("/");
}
