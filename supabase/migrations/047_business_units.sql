-- Business units / divisions within a customer (e.g. Tyson Fresh Meats, Prepared Foods, etc.)
CREATE TABLE business_units (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  slug        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, slug)
);

-- Tag sites to a business unit (optional)
ALTER TABLE sites ADD COLUMN business_unit_id uuid REFERENCES business_units(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_read" ON business_units FOR SELECT USING (can_read_tenant(tenant_id));
CREATE POLICY "tenant_insert" ON business_units FOR INSERT WITH CHECK (is_active());
CREATE POLICY "tenant_update" ON business_units FOR UPDATE USING (is_active());
CREATE POLICY "tenant_delete" ON business_units FOR DELETE USING (is_active());
