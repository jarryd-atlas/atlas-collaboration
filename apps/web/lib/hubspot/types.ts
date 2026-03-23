/** HubSpot CRM integration types */

// ─── Sync Direction ────────────────────────────────────────

export type SyncDirection = "hubspot_to_app" | "app_to_hubspot" | "bidirectional";
export type SyncStatus = "started" | "completed" | "failed" | "partial";

// ─── HubSpot API Response Types ────────────────────────────

export interface HubSpotDeal {
  id: string;
  properties: Record<string, string | null>;
  createdAt?: string;
  updatedAt?: string;
}

export interface HubSpotSearchResult {
  total: number;
  results: HubSpotDeal[];
  paging?: { next?: { after: string } };
}

export interface HubSpotPropertyOption {
  value: string;
  label: string;
  description?: string;
  displayOrder: number;
  hidden: boolean;
}

export interface HubSpotProperty {
  name: string;
  label: string;
  description: string;
  type: string;
  fieldType: string;
  groupName: string;
  options?: HubSpotPropertyOption[];
}

export interface HubSpotPropertiesResponse {
  results: HubSpotProperty[];
}

// ─── App-side Types ────────────────────────────────────────

export interface HubSpotConfig {
  id: string;
  tenant_id: string;
  access_token: string;
  portal_id: string;
  is_active: boolean;
  last_synced_at: string | null;
}

export interface HubSpotSiteLink {
  id: string;
  tenant_id: string;
  site_id: string;
  hubspot_deal_id: string;
  deal_name: string | null;
  linked_by: string | null;
  created_at: string;
  // Joined fields
  site?: { name: string; slug: string; customer_slug?: string };
}

export interface HubSpotFieldMapping {
  id: string;
  tenant_id: string;
  hubspot_property: string;
  app_table: string;
  app_column: string;
  direction: SyncDirection;
  transform: string | null;
  is_active: boolean;
}

export interface HubSpotSyncLogEntry {
  id: string;
  site_link_id: string | null;
  direction: SyncDirection;
  status: SyncStatus;
  fields_synced: SyncFieldChange[];
  fields_skipped: SyncFieldSkip[];
  error: string | null;
  triggered_by: string;
  initiated_by: string | null;
  started_at: string;
  completed_at: string | null;
  // Joined
  site_link?: { deal_name: string | null; site_id: string };
}

export interface SyncFieldChange {
  hubspot_property: string;
  app_table: string;
  app_column: string;
  old_value: string | null;
  new_value: string | null;
  direction: "to_app" | "to_hubspot";
}

export interface SyncFieldSkip {
  field: string;
  reason: string;
}

// ─── Mappable App Fields ───────────────────────────────────

export interface MappableAppField {
  table: string;
  column: string;
  label: string;
  type: "text" | "number" | "percentage" | "date" | "enum";
}

export interface FieldMappingInput {
  hubspot_property: string;
  app_table: string;
  app_column: string;
  direction: SyncDirection;
  transform?: string;
}

// ─── Sync Result ───────────────────────────────────────────

export interface SyncResult {
  status: SyncStatus;
  fieldsChanged: SyncFieldChange[];
  fieldsSkipped: SyncFieldSkip[];
  error?: string;
}
