import { NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../../lib/supabase/server";
import { listAllDeals } from "../../../../../lib/hubspot/client";
import { DEAL_STAGE_LABELS, getDealType } from "../../../../../lib/hubspot/constants";

const DEAL_PROPERTIES = [
  "dealname",
  "dealstage",
  "amount",
  "closedate",
  "hubspot_owner_id",
  "pipeline",
];

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.claims.tenantType !== "internal") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.claims.tenantId!;
    const admin = createSupabaseAdmin();

    // Fetch HubSpot config
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: config } = await (admin as any)
      .from("hubspot_config")
      .select("access_token")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (!config) {
      return NextResponse.json({ error: "HubSpot not connected" }, { status: 400 });
    }

    // Fetch all deals and site links in parallel
    const [allDeals, siteLinksResult] = await Promise.all([
      listAllDeals(config.access_token, DEAL_PROPERTIES),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (admin as any)
        .from("hubspot_site_links")
        .select("id, site_id, hubspot_deal_id, deal_name, deal_type, sites(name)")
        .eq("tenant_id", tenantId),
    ]);

    // Build deal ID → site link map
    const linkMap = new Map<string, { linkId: string; siteId: string; siteName: string; dealType: string | null }>();
    for (const link of siteLinksResult.data ?? []) {
      linkMap.set(link.hubspot_deal_id, {
        linkId: link.id,
        siteId: link.site_id,
        siteName: link.sites?.name ?? "Unknown",
        dealType: link.deal_type,
      });
    }

    // Resolve owner names
    const ownerIds = new Set<string>();
    for (const deal of allDeals) {
      const ownerId = deal.properties.hubspot_owner_id;
      if (ownerId) ownerIds.add(ownerId);
    }

    const ownerMap = new Map<string, string>();
    const ownerIdArray = Array.from(ownerIds);
    // Fetch owners in batches of 10 to stay within rate limits
    for (let i = 0; i < ownerIdArray.length; i += 10) {
      const batch = ownerIdArray.slice(i, i + 10);
      const ownerResults = await Promise.allSettled(
        batch.map(async (id) => {
          const res = await fetch(`https://api.hubapi.com/crm/v3/owners/${id}`, {
            headers: { Authorization: `Bearer ${config.access_token}` },
          });
          if (!res.ok) return null;
          const data = await res.json();
          return { id, name: `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim() || data.email || id };
        })
      );
      for (const result of ownerResults) {
        if (result.status === "fulfilled" && result.value) {
          ownerMap.set(result.value.id, result.value.name);
        }
      }
    }

    // Map deals to enriched rows
    const deals = allDeals.map((deal) => {
      const stageId = deal.properties.dealstage ?? "";
      const pipelineId = deal.properties.pipeline ?? "";
      const link = linkMap.get(deal.id);

      return {
        id: deal.id,
        name: deal.properties.dealname ?? "Untitled Deal",
        stage: stageId,
        stageLabel: DEAL_STAGE_LABELS[stageId] ?? stageId,
        pipeline: pipelineId,
        dealType: getDealType(stageId, pipelineId),
        amount: deal.properties.amount ?? null,
        closeDate: deal.properties.closedate ?? null,
        ownerName: ownerMap.get(deal.properties.hubspot_owner_id ?? "") ?? null,
        linkedSite: link
          ? { linkId: link.linkId, siteId: link.siteId, siteName: link.siteName }
          : null,
      };
    });

    return NextResponse.json({ deals, total: deals.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "HubSpot API error" },
      { status: 500 }
    );
  }
}
