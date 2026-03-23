import type { MappableAppField, FieldMappingInput } from "./types";

/**
 * HubSpot deal stage IDs → ATLAS pipeline_stage enum.
 * HubSpot uses UUIDs/numeric IDs for stages; we map to our simplified lifecycle.
 */
export const PIPELINE_STAGE_MAP: Record<string, string> = {
  // New Business pipeline
  "1188492915": "prospect",      // 01 - Intro/Contact
  "250564613": "prospect",       // 02 - Discovery
  "1188492916": "prospect",      // 03 - Demonstration
  "250564614": "evaluation",     // 04 - Data Collection
  "1240422453": "qualified",     // 05 - Qualified
  "1188492917": "evaluation",    // 06 - Energy Value Assessment
  "1188492918": "evaluation",    // 07 - Executive Presentation
  "1188492919": "evaluation",    // 08 - M&V Alignment
  "6b3b22f8-8bf4-40af-91e0-61bd1b0bfc63": "evaluation", // 09 - In Consideration
  "250564615": "contracted",     // 10 - Out for Signature
  "4c6e00f8-890b-4a2d-8f22-7eb9b7227e00": "contracted", // 11 - Won
  "10d2d0d7-556b-4fb9-aa24-12b0fd0159a6": "paused",     // 99 - Stalled
  "5b2cab04-4ab5-4249-8487-0b3834d444c5": "disqualified", // 100 - Lost
  // Renewal pipeline
  "e4be6fb9-65ed-4f32-9493-d755e7410ab1": "evaluation",  // In Consideration
  "268042404": "evaluation",     // Renewal Preparation
  "264057885": "contracted",     // Out for Signature
  "80a99505-8d78-4864-bee8-c416cb2e7f4f": "active",     // Won
  "dddab890-d5f2-4399-9886-f2ad9fb46864": "disqualified", // Lost
};

/** Reverse map: app pipeline_stage → best-fit HubSpot deal stage */
export const REVERSE_PIPELINE_STAGE_MAP: Record<string, string> = {
  prospect: "1188492915",      // 01 - Intro/Contact
  evaluation: "1188492917",    // 06 - Energy Value Assessment
  qualified: "1240422453",     // 05 - Qualified
  disqualified: "5b2cab04-4ab5-4249-8487-0b3834d444c5", // 100 - Lost
  contracted: "4c6e00f8-890b-4a2d-8f22-7eb9b7227e00",   // 11 - Won
  deployment: "4c6e00f8-890b-4a2d-8f22-7eb9b7227e00",   // 11 - Won (closest)
  active: "80a99505-8d78-4864-bee8-c416cb2e7f4f",       // Won (renewal)
  paused: "10d2d0d7-556b-4fb9-aa24-12b0fd0159a6",       // 99 - Stalled
};

/**
 * App fields available for HubSpot field mapping.
 * Each entry represents a writable column in an assessment table.
 */
export const MAPPABLE_APP_FIELDS: MappableAppField[] = [
  // Sites
  { table: "sites", column: "name", label: "Site Name", type: "text" },
  { table: "sites", column: "pipeline_stage", label: "Pipeline Stage", type: "enum" },
  { table: "sites", column: "address", label: "Address", type: "text" },
  { table: "sites", column: "city", label: "City", type: "text" },
  { table: "sites", column: "state", label: "State", type: "text" },

  // Savings Analysis
  { table: "site_savings_analysis", column: "annual_energy_spend", label: "Annual Energy Spend ($)", type: "number" },
  { table: "site_savings_analysis", column: "pre_atlas_kwh", label: "Pre-ATLAS Annual kWh", type: "number" },
  { table: "site_savings_analysis", column: "peak_demand_kw", label: "Peak Demand (kW)", type: "number" },
  { table: "site_savings_analysis", column: "compressor_load_pct", label: "Compressor Load %", type: "percentage" },
  { table: "site_savings_analysis", column: "refrigeration_pct", label: "Refrigeration %", type: "percentage" },
  { table: "site_savings_analysis", column: "flexible_demand_pct", label: "Flexible Demand %", type: "percentage" },
  { table: "site_savings_analysis", column: "compressor_savings_pct", label: "Compressor Savings %", type: "percentage" },
  { table: "site_savings_analysis", column: "post_atlas_annual_kwh", label: "Post-ATLAS Annual kWh", type: "number" },
  { table: "site_savings_analysis", column: "pre_atlas_avg_power_kw", label: "Pre-ATLAS Avg Power (kW)", type: "number" },
  { table: "site_savings_analysis", column: "post_atlas_avg_power_kw", label: "Post-ATLAS Avg Power (kW)", type: "number" },
  { table: "site_savings_analysis", column: "post_atlas_peak_demand_kw", label: "Post-ATLAS Peak Demand (kW)", type: "number" },

  // Operational Params
  { table: "site_operational_params", column: "facility_type", label: "Facility Type", type: "text" },
  { table: "site_operational_params", column: "system_type", label: "System Type", type: "text" },
  { table: "site_operational_params", column: "refrigerant", label: "Refrigerant", type: "text" },
  { table: "site_operational_params", column: "control_system", label: "Control System", type: "text" },
  { table: "site_operational_params", column: "estimated_upgrade_cost", label: "Estimated Upgrade Cost ($)", type: "number" },
  { table: "site_operational_params", column: "required_upgrades", label: "Required Upgrades", type: "text" },
  { table: "site_operational_params", column: "operating_days_week", label: "Operating Days/Week", type: "number" },
  { table: "site_operational_params", column: "daily_hours", label: "Daily Hours", type: "number" },

  // TOU Schedule
  { table: "site_tou_schedule", column: "account_number", label: "Utility Account #", type: "text" },
  { table: "site_tou_schedule", column: "meter_number", label: "Meter #", type: "text" },
  { table: "site_tou_schedule", column: "rate_name", label: "Rate Name", type: "text" },
  { table: "site_tou_schedule", column: "supply_provider", label: "Supply Provider", type: "text" },
  { table: "site_tou_schedule", column: "distribution_provider", label: "Distribution Provider", type: "text" },
];

/**
 * Default field mappings seeded on first HubSpot connection.
 * Users can modify direction and add/remove mappings via the admin UI.
 */
export const DEFAULT_FIELD_MAPPINGS: Omit<FieldMappingInput, "tenant_id">[] = [
  { hubspot_property: "atlas_site_name", app_table: "sites", app_column: "name", direction: "hubspot_to_app", transform: "text" },
  { hubspot_property: "dealstage", app_table: "sites", app_column: "pipeline_stage", direction: "hubspot_to_app", transform: "pipeline_stage_map" },
  { hubspot_property: "annual_energy_spend__c", app_table: "site_savings_analysis", app_column: "annual_energy_spend", direction: "bidirectional", transform: "number" },
  { hubspot_property: "refrigeration_load", app_table: "site_savings_analysis", app_column: "refrigeration_pct", direction: "bidirectional", transform: "percentage" },
  { hubspot_property: "forecasted_refrigeration_savings_percent", app_table: "site_savings_analysis", app_column: "compressor_savings_pct", direction: "app_to_hubspot", transform: "percentage" },
  { hubspot_property: "forecasted_total_savings_percent", app_table: "site_savings_analysis", app_column: "flexible_demand_pct", direction: "app_to_hubspot", transform: "percentage" },
  { hubspot_property: "facility_type", app_table: "site_operational_params", app_column: "facility_type", direction: "hubspot_to_app", transform: "text" },
  { hubspot_property: "nrc", app_table: "site_operational_params", app_column: "estimated_upgrade_cost", direction: "bidirectional", transform: "number" },
];
