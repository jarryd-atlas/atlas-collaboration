"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

export function BackfillButton() {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{
    processed: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  async function handleBackfill() {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    setLoading(true);
    setShowConfirm(false);
    setResult(null);

    try {
      const res = await fetch("/api/ai/backfill-success-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Backfill failed");
      setResult(data);
    } catch (err: any) {
      setResult({ processed: 0, skipped: 0, errors: [err.message] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {loading ? (
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-md border border-purple-100">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Backfilling...
        </div>
      ) : (
        <button
          onClick={handleBackfill}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors border border-purple-100"
        >
          <Sparkles className="h-3.5 w-3.5" />
          AI Backfill
        </button>
      )}

      {showConfirm && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">
            Research &amp; generate success plans for companies without them?
          </span>
          <button
            onClick={handleBackfill}
            className="px-2 py-0.5 text-purple-700 bg-purple-100 rounded hover:bg-purple-200"
          >
            Yes
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="px-2 py-0.5 text-gray-500 bg-gray-100 rounded hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      )}

      {result && (
        <div className="flex items-center gap-1.5 text-xs">
          {result.errors.length === 0 ? (
            <>
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              <span className="text-gray-600">
                {result.processed} processed, {result.skipped} skipped
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-gray-600">
                {result.processed} done, {result.errors.length} errors
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
