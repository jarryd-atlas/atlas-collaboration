"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import { slugify } from "../utils";
import type { MilestoneStatus, PriorityLevel } from "@repo/supabase";

export async function createMilestone(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const siteId = formData.get("siteId") as string;
    const tenantId = formData.get("tenantId") as string;
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;
    const priority = (formData.get("priority") as PriorityLevel) || "medium";
    const startDate = (formData.get("startDate") as string) || null;
    const dueDate = (formData.get("dueDate") as string) || null;
    const templateId = (formData.get("templateId") as string) || null;
    const slug = slugify(name);

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin.from("milestones").insert({
      site_id: siteId,
      tenant_id: tenantId,
      name,
      slug,
      description,
      priority,
      start_date: startDate,
      due_date: dueDate,
      template_id: templateId,
      status: "not_started" as MilestoneStatus,
    });

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateMilestoneStatus(
  milestoneId: string,
  status: MilestoneStatus,
) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin
      .from("milestones")
      .update({
        status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", milestoneId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateMilestoneProgress(
  milestoneId: string,
  progress: number,
) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin
      .from("milestones")
      .update({ progress: Math.min(100, Math.max(0, progress)) })
      .eq("id", milestoneId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
