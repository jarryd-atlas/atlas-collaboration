/**
 * HubSpot sync engine — syncs field values between a HubSpot Deal and an ATLAS Site.
 */

import { createSupabaseAdmin } from "../supabase/server";
import { getDeal, updateDeal } from "./client";
import { transformToApp, transformToHubSpot } from "./transforms";
import { recalculateSiteStage } from "./stage-resolver";
import type {
  HubSpotFieldMapping,
  SyncFieldChange,
  SyncFieldSkip,
  SyncResult,
} from "./types";

/**
 * Tables that are linked to a site through site_assessments.
 * For these, we need to look up via assessment_id, not site_id directly.
 */
const ASSESSMENT_LINKED_TABLES = new Set([
  "site_savings_analysis",
  "site_operational_params",
  "site_equipment",
  "site_energy_data",
  "site_tou_schedule",
  "site_operations",
  "site_load_breakdown",
  "site_arco_performance",
  "site_labor_baseline",
  "site_rate_structure",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

/**
 * Sync a single linked HubSpot Deal with its ATLAS Site.
 */
export async function syncSiteWithDeal(opts: {
  token: string;
  siteLinkId: string;
  siteId: string;
  dealId: string;
  tenantId: string;
  profileId?: string;
  triggeredBy: "manual" | "webhook" | "scheduled";
}): Promise<SyncResult> {
  const { token, siteLinkId, siteId, dealId, tenantId, profileId, triggeredBy } = opts;
  const admin = createSupabaseAdmin();

  // 1. Create sync log entry
  const { data: logEntry } = await fromTable(admin, "hubspot_sync_log")
    .insert({
      tenant_id: tenantId,
      site_link_id: siteLinkId,
      direction: "bidirectional",
      status: "started",
      triggered_by: triggeredBy,
      initiated_by: profileId ?? null,
    })
    .select("id")
    .single();

  const logId = logEntry?.id;
  const fieldsChanged: SyncFieldChange[] = [];
  const fieldsSkipped: SyncFieldSkip[] = [];

  try {
    // 2. Load active field mappings
    const { data: mappings } = await fromTable(admin, "hubspot_field_mappings")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (!mappings || mappings.length === 0) {
      return finalize(admin, logId, { status: "completed", fieldsChanged: [], fieldsSkipped: [{ field: "*", reason: "no_active_mappings" }], error: undefined });
    }

    // 3. Fetch deal from HubSpot with all mapped properties + hs_lastmodifieddate
    const hubspotProperties = [
      ...new Set([
        ...mappings.map((m: HubSpotFieldMapping) => m.hubspot_property),
        "hs_lastmodifieddate",
        "dealname",
      ]),
    ];
    const deal = await getDeal(token, dealId, hubspotProperties);
    const dealModifiedAt = deal.properties.hs_lastmodifieddate
      ? new Date(deal.properties.hs_lastmodifieddate)
      : new Date(0);

    // 4. Get the assessment_id for this site (needed for assessment-linked tables)
    const { data: assessment } = await fromTable(admin, "site_assessments")
      .select("id")
      .eq("site_id", siteId)
      .single();

    // 5. Group mappings by target table for efficient reads/writes
    const byTable = new Map<string, HubSpotFieldMapping[]>();
    for (const m of mappings as HubSpotFieldMapping[]) {
      const list = byTable.get(m.app_table) ?? [];
      list.push(m);
      byTable.set(m.app_table, list);
    }

    // 6. Process each table
    const hubspotUpdates: Record<string, string> = {};

    for (const [table, tableMappings] of byTable) {
      // Determine the lookup key
      let lookupCol: string;
      let lookupVal: string;

      if (table === "sites") {
        lookupCol = "id";
        lookupVal = siteId;
      } else if (ASSESSMENT_LINKED_TABLES.has(table)) {
        if (!assessment) {
          for (const m of tableMappings) {
            fieldsSkipped.push({ field: `${m.app_table}.${m.app_column}`, reason: "no_assessment" });
          }
          continue;
        }
        lookupCol = "assessment_id";
        lookupVal = assessment.id as string;
      } else {
        lookupCol = "site_id";
        lookupVal = siteId;
      }

      // Fetch current app values
      const selectCols = [...new Set([...tableMappings.map((m) => m.app_column), "updated_at"])].join(",");
      const { data: appRow } = await fromTable(admin, table)
        .select(selectCols)
        .eq(lookupCol, lookupVal)
        .maybeSingle();

      const appUpdatedAt = appRow?.updated_at ? new Date(appRow.updated_at as string) : new Date(0);
      const appUpdates: Record<string, unknown> = {};

      for (const mapping of tableMappings) {
        // Skip pipeline_stage — it's recalculated from ALL linked deals after sync
        if (mapping.app_column === "pipeline_stage" && mapping.app_table === "sites") {
          fieldsSkipped.push({ field: `${table}.${mapping.app_column}`, reason: "resolved_from_all_deals" });
          continue;
        }

        const hubspotRaw = deal.properties[mapping.hubspot_property] ?? null;
        const appRaw = appRow ? (appRow as Record<string, unknown>)[mapping.app_column] : null;

        const hubspotTransformed = transformToApp(mapping.transform, hubspotRaw);
        const appTransformedToHS = transformToHubSpot(mapping.transform, appRaw);

        // Determine if values differ
        const appValueStr = appRaw === null || appRaw === undefined ? null : String(appRaw);
        const hsValueStr = hubspotTransformed === null ? null : String(hubspotTransformed);
        const valuesMatch = appValueStr === hsValueStr;

        if (valuesMatch) {
          fieldsSkipped.push({ field: `${table}.${mapping.app_column}`, reason: "values_match" });
          continue;
        }

        // Apply direction logic
        if (mapping.direction === "hubspot_to_app") {
          if (hubspotRaw !== null && hubspotRaw !== "") {
            appUpdates[mapping.app_column] = hubspotTransformed;
            fieldsChanged.push({
              hubspot_property: mapping.hubspot_property,
              app_table: table,
              app_column: mapping.app_column,
              old_value: appValueStr,
              new_value: hsValueStr,
              direction: "to_app",
            });
          }
        } else if (mapping.direction === "app_to_hubspot") {
          if (appRaw !== null && appRaw !== undefined) {
            hubspotUpdates[mapping.hubspot_property] = appTransformedToHS;
            fieldsChanged.push({
              hubspot_property: mapping.hubspot_property,
              app_table: table,
              app_column: mapping.app_column,
              old_value: hubspotRaw,
              new_value: appTransformedToHS,
              direction: "to_hubspot",
            });
          }
        } else {
          // Bidirectional: last-write-wins
          if (appUpdatedAt > dealModifiedAt) {
            // App is newer → push to HubSpot
            if (appRaw !== null && appRaw !== undefined) {
              hubspotUpdates[mapping.hubspot_property] = appTransformedToHS;
              fieldsChanged.push({
                hubspot_property: mapping.hubspot_property,
                app_table: table,
                app_column: mapping.app_column,
                old_value: hubspotRaw,
                new_value: appTransformedToHS,
                direction: "to_hubspot",
              });
            }
          } else {
            // HubSpot is newer → pull to app
            if (hubspotRaw !== null && hubspotRaw !== "") {
              appUpdates[mapping.app_column] = hubspotTransformed;
              fieldsChanged.push({
                hubspot_property: mapping.hubspot_property,
                app_table: table,
                app_column: mapping.app_column,
                old_value: appValueStr,
                new_value: hsValueStr,
                direction: "to_app",
              });
            }
          }
        }
      }

      // Write app updates
      if (Object.keys(appUpdates).length > 0) {
        if (appRow) {
          await fromTable(admin, table)
            .update(appUpdates)
            .eq(lookupCol, lookupVal);
        } else if (assessment) {
          // Row doesn't exist yet — create it
          await fromTable(admin, table).insert({
            ...appUpdates,
            ...(ASSESSMENT_LINKED_TABLES.has(table)
              ? { assessment_id: assessment.id, site_id: siteId, tenant_id: tenantId }
              : {}),
            ...(table === "sites" ? {} : { tenant_id: tenantId }),
          });
        }
      }
    }

    // 7. Push accumulated HubSpot updates in one API call
    if (Object.keys(hubspotUpdates).length > 0) {
      await updateDeal(token, dealId, hubspotUpdates);
    }

    // 8. Update cached deal name
    const newDealName = deal.properties.dealname ?? null;
    await fromTable(admin, "hubspot_site_links")
      .update({ deal_name: newDealName })
      .eq("id", siteLinkId);

    // 9. Recalculate pipeline_stage from ALL linked deals (multi-deal resolution)
    try {
      await recalculateSiteStage(siteId, tenantId, token);
    } catch {
      // Non-critical — field sync already completed
    }

    // 10. Update last_synced_at on config
    await fromTable(admin, "hubspot_config")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("tenant_id", tenantId);

    return finalize(admin, logId, { status: "completed", fieldsChanged, fieldsSkipped });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return finalize(admin, logId, { status: "failed", fieldsChanged, fieldsSkipped, error: errorMsg });
  }
}

/** Finalize sync log entry */
async function finalize(
  admin: ReturnType<typeof createSupabaseAdmin>,
  logId: string | undefined,
  result: SyncResult
): Promise<SyncResult> {
  if (logId) {
    await fromTable(admin, "hubspot_sync_log")
      .update({
        status: result.status,
        fields_synced: result.fieldsChanged,
        fields_skipped: result.fieldsSkipped,
        error: result.error ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", logId);
  }
  return result;
}
