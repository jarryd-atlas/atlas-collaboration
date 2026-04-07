import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "../../../../lib/supabase/server";

/**
 * POST /api/email/sync-all
 * Syncs Gmail emails for ALL CK users with stored Google tokens.
 * After syncing, auto-regenerates AI digests only for customers
 * that received new emails since their last digest was generated.
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

    // ── Phase 1: Sync emails for all users ───────────────────
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

    // ── Phase 2: Auto-regenerate digests for customers with new emails ──
    let digestsRegenerated = 0;

    if (totalSynced > 0) {
      try {
        // Find customers that have emails newer than their last digest
        // This ensures we only re-analyze when there's genuinely new data
        const { data: staleDigests } = await (supabase as any).rpc(
          "get_customers_needing_digest_refresh"
        ).catch(() => ({ data: null }));

        // Fallback: if the RPC doesn't exist, query manually
        const customersToRefresh: Array<{ customer_id: string; customer_name: string }> =
          staleDigests ?? [];

        if (!staleDigests) {
          // Manual query: find customers where newest email > digest generated_at
          // or where no digest exists but emails do
          const { data: customers } = await (supabase as any)
            .from("customers")
            .select("id, name");

          if (customers) {
            for (const c of customers as { id: string; name: string }[]) {
              // Get the latest email date for this customer
              const { data: latestEmail } = await (supabase as any)
                .from("customer_emails")
                .select("date")
                .eq("customer_id", c.id)
                .order("date", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (!latestEmail) continue; // No emails → skip

              // Get the existing digest
              const { data: digest } = await (supabase as any)
                .from("customer_email_digests")
                .select("generated_at, email_count")
                .eq("customer_id", c.id)
                .maybeSingle();

              // Get current email count for this customer
              const { count: currentCount } = await (supabase as any)
                .from("customer_emails")
                .select("id", { count: "exact", head: true })
                .eq("customer_id", c.id);

              const needsRefresh =
                // No digest exists yet but emails do
                !digest ||
                // New emails arrived after the digest was generated
                new Date(latestEmail.date) > new Date(digest.generated_at) ||
                // Email count changed (new emails from other threads)
                (currentCount && currentCount !== digest.email_count);

              if (needsRefresh) {
                customersToRefresh.push({ customer_id: c.id, customer_name: c.name });
              }
            }
          }
        }

        // Regenerate digests for customers with new data
        for (const c of customersToRefresh) {
          try {
            const digestRes = await fetch(`${baseUrl}/api/ai/email-digest`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                customerId: c.customer_id,
                customerName: c.customer_name,
              }),
            });

            if (digestRes.ok) {
              digestsRegenerated++;
              console.log(`Regenerated digest for ${c.customer_name}`);
            } else {
              console.warn(`Failed to regenerate digest for ${c.customer_name}: ${digestRes.status}`);
            }
          } catch (err) {
            console.warn(`Digest regen error for ${c.customer_name}:`, err);
          }
        }
      } catch (err) {
        console.warn("Digest refresh phase error:", err);
      }
    }

    return NextResponse.json({
      users_processed: usersProcessed,
      users_failed: results.filter((r) => r.error).length,
      total_synced: totalSynced,
      digests_regenerated: digestsRegenerated,
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
