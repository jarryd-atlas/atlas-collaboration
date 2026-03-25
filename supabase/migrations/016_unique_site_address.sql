-- Prevent duplicate sites: require address + enforce uniqueness

-- Fill any existing null addresses with site name as fallback
UPDATE sites SET address = name WHERE address IS NULL;

-- Make address required
ALTER TABLE sites ALTER COLUMN address SET NOT NULL;

-- Case-insensitive unique index on address
CREATE UNIQUE INDEX IF NOT EXISTS sites_address_unique ON sites (LOWER(address));
