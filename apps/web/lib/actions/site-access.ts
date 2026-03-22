"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

/**
 * Set site access for a customer profile.
 * Empty array = company-level (unrestricted access to all sites).
 * Non-empty = restricted to only those sites.
 * CK admin only.
 */
export async function setSiteAccess(profileId: string, siteIds: string[]) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal" || (claims.appRole !== "admin" && claims.appRole !== "super_admin")) {
      return { error: "Only CK admins can manage site access" };
    }

    const admin = createSupabaseAdmin();

    // Delete all existing site_access rows for this profile
    const { error: deleteError } = await admin
      .from("site_access" as any)
      .delete()
      .eq("profile_id", profileId);

    if (deleteError) return { error: deleteError.message };

    // Insert new rows if any
    if (siteIds.length > 0) {
      const rows = siteIds.map((siteId) => ({
        profile_id: profileId,
        site_id: siteId,
      }));

      const { error: insertError } = await admin
        .from("site_access" as any)
        .insert(rows as any);

      if (insertError) return { error: insertError.message };
    }

    revalidatePath("/customers");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
