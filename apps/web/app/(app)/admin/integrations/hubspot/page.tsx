import { requireSession } from "../../../../../lib/supabase/server";
import { getHubSpotConfig, getHubSpotSiteLinks, getHubSpotFieldMappings, getHubSpotSyncLog } from "../../../../../lib/data/hubspot-queries";
import { redirect } from "next/navigation";
import { HubSpotConnection } from "./_components/hubspot-connection";
import { DealLinker } from "./_components/deal-linker";
import { FieldMappings } from "./_components/field-mappings";
import { SyncDashboard } from "./_components/sync-dashboard";

export default async function HubSpotIntegrationPage() {
  const { claims } = await requireSession();
  if (claims.appRole !== "super_admin" && claims.appRole !== "admin") {
    redirect("/");
  }

  const tenantId = claims.tenantId!;
  const [config, siteLinks, fieldMappings, syncLog] = await Promise.all([
    getHubSpotConfig(tenantId),
    getHubSpotSiteLinks(tenantId),
    getHubSpotFieldMappings(tenantId),
    getHubSpotSyncLog(tenantId, { limit: 20 }),
  ]);

  const isConnected = !!config?.is_active;

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">HubSpot Integration</h1>
        <p className="text-gray-500 mt-1">
          Connect HubSpot deals to sites and sync data between systems.
        </p>
      </div>

      {/* Connection */}
      <HubSpotConnection config={config} />

      {/* Deal Linker — only show when connected */}
      {isConnected && <DealLinker siteLinks={siteLinks} />}

      {/* Field Mappings */}
      {isConnected && <FieldMappings mappings={fieldMappings} />}

      {/* Sync Dashboard */}
      {isConnected && siteLinks.length > 0 && (
        <SyncDashboard siteLinks={siteLinks} syncLog={syncLog} />
      )}
    </div>
  );
}
