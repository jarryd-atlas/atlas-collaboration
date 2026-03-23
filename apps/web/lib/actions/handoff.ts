"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

export async function generateHandoff(
  siteId: string,
  tenantId: string,
  assessmentId: string,
  profileId: string,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    // Check for existing handoff
    const { data: existing } = await fromTable(admin, "handoff_reports")
      .select("*")
      .eq("site_id", siteId)
      .single();

    if (existing) {
      // Update generation timestamp
      await fromTable(admin, "handoff_reports")
        .update({ generated_by: profileId, generated_at: new Date().toISOString() })
        .eq("id", existing.id);
      revalidatePath("/customers");
      return { handoff: existing };
    }

    // Get site name for default title
    const { data: site } = await admin.from("sites").select("name").eq("id", siteId).single();
    const title = `${site?.name ?? "Site"} — Sales Engineering Handoff`;

    const { data: row, error } = await fromTable(admin, "handoff_reports")
      .insert({
        site_id: siteId,
        tenant_id: tenantId,
        assessment_id: assessmentId,
        title,
        generated_by: profileId,
      })
      .select()
      .single();

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { handoff: row };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}
