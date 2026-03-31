/**
 * Stage resolution logic for sites with multiple linked HubSpot deals.
 * Computes a single pipeline_stage from all linked deals.
 */

import { PIPELINE_STAGE_MAP, getDealType } from "./constants";
import { createSupabaseAdmin } from "../supabase/server";
import type { SitePipelineStage } from "@repo/shared";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

/** Stage ordering for "most advanced" comparison */
const STAGE_RANK: Record<string, number> = {
  whitespace: 0,
  prospect: 1,
  evaluation: 2,
  qualified: 3,
  contracted: 4,
  deployment: 5,
  active: 6,
};

const TERMINAL_STAGES = new Set(["disqualified", "paused"]);

export interface DealForResolution {
  dealStageId: string;
  pipelineId?: string;
  closeDate?: string | null;
}

/**
 * Pure function: given an array of deals (with their HubSpot stage IDs),
 * compute the resolved site pipeline stage.
 */
export function resolveStageFromDeals(deals: DealForResolution[]): SitePipelineStage {
  if (deals.length === 0) return "whitespace";

  // Map each deal to its app-level stage
  const mappedDeals = deals.map((d) => ({
    ...d,
    appStage: (PIPELINE_STAGE_MAP[d.dealStageId] ?? "prospect") as string,
    dealType: getDealType(d.dealStageId, d.pipelineId),
  }));

  // If ANY deal is "active", site is active
  if (mappedDeals.some((d) => d.appStage === "active")) return "active";

  // Separate terminal vs progression deals
  const progressionDeals = mappedDeals.filter((d) => !TERMINAL_STAGES.has(d.appStage));
  const terminalDeals = mappedDeals.filter((d) => TERMINAL_STAGES.has(d.appStage));

  // If ALL deals are terminal (disqualified/paused)
  if (progressionDeals.length === 0) {
    if (terminalDeals.every((d) => d.appStage === "disqualified")) return "disqualified";
    return "paused";
  }

  // Among progression deals, separate new_business vs renewal
  const newBiz = progressionDeals.filter((d) => d.dealType === "new_business");
  const renewals = progressionDeals.filter((d) => d.dealType === "renewal");

  let bestNewBizStage: string | null = null;
  let bestRenewalStage: string | null = null;

  // New business: pick most advanced stage
  if (newBiz.length > 0) {
    bestNewBizStage = newBiz.reduce((best, d) =>
      (STAGE_RANK[d.appStage] ?? 0) > (STAGE_RANK[best.appStage] ?? 0) ? d : best
    ).appStage;
  }

  // Renewals: pick furthest-out close date, then use that deal's stage
  if (renewals.length > 0) {
    const sorted = [...renewals].sort((a, b) => {
      if (!a.closeDate && !b.closeDate) return 0;
      if (!a.closeDate) return 1;
      if (!b.closeDate) return -1;
      return new Date(b.closeDate).getTime() - new Date(a.closeDate).getTime();
    });
    bestRenewalStage = sorted[0]!.appStage;
  }

  // Between new biz and renewal: use the more advanced stage
  if (bestNewBizStage && bestRenewalStage) {
    return ((STAGE_RANK[bestNewBizStage] ?? 0) >= (STAGE_RANK[bestRenewalStage] ?? 0)
      ? bestNewBizStage
      : bestRenewalStage) as SitePipelineStage;
  }

  return (bestNewBizStage ?? bestRenewalStage ?? "whitespace") as SitePipelineStage;
}

/**
 * Recalculate a site's pipeline_stage from all its linked HubSpot deals.
 * Fetches deal data from HubSpot API, resolves the stage, and updates the site.
 */
export async function recalculateSiteStage(
  siteId: string,
  tenantId: string,
  token?: string
): Promise<SitePipelineStage> {
  const admin = createSupabaseAdmin();

  // Get all linked deals for this site
  const { data: links } = await fromTable(admin, "hubspot_site_links")
    .select("hubspot_deal_id")
    .eq("site_id", siteId)
    .eq("tenant_id", tenantId);

  if (!links || links.length === 0) {
    // No deals → whitespace
    await admin.from("sites").update({ pipeline_stage: "whitespace" }).eq("id", siteId);
    return "whitespace";
  }

  // Get HubSpot token if not provided
  let accessToken = token;
  if (!accessToken) {
    const { data: config } = await fromTable(admin, "hubspot_config")
      .select("access_token")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();
    accessToken = (config as { access_token: string } | null)?.access_token;
  }

  if (!accessToken) {
    // No HubSpot config — can't resolve, leave as-is
    return "whitespace";
  }

  // Fetch deal data from HubSpot for all linked deals
  const deals: DealForResolution[] = [];
  for (const link of links as { hubspot_deal_id: string }[]) {
    try {
      const res = await fetch(
        `https://api.hubapi.com/crm/v3/objects/deals/${link.hubspot_deal_id}?properties=dealstage,pipeline,closedate`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        deals.push({
          dealStageId: data.properties?.dealstage ?? "",
          pipelineId: data.properties?.pipeline ?? undefined,
          closeDate: data.properties?.closedate ?? null,
        });
      }
    } catch {
      // Skip deals we can't fetch
    }
  }

  const resolvedStage = resolveStageFromDeals(deals);

  // Update the site
  await admin.from("sites").update({ pipeline_stage: resolvedStage }).eq("id", siteId);

  return resolvedStage;
}
