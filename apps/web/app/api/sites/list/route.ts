import { NextResponse } from "next/server";
import { getSession, createSupabaseAdmin } from "../../../../lib/supabase/server";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.claims.tenantType !== "internal") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    const { data: sites } = await admin
      .from("sites")
      .select("id, name, slug, customer_id, customers(name)")
      .order("name", { ascending: true });

    const results = (sites ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      customerName: s.customers?.name ?? "",
    }));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load sites" },
      { status: 500 }
    );
  }
}
