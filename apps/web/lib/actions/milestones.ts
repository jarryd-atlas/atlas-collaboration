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

/** Create a company-specific milestone template */
export async function createMilestoneTemplate(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const customerId = formData.get("customerId") as string;
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || null;

    const admin = createSupabaseAdmin();

    // Get max sort_order for this company's templates
    const { data: existing } = await admin
      .from("milestone_templates")
      .select("sort_order")
      .eq("customer_id", customerId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0
      ? ((existing[0] as { sort_order: number }).sort_order + 1)
      : 100; // Start company templates at 100 to separate from global

    const { error: dbError } = await admin.from("milestone_templates").insert({
      customer_id: customerId,
      name,
      description,
      sort_order: nextOrder,
      is_default: false,
    });

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/** Delete a company-specific milestone template (cannot delete global/default templates) */
export async function deleteMilestoneTemplate(templateId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();

    // Verify it's not a global template
    const { data: template } = await admin
      .from("milestone_templates")
      .select("customer_id, is_default")
      .eq("id", templateId)
      .single();

    if (!template) return { error: "Template not found" };
    if ((template as any).is_default) return { error: "Cannot delete default ATLAS templates" };
    if (!(template as any).customer_id) return { error: "Cannot delete global templates" };

    const { error: dbError } = await admin
      .from("milestone_templates")
      .delete()
      .eq("id", templateId);

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
