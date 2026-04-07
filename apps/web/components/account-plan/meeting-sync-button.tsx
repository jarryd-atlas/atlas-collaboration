"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

interface MeetingSyncButtonProps {
  userId: string;
}

export function MeetingSyncButton({ userId }: MeetingSyncButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ synced?: number; error?: string } | null>(null);
  const router = useRouter();

  async function handleSync() {
    setSyncing(true);
    setResult(null);

    try {
      const res = await fetch("/api/calendar/sync-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();

      if (data.error) {
        setResult({ error: data.error });
      } else {
        setResult({ synced: data.synced });
        router.refresh();
      }
    } catch {
      setResult({ error: "Sync failed" });
    }

    setSyncing(false);
    setTimeout(() => setResult(null), 5000);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync Meetings"}
      </button>

      {result && (
        <span className={`inline-flex items-center gap-1 text-xs ${
          result.error ? "text-red-500" : "text-green-600"
        }`}>
          {result.error ? (
            <>
              <AlertCircle className="h-3 w-3" />
              {result.error}
            </>
          ) : (
            <>
              <Check className="h-3 w-3" />
              {result.synced} meetings synced
            </>
          )}
        </span>
      )}
    </div>
  );
}
