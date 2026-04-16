"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, requireSession } from "../supabase/server";
import { NEW_BUSINESS_PIPELINE_ID } from "../hubspot/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (admin: ReturnType<typeof createSupabaseAdmin>, table: string) =>
  (admin as any).from(table);

interface ActionResult {
  error?: string;
  success?: boolean;
  jobId?: string;
}

async function enqueueSnapshotJob(
  mode: "backfill" | "current_month",
): Promise<ActionResult> {
  try {
    const { claims } = await requireSession();
    if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
      return { error: "Forbidden: admin only" };
    }

    const tenantId = claims.tenantId;
    if (!tenantId) return { error: "Missing tenant" };

    const admin = createSupabaseAdmin();

    // Verify HubSpot is connected for this tenant before queueing.
    const { data: config } = await fromTable(admin, "hubspot_config")
      .select("id, is_active")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();

    if (!config) return { error: "HubSpot is not connected for this tenant" };

    const { data: job, error: jobError } = await fromTable(admin, "job_queue")
      .insert({
        type: "snapshot_deal_funnel",
        payload: {
          tenant_id: tenantId,
          pipeline_id: NEW_BUSINESS_PIPELINE_ID,
          mode,
        },
        status: "pending",
      })
      .select("id")
      .single();

    if (jobError) return { error: jobError.message };

    revalidatePath("/admin/sales/funnel");
    return { success: true, jobId: job.id as string };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "An unexpected error occurred",
    };
  }
}

/** Queue a full backfill: recomputes every month since the earliest New Business deal. */
export async function triggerBackfill(): Promise<ActionResult> {
  return enqueueSnapshotJob("backfill");
}

/** Queue a refresh of just the most-recent month's snapshot. */
export async function triggerCurrentMonth(): Promise<ActionResult> {
  return enqueueSnapshotJob("current_month");
}
