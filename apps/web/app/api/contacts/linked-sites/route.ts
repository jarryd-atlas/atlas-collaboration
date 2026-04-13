import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, getSession } from "../../../../lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

/**
 * GET /api/contacts/linked-sites?stakeholderId=xxx
 * Returns the site IDs currently linked to a stakeholder via site_contacts.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const stakeholderId = searchParams.get("stakeholderId");

    if (!stakeholderId) {
      return NextResponse.json({ error: "stakeholderId is required" }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    const { data: links, error } = await fromTable(admin, "site_contacts")
      .select("site_id")
      .eq("stakeholder_id", stakeholderId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const siteIds = (links ?? []).map((l: { site_id: string }) => l.site_id);
    return NextResponse.json({ siteIds });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
