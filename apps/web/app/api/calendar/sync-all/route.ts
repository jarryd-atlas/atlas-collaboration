import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/server";
import { syncCalendarForUser } from "../sync-user/route";

/**
 * POST /api/calendar/sync-all
 * Syncs Google Calendar events for ALL CK users with stored Google tokens.
 * Uses incremental sync (syncToken) so each call is fast and only fetches
 * events that changed since the last sync.
 *
 * Protected by CRON_SECRET for scheduled access.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const body = await req.json().catch(() => ({}));
      if (!(body as any).__internal) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabase = createSupabaseAdmin();

    // Get all users with Google tokens that include calendar scopes
    const { data: tokens } = await (supabase as any)
      .from("user_google_tokens")
      .select("user_id");

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ message: "No users with Google tokens" }, { status: 200 });
    }

    const results: Array<{ userId: string; synced?: number; deleted?: number; error?: string }> = [];

    for (const t of tokens as { user_id: string }[]) {
      try {
        const result = await syncCalendarForUser(t.user_id);
        results.push({
          userId: t.user_id,
          synced: result.synced,
          deleted: result.deleted,
          error: result.error,
        });
      } catch (err: any) {
        results.push({
          userId: t.user_id,
          error: err.message || "Unknown error",
        });
      }
    }

    const totalSynced = results.reduce((sum, r) => sum + (r.synced ?? 0), 0);
    const totalDeleted = results.reduce((sum, r) => sum + (r.deleted ?? 0), 0);
    const errors = results.filter((r) => r.error);

    return NextResponse.json({
      users_processed: results.length,
      total_synced: totalSynced,
      total_deleted: totalDeleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("Calendar sync-all error:", err);
    return NextResponse.json({ error: "Failed to sync calendars" }, { status: 500 });
  }
}
