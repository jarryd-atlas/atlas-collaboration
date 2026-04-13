-- ============================================================
-- Transfer site to another customer
-- ============================================================
CREATE OR REPLACE FUNCTION transfer_site_to_customer(
  p_site_id uuid,
  p_target_customer_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_site RECORD;
  v_target RECORD;
  v_new_slug text;
  v_suffix int := 1;
  v_new_tenant_id uuid;
  v_old_customer_id uuid;
BEGIN
  -- 1. Validate site exists
  SELECT id, customer_id, slug, tenant_id, name
    INTO v_site
    FROM sites WHERE id = p_site_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site not found';
  END IF;

  v_old_customer_id := v_site.customer_id;

  IF v_old_customer_id = p_target_customer_id THEN
    RAISE EXCEPTION 'Site already belongs to this customer';
  END IF;

  -- 2. Validate target customer exists, get its tenant_id
  SELECT id, tenant_id
    INTO v_target
    FROM customers WHERE id = p_target_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target customer not found';
  END IF;

  v_new_tenant_id := v_target.tenant_id;

  -- 3. Resolve slug conflicts
  v_new_slug := v_site.slug;
  WHILE EXISTS (
    SELECT 1 FROM sites
    WHERE customer_id = p_target_customer_id AND slug = v_new_slug
  ) LOOP
    v_new_slug := v_site.slug || '-' || v_suffix;
    v_suffix := v_suffix + 1;
  END LOOP;

  -- 4. Update the site itself
  UPDATE sites
    SET customer_id = p_target_customer_id,
        tenant_id   = v_new_tenant_id,
        slug        = v_new_slug,
        updated_at  = now()
  WHERE id = p_site_id;

  -- 5. Cascade tenant_id to all child tables that have both site_id and tenant_id
  UPDATE milestones          SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE flagged_issues      SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE voice_notes         SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id AND tenant_id != v_new_tenant_id;
  UPDATE status_reports      SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id AND tenant_id != v_new_tenant_id;
  UPDATE report_schedules    SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id AND tenant_id != v_new_tenant_id;
  UPDATE site_assessments    SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_operational_params SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_equipment      SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_energy_data    SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_rate_structure SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_operations     SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_load_breakdown SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_arco_performance SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_savings_analysis SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE document_extractions SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_tou_schedule   SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_labor_baseline SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE baseline_data_sources SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_contacts       SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE handoff_reports     SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_interviews     SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;
  UPDATE site_contractors    SET tenant_id = v_new_tenant_id WHERE site_id = p_site_id;

  -- 6. Update tasks linked to this site (direct site_id or via milestones)
  UPDATE tasks SET tenant_id = v_new_tenant_id, customer_id = p_target_customer_id
    WHERE site_id = p_site_id;
  UPDATE tasks SET tenant_id = v_new_tenant_id, customer_id = p_target_customer_id
    WHERE milestone_id IN (SELECT id FROM milestones WHERE site_id = p_site_id)
      AND tenant_id != v_new_tenant_id;

  -- 7. Clear site_access (old customer users should not retain access)
  DELETE FROM site_access WHERE site_id = p_site_id;

  RETURN jsonb_build_object(
    'success', true,
    'old_customer_id', v_old_customer_id,
    'new_customer_id', p_target_customer_id,
    'new_slug', v_new_slug
  );
END;
$$;

-- ============================================================
-- Merge two sites (same customer)
-- ============================================================
CREATE OR REPLACE FUNCTION merge_sites(
  p_primary_site_id uuid,
  p_secondary_site_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_primary RECORD;
  v_secondary RECORD;
  v_counts jsonb := '{}'::jsonb;
  v_cnt int;
BEGIN
  -- 1. Validate both sites exist
  SELECT id, customer_id, name FROM sites WHERE id = p_primary_site_id INTO v_primary;
  IF NOT FOUND THEN RAISE EXCEPTION 'Primary site not found'; END IF;

  SELECT id, customer_id, name FROM sites WHERE id = p_secondary_site_id INTO v_secondary;
  IF NOT FOUND THEN RAISE EXCEPTION 'Secondary site not found'; END IF;

  IF p_primary_site_id = p_secondary_site_id THEN
    RAISE EXCEPTION 'Cannot merge a site with itself';
  END IF;

  IF v_primary.customer_id != v_secondary.customer_id THEN
    RAISE EXCEPTION 'Both sites must belong to the same customer';
  END IF;

  -- 2. Handle milestone slug conflicts before moving
  UPDATE milestones m
    SET slug = m.slug || '-merged'
    WHERE m.site_id = p_secondary_site_id
      AND EXISTS (
        SELECT 1 FROM milestones m2
        WHERE m2.site_id = p_primary_site_id AND m2.slug = m.slug
      );

  -- 3. Move simple child tables (no per-site unique constraints)
  UPDATE milestones SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('milestones', v_cnt);

  UPDATE flagged_issues SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('flagged_issues', v_cnt);

  UPDATE site_contacts SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('site_contacts', v_cnt);

  UPDATE site_contractors SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('site_contractors', v_cnt);

  UPDATE site_interviews SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('site_interviews', v_cnt);

  -- Nullable FKs
  UPDATE voice_notes SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
  UPDATE status_reports SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
  UPDATE report_schedules SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
  UPDATE meeting_items SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;

  -- Tasks directly linked to secondary site
  UPDATE tasks SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  v_counts := v_counts || jsonb_build_object('tasks', v_cnt);

  -- 4. Junction tables with UNIQUE — delete duplicates first, then move rest
  DELETE FROM task_sites
    WHERE site_id = p_secondary_site_id
      AND task_id IN (SELECT task_id FROM task_sites WHERE site_id = p_primary_site_id);
  UPDATE task_sites SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;

  DELETE FROM site_google_docs
    WHERE site_id = p_secondary_site_id
      AND google_file_id IN (SELECT google_file_id FROM site_google_docs WHERE site_id = p_primary_site_id);
  UPDATE site_google_docs SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;

  -- site_access — merge access permissions
  DELETE FROM site_access
    WHERE site_id = p_secondary_site_id
      AND profile_id IN (SELECT profile_id FROM site_access WHERE site_id = p_primary_site_id);
  UPDATE site_access SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;

  -- 5. Per-site UNIQUE tables — keep primary's, secondary's will cascade-delete with the site
  -- handoff_reports: move if primary doesn't have one
  IF NOT EXISTS (SELECT 1 FROM handoff_reports WHERE site_id = p_primary_site_id) THEN
    UPDATE handoff_reports SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
  END IF;

  -- site_network_diagnostics: move if primary doesn't have one
  IF NOT EXISTS (SELECT 1 FROM site_network_diagnostics WHERE site_id = p_primary_site_id) THEN
    UPDATE site_network_diagnostics SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
    UPDATE site_network_test_results SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;
  END IF;

  -- site_assessments + all sub-tables: keep primary's assessment, secondary's cascades on delete
  -- (we don't move assessment sub-tables because they're tied to the assessment_id, not just site_id)

  -- hubspot_site_links: move all deals (no unique per site anymore after migration 015)
  UPDATE hubspot_site_links SET site_id = p_primary_site_id WHERE site_id = p_secondary_site_id;

  -- 6. Delete the secondary site — ON DELETE CASCADE handles remaining orphans
  DELETE FROM sites WHERE id = p_secondary_site_id;

  RETURN jsonb_build_object(
    'success', true,
    'primary_site', v_primary.name,
    'secondary_site', v_secondary.name,
    'merged_counts', v_counts
  );
END;
$$;
