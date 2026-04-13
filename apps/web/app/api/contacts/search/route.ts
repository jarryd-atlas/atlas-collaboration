import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, getSession } from "../../../../lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

/**
 * GET /api/contacts/search?customerId=xxx&q=searchterm
 * Searches account_stakeholders for a customer by name, title, or email.
 * Returns matching stakeholders for the contact picker.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const q = searchParams.get("q") || "";

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // Find account_plan for this customer
    const { data: accountPlan } = await fromTable(admin, "account_plans")
      .select("id")
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!accountPlan) {
      // No account plan yet — return empty results
      return NextResponse.json({ stakeholders: [] });
    }

    // Search stakeholders
    let query = fromTable(admin, "account_stakeholders")
      .select("id, name, title, email, phone, department, stakeholder_role")
      .eq("account_plan_id", accountPlan.id)
      .order("name");

    if (q.trim()) {
      // Use ilike for fuzzy matching across name, title, email
      const pattern = `%${q.trim()}%`;
      query = query.or(`name.ilike.${pattern},title.ilike.${pattern},email.ilike.${pattern}`);
    }

    const { data: stakeholders, error } = await query.limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stakeholders: stakeholders ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
