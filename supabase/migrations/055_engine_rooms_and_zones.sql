-- Multi-Engine-Room & Temperature Zone support
-- Allows facilities with multiple engine rooms (connected or independent)
-- and multiple temperature zones (cooler/freezer/blast/dock rooms).
-- All new columns are nullable for backward compatibility with simple sites.

-- ═══════════════════════════════════════════════════════════════
-- Engine Rooms — mechanical rooms with compressors, condensers, vessels, controls
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE site_engine_rooms (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id               uuid NOT NULL REFERENCES site_assessments(id) ON DELETE CASCADE,
  site_id                     uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id                   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                        text NOT NULL DEFAULT 'Engine Room 1',
  sort_order                  integer NOT NULL DEFAULT 0,

  -- Refrigeration system config (mirrors site_operational_params but per-ER)
  system_type                 text,           -- single_stage / two_stage / cascade
  refrigerant                 text,           -- ammonia / R-22 / etc
  control_system              text,           -- Frick / Logix / etc
  control_hardware            text,           -- Opto 22 / Allen Bradley
  micro_panel_type            text,

  -- Operating pressures (mirrors site_operations but per-ER)
  suction_pressure_typical    numeric,
  discharge_pressure_typical  numeric,

  -- Inter-ER relationships
  connected_to_engine_room_id uuid REFERENCES site_engine_rooms(id) ON DELETE SET NULL,
  shared_controls             boolean NOT NULL DEFAULT false,

  notes                       text,
  last_edited_by              uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_engine_rooms_site ON site_engine_rooms(site_id);
CREATE INDEX idx_engine_rooms_assessment ON site_engine_rooms(assessment_id);

-- RLS
ALTER TABLE site_engine_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY engine_rooms_select ON site_engine_rooms
  FOR SELECT USING (public.can_read_tenant(tenant_id));

-- CK internal can always mutate
CREATE POLICY engine_rooms_insert_internal ON site_engine_rooms
  FOR INSERT WITH CHECK (public.is_internal());

CREATE POLICY engine_rooms_update_internal ON site_engine_rooms
  FOR UPDATE USING (public.is_internal());

CREATE POLICY engine_rooms_delete_internal ON site_engine_rooms
  FOR DELETE USING (public.is_internal());

-- Customer users can insert/update via baseline form (token-authenticated flow)
-- The baseline form uses admin client, so these policies cover direct access.
-- We also allow customer tenant members to mutate their own data.
CREATE POLICY engine_rooms_insert_customer ON site_engine_rooms
  FOR INSERT WITH CHECK (
    public.can_read_tenant(tenant_id)
    AND NOT public.is_internal()
  );

CREATE POLICY engine_rooms_update_customer ON site_engine_rooms
  FOR UPDATE USING (
    public.can_read_tenant(tenant_id)
    AND NOT public.is_internal()
  );


-- ═══════════════════════════════════════════════════════════════
-- Temperature Zones — cooler/freezer/blast/dock rooms with evaporators
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE site_temperature_zones (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id           uuid NOT NULL REFERENCES site_assessments(id) ON DELETE CASCADE,
  site_id                 uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  engine_room_id          uuid REFERENCES site_engine_rooms(id) ON DELETE SET NULL,
  name                    text NOT NULL DEFAULT 'Zone 1',
  sort_order              integer NOT NULL DEFAULT 0,

  -- Zone characteristics (critical for load calculation)
  zone_type               text,             -- cooler / freezer / blast / dock / processing / dry_storage
  target_temp_f           numeric,          -- target temperature in °F
  length_ft               numeric,          -- room dimensions for volume calc
  width_ft                numeric,
  height_ft               numeric,

  -- Doors & insulation (infiltration load factors)
  num_doors               integer,
  door_type               text,             -- strip_curtain / high_speed / manual / dock_door
  insulation_thickness_in numeric,
  insulation_condition    text,             -- good / fair / poor

  notes                   text,
  last_edited_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_temp_zones_site ON site_temperature_zones(site_id);
CREATE INDEX idx_temp_zones_assessment ON site_temperature_zones(assessment_id);
CREATE INDEX idx_temp_zones_engine_room ON site_temperature_zones(engine_room_id);

-- RLS
ALTER TABLE site_temperature_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY temp_zones_select ON site_temperature_zones
  FOR SELECT USING (public.can_read_tenant(tenant_id));

CREATE POLICY temp_zones_insert_internal ON site_temperature_zones
  FOR INSERT WITH CHECK (public.is_internal());

CREATE POLICY temp_zones_update_internal ON site_temperature_zones
  FOR UPDATE USING (public.is_internal());

CREATE POLICY temp_zones_delete_internal ON site_temperature_zones
  FOR DELETE USING (public.is_internal());

CREATE POLICY temp_zones_insert_customer ON site_temperature_zones
  FOR INSERT WITH CHECK (
    public.can_read_tenant(tenant_id)
    AND NOT public.is_internal()
  );

CREATE POLICY temp_zones_update_customer ON site_temperature_zones
  FOR UPDATE USING (
    public.can_read_tenant(tenant_id)
    AND NOT public.is_internal()
  );


-- ═══════════════════════════════════════════════════════════════
-- Add engine_room_id and zone_id to existing equipment table
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE site_equipment
  ADD COLUMN engine_room_id uuid REFERENCES site_engine_rooms(id) ON DELETE SET NULL,
  ADD COLUMN zone_id        uuid REFERENCES site_temperature_zones(id) ON DELETE SET NULL;

CREATE INDEX idx_equipment_engine_room ON site_equipment(engine_room_id) WHERE engine_room_id IS NOT NULL;
CREATE INDEX idx_equipment_zone ON site_equipment(zone_id) WHERE zone_id IS NOT NULL;
