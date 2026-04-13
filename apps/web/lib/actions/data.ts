"use server";

import { createSupabaseAdmin, requireSession } from "../supabase/server";

/**
 * Server-side data fetching actions for client components.
 * These bypass RLS (using admin client) since the JWT hook is disabled
 * and custom claims aren't available in browser-side tokens.
 */

export async function fetchSitesWithMilestones() {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("sites")
      .select("id, name, tenant_id, customer_id, milestones(id, name)")
      .order("name");

    if (error) return { error: error.message, sites: [] };
    return { sites: data ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to fetch sites", sites: [] };
  }
}

export async function fetchAssignableUsers() {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();
    // Get the internal (CK) tenant
    const { data: tenant } = await admin
      .from("tenants")
      .select("id")
      .eq("type", "internal")
      .single();

    if (!tenant) return { users: [] };

    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("status", "active")
      .eq("tenant_id", tenant.id)
      .order("full_name");

    if (error) return { users: [] };
    return { users: data ?? [] };
  } catch {
    return { users: [] };
  }
}

export async function fetchCustomers() {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("customers")
      .select("id, name, slug, tenant_id")
      .order("name");

    if (error) return { customers: [] };
    return { customers: data ?? [] };
  } catch {
    return { customers: [] };
  }
}

/**
 * Combined fetch for Quick Task dialog — single round-trip instead of 3.
 */
export async function fetchQuickTaskData() {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    const [sitesResult, tenantResult, customersResult] = await Promise.all([
      admin.from("sites").select("id, name, tenant_id, customer_id").order("name"),
      admin.from("tenants").select("id").eq("type", "internal").single(),
      admin.from("customers").select("id, name, slug, tenant_id").order("name"),
    ]);

    let users: any[] = [];
    if (tenantResult.data) {
      const { data } = await admin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("status", "active")
        .eq("tenant_id", tenantResult.data.id)
        .order("full_name");
      users = data ?? [];
    }

    return {
      sites: sitesResult.data ?? [],
      customers: customersResult.data ?? [],
      users,
    };
  } catch {
    return { sites: [], customers: [], users: [] };
  }
}

export async function fetchSitesList() {
  try {
    await requireSession();

    const admin = createSupabaseAdmin();
    const { data, error } = await admin
      .from("sites")
      .select("id, name, tenant_id")
      .order("name");

    if (error) return { error: error.message, sites: [] };
    return { sites: data ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to fetch sites", sites: [] };
  }
}
