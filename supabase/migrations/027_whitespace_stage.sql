-- Add "whitespace" pipeline stage for sites with no linked HubSpot deal
-- NOTE: ALTER TYPE ADD VALUE cannot be used in the same transaction as DML
-- that references the new value. Run this migration first, then run 028.
ALTER TYPE pipeline_stage ADD VALUE 'whitespace' BEFORE 'prospect';
