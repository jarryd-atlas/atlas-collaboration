"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import { syncSiteWithDeal } from "../hubspot/sync";
import { DEFAULT_FIELD_MAPPINGS } from "../hubspot/constants";
import type { SyncDirection, SyncResult } from "../hubspot/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

// ─── Connection Management ─────────────────────────────────

export async function saveHubSpotConfig(token: string, portalId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();
    const tenantId = claims.tenantId!;

    // Upsert config
    const { error: dbError } = await fromTable(admin, "hubspot_config")
      .upsert(
        { tenant_id: tenantId, access_token: token, portal_id: portalId, is_active: true },
        { onConflict: "tenant_id" }
      );

    if (dbError) return { error: dbError.message };

    // Seed default field mappings if none exist
    const { count } = await fromTable(admin, "hubspot_field_mappings")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    if (count === 0) {
      const seeds = DEFAULT_FIELD_MAPPINGS.map((m) => ({
        ...m,
        tenant_id: tenantId,
      }));
      await fromTable(admin, "hubspot_field_mappings").insert(seeds);
    }

    revalidatePath("/admin/integrations");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function disconnectHubSpot() {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();
    await fromTable(admin, "hubspot_config")
      .update({ is_active: false })
      .eq("tenant_id", claims.tenantId!);

    revalidatePath("/admin/integrations");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ─── Deal Linking ──────────────────────────────────────────

export async function linkDealToSite(siteId: string, dealId: string, dealName: string) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await fromTable(admin, "hubspot_site_links").insert({
      tenant_id: claims.tenantId!,
      site_id: siteId,
      hubspot_deal_id: dealId,
      deal_name: dealName,
      linked_by: claims.profileId ?? null,
    });

    if (dbError) {
      if (dbError.code === "23505") {
        return { error: "This site or deal is already linked" };
      }
      return { error: dbError.message };
    }

    revalidatePath("/admin/integrations");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function unlinkDealFromSite(siteLinkId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await fromTable(admin, "hubspot_site_links")
      .delete()
      .eq("id", siteLinkId)
      .eq("tenant_id", claims.tenantId!);

    if (dbError) return { error: dbError.message };

    revalidatePath("/admin/integrations");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ─── Field Mapping CRUD ────────────────────────────────────

export async function addFieldMapping(data: {
  hubspot_property: string;
  app_table: string;
  app_column: string;
  direction: SyncDirection;
  transform?: string;
}) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await fromTable(admin, "hubspot_field_mappings").insert({
      ...data,
      tenant_id: claims.tenantId!,
    });

    if (dbError) {
      if (dbError.code === "23505") return { error: "This mapping already exists" };
      return { error: dbError.message };
    }

    revalidatePath("/admin/integrations");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function updateFieldMapping(
  mappingId: string,
  data: { direction?: SyncDirection; transform?: string; is_active?: boolean }
) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await fromTable(admin, "hubspot_field_mappings")
      .update(data)
      .eq("id", mappingId)
      .eq("tenant_id", claims.tenantId!);

    if (dbError) return { error: dbError.message };

    revalidatePath("/admin/integrations");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function deleteFieldMapping(mappingId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await fromTable(admin, "hubspot_field_mappings")
      .delete()
      .eq("id", mappingId)
      .eq("tenant_id", claims.tenantId!);

    if (dbError) return { error: dbError.message };

    revalidatePath("/admin/integrations");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function toggleFieldMapping(mappingId: string, isActive: boolean) {
  return updateFieldMapping(mappingId, { is_active: isActive });
}

// ─── Sync ──────────────────────────────────────────────────

export async function syncHubSpotSite(siteLinkId: string): Promise<{ success?: true; result?: SyncResult; error?: string }> {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();
    const tenantId = claims.tenantId!;

    // Get config
    const { data: config } = await fromTable(admin, "hubspot_config")
      .select("access_token")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (!config) return { error: "HubSpot not connected" };

    // Get site link
    const { data: link } = await fromTable(admin, "hubspot_site_links")
      .select("id, site_id, hubspot_deal_id")
      .eq("id", siteLinkId)
      .eq("tenant_id", tenantId)
      .single();

    if (!link) return { error: "Site link not found" };

    const result = await syncSiteWithDeal({
      token: (config as { access_token: string }).access_token,
      siteLinkId: link.id as string,
      siteId: link.site_id as string,
      dealId: link.hubspot_deal_id as string,
      tenantId,
      profileId: claims.profileId,
      triggeredBy: "manual",
    });

    revalidatePath("/admin/integrations");
    return { success: true, result };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function syncAllHubSpotSites(): Promise<{ success?: true; results?: SyncResult[]; error?: string }> {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const admin = createSupabaseAdmin();
    const tenantId = claims.tenantId!;

    const { data: config } = await fromTable(admin, "hubspot_config")
      .select("access_token")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (!config) return { error: "HubSpot not connected" };

    const { data: links } = await fromTable(admin, "hubspot_site_links")
      .select("id, site_id, hubspot_deal_id")
      .eq("tenant_id", tenantId);

    if (!links || links.length === 0) return { error: "No linked sites" };

    const results: SyncResult[] = [];
    for (const link of links) {
      const result = await syncSiteWithDeal({
        token: (config as { access_token: string }).access_token,
        siteLinkId: link.id as string,
        siteId: link.site_id as string,
        dealId: link.hubspot_deal_id as string,
        tenantId,
        profileId: claims.profileId,
        triggeredBy: "manual",
      });
      results.push(result);
    }

    revalidatePath("/admin/integrations");
    return { success: true, results };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}
