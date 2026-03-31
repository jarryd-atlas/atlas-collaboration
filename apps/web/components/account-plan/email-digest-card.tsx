"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import type { EmailDigest } from "../../lib/actions/customer-emails";

interface EmailDigestCardProps {
  digest: EmailDigest | null;
  customerId: string;
  customerName: string;
  emailCount: number;
}

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; icon: typeof TrendingUp }> = {
  positive: { label: "Positive", color: "text-green-600 bg-green-50", icon: TrendingUp },
  neutral: { label: "Neutral", color: "text-gray-600 bg-gray-50", icon: Minus },
  cautious: { label: "Cautious", color: "text-amber-600 bg-amber-50", icon: AlertTriangle },
  at_risk: { label: "At Risk", color: "text-red-600 bg-red-50", icon: AlertTriangle },
};

const MOMENTUM_CONFIG: Record<string, { label: string; color: string }> = {
  accelerating: { label: "Accelerating", color: "text-green-600" },
  steady: { label: "Steady", color: "text-blue-600" },
  slowing: { label: "Slowing", color: "text-amber-600" },
  stalled: { label: "Stalled", color: "text-red-600" },
};

export function EmailDigestCard({ digest, customerId, customerName, emailCount }: EmailDigestCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localDigest, setLocalDigest] = useState<EmailDigest | null>(digest);
  const [showActions, setShowActions] = useState(false);

  async function generateDigest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/email-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, customerName }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setLocalDigest({
          id: "",
          customer_id: customerId,
          period_start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          period_end: new Date().toISOString(),
          email_count: emailCount,
          narrative: data.digest.narrative,
          key_topics: data.digest.key_topics || [],
          key_contacts: data.digest.key_contacts || [],
          action_items: data.digest.action_items || [],
          sentiment: data.digest.sentiment,
          momentum: data.digest.momentum,
          generated_at: new Date().toISOString(),
        });
      }
    } catch {
      setError("Failed to generate communication pulse");
    }
    setLoading(false);
  }

  // No digest and no emails
  if (!localDigest && emailCount === 0) return null;

  // No digest but has emails — show generate button
  if (!localDigest) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-900">Communication Pulse</h3>
          </div>
          <button
            onClick={generateDigest}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Analyzing {emailCount} emails...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate Pulse
              </>
            )}
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-500 mt-2">{error}</p>
        )}
        <p className="text-xs text-gray-400 mt-2">
          AI will analyze {emailCount} emails to generate a communication narrative
        </p>
      </div>
    );
  }

  // Show digest
  const sentimentCfg = SENTIMENT_CONFIG[localDigest.sentiment ?? "neutral"] ?? SENTIMENT_CONFIG.neutral!;
  const momentumCfg = MOMENTUM_CONFIG[localDigest.momentum ?? "steady"] ?? MOMENTUM_CONFIG.steady!;
  const SentimentIcon = sentimentCfg!.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-gray-900">Communication Pulse</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Sentiment badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sentimentCfg.color}`}>
            <SentimentIcon className="h-3 w-3" />
            {sentimentCfg.label}
          </span>
          {/* Momentum badge */}
          <span className={`text-[10px] font-medium ${momentumCfg.color}`}>
            {momentumCfg.label}
          </span>
          {/* Refresh */}
          <button
            onClick={generateDigest}
            disabled={loading}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="Regenerate pulse"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Narrative */}
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {localDigest.narrative}
      </div>

      {/* Topics */}
      {localDigest.key_topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {localDigest.key_topics.map((topic, i) => (
            <span
              key={i}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-medium"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* Action Items (collapsible) */}
      {localDigest.action_items.length > 0 && (
        <div>
          <button
            onClick={() => setShowActions(!showActions)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showActions ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {localDigest.action_items.length} action item{localDigest.action_items.length !== 1 ? "s" : ""} identified
          </button>
          {showActions && (
            <ul className="mt-1.5 space-y-1 pl-4">
              {localDigest.action_items.map((item, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                  <span className="text-gray-400 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Footer meta */}
      <p className="text-[10px] text-gray-300">
        Based on {localDigest.email_count} emails · Generated {new Date(localDigest.generated_at).toLocaleDateString()}
      </p>
    </div>
  );
}
