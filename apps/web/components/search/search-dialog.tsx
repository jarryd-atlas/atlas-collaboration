"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { searchAll, type SearchResult } from "../../lib/mock-data";
import { Search, MapPin, Target, ListTodo, X } from "lucide-react";
import { cn } from "../../lib/utils";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  site: <MapPin className="h-4 w-4" />,
  milestone: <Target className="h-4 w-4" />,
  task: <ListTodo className="h-4 w-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  site: "Sites",
  milestone: "Milestones",
  task: "Tasks",
};

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Cmd+K handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        setResults(searchAll(query));
        setSelectedIndex(0);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type]!.push(r);
    return acc;
  }, {});

  const flatResults = results;

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      if (result.href !== "#") {
        router.push(result.href);
      }
    },
    [router],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flatResults[selectedIndex]) {
      handleSelect(flatResults[selectedIndex]!);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="relative mx-auto mt-[15vh] max-w-xl w-full px-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-dropdown overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-gray-100">
            <Search className="h-5 w-5 text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search sites, milestones, tasks..."
              className="flex-1 py-4 text-sm bg-transparent outline-none placeholder:text-gray-400"
            />
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {query.trim() && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No results found for &ldquo;{query}&rdquo;
              </div>
            )}

            {Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <p className="px-4 pt-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {TYPE_LABELS[type] ?? type}
                </p>
                {items.map((result) => {
                  const globalIdx = flatResults.indexOf(result);
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        globalIdx === selectedIndex
                          ? "bg-gray-50"
                          : "hover:bg-gray-50",
                      )}
                    >
                      <span className="text-gray-400">
                        {TYPE_ICONS[result.type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {result.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {result.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          {!query.trim() && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
              Type to search across sites, milestones, and tasks
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
