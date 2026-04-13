"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import { slugify } from "../utils";
import { REVERSE_PIPELINE_STAGE_MAP } from "../hubspot/constants";
import { geocodeAddress } from "../geocoding";
import type { PipelineStage } from "@repo/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

// ── Transfer & Merge ────────────────────────────────────────

/** Preview data counts before transferring a site */
export async function getTransferPreview(siteId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();

    // Get site info
    const { data: site, error: siteErr } = await admin
      .from("sites")
      .select("id, name, slug, address, customer_id, pipeline_stage")
      .eq("id", siteId)
      .single();
    if (siteErr || !site) return { error: "Site not found" };

    // Count child records
    const tables = [
      "milestones", "flagged_issues", "voice_notes", "status_reports",
      "tasks", "site_contacts", "site_contractors",
      "site_assessments", "handoff_reports", "document_extractions",
    ];

    const counts: Record<string, number> = {};
    for (const table of tables) {
      const { count } = await fromTable(admin, table)
        .select("id", { count: "exact", head: true })
        .eq("site_id", siteId);
      counts[table] = count ?? 0;
    }

    return { site, counts };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/** Transfer a site to another customer */
export async function transferSite(siteId: string, targetCustomerId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await (admin as any).rpc("transfer_site_to_customer", {
      p_site_id: siteId,
      p_target_customer_id: targetCustomerId,
    });

    if (error) return { error: error.message };

    revalidatePath("/customers");
    return { success: true, data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/** Preview what will happen when merging two sites */
export async function getMergePreview(primarySiteId: string, secondarySiteId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();

    const [{ data: primary }, { data: secondary }] = await Promise.all([
      admin.from("sites").select("id, name, slug, address, customer_id, pipeline_stage").eq("id", primarySiteId).single(),
      admin.from("sites").select("id, name, slug, address, customer_id, pipeline_stage").eq("id", secondarySiteId).single(),
    ]);

    if (!primary) return { error: "Primary site not found" };
    if (!secondary) return { error: "Secondary site not found" };
    if ((primary as any).customer_id !== (secondary as any).customer_id) {
      return { error: "Both sites must belong to the same customer" };
    }

    // Count what the secondary site has
    const tables = [
      "milestones", "flagged_issues", "voice_notes", "status_reports",
      "tasks", "site_contacts", "site_contractors",
      "site_assessments", "handoff_reports",
    ];

    const secondaryCounts: Record<string, number> = {};
    for (const table of tables) {
      const { count } = await fromTable(admin, table)
        .select("id", { count: "exact", head: true })
        .eq("site_id", secondarySiteId);
      secondaryCounts[table] = count ?? 0;
    }

    // Check for assessment conflict
    const { count: primaryAssessments } = await fromTable(admin, "site_assessments")
      .select("id", { count: "exact", head: true })
      .eq("site_id", primarySiteId);

    const conflicts: string[] = [];
    if ((primaryAssessments ?? 0) > 0 && (secondaryCounts.site_assessments ?? 0) > 0) {
      conflicts.push("Both sites have assessment data. The secondary site's assessment will be deleted.");
    }
    if ((secondaryCounts.handoff_reports ?? 0) > 0) {
      const { count: primaryHandoffs } = await fromTable(admin, "handoff_reports")
        .select("id", { count: "exact", head: true })
        .eq("site_id", primarySiteId);
      if ((primaryHandoffs ?? 0) > 0) {
        conflicts.push("Both sites have handoff reports. The secondary site's report will be deleted.");
      }
    }

    return { primary, secondary, secondaryCounts, conflicts };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

/** Merge two sites (secondary into primary) */
export async function mergeSites(primarySiteId: string, secondarySiteId: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { data, error } = await (admin as any).rpc("merge_sites", {
      p_primary_site_id: primarySiteId,
      p_secondary_site_id: secondarySiteId,
    });

    if (error) return { error: error.message };

    revalidatePath("/customers");
    return { success: true, data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function createSite(formData: FormData) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const customerId = formData.get("customerId") as string;
    const customerTenantId = formData.get("customerTenantId") as string;
    const name = formData.get("name") as string;
    const address = (formData.get("address") as string)?.trim();
    const city = (formData.get("city") as string) || null;
    const state = (formData.get("state") as string) || null;
    const pipelineStage = (formData.get("pipelineStage") as PipelineStage) || "whitespace";
    const rawLat = formData.get("latitude") as string | null;
    const rawLng = formData.get("longitude") as string | null;
    let latitude = rawLat ? parseFloat(rawLat) : null;
    let longitude = rawLng ? parseFloat(rawLng) : null;
    if (latitude != null && isNaN(latitude)) latitude = null;
    if (longitude != null && isNaN(longitude)) longitude = null;
    const slug = slugify(name);

    if (!address) return { error: "Address is required" };

    // Check for duplicate address
    const admin = createSupabaseAdmin();
    const { data: existing } = await admin
      .from("sites")
      .select("id, name")
      .ilike("address", address)
      .maybeSingle();

    if (existing) {
      return { error: `A site already exists at this address: ${existing.name}` };
    }

    // Geocode server-side if coordinates weren't provided from the client
    if (latitude == null || longitude == null) {
      const geo = await geocodeAddress(address, city, state);
      if (geo) {
        latitude = geo.latitude;
        longitude = geo.longitude;
      }
    }

    const { error: dbError } = await admin.from("sites").insert({
      customer_id: customerId,
      tenant_id: customerTenantId,
      name,
      slug,
      address,
      city,
      state,
      pipeline_stage: pipelineStage,
      latitude,
      longitude,
    } as any);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function createSitesBatch(
  sites: Array<{
    customerId: string;
    customerTenantId: string;
    name: string;
    address: string;
    city: string | null;
    state: string | null;
    pipelineStage?: PipelineStage;
  }>
) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    let created = 0;
    let skipped = 0;

    for (const site of sites) {
      if (!site.address?.trim()) {
        skipped++;
        continue;
      }

      // Check for duplicate address
      const { data: existing } = await admin
        .from("sites")
        .select("id")
        .ilike("address", site.address.trim())
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const slug = slugify(site.name);

      // Geocode each site
      let latitude: number | null = null;
      let longitude: number | null = null;
      const geo = await geocodeAddress(site.address.trim(), site.city, site.state);
      if (geo) {
        latitude = geo.latitude;
        longitude = geo.longitude;
      }

      const { error: dbError } = await admin.from("sites").insert({
        customer_id: site.customerId,
        tenant_id: site.customerTenantId,
        name: site.name,
        slug,
        address: site.address.trim(),
        city: site.city || null,
        state: site.state || null,
        pipeline_stage: site.pipelineStage || "whitespace",
        latitude,
        longitude,
      } as any);

      if (dbError) {
        // Unique constraint violation — treat as duplicate
        if (dbError.code === "23505") {
          skipped++;
        } else {
          console.error("Error creating site:", dbError.message);
          skipped++;
        }
      } else {
        created++;
      }
    }

    revalidatePath("/customers");
    return { success: true, created, skipped };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateSiteAddress(
  siteId: string,
  address: string,
  city: string,
  state: string,
) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();

    // Geocode the new address
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (address && city && state) {
      const geo = await geocodeAddress(address, city, state);
      if (geo) {
        latitude = geo.latitude;
        longitude = geo.longitude;
      }
    }

    const { error: dbError } = await admin
      .from("sites")
      .update({
        address: address || null,
        city: city || null,
        state: state || null,
        ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
      } as any)
      .eq("id", siteId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateSiteNextStep(siteId: string, nextStep: string) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin
      .from("sites")
      .update({ next_step: nextStep || null } as any)
      .eq("id", siteId);

    if (dbError) return { error: dbError.message };

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}

export async function updateSitePipelineStage(
  siteId: string,
  stage: PipelineStage,
  dqReason?: string,
  dqReevalDate?: string,
) {
  try {
    const { claims } = await requireSession();
    if (claims.tenantType && claims.tenantType !== "internal") {
      return { error: "Forbidden" };
    }

    const admin = createSupabaseAdmin();
    const { error: dbError } = await admin
      .from("sites")
      .update({
        pipeline_stage: stage,
        dq_reason: stage === "disqualified" ? (dqReason ?? null) : null,
        dq_reeval_date: stage === "disqualified" ? (dqReevalDate ?? null) : null,
      })
      .eq("id", siteId);

    if (dbError) return { error: dbError.message };

    // Push stage change to HubSpot if deals are linked
    if (stage !== "whitespace") {
      try {
        const hubspotStageId = REVERSE_PIPELINE_STAGE_MAP[stage];
        if (hubspotStageId) {
          const { data: config } = await fromTable(admin, "hubspot_config")
            .select("access_token")
            .eq("tenant_id", claims.tenantId!)
            .eq("is_active", true)
            .single();

          if (config) {
            const { data: links } = await fromTable(admin, "hubspot_site_links")
              .select("hubspot_deal_id")
              .eq("site_id", siteId)
              .eq("tenant_id", claims.tenantId!);

            if (links && links.length > 0) {
              const dealId = (links[0] as { hubspot_deal_id: string }).hubspot_deal_id;
              await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${(config as { access_token: string }).access_token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  properties: { dealstage: hubspotStageId },
                }),
              });
            }
          }
        }
      } catch {
        // Non-critical — local stage was updated, HubSpot push can be retried
      }
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "An unexpected error occurred" };
  }
}
