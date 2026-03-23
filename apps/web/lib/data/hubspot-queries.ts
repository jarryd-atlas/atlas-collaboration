/**
 * Data queries for HubSpot integration.
 */

import { createSupabaseAdmin } from "../supabase/server";
import type { HubSpotConfig, HubSpotSiteLink, HubSpotFieldMapping, HubSpotSyncLogEntry } from "../hubspot/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

/** Get HubSpot config for a tenant */
export async function getHubSpotConfig(tenantId: string): Promise<HubSpotConfig | null> {
  const admin = createSupabaseAdmin();
  const { data } = await fromTable(admin, "hubspot_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data ?? null) as HubSpotConfig | null;
}

/** Get all HubSpot site links for a tenant, with site info joined */
export async function getHubSpotSiteLinks(tenantId: string): Promise<HubSpotSiteLink[]> {
  const admin = createSupabaseAdmin();
  const { data } = await fromTable(admin, "hubspot_site_links")
    .select("*, sites(name, slug, customer_id)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (!data) return [];

  const siteLinks = (data as unknown) as (HubSpotSiteLink & { sites: { name: string; slug: string; customer_id: string } })[];
  const customerIds = [...new Set(siteLinks.map((l) => l.sites?.customer_id).filter(Boolean))];

  let customerMap: Record<string, string> = {};
  if (customerIds.length > 0) {
    const { data: customers } = await admin
      .from("customers")
      .select("id, slug")
      .in("id", customerIds as string[]);
    if (customers) {
      customerMap = Object.fromEntries(customers.map((c) => [c.id, c.slug]));
    }
  }

  return siteLinks.map((link) => ({
    ...link,
    site: link.sites
      ? {
          name: link.sites.name,
          slug: link.sites.slug,
          customer_slug: customerMap[link.sites.customer_id] ?? undefined,
        }
      : undefined,
  }));
}

/** Get HubSpot link for a specific site */
export async function getHubSpotLinkForSite(siteId: string): Promise<HubSpotSiteLink | null> {
  const admin = createSupabaseAdmin();
  const { data } = await fromTable(admin, "hubspot_site_links")
    .select("*")
    .eq("site_id", siteId)
    .maybeSingle();
  return (data ?? null) as unknown as HubSpotSiteLink | null;
}

/** Get all field mappings for a tenant */
export async function getHubSpotFieldMappings(tenantId: string): Promise<HubSpotFieldMapping[]> {
  const admin = createSupabaseAdmin();
  const { data } = await fromTable(admin, "hubspot_field_mappings")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  return ((data as unknown) as HubSpotFieldMapping[]) ?? [];
}

/** Get recent sync log entries */
export async function getHubSpotSyncLog(
  tenantId: string,
  opts?: { siteLinkId?: string; limit?: number }
): Promise<HubSpotSyncLogEntry[]> {
  const admin = createSupabaseAdmin();
  let query = fromTable(admin, "hubspot_sync_log")
    .select("*, hubspot_site_links(deal_name, site_id)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);

  if (opts?.siteLinkId) {
    query = query.eq("site_link_id", opts.siteLinkId);
  }

  const { data } = await query;
  return ((data as unknown) as HubSpotSyncLogEntry[]) ?? [];
}
