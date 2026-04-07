"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, ChevronDown, ChevronRight, Mail } from "lucide-react";
import type { EmailDigest } from "../../lib/actions/customer-emails";

interface EmailDigestCardProps {
  digest: EmailDigest | null;
  customerId: string;
  customerName: string;
  emailCount: number;
}

export function EmailDigestCard({ digest, customerId, customerName, emailCount }: EmailDigestCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localDigest, setLocalDigest] = useState<EmailDigest | null>(digest);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  function toggleSection(team: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(team)) {
        next.delete(team);
      } else {
        next.add(team);
      }
      return next;
    });
  }

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
          team_sections: data.digest.team_sections || [],
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
          AI will analyze {emailCount} emails to generate a communication summary
        </p>
      </div>
    );
  }

  // Show digest with team sections
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-gray-900">Communication Pulse</h3>
        </div>
        <button
          onClick={generateDigest}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
          title="Refresh pulse"
        >
          {loading ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </>
          )}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Team Sections */}
      <div className="space-y-2">
        {localDigest.team_sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.team);
          return (
            <div key={section.team} className="border border-gray-100 rounded-lg overflow-hidden">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.team)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                  )}
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                    {section.team_label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {section.total_emails} emails
                  </span>
                  <span>{section.total_threads} threads</span>
                </div>
              </button>

              {/* Section Body */}
              {!isCollapsed && (
                <div className="px-3 py-2 space-y-2">
                  {/* AI Summary */}
                  <p className="text-xs text-gray-500 italic leading-relaxed">
                    {section.summary}
                  </p>

                  {/* Members */}
                  <div className="space-y-1.5">
                    {section.members.map((member) => (
                      <div
                        key={member.email}
                        className="flex items-start justify-between gap-2 py-1 border-t border-gray-50 first:border-t-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-800 truncate">
                              {member.name}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {member.email_count} emails · {member.thread_count} threads
                            </span>
                          </div>
                          {member.recent_subjects.length > 0 && (
                            <p className="text-[10px] text-gray-400 truncate mt-0.5">
                              {member.recent_subjects.join(", ")}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-300 whitespace-nowrap flex-shrink-0">
                          {new Date(member.last_email_date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-gray-300">
        Based on {localDigest.email_count} emails · Generated{" "}
        {new Date(localDigest.generated_at).toLocaleDateString()}
      </p>
    </div>
  );
}
