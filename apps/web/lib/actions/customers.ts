"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "../supabase/server";
import { requireSession } from "../supabase/server";
import { slugify } from "../utils";

export async function createCustomer(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden: only internal users can create customers" };
    }

    const name = formData.get("name") as string;
    const domain = (formData.get("domain") as string) || null;
    const logoUrl = (formData.get("logoUrl") as string) || null;
    const companyType = (formData.get("companyType") as string) || "customer";
    const slug = slugify(name);

    const admin = createSupabaseAdmin();

    // Create a customer tenant
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({ name, type: "customer" as const, domain, logo_url: logoUrl })
      .select()
      .single();

    if (tenantErr) return { error: `Failed to create tenant: ${tenantErr.message}` };

    // HQ location fields (optional)
    const hqAddress = (formData.get("hqAddress") as string) || null;
    const hqCity = (formData.get("hqCity") as string) || null;
    const hqState = (formData.get("hqState") as string) || null;
    const hqZip = (formData.get("hqZip") as string) || null;
    const hqLat = formData.get("hqLatitude") ? parseFloat(formData.get("hqLatitude") as string) : null;
    const hqLng = formData.get("hqLongitude") ? parseFloat(formData.get("hqLongitude") as string) : null;

    // Create the company record
    const { error: customerErr } = await admin
      .from("customers")
      .insert({
        tenant_id: tenant.id,
        name,
        slug,
        logo_url: logoUrl,
        company_type: companyType,
        hq_address: hqAddress,
        hq_city: hqCity,
        hq_state: hqState,
        hq_zip: hqZip,
        hq_latitude: hqLat,
        hq_longitude: hqLng,
      });

    if (customerErr) return { error: `Failed to create customer: ${customerErr.message}` };

    revalidatePath("/");
    revalidatePath("/customers");
    return { slug };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/** Search customers by name — for transfer site dialog */
export async function searchCustomers(query: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("customers")
      .select("id, name, slug")
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(20);

    if (error) return { error: error.message };
    return { customers: data ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateCustomer(customerId: string, formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const name = formData.get("name") as string;
    const logoUrl = (formData.get("logoUrl") as string) || null;

    const update: Record<string, unknown> = { name, logo_url: logoUrl };

    // HQ location fields (only include if provided)
    if (formData.has("hqAddress")) {
      update.hq_address = (formData.get("hqAddress") as string) || null;
      update.hq_city = (formData.get("hqCity") as string) || null;
      update.hq_state = (formData.get("hqState") as string) || null;
      update.hq_zip = (formData.get("hqZip") as string) || null;
      update.hq_latitude = formData.get("hqLatitude") ? parseFloat(formData.get("hqLatitude") as string) : null;
      update.hq_longitude = formData.get("hqLongitude") ? parseFloat(formData.get("hqLongitude") as string) : null;
    }

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("customers")
      .update(update)
      .eq("id", customerId);

    if (error) return { error: error.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
