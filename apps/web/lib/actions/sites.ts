"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import { slugify } from "../utils";
import { REVERSE_PIPELINE_STAGE_MAP } from "../hubspot/constants";
import type { PipelineStage } from "@repo/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

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

    const { error: dbError } = await admin.from("sites").insert({
      customer_id: customerId,
      tenant_id: customerTenantId,
      name,
      slug,
      address,
      city,
      state,
      pipeline_stage: pipelineStage,
    });

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
      const { error: dbError } = await admin.from("sites").insert({
        customer_id: site.customerId,
        tenant_id: site.customerTenantId,
        name: site.name,
        slug,
        address: site.address.trim(),
        city: site.city || null,
        state: site.state || null,
        pipeline_stage: site.pipelineStage || "whitespace",
      });

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
