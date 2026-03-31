"use client";

import { useState, useCallback } from "react";
import { createStakeholder } from "../../lib/actions/account-plan";
import { Sparkles, Check, X, Loader2, UserPlus, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../lib/utils";
import type { Stakeholder } from "./org-chart-node";

interface Suggestion {
  name: string;
  title: string | null;
  department: string | null;
  reports_to_name: string | null;
  // UI state
  selected: boolean;
  added: boolean;
}

interface AILeadershipLookupProps {
  customerName: string;
  customerDomain: string | null;
  accountPlanId: string;
  tenantId: string;
  existingStakeholders: Stakeholder[];
}

export function AILeadershipLookup({
  customerName,
  customerDomain,
  accountPlanId,
  tenantId,
  existingStakeholders,
}: AILeadershipLookupProps) {
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    setSearching(true);
    setError(null);
    setSuggestions([]);
    setShowResults(true);

    try {
      const res = await fetch("/api/ai/suggest-leadership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          domain: customerDomain,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to search");
      }

      const { suggestions: results } = await res.json();

      // Mark existing contacts as already added
      const existingNames = new Set(
        existingStakeholders.map((s) => s.name.toLowerCase())
      );

      setSuggestions(
        results.map((s: any) => ({
          ...s,
          selected: !existingNames.has(s.name.toLowerCase()),
          added: existingNames.has(s.name.toLowerCase()),
        }))
      );
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSearching(false);
    }
  }, [customerName, customerDomain, existingStakeholders]);

  const toggleSuggestion = useCallback((index: number) => {
    setSuggestions((prev) =>
      prev.map((s, i) =>
        i === index && !s.added ? { ...s, selected: !s.selected } : s
      )
    );
  }, []);

  const handleAddSelected = useCallback(async () => {
    const toAdd = suggestions.filter((s) => s.selected && !s.added);
    if (toAdd.length === 0) return;

    setAdding(true);

    // Build a name → id map for reports_to linking
    // First pass: add all contacts, track created IDs
    const nameToId: Record<string, string> = {};

    // Map existing stakeholders
    existingStakeholders.forEach((s) => {
      nameToId[s.name.toLowerCase()] = s.id;
    });

    // Add in order (most senior first) so parents exist when children are added
    for (const suggestion of toAdd) {
      // Find reports_to ID
      let reportsTo: string | null = null;
      if (suggestion.reports_to_name) {
        reportsTo =
          nameToId[suggestion.reports_to_name.toLowerCase()] || null;
      }

      const result = await createStakeholder(accountPlanId, tenantId, {
        name: suggestion.name,
        title: suggestion.title || undefined,
        department: suggestion.department || undefined,
        reports_to: reportsTo,
        is_ai_suggested: true,
      });

      if (result.success && result.id) {
        nameToId[suggestion.name.toLowerCase()] = result.id;
      }
    }

    // Mark all as added
    setSuggestions((prev) =>
      prev.map((s) => (s.selected ? { ...s, added: true, selected: false } : s))
    );
    setAdding(false);
  }, [suggestions, existingStakeholders, accountPlanId, tenantId]);

  const selectedCount = suggestions.filter(
    (s) => s.selected && !s.added
  ).length;
  const addedCount = suggestions.filter((s) => s.added).length;

  return (
    <div>
      {/* Trigger button */}
      {!showResults && (
        <button
          onClick={handleSearch}
          disabled={searching}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 disabled:opacity-50 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          {searching ? "Searching..." : "Find Leadership"}
        </button>
      )}

      {/* Results panel */}
      {showResults && (
        <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-purple-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-purple-600" />
              <span className="text-xs font-semibold text-gray-900">
                AI Leadership Search
              </span>
              {!searching && suggestions.length > 0 && (
                <span className="text-[10px] text-gray-500">
                  {suggestions.length} found
                  {addedCount > 0 && ` · ${addedCount} already in chart`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!searching && suggestions.length > 0 && (
                <button
                  onClick={handleSearch}
                  className="text-[10px] text-purple-600 hover:text-purple-800"
                >
                  Search again
                </button>
              )}
              <button
                onClick={() => setShowResults(false)}
                className="p-0.5 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Loading state */}
          {searching && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="h-4 w-4 text-purple-600 animate-spin" />
              <span className="text-sm text-gray-500">
                Searching for {customerName} leadership...
              </span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="px-4 py-3 text-sm text-red-600 bg-red-50">
              {error}
            </div>
          )}

          {/* Suggestions list */}
          {!searching && suggestions.length > 0 && (
            <>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 transition-colors",
                      s.added
                        ? "bg-green-50/50 opacity-60"
                        : s.selected
                        ? "bg-purple-50/30"
                        : "hover:bg-gray-50"
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleSuggestion(i)}
                      disabled={s.added}
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        s.added
                          ? "bg-green-100 border-green-300"
                          : s.selected
                          ? "bg-purple-600 border-purple-600"
                          : "border-gray-300 hover:border-gray-400"
                      )}
                    >
                      {(s.selected || s.added) && (
                        <Check
                          className={cn(
                            "h-2.5 w-2.5",
                            s.added ? "text-green-600" : "text-white"
                          )}
                        />
                      )}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {s.name}
                        </span>
                        {s.added && (
                          <span className="text-[10px] text-green-600 font-medium">
                            Added
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        {s.title && <span>{s.title}</span>}
                        {s.title && s.department && (
                          <span className="text-gray-300">·</span>
                        )}
                        {s.department && <span>{s.department}</span>}
                      </div>
                      {s.reports_to_name && (
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Reports to: {s.reports_to_name}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => {
                    const allSelected = suggestions.every(
                      (s) => s.selected || s.added
                    );
                    setSuggestions((prev) =>
                      prev.map((s) =>
                        s.added ? s : { ...s, selected: !allSelected }
                      )
                    );
                  }}
                  className="text-[10px] text-gray-500 hover:text-gray-700"
                >
                  {suggestions.every((s) => s.selected || s.added)
                    ? "Deselect all"
                    : "Select all"}
                </button>
                <button
                  onClick={handleAddSelected}
                  disabled={selectedCount === 0 || adding}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  {adding ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3 w-3" /> Add {selectedCount}{" "}
                      to Org Chart
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* Empty state */}
          {!searching && !error && suggestions.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              No leadership information found for {customerName}.
              <br />
              <span className="text-xs text-gray-400">
                Try adding contacts manually instead.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
