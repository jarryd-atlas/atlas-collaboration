import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "../../../lib/supabase/server";
import { getActivityForPortfolio } from "../../../lib/data/queries";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session.claims?.tenantType !== "internal") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const tenantId = searchParams.get("tenantId");
    if (!tenantId) {
      return NextResponse.json({ error: "tenantId required" }, { status: 400 });
    }

    const filters: {
      customerId?: string;
      entityType?: string;
      actorId?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {};

    const customerId = searchParams.get("customerId");
    const entityType = searchParams.get("entityType");
    const actorId = searchParams.get("actorId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    if (customerId) filters.customerId = customerId;
    if (entityType) filters.entityType = entityType;
    if (actorId) filters.actorId = actorId;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const activities = await getActivityForPortfolio(tenantId, filters, 50);
    return NextResponse.json(activities);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
