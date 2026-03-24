import { NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../lib/supabase/server";
import { getDealProperties } from "../../../../lib/hubspot/client";

export async function GET() {
  try {
  const session = await getSession();
  if (!session || session.claims.tenantType !== "internal") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.claims.appRole !== "super_admin" && session.claims.appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const properties = await getDealProperties(config.access_token);
    // Return a simplified list for the mapping UI
    return NextResponse.json({
      properties: properties
        .map((p) => ({
          name: p.name,
          label: p.label,
          type: p.type,
          group: p.groupName,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "HubSpot API error" },
      { status: 500 }
    );
  }
  } catch (outerErr) {
    return NextResponse.json(
      { error: outerErr instanceof Error ? outerErr.message : "Server error" },
      { status: 500 }
    );
  }
}
