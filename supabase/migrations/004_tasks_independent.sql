-- Allow tasks to exist without a milestone (standalone tasks linked to a site)
-- Also add site_id to tasks for direct site association

-- 1. Add site_id column to tasks
alter table tasks add column site_id uuid references sites (id) on delete cascade;

-- 2. Make milestone_id nullable
alter table tasks alter column milestone_id drop not null;

-- 3. Backfill site_id from existing milestone relationships
update tasks
set site_id = m.site_id
from milestones m
where tasks.milestone_id = m.id
  and tasks.site_id is null;

-- 4. Add index on site_id
create index tasks_site_idx on tasks (site_id);

-- 5. Add check: task must have at least a site_id or milestone_id
-- (We don't enforce this as a constraint since site_id can be derived from milestone)
