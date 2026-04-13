"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, Building2 } from "lucide-react";
import { searchCustomers } from "../../lib/actions";

interface CustomerResult {
  id: string;
  name: string;
  slug: string;
}

interface CustomerSearchProps {
  onSelect: (customer: CustomerResult) => void;
  excludeCustomerId?: string;
  placeholder?: string;
}

export function CustomerSearch({ onSelect, excludeCustomerId, placeholder = "Search companies..." }: CustomerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await searchCustomers(query.trim());
      if ("customers" in res && res.customers) {
        const filtered = excludeCustomerId
          ? res.customers.filter((c) => c.id !== excludeCustomerId)
          : res.customers;
        setResults(filtered);
      }
      setLoading(false);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, excludeCustomerId]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-8 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green/50"
      />
      {query && (
        <button
          onClick={() => { setQuery(""); setResults([]); setOpen(false); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100 text-gray-400"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && query.trim().length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-gray-400">Searching...</div>
          )}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-3 py-3 text-sm text-gray-400">No companies found</div>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c);
                setQuery(c.name);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
            >
              <Building2 className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-900">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
