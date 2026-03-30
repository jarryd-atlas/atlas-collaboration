"use server";

import { createSupabaseServer, createSupabaseAdmin } from "../supabase/server";
import { getCurrentUser } from "../data/current-user";

export interface SiteGoogleDoc {
  id: string;
  site_id: string;
  google_file_id: string;
  title: string;
  mime_type: string;
  google_url: string;
  thumbnail_url: string | null;
  icon_url: string | null;
  linked_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Link a Google Workspace file to a site.
 */
export async function linkGoogleDoc(
  siteId: string,
  fileData: {
    google_file_id: string;
    title: string;
    mime_type: string;
    google_url: string;
    thumbnail_url?: string;
    icon_url?: string;
  },
): Promise<{ id: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.sessionClaims?.tenantType !== "internal") return { error: "Internal users only" };

  // Use admin client to bypass RLS — this is an internal-only feature
  const admin = createSupabaseAdmin();
  const { data, error } = await (admin as any)
    .from("site_google_docs")
    .insert({
      tenant_id: user.sessionClaims?.tenantId,
      site_id: siteId,
      google_file_id: fileData.google_file_id,
      title: fileData.title,
      mime_type: fileData.mime_type,
      google_url: fileData.google_url,
      thumbnail_url: fileData.thumbnail_url ?? null,
      icon_url: fileData.icon_url ?? null,
      linked_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "This document is already linked to this site." };
    }
    return { error: error.message };
  }

  return { id: data.id };
}

/**
 * Unlink a Google Doc from a site.
 */
export async function unlinkGoogleDoc(linkId: string): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user || user.sessionClaims?.tenantType !== "internal") return { error: "Internal users only" };

  const admin = createSupabaseAdmin();
  const { error } = await (admin as any)
    .from("site_google_docs")
    .delete()
    .eq("id", linkId);

  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Fetch all linked Google Docs for a site.
 */
export async function fetchLinkedGoogleDocs(siteId: string): Promise<SiteGoogleDoc[]> {
  const admin = createSupabaseAdmin();

  const { data, error } = await (admin as any)
    .from("site_google_docs")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch linked Google Docs:", error);
    return [];
  }

  return (data ?? []) as SiteGoogleDoc[];
}
