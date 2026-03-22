"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

/**
 * Add a CK team member to a customer account.
 * Only CK admins can do this. Validates that the profile belongs to the internal tenant.
 */
export async function addCKTeamMember(
  customerId: string,
  profileId: string,
  roleLabel?: string,
) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Only CK team members can manage customer teams" };
    }

    const admin = createSupabaseAdmin();

    // Verify the profile belongs to the internal tenant
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id, tenant:tenants!inner(type)")
      .eq("id", profileId)
      .single();

    if (!profile || (profile as any).tenant?.type !== "internal") {
      return { error: "Can only add CK internal users to customer teams" };
    }

    const { error: insertError } = await admin
      .from("customer_team_members" as any)
      .insert({
        customer_id: customerId,
        profile_id: profileId,
        role_label: roleLabel || null,
      } as any);

    if (insertError) {
      if (insertError.code === "23505") {
        return { error: "This team member is already assigned to this customer" };
      }
      return { error: insertError.message };
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Remove a CK team member from a customer account.
 */
export async function removeCKTeamMember(customerId: string, profileId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Only CK team members can manage customer teams" };
    }

    const admin = createSupabaseAdmin();
    const { error: deleteError } = await admin
      .from("customer_team_members" as any)
      .delete()
      .eq("customer_id", customerId)
      .eq("profile_id", profileId);

    if (deleteError) return { error: deleteError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/**
 * Update the role label of a CK team member on a customer account.
 */
export async function updateCKTeamMemberLabel(
  customerId: string,
  profileId: string,
  roleLabel: string,
) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Only CK team members can manage customer teams" };
    }

    const admin = createSupabaseAdmin();
    const { error: updateError } = await admin
      .from("customer_team_members" as any)
      .update({ role_label: roleLabel || null } as any)
      .eq("customer_id", customerId)
      .eq("profile_id", profileId);

    if (updateError) return { error: updateError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
