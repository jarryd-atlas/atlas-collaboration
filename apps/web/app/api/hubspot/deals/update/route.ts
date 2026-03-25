import { NextRequest, NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../../lib/supabase/server";
import { updateDeal } from "../../../../../lib/hubspot/client";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.claims.tenantType !== "internal") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { dealId, properties } = await request.json();
    if (!dealId || !properties || typeof properties !== "object") {
      return NextResponse.json({ error: "dealId and properties required" }, { status: 400 });
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

    const updated = await updateDeal(config.access_token, dealId, properties);
    return NextResponse.json({ success: true, properties: updated.properties });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update deal" },
      { status: 500 }
    );
  }
}
