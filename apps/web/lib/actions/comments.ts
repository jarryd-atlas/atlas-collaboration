"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import type { EntityType } from "@repo/supabase";

export async function createComment(formData: FormData) {
  const { claims } = await requireSession();

  const entityType = formData.get("entityType") as EntityType;
  const entityId = formData.get("entityId") as string;
  const body = formData.get("body") as string;
  const tenantId = formData.get("tenantId") as string;

  if (!body.trim()) throw new Error("Comment body required");

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("comments").insert({
    tenant_id: tenantId,
    entity_type: entityType,
    entity_id: entityId,
    author_id: claims.profileId!,
    body: body.trim(),
  });

  if (error) throw error;

  revalidatePath("/customers");
}

export async function deleteComment(commentId: string) {
  const { claims } = await requireSession();

  // Users can only delete their own comments (enforced by RLS too)
  const admin = createSupabaseAdmin();
  const { data: comment } = await admin
    .from("comments")
    .select("author_id")
    .eq("id", commentId)
    .single();

  if (comment?.author_id !== claims.profileId) {
    throw new Error("Can only delete your own comments");
  }

  const { error } = await admin.from("comments").delete().eq("id", commentId);

  if (error) throw error;

  revalidatePath("/customers");
}
