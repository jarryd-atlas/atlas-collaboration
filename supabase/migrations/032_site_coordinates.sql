-- Add coordinate columns for geographic map views
ALTER TABLE sites
  ADD COLUMN latitude  double precision,
  ADD COLUMN longitude double precision;

-- Index for bounding box queries on the map
CREATE INDEX sites_coordinates_idx ON sites (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
