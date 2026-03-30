import { NextRequest, NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../../lib/supabase/server";
import { getDeal } from "../../../../../lib/hubspot/client";

const DISPLAY_PROPERTIES = [
  "dealname", "dealstage", "amount", "closedate", "hubspot_owner_id",
  "annual_energy_spend__c", "refrigeration_load", "forecasted_savings__",
  "forecasted_refrigeration_savings_percent", "forecasted_total_savings_percent",
  "facility_type", "nrc", "atlas_site_name", "pipeline",
  "energy_savings_status", "site_equivalent", "roi", "hs_next_step",
  "service_start_date", "service_end_date",
  "hs_lastmodifieddate",
];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.claims.tenantType !== "internal") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dealId } = await params;

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

    const deal = await getDeal(config.access_token, dealId, DISPLAY_PROPERTIES);
    return NextResponse.json({ deal: { id: deal.id, properties: deal.properties } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch deal" },
      { status: 500 }
    );
  }
}
