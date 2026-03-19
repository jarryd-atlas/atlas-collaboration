"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import type { TaskStatus, PriorityLevel } from "@repo/supabase";

export async function createTask(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const milestoneId = formData.get("milestoneId") as string;
    const tenantId = formData.get("tenantId") as string;
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || null;
    const priority = (formData.get("priority") as PriorityLevel) || "medium";
    const assigneeId = (formData.get("assigneeId") as string) || null;
    const dueDate = (formData.get("dueDate") as string) || null;

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin.from("tasks").insert({
      milestone_id: milestoneId,
      tenant_id: tenantId,
      title,
      description,
      priority,
      assignee_id: assigneeId,
      due_date: dueDate,
      status: "todo" as TaskStatus,
      source: "manual" as const,
    });

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

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

export async function updateTaskAssignee(taskId: string, assigneeId: string | null) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin
      .from("tasks")
      .update({ assignee_id: assigneeId })
      .eq("id", taskId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

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
