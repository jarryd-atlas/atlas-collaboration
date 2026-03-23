"use client";

import { useState } from "react";
import { Button } from "../../../../../../components/ui/button";
import { RefreshCw, Activity, CheckCircle, XCircle, Clock, ArrowRight, ArrowLeft } from "lucide-react";
import { syncHubSpotSite, syncAllHubSpotSites } from "../../../../../../lib/actions/hubspot";
import type { HubSpotSiteLink, HubSpotSyncLogEntry, SyncFieldChange } from "../../../../../../lib/hubspot/types";

export function SyncDashboard({
  siteLinks,
  syncLog,
}: {
  siteLinks: HubSpotSiteLink[];
  syncLog: HubSpotSyncLogEntry[];
}) {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  async function handleSyncSite(linkId: string) {
    setSyncing(linkId);
    await syncHubSpotSite(linkId);
    setSyncing(null);
  }

  async function handleSyncAll() {
    setSyncingAll(true);
    await syncAllHubSpotSites();
    setSyncingAll(false);
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg">
            <Activity className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Sync</h2>
            <p className="text-sm text-gray-500">Manually trigger data sync between systems.</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleSyncAll}
          disabled={syncingAll}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${syncingAll ? "animate-spin" : ""}`} />
          {syncingAll ? "Syncing All..." : "Sync All"}
        </Button>
      </div>

      {/* Per-site sync buttons */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {siteLinks.map((link) => (
          <div
            key={link.id}
            className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-md"
          >
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-900 truncate block">
                {link.site?.name ?? link.site_id}
              </span>
              <span className="text-xs text-gray-400 truncate block">
                {link.deal_name ?? `Deal #${link.hubspot_deal_id}`}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSyncSite(link.id)}
              disabled={syncing === link.id}
              className="ml-2 flex-shrink-0"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${syncing === link.id ? "animate-spin" : ""}`} />
              {syncing === link.id ? "Syncing" : "Sync"}
            </Button>
          </div>
        ))}
      </div>

      {/* Sync log */}
      <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Sync Activity</h3>
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Time</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Fields Changed</th>
              <th className="text-left px-4 py-2 font-medium text-gray-600">Trigger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {syncLog.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  No sync activity yet. Click &quot;Sync&quot; to start.
                </td>
              </tr>
            ) : (
              syncLog.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {new Date(entry.started_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <SyncStatusBadge status={entry.status} error={entry.error} />
                  </td>
                  <td className="px-4 py-2">
                    <SyncFieldsSummary changes={entry.fields_synced} />
                  </td>
                  <td className="px-4 py-2 text-gray-500 capitalize text-xs">{entry.triggered_by}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SyncStatusBadge({ status, error }: { status: string; error: string | null }) {
  switch (status) {
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
          <CheckCircle className="h-3 w-3" /> Completed
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full" title={error ?? ""}>
          <XCircle className="h-3 w-3" /> Failed
        </span>
      );
    case "partial":
      return (
        <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
          Partial
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
          <RefreshCw className="h-3 w-3 animate-spin" /> Running
        </span>
      );
  }
}

function SyncFieldsSummary({ changes }: { changes: SyncFieldChange[] }) {
  if (!changes || changes.length === 0) {
    return <span className="text-gray-400 text-xs">No changes</span>;
  }

  const toApp = changes.filter((c) => c.direction === "to_app").length;
  const toHs = changes.filter((c) => c.direction === "to_hubspot").length;

  return (
    <div className="flex items-center gap-2 text-xs">
      {toApp > 0 && (
        <span className="inline-flex items-center gap-0.5 text-blue-600">
          <ArrowRight className="h-3 w-3" /> {toApp} to app
        </span>
      )}
      {toHs > 0 && (
        <span className="inline-flex items-center gap-0.5 text-green-600">
          <ArrowLeft className="h-3 w-3" /> {toHs} to HubSpot
        </span>
      )}
    </div>
  );
}
