-- Add IP and geolocation fields to network test results
ALTER TABLE site_network_test_results
  ADD COLUMN IF NOT EXISTS ip_address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS city text DEFAULT '',
  ADD COLUMN IF NOT EXISTS region text DEFAULT '',
  ADD COLUMN IF NOT EXISTS country text DEFAULT '',
  ADD COLUMN IF NOT EXISTS timezone text DEFAULT '',
  ADD COLUMN IF NOT EXISTS isp text DEFAULT '';
