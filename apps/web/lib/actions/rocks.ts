"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

// ─── Rocks CRUD ────────────────────────────────────────────

export async function createRock(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") return { error: "Only internal users can manage rocks" };
    if (!claims.profileId) return { error: "Profile not found" };

    const title = formData.get("title") as string;
    const description = (formData.get("description") as string) || null;
    const level = formData.get("level") as string;
    const quarter = parseInt(formData.get("quarter") as string, 10);
    const year = parseInt(formData.get("year") as string, 10);
    const ownerId = (formData.get("ownerId") as string) || null;
    const parentRockId = (formData.get("parentRockId") as string) || null;
    const teamName = (formData.get("teamName") as string) || null;
    const departmentName = (formData.get("departmentName") as string) || null;

    if (!title?.trim()) return { error: "Title is required" };
    if (!level) return { error: "Level is required" };
    if (!quarter || !year) return { error: "Quarter and year are required" };

    const admin = createSupabaseAdmin();
    const { data, error } = await fromTable(admin, "rocks")
      .insert({
        title: title.trim(),
        description,
        level,
        quarter,
        year,
        owner_id: ownerId,
        parent_rock_id: parentRockId || null,
        team_name: teamName,
        department_name: departmentName,
        created_by: claims.profileId,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };

    // Add collaborators if provided
    const collaboratorIds = formData.get("collaboratorIds") as string;
    if (collaboratorIds) {
      const ids = collaboratorIds.split(",").filter(Boolean);
      if (ids.length > 0) {
        const rows = ids.map((pid) => ({ rock_id: data.id, profile_id: pid }));
        await fromTable(admin, "rock_collaborators").insert(rows);
      }
    }

    revalidatePath("/rocks");
    return { success: true, id: data.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateRock(
  rockId: string,
  data: {
    title?: string;
    description?: string | null;
    status?: string;
    level?: string;
    owner_id?: string | null;
    parent_rock_id?: string | null;
    team_name?: string | null;
    department_name?: string | null;
  },
) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") return { error: "Only internal users can manage rocks" };

    const admin = createSupabaseAdmin();

    const updateData: Record<string, unknown> = { ...data };
    if (data.status === "complete") {
      updateData.completed_at = new Date().toISOString();
    } else if (data.status && data.status !== "complete") {
      updateData.completed_at = null;
    }

    const { error } = await fromTable(admin, "rocks")
      .update(updateData)
      .eq("id", rockId);

    if (error) return { error: error.message };

    revalidatePath("/rocks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteRock(rockId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") return { error: "Only internal users can delete rocks" };

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "rocks")
      .delete()
      .eq("id", rockId);

    if (error) return { error: error.message };

    revalidatePath("/rocks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function linkRockToParent(rockId: string, parentRockId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") return { error: "Only internal users can manage rocks" };

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "rocks")
      .update({ parent_rock_id: parentRockId })
      .eq("id", rockId);

    if (error) return { error: error.message };

    revalidatePath("/rocks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function setRockCollaborators(rockId: string, profileIds: string[]) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") return { error: "Only internal users can manage rocks" };

    const admin = createSupabaseAdmin();

    // Delete existing collaborators
    await fromTable(admin, "rock_collaborators").delete().eq("rock_id", rockId);

    // Insert new ones
    if (profileIds.length > 0) {
      const rows = profileIds.map((pid) => ({ rock_id: rockId, profile_id: pid }));
      const { error } = await fromTable(admin, "rock_collaborators").insert(rows);
      if (error) return { error: error.message };
    }

    revalidatePath("/rocks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function unlinkRockFromParent(rockId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") return { error: "Only internal users can manage rocks" };

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "rocks")
      .update({ parent_rock_id: null })
      .eq("id", rockId);

    if (error) return { error: error.message };

    revalidatePath("/rocks");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
