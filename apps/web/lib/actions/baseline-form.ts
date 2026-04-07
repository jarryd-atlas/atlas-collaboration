"use server";

import { createSupabaseAdmin } from "../supabase/server";
import type {
  ContactData,
  ContractorData,
  FacilityData,
  SystemData,
  EquipmentData,
  EnergyData,
  OperationsData,
  EfficiencyData,
} from "../baseline-form/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

// ═══════════════════════════════════════════════════════════════
// Token Validation
// ═══════════════════════════════════════════════════════════════

interface FormSession {
  id: string;
  assessment_id: string;
  site_id: string;
  tenant_id: string;
}

async function validateToken(token: string): Promise<FormSession | null> {
  const admin = createSupabaseAdmin();
  const { data } = await fromTable(admin, "assessment_interviews")
    .select("id, assessment_id, site_id, tenant_id, status, form_type")
    .eq("invite_token", token)
    .single();

  if (!data) return null;
  // Allow access as long as the token exists (living form, no lockout)
  return {
    id: data.id,
    assessment_id: data.assessment_id,
    site_id: data.site_id,
    tenant_id: data.tenant_id,
  };
}

/** Log a change to the activity_log table */
async function logChange(
  admin: ReturnType<typeof createSupabaseAdmin>,
  session: FormSession,
  profileId: string,
  action: string,
  changes: Record<string, unknown>
) {
  try {
    await fromTable(admin, "activity_log").insert({
      tenant_id: session.tenant_id,
      actor_id: profileId,
      entity_type: "site",
      entity_id: session.site_id,
      action,
      changes,
    });
  } catch {
    // Non-critical — don't fail the save
  }
}

// ═══════════════════════════════════════════════════════════════
// Contacts
// ═══════════════════════════════════════════════════════════════

export async function upsertBaselineContact(
  token: string,
  profileId: string,
  contact: ContactData
) {
  try {
    const session = await validateToken(token);
    if (!session) return { error: "Invalid or expired form link" };

    const admin = createSupabaseAdmin();
    const record = {
      assessment_id: session.assessment_id,
      site_id: session.site_id,
      tenant_id: session.tenant_id,
      name: contact.name,
      title: contact.title || null,
      email: contact.email || null,
      phone: contact.phone || null,
      is_primary: contact.is_primary,
      source: "baseline_form",
      last_edited_by: profileId,
      updated_at: new Date().toISOString(),
    };

    if (contact.id) {
      const { error } = await fromTable(admin, "site_contacts")
        .update(record)
        .eq("id", contact.id);
      if (error) return { error: error.message };
      await logChange(admin, session, profileId, "baseline_form_update", {
        table: "site_contacts",
        record_id: contact.id,
      });
      return { id: contact.id };
    } else {
      const { data, error } = await fromTable(admin, "site_contacts")
        .insert(record)
        .select("id")
        .single();
      if (error) return { error: error.message };
      await logChange(admin, session, profileId, "baseline_form_update", {
        table: "site_contacts",
        action: "created",
        name: contact.name,
      });
      return { id: data.id };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function deleteBaselineContact(token: string, profileId: string, contactId: string) {
  try {
    const session = await validateToken(token);
    if (!session) return { error: "Invalid or expired form link" };

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "site_contacts")
      .delete()
      .eq("id", contactId)
      .eq("assessment_id", session.assessment_id);
    if (error) return { error: error.message };

    await logChange(admin, session, profileId, "baseline_form_update", {
      table: "site_contacts",
      action: "deleted",
      record_id: contactId,
    });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Contractors
// ═══════════════════════════════════════════════════════════════

export async function upsertBaselineContractor(
  token: string,
  profileId: string,
  contractor: ContractorData
) {
  try {
    const session = await validateToken(token);
    if (!session) return { error: "Invalid or expired form link" };

    const admin = createSupabaseAdmin();
    const record = {
      assessment_id: session.assessment_id,
      site_id: session.site_id,
      tenant_id: session.tenant_id,
      company_name: contractor.company_name,
      contractor_type: contractor.contractor_type || "",
      contact_name: contractor.contact_name || "",
      email: contractor.email || "",
      phone: contractor.phone || "",
      notes: contractor.notes || "",
      source: "baseline_form",
      last_edited_by: profileId,
      updated_at: new Date().toISOString(),
    };

    if (contractor.id) {
      const { error } = await fromTable(admin, "site_contractors")
        .update(record)
        .eq("id", contractor.id);
      if (error) return { error: error.message };
      await logChange(admin, session, profileId, "baseline_form_update", {
        table: "site_contractors",
        record_id: contractor.id,
      });
      return { id: contractor.id };
    } else {
      const { data, error } = await fromTable(admin, "site_contractors")
        .insert(record)
        .select("id")
        .single();
      if (error) return { error: error.message };
      await logChange(admin, session, profileId, "baseline_form_update", {
        table: "site_contractors",
        action: "created",
        company_name: contractor.company_name,
      });
      return { id: data.id };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function deleteBaselineContractor(token: string, profileId: string, contractorId: string) {
  try {
    const session = await validateToken(token);
    if (!session) return { error: "Invalid or expired form link" };

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "site_contractors")
      .delete()
      .eq("id", contractorId)
      .eq("assessment_id", session.assessment_id);
    if (error) return { error: error.message };

    await logChange(admin, session, profileId, "baseline_form_update", {
      table: "site_contractors",
      action: "deleted",
      record_id: contractorId,
    });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Equipment
// ═══════════════════════════════════════════════════════════════

export async function upsertBaselineEquipment(
  token: string,
  profileId: string,
  equipment: EquipmentData
) {
  try {
    const session = await validateToken(token);
    if (!session) return { error: "Invalid or expired form link" };

    const admin = createSupabaseAdmin();
    const record = {
      assessment_id: session.assessment_id,
      site_id: session.site_id,
      tenant_id: session.tenant_id,
      category: equipment.category,
      name: equipment.name,
      manufacturer: equipment.manufacturer || null,
      model: equipment.model || null,
      quantity: equipment.quantity || 1,
      specs: equipment.specs,
      notes: equipment.notes || null,
      source: "baseline_form",
      contributed_by: profileId,
      updated_at: new Date().toISOString(),
    };

    if (equipment.id) {
      const { error } = await fromTable(admin, "site_equipment")
        .update(record)
        .eq("id", equipment.id);
      if (error) return { error: error.message };
      await logChange(admin, session, profileId, "baseline_form_update", {
        table: "site_equipment",
        record_id: equipment.id,
        category: equipment.category,
      });
      return { id: equipment.id };
    } else {
      const { data, error } = await fromTable(admin, "site_equipment")
        .insert(record)
        .select("id")
        .single();
      if (error) return { error: error.message };
      await logChange(admin, session, profileId, "baseline_form_update", {
        table: "site_equipment",
        action: "created",
        category: equipment.category,
        name: equipment.name,
      });
      return { id: data.id };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function deleteBaselineEquipment(token: string, profileId: string, equipmentId: string) {
  try {
    const session = await validateToken(token);
    if (!session) return { error: "Invalid or expired form link" };

    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "site_equipment")
      .delete()
      .eq("id", equipmentId)
      .eq("assessment_id", session.assessment_id);
    if (error) return { error: error.message };

    await logChange(admin, session, profileId, "baseline_form_update", {
      table: "site_equipment",
      action: "deleted",
      record_id: equipmentId,
    });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Facility & System → site_operational_params
// ═══════════════════════════════════════════════════════════════

export async function upsertBaselineFacilityAndSystem(
  token: string,
  profileId: string,
  facility: Partial<FacilityData>,
  system: Partial<SystemData>
) {
  try {
    const session = await validateToken(token);
    if (!session) return { error: "Invalid or expired form link" };

    const admin = createSupabaseAdmin();

    // Build update payload from non-empty values
    const record: Record<string, unknown> = {
      assessment_id: session.assessment_id,
      site_id: session.site_id,
      tenant_id: session.tenant_id,
      last_edited_by: profileId,
      updated_at: new Date().toISOString(),
    };

    // Facility fields
    if (facility.facility_type !== undefined) record.facility_type = facility.facility_type || null;
    if (facility.product_notes !== undefined) record.product_notes = facility.product_notes || null;
    if (facility.operating_days_per_week !== undefined) record.operating_days_per_week = facility.operating_days_per_week;
    if (facility.daily_operational_hours !== undefined) record.daily_operational_hours = facility.daily_operational_hours;
    if (facility.runs_24_7 !== undefined) record.runs_24_7 = facility.runs_24_7;
    if (facility.has_blast_freezing !== undefined) record.has_blast_freezing = facility.has_blast_freezing;

    // System fields
    if (system.system_type !== undefined) record.system_type = system.system_type || null;
    if (system.refrigerant !== undefined) record.refrigerant = system.refrigerant || null;
    if (system.control_system !== undefined) record.control_system = system.control_system || null;
    if (system.control_hardware !== undefined) record.control_hardware = system.control_hardware || null;
    if (system.micro_panel_type !== undefined) record.micro_panel_type = system.micro_panel_type || null;
    if (system.has_sub_metering !== undefined) record.has_sub_metering = system.has_sub_metering;

    // Upsert — check if record exists first
    const { data: existing } = await fromTable(admin, "site_operational_params")
      .select("id")
      .eq("assessment_id", session.assessment_id)
      .maybeSingle();

    if (existing) {
      const { error } = await fromTable(admin, "site_operational_params")
        .update(record)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_operational_params")
        .insert(record);
      if (error) return { error: error.message };
    }

    await logChange(admin, session, profileId, "baseline_form_update", {
      table: "site_operational_params",
    });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Energy → site_tou_schedule
// ═══════════════════════════════════════════════════════════════

export async function upsertBaselineEnergy(
  token: string,
  profileId: string,
  energy: Partial<EnergyData>
) {
  try {
    const session = await validateToken(token);
    if (!session) return { error: "Invalid or expired form link" };

    const admin = createSupabaseAdmin();
    const record: Record<string, unknown> = {
      assessment_id: session.assessment_id,
      site_id: session.site_id,
      tenant_id: session.tenant_id,
      last_edited_by: profileId,
      updated_at: new Date().toISOString(),
    };

    // Map energy fields
    for (const [key, value] of Object.entries(energy)) {
      if (value !== undefined) {
        record[key] = value === "" ? null : value;
      }
    }

    const { data: existing } = await fromTable(admin, "site_tou_schedule")
      .select("id")
      .eq("assessment_id", session.assessment_id)
      .maybeSingle();

    if (existing) {
      const { error } = await fromTable(admin, "site_tou_schedule")
        .update(record)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_tou_schedule")
        .insert(record);
      if (error) return { error: error.message };
    }

    // Also update annual spend in savings analysis if provided
    if (energy.annual_energy_spend != null) {
      const { data: existingSavings } = await fromTable(admin, "site_savings_analysis")
        .select("id")
        .eq("assessment_id", session.assessment_id)
        .maybeSingle();

      if (existingSavings) {
        await fromTable(admin, "site_savings_analysis")
          .update({ annual_energy_spend: energy.annual_energy_spend })
          .eq("id", existingSavings.id);
      } else {
        await fromTable(admin, "site_savings_analysis")
          .insert({
            assessment_id: session.assessment_id,
            site_id: session.site_id,
            tenant_id: session.tenant_id,
            annual_energy_spend: energy.annual_energy_spend,
          });
      }
    }

    await logChange(admin, session, profileId, "baseline_form_update", {
      table: "site_tou_schedule",
    });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Operations → site_operations
// ═══════════════════════════════════════════════════════════════

export async function upsertBaselineOperations(
  token: string,
  profileId: string,
  operations: Partial<OperationsData>
) {
  try {
    const session = await validateToken(token);
    if (!session) return { error: "Invalid or expired form link" };

    const admin = createSupabaseAdmin();
    const record: Record<string, unknown> = {
      assessment_id: session.assessment_id,
      site_id: session.site_id,
      tenant_id: session.tenant_id,
      last_edited_by: profileId,
      updated_at: new Date().toISOString(),
    };

    for (const [key, value] of Object.entries(operations)) {
      if (value !== undefined) {
        record[key] = value === "" ? null : value;
      }
    }

    const { data: existing } = await fromTable(admin, "site_operations")
      .select("id")
      .eq("assessment_id", session.assessment_id)
      .maybeSingle();

    if (existing) {
      const { error } = await fromTable(admin, "site_operations")
        .update(record)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_operations")
        .insert(record);
      if (error) return { error: error.message };
    }

    await logChange(admin, session, profileId, "baseline_form_update", {
      table: "site_operations",
    });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Efficiency → site_labor_baseline
// ═══════════════════════════════════════════════════════════════

export async function upsertBaselineEfficiency(
  token: string,
  profileId: string,
  efficiency: Partial<EfficiencyData>
) {
  try {
    const session = await validateToken(token);
    if (!session) return { error: "Invalid or expired form link" };

    const admin = createSupabaseAdmin();
    const record: Record<string, unknown> = {
      assessment_id: session.assessment_id,
      site_id: session.site_id,
      tenant_id: session.tenant_id,
      last_edited_by: profileId,
      updated_at: new Date().toISOString(),
    };

    if (efficiency.headcount !== undefined) record.headcount = JSON.stringify(efficiency.headcount);
    if (efficiency.total_manual_hours_week !== undefined) record.total_manual_hours_week = efficiency.total_manual_hours_week;
    if (efficiency.pain_points !== undefined) record.pain_points = efficiency.pain_points || null;
    if (efficiency.manual_processes !== undefined) record.manual_processes = efficiency.manual_processes || null;
    if (efficiency.time_sinks !== undefined) record.time_sinks = efficiency.time_sinks || null;
    if (efficiency.automation_opportunities !== undefined) record.automation_opportunities = efficiency.automation_opportunities || null;

    const { data: existing } = await fromTable(admin, "site_labor_baseline")
      .select("id")
      .eq("assessment_id", session.assessment_id)
      .maybeSingle();

    if (existing) {
      const { error } = await fromTable(admin, "site_labor_baseline")
        .update(record)
        .eq("id", existing.id);
      if (error) return { error: error.message };
    } else {
      const { error } = await fromTable(admin, "site_labor_baseline")
        .insert(record);
      if (error) return { error: error.message };
    }

    await logChange(admin, session, profileId, "baseline_form_update", {
      table: "site_labor_baseline",
    });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Generate Baseline Form Link
// ═══════════════════════════════════════════════════════════════

export async function generateBaselineFormLink(
  siteId: string,
  tenantId: string,
  assessmentId: string
) {
  try {
    const admin = createSupabaseAdmin();

    // Check if an active baseline form token already exists
    const { data: existing } = await fromTable(admin, "assessment_interviews")
      .select("invite_token")
      .eq("assessment_id", assessmentId)
      .eq("form_type", "baseline")
      .in("status", ["pending", "submitted"])
      .maybeSingle();

    if (existing?.invite_token) {
      return { token: existing.invite_token };
    }

    // Generate a new token
    const token = crypto.randomUUID();
    const { error } = await fromTable(admin, "assessment_interviews")
      .insert({
        assessment_id: assessmentId,
        site_id: siteId,
        tenant_id: tenantId,
        invite_token: token,
        form_type: "baseline",
        status: "pending",
      });

    if (error) return { error: error.message };
    return { token };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Form Progress
// ═══════════════════════════════════════════════════════════════

export async function updateBaselineFormProgress(
  token: string,
  progress: Record<string, unknown>
) {
  try {
    const admin = createSupabaseAdmin();
    const { error } = await fromTable(admin, "assessment_interviews")
      .update({
        form_progress: progress,
        updated_at: new Date().toISOString(),
      })
      .eq("invite_token", token);
    if (error) return { error: error.message };
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function submitBaselineForm(token: string, profileId: string) {
  try {
    const session = await validateToken(token);
    if (!session) return { error: "Invalid or expired form link" };

    const admin = createSupabaseAdmin();

    // Mark as submitted (but NOT locked — it remains editable)
    const { error } = await fromTable(admin, "assessment_interviews")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("invite_token", token);

    if (error) return { error: error.message };

    // Create notification for CK team
    // Find CK user(s) who are assigned to this site/assessment
    const { data: assessment } = await fromTable(admin, "site_assessments")
      .select("assessed_by")
      .eq("id", session.assessment_id)
      .maybeSingle();

    if (assessment?.assessed_by) {
      const { data: site } = await fromTable(admin, "sites")
        .select("name")
        .eq("id", session.site_id)
        .single();

      await fromTable(admin, "notifications").insert({
        profile_id: assessment.assessed_by,
        tenant_id: session.tenant_id,
        type: "baseline_form_updated",
        title: "Baseline form submitted",
        body: `A site contact submitted baseline data for ${site?.name || "a site"}`,
        entity_type: "site",
        entity_id: session.site_id,
        read: false,
      });
    }

    await logChange(admin, session, profileId, "baseline_form_submitted", {
      table: "assessment_interviews",
    });
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

// ═══════════════════════════════════════════════════════════════
// Data Loading (for form hydration)
// ═══════════════════════════════════════════════════════════════

export async function getBaselineFormData(token: string) {
  try {
    const admin = createSupabaseAdmin();

    // Validate token and get session info
    const { data: interview } = await fromTable(admin, "assessment_interviews")
      .select("id, assessment_id, site_id, tenant_id, form_progress, status")
      .eq("invite_token", token)
      .single();

    if (!interview) return null;

    // Load site and customer info
    const { data: site } = await fromTable(admin, "sites")
      .select("id, name, tenant_id")
      .eq("id", interview.site_id)
      .single();

    const { data: customer } = await fromTable(admin, "customers")
      .select("id, name, logo_url")
      .eq("tenant_id", interview.tenant_id)
      .single();

    // Load existing baseline data in parallel
    const [contacts, equipment, operationalParams, touSchedule, operations, laborBaseline, contractors, attachments] =
      await Promise.all([
        fromTable(admin, "site_contacts")
          .select("*")
          .eq("assessment_id", interview.assessment_id)
          .order("sort_order"),
        fromTable(admin, "site_equipment")
          .select("*")
          .eq("assessment_id", interview.assessment_id)
          .order("sort_order"),
        fromTable(admin, "site_operational_params")
          .select("*")
          .eq("assessment_id", interview.assessment_id)
          .maybeSingle(),
        fromTable(admin, "site_tou_schedule")
          .select("*")
          .eq("assessment_id", interview.assessment_id)
          .maybeSingle(),
        fromTable(admin, "site_operations")
          .select("*")
          .eq("assessment_id", interview.assessment_id)
          .maybeSingle(),
        fromTable(admin, "site_labor_baseline")
          .select("*")
          .eq("assessment_id", interview.assessment_id)
          .maybeSingle(),
        fromTable(admin, "site_contractors")
          .select("*")
          .eq("assessment_id", interview.assessment_id)
          .order("sort_order")
          .then((res: { data: unknown[] | null }) => res)
          .catch(() => ({ data: [] })),
        fromTable(admin, "attachments")
          .select("*")
          .eq("entity_type", "site")
          .eq("entity_id", interview.site_id)
          .order("created_at", { ascending: false }),
      ]);

    return {
      context: {
        token,
        assessmentId: interview.assessment_id,
        siteId: interview.site_id,
        tenantId: interview.tenant_id,
        siteName: site?.name ?? "Site",
        customerName: customer?.name ?? "Customer",
        customerLogoUrl: customer?.logo_url ?? null,
      },
      formProgress: interview.form_progress ?? {},
      status: interview.status,
      contacts: contacts.data ?? [],
      equipment: equipment.data ?? [],
      operationalParams: operationalParams.data ?? null,
      touSchedule: touSchedule.data ?? null,
      operations: operations.data ?? null,
      laborBaseline: laborBaseline.data ?? null,
      contractors: contractors.data ?? [],
      attachments: attachments.data ?? [],
    };
  } catch {
    return null;
  }
}
