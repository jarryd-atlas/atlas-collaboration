-- Migration 050: Unify contacts — site_contacts references account_stakeholders
-- Instead of duplicating contact data per site, site_contacts now links to account_stakeholders
-- as the single source of truth for customer contacts.

-- Add stakeholder reference to site_contacts
ALTER TABLE site_contacts
  ADD COLUMN IF NOT EXISTS stakeholder_id UUID REFERENCES account_stakeholders(id) ON DELETE SET NULL;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_site_contacts_stakeholder_id
  ON site_contacts(stakeholder_id) WHERE stakeholder_id IS NOT NULL;
