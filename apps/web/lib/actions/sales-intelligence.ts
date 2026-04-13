"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

// ─── Buying Triggers ─────────────────────────────────────────

export async function createBuyingTrigger(
  customerId: string,
  tenantId: string,
  data: {
    trigger_key?: string;
    custom_label?: string;
    persona_type?: string;
    fired_date?: string;
    notes?: string;
  }
) {
  try {
    const { claims, session } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { data: result, error } = await (admin as any)
      .from("account_buying_triggers")
      .insert({
        customer_id: customerId,
        tenant_id: tenantId,
        created_by: session.user.id,
        ...data,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true, id: result.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateBuyingTrigger(
  id: string,
  data: {
    is_active?: boolean;
    fired_date?: string | null;
    notes?: string;
  }
) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error } = await (admin as any)
      .from("account_buying_triggers")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteBuyingTrigger(id: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error } = await (admin as any)
      .from("account_buying_triggers")
      .delete()
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

// ─── Objections ──────────────────────────────────────────────

export async function createObjection(
  customerId: string,
  tenantId: string,
  data: {
    objection_key?: string;
    custom_label?: string;
    raised_by_stakeholder_id?: string | null;
    notes?: string;
  }
) {
  try {
    const { claims, session } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { data: result, error } = await (admin as any)
      .from("account_objections")
      .insert({
        customer_id: customerId,
        tenant_id: tenantId,
        created_by: session.user.id,
        ...data,
      })
      .select("id")
      .single();

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true, id: result.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateObjection(
  id: string,
  data: {
    status?: string;
    notes?: string;
    resolution_notes?: string;
  }
) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error } = await (admin as any)
      .from("account_objections")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteObjection(id: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error } = await (admin as any)
      .from("account_objections")
      .delete()
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
