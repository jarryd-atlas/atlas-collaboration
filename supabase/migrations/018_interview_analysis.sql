-- Add analysis tracking fields to site_interviews
ALTER TABLE site_interviews
  ADD COLUMN IF NOT EXISTS analysis_status text DEFAULT 'pending'
    CHECK (analysis_status IN ('pending', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS analysis_summary text,
  ADD COLUMN IF NOT EXISTS analysis_error text,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;
