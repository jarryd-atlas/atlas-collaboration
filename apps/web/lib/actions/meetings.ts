"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

/**
 * Create a new meeting series (standup, 1:1, or Account 360) with participants.
 * Creates the series + adds participants + creates first meeting.
 *
 * For account_360 series, `customerId` is required and `cadence` defaults to weekly.
 */
export async function createMeetingSeries(
  title: string,
  type: "standup" | "one_on_one" | "account_360",
  participantIds: string[],
  options?: {
    customerId?: string | null;
    cadence?: "weekly" | "biweekly" | "monthly" | null;
  }
) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };
    if (claims.tenantType !== "internal") return { error: "Internal users only" };

    if (!title.trim()) return { error: "Title is required" };

    if (type === "account_360") {
      if (!options?.customerId) return { error: "Customer is required for Account 360 meetings" };
    } else {
      if (participantIds.length === 0) return { error: "At least one participant required" };
    }

    // Ensure the creator is included in participants
    const allParticipantIds = new Set([claims.profileId, ...participantIds]);

    const admin = createSupabaseAdmin();

    // Create the series.
    // For account_360 we prefer the RPC function (bypasses PostgREST column cache).
    // Falls back to a plain insert + update if the RPC isn't available yet.
    let seriesId: string;

    if (type === "account_360") {
      // Try RPC first — works even when PostgREST column cache is stale
      const { data: rpcId, error: rpcError } = await (admin as any).rpc(
        "create_account360_series",
        {
          p_tenant_id: claims.tenantId,
          p_type: type,
          p_title: title.trim(),
          p_created_by: claims.profileId,
          p_customer_id: options?.customerId,
          p_cadence: options?.cadence ?? "weekly",
        },
      );

      if (!rpcError && rpcId) {
        seriesId = rpcId;
      } else {
        // Fallback: insert without new columns, then try to update them
        const { data: series, error: seriesError } = await fromTable(admin, "meeting_series")
          .insert({
            tenant_id: claims.tenantId,
            type,
            title: title.trim(),
            created_by: claims.profileId,
          })
          .select("id")
          .single();

        if (seriesError) return { error: seriesError.message };
        seriesId = series.id;

        // Best-effort: set customer_id / cadence (may fail if cache is stale)
        await fromTable(admin, "meeting_series")
          .update({
            customer_id: options?.customerId ?? null,
            cadence: options?.cadence ?? "weekly",
          })
          .eq("id", seriesId);
      }
    } else {
      const { data: series, error: seriesError } = await fromTable(admin, "meeting_series")
        .insert({
          tenant_id: claims.tenantId,
          type,
          title: title.trim(),
          created_by: claims.profileId,
        })
        .select("id")
        .single();

      if (seriesError) return { error: seriesError.message };
      seriesId = series.id;
    }

    // Add participants
    const participantRows = [...allParticipantIds].map((profileId) => ({
      series_id: seriesId,
      profile_id: profileId,
    }));

    const { error: partError } = await fromTable(admin, "meeting_participants")
      .insert(participantRows);

    if (partError) return { error: partError.message };

    // Create first meeting (today)
    const { error: meetingError } = await fromTable(admin, "meetings")
      .insert({
        series_id: seriesId,
        meeting_date: new Date().toISOString().split("T")[0],
        status: "active",
      });

    if (meetingError) return { error: meetingError.message };

    revalidatePath("/meetings");
    return { success: true, id: seriesId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/** Sections whose incomplete items carry forward in account_360 meetings. */
const ACCOUNT_360_CARRY_OVER_SECTIONS = ["priorities", "blockers", "marketing_asks"];

/**
 * Create a new meeting instance in a series.
 *
 * For account_360 series, also copies incomplete items in the carry-over
 * sections (priorities, blockers, marketing asks) forward from the previous
 * meeting. Cross-team grid items (product/revenue/marketing working/risks/opps)
 * do NOT carry forward — those are fresh each week.
 */
export async function createMeeting(seriesId: string) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };
    if (claims.tenantType !== "internal") return { error: "Internal users only" };

    const admin = createSupabaseAdmin();

    // Load series to determine type (and bypass RLS via admin).
    const { data: series } = await fromTable(admin, "meeting_series")
      .select("id, type")
      .eq("id", seriesId)
      .single();

    if (!series) return { error: "Series not found" };

    // Non-account_360 series still require the caller to be a participant.
    if (series.type !== "account_360") {
      const { data: participant } = await fromTable(admin, "meeting_participants")
        .select("id")
        .eq("series_id", seriesId)
        .eq("profile_id", claims.profileId)
        .single();

      if (!participant) return { error: "Not a participant in this series" };
    }

    // Look up the previous meeting before creating a new one — used for carry-over.
    const { data: previousMeeting } = await fromTable(admin, "meetings")
      .select("id")
      .eq("series_id", seriesId)
      .order("meeting_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Create meeting
    const { data: meeting, error } = await fromTable(admin, "meetings")
      .insert({
        series_id: seriesId,
        meeting_date: new Date().toISOString().split("T")[0],
        status: "active",
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    // Carry forward incomplete items in key sections for account_360 series.
    if (series.type === "account_360" && previousMeeting?.id) {
      const { data: carryItems } = await fromTable(admin, "meeting_items")
        .select("body, section, assignee_id, customer_id, site_id, due_date, sort_order")
        .eq("meeting_id", previousMeeting.id)
        .in("section", ACCOUNT_360_CARRY_OVER_SECTIONS)
        .eq("completed", false);

      if (carryItems && carryItems.length > 0) {
        const newRows = (carryItems as any[]).map((it) => ({
          meeting_id: meeting.id,
          // Carry-over sections (priorities/blockers/marketing_asks) are always
          // action_item type so they keep their checkbox in the UI.
          type: "action_item" as const,
          body: it.body,
          section: it.section,
          author_id: claims.profileId,
          assignee_id: it.assignee_id ?? null,
          customer_id: it.customer_id ?? null,
          site_id: it.site_id ?? null,
          due_date: it.due_date ?? null,
          sort_order: it.sort_order ?? 0,
          // Leave task_id null so we don't duplicate the source task.
          task_id: null,
        }));

        await fromTable(admin, "meeting_items").insert(newRows);
      }
    }

    revalidatePath("/meetings");
    return { success: true, id: meeting.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Add a note, action item, or talking point to a meeting.
 * If it's an action item with an assignee, auto-creates a task.
 */
export async function addMeetingItem(
  meetingId: string,
  item: {
    type: "note" | "action_item" | "talking_point";
    body: string;
    customerId?: string | null;
    siteId?: string | null;
    assigneeId?: string | null;
    dueDate?: string | null;
    section?: string | null;
  }
) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };
    if (claims.tenantType !== "internal") return { error: "Internal users only" };

    if (!item.body.trim()) return { error: "Body is required" };

    const admin = createSupabaseAdmin();

    // Verify user is a participant (through meeting → series → participants),
    // OR the series is an account_360 (which any internal user may edit).
    const { data: meeting } = await fromTable(admin, "meetings")
      .select("id, series_id, meeting_series:meeting_series(type)")
      .eq("id", meetingId)
      .single();

    if (!meeting) return { error: "Meeting not found" };

    const seriesType = (meeting as any).meeting_series?.type as string | undefined;

    if (seriesType !== "account_360") {
      const { data: participant } = await fromTable(admin, "meeting_participants")
        .select("id")
        .eq("series_id", meeting.series_id)
        .eq("profile_id", claims.profileId)
        .single();

      if (!participant) return { error: "Not a participant" };
    }

    let taskId: string | null = null;

    // Auto-create task for action items with an assignee
    if (item.type === "action_item" && item.assigneeId) {
      // Look up the customer's tenant_id for the task
      let taskTenantId = claims.tenantId;
      if (item.customerId) {
        const { data: customer } = await admin
          .from("customers")
          .select("tenant_id")
          .eq("id", item.customerId)
          .single();
        if (customer) taskTenantId = customer.tenant_id;
      }

      const { data: task, error: taskError } = await admin
        .from("tasks")
        .insert({
          title: item.body.trim(),
          tenant_id: taskTenantId,
          customer_id: item.customerId || null,
          site_id: item.siteId || null,
          assignee_id: item.assigneeId,
          due_date: item.dueDate || null,
          status: "todo",
          priority: "medium",
          source: "manual",
          created_by: claims.profileId,
        } as any)
        .select("id")
        .single();

      if (!taskError && task) {
        taskId = task.id;
      }
    }

    // Insert the meeting item
    const { data: meetingItem, error: itemError } = await fromTable(admin, "meeting_items")
      .insert({
        meeting_id: meetingId,
        type: item.type,
        body: item.body.trim(),
        customer_id: item.customerId || null,
        site_id: item.siteId || null,
        author_id: claims.profileId,
        assignee_id: item.assigneeId || null,
        due_date: item.dueDate || null,
        task_id: taskId,
        section: item.section || null,
      })
      .select("id")
      .single();

    if (itemError) return { error: itemError.message };

    revalidatePath("/meetings");
    revalidatePath("/tasks");
    return { success: true, id: meetingItem.id, taskId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Update a meeting item (body, completed status, assignee, due date).
 */
export async function updateMeetingItem(
  itemId: string,
  updates: {
    body?: string;
    completed?: boolean;
    assigneeId?: string | null;
    dueDate?: string | null;
  }
) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };
    if (claims.tenantType !== "internal") return { error: "Internal users only" };

    const admin = createSupabaseAdmin();

    // Get the item to check access and get task_id
    const { data: existingItem } = await fromTable(admin, "meeting_items")
      .select("id, task_id, meeting_id")
      .eq("id", itemId)
      .single();

    if (!existingItem) return { error: "Item not found" };

    // Build update object
    const updateData: Record<string, any> = {};
    if (updates.body !== undefined) updateData.body = updates.body.trim();
    if (updates.completed !== undefined) updateData.completed = updates.completed;
    if (updates.assigneeId !== undefined) updateData.assignee_id = updates.assigneeId;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;

    const { error: updateError } = await fromTable(admin, "meeting_items")
      .update(updateData)
      .eq("id", itemId);

    if (updateError) return { error: updateError.message };

    // If completing/uncompleting an action item with a linked task, update the task too
    if (updates.completed !== undefined && existingItem.task_id) {
      await admin
        .from("tasks")
        .update({ status: updates.completed ? "done" : "todo" })
        .eq("id", existingItem.task_id);
    }

    revalidatePath("/meetings");
    revalidatePath("/tasks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Delete a meeting item. Does NOT delete the linked task.
 */
export async function deleteMeetingItem(itemId: string) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };
    if (claims.tenantType !== "internal") return { error: "Internal users only" };

    const admin = createSupabaseAdmin();

    const { error } = await fromTable(admin, "meeting_items")
      .delete()
      .eq("id", itemId);

    if (error) return { error: error.message };

    revalidatePath("/meetings");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Complete a meeting (set status to 'completed').
 */
export async function completeMeeting(meetingId: string) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };
    if (claims.tenantType !== "internal") return { error: "Internal users only" };

    const admin = createSupabaseAdmin();

    const { error } = await fromTable(admin, "meetings")
      .update({ status: "completed" })
      .eq("id", meetingId);

    if (error) return { error: error.message };

    revalidatePath("/meetings");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Add a participant to a meeting series.
 */
export async function addMeetingParticipant(seriesId: string, profileId: string) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };
    if (claims.tenantType !== "internal") return { error: "Internal users only" };

    const admin = createSupabaseAdmin();

    const { error } = await fromTable(admin, "meeting_participants")
      .insert({ series_id: seriesId, profile_id: profileId });

    if (error) {
      if (error.code === "23505") return { error: "Already a participant" };
      return { error: error.message };
    }

    revalidatePath("/meetings");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Remove a participant from a meeting series.
 */
export async function removeMeetingParticipant(seriesId: string, profileId: string) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };
    if (claims.tenantType !== "internal") return { error: "Internal users only" };

    const admin = createSupabaseAdmin();

    const { error } = await fromTable(admin, "meeting_participants")
      .delete()
      .eq("series_id", seriesId)
      .eq("profile_id", profileId);

    if (error) return { error: error.message };

    revalidatePath("/meetings");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
