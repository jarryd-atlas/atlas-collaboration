"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import { slugify } from "../utils";

export async function createBusinessUnit(customerId: string, tenantId: string, name: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const slug = slugify(name);
    const admin = createSupabaseAdmin();
    const { data, error } = await (admin as any)
      .from("business_units")
      .insert({ customer_id: customerId, tenant_id: tenantId, name, slug })
      .select("id, name, slug")
      .single();

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true, businessUnit: data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateBusinessUnit(id: string, name: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const slug = slugify(name);
    const admin = createSupabaseAdmin();
    const { error } = await (admin as any)
      .from("business_units")
      .update({ name, slug })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function deleteBusinessUnit(id: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error } = await (admin as any)
      .from("business_units")
      .delete()
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function assignSiteBusinessUnit(siteId: string, businessUnitId: string | null) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error } = await (admin as any)
      .from("sites")
      .update({ business_unit_id: businessUnitId })
      .eq("id", siteId);

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
