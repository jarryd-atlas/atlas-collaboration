"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import type { SeverityLevel, IssueStatus } from "@repo/supabase";

export async function createFlaggedIssue(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }
    if (!claims.profileId) return { error: "Profile not found" };

    const siteId = formData.get("siteId") as string;
    const tenantId = formData.get("tenantId") as string;
    const severity = formData.get("severity") as SeverityLevel;
    const summary = formData.get("summary") as string;
    const details = (formData.get("details") as string) || null;

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin.from("flagged_issues").insert({
      tenant_id: tenantId,
      site_id: siteId,
      severity,
      summary,
      details,
      flagged_by: claims.profileId,
      status: "open" as IssueStatus,
    });

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateIssueStatus(issueId: string, status: IssueStatus) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const update: Record<string, unknown> = { status };

    if (status === "resolved") {
      update.resolved_by = claims.profileId;
      update.resolved_at = new Date().toISOString();
    }

    const { error: dbError } = await admin
      .from("flagged_issues")
      .update(update)
      .eq("id", issueId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
