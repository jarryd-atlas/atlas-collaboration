import { redirect } from "next/navigation";
import { requireSession, createSupabaseAdmin } from "../../../../../lib/supabase/server";
import { NEW_BUSINESS_PIPELINE_ID } from "../../../../../lib/hubspot/constants";
import { FunnelSnapshotsClient, type FunnelRow } from "./funnel-client";

export default async function DealFunnelPage() {
  const { claims } = await requireSession();
  if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
    redirect("/");
  }

  const tenantId = claims.tenantId!;
  const admin = createSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("deal_funnel_snapshots")
    .select(
      "snapshot_month, stage_id, stage_label, stage_order, deal_count, total_amount",
    )
    .eq("tenant_id", tenantId)
    .eq("pipeline_id", NEW_BUSINESS_PIPELINE_ID)
    .order("snapshot_month", { ascending: false })
    .order("stage_order", { ascending: true });

  const rows: FunnelRow[] = (data ?? []) as FunnelRow[];

  // Check HubSpot connection status to decide whether to show empty state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: config } = await (admin as any)
    .from("hubspot_config")
    .select("id, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  const isConnected = !!config;
  const isSuperAdmin = claims.appRole === "super_admin";

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Business Deal Funnel</h1>
        <p className="text-gray-500 mt-1">
          Month-over-month snapshots of the HubSpot New Business pipeline. Counts and total
          amounts per stage are recomputed on the 1st of each month and can be refreshed
          manually below.
        </p>
      </div>

      {!isConnected ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
          HubSpot is not connected for this tenant. Connect it on the{" "}
          <a href="/admin/integrations/hubspot" className="text-gray-900 underline">
            HubSpot integration page
          </a>{" "}
          first.
        </div>
      ) : (
        <FunnelSnapshotsClient rows={rows} canTrigger={isSuperAdmin} />
      )}

      <p className="text-xs text-gray-400">
        Amount column reflects each deal&apos;s <em>current</em> amount, not the historical
        amount at snapshot time. HubSpot does not expose per-stage historical amounts
        without Enterprise add-ons.
      </p>
    </div>
  );
}
