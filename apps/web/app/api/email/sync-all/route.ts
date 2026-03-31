import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/server";

/**
 * POST /api/email/sync-all
 * Syncs Gmail emails for ALL CK users with stored Google tokens.
 * Protected by API key for cron/scheduled access.
 */
export async function POST(req: NextRequest) {
  try {
    // Simple API key protection for cron access
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // Also allow internal calls without auth
      const body = await req.json().catch(() => ({}));
      if (!(body as any).__internal) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = createSupabaseAdmin();

    // Get all users with Google tokens
    const { data: tokens } = await (supabase as any)
      .from("user_google_tokens")
      .select("user_id");

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ error: "No users with Google tokens" }, { status: 404 });
    }

    const results: Array<{ userId: string; synced?: number; error?: string }> = [];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    for (const t of tokens as { user_id: string }[]) {
      try {
        const res = await fetch(`${baseUrl}/api/email/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: t.user_id }),
        });

        const data = await res.json();
        results.push({
          userId: t.user_id,
          synced: data.synced,
          error: data.error,
        });
      } catch (err) {
        results.push({
          userId: t.user_id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    const totalSynced = results.reduce((sum, r) => sum + (r.synced ?? 0), 0);
    const usersProcessed = results.filter((r) => !r.error).length;

    return NextResponse.json({
      users_processed: usersProcessed,
      users_failed: results.filter((r) => r.error).length,
      total_synced: totalSynced,
      results,
    });
  } catch (err) {
    console.error("Email sync-all error:", err);
    return NextResponse.json(
      { error: "Failed to run email sync" },
      { status: 500 }
    );
  }
}
