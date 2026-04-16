-- ATLAS Collaborate — Schedule 15-minute Gmail sync for all CK users
-- Enqueues a job into job_queue every 15 minutes. The worker picks it up
-- and HTTP-POSTs /api/email/sync-all, which iterates every @crossnokaye.com
-- user with a stored Google OAuth token and pulls their customer-domain
-- emails into customer_emails.
--
-- pg_cron is wrapped in a DO block so local dev without the extension
-- still runs `supabase db reset` successfully.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Idempotent re-run
    PERFORM cron.unschedule('enqueue-email-sync-15min')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'enqueue-email-sync-15min'
    );

    PERFORM cron.schedule(
      'enqueue-email-sync-15min',
      '*/15 * * * *',
      $CRON$
        INSERT INTO job_queue (type, payload, status)
        VALUES (
          'sync_all_emails',
          '{}'::jsonb,
          'pending'
        );
      $CRON$
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not installed — skipping 15-minute email sync schedule. Enable pg_cron on Supabase Cloud and re-run migration 057 (or schedule manually).';
  END IF;
END;
$$;
