/**
 * Shared function to apply AI-extracted baseline data to assessment tables.
 * Used by both the auto-apply flow (analyze-document) and the manual apply route.
 */

import { createSupabaseAdmin } from "../supabase/server";
import type { BaselineExtraction } from "@repo/ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

export interface ApplyExtractionParams {
  extractionId: string;
  assessmentId: string;
  siteId: string;
  tenantId: string;
  attachmentId: string;
  data: Partial<BaselineExtraction>;
  reviewedBy?: string;
}

export async function applyExtraction(params: ApplyExtractionParams): Promise<string[]> {
  const { extractionId, assessmentId, siteId, tenantId, attachmentId, data, reviewedBy } = params;
  const admin = createSupabaseAdmin();
  const appliedSections: string[] = [];

  // ── Equipment ──────────────────────────────────────────────
  if (data.equipment && data.equipment.length > 0) {
    for (const eq of data.equipment) {
      const { data: inserted } = await fromTable(admin, "site_equipment")
        .insert({
          assessment_id: assessmentId,
          site_id: siteId,
          tenant_id: tenantId,
          category: eq.category,
          name: eq.name || null,
          manufacturer: eq.manufacturer || null,
          model: eq.model || null,
          quantity: eq.quantity ?? 1,
          specs: eq.specs || {},
          notes: eq.notes || null,
          source_document_id: attachmentId,
          sort_order: 0,
        })
        .select("id")
        .single();

      if (inserted) {
        await fromTable(admin, "baseline_data_sources").insert({
          assessment_id: assessmentId,
          site_id: siteId,
          tenant_id: tenantId,
          attachment_id: attachmentId,
          extraction_id: extractionId,
          target_table: "site_equipment",
          target_record_id: inserted.id,
          confidence: data.confidence,
        });
      }
    }
    appliedSections.push("equipment");
  }

  // ── Energy Data ────────────────────────────────────────────
  if (data.energyData && data.energyData.length > 0) {
    for (const ed of data.energyData) {
      const { data: inserted } = await fromTable(admin, "site_energy_data")
        .insert({
          assessment_id: assessmentId,
          site_id: siteId,
          tenant_id: tenantId,
          period_month: ed.periodMonth,
          total_charges: ed.totalCharges,
          total_kwh: ed.totalKwh,
          peak_demand_kw: ed.peakDemandKw,
          supply_charges: ed.supplyCharges,
          distribution_charges: ed.distributionCharges,
          on_peak_kwh: ed.onPeakKwh,
          off_peak_kwh: ed.offPeakKwh,
          shoulder_kwh: ed.shoulderKwh,
          on_peak_demand_kw: ed.onPeakDemandKw,
          off_peak_demand_kw: ed.offPeakDemandKw,
          capacity_plc_kw: ed.capacityPlcKw,
          transmission_plc_kw: ed.transmissionPlcKw,
          sales_tax: ed.salesTax,
          source: "extracted",
          source_document_id: attachmentId,
        })
        .select("id")
        .single();

      if (inserted) {
        await fromTable(admin, "baseline_data_sources").insert({
          assessment_id: assessmentId,
          site_id: siteId,
          tenant_id: tenantId,
          attachment_id: attachmentId,
          extraction_id: extractionId,
          target_table: "site_energy_data",
          target_record_id: inserted.id,
          confidence: data.confidence,
        });
      }
    }
    appliedSections.push("energyData");
  }

  // ── TOU Schedule ───────────────────────────────────────────
  if (data.touSchedule) {
    const ts = data.touSchedule;
    await upsertSingle(admin, "site_tou_schedule", assessmentId, siteId, tenantId, {
      supply_provider: ts.supplyProvider,
      distribution_provider: ts.distributionProvider,
      account_number: ts.accountNumber,
      meter_number: ts.meterNumber,
      rate_name: ts.rateName,
      rate_id_external: ts.rateIdExternal,
      demand_response_status: ts.demandResponseStatus,
      on_peak_energy_rate: ts.onPeakEnergyRate,
      on_peak_demand_rate: ts.onPeakDemandRate,
      on_peak_start_hour: ts.onPeakStartHour,
      on_peak_end_hour: ts.onPeakEndHour,
      on_peak_months: ts.onPeakMonths,
      off_peak_energy_rate: ts.offPeakEnergyRate,
      off_peak_demand_rate: ts.offPeakDemandRate,
      shoulder_energy_rate: ts.shoulderEnergyRate,
      shoulder_demand_rate: ts.shoulderDemandRate,
      shoulder_start_hour: ts.shoulderStartHour,
      shoulder_end_hour: ts.shoulderEndHour,
      shoulder_months: ts.shoulderMonths,
      source_document_id: attachmentId,
    });
    await fromTable(admin, "baseline_data_sources").insert({
      assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId,
      attachment_id: attachmentId, extraction_id: extractionId,
      target_table: "site_tou_schedule", confidence: data.confidence,
    });
    appliedSections.push("touSchedule");
  }

  // ── Rate Structure ─────────────────────────────────────────
  if (data.rateStructure) {
    const rs = data.rateStructure;
    await upsertSingle(admin, "site_rate_structure", assessmentId, siteId, tenantId, {
      fixed_usage_pct: rs.fixedUsagePct,
      variable_tou_usage_pct: rs.variableTouUsagePct,
      max_demand_pct: rs.maxDemandPct,
      variable_tou_demand_pct: rs.variableTouDemandPct,
      coincident_peak_pct: rs.coincidentPeakPct,
      other_fixed_pct: rs.otherFixedPct,
      cp_zone: rs.cpZone,
      avg_cp_tag_kw: rs.avgCpTagKw,
      capacity_rate_per_kw_yr: rs.capacityRatePerKwYr,
      transmission_rate_per_kw_yr: rs.transmissionRatePerKwYr,
      source_document_id: attachmentId,
    });
    await fromTable(admin, "baseline_data_sources").insert({
      assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId,
      attachment_id: attachmentId, extraction_id: extractionId,
      target_table: "site_rate_structure", confidence: data.confidence,
    });
    appliedSections.push("rateStructure");
  }

  // ── Operational Params ─────────────────────────────────────
  if (data.operationalParams) {
    const op = data.operationalParams;
    await upsertSingle(admin, "site_operational_params", assessmentId, siteId, tenantId, {
      operating_days_per_week: op.operatingDaysPerWeek,
      daily_operational_hours: op.dailyOperationalHours,
      load_factor: op.loadFactor,
      off_ops_energy_use: op.offOpsEnergyUse,
      system_type: op.systemType,
      refrigerant: op.refrigerant,
      control_system: op.controlSystem,
      control_hardware: op.controlHardware,
      facility_type: op.facilityType,
      runs_24_7: op.runs247,
      has_sub_metering: op.hasSubMetering,
      has_blast_freezing: op.hasBlastFreezing,
      required_upgrades: op.requiredUpgrades,
      estimated_upgrade_cost: op.estimatedUpgradeCost,
      survey_notes: op.surveyNotes,
      source_document_id: attachmentId,
    });
    await fromTable(admin, "baseline_data_sources").insert({
      assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId,
      attachment_id: attachmentId, extraction_id: extractionId,
      target_table: "site_operational_params", confidence: data.confidence,
    });
    appliedSections.push("operationalParams");
  }

  // ── Operations ─────────────────────────────────────────────
  if (data.operations) {
    const ops = data.operations;
    await upsertSingle(admin, "site_operations", assessmentId, siteId, tenantId, {
      discharge_pressure_typical: ops.dischargePressureTypical,
      suction_pressure_typical: ops.suctionPressureTypical,
      can_shed_load: ops.canShedLoad,
      can_shutdown: ops.canShutdown,
      shutdown_constraints: ops.shutdownConstraints,
      curtailment_enrolled: ops.curtailmentEnrolled,
      curtailment_frequency: ops.curtailmentFrequency,
      curtailment_barriers: ops.curtailmentBarriers,
      seasonality_notes: ops.seasonalityNotes,
      temperature_challenges: ops.temperatureChallenges,
      operational_nuances: ops.operationalNuances,
      product_notes: ops.productNotes,
      staffing_notes: ops.staffingNotes,
      source_document_id: attachmentId,
    });
    await fromTable(admin, "baseline_data_sources").insert({
      assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId,
      attachment_id: attachmentId, extraction_id: extractionId,
      target_table: "site_operations", confidence: data.confidence,
    });
    appliedSections.push("operations");
  }

  // ── Labor ──────────────────────────────────────────────────
  if (data.labor) {
    const lb = data.labor;
    await upsertSingle(admin, "site_labor_baseline", assessmentId, siteId, tenantId, {
      headcount: lb.headcount || [],
      pain_points: lb.painPoints,
      manual_processes: lb.manualProcesses,
      time_sinks: lb.timeSinks,
      automation_opportunities: lb.automationOpportunities,
      source_document_id: attachmentId,
    });
    await fromTable(admin, "baseline_data_sources").insert({
      assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId,
      attachment_id: attachmentId, extraction_id: extractionId,
      target_table: "site_labor_baseline", confidence: data.confidence,
    });
    appliedSections.push("labor");
  }

  // ── Site Contacts ──────────────────────────────────────────
  if (data.siteContacts && data.siteContacts.length > 0) {
    for (const contact of data.siteContacts) {
      const { data: inserted } = await fromTable(admin, "site_contacts")
        .insert({
          assessment_id: assessmentId,
          site_id: siteId,
          tenant_id: tenantId,
          name: contact.name || "Unknown",
          title: contact.title || null,
          email: contact.email || null,
          phone: contact.phone || null,
        })
        .select("id")
        .single();

      if (inserted) {
        await fromTable(admin, "baseline_data_sources").insert({
          assessment_id: assessmentId,
          site_id: siteId,
          tenant_id: tenantId,
          attachment_id: attachmentId,
          extraction_id: extractionId,
          target_table: "site_contacts",
          target_record_id: inserted.id,
          confidence: data.confidence,
        });
      }
    }
    appliedSections.push("siteContacts");
  }

  // ── Update extraction status ───────────────────────────────
  await fromTable(admin, "document_extractions")
    .update({
      status: "accepted",
      reviewed_by: reviewedBy ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", extractionId);

  return appliedSections;
}

/**
 * Upsert a single record in an assessment-scoped table.
 */
async function upsertSingle(
  admin: ReturnType<typeof createSupabaseAdmin>,
  table: string,
  assessmentId: string,
  siteId: string,
  tenantId: string,
  data: Record<string, unknown>,
) {
  const cleanData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  }

  const { data: existing } = await fromTable(admin, table)
    .select("id")
    .eq("assessment_id", assessmentId)
    .single();

  if (existing) {
    await fromTable(admin, table).update(cleanData).eq("id", existing.id);
  } else {
    await fromTable(admin, table).insert({
      assessment_id: assessmentId,
      site_id: siteId,
      tenant_id: tenantId,
      ...cleanData,
    });
  }
}
