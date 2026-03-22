"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";

// NOTE: Assessment tables are not yet in the generated Supabase types.
// We cast admin to `any` for assessment table access until types are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

// ═══════════════════════════════════════════════════════════════
// Assessment CRUD
// ═══════════════════════════════════════════════════════════════

export async function createOrGetAssessment(siteId: string, tenantId: string) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    // Check for existing assessment
    const { data: existing } = await fromTable(admin, "site_assessments")
      .select("*")
      .eq("site_id", siteId)
      .single();

    if (existing) return { assessment: existing };

    const { data, error } = await fromTable(admin, "site_assessments")
      .insert({ site_id: siteId, tenant_id: tenantId, status: "draft" })
      .select()
      .single();

    if (error) return { error: error.message };
    return { assessment: data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function lockAssessment(assessmentId: string, profileId: string) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "site_assessments")
      .update({ status: "locked", locked_by: profileId, locked_at: new Date().toISOString() })
      .eq("id", assessmentId);
    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function unlockAssessment(assessmentId: string) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "site_assessments")
      .update({ status: "in_progress", locked_by: null, locked_at: null })
      .eq("id", assessmentId);
    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function updateAssessmentStatus(assessmentId: string, status: string) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "site_assessments")
      .update({ status })
      .eq("id", assessmentId);
    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Equipment CRUD
// ═══════════════════════════════════════════════════════════════

export async function addEquipment(data: {
  assessmentId: string;
  siteId: string;
  tenantId: string;
  category: string;
  name?: string;
  manufacturer?: string;
  model?: string;
  quantity?: number;
  specs: Record<string, unknown>;
  notes?: string;
}) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    // Get current max sort_order
    const { data: existing } = await fromTable(admin, "site_equipment")
      .select("sort_order")
      .eq("assessment_id", data.assessmentId)
      .eq("category", data.category)
      .order("sort_order", { ascending: false })
      .limit(1);

    const sortOrder = existing && existing.length > 0 ? (existing[0].sort_order ?? 0) + 1 : 0;

    const { data: row, error } = await fromTable(admin, "site_equipment")
      .insert({
        assessment_id: data.assessmentId,
        site_id: data.siteId,
        tenant_id: data.tenantId,
        category: data.category,
        name: data.name || null,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        quantity: data.quantity ?? 1,
        specs: data.specs,
        notes: data.notes || null,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { equipment: row };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function updateEquipment(
  equipmentId: string,
  data: Partial<{
    name: string;
    manufacturer: string;
    model: string;
    quantity: number;
    specs: Record<string, unknown>;
    notes: string;
  }>,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "site_equipment")
      .update(data)
      .eq("id", equipmentId);
    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function deleteEquipment(equipmentId: string) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "site_equipment")
      .delete()
      .eq("id", equipmentId);
    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Energy Data CRUD
// ═══════════════════════════════════════════════════════════════

export async function addEnergyData(data: {
  assessmentId: string;
  siteId: string;
  tenantId: string;
  periodMonth: string;
  totalCharges?: number;
  totalKwh?: number;
  peakDemandKw?: number;
  supplyProvider?: string;
  supplyCharges?: number;
  supplyKwhRate?: number;
  supplyCapacity?: number;
  supplyCapRate?: number;
  supplyTransmission?: number;
  supplyTransRate?: number;
  distributionProvider?: string;
  distributionCharges?: number;
  distributionDemandRate?: number;
  distributionEnergyRate?: number;
  capacityPlcKw?: number;
  transmissionPlcKw?: number;
  salesTax?: number;
  // TOU consumption fields
  onPeakKwh?: number;
  offPeakKwh?: number;
  shoulderKwh?: number;
  superPeakKwh?: number;
  onPeakDemandKw?: number;
  offPeakDemandKw?: number;
}) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();
    const { data: row, error } = await fromTable(admin, "site_energy_data")
      .insert({
        assessment_id: data.assessmentId,
        site_id: data.siteId,
        tenant_id: data.tenantId,
        period_month: data.periodMonth,
        total_charges: data.totalCharges,
        total_kwh: data.totalKwh,
        peak_demand_kw: data.peakDemandKw,
        supply_provider: data.supplyProvider,
        supply_charges: data.supplyCharges,
        supply_kwh_rate: data.supplyKwhRate,
        supply_capacity: data.supplyCapacity,
        supply_cap_rate: data.supplyCapRate,
        supply_transmission: data.supplyTransmission,
        supply_trans_rate: data.supplyTransRate,
        distribution_provider: data.distributionProvider,
        distribution_charges: data.distributionCharges,
        distribution_demand_rate: data.distributionDemandRate,
        distribution_energy_rate: data.distributionEnergyRate,
        capacity_plc_kw: data.capacityPlcKw,
        transmission_plc_kw: data.transmissionPlcKw,
        sales_tax: data.salesTax,
        on_peak_kwh: data.onPeakKwh,
        off_peak_kwh: data.offPeakKwh,
        shoulder_kwh: data.shoulderKwh,
        super_peak_kwh: data.superPeakKwh,
        on_peak_demand_kw: data.onPeakDemandKw,
        off_peak_demand_kw: data.offPeakDemandKw,
        source: "manual",
      })
      .select()
      .single();

    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { energyData: row };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function updateEnergyData(
  energyDataId: string,
  data: Record<string, unknown>,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "site_energy_data")
      .update(data)
      .eq("id", energyDataId);
    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function deleteEnergyData(energyDataId: string) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "site_energy_data")
      .delete()
      .eq("id", energyDataId);
    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Operational Params (upsert)
// ═══════════════════════════════════════════════════════════════

export async function updateOperationalParams(
  assessmentId: string,
  siteId: string,
  tenantId: string,
  data: Record<string, unknown>,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    const { data: existing } = await fromTable(admin, "site_operational_params")
      .select("id")
      .eq("assessment_id", assessmentId)
      .single();

    if (existing) {
      const { error } = await fromTable(admin, "site_operational_params")
        .update(data)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_operational_params")
        .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...data });
      if (error) return { error: error.message };
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Operations (upsert)
// ═══════════════════════════════════════════════════════════════

export async function updateOperations(
  assessmentId: string,
  siteId: string,
  tenantId: string,
  data: Record<string, unknown>,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    const { data: existing } = await fromTable(admin, "site_operations")
      .select("id")
      .eq("assessment_id", assessmentId)
      .single();

    if (existing) {
      const { error } = await fromTable(admin, "site_operations")
        .update(data)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_operations")
        .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...data });
      if (error) return { error: error.message };
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Rate Structure (upsert)
// ═══════════════════════════════════════════════════════════════

export async function updateRateStructure(
  assessmentId: string,
  siteId: string,
  tenantId: string,
  data: Record<string, unknown>,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    const { data: existing } = await fromTable(admin, "site_rate_structure")
      .select("id")
      .eq("assessment_id", assessmentId)
      .single();

    if (existing) {
      const { error } = await fromTable(admin, "site_rate_structure")
        .update(data)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_rate_structure")
        .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...data });
      if (error) return { error: error.message };
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Load Breakdown (upsert)
// ═══════════════════════════════════════════════════════════════

export async function updateLoadBreakdown(
  assessmentId: string,
  siteId: string,
  tenantId: string,
  data: Record<string, unknown>,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    const { data: existing } = await fromTable(admin, "site_load_breakdown")
      .select("id")
      .eq("assessment_id", assessmentId)
      .single();

    if (existing) {
      const { error } = await fromTable(admin, "site_load_breakdown")
        .update(data)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_load_breakdown")
        .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...data });
      if (error) return { error: error.message };
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// ARCO Performance (upsert)
// ═══════════════════════════════════════════════════════════════

export async function updateArcoPerformance(
  assessmentId: string,
  siteId: string,
  tenantId: string,
  data: Record<string, unknown>,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    const { data: existing } = await fromTable(admin, "site_arco_performance")
      .select("id")
      .eq("assessment_id", assessmentId)
      .single();

    if (existing) {
      const { error } = await fromTable(admin, "site_arco_performance")
        .update(data)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_arco_performance")
        .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...data });
      if (error) return { error: error.message };
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Savings Analysis (upsert)
// ═══════════════════════════════════════════════════════════════

export async function updateSavingsAnalysis(
  assessmentId: string,
  siteId: string,
  tenantId: string,
  data: Record<string, unknown>,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    const { data: existing } = await fromTable(admin, "site_savings_analysis")
      .select("id")
      .eq("assessment_id", assessmentId)
      .single();

    if (existing) {
      const { error } = await fromTable(admin, "site_savings_analysis")
        .update(data)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_savings_analysis")
        .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...data });
      if (error) return { error: error.message };
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Labor Baseline (upsert)
// ═══════════════════════════════════════════════════════════════

export async function updateLaborBaseline(
  assessmentId: string,
  siteId: string,
  tenantId: string,
  data: Record<string, unknown>,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    const { data: existing } = await fromTable(admin, "site_labor_baseline")
      .select("id")
      .eq("assessment_id", assessmentId)
      .single();

    if (existing) {
      const { error } = await fromTable(admin, "site_labor_baseline")
        .update(data)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_labor_baseline")
        .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...data });
      if (error) return { error: error.message };
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// TOU Schedule (upsert)
// ═══════════════════════════════════════════════════════════════

export async function updateTouSchedule(
  assessmentId: string,
  siteId: string,
  tenantId: string,
  data: Record<string, unknown>,
) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();

    const { data: existing } = await fromTable(admin, "site_tou_schedule")
      .select("id")
      .eq("assessment_id", assessmentId)
      .single();

    if (existing) {
      const { error } = await fromTable(admin, "site_tou_schedule")
        .update(data)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_tou_schedule")
        .insert({ assessment_id: assessmentId, site_id: siteId, tenant_id: tenantId, ...data });
      if (error) return { error: error.message };
    }

    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Baseline Data Sources (AI attribution)
// ═══════════════════════════════════════════════════════════════

export async function saveBaselineDataSource(data: {
  assessmentId: string;
  siteId: string;
  tenantId: string;
  attachmentId: string;
  extractionId?: string;
  targetTable: string;
  targetRecordId?: string;
  targetField?: string;
  confidence?: number;
}) {
  try {
    await requireSession();
    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "baseline_data_sources")
      .insert({
        assessment_id: data.assessmentId,
        site_id: data.siteId,
        tenant_id: data.tenantId,
        attachment_id: data.attachmentId,
        extraction_id: data.extractionId || null,
        target_table: data.targetTable,
        target_record_id: data.targetRecordId || null,
        target_field: data.targetField || null,
        confidence: data.confidence,
      });
    if (error) return { error: error.message };
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}
