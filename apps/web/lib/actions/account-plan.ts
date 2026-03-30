"use server";

import { createSupabaseAdmin } from "../supabase/server";
import { revalidatePath } from "next/cache";

// NOTE: Account plan tables not yet in generated Supabase types — cast to any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (sb: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (sb as any).from(table);

// ─── Account Plan ───────────────────────────────────────────

export async function upsertAccountPlan(
  customerId: string,
  tenantId: string,
  data: {
    account_stage?: string;
    strategy_notes?: string;
    whitespace_notes?: string;
    expansion_targets?: string;
    competitive_landscape?: string;
    win_themes?: string;
    total_addressable_sites?: number;
  },
  profileId?: string
) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"account_plans")
    .upsert(
      { customer_id: customerId, tenant_id: tenantId, ...data, created_by: profileId },
      { onConflict: "customer_id" }
    );

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

export async function updateAccountStage(customerId: string, stage: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"account_plans")
    .update({ account_stage: stage })
    .eq("customer_id", customerId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

// ─── Stakeholders ───────────────────────────────────────────

export async function createStakeholder(
  accountPlanId: string,
  tenantId: string,
  data: {
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    department?: string;
    stakeholder_role?: string;
    relationship_strength?: string;
    strategy_notes?: string;
    notes?: string;
    reports_to?: string | null;
    is_ai_suggested?: boolean;
  }
) {
  const supabase = createSupabaseAdmin();
  const { data: result, error } = await fromTable(supabase,"account_stakeholders")
    .insert({ account_plan_id: accountPlanId, tenant_id: tenantId, ...data })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true, id: result.id };
}

export async function updateStakeholder(
  stakeholderId: string,
  data: {
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    department?: string;
    stakeholder_role?: string;
    relationship_strength?: string;
    strategy_notes?: string;
    notes?: string;
    reports_to?: string | null;
    is_ai_suggested?: boolean;
  }
) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"account_stakeholders")
    .update(data)
    .eq("id", stakeholderId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

export async function deleteStakeholder(stakeholderId: string) {
  const supabase = createSupabaseAdmin();
  // First, unlink any children (set their reports_to to null)
  await fromTable(supabase,"account_stakeholders")
    .update({ reports_to: null })
    .eq("reports_to", stakeholderId);

  const { error } = await fromTable(supabase,"account_stakeholders")
    .delete()
    .eq("id", stakeholderId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

export async function updateStakeholderParent(
  stakeholderId: string,
  reportsTo: string | null
) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"account_stakeholders")
    .update({ reports_to: reportsTo })
    .eq("id", stakeholderId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

// ─── Success Plan Goals ─────────────────────────────────────

export async function createGoal(
  accountPlanId: string,
  tenantId: string,
  data: { title: string; description?: string },
  profileId?: string
) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"success_plan_goals")
    .insert({
      account_plan_id: accountPlanId,
      tenant_id: tenantId,
      ...data,
      created_by: profileId,
    });

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

export async function updateGoal(
  goalId: string,
  data: { title?: string; description?: string }
) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"success_plan_goals")
    .update(data)
    .eq("id", goalId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

export async function toggleGoalAchieved(goalId: string, isAchieved: boolean) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"success_plan_goals")
    .update({ is_achieved: isAchieved })
    .eq("id", goalId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

export async function deleteGoal(goalId: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"success_plan_goals")
    .delete()
    .eq("id", goalId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

// ─── Success Plan Milestones ────────────────────────────────

export async function createSuccessMilestone(
  accountPlanId: string,
  tenantId: string,
  data: {
    title: string;
    description?: string;
    target_date?: string;
    status?: string;
  },
  profileId?: string
) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"success_plan_milestones")
    .insert({
      account_plan_id: accountPlanId,
      tenant_id: tenantId,
      ...data,
      created_by: profileId,
    });

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

export async function updateSuccessMilestone(
  milestoneId: string,
  data: {
    title?: string;
    description?: string;
    target_date?: string | null;
    completed_date?: string | null;
    status?: string;
    evidence_notes?: string;
  }
) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"success_plan_milestones")
    .update(data)
    .eq("id", milestoneId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

export async function deleteSuccessMilestone(milestoneId: string) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"success_plan_milestones")
    .delete()
    .eq("id", milestoneId);

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}

// ─── Enterprise Deals ───────────────────────────────────────

export async function upsertEnterpriseDeal(
  customerId: string,
  tenantId: string,
  data: {
    deal_name: string;
    target_value?: number;
    deal_stage?: string;
    target_close_date?: string | null;
    hubspot_deal_id?: string;
    notes?: string;
  },
  profileId?: string
) {
  const supabase = createSupabaseAdmin();
  const { error } = await fromTable(supabase,"enterprise_deals")
    .upsert(
      { customer_id: customerId, tenant_id: tenantId, ...data, created_by: profileId },
      { onConflict: "customer_id" }
    );

  if (error) return { error: error.message };
  revalidatePath("/customers");
  return { success: true };
}
