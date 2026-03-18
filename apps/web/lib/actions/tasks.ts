"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import type { TaskStatus, PriorityLevel } from "@repo/supabase";

export async function createTask(formData: FormData) {
  const { claims } = await requireSession();
  if (claims.tenantType !== "internal") throw new Error("Forbidden");

  const milestoneId = formData.get("milestoneId") as string;
  const tenantId = formData.get("tenantId") as string;
  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || null;
  const priority = (formData.get("priority") as PriorityLevel) || "medium";
  const assigneeId = (formData.get("assigneeId") as string) || null;
  const dueDate = (formData.get("dueDate") as string) || null;

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("tasks").insert({
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

  if (error) throw error;

  revalidatePath("/customers");
  revalidatePath("/tasks");
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const { claims } = await requireSession();
  if (claims.tenantType !== "internal") throw new Error("Forbidden");

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("tasks")
    .update({ status })
    .eq("id", taskId);

  if (error) throw error;

  revalidatePath("/customers");
  revalidatePath("/tasks");
}

export async function updateTaskAssignee(taskId: string, assigneeId: string | null) {
  const { claims } = await requireSession();
  if (claims.tenantType !== "internal") throw new Error("Forbidden");

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("tasks")
    .update({ assignee_id: assigneeId })
    .eq("id", taskId);

  if (error) throw error;

  revalidatePath("/customers");
  revalidatePath("/tasks");
}

export async function deleteTask(taskId: string) {
  const { claims } = await requireSession();
  if (claims.tenantType !== "internal") throw new Error("Forbidden");

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("tasks").delete().eq("id", taskId);

  if (error) throw error;

  revalidatePath("/customers");
  revalidatePath("/tasks");
}
