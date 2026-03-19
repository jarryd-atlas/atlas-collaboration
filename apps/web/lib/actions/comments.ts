"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import type { EntityType } from "@repo/supabase";

export async function createComment(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (!claims.profileId) return { error: "Profile not found" };

    const entityType = formData.get("entityType") as EntityType;
    const entityId = formData.get("entityId") as string;
    const body = formData.get("body") as string;
    const tenantId = formData.get("tenantId") as string;

    if (!body.trim()) return { error: "Comment body required" };

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin.from("comments").insert({
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      author_id: claims.profileId,
      body: body.trim(),
    });

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteComment(commentId: string) {
  try {
    const { claims } = await requireSession();

    // Users can only delete their own comments (enforced by RLS too)
    const admin = createSupabaseAdmin();
    const { data: comment } = await admin
      .from("comments")
      .select("author_id")
      .eq("id", commentId)
      .single();

    if (comment?.author_id !== claims.profileId) {
      return { error: "Can only delete your own comments" };
    }

    const { error: dbError } = await admin.from("comments").delete().eq("id", commentId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
