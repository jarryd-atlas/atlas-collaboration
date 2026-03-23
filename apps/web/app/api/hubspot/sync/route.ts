import { NextRequest, NextResponse } from "next/server";
import { getSession } from "../../../../lib/supabase/server";
import { syncHubSpotSite, syncAllHubSpotSites } from "../../../../lib/actions/hubspot";

export const runtime = "edge";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.claims.tenantType !== "internal") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { siteLinkId } = body as { siteLinkId?: string };

  if (siteLinkId) {
    const result = await syncHubSpotSite(siteLinkId);
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  } else {
    const result = await syncAllHubSpotSites();
    return NextResponse.json(result, { status: result.error ? 400 : 200 });
  }
}
