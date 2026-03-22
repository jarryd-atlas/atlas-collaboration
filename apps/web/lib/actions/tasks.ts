"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import type { TaskStatus, PriorityLevel } from "@repo/supabase";

/**
 * Create a task. Both CK and customer users can create tasks.
 * Tasks can be tied to a milestone, a site, or just a customer (company-level).
 */
export async function createTask(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Missing profile" };

    const milestoneId = (formData.get("milestoneId") as string) || null;
    const siteId = (formData.get("siteId") as string) || null;
    const customerId = (formData.get("customerId") as string) || null;
    const tenantId = formData.get("tenantId") as string;
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || null;
    const priority = (formData.get("priority") as PriorityLevel) || "medium";
    const assigneeId = (formData.get("assigneeId") as string) || null;
    const dueDate = (formData.get("dueDate") as string) || null;

    if (!title) return { error: "Title is required" };
    if (!tenantId) return { error: "Tenant ID is required" };

    // If we have a milestone but no site, look up the site from the milestone
    let resolvedSiteId = siteId;
    if (milestoneId && !resolvedSiteId) {
      const admin2 = createSupabaseAdmin();
      const { data: ms } = await admin2
        .from("milestones")
        .select("site_id")
        .eq("id", milestoneId)
        .single();
      if (ms) resolvedSiteId = ms.site_id;
    }

    // Collect additional site IDs (for multi-site association)
    const additionalSiteIds = (formData.get("additionalSiteIds") as string) || "";
    const allSiteIds = new Set<string>();
    if (resolvedSiteId) allSiteIds.add(resolvedSiteId);
    if (additionalSiteIds) {
      for (const id of additionalSiteIds.split(",").map((s) => s.trim()).filter(Boolean)) {
        allSiteIds.add(id);
      }
    }

    const admin = createSupabaseAdmin();
    const { data: task, error: dbError } = await admin
      .from("tasks")
      .insert({
        milestone_id: milestoneId,
        site_id: resolvedSiteId,
        customer_id: customerId,
        tenant_id: tenantId,
        title,
        description,
        priority,
        assignee_id: assigneeId,
        due_date: dueDate,
        status: "todo" as TaskStatus,
        source: "manual" as const,
        created_by: claims.profileId,
      } as any)
      .select("id")
      .single();

    if (dbError) return { error: dbError.message };

    // Insert into task_sites junction table for all associated sites
    if (allSiteIds.size > 0) {
      const taskSiteRows = [...allSiteIds].map((sId) => ({
        task_id: task.id,
        site_id: sId,
      }));
      await (admin as any).from("task_sites").insert(taskSiteRows).throwOnError();
    }

    // Send notification to assignee
    if (assigneeId && assigneeId !== claims.profileId) {
      try {
        await createAssignmentNotification(admin, {
          tenantId,
          taskId: task.id,
          taskTitle: title,
          assigneeId,
          assignerProfileId: claims.profileId,
        });
      } catch {
        // Non-critical
      }
    }

    revalidatePath("/customers");
    revalidatePath("/tasks");
    return { success: true, id: task.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Update task status. Both CK and customer users can update tasks in their tenant.
 */
export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin
      .from("tasks")
      .update({ status })
      .eq("id", taskId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Update task title. Both CK and customer users can edit task titles.
 */
export async function updateTaskTitle(taskId: string, title: string) {
  try {
    await requireSession();

    const trimmed = title.trim();
    if (!trimmed) return { error: "Title cannot be empty" };

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin
      .from("tasks")
      .update({ title: trimmed })
      .eq("id", taskId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Get comments/updates for a specific task.
 */
export async function getTaskComments(taskId: string) {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("comments")
      .select("*, author:profiles!comments_author_id_fkey(id, full_name, avatar_url)")
      .eq("entity_type", "task")
      .eq("entity_id", taskId)
      .order("created_at", { ascending: true });

    if (error) return { error: error.message };
    return { data: data ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Update task assignee. Both CK and customer users can reassign tasks.
 * Creates a notification for the new assignee.
 */
export async function updateTaskAssignee(taskId: string, assigneeId: string | null) {
  try {
    const { claims } = await requireSession();

    const admin = createSupabaseAdmin();

    // Get previous assignee and task title for notification
    const { data: existing } = await admin
      .from("tasks")
      .select("assignee_id, title, tenant_id")
      .eq("id", taskId)
      .single();

    const { error: dbError } = await admin
      .from("tasks")
      .update({ assignee_id: assigneeId })
      .eq("id", taskId);

    if (dbError) return { error: dbError.message };

    // Send notification if assignee changed and is not self
    if (
      assigneeId &&
      assigneeId !== claims.profileId &&
      assigneeId !== (existing as any)?.assignee_id
    ) {
      try {
        await createAssignmentNotification(admin, {
          tenantId: (existing as any)?.tenant_id ?? "",
          taskId,
          taskTitle: (existing as any)?.title ?? "a task",
          assigneeId,
          assignerProfileId: claims.profileId!,
        });
      } catch {
        // Non-critical
      }
    }

    revalidatePath("/customers");
    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Delete a task. CK internal only — customers cannot delete tasks.
 */
export async function deleteTask(taskId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin.from("tasks").delete().eq("id", taskId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Create a task inline (quick creation from Kanban board).
 * Both CK and customer users can use this.
 */
export async function createTaskInline(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Missing profile" };

    const title = formData.get("title") as string;
    const tenantId = formData.get("tenantId") as string;

    if (!title || !tenantId) {
      return { error: "title and tenantId are required" };
    }

    const milestoneId = (formData.get("milestoneId") as string) || null;
    const siteId = (formData.get("siteId") as string) || null;
    const customerId = (formData.get("customerId") as string) || null;
    const priority = (formData.get("priority") as PriorityLevel) || "medium";
    const assigneeId = (formData.get("assigneeId") as string) || null;
    const dueDate = (formData.get("dueDate") as string) || null;

    // If we have a milestone but no site, look up the site from the milestone
    let resolvedSiteId = siteId;
    if (milestoneId && !resolvedSiteId) {
      const adminLookup = createSupabaseAdmin();
      const { data: ms } = await adminLookup
        .from("milestones")
        .select("site_id")
        .eq("id", milestoneId)
        .single();
      if (ms) resolvedSiteId = ms.site_id;
    }

    // Collect additional site IDs (for multi-site association)
    const additionalSiteIds = (formData.get("additionalSiteIds") as string) || "";
    const allSiteIds = new Set<string>();
    if (resolvedSiteId) allSiteIds.add(resolvedSiteId);
    if (additionalSiteIds) {
      for (const id of additionalSiteIds.split(",").map((s) => s.trim()).filter(Boolean)) {
        allSiteIds.add(id);
      }
    }

    const admin = createSupabaseAdmin();
    const { data, error: dbError } = await admin
      .from("tasks")
      .insert({
        title,
        tenant_id: tenantId,
        milestone_id: milestoneId,
        site_id: resolvedSiteId,
        customer_id: customerId,
        priority,
        assignee_id: assigneeId,
        due_date: dueDate,
        status: "todo" as TaskStatus,
        source: "manual" as const,
        created_by: claims.profileId,
      } as any)
      .select("id")
      .single();

    if (dbError) return { error: dbError.message };

    // Insert into task_sites junction table for all associated sites
    if (allSiteIds.size > 0) {
      const taskSiteRows = [...allSiteIds].map((sId) => ({
        task_id: data.id,
        site_id: sId,
      }));
      await (admin as any).from("task_sites").insert(taskSiteRows).throwOnError();
    }

    // Send notification to assignee
    if (assigneeId && assigneeId !== claims.profileId) {
      try {
        await createAssignmentNotification(admin, {
          tenantId,
          taskId: data.id,
          taskTitle: title,
          assigneeId,
          assignerProfileId: claims.profileId,
        });
      } catch {
        // Non-critical
      }
    }

    revalidatePath("/customers");
    revalidatePath("/tasks");
    return { success: true as const, id: data.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Batch create tasks (from AI extraction).
 * CK internal only for AI-extracted tasks.
 */
export async function createTasksBatch(
  tasks: Array<{
    title: string;
    description?: string;
    priority?: string;
    milestoneId?: string;
    siteId?: string;
    tenantId: string;
    assigneeId?: string;
    dueDate?: string;
  }>
) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    if (!tasks || tasks.length === 0) {
      return { error: "At least one task is required" };
    }

    // Collect milestone IDs that need site resolution
    const milestoneIds = [
      ...new Set(
        tasks
          .filter((t) => t.milestoneId && !t.siteId)
          .map((t) => t.milestoneId as string)
      ),
    ];

    // Batch-fetch sites for milestones
    const milestoneSiteMap: Record<string, string> = {};
    if (milestoneIds.length > 0) {
      const adminLookup = createSupabaseAdmin();
      const { data: milestones } = await adminLookup
        .from("milestones")
        .select("id, site_id")
        .in("id", milestoneIds);
      if (milestones) {
        for (const ms of milestones) {
          milestoneSiteMap[ms.id] = ms.site_id;
        }
      }
    }

    const rows = tasks.map((t) => {
      const resolvedSiteId =
        t.siteId || (t.milestoneId ? milestoneSiteMap[t.milestoneId] : null) || null;
      return {
        title: t.title,
        description: t.description || null,
        tenant_id: t.tenantId,
        milestone_id: t.milestoneId || null,
        site_id: resolvedSiteId,
        priority: (t.priority as PriorityLevel) || "medium",
        assignee_id: t.assigneeId || null,
        due_date: t.dueDate || null,
        status: "todo" as TaskStatus,
        source: "ai_extracted" as const,
        created_by: claims.profileId,
      };
    });

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin.from("tasks").insert(rows as any);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    revalidatePath("/tasks");
    return { success: true as const, created: tasks.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

// ─── Internal helpers ──────────────────────────────────────────

async function createAssignmentNotification(
  admin: ReturnType<typeof createSupabaseAdmin>,
  opts: {
    tenantId: string;
    taskId: string;
    taskTitle: string;
    assigneeId: string;
    assignerProfileId: string;
  },
) {
  const { tenantId, taskId, taskTitle, assigneeId, assignerProfileId } = opts;

  // Get assigner's name
  const { data: assigner } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", assignerProfileId)
    .single();

  const assignerName = (assigner as any)?.full_name ?? "Someone";

  await admin.from("notifications").insert({
    tenant_id: tenantId,
    user_id: assigneeId,
    type: "task_assigned" as any,
    entity_type: "task",
    entity_id: taskId,
    title: `${assignerName} assigned you a task`,
    body: `"${taskTitle}"`,
  });
}
