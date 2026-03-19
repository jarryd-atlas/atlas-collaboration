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
    const slug = slugify(name);

    const admin = createSupabaseAdmin();

    // Create a customer tenant
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({ name, type: "customer" as const, domain, logo_url: logoUrl })
      .select()
      .single();

    if (tenantErr) return { error: `Failed to create tenant: ${tenantErr.message}` };

    // Create the customer record
    const { error: customerErr } = await admin
      .from("customers")
      .insert({
        tenant_id: tenant.id,
        name,
        slug,
        logo_url: logoUrl,
      });

    if (customerErr) return { error: `Failed to create customer: ${customerErr.message}` };

    revalidatePath("/");
    revalidatePath("/customers");
    return { slug };
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

    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("customers")
      .update({ name, logo_url: logoUrl })
      .eq("id", customerId);

    if (error) return { error: error.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
