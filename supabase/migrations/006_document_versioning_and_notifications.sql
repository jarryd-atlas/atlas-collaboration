-- Migration: Document versioning + upload notification support
-- 1. Add version tracking columns to attachments
-- 2. Add 'document_uploaded' notification type

-- 1. Version tracking: group related document versions together
--    version_group_id links all versions of the same document
--    version_number increments per new version (1, 2, 3...)
alter table attachments
  add column version_group_id uuid default gen_random_uuid(),
  add column version_number integer not null default 1;

-- Index for looking up version history of a document
create index attachments_version_group_idx on attachments (version_group_id);

-- 2. Add 'document_uploaded' to the notification_type enum
alter type notification_type add value if not exists 'document_uploaded';
