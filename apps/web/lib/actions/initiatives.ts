"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

// NOTE: Initiative tables not yet in generated Supabase types — cast to any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

// ─── Initiatives CRUD ──────────────────────────────────────

export async function createInitiative(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };

    const customerId = formData.get("customerId") as string;
    const tenantId = formData.get("tenantId") as string;
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || null;
    const priority = (formData.get("priority") as string) || "medium";
    const ownerId = (formData.get("ownerId") as string) || claims.profileId;
    const targetDate = (formData.get("targetDate") as string) || null;
    const category = (formData.get("category") as string) || null;

    if (!title?.trim()) return { error: "Title is required" };
    if (!customerId || !tenantId) return { error: "Missing required fields" };

    const admin = createSupabaseAdmin();
    const { data, error } = await fromTable(admin, "initiatives")
      .insert({
        customer_id: customerId,
        tenant_id: tenantId,
        title: title.trim(),
        description,
        priority,
        owner_id: ownerId,
        target_date: targetDate || null,
        category,
        created_by: claims.profileId,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    revalidatePath("/customers");
    return { success: true, id: data.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateInitiative(
  initiativeId: string,
  data: {
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    target_date?: string | null;
    owner_id?: string;
    category?: string | null;
  }
) {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();

    // Auto-set completed_at when status becomes completed
    const updateData: Record<string, unknown> = { ...data };
    if (data.status === "completed") {
      updateData.completed_at = new Date().toISOString();
    } else if (data.status && data.status !== "completed") {
      updateData.completed_at = null;
    }

    const { error } = await fromTable(admin, "initiatives")
      .update(updateData)
      .eq("id", initiativeId);

    if (error) return { error: error.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteInitiative(initiativeId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") return { error: "Only internal users can delete initiatives" };

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "initiatives")
      .delete()
      .eq("id", initiativeId);

    if (error) return { error: error.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

// ─── Task Linking ──────────────────────────────────────────

export async function linkTaskToInitiative(initiativeId: string, taskId: string) {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "initiative_tasks")
      .insert({ initiative_id: initiativeId, task_id: taskId });

    if (error) {
      if (error.code === "23505") return { success: true }; // already linked
      return { error: error.message };
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function unlinkTaskFromInitiative(initiativeId: string, taskId: string) {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "initiative_tasks")
      .delete()
      .eq("initiative_id", initiativeId)
      .eq("task_id", taskId);

    if (error) return { error: error.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

// ─── Stakeholder Linking ───────────────────────────────────

export async function addInitiativeStakeholder(
  initiativeId: string,
  stakeholderId: string,
  role?: string
) {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "initiative_stakeholders")
      .insert({
        initiative_id: initiativeId,
        stakeholder_id: stakeholderId,
        role: role || null,
      });

    if (error) {
      if (error.code === "23505") return { success: true }; // already linked
      return { error: error.message };
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function removeInitiativeStakeholder(initiativeId: string, stakeholderId: string) {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "initiative_stakeholders")
      .delete()
      .eq("initiative_id", initiativeId)
      .eq("stakeholder_id", stakeholderId);

    if (error) return { error: error.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

// ─── Decisions ─────────────────────────────────────────────

export async function createInitiativeDecision(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };

    const initiativeId = formData.get("initiativeId") as string;
    const tenantId = formData.get("tenantId") as string;
    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || null;

    if (!title?.trim()) return { error: "Decision title is required" };
    if (!initiativeId || !tenantId) return { error: "Missing required fields" };

    const admin = createSupabaseAdmin();
    const { data, error } = await fromTable(admin, "initiative_decisions")
      .insert({
        initiative_id: initiativeId,
        tenant_id: tenantId,
        title: title.trim(),
        description,
        decided_by: claims.profileId,
        decided_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    revalidatePath("/customers");
    return { success: true, id: data.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteInitiativeDecision(decisionId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") return { error: "Only internal users can delete decisions" };

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "initiative_decisions")
      .delete()
      .eq("id", decisionId);

    if (error) return { error: error.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

// ─── Create Task + Auto-Link ───────────────────────────────

export async function createTaskForInitiative(
  initiativeId: string,
  customerId: string,
  tenantId: string,
  title: string,
  assigneeId?: string | null,
) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };

    if (!title?.trim()) return { error: "Title is required" };

    const admin = createSupabaseAdmin();

    // Create the task
    const { data: task, error: taskError } = await admin
      .from("tasks")
      .insert({
        customer_id: customerId,
        tenant_id: tenantId,
        title: title.trim(),
        status: "todo",
        priority: "medium",
        source: "manual",
        assignee_id: assigneeId || claims.profileId,
        created_by: claims.profileId,
      } as any)
      .select("id")
      .single();

    if (taskError) return { error: taskError.message };

    // Link it to the initiative
    await fromTable(admin, "initiative_tasks")
      .insert({ initiative_id: initiativeId, task_id: task.id });

    revalidatePath("/customers");
    revalidatePath("/tasks");
    return { success: true, id: task.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

// ─── Detail Fetch (server action callable from client) ─────

export async function fetchInitiativeDetail(initiativeId: string) {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();

    const { data: initiative, error: initError } = await fromTable(admin, "initiatives")
      .select("*")
      .eq("id", initiativeId)
      .single();

    if (initError || !initiative) return null;

    // Fetch related data in parallel
    const [ownerRes, stakeholdersRes, tasksRes, decisionsRes, commentsRes] = await Promise.all([
      admin.from("profiles").select("id, full_name, avatar_url, email").eq("id", initiative.owner_id).single(),
      fromTable(admin, "initiative_stakeholders")
        .select("id, stakeholder_id, role")
        .eq("initiative_id", initiativeId),
      fromTable(admin, "initiative_tasks")
        .select("task_id")
        .eq("initiative_id", initiativeId),
      fromTable(admin, "initiative_decisions")
        .select("*")
        .eq("initiative_id", initiativeId)
        .order("decided_at", { ascending: false }),
      admin.from("comments")
        .select("id, body, created_at, author_id")
        .eq("entity_type", "initiative" as any)
        .eq("entity_id", initiativeId)
        .order("created_at", { ascending: true }),
    ]);

    // Fetch stakeholder details
    const stakeholderIds = (stakeholdersRes.data ?? []).map((s: any) => s.stakeholder_id);
    let stakeholderDetails: any[] = [];
    if (stakeholderIds.length > 0) {
      const { data: details } = await fromTable(admin, "account_stakeholders")
        .select("id, name, email, title, company, is_ck_internal")
        .in("id", stakeholderIds);
      stakeholderDetails = details ?? [];
    }

    const stakeholders = (stakeholdersRes.data ?? []).map((link: any) => {
      const detail = stakeholderDetails.find((d: any) => d.id === link.stakeholder_id);
      return { ...link, stakeholder: detail ?? null };
    });

    // Fetch task details
    const taskIds = (tasksRes.data ?? []).map((t: any) => t.task_id);
    let tasks: any[] = [];
    if (taskIds.length > 0) {
      const { data: taskData } = await admin
        .from("tasks")
        .select("id, title, status, priority, assignee_id, due_date")
        .in("id", taskIds);

      const assigneeIds = [...new Set((taskData ?? []).map((t: any) => t.assignee_id).filter(Boolean))] as string[];
      const assigneeMap: Record<string, any> = {};
      if (assigneeIds.length > 0) {
        const { data: assignees } = await admin
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", assigneeIds);
        for (const a of (assignees ?? [])) {
          assigneeMap[a.id] = a;
        }
      }

      tasks = (taskData ?? []).map((t: any) => ({
        ...t,
        assignee: assigneeMap[t.assignee_id] ?? null,
      }));
    }

    // Fetch decision author profiles
    const decisionAuthorIds = [...new Set((decisionsRes.data ?? []).map((d: any) => d.decided_by).filter(Boolean))] as string[];
    const decisionAuthorMap: Record<string, any> = {};
    if (decisionAuthorIds.length > 0) {
      const { data: authors } = await admin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", decisionAuthorIds);
      for (const a of (authors ?? [])) {
        decisionAuthorMap[a.id] = a;
      }
    }
    const decisions = (decisionsRes.data ?? []).map((d: any) => ({
      ...d,
      author: decisionAuthorMap[d.decided_by] ?? null,
    }));

    // Fetch comment author profiles
    const commentAuthorIds = [...new Set((commentsRes.data ?? []).map((c: any) => c.author_id).filter(Boolean))] as string[];
    const commentAuthorMap: Record<string, any> = {};
    if (commentAuthorIds.length > 0) {
      const { data: authors } = await admin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", commentAuthorIds);
      for (const a of (authors ?? [])) {
        commentAuthorMap[a.id] = a;
      }
    }
    const comments = (commentsRes.data ?? []).map((c: any) => ({
      ...c,
      author: commentAuthorMap[c.author_id] ?? null,
    }));

    return {
      ...initiative,
      owner: ownerRes.data ?? null,
      stakeholders,
      tasks,
      decisions,
      comments,
    };
  } catch {
    return null;
  }
}
