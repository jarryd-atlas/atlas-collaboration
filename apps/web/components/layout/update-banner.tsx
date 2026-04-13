"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, LogOut, X } from "lucide-react";

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const CLIENT_BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "unknown";

export function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [dismissed, setDismissed] = useState<"update" | "reauth" | null>(null);

  // Check for new app version
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function checkVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = await res.json();
        if (buildId && buildId !== CLIENT_BUILD_ID) {
          setUpdateAvailable(true);
        }
      } catch {
        // Silently ignore — network errors shouldn't bother the user
      }
    }

    // First check after 30s (don't slow down initial load)
    const initial = setTimeout(checkVersion, 30_000);
    timer = setInterval(checkVersion, CHECK_INTERVAL);

    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, []);

  // Check if re-auth is needed (once on mount)
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth-check");
        if (!res.ok) return;
        const { needsReauth: reauth } = await res.json();
        if (reauth) setNeedsReauth(true);
      } catch {
        // Silently ignore
      }
    }
    checkAuth();
  }, []);

  const handleRefresh = useCallback(() => {
    window.location.reload();
  }, []);

  const handleSignOut = useCallback(async () => {
    // Navigate to login which will trigger sign-out flow
    window.location.href = "/login";
  }, []);

  // Re-auth banner takes priority
  if (needsReauth && dismissed !== "reauth") {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-blue-600 px-4 py-2 text-sm font-medium text-white">
        <LogOut className="h-4 w-4 shrink-0" />
        <span>New features require updated permissions. Please sign out and back in to enable them.</span>
        <button
          onClick={handleSignOut}
          className="ml-1 rounded-md bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-colors"
        >
          Sign Out
        </button>
        <button
          onClick={() => setDismissed("reauth")}
          className="ml-1 p-1 rounded hover:bg-white/20 transition-colors"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (updateAvailable && dismissed !== "update") {
    return (
      <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-gray-900 px-4 py-2 text-sm font-medium text-white">
        <RefreshCw className="h-4 w-4 shrink-0" />
        <span>A new version of ATLAS is available.</span>
        <button
          onClick={handleRefresh}
          className="ml-1 rounded-md bg-brand-green px-3 py-1 text-xs font-semibold text-gray-900 hover:bg-brand-green/80 transition-colors"
        >
          Refresh Now
        </button>
        <button
          onClick={() => setDismissed("update")}
          className="ml-1 p-1 rounded hover:bg-white/20 transition-colors"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
