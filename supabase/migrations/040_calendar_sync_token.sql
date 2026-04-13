-- Add sync token for Google Calendar incremental sync
-- Google returns a syncToken after each full/incremental sync;
-- subsequent requests with this token return only changed events.

ALTER TABLE user_google_tokens
  ADD COLUMN IF NOT EXISTS calendar_sync_token text;
