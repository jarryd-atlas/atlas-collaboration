"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "../supabase/server";
import { requireSession } from "../supabase/server";
import { slugify } from "../utils";

export async function createCustomer(formData: FormData) {
  const { claims } = await requireSession();
  if (claims.tenantType !== "internal") throw new Error("Forbidden");

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

  if (tenantErr) throw tenantErr;

  // Create the customer record
  const { error: customerErr } = await admin
    .from("customers")
    .insert({
      tenant_id: tenant.id,
      name,
      slug,
      logo_url: logoUrl,
    });

  if (customerErr) throw customerErr;

  revalidatePath("/");
  revalidatePath("/customers");
  return { slug };
}

export async function updateCustomer(customerId: string, formData: FormData) {
  const { claims } = await requireSession();
  if (claims.tenantType !== "internal") throw new Error("Forbidden");

  const name = formData.get("name") as string;
  const logoUrl = (formData.get("logoUrl") as string) || null;

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("customers")
    .update({ name, logo_url: logoUrl })
    .eq("id", customerId);

  if (error) throw error;

  revalidatePath("/customers");
}
