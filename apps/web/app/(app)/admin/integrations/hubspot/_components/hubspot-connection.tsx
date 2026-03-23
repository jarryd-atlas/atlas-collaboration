"use client";

import { useState } from "react";
import { Button } from "../../../../../../components/ui/button";
import { Input } from "../../../../../../components/ui/input";
import { Plug, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { saveHubSpotConfig, disconnectHubSpot } from "../../../../../../lib/actions/hubspot";
import type { HubSpotConfig } from "../../../../../../lib/hubspot/types";

export function HubSpotConnection({ config }: { config: HubSpotConfig | null }) {
  const [showDialog, setShowDialog] = useState(false);
  const [token, setToken] = useState("");
  const [portalId, setPortalId] = useState(config?.portal_id ?? "");
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = !!config?.is_active;

  async function handleSave() {
    if (!token.trim() || !portalId.trim()) {
      setError("Both fields are required");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveHubSpotConfig(token.trim(), portalId.trim());
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setShowDialog(false);
      setToken("");
    }
  }

  async function handleDisconnect() {
    await disconnectHubSpot();
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-lg">
            <Plug className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Connection</h2>
            <div className="flex items-center gap-2 mt-0.5">
              {isConnected ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-700">Connected — Portal {config.portal_id}</span>
                  {config.last_synced_at && (
                    <span className="text-xs text-gray-400 ml-2">
                      Last synced {new Date(config.last_synced_at).toLocaleDateString()}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-500">Not connected</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {isConnected && (
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          )}
          <Button size="sm" onClick={() => setShowDialog(true)}>
            {isConnected ? "Update Token" : "Connect"}
          </Button>
        </div>
      </div>

      {/* Config Dialog (inline expand) */}
      {showDialog && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
          <p className="text-sm text-gray-500">
            Create a <a href="https://app.hubspot.com/private-apps/" target="_blank" rel="noopener" className="underline text-blue-600">HubSpot Private App</a> with CRM scopes (crm.objects.deals.read, crm.objects.deals.write, crm.schemas.deals.read) and paste the token below.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Portal ID</label>
              <Input
                value={portalId}
                onChange={(e) => setPortalId(e.target.value)}
                placeholder="e.g. 21770553"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Access Token</label>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="pat-na1-..."
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowDialog(false); setError(null); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Connection"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
