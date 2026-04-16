"use server";

import { createSupabaseAdmin } from "../supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

export interface LogActivityParams {
  tenantId: string;
  actorId: string;
  entityType: string; // 'site' | 'section_status' | 'info_request' | 'task' | 'milestone' | 'document'
  entityId: string;
  action: string; // 'status_changed' | 'created' | 'responded' | 'resolved' | 'uploaded' | 'completed' | 'assigned'
  changes?: Record<string, unknown>;
  siteId?: string | null;
  customerId?: string | null;
  customerVisible?: boolean;
}

/**
 * Centralized activity logging utility.
 * Called from other server actions that already have session context.
 * Non-critical — never throws; failures are silently caught.
 */
export async function logActivity(params: LogActivityParams) {
  try {
    const admin = createSupabaseAdmin();
    await fromTable(admin, "activity_log").insert({
      tenant_id: params.tenantId,
      actor_id: params.actorId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      changes: params.changes ?? {},
      site_id: params.siteId ?? null,
      customer_id: params.customerId ?? null,
      customer_visible: params.customerVisible ?? false,
    });
  } catch {
    // Non-critical — don't fail the calling action
  }
}

/**
 * Helper to look up customer_id for a given site_id.
 * Used when logging activity and the caller only has siteId.
 */
export async function getCustomerIdForSite(siteId: string): Promise<string | null> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin
      .from("sites")
      .select("customer_id")
      .eq("id", siteId)
      .single();
    return (data as any)?.customer_id ?? null;
  } catch {
    return null;
  }
}
