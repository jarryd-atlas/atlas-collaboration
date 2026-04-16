/**
 * sync_all_emails worker job.
 *
 * pg_cron enqueues a row into job_queue every 15 minutes. This handler
 * HTTP-POSTs /api/email/sync-all on the web app, which iterates every
 * @crossnokaye.com user with a stored Google OAuth token and pulls new
 * customer emails into customer_emails.
 *
 * Env vars required on the worker (Railway):
 *   NEXT_PUBLIC_APP_URL  — absolute URL of the web app (e.g. https://app.atlas.crossnokaye.com)
 *   CRON_SECRET          — shared secret, must match the web app's value
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function processSyncAllEmailsJob(
  _supabase: SupabaseClient,
  _payload: Record<string, unknown>,
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!appUrl) {
    throw new Error("sync_all_emails: missing NEXT_PUBLIC_APP_URL env var");
  }
  if (!cronSecret) {
    throw new Error("sync_all_emails: missing CRON_SECRET env var");
  }

  const url = `${appUrl.replace(/\/$/, "")}/api/email/sync-all`;
  console.log(`[SyncEmails] POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cronSecret}`,
    },
    body: "{}",
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`sync_all_emails: HTTP ${res.status} — ${text.slice(0, 500)}`);
  }

  // Best-effort log of the response body so the worker console shows counts.
  try {
    const parsed = JSON.parse(text) as {
      users_processed?: number;
      users_failed?: number;
      total_synced?: number;
      digests_regenerated?: number;
    };
    console.log(
      `[SyncEmails] done — users_processed=${parsed.users_processed ?? 0} ` +
        `users_failed=${parsed.users_failed ?? 0} ` +
        `total_synced=${parsed.total_synced ?? 0} ` +
        `digests_regenerated=${parsed.digests_regenerated ?? 0}`,
    );
  } catch {
    console.log(`[SyncEmails] done — non-JSON response: ${text.slice(0, 200)}`);
  }
}
