"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

export async function saveCategoryInstructions(
  tenantId: string,
  categoryKey: string,
  instructions: string,
) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();

    // Upsert — update if exists, insert if not
    const { data: existing } = await fromTable(admin, "ai_category_instructions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("category_key", categoryKey)
      .maybeSingle();

    if (existing) {
      await fromTable(admin, "ai_category_instructions")
        .update({ instructions, is_active: true })
        .eq("id", existing.id);
    } else {
      await fromTable(admin, "ai_category_instructions").insert({
        tenant_id: tenantId,
        category_key: categoryKey,
        instructions,
        is_active: true,
      });
    }

    revalidatePath("/admin/ai-instructions");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}
