import { NextRequest, NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../../lib/supabase/server";
import { searchDeals } from "../../../../../lib/hubspot/client";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.claims.tenantType !== "internal") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.claims.appRole !== "super_admin" && session.claims.appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
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

  try {
    const data = await searchDeals(config.access_token, q);
    return NextResponse.json({
      results: data.results.map((d) => ({
        id: d.id,
        name: d.properties.dealname,
        stage: d.properties.dealstage,
        amount: d.properties.amount,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "HubSpot API error" },
      { status: 502 }
    );
  }
}
