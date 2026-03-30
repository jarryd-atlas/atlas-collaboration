import { NextRequest, NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../../../lib/supabase/server";
import { getDeal } from "../../../../../../lib/hubspot/client";

/**
 * GET /api/hubspot/deals/[dealId]/pipeline
 * Returns the deal's current stage + all stages for its pipeline.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const session = await getSession();
    if (!session || session.claims.tenantType !== "internal") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: config } = await (admin as any).from("hubspot_config")
      .select("access_token")
      .eq("tenant_id", session.claims.tenantId!)
      .eq("is_active", true)
      .single();

    if (!config) {
      return NextResponse.json({ error: "HubSpot not connected" }, { status: 400 });
    }

    const token = config.access_token as string;

    // Fetch deal to get its current stage and pipeline
    const deal = await getDeal(token, dealId, ["dealstage", "pipeline", "dealname"]);
    const currentStageId = deal.properties.dealstage ?? "";
    const pipelineId = deal.properties.pipeline ?? "";

    // Fetch pipeline stages from HubSpot
    const pipelineRes = await fetch(
      `https://api.hubapi.com/crm/v3/pipelines/deals/${pipelineId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!pipelineRes.ok) {
      return NextResponse.json({ error: "Failed to fetch pipeline stages" }, { status: 500 });
    }

    const pipelineData = await pipelineRes.json();
    const stages = (pipelineData.stages ?? [])
      .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
      .map((s: any) => ({
        id: s.id,
        label: s.label,
      }));

    return NextResponse.json({
      dealId,
      dealName: deal.properties.dealname,
      currentStageId,
      pipelineId,
      stages,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "HubSpot API error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/hubspot/deals/[dealId]/pipeline
 * Updates the deal's stage in HubSpot and caches it locally.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const session = await getSession();
    if (!session || session.claims.tenantType !== "internal") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { stageId, siteId } = body;
    if (!stageId) {
      return NextResponse.json({ error: "stageId is required" }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: config } = await (admin as any).from("hubspot_config")
      .select("access_token")
      .eq("tenant_id", session.claims.tenantId!)
      .eq("is_active", true)
      .single();

    if (!config) {
      return NextResponse.json({ error: "HubSpot not connected" }, { status: 400 });
    }

    const token = config.access_token as string;

    // Update deal stage in HubSpot
    const res = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: { dealstage: stageId } }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return NextResponse.json({ error: `HubSpot update failed: ${errBody}` }, { status: 500 });
    }

    // Also cache the stage label on the site's pipeline_stage if siteId provided
    // We use the PIPELINE_STAGE_MAP to translate, but since we're going HubSpot-native
    // we just store the stage ID for reference
    if (siteId) {
      // Import the mapping to find the best ATLAS stage equivalent
      const { PIPELINE_STAGE_MAP } = await import("../../../../../../lib/hubspot/constants");
      const atlasStage = PIPELINE_STAGE_MAP[stageId] as string | undefined;
      if (atlasStage) {
        await admin.from("sites").update({ pipeline_stage: atlasStage as any }).eq("id", siteId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "HubSpot API error" },
      { status: 500 }
    );
  }
}
