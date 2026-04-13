import { NextRequest, NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../lib/supabase/server";

/**
 * POST /api/forecast/targets
 * Upsert a revenue target for a specific period.
 * Auth: internal users only.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.claims.tenantType !== "internal") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { periodType, periodKey, targetAmount } = body;

  if (!periodType || !periodKey || targetAmount == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!["quarter", "year"].includes(periodType)) {
    return NextResponse.json({ error: "Invalid period_type" }, { status: 400 });
  }

  const amount = parseFloat(targetAmount);
  if (isNaN(amount) || amount < 0) {
    return NextResponse.json({ error: "Invalid target_amount" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { error } = await (admin as any)
    .from("forecast_targets")
    .upsert(
      {
        period_type: periodType,
        period_key: periodKey,
        target_amount: amount,
        created_by: session.user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "period_type,period_key" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, periodKey, targetAmount: amount });
}
